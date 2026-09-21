'use server';

import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, dateField, check } from '@/lib/operations/server';
import { isRequestStatus, isServiceType, requestTransitions } from '@/lib/requests';
import { slaDeadline } from '@/lib/catalog';
import type { ActionResult } from '@/lib/operations/shared';

function refreshRequests() {
  revalidatePath('/concierge');
  revalidatePath('/concierge/interventions');
  revalidatePath('/admin');
}

export async function createRequest(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const service = field(form, 'service', true)!;
    const priority = field(form, 'priority', true);
    if (!isServiceType(service) || !['normale', 'urgente'].includes(priority!)) throw new Error('Service ou priorité invalide.');
    // Le catalogue de l'immeuble décide de l'ouverture du service et porte
    // l'engagement SLA par défaut (PRD §6.3.4) ; la base le vérifie aussi.
    const { data: catalog, error: catalogError } = await db.from('building_services')
      .select('enabled, sla_minutes').eq('building_id', session.buildingId).eq('service', service).maybeSingle();
    check(catalogError);
    if (!catalog?.enabled) throw new Error('Ce service est désactivé pour cet immeuble.');
    const { error } = await db.from('service_requests').insert({
      building_id: session.buildingId, resident_id: uuid(form, 'resident_id'), service, priority,
      payload: { description: field(form, 'description', true, 4000) },
      sla_deadline: dateField(form, 'sla_deadline') ?? slaDeadline(catalog.sla_minutes, Date.now()),
    });
    if (error?.code === '23514') throw new Error('Ce service est désactivé pour cet immeuble.');
    check(error);
    refreshRequests();
    return { success: 'Demande créée.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Création impossible.' };
  }
}

export async function updateRequestStatus(id: string, status: string, expected: string): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const form = new FormData(); form.set('id', id); uuid(form, 'id');
    if (!isRequestStatus(status) || !isRequestStatus(expected) || !requestTransitions[expected].includes(status)) throw new Error('Transition non autorisée.');
    const { data, error } = await db.from('service_requests').update({ status })
      .eq('id', id).eq('building_id', session.buildingId).eq('status', expected).select('id');
    if (error?.code === '23514' && status === 'termine') throw new Error('Clôture refusée : vérifiez le statut et résolvez les incidents ouverts dans les interventions.');
    check(error);
    if (!data?.length) throw new Error('La demande a changé ou n’est plus accessible. Actualisez le tableau.');
    refreshRequests();
    return { success: status === 'termine' ? 'Réalisation validée et demande clôturée.' : 'Statut mis à jour.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Mise à jour impossible.' };
  }
}
