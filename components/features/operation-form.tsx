'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/operations/shared';

export function OperationForm({ action, children, submit = 'Enregistrer', primary = false }: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  children?: React.ReactNode; submit?: string; primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="space-y-3">
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">{children}</fieldset>
    <Button type="submit" variant={primary ? 'gold' : 'outline'} disabled={pending}>{pending ? 'En cours…' : submit}</Button>
    {state.error && <p role="alert" className="text-red">{state.error}</p>}
    {state.success && <p role="status" className="text-cream">{state.success}</p>}
  </form>;
}
