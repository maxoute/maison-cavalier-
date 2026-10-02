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
import { buildTemplateMessage } from '@/lib/whatsapp/templates';
import { serviceWindowClosesAt } from '@/lib/whatsapp/window';
import { isWhatsAppLive } from '@/lib/whatsapp';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Conversation, Message } from '@/types';

const statuses: Record<string, string> = { ouverte: 'Ouverte', en_attente: 'En attente', resolue: 'Résolue' };
const statusTone: Record<string, 'green' | 'orange' | 'grey'> = { ouverte: 'green', en_attente: 'orange', resolue: 'grey' };
const deliveryLabels: Record<string, string> = { en_attente: 'En attente d’envoi', envoi: 'Envoi en cours', envoye: 'Envoyé', livre: 'Livré', lu: 'Lu', echec: 'Échec de l’envoi' };
const automaticLabels: Record<string, string> = {
  colis_recu: 'Colis disponible', rappel_colis_non_retire: 'Rappel colis', pressing_pret: 'Pressing prêt',
  annonce_urgente: 'Annonce urgente', recommandation_partagee: 'Recommandation',
};

interface AutomaticMessage {
  id: string; event: string; payload: Record<string, unknown>; sent_at: string;
  delivery_status: string; delivery_error: string | null; external_message_id: string | null;
}
type TimelineEntry = { kind: 'message'; at: string; message: Message } | { kind: 'auto'; at: string; auto: AutomaticMessage };

export default async function Page({ searchParams }: { searchParams: Promise<{ fil?: string }> }) {
  const { db, session, now } = await staffContext();
  const residents = await residentsForStaff();
  const { fil } = await searchParams;
  const { data, error } = await db.from('conversations').select('*').eq('building_id', session.buildingId).eq('channel', 'whatsapp').order('last_message_at', { ascending: false, nullsFirst: false });
  checkRead(error);
  const conversations = (data ?? []) as Conversation[];
  const selected = fil ? conversations.find(c => c.id === fil) : conversations[0];
  let messages: Message[] = [];
  let automatic: AutomaticMessage[] = [];
  let buildingName = '';
  if (selected) {
    const [result, notifications, building] = await Promise.all([
      db.from('messages').select('*').eq('building_id', session.buildingId).eq('conversation_id', selected.id).order('created_at', { ascending: false }).limit(100),
      // Messages automatiques (file WhatsApp) : ils s'affichent dans le fil
      // pour que la loge sache ce que le résident a reçu sans elle.
      db.from('notifications').select('id, event, payload, sent_at, delivery_status, delivery_error, external_message_id')
        .eq('building_id', session.buildingId).eq('recipient_resident_id', selected.resident_id).eq('channel', 'whatsapp')
        .not('delivery_status', 'is', null).order('sent_at', { ascending: false }).limit(50),
      db.from('buildings').select('name').eq('id', session.buildingId).maybeSingle(),
    ]);
    checkRead(result.error);
    checkRead(notifications.error);
    messages = ((result.data ?? []) as Message[]).reverse();
    automatic = (notifications.data ?? []) as AutomaticMessage[];
    buildingName = building.data?.name ?? '';
  }
  const timeline: TimelineEntry[] = [
    ...messages.map(message => ({ kind: 'message' as const, at: message.created_at, message })),
    ...automatic.map(auto => ({ kind: 'auto' as const, at: auto.sent_at, auto })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const lastInbound = [...messages].reverse().find(m => m.direction === 'entrant')?.created_at;
  const windowClosesAt = serviceWindowClosesAt(lastInbound, now);
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
          {timeline.map(entry => {
            if (entry.kind === 'auto') {
              const auto = entry.auto;
              const preview = buildTemplateMessage({ event: auto.event, payload: auto.payload ?? {}, residentName: selectedName, buildingName })?.preview
                ?? String(auto.payload?.body ?? '');
              const status = auto.external_message_id?.startsWith('wamid.mock-') ? 'Envoi simulé' : deliveryLabels[auto.delivery_status] ?? auto.delivery_status;
              return <article key={`auto-${auto.id}`} className="flex justify-end">
                <div className="max-w-[78%] rounded-[12px] rounded-br-[3px] border border-dashed border-line bg-surface-2/70 px-3.5 py-2.5">
                  <p className="mb-1 text-[9.5px] uppercase tracking-[1.2px] text-muted">Message automatique · {automaticLabels[auto.event] ?? auto.event}</p>
                  <p className="text-[12.5px] text-ink/85 whitespace-pre-wrap break-words leading-relaxed">{preview}</p>
                  <p className={cn('mt-1 text-[10px]', auto.delivery_status === 'echec' ? 'text-red' : 'text-muted')}>
                    Conciergerie · {formatDateTime(auto.sent_at)} · {status}{auto.delivery_status === 'echec' && auto.delivery_error ? ` : ${auto.delivery_error}` : ''}
                  </p>
                </div>
              </article>;
            }
            const m = entry.message;
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
          {!timeline.length && <EmptyState title="Aucun message dans ce fil." description="Écrivez le premier message ci-dessous." />}
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
          {live && <p className={cn('mb-2 text-[11px]', windowClosesAt ? 'text-muted' : 'text-orange')}>
            {windowClosesAt
              ? `Réponse libre possible jusqu’au ${formatDateTime(windowClosesAt.toISOString())} (24 h après le dernier message du résident).`
              : 'Fenêtre de 24 h fermée : WhatsApp n’accepte plus de réponse libre tant que le résident n’a pas écrit. Les messages automatiques continuent de partir.'}
          </p>}
          <OperationForm key={selected.id} action={sendOperationalMessage} primary submit={live ? 'Envoyer' : 'Simuler l’envoi'}>
            <input type="hidden" name="id" value={selected.id} />
            <Textarea name="body" required maxLength={4000} rows={2} placeholder="Écrire au résident…" aria-label="Message" className="text-[12.5px]" />
          </OperationForm>
        </div>
      </section> : <EmptyState title="Sélectionnez ou ouvrez une conversation." description="Chaque résident dispose d’un fil WhatsApp unique, rattaché à sa fiche." />}
    </div>
  </div>;
}
