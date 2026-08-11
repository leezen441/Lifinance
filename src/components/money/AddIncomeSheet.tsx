"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, MoneyInput, Select } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { todayISO } from "@/lib/date";
import { num } from "@/lib/utils";
import type { IncomeEntry, IncomeKind } from "@/lib/types";

export function AddIncomeSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: IncomeEntry | null;
}) {
  const { addIncome, updateIncome, removeIncome, settings } = useFinance();
  const { t, money } = useI18n();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [kind, setKind] = useState<IncomeKind>("salary");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount));
      setNote(editing.note ?? "");
      setDate(editing.date);
      setKind(editing.kind);
      return;
    }
    setAmount("");
    setNote("");
    setDate(todayISO());
    setKind("salary");
  }, [open, editing]);

  const value = num(amount);

  const submit = () => {
    if (value <= 0) return;
    const payload = {
      amount: value,
      note: note.trim() || undefined,
      date,
      kind,
    };
    if (editing) {
      updateIncome(editing.id, payload);
      toast(t("common.done"), { tone: "neon" });
    } else {
      addIncome(payload);
      toast(`${t("worlds.tagIn")} · ${money(value)}`, { tone: "neon" });
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t("common.edit") : t("worlds.addIncome")}
      footer={
        <div className="flex gap-2">
          {editing ? (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() => {
                if (confirm(t("common.confirmDelete"))) {
                  removeIncome(editing.id);
                  onClose();
                }
              }}
            >
              <Trash2 size={16} />
              {t("common.delete")}
            </Button>
          ) : null}
          <Button variant="neon" className="flex-1" disabled={value <= 0} onClick={submit}>
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="income-amount">{t("worlds.moneyIn")}</Label>
          <MoneyInput
            id="income-amount"
            symbol={CURRENCY_SYMBOL[settings.currency]}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="income-kind">{t("worlds.incomeKindSalary")}</Label>
          <Select
            id="income-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as IncomeKind)}
          >
            <option value="salary">{t("worlds.incomeKindSalary")}</option>
            <option value="other">{t("worlds.incomeKindOther")}</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="income-date">{t("common.today")}</Label>
          <Input
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="income-note" hint={t("common.optional")}>
            {t("worlds.incomeNote")}
          </Label>
          <Input
            id="income-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("common.optional")}
          />
        </div>
      </div>
    </Sheet>
  );
}
