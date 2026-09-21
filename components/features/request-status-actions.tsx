'use client';

import { useState, useTransition } from 'react';
import { updateRequestStatus } from '@/app/actions/requests';
import { requestTransitions } from '@/lib/requests';
import type { RequestStatus } from '@/types';

export function RequestStatusActions({ id, status }: { id: string; status: RequestStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">{requestTransitions[status].map(next => <button
      key={next} type="button" disabled={pending}
      className="rounded-3xl border border-navy-3 px-4 py-2 hover:bg-navy disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-cream"
      onClick={() => startTransition(async () => {
        setError(undefined);
        try { const result = await updateRequestStatus(id, next, status); setError(result.error); }
        catch { setError('Connexion interrompue. Réessayez.'); }
      })}
    >{next === 'termine' ? 'Valider la réalisation' : next === 'en_cours' ? 'Prendre en charge' : 'Mettre en attente'}</button>)}</div>
    {pending && <p role="status">Enregistrement…</p>}
    {error && <p role="alert" className="text-red">{error}</p>}
  </div>;
}
