'use server';
import { revalidatePath } from 'next/cache';
import { staffContext, field, uuid, check } from '@/lib/operations/server';
import type { ActionResult } from '@/lib/operations/shared';
import { emailProvider } from '@/lib/email/provider';

export async function receiveBuildingQuote(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const sender = field(form, 'email_from', true)!;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) throw new Error('Adresse email invalide.');
    const amount = field(form, 'amount');
    if (amount && (!/^\d+(?:[.,]\d{1,2})?$/.test(amount) || Number(amount.replace(',', '.')) > 10000000)) throw new Error('Montant invalide.');
    const { error } = await db.from('building_documents').insert({ building_id: session.buildingId, title: field(form, 'title', true, 200), provider: field(form, 'provider', true, 200), amount_cents: amount ? Math.round(Number(amount.replace(',', '.')) * 100) : null, body: field(form, 'body', true, 10000), email_from: sender, email_message_id: field(form, 'email_message_id', true, 500), created_by: session.userId });
    check(error);
    revalidatePath('/concierge/documents'); revalidatePath('/syndic/documents');
    return { success: 'Devis enregistré et visible par le syndic. La réception automatique des emails est simulée.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Enregistrement impossible.' }; }
}
export async function emailBuildingQuote(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    const { db, session } = await staffContext();
    const id = uuid(form, 'id');
    const recipient = field(form, 'email', true, 254)!;
    const { data, error } = await db.from('building_documents').select('title, body').eq('id', id).eq('building_id', session.buildingId).single();
    check(error);
    if (!data) throw new Error('Document introuvable.');
    const delivery = await emailProvider.send({ to: recipient, subject: data.title, body: data.body });
    const { error: deliveryError } = await db.from('building_document_deliveries').insert({ building_id: session.buildingId, document_id: id, recipient, external_id: delivery.id, simulated: delivery.simulated, sent_by: session.userId });
    check(deliveryError);
    revalidatePath('/concierge/documents');
    return { success: 'Envoi email simulé et historisé. Aucun email externe envoyé.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Envoi impossible.' }; }
}
