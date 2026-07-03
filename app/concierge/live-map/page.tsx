import { Card, SectionLabel } from "@/components/ui/card";
import { IconAlert } from "@/components/ui/icons";

const drivers = [
  { name: "Karim", vehicle: "Van", status: "En course → CDG", tone: "#3FA776" },
  { name: "Sofiane", vehicle: "Berline", status: "En attente — loge", tone: "#D98E3B" },
  { name: "David", vehicle: "SUV", status: "Hors ligne", tone: "#8A93A6" },
];

/**
 * Live Map — aperçu de démonstration statique. L'intégration Mapbox et le
 * flux GPS temps réel (latence cible < 1s, PRD §6.1.2) arrivent au Sprint 3 ;
 * cet écran fige déjà la mise en page et le comportement attendus.
 */
export default function LiveMapPage() {
  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl text-cream">Live Map</h1>
        <p className="text-[11px] text-grey mt-1">
          Aperçu de démonstration — flux GPS temps réel au Sprint 3
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="relative h-[300px] bg-[#0d1b30]">
          <svg
            viewBox="0 0 640 300"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {[40, 100, 160, 220, 270].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="640"
                y2={y}
                stroke="#1B2D4D"
                strokeWidth={y === 160 ? 6 : 2.5}
              />
            ))}
            {[80, 200, 340, 480, 580].map((x) => (
              <line
                key={x}
                x1={x}
                y1="0"
                x2={x}
                y2="300"
                stroke="#1B2D4D"
                strokeWidth={x === 340 ? 6 : 2.5}
              />
            ))}
            <text x="350" y="152" fill="#3A4E73" fontSize="11">
              Av. Victor Hugo
            </text>
            <text x="90" y="92" fill="#3A4E73" fontSize="11">
              Rue de Passy
            </text>
            <path
              d="M 580 40 L 480 40 L 480 160 L 340 160 L 340 220 L 200 220"
              stroke="var(--gold)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              fill="none"
              opacity=".85"
            />
            <g transform="translate(200,220)">
              <circle r="12" fill="var(--gold)" opacity=".18" />
              <circle r="5" fill="var(--gold)" />
            </g>
            <g transform="translate(480,40)">
              <circle r="10" fill="var(--gold-light)" opacity=".3" />
              <circle r="6" fill="var(--navy)" stroke="var(--gold-light)" strokeWidth="2.5" />
            </g>
          </svg>
          <div className="absolute top-3 right-3 bg-navy/90 border border-gold/25 rounded-[8px] px-3 py-2 text-[11px] text-cream backdrop-blur-sm">
            ETA <span className="text-gold-light font-medium">6 min</span>
          </div>
          <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-[1px] text-grey flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
            Mode suivi — MAJ toutes les 30 s
          </div>
        </div>
      </Card>

      <div>
        <SectionLabel className="mb-2.5">Chauffeurs de l&apos;immeuble</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {drivers.map((d) => (
            <Card key={d.name} className="p-3.5">
              <p className="text-[12px] text-cream font-medium flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: d.tone }}
                />
                {d.name} · {d.vehicle}
              </p>
              <p className="text-[10px] text-grey mt-1.5">{d.status}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-[8px] border border-navy-3 bg-white/[0.02] px-4 py-3">
        <IconAlert size={14} className="text-grey shrink-0 mt-0.5" />
        <p className="text-[11px] text-grey leading-relaxed">
          Plan B : si aucun chauffeur ne répond sous 3 min → alerte concierge +
          suggestion de taxi externe (PRD §6.1.3).
        </p>
      </div>
    </div>
  );
}
