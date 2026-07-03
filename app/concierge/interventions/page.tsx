import { Avatar } from "@/components/ui/avatar";
import { ServiceBadge, serviceColors } from "@/components/ui/badge";
import { CloseInterventionButton } from "@/components/features/close-intervention-button";
import { SectionLabel } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus, ServiceRequest } from "@/types";

type Req = ServiceRequest & { residents: { full_name: string } | null };

const columns: { status: RequestStatus; label: string }[] = [
  { status: "nouveau", label: "Assignée" },
  { status: "en_cours", label: "En déplacement / en cours" },
  { status: "en_attente", label: "En attente" },
  { status: "termine", label: "Clôturée" },
];

/**
 * Kanban des interventions actives, tous services confondus (PRD §6.1.7).
 * Réutilise service_requests — Sprint 4 y ajoutera prestataire assigné,
 * ETA et escalade incident dédiés.
 */
export default async function InterventionsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_requests")
    .select("*, residents(full_name)")
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as Req[];
  const closedToday = requests.filter((r) => r.status === "termine").length;
  const active = requests.filter((r) => r.status !== "termine").length;

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl text-cream">Interventions</h1>
        <p className="text-[11px] text-grey mt-1">
          <span className="text-cream font-medium">{active}</span> actives ·{" "}
          <span className="text-green font-medium">{closedToday}</span> clôturées
        </p>
      </div>

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
                  {cards.map((r) => (
                    <div
                      key={r.id}
                      className="bg-[linear-gradient(160deg,var(--navy-3),var(--navy-2)_45%)] border border-navy-3 rounded-[8px] p-3 border-l-[3px]"
                      style={{ borderLeftColor: serviceColors[r.service] }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={r.residents?.full_name ?? "?"} size={22} />
                        <span className="text-[11px] text-cream truncate flex-1">
                          {r.residents?.full_name ?? "—"}
                        </span>
                        <ServiceBadge service={r.service} />
                      </div>
                      {r.status === "en_cours" && (
                        <CloseInterventionButton id={r.id} />
                      )}
                      {r.status === "termine" && (
                        <p className="text-[9.5px] text-green">
                          Validé · réalisation confirmée
                        </p>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <p className="text-[10px] text-grey/60 italic">Aucune intervention</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-grey">
        Signalement d&apos;incident et escalade automatique — Sprint 4.
      </p>
    </div>
  );
}
