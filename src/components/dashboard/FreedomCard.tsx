"use client";

import Link from "next/link";
import { ArrowRight, PartyPopper, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Progress, Ring } from "@/components/ui/Progress";
import { Button } from "@/components/ui/Button";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { blendedApr, overallProgress, totalDebt } from "@/lib/debt-engine";

/**
 * The one card that answers "am I okay?" in under two seconds:
 * a date, a countdown, and a bar that moves.
 */
export function FreedomCard() {
  const { debts, plan, monthsSaved, interestSaved, budget } = useFinance();
  const { t, money, monthYear, duration, percent } = useI18n();

  const owed = totalDebt(debts);
  const progress = overallProgress(debts);
  const apr = blendedApr(debts);

  if (debts.length === 0) {
    return (
      <Card neon className="animate-rise">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-neon">
              <PartyPopper size={18} />
              <span className="text-sm font-semibold">{t("dashboard.noDebt")}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{t("dashboard.addFirstDebtSub")}</p>
          </div>
          <Link href="/debts">
            <Button variant="neon" size="md">
              {t("dashboard.addFirstDebt")}
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const infeasible = !plan.feasible;

  return (
    <Card neon className="animate-rise overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">{t("dashboard.freedomTitle")}</p>

          {infeasible ? (
            <>
              <p className="mt-1 text-3xl font-bold tracking-tight text-warn sm:text-4xl">
                —
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-warn/90">
                {t("warnings.minimums_exceed_budget")}
              </p>
            </>
          ) : (
            <>
              <p className="tabular mt-0.5 text-4xl font-bold leading-none tracking-tight text-neon text-glow sm:text-5xl">
                {monthYear(plan.payoffDate)}
              </p>
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-semibold text-ink">
                  {t("dashboard.timeToGo", { time: duration(plan.monthsToFreedom) })}
                </span>{" "}
                · {t("dashboard.freedomSub")}
              </p>
            </>
          )}
        </div>

        <Ring value={progress} size={76}>
          <div className="text-center leading-none">
            <div className="tabular text-sm font-bold">{percent(progress)}</div>
            <div className="mt-0.5 text-[9px] text-muted">{t("dashboard.paidOff")}</div>
          </div>
        </Ring>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="text-muted">{t("dashboard.totalOwed")}</span>
          <span className="tabular text-lg font-bold">{money(owed)}</span>
        </div>
        <Progress value={progress} height="h-2.5" label={t("dashboard.paidOff")} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-[12px]">
        <span className="text-muted">
          {t("dashboard.avgApr")}{" "}
          <span className="tabular font-semibold text-ink">{apr.toFixed(1)}%</span>
        </span>
        <span className="text-muted">
          {t("dashboard.extraRow")}{" "}
          <span className="tabular font-semibold text-neon">
            {money(budget.availableExtra)}
            {t("common.perMonth")}
          </span>
        </span>
        {monthsSaved > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-neon/10 px-2.5 py-1 font-medium text-neon">
            <TrendingDown size={13} />
            {t("dashboard.monthsSooner", { months: duration(monthsSaved) })}
            {interestSaved > 0 ? ` · ${money(interestSaved)}` : ""}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
