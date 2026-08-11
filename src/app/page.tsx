"use client";

import { Greeting } from "@/components/dashboard/Greeting";
import { SetupPrompt } from "@/components/dashboard/SetupPrompt";
import { ThisMonthCard } from "@/components/dashboard/ThisMonthCard";
import { FreedomCard } from "@/components/dashboard/FreedomCard";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { useFinance } from "@/store/FinanceProvider";

/**
 * Home = one job: tell you what to do this month.
 * Detail lives in Spend / Save / Debt.
 */
export default function DashboardPage() {
  const { debts } = useFinance();

  return (
    <div className="space-y-4 sm:space-y-5">
      <Greeting />
      <SetupPrompt />
      <InstallPrompt />
      <ThisMonthCard />
      {debts.length > 0 ? <FreedomCard /> : null}
    </div>
  );
}
