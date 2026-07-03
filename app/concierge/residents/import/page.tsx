import { importResidentsCsv } from "@/app/actions/residents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function ImportResidentsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl">Import CSV des résidents</h1>
      <Card>
        <CardHeader>
          <CardTitle>Format attendu</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-grey space-y-2">
          <p>
            Fichier CSV avec en-têtes, séparateur virgule. Seule la colonne{" "}
            <code className="bg-navy-3 px-1 rounded">full_name</code> est
            obligatoire.
          </p>
          <pre className="bg-navy-3 rounded-[8px] p-3 overflow-x-auto text-xs">
            {`full_name,email,phone,floor,unit,owner_status
Jean Dupont,j.dupont@example.com,+33600000000,3,3A,proprietaire
Marie Claire,,+33600000001,5,5B,locataire`}
          </pre>
        </CardContent>
      </Card>
      <form action={importResidentsCsv} className="space-y-4">
        <div>
          <Label htmlFor="file">Fichier CSV</Label>
          <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <Button type="submit" variant="gold">
          Importer
        </Button>
      </form>
    </div>
  );
}
