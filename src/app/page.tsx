"use client";

import { Greeting } from "@/components/dashboard/Greeting";
import { SetupPrompt } from "@/components/dashboard/SetupPrompt";
import { FreedomCard } from "@/components/dashboard/FreedomCard";
import { StatGrid } from "@/components/dashboard/StatGrid";
import { QuickAdd } from "@/components/dashboard/QuickAdd";
import { PayoffPlanCard } from "@/components/dashboard/PayoffPlanCard";
import { RealityCheck } from "@/components/dashboard/RealityCheck";
import { GoalsStrip } from "@/components/dashboard/GoalsStrip";
import { SpendingBreakdown } from "@/components/dashboard/SpendingBreakdown";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { BudgetAdvice } from "@/components/dashboard/BudgetAdvice";

/**
 * Dashboard.
 *
 * Layout intent, mobile-first:
 *   base  → one column, ordered by how often you need it: status, log a spend,
 *           then the plan, then the detail.
 *   sm    → the same column, roomier cards (iPad portrait / large phones).
 *   lg    → two columns. Left is "what do I do" (plan + reality), right is
 *           "how am I doing" (goals + spending). The hero spans both.
 *
 * Nothing below is fixed-width; every card is fluid and the grid is the only
 * thing that changes at breakpoints.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <Greeting />
      <SetupPrompt />
      <InstallPrompt />

      {/* Hero — always full width */}
      <FreedomCard />

      {/* Three glanceable numbers */}
      <StatGrid />

      {/* Frictionless logging sits high: it's the daily habit the plan needs */}
      <QuickAdd />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4 sm:space-y-5">
          <BudgetAdvice />
          <PayoffPlanCard />
          <RealityCheck />
        </div>
        <div className="space-y-4 sm:space-y-5">
          <GoalsStrip />
          <SpendingBreakdown />
        </div>
      </div>
    </div>
  );
}
