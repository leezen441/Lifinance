"use client";

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryLabel, GROUP_COLOR } from "@/lib/category";
import { formatWeekdayShort } from "@/lib/format";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * Two views of the same truth: the last 7 days (did I blow it *today*?) and
 * the per-month category ranking (what is actually eating the budget?).
 */
export function SpendingBreakdown() {
  const { profile, categories, settings } = useFinance();
  const { t, lang, money } = useI18n();

  const top = profile.byCategory.slice(0, 6);
  const max7 = Math.max(...profile.last7.map((d) => d.total), 1);
  const today = todayISO();

  return (
    <Card>
      <CardHeader
        title={t("dashboard.spendingTitle")}
        subtitle={t("dashboard.spendingSub", {
          days: profile.windowDays || settings.spendWindowDays,
        })}
        action={
          <Link
            href="/expenses"
            className="text-[13px] font-medium text-neon underline-offset-2 hover:underline"
          >
            {t("expenses.title")}
          </Link>
        }
      />

      {/* last 7 days */}
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between text-[12px]">
          <span className="text-muted">{t("dashboard.last7")}</span>
          <span className="tabular font-medium">
            {t("expenses.dailyAvg")} {money(profile.dailyAvg)}
          </span>
        </div>
        <div className="flex h-20 items-end gap-1.5">
          {profile.last7.map((d) => {
            const h = Math.max(4, (d.total / max7) * 100);
            const isToday = d.date === today;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-md transition-all duration-500",
                      isToday
                        ? "bg-neon dark:shadow-[0_0_12px_rgba(57,255,20,0.5)]"
                        : "bg-neon/30",
                    )}
                    style={{ height: `${h}%` }}
                    title={money(d.total)}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px]",
                    isToday ? "font-bold text-neon" : "text-muted",
                  )}
                >
                  {formatWeekdayShort(d.date, lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* category ranking */}
      {top.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-center text-[13px] text-muted">
          {t("expenses.empty")}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((row) => {
            const category = categories.find((c) => c.id === row.categoryId);
            const color = category ? GROUP_COLOR[category.group] : GROUP_COLOR.other;
            return (
              <li key={row.categoryId}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-sm leading-none">{category?.emoji ?? "•"}</span>
                    <span className="truncate">{categoryLabel(category, lang)}</span>
                    {category?.isEssential ? (
                      <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">
                        {t("expenses.essential")}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular shrink-0 font-semibold">
                    {money(row.monthlyAvg)}
                    <span className="text-[11px] font-normal text-muted">
                      {t("common.perMonth")}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.min(100, row.share * 100)}%`, background: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
