import { cn } from "@/lib/cn";

type Accent = "gold" | "blue" | "green" | "orange" | "violet" | "red" | "grey";

const accentColor: Record<Accent, string> = {
  gold: "var(--gold)",
  blue: "var(--blue)",
  green: "var(--green)",
  orange: "var(--orange)",
  violet: "var(--violet)",
  red: "var(--red)",
  grey: "var(--grey)",
};

/**
 * Carte du prototype, enrichie : dégradé subtil de profondeur, liseré
 * intérieur, barre d'accent optionnelle en tête, lift au survol.
 */
export function Card({
  className,
  accent,
  interactive,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  accent?: Accent;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[8px] border border-navy-3 overflow-hidden",
        "bg-[linear-gradient(160deg,var(--navy-3),var(--navy-2)_45%)]",
        "shadow-[0_1px_0_rgba(255,255,255,.03)_inset,0_10px_28px_-14px_rgba(0,0,0,.65)]",
        interactive &&
          "transition-all duration-300 ease-in-out hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(255,255,255,.05)_inset,0_18px_38px_-16px_rgba(0,0,0,.75)]",
        className,
      )}
      style={style}
      {...props}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor[accent]}, transparent)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-5 pt-4 pb-2 flex items-center justify-between gap-3", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-[15px] text-cream", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-4", className)} {...props} />;
}

/** Étiquette de section du prototype : uppercase, espacée, grise, avec tiret repère. */
export function SectionLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-[10px] tracking-[1.5px] uppercase text-grey",
        "before:content-[''] before:w-3 before:h-px before:bg-gold/50",
        className,
      )}
      {...props}
    />
  );
}
