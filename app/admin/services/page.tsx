import { Card, SectionLabel } from '@/components/ui/card';
import { NotificationTemplates } from '@/components/features/notification-templates';
import { ServiceTariffForm } from '@/components/features/service-tariff-form';
import { managerContext } from '@/lib/admin/server';
import { check } from '@/lib/operations/server';
import { commissionCents, serviceOrder } from '@/lib/catalog';
import { serviceLabels } from '@/lib/requests';
import type { BuildingService, NotificationTemplate, ServiceType } from '@/types';

/**
 * Paramétrage services & tarifs (PRD §6.3.4) : catalogue activable par
 * immeuble, grille tarifaire, commissions et modèles de notification.
 * Le revenu et la commission affichés proviennent des demandes terminées.
 */
export default async function ServicesPage() {
  const { db, buildingId, session } = await managerContext();
  const [building, catalog, templates, requests] = await Promise.all([
    db.from('buildings').select('name').eq('id', buildingId).single(),
    db.from('building_services').select('*').eq('building_id', buildingId),
    db.from('notification_templates').select('*').eq('building_id', buildingId).order('label'),
    db.from('service_requests').select('service, amount_cents').eq('building_id', buildingId).eq('status', 'termine'),
  ]);
  check(building.error); check(catalog.error); check(templates.error); check(requests.error);

  const rows = (catalog.data ?? []) as BuildingService[];
  const byService = new Map(rows.map(row => [row.service, row]));
  const revenue = new Map<ServiceType, number>();
  for (const request of requests.data ?? []) {
    revenue.set(request.service, (revenue.get(request.service) ?? 0) + (request.amount_cents ?? 0));
  }
  const commissions = rows.reduce((sum, row) => sum + commissionCents(revenue.get(row.service) ?? 0, row.commission_rate), 0);
  const active = rows.filter(row => row.enabled).length;
  const totalRevenue = [...revenue.values()].reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-7 fade-up">
      <div>
        <h1 className="text-2xl text-cream">Services &amp; tarifs</h1>
        <p className="text-[11px] text-grey mt-1">
          {building.data?.name} · {active} service{active > 1 ? 's' : ''} actif{active > 1 ? 's' : ''} sur {rows.length}
          {session.role === 'super_admin' ? ' · immeuble choisi dans la barre latérale' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { v: `${active}/${rows.length}`, l: 'services activés' },
          { v: `${(totalRevenue / 100).toLocaleString('fr-FR')} €`, l: 'revenus des services terminés' },
          { v: `${(commissions / 100).toLocaleString('fr-FR')} €`, l: 'commissions au taux courant' },
        ].map(({ v, l }) => (
          <Card key={l} className="p-4">
            <p className="font-serif text-cream text-2xl leading-none">{v}</p>
            <SectionLabel className="mt-2 text-[9px]">{l}</SectionLabel>
          </Card>
        ))}
      </div>

      <section className="space-y-2">
        <SectionLabel className="mb-2.5">Catalogue de l’immeuble</SectionLabel>
        {rows.length === 0 && <p className="text-[11px] text-grey">Catalogue non provisionné pour cet immeuble.</p>}
        {serviceOrder.map(service => {
          const row = byService.get(service);
          if (!row) return null;
          const serviceRevenue = revenue.get(service) ?? 0;
          return (
            <ServiceTariffForm
              key={row.id}
              row={row}
              label={serviceLabels[service]}
              revenueCents={serviceRevenue}
              commissionCents={commissionCents(serviceRevenue, row.commission_rate)}
            />
          );
        })}
        <p className="text-[10px] text-grey pt-1">
          Un service désactivé reste consultable dans l’historique : les demandes en cours se terminent normalement, seules les nouvelles sont refusées, y compris par appel direct.
        </p>
      </section>

      <section className="space-y-2">
        <SectionLabel className="mb-2.5">Modèles de notification</SectionLabel>
        <NotificationTemplates templates={(templates.data ?? []) as NotificationTemplate[]} />
      </section>
    </div>
  );
}
