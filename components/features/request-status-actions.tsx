'use client';

import { useState, useTransition } from 'react';
import { updateRequestStatus } from '@/app/actions/requests';
import { Button } from '@/components/ui/button';
import { IconCheck } from '@/components/ui/icons';
import { requestTransitions } from '@/lib/requests';
import type { RequestStatus } from '@/types';

const labels: Record<string, string> = {
  en_cours: 'Prendre en charge', en_attente: 'Mettre en attente', termine: 'Valider la réalisation',
};

/** Boutons d'action rapide : un clic, une transition (PRD §6.1.1 « 2 clics »). */
export function RequestStatusActions({ id, status, compact = false }: { id: string; status: RequestStatus; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const next = requestTransitions[status];
  if (!next.length) return null;
  return <div className="space-y-1.5">
    <div className="flex flex-wrap gap-1.5">{next.map(target => <Button
      key={target} type="button" size="sm" disabled={pending}
      variant={target === 'termine' ? 'ghost' : 'outline'}
      className={compact ? 'px-3 py-1.5 text-[10.5px]' : undefined}
      onClick={() => startTransition(async () => {
        setError(undefined); setDone(undefined);
        try {
          const result = await updateRequestStatus(id, target, status);
          if (result.error) setError(result.error); else setDone(result.success);
        } catch { setError('Connexion interrompue. Réessayez.'); }
      })}
    >{target === 'termine' && <IconCheck size={11} />}{pending ? 'Enregistrement…' : labels[target]}</Button>)}</div>
    {error && <p role="alert" className="text-[11px] text-red">{error}</p>}
    {done && <p role="status" className="text-[11px] text-green">{done}</p>}
  </div>;
}
