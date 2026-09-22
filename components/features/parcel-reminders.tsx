'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { IconAnnounce } from '@/components/ui/icons';
import { sendParcelReminders } from '@/app/actions/operations';
import type { ActionResult } from '@/lib/operations/shared';

/** Rappels « colis non retiré » J+2 (PRD Annexe A), déclenchés depuis la loge. */
export function ParcelReminders({ due }: { due: number }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(() => sendParcelReminders(), {});
  return (
    <form action={action} className={`flex flex-wrap items-center justify-between gap-3 rounded-[8px] border px-4 py-3 ${due ? 'border-orange/40 bg-orange/[0.06]' : 'border-line bg-surface'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${due ? 'bg-orange/15 text-orange' : 'bg-ink/[0.04] text-muted'}`}><IconAnnounce size={14} /></span>
        <div className="min-w-0">
          <p className="text-[12.5px] text-ink">Rappels J+2</p>
          <p className="text-[11px] text-muted">
            {due === 0
              ? 'Aucun colis en attente depuis plus de deux jours.'
              : `${due} colis non retiré${due > 1 ? 's' : ''} depuis plus de deux jours, sans rappel envoyé.`}
            {state.error && <span role="alert" className="text-red"> {state.error}</span>}
            {state.success && <span role="status" className="text-green"> {state.success}</span>}
          </p>
        </div>
      </div>
      <Button type="submit" variant={due ? 'ghost' : 'outline'} size="sm" disabled={pending}>{pending ? 'Envoi…' : 'Envoyer les rappels dus'}</Button>
    </form>
  );
}
