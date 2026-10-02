'use server';

import { revalidatePath } from 'next/cache';
import { staffContext, field, check } from '@/lib/operations/server';
import type { ActionResult } from '@/lib/operations/shared';
import { isWhatsAppLive } from '@/lib/whatsapp';
import { scheduleWhatsAppFlush } from '@/lib/whatsapp/outbox';

export async function publishAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const owner = field(form, 'target_owner_status');
    if (owner && !['proprietaire', 'locataire'].includes(owner)) throw new Error('Audience invalide.');
    const { data, error } = await db.from('announcements').insert({
      building_id: session.buildingId, created_by: session.userId,
      title: field(form, 'title', true, 200), body: field(form, 'body', true, 4000),
      target_floor: field(form, 'target_floor', false, 100), target_owner_status: owner,
      urgent: form.get('urgent') === 'on',
    }).select('recipient_count').single();
    if (error?.code === '23514') throw new Error('Audience vide ou contenu invalide. Vérifiez votre annonce.');
    check(error);
    // Une annonce urgente part aussi sur WhatsApp (trigger `prepare_announcement`).
    const urgent = form.get('urgent') === 'on';
    if (urgent) scheduleWhatsAppFlush();
    revalidatePath('/concierge/annonces');
    const diffusion = urgent && isWhatsAppLive()
      ? 'Envoi WhatsApp en cours ; push, e-mail et SMS restent simulés.'
      : 'Diffusion simulée, aucun message externe envoyé.';
    return { success: `Annonce enregistrée pour ${data?.recipient_count ?? 0} résident(s). ${diffusion}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Diffusion impossible.' };
  }
}
