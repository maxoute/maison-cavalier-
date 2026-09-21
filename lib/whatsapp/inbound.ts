import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { MessageDeliveryStatus } from '@/types';
import type { InboundMessage, InboundStatus } from './webhook';

/** Progression d'un accusé : un « livré » tardif ne doit pas effacer un « lu ». */
const rank: MessageDeliveryStatus[] = ['en_attente', 'envoye', 'livre', 'lu'];

export interface InboundReport {
  stored: number;
  /** Messages écartés : numéro inconnu, ambigu, ou message déjà reçu. */
  ignored: number;
  updated: number;
}

/**
 * Dépose les messages entrants dans le bon fil, donc dans le bon immeuble.
 * Écrit avec la clé service-role : le webhook n'a pas de session, et aucune
 * policy ne saurait décider du tenant avant que le rattachement soit fait.
 *
 * Un numéro inconnu — ou porté par deux immeubles — est écarté plutôt que
 * déposé au hasard : mieux vaut un message manquant qu'un message chez le
 * mauvais résident.
 */
export async function recordInbound(
  messages: InboundMessage[],
  statuses: InboundStatus[],
): Promise<InboundReport> {
  const db = createAdminClient();
  const report: InboundReport = { stored: 0, ignored: 0, updated: 0 };

  for (const message of messages) {
    const thread = await resolveThread(db, message.waId);
    if (!thread) { report.ignored += 1; continue; }
    const { error } = await db.from('messages').insert({
      building_id: thread.buildingId,
      conversation_id: thread.conversationId,
      direction: 'entrant',
      body: message.body,
      external_message_id: message.externalMessageId,
      delivery_status: 'livre',
      created_at: message.receivedAt,
    });
    // 23505 : le même événement rejoué par Meta, déjà enregistré.
    if (error?.code === '23505') { report.ignored += 1; continue; }
    if (error) throw new Error('Message entrant non enregistré.');
    report.stored += 1;
  }

  for (const status of statuses) {
    const position = rank.indexOf(status.status);
    const overwritable = position === -1 ? rank : rank.slice(0, position);
    const { data, error } = await db.from('messages')
      .update({ delivery_status: status.status })
      .eq('external_message_id', status.externalMessageId)
      .in('delivery_status', overwritable)
      .select('id');
    if (error) throw new Error('Accusé de réception non enregistré.');
    report.updated += data?.length ?? 0;
  }

  return report;
}

type Db = ReturnType<typeof createAdminClient>;

async function resolveThread(db: Db, waId: string) {
  const existing = await db.from('conversations')
    .select('id, building_id').eq('external_thread_id', waId).maybeSingle();
  if (existing.error) throw new Error('Fil de discussion indisponible.');
  if (existing.data) return { conversationId: existing.data.id, buildingId: existing.data.building_id };

  const { data: candidates, error } = await db.rpc('resident_by_whatsapp', { wa_id: waId });
  if (error) throw new Error('Résident indisponible.');
  const residents = (candidates ?? []) as { resident_id: string; building_id: string }[];
  if (residents.length !== 1) return null;
  const [resident] = residents;

  // Le fil existe peut-être déjà, ouvert depuis la loge et jamais rattaché
  // à un identifiant Meta : on le complète au lieu d'en créer un second.
  const { data: conversation, error: upsertError } = await db.from('conversations')
    .upsert({
      building_id: resident.building_id,
      resident_id: resident.resident_id,
      channel: 'whatsapp',
      external_thread_id: waId,
    }, { onConflict: 'resident_id,channel' })
    .select('id')
    .single();
  if (upsertError || !conversation) throw new Error('Fil de discussion non créé.');
  return { conversationId: conversation.id, buildingId: resident.building_id };
}
