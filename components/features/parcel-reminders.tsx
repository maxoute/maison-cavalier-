'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { sendParcelReminders } from '@/app/actions/operations';
import type { ActionResult } from '@/lib/operations/shared';

/** Rappels « colis non retiré » J+2 (PRD Annexe A), déclenchés depuis la loge. */
export function ParcelReminders({ due }: { due: number }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(() => sendParcelReminders(), {});
  return (
    <form action={action} className="space-y-3">
      <h2 className="text-xl">Rappels J+2</h2>
      <p className="text-grey">
        {due === 0
          ? 'Aucun colis en attente depuis plus de deux jours.'
          : `${due} colis non retiré(s) depuis plus de deux jours, sans rappel envoyé.`}
      </p>
      <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Envoi…' : 'Envoyer les rappels dus'}</Button>
      {state.error && <p role="alert" className="text-red">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
      <p className="text-grey">Un ordonnanceur peut appeler la même opération sur <code>/api/rappels/colis</code> avec le secret de service.</p>
    </form>
  );
}
