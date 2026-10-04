import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Accent = "gold" | "blue" | "green" | "orange" | "violet" | "red" | "grey";

/** Indicateurs sobres ; les couleurs signalent uniquement les points à surveiller. */
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
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-ink text-[30px] leading-tight tabular-nums break-words">{value}</p>
          <p className="mt-2 text-sm text-ink/80">{label}</p>
          {hint && <p className={cn("mt-2 text-xs leading-relaxed", accent === "red" ? "text-red" : accent === "orange" ? "text-orange" : "text-muted")}>{hint}</p>}
        </div>
        {Icon && (
          <span className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-ink/[0.04] text-muted shrink-0">
            <Icon size={15} />
          </span>
        )}
      </div>
    </Card>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 min-[400px]:grid-cols-2 xl:grid-cols-4 gap-4", className)}>{children}</div>;
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
