"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, PiggyBank, Receipt, Settings2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/debts", key: "nav.debts", icon: CreditCard },
  { href: "/expenses", key: "nav.expenses", icon: Receipt },
  { href: "/goals", key: "nav.goals", icon: PiggyBank },
  { href: "/settings", key: "nav.settings", icon: Settings2 },
] as const;

/**
 * Mobile-first chrome:
 *   < lg  → sticky top bar + fixed bottom tab bar (thumb reach)
 *   ≥ lg  → left sidebar, content centred at a comfortable measure
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="lg:flex">
      {/* ---------------------------- sidebar ---------------------------- */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border px-4 py-6 lg:flex xl:w-64">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">Lifinance</div>
            <div className="text-[11px] text-muted">{t("tagline")}</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-neon/10 font-semibold text-neon"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={18} />
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </aside>

      {/* ---------------------------- content ---------------------------- */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={26} />
              <span className="text-[15px] font-bold tracking-tight">Lifinance</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:max-w-5xl lg:pb-10 lg:pt-8 xl:px-10">
          {children}
        </main>
      </div>

      {/* -------------------------- bottom tabs -------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {NAV.map(({ href, key, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-neon" : "text-muted",
                )}
              >
                {active ? (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-neon dark:shadow-[0_0_10px_var(--neon)]" />
                ) : null}
                <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                <span className="max-w-full truncate px-0.5">{t(key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl bg-neon text-neon-ink dark:shadow-[0_0_16px_rgba(57,255,20,0.45)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 18L9.5 11.5L14 15L20 6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
