'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/operations/shared';

export function OperationForm({ action, children, submit = 'Enregistrer', primary = false, variant }: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  children?: React.ReactNode; submit?: string; primary?: boolean;
  /** Surcharge du style du bouton (défaut : or si `primary`, contour sinon). */
  variant?: 'gold' | 'ghost' | 'outline' | 'danger';
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="space-y-3">
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">{children}</fieldset>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" variant={variant ?? (primary ? 'gold' : 'outline')} disabled={pending}>{pending ? 'En cours…' : submit}</Button>
      {state.error && <p role="alert" className="text-[12px] text-red">{state.error}</p>}
      {state.success && <p role="status" className="text-[12px] text-green">{state.success}</p>}
    </div>
  </form>;
}
