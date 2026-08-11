"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, MoneyInput, Select } from "@/components/ui/Field";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { CURRENCY_SYMBOL } from "@/lib/format";
import { todayISO } from "@/lib/date";
import { num } from "@/lib/utils";
import type { Debt, DebtKind } from "@/lib/types";

const KINDS: DebtKind[] = [
  "credit_card",
  "personal_loan",
  "auto",
  "mortgage",
  "student",
  "bnpl",
  "informal",
  "other",
];

/** Suggested minimum when the user leaves it blank — the common card rule. */
function suggestMinimum(balance: number, apr: number, kind: DebtKind): number {
  if (kind === "credit_card") {
    const interest = (balance * apr) / 100 / 12;
    return Math.max(Math.round(balance * 0.05), Math.ceil(interest + balance * 0.01));
  }
  return Math.round(balance * 0.03);
}

export function DebtSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Debt | null;
}) {
  const { addDebt, updateDebt, settings } = useFinance();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<DebtKind>("credit_card");
  const [balance, setBalance] = useState("");
  const [principal, setPrincipal] = useState("");
  const [apr, setApr] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [dueDay, setDueDay] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? "credit_card");
    setBalance(editing ? String(editing.balance) : "");
    setPrincipal(editing ? String(editing.principal) : "");
    setApr(editing ? String(editing.apr) : "");
    setMinPayment(editing ? String(editing.minPayment) : "");
    setDueDay(editing?.dueDay ? String(editing.dueDay) : "");
  }, [open, editing]);

  const balanceValue = num(balance);
  const aprValue = num(apr);
  const valid = name.trim().length > 0 && (editing ? balanceValue >= 0 : balanceValue > 0);

  const submit = () => {
    if (!valid) return;
    const cleared = balanceValue <= 0;
    const payload = {
      name: name.trim(),
      kind,
      balance: cleared ? 0 : balanceValue,
      principal: num(principal) > 0 ? num(principal) : Math.max(balanceValue, editing?.principal ?? 0),
      apr: aprValue,
      minPayment:
        num(minPayment) > 0
          ? num(minPayment)
          : cleared
            ? 0
            : suggestMinimum(balanceValue, aprValue, kind),
      dueDay: num(dueDay) > 0 ? Math.min(31, num(dueDay)) : undefined,
      archivedAt: cleared ? editing?.archivedAt ?? todayISO() : undefined,
    };
    if (editing) updateDebt(editing.id, payload);
    else addDebt(payload);
    onClose();
  };

  const symbol = CURRENCY_SYMBOL[settings.currency];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t("debts.edit") : t("debts.add")}
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
        <div>
          <Label htmlFor="debt-name">{t("debts.name")}</Label>
          <Input
            id="debt-name"
            autoFocus
            placeholder={t("debts.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="debt-kind">{t("debts.kind")}</Label>
          <Select
            id="debt-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as DebtKind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`debts.kinds.${k}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="debt-balance">{t("debts.balance")}</Label>
            <MoneyInput
              id="debt-balance"
              symbol={symbol}
              placeholder="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="debt-apr">{t("debts.apr")}</Label>
            <MoneyInput
              id="debt-apr"
              symbol="%"
              placeholder="0.0"
              value={apr}
              onChange={(e) => setApr(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="debt-min">{t("debts.minPayment")}</Label>
            <MoneyInput
              id="debt-min"
              symbol={symbol}
              placeholder={
                balanceValue > 0 ? String(suggestMinimum(balanceValue, aprValue, kind)) : "0"
              }
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="debt-due">
              {t("debts.dueDay")}{" "}
              <span className="font-normal text-muted">({t("common.optional")})</span>
            </Label>
            <MoneyInput
              id="debt-due"
              placeholder="1–31"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="debt-principal">
            {t("debts.principal")}{" "}
            <span className="font-normal text-muted">({t("common.optional")})</span>
          </Label>
          <MoneyInput
            id="debt-principal"
            symbol={symbol}
            placeholder={balance || "0"}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}
