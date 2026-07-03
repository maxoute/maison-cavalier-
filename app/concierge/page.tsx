import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { SectionLabel } from "@/components/ui/card";
import { ServiceBadge, serviceColors } from "@/components/ui/badge";
import { IconAlert, IconClock, IconGrid } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus, ServiceRequest } from "@/types";

type Req = ServiceRequest & { residents: { id: string; full_name: string } | null };

const columns: { status: RequestStatus; label: string }[] = [
  { status: "nouveau", label: "Nouveau" },
  { status: "en_cours", label: "En cours" },
  { status: "en_attente", label: "En attente" },
  { status: "termine", label: "Terminé" },
];

function slaLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const diffMin = Math.round(
    (new Date(deadline).getTime() - Date.now()) / 60000,
  );
  if (diffMin < 0) return `SLA dépassé de ${-diffMin} min`;
  if (diffMin < 60) return `SLA ${diffMin} min`;
  return null;
}

const statChips: {
  key: "urgent" | "open" | "late";
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
}[] = [
  { key: "urgent", label: "urgente", icon: IconAlert, tone: "text-red" },
  { key: "open", label: "à traiter", icon: IconGrid, tone: "text-gold-light" },
  { key: "late", label: "en retard SLA", icon: IconClock, tone: "text-orange" },
];

/**
 * Tableau de bord opérationnel Kanban (PRD §6.1.1, maquette client).
 * Sprint 2 : passage en temps réel (Supabase Realtime) + drag & drop.
 */
export default async function ConciergeDashboard() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_requests")
    .select("*, residents(id, full_name)")
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as Req[];
  const counts = {
    urgent: requests.filter((r) => r.priority === "urgente" && r.status !== "termine").length,
    late: requests.filter(
      (r) => r.sla_deadline && new Date(r.sla_deadline) < new Date() && r.status !== "termine",
    ).length,
    open: requests.filter((r) => r.status !== "termine").length,
  };

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl text-cream">Demandes</h1>
        <div className="flex flex-wrap gap-4">
          {statChips.map(({ key, label, icon: Icon, tone }) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-grey">
              <Icon size={12} className={tone} />
              <span className={`font-semibold text-[13px] ${tone}`}>{counts[key]}</span>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-[820px]">
          {columns.map((col) => {
            const cards = requests.filter((r) => r.status === col.status);
            return (
              <div key={col.status} className="flex-1 min-w-[190px]">
                <SectionLabel className="mb-2">
                  {col.label} · {cards.length}
                </SectionLabel>
                <div className="space-y-2">
                  {cards.map((r) => {
                    const urgentCard = r.priority === "urgente" && r.status !== "termine";
                    const sla = urgentCard ? slaLabel(r.sla_deadline) : null;
                    const card = (
                      <div
                        className={`group bg-[linear-gradient(160deg,var(--navy-3),var(--navy-2)_45%)] border rounded-[8px] p-3 border-l-[3px] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] ${
                          urgentCard ? "border-red/45" : "border-navy-3"
                        }`}
                        style={{ borderLeftColor: serviceColors[r.service] }}
                      >
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <ServiceBadge service={r.service} />
                          {sla && (
                            <span className="inline-flex items-center gap-1 text-red text-[9px] font-semibold shrink-0">
                              <IconClock size={9} /> {sla}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar name={r.residents?.full_name ?? "?"} size={22} />
                          <p className="text-[11px] text-cream leading-snug truncate group-hover:text-gold-light transition-colors duration-300">
                            {r.residents?.full_name ?? "—"}
                          </p>
                        </div>
                        {typeof r.payload === "object" &&
                          r.payload !== null &&
                          Object.values(r.payload)[0] != null && (
                            <p className="text-[10px] text-grey mt-1.5 truncate">
                              {String(Object.values(r.payload)[0])}
                            </p>
                          )}
                        {r.amount_cents != null && (
                          <p className="text-[10px] text-gold-light/90 mt-1 font-medium">
                            {(r.amount_cents / 100).toLocaleString("fr-FR")} €
                          </p>
                        )}
                      </div>
                    );
                    return r.residents?.id ? (
                      <Link
                        key={r.id}
                        href={`/concierge/residents/${r.residents.id}`}
                        className="block"
                      >
                        {card}
                      </Link>
                    ) : (
                      <div key={r.id}>{card}</div>
                    );
                  })}
                  {cards.length === 0 && (
                    <p className="text-[10px] text-grey/60 italic">Aucune demande</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-grey/60">
        Temps réel, drag &amp; drop et filtres arrivent au Sprint 2.
      </p>
    </div>
  );
}
