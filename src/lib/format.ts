import type { CurrencyCode, Language } from "./types";
import { fromISODate } from "./date";

/**
 * Formatting is locale-aware but calendar-pinned to Gregorian. Thai locales
 * default to the Buddhist era in `Intl`, which would show 2569 next to an
 * English 2026 — confusing when the user flips languages mid-plan.
 */
const LOCALE: Record<Language, string> = {
  en: "en-US",
  th: "th-TH-u-ca-gregory",
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  THB: "฿",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  JPY: "¥",
};

const ZERO_DECIMAL: CurrencyCode[] = ["JPY"];

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  lang: Language,
  opts: { decimals?: boolean; compact?: boolean } = {},
): string {
  const decimals = opts.decimals ?? false;
  const fractionDigits = ZERO_DECIMAL.includes(currency) ? 0 : decimals ? 2 : 0;
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "currency",
    currency,
    // Without this, en-US renders THB as the literal code ("THB 199,300").
    // The symbol is what people recognise at a glance.
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    notation: opts.compact ? "compact" : "standard",
  }).format(amount);
}

/** Number only — for places where the symbol is already in the label. */
export function formatNumber(
  amount: number,
  lang: Language,
  decimals = 0,
): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatPercent(ratio: number, lang: Language, decimals = 0): string {
  return new Intl.NumberFormat(LOCALE[lang], {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ratio);
}

/** "Mar 2028" / "มี.ค. 2028" */
export function formatMonthYear(iso: string | null, lang: Language): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(LOCALE[lang], {
    month: "short",
    year: "numeric",
  }).format(fromISODate(iso));
}

/** "12 Mar" / "12 มี.ค." */
export function formatDayMonth(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "short",
  }).format(fromISODate(iso));
}

/** Single-letter weekday for the 7-day bar strip. */
export function formatWeekdayShort(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "narrow" }).format(
    fromISODate(iso),
  );
}

/** 38 → "3y 2m" (en) / "3 ปี 2 เดือน" (th) */
export function formatDuration(months: number, lang: Language): string {
  if (months <= 0) return lang === "th" ? "0 เดือน" : "0m";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (lang === "th") {
    const parts: string[] = [];
    if (y > 0) parts.push(`${y} ปี`);
    if (m > 0) parts.push(`${m} เดือน`);
    return parts.join(" ");
  }
  const parts: string[] = [];
  if (y > 0) parts.push(`${y}y`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ");
}
