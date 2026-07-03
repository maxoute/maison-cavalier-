import { QuoteActions } from "@/components/features/quote-actions";
import { Badge } from "@/components/ui/badge";
import { Card, SectionLabel } from "@/components/ui/card";
import { IconClock, IconDoc } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { Quote, QuoteStatus } from "@/types";

const statusTone: Record<QuoteStatus, "grey" | "gold" | "green" | "red"> = {
  en_attente: "grey",
  envoye: "gold",
  accepte: "green",
  refuse: "red",
};
const statusLabel: Record<QuoteStatus, string> = {
  en_attente: "En attente",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
};

/** Module Devis (PRD §6.1.6) — connecté à la table `quotes`. */
export default async function DevisPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select("*, residents(full_name)")
    .order("created_at", { ascending: false });

  const quotes = (data ?? []) as (Quote & {
    residents: { full_name: string } | null;
  })[];

  const enCours = quotes.filter((q) => q.status === "en_attente" || q.status === "envoye");
  const decides = quotes.filter((q) => q.status === "accepte" || q.status === "refuse");
  const montantEnCours = enCours.reduce((s, q) => s + q.amount_cents, 0);
  const tauxConversion = decides.length
    ? Math.round(
        (decides.filter((q) => q.status === "accepte").length / decides.length) * 100,
      )
    : 0;

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl text-cream">Devis</h1>
        <p className="text-[11px] text-grey mt-1">
          {quotes.length} devis · générés au format PDF Maison Cavalier
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card accent="gold" className="p-4">
          <p className="font-serif text-cream text-xl">
            {(montantEnCours / 100).toLocaleString("fr-FR")} €
          </p>
          <SectionLabel className="mt-1.5 text-[9px]">montant en cours</SectionLabel>
        </Card>
        <Card accent="green" className="p-4">
          <p className="font-serif text-cream text-xl">{tauxConversion} %</p>
          <SectionLabel className="mt-1.5 text-[9px]">taux d&apos;acceptation</SectionLabel>
        </Card>
        <Card accent="blue" className="p-4">
          <p className="font-serif text-cream text-xl">{enCours.length}</p>
          <SectionLabel className="mt-1.5 text-[9px]">devis actifs</SectionLabel>
        </Card>
      </div>

      <div className="space-y-2">
        {quotes.map((q) => (
          <Card key={q.id} interactive className="p-3.5 flex items-center gap-3 flex-wrap">
            <span className="flex items-center justify-center w-9 h-9 rounded-[8px] bg-white/[0.04] text-gold-light shrink-0">
              <IconDoc size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-cream truncate">{q.label}</p>
              <p className="text-[10px] text-grey mt-0.5 truncate flex items-center gap-1">
                {q.residents?.full_name ?? "—"} · {q.provider}
                {q.status === "en_attente" && (
                  <span className="inline-flex items-center gap-1 text-grey/80 ml-1">
                    <IconClock size={10} /> en attente d&apos;envoi
                  </span>
                )}
              </p>
            </div>
            <span className="font-serif text-cream text-[14px] shrink-0">
              {(q.amount_cents / 100).toLocaleString("fr-FR")} €
            </span>
            <Badge tone={statusTone[q.status]} className="shrink-0">
              {statusLabel[q.status]}
            </Badge>
            {(q.status === "en_attente" || q.status === "envoye") && (
              <QuoteActions id={q.id} />
            )}
          </Card>
        ))}
        {quotes.length === 0 && (
          <p className="text-sm text-grey">Aucun devis pour le moment.</p>
        )}
      </div>
    </div>
  );
}
