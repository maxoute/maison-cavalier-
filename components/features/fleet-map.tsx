"use client";

import {
  LODGE,
  MAP_AVENUES,
  MAP_GRID,
  MAP_HEIGHT,
  MAP_LANDMARKS,
  MAP_RIVER,
  MAP_WIDTH,
} from "@/lib/drivers/mock-provider";
import type { Driver, MapPoint } from "@/lib/drivers";
import { driverStatusMeta } from "./driver-card";

/**
 * Fond de carte stylisé — aucune dépendance cartographique externe tant que
 * le compte Mapbox n'est pas ouvert (AGENTS.md). Le tracé est purement
 * vectoriel : il suit le `viewBox`, donc il reste net et lisible du mobile
 * au poste de loge.
 */

/** Îlots bâtis : trame déterministe, jamais aléatoire (rendu serveur = client). */
const BLOCKS: { x: number; y: number; w: number; h: number; tint: number }[] = (() => {
  const xs = [0, ...MAP_GRID.vertical, MAP_WIDTH];
  const ys = [0, ...MAP_GRID.horizontal, MAP_HEIGHT];
  const blocks: { x: number; y: number; w: number; h: number; tint: number }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x = xs[i] + 9;
      const y = ys[j] + 9;
      const w = xs[i + 1] - xs[i] - 18;
      const h = ys[j + 1] - ys[j] - 18;
      if (w <= 6 || h <= 6) continue;
      blocks.push({ x, y, w, h, tint: (i * 3 + j * 5) % 5 });
    }
  }
  return blocks;
})();

const ZOOM = 1.45;

function polyline(points: MapPoint[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

/** Pastille blanche derrière un libellé : largeur estimée, pas de mesure DOM. */
function LabelChip({
  label,
  y,
  emphasis,
}: {
  label: string;
  y: number;
  emphasis?: boolean;
}) {
  const width = label.length * 6.1 + 18;
  return (
    <g aria-hidden>
      <rect
        x={-width / 2}
        y={y - 11}
        width={width}
        height={17}
        rx={8.5}
        fill="var(--surface)"
        stroke={emphasis ? "var(--gold)" : "var(--line)"}
        strokeOpacity={emphasis ? 0.5 : 1}
      />
      <text
        x={0}
        y={y + 1.5}
        textAnchor="middle"
        fontSize={10.5}
        fill={emphasis ? "var(--gold-deep)" : "var(--ink)"}
        fontWeight={emphasis ? 600 : 500}
      >
        {label}
      </text>
    </g>
  );
}

export function FleetMap({
  drivers,
  selectedId,
  onSelect,
  follow,
  buildingName,
  avenueLabel,
}: {
  drivers: Driver[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  follow: boolean;
  buildingName: string;
  avenueLabel: string;
}) {
  const selected = drivers.find((driver) => driver.id === selectedId) ?? null;
  const followed = follow ? selected : null;
  // L'ordre des transformations CSS s'applique de droite à gauche : le point
  // suivi est d'abord mis à l'échelle, puis ramené au centre du cadre.
  const stage = followed
    ? `translate(${(MAP_WIDTH / 2 - followed.position.x * ZOOM).toFixed(1)}px, ${(
        MAP_HEIGHT / 2 - followed.position.y * ZOOM
      ).toFixed(1)}px) scale(${ZOOM})`
    : "none";

  // Hauteur fixe sur petit écran — la carte se recadre alors en largeur —
  // puis ratio exact du `viewBox` à partir de `lg` : au poste de loge, aucun
  // chauffeur ne sort du cadre, quelle que soit la largeur de la fenêtre.
  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      className="w-full block h-[300px] sm:h-[380px] lg:h-auto lg:aspect-[1000/470] lg:max-h-[540px]"
      preserveAspectRatio="xMidYMid slice"
      role="group"
      aria-label={`Carte de suivi des chauffeurs de ${buildingName}`}
    >
      <style>{`
        .mc-marker { transition: transform 1s linear; }
        .mc-arrow { transition: transform .7s cubic-bezier(.22,1,.36,1); }
        .mc-stage { transition: transform .9s cubic-bezier(.22,1,.36,1); }
        @keyframes mc-ping { 0% { transform: scale(.75); opacity: .5 } 70% { transform: scale(2.3); opacity: 0 } 100% { opacity: 0 } }
        .mc-ping { animation: mc-ping 2.4s cubic-bezier(0,0,.2,1) infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes mc-dash { to { stroke-dashoffset: -36 } }
        .mc-dash { animation: mc-dash 1.6s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mc-ping { animation: none; opacity: .22 }
          .mc-dash { animation: none }
        }
      `}</style>
      <defs>
        <linearGradient id="mc-seal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold-light)" />
          <stop offset="100%" stopColor="var(--gold)" />
        </linearGradient>
      </defs>

      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--surface-2)" />

      <g className="mc-stage" style={{ transform: stage }}>
        {/* Îlots bâtis */}
        {BLOCKS.map((block, index) => (
          <rect
            key={index}
            x={block.x}
            y={block.y}
            width={block.w}
            height={block.h}
            rx={3}
            fill="var(--ink)"
            opacity={block.tint === 0 ? 0.055 : block.tint === 1 ? 0.035 : 0.022}
          />
        ))}

        {/* Jardin de quartier */}
        <rect x={489} y={309} width={122} height={62} rx={6} fill="var(--green)" opacity={0.13} />
        <text x={550} y={344} textAnchor="middle" fontSize={10} fill="var(--green)" opacity={0.85}>
          Square Marigny
        </text>

        {/* Chaussées : liseré sombre puis asphalte clair */}
        {MAP_GRID.horizontal.map((y) => (
          <line key={`hb-${y}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="var(--ink)" strokeOpacity={0.07} strokeWidth={15} />
        ))}
        {MAP_GRID.vertical.map((x) => (
          <line key={`vb-${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} stroke="var(--ink)" strokeOpacity={0.07} strokeWidth={15} />
        ))}
        {MAP_GRID.horizontal.map((y) => (
          <line key={`h-${y}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="var(--surface)" strokeWidth={12} />
        ))}
        {MAP_GRID.vertical.map((x) => (
          <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} stroke="var(--surface)" strokeWidth={12} />
        ))}
        {MAP_AVENUES.map((avenue) =>
          avenue.orientation === "h" ? (
            <line key={avenue.label} x1={0} y1={avenue.at} x2={MAP_WIDTH} y2={avenue.at} stroke="var(--surface)" strokeWidth={22} />
          ) : (
            <line key={avenue.label} x1={avenue.at} y1={0} x2={avenue.at} y2={MAP_HEIGHT} stroke="var(--surface)" strokeWidth={22} />
          ),
        )}

        {/* La Seine */}
        <path d={MAP_RIVER} fill="var(--blue)" opacity={0.16} />
        <text x={640} y={452} fontSize={11} fill="var(--blue)" opacity={0.8} letterSpacing={1.5}>
          La Seine
        </text>

        {/* Noms de voies */}
        <text x={36} y={296} fontSize={11.5} fill="var(--muted)" letterSpacing={1.2}>
          {avenueLabel}
        </text>
        <text
          x={-372}
          y={612}
          transform="rotate(-90)"
          fontSize={11.5}
          fill="var(--muted)"
          letterSpacing={1.2}
        >
          {MAP_AVENUES[1].label}
        </text>

        {/* Points d'intérêt */}
        {MAP_LANDMARKS.map((landmark) => (
          <g key={landmark.label} transform={`translate(${landmark.x},${landmark.y})`} aria-hidden>
            <circle r={4.5} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.6} />
            <text x={0} y={-11} textAnchor="middle" fontSize={10} fill="var(--muted)">
              {landmark.label}
            </text>
          </g>
        ))}

        {/* Itinéraire restant du chauffeur suivi */}
        {selected?.route && selected.route.length > 1 && (
          <polyline
            className="mc-dash"
            points={polyline(selected.route)}
            fill="none"
            stroke="var(--gold)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 8"
            opacity={0.9}
          />
        )}

        {/* Immeuble — sceau doré, unique élément or de la carte */}
        <g transform={`translate(${LODGE.x},${LODGE.y})`} aria-hidden>
          <circle r={20} fill="var(--gold)" opacity={0.12} />
          <circle r={11} fill="url(#mc-seal)" stroke="var(--surface)" strokeWidth={2.5} />
          <path d="M -4 3 L 0 -5 L 4 3 Z" fill="var(--navy)" opacity={0.75} />
          <LabelChip label={buildingName} y={-26} emphasis />
        </g>

        {/* Chauffeurs */}
        {drivers.map((driver) => {
          const meta = driverStatusMeta[driver.status];
          const isSelected = driver.id === selectedId;
          const label = driver.trip
            ? `${driver.name}, ${meta.label.toLocaleLowerCase("fr-FR")}, ${driver.trip.destination}, arrivée dans ${driver.trip.etaMinutes} minutes`
            : `${driver.name}, ${meta.label.toLocaleLowerCase("fr-FR")}, ${driver.note ?? "sans course"}`;
          return (
            <g
              key={driver.id}
              className="mc-marker"
              style={{ transform: `translate(${driver.position.x.toFixed(1)}px, ${driver.position.y.toFixed(1)}px)`, cursor: "pointer" }}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              data-driver={driver.id}
              onClick={() => onSelect(driver.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(driver.id);
                }
              }}
            >
              {driver.status === "en_mouvement" && (
                <circle className="mc-ping" r={12} fill={meta.color} opacity={0.5} />
              )}
              {isSelected && (
                <circle r={19} fill="none" stroke="var(--gold)" strokeWidth={2} opacity={0.9} />
              )}
              <circle r={13} fill="var(--surface)" opacity={0.95} />
              <g className="mc-arrow" style={{ transform: `rotate(${driver.heading.toFixed(1)}deg)` }}>
                <path
                  d="M 0 -9.5 L 6.5 7 L 0 3.4 L -6.5 7 Z"
                  fill={meta.color}
                  stroke="var(--surface)"
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                />
              </g>
              <LabelChip label={driver.name.split(" ")[0]} y={-19} emphasis={isSelected} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
