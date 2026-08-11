"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Repeat, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AddExpenseSheet } from "@/components/expenses/AddExpenseSheet";
import { AddIncomeSheet } from "@/components/money/AddIncomeSheet";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryLabel } from "@/lib/category";
import { startOfMonthISO, todayISO } from "@/lib/date";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Expense, IncomeEntry } from "@/lib/types";

type Activity =
  | { kind: "in"; id: string; date: string; amount: number; entry: IncomeEntry }
  | { kind: "out"; id: string; date: string; amount: number; entry: Expense };

/** Spend world — money in, money out, what's left. */
export default function MoneyPageClient() {
  const {
    expenses,
    incomes,
    categories,
    monthPlan,
    removeExpense,
    removeIncome,
    addExpense,
    addIncome,
  } = useFinance();
  const { t, lang, money, dayMonth } = useI18n();
  const { toast } = useToast();
  const search = useSearchParams();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);

  useEffect(() => {
    const action = search.get("action");
    if (action === "in") setIncomeOpen(true);
    if (action === "out") setExpenseOpen(true);
  }, [search]);

  const today = todayISO();
  const monthStart = startOfMonthISO();
  const overspent = monthPlan.leftToSpend < 0;

  const activity = useMemo(() => {
    const rows: Activity[] = [
      ...incomes
        .filter((i) => i.date >= monthStart && i.date <= today)
        .map((entry) => ({
          kind: "in" as const,
          id: entry.id,
          date: entry.date,
          amount: entry.amount,
          entry,
        })),
      ...expenses
        .filter((e) => e.date >= monthStart && e.date <= today)
        .map((entry) => ({
          kind: "out" as const,
          id: entry.id,
          date: entry.date,
          amount: entry.amount,
          entry,
        })),
    ];
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const groups = new Map<string, Activity[]>();
    for (const row of rows) {
      const list = groups.get(row.date) ?? [];
      list.push(row);
      groups.set(row.date, list);
    }
    return [...groups.entries()];
  }, [incomes, expenses, monthStart, today]);

  const removeOut = (expense: Expense) => {
    removeExpense(expense.id);
    toast(`${t("expenses.deleted")} · ${money(expense.amount)}`, {
      action: {
        label: t("common.undo"),
        onClick: () =>
          addExpense({
            categoryId: expense.categoryId,
            amount: expense.amount,
            note: expense.note,
            date: expense.date,
            recurrence: expense.recurrence,
          }),
      },
      duration: 6000,
    });
  };

  const removeIn = (entry: IncomeEntry) => {
    removeIncome(entry.id);
    toast(`${t("expenses.deleted")} · ${money(entry.amount)}`, {
      action: {
        label: t("common.undo"),
        onClick: () =>
          addIncome({
            amount: entry.amount,
            note: entry.note,
            date: entry.date,
            kind: entry.kind,
          }),
      },
      duration: 6000,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("expenses.title")}</h1>
        <p className="mt-0.5 text-[13px] text-muted">{t("expenses.subtitle")}</p>
      </div>

      <Card neon className="text-center">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          {t("worlds.leftToSpend")}
        </div>
        <div
          className={cn(
            "tabular mt-1 text-4xl font-bold tracking-tight",
            overspent ? "text-warn" : "text-neon text-glow",
          )}
        >
          {money(monthPlan.leftToSpend)}
        </div>
        {overspent ? (
          <p className="mt-2 text-[12px] text-warn">{t("worlds.leftToSpendWarn")}</p>
        ) : null}
      </Card>

      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat
          label={t("worlds.moneyIn")}
          value={money(monthPlan.moneyIn)}
          hint={
            monthPlan.moneyInEstimated
              ? t("worlds.moneyInEstimated")
              : t("worlds.moneyInLogged")
          }
        />
        <MiniStat label={t("worlds.moneyOut")} value={money(monthPlan.moneyOut)} />
        <MiniStat
          label={t("worlds.setAside")}
          value={money(monthPlan.reserved)}
          hint={t("worlds.setAsideHint")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="neon"
          size="lg"
          className="w-full"
          onClick={() => {
            setEditingIncome(null);
            setIncomeOpen(true);
          }}
        >
          <ArrowDownLeft size={18} />
          {t("worlds.addIncome")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => {
            setEditingExpense(null);
            setExpenseOpen(true);
          }}
        >
          <ArrowUpRight size={18} />
          {t("worlds.addExpense")}
        </Button>
      </div>

      <Card>
        <h2 className="mb-3 text-[14px] font-semibold">{t("worlds.activityTitle")}</h2>
        {activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
            {t("worlds.incomeEmpty")}
          </p>
        ) : (
          <div className="space-y-5">
            {activity.map(([date, items]) => {
              const net = items.reduce(
                (s, row) => s + (row.kind === "in" ? row.amount : -row.amount),
                0,
              );
              return (
                <div key={date}>
                  <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1.5">
                    <span className="text-[12px] font-semibold">
                      {date === today ? t("common.today") : dayMonth(date)}
                    </span>
                    <span
                      className={cn(
                        "tabular text-[12px] font-semibold",
                        net >= 0 ? "text-neon" : "text-muted",
                      )}
                    >
                      {net >= 0 ? "+" : ""}
                      {money(net)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {items.map((row) => {
                      if (row.kind === "in") {
                        const entry = row.entry;
                        return (
                          <li key={row.id} className="group flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingIncome(entry);
                                setIncomeOpen(true);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
                            >
                              <span className="rounded-md bg-neon/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neon">
                                {t("worlds.tagIn")}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px]">
                                {entry.kind === "salary"
                                  ? t("worlds.incomeKindSalary")
                                  : t("worlds.incomeKindOther")}
                                {entry.note ? (
                                  <span className="text-muted"> · {entry.note}</span>
                                ) : null}
                              </span>
                              <span className="tabular shrink-0 text-[13px] font-semibold text-neon">
                                +{money(entry.amount)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeIn(entry)}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100"
                              aria-label={t("common.delete")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </li>
                        );
                      }

                      const entry = row.entry;
                      const category = categories.find((c) => c.id === entry.categoryId);
                      return (
                        <li key={row.id} className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(entry);
                              setExpenseOpen(true);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                              {t("worlds.tagOut")}
                            </span>
                            <span className="text-base leading-none">
                              {category?.emoji ?? "•"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {categoryLabel(category, lang)}
                              {entry.note ? (
                                <span className="text-muted"> · {entry.note}</span>
                              ) : null}
                              {entry.recurrence === "monthly" ? (
                                <Repeat size={11} className="ml-1.5 inline text-muted" />
                              ) : null}
                            </span>
                            <span className="tabular shrink-0 text-[13px] font-semibold">
                              −{money(entry.amount)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOut(entry)}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger sm:h-9 sm:w-9 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 size={15} />
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

      <AddExpenseSheet
        open={expenseOpen}
        onClose={() => {
          setExpenseOpen(false);
          setEditingExpense(null);
        }}
        editing={editingExpense}
      />
      <AddIncomeSheet
        open={incomeOpen}
        onClose={() => {
          setIncomeOpen(false);
          setEditingIncome(null);
        }}
        editing={editingIncome}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular mt-1 text-base font-bold tracking-tight sm:text-lg">{value}</div>
      {hint ? <div className="mt-0.5 text-[10px] leading-snug text-muted">{hint}</div> : null}
    </Card>
  );
}
