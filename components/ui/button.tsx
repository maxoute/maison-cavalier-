import { cn } from "@/lib/cn";

type Variant = "gold" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

/* Style prototype : pill 24px, or en dégradé pour l'action principale,
   ghost doré pour le secondaire. Un seul bouton or par écran (PRD §10). */
const variants: Record<Variant, string> = {
  gold: cn(
    "relative overflow-hidden text-navy font-semibold isolate",
    "bg-gradient-to-br from-gold-light via-gold to-[#9c7a22]",
    "shadow-[0_1px_0_rgba(255,255,255,.35)_inset,0_10px_24px_-10px_rgba(184,146,42,.65)]",
    "hover:shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_14px_30px_-10px_rgba(184,146,42,.8)]",
    "hover:-translate-y-px active:translate-y-0 active:brightness-95",
  ),
  ghost:
    "bg-gold/[0.06] text-gold-deep border border-gold/40 hover:bg-gold/[0.12] hover:border-gold/60",
  outline:
    "bg-ink/[0.03] text-ink/80 border border-line hover:border-grey/50 hover:bg-ink/[0.03] hover:text-ink",
  danger: "bg-red/[0.06] text-red border border-red/40 hover:bg-red/[0.12] hover:border-red/60",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-[11px]",
  md: "px-6 py-3 text-[13px]",
  lg: "px-8 py-3.5 text-sm",
};

export function Button({
  variant = "gold",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-[24px] font-medium tracking-[0.4px]",
        "transition-all duration-300 ease-in-out cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {variant === "gold" && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-0 -translate-x-[130%] skew-x-[-15deg]",
            "transition-transform duration-700 ease-out group-hover:translate-x-[130%]",
          )}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)",
          }}
        />
      )}
      <span className="relative z-[1] inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}
