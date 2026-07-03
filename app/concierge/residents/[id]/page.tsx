import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteResident, updateResident } from "@/app/actions/residents";
import { ResidentForm } from "@/components/features/resident-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ServiceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Resident, ServiceRequest } from "@/types";

const contactTemplate = encodeURIComponent(
  "Bonjour, ici votre conciergerie Maison Cavalier. ",
);

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: resident }, { data: requests }] = await Promise.all([
    supabase.from("residents").select("*").eq("id", id).single(),
    supabase
      .from("service_requests")
      .select("*")
      .eq("resident_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!resident) notFound();
  const r = resident as Resident;
  const history = (requests ?? []) as ServiceRequest[];
  const totalCents = history.reduce((s, h) => s + (h.amount_cents ?? 0), 0);

  const updateAction = updateResident.bind(null, r.id);
  const deleteAction = deleteResident.bind(null, r.id);

  return (
    <div className="space-y-8 fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={r.full_name} size={48} />
          <div>
            <Link
              href="/concierge/residents"
              className="text-[11px] text-grey hover:text-cream transition-colors duration-300"
            >
              ← Résidents
            </Link>
            <h1 className="text-2xl text-cream mt-0.5">{r.full_name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge tone={r.owner_status === "proprietaire" ? "gold" : "blue"}>
                {r.owner_status === "proprietaire" ? "Propriétaire" : "Locataire"}
              </Badge>
              <span className="text-[11px] text-grey">
                Étage {r.floor ?? "—"} · Lot {r.unit ?? "—"}
              </span>
              {r.satisfaction_score != null && (
                <Badge tone="gold">
                  Satisfaction {Number(r.satisfaction_score).toFixed(2)} / 5
                </Badge>
              )}
            </div>
          </div>
        </div>
        {/* Contact direct depuis la fiche (PRD §6.1.5) */}
        <div className="flex gap-2">
          {r.phone && (
            <>
              <a href={`tel:${r.phone}`}>
                <Button variant="outline" size="sm">
                  Appeler
                </Button>
              </a>
              <a href={`sms:${r.phone}?body=${contactTemplate}`}>
                <Button variant="outline" size="sm">
                  SMS
                </Button>
              </a>
              <a
                href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}?text=${contactTemplate}`}
                target="_blank"
              >
                <Button variant="outline" size="sm">
                  WhatsApp
                </Button>
              </a>
            </>
          )}
          {r.email && (
            <a
              href={`mailto:${r.email}?subject=${encodeURIComponent("Votre conciergerie Maison Cavalier")}&body=${contactTemplate}`}
            >
              <Button variant="outline" size="sm">
                Email
              </Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Historique des services
              {totalCents > 0 && (
                <span className="text-sm text-grey font-sans ml-2">
                  · total {(totalCents / 100).toLocaleString("fr-FR")} €
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-navy-3/60">
              {history.map((h) => (
                <li key={h.id} className="py-2.5 flex items-center gap-3 text-sm">
                  <ServiceBadge service={h.service} />
                  <span className="flex-1 text-grey">
                    {new Date(h.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <span>
                    {h.amount_cents != null
                      ? `${(h.amount_cents / 100).toLocaleString("fr-FR")} €`
                      : "—"}
                  </span>
                </li>
              ))}
              {history.length === 0 && (
                <li className="py-2.5 text-sm text-grey">
                  Aucun service pour le moment.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fiche</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <p className="text-grey">Préférences</p>
              <p>{r.preferences ?? "—"}</p>
            </div>
            <div>
              <p className="text-grey">Accès particuliers</p>
              <p>{r.special_access ?? "—"}</p>
            </div>
            <div>
              <p className="text-grey">Notes internes</p>
              <p>{r.internal_notes ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modifier la fiche</CardTitle>
          <form action={deleteAction}>
            <Button type="submit" variant="danger" size="sm">
              Supprimer
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <ResidentForm
            action={updateAction}
            resident={r}
            submitLabel="Enregistrer"
          />
        </CardContent>
      </Card>
    </div>
  );
}
