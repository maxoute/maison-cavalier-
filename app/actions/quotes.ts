'use server';

import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, check } from '@/lib/operations/server';
import { parseQuoteAmount, quoteTransitions } from '@/lib/quotes';
import type { ActionResult } from '@/lib/operations/shared';
import type { QuoteStatus } from '@/types';

export async function saveQuote(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const requestId = uuid(form, 'request_id');
    const { data: request, error: requestError } = await db.from('service_requests').select('resident_id').eq('id', requestId).eq('building_id', session.buildingId).single();
    check(requestError);
    if (!request) throw new Error('Demande inaccessible.');
    const values = {
      request_id: requestId, resident_id: request.resident_id,
      provider: field(form, 'provider', true, 200), label: field(form, 'label', true, 4000),
      amount_cents: parseQuoteAmount(field(form, 'amount', true)!),
    };
    if (field(form, 'id')) {
      const { data, error } = await db.from('quotes').update(values).eq('id', uuid(form, 'id'))
        .eq('building_id', session.buildingId).eq('status', 'en_attente').eq('updated_at', field(form, 'updated_at', true)!).select('id');
      check(error);
      if (!data?.length) throw new Error('Le devis a changé ou a déjà été envoyé. Actualisez la page.');
    } else {
      const { error } = await db.from('quotes').insert({ ...values, building_id: session.buildingId });
      check(error);
    }
    revalidatePath('/concierge/devis');
    return { success: 'Devis enregistré. Son PDF est disponible au téléchargement.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Enregistrement impossible.' }; }
}

export async function updateQuoteStatus(id: string, status: QuoteStatus, expected: QuoteStatus, version: string): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const form = new FormData(); form.set('id', id); uuid(form, 'id');
    if (!Object.prototype.hasOwnProperty.call(quoteTransitions, expected) || !quoteTransitions[expected].includes(status)) throw new Error('Transition de devis invalide.');
    if (!Number.isFinite(Date.parse(version))) throw new Error('Version invalide. Actualisez la page.');
    const { data, error } = await db.from('quotes').update({ status }).eq('id', id).eq('building_id', session.buildingId)
      .eq('status', expected).eq('updated_at', version).select('id');
    if (error?.code === '23514') throw new Error('Complétez le devis avant envoi ou actualisez son statut.');
    check(error);
    if (!data?.length) throw new Error('Le devis a changé. Actualisez la page.');
    revalidatePath('/concierge/devis'); revalidatePath('/concierge/residents');
    return { success: 'Statut enregistré. Notification résident simulée.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Mise à jour impossible.' }; }
}
