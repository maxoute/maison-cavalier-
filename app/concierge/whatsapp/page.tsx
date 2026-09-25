import Link from 'next/link';
import { staffContext, residentsForStaff, checkRead } from '@/lib/operations/server';
import { OperationForm } from '@/components/features/operation-form';
import { ResidentSelect } from '@/components/features/operation-fields';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { Select, Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { openConversation, sendOperationalMessage, setConversationStatus, markConversationRead, simulateInboundMessage } from '@/app/actions/operations';
import { serviceLabels } from '@/lib/requests';
import { isWhatsAppLive } from '@/lib/whatsapp';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Conversation, Message } from '@/types';

const statuses: Record<string, string> = { ouverte: 'Ouverte', en_attente: 'En attente', resolue: 'Résolue' };
const statusTone: Record<string, 'green' | 'orange' | 'grey'> = { ouverte: 'green', en_attente: 'orange', resolue: 'grey' };
const deliveryLabels: Record<string, string> = { en_attente: 'En attente d’envoi', envoye: 'Envoyé', livre: 'Livré', lu: 'Lu', echec: 'Échec de l’envoi' };

export default async function Page({ searchParams }: { searchParams: Promise<{ fil?: string }> }) {
  const { db, session } = await staffContext();
  const residents = await residentsForStaff();
  const { fil } = await searchParams;
  const { data, error } = await db.from('conversations').select('*').eq('building_id', session.buildingId).eq('channel', 'whatsapp').order('last_message_at', { ascending: false, nullsFirst: false });
  checkRead(error);
  const conversations = (data ?? []) as Conversation[];
  const selected = fil ? conversations.find(c => c.id === fil) : conversations[0];
  let messages: Message[] = [];
  if (selected) {
    const result = await db.from('messages').select('*').eq('building_id', session.buildingId).eq('conversation_id', selected.id).order('created_at', { ascending: false }).limit(100);
    checkRead(result.error);
    messages = ((result.data ?? []) as Message[]).reverse();
  }
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  const live = isWhatsAppLive();
  // Non lu : un message est arrivé après le dernier passage de la loge.
  // Répondre vaut lecture, le trigger `touch_conversation` s'en charge.
  const unread = (conversation: Conversation) => Boolean(conversation.last_message_at)
    && (!conversation.last_read_at || conversation.last_message_at! > conversation.last_read_at);
  const unreadCount = conversations.filter(unread).length;
  const selectedName = selected ? names.get(selected.resident_id) ?? 'Résident' : '';

  return <div className="space-y-5 fade-up">
    <PageHeader
      title="WhatsApp"
      subtitle={<>{unreadCount === 0 ? 'Aucun fil en attente de lecture.' : `${unreadCount} fil${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}.`} {live
        ? 'Compte WhatsApp Business raccordé : les messages partent et arrivent réellement.'
        : 'Canal résident opérationnel · envoi simulé tant que le compte WhatsApp Business n’est pas raccordé.'}</>}
      actions={<Badge tone={live ? 'green' : 'grey'}>{live ? 'Connecté' : 'Simulation'}</Badge>}
    />
    <Disclosure summary="Ouvrir une conversation" hint="Un fil par résident">
      <div className="max-w-md"><OperationForm action={openConversation} primary submit="Ouvrir le fil"><ResidentSelect residents={residents} /></OperationForm></div>
    </Disclosure>
    <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
      <nav aria-label="Conversations" className="rounded-[8px] border border-line bg-surface p-1.5 space-y-0.5 max-h-[640px] overflow-y-auto">
        {conversations.map(c => {
          const isSelected = selected?.id === c.id;
          const name = names.get(c.resident_id) ?? 'Résident';
          return <Link key={c.id} href={`/concierge/whatsapp?fil=${c.id}`} aria-current={isSelected ? 'page' : undefined}
            className={cn('flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 transition-colors duration-300', isSelected ? 'bg-gold/[0.09]' : 'hover:bg-surface-2')}>
            <Avatar name={name} size={30} />
            <span className="min-w-0 flex-1">
              <span className={cn('flex items-center justify-between gap-2 text-[12.5px]', unread(c) ? 'font-semibold text-ink' : 'text-ink')}>
                <span className="truncate">{name}</span>
                {unread(c) && <span className="w-2 h-2 rounded-full bg-gold shrink-0" aria-label="Non lu" />}
              </span>
              <span className="flex items-center justify-between gap-2 text-[10.5px] text-muted">
                <span>{statuses[c.status]}</span>
                {c.last_message_at && <span>{formatRelative(c.last_message_at)}</span>}
              </span>
            </span>
          </Link>;
        })}
        {!conversations.length && <p className="p-3 text-[12px] text-muted">Aucune conversation.</p>}
      </nav>
      {selected ? <section className="rounded-[8px] border border-line bg-surface flex flex-col min-h-[520px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={selectedName} size={34} />
            <div className="min-w-0">
              <h2 className="text-[15px] leading-tight truncate"><Link href={`/concierge/residents/${selected.resident_id}`} className="hover:text-gold-deep transition-colors duration-300">{selectedName}</Link></h2>
              <p className="text-[10.5px] text-muted flex items-center gap-1.5"><Badge tone={statusTone[selected.status]}>{statuses[selected.status]}</Badge>{selected.last_message_at && <span>dernier message {formatRelative(selected.last_message_at)}</span>}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unread(selected) && <OperationForm action={markConversationRead} submit="Marquer comme lu"><input type="hidden" name="id" value={selected.id} /></OperationForm>}
            <OperationForm action={setConversationStatus} submit="Changer l’état"><input type="hidden" name="id" value={selected.id} />
              <Select key={selected.status} name="status" defaultValue={selected.status} aria-label="État du fil" className="py-1.5 text-[12px] w-40">{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
            </OperationForm>
          </div>
        </header>
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4 max-h-[460px] bg-[radial-gradient(circle_at_top,rgba(184,146,42,.04),transparent_60%)]" aria-label="Historique des 100 derniers messages">
          {messages.map(m => {
            const outgoing = m.direction === 'sortant';
            const delivery = m.external_message_id?.startsWith('wamid.mock-') ? 'Envoi simulé' : deliveryLabels[m.delivery_status] ?? m.delivery_status;
            return <article key={m.id} className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-[12px] border px-3.5 py-2.5 shadow-[0_2px_10px_-8px_rgba(10,22,40,.25)]', outgoing ? 'bg-gradient-to-br from-gold/[0.14] to-gold/[0.05] border-gold/25 rounded-br-[3px]' : 'bg-surface border-line rounded-bl-[3px]')}>
                <p className="text-[12.5px] text-ink whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.delivery_status === 'echec' ? 'text-red' : 'text-muted')}>{outgoing ? 'Conciergerie' : selectedName} · {formatDateTime(m.created_at)}{outgoing ? ` · ${delivery}` : ''}</p>
                {!outgoing && m.ai_analysis && <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted">
                  {m.ai_analysis.action === 'creer_demande' && m.request_id
                    ? <Link href="/concierge" className="inline-flex items-center gap-1.5 hover:text-ink transition-colors duration-300"><Badge tone="green">Demande créée</Badge>{m.ai_analysis.service ? serviceLabels[m.ai_analysis.service] : ''}{m.ai_analysis.priority === 'urgente' ? ' · urgente' : ''}</Link>
                    : m.ai_analysis.action === 'a_traiter' ? <Badge tone="orange">À traiter</Badge>
                    : m.ai_analysis.action === 'erreur' ? <Badge tone="red">IA indisponible</Badge>
                    : <Badge tone="grey">IA · aucune action</Badge>}
                  <span>{m.ai_analysis.summary}</span>
                </p>}
              </div>
            </article>;
          })}
          {!messages.length && <EmptyState title="Aucun message dans ce fil." description="Écrivez le premier message ci-dessous." />}
        </div>
        {!live && <div className="border-t border-line px-4 py-2.5">
          <Disclosure summary="Simuler un message reçu" hint="Démo : le message est analysé par l’IA, qui crée une demande si besoin">
            <OperationForm key={`sim-${selected.id}`} action={simulateInboundMessage} submit="Recevoir le message">
              <input type="hidden" name="id" value={selected.id} />
              <Textarea name="body" required maxLength={4000} rows={2} placeholder={`Message de ${selectedName}…`} aria-label="Message reçu" className="text-[12.5px]" />
            </OperationForm>
          </Disclosure>
        </div>}
        <div className="border-t border-line px-4 py-3">
          <OperationForm key={selected.id} action={sendOperationalMessage} primary submit={live ? 'Envoyer' : 'Simuler l’envoi'}>
            <input type="hidden" name="id" value={selected.id} />
            <Textarea name="body" required maxLength={4000} rows={2} placeholder="Écrire au résident…" aria-label="Message" className="text-[12.5px]" />
          </OperationForm>
        </div>
      </section> : <EmptyState title="Sélectionnez ou ouvrez une conversation." description="Chaque résident dispose d’un fil WhatsApp unique, rattaché à sa fiche." />}
    </div>
  </div>;
}
