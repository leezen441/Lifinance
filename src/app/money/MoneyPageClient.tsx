"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, MoneyInput, Toggle } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { AddExpenseSheet } from "@/components/expenses/AddExpenseSheet";
import { AddIncomeSheet } from "@/components/money/AddIncomeSheet";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { categoryLabel } from "@/lib/category";
import { startOfMonthISO, todayISO } from "@/lib/date";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { cn, num } from "@/lib/utils";
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
    debts,
    monthPlan,
    settings,
    updateSettings,
    removeExpense,
    removeIncome,
    addExpense,
    addIncome,
    payDebt,
  } = useFinance();
  const { t, lang, money, dayMonth } = useI18n();
  const { toast } = useToast();
  const search = useSearchParams();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [spendPotOpen, setSpendPotOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [payDebtId, setPayDebtId] = useState<string | undefined>();

  useEffect(() => {
    const action = search.get("action");
    const debt = search.get("debt") ?? undefined;
    if (action === "in") setIncomeOpen(true);
    if (action === "out") {
      setPayDebtId(debt);
      setExpenseOpen(true);
    }
  }, [search]);

  const today = todayISO();
  const monthStart = startOfMonthISO();
  const overspent = monthPlan.leftToSpend < 0;
  const againstPotOnly = Boolean(settings.spendAgainstPotOnly);
  const countSpend = settings.spendCountSpend !== false;
  const countSave = settings.spendCountSave !== false;
  const countDebt = settings.spendCountDebt !== false;

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
        onClick: () => {
          if (expense.debtId) {
            payDebt({
              debtId: expense.debtId,
              amount: expense.amount,
              date: expense.date,
              note: expense.note,
            });
          } else {
            addExpense({
              categoryId: expense.categoryId,
              amount: expense.amount,
              note: expense.note,
              date: expense.date,
              recurrence: expense.recurrence,
            });
          }
        },
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

      <Card neon className="space-y-3 text-center">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            {monthPlan.againstPotOnly ? t("worlds.leftInSpendPot") : t("worlds.leftToSpend")}
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
        </div>

        <div className="rounded-2xl border border-border bg-surface-2 p-3 text-left">
          <Toggle
            checked={againstPotOnly}
            onChange={(next) => {
              if (next && monthPlan.spendPot <= 0) {
                setSpendPotOpen(true);
                return;
              }
              updateSettings({ spendAgainstPotOnly: next });
            }}
            label={t("worlds.againstPotOnly")}
            hint={
              againstPotOnly && monthPlan.spendPot <= 0
                ? t("worlds.againstPotOnlyNeedPot")
                : t("worlds.againstPotOnlyHint")
            }
          />

          {!againstPotOnly ? (
            <>
              <div className="mt-3 text-[13px] font-semibold">{t("worlds.countEnvelopesTitle")}</div>
              <p className="mt-0.5 text-[11px] text-muted">{t("worlds.countEnvelopesHint")}</p>
            </>
          ) : (
            <p className="mt-3 text-[11px] text-muted">{t("worlds.againstPotOnlyHint")}</p>
          )}

          <div className="mt-2.5 space-y-2">
            <div className="flex items-stretch gap-1.5">
              <EnvelopeToggle
                active={againstPotOnly ? monthPlan.spendPot > 0 : countSpend && monthPlan.spendPot > 0}
                label={t("worlds.reservedSpend")}
                amount={
                  monthPlan.spendPot > 0
                    ? money(monthPlan.spendPot)
                    : t("worlds.reservedSpendEmpty")
                }
                hint={
                  monthPlan.spendSuggested > 0
                    ? t("worlds.reservedSpendSuggested", {
                        amount: money(monthPlan.spendSuggested),
                      })
                    : t("worlds.reservedSpendHint")
                }
                onClick={() => {
                  if (againstPotOnly) {
                    setSpendPotOpen(true);
                    return;
                  }
                  updateSettings({ spendCountSpend: !countSpend });
                }}
                inactive={monthPlan.spendPot <= 0}
              />
              <button
                type="button"
                onClick={() => setSpendPotOpen(true)}
                className="grid w-11 shrink-0 place-items-center rounded-xl border border-border bg-bg/40 text-muted transition-colors hover:border-neon/40 hover:text-neon"
                aria-label={t("worlds.reservedSpendEdit")}
              >
                <Pencil size={15} />
              </button>
            </div>

            {!againstPotOnly ? (
              <>
                <EnvelopeToggle
                  active={countSave}
                  label={t("worlds.reservedSave")}
                  hint={monthPlan.saveThisMonth > 0 ? t("worlds.reservedSaveFromGoals") : undefined}
                  amount={
                    monthPlan.saveThisMonth > 0 ? (
                      money(monthPlan.saveThisMonth)
                    ) : (
                      <Link
                        href="/goals"
                        className="text-[12px] font-medium text-neon underline-offset-2 hover:underline"
                      >
                        {t("worlds.reservedSaveEmpty")}
                      </Link>
                    )
                  }
                  onClick={() => updateSettings({ spendCountSave: !countSave })}
                />

                <EnvelopeToggle
                  active={countDebt}
                  label={t("worlds.reservedDebt")}
                  amount={money(monthPlan.payDebtsThisMonth)}
                  onClick={() => updateSettings({ spendCountDebt: !countDebt })}
                />
              </>
            ) : null}
          </div>
        </div>
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
            setPayDebtId(undefined);
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
                      const debtName = entry.debtId
                        ? debts.find((d) => d.id === entry.debtId)?.name
                        : null;
                      return (
                        <li key={row.id} className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExpense(entry);
                              setPayDebtId(entry.debtId);
                              setExpenseOpen(true);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
                          >
                            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                              {entry.debtId ? t("expenses.kindDebt") : t("worlds.tagOut")}
                            </span>
                            <span className="text-base leading-none">
                              {entry.debtId ? "💳" : (category?.emoji ?? "•")}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {debtName ?? categoryLabel(category, lang)}
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
          setPayDebtId(undefined);
        }}
        editing={editingExpense}
        initialDebtId={payDebtId}
      />
      <AddIncomeSheet
        open={incomeOpen}
        onClose={() => {
          setIncomeOpen(false);
          setEditingIncome(null);
        }}
        editing={editingIncome}
      />
      <SpendPotSheet open={spendPotOpen} onClose={() => setSpendPotOpen(false)} />
    </div>
  );
}

function SpendPotSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, monthPlan } = useFinance();
  const { t, money } = useI18n();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    const current = settings.spendPotAmount ?? 0;
    setAmount(current > 0 ? String(current) : "");
  }, [open, settings.spendPotAmount]);

  const value = num(amount);
  const suggested = monthPlan.spendSuggested;

  const submit = (next = value) => {
    updateSettings({
      spendPotAmount: Math.max(0, next),
      spendCountSpend: next > 0,
    });
    toast(t("common.done"), { tone: "neon" });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("worlds.reservedSpendEdit")}
      footer={
        <Button variant="neon" size="lg" className="w-full" onClick={() => submit()}>
          {t("common.save")}
        </Button>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        {t("worlds.reservedSpendHint")}
      </p>

      <div className="mb-4 rounded-2xl border border-neon/30 bg-neon/[0.06] p-3">
        <div className="text-[12px] font-semibold text-muted">
          {t("worlds.reservedSpendSuggested", { amount: money(suggested) })}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {suggested > 0
            ? t("worlds.reservedSpendSuggestedExplain")
            : t("worlds.reservedSpendSuggestedZero")}
        </p>
        <Button
          variant="outline"
          size="md"
          className="mt-2.5 w-full"
          disabled={suggested <= 0}
          onClick={() => {
            setAmount(String(suggested));
            submit(suggested);
          }}
        >
          {t("worlds.reservedSpendUseSuggested")} · {money(suggested)}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="spend-pot">{t("worlds.reservedSpend")}</Label>
        <MoneyInput
          id="spend-pot"
          symbol={CURRENCY_SYMBOL[settings.currency]}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
    </Sheet>
  );
}

function EnvelopeToggle({
  active,
  label,
  amount,
  hint,
  inactive,
  onClick,
}: {
  active: boolean;
  label: string;
  amount: React.ReactNode;
  hint?: string;
  inactive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-neon/40 bg-neon/10"
          : "border-border bg-bg/40 opacity-70 hover:opacity-100",
        inactive && !active && "opacity-50",
      )}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-bold",
              active ? "border-neon bg-neon text-neon-ink" : "border-border text-transparent",
            )}
          >
            {active ? "✓" : "·"}
          </span>
          <span className={cn("text-[13px] font-medium", active ? "text-ink" : "text-muted")}>
            {label}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-right text-[13px] font-semibold",
            typeof amount === "string" && active ? "tabular text-neon" : "",
            typeof amount === "string" && !active ? "tabular text-muted" : "",
          )}
        >
          {amount}
        </span>
      </span>
      {hint ? <span className="pl-7 text-[10px] text-muted">{hint}</span> : null}
    </button>
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
