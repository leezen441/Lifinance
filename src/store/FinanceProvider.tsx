"use client";

/**
 * Single source of truth for the whole app.
 *
 * Offline-first: state lives in localStorage, so the app works on a plane and
 * no financial data leaves the device. Every derived number (payoff plan,
 * budget, spend profile) is memoised here so the dashboard reads them like
 * plain props instead of recomputing a 200-month simulation per render.
 *
 * Swapping to a real backend = replace `persist`/`load` with fetch calls; the
 * shape of `AppState` already matches the Prisma models.
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
  Language,
  PayoffPlan,
  Settings,
  SpendProfile,
  StrategyComparison,
  ThemeMode,
} from "@/lib/types";
import { emptyState, demoState, STORAGE_KEY, STATE_VERSION } from "@/lib/seed";
import { buildPlan, minimumsOnlyPlan } from "@/lib/debt-engine";
import { buildSpendProfile, computeBudget } from "@/lib/budget-engine";
import { todayISO } from "@/lib/date";
import { uid } from "@/lib/utils";

interface Derived {
  profile: SpendProfile;
  budget: BudgetBreakdown;
  plan: PayoffPlan;
  comparison: StrategyComparison;
  baseline: PayoffPlan;
  /** Months the extra payment buys versus paying minimums only. */
  monthsSaved: number;
  interestSaved: number;
}

interface FinanceValue extends Derived {
  hydrated: boolean;
  state: AppState;

  settings: Settings;
  categories: Category[];
  expenses: Expense[];
  debts: Debt[];
  goals: Goal[];

  updateSettings: (patch: Partial<Settings>) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeMode) => void;

  addExpense: (input: Omit<Expense, "id" | "createdAt"> & { date?: string }) => Expense;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;

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

function load(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (typeof parsed !== "object" || parsed === null) return null;
    // Future migrations hang off this check.
    if (parsed.version !== STATE_VERSION) return { ...emptyState(), ...parsed, version: STATE_VERSION };
    return parsed;
  } catch {
    return null;
  }
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  // Start from `emptyState()` on both server and first client render so the
  // markup matches; real data arrives in the effect below.
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

  /* ---------------------------- mutations ---------------------------- */

  const patch = useCallback((fn: (prev: AppState) => AppState) => setState(fn), []);

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
    (id) => patch((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) })),
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
        // Expenses keep their history; the category is archived, not deleted,
        // so past totals never silently change.
        categories: s.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      })),
    [patch],
  );

  const addDebt = useCallback<FinanceValue["addDebt"]>(
    (input) => {
      const debt: Debt = { ...input, id: uid("debt"), createdAt: new Date().toISOString() };
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

  const loadDemo = useCallback(() => setState(demoState()), []);

  const resetAll = useCallback(() => {
    const fresh = emptyState();
    // Keep the language/theme the user already chose — resetting data should
    // not throw them back into the wrong language.
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
      setState({ ...emptyState(), ...parsed, version: STATE_VERSION });
      return true;
    } catch {
      return false;
    }
  }, []);

  /* ----------------------------- derived ----------------------------- */

  const { settings, categories, expenses, debts, goals } = state;

  const profile = useMemo(
    () => buildSpendProfile(expenses, categories, settings.spendWindowDays),
    [expenses, categories, settings.spendWindowDays],
  );

  const budget = useMemo(
    () => computeBudget(settings, profile, debts, goals),
    [settings, profile, debts, goals],
  );

  const { plan, comparison } = useMemo(
    () => buildPlan(debts, budget.availableExtra, settings.strategy),
    [debts, budget.availableExtra, settings.strategy],
  );

  const baseline = useMemo(() => minimumsOnlyPlan(debts), [debts]);

  const monthsSaved = useMemo(() => {
    if (!plan.feasible || !baseline.feasible) return 0;
    return Math.max(0, baseline.monthsToFreedom - plan.monthsToFreedom);
  }, [plan, baseline]);

  const interestSaved = useMemo(() => {
    if (!plan.feasible || !baseline.feasible) return 0;
    return Math.max(0, baseline.totalInterest - plan.totalInterest);
  }, [plan, baseline]);

  const value = useMemo<FinanceValue>(
    () => ({
      hydrated,
      state,
      settings,
      categories,
      expenses,
      debts,
      goals,
      profile,
      budget,
      plan,
      comparison,
      baseline,
      monthsSaved,
      interestSaved,
      updateSettings,
      setLanguage,
      setTheme,
      addExpense,
      updateExpense,
      removeExpense,
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
      hydrated, state, settings, categories, expenses, debts, goals,
      profile, budget, plan, comparison, baseline, monthsSaved, interestSaved,
      updateSettings, setLanguage, setTheme, addExpense, updateExpense, removeExpense,
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
