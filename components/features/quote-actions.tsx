'use client';

import { useState, useTransition } from 'react';
import { updateQuoteStatus } from '@/app/actions/quotes';
import { quoteTransitions } from '@/lib/quotes';
import type { QuoteStatus } from '@/types';
import type { ActionResult } from '@/lib/operations/shared';

export function QuoteActions({ id, status, version }: { id: string; status: QuoteStatus; version: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">{quoteTransitions[status].map(next => <button key={next} type="button" disabled={pending}
      className="rounded-3xl border border-navy-3 px-4 py-2 hover:bg-navy disabled:opacity-50"
      onClick={() => startTransition(async () => {
        setResult({});
        try { setResult(await updateQuoteStatus(id, next, status, version)); }
        catch { setResult({ error: 'Connexion interrompue. Réessayez.' }); }
      })}>
      {next === 'envoye' ? 'Simuler l’envoi au résident' : next === 'accepte' ? 'Enregistrer l’acceptation' : 'Enregistrer le refus'}
    </button>)}</div>
    {pending && <p role="status">Enregistrement…</p>}
    {result.error && <p role="alert" className="text-red">{result.error}</p>}
    {result.success && <p role="status">{result.success}</p>}
  </div>;
}
