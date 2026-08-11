"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, MoneyInput, Slider } from "@/components/ui/Field";
import { Progress } from "@/components/ui/Progress";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { categoryLabel } from "@/lib/category";
import { cn, num } from "@/lib/utils";
import type { Category, Language } from "@/lib/types";
import {
  adjustableCategoryIds,
  DEFAULT_ANSWERS,
  estimateMonthly,
  estimateMonthlyBase,
  estimateTotal,
  HOBBY_OPTIONS,
  normalizeAnswers,
  pruneOverrides,
  QUIZ_STEPS,
  SUBSCRIPTION_OPTIONS,
  type Intensity,
  type QuizAnswers,
} from "@/lib/assessment";

/**
 * The spending check-up.
 *
 * One question per screen with big tap targets — a ten-field form on a phone is
 * a form nobody finishes. Every answer has a sane default, so "Next" all the
 * way through still produces a usable estimate. Amounts that used to be locked
 * behind intensity tables are editable on each step and again on the review.
 */
export default function AssessmentPage() {
  const router = useRouter();
  const { settings, categories, baseline, setBaseline, updateSettings } = useFinance();
  const { t, lang, money } = useI18n();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(() =>
    normalizeAnswers((baseline?.answers as Partial<QuizAnswers> | undefined) ?? DEFAULT_ANSWERS),
  );
  const [income, setIncome] = useState(
    settings.monthlyIncome > 0 ? String(settings.monthlyIncome) : "",
  );
  /** Empty until the user types — so 0 is a real answer, not “not filled”. */
  const [housingCostText, setHousingCostText] = useState(() => {
    const prior = baseline?.answers as Partial<QuizAnswers> | undefined;
    if (prior && typeof prior.housingCost === "number" && prior.housing !== "owned") {
      return String(prior.housingCost);
    }
    return "";
  });

  const set = <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  const toggle = (key: "subscriptions" | "hobbies", id: string) =>
    setAnswers((a) => ({
      ...a,
      [key]: a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id],
    }));

  const setOverride = (categoryId: string, amount: number) =>
    setAnswers((a) => {
      const amountOverrides = { ...a.amountOverrides };
      // Keep 0 so “I spend nothing here” is valid and the field still shows 0.
      if (!Number.isFinite(amount) || amount < 0) delete amountOverrides[categoryId];
      else amountOverrides[categoryId] = amount;
      return { ...a, amountOverrides };
    });

  const setSubAmount = (subId: string, amount: number) =>
    setAnswers((a) => {
      const subscriptionAmounts = { ...a.subscriptionAmounts };
      if (!Number.isFinite(amount) || amount < 0) delete subscriptionAmounts[subId];
      else subscriptionAmounts[subId] = amount;
      return { ...a, subscriptionAmounts };
    });

  // Drop stale overrides when the underlying suggestion set changes
  // (e.g. switched from car → BTS so a fuel override no longer applies).
  useEffect(() => {
    const base = estimateMonthlyBase({ ...answers, amountOverrides: {} });
    const pruned = pruneOverrides(base, answers.amountOverrides);
    if (JSON.stringify(pruned) !== JSON.stringify(answers.amountOverrides)) {
      setAnswers((a) => ({ ...a, amountOverrides: pruned }));
    }
    // Only re-prune when the answer fields that rebuild the base change —
    // not when amountOverrides itself changes (that would fight the user).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    answers.housing,
    answers.housingCost,
    answers.utilities,
    answers.phone,
    answers.insurance,
    answers.familySupport,
    answers.transport,
    answers.transportIntensity,
    answers.cooking,
    answers.drinks,
    answers.drinkPrice,
    answers.delivery,
    answers.subscriptions,
    answers.subscriptionAmounts,
    answers.pets,
    answers.petCount,
    answers.hobbies,
    answers.hobbyIntensity,
  ]);

  const baseEstimate = useMemo(
    () => estimateMonthlyBase({ ...answers, amountOverrides: {} }),
    [answers],
  );
  const estimate = useMemo(() => estimateMonthly(answers), [answers]);
  const total = estimateTotal(estimate);
  /** Review rows stay visible even when an amount is temporarily cleared to 0. */
  const reviewRows = useMemo(() => {
    const ids = new Set([
      ...Object.keys(baseEstimate),
      ...Object.keys(answers.amountOverrides),
    ]);
    return [...ids].sort(
      (a, b) => (estimate[b] ?? answers.amountOverrides[b] ?? 0) - (estimate[a] ?? answers.amountOverrides[a] ?? 0),
    );
  }, [baseEstimate, answers.amountOverrides, estimate]);
  const symbol = CURRENCY_SYMBOL[settings.currency];
  const current = QUIZ_STEPS[step];
  const isLast = step === QUIZ_STEPS.length - 1;

  const housingBlocked =
    current === "housing" && answers.housing !== "owned" && housingCostText.trim() === "";
  const incomeBlocked = isLast && income.trim() === "";
  const nextBlocked = housingBlocked || incomeBlocked;

  const finish = () => {
    if (income.trim() === "") return;
    setBaseline({
      createdAt: new Date().toISOString(),
      monthlyByCategory: estimate,
      answers,
    });
    updateSettings({ monthlyIncome: num(income), onboarded: true });
    toast(t("assess.applied"), { tone: "neon" });
    router.push("/");
  };

  const stepAdjustIds = adjustableCategoryIds(current, answers);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">{t("assess.title")}</h1>
          <span className="tabular text-[12px] text-muted">
            {t("assess.step", { current: step + 1, total: QUIZ_STEPS.length })}
          </span>
        </div>
        <Progress value={(step + 1) / QUIZ_STEPS.length} height="h-1.5" />
      </div>

      <Card className="min-h-[22rem]">
        {current === "housing" ? (
          <Step title={t("assess.housingTitle")} sub={t("assess.housingSub")}>
            <Choices
              value={answers.housing}
              onChange={(v) => set("housing", v as QuizAnswers["housing"])}
              options={[
                { id: "rent_alone", emoji: "🏠", label: t("assess.housingRentAlone") },
                { id: "rent_share", emoji: "🏘️", label: t("assess.housingRentShare") },
                { id: "family", emoji: "👨‍👩‍👧", label: t("assess.housingFamily") },
                { id: "mortgage", emoji: "🏦", label: t("assess.housingMortgage") },
                { id: "owned", emoji: "🔑", label: t("assess.housingOwned") },
              ]}
            />
            {answers.housing !== "owned" ? (
              <div className="mt-4">
                <Label htmlFor="housingCost">
                  {answers.housing === "family"
                    ? t("assess.housingCostFamily")
                    : t("assess.housingCost")}
                </Label>
                <MoneyInput
                  id="housingCost"
                  symbol={symbol}
                  placeholder="0"
                  value={housingCostText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setHousingCostText(text);
                    set("housingCost", num(text));
                  }}
                />
                {housingBlocked ? (
                  <p className="mt-2 text-[12px] text-warn">{t("assess.housingCostRequired")}</p>
                ) : null}
              </div>
            ) : null}
          </Step>
        ) : null}

        {current === "bills" ? (
          <Step title={t("assess.billsTitle")} sub={t("assess.billsSub")}>
            <div className="space-y-3">
              <AmountField
                id="utilities"
                label={t("assess.utilities")}
                symbol={symbol}
                value={answers.utilities}
                onChange={(v) => set("utilities", v)}
              />
              <AmountField
                id="phone"
                label={t("assess.phone")}
                symbol={symbol}
                value={answers.phone}
                onChange={(v) => set("phone", v)}
              />
              <AmountField
                id="insurance"
                label={t("assess.insurance")}
                symbol={symbol}
                value={answers.insurance}
                onChange={(v) => set("insurance", v)}
              />
              <AmountField
                id="familySupport"
                label={t("assess.familySupport")}
                hint={t("assess.familySupportHint")}
                symbol={symbol}
                value={answers.familySupport}
                onChange={(v) => set("familySupport", v)}
              />
            </div>
          </Step>
        ) : null}

        {current === "transport" ? (
          <Step title={t("assess.transportTitle")} sub={t("assess.transportSub")}>
            <Choices
              value={answers.transport}
              onChange={(v) => set("transport", v as QuizAnswers["transport"])}
              options={[
                { id: "motorbike", emoji: "🛵", label: t("assess.transportMotorbike") },
                { id: "car", emoji: "🚗", label: t("assess.transportCar") },
                { id: "transit", emoji: "🚇", label: t("assess.transportTransit") },
                { id: "ride_hailing", emoji: "🚕", label: t("assess.transportRide") },
                { id: "wfh", emoji: "🏡", label: t("assess.transportWfh") },
              ]}
            />
            <IntensityPicker
              label={t("assess.transportIntensity")}
              value={answers.transportIntensity}
              onChange={(v) => set("transportIntensity", v)}
              t={t}
            />
          </Step>
        ) : null}

        {current === "food" ? (
          <Step title={t("assess.foodTitle")} sub={t("assess.foodSub")}>
            <Choices
              value={answers.cooking}
              onChange={(v) => set("cooking", v as QuizAnswers["cooking"])}
              options={[
                { id: "mostly", emoji: "🍳", label: t("assess.cookMostly") },
                { id: "half", emoji: "🥡", label: t("assess.cookHalf") },
                { id: "rarely", emoji: "🍜", label: t("assess.cookRarely") },
                { id: "never", emoji: "🍔", label: t("assess.cookNever") },
              ]}
            />
          </Step>
        ) : null}

        {current === "drinks" ? (
          <Step title={t("assess.drinksTitle")} sub={t("assess.drinksSub")}>
            <CountSlider
              label={t("assess.drinksCount")}
              value={answers.drinks}
              max={21}
              onChange={(v) => set("drinks", v)}
            />
            <div className="mt-5">
              <Label>{t("assess.drinkPrice")}</Label>
              <Choices
                compact
                value={answers.drinkPrice}
                onChange={(v) => set("drinkPrice", v as QuizAnswers["drinkPrice"])}
                options={[
                  { id: "cheap", emoji: "🏪", label: t("assess.priceCheap") },
                  { id: "mid", emoji: "☕", label: t("assess.priceMid") },
                  { id: "premium", emoji: "✨", label: t("assess.pricePremium") },
                ]}
              />
            </div>
          </Step>
        ) : null}

        {current === "delivery" ? (
          <Step title={t("assess.deliveryTitle")} sub={t("assess.deliverySub")}>
            <CountSlider
              label={t("assess.deliveryCount")}
              value={answers.delivery}
              max={14}
              onChange={(v) => set("delivery", v)}
            />
          </Step>
        ) : null}

        {current === "subscriptions" ? (
          <Step title={t("assess.subsTitle")} sub={t("assess.subsSub")}>
            <div className="space-y-2">
              {SUBSCRIPTION_OPTIONS.map((sub) => {
                const active = answers.subscriptions.includes(sub.id);
                const amount = answers.subscriptionAmounts[sub.id] ?? sub.monthly;
                return (
                  <div key={sub.id} className="space-y-2">
                    <MultiChip
                      active={active}
                      onClick={() => toggle("subscriptions", sub.id)}
                      label={t(`assess.sub${toPascal(sub.id)}`)}
                      meta={money(amount)}
                    />
                    {active ? (
                      <div className="pl-1">
                        <Label htmlFor={`sub-${sub.id}`}>{t("assess.subCustomAmount")}</Label>
                        <MoneyInput
                          id={`sub-${sub.id}`}
                          symbol={symbol}
                          value={String(amount)}
                          onChange={(e) => setSubAmount(sub.id, num(e.target.value))}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Step>
        ) : null}

        {current === "pets" ? (
          <Step title={t("assess.petsTitle")} sub={t("assess.petsSub")}>
            <Choices
              value={answers.pets}
              onChange={(v) => set("pets", v as QuizAnswers["pets"])}
              options={[
                { id: "none", emoji: "🚫", label: t("assess.petsNone") },
                { id: "cat", emoji: "🐱", label: t("assess.petsCat") },
                { id: "dog", emoji: "🐶", label: t("assess.petsDog") },
                { id: "both", emoji: "🐾", label: t("assess.petsBoth") },
              ]}
            />
            {answers.pets !== "none" ? (
              <CountSlider
                className="mt-4"
                label={t("assess.petCount")}
                value={answers.petCount}
                min={1}
                max={6}
                onChange={(v) => set("petCount", v)}
              />
            ) : null}
          </Step>
        ) : null}

        {current === "hobbies" ? (
          <Step title={t("assess.hobbiesTitle")} sub={t("assess.hobbiesSub")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {HOBBY_OPTIONS.map((h) => (
                <MultiChip
                  key={h.id}
                  active={answers.hobbies.includes(h.id)}
                  onClick={() => toggle("hobbies", h.id)}
                  label={t(`assess.hobby${toPascal(h.id)}`)}
                />
              ))}
            </div>
            {answers.hobbies.length > 0 ? (
              <IntensityPicker
                label={t("assess.hobbyIntensity")}
                value={answers.hobbyIntensity}
                onChange={(v) => set("hobbyIntensity", v)}
                t={t}
              />
            ) : null}
          </Step>
        ) : null}

        {current === "review" ? (
          <Step title={t("assess.reviewTitle")} sub={t("assess.reviewSub")}>
            <div className="rounded-2xl border border-neon/30 bg-neon/[0.06] p-4 text-center">
              <div className="text-[12px] text-muted">{t("assess.estimatedTotal")}</div>
              <div className="tabular mt-1 text-3xl font-bold text-neon text-glow">
                {money(total)}
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="assess-income">{t("settings.income")}</Label>
              <MoneyInput
                id="assess-income"
                symbol={symbol}
                placeholder="0"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
              {incomeBlocked ? (
                <p className="mt-2 text-[12px] text-warn">{t("assess.incomeRequired")}</p>
              ) : null}
            </div>

            <ul className="mt-4 max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {reviewRows.map((categoryId) => {
                const category = categories.find((c) => c.id === categoryId);
                const suggested = baseEstimate[categoryId];
                const amount =
                  answers.amountOverrides[categoryId] ?? estimate[categoryId] ?? 0;
                return (
                  <li key={categoryId} className="rounded-xl border border-border bg-surface-2 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span>{category?.emoji ?? "•"}</span>
                        <span className="truncate font-medium">
                          {categoryLabel(category, lang)}
                        </span>
                      </span>
                      {suggested != null && suggested !== amount ? (
                        <span className="shrink-0 text-[11px] text-muted">
                          {t("assess.suggested", { amount: money(suggested) })}
                        </span>
                      ) : null}
                    </div>
                    <MoneyInput
                      symbol={symbol}
                      value={String(amount)}
                      onChange={(e) => setOverride(categoryId, num(e.target.value))}
                      aria-label={categoryLabel(category, lang)}
                    />
                  </li>
                );
              })}
            </ul>
          </Step>
        ) : null}

        {stepAdjustIds.length > 0 ? (
          <AmountAdjuster
            categoryIds={stepAdjustIds}
            baseEstimate={baseEstimate}
            estimate={estimate}
            overrides={answers.amountOverrides}
            categories={categories}
            lang={lang}
            symbol={symbol}
            money={money}
            t={t}
            onChange={setOverride}
          />
        ) : null}
      </Card>

      <p className="px-1 text-center text-[12px] text-muted">{t("assess.why")}</p>

      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="lg"
          className="flex-1"
          onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
        >
          <ArrowLeft size={16} />
          {t("assess.back")}
        </Button>
        <Button
          variant="neon"
          size="lg"
          className="flex-[2]"
          disabled={nextBlocked}
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
        >
          {isLast ? (
            <>
              <Check size={16} />
              {t("assess.apply")}
            </>
          ) : (
            <>
              {t("assess.next")}
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- parts -------------------------------- */

function Step({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mb-4 mt-0.5 text-[13px] text-muted">{sub}</p>
      {children}
    </div>
  );
}

function AmountAdjuster({
  categoryIds,
  baseEstimate,
  estimate,
  overrides,
  categories,
  lang,
  symbol,
  money,
  t,
  onChange,
}: {
  categoryIds: string[];
  baseEstimate: Record<string, number>;
  estimate: Record<string, number>;
  overrides: Record<string, number>;
  categories: Category[];
  lang: Language;
  symbol: string;
  money: (n: number) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onChange: (categoryId: string, amount: number) => void;
}) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-1 text-[13px] font-semibold">{t("assess.adjustMonthly")}</div>
      <p className="mb-3 text-[12px] text-muted">{t("assess.adjustMonthlyHint")}</p>
      <div className="space-y-3">
        {categoryIds.map((categoryId) => {
          const category = categories.find((c) => c.id === categoryId);
          const amount = overrides[categoryId] ?? estimate[categoryId] ?? 0;
          const suggested = baseEstimate[categoryId] ?? 0;
          return (
            <div key={categoryId}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <Label htmlFor={`adj-${categoryId}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{category?.emoji ?? "•"}</span>
                    {categoryLabel(category, lang)}
                  </span>
                </Label>
                {suggested > 0 && suggested !== amount ? (
                  <span className="text-[11px] text-muted">
                    {t("assess.suggested", { amount: money(suggested) })}
                  </span>
                ) : null}
              </div>
              <MoneyInput
                id={`adj-${categoryId}`}
                symbol={symbol}
                value={String(amount)}
                onChange={(e) => onChange(categoryId, num(e.target.value))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Choices({
  value,
  onChange,
  options,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; emoji: string; label: string }[];
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-2")}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] font-medium transition-all active:scale-[0.98]",
              compact && "flex-col justify-center gap-1 text-center text-[12px]",
              active
                ? "border-neon bg-neon/10 text-neon dark:shadow-[0_0_14px_rgba(57,255,20,0.2)]"
                : "border-border bg-surface-2 hover:border-neon/50",
            )}
          >
            <span className="text-lg leading-none">{o.emoji}</span>
            <span className="min-w-0">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChip({
  active,
  onClick,
  label,
  meta,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-[13px] font-medium transition-all active:scale-[0.98]",
        active
          ? "border-neon bg-neon/10 text-neon"
          : "border-border bg-surface-2 hover:border-neon/50",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded border",
            active ? "border-neon bg-neon text-neon-ink" : "border-border",
          )}
        >
          {active ? <Check size={11} strokeWidth={3.5} /> : null}
        </span>
        {label}
      </span>
      {meta ? <span className="tabular text-[11px] text-muted">{meta}</span> : null}
    </button>
  );
}

function IntensityPicker({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: Intensity;
  onChange: (v: Intensity) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-5">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
        {(["low", "mid", "high"] as Intensity[]).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            aria-pressed={value === level}
            className={cn(
              "rounded-xl px-2 py-2.5 text-[12px] font-semibold transition-all",
              value === level ? "bg-neon text-neon-ink" : "text-muted hover:text-ink",
            )}
          >
            {t(`assess.intensity${toPascal(level)}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CountSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="tabular text-xl font-bold text-neon">{value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function AmountField({
  id,
  label,
  hint,
  symbol,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  symbol: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <MoneyInput
        id={id}
        symbol={symbol}
        placeholder="0"
        value={String(value)}
        onChange={(e) => onChange(num(e.target.value))}
      />
    </div>
  );
}

/** `streaming_video` → `StreamingVideo`, for building i18n keys. */
function toPascal(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
