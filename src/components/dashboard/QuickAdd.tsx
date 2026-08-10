"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { AddExpenseSheet } from "@/components/expenses/AddExpenseSheet";
import { categoryLabel } from "@/lib/category";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/date";

/**
 * Two taps to log a spend: category, then amount. The category row is ordered
 * by what this user actually taps, so the coffee they buy every morning drifts
 * to the front on its own.
 */
export function QuickAdd() {
  const { categories, expenses, addExpense, removeExpense } = useFinance();
  const { t, lang, money } = useI18n();
  const { toast } = useToast();

  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [sheetCategoryId, setSheetCategoryId] = useState<string | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Frequency over the last ~30 logs, so the row adapts within a few days.
  const ordered = useMemo(() => {
    const recent = expenses.slice(0, 40);
    const freq = new Map<string, number>();
    recent.forEach((e, i) => {
      // Newer entries count for more.
      freq.set(e.categoryId, (freq.get(e.categoryId) ?? 0) + (40 - i));
    });
    return categories
      .filter((c) => !c.archived)
      .map((c) => ({ c, score: freq.get(c.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [categories, expenses]);

  const open = ordered.find((c) => c.id === openCategoryId);

  const log = (categoryId: string, amount: number) => {
    const created = addExpense({
      categoryId,
      amount,
      date: todayISO(),
      recurrence: "none",
    });
    const category = categories.find((c) => c.id === categoryId);
    toast(`${money(amount)} · ${categoryLabel(category, lang)}`, {
      tone: "neon",
      action: { label: t("common.undo"), onClick: () => removeExpense(created.id) },
    });
    setOpenCategoryId(null);
  };

  return (
    <Card>
      <CardHeader
        title={t("dashboard.quickAddTitle")}
        subtitle={t("dashboard.quickAddSub")}
        action={
          <button
            onClick={() => {
              setSheetCategoryId(undefined);
              setSheetOpen(true);
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-neon text-neon-ink transition-transform active:scale-95 dark:shadow-[0_0_14px_rgba(57,255,20,0.4)]"
            aria-label={t("expenses.add")}
          >
            <Plus size={17} strokeWidth={2.6} />
          </button>
        }
      />

      {/* Horizontal scroll keeps every category one swipe away on a phone,
          and wraps into a grid once there is room. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {ordered.slice(0, 14).map((c) => {
          const active = c.id === openCategoryId;
          return (
            <button
              key={c.id}
              onClick={() => setOpenCategoryId(active ? null : c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all active:scale-95",
                active
                  ? "border-neon bg-neon/12 text-neon dark:shadow-[0_0_14px_rgba(57,255,20,0.25)]"
                  : "border-border bg-surface-2 text-ink hover:border-neon/50",
              )}
            >
              <span className="text-base leading-none">{c.emoji}</span>
              <span className="whitespace-nowrap">{categoryLabel(c, lang)}</span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div className="animate-rise mt-3 rounded-2xl border border-neon/30 bg-neon/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] text-muted">
            <span className="text-base">{open.emoji}</span>
            <span className="font-medium text-ink">{categoryLabel(open, lang)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(open.quickAmounts.length > 0 ? open.quickAmounts : [100, 200, 500]).map((q) => (
              <button
                key={q}
                onClick={() => log(open.id, q)}
                className="tabular rounded-xl bg-neon px-4 py-2.5 text-sm font-bold text-neon-ink transition-transform active:scale-95 dark:shadow-[0_0_14px_rgba(57,255,20,0.35)]"
              >
                {money(q)}
              </button>
            ))}
            <button
              onClick={() => {
                setSheetCategoryId(open.id);
                setSheetOpen(true);
                setOpenCategoryId(null);
              }}
              className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors hover:border-neon/60 hover:text-neon"
            >
              {t("common.add")}…
            </button>
          </div>
        </div>
      ) : null}

      <AddExpenseSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialCategoryId={sheetCategoryId}
      />
    </Card>
  );
}
