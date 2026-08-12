/**
 * Debt payoff engine.
 *
 * Month-by-month amortisation. Every month:
 *   1. Interest accrues on each balance      (balance * apr / 12)
 *   2. Every debt gets its minimum payment   (capped at the payoff amount)
 *   3. Whatever is left over — the extra, *plus* the minimums freed up by
 *      already-cleared debts — is thrown at one target debt.
 *
 * Step 3 is the snowball effect, and it applies to both strategies. The only
 * difference between avalanche and snowball is which debt is the target.
 */

import type {
  Debt,
  DebtPayoffDetail,
  MonthSnapshot,
  PayoffPlan,
  Strategy,
  StrategyComparison,
} from "./types";
import { addMonths, isoMonthStart } from "./date";
import { DAYS_PER_YEAR } from "./debt-interest";

/** Simulating past this means the plan is not a plan. */
const MAX_MONTHS = 720; // 60 years
const EPSILON = 0.005; // half a satang / cent — below this a debt is cleared

interface Working {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
  interestPaid: number;
  totalPaid: number;
  payoffMonth: number | null;
}

/**
 * Interest for one month of the projection.
 *
 * Must agree with `accrueDebtToDate`, which charges real balances APR/365 every
 * day and adds it back — i.e. daily compounding. A flat APR/12 assumes monthly
 * compounding, which grows slower: on ฿100,000 at 20% left untouched for a
 * year, APR/12 predicts ฿121,939 while the balance actually reaches ฿122,134.
 * The projection was quietly optimistic by ~0.16%/yr.
 *
 * So the monthly factor here is the daily rate compounded over an average
 * month, which makes forecast and reality the same model.
 */
export function monthlyInterest(balance: number, apr: number): number {
  if (balance <= 0 || apr <= 0) return 0;
  const dailyRate = apr / 100 / DAYS_PER_YEAR;
  const monthlyRate = Math.pow(1 + dailyRate, DAYS_PER_YEAR / 12) - 1;
  return balance * monthlyRate;
}

/**
 * Order the debts for a given strategy. Ties break on the other metric so the
 * ordering is deterministic (important — the UI names one "focus" debt).
 */
export function orderDebts(
  debts: Working[],
  strategy: Exclude<Strategy, "auto">,
): Working[] {
  const open = debts.filter((d) => d.balance > EPSILON);
  return [...open].sort((a, b) => {
    if (strategy === "avalanche") {
      if (b.apr !== a.apr) return b.apr - a.apr;
      return a.balance - b.balance;
    }
    if (b.balance !== a.balance) return a.balance - b.balance;
    return b.apr - a.apr;
  });
}

/**
 * The minimum you must pay every month just to stand still.
 * A minimum larger than the balance is pointless, so it is capped.
 */
export function totalMinimums(debts: Pick<Debt, "balance" | "minPayment" | "apr">[]): number {
  return debts.reduce((sum, d) => {
    if (d.balance <= EPSILON) return sum;
    const payoff = d.balance + monthlyInterest(d.balance, d.apr);
    return sum + Math.min(d.minPayment, payoff);
  }, 0);
}

/**
 * Run the full simulation.
 *
 * @param debts       Open debts (archived ones should be filtered out first).
 * @param extraPerMonth  Cash available *on top of* the minimums. This is what
 *                       the budget engine derives from real tracked spending.
 * @param strategy    Which debt the extra targets.
 * @param startDate   Defaults to today; injectable for tests.
 */
export function simulatePayoff(
  debts: Debt[],
  extraPerMonth: number,
  strategy: Exclude<Strategy, "auto">,
  startDate: Date = new Date(),
): PayoffPlan {
  const active = debts
    .filter((d) => !d.archivedAt && d.balance > EPSILON)
    .map<Working>((d) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: Math.max(0, d.apr),
      minPayment: Math.max(0, d.minPayment),
      interestPaid: 0,
      totalPaid: 0,
      payoffMonth: null,
    }));

  const empty: PayoffPlan = {
    strategy,
    feasible: true,
    shortfall: 0,
    months: [],
    monthsToFreedom: 0,
    payoffDate: null,
    totalInterest: 0,
    totalPaid: 0,
    perDebt: [],
    focusDebtId: null,
  };

  if (active.length === 0) return empty;

  const extra = Math.max(0, extraPerMonth);
  const budget = totalMinimums(active) + extra;

  // A plan where the payment never covers the interest is not a slow plan,
  // it is a growing one. Detect it up front rather than looping for 60 years.
  const firstMonthInterest = active.reduce(
    (s, d) => s + monthlyInterest(d.balance, d.apr),
    0,
  );
  if (budget <= firstMonthInterest + EPSILON) {
    return {
      ...empty,
      feasible: false,
      shortfall: firstMonthInterest - budget,
      focusDebtId: orderDebts(active, strategy)[0]?.id ?? null,
      perDebt: active.map((d) => ({
        debtId: d.id,
        name: d.name,
        payoffMonth: null,
        payoffDate: null,
        interestPaid: 0,
        totalPaid: 0,
      })),
    };
  }

  const months: MonthSnapshot[] = [];
  let firstFocusId: string | null = null;
  let month = 0;

  while (month < MAX_MONTHS) {
    const openBefore = active.filter((d) => d.balance > EPSILON);
    if (openBefore.length === 0) break;

    month += 1;
    const startingBalance = sumBalances(active);
    let interestCharged = 0;
    let totalPaid = 0;
    const clearedThisMonth: string[] = [];

    // 1. Interest first — you are charged before you pay.
    for (const d of openBefore) {
      const interest = monthlyInterest(d.balance, d.apr);
      d.balance += interest;
      d.interestPaid += interest;
      interestCharged += interest;
    }

    // 2. Minimums. `budget` is fixed, so minimums released by cleared debts
    //    automatically roll into the pot for step 3.
    let pot = budget;
    for (const d of openBefore) {
      if (d.balance <= EPSILON) continue;
      const pay = Math.min(d.minPayment, d.balance, pot);
      d.balance -= pay;
      d.totalPaid += pay;
      pot -= pay;
      totalPaid += pay;
      if (d.balance <= EPSILON) {
        d.balance = 0;
        d.payoffMonth = month;
        clearedThisMonth.push(d.id);
      }
    }

    // 3. Everything left goes to the target — and cascades to the next debt
    //    the moment the target is cleared, in the same month.
    const focusId = orderDebts(active, strategy)[0]?.id ?? null;
    if (month === 1) firstFocusId = focusId;

    while (pot > EPSILON) {
      const target = orderDebts(active, strategy)[0];
      if (!target) break;
      const pay = Math.min(pot, target.balance);
      target.balance -= pay;
      target.totalPaid += pay;
      pot -= pay;
      totalPaid += pay;
      if (target.balance <= EPSILON) {
        target.balance = 0;
        if (target.payoffMonth === null) target.payoffMonth = month;
        if (!clearedThisMonth.includes(target.id)) clearedThisMonth.push(target.id);
      }
    }

    months.push({
      month,
      date: isoMonthStart(addMonths(startDate, month - 1)),
      startingBalance,
      interestCharged,
      principalPaid: totalPaid - interestCharged,
      totalPaid,
      endingBalance: sumBalances(active),
      focusDebtId: focusId,
      clearedDebtIds: clearedThisMonth,
    });
  }

  const cleared = active.every((d) => d.balance <= EPSILON);
  const monthsToFreedom = months.length;

  const perDebt: DebtPayoffDetail[] = active.map((d) => ({
    debtId: d.id,
    name: d.name,
    payoffMonth: d.payoffMonth,
    payoffDate:
      d.payoffMonth === null
        ? null
        : isoMonthStart(addMonths(startDate, d.payoffMonth - 1)),
    interestPaid: round2(d.interestPaid),
    totalPaid: round2(d.totalPaid),
  }));

  return {
    strategy,
    feasible: cleared,
    shortfall: 0,
    months,
    monthsToFreedom,
    payoffDate: cleared
      ? isoMonthStart(addMonths(startDate, Math.max(0, monthsToFreedom - 1)))
      : null,
    totalInterest: round2(active.reduce((s, d) => s + d.interestPaid, 0)),
    totalPaid: round2(active.reduce((s, d) => s + d.totalPaid, 0)),
    perDebt,
    focusDebtId: firstFocusId,
  };
}

/**
 * Run both strategies and pick the winner.
 *
 * Avalanche is provably never worse on interest, but it can tie on months, and
 * when it ties the snowball's early wins are worth more than nothing — so we
 * prefer the plan that clears sooner and only fall back to cost as a tiebreak.
 */
export function compareStrategies(
  debts: Debt[],
  extraPerMonth: number,
  startDate: Date = new Date(),
): StrategyComparison {
  const avalanche = simulatePayoff(debts, extraPerMonth, "avalanche", startDate);
  const snowball = simulatePayoff(debts, extraPerMonth, "snowball", startDate);

  let best = avalanche;
  if (snowball.feasible && !avalanche.feasible) {
    best = snowball;
  } else if (avalanche.feasible === snowball.feasible) {
    if (snowball.monthsToFreedom < avalanche.monthsToFreedom) best = snowball;
    else if (
      snowball.monthsToFreedom === avalanche.monthsToFreedom &&
      snowball.totalInterest < avalanche.totalInterest
    )
      best = snowball;
  }

  return {
    avalanche,
    snowball,
    best,
    monthsSaved: Math.abs(avalanche.monthsToFreedom - snowball.monthsToFreedom),
    interestSaved: round2(Math.abs(avalanche.totalInterest - snowball.totalInterest)),
  };
}

/** Resolve `auto` into a concrete plan. */
export function buildPlan(
  debts: Debt[],
  extraPerMonth: number,
  strategy: Strategy,
  startDate: Date = new Date(),
): { plan: PayoffPlan; comparison: StrategyComparison } {
  const comparison = compareStrategies(debts, extraPerMonth, startDate);
  const plan =
    strategy === "auto"
      ? comparison.best
      : strategy === "avalanche"
        ? comparison.avalanche
        : comparison.snowball;
  return { plan, comparison };
}

/**
 * What the plan looks like if the user adds nothing extra — the baseline the
 * dashboard compares against to show "your extra ฿X buys you Y months".
 */
export function minimumsOnlyPlan(
  debts: Debt[],
  strategy: Exclude<Strategy, "auto"> = "avalanche",
  startDate: Date = new Date(),
): PayoffPlan {
  return simulatePayoff(debts, 0, strategy, startDate);
}

/**
 * Inverse question: "I want to be debt-free in N months — what does that cost
 * per month?" Binary search on the extra, because the payoff month is a
 * monotonic step function of the extra payment.
 */
export function extraNeededForTarget(
  debts: Debt[],
  targetMonths: number,
  strategy: Exclude<Strategy, "auto"> = "avalanche",
  startDate: Date = new Date(),
): number | null {
  if (targetMonths <= 0) return null;
  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  if (totalBalance <= 0) return 0;

  let lo = 0;
  let hi = totalBalance; // paying the whole balance in month 1 always wins
  const fits = (extra: number) => {
    const p = simulatePayoff(debts, extra, strategy, startDate);
    return p.feasible && p.monthsToFreedom <= targetMonths;
  };
  if (!fits(hi)) return null;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}

/** Total owed right now across all open debts. */
export function totalDebt(debts: Debt[]): number {
  return debts.filter((d) => !d.archivedAt).reduce((s, d) => s + d.balance, 0);
}

/**
 * Progress across every open debt, 0–1.
 *
 * Same yardstick as the per-debt `debtProgress`, summed, so Home and the Debts
 * page can never disagree about how far along you are.
 */
export function overallProgress(debts: Debt[]): number {
  const open = debts.filter((d) => !d.archivedAt);
  let denom = 0;
  let balance = 0;
  for (const d of open) {
    const paid = Math.max(0, d.paidTotal ?? 0);
    denom += Math.max(d.principal ?? 0, d.balance + paid);
    balance += Math.max(0, d.balance);
  }
  if (denom <= 0) return 0;
  return clamp01(1 - balance / denom);
}

/** Weighted average APR — the single number that says "how bad is this debt". */
export function blendedApr(debts: Debt[]): number {
  const open = debts.filter((d) => !d.archivedAt && d.balance > 0);
  const total = open.reduce((s, d) => s + d.balance, 0);
  if (total <= 0) return 0;
  return open.reduce((s, d) => s + d.apr * (d.balance / total), 0);
}

function sumBalances(debts: Working[]): number {
  return debts.reduce((s, d) => s + Math.max(0, d.balance), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
