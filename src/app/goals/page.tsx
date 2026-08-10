"use client";

import { useEffect, useState } from "react";
import { Check, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MilestoneBar } from "@/components/ui/Progress";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Label, MoneyInput, Toggle } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { addMonths, toISODate } from "@/lib/date";
import { num } from "@/lib/utils";
import type { Goal } from "@/lib/types";

const MILESTONES = [0.25, 0.5, 0.75, 1] as const;
const MILESTONE_KEYS = {
  0.25: "goals.milestone25",
  0.5: "goals.milestone50",
  0.75: "goals.milestone75",
  1: "goals.milestone100",
} as const;

export default function GoalsPage() {
  const { goals, removeGoal, contributeToGoal } = useFinance();
  const { t, money, percent, monthYear } = useI18n();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("goals.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("goals.subtitle")}</p>
        </div>
        <Button
          variant="neon"
          size="md"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus size={16} />
          {t("goals.add")}
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
            {t("goals.empty")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {goals.map((g) => {
            const progress = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
            const done = progress >= 1;
            const remaining = Math.max(0, g.target - g.saved);
            const monthsLeft =
              g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : null;
            const eta =
              monthsLeft !== null ? toISODate(addMonths(new Date(), monthsLeft)) : null;

            return (
              <Card key={g.id} neon={done || g.isEmergencyFund}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-2xl leading-none">{g.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{g.name}</span>
                        {g.isEmergencyFund ? (
                          <ShieldCheck size={14} className="shrink-0 text-neon" />
                        ) : null}
                      </div>
                      <div className="text-[12px] text-muted">
                        {done
                          ? t("goals.complete")
                          : eta
                            ? t("goals.eta", { date: monthYear(eta) })
                            : t("goals.etaNever")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditing(g);
                        setSheetOpen(true);
                      }}
                      className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("common.confirmDelete"))) removeGoal(g.id);
                      }}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label={t("common.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <span className="tabular text-2xl font-bold text-neon">
                    {money(g.saved)}
                  </span>
                  <span className="tabular text-[13px] text-muted">
                    {t("common.of")} {money(g.target)}
                  </span>
                </div>

                <MilestoneBar value={progress} className="mt-2.5" />

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="tabular font-semibold text-neon">{percent(progress)}</span>
                  <div className="flex gap-2">
                    {MILESTONES.map((m) => {
                      const hit = progress >= m;
                      return (
                        <span
                          key={m}
                          title={t(MILESTONE_KEYS[m])}
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium transition-colors ${
                            hit
                              ? "bg-neon/15 text-neon"
                              : "bg-surface-2 text-muted opacity-60"
                          }`}
                        >
                          {hit ? <Check size={9} strokeWidth={3.5} /> : null}
                          {Math.round(m * 100)}%
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  {[500, 1000, 2000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        const before = progress;
                        contributeToGoal(g.id, amount);
                        const after = g.target > 0 ? (g.saved + amount) / g.target : 0;
                        const crossed = MILESTONES.find((m) => before < m && after >= m);
                        toast(
                          crossed
                            ? `${t("dashboard.milestoneHit")} ${t(MILESTONE_KEYS[crossed])}`
                            : `+${money(amount)} · ${g.name}`,
                          { tone: crossed ? "neon" : "plain" },
                        );
                      }}
                      className="tabular rounded-xl border border-border bg-surface-2 px-3 py-2 text-[13px] font-medium transition-colors hover:border-neon/60 hover:text-neon"
                    >
                      +{money(amount)}
                    </button>
                  ))}
                  <span className="ml-auto self-center text-[11px] text-muted">
                    {money(g.monthlyContribution)}
                    {t("common.perMonth")}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <GoalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} />
    </div>
  );
}

function GoalSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Goal | null;
}) {
  const { addGoal, updateGoal, settings } = useFinance();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [monthly, setMonthly] = useState("");
  const [deadline, setDeadline] = useState("");
  const [emergency, setEmergency] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmoji(editing?.emoji ?? "🎯");
    setTarget(editing ? String(editing.target) : "");
    setSaved(editing ? String(editing.saved) : "");
    setMonthly(editing ? String(editing.monthlyContribution) : "");
    setDeadline(editing?.deadline ?? "");
    setEmergency(editing?.isEmergencyFund ?? false);
  }, [open, editing]);

  const valid = name.trim().length > 0 && num(target) > 0;

  const submit = () => {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      emoji: emoji || "🎯",
      target: num(target),
      saved: num(saved),
      monthlyContribution: num(monthly),
      deadline: deadline || undefined,
      isEmergencyFund: emergency,
    };
    if (editing) updateGoal(editing.id, payload);
    else addGoal(payload);
    onClose();
  };

  const symbol = CURRENCY_SYMBOL[settings.currency];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t("common.edit") : t("goals.add")}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="neon"
            size="lg"
            className="flex-[2]"
            disabled={!valid}
            onClick={submit}
          >
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="w-20">
            <Label htmlFor="goal-emoji">🙂</Label>
            <Input
              id="goal-emoji"
              value={emoji}
              maxLength={4}
              className="text-center text-xl"
              onChange={(e) => setEmoji(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="goal-name">{t("goals.name")}</Label>
            <Input
              id="goal-name"
              autoFocus
              placeholder={t("goals.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="goal-target">{t("goals.target")}</Label>
            <MoneyInput
              id="goal-target"
              symbol={symbol}
              placeholder="0"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="goal-saved">{t("goals.saved")}</Label>
            <MoneyInput
              id="goal-saved"
              symbol={symbol}
              placeholder="0"
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="goal-monthly">{t("goals.monthly")}</Label>
            <MoneyInput
              id="goal-monthly"
              symbol={symbol}
              placeholder="0"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="goal-deadline">
              {t("goals.deadline")}{" "}
              <span className="font-normal text-muted">({t("common.optional")})</span>
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <Toggle
          checked={emergency}
          onChange={setEmergency}
          label={t("goals.emergency")}
          hint={t("goals.emergencyHint")}
        />
      </div>
    </Sheet>
  );
}
