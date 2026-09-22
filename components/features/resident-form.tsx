"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/operations/shared";
import type { Resident } from "@/types";

/** Formulaire création / édition de fiche résident (PRD §6.1.5). */
export function ResidentForm({
  action,
  resident,
  submitLabel,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  resident?: Resident;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-5 max-w-2xl">
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="full_name">Nom complet *</Label>
            <Input id="full_name" name="full_name" defaultValue={resident?.full_name ?? ""} required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={resident?.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={resident?.phone ?? ""} placeholder="+33 6 12 34 56 78" />
          </div>
          <div>
            <Label htmlFor="floor">Étage</Label>
            <Input id="floor" name="floor" defaultValue={resident?.floor ?? ""} />
          </div>
          <div>
            <Label htmlFor="unit">Lot</Label>
            <Input id="unit" name="unit" defaultValue={resident?.unit ?? ""} />
          </div>
          <div>
            <Label htmlFor="owner_status">Statut</Label>
            <Select id="owner_status" name="owner_status" defaultValue={resident?.owner_status ?? "proprietaire"}>
              <option value="proprietaire">Propriétaire</option>
              <option value="locataire">Locataire</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="preferences">Préférences</Label>
          <Textarea id="preferences" name="preferences" rows={2} defaultValue={resident?.preferences ?? ""} placeholder="Ex. pressing chaque lundi matin, journaux…" />
        </div>
        <div>
          <Label htmlFor="special_access">Accès particuliers</Label>
          <Textarea id="special_access" name="special_access" rows={2} defaultValue={resident?.special_access ?? ""} placeholder="Ex. badge cave n°12, ascenseur privatif…" />
        </div>
        <div>
          <Label htmlFor="internal_notes">Notes internes</Label>
          <Textarea id="internal_notes" name="internal_notes" rows={3} defaultValue={resident?.internal_notes ?? ""} placeholder="Visibles uniquement par la conciergerie." />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="gold" disabled={pending}>{pending ? "Enregistrement…" : submitLabel}</Button>
        {state.error && <p role="alert" className="text-[12px] text-red">{state.error}</p>}
        {state.success && <p role="status" className="text-[12px] text-green">{state.success}</p>}
      </div>
    </form>
  );
}
