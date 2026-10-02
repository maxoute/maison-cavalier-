import 'server-only';

import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWhatsAppProvider, toE164 } from '@/lib/whatsapp';
import { buildTemplateMessage } from './templates';

export interface OutboxReport {
  sent: number;
  failed: number;
}

/**
 * Envoie les notifications WhatsApp en attente (voir la migration
 * `whatsapp_outbox`). Chaque ligne est d'abord réservée (`en_attente` →
 * `envoi`) par une mise à jour conditionnelle : deux vidages simultanés —
 * action serveur et ordonnanceur — ne l'enverront jamais deux fois.
 *
 * Écrit avec la clé service-role : la file couvre tous les immeubles et
 * n'est appelée que côté serveur, jamais depuis le navigateur.
 */
export async function flushWhatsAppOutbox(limit = 50): Promise<OutboxReport> {
  const db = createAdminClient();
  const report: OutboxReport = { sent: 0, failed: 0 };
  const { data: pending, error } = await db.from('notifications')
    .select('id, building_id, recipient_resident_id, event, payload')
    .eq('delivery_status', 'en_attente').order('sent_at').limit(limit);
  if (error) throw new Error('File WhatsApp illisible.');

  const buildings = new Map<string, string>();
  for (const notification of pending ?? []) {
    const { data: claimed } = await db.from('notifications').update({ delivery_status: 'envoi' })
      .eq('id', notification.id).eq('delivery_status', 'en_attente').select('id');
    if (!claimed?.length) continue;

    const fail = async (reason: string) => {
      report.failed += 1;
      await db.from('notifications').update({ delivery_status: 'echec', delivery_error: reason.slice(0, 500) })
        .eq('id', notification.id);
    };

    const { data: resident } = await db.from('residents').select('full_name, phone')
      .eq('id', notification.recipient_resident_id).eq('building_id', notification.building_id).maybeSingle();
    const to = toE164(resident?.phone);
    if (!resident || !to) { await fail('Numéro du résident absent ou invalide.'); continue; }

    if (!buildings.has(notification.building_id)) {
      const { data: building } = await db.from('buildings').select('name').eq('id', notification.building_id).maybeSingle();
      buildings.set(notification.building_id, building?.name ?? '');
    }
    const template = buildTemplateMessage({
      event: notification.event,
      payload: (notification.payload ?? {}) as Record<string, unknown>,
      residentName: resident.full_name,
      buildingName: buildings.get(notification.building_id)!,
    });
    if (!template) { await fail(`Aucun modèle WhatsApp pour l’événement ${notification.event}.`); continue; }

    try {
      const result = await getWhatsAppProvider().send({
        to, body: template.preview, template: { name: template.name, variables: template.variables },
      });
      await db.from('notifications').update({
        delivery_status: 'envoye', external_message_id: result.externalMessageId,
        delivered_at: new Date().toISOString(), delivery_error: null,
      }).eq('id', notification.id);
      report.sent += 1;
    } catch (sendError) {
      await fail(sendError instanceof Error ? sendError.message : 'Envoi WhatsApp refusé.');
    }
  }
  return report;
}

/**
 * Vide la file après la réponse : l'action de la loge (colis enregistré,
 * annonce publiée…) n'attend pas Meta. L'ordonnanceur
 * (`/api/whatsapp/outbox`) rattrape ce qu'un vidage aurait manqué.
 */
export function scheduleWhatsAppFlush() {
  after(async () => {
    try {
      await flushWhatsAppOutbox();
    } catch (error) {
      console.error('[whatsapp:outbox]', error instanceof Error ? error.message : error);
    }
  });
}
