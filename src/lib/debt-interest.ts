/**
 * Daily interest accrual + payment application for real tracked debts.
 *
 * APR is quoted yearly; we use /365 simple daily interest (common consumer
 * approximation). Accrual is idempotent per calendar day via `lastInterestDate`.
 */

import type { Debt } from "./types";
import { daysBetween, fromISODate, todayISO } from "./date";

const EPSILON = 0.005;

export const DEBT_PAYMENT_CATEGORY_ID = "cat_debt_payment";

/** Days in the interest year — simple daily APR/365. */
export const DAYS_PER_YEAR = 365;

export function dailyInterest(balance: number, apr: number, days = 1): number {
  if (balance <= EPSILON || apr <= 0 || days <= 0) return 0;
  return (balance * apr) / 100 / DAYS_PER_YEAR * days;
}

function debtStartDate(debt: Debt): string {
  if (debt.lastInterestDate) return debt.lastInterestDate;
  if (debt.createdAt.length >= 10) return debt.createdAt.slice(0, 10);
  return todayISO();
}

/** Round to 2 decimal places (satang / cents). */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Accrue simple daily interest from lastInterestDate (or created day) up to
 * `asOf` (exclusive of starting day, inclusive of catching up to asOf).
 * Days = calendar days between last date and asOf.
 */
export function accrueDebtToDate(debt: Debt, asOf: string = todayISO()): Debt {
  if (debt.archivedAt || debt.balance <= EPSILON) {
    return debt.lastInterestDate === asOf ? debt : { ...debt, lastInterestDate: asOf };
  }

  const from = debtStartDate(debt);
  const days = daysBetween(fromISODate(from), fromISODate(asOf));
  if (days <= 0) {
    return debt.lastInterestDate === asOf ? debt : { ...debt, lastInterestDate: asOf };
  }

  const interest = roundMoney(dailyInterest(debt.balance, debt.apr, days));
  if (interest <= 0) {
    return { ...debt, lastInterestDate: asOf };
  }

  return {
    ...debt,
    balance: roundMoney(debt.balance + interest),
    interestAccrued: roundMoney((debt.interestAccrued ?? 0) + interest),
    lastInterestDate: asOf,
  };
}

export function accrueAllDebts(debts: Debt[], asOf: string = todayISO()): Debt[] {
  let changed = false;
  const next = debts.map((d) => {
    const updated = accrueDebtToDate(d, asOf);
    if (updated !== d && (updated.balance !== d.balance || updated.lastInterestDate !== d.lastInterestDate)) {
      changed = true;
    }
    return updated;
  });
  return changed ? next : debts;
}

/**
 * How far through this debt you are, 0–1.
 *
 * One definition, used by every screen. Two were in play before and they
 * disagreed badly — the same card read 31.3% on Home and 14.6% on the Debts
 * page, because one measured against the original borrowing and the other
 * counted only payments logged inside the app.
 *
 * The yardstick is whichever is larger: what was originally borrowed, or
 * everything that has actually moved through the debt (still owed + repaid).
 * Taking the max matters at both ends — measuring against payments alone shows
 * 0% for a debt you imported halfway through paying off, and measuring against
 * the original alone shows negative progress once interest outgrows it.
 */
export function debtProgress(
  debt: Pick<Debt, "balance" | "principal" | "paidTotal" | "archivedAt">,
): number {
  if (debt.archivedAt || debt.balance <= EPSILON) return 1;
  const paid = Math.max(0, debt.paidTotal ?? 0);
  const balance = Math.max(0, debt.balance);
  const denom = Math.max(debt.principal ?? 0, balance + paid);
  if (denom <= EPSILON) return 1;
  return Math.min(1, Math.max(0, (denom - balance) / denom));
}

export interface ApplyPaymentResult {
  debt: Debt;
  applied: number;
  cleared: boolean;
}

/** Apply a payment after interest has been accrued for `asOf`. */
export function applyDebtPayment(
  debt: Debt,
  amount: number,
  asOf: string = todayISO(),
): ApplyPaymentResult {
  const current = accrueDebtToDate(debt, asOf);
  const pay = Math.max(0, roundMoney(amount));
  if (pay <= 0) {
    return { debt: current, applied: 0, cleared: Boolean(current.archivedAt) };
  }

  const applied = Math.min(pay, current.balance);
  const balance = roundMoney(current.balance - applied);
  const paidTotal = roundMoney((current.paidTotal ?? 0) + applied);
  const cleared = balance <= EPSILON;

  return {
    applied,
    cleared,
    debt: {
      ...current,
      balance: cleared ? 0 : balance,
      paidTotal,
      archivedAt: cleared ? current.archivedAt ?? asOf : current.archivedAt,
      lastInterestDate: asOf,
    },
  };
}

/** Undo a payment (e.g. delete expense). Reopens the debt if it was cleared. */
export function reverseDebtPayment(debt: Debt, amount: number): Debt {
  const pay = Math.max(0, roundMoney(amount));
  if (pay <= 0) return debt;
  const paidTotal = Math.max(0, roundMoney((debt.paidTotal ?? 0) - pay));
  return {
    ...debt,
    balance: roundMoney(debt.balance + pay),
    paidTotal,
    archivedAt: undefined,
  };
}
