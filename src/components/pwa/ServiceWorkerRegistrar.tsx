"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only.
 *
 * In dev it is actively harmful: it would sit in front of Next's HMR endpoints
 * and serve stale chunks, producing "why isn't my edit showing" bugs that look
 * like build problems.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failing is not fatal — the app still works online.
      });
    };

    // Wait for load so the SW install never competes with the first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
