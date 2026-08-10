"use client";

import { useMemo, useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { QuickAdd } from "@/components/dashboard/QuickAdd";
import { AddExpenseSheet } from "@/components/expenses/AddExpenseSheet";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryLabel } from "@/lib/category";
import { addDays, todayISO, toISODate } from "@/lib/date";
import { monthPace } from "@/lib/budget-engine";

export default function ExpensesPage() {
  const { expenses, categories, removeExpense, profile } = useFinance();
  const { t, lang, money, dayMonth } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);

  const today = todayISO();
  const weekStart = toISODate(addDays(new Date(), -6));
  const monthStart = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const sum = (from: string) =>
    expenses
      .filter((e) => e.date >= from && e.date <= today && e.recurrence !== "monthly")
      .reduce((s, e) => s + e.amount, 0);

  const pace = monthPace(expenses, profile.variableMonthly);

  /** Grouped by day, newest first — the shape people actually scan. */
  const byDay = useMemo(() => {
    const groups = new Map<string, typeof expenses>();
    for (const e of [...expenses].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const list = groups.get(e.date) ?? [];
      list.push(e);
      groups.set(e.date, list);
    }
    return [...groups.entries()].slice(0, 21);
  }, [expenses]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {t("expenses.title")}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("expenses.subtitle")}</p>
        </div>
        <Button variant="neon" size="md" onClick={() => setSheetOpen(true)}>
          <Plus size={16} />
          {t("expenses.add")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Tile label={t("expenses.todayTotal")} value={money(profile.todayTotal)} neon />
        <Tile label={t("expenses.weekTotal")} value={money(sum(weekStart))} />
        <Tile label={t("expenses.monthTotal")} value={money(sum(monthStart))} />
      </div>

      <Card className="flex items-center justify-between gap-3 py-3">
        <span className="text-[13px] text-muted">
          {t("expenses.paceHint", {
            spent: money(pace.spent),
            target: money(pace.target),
          })}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            pace.onTrack ? "bg-neon/15 text-neon" : "bg-warn/15 text-warn"
          }`}
        >
          {pace.onTrack ? t("expenses.onPace") : t("expenses.overPace")}
        </span>
      </Card>

      <QuickAdd />

      <Card>
        <CardHeader title={t("expenses.recent")} />
        {byDay.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
            {t("expenses.empty")}
          </p>
        ) : (
          <div className="space-y-5">
            {byDay.map(([date, items]) => {
              const dayTotal = items.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={date}>
                  <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1.5">
                    <span className="text-[12px] font-semibold">
                      {date === today ? t("common.today") : dayMonth(date)}
                    </span>
                    <span className="tabular text-[12px] font-semibold text-muted">
                      {money(dayTotal)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((e) => {
                      const category = categories.find((c) => c.id === e.categoryId);
                      return (
                        <li
                          key={e.id}
                          className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-2"
                        >
                          <span className="text-base leading-none">
                            {category?.emoji ?? "•"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">
                            {categoryLabel(category, lang)}
                            {e.note ? (
                              <span className="text-muted"> · {e.note}</span>
                            ) : null}
                            {e.recurrence === "monthly" ? (
                              <Repeat size={11} className="ml-1.5 inline text-muted" />
                            ) : null}
                          </span>
                          <span className="tabular shrink-0 text-[13px] font-semibold">
                            {money(e.amount)}
                          </span>
                          <button
                            onClick={() => removeExpense(e.id)}
                            className="shrink-0 rounded-md p-1 text-muted opacity-0 transition-all hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AddExpenseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

function Tile({ label, value, neon }: { label: string; value: string; neon?: boolean }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`tabular mt-1 text-lg font-bold tracking-tight sm:text-2xl ${
          neon ? "text-neon" : ""
        }`}
      >
        {value}
      </div>
    </Card>
  );
}
