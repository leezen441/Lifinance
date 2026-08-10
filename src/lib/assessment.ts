/**
 * Lifestyle assessment — the cold-start fix.
 *
 * A tracker knows nothing on day one, so its advice is worthless for the first
 * month, which is exactly when people give up. This asks ten questions about
 * how someone actually lives and turns the answers into a per-category monthly
 * estimate, so the payoff plan is meaningful immediately and then converges on
 * reality as real expenses accumulate (see `buildSpendProfile`).
 *
 * The constants below are ballpark Bangkok figures. They are deliberately
 * middle-of-the-road: the estimate only has to be close enough to plan with,
 * and every number stays editable afterwards.
 */

import { DAYS_PER_MONTH } from "./date";

const WEEKS_PER_MONTH = DAYS_PER_MONTH / 7; // ≈ 4.35

export type HousingKind = "rent_alone" | "rent_share" | "family" | "mortgage" | "owned";
export type TransportKind = "motorbike" | "car" | "transit" | "ride_hailing" | "wfh";
export type Intensity = "low" | "mid" | "high";
export type CookingHabit = "mostly" | "half" | "rarely" | "never";
export type DrinkPrice = "cheap" | "mid" | "premium";
export type PetKind = "none" | "cat" | "dog" | "both";

export interface QuizAnswers {
  housing: HousingKind;
  housingCost: number;
  utilities: number;
  /** Money sent home each month — a real fixed cost for many people here. */
  familySupport: number;
  phone: number;
  insurance: number;
  transport: TransportKind;
  transportIntensity: Intensity;
  cooking: CookingHabit;
  /** Coffee / matcha / bubble tea, cups per week. */
  drinks: number;
  drinkPrice: DrinkPrice;
  /** Food delivery orders per week. */
  delivery: number;
  subscriptions: string[];
  pets: PetKind;
  petCount: number;
  hobbies: string[];
  hobbyIntensity: Intensity;
}

export const DEFAULT_ANSWERS: QuizAnswers = {
  housing: "rent_alone",
  housingCost: 0,
  utilities: 1200,
  familySupport: 0,
  phone: 599,
  insurance: 0,
  transport: "transit",
  transportIntensity: "mid",
  cooking: "half",
  drinks: 5,
  drinkPrice: "mid",
  delivery: 2,
  subscriptions: [],
  pets: "none",
  petCount: 1,
  hobbies: [],
  hobbyIntensity: "mid",
};

/* ------------------------------------------------------------------ */
/* Estimate tables                                                     */
/* ------------------------------------------------------------------ */

const TRANSPORT: Record<TransportKind, Record<Intensity, { fuel?: number; transit?: number; ride?: number }>> = {
  motorbike: {
    low: { fuel: 500 },
    mid: { fuel: 1000 },
    high: { fuel: 1800 },
  },
  car: {
    low: { fuel: 2500 },
    mid: { fuel: 4500 },
    high: { fuel: 7500 },
  },
  transit: {
    low: { transit: 700 },
    mid: { transit: 1400 },
    high: { transit: 2300 },
  },
  ride_hailing: {
    low: { ride: 1200, transit: 300 },
    mid: { ride: 2600, transit: 400 },
    high: { ride: 4800, transit: 500 },
  },
  wfh: {
    low: { transit: 200 },
    mid: { transit: 500, ride: 300 },
    high: { transit: 800, ride: 600 },
  },
};

const COOKING: Record<CookingHabit, { groceries: number; eating_out: number }> = {
  mostly: { groceries: 5200, eating_out: 1800 },
  half: { groceries: 3200, eating_out: 4200 },
  rarely: { groceries: 1400, eating_out: 6800 },
  never: { groceries: 600, eating_out: 8800 },
};

const DRINK_PRICE: Record<DrinkPrice, number> = { cheap: 45, mid: 95, premium: 155 };

const DELIVERY_ORDER = 220;

export const SUBSCRIPTION_OPTIONS = [
  { id: "streaming_video", monthly: 419, category: "streaming" },
  { id: "streaming_music", monthly: 149, category: "streaming" },
  { id: "ai_tools", monthly: 780, category: "ai_tools" },
  { id: "cloud", monthly: 99, category: "cloud" },
  { id: "software", monthly: 350, category: "software" },
  { id: "gym", monthly: 1290, category: "gym" },
] as const;

const PET_MONTHLY: Record<Exclude<PetKind, "none">, { food: number; supplies: number; vet: number }> = {
  cat: { food: 700, supplies: 250, vet: 300 },
  dog: { food: 1300, supplies: 400, vet: 450 },
  both: { food: 2000, supplies: 650, vet: 750 },
};

export const HOBBY_OPTIONS = [
  { id: "badminton", category: "badminton", cost: { low: 500, mid: 1300, high: 2600 } },
  { id: "diy", category: "diy", cost: { low: 400, mid: 1100, high: 2400 } },
  { id: "gear", category: "gear", cost: { low: 500, mid: 1500, high: 3500 } },
  { id: "beauty", category: "beauty", cost: { low: 400, mid: 900, high: 2000 } },
  { id: "gifts", category: "gifts", cost: { low: 300, mid: 700, high: 1600 } },
] as const;

/* ------------------------------------------------------------------ */
/* Estimation                                                          */
/* ------------------------------------------------------------------ */

/** `cat_<key>` ids match the seeded categories. */
function catId(key: string): string {
  return `cat_${key}`;
}

function add(map: Map<string, number>, key: string, amount: number) {
  if (amount <= 0) return;
  map.set(catId(key), (map.get(catId(key)) ?? 0) + amount);
}

/**
 * Turn answers into `{ categoryId: monthlyAmount }`.
 *
 * Everything here is a monthly figure, so it drops straight into the budget
 * engine next to real tracked spending.
 */
export function estimateMonthly(answers: QuizAnswers): Record<string, number> {
  const out = new Map<string, number>();

  // --- fixed commitments ---
  if (answers.housing !== "owned") add(out, "rent", answers.housingCost);
  add(out, "utilities", answers.utilities);
  add(out, "phone", answers.phone);
  add(out, "insurance", answers.insurance);
  // Money sent home has no dedicated category; it is essential, so it lands in
  // the essential "misc" bucket rather than being quietly dropped.
  add(out, "misc", answers.familySupport);

  // --- getting around ---
  const transport = TRANSPORT[answers.transport][answers.transportIntensity];
  add(out, "fuel", transport.fuel ?? 0);
  add(out, "transit", transport.transit ?? 0);
  add(out, "ride_hailing", transport.ride ?? 0);

  // --- food ---
  const cooking = COOKING[answers.cooking];
  add(out, "groceries", cooking.groceries);
  add(out, "eating_out", cooking.eating_out);

  const drinksMonthly = answers.drinks * DRINK_PRICE[answers.drinkPrice] * WEEKS_PER_MONTH;
  // Most people split between coffee and everything else; 70/30 is a
  // reasonable default and both are editable later.
  add(out, "coffee", drinksMonthly * 0.7);
  add(out, "matcha", drinksMonthly * 0.3);

  add(out, "delivery", answers.delivery * DELIVERY_ORDER * WEEKS_PER_MONTH);

  // --- subscriptions ---
  for (const id of answers.subscriptions) {
    const sub = SUBSCRIPTION_OPTIONS.find((s) => s.id === id);
    if (sub) add(out, sub.category, sub.monthly);
  }

  // --- pets ---
  if (answers.pets !== "none") {
    const per = PET_MONTHLY[answers.pets];
    const count = Math.max(1, answers.petCount);
    add(out, "cat_food", per.food * count);
    add(out, "pet_supplies", per.supplies * count);
    add(out, "vet", per.vet * count);
  }

  // --- hobbies ---
  for (const id of answers.hobbies) {
    const hobby = HOBBY_OPTIONS.find((h) => h.id === id);
    if (hobby) add(out, hobby.category, hobby.cost[answers.hobbyIntensity]);
  }

  return Object.fromEntries([...out].map(([k, v]) => [k, Math.round(v)]));
}

/** Total of an estimate map. */
export function estimateTotal(estimate: Record<string, number>): number {
  return Object.values(estimate).reduce((s, v) => s + v, 0);
}

/** The ten steps, in order. The UI renders these generically. */
export const QUIZ_STEPS = [
  "housing",
  "bills",
  "transport",
  "food",
  "drinks",
  "delivery",
  "subscriptions",
  "pets",
  "hobbies",
  "review",
] as const;

export type QuizStep = (typeof QUIZ_STEPS)[number];
