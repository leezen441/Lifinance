/**
 * Core data structures for Lifinance.
 *
 * These mirror the Prisma models in `prisma/schema.prisma` one-to-one, so the
 * same objects can move between localStorage (offline-first) and a real API
 * without a translation layer. Money is stored as a plain number in the user's
 * display currency — see `docs/DATA-MODEL.md` for the integer-minor-unit
 * migration note before you put real money through this.
 */

export type Language = "en" | "th";
export type ThemeMode = "dark" | "light" | "system";

export type CurrencyCode = "THB" | "USD" | "EUR" | "GBP" | "SGD" | "JPY";

/** Ordering rule for which debt gets the extra cash each month. */
export type Strategy =
  /** Highest APR first — mathematically cheapest. */
  | "avalanche"
  /** Smallest balance first — fastest first win, better adherence. */
  | "snowball"
  /** Let the engine simulate both and pick the one that clears first. */
  | "auto";

export type DebtKind =
  | "credit_card"
  | "personal_loan"
  | "auto"
  | "mortgage"
  | "student"
  | "bnpl"
  | "informal"
  | "other";

/** Groups drive the "essential vs lifestyle" split in the budget engine. */
export type CategoryGroup =
  | "essential"
  | "tech"
  | "food"
  | "pet"
  | "hobby"
  | "transport"
  | "health"
  | "other";

export interface Category {
  id: string;
  /** Stable key used for i18n lookup + seed matching. */
  key: string;
  group: CategoryGroup;
  emoji: string;
  /** Custom labels win over the i18n dictionary when present. */
  labelEn?: string;
  labelTh?: string;
  /**
   * Essential = the plan must never squeeze it.
   * Non-essential = protected only up to `lifestyleKeepRatio`.
   */
  isEssential: boolean;
  /** One-tap amounts shown on the quick-add row. */
  quickAmounts: number[];
  isCustom: boolean;
  archived?: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  note?: string;
  /** Local calendar day, `YYYY-MM-DD`. Not a timestamp — no timezone drift. */
  date: string;
  createdAt: string;
  /** Rent/subscriptions: counted once per month, not per occurrence. */
  recurrence: "none" | "monthly";
}

/** Money that landed in the account — salary or anything else. */
export type IncomeKind = "salary" | "other";

export interface IncomeEntry {
  id: string;
  amount: number;
  note?: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  createdAt: string;
  kind: IncomeKind;
}

export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  /** Amount owed today. This is what the engine amortises. */
  balance: number;
  /** Original amount, kept so we can show "X% paid off". */
  principal: number;
  /** Annual percentage rate, e.g. 19.8 for 19.8%. */
  apr: number;
  minPayment: number;
  /** Day of month the payment is due, 1–31. */
  dueDay?: number;
  createdAt: string;
  archivedAt?: string;
}

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  /** `YYYY-MM-DD`, optional. */
  deadline?: string;
  monthlyContribution: number;
  /** The emergency fund is funded before extra debt payments. */
  isEmergencyFund: boolean;
  createdAt: string;
}

export interface Settings {
  language: Language;
  theme: ThemeMode;
  currency: CurrencyCode;
  /** Take-home pay per month, after tax. */
  monthlyIncome: number;
  /** Day of month the salary lands. */
  payday: number;
  strategy: Strategy;
  /**
   * How much of *discretionary* spending the plan promises to leave alone.
   * 1.0 = never touch my hobbies; 0.5 = I'll halve the fun to get out faster.
   */
  lifestyleKeepRatio: number;
  /** Slack left in the budget for the unexpected, as a % of income. */
  safetyBufferPct: number;
  /** Trailing window (days) used to learn the real spending rate. */
  spendWindowDays: 30 | 60 | 90;
  /**
   * Monthly "spend pot" — how much of income is set aside for day-to-day
   * spending. 0 = not set yet.
   */
  spendPotAmount: number;
  /**
   * On the Spend screen: subtract the spend pot when computing left-to-spend.
   */
  spendCountSpend: boolean;
  /**
   * On the Spend screen: subtract the "save this month" envelope when
   * computing left-to-spend.
   */
  spendCountSave: boolean;
  /**
   * On the Spend screen: subtract the "pay debts this month" envelope when
   * computing left-to-spend.
   */
  spendCountDebt: boolean;
  /** Cap on months simulated before we call a plan hopeless. */
  onboarded: boolean;
}

export interface AppState {
  version: number;
  settings: Settings;
  categories: Category[];
  expenses: Expense[];
  /** Money-in log for the "Spend" world. Missing on older saves → treat as []. */
  incomes: IncomeEntry[];
  debts: Debt[];
  goals: Goal[];
  /** Undefined until the user takes the lifestyle assessment. */
  baseline?: SpendingBaseline;
}

/* ------------------------------------------------------------------ */
/* Engine outputs                                                      */
/* ------------------------------------------------------------------ */

export interface MonthSnapshot {
  /** 1-based month index from today. */
  month: number;
  /** ISO date of the first of that month. */
  date: string;
  startingBalance: number;
  interestCharged: number;
  principalPaid: number;
  totalPaid: number;
  endingBalance: number;
  /** Debt receiving the extra payment this month. */
  focusDebtId: string | null;
  clearedDebtIds: string[];
}

export interface DebtPayoffDetail {
  debtId: string;
  name: string;
  /** Month index when it hits zero, null if not cleared within the horizon. */
  payoffMonth: number | null;
  payoffDate: string | null;
  interestPaid: number;
  totalPaid: number;
}

export interface PayoffPlan {
  strategy: Exclude<Strategy, "auto">;
  feasible: boolean;
  /** Set when minimum payments alone exceed the available budget. */
  shortfall: number;
  months: MonthSnapshot[];
  monthsToFreedom: number;
  payoffDate: string | null;
  totalInterest: number;
  totalPaid: number;
  perDebt: DebtPayoffDetail[];
  /** Debt currently receiving the extra — the one thing to focus on. */
  focusDebtId: string | null;
}

export interface StrategyComparison {
  avalanche: PayoffPlan;
  snowball: PayoffPlan;
  best: PayoffPlan;
  /** Months saved by `best` versus the slower of the two. */
  monthsSaved: number;
  /** Interest saved by `best` versus the more expensive of the two. */
  interestSaved: number;
}

export interface CategorySpend {
  categoryId: string;
  monthlyAvg: number;
  total: number;
  count: number;
  share: number;
}

export interface SpendProfile {
  /** Days of history actually available (capped by the window setting). */
  windowDays: number;
  /** Normalised to a month (30.44 days) so it lines up with income. */
  essentialMonthly: number;
  lifestyleMonthly: number;
  totalMonthly: number;
  /**
   * Day-to-day spending only — fixed monthly bills excluded. This is the
   * number the pace check compares against; measuring variable spend against
   * a target that includes rent would read "on pace" every day of the month.
   */
  variableMonthly: number;
  dailyAvg: number;
  todayTotal: number;
  last7: { date: string; total: number }[];
  byCategory: CategorySpend[];
  /** False when there is too little history to trust the averages. */
  hasEnoughData: boolean;
  /** 0 = figures come from the assessment estimate, 1 = from tracked data. */
  dataTrust: number;
  /** True while the assessment estimate is still contributing. */
  usingBaseline: boolean;
}

/** Output of the lifestyle assessment, stored so the plan works on day one. */
export interface SpendingBaseline {
  createdAt: string;
  /** `{ categoryId: estimated monthly amount }` */
  monthlyByCategory: Record<string, number>;
  /** Kept so the quiz can be reopened pre-filled instead of restarted. */
  answers: unknown;
}

export interface BudgetBreakdown {
  income: number;
  essentials: number;
  /** Discretionary spending the plan refuses to cut. */
  lifestyleProtected: number;
  /** Discretionary the user agreed to redirect (income for the plan). */
  lifestyleFreed: number;
  goalContributions: number;
  safetyBuffer: number;
  minimumPayments: number;
  /** What is left for extra debt payments after everything above. */
  availableExtra: number;
  /** Negative = the budget does not close. */
  surplus: number;
  warnings: BudgetWarning[];
}

export type BudgetWarning =
  | "no_income"
  | "minimums_exceed_budget"
  | "overspending"
  | "thin_data"
  | "no_emergency_fund"
  | "no_buffer";
