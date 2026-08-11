"use client";

/**
 * Single source of truth for the whole app.
 *
 * Offline-first: state lives in localStorage, so the app works on a plane and
 * no financial data leaves the device. Every derived number (payoff plan,
 * budget, spend profile, month plan) is memoised here so screens read them
 * like plain props instead of recomputing a 200-month simulation per render.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  BudgetBreakdown,
  Category,
  Debt,
  Expense,
  Goal,
  IncomeEntry,
  Language,
  PayoffPlan,
  Settings,
  SpendingBaseline,
  SpendProfile,
  StrategyComparison,
  ThemeMode,
} from "@/lib/types";
import type { BudgetRecommendation } from "@/lib/recommend";
import type { MonthPlan } from "@/lib/month-plan";
import { emptyState, demoState, STORAGE_KEY, STATE_VERSION, DEFAULT_CATEGORIES } from "@/lib/seed";
import { buildPlan, minimumsOnlyPlan } from "@/lib/debt-engine";
import { buildSpendProfile, computeBudget } from "@/lib/budget-engine";
import { recommendBudget } from "@/lib/recommend";
import { buildMonthPlan } from "@/lib/month-plan";
import { todayISO } from "@/lib/date";
import { uid } from "@/lib/utils";
import {
  accrueAllDebts,
  applyDebtPayment,
  DEBT_PAYMENT_CATEGORY_ID,
  reverseDebtPayment,
} from "@/lib/debt-interest";

interface Derived {
  profile: SpendProfile;
  budget: BudgetBreakdown;
  recommendation: BudgetRecommendation;
  plan: PayoffPlan;
  comparison: StrategyComparison;
  minimumsPlan: PayoffPlan;
  monthsSaved: number;
  interestSaved: number;
  /** Single story for Spend / Save / Debt screens. */
  monthPlan: MonthPlan;
}

interface FinanceValue extends Derived {
  hydrated: boolean;
  state: AppState;

  settings: Settings;
  categories: Category[];
  expenses: Expense[];
  incomes: IncomeEntry[];
  debts: Debt[];
  goals: Goal[];
  baseline?: SpendingBaseline;

  setBaseline: (baseline: SpendingBaseline | undefined) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeMode) => void;

  addExpense: (input: Omit<Expense, "id" | "createdAt"> & { date?: string }) => Expense;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;
  /**
   * Log a payment toward a debt: accrues daily interest, reduces balance,
   * archives when cleared, and creates a money-out row.
   */
  payDebt: (input: {
    debtId: string;
    amount: number;
    date?: string;
    note?: string;
  }) => { expense: Expense; cleared: boolean; debt: Debt };

  addIncome: (input: Omit<IncomeEntry, "id" | "createdAt"> & { date?: string }) => IncomeEntry;
  updateIncome: (id: string, patch: Partial<IncomeEntry>) => void;
  removeIncome: (id: string) => void;

  addCategory: (input: Omit<Category, "id" | "isCustom">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  addDebt: (input: Omit<Debt, "id" | "createdAt">) => Debt;
  updateDebt: (id: string, patch: Partial<Debt>) => void;
  removeDebt: (id: string) => void;

  addGoal: (input: Omit<Goal, "id" | "createdAt">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number) => void;

  loadDemo: () => void;
  resetAll: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
}

const FinanceContext = createContext<FinanceValue | null>(null);

/** Ensure newly added built-in categories appear for existing local saves. */
function mergeMissingCategories(state: AppState): AppState {
  const have = new Set(state.categories.map((c) => c.key));
  const missing = DEFAULT_CATEGORIES.filter((c) => !have.has(c.key)).map((c) => ({
    ...c,
    id: `cat_${c.key}`,
  }));
  if (missing.length === 0) return state;
  return { ...state, categories: [...state.categories, ...missing] };
}

/** Older saves may lack `incomes` — fill the gap without wiping data. */
function migrateState(raw: AppState): AppState {
  const withDefaults: AppState = {
    ...emptyState(),
    ...raw,
    version: STATE_VERSION,
    incomes: Array.isArray(raw.incomes) ? raw.incomes : [],
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    debts: Array.isArray(raw.debts) ? raw.debts : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    categories: Array.isArray(raw.categories) ? raw.categories : emptyState().categories,
    settings: { ...emptyState().settings, ...(raw.settings ?? {}) },
  };
  return mergeMissingCategories(withDefaults);
}

function load(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (typeof parsed !== "object" || parsed === null) return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState());
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  useEffect(() => {
    const stored = load();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or private mode — the app keeps working in memory.
    }
  }, [state, hydrated]);

  const patch = useCallback((fn: (prev: AppState) => AppState) => setState(fn), []);

  useEffect(() => {
    if (!hydrated) return;
    const today = todayISO();
    patch((s) => {
      const debts = accrueAllDebts(s.debts, today);
      if (debts === s.debts) return s;
      return { ...s, debts };
    });
  }, [hydrated, patch]);

  const updateSettings = useCallback(
    (p: Partial<Settings>) =>
      patch((s) => ({ ...s, settings: { ...s.settings, ...p } })),
    [patch],
  );

  const setLanguage = useCallback((lang: Language) => updateSettings({ language: lang }), [updateSettings]);
  const setTheme = useCallback((theme: ThemeMode) => updateSettings({ theme }), [updateSettings]);

  const addExpense = useCallback<FinanceValue["addExpense"]>(
    (input) => {
      const expense: Expense = {
        id: uid("exp"),
        createdAt: new Date().toISOString(),
        date: input.date ?? todayISO(),
        recurrence: input.recurrence ?? "none",
        categoryId: input.categoryId,
        amount: input.amount,
        note: input.note,
        debtId: input.debtId,
      };
      patch((s) => ({ ...s, expenses: [expense, ...s.expenses] }));
      return expense;
    },
    [patch],
  );

  const updateExpense = useCallback<FinanceValue["updateExpense"]>(
    (id, p) =>
      patch((s) => ({
        ...s,
        expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...p } : e)),
      })),
    [patch],
  );

  const removeExpense = useCallback<FinanceValue["removeExpense"]>(
    (id) =>
      patch((s) => {
        const expense = s.expenses.find((e) => e.id === id);
        const debts =
          expense?.debtId
            ? s.debts.map((d) =>
                d.id === expense.debtId ? reverseDebtPayment(d, expense.amount) : d,
              )
            : s.debts;
        return {
          ...s,
          debts,
          expenses: s.expenses.filter((e) => e.id !== id),
        };
      }),
    [patch],
  );

  const payDebt = useCallback<FinanceValue["payDebt"]>(
    (input) => {
      const date = input.date ?? todayISO();
      let result: { expense: Expense; cleared: boolean; debt: Debt } | null = null;

      patch((s) => {
        const accrued = accrueAllDebts(s.debts, date);
        const current = accrued.find((d) => d.id === input.debtId);
        if (!current || current.archivedAt) {
          return accrued === s.debts ? s : { ...s, debts: accrued };
        }

        const { debt, applied, cleared } = applyDebtPayment(current, input.amount, date);
        if (applied <= 0) {
          return accrued === s.debts ? s : { ...s, debts: accrued };
        }

        const expense: Expense = {
          id: uid("exp"),
          createdAt: new Date().toISOString(),
          date,
          recurrence: "none",
          categoryId: DEBT_PAYMENT_CATEGORY_ID,
          amount: applied,
          note: input.note,
          debtId: debt.id,
        };
        result = { expense, cleared, debt };
        return {
          ...s,
          debts: accrued.map((d) => (d.id === debt.id ? debt : d)),
          expenses: [expense, ...s.expenses],
        };
      });

      if (!result) {
        return {
          expense: {
            id: "",
            categoryId: DEBT_PAYMENT_CATEGORY_ID,
            amount: 0,
            date,
            createdAt: new Date().toISOString(),
            recurrence: "none" as const,
            debtId: input.debtId,
          },
          cleared: false,
          debt: {
            id: input.debtId,
            name: "",
            kind: "other" as const,
            balance: 0,
            principal: 0,
            apr: 0,
            minPayment: 0,
            createdAt: new Date().toISOString(),
          },
        };
      }
      return result;
    },
    [patch],
  );

  const addIncome = useCallback<FinanceValue["addIncome"]>(
    (input) => {
      const entry: IncomeEntry = {
        id: uid("inc"),
        createdAt: new Date().toISOString(),
        date: input.date ?? todayISO(),
        amount: input.amount,
        note: input.note,
        kind: input.kind,
      };
      patch((s) => ({ ...s, incomes: [entry, ...(s.incomes ?? [])] }));
      return entry;
    },
    [patch],
  );

  const updateIncome = useCallback<FinanceValue["updateIncome"]>(
    (id, p) =>
      patch((s) => ({
        ...s,
        incomes: (s.incomes ?? []).map((e) => (e.id === id ? { ...e, ...p } : e)),
      })),
    [patch],
  );

  const removeIncome = useCallback<FinanceValue["removeIncome"]>(
    (id) =>
      patch((s) => ({
        ...s,
        incomes: (s.incomes ?? []).filter((e) => e.id !== id),
      })),
    [patch],
  );

  const addCategory = useCallback<FinanceValue["addCategory"]>(
    (input) => {
      const category: Category = { ...input, id: uid("cat"), isCustom: true };
      patch((s) => ({ ...s, categories: [...s.categories, category] }));
      return category;
    },
    [patch],
  );

  const updateCategory = useCallback<FinanceValue["updateCategory"]>(
    (id, p) =>
      patch((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...p } : c)),
      })),
    [patch],
  );

  const removeCategory = useCallback<FinanceValue["removeCategory"]>(
    (id) =>
      patch((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      })),
    [patch],
  );

  const addDebt = useCallback<FinanceValue["addDebt"]>(
    (input) => {
      const debt: Debt = {
        ...input,
        id: uid("debt"),
        createdAt: new Date().toISOString(),
        paidTotal: input.paidTotal ?? 0,
        interestAccrued: input.interestAccrued ?? 0,
        lastInterestDate: input.lastInterestDate ?? todayISO(),
      };
      patch((s) => ({ ...s, debts: [...s.debts, debt] }));
      return debt;
    },
    [patch],
  );

  const updateDebt = useCallback<FinanceValue["updateDebt"]>(
    (id, p) =>
      patch((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...p } : d)) })),
    [patch],
  );

  const removeDebt = useCallback<FinanceValue["removeDebt"]>(
    (id) => patch((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) })),
    [patch],
  );

  const addGoal = useCallback<FinanceValue["addGoal"]>(
    (input) => {
      const goal: Goal = { ...input, id: uid("goal"), createdAt: new Date().toISOString() };
      patch((s) => ({ ...s, goals: [...s.goals, goal] }));
      return goal;
    },
    [patch],
  );

  const updateGoal = useCallback<FinanceValue["updateGoal"]>(
    (id, p) =>
      patch((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, ...p } : g)) })),
    [patch],
  );

  const removeGoal = useCallback<FinanceValue["removeGoal"]>(
    (id) => patch((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
    [patch],
  );

  const contributeToGoal = useCallback<FinanceValue["contributeToGoal"]>(
    (id, amount) =>
      patch((s) => ({
        ...s,
        goals: s.goals.map((g) =>
          g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g,
        ),
      })),
    [patch],
  );

  const setBaseline = useCallback<FinanceValue["setBaseline"]>(
    (baseline) => patch((s) => ({ ...s, baseline })),
    [patch],
  );

  const loadDemo = useCallback(() => setState(demoState()), []);

  const resetAll = useCallback(() => {
    const fresh = emptyState();
    setState((prev) => ({
      ...fresh,
      settings: {
        ...fresh.settings,
        language: prev.settings.language,
        theme: prev.settings.theme,
        currency: prev.settings.currency,
      },
    }));
  }, []);

  const exportJSON = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importJSON = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!parsed || !Array.isArray(parsed.debts) || !Array.isArray(parsed.expenses)) {
        return false;
      }
      setState(migrateState(parsed));
      return true;
    } catch {
      return false;
    }
  }, []);

  const { settings, categories, expenses, debts, goals } = state;
  const incomes = state.incomes ?? [];

  const profile = useMemo(
    () =>
      buildSpendProfile(
        expenses,
        categories,
        settings.spendWindowDays,
        new Date(),
        state.baseline?.monthlyByCategory,
      ),
    [expenses, categories, settings.spendWindowDays, state.baseline],
  );

  const recommendation = useMemo(() => {
    const essentialById = new Map(categories.map((c) => [c.id, c.isEssential]));
    return recommendBudget(settings.monthlyIncome, profile, debts, goals, (id) =>
      essentialById.get(id) ?? false,
    );
  }, [settings.monthlyIncome, profile, debts, goals, categories]);

  const budget = useMemo(
    () => computeBudget(settings, profile, debts, goals),
    [settings, profile, debts, goals],
  );

  const { plan, comparison } = useMemo(
    () => buildPlan(debts, budget.availableExtra, settings.strategy),
    [debts, budget.availableExtra, settings.strategy],
  );

  const minimumsPlan = useMemo(() => minimumsOnlyPlan(debts), [debts]);

  const monthsSaved = useMemo(() => {
    if (!plan.feasible || !minimumsPlan.feasible) return 0;
    return Math.max(0, minimumsPlan.monthsToFreedom - plan.monthsToFreedom);
  }, [plan, minimumsPlan]);

  const interestSaved = useMemo(() => {
    if (!plan.feasible || !minimumsPlan.feasible) return 0;
    return Math.max(0, minimumsPlan.totalInterest - plan.totalInterest);
  }, [plan, minimumsPlan]);

  const monthPlan = useMemo(
    () =>
      buildMonthPlan({
        settings,
        incomes,
        expenses,
        debts,
        goals,
        budget,
        recommendation,
        plan,
      }),
    [settings, incomes, expenses, debts, goals, budget, recommendation, plan],
  );

  const value = useMemo<FinanceValue>(
    () => ({
      hydrated,
      state,
      settings,
      categories,
      expenses,
      incomes,
      debts,
      goals,
      baseline: state.baseline,
      setBaseline,
      profile,
      budget,
      recommendation,
      plan,
      comparison,
      minimumsPlan,
      monthsSaved,
      interestSaved,
      monthPlan,
      updateSettings,
      setLanguage,
      setTheme,
      addExpense,
      updateExpense,
      removeExpense,
      payDebt,
      addIncome,
      updateIncome,
      removeIncome,
      addCategory,
      updateCategory,
      removeCategory,
      addDebt,
      updateDebt,
      removeDebt,
      addGoal,
      updateGoal,
      removeGoal,
      contributeToGoal,
      loadDemo,
      resetAll,
      exportJSON,
      importJSON,
    }),
    [
      hydrated, state, settings, categories, expenses, incomes, debts, goals,
      setBaseline, profile, budget, recommendation, plan, comparison,
      minimumsPlan, monthsSaved, interestSaved, monthPlan,
      updateSettings, setLanguage, setTheme, addExpense, updateExpense, removeExpense, payDebt,
      addIncome, updateIncome, removeIncome,
      addCategory, updateCategory, removeCategory, addDebt, updateDebt, removeDebt,
      addGoal, updateGoal, removeGoal, contributeToGoal, loadDemo, resetAll,
      exportJSON, importJSON,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>");
  return ctx;
}
