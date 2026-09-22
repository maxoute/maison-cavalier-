import Link from "next/link";
import { SwitchBuildingButton } from "@/components/features/switch-building-button";
import { Badge } from "@/components/ui/badge";
import { Card, SectionLabel } from "@/components/ui/card";
import { IconAlert, IconBuilding, IconCoin, IconGrid, IconUsers } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Meter, StatCard, StatGrid } from "@/components/ui/stat";
import { managerContext } from "@/lib/admin/server";
import { checkRead } from "@/lib/operations/server";
import { formatMoney, count } from "@/lib/format";
import { requestSla } from "@/lib/requests";
import type { Building } from "@/types";

const planTone: Record<string, "grey" | "blue" | "gold"> = { essentiel: "grey", premium: "blue", signature: "gold" };

/** Dashboard global (PRD §6.3.1) : KPIs consolidés et comparaison multi-immeubles. */
export default async function AdminDashboard() {
  const { db, session, buildingId, now } = await managerContext();

  const [buildingsResult, requestsResult, residentsResult, incidentsResult] = await Promise.all([
    db.from("buildings").select("*").order("name"),
    db.from("service_requests").select("building_id, status, priority, amount_cents, sla_deadline, completed_at, created_at"),
    db.from("residents").select("building_id, satisfaction_score"),
    db.from("intervention_incidents").select("building_id, resolved_at"),
  ]);
  checkRead(buildingsResult.error); checkRead(requestsResult.error); checkRead(residentsResult.error);

  const buildings = (buildingsResult.data ?? []) as Building[];
  const all = requestsResult.data ?? [];
  const residents = residentsResult.data ?? [];
  const incidents = incidentsResult.data ?? [];

  const open = all.filter((r) => r.status !== "termine");
  const late = open.filter((r) => requestSla(r.sla_deadline, r.status as "nouveau", now)?.late).length;
  const completed = all.filter((r) => r.status === "termine");
  const revenueTotal = completed.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const withDeadline = completed.filter((r) => r.sla_deadline && r.completed_at);
  const slaRespected = withDeadline.filter((r) => Date.parse(r.completed_at!) <= Date.parse(r.sla_deadline!)).length;
  const slaRate = withDeadline.length ? slaRespected / withDeadline.length : null;
  const scores = residents.map((r) => Number(r.satisfaction_score)).filter((v) => Number.isFinite(v) && v > 0);
  const satisfaction = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const openIncidents = incidents.filter((i) => !i.resolved_at).length;

  const rows = buildings.map((b) => {
    const bReqs = all.filter((r) => r.building_id === b.id);
    const bOpen = bReqs.filter((r) => r.status !== "termine");
    const bLate = bOpen.filter((r) => requestSla(r.sla_deadline, r.status as "nouveau", now)?.late).length;
    // Même définition que le KPI global (services terminés) : sinon la somme
    // des lignes ne retombe pas sur le chiffre affiché en haut de page.
    const bRev = bReqs.filter((r) => r.status === "termine").reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    const bScores = residents.filter((r) => r.building_id === b.id).map((r) => Number(r.satisfaction_score)).filter((v) => v > 0);
    return {
      building: b, open: bOpen.length, late: bLate, revenue: bRev, total: bReqs.length,
      residents: residents.filter((r) => r.building_id === b.id).length,
      satisfaction: bScores.length ? bScores.reduce((a, c) => a + c, 0) / bScores.length : null,
      incidents: incidents.filter((i) => i.building_id === b.id && !i.resolved_at).length,
    };
  });
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  const quietest = rows.length > 1 ? rows.reduce((min, r) => (r.total < min.total ? r : min), rows[0]) : null;
  const median = rows.length > 1 ? [...rows].sort((a, b) => a.total - b.total)[Math.floor(rows.length / 2)].total : 0;
  const showAlert = quietest && quietest.total < median / 2;

  return (
    <div className="space-y-7 fade-up">
      <PageHeader
        title="Tableau de bord"
        subtitle={`Vue consolidée sur ${count(buildings.length, "immeuble")} · ${count(residents.length, "résident")} · mise à jour en continu`}
        actions={session.role === "super_admin" ? <Link href="/admin/immeubles"><span className="text-[11.5px] text-gold-deep hover:text-ink underline underline-offset-4">Onboarder un immeuble →</span></Link> : undefined}
      />

      <StatGrid>
        <StatCard value={open.length} label="demandes en cours" icon={IconGrid} accent="blue" hint={late ? `${count(late, "demande")} hors SLA` : "aucune demande hors SLA"} />
        <StatCard value={formatMoney(revenueTotal, { round: true })} label="revenus des services terminés" icon={IconCoin} accent="gold" hint={`${count(completed.length, "prestation réalisée", "prestations réalisées")}`} />
        <StatCard value={slaRate === null ? "—" : `${Math.round(slaRate * 100)} %`} label="SLA respecté" accent={slaRate !== null && slaRate < 0.97 ? "orange" : "green"} hint="objectif ≥ 97 %" />
        <StatCard value={satisfaction === null ? "—" : `${satisfaction.toFixed(2)} / 5`} label="satisfaction résidents" icon={IconUsers} accent="violet" hint={openIncidents ? `${count(openIncidents, "incident ouvert", "incidents ouverts")}` : "aucun incident ouvert"} />
      </StatGrid>

      {showAlert && quietest && (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-orange/30 bg-orange/[0.06] px-4 py-3">
          <IconAlert size={15} className="text-orange shrink-0 mt-0.5" />
          <p className="text-[12px] text-ink/90 leading-relaxed">
            <span className="font-medium">{quietest.building.name}</span> affiche une activité nettement plus faible que les autres immeubles ({count(quietest.total, "demande")} au total) — concierge à recontacter pour identifier un frein éventuel.
          </p>
        </div>
      )}

      <div>
        <SectionLabel className="mb-2.5">Comparaison multi-immeubles</SectionLabel>
        <div className="space-y-2">
          {rows.map(({ building: b, open: bOpen, late: bLate, revenue: bRev, residents: bRes, satisfaction: bSat, incidents: bInc }) => {
            const active = buildingId === b.id;
            return (
              <Card key={b.id} interactive className={`p-3.5 ${active ? "border-gold/40" : ""}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex items-center justify-center w-9 h-9 rounded-[8px] shrink-0 ${active ? "bg-gold/10 text-gold-deep" : "bg-ink/[0.04] text-muted"}`}>
                      <IconBuilding size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate flex items-center gap-2">
                        {b.name}
                        {b.b2b_plan && <Badge tone={planTone[b.b2b_plan] ?? "grey"}>{b.b2b_plan}</Badge>}
                      </p>
                      <p className="text-[10.5px] text-muted mt-0.5 truncate">{b.address} · {count(bRes, "résident")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 text-[11px] text-muted">
                    <span><span className="text-ink font-medium">{bOpen}</span> en cours{bLate ? <span className="text-red"> · {bLate} hors SLA</span> : ""}</span>
                    <span className="hidden sm:inline"><span className="text-ink font-medium">{bSat === null ? "—" : bSat.toFixed(1)}</span> / 5</span>
                    {bInc > 0 && <Badge tone="red">{bInc} incident{bInc > 1 ? "s" : ""}</Badge>}
                    <span className="font-serif text-ink text-[14px]">{formatMoney(bRev, { round: true })}</span>
                    <SwitchBuildingButton buildingId={b.id} active={active} />
                  </div>
                </div>
                <Meter value={bRev} max={maxRevenue} tone={active ? "gold" : "grey"} className="mt-3" />
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
