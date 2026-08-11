"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { evalMoneyExpression, isIncompleteMoneyExpression } from "@/lib/money-expr";

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

const OPS = [
  { key: "+", label: "+" },
  { key: "-", label: "−" },
  { key: "*", label: "×" },
  { key: "/", label: "÷" },
] as const;

function fireChange(el: HTMLInputElement, next: string, onChange?: React.ChangeEventHandler<HTMLInputElement>) {
  el.value = next;
  onChange?.({
    target: el,
    currentTarget: el,
  } as React.ChangeEvent<HTMLInputElement>);
}

/**
 * Money field that doubles as a tiny calculator.
 *
 * Type `120+80` or tap + − × ÷. A live `= total` appears while the expression
 * is valid; blur or Enter resolves it to the final number.
 */
export function MoneyInput({
  className,
  symbol,
  value,
  defaultValue,
  onChange,
  onBlur,
  onKeyDown,
  onFocus,
  placeholder = "0  ·  120+80",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { symbol?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewId = useId();
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => String(value ?? defaultValue ?? ""));

  useEffect(() => {
    if (focused) return;
    setDraft(value === undefined || value === null ? "" : String(value));
  }, [value, focused]);

  const preview = evalMoneyExpression(draft);
  const showPreview =
    focused &&
    preview !== null &&
    /[+\-*/×÷xX]/.test(String(draft)) &&
    !isIncompleteMoneyExpression(draft);

  const resolve = (el: HTMLInputElement) => {
    const result = evalMoneyExpression(draft);
    if (result === null) return;
    const resolved = Number.isInteger(result) ? String(result) : String(result);
    setDraft(resolved);
    fireChange(el, resolved, onChange);
  };

  const appendOp = (op: string) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${op}${draft.slice(end)}`;
    setDraft(next);
    fireChange(el, next, onChange);
    requestAnimationFrame(() => {
      const pos = start + op.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const display = focused
    ? draft
    : value === undefined || value === null
      ? draft
      : String(value);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {symbol ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
            {symbol}
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={showPreview ? previewId : undefined}
          placeholder={placeholder}
          className={cn(
            base,
            "tabular h-11 text-[15px] font-medium",
            symbol && "pl-8",
            showPreview && "pr-24",
            className,
          )}
          {...props}
          value={display}
          onFocus={(e) => {
            setFocused(true);
            setDraft(e.target.value);
            onFocus?.(e);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange?.(e);
          }}
          onBlur={(e) => {
            resolve(e.currentTarget);
            setFocused(false);
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              resolve(e.currentTarget);
              e.currentTarget.blur();
            }
            onKeyDown?.(e);
          }}
        />
        {showPreview ? (
          <span
            id={previewId}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 tabular text-[13px] font-semibold text-neon"
          >
            = {preview}
          </span>
        ) : null}
      </div>

      {focused ? (
        <div className="grid grid-cols-5 gap-1">
          {OPS.map((op) => (
            <button
              key={op.key}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => appendOp(op.key)}
              className="h-9 rounded-lg border border-border bg-surface-2 text-[15px] font-semibold text-ink transition-colors hover:border-neon/50 hover:text-neon active:scale-[0.98]"
            >
              {op.label}
            </button>
          ))}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const el = inputRef.current;
              if (el) resolve(el);
            }}
            className="h-9 rounded-lg border border-neon/40 bg-neon/10 text-[13px] font-bold text-neon transition-colors hover:bg-neon/20 active:scale-[0.98]"
          >
            =
          </button>
        </div>
      ) : null}
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
