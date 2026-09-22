import { cn } from "@/lib/cn";

/**
 * Histogramme minimal, rendu côté serveur : aucune librairie, aucun état,
 * uniquement des div et les couleurs du thème. Chaque colonne porte sa
 * description complète pour les lecteurs d'écran et au survol.
 */
export interface BarSeries {
  key: string;
  label: string;
  /** Couleur CSS — `var(--gold)`, `var(--blue)`, `serviceColors[...]`. */
  color: string;
}

export interface BarDatum {
  key: string;
  /** Libellé court sous la colonne. */
  label: string;
  values: Record<string, number>;
  /** Couleur propre à la colonne — code couleur par service, par exemple. */
  color?: string;
  /** Mise en avant : colonne de la période consultée. */
  highlight?: boolean;
}

export function BarChart({
  data,
  series,
  format,
  height = 132,
  className,
  emptyLabel = "Aucune activité sur la période.",
}: {
  data: BarDatum[];
  series: BarSeries[];
  /** Mise en forme des valeurs (montants, effectifs…). */
  format: (value: number) => string;
  height?: number;
  className?: string;
  emptyLabel?: string;
}) {
  const max = data.reduce(
    (peak, datum) => series.reduce((inner, s) => Math.max(inner, datum.values[s.key] ?? 0), peak),
    0,
  );

  return (
    <figure className={cn("m-0", className)}>
      {max === 0 ? (
        <p className="text-[11.5px] text-muted py-6 text-center">{emptyLabel}</p>
      ) : (
        <div className="relative">
          {/* Ligne de base commune à toutes les colonnes, au pied des barres. */}
          <span
            aria-hidden
            className="absolute inset-x-0 border-b border-line"
            style={{ top: height }}
          />
          <ul className="flex items-end gap-1.5 sm:gap-2.5" style={{ minHeight: height }}>
          {data.map((datum) => {
            const description = `${datum.label} — ${series
              .map((s) => `${s.label} : ${format(datum.values[s.key] ?? 0)}`)
              .join(", ")}`;
            return (
              <li key={datum.key} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                <div
                  className="flex w-full items-end justify-center gap-[3px]"
                  style={{ height }}
                  title={description}
                >
                  {series.map((s) => {
                    const value = datum.values[s.key] ?? 0;
                    const ratio = max > 0 ? value / max : 0;
                    return (
                      <span
                        key={s.key}
                        aria-hidden
                        className="w-full max-w-[16px] rounded-t-[3px] transition-[height] duration-500"
                        style={{
                          // Un filet reste visible à zéro : la colonne garde sa place.
                          height: `${Math.max(ratio * 100, 1.5)}%`,
                          background: datum.color ?? s.color,
                          opacity: value === 0 ? 0.22 : datum.highlight ? 1 : 0.82,
                        }}
                      />
                    );
                  })}
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none text-center truncate w-full",
                    datum.highlight ? "text-ink font-medium" : "text-muted",
                  )}
                >
                  {datum.label}
                </span>
                <span className="sr-only">{description}</span>
              </li>
            );
          })}
          </ul>
        </div>
      )}
      {series.length > 1 && (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
              <span
                aria-hidden
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
