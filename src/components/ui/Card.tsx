import { cn } from "@/lib/utils";

export function Card({
  className,
  neon,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { neon?: boolean }) {
  return (
    <div
      className={cn(neon ? "card-neon" : "card", "p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight sm:text-base">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted sm:text-[13px]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
