/**
 * Default categories + demo data.
 *
 * The category list is deliberately opinionated: it mirrors how people
 * actually spend now — AI subscriptions, specialty coffee, the cat, badminton
 * night — because a tracker whose categories don't match your life is a
 * tracker you stop opening after four days.
 */

import type { AppState, Category, Debt, Expense, Goal, IncomeEntry, Settings } from "./types";
import { addDays, toISODate } from "./date";

export const STORAGE_KEY = "lifinance.state.v1";
export const STATE_VERSION = 1;

/** Quick-tap amounts are tuned for THB; they scale on currency change. */
export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  // --- Essential living -------------------------------------------------
  { key: "rent", group: "essential", emoji: "🏠", isEssential: true, quickAmounts: [], isCustom: false },
  { key: "utilities", group: "essential", emoji: "💡", isEssential: true, quickAmounts: [500, 1000, 1500], isCustom: false },
  { key: "groceries", group: "essential", emoji: "🛒", isEssential: true, quickAmounts: [200, 500, 1000], isCustom: false },
  { key: "phone", group: "essential", emoji: "📶", isEssential: true, quickAmounts: [], isCustom: false },
  { key: "insurance", group: "essential", emoji: "🛡️", isEssential: true, quickAmounts: [], isCustom: false },
  { key: "family_support", group: "essential", emoji: "👨‍👩‍👧", isEssential: true, quickAmounts: [], isCustom: false },

  // --- Tech & subscriptions --------------------------------------------
  { key: "ai_tools", group: "tech", emoji: "🤖", isEssential: false, quickAmounts: [700, 800], isCustom: false },
  { key: "cloud", group: "tech", emoji: "☁️", isEssential: false, quickAmounts: [99, 350], isCustom: false },
  { key: "streaming", group: "tech", emoji: "🎬", isEssential: false, quickAmounts: [149, 199, 419], isCustom: false },
  { key: "software", group: "tech", emoji: "🧩", isEssential: false, quickAmounts: [199, 500], isCustom: false },

  // --- Food & beverage --------------------------------------------------
  { key: "coffee", group: "food", emoji: "☕", isEssential: false, quickAmounts: [80, 120, 150], isCustom: false },
  { key: "matcha", group: "food", emoji: "🍵", isEssential: false, quickAmounts: [90, 130, 180], isCustom: false },
  { key: "eating_out", group: "food", emoji: "🍜", isEssential: false, quickAmounts: [100, 250, 500], isCustom: false },
  { key: "delivery", group: "food", emoji: "🛵", isEssential: false, quickAmounts: [150, 250, 400], isCustom: false },
  { key: "snacks", group: "food", emoji: "🍫", isEssential: false, quickAmounts: [40, 80, 120], isCustom: false },

  // --- Pet care ---------------------------------------------------------
  { key: "cat_food", group: "pet", emoji: "🐱", isEssential: true, quickAmounts: [200, 450, 900], isCustom: false },
  { key: "pet_supplies", group: "pet", emoji: "🧴", isEssential: false, quickAmounts: [150, 300, 600], isCustom: false },
  { key: "vet", group: "pet", emoji: "🩺", isEssential: true, quickAmounts: [500, 1500], isCustom: false },

  // --- Sports & hobbies -------------------------------------------------
  { key: "badminton", group: "hobby", emoji: "🏸", isEssential: false, quickAmounts: [120, 200, 350], isCustom: false },
  { key: "gym", group: "hobby", emoji: "🏋️", isEssential: false, quickAmounts: [], isCustom: false },
  { key: "diy", group: "hobby", emoji: "🔧", isEssential: false, quickAmounts: [200, 500, 1200], isCustom: false },
  { key: "gear", group: "hobby", emoji: "🎒", isEssential: false, quickAmounts: [500, 1500, 3000], isCustom: false },

  // --- Getting around ---------------------------------------------------
  { key: "fuel", group: "transport", emoji: "⛽", isEssential: true, quickAmounts: [300, 500, 1000], isCustom: false },
  { key: "transit", group: "transport", emoji: "🚇", isEssential: true, quickAmounts: [30, 60, 100], isCustom: false },
  { key: "ride_hailing", group: "transport", emoji: "🚕", isEssential: false, quickAmounts: [80, 150, 300], isCustom: false },

  // --- Health & misc ----------------------------------------------------
  { key: "health", group: "health", emoji: "💊", isEssential: true, quickAmounts: [200, 500], isCustom: false },
  { key: "beauty", group: "health", emoji: "✂️", isEssential: false, quickAmounts: [300, 800], isCustom: false },
  { key: "gifts", group: "other", emoji: "🎁", isEssential: false, quickAmounts: [200, 500, 1000], isCustom: false },
  { key: "misc", group: "other", emoji: "•", isEssential: false, quickAmounts: [100, 300], isCustom: false },
];

export const DEFAULT_SETTINGS: Settings = {
  language: "th",
  theme: "dark",
  currency: "THB",
  monthlyIncome: 0,
  payday: 25,
  strategy: "auto",
  lifestyleKeepRatio: 0.7,
  safetyBufferPct: 5,
  spendWindowDays: 60,
  spendPotAmount: 0,
  spendCountSpend: true,
  spendCountSave: true,
  spendCountDebt: true,
  onboarded: false,
};

export function buildCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: `cat_${c.key}` }));
}

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    categories: buildCategories(),
    expenses: [],
    incomes: [],
    debts: [],
    goals: [],
  };
}

/**
 * A realistic demo: a Bangkok office worker on ฿48k take-home, three debts
 * including one nasty credit card, and 60 days of believable spending.
 * Deterministic (seeded PRNG) so screenshots and tests stay stable.
 */
export function demoState(now: Date = new Date()): AppState {
  const categories = buildCategories();
  const catId = (key: string) => `cat_${key}`;

  const debts: Debt[] = [
    {
      id: "debt_visa",
      name: "Visa Platinum",
      kind: "credit_card",
      balance: 68_400,
      principal: 85_000,
      apr: 20,
      minPayment: 3_500,
      dueDay: 15,
      createdAt: toISODate(addDays(now, -420)),
    },
    {
      id: "debt_kbank",
      name: "K-Bank personal loan",
      kind: "personal_loan",
      balance: 112_000,
      principal: 150_000,
      apr: 14.5,
      minPayment: 4_800,
      dueDay: 5,
      createdAt: toISODate(addDays(now, -600)),
    },
    {
      id: "debt_phone",
      name: "iPhone instalment",
      kind: "bnpl",
      balance: 18_900,
      principal: 42_000,
      apr: 0,
      minPayment: 2_100,
      dueDay: 20,
      createdAt: toISODate(addDays(now, -270)),
    },
  ];

  const goals: Goal[] = [
    {
      id: "goal_emergency",
      name: "Emergency fund",
      emoji: "🛟",
      target: 90_000,
      saved: 21_500,
      monthlyContribution: 2_000,
      isEmergencyFund: true,
      createdAt: toISODate(addDays(now, -180)),
    },
    {
      id: "goal_japan",
      name: "Japan trip",
      emoji: "🗾",
      target: 60_000,
      saved: 14_000,
      deadline: toISODate(addDays(now, 400)),
      monthlyContribution: 1_500,
      isEmergencyFund: false,
      createdAt: toISODate(addDays(now, -120)),
    },
    {
      id: "goal_racket",
      name: "New badminton racket",
      emoji: "🏸",
      target: 6_500,
      saved: 5_200,
      monthlyContribution: 500,
      isEmergencyFund: false,
      createdAt: toISODate(addDays(now, -60)),
    },
  ];

  // Deterministic pseudo-random so the demo looks organic but never shifts.
  let seed = 20260810;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const expenses: Expense[] = [];
  const push = (
    key: string,
    amount: number,
    dayOffset: number,
    recurrence: Expense["recurrence"] = "none",
    note?: string,
  ) => {
    const date = toISODate(addDays(now, -dayOffset));
    expenses.push({
      id: `exp_${expenses.length}`,
      categoryId: catId(key),
      amount,
      date,
      note,
      createdAt: date,
      recurrence,
    });
  };

  // Fixed monthly commitments — logged once, flagged as recurring.
  push("rent", 12_000, 8, "monthly");
  push("phone", 799, 8, "monthly");
  push("insurance", 1_450, 8, "monthly");
  push("ai_tools", 780, 6, "monthly", "Claude Pro");
  push("cloud", 99, 6, "monthly", "iCloud 200GB");
  push("streaming", 419, 5, "monthly", "Netflix + Spotify");
  push("gym", 1_290, 12, "monthly");

  // 60 days of day-to-day life.
  for (let d = 0; d < 60; d++) {
    if (rand() < 0.72) push("coffee", pick([80, 95, 120, 150]), d);
    if (rand() < 0.28) push("matcha", pick([90, 130, 180]), d);
    if (rand() < 0.55) push("eating_out", pick([90, 120, 180, 260, 420]), d);
    if (rand() < 0.22) push("delivery", pick([150, 220, 310]), d);
    if (rand() < 0.3) push("transit", pick([30, 44, 60, 88]), d);
    if (rand() < 0.16) push("ride_hailing", pick([85, 120, 190, 260]), d);
    if (rand() < 0.2) push("snacks", pick([35, 60, 95]), d);
    if (d % 7 === 2 || d % 7 === 5) push("badminton", pick([120, 180, 200]), d);
    if (d % 14 === 3) push("groceries", pick([680, 950, 1_240]), d);
    if (d % 10 === 4) push("cat_food", pick([420, 560, 890]), d);
    if (d % 21 === 6) push("pet_supplies", pick([260, 480]), d);
    if (d % 30 === 9) push("diy", pick([450, 900, 1_600]), d);
    if (d % 26 === 11) push("beauty", pick([350, 600]), d);
    if (d % 17 === 8) push("fuel", pick([400, 600]), d);
    if (d % 33 === 14) push("health", pick([250, 780]), d);
    if (d % 45 === 20) push("gear", pick([1_200, 2_400]), d);
  }

  return {
    version: STATE_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      // Chosen so the demo lands where the app is most interesting: a real
      // but not comfortable surplus, where moving the intensity slider
      // visibly changes the payoff date.
      monthlyIncome: 58_000,
      onboarded: true,
    },
    categories,
    expenses,
    incomes: [
      {
        id: "inc_salary",
        amount: 58_000,
        kind: "salary",
        date: toISODate(new Date(now.getFullYear(), now.getMonth(), Math.min(25, now.getDate()))),
        createdAt: toISODate(now),
        note: "Payday",
      } satisfies IncomeEntry,
    ],
    debts,
    goals,
  };
}
