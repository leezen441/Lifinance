/**
 * "How much should I actually spend each month?"
 *
 * Not a blind 50/30/20. That rule assumes no debt and a stable emergency fund;
 * apply it to someone paying 20% APR and it tells them to keep spending 30% on
 * wants while the card compounds. The allocation here reacts to the two things
 * that genuinely change the right answer:
 *
 *   1. Do you have a safety net yet?  (no fund → savings comes first)
 *   2. How expensive is your debt?    (high APR → lifestyle yields to payoff)
 *
 * Essentials are treated as near-fixed: you cannot decide to pay less rent this
 * month. So the recommendation lands almost entirely on discretionary spending,
 * and names which categories to trim rather than just quoting a total.
 */

import type { Debt, Goal, SpendProfile } from "./types";
import { blendedApr, totalMinimums } from "./debt-engine";

export type AdviceLevel = "ok" | "watch" | "over";

export interface CategoryAdvice {
  categoryId: string;
  current: number;
  recommended: number;
  /** Negative = spend less. */
  delta: number;
  level: AdviceLevel;
  isEssential: boolean;
}

export type AdviceNote =
  | "housing_heavy"
  | "no_income"
  | "essentials_exceed_income"
  | "no_emergency_fund"
  | "high_apr_debt"
  | "comfortable"
  | "estimate_only";

export interface BudgetRecommendation {
  income: number;
  /** The headline number: total monthly living spend to aim for. */
  recommendedLiving: number;
  /** What they'd spend if nothing changes. */
  currentLiving: number;
  /** Positive = must cut this much per month. */
  gap: number;

  essentials: number;
  lifestyleAllowance: number;
  savings: number;
  debtPayment: number;

  /** Share of income, for the ring/labels. */
  shares: { living: number; savings: number; debt: number };

  feasible: boolean;
  perCategory: CategoryAdvice[];
  notes: AdviceNote[];
}

/** Housing above this share of income is the single biggest budget killer. */
const HOUSING_CEILING = 0.3;
/** Floor for savings once an emergency fund exists. */
const SAVINGS_MIN = 0.05;
/** Target while there is no emergency fund at all. */
const SAVINGS_URGENT = 0.1;
/** Above this blended APR, debt outranks discretionary spending. */
const HIGH_APR = 15;
/** Never recommend cutting a discretionary category by more than this. */
const MAX_CUT = 0.5;

export function recommendBudget(
  income: number,
  profile: SpendProfile,
  debts: Debt[],
  goals: Goal[],
  categoryIsEssential: (categoryId: string) => boolean,
): BudgetRecommendation {
  const notes: AdviceNote[] = [];
  const open = debts.filter((d) => !d.archivedAt && d.balance > 0);

  const essentials = profile.essentialMonthly;
  const lifestyle = profile.lifestyleMonthly;
  const currentLiving = essentials + lifestyle;

  if (income <= 0) {
    notes.push("no_income");
    return {
      income: 0,
      recommendedLiving: currentLiving,
      currentLiving,
      gap: 0,
      essentials,
      lifestyleAllowance: lifestyle,
      savings: 0,
      debtPayment: 0,
      shares: { living: 0, savings: 0, debt: 0 },
      feasible: false,
      perCategory: [],
      notes,
    };
  }

  if (!profile.hasEnoughData) notes.push("estimate_only");

  // --- 1. Savings comes off the top -----------------------------------
  const emergencyFund = goals
    .filter((g) => g.isEmergencyFund)
    .reduce((s, g) => s + g.saved, 0);
  const runwayMonths = currentLiving > 0 ? emergencyFund / currentLiving : 0;
  const hasNet = runwayMonths >= 3;
  if (!hasNet) notes.push("no_emergency_fund");

  const apr = blendedApr(open);
  const expensiveDebt = open.length > 0 && apr >= HIGH_APR;
  if (expensiveDebt) notes.push("high_apr_debt");

  // No safety net → build one first, even ahead of extra debt payments. One
  // emergency on a credit card undoes a year of overpayment.
  const savingsRate = hasNet ? SAVINGS_MIN : SAVINGS_URGENT;
  const savings = income * savingsRate;

  // --- 2. Debt takes its minimums, plus a push if it's expensive -------
  const minimums = totalMinimums(open);
  const debtPush = expensiveDebt ? income * 0.1 : open.length > 0 ? income * 0.05 : 0;
  const debtPayment = minimums + debtPush;

  // --- 3. Whatever remains is the living budget ------------------------
  let recommendedLiving = income - savings - debtPayment;

  // Essentials are close to fixed, so a living budget below them is fiction.
  // Report it honestly instead of pretending the plan works.
  let feasible = true;
  if (recommendedLiving < essentials) {
    recommendedLiving = Math.max(essentials, income - minimums);
    feasible = recommendedLiving >= essentials && income >= essentials + minimums;
    if (!feasible) notes.push("essentials_exceed_income");
  }

  const lifestyleAllowance = Math.max(0, recommendedLiving - essentials);
  const gap = Math.max(0, currentLiving - recommendedLiving);

  // Housing is checked against income directly — it is the one essential big
  // enough that the right advice is "move or take in a flatmate", not "trim".
  const housing = profile.byCategory.find((c) => c.categoryId === "cat_rent");
  if (housing && housing.monthlyAvg > income * HOUSING_CEILING) notes.push("housing_heavy");

  if (gap <= 0 && feasible) notes.push("comfortable");

  // --- 4. Per-category targets ----------------------------------------
  // Discretionary categories scale toward the allowance proportionally, so the
  // biggest line takes the biggest cut, and nothing is cut past MAX_CUT.
  const scale = lifestyle > 0 ? Math.min(1, lifestyleAllowance / lifestyle) : 1;

  const perCategory: CategoryAdvice[] = profile.byCategory.map((row) => {
    const isEssential = categoryIsEssential(row.categoryId);
    const current = row.monthlyAvg;

    if (isEssential) {
      return {
        categoryId: row.categoryId,
        current,
        recommended: current,
        delta: 0,
        level: row.categoryId === "cat_rent" && current > income * HOUSING_CEILING ? "over" : "ok",
        isEssential: true,
      };
    }

    const recommended = Math.max(current * (1 - MAX_CUT), current * scale);
    const delta = recommended - current;
    const level: AdviceLevel =
      delta >= -1 ? "ok" : delta / current <= -0.25 ? "over" : "watch";

    return { categoryId: row.categoryId, current, recommended, delta, level, isEssential: false };
  });

  return {
    income,
    recommendedLiving,
    currentLiving,
    gap,
    essentials,
    lifestyleAllowance,
    savings,
    debtPayment,
    shares: {
      living: recommendedLiving / income,
      savings: savings / income,
      debt: debtPayment / income,
    },
    feasible,
    perCategory,
    notes,
  };
}

/** Daily allowance for discretionary spending — easier to hold than a monthly. */
export function dailyAllowance(recommendation: BudgetRecommendation): number {
  return recommendation.lifestyleAllowance / 30.44;
}
