import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconSearch, IconUpload } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { Resident } from "@/types";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etage?: string; statut?: string }>;
}) {
  const { q, etage, statut } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("residents").select("*").order("full_name");
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (etage) query = query.eq("floor", etage);
  if (statut === "proprietaire" || statut === "locataire")
    query = query.eq("owner_status", statut);

  const { data } = await query;
  const residents = (data ?? []) as Resident[];

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl text-cream">Résidents</h1>
          <p className="text-[11px] text-grey mt-1">{residents.length} fiches</p>
        </div>
        <div className="flex gap-2">
          <Link href="/concierge/residents/import">
            <Button variant="outline">
              <IconUpload size={13} /> Import CSV
            </Button>
          </Link>
          <Link href="/concierge/residents/nouveau">
            <Button variant="gold">Nouveau résident</Button>
          </Link>
        </div>
      </div>

      <form className="flex gap-3" method="get">
        <div className="relative max-w-xs w-full">
          <IconSearch
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-grey pointer-events-none"
          />
          <Input
            name="q"
            placeholder="Rechercher un nom…"
            defaultValue={q ?? ""}
            className="pl-8"
          />
        </div>
        <Input
          name="etage"
          placeholder="Étage"
          defaultValue={etage ?? ""}
          className="max-w-24"
        />
        <Select name="statut" defaultValue={statut ?? ""} className="max-w-44">
          <option value="">Tous statuts</option>
          <option value="proprietaire">Propriétaire</option>
          <option value="locataire">Locataire</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
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
                <Link
                  href={`/concierge/residents/${r.id}`}
                  className="flex items-center gap-2.5 font-medium group"
                >
                  <Avatar name={r.full_name} size={26} />
                  <span className="group-hover:text-gold-light transition-colors duration-300">
                    {r.full_name}
                  </span>
                </Link>
              </TD>
              <TD>
                {r.floor ?? "—"} · {r.unit ?? "—"}
              </TD>
              <TD>
                <Badge tone={r.owner_status === "proprietaire" ? "gold" : "blue"}>
                  {r.owner_status === "proprietaire"
                    ? "Propriétaire"
                    : "Locataire"}
                </Badge>
              </TD>
              <TD>{r.phone ?? "—"}</TD>
              <TD>
                {r.satisfaction_score != null
                  ? `${Number(r.satisfaction_score).toFixed(2)} / 5`
                  : "—"}
              </TD>
            </TR>
          ))}
          {residents.length === 0 && (
            <TR>
              <TD colSpan={5} className="text-grey">
                Aucun résident trouvé.
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
    </div>
  );
}
