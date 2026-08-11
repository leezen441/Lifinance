/**
 * One plain story for the whole app: money in, money out, save, pay debts.
 *
 * The budget engine and the recommendation engine answer related but different
 * questions. The UI must not show both as competing headlines — this module
 * picks one set of numbers every screen can share.
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
  /** How much to put into savings this month. */
  saveThisMonth: number;
  /** How much to send to debts this month (mins + spare). */
  payDebtsThisMonth: number;
  /** Minimums only. */
  debtMinimums: number;
  /** Extra on top of mins for the focus debt. */
  debtExtra: number;
  /** moneyIn − moneyOut − (selected envelopes). */
  leftToSpend: number;
  /** Save + debt amounts currently counted toward left-to-spend. */
  reserved: number;
  /** Whether the save envelope is counted. */
  countSave: boolean;
  /** Whether the debt envelope is counted. */
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

  const goalContributions = input.goals.reduce(
    (s, g) => s + Math.max(0, g.monthlyContribution),
    0,
  );
  const saveThisMonth = Math.max(input.recommendation.savings, goalContributions);

  const debtMinimums = input.budget.minimumPayments;
  const debtExtra = input.budget.availableExtra;
  const payDebtsThisMonth = debtMinimums + debtExtra;

  const countSave = input.settings.spendCountSave !== false;
  const countDebt = input.settings.spendCountDebt !== false;
  const reserved =
    (countSave ? saveThisMonth : 0) + (countDebt ? payDebtsThisMonth : 0);
  const leftToSpend = moneyIn - moneyOut - reserved;

  const activeDebts = input.debts.filter((d) => !d.archivedAt && d.balance > 0);
  const orderedDetails = [...input.plan.perDebt].sort((a, b) => {
    if (a.payoffMonth === null) return 1;
    if (b.payoffMonth === null) return -1;
    return a.payoffMonth - b.payoffMonth;
  });

  // Prefer engine order; fall back to list order if the plan is empty.
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
    saveThisMonth,
    payDebtsThisMonth,
    debtMinimums,
    debtExtra,
    leftToSpend,
    reserved,
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
