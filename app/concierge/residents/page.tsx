import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCheck, IconSearch, IconUpload } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { staffContext, checkRead } from "@/lib/operations/server";
import { count } from "@/lib/format";
import type { Resident } from "@/types";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etage?: string; statut?: string; import?: string }>;
}) {
  const { q, etage, statut, import: imported } = await searchParams;
  const { db, session } = await staffContext();

  let query = db.from("residents").select("*").eq("building_id", session.buildingId).order("full_name");
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (etage) query = query.eq("floor", etage);
  if (statut === "proprietaire" || statut === "locataire") query = query.eq("owner_status", statut);

  const { data, error } = await query;
  checkRead(error);
  const residents = (data ?? []) as Resident[];
  const filtered = Boolean(q || etage || statut);

  return (
    <div className="space-y-6 fade-up">
      <PageHeader
        title="Résidents"
        subtitle={`${count(residents.length, "fiche")}${filtered ? " correspondant aux filtres" : ""} · préférences, accès et historique de services`}
        actions={
          <>
            <Link href="/concierge/residents/import">
              <Button variant="outline" size="sm"><IconUpload size={13} /> Import CSV</Button>
            </Link>
            <Link href="/concierge/residents/nouveau">
              <Button variant="gold" size="sm">Nouveau résident</Button>
            </Link>
          </>
        }
      />

      {imported && Number(imported) > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-[8px] border border-green/30 bg-green/[0.06] px-4 py-2.5 text-[12px] text-ink">
          <IconCheck size={14} className="text-green" /> {count(Number(imported), "fiche importée", "fiches importées")}.
        </p>
      )}

      <form className="flex flex-wrap gap-2.5" method="get">
        <div className="relative max-w-xs w-full">
          <IconSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input name="q" placeholder="Rechercher un nom…" defaultValue={q ?? ""} className="pl-8 text-[13px]" />
        </div>
        <Input name="etage" placeholder="Étage" defaultValue={etage ?? ""} className="max-w-24 text-[13px]" />
        <Select name="statut" defaultValue={statut ?? ""} className="max-w-44 text-[13px]">
          <option value="">Tous statuts</option>
          <option value="proprietaire">Propriétaire</option>
          <option value="locataire">Locataire</option>
        </Select>
        <Button type="submit" variant="outline">Filtrer</Button>
        {filtered && (
          <Link href="/concierge/residents" className="self-center text-[11.5px] text-muted hover:text-ink underline underline-offset-4">Réinitialiser</Link>
        )}
      </form>

      <Table>
        <THead>
          <TR>
            <TH>Nom</TH>
            <TH>Étage · Lot</TH>
            <TH>Statut</TH>
            <TH>Téléphone</TH>
            <TH>Satisfaction</TH>
          </TR>
        </THead>
        <TBody>
          {residents.map((r) => (
            <TR key={r.id}>
              <TD>
                <Link href={`/concierge/residents/${r.id}`} className="flex items-center gap-2.5 font-medium group">
                  <Avatar name={r.full_name} size={26} />
                  <span className="group-hover:text-gold-deep transition-colors duration-300">{r.full_name}</span>
                </Link>
              </TD>
              <TD>{r.floor ?? "—"} · {r.unit ?? "—"}</TD>
              <TD>
                <Badge tone={r.owner_status === "proprietaire" ? "gold" : "blue"}>
                  {r.owner_status === "proprietaire" ? "Propriétaire" : "Locataire"}
                </Badge>
              </TD>
              <TD>{r.phone ?? "—"}</TD>
              <TD>{r.satisfaction_score != null ? `${Number(r.satisfaction_score).toFixed(2)} / 5` : "—"}</TD>
            </TR>
          ))}
          {residents.length === 0 && (
            <TR>
              <TD colSpan={5} className="text-muted text-center py-8">Aucun résident trouvé.</TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
