import { cn } from "@/lib/cn";

/**
 * Panneau repliable (élément natif `details`) habillé comme une carte :
 * utilisable dans les Server Components sans état client. Le chevron est
 * dessiné par le style global de `summary`.
 */
export function Disclosure({
  summary,
  hint,
  children,
  className,
  bodyClassName,
  open,
  variant = "card",
}: {
  summary: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  open?: boolean;
  /** `card` : panneau autonome · `inline` : lien discret dans une carte. */
  variant?: "card" | "inline";
}) {
  if (variant === "inline") {
    return (
      <details open={open} className={cn("group", className)}>
        <summary className="inline-flex items-center text-[11.5px] font-medium text-gold-deep hover:text-ink transition-colors duration-300 select-none">
          {summary}
        </summary>
        <div className={cn("mt-3 rounded-[8px] border border-line bg-surface-2/60 p-4", bodyClassName)}>{children}</div>
      </details>
    );
  }
  return (
    <details
      open={open}
      className={cn(
        "group rounded-[8px] border border-line bg-surface shadow-[0_1px_2px_rgba(10,22,40,.04)] open:border-gold/30",
        className,
      )}
    >
      <summary className="flex flex-wrap items-center gap-2 px-5 py-3.5 text-[13px] font-medium text-ink select-none rounded-[8px] hover:bg-surface-2/70 transition-colors duration-300">
        <span className="inline-flex items-center">{summary}</span>
        {hint && <span className="ml-auto text-[11px] font-normal text-muted">{hint}</span>}
      </summary>
      <div className={cn("border-t border-line px-5 py-5", bodyClassName)}>{children}</div>
    </details>
  );
}
