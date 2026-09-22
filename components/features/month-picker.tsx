import Link from "next/link";
import { IconChevronDown } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { currentMonth, monthStartIso, shiftMonth, type MonthKey } from "@/lib/finance";
import { formatMonth } from "@/lib/format";

/**
 * Navigation de période : mois précédent / suivant en simples liens, pour
 * que la page reste un Server Component et que chaque mois soit partageable
 * par son URL (`?mois=2026-08`). Le futur n'est pas navigable.
 */
export function MonthPicker({
  month,
  basePath,
  className,
}: {
  month: MonthKey;
  /** Chemin de la page, sans paramètres : « /admin/finance ». */
  basePath: string;
  className?: string;
}) {
  const current = currentMonth();
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const hasNext = next <= current;
  const isCurrent = month === current;
  const step = "flex items-center justify-center w-8 h-8 text-muted transition-colors duration-300";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="inline-flex items-center rounded-[24px] border border-line bg-surface overflow-hidden">
        <Link
          href={`${basePath}?mois=${previous}`}
          aria-label={`Mois précédent : ${formatMonth(monthStartIso(previous))}`}
          className={cn(step, "hover:text-ink hover:bg-surface-2")}
        >
          <IconChevronDown size={14} className="rotate-90" />
        </Link>
        <span className="px-2 text-[12px] text-ink capitalize whitespace-nowrap min-w-[112px] text-center">
          {formatMonth(monthStartIso(month))}
        </span>
        {hasNext ? (
          <Link
            href={`${basePath}?mois=${next}`}
            aria-label={`Mois suivant : ${formatMonth(monthStartIso(next))}`}
            className={cn(step, "hover:text-ink hover:bg-surface-2")}
          >
            <IconChevronDown size={14} className="-rotate-90" />
          </Link>
        ) : (
          <span aria-hidden className={cn(step, "opacity-30")}>
            <IconChevronDown size={14} className="-rotate-90" />
          </span>
        )}
      </div>
      {!isCurrent && (
        <Link
          href={basePath}
          className="text-[11px] text-gold-deep hover:text-ink transition-colors duration-300 whitespace-nowrap"
        >
          Mois en cours
        </Link>
      )}
    </div>
  );
}
