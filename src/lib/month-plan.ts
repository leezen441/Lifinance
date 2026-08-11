/**
 * One plain story for the whole app: money in, money out, save, pay debts.
 *
 * Envelopes (spend / save / debt) are amounts the user chose or that come from
 * real goals and debt mins — not a hidden % of income.
 */

import type {
  BudgetBreakdown,
  Debt,
  Expense,
  Goal,
  IncomeEntry,
  PayoffPlan,
  Settings,
} from "./types";
import type { BudgetRecommendation } from "./recommend";
import { startOfMonthISO, todayISO } from "./date";

export interface PayOrderItem {
  rank: number;
  debtId: string;
  name: string;
  /** What to send this debt this month (min + extra if focus). */
  payThisMonth: number;
  minPayment: number;
  extra: number;
  balance: number;
  apr: number;
  isFocus: boolean;
  payoffDate: string | null;
}

export interface MonthPlan {
  /** Calendar month start `YYYY-MM-DD`. */
  monthStart: string;
  /** Money that landed (logged), or expected income if nothing logged yet. */
  moneyIn: number;
  /** True when moneyIn comes from settings, not the income log. */
  moneyInEstimated: boolean;
  moneyOut: number;
  /**
   * Day-to-day spend pot the user set (from income). 0 = not set.
   */
  spendPot: number;
  /**
   * Suggested spend pot = money in − save goals − debt payments.
   * What is left for day-to-day after locking save + debt.
   */
  spendSuggested: number;
  /**
   * Sum of monthly contributions on Save-page goals — the real save envelope
   * for this month's plan (what to set aside).
   */
  saveThisMonth: number;
  /**
   * Sum of money already in goals (`saved`) — the savings balance.
   */
  savedTotal: number;
  /** Engine suggestion only (for tips) — not what the Spend toggles use. */
  saveSuggested: number;
  /** How much to send to debts this month (mins + spare). */
  payDebtsThisMonth: number;
  /** Minimums only. */
  debtMinimums: number;
  /** Extra on top of mins for the focus debt. */
  debtExtra: number;
  /** moneyIn − moneyOut − envelopes, or spendPot − moneyOut when against-pot-only. */
  leftToSpend: number;
  /** Amounts currently counted toward left-to-spend. */
  reserved: number;
  /** True when remaining = spend pot − expenses. */
  againstPotOnly: boolean;
  countSpend: boolean;
  countSave: boolean;
  countDebt: boolean;
  payOrder: PayOrderItem[];
  focusDebtId: string | null;
  focusName: string | null;
  focusPayThisMonth: number;
  debtFreeDate: string | null;
  hasEmergencyFund: boolean;
}

function inCurrentMonth(date: string, monthStart: string, today: string): boolean {
  return date >= monthStart && date <= today;
}

/** Monthly save envelope = what the user set on goals, nothing else. */
export function saveFromGoals(goals: Goal[]): number {
  return goals.reduce((s, g) => s + Math.max(0, g.monthlyContribution), 0);
}

/** Total already saved across all goals. */
export function savedFromGoals(goals: Goal[]): number {
  return goals.reduce((s, g) => s + Math.max(0, g.saved), 0);
}

export function buildMonthPlan(input: {
  settings: Settings;
  incomes: IncomeEntry[];
  expenses: Expense[];
  debts: Debt[];
  goals: Goal[];
  budget: BudgetBreakdown;
  recommendation: BudgetRecommendation;
  plan: PayoffPlan;
  now?: Date;
}): MonthPlan {
  const now = input.now ?? new Date();
  const monthStart = startOfMonthISO(now);
  const today = todayISO(now);

  const loggedIn = input.incomes
    .filter((i) => inCurrentMonth(i.date, monthStart, today))
    .reduce((s, i) => s + i.amount, 0);

  const moneyInEstimated = loggedIn <= 0;
  const moneyIn = moneyInEstimated ? Math.max(0, input.settings.monthlyIncome) : loggedIn;

  const moneyOut = input.expenses
    .filter((e) => inCurrentMonth(e.date, monthStart, today))
    .reduce((s, e) => s + e.amount, 0);

  const spendPot = Math.max(0, input.settings.spendPotAmount ?? 0);
  const saveThisMonth = saveFromGoals(input.goals);
  const savedTotal = savedFromGoals(input.goals);
  const saveSuggested = Math.max(0, input.recommendation.savings);

  const debtMinimums = input.budget.minimumPayments;
  const debtExtra = input.budget.availableExtra;
  const payDebtsThisMonth = debtMinimums + debtExtra;

  // After locking save + debt, this is what is left for day-to-day spending.
  const spendSuggested = Math.max(0, Math.round(moneyIn - saveThisMonth - payDebtsThisMonth));

  const againstPotOnly = Boolean(input.settings.spendAgainstPotOnly) && spendPot > 0;
  const countSpend = !againstPotOnly && input.settings.spendCountSpend !== false && spendPot > 0;
  const countSave = !againstPotOnly && input.settings.spendCountSave !== false;
  const countDebt = !againstPotOnly && input.settings.spendCountDebt !== false;
  const reserved = againstPotOnly
    ? spendPot
    : (countSpend ? spendPot : 0) +
      (countSave ? saveThisMonth : 0) +
      (countDebt ? payDebtsThisMonth : 0);
  // Pot-only: expenses eat the spend pot. Otherwise: income minus out minus selected pots.
  const leftToSpend = againstPotOnly ? spendPot - moneyOut : moneyIn - moneyOut - reserved;

  const activeDebts = input.debts.filter((d) => !d.archivedAt && d.balance > 0);
  const orderedDetails = [...input.plan.perDebt].sort((a, b) => {
    if (a.payoffMonth === null) return 1;
    if (b.payoffMonth === null) return -1;
    return a.payoffMonth - b.payoffMonth;
  });

  const orderedIds =
    orderedDetails.length > 0
      ? orderedDetails.map((d) => d.debtId)
      : activeDebts.map((d) => d.id);

  const focusDebtId = input.plan.focusDebtId ?? orderedIds[0] ?? null;
  const payOrder: PayOrderItem[] = orderedIds
    .map((debtId, index) => {
      const debt = activeDebts.find((d) => d.id === debtId);
      if (!debt) return null;
      const detail = input.plan.perDebt.find((p) => p.debtId === debtId);
      const isFocus = debt.id === focusDebtId;
      const extra = isFocus ? debtExtra : 0;
      return {
        rank: index + 1,
        debtId: debt.id,
        name: debt.name,
        payThisMonth: debt.minPayment + extra,
        minPayment: debt.minPayment,
        extra,
        balance: debt.balance,
        apr: debt.apr,
        isFocus,
        payoffDate: detail?.payoffDate ?? null,
      } satisfies PayOrderItem;
    })
    .filter((x): x is PayOrderItem => x !== null);

  const focus = payOrder.find((p) => p.isFocus) ?? payOrder[0] ?? null;

  return {
    monthStart,
    moneyIn,
    moneyInEstimated,
    moneyOut,
    spendPot,
    spendSuggested,
    saveThisMonth,
    savedTotal,
    saveSuggested,
    payDebtsThisMonth,
    debtMinimums,
    debtExtra,
    leftToSpend,
    reserved,
    againstPotOnly,
    countSpend,
    countSave,
    countDebt,
    payOrder,
    focusDebtId: focus?.debtId ?? null,
    focusName: focus?.name ?? null,
    focusPayThisMonth: focus?.payThisMonth ?? 0,
    debtFreeDate: input.plan.feasible ? input.plan.payoffDate : null,
    hasEmergencyFund: input.goals.some((g) => g.isEmergencyFund),
  };
}
