"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, MoneyInput, Select, Toggle } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { categoryLabel, GROUP_ORDER, groupLabel } from "@/lib/category";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { todayISO } from "@/lib/date";
import { debtProgress, DEBT_PAYMENT_CATEGORY_ID, dailyInterest } from "@/lib/debt-interest";
import { cn, num } from "@/lib/utils";
import type { Expense } from "@/lib/types";

type OutKind = "spend" | "debt";

export function AddExpenseSheet({
  open,
  onClose,
  initialCategoryId,
  initialDebtId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  /** Prefill “pay debt” mode for this pot. */
  initialDebtId?: string;
  /** When set, the sheet edits this entry instead of creating a new one. */
  editing?: Expense | null;
}) {
  const {
    categories,
    debts,
    addExpense,
    updateExpense,
    removeExpense,
    payDebt,
    settings,
  } = useFinance();
  const { t, lang, money, percent } = useI18n();
  const { toast } = useToast();

  const openDebts = useMemo(
    () => debts.filter((d) => !d.archivedAt && d.balance > 0),
    [debts],
  );
  const active = useMemo(
    () =>
      categories.filter(
        (c) => !c.archived && c.id !== DEBT_PAYMENT_CATEGORY_ID,
      ),
    [categories],
  );

  const [kind, setKind] = useState<OutKind>("spend");
  const [debtId, setDebtId] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? active[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.debtId ? "debt" : "spend");
      setDebtId(editing.debtId ?? "");
      setCategoryId(editing.categoryId);
      setAmount(String(editing.amount));
      setNote(editing.note ?? "");
      setDate(editing.date);
      setRecurring(editing.recurrence === "monthly");
      return;
    }
    const payDebtMode = Boolean(initialDebtId) || openDebts.length > 0 && Boolean(initialDebtId);
    setKind(initialDebtId ? "debt" : "spend");
    setDebtId(initialDebtId ?? openDebts[0]?.id ?? "");
    setCategoryId(initialCategoryId ?? active[0]?.id ?? "");
    setAmount("");
    setNote("");
    setDate(todayISO());
    setRecurring(false);
    void payDebtMode;
  }, [open, initialCategoryId, initialDebtId, active, editing, openDebts]);

  const category = active.find((c) => c.id === categoryId);
  const selectedDebt = openDebts.find((d) => d.id === debtId) ?? debts.find((d) => d.id === debtId);
  const value = num(amount);
  const interestToday = selectedDebt
    ? dailyInterest(selectedDebt.balance, selectedDebt.apr, 1)
    : 0;
  const progressNow = selectedDebt ? debtProgress(selectedDebt) : 0;
  const progressAfter =
    selectedDebt && value > 0
      ? debtProgress({
          // principal is part of the yardstick, so the preview has to carry it
          // or the "after paying" bar jumps to a different scale.
          principal: selectedDebt.principal,
          balance: Math.max(0, selectedDebt.balance - value),
          paidTotal: (selectedDebt.paidTotal ?? 0) + Math.min(value, selectedDebt.balance),
          archivedAt: value >= selectedDebt.balance ? todayISO() : undefined,
        })
      : progressNow;

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: active.filter((c) => c.group === group),
      })).filter((g) => g.items.length > 0),
    [active],
  );

  const canSave =
    value > 0 &&
    (kind === "debt" ? Boolean(debtId) && Boolean(selectedDebt && !selectedDebt.archivedAt) : Boolean(categoryId));

  const submit = () => {
    if (!canSave) return;

    if (kind === "debt") {
      if (editing?.debtId) {
        // Editing a debt payment: reverse old, apply new (via remove+pay is messy). Update amount only by reverse+repay.
        removeExpense(editing.id);
        const { cleared, debt } = payDebt({
          debtId,
          amount: value,
          date,
          note: note.trim() || undefined,
        });
        toast(
          cleared
            ? t("debts.clearedToast", { name: debt.name })
            : `${money(value)} · ${debt.name}`,
          { tone: "neon" },
        );
      } else {
        const { cleared, debt, expense } = payDebt({
          debtId,
          amount: value,
          date,
          note: note.trim() || undefined,
        });
        if (expense.amount <= 0) return;
        toast(
          cleared
            ? t("debts.clearedToast", { name: debt.name })
            : `${money(expense.amount)} · ${debt.name}`,
          { tone: "neon" },
        );
      }
      onClose();
      return;
    }

    const payload = {
      categoryId,
      amount: value,
      note: note.trim() || undefined,
      date,
      recurrence: recurring ? ("monthly" as const) : ("none" as const),
    };

    if (editing) {
      updateExpense(editing.id, payload);
      toast(`${t("expenses.updated")} · ${money(value)}`, { tone: "neon" });
    } else {
      addExpense(payload);
      toast(`${money(value)} · ${categoryLabel(category, lang)}`, { tone: "neon" });
    }
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    const snapshot = editing;
    removeExpense(snapshot.id);
    onClose();
    toast(`${t("expenses.deleted")} · ${money(snapshot.amount)}`, {
      action: {
        label: t("common.undo"),
        onClick: () => {
          if (snapshot.debtId) {
            payDebt({
              debtId: snapshot.debtId,
              amount: snapshot.amount,
              date: snapshot.date,
              note: snapshot.note,
            });
          } else {
            addExpense({
              categoryId: snapshot.categoryId,
              amount: snapshot.amount,
              note: snapshot.note,
              date: snapshot.date,
              recurrence: snapshot.recurrence,
            });
          }
        },
      },
      duration: 6000,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        editing
          ? t("expenses.edit")
          : kind === "debt"
            ? t("expenses.addDebtPay")
            : t("expenses.add")
      }
      footer={
        <div className="flex gap-3">
          {editing ? (
            <Button variant="danger" size="lg" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 size={17} />
            </Button>
          ) : (
            <Button variant="ghost" size="lg" className="flex-1" onClick={onClose}>
              {t("common.cancel")}
            </Button>
          )}
          <Button
            variant="neon"
            size="lg"
            className="flex-[2]"
            disabled={!canSave}
            onClick={submit}
          >
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!editing ? (
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => setKind("spend")}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors",
                kind === "spend" ? "bg-neon text-neon-ink" : "text-muted hover:text-ink",
              )}
            >
              {t("expenses.kindSpend")}
            </button>
            <button
              type="button"
              onClick={() => {
                setKind("debt");
                if (!debtId && openDebts[0]) setDebtId(openDebts[0].id);
              }}
              disabled={openDebts.length === 0}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40",
                kind === "debt" ? "bg-neon text-neon-ink" : "text-muted hover:text-ink",
              )}
            >
              {t("expenses.kindDebt")}
            </button>
          </div>
        ) : null}

        <div>
          <Label htmlFor="amount">{t("expenses.amount")}</Label>
          <MoneyInput
            id="amount"
            autoFocus
            placeholder="0"
            symbol={CURRENCY_SYMBOL[settings.currency]}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-14 text-2xl"
          />
          {kind === "spend" && category && category.quickAmounts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {category.quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="tabular rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-neon/60 hover:text-neon"
                >
                  {money(q)}
                </button>
              ))}
            </div>
          ) : null}
          {kind === "debt" && selectedDebt ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                selectedDebt.minPayment,
                Math.round(selectedDebt.balance),
                500,
                1000,
                2000,
              ]
                .filter((q, i, a) => q > 0 && a.indexOf(q) === i)
                .slice(0, 4)
                .map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className="tabular rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-neon/60 hover:text-neon"
                  >
                    {money(q)}
                  </button>
                ))}
            </div>
          ) : null}
        </div>

        {kind === "debt" ? (
          <div className="space-y-3">
            {openDebts.length === 0 && !selectedDebt ? (
              <p className="text-[13px] text-muted">{t("expenses.noOpenDebts")}</p>
            ) : (
              <>
                <div>
                  <Label htmlFor="debt-pot">{t("expenses.debtPot")}</Label>
                  <Select
                    id="debt-pot"
                    value={debtId}
                    onChange={(e) => setDebtId(e.target.value)}
                    disabled={Boolean(editing?.debtId)}
                  >
                    {openDebts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {money(d.balance)}
                      </option>
                    ))}
                  </Select>
                </div>
                {selectedDebt ? (
                  <div className="rounded-2xl border border-border bg-surface-2 p-3 text-[12px] text-muted">
                    <div className="flex justify-between gap-2">
                      <span>{t("dashboard.totalOwed")}</span>
                      <span className="tabular font-semibold text-ink">
                        {money(selectedDebt.balance)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span>{t("debts.dailyInterest")}</span>
                      <span className="tabular text-ink">
                        ≈ {money(interestToday)}
                        {t("common.perDay")}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2">
                      <span>{t("debts.progress")}</span>
                      <span className="tabular font-semibold text-neon">
                        {percent(progressNow)}
                        {value > 0 ? ` → ${percent(progressAfter)}` : ""}
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div>
            <Label htmlFor="category">{t("expenses.category")}</Label>
            <Select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {grouped.map(({ group, items }) => (
                <optgroup key={group} label={groupLabel(group, lang)}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {categoryLabel(c, lang)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="date">{t("expenses.date")}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">
              {t("expenses.note")}{" "}
              <span className="font-normal text-muted">({t("common.optional")})</span>
            </Label>
            <Input
              id="note"
              placeholder={t("expenses.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {kind === "spend" ? (
          <Toggle
            checked={recurring}
            onChange={setRecurring}
            label={t("expenses.recurring")}
            hint={t("expenses.recurringHint")}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
