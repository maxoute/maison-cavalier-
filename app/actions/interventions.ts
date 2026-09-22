'use server';

import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, dateField, check } from '@/lib/operations/server';
import { incidentLabels } from '@/lib/interventions';
import { parseEuros } from '@/lib/catalog';
import type { ActionResult } from '@/lib/operations/shared';

async function perform(work: () => Promise<void>, success: string): Promise<ActionResult> {
  try {
    await work();
    revalidatePath('/concierge', 'layout'); revalidatePath('/syndic', 'layout'); revalidatePath('/admin', 'layout');
    return { success };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Enregistrement impossible.' }; }
}

export async function assignIntervention(_: ActionResult, form: FormData): Promise<ActionResult> {
  return perform(async () => {
    const { db, session } = await staffContext();
    const version = field(form, 'updated_at', true)!;
    if (!Number.isFinite(Date.parse(version))) throw new Error('Version invalide. Actualisez la page.');
    const amount = field(form, 'amount', false, 20);
    const { data, error } = await db.from('service_requests').update({
      assigned_provider: field(form, 'assigned_provider', true, 200),
      estimated_completion_at: dateField(form, 'estimated_completion_at'),
      ...(amount ? { amount_cents: parseEuros(amount) } : {}),
    }).eq('id', uuid(form, 'id')).eq('building_id', session.buildingId).eq('updated_at', version).neq('status', 'termine').select('id');
    check(error);
    if (!data?.length) throw new Error('Cette intervention a changé. Actualisez la page.');
  }, 'Prestataire et heure prévue enregistrés.');
}

export async function reportInterventionIncident(_: ActionResult, form: FormData): Promise<ActionResult> {
  return perform(async () => {
    const { db, session } = await staffContext();
    const kind = field(form, 'kind', true)!;
    if (!Object.prototype.hasOwnProperty.call(incidentLabels, kind)) throw new Error('Type d’incident invalide.');
    const { error } = await db.from('intervention_incidents').insert({
      building_id: session.buildingId, request_id: uuid(form, 'request_id'), reported_by: session.userId,
      kind, severity: form.get('grave') === 'on' ? 'grave' : 'standard', description: field(form, 'description', true, 4000),
    });
    if (error?.code === '23514') throw new Error('Cette intervention est déjà clôturée ou les données sont invalides.');
    check(error);
  }, form.get('grave') === 'on' ? 'Incident enregistré et alerte générique ajoutée au fil syndic. Notifications externes simulées.' : 'Incident enregistré.');
}

export async function resolveInterventionIncident(_: ActionResult, form: FormData): Promise<ActionResult> {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { data, error } = await db.from('intervention_incidents').update({ resolution: field(form, 'resolution', true, 4000) })
      .eq('id', uuid(form, 'id')).eq('building_id', session.buildingId).is('resolved_at', null).select('id');
    check(error);
    if (!data?.length) throw new Error('Cet incident est déjà résolu ou n’est plus accessible.');
  }, 'Incident résolu.');
}
