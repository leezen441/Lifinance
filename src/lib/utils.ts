import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  evalMoneyExpression,
  isIncompleteMoneyExpression,
  normalizeMoneyExpression,
} from "./money-expr";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Safe number parse for text inputs — empty/garbage becomes the fallback.
 * Also accepts simple calculator expressions: `120+80`, `1000-250`, `50*3`.
 */
export function num(value: string | number, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const str = String(value).trim();
  if (!str) return fallback;

  const evaluated = evalMoneyExpression(str);
  if (evaluated !== null) return evaluated;

  // "120+" mid-typing — keep the left side, don't strip into garbage.
  if (/[+\-*/×÷xX(]/.test(str)) {
    if (isIncompleteMoneyExpression(str)) {
      const head = normalizeMoneyExpression(str).replace(/[+\-*/(]+$/, "");
      const partial = evalMoneyExpression(head);
      return partial !== null ? partial : fallback;
    }
    return fallback;
  }

  const parsed = Number(str.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
