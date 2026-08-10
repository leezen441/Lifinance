"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Sparkles, Upload } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, MoneyInput, Select, Slider } from "@/components/ui/Field";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { num } from "@/lib/utils";
import type { CurrencyCode, Strategy, ThemeMode } from "@/lib/types";

const CURRENCIES: CurrencyCode[] = ["THB", "USD", "EUR", "GBP", "SGD", "JPY"];
const THEMES: ThemeMode[] = ["dark", "light", "system"];
const STRATEGIES: Strategy[] = ["auto", "avalanche", "snowball"];

export default function SettingsPage() {
  const { settings, updateSettings, loadDemo, resetAll, exportJSON, importJSON } =
    useFinance();
  const { t, percent } = useI18n();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * `null` = not being edited, so the field mirrors the store. Seeding
   * `useState` from settings instead would freeze the field at whatever it
   * was on first render — which is zero, before localStorage is read.
   */
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null);
  const income =
    incomeDraft ?? (settings.monthlyIncome > 0 ? String(settings.monthlyIncome) : "");

  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifinance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    const text = await file.text();
    toast(importJSON(text) ? t("common.done") : "✕", { tone: "neon" });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("settings.title")}</h1>

      <Card>
        <CardHeader title={t("settings.language")} subtitle={t("settings.languageHint")} />
        <LanguageToggle full />
      </Card>

      <Card>
        <CardHeader title={t("settings.theme")} />
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
          {THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => updateSettings({ theme })}
              className={`rounded-xl px-2 py-2.5 text-[13px] font-semibold transition-all ${
                settings.theme === theme
                  ? "bg-neon text-neon-ink dark:shadow-[0_0_14px_rgba(57,255,20,0.35)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t(
                theme === "dark"
                  ? "settings.themeDark"
                  : theme === "light"
                    ? "settings.themeLight"
                    : "settings.themeSystem",
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.income")} subtitle={t("settings.incomeHint")} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="income">{t("settings.income")}</Label>
            <MoneyInput
              id="income"
              symbol={CURRENCY_SYMBOL[settings.currency]}
              placeholder="0"
              value={income}
              onChange={(e) => setIncomeDraft(e.target.value)}
              onBlur={() => {
                updateSettings({ monthlyIncome: num(income) });
                setIncomeDraft(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="payday">{t("settings.payday")}</Label>
            <Select
              id="payday"
              value={settings.payday}
              onChange={(e) => updateSettings({ payday: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="currency">{t("settings.currency")}</Label>
            <Select
              id="currency"
              value={settings.currency}
              onChange={(e) =>
                updateSettings({ currency: e.target.value as CurrencyCode })
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_SYMBOL[c]} {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="strategy">{t("settings.strategy")}</Label>
            <Select
              id="strategy"
              value={settings.strategy}
              onChange={(e) => updateSettings({ strategy: e.target.value as Strategy })}
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {t(
                    s === "auto"
                      ? "dashboard.strategyAuto"
                      : s === "avalanche"
                        ? "dashboard.strategyAvalanche"
                        : "dashboard.strategySnowball",
                  )}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t("settings.lifestyleKeep")}
          subtitle={t("settings.lifestyleKeepHint")}
          action={
            <span className="tabular text-sm font-bold text-neon">
              {percent(settings.lifestyleKeepRatio)}
            </span>
          }
        />
        <Slider
          min={40}
          max={100}
          step={5}
          value={Math.round(settings.lifestyleKeepRatio * 100)}
          onChange={(e) =>
            updateSettings({ lifestyleKeepRatio: Number(e.target.value) / 100 })
          }
        />

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium">{t("settings.buffer")}</span>
            <span className="tabular text-sm font-bold text-neon">
              {settings.safetyBufferPct}%
            </span>
          </div>
          <Slider
            min={0}
            max={25}
            step={1}
            value={settings.safetyBufferPct}
            onChange={(e) => updateSettings({ safetyBufferPct: Number(e.target.value) })}
          />
          <p className="mt-2 text-[12px] text-muted">{t("settings.bufferHint")}</p>
        </div>

        <div className="mt-6">
          <Label htmlFor="window" hint={t("settings.windowHint")}>
            {t("settings.window")}
          </Label>
          <Select
            id="window"
            value={settings.spendWindowDays}
            onChange={(e) =>
              updateSettings({
                spendWindowDays: Number(e.target.value) as 30 | 60 | 90,
              })
            }
          >
            {[30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.data")} subtitle={t("settings.dataHint")} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}>
            <Download size={15} />
            {t("settings.export")}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={15} />
            {t("settings.import")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={loadDemo}>
            <Sparkles size={15} />
            {t("settings.loadDemo")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t("settings.resetConfirm"))) resetAll();
            }}
          >
            <RotateCcw size={15} />
            {t("settings.reset")}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("settings.about")} />
        <p className="text-[13px] leading-relaxed text-muted">{t("settings.aboutBody")}</p>
      </Card>
    </div>
  );
}
