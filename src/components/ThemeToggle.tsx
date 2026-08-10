"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useFinance } from "@/store/FinanceProvider";

/**
 * Applies the theme class to <html>. Dark is the default because the neon
 * only really sings against near-black — light mode swaps in a darker green.
 */
export function ThemeApplier() {
  const { settings, hydrated } = useFinance();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark =
      settings.theme === "dark" || (settings.theme === "system" && prefersDark);
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }, [settings.theme, hydrated]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  return null;
}

export function ThemeToggle() {
  const { settings, setTheme } = useFinance();
  const isDark = settings.theme !== "light";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 text-muted transition-colors hover:text-neon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
