"use client";

import Link from "next/link";
import { Check, Plus, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { MilestoneBar } from "@/components/ui/Progress";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { emergencyRunwayMonths } from "@/lib/budget-engine";
import { cn } from "@/lib/utils";

/**
 * Goals are the "why". Milestones are segmented rather than continuous so
 * crossing 25/50/75% is a visible event, not a pixel of extra fill.
 */
export function GoalsStrip() {
  const { goals, profile } = useFinance();
  const { t, money, percent } = useI18n();

  const runway = emergencyRunwayMonths(goals, profile);

  return (
    <Card>
      <CardHeader
        title={t("dashboard.goalsTitle")}
        subtitle={t("dashboard.goalsSub")}
        action={
          <Link
            href="/goals"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted transition-colors hover:border-neon/60 hover:text-neon"
            aria-label={t("goals.add")}
          >
            <Plus size={16} />
          </Link>
        }
      />

      {goals.length === 0 ? (
        <Link
          href="/goals"
          className="block rounded-2xl border border-dashed border-border p-5 text-center text-[13px] text-muted transition-colors hover:border-neon/50 hover:text-neon"
        >
          {t("goals.empty")}
        </Link>
      ) : (
        <div className="space-y-4">
          {goals.slice(0, 3).map((g) => {
            const progress = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
            const done = progress >= 1;
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-base leading-none">{g.emoji}</span>
                    <span className="truncate text-sm font-medium">{g.name}</span>
                    {g.isEmergencyFund ? (
                      <ShieldCheck size={13} className="shrink-0 text-neon" />
                    ) : null}
                    {done ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-bold text-neon">
                        <Check size={10} strokeWidth={3} />
                        {t("goals.complete")}
                      </span>
                    ) : null}
                  </div>
                  <span className="tabular shrink-0 text-[13px] font-semibold">
                    {money(g.saved, { compact: g.saved >= 100_000 })}
                    <span className="font-normal text-muted">
                      {" / "}
                      {money(g.target, { compact: g.target >= 100_000 })}
                    </span>
                  </span>
                </div>
                <MilestoneBar value={progress} className="mt-2" />
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span className={cn(done && "text-neon")}>{percent(progress)}</span>
                  <span>
                    {done
                      ? t("goals.milestone100")
                      : t("goals.remaining", { amount: money(g.target - g.saved) })}
                  </span>
                </div>
              </div>
            );
          })}

          {runway > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
              <ShieldCheck size={14} className="shrink-0 text-neon" />
              <span>
                {t("goals.runwayShort")}:{" "}
                <span className="tabular font-semibold text-ink">
                  {t("goals.runway", { months: runway.toFixed(1) })}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
