"use client";

import { Coins, PiggyBank, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { monthPace } from "@/lib/budget-engine";

/**
 * Three numbers, big type, no jargon. 1 column on phones is too tall and 3 is
 * too cramped — 3 across works because the values are short.
 */
export function StatGrid() {
  const { budget, profile, goals, expenses } = useFinance();
  const { t, money } = useI18n();

  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const pace = monthPace(expenses, profile.variableMonthly);

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      <Stat
        icon={<Wallet size={15} />}
        label={t("dashboard.freeCash")}
        value={money(budget.availableExtra, { compact: budget.availableExtra >= 100_000 })}
        tone="neon"
        hint={t("dashboard.freeCashSub")}
      />
      <Stat
        icon={<Coins size={15} />}
        label={t("dashboard.spentToday")}
        value={money(profile.todayTotal)}
        tone={pace.onTrack ? "default" : "warn"}
        hint={pace.onTrack ? t("expenses.onPace") : t("expenses.overPace")}
      />
      <Stat
        icon={<PiggyBank size={15} />}
        label={t("dashboard.saved")}
        value={money(saved, { compact: saved >= 100_000 })}
        tone="default"
        hint={`${goals.length} ${t("goals.title").toLowerCase()}`}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "neon" | "warn";
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium sm:text-xs",
          tone === "neon" ? "text-neon" : tone === "warn" ? "text-warn" : "text-muted",
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "tabular mt-1.5 text-lg font-bold leading-tight tracking-tight sm:text-2xl",
          tone === "neon" && "text-neon",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted sm:text-[11px]">
          {hint}
        </div>
      ) : null}
    </Card>
  );
}
