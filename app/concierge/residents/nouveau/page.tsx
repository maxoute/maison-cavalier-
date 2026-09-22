import Link from "next/link";
import { createResident } from "@/app/actions/residents";
import { ResidentForm } from "@/components/features/resident-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function NewResidentPage() {
  return (
    <div className="space-y-6 fade-up">
      <div>
        <Link href="/concierge/residents" className="text-[11px] text-muted hover:text-ink transition-colors duration-300">← Résidents</Link>
        <PageHeader className="mt-1" title="Nouveau résident" subtitle="La fiche est immédiatement disponible dans les demandes, colis, pressing et WhatsApp." />
      </div>
      <Card>
        <CardContent className="pt-5">
          <ResidentForm action={createResident} submitLabel="Créer la fiche" />
        </CardContent>
      </Card>
    </div>
  );
}
