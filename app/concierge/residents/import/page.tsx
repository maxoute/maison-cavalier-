import Link from "next/link";
import { importResidentsCsv } from "@/app/actions/residents";
import { OperationForm } from "@/components/features/operation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

export default function ImportResidentsPage() {
  return (
    <div className="space-y-6 max-w-2xl fade-up">
      <div>
        <Link href="/concierge/residents" className="text-[11px] text-muted hover:text-ink transition-colors duration-300">← Résidents</Link>
        <PageHeader className="mt-1" title="Import CSV des résidents" subtitle="Onboarding d'un immeuble en quelques minutes : importez la liste des occupants depuis un export du syndic ou d'Excel." />
      </div>
      <Card>
        <CardHeader><CardTitle>Format attendu</CardTitle></CardHeader>
        <CardContent className="text-[12.5px] text-muted space-y-2">
          <p>
            Fichier CSV avec en-têtes, séparateur virgule, point-virgule (export Excel) ou tabulation. Seule la colonne{" "}
            <code className="bg-surface-2 px-1 rounded text-ink">full_name</code> est obligatoire.
          </p>
          <pre className="bg-surface-2 rounded-[8px] p-3 overflow-x-auto text-[11px] text-ink">
            {`full_name,email,phone,floor,unit,owner_status
Jean Dupont,j.dupont@example.com,+33600000000,3,3A,proprietaire
Marie Claire,,+33600000001,5,5B,locataire`}
          </pre>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5">
          <OperationForm action={importResidentsCsv} primary submit="Importer les résidents">
            <div>
              <Label htmlFor="file">Fichier CSV</Label>
              <input id="file" name="file" type="file" accept=".csv,text/csv" required className="block w-full text-[12.5px] text-ink file:mr-3 file:rounded-[24px] file:border file:border-line file:bg-surface file:px-4 file:py-2 file:text-[12px] file:text-ink file:cursor-pointer" />
            </div>
          </OperationForm>
        </CardContent>
      </Card>
    </div>
  );
}
