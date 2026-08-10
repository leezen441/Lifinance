"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { CurrencyCode, Language } from "@/lib/types";
import { interpolate, lookup, type TranslationKey } from "./dictionaries";
import {
  formatDayMonth,
  formatDuration,
  formatMoney,
  formatMonthYear,
  formatNumber,
  formatPercent,
} from "@/lib/format";

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Translate a dot-path key, with optional `{placeholder}` values. */
  t: (key: TranslationKey | string, vars?: Record<string, string | number>) => string;
  money: (amount: number, opts?: { decimals?: boolean; compact?: boolean }) => string;
  number: (amount: number, decimals?: number) => string;
  percent: (ratio: number, decimals?: number) => string;
  monthYear: (iso: string | null) => string;
  dayMonth: (iso: string) => string;
  duration: (months: number) => string;
  currency: CurrencyCode;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  lang,
  setLang,
  currency,
  children,
}: {
  lang: Language;
  setLang: (lang: Language) => void;
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (key: TranslationKey | string, vars?: Record<string, string | number>) =>
      interpolate(lookup(lang, key), vars),
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t,
      currency,
      money: (amount, opts) => formatMoney(amount, currency, lang, opts),
      number: (amount, decimals) => formatNumber(amount, lang, decimals),
      percent: (ratio, decimals) => formatPercent(ratio, lang, decimals),
      monthYear: (iso) => formatMonthYear(iso, lang),
      dayMonth: (iso) => formatDayMonth(iso, lang),
      duration: (months) => formatDuration(months, lang),
    }),
    [lang, setLang, currency, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
