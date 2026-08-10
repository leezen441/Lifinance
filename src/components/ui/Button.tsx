import { cn } from "@/lib/utils";

type Variant = "neon" | "solid" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // The one call-to-action style. Used sparingly so it stays loud.
  neon: "bg-neon text-neon-ink font-semibold hover:brightness-110 active:brightness-95 dark:glow",
  solid: "bg-surface-2 text-ink hover:bg-surface-2/70 border border-border",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  outline: "border border-border text-ink hover:border-neon/60 hover:text-neon",
  danger: "text-danger border border-danger/30 hover:bg-danger/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-base rounded-2xl",
  icon: "h-10 w-10 rounded-xl",
};

export function Button({
  variant = "solid",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all",
        "disabled:pointer-events-none disabled:opacity-40",
        // 44px min touch target on mobile comes from the size classes above
        "select-none active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
