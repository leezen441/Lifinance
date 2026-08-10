"use client";

import { CalendarClock } from "lucide-react";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { daysUntilPayday } from "@/lib/date";

export function Greeting() {
  const { settings } = useFinance();
  const { t } = useI18n();

  const hour = new Date().getHours();
  const key =
    hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const days = daysUntilPayday(settings.payday);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        {t(`greeting.${key}`)}
      </h1>
      {settings.monthlyIncome > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-muted">
          <CalendarClock size={13} />
          {days === 0 ? t("dashboard.paydayToday") : t("dashboard.payday", { days })}
        </span>
      ) : null}
    </div>
  );
}
