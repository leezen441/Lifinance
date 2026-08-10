"use client";

import { cn } from "@/lib/utils";

/**
 * Smooth progress bar. The neon fill animates its width, so a payment landing
 * visibly moves the bar — that motion is the whole reward loop.
 */
export function Progress({
  value,
  className,
  barClassName,
  height = "h-2",
  label,
  glow = true,
}: {
  /** 0–1 */
  value: number;
  className?: string;
  barClassName?: string;
  height?: string;
  label?: string;
  glow?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-2", height, className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full bg-neon transition-[width] duration-700 ease-out",
          glow && "dark:shadow-[0_0_12px_rgba(57,255,20,0.55)]",
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Segmented milestone bar — 4 chunks at 25/50/75/100%. Reads as a game
 * progress bar rather than a spreadsheet cell.
 */
export function MilestoneBar({
  value,
  className,
}: {
  /** 0–1 */
  value: number;
  className?: string;
}) {
  const pct = Math.min(1, Math.max(0, value));
  return (
    <div className={cn("flex gap-1", className)}>
      {[0.25, 0.5, 0.75, 1].map((stop, i) => {
        const start = i * 0.25;
        const fill = Math.min(1, Math.max(0, (pct - start) / 0.25));
        return (
          <div key={stop} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-neon transition-[width] duration-700 ease-out dark:shadow-[0_0_10px_rgba(57,255,20,0.5)]"
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Donut used for the headline "% paid off". */
export function Ring({
  value,
  size = 72,
  stroke = 7,
  children,
}: {
  /** 0–1 */
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const pct = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--neon)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
