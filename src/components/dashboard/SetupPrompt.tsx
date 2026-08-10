"use client";

import { useState } from "react";
import { Sparkles, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { num } from "@/lib/utils";

/**
 * Onboarding is one question. Everything else in the app has a sane default,
 * but without take-home pay there is no budget and therefore no plan.
 */
export function SetupPrompt() {
  const { settings, updateSettings, loadDemo } = useFinance();
  const { t } = useI18n();
  const [income, setIncome] = useState("");

  if (settings.monthlyIncome > 0) return null;

  const value = num(income);

  return (
    <Card neon className="animate-rise">
      <div className="flex items-center gap-2 text-neon">
        <Wallet size={17} />
        <h2 className="text-[15px] font-semibold">{t("onboarding.title")}</h2>
      </div>
      <p className="mt-1.5 text-[13px] text-muted">{t("onboarding.incomeQ")}</p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <MoneyInput
          symbol={CURRENCY_SYMBOL[settings.currency]}
          placeholder="0"
          value={income}
          inputMode="decimal"
          className="h-12 flex-1 text-lg"
          onChange={(e) => setIncome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value > 0) {
              updateSettings({ monthlyIncome: value, onboarded: true });
            }
          }}
        />
        <Button
          variant="neon"
          size="lg"
          disabled={value <= 0}
          onClick={() => updateSettings({ monthlyIncome: value, onboarded: true })}
        >
          {t("onboarding.start")}
        </Button>
      </div>

      <button
        onClick={loadDemo}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-neon"
      >
        <Sparkles size={13} />
        {t("settings.loadDemo")}
      </button>
    </Card>
  );
}
