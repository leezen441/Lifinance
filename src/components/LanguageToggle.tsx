"use client";

import { useFinance } from "@/store/FinanceProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

const OPTIONS: { value: Language; short: string; full: string }[] = [
  { value: "th", short: "ไทย", full: "ไทย" },
  { value: "en", short: "EN", full: "English" },
];

/**
 * TH ⇄ EN switch. Lives in the header on every screen — language is not a
 * setting you should have to go hunting for.
 */
export function LanguageToggle({ full = false }: { full?: boolean }) {
  const { setLanguage } = useFinance();
  const { lang } = useI18n();

  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-surface-2 p-0.5"
      role="group"
      aria-label="Language / ภาษา"
    >
      {OPTIONS.map((opt) => {
        const active = lang === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setLanguage(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-all",
              full && "px-4 py-2 text-sm",
              active
                ? "bg-neon text-neon-ink dark:shadow-[0_0_14px_rgba(57,255,20,0.45)]"
                : "text-muted hover:text-ink",
            )}
          >
            {full ? opt.full : opt.short}
          </button>
        );
      })}
    </div>
  );
}
