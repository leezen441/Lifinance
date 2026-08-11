"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, CreditCard, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * The only dashboard headline that matters: three envelopes for this month.
 */
export function ThisMonthCard() {
  const { monthPlan, goals } = useFinance();
  const { t, money, monthYear } = useI18n();
  const overspent = monthPlan.leftToSpend < 0;

  return (
    <Card neon className="animate-rise space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{t("worlds.thisMonth")}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{t("worlds.thisMonthSub")}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <Envelope
          href="/money"
          icon={<Wallet size={18} />}
          label={t("worlds.spend")}
          hint={
            overspent
              ? t("worlds.leftToSpendWarn")
              : monthPlan.againstPotOnly
                ? t("worlds.leftInSpendPot")
                : t("worlds.spendSub")
          }
          value={money(monthPlan.leftToSpend)}
          warn={overspent}
        />
        <Envelope
          href="/goals"
          icon={<PiggyBank size={18} />}
          label={t("worlds.save")}
          hint={
            monthPlan.savedTotal > 0
              ? t("worlds.saveSub")
              : goals.length > 0
                ? t("worlds.saveSubZero")
                : t("worlds.saveEmpty")
          }
          value={money(monthPlan.savedTotal)}
          muted={monthPlan.savedTotal <= 0}
        />
        <Envelope
          href="/debts"
          icon={<CreditCard size={18} />}
          label={t("worlds.debt")}
          hint={
            monthPlan.focusName
              ? t("worlds.focusPay", { name: monthPlan.focusName })
              : t("worlds.debtSub")
          }
          value={money(monthPlan.payDebtsThisMonth)}
          meta={
            monthPlan.focusName
              ? `#1 ${monthPlan.focusName} · ${money(monthPlan.focusPayThisMonth)}`
              : undefined
          }
        />
      </div>

      {monthPlan.debtFreeDate ? (
        <p className="text-center text-[12px] text-muted">
          {t("worlds.debtFreeOn", { date: monthYear(monthPlan.debtFreeDate) })}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickLink href="/money?action=in" icon={<ArrowDownLeft size={15} />} label={t("worlds.quickIncome")} />
        <QuickLink href="/money?action=out" icon={<ArrowUpRight size={15} />} label={t("worlds.quickExpense")} />
        <QuickLink href="/goals" icon={<PiggyBank size={15} />} label={t("worlds.quickSave")} />
        <QuickLink href="/debts" icon={<CreditCard size={15} />} label={t("worlds.quickDebt")} />
      </div>
    </Card>
  );
}

function Envelope({
  href,
  icon,
  label,
  hint,
  value,
  meta,
  warn,
  muted,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  meta?: string;
  warn?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border p-3.5 transition-colors hover:border-neon/50",
        warn ? "border-warn/50 bg-warn/10" : "border-border bg-surface-2",
      )}
    >
      <div className={cn("mb-2 flex items-center gap-1.5 text-[12px] font-semibold", warn ? "text-warn" : "text-muted")}>
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "tabular text-xl font-bold tracking-tight",
          warn ? "text-warn" : muted ? "text-muted" : "text-neon",
        )}
      >
        {value}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>
      {meta ? <p className="mt-1 truncate text-[11px] font-medium text-ink">{meta}</p> : null}
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-auto w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-[12px] font-medium text-ink transition-colors hover:border-neon/60 hover:text-neon active:scale-[0.98]"
    >
      {icon}
      {label}
    </Link>
  );
}
