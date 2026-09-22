import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { checkRead } from '@/lib/operations/server';
import { OperationForm } from './operation-form';
import { Field } from './operation-fields';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { IconDoc } from '@/components/ui/icons';
import { Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { receiveBuildingQuote, emailBuildingQuote } from '@/app/actions/building-documents';
import { formatDateTime, formatMoney, count } from '@/lib/format';

/** Devis et documents des parties communes partagés avec le syndic (PRD §6.1.8). */
export async function BuildingDocuments() {
  const session = await getSession();
  if (!session || !['syndic', 'concierge', 'admin', 'super_admin'].includes(session.role)) throw new Error('Accès refusé.');
  const staff = session.role !== 'syndic';
  const db = await createClient();
  const { data, error } = await db.from('building_documents').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false });
  checkRead(error);
  const deliveries = staff ? await db.from('building_document_deliveries').select('document_id, recipient, created_at, simulated').eq('building_id', session.buildingId).order('created_at', { ascending: false }) : null;
  if (deliveries) checkRead(deliveries.error);
  const total = (data ?? []).reduce((sum, doc) => sum + (doc.amount_cents ?? 0), 0);
  return <div className="space-y-6 fade-up">
    <PageHeader
      title={staff ? 'Documents syndic' : 'Documents'}
      subtitle={staff
        ? `Devis prestataires et rapports des parties communes, visibles par le syndic. ${count(data?.length ?? 0, 'document')} · ${formatMoney(total, { round: true })} de devis cumulés.`
        : `Devis et rapports transmis par la conciergerie pour les parties communes. ${count(data?.length ?? 0, 'document')}.`}
    />
    {staff && <Disclosure summary="Enregistrer un devis reçu par email" hint="Visible par le syndic">
      <div className="max-w-2xl space-y-3">
        <p className="text-[11.5px] text-muted">Réception automatique des emails non connectée : recopiez les informations du devis reçu. Réservez cet espace aux parties communes, jamais aux demandes individuelles.</p>
        <OperationForm action={receiveBuildingQuote} primary submit="Enregistrer et partager">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Objet du devis" name="title" required maxLength={200} placeholder="Remplacement moteur porte parking" />
            <Field label="Prestataire" name="provider" required maxLength={200} />
            <Field label="Email de l’expéditeur" name="email_from" type="email" required />
            <Field label="Référence du mail ou du devis" name="email_message_id" required maxLength={500} placeholder="DEV-2026-118" />
            <Field label="Montant (€)" name="amount" inputMode="decimal" placeholder="4 850,00" />
          </div>
          <label className="block space-y-1 text-[12.5px] text-ink"><span>Contenu du devis</span><Textarea name="body" required maxLength={10000} rows={5} /></label>
        </OperationForm>
      </div>
    </Disclosure>}
    {!data?.length && <EmptyState title="Aucun document partagé pour cet immeuble." description={staff ? 'Enregistrez un devis reçu pour le transmettre au syndic.' : 'La conciergerie vous transmettra ici les devis des parties communes.'} />}
    <div className="grid gap-3 lg:grid-cols-2">
    {data?.map(doc => {
      const sent = deliveries?.data?.filter(d => d.document_id === doc.id) ?? [];
      return <article key={doc.id} className="rounded-[8px] border border-line bg-surface p-4 space-y-2.5 shadow-[0_1px_2px_rgba(10,22,40,.04)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] leading-snug flex items-center gap-2"><IconDoc size={14} className="text-gold-deep shrink-0" />{doc.title}</h3>
          <Badge tone={doc.amount_cents === null ? 'grey' : 'gold'}>{doc.amount_cents === null ? 'Montant à confirmer' : formatMoney(doc.amount_cents)}</Badge>
        </div>
        <p className="text-[11.5px] text-muted">{doc.provider} · reçu {formatDateTime(doc.created_at)}{staff && doc.email_from ? ` · ${doc.email_from}` : ''}</p>
        <p className="text-[12.5px] text-ink/85 whitespace-pre-wrap break-words leading-relaxed">{doc.body}</p>
        {staff && <Disclosure variant="inline" summary={sent.length ? `Transmis par email (${sent.length})` : 'Transmettre par email'}>
          <div className="space-y-3">
            <OperationForm action={emailBuildingQuote} submit="Envoyer au syndic (simulé)"><input type="hidden" name="id" value={doc.id} /><Field label="Email du syndic" name="email" type="email" required placeholder="contact@cabinet-syndic.fr" /></OperationForm>
            {sent.map((d, i) => <p key={i} className="text-[11px] text-muted">{d.simulated ? 'Envoi simulé' : 'Envoyé'} à {d.recipient} · {formatDateTime(d.created_at)}</p>)}
          </div>
        </Disclosure>}
      </article>;
    })}
    </div>
  </div>;
}
