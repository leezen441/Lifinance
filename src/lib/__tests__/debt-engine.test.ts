/**
 * Engine tests. Run with:  npm run test:engine
 * (Node's built-in runner + type stripping — no test framework dependency.)
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blendedApr,
  buildPlan,
  compareStrategies,
  extraNeededForTarget,
  monthlyInterest,
  overallProgress,
  simulatePayoff,
  totalMinimums,
} from "../debt-engine";
import { buildSpendProfile, computeBudget, monthPace } from "../budget-engine";
import { DEFAULT_ANSWERS, estimateMonthly, estimateTotal } from "../assessment";
import { buildMonthPlan } from "../month-plan";
import { evalMoneyExpression } from "../money-expr";
import {
  accrueDebtToDate,
  applyDebtPayment,
  dailyInterest,
  debtProgress,
} from "../debt-interest";
import { recommendBudget } from "../recommend";
import { num } from "../utils";
import type { Category, Debt, Expense, Goal, Settings } from "../types";
import { toISODate, addDays } from "../date";

const START = new Date(2026, 0, 1);

function debt(over: Partial<Debt> & { id: string }): Debt {
  return {
    name: over.id,
    kind: "credit_card",
    balance: 10_000,
    principal: 10_000,
    apr: 12,
    minPayment: 500,
    createdAt: "2026-01-01",
    ...over,
  };
}

test("projected interest matches the daily accrual it forecasts", () => {
  // The projection must use the same model as accrueDebtToDate (APR/365 added
  // back daily), not a flat APR/12 — otherwise the forecast is systematically
  // cheaper than the balance the user actually ends up with.
  const projected = monthlyInterest(12_000, 12);
  assert.ok(projected > 120, `daily compounding must exceed flat APR/12, got ${projected}`);
  assert.ok(Math.abs(projected - 120.58) < 0.01, `got ${projected}`);

  // A month of real accrual on the same balance should land in the same place.
  const daily = 12_000 * (Math.pow(1 + 0.12 / 365, 365 / 12) - 1);
  assert.ok(Math.abs(projected - daily) < 0.001);

  assert.equal(monthlyInterest(0, 20), 0);
  assert.equal(monthlyInterest(5_000, 0), 0);
});

test("progress is one number, whichever screen asks for it", () => {
  // Regression: Home read 31.3% while the Debts page read 14.6% for this exact
  // debt, because they measured against different denominators.
  const card = debt({ id: "visa", principal: 85_000, balance: 58_400, paidTotal: 10_000 });
  const perDebt = debtProgress(card);
  const aggregate = overallProgress([card]);
  assert.ok(Math.abs(perDebt - aggregate) < 1e-9, `${perDebt} vs ${aggregate}`);
  assert.ok(Math.abs(perDebt - 0.3129) < 0.001, `got ${perDebt}`);

  // A debt imported mid-life, never paid inside the app, still shows progress.
  const imported = debt({ id: "old", principal: 100_000, balance: 40_000, paidTotal: 0 });
  assert.ok(Math.abs(debtProgress(imported) - 0.6) < 1e-9);

  // Interest outgrowing the original shows zero, never negative.
  const underwater = debt({ id: "bad", principal: 10_000, balance: 12_000, paidTotal: 0 });
  assert.equal(debtProgress(underwater), 0);
  assert.equal(overallProgress([underwater]), 0);
});

test("a single 0% debt clears in exactly balance/payment months", () => {
  const plan = simulatePayoff([debt({ id: "a", balance: 1_000, apr: 0, minPayment: 100 })], 0, "avalanche", START);
  assert.equal(plan.feasible, true);
  assert.equal(plan.monthsToFreedom, 10);
  assert.equal(plan.totalInterest, 0);
  assert.equal(plan.totalPaid, 1_000);
});

test("interest makes a plan cost more than the balance", () => {
  const plan = simulatePayoff([debt({ id: "a", balance: 10_000, apr: 24, minPayment: 1_000 })], 0, "avalanche", START);
  assert.equal(plan.feasible, true);
  assert.ok(plan.totalInterest > 0, "should charge interest");
  assert.ok(plan.totalPaid > 10_000, "total paid must exceed principal");
  assert.ok(plan.monthsToFreedom > 10, "interest should push it past 10 months");
});

test("extra payment strictly shortens the plan", () => {
  const debts = [debt({ id: "a", balance: 50_000, apr: 18, minPayment: 2_000 })];
  const base = simulatePayoff(debts, 0, "avalanche", START);
  const boosted = simulatePayoff(debts, 3_000, "avalanche", START);
  assert.ok(boosted.monthsToFreedom < base.monthsToFreedom);
  assert.ok(boosted.totalInterest < base.totalInterest);
});

test("avalanche never pays more interest than snowball", () => {
  const debts = [
    debt({ id: "small-cheap", balance: 5_000, apr: 5, minPayment: 300 }),
    debt({ id: "big-expensive", balance: 60_000, apr: 24, minPayment: 2_500 }),
  ];
  const { avalanche, snowball } = compareStrategies(debts, 4_000, START);
  assert.ok(avalanche.feasible && snowball.feasible);
  assert.ok(
    avalanche.totalInterest <= snowball.totalInterest + 0.01,
    `avalanche ${avalanche.totalInterest} should be <= snowball ${snowball.totalInterest}`,
  );
});

test("snowball clears the smallest debt first, avalanche the priciest", () => {
  const debts = [
    debt({ id: "small", balance: 3_000, apr: 6, minPayment: 200 }),
    debt({ id: "pricey", balance: 40_000, apr: 26, minPayment: 1_500 }),
  ];
  const { avalanche, snowball } = compareStrategies(debts, 3_000, START);
  assert.equal(snowball.focusDebtId, "small");
  assert.equal(avalanche.focusDebtId, "pricey");

  const firstCleared = (p: typeof avalanche) =>
    [...p.perDebt].sort((a, b) => (a.payoffMonth ?? 1e9) - (b.payoffMonth ?? 1e9))[0].debtId;
  assert.equal(firstCleared(snowball), "small");
  assert.equal(firstCleared(avalanche), "pricey");
});

test("freed-up minimums roll into the next debt (the snowball effect)", () => {
  const debts = [
    debt({ id: "a", balance: 2_000, apr: 0, minPayment: 1_000 }),
    debt({ id: "b", balance: 10_000, apr: 0, minPayment: 500 }),
  ];
  // Total budget is fixed at 1,500/mo. Without rolling, "b" would take 20
  // months; with the roll it must finish sooner.
  const plan = simulatePayoff(debts, 0, "avalanche", START);
  assert.equal(plan.feasible, true);
  assert.equal(plan.monthsToFreedom, 8, "12,000 total at 1,500/mo = 8 months");
});

test("a payment that cannot cover interest is reported as infeasible", () => {
  const plan = simulatePayoff(
    [debt({ id: "a", balance: 100_000, apr: 24, minPayment: 500 })],
    0,
    "avalanche",
    START,
  );
  assert.equal(plan.feasible, false);
  assert.ok(plan.shortfall > 0);
  assert.equal(plan.payoffDate, null);
  assert.equal(plan.months.length, 0, "must not loop for 60 years");
});

test("no debts yields an empty but valid plan", () => {
  const plan = simulatePayoff([], 1_000, "avalanche", START);
  assert.equal(plan.feasible, true);
  assert.equal(plan.monthsToFreedom, 0);
  assert.equal(plan.payoffDate, null);
});

test("archived debts are excluded", () => {
  const plan = simulatePayoff(
    [debt({ id: "a", balance: 5_000, apr: 0, minPayment: 500, archivedAt: "2026-01-01" })],
    0,
    "avalanche",
    START,
  );
  assert.equal(plan.monthsToFreedom, 0);
});

test("minimums are capped at the payoff amount", () => {
  // A 100 balance with a 500 minimum must only take 100 (plus interest).
  const total = totalMinimums([{ balance: 100, minPayment: 500, apr: 0 }]);
  assert.equal(total, 100);
});

test("blended APR is balance-weighted", () => {
  const value = blendedApr([
    debt({ id: "a", balance: 10_000, apr: 10 }),
    debt({ id: "b", balance: 30_000, apr: 20 }),
  ]);
  assert.equal(Math.round(value * 100) / 100, 17.5);
});

test("extraNeededForTarget finds a payment that hits the deadline", () => {
  const debts = [debt({ id: "a", balance: 60_000, apr: 18, minPayment: 2_000 })];
  const extra = extraNeededForTarget(debts, 12, "avalanche", START);
  assert.ok(extra !== null && extra > 0);
  const plan = simulatePayoff(debts, extra!, "avalanche", START);
  assert.ok(plan.monthsToFreedom <= 12, `got ${plan.monthsToFreedom} months`);
  // And one unit less should miss it — i.e. the answer is tight, not lazy.
  const under = simulatePayoff(debts, Math.max(0, extra! - 50), "avalanche", START);
  assert.ok(under.monthsToFreedom >= plan.monthsToFreedom);
});

test("auto strategy resolves to the plan that finishes first", () => {
  const debts = [
    debt({ id: "small", balance: 3_000, apr: 6, minPayment: 200 }),
    debt({ id: "pricey", balance: 40_000, apr: 26, minPayment: 1_500 }),
  ];
  const { plan, comparison } = buildPlan(debts, 3_000, "auto", START);
  assert.ok(plan.monthsToFreedom <= comparison.avalanche.monthsToFreedom);
  assert.ok(plan.monthsToFreedom <= comparison.snowball.monthsToFreedom);
});

/* ------------------------------------------------------------------ */
/* Budget engine                                                       */
/* ------------------------------------------------------------------ */

const NOW = new Date(2026, 5, 15);

const categories: Category[] = [
  { id: "c_rent", key: "rent", group: "essential", emoji: "🏠", isEssential: true, quickAmounts: [], isCustom: false },
  { id: "c_coffee", key: "coffee", group: "food", emoji: "☕", isEssential: false, quickAmounts: [], isCustom: false },
];

function expense(over: Partial<Expense> & { id: string; categoryId: string; amount: number; date: string }): Expense {
  return { createdAt: over.date, recurrence: "none", ...over };
}

const settings: Settings = {
  language: "en",
  theme: "dark",
  currency: "THB",
  monthlyIncome: 50_000,
  payday: 25,
  strategy: "auto",
  lifestyleKeepRatio: 0.7,
  safetyBufferPct: 5,
  spendWindowDays: 30,
  spendPotAmount: 0,
  spendCountSpend: true,
  spendCountSave: true,
  spendCountDebt: true,
  spendAgainstPotOnly: false,
  onboarded: true,
};

test("recurring items count once per month, not once per log", () => {
  const expenses: Expense[] = [
    expense({ id: "1", categoryId: "c_rent", amount: 12_000, date: toISODate(addDays(NOW, -2)), recurrence: "monthly" }),
    expense({ id: "2", categoryId: "c_rent", amount: 12_000, date: toISODate(addDays(NOW, -20)), recurrence: "monthly" }),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  assert.equal(Math.round(profile.essentialMonthly), 12_000);
});

test("variableMonthly excludes fixed bills so the pace check is comparable", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "c_rent", amount: 12_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
    ...Array.from({ length: 30 }, (_, i) =>
      expense({ id: `c${i}`, categoryId: "c_coffee", amount: 100, date: toISODate(addDays(NOW, -i)) }),
    ),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  assert.ok(Math.abs(profile.totalMonthly - profile.variableMonthly - 12_000) < 1);
  assert.ok(Math.abs(profile.variableMonthly - 3_044) < 5, `got ${profile.variableMonthly}`);
});

test("daily spending is normalised to a monthly rate", () => {
  // 100/day for 30 days → ~3,044/month (30.44-day month).
  const expenses = Array.from({ length: 30 }, (_, i) =>
    expense({ id: `e${i}`, categoryId: "c_coffee", amount: 100, date: toISODate(addDays(NOW, -i)) }),
  );
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  assert.ok(Math.abs(profile.lifestyleMonthly - 3_044) < 5, `got ${profile.lifestyleMonthly}`);
  assert.equal(profile.essentialMonthly, 0);
});

test("the keep ratio is what turns lifestyle into payoff capacity", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "c_rent", amount: 12_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
    ...Array.from({ length: 30 }, (_, i) =>
      expense({ id: `c${i}`, categoryId: "c_coffee", amount: 200, date: toISODate(addDays(NOW, -i)) }),
    ),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const debts = [debt({ id: "a", balance: 30_000, apr: 18, minPayment: 1_500 })];
  const goals: Goal[] = [];

  const strict = computeBudget({ ...settings, lifestyleKeepRatio: 1 }, profile, debts, goals);
  const aggressive = computeBudget({ ...settings, lifestyleKeepRatio: 0.5 }, profile, debts, goals);

  assert.ok(
    aggressive.availableExtra > strict.availableExtra,
    "cutting the keep ratio must free up money",
  );
  // And that freed money is exactly half the discretionary spend.
  assert.ok(
    Math.abs(aggressive.availableExtra - strict.availableExtra - profile.lifestyleMonthly * 0.5) < 1,
  );
});

test("the budget never reports negative capacity", () => {
  const profile = buildSpendProfile([], categories, 30, NOW);
  const debts = [debt({ id: "a", balance: 500_000, apr: 20, minPayment: 90_000 })];
  const budget = computeBudget(settings, profile, debts, []);
  assert.equal(budget.availableExtra, 0);
  assert.ok(budget.surplus < 0, "surplus stays negative so the UI can warn");
  assert.ok(budget.warnings.includes("minimums_exceed_budget"));
});

/* ------------------------------------------------------------------ */
/* Assessment + recommendation                                         */
/* ------------------------------------------------------------------ */

test("the assessment turns answers into a plausible monthly estimate", () => {
  const estimate = estimateMonthly({
    ...DEFAULT_ANSWERS,
    housing: "rent_alone",
    housingCost: 12_000,
    utilities: 1_500,
    drinks: 7,
    drinkPrice: "mid",
  });
  assert.equal(estimate["cat_rent"], 12_000);
  assert.equal(estimate["cat_utilities"], 1_500);
  // 7 cups/wk * 95 * 4.35 weeks ≈ 2,891, split 70/30 across coffee + matcha.
  const drinks = estimate["cat_coffee"] + estimate["cat_matcha"];
  assert.ok(Math.abs(drinks - 2_891) < 15, `got ${drinks}`);
  assert.ok(estimateTotal(estimate) > 12_000);
});

test("amount overrides replace table estimates", () => {
  const estimate = estimateMonthly({
    ...DEFAULT_ANSWERS,
    housing: "rent_alone",
    housingCost: 12_000,
    transport: "car",
    transportIntensity: "mid",
    amountOverrides: { cat_fuel: 6_000, cat_rent: 15_000 },
  });
  assert.equal(estimate["cat_fuel"], 6_000);
  assert.equal(estimate["cat_rent"], 15_000);
});

test("custom subscription amounts beat the defaults", () => {
  const estimate = estimateMonthly({
    ...DEFAULT_ANSWERS,
    subscriptions: ["streaming_video"],
    subscriptionAmounts: { streaming_video: 199 },
  });
  assert.equal(estimate["cat_streaming"], 199);
});

test("family support lands in an essential category", () => {
  const estimate = estimateMonthly({
    ...DEFAULT_ANSWERS,
    familySupport: 5_000,
  });
  assert.equal(estimate["cat_family_support"], 5_000);
  assert.equal(estimate["cat_misc"], undefined);
});

test("cooking habit moves groceries and eating out in opposite directions", () => {
  const cooks = estimateMonthly({ ...DEFAULT_ANSWERS, cooking: "mostly" });
  const doesnt = estimateMonthly({ ...DEFAULT_ANSWERS, cooking: "never" });
  assert.ok(cooks["cat_groceries"] > doesnt["cat_groceries"]);
  assert.ok(cooks["cat_eating_out"] < doesnt["cat_eating_out"]);
});

test("the baseline carries the plan until real data takes over", () => {
  const baseline = { cat_coffee: 3_000 };
  // Day one: nothing logged, so the estimate is the whole picture.
  const empty = buildSpendProfile([], categories, 30, NOW, baseline);
  assert.equal(Math.round(empty.lifestyleMonthly), 3_000);
  assert.equal(empty.dataTrust, 0);
  assert.equal(empty.usingBaseline, true);

  // Three weeks in, tracked data has fully replaced it.
  const tracked = Array.from({ length: 21 }, (_, i) =>
    expense({ id: `c${i}`, categoryId: "c_coffee", amount: 100, date: toISODate(addDays(NOW, -i)) }),
  );
  const mature = buildSpendProfile(tracked, categories, 30, NOW, baseline);
  assert.equal(mature.dataTrust, 1);
  assert.equal(mature.usingBaseline, false);
  assert.ok(Math.abs(mature.lifestyleMonthly - 3_044) < 5, `got ${mature.lifestyleMonthly}`);
});

test("recommendation leaves room for savings and debt, and flags the gap", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "c_rent", amount: 10_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
    // ~24,350/mo of discretionary spending on a 40k income.
    ...Array.from({ length: 30 }, (_, i) =>
      expense({ id: `c${i}`, categoryId: "c_coffee", amount: 800, date: toISODate(addDays(NOW, -i)) }),
    ),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const debts = [debt({ id: "a", balance: 60_000, apr: 22, minPayment: 3_000 })];
  const isEssential = (id: string) => id === "c_rent";

  const rec = recommendBudget(40_000, profile, debts, [], isEssential);

  assert.ok(rec.savings > 0, "must always carve out savings");
  assert.ok(rec.debtPayment >= 3_000, "must at least cover minimums");
  assert.ok(rec.recommendedLiving < 40_000, "living budget cannot be the whole income");
  assert.ok(rec.gap > 0, "should detect overspending");
  assert.ok(rec.notes.includes("high_apr_debt"));
  assert.ok(rec.notes.includes("no_emergency_fund"));

  // Rent is essential, so it is never in the trim list.
  const rent = rec.perCategory.find((c) => c.categoryId === "c_rent");
  assert.equal(rent?.delta, 0);
  const coffee = rec.perCategory.find((c) => c.categoryId === "c_coffee");
  assert.ok(coffee && coffee.delta < 0, "discretionary spending absorbs the cut");
  assert.ok(coffee!.recommended >= coffee!.current * 0.5, "never cuts more than half");
});

test("a comfortable budget is reported as comfortable", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "c_rent", amount: 8_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
    ...Array.from({ length: 30 }, (_, i) =>
      expense({ id: `c${i}`, categoryId: "c_coffee", amount: 80, date: toISODate(addDays(NOW, -i)) }),
    ),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const goals: Goal[] = [
    {
      id: "g",
      name: "Emergency",
      emoji: "🛟",
      target: 100_000,
      saved: 90_000,
      monthlyContribution: 0,
      isEmergencyFund: true,
      createdAt: "2026-01-01",
    },
  ];
  const rec = recommendBudget(80_000, profile, [], goals, (id) => id === "c_rent");
  assert.equal(rec.gap, 0);
  assert.ok(rec.notes.includes("comfortable"));
  assert.ok(!rec.notes.includes("no_emergency_fund"), "90k covers >3 months of burn");
});

test("housing above 30% of income is called out", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "cat_rent", amount: 20_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
  ];
  const cats = [
    { ...categories[0], id: "cat_rent" },
    categories[1],
  ];
  const profile = buildSpendProfile(expenses, cats, 30, NOW);
  const rec = recommendBudget(50_000, profile, [], [], (id) => id === "cat_rent");
  assert.ok(rec.notes.includes("housing_heavy"));
});

test("essentials are never squeezed, whatever the keep ratio", () => {
  const expenses: Expense[] = [
    expense({ id: "r", categoryId: "c_rent", amount: 12_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const budget = computeBudget({ ...settings, lifestyleKeepRatio: 0 }, profile, [], []);
  assert.equal(Math.round(budget.essentials), 12_000);
  assert.ok(budget.availableExtra <= settings.monthlyIncome - 12_000);
});

test("month plan: left to spend = in − out − save − debt", () => {
  const debts = [debt({ id: "a", balance: 10_000, apr: 20, minPayment: 1_000 })];
  const expenses: Expense[] = [
    expense({
      id: "coffee",
      categoryId: "c_coffee",
      amount: 500,
      date: toISODate(NOW),
    }),
  ];
  const incomes = [
    {
      id: "pay",
      amount: 40_000,
      date: toISODate(NOW),
      kind: "salary" as const,
      createdAt: toISODate(NOW),
    },
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const budget = computeBudget(settings, profile, debts, []);
  const rec = recommendBudget(settings.monthlyIncome, profile, debts, [], () => false);
  const { plan } = buildPlan(debts, budget.availableExtra, "avalanche");
  const month = buildMonthPlan({
    settings,
    incomes,
    expenses,
    debts,
    goals: [],
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });
  assert.equal(month.moneyIn, 40_000);
  assert.equal(month.moneyInEstimated, false);
  assert.equal(month.moneyOut, 500);
  assert.equal(
    month.leftToSpend,
    month.moneyIn - month.moneyOut - month.saveThisMonth - month.payDebtsThisMonth,
  );
  assert.ok(month.payOrder.length >= 1);
  assert.equal(month.payOrder[0].isFocus, true);
});

test("paying a debt must never reduce payoff capacity", () => {
  // The invariant that matters: a debt payment is a transfer, not consumption.
  // It was being counted as an essential living expense *and* double-charged
  // against the minimums the budget already subtracts, so a ฿10,000 payment
  // cut capacity by ~฿5,073/mo and pushed the debt-free date months later —
  // the app punished the user for doing the one thing it exists to encourage.
  const debts = [debt({ id: "visa", balance: 60_000, apr: 20, minPayment: 3_000 })];
  const living: Expense[] = [
    expense({ id: "rent", categoryId: "c_rent", amount: 10_000, date: toISODate(addDays(NOW, -1)), recurrence: "monthly" }),
  ];

  const before = computeBudget(
    settings,
    buildSpendProfile(living, categories, 60, NOW),
    debts,
    [],
  );

  const payment: Expense = {
    ...expense({ id: "pay", categoryId: "cat_debt_payment", amount: 10_000, date: toISODate(NOW) }),
    debtId: "visa",
  };
  const after = computeBudget(
    settings,
    buildSpendProfile([...living, payment], categories, 60, NOW),
    debts,
    [],
  );

  assert.equal(
    after.availableExtra,
    before.availableExtra,
    "logging a debt payment must not change payoff capacity",
  );
  assert.equal(after.essentials, before.essentials, "a transfer is not an expense");
});

test("debt payments are excluded from spending totals and pace", () => {
  const payment: Expense = {
    ...expense({ id: "pay", categoryId: "cat_debt_payment", amount: 9_000, date: toISODate(NOW) }),
    debtId: "visa",
  };
  const coffee = expense({ id: "c", categoryId: "c_coffee", amount: 120, date: toISODate(NOW) });

  const profile = buildSpendProfile([payment, coffee], categories, 60, NOW);
  assert.equal(profile.todayTotal, 120, "clearing a card is not today's spending");
  assert.equal(profile.last7[6].total, 120);

  const pace = monthPace([payment, coffee], 5_000, NOW);
  assert.equal(pace.spent, 120, "a card payment must not read as overspending");
});

test("a new user with no debts is never shown their income as debt", () => {
  // Regression: `budget.availableExtra` is capacity to overpay, not an amount
  // owed. Filing it under "pay debts" showed a fresh user their whole salary
  // as a debt pile and reserved it away from the spend envelope.
  const profile = buildSpendProfile([], categories, 30, NOW);
  const budget = computeBudget(settings, profile, [], []);
  const rec = recommendBudget(settings.monthlyIncome, profile, [], [], () => false);
  const { plan } = buildPlan([], budget.availableExtra, "avalanche");

  const month = buildMonthPlan({
    settings,
    incomes: [],
    expenses: [],
    debts: [],
    goals: [],
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });

  assert.ok(budget.availableExtra > 0, "there is spare capacity to misreport");
  assert.equal(month.payDebtsThisMonth, 0, "no debts means nothing to pay");
  assert.equal(month.debtExtra, 0);
  assert.equal(month.debtMinimums, 0);
  assert.equal(month.payOrder.length, 0);
  // The whole income stays spendable rather than being reserved for phantom debt.
  assert.equal(month.leftToSpend, settings.monthlyIncome);
});

test("this month's debt payment never exceeds what is actually owed", () => {
  // 50k income against a 4k balance: capacity far exceeds the debt.
  const debts = [debt({ id: "a", balance: 4_000, apr: 18, minPayment: 500 })];
  const profile = buildSpendProfile([], categories, 30, NOW);
  const budget = computeBudget(settings, profile, debts, []);
  const rec = recommendBudget(settings.monthlyIncome, profile, debts, [], () => false);
  const { plan } = buildPlan(debts, budget.availableExtra, "avalanche");

  const month = buildMonthPlan({
    settings,
    incomes: [],
    expenses: [],
    debts,
    goals: [],
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });

  assert.ok(budget.availableExtra > 4_000, "capacity exceeds the balance");
  assert.equal(month.payDebtsThisMonth, 4_000, "capped at the balance");
  assert.ok(month.payOrder[0].payThisMonth <= 4_000);
});

test("month plan can ignore save or debt envelopes", () => {
  const debts = [debt({ id: "a", balance: 10_000, apr: 20, minPayment: 1_000 })];
  const expenses: Expense[] = [
    expense({ id: "coffee", categoryId: "c_coffee", amount: 500, date: toISODate(NOW) }),
  ];
  const incomes = [
    {
      id: "pay",
      amount: 40_000,
      date: toISODate(NOW),
      kind: "salary" as const,
      createdAt: toISODate(NOW),
    },
  ];
  const goals = [
    {
      id: "g",
      name: "EF",
      emoji: "🛟",
      target: 50_000,
      saved: 0,
      monthlyContribution: 2_000,
      isEmergencyFund: true,
      createdAt: "2026-01-01",
    },
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const budget = computeBudget(settings, profile, debts, goals);
  const rec = recommendBudget(settings.monthlyIncome, profile, debts, goals, () => false);
  const { plan } = buildPlan(debts, budget.availableExtra, "avalanche");

  const both = buildMonthPlan({
    settings: { ...settings, spendPotAmount: 10_000 },
    incomes,
    expenses,
    debts,
    goals,
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });
  assert.equal(both.saveThisMonth, 2_000, "save pot comes from goals only");
  assert.equal(both.spendPot, 10_000);
  assert.equal(both.savedTotal, 0, "saved total is money already in goals");

  const cashOnly = buildMonthPlan({
    settings: {
      ...settings,
      spendPotAmount: 10_000,
      spendCountSpend: false,
      spendCountSave: false,
      spendCountDebt: false,
    },
    incomes,
    expenses,
    debts,
    goals,
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });
  assert.equal(cashOnly.leftToSpend, 40_000 - 500);
  assert.ok(cashOnly.leftToSpend > both.leftToSpend);
});

test("month plan can track expenses against spend pot only", () => {
  const debts = [debt({ id: "a", balance: 10_000, apr: 20, minPayment: 1_000 })];
  const expenses: Expense[] = [
    expense({ id: "coffee", categoryId: "c_coffee", amount: 500, date: toISODate(NOW) }),
  ];
  const incomes = [
    {
      id: "pay",
      amount: 40_000,
      date: toISODate(NOW),
      kind: "salary" as const,
      createdAt: toISODate(NOW),
    },
  ];
  const goals = [
    {
      id: "g",
      name: "EF",
      emoji: "🛟",
      target: 50_000,
      saved: 0,
      monthlyContribution: 2_000,
      isEmergencyFund: true,
      createdAt: "2026-01-01",
    },
  ];
  const profile = buildSpendProfile(expenses, categories, 30, NOW);
  const budget = computeBudget(settings, profile, debts, goals);
  const rec = recommendBudget(settings.monthlyIncome, profile, debts, goals, () => false);
  const { plan } = buildPlan(debts, budget.availableExtra, "avalanche");

  const potOnly = buildMonthPlan({
    settings: {
      ...settings,
      spendPotAmount: 10_000,
      spendAgainstPotOnly: true,
      spendCountSave: true,
      spendCountDebt: true,
    },
    incomes,
    expenses,
    debts,
    goals,
    budget,
    recommendation: rec,
    plan,
    now: NOW,
  });
  assert.equal(potOnly.againstPotOnly, true);
  assert.equal(potOnly.leftToSpend, 10_000 - 500);
  assert.equal(potOnly.reserved, 10_000);
});

test("money expressions evaluate safely", () => {
  assert.equal(evalMoneyExpression("120+80"), 200);
  assert.equal(evalMoneyExpression("1000-250"), 750);
  assert.equal(evalMoneyExpression("50*3"), 150);
  assert.equal(evalMoneyExpression("100/4"), 25);
  assert.equal(evalMoneyExpression("(10+5)*2"), 30);
  assert.equal(evalMoneyExpression("120+"), null);
  assert.equal(num("120+80"), 200);
  assert.equal(num("99.5"), 99.5);
});

test("daily interest accrues and payments raise progress until cleared", () => {
  const start: Debt = {
    id: "card",
    name: "Visa",
    kind: "credit_card",
    balance: 10_000,
    principal: 10_000,
    apr: 36.5, // 0.1% per day exactly (36.5/365)
    minPayment: 500,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastInterestDate: "2026-01-01",
    paidTotal: 0,
    interestAccrued: 0,
  };
  assert.ok(Math.abs(dailyInterest(10_000, 36.5, 1) - 10) < 0.01);

  const afterOneDay = accrueDebtToDate(start, "2026-01-02");
  assert.ok(afterOneDay.balance > 10_000);
  assert.equal(afterOneDay.lastInterestDate, "2026-01-02");

  const paid = applyDebtPayment(afterOneDay, 5_000, "2026-01-02");
  assert.equal(paid.cleared, false);
  assert.ok(debtProgress(paid.debt) > 0.4);

  const done = applyDebtPayment(paid.debt, paid.debt.balance, "2026-01-02");
  assert.equal(done.cleared, true);
  assert.equal(done.debt.balance, 0);
  assert.ok(done.debt.archivedAt);
  assert.equal(debtProgress(done.debt), 1);
});
