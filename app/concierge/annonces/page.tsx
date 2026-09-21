import { AnnouncementForm } from '@/components/features/announcement-form';
import { staffContext, check } from '@/lib/operations/server';

export default async function AnnouncementsPage() {
  const { db, session } = await staffContext();
  const groups = new Map<string, { floor: string | null; owner_status: string; count: number }>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('residents').select('floor, owner_status').eq('building_id', session.buildingId).order('id').range(offset, offset + 499);
    check(error);
    for (const resident of data ?? []) {
      const key = JSON.stringify([resident.floor, resident.owner_status]);
      const group = groups.get(key) ?? { ...resident, count: 0 };
      group.count += 1; groups.set(key, group);
    }
    if (!data || data.length < 500) break;
  }
  const { data: announcements, error } = await db.from('announcements').select('*').eq('building_id', session.buildingId).order('created_at', { ascending: false }).limit(100);
  check(error);
  // Modèles paramétrés pour cet immeuble par l'administration (PRD §6.3.4).
  const { data: templates, error: templatesError } = await db.from('notification_templates')
    .select('slug, label, title, body').eq('building_id', session.buildingId).order('label');
  check(templatesError);
  return <div className="space-y-6 text-base">
    <header><h1 className="text-3xl">Annonces</h1><p className="mt-2 text-grey">Informez les résidents de votre immeuble. Tous les canaux sont actuellement simulés.</p></header>
    <section className="max-w-2xl rounded-lg border border-navy-3 p-5"><h2 className="mb-4 text-2xl">Nouvelle annonce</h2><AnnouncementForm audience={[...groups.values()]} templates={templates ?? []} /></section>
    <section className="space-y-4"><h2 className="text-2xl">Historique des 100 dernières annonces</h2>
      {!announcements?.length && <p className="text-grey">Aucune annonce diffusée.</p>}
      {announcements?.map(announcement => <article key={announcement.id} className="rounded-lg border border-navy-3 bg-navy-2 p-5 space-y-3">
        <h3 className="text-xl">{announcement.title}{announcement.urgent && <span className="ml-3 text-base text-red">Urgente</span>}</h3>
        <p className="whitespace-pre-wrap break-words">{announcement.body}</p>
        <p className="text-grey">{announcement.target_floor ? `Étage ${announcement.target_floor}` : 'Tous les étages'} · {announcement.target_owner_status === 'proprietaire' ? 'Propriétaires' : announcement.target_owner_status === 'locataire' ? 'Locataires' : 'Tous les résidents'} · {announcement.recipient_count} destinataire(s)</p>
        <p className="text-grey">Diffusion simulée : {announcement.channels.join(', ')} · {new Date(announcement.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC</p>
      </article>)}
    </section>
  </div>;
}
