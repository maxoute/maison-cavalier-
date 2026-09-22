'use client';

import { useState, useTransition } from 'react';
import { updateQuoteStatus } from '@/app/actions/quotes';
import { Button } from '@/components/ui/button';
import { IconCheck, IconSend } from '@/components/ui/icons';
import { quoteTransitions } from '@/lib/quotes';
import type { QuoteStatus } from '@/types';
import type { ActionResult } from '@/lib/operations/shared';

export function QuoteActions({ id, status, version, live = false }: { id: string; status: QuoteStatus; version: string; live?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});
  const next = quoteTransitions[status];
  if (!next.length) return null;
  return <div className="space-y-1.5">
    <div className="flex flex-wrap gap-1.5">{next.map(target => <Button key={target} type="button" size="sm" disabled={pending}
      variant={target === 'refuse' ? 'outline' : 'ghost'}
      onClick={() => startTransition(async () => {
        setResult({});
        try { setResult(await updateQuoteStatus(id, target, status, version)); }
        catch { setResult({ error: 'Connexion interrompue. Réessayez.' }); }
      })}>
      {target === 'envoye' ? <><IconSend size={11} />{live ? 'Envoyer au résident' : 'Envoyer au résident (simulé)'}</> : target === 'accepte' ? <><IconCheck size={11} />Accepté par le résident</> : 'Refusé par le résident'}
    </Button>)}</div>
    {pending && <p role="status" className="text-[11px] text-muted">Enregistrement…</p>}
    {result.error && <p role="alert" className="text-[11px] text-red">{result.error}</p>}
    {result.success && <p role="status" className="text-[11px] text-green">{result.success}</p>}
  </div>;
}
