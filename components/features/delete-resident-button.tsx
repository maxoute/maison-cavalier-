"use client";

import { useState, useTransition } from "react";
import { deleteResident } from "@/app/actions/residents";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconTrash } from "@/components/ui/icons";

/** Suppression d'une fiche résident, toujours confirmée (PRD §6.1.5). */
export function DeleteResidentButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button type="button" variant="danger" size="sm" onClick={() => { setError(undefined); setOpen(true); }}>
        <IconTrash size={12} /> Supprimer
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Supprimer la fiche ?">
        <div className="space-y-4 text-[12.5px]">
          <p className="text-ink">La fiche de <span className="font-medium">{name}</span> sera définitivement supprimée.</p>
          <p className="text-muted">Une fiche liée à un historique (demandes, devis, colis…) ne peut pas être supprimée : elle est conservée pour la traçabilité.</p>
          {error && <p role="alert" className="text-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>Annuler</Button>
            <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => startTransition(async () => {
              setError(undefined);
              try {
                const result = await deleteResident(id);
                if (result?.error) setError(result.error);
              } catch { setError("Connexion interrompue. Réessayez."); }
            })}>{pending ? "Suppression…" : "Confirmer la suppression"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
