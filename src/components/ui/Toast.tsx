"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  message: string;
  tone: "neon" | "plain";
  action?: { label: string; onClick: () => void };
}

interface ToastValue {
  toast: (
    message: string,
    opts?: { tone?: ToastItem["tone"]; action?: ToastItem["action"]; duration?: number },
  ) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback<ToastValue["toast"]>((message, opts) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, message, tone: opts?.tone ?? "plain", action: opts?.action }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, opts?.duration ?? 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-toast pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm shadow-lg backdrop-blur",
              t.tone === "neon"
                ? "border-neon/50 bg-neon/12 text-ink dark:glow"
                : "border-border bg-surface/95 text-ink",
            )}
          >
            <span className="font-medium">{t.message}</span>
            {t.action ? (
              <button
                onClick={() => {
                  t.action?.onClick();
                  setItems((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="font-semibold text-neon underline-offset-2 hover:underline"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
