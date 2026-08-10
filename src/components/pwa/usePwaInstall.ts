"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Chrome/Edge fire `beforeinstallprompt` and hand you a deferred prompt.
 * Safari fires nothing and has no API at all — iOS installs happen through the
 * Share sheet — so the hook reports the platform and lets the UI branch.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lifinance.install.dismissed";

export type InstallState =
  /** Already running from the home screen — nothing to offer. */
  | "installed"
  /** Chrome-family: we hold a real prompt and can install on tap. */
  | "available"
  /** iOS Safari: no API, show the Share-sheet instructions instead. */
  | "ios"
  /** Nothing to do here (desktop Firefox, in-app browsers, already dismissed). */
  | "unsupported";

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>("unsupported");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS exposes this instead of the display-mode media query.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setState("installed");
      return;
    }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

    if ((isIOS || isIPadOS) && isSafari) setState("ios");

    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    const onPrompt = (event: Event) => {
      // Stop Chrome's own mini-infobar so ours is the only prompt shown.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setState("available");
    };
    const onInstalled = () => {
      setState("installed");
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; Chrome re-fires it if the user declines.
    setDeferred(null);
    if (outcome === "accepted") setState("installed");
    return outcome === "accepted";
  }, [deferred]);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  return { state, install, dismiss, dismissed };
}
