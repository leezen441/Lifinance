"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MilestoneBar } from "@/components/ui/Progress";
import { DebtSheet } from "@/components/debts/DebtSheet";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { dailyInterest, debtProgress } from "@/lib/debt-interest";
import { cn } from "@/lib/utils";
import type { Debt, Strategy } from "@/lib/types";

const STRATEGIES: { value: Strategy; labelKey: string; hintKey: string }[] = [
  { value: "auto", labelKey: "dashboard.strategyAuto", hintKey: "dashboard.strategyAutoHint" },
  {
    value: "avalanche",
    labelKey: "dashboard.strategyAvalanche",
    hintKey: "dashboard.strategyAvalancheHint",
  },
  {
    value: "snowball",
    labelKey: "dashboard.strategySnowball",
    hintKey: "dashboard.strategySnowballHint",
  },
];

const MILESTONES = [0.25, 0.5, 0.75, 1] as const;

/**
 * Debt world — pay how much, and which debt first. Strategy is tucked away.
 */
export default function DebtsPage() {
  const { debts, monthPlan, plan, removeDebt, settings, updateSettings, comparison } =
    useFinance();
  const { t, money, monthYear, percent } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const openDebts = debts.filter((d) => !d.archivedAt && d.balance > 0);
  const closedDebts = debts.filter((d) => d.archivedAt || d.balance <= 0);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("debts.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("debts.subtitle")}</p>
        </div>
        <Button variant="neon" size="md" onClick={openNew}>
          <Plus size={16} />
          {t("debts.add")}
        </Button>
      </div>

      <Card neon className="text-center">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          {t("worlds.payDebtsThisMonth")}
        </div>
        <div className="tabular mt-1 text-4xl font-bold tracking-tight text-neon text-glow">
          {money(monthPlan.payDebtsThisMonth)}
        </div>
        <p className="mt-2 text-[12px] text-muted">{t("worlds.payOrderHint")}</p>
        {monthPlan.debtPaidThisMonth > 0 ? (
          <p className="mt-1 text-[12px] text-ink">
            {t("debts.progress")} {money(monthPlan.debtPaidThisMonth)}
          </p>
        ) : null}
        {monthPlan.debtFreeDate ? (
          <p className="mt-1 text-[12px] font-medium text-ink">
            {t("worlds.debtFreeOn", { date: monthYear(monthPlan.debtFreeDate) })}
          </p>
        ) : null}
      </Card>

      {openDebts.length === 0 && closedDebts.length === 0 ? (
        <Card>
          <button
            type="button"
            onClick={openNew}
            className="block w-full rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted transition-colors hover:border-neon/50 hover:text-neon"
          >
            {t("worlds.noDebtsYet")}
          </button>
        </Card>
      ) : (
        <ol className="space-y-3">
          {monthPlan.payOrder.map((item) => {
            const debt = openDebts.find((d) => d.id === item.debtId);
            if (!debt) return null;
            const progress = debtProgress(debt);
            const interestDay = dailyInterest(debt.balance, debt.apr, 1);
            return (
              <li key={item.debtId}>
                <Card neon={item.isFocus}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "tabular grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[13px] font-bold",
                        item.isFocus ? "bg-neon text-neon-ink" : "bg-surface-2 text-muted",
                      )}
                    >
                      {item.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold uppercase tracking-wide text-muted">
                            {t("worlds.payNthN", { n: item.rank })}
                          </div>
                          <div className="truncate text-lg font-bold">{debt.name}</div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(debt);
                              setSheetOpen(true);
                            }}
                            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
                            aria-label={t("common.edit")}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(t("common.confirmDelete"))) removeDebt(debt.id);
                            }}
                            className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                            aria-label={t("common.delete")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between gap-3">
                        <span className="tabular text-2xl font-bold text-neon">
                          {money(debt.balance)}
                        </span>
                        <span className="tabular text-[13px] text-muted">
                          {t("common.of")} {money(Math.max(debt.principal, debt.balance))}
                        </span>
                      </div>

                      <MilestoneBar value={progress} className="mt-2.5" />

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="tabular font-semibold text-neon">{percent(progress)}</span>
                        <div className="flex gap-2">
                          {MILESTONES.map((m) => {
                            const hit = progress >= m;
                            return (
                              <span
                                key={m}
                                className={cn(
                                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                                  hit
                                    ? "bg-neon/15 text-neon"
                                    : "bg-surface-2 text-muted opacity-60",
                                )}
                              >
                                {hit ? <Check size={9} strokeWidth={3.5} /> : null}
                                {Math.round(m * 100)}%
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
                        <div>
                          <div className="text-[11px] text-muted">{t("worlds.focusPay", { name: debt.name })}</div>
                          <div className="tabular text-lg font-bold text-ink">
                            {money(item.payThisMonth)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted">
                            {t("debts.minPayment")} {money(item.minPayment)}
                            {item.extra > 0 ? ` + ${money(item.extra)}` : null}
                          </div>
                          {interestDay > 0 ? (
                            <div className="mt-0.5 text-[11px] text-muted">
                              {t("debts.dailyInterest")} ≈ {money(interestDay)}
                              {t("common.perDay")}
                            </div>
                          ) : null}
                        </div>
                        <Link href={`/money?action=out&debt=${debt.id}`}>
                          <Button variant="neon" size="md">
                            {t("debts.payThis")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {closedDebts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="px-1 text-[13px] font-semibold text-muted">{t("debts.closedTitle")}</h2>
          {closedDebts.map((debt) => (
            <Card key={debt.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-neon">
                    <Check size={15} strokeWidth={3} />
                    <span className="text-[12px] font-semibold">{t("debts.cleared")}</span>
                  </div>
                  <div className="truncate font-semibold">{debt.name}</div>
                </div>
                <div className="tabular text-[13px] text-muted">100%</div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {openDebts.length > 0 ? (
        <Card>
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <Info size={15} className="text-muted" />
              {t("worlds.whyOrder")}
            </span>
            <ChevronDown
              size={16}
              className={cn("text-muted transition-transform", whyOpen && "rotate-180")}
            />
          </button>
          {whyOpen ? (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
                {STRATEGIES.map((s) => {
                  const active = settings.strategy === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateSettings({ strategy: s.value })}
                      className={cn(
                        "rounded-xl px-2 py-2 text-[11px] font-semibold sm:text-[12px]",
                        active ? "bg-neon text-neon-ink" : "text-muted hover:text-ink",
                      )}
                    >
                      {t(s.labelKey)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] leading-relaxed text-muted">
                {t(
                  STRATEGIES.find((s) => s.value === settings.strategy)?.hintKey ??
                    "dashboard.strategyAutoHint",
                )}
              </p>
              {comparison.interestSaved > 0.5 || comparison.monthsSaved > 0 ? (
                <p className="text-[12px] text-muted">
                  <span className="font-medium text-ink">
                    {t(
                      comparison.best.strategy === "avalanche"
                        ? "dashboard.strategyAvalanche"
                        : "dashboard.strategySnowball",
                    )}
                  </span>{" "}
                  {t("dashboard.savesVs", {
                    amount:
                      comparison.interestSaved > 0.5
                        ? money(comparison.interestSaved)
                        : String(comparison.monthsSaved),
                  })}
                </p>
              ) : null}
              {!plan.feasible ? (
                <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-[12px] text-warn">
                  {t("warnings.minimums_exceed_budget")}
                </p>
              ) : null}
              <p className="text-[12px] text-muted">
                <Link href="/settings" className="text-neon underline-offset-2 hover:underline">
                  {t("nav.settings")}
                </Link>
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      <DebtSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} />
    </div>
  );
}
