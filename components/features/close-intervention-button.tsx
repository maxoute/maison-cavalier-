"use client";

import { useState, useTransition } from "react";
import { updateRequestStatus } from "@/app/actions/requests";
import { IconCheck } from "@/components/ui/icons";

/** Validation à la clôture : le concierge confirme la bonne réalisation (PRD §6.1.7). */
export function CloseInterventionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        setError(undefined);
        try {
          const result = await updateRequestStatus(id, "termine", "en_cours");
          setError(result.error);
        } catch { setError("Connexion interrompue. Réessayez."); }
      })}
      className="inline-flex items-center gap-1 rounded-[14px] border border-green/35 bg-green/[0.08] px-2.5 py-1 text-[9.5px] font-medium text-green hover:bg-green/[0.15] transition-colors duration-300 cursor-pointer disabled:opacity-50"
    >
      <IconCheck size={11} />
      {pending ? "Clôture…" : "Valider la clôture"}
    </button>
    {error && <p role="alert" className="text-red">{error}</p>}
    </div>
  );
}
