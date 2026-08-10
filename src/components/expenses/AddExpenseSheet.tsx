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
import { num } from "@/lib/utils";
import type { Expense } from "@/lib/types";

export function AddExpenseSheet({
  open,
  onClose,
  initialCategoryId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string;
  /** When set, the sheet edits this entry instead of creating a new one. */
  editing?: Expense | null;
}) {
  const { categories, addExpense, updateExpense, removeExpense, settings } = useFinance();
  const { t, lang, money } = useI18n();
  const { toast } = useToast();

  const active = useMemo(() => categories.filter((c) => !c.archived), [categories]);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? active[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [recurring, setRecurring] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCategoryId(editing.categoryId);
      setAmount(String(editing.amount));
      setNote(editing.note ?? "");
      setDate(editing.date);
      setRecurring(editing.recurrence === "monthly");
      return;
    }
    setCategoryId(initialCategoryId ?? active[0]?.id ?? "");
    setAmount("");
    setNote("");
    setDate(todayISO());
    setRecurring(false);
  }, [open, initialCategoryId, active, editing]);

  const category = active.find((c) => c.id === categoryId);
  const value = num(amount);

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: active.filter((c) => c.group === group),
      })).filter((g) => g.items.length > 0),
    [active],
  );

  const submit = () => {
    if (value <= 0 || !categoryId) return;
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

  /**
   * Delete offers Undo rather than a confirm dialog. A blocking "are you sure?"
   * on a ฿80 coffee is friction on the wrong side of the action — undo costs
   * nothing when you meant it and rescues you when you didn't.
   */
  const remove = () => {
    if (!editing) return;
    const snapshot = editing;
    removeExpense(snapshot.id);
    onClose();
    toast(`${t("expenses.deleted")} · ${money(snapshot.amount)}`, {
      action: {
        label: t("common.undo"),
        onClick: () =>
          addExpense({
            categoryId: snapshot.categoryId,
            amount: snapshot.amount,
            note: snapshot.note,
            date: snapshot.date,
            recurrence: snapshot.recurrence,
          }),
      },
      duration: 6000,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t("expenses.edit") : t("expenses.add")}
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
            disabled={value <= 0}
            onClick={submit}
          >
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
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
          {category && category.quickAmounts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {category.quickAmounts.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="tabular rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-neon/60 hover:text-neon"
                >
                  {money(q)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

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

        <Toggle
          checked={recurring}
          onChange={setRecurring}
          label={t("expenses.recurring")}
          hint={t("expenses.recurringHint")}
        />
      </div>
    </Sheet>
  );
}
