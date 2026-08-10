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
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // A worker left behind by `npm start` on this same port would keep
      // serving the built app to `npm run dev`, so edits appear to do nothing
      // and the page hydrates against stale HTML. Evict it on sight.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        if (regs.length === 0) return;
        regs.forEach((r) => void r.unregister());
        if ("caches" in window) {
          void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
        }
      });
      return;
    }

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
