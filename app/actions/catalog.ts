'use server';

import { revalidatePath } from 'next/cache';
import { managerContext } from '@/lib/admin/server';
import { field, uuid, check } from '@/lib/operations/server';
import { isPricingUnit, parseEuros, parseRate } from '@/lib/catalog';
import { isServiceType } from '@/lib/requests';
import type { ActionResult } from '@/lib/operations/shared';

function refreshCatalog() {
  revalidatePath('/admin/services');
  revalidatePath('/admin');
  // Le catalogue pilote les services proposés en loge et les modèles d'annonce.
  revalidatePath('/concierge', 'layout');
}

/** Slug stable déduit du libellé : accents retirés, séparateurs normalisés. */
function slugify(label: string) {
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (slug.length < 2) throw new Error('Nom de modèle invalide : utilisez au moins deux lettres ou chiffres.');
  return slug;
}

export async function saveBuildingService(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, buildingId, session } = await managerContext();
    const service = field(form, 'service', true)!;
    const unit = field(form, 'pricing_unit', true)!;
    if (!isServiceType(service) || !isPricingUnit(unit)) throw new Error('Service ou unité tarifaire invalide.');
    const slaInput = field(form, 'sla_minutes');
    let slaMinutes: number | null = null;
    if (slaInput) {
      slaMinutes = Number(slaInput);
      if (!Number.isInteger(slaMinutes) || slaMinutes < 5 || slaMinutes > 10080) throw new Error('Engagement SLA invalide : entre 5 minutes et 7 jours (10080 minutes).');
    }
    const { data, error } = await db.from('building_services').update({
      enabled: form.get('enabled') === 'on',
      pricing_unit: unit,
      base_price_cents: parseEuros(field(form, 'base_price', true, 20)!),
      commission_rate: parseRate(field(form, 'commission_rate', true, 10)!),
      partner_name: field(form, 'partner_name', false, 200),
      sla_minutes: slaMinutes,
      updated_by: session.userId,
    }).eq('building_id', buildingId).eq('service', service).select('enabled');
    check(error);
    if (!data?.length) throw new Error('Service introuvable pour cet immeuble ou modification refusée.');
    refreshCatalog();
    return { success: data[0].enabled ? 'Service actif, tarif enregistré.' : 'Service désactivé : aucune nouvelle demande ne sera acceptée.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enregistrement impossible.' };
  }
}

export async function saveNotificationTemplate(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, buildingId, session } = await managerContext();
    const label = field(form, 'label', true, 80)!;
    const row = {
      building_id: buildingId, slug: slugify(label), label,
      title: field(form, 'title', true, 200)!, body: field(form, 'body', true, 4000)!,
      updated_by: session.userId,
    };
    const { error } = await db.from('notification_templates').upsert(row, { onConflict: 'building_id,slug' });
    check(error);
    refreshCatalog();
    revalidatePath('/concierge/annonces');
    return { success: 'Modèle enregistré : il est proposé aux concierges de cet immeuble.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Enregistrement impossible.' };
  }
}

export async function deleteNotificationTemplate(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, buildingId } = await managerContext();
    const { data, error } = await db.from('notification_templates').delete()
      .eq('building_id', buildingId).eq('id', uuid(form, 'id')).select('id');
    check(error);
    if (!data?.length) throw new Error('Modèle introuvable ou suppression refusée.');
    refreshCatalog();
    revalidatePath('/concierge/annonces');
    return { success: 'Modèle supprimé.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Suppression impossible.' };
  }
}
