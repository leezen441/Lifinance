"use client";

import { FinanceProvider, useFinance } from "@/store/FinanceProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeApplier } from "@/components/ThemeToggle";
import { AppShell } from "@/components/AppShell";

/**
 * i18n reads its language from the finance store, so it has to sit inside it.
 */
function Localised({ children }: { children: React.ReactNode }) {
  const { settings, setLanguage, hydrated } = useFinance();

  return (
    <I18nProvider
      lang={settings.language}
      setLang={setLanguage}
      currency={settings.currency}
    >
      <ThemeApplier />
      <ToastProvider>
        <AppShell>
          {/* Until localStorage is read, render a calm skeleton rather than
              flashing zeroes that are about to be replaced. */}
          <div className={hydrated ? "" : "pointer-events-none opacity-0"}>{children}</div>
        </AppShell>
      </ToastProvider>
    </I18nProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <Localised>{children}</Localised>
    </FinanceProvider>
  );
}
