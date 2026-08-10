"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, Info, TrendingDown } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { dailyAllowance } from "@/lib/recommend";
import { categoryLabel } from "@/lib/category";
import { cn } from "@/lib/utils";

/**
 * "How much should I spend this month?" — the single number, plus where to
 * find the difference if they're over.
 *
 * Shown only once there's an income to divide up; before that the card is an
 * invitation to take the check-up, which is the fastest route to a real plan.
 */
export function BudgetAdvice() {
  const { recommendation: rec, settings, categories, baseline, profile } = useFinance();
  const { t, lang, money, percent } = useI18n();

  // No income and no assessment: pitch the check-up instead of showing zeroes.
  if (settings.monthlyIncome <= 0 || !rec.feasible) {
    return (
      <Card neon className="animate-rise">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-neon">
              <ClipboardCheck size={17} />
              <h2 className="text-[15px] font-semibold">{t("assess.title")}</h2>
            </div>
            <p className="mt-1 text-[13px] text-muted">{t("assess.subtitle")}</p>
            {!rec.feasible && rec.notes.includes("essentials_exceed_income") ? (
              <p className="mt-2 text-[12px] leading-relaxed text-warn">
                {t("assess.notes.essentials_exceed_income")}
              </p>
            ) : null}
          </div>
          <Link href="/assessment" className="shrink-0">
            <Button variant="neon" size="md">
              {t("assess.cta")}
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const daily = dailyAllowance(rec);
  const overspending = rec.gap > 0;
  const usedShare = rec.recommendedLiving > 0 ? rec.currentLiving / rec.recommendedLiving : 0;

  const trims = rec.perCategory
    .filter((c) => !c.isEssential && c.delta < -1)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 4);

  return (
    <Card className="animate-rise">
      <CardHeader
        title={t("assess.resultTitle")}
        subtitle={t("assess.resultSub")}
        action={
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-muted">
            {profile.usingBaseline
              ? profile.dataTrust > 0
                ? t("assess.blendBadge", { percent: percent(profile.dataTrust) })
                : t("assess.estimateBadge")
              : t("assess.trackedBadge")}
          </span>
        }
      />

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="tabular text-4xl font-bold leading-none tracking-tight text-neon text-glow">
            {money(rec.recommendedLiving)}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {t("assess.resultDaily", { amount: money(daily) })}
          </p>
        </div>
      </div>

      {/* current vs recommended */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
          <span className="text-muted">
            {t("assess.resultCurrent", { amount: money(rec.currentLiving) })}
          </span>
          <span
            className={cn(
              "tabular font-semibold",
              overspending ? "text-warn" : "text-neon",
            )}
          >
            {percent(Math.min(usedShare, 2))}
          </span>
        </div>
        <Progress
          value={Math.min(usedShare, 1)}
          height="h-2"
          barClassName={overspending ? "bg-warn" : undefined}
          glow={!overspending}
        />
      </div>

      {/* allocation */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
        <Slice label={t("assess.breakdownEssentials")} value={money(rec.essentials)} />
        <Slice
          label={t("assess.breakdownLifestyle")}
          value={money(rec.lifestyleAllowance)}
          neon
        />
        <Slice label={t("assess.breakdownSavings")} value={money(rec.savings)} />
        <Slice label={t("assess.breakdownDebt")} value={money(rec.debtPayment)} />
      </dl>

      {/* where to trim */}
      {overspending && trims.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-warn/30 bg-warn/[0.06] p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-warn">
            <TrendingDown size={14} />
            {t("assess.resultGap", { amount: money(rec.gap) })}
          </p>
          <ul className="space-y-2">
            {trims.map((c) => {
              const category = categories.find((x) => x.id === c.categoryId);
              return (
                <li
                  key={c.categoryId}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{category?.emoji ?? "•"}</span>
                    <span className="truncate">{categoryLabel(category, lang)}</span>
                  </span>
                  <span className="tabular shrink-0 text-[12px]">
                    <span className="text-muted line-through">{money(c.current)}</span>
                    <span className="mx-1.5 text-muted">→</span>
                    <span className="font-semibold text-neon">{money(c.recommended)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!overspending ? (
        <p className="mt-4 rounded-xl bg-neon/10 px-3 py-2.5 text-[12px] font-medium text-neon">
          {t("assess.resultComfortable")}
        </p>
      ) : null}

      {/* the one note that most changes what they should do */}
      {rec.notes.filter((n) => n !== "comfortable" && n !== "estimate_only")[0] ? (
        <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
          <Info size={13} className="mt-0.5 shrink-0" />
          {t(
            `assess.notes.${rec.notes.filter((n) => n !== "comfortable" && n !== "estimate_only")[0]}`,
          )}
        </p>
      ) : null}

      <Link
        href="/assessment"
        className="mt-3 inline-block text-[12px] font-medium text-neon underline-offset-2 hover:underline"
      >
        {baseline ? t("assess.retake") : t("assess.cta")}
      </Link>
    </Card>
  );
}

function Slice({ label, value, neon }: { label: string; value: string; neon?: boolean }) {
  return (
    <div>
      <dt className="truncate text-muted">{label}</dt>
      <dd className={cn("tabular mt-0.5 font-bold", neon && "text-neon")}>{value}</dd>
    </div>
  );
}
