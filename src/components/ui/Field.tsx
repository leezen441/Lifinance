import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-border bg-surface-2 px-3.5 text-ink placeholder:text-muted/70 " +
  "outline-none transition-colors focus:border-neon/60 disabled:opacity-50";

export function Label({
  children,
  hint,
  className,
  htmlFor,
}: {
  children: React.ReactNode;
  hint?: string;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{children}</span>
      {hint ? <span className="mb-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-11 text-[15px]", className)} {...props} />;
}

/**
 * Numeric input with `inputMode="decimal"` so phones show the number pad —
 * the difference between a 2-second log and a 10-second one.
 */
export function MoneyInput({
  className,
  symbol,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { symbol?: string }) {
  return (
    <div className="relative">
      {symbol ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
          {symbol}
        </span>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          base,
          "tabular h-11 text-[15px] font-medium",
          symbol && "pl-8",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(base, "h-11 appearance-none pr-9 text-[15px]", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b968c' stroke-width='2.5' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Range slider with a neon thumb, used for the intensity control. */
export function Slider({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--neon)]",
        "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon",
        "[&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(57,255,20,0.6)]",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full",
        "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-neon",
        className,
      )}
      {...props}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-left transition-colors hover:border-neon/40"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-neon" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
