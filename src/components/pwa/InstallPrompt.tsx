"use client";

import { useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { usePwaInstall } from "./usePwaInstall";
import { Button } from "@/components/ui/Button";

/**
 * A one-line invitation above the dashboard, not a modal — installing is a
 * nice-to-have, and interrupting someone's first look at their finances to
 * ask for it would be rude.
 *
 * Chrome gets a real Install button. iOS Safari gets the Share-sheet steps,
 * because Apple provides no programmatic install at all.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const { state, install, dismiss, dismissed } = usePwaInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (dismissed || state === "installed" || state === "unsupported") return null;

  return (
    <div className="animate-rise card-neon overflow-hidden p-3.5 sm:p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neon text-neon-ink dark:shadow-[0_0_16px_rgba(57,255,20,0.4)]">
          <Download size={19} strokeWidth={2.4} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-tight">{t("install.title")}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted">{t("install.body")}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="neon"
            size="sm"
            onClick={() => {
              if (state === "ios") setShowIosSteps((v) => !v);
              else void install();
            }}
          >
            {t("install.cta")}
          </Button>
          <button
            onClick={dismiss}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={t("install.later")}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {state === "ios" && showIosSteps ? (
        <div className="animate-rise mt-3 rounded-xl border border-neon/25 bg-neon/[0.05] p-3">
          <p className="mb-2 text-[12px] font-medium">{t("install.iosBody")}</p>
          <ol className="space-y-2 text-[13px]">
            <li className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-bold">
                1
              </span>
              <Share size={15} className="shrink-0 text-neon" />
              <span>{t("install.iosStep1")}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-2 text-[11px] font-bold">
                2
              </span>
              <SquarePlus size={15} className="shrink-0 text-neon" />
              <span>{t("install.iosStep2")}</span>
            </li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}

/** Persistent version for Settings — no dismiss, always shows current status. */
export function InstallSection() {
  const { t } = useI18n();
  const { state, install } = usePwaInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (state === "installed") {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-neon/10 px-3 py-2.5 text-[13px] font-medium text-neon">
        <Download size={15} />
        {t("install.alreadyInstalled")}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="neon"
          onClick={() => {
            if (state === "ios") setShowIosSteps((v) => !v);
            else void install();
          }}
          disabled={state === "unsupported"}
        >
          <Download size={15} />
          {t("install.cta")}
        </Button>
        <span className="text-[12px] text-muted">{t("install.sectionHint")}</span>
      </div>

      {state === "ios" && showIosSteps ? (
        <ol className="animate-rise mt-3 space-y-2 rounded-xl border border-neon/25 bg-neon/[0.05] p-3 text-[13px]">
          <li className="flex items-center gap-2.5">
            <Share size={15} className="shrink-0 text-neon" />
            {t("install.iosStep1")}
          </li>
          <li className="flex items-center gap-2.5">
            <SquarePlus size={15} className="shrink-0 text-neon" />
            {t("install.iosStep2")}
          </li>
        </ol>
      ) : null}
    </div>
  );
}
