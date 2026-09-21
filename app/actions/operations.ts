'use server';
import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, dateField, check } from '@/lib/operations/server';
import { categories, type ActionResult } from '@/lib/operations/shared';
import { getWhatsAppProvider, toE164 } from '@/lib/whatsapp';
import { parseEuros, parseRate } from '@/lib/catalog';

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
/** Preuve photo d'un colis : une image, stockée sous l'immeuble (PRD §6.1.4). */
const photoTypes: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export async function uploadParcelPhoto(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const id = uuid(form, 'id');
    const photo = form.get('photo');
    if (!(photo instanceof File) || photo.size === 0) throw new Error('Sélectionnez ou prenez une photo.');
    if (photo.size > 5_242_880) throw new Error('Photo trop lourde : 5 Mo maximum.');
    const extension = photoTypes[photo.type];
    if (!extension) throw new Error('Format accepté : JPEG, PNG ou WebP.');
    const path = `${session.buildingId}/${id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from('colis').upload(path, photo, { contentType: photo.type, upsert: false });
    if (uploadError) throw new Error('Téléversement refusé. Vérifiez le format et réessayez.');
    const { data, error } = await db.from('parcels').update({ photo_path: path })
      .eq('building_id', session.buildingId).eq('id', id).select('id');
    if (error || !data?.length) {
      // Pas de fichier orphelin si la fiche a disparu entre-temps.
      await db.storage.from('colis').remove([path]);
      check(error);
      throw new Error('Colis introuvable.');
    }
  }, 'Photo enregistrée comme preuve de réception.');
}
export async function rescheduleParcel(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { data, error } = await db.from('parcels').update({ scheduled_delivery_at: dateField(form, 'scheduled_delivery_at') })
      .eq('building_id', session.buildingId).eq('id', uuid(form, 'id')).select('id');
    if (error?.code === '23514') throw new Error('Créneau figé : ce colis est déjà remis ou retourné.');
    check(error);
    if (!data?.length) throw new Error('Colis introuvable.');
  }, 'Créneau de remise mis à jour.');
}
/** Rappels J+2 des colis non retirés (PRD Annexe A) — un seul par colis. */
export async function sendParcelReminders(): Promise<ActionResult> {
  try {
    const { db } = await staffContext();
    const { data, error } = await db.rpc('send_parcel_reminders');
    check(error);
    revalidatePath('/concierge/colis');
    const count = typeof data === 'number' ? data : 0;
    return { success: count === 0 ? 'Aucun rappel à envoyer.' : `${count} rappel(s) enregistré(s). Envoi simulé.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Rappels impossibles.' };
  }
}
/** Affiliation : un partenaire porte toujours un taux de commission. */
function affiliation(form: FormData) {
  const partner = form.get('is_partner') === 'on';
  const rate = field(form, 'commission_rate', false, 10);
  if (!partner) return { is_partner: false, commission_rate: rate ? parseRate(rate) : null };
  if (!rate) throw new Error('Indiquez le taux de commission du partenaire.');
  return { is_partner: true, commission_rate: parseRate(rate) };
}
export async function createRecommendation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const category = field(form, 'category', true)!;
    if (!Object.prototype.hasOwnProperty.call(categories, category)) throw new Error('Catégorie invalide.');
    const url = field(form, 'url');
    if (url && !/^https?:\/\//i.test(url)) throw new Error('Le lien doit commencer par https:// ou http://.');
    const { error } = await db.from('recommendations').insert({ building_id: session.buildingId, name: field(form, 'name', true, 200), category, description: field(form, 'description'), address: field(form, 'address'), phone: field(form, 'phone'), url, ...affiliation(form) });
    check(error);
  });
}
export async function updateRecommendation(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { data, error } = await db.from('recommendations')
      .update({ ...affiliation(form), is_active: form.get('is_active') === 'on' })
      .eq('building_id', session.buildingId).eq('id', uuid(form, 'id')).select('id');
    check(error);
    if (!data?.length) throw new Error('Adresse introuvable.');
  }, 'Affiliation mise à jour.');
}
/** Devenir d'un partage : c'est ce suivi qui rend l'affiliation mesurable. */
export async function setShareStatus(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const status = field(form, 'status', true)!;
    if (!['consultee', 'reservee', 'refusee'].includes(status)) throw new Error('Suivi invalide.');
    const amount = field(form, 'amount', false, 20);
    if (status === 'reservee' && !amount) throw new Error('Indiquez le montant de la réservation.');
    const { data, error } = await db.from('recommendation_shares').update({
      status,
      booking_amount_cents: status === 'reservee' ? parseEuros(amount!) : null,
      feedback: field(form, 'feedback', false, 500),
    }).eq('building_id', session.buildingId).eq('id', uuid(form, 'id')).select('commission_cents');
    if (error?.code === '23514') throw new Error('Suivi impossible depuis l’état actuel de ce partage.');
    check(error);
    if (!data?.length) throw new Error('Partage introuvable.');
    revalidatePath('/concierge/recommandations');
    if (status !== 'reservee') return { success: 'Suivi enregistré.' };
    const commission = data[0].commission_cents ?? 0;
    return { success: commission > 0
      ? `Réservation enregistrée. Commission acquise : ${(commission / 100).toLocaleString('fr-FR')} €.`
      : 'Réservation enregistrée. Cette adresse n’est pas affiliée : aucune commission.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Suivi impossible.' };
  }
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
export async function markConversationRead(_: ActionResult, form: FormData) {
  return perform(async () => {
    const { db, session } = await staffContext();
    const { data, error } = await db.from('conversations').update({ last_read_at: new Date().toISOString() })
      .eq('building_id', session.buildingId).eq('id', uuid(form, 'id')).select('id');
    check(error);
    if (!data?.length) throw new Error('Conversation introuvable.');
  }, 'Fil marqué comme lu.');
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
