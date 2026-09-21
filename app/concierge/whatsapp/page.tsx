import Link from 'next/link';
import { staffContext, residentsForStaff, check } from '@/lib/operations/server';
import { OperationForm } from '@/components/features/operation-form';
import { ResidentSelect } from '@/components/features/operation-fields';
import { Select, Textarea } from '@/components/ui/input';
import { openConversation, sendOperationalMessage, setConversationStatus, markConversationRead } from '@/app/actions/operations';
import { isWhatsAppLive } from '@/lib/whatsapp';
import type { Conversation, Message } from '@/types';
export default async function Page({ searchParams }: { searchParams: Promise<{ fil?: string }> }) {
  const { db, session } = await staffContext();
  const residents = await residentsForStaff();
  const { fil } = await searchParams;
  const { data, error } = await db.from('conversations').select('*').eq('building_id', session.buildingId).eq('channel', 'whatsapp').order('last_message_at', { ascending: false, nullsFirst: false });
  check(error);
  const conversations = (data ?? []) as Conversation[];
  const selected = fil ? conversations.find(c => c.id === fil) : conversations[0];
  let messages: Message[] = [];
  if (selected) {
    const result = await db.from('messages').select('*').eq('building_id', session.buildingId).eq('conversation_id', selected.id).order('created_at', { ascending: false }).limit(100);
    check(result.error);
    messages = ((result.data ?? []) as Message[]).reverse();
  }
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  const statuses: Record<string, string> = { ouverte: 'Ouverte', en_attente: 'En attente', resolue: 'Résolue' };
  const live = isWhatsAppLive();
  // Non lu : un message est arrivé après le dernier passage de la loge.
  // Répondre vaut lecture, le trigger `touch_conversation` s'en charge.
  const unread = (conversation: Conversation) => Boolean(conversation.last_message_at)
    && (!conversation.last_read_at || conversation.last_message_at! > conversation.last_read_at);
  const unreadCount = conversations.filter(unread).length;
  return <div className="space-y-6 text-base"><header><h1 className="text-3xl">WhatsApp · Opérationnel</h1>
    <p className="text-grey mt-2">{live
      ? 'Compte WhatsApp Business raccordé : les messages partent et arrivent réellement.'
      : 'Mode simulation : aucun message envoyé à WhatsApp. Les messages entrants seront reçus dès que le compte Business sera raccordé.'}</p>
    <p className="text-grey">{unreadCount === 0 ? 'Aucun fil en attente de lecture.' : `${unreadCount} fil(s) non lu(s).`}</p></header>
    <details className="rounded-lg border border-navy-3 p-4"><summary className="cursor-pointer">Ouvrir une conversation</summary><div className="max-w-lg mt-4"><OperationForm action={openConversation} primary submit="Ouvrir"><ResidentSelect residents={residents} /></OperationForm></div></details>
    <div className="grid md:grid-cols-[250px_1fr] gap-5"><nav aria-label="Conversations" className="space-y-2">{conversations.map(c => <Link key={c.id} href={`/concierge/whatsapp?fil=${c.id}`} aria-current={selected?.id === c.id ? 'page' : undefined} className={`block rounded-lg border p-3 ${selected?.id === c.id ? 'border-cream bg-navy-2' : 'border-navy-3'}`}><span className="block">{names.get(c.resident_id) ?? 'Résident'}{unread(c) && <span className="text-gold-light"> · non lu</span>}</span><span className="text-grey">{statuses[c.status]}</span></Link>)}{!conversations.length && <p>Aucune conversation.</p>}</nav>
    {selected ? <section className="space-y-4"><h2 className="text-2xl">{names.get(selected.resident_id)}</h2>{unread(selected) && <OperationForm action={markConversationRead} submit="Marquer comme lu"><input type="hidden" name="id" value={selected.id} /></OperationForm>}
      <OperationForm action={setConversationStatus} submit="Mettre à jour"><input type="hidden" name="id" value={selected.id} /><label>État du fil<Select key={selected.status} name="status" defaultValue={selected.status}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label></OperationForm>
      <div className="space-y-3 max-h-[500px] overflow-y-auto" aria-label="Historique des 100 derniers messages">{messages.map(m => <article key={m.id} className={`rounded-lg border border-navy-3 bg-navy-2 p-4 ${m.direction === 'sortant' ? 'ml-8' : 'mr-8'}`}><p className="text-grey mb-1">{m.direction === 'sortant' ? 'Conciergerie' : names.get(selected.resident_id)} · {new Date(m.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-grey mt-1">{m.external_message_id?.startsWith('wamid.mock-') ? 'Envoi simulé' : m.delivery_status === 'echec' ? 'Échec de l’envoi' : m.delivery_status}</p></article>)}{!messages.length && <p className="text-grey">Écrivez le premier message.</p>}</div>
      <OperationForm key={selected.id} action={sendOperationalMessage} submit={live ? 'Envoyer' : 'Simuler l’envoi'}><input type="hidden" name="id" value={selected.id} /><label className="block">Message<Textarea name="body" required maxLength={4000} rows={3} /></label></OperationForm>
    </section> : <p className="text-grey">Sélectionnez ou ouvrez une conversation.</p>}</div>
  </div>;
}
