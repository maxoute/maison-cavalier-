import { cookies } from "next/headers";
import { SwitchBuildingButton } from "@/components/features/switch-building-button";
import { Card, SectionLabel } from "@/components/ui/card";
import {
  IconAlert,
  IconBuilding,
  IconCoin,
  IconGrid,
  IconUsers,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { Building } from "@/types";

/**
 * Dashboard global — les KPIs temps réel complets (revenus, SLA, satisfaction)
 * arrivent au Sprint 6 avec les données des sprints 2-5.
 */
export default async function AdminDashboard() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeBuildingId = cookieStore.get("mc-building")?.value;

  const [{ data: buildings }, { data: requests }, { count: residentCount }] =
    await Promise.all([
      supabase.from("buildings").select("*").order("name"),
      supabase.from("service_requests").select("building_id, status, amount_cents"),
      supabase.from("residents").select("*", { count: "exact", head: true }),
    ]);

  const all = requests ?? [];
  const open = all.filter((r) => r.status !== "termine").length;
  const revenueTotal = all
    .filter((r) => r.status === "termine")
    .reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  const kpis: {
    v: string;
    l: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: "gold" | "green" | "blue" | "violet";
  }[] = [
    { v: String(open), l: "demandes en cours", icon: IconGrid, accent: "blue" },
    {
      v: `${(revenueTotal / 100).toLocaleString("fr-FR")} €`,
      l: "revenus (services terminés)",
      icon: IconCoin,
      accent: "gold",
    },
    { v: String(residentCount ?? 0), l: "résidents", icon: IconUsers, accent: "green" },
    {
      v: `${(buildings ?? []).length}`,
      l: "immeubles",
      icon: IconBuilding,
      accent: "violet",
    },
  ];

  const buildingRows = ((buildings ?? []) as Building[]).map((b) => {
    const bReqs = all.filter((r) => r.building_id === b.id);
    const bOpen = bReqs.filter((r) => r.status !== "termine").length;
    // Même définition que le KPI global (services terminés) : sinon la somme
    // des lignes ne retombe pas sur le chiffre affiché en haut de page.
    const bRev = bReqs
      .filter((r) => r.status === "termine")
      .reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    return { building: b, open: bOpen, revenue: bRev, total: bReqs.length };
  });

  const quietest = buildingRows.reduce(
    (min, r) => (r.total < min.total ? r : min),
    buildingRows[0],
  );
  const showAlert =
    buildingRows.length > 1 && quietest && quietest.total <= 8;

  return (
    <div className="space-y-7 fade-up">
      <div>
        <h1 className="text-2xl text-cream">Dashboard global</h1>
        <p className="text-[11px] text-grey mt-1">
          Vue consolidée sur {(buildings ?? []).length} immeuble
          {(buildings ?? []).length > 1 ? "s" : ""} · mise à jour en continu
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ v, l, icon: Icon, accent }) => (
          <Card key={l} accent={accent} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-serif text-cream text-2xl leading-none">{v}</p>
                <SectionLabel className="mt-2 text-[9px]">{l}</SectionLabel>
              </div>
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] text-gold-light shrink-0">
                <Icon size={15} />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {showAlert && (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-orange/30 bg-orange/[0.06] px-4 py-3">
          <IconAlert size={15} className="text-orange shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-cream/90 leading-relaxed">
            <span className="font-medium">{quietest.building.name}</span>{" "}
            affiche une activité plus faible que les autres immeubles (
            {quietest.total} demande{quietest.total > 1 ? "s" : ""} au total) —
            concierge à recontacter pour identifier un frein éventuel.
          </p>
        </div>
      )}

      <div>
        <SectionLabel className="mb-2.5">Comparaison multi-immeubles</SectionLabel>
        <div className="space-y-2">
          {buildingRows.map(({ building: b, open: bOpen, revenue: bRev }) => (
            <Card
              key={b.id}
              interactive
              className="p-3.5 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-[8px] bg-white/[0.04] text-gold-light shrink-0">
                  <IconBuilding size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-cream truncate">
                    {b.name}
                  </p>
                  <p className="text-[10px] text-grey mt-0.5 truncate">
                    Plan{" "}
                    <span className="text-gold-light capitalize">
                      {b.b2b_plan ?? "—"}
                    </span>{" "}
                    · {b.address}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <span className="text-[11px] text-grey">
                  <span className="text-cream font-medium">{bOpen}</span> en
                  cours
                </span>
                <span className="font-serif text-cream text-[14px]">
                  {(bRev / 100).toLocaleString("fr-FR")} €
                  <span className="text-grey text-[9px] font-sans">
                    {" "}
                    réalisés
                  </span>
                </span>
                <SwitchBuildingButton
                  buildingId={b.id}
                  active={
                    activeBuildingId
                      ? activeBuildingId === b.id
                      : buildingRows[0]?.building.id === b.id
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-grey">
        Onboarding d&apos;un immeuble en moins de 5 min · import CSV résidents ·
        rapports consolidés · console Stripe Connect — Sprint 6.
      </p>
    </div>
  );
}
