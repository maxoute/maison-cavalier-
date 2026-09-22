import Link from 'next/link';
import { staffContext, residentsForStaff, checkRead } from '@/lib/operations/server';
import { parcelLabels, pressingLabels } from '@/lib/operations/shared';
import { createParcel, createPressing, advanceOperation, uploadParcelPhoto, rescheduleParcel } from '@/app/actions/operations';
import { formatDateTime, formatRelative, toLocalInputValue, count } from '@/lib/format';
import { ParcelReminders } from './parcel-reminders';
import { OperationForm } from './operation-form';
import { Field, ResidentSelect } from './operation-fields';
import { ServiceSchedule } from './service-schedule';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { IconCamera } from '@/components/ui/icons';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { cn } from '@/lib/cn';
import type { Parcel, PressingOrder } from '@/types';

const statusTone: Record<string, 'blue' | 'grey' | 'orange' | 'green' | 'red'> = {
  recu: 'blue', stocke: 'grey', notifie: 'orange', remis: 'green', retourne: 'red',
  collecte: 'blue', chez_le_pressing: 'grey', pret: 'orange', livre: 'green',
};
const nextLabels: Record<string, string> = {
  recu: 'Ranger en loge', stocke: 'Notifier le résident', notifie: 'Remettre au résident',
  collecte: 'Déposer au pressing', chez_le_pressing: 'Marquer prêt', pret: 'Livrer au résident',
};

export async function ServiceRegister({ kind }: { kind: 'parcels' | 'pressing_orders' }) {
  const { db, session, now } = await staffContext();
  const residents = await residentsForStaff();
  const { data, error } = await db.from(kind).select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false });
  checkRead(error);
  const rows = (data ?? []) as (Parcel | PressingOrder)[];
  const parcel = kind === 'parcels';
  const labels = parcel ? parcelLabels : pressingLabels;
  const doneStatuses = ['remis', 'retourne', 'livre'];
  const active = rows.filter(row => !doneStatuses.includes(row.status));
  const names = new Map(residents.map(r => [r.id, r.full_name]));
  // Les preuves vivent dans un bucket privé : chaque photo est servie par une
  // URL signée de courte durée, jamais par un lien public.
  const photoPaths = rows.flatMap(row => ('photo_path' in row && row.photo_path ? [row.photo_path] : []));
  const photos = new Map<string, string>();
  if (photoPaths.length) {
    const signed = await db.storage.from('colis').createSignedUrls(photoPaths, 120);
    for (const entry of signed.data ?? []) if (entry.path && entry.signedUrl) photos.set(entry.path, entry.signedUrl);
  }
  const reminderDue = parcel ? rows.filter(row => 'received_at' in row && !row.reminder_sent_at
    && !['remis', 'retourne'].includes(row.status)
    && now - Date.parse(row.received_at) > 2 * 86_400_000).length : 0;
  const deadlineOf = (row: Parcel | PressingOrder) => 'scheduled_delivery_at' in row ? row.scheduled_delivery_at : row.expected_return_at;
  const late = active.filter(row => { const d = deadlineOf(row); return d && Date.parse(d) < now; }).length;
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const today = active.filter(row => { const d = deadlineOf(row); return d && d.slice(0, 10) === todayKey; }).length;
  const ready = active.filter(row => row.status === (parcel ? 'notifie' : 'pret')).length;
  const monthDone = rows.filter(row => doneStatuses.includes(row.status)).length;

  return <div className="space-y-6 fade-up">
    <PageHeader
      title={parcel ? 'Colis' : 'Pressing'}
      subtitle={parcel
        ? 'Réception, rangement, notification et remise en deux clics. Photo à la réception comme preuve en cas de litige.'
        : 'Collecte, dépôt chez le prestataire, retour et livraison. Chaque étape notifie le résident.'}
    />
    <StatGrid>
      <StatCard value={active.length} label="en cours" accent="blue" />
      <StatCard value={ready} label={parcel ? 'à remettre' : 'prêts à livrer'} accent="orange" />
      <StatCard value={today} label="prévus aujourd’hui" accent="gold" />
      <StatCard value={late} label="en retard" accent={late ? 'red' : 'green'} hint={`${count(monthDone, parcel ? 'colis clôturé' : 'commande clôturée', parcel ? 'colis clôturés' : 'commandes clôturées')}`} />
    </StatGrid>
    {parcel && <ParcelReminders due={reminderDue} />}
    <Disclosure summary={parcel ? 'Réceptionner un colis' : 'Nouvelle collecte'} hint={parcel ? 'Scan du code ou saisie manuelle' : 'Articles confiés au pressing'}>
      <div className="max-w-2xl"><OperationForm action={parcel ? createParcel : createPressing} primary submit={parcel ? 'Enregistrer la réception' : 'Enregistrer la collecte'}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResidentSelect residents={residents} />
          {parcel ? <>
            <Field label="Code de suivi (scan ou saisie)" name="tracking_code" required maxLength={200} placeholder="1Z999AA10123456784" />
            <Field label="Transporteur" name="carrier" placeholder="Chronopost, UPS, DHL…" />
            <Field label="Emplacement en loge" name="storage_location" placeholder="Étagère A, cave n°12…" />
            <Field label="Remise prévue (heure de Paris)" name="scheduled_delivery_at" type="datetime-local" />
          </> : <>
            <Field label="Prestataire" name="provider" required placeholder="Pressing Montaigne" />
            <Field label="Articles confiés" name="items" required placeholder="Chemises, costume…" />
            <Field label="Nombre de pièces" name="quantity" type="number" min={1} max={1000} defaultValue={1} required />
            <Field label="Retour prévu (heure de Paris)" name="expected_return_at" type="datetime-local" />
          </>}
          <div className="sm:col-span-2"><Field label="Notes" name="notes" placeholder="Fragile, signature demandée…" /></div>
        </div>
      </OperationForm></div>
    </Disclosure>
    <ServiceSchedule now={now} operations={active.map(row => ({
      id: row.id,
      resident: names.get(row.resident_id) ?? 'Résident',
      deadline: deadlineOf(row),
      status: labels[row.status],
    }))} />
    <SectionTitle hint={`${count(rows.length, parcel ? 'colis' : 'commande', parcel ? 'colis' : 'commandes')} au registre`}>Registre</SectionTitle>
    {!rows.length && <EmptyState title={`Aucun ${parcel ? 'colis' : 'pressing'} enregistré.`} description="Utilisez le formulaire ci-dessus pour la première opération." />}
    <div className="grid gap-3 md:grid-cols-2">{rows.map(row => {
      const deadline = deadlineOf(row);
      const done = doneStatuses.includes(row.status);
      const isLate = Boolean(deadline) && !done && Date.parse(deadline!) < now;
      const residentName = names.get(row.resident_id) ?? 'Résident';
      return <article key={row.id} id={`operation-${row.id}`} className={cn('scroll-mt-6 rounded-[8px] border bg-surface p-4 space-y-3 shadow-[0_1px_2px_rgba(10,22,40,.04)]', isLate ? 'border-red/40' : 'border-line', done && 'opacity-80')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] leading-snug"><Link href={`/concierge/residents/${row.resident_id}`} className="hover:text-gold-deep transition-colors duration-300">{residentName}</Link></h3>
            <p className="text-[12px] text-ink/80 mt-0.5">
              {'tracking_code' in row
                ? <>{row.carrier || 'Transporteur non renseigné'} · <span className="font-mono text-[11px]">{row.tracking_code}</span>{row.storage_location ? ` · ${row.storage_location}` : ''}</>
                : <>{row.provider} · {count(row.item_count, 'pièce')} · {row.items.map(i => `${i.quantity} × ${i.label}`).join(', ')}</>}
            </p>
          </div>
          <Badge tone={statusTone[row.status] ?? 'grey'}>{labels[row.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>{parcel ? 'Reçu' : 'Collecté'} {formatDateTime(row.created_at)}</span>
          {deadline && <span className={isLate ? 'text-red font-medium' : ''}>· {parcel ? 'Remise' : 'Retour'} prévu{parcel ? 'e' : ''} {formatDateTime(deadline)}{isLate ? ` (${formatRelative(deadline, now)})` : ''}</span>}
          {'reminder_sent_at' in row && row.reminder_sent_at && <span>· Rappel envoyé {formatDateTime(row.reminder_sent_at)}</span>}
        </div>
        {row.notes && <p className="text-[12px] text-ink/80 whitespace-pre-wrap break-words">{row.notes}</p>}
        {'photo_path' in row && row.photo_path && photos.get(row.photo_path) && (
          // URL signée de courte durée sur un bucket privé : `next/image`
          // la mettrait en cache et demanderait d'autoriser l'hôte Supabase.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos.get(row.photo_path)} alt={`Preuve de réception du colis de ${residentName}`} className="max-h-48 w-full rounded-[8px] border border-line object-contain bg-surface-2" />
        )}
        {!done && <div className="flex flex-wrap items-center gap-2 pt-1">
          <OperationForm action={advanceOperation} variant="ghost" submit={`${nextLabels[row.status] ?? 'Étape suivante'} →`}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value={row.status} /></OperationForm>
          {parcel && <OperationForm action={advanceOperation} submit="Retour transporteur"><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="status" value={row.status} /><input type="hidden" name="target" value="retourne" /></OperationForm>}
        </div>}
        {'photo_path' in row && <div className="flex flex-wrap gap-4 pt-1">
          <Disclosure variant="inline" summary={<span className="inline-flex items-center gap-1"><IconCamera size={12} />{row.photo_path ? 'Remplacer la photo' : 'Ajouter une photo'}</span>}>
            <OperationForm action={uploadParcelPhoto} submit="Enregistrer la photo">
              <input type="hidden" name="id" value={row.id} />
              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" required aria-label="Photo du colis" className="block w-full text-[12px] text-ink file:mr-3 file:rounded-[24px] file:border file:border-line file:bg-surface file:px-4 file:py-1.5 file:text-[11.5px] file:text-ink file:cursor-pointer" />
              <p className="text-[11px] text-muted">Depuis la tablette de la loge, le bouton ouvre directement l’appareil photo. JPEG, PNG ou WebP, 5 Mo maximum.</p>
            </OperationForm>
          </Disclosure>
          {!done && <Disclosure variant="inline" summary="Modifier le créneau de remise">
            <OperationForm action={rescheduleParcel} submit="Mettre à jour le créneau">
              <input type="hidden" name="id" value={row.id} />
              <Field label="Remise prévue (heure de Paris)" name="scheduled_delivery_at" type="datetime-local" defaultValue={toLocalInputValue(row.scheduled_delivery_at)} />
              <p className="text-[11px] text-muted">Laisser vide retire le colis du planning.</p>
            </OperationForm>
          </Disclosure>}
        </div>}
      </article>;
    })}</div>
  </div>;
}
