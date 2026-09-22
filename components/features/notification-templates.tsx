'use client';

import { useActionState, useState } from 'react';
import { OperationForm } from './operation-form';
import { Input, Textarea } from '@/components/ui/input';
import { deleteNotificationTemplate, saveNotificationTemplate } from '@/app/actions/catalog';
import type { ActionResult } from '@/lib/operations/shared';
import type { NotificationTemplate } from '@/types';

function DeleteTemplate({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(deleteNotificationTemplate, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-[11px] text-red underline underline-offset-4 cursor-pointer disabled:opacity-50">
        {pending ? 'Suppression…' : 'Supprimer'}
      </button>
      {state.error && <span role="alert" className="text-[11px] text-red">{state.error}</span>}
    </form>
  );
}

/**
 * Modèles de notification propres à l'immeuble (PRD §6.3.4). Le concierge les
 * retrouve dans l'écran Annonces ; sans modèle enregistré, les modèles
 * intégrés restent proposés.
 */
export function NotificationTemplates({ templates }: { templates: NotificationTemplate[] }) {
  const [edited, setEdited] = useState<NotificationTemplate | null>(null);
  return (
    <div className="space-y-4 text-[12.5px]">
      {templates.length === 0 && (
        <p className="text-[11px] text-muted">Aucun modèle propre à cet immeuble : les concierges utilisent les modèles intégrés (travaux, incident technique, événement).</p>
      )}
      {templates.map(template => (
        <article key={template.id} className="rounded-[8px] border border-line bg-surface/60 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] text-ink">{template.label}</h3>
            <div className="flex items-center gap-3">
              <button type="button" className="text-[11px] text-ink/80 underline underline-offset-4 cursor-pointer"
                onClick={() => setEdited(edited?.id === template.id ? null : template)}>
                {edited?.id === template.id ? 'Annuler la modification' : 'Modifier'}
              </button>
              <DeleteTemplate id={template.id} />
            </div>
          </div>
          <p className="text-ink/90">{template.title}</p>
          <p className="whitespace-pre-wrap break-words text-[11.5px] text-muted">{template.body}</p>
        </article>
      ))}
      <div className="rounded-[8px] border border-line px-4 py-3">
        <h3 className="mb-3 text-[13px] text-ink">{edited ? `Modifier « ${edited.label} »` : 'Nouveau modèle'}</h3>
        <OperationForm key={edited?.id ?? 'nouveau'} action={saveNotificationTemplate} submit={edited ? 'Mettre à jour le modèle' : 'Ajouter le modèle'}>
          <label className="block space-y-1"><span>Nom du modèle</span>
            <Input name="label" defaultValue={edited?.label ?? ''} required maxLength={80} placeholder="Coupure d’eau" />
          </label>
          <label className="block space-y-1"><span>Titre envoyé</span>
            <Input name="title" defaultValue={edited?.title ?? ''} required maxLength={200} />
          </label>
          <label className="block space-y-1"><span>Message</span>
            <Textarea name="body" defaultValue={edited?.body ?? ''} required maxLength={4000} rows={4} />
          </label>
          <p className="text-[11px] text-muted">Les éléments entre crochets, par exemple [date], sont complétés par le concierge avant diffusion. Réutiliser un nom existant met le modèle à jour.</p>
        </OperationForm>
      </div>
    </div>
  );
}
