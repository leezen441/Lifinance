"use client";

import Link from "next/link";
import { Flame, Info, Target } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { Strategy } from "@/lib/types";

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

/**
 * Strategy picker + the ordered attack list. The focus debt is visually loud
 * on purpose: the entire method reduces to "put everything spare here".
 */
export function PayoffPlanCard() {
  const { debts, plan, comparison, settings, updateSettings, budget } = useFinance();
  const { t, money, duration, monthYear } = useI18n();

  if (debts.length === 0) return null;

  const active = STRATEGIES.find((s) => s.value === settings.strategy) ?? STRATEGIES[0];

  // Payoff order = the order the engine actually clears them in.
  const ordered = [...plan.perDebt].sort((a, b) => {
    if (a.payoffMonth === null) return 1;
    if (b.payoffMonth === null) return -1;
    return a.payoffMonth - b.payoffMonth;
  });

  const focus = debts.find((d) => d.id === plan.focusDebtId);
  const focusDetail = plan.perDebt.find((p) => p.debtId === plan.focusDebtId);
  const focusExtra = budget.availableExtra + (focus?.minPayment ?? 0);

  return (
    <Card>
      <CardHeader
        title={t("dashboard.planTitle")}
        subtitle={active ? t(active.hintKey) : undefined}
        action={
          <Link
            href="/debts"
            className="text-[13px] font-medium text-neon underline-offset-2 hover:underline"
          >
            {t("debts.title")}
          </Link>
        }
      />

      {/* Strategy segmented control */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
        {STRATEGIES.map((s) => {
          const isActive = settings.strategy === s.value;
          return (
            <button
              key={s.value}
              onClick={() => updateSettings({ strategy: s.value })}
              aria-pressed={isActive}
              className={cn(
                "rounded-xl px-2 py-2 text-[12px] font-semibold transition-all sm:text-[13px]",
                isActive
                  ? "bg-neon text-neon-ink dark:shadow-[0_0_14px_rgba(57,255,20,0.35)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t(s.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Focus debt */}
      {focus && plan.feasible ? (
        <div className="mb-4 rounded-2xl border border-neon/35 bg-neon/[0.06] p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neon">
            <Flame size={14} />
            {t("dashboard.focusTitle")}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold">{focus.name}</div>
              <div className="text-[13px] text-muted">
                {focus.apr.toFixed(1)}% · {t("dashboard.payoffIn")}{" "}
                <span className="font-semibold text-ink">
                  {focusDetail?.payoffMonth ? duration(focusDetail.payoffMonth) : "—"}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="tabular text-xl font-bold text-neon">{money(focusExtra)}</div>
              <div className="text-[11px] text-muted">{t("common.perMonth")}</div>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {t("dashboard.focusSub")}
          </p>
        </div>
      ) : null}

      {/* Ordered list */}
      <ol className="space-y-3">
        {ordered.map((detail, i) => {
          const debt = debts.find((d) => d.id === detail.debtId);
          if (!debt) return null;
          const paid = Math.max(debt.principal, debt.balance);
          const progress = paid > 0 ? 1 - debt.balance / paid : 0;
          const isFocus = debt.id === plan.focusDebtId;
          return (
            <li key={detail.debtId} className="flex items-start gap-3">
              <span
                className={cn(
                  "tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold",
                  isFocus ? "bg-neon text-neon-ink" : "bg-surface-2 text-muted",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{debt.name}</span>
                  <span className="tabular shrink-0 text-sm font-semibold">
                    {money(debt.balance)}
                  </span>
                </div>
                <Progress value={progress} height="h-1.5" className="mt-1.5" glow={isFocus} />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted">
                  <span>
                    {debt.apr.toFixed(1)}% · {t("debts.minPayment")} {money(debt.minPayment)}
                  </span>
                  <span className="tabular">
                    {detail.payoffDate ? monthYear(detail.payoffDate) : "—"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Strategy comparison footnote */}
      <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[12px] text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          {comparison.interestSaved > 0.5 || comparison.monthsSaved > 0 ? (
            <>
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
                    : duration(comparison.monthsSaved),
              })}
            </>
          ) : (
            t("dashboard.sameEither")
          )}{" "}
          <span className="whitespace-nowrap">
            · {t("debts.totalInterest")}:{" "}
            <span className="tabular font-medium text-ink">{money(plan.totalInterest)}</span>
          </span>
        </p>
      </div>

      {!plan.feasible ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-[12px] leading-relaxed text-warn">
          <Target size={14} className="mt-0.5 shrink-0" />
          <span>{t("warnings.minimums_exceed_budget")}</span>
        </div>
      ) : null}
    </Card>
  );
}
