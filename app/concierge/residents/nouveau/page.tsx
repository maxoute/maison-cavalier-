import { createResident } from "@/app/actions/residents";
import { ResidentForm } from "@/components/features/resident-form";

export default function NewResidentPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Nouveau résident</h1>
      <ResidentForm action={createResident} submitLabel="Créer la fiche" />
    </div>
  );
}
