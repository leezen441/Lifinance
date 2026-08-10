"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Gauge } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Slider } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { extraAtKeepRatio } from "@/lib/budget-engine";
import { simulatePayoff } from "@/lib/debt-engine";
import { cn } from "@/lib/utils";
import { GROUP_COLOR } from "@/lib/category";

/**
 * The honesty card. It shows, line by line, where the month's money is claimed
 * before any debt gets attacked — and lets the user drag the one dial that
 * actually changes the answer: how much of their lifestyle they'll trade.
 */
export function RealityCheck() {
  const { budget, profile, settings, updateSettings, debts, goals, plan } = useFinance();
  const { t, money, percent, duration } = useI18n();

  // Local while dragging so the simulation doesn't rerun the store on every
  // pixel; committed on release.
  const [draft, setDraft] = useState<number | null>(null);
  const keep = draft ?? settings.lifestyleKeepRatio;

  const preview = useMemo(() => {
    const extra = extraAtKeepRatio(settings, profile, debts, goals, keep);
    const sim = simulatePayoff(
      debts,
      extra,
      settings.strategy === "snowball" ? "snowball" : "avalanche",
    );
    return { extra, months: sim.monthsToFreedom, feasible: sim.feasible };
  }, [settings, profile, debts, goals, keep]);

  const monthsDelta = plan.feasible && preview.feasible
    ? plan.monthsToFreedom - preview.months
    : 0;

  const rows = [
    { key: "dashboard.incomeRow", value: budget.income, tone: "in" as const },
    { key: "dashboard.essentialsRow", value: -budget.essentials, color: GROUP_COLOR.essential },
    {
      key: "dashboard.lifestyleKeptRow",
      value: -budget.lifestyleProtected,
      color: GROUP_COLOR.hobby,
    },
    { key: "dashboard.goalsRow", value: -budget.goalContributions, color: GROUP_COLOR.health },
    { key: "dashboard.bufferRow", value: -budget.safetyBuffer, color: GROUP_COLOR.other },
    {
      key: "dashboard.minimumsRow",
      value: -budget.minimumPayments,
      color: GROUP_COLOR.transport,
    },
  ];

  const maxAbs = Math.max(budget.income, 1);

  return (
    <Card>
      <CardHeader title={t("dashboard.realityTitle")} subtitle={t("dashboard.realitySub")} />

      <div className="space-y-2.5">
        {rows.map((row) => {
          const abs = Math.abs(row.value);
          const width = Math.min(100, (abs / maxAbs) * 100);
          const isIncome = row.tone === "in";
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className={cn(isIncome ? "font-medium text-ink" : "text-muted")}>
                  {t(row.key)}
                </span>
                <span
                  className={cn(
                    "tabular font-semibold",
                    isIncome ? "text-ink" : "text-muted",
                  )}
                >
                  {isIncome ? "" : "− "}
                  {money(abs)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${width}%`,
                    background: isIncome ? "var(--neon)" : row.color,
                    opacity: isIncome ? 1 : 0.75,
                  }}
                />
              </div>
            </div>
          );
        })}

        <div className="!mt-4 flex items-baseline justify-between gap-3 rounded-xl bg-neon/10 px-3 py-2.5">
          <span className="text-[13px] font-semibold text-neon">
            {t("dashboard.extraRow")}
          </span>
          <span className="tabular text-lg font-bold text-neon">
            {money(budget.availableExtra)}
            <span className="text-xs font-medium text-muted">{t("common.perMonth")}</span>
          </span>
        </div>
      </div>

      {/* ---------------------------- intensity ---------------------------- */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Gauge size={15} className="text-neon" />
            {t("dashboard.intensityTitle")}
          </div>
          <span className="tabular text-[13px] font-semibold text-neon">
            {money(preview.extra)}
            {t("common.perMonth")}
          </span>
        </div>

        <Slider
          min={40}
          max={100}
          step={5}
          value={Math.round(keep * 100)}
          onChange={(e) => setDraft(Number(e.target.value) / 100)}
          onMouseUp={() => {
            if (draft !== null) updateSettings({ lifestyleKeepRatio: draft });
            setDraft(null);
          }}
          onTouchEnd={() => {
            if (draft !== null) updateSettings({ lifestyleKeepRatio: draft });
            setDraft(null);
          }}
          onKeyUp={() => {
            if (draft !== null) updateSettings({ lifestyleKeepRatio: draft });
            setDraft(null);
          }}
          aria-label={t("settings.lifestyleKeep")}
        />

        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{t("dashboard.intensityBeast")}</span>
          <span>{t("dashboard.intensityBalanced")}</span>
          <span>{t("dashboard.intensityChill")}</span>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          {t("dashboard.intensityHint", { percent: percent(keep) })}
          {monthsDelta !== 0 ? (
            <span className={cn("ml-1 font-semibold", monthsDelta > 0 ? "text-neon" : "text-warn")}>
              {monthsDelta > 0 ? "−" : "+"}
              {duration(Math.abs(monthsDelta))}
            </span>
          ) : null}
        </p>
      </div>

      {/* ---------------------------- warnings ---------------------------- */}
      {budget.warnings.filter((w) => w !== "no_buffer").length > 0 ? (
        <ul className="mt-4 space-y-2">
          {budget.warnings
            .filter((w) => w !== "no_buffer")
            .slice(0, 2)
            .map((w) => (
              <li
                key={w}
                className={cn(
                  "flex items-start gap-2 rounded-xl border p-2.5 text-[12px] leading-relaxed",
                  w === "minimums_exceed_budget" || w === "overspending"
                    ? "border-danger/35 bg-danger/10 text-danger"
                    : "border-border bg-surface-2 text-muted",
                )}
              >
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{t(`warnings.${w}`)}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </Card>
  );
}
