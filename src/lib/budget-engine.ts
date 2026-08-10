/**
 * Budget engine — the "stay realistic" half of the app.
 *
 * The debt engine will happily tell you to throw every baht at your credit
 * card. This module is what stops it: it learns your *actual* spending rate
 * from tracked expenses, protects the part of your life you said you wanted to
 * keep, and only then reports what is genuinely spare.
 *
 *   available extra = income
 *                   − essentials (measured, never squeezed)
 *                   − lifestyle × keepRatio (the hobbies you're keeping)
 *                   − goal contributions (emergency fund first)
 *                   − safety buffer (% of income, for the unexpected)
 *                   − minimum debt payments
 */

import type {
  BudgetBreakdown,
  BudgetWarning,
  Category,
  CategorySpend,
  Debt,
  Expense,
  Goal,
  Settings,
  SpendProfile,
} from "./types";
import { DAYS_PER_MONTH, daysBetween, fromISODate, todayISO, toISODate, addDays } from "./date";
import { totalMinimums } from "./debt-engine";

/** Below this many days of history the averages are noise, not signal. */
const MIN_TRUSTED_DAYS = 10;

/**
 * Summarise real spending over a trailing window.
 *
 * Monthly recurring items (rent, subscriptions) are counted once per month
 * regardless of how many times they appear in the window — otherwise logging
 * rent twice in a 60-day window would double your "monthly rent".
 */
export function buildSpendProfile(
  expenses: Expense[],
  categories: Category[],
  windowDays: number,
  now: Date = new Date(),
): SpendProfile {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const cutoff = addDays(now, -(windowDays - 1));
  const cutoffISO = toISODate(cutoff);
  const today = todayISO(now);

  const inWindow = expenses.filter((e) => e.date >= cutoffISO && e.date <= today);

  // How much history do we actually have? A user three days in should not be
  // told their monthly spend based on three days of coffee.
  const oldest = expenses.reduce<string | null>(
    (min, e) => (min === null || e.date < min ? e.date : min),
    null,
  );
  const historyDays = oldest
    ? Math.min(windowDays, daysBetween(fromISODate(oldest), now) + 1)
    : 0;
  const effectiveDays = Math.max(1, historyDays);

  // Recurring items: take the largest logged amount per category as the
  // monthly figure. Rent logged at 12,000 and again at 12,000 is one rent.
  const recurringByCategory = new Map<string, number>();
  for (const e of inWindow.filter((e) => e.recurrence === "monthly")) {
    recurringByCategory.set(
      e.categoryId,
      Math.max(recurringByCategory.get(e.categoryId) ?? 0, e.amount),
    );
  }

  const oneOff = inWindow.filter((e) => e.recurrence !== "monthly");

  const totals = new Map<string, { total: number; count: number }>();
  for (const e of oneOff) {
    const cur = totals.get(e.categoryId) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    totals.set(e.categoryId, cur);
  }

  const byCategory: CategorySpend[] = [];
  let essentialMonthly = 0;
  let lifestyleMonthly = 0;

  const categoryIds = new Set([...totals.keys(), ...recurringByCategory.keys()]);
  for (const categoryId of categoryIds) {
    const t = totals.get(categoryId) ?? { total: 0, count: 0 };
    const recurring = recurringByCategory.get(categoryId) ?? 0;
    // one-off spend scaled to a month + the fixed monthly amount
    const monthlyAvg = (t.total / effectiveDays) * DAYS_PER_MONTH + recurring;
    const isEssential = catById.get(categoryId)?.isEssential ?? false;
    if (isEssential) essentialMonthly += monthlyAvg;
    else lifestyleMonthly += monthlyAvg;

    byCategory.push({
      categoryId,
      monthlyAvg,
      total: t.total + recurring,
      count: t.count + (recurring > 0 ? 1 : 0),
      share: 0,
    });
  }

  const totalMonthly = essentialMonthly + lifestyleMonthly;
  const recurringMonthly = [...recurringByCategory.values()].reduce((s, v) => s + v, 0);
  const variableMonthly = Math.max(0, totalMonthly - recurringMonthly);
  for (const c of byCategory) {
    c.share = totalMonthly > 0 ? c.monthlyAvg / totalMonthly : 0;
  }
  byCategory.sort((a, b) => b.monthlyAvg - a.monthlyAvg);

  const todayTotal = expenses
    .filter((e) => e.date === today)
    .reduce((s, e) => s + e.amount, 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = toISODate(addDays(now, -(6 - i)));
    const total = expenses
      .filter((e) => e.date === date && e.recurrence !== "monthly")
      .reduce((s, e) => s + e.amount, 0);
    return { date, total };
  });

  const dailyAvg = oneOff.reduce((s, e) => s + e.amount, 0) / effectiveDays;

  return {
    windowDays: historyDays,
    essentialMonthly,
    lifestyleMonthly,
    totalMonthly,
    variableMonthly,
    dailyAvg,
    todayTotal,
    last7,
    byCategory,
    hasEnoughData: historyDays >= MIN_TRUSTED_DAYS && inWindow.length >= 5,
  };
}

/**
 * Turn the spend profile into a payment capacity.
 *
 * The order matters: essentials and the protected slice of lifestyle come out
 * *before* debt, because a plan that ignores them is a plan the user abandons
 * in month two.
 */
export function computeBudget(
  settings: Settings,
  profile: SpendProfile,
  debts: Debt[],
  goals: Goal[],
): BudgetBreakdown {
  const warnings: BudgetWarning[] = [];
  const income = Math.max(0, settings.monthlyIncome);

  if (income <= 0) warnings.push("no_income");
  if (!profile.hasEnoughData) warnings.push("thin_data");

  const essentials = profile.essentialMonthly;
  const keep = clamp(settings.lifestyleKeepRatio, 0, 1);
  const lifestyleProtected = profile.lifestyleMonthly * keep;
  const lifestyleFreed = profile.lifestyleMonthly - lifestyleProtected;

  const goalContributions = goals.reduce(
    (s, g) => s + Math.max(0, g.monthlyContribution),
    0,
  );
  const safetyBuffer = (income * clamp(settings.safetyBufferPct, 0, 100)) / 100;
  const minimumPayments = totalMinimums(debts.filter((d) => !d.archivedAt));

  const committed =
    essentials + lifestyleProtected + goalContributions + safetyBuffer + minimumPayments;
  const surplus = income - committed;
  const availableExtra = Math.max(0, surplus);

  if (income > 0 && essentials + lifestyleProtected > income) warnings.push("overspending");
  if (income > 0 && essentials + minimumPayments > income)
    warnings.push("minimums_exceed_budget");
  if (!goals.some((g) => g.isEmergencyFund && g.saved > 0)) warnings.push("no_emergency_fund");
  if (settings.safetyBufferPct <= 0) warnings.push("no_buffer");

  return {
    income,
    essentials,
    lifestyleProtected,
    lifestyleFreed,
    goalContributions,
    safetyBuffer,
    minimumPayments,
    availableExtra,
    surplus,
    warnings,
  };
}

/**
 * "What if I kept a bit less of the fun?" — used by the intensity slider so the
 * user can see the trade before committing to it.
 */
export function extraAtKeepRatio(
  settings: Settings,
  profile: SpendProfile,
  debts: Debt[],
  goals: Goal[],
  keepRatio: number,
): number {
  return computeBudget({ ...settings, lifestyleKeepRatio: keepRatio }, profile, debts, goals)
    .availableExtra;
}

/** Spend rate so far this month versus where it should be by this date. */
export function monthPace(
  expenses: Expense[],
  monthlyTarget: number,
  now: Date = new Date(),
): { spent: number; target: number; pace: number; onTrack: boolean } {
  const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = todayISO(now);
  const spent = expenses
    .filter((e) => e.date >= monthStart && e.date <= today && e.recurrence !== "monthly")
    .reduce((s, e) => s + e.amount, 0);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = now.getDate();
  const target = monthlyTarget * (elapsed / daysInMonth);
  const pace = target > 0 ? spent / target : 0;
  return { spent, target, pace, onTrack: spent <= target * 1.05 };
}

/** Months of essentials covered by the emergency fund. */
export function emergencyRunwayMonths(goals: Goal[], profile: SpendProfile): number {
  const fund = goals
    .filter((g) => g.isEmergencyFund)
    .reduce((s, g) => s + g.saved, 0);
  const burn = profile.essentialMonthly + profile.lifestyleMonthly;
  if (burn <= 0) return 0;
  return fund / burn;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
