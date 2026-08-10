"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { DebtSheet } from "@/components/debts/DebtSheet";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { blendedApr, totalDebt } from "@/lib/debt-engine";
import type { Debt } from "@/lib/types";

export default function DebtsPage() {
  const { debts, plan, removeDebt, budget } = useFinance();
  const { t, money, monthYear, duration } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const owed = totalDebt(debts);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("debts.title")}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("debts.subtitle")}</p>
        </div>
        <Button variant="neon" size="md" onClick={openNew}>
          <Plus size={16} />
          {t("debts.add")}
        </Button>
      </div>

      <Card neon>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label={t("dashboard.totalOwed")} value={money(owed)} neon />
          <Metric label={t("dashboard.avgApr")} value={`${blendedApr(debts).toFixed(1)}%`} />
          <Metric
            label={t("debts.payoffDate")}
            value={plan.feasible ? monthYear(plan.payoffDate) : "—"}
          />
          <Metric
            label={t("debts.totalInterest")}
            value={plan.feasible ? money(plan.totalInterest) : "—"}
          />
        </div>
        <p className="mt-4 border-t border-border/70 pt-3 text-[12px] text-muted">
          {t("dashboard.extraRow")}:{" "}
          <span className="tabular font-semibold text-neon">
            {money(budget.availableExtra)}
            {t("common.perMonth")}
          </span>
          {plan.feasible ? (
            <>
              {" · "}
              {t("dashboard.timeToGo", { time: duration(plan.monthsToFreedom) })}
            </>
          ) : null}
        </p>
      </Card>

      {debts.length === 0 ? (
        <Card>
          <button
            onClick={openNew}
            className="block w-full rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted transition-colors hover:border-neon/50 hover:text-neon"
          >
            {t("debts.empty")}
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {debts.map((debt) => {
            const detail = plan.perDebt.find((p) => p.debtId === debt.id);
            const base = Math.max(debt.principal, debt.balance);
            const progress = base > 0 ? 1 - debt.balance / base : 0;
            const isFocus = debt.id === plan.focusDebtId;
            return (
              <Card key={debt.id} neon={isFocus}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {debt.name}
                      {isFocus ? (
                        <span className="rounded-full bg-neon/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neon">
                          {t("dashboard.focusTitle")}
                        </span>
                      ) : null}
                    </span>
                  }
                  subtitle={t(`debts.kinds.${debt.kind}`)}
                  action={
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditing(debt);
                          setSheetOpen(true);
                        }}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label={t("common.edit")}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t("common.confirmDelete"))) removeDebt(debt.id);
                        }}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label={t("common.delete")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  }
                />

                <div className="flex items-baseline justify-between gap-3">
                  <span className="tabular text-2xl font-bold">{money(debt.balance)}</span>
                  <span className="tabular text-[13px] font-medium text-muted">
                    {debt.apr.toFixed(1)}%
                  </span>
                </div>
                <Progress value={progress} className="mt-2.5" glow={isFocus} />

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
                  <Row label={t("debts.minPayment")} value={money(debt.minPayment)} />
                  <Row
                    label={t("debts.dueDay")}
                    value={debt.dueDay ? String(debt.dueDay) : "—"}
                  />
                  <Row
                    label={t("debts.payoffDate")}
                    value={detail?.payoffDate ? monthYear(detail.payoffDate) : "—"}
                    accent={isFocus}
                  />
                  <Row
                    label={t("debts.interestCost")}
                    value={detail ? money(detail.interestPaid) : "—"}
                  />
                </dl>
              </Card>
            );
          })}
        </div>
      )}

      <DebtSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editing={editing} />
    </div>
  );
}

function Metric({ label, value, neon }: { label: string; value: string; neon?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`tabular mt-0.5 text-lg font-bold tracking-tight sm:text-xl ${
          neon ? "text-neon" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={`tabular shrink-0 font-semibold ${accent ? "text-neon" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
