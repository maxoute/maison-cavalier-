'use server';
import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, dateField, check } from '@/lib/operations/server';
import { categories, type ActionResult } from '@/lib/operations/shared';
import { getWhatsAppProvider, toE164 } from '@/lib/whatsapp';

async function perform(work: () => Promise<void>, message = 'Enregistré.'): Promise<ActionResult> {
  try {
    await work();
    revalidatePath('/concierge', 'layout');
    revalidatePath('/syndic/documents');
    return { success: message };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Une erreur est survenue.' }; }
}

export async function createParcel(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { error } = await db.from('parcels').insert({ building_id: session.buildingId, resident_id: uuid(form, 'resident_id'), carrier: field(form, 'carrier'), tracking_code: field(form, 'tracking_code', true, 200), storage_location: field(form, 'storage_location'), scheduled_delivery_at: dateField(form, 'scheduled_delivery_at'), notes: field(form, 'notes') });
    check(error);
  }, 'Colis reçu. Notification résident simulée.');
}
export async function createPressing(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const quantity = Number(field(form, 'quantity', true));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Quantité invalide.');
    const { error } = await db.from('pressing_orders').insert({ building_id: session.buildingId, resident_id: uuid(form, 'resident_id'), provider: field(form, 'provider', true), items: [{ label: field(form, 'items', true), quantity }], item_count: quantity, expected_return_at: dateField(form, 'expected_return_at'), notes: field(form, 'notes') });
    check(error);
  });
}
export async function advanceOperation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const kind = field(form, 'kind');
    if (kind !== 'parcels' && kind !== 'pressing_orders') throw new Error('Service invalide.');
    const expected = field(form, 'status', true)!;
    const transitions: Record<string, string> = kind === 'parcels' ? { recu: 'stocke', stocke: 'notifie', notifie: 'remis' } : { collecte: 'chez_le_pressing', chez_le_pressing: 'pret', pret: 'livre' };
    const status = transitions[expected];
    if (!status) throw new Error('Cette opération est déjà terminée.');
    const now = new Date().toISOString();
    const { data, error } = await db.from(kind).update({ status, ...(status === 'pret' ? { returned_at: now } : {}), ...(['remis', 'livre'].includes(status) ? { delivered_at: now } : {}) }).eq('building_id', session.buildingId).eq('id', uuid(form, 'id')).eq('status', expected).select('id');
    check(error);
    if (!data?.length) throw new Error('Le statut a changé. Actualisez la page.');
  }, 'Étape enregistrée. Les notifications éventuelles sont simulées.');
}
export async function createRecommendation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const category = field(form, 'category', true)!;
    if (!Object.prototype.hasOwnProperty.call(categories, category)) throw new Error('Catégorie invalide.');
    const url = field(form, 'url');
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Le lien doit commencer par https:// ou http://.');
    const { error } = await db.from('recommendations').insert({ building_id: session.buildingId, name: field(form, 'name', true, 200), category, description: field(form, 'description'), address: field(form, 'address'), phone: field(form, 'phone'), url });
    check(error);
  });
}
export async function shareRecommendation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { error } = await db.from('recommendation_shares').insert({ building_id: session.buildingId, recommendation_id: uuid(form, 'id'), resident_id: uuid(form, 'resident_id'), shared_by_profile_id: session.userId, channel: 'whatsapp' });
    check(error);
  }, 'Recommandation enregistrée. Partage WhatsApp simulé.');
}
export async function openConversation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { error } = await db.from('conversations').upsert({ building_id: session.buildingId, resident_id: uuid(form, 'resident_id'), channel: 'whatsapp' }, { onConflict: 'resident_id,channel', ignoreDuplicates: true });
    check(error);
  }, 'Conversation disponible dans la liste.');
}
export async function sendOperationalMessage(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const id = uuid(form, 'id');
    const body = field(form, 'body', true, 4000)!;
    const { data: conversation, error } = await db.from('conversations').select('resident_id').eq('id', id).eq('building_id', session.buildingId).single();
    check(error);
    if (!conversation) throw new Error('Conversation introuvable.');
    const { data: resident } = await db.from('residents').select('phone').eq('id', conversation.resident_id).eq('building_id', session.buildingId).single();
    const phone = toE164(resident?.phone);
    if (!phone) throw new Error('Renseignez un numéro valide dans la fiche résident.');
    const { data: message, error: insertError } = await db.from('messages').insert({ building_id: session.buildingId, conversation_id: id, direction: 'sortant', sender_profile_id: session.userId, body, delivery_status: 'en_attente' }).select('id').single();
    check(insertError);
    if (!message) throw new Error('Message non enregistré.');
    try {
      const result = await getWhatsAppProvider().send({ to: phone, body });
      const { error: updateError } = await db.from('messages').update({ external_message_id: result.externalMessageId, delivery_status: result.status }).eq('id', message.id);
      check(updateError);
    } catch {
      await db.from('messages').update({ delivery_status: 'echec' }).eq('id', message.id);
      throw new Error('Envoi échoué. Le message reste dans l’historique.');
    }
  }, 'Envoi WhatsApp simulé ; aucun message externe envoyé.');
}
export async function setConversationStatus(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const status = field(form, 'status', true);
    if (!['ouverte', 'en_attente', 'resolue'].includes(status!)) throw new Error('Statut invalide.');
    const { data, error } = await db.from('conversations').update({ status }).eq('id', uuid(form, 'id')).eq('building_id', session.buildingId).select('id');
    check(error);
    if (!data?.length) throw new Error('Conversation introuvable.');
  });
}
