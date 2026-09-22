import { Card, SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Accent = "gold" | "blue" | "green" | "orange" | "violet" | "red" | "grey";

/**
 * Tuile d'indicateur : valeur en Lora, libellé en capitales espacées,
 * icône dans une pastille et barre d'accent en tête. Même gabarit sur le
 * dashboard admin, la finance, les devis, les interventions et le reporting.
 */
export function StatCard({
  value,
  label,
  hint,
  icon: Icon,
  accent = "grey",
  className,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card accent={accent} className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-ink text-[24px] leading-none truncate">{value}</p>
          <SectionLabel className="mt-2 text-[9px]">{label}</SectionLabel>
          {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gold/10 text-gold-deep shrink-0">
            <Icon size={15} />
          </span>
        )}
      </div>
    </Card>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>{children}</div>;
}

/** Barre de progression fine, or par défaut. */
export function Meter({
  value,
  max = 1,
  tone = "gold",
  className,
}: {
  value: number;
  max?: number;
  tone?: Accent;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const colors: Record<Accent, string> = {
    gold: "var(--gold)", blue: "var(--blue)", green: "var(--green)", orange: "var(--orange)",
    violet: "var(--violet)", red: "var(--red)", grey: "var(--muted)",
  };
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-ink/[0.06] overflow-hidden", className)} aria-hidden>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${ratio * 100}%`, background: colors[tone] }} />
    </div>
  );
}
