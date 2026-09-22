import { AnnouncementForm } from '@/components/features/announcement-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconAnnounce } from '@/components/ui/icons';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { staffContext, checkRead } from '@/lib/operations/server';
import { formatDateTime, count } from '@/lib/format';

const channelLabels: Record<string, string> = { push: 'Push', email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' };

export default async function AnnouncementsPage() {
  const { db, session } = await staffContext();
  const groups = new Map<string, { floor: string | null; owner_status: string; count: number }>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('residents').select('floor, owner_status').eq('building_id', session.buildingId).order('id').range(offset, offset + 499);
    checkRead(error);
    for (const resident of data ?? []) {
      const key = JSON.stringify([resident.floor, resident.owner_status]);
      const group = groups.get(key) ?? { ...resident, count: 0 };
      group.count += 1; groups.set(key, group);
    }
    if (!data || data.length < 500) break;
  }
  const { data: announcements, error } = await db.from('announcements').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).limit(100);
  checkRead(error);
  // Modèles paramétrés pour cet immeuble par l'administration (PRD §6.3.4).
  const { data: templates, error: templatesError } = await db.from('notification_templates')
    .select('slug, label, title, body').eq('building_id', session.buildingId).order('label');
  checkRead(templatesError);
  const total = [...groups.values()].reduce((sum, group) => sum + group.count, 0);
  return <div className="space-y-6 fade-up">
    <PageHeader title="Annonces" subtitle={`Communication groupée : tous les résidents, un étage ou un statut. ${count(total, 'résident')} joignables · canaux simulés jusqu’au raccordement des comptes.`} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_1fr] items-start">
      <Card>
        <CardHeader><CardTitle>Nouvelle annonce</CardTitle><span className="text-[11px] text-muted">Modèles : travaux, incident, événement</span></CardHeader>
        <CardContent><AnnouncementForm audience={[...groups.values()]} templates={templates ?? []} /></CardContent>
      </Card>
      <section className="space-y-3">
        <SectionTitle hint={announcements?.length ? `${count(announcements.length, 'diffusion')}` : undefined}>Historique</SectionTitle>
        {!announcements?.length && <EmptyState title="Aucune annonce diffusée pour le moment." description="La première diffusion apparaîtra ici avec son audience et ses canaux." />}
        {announcements?.map(announcement => <article key={announcement.id} className="rounded-[8px] border border-line bg-surface p-4 space-y-2 shadow-[0_1px_2px_rgba(10,22,40,.04)]">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] leading-snug flex items-center gap-2"><IconAnnounce size={14} className="text-gold-deep shrink-0" />{announcement.title}</h3>
            {announcement.urgent && <Badge tone="red">Urgente</Badge>}
          </div>
          <p className="text-[12.5px] text-ink/85 whitespace-pre-wrap break-words leading-relaxed">{announcement.body}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span>{announcement.target_floor ? `Étage ${announcement.target_floor}` : 'Tous les étages'} · {announcement.target_owner_status === 'proprietaire' ? 'Propriétaires' : announcement.target_owner_status === 'locataire' ? 'Locataires' : 'Tous les résidents'}</span>
            <span>· {count(announcement.recipient_count, 'destinataire')}</span>
            <span>· {(announcement.channels as string[]).map(channel => channelLabels[channel] ?? channel).join(', ')}</span>
            <span>· {formatDateTime(announcement.created_at)}</span>
          </div>
        </article>)}
      </section>
    </div>
  </div>;
}
