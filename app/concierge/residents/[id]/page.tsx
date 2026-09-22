import Link from "next/link";
import { notFound } from "next/navigation";
import { updateResident } from "@/app/actions/residents";
import { DeleteResidentButton } from "@/components/features/delete-resident-button";
import { ResidentForm } from "@/components/features/resident-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ServiceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconPhone } from "@/components/ui/icons";
import { StatCard, StatGrid } from "@/components/ui/stat";
import { formatDateTime, formatMoney, count } from "@/lib/format";
import { requestLabels } from "@/lib/requests";
import { staffContext } from "@/lib/operations/server";
import type { Resident, ServiceRequest, ServiceType } from "@/types";

const contactTemplate = encodeURIComponent("Bonjour, ici votre conciergerie Maison Cavalier. ");

const statusTone: Record<string, "blue" | "orange" | "green" | "grey"> = {
  nouveau: "blue", en_cours: "orange", en_attente: "grey", termine: "green",
};

export default async function ResidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, session } = await staffContext();

  const [{ data: resident }, { data: requests }] = await Promise.all([
    db.from("residents").select("*").eq("id", id).eq("building_id", session.buildingId).maybeSingle(),
    db.from("service_requests").select("*").eq("resident_id", id).eq("building_id", session.buildingId).order("created_at", { ascending: false }),
  ]);

  if (!resident) notFound();
  const r = resident as Resident;
  const history = (requests ?? []) as ServiceRequest[];
  const totalCents = history.reduce((s, h) => s + (h.amount_cents ?? 0), 0);
  const open = history.filter((h) => h.status !== "termine").length;

  // Insight automatique (PRD §6.1.5) : service le plus utilisé.
  const usage = new Map<ServiceType, number>();
  for (const h of history) usage.set(h.service, (usage.get(h.service) ?? 0) + 1);
  const favourite = [...usage.entries()].sort((a, b) => b[1] - a[1])[0];
  const favouriteLabel: Record<ServiceType, string> = {
    chauffeur: "le service chauffeur", pressing: "le pressing", colis: "la réception de colis",
    billetterie: "la billetterie", personal_shopper: "le personal shopper",
  };

  const updateAction = updateResident.bind(null, r.id);

  return (
    <div className="space-y-7 fade-up">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={r.full_name} size={52} />
          <div>
            <Link href="/concierge/residents" className="text-[11px] text-muted hover:text-ink transition-colors duration-300">← Résidents</Link>
            <h1 className="text-[26px] leading-tight text-ink mt-0.5">{r.full_name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge tone={r.owner_status === "proprietaire" ? "gold" : "blue"}>
                {r.owner_status === "proprietaire" ? "Propriétaire" : "Locataire"}
              </Badge>
              <span className="text-[11px] text-muted">Étage {r.floor ?? "—"} · Lot {r.unit ?? "—"}</span>
              {r.email && <span className="text-[11px] text-muted">· {r.email}</span>}
            </div>
          </div>
        </div>
        {/* Contact direct depuis la fiche (PRD §6.1.5) */}
        <div className="flex flex-wrap gap-2">
          {r.phone && (
            <>
              <a href={`tel:${r.phone}`}><Button variant="outline" size="sm"><IconPhone size={12} /> Appeler</Button></a>
              <a href={`sms:${r.phone}?body=${contactTemplate}`}><Button variant="outline" size="sm">SMS</Button></a>
              <a href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}?text=${contactTemplate}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">WhatsApp</Button>
              </a>
            </>
          )}
          {r.email && (
            <a href={`mailto:${r.email}?subject=${encodeURIComponent("Votre conciergerie Maison Cavalier")}&body=${contactTemplate}`}>
              <Button variant="outline" size="sm">Email</Button>
            </a>
          )}
        </div>
      </div>

      <StatGrid>
        <StatCard value={history.length} label="services utilisés" accent="blue" />
        <StatCard value={open} label="en cours" accent="orange" />
        <StatCard value={formatMoney(totalCents, { round: true })} label="montant total" accent="gold" />
        <StatCard value={r.satisfaction_score != null ? `${Number(r.satisfaction_score).toFixed(1)} / 5` : "—"} label="satisfaction" accent="green" />
      </StatGrid>

      {favourite && favourite[1] >= 2 && (
        <p className="text-[12px] text-ink/80 rounded-[8px] border border-gold/25 bg-gold/[0.05] px-4 py-2.5">
          <span className="font-medium text-gold-deep">Insight ·</span> {r.full_name.split(" ")[0]} utilise surtout {favouriteLabel[favourite[0]]} ({count(favourite[1], "demande")}).
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>Historique des services</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-line/60">
              {history.slice(0, 12).map((h) => (
                <li key={h.id} className="py-2.5 flex items-center gap-3 text-[12.5px]">
                  <ServiceBadge service={h.service} />
                  <span className="flex-1 min-w-0 truncate text-ink/80">{(() => { const d = h.payload.description ?? Object.values(h.payload)[0]; return typeof d === "string" ? d : "—"; })()}</span>
                  <Badge tone={statusTone[h.status]}>{requestLabels[h.status]}</Badge>
                  <span className="text-muted text-[11px] w-24 text-right">{formatDateTime(h.created_at)}</span>
                  <span className="w-16 text-right">{h.amount_cents != null ? formatMoney(h.amount_cents, { round: true }) : "—"}</span>
                </li>
              ))}
              {history.length === 0 && <li className="py-2.5 text-[12.5px] text-muted">Aucun service pour le moment.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fiche</CardTitle></CardHeader>
          <CardContent className="text-[12.5px] space-y-3">
            <div><p className="text-[10px] uppercase tracking-[1px] text-muted">Préférences</p><p className="mt-0.5">{r.preferences ?? "—"}</p></div>
            <div><p className="text-[10px] uppercase tracking-[1px] text-muted">Accès particuliers</p><p className="mt-0.5">{r.special_access ?? "—"}</p></div>
            <div><p className="text-[10px] uppercase tracking-[1px] text-muted">Notes internes</p><p className="mt-0.5 whitespace-pre-wrap">{r.internal_notes ?? "—"}</p></div>
            <div><p className="text-[10px] uppercase tracking-[1px] text-muted">Fiche créée</p><p className="mt-0.5">{formatDateTime(r.created_at)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modifier la fiche</CardTitle>
          <DeleteResidentButton id={r.id} name={r.full_name} />
        </CardHeader>
        <CardContent>
          <ResidentForm action={updateAction} resident={r} submitLabel="Enregistrer" />
        </CardContent>
      </Card>
    </div>
  );
}
