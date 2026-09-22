import { BuildingOnboardingForm } from '@/components/features/building-onboarding-form';
import { SwitchBuildingButton } from '@/components/features/switch-building-button';
import { Badge } from '@/components/ui/badge';
import { Disclosure } from '@/components/ui/disclosure';
import { IconBuilding, IconGrid, IconTag, IconUsers } from '@/components/ui/icons';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { StatCard, StatGrid } from '@/components/ui/stat';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { managerContext } from '@/lib/admin/server';
import { count, formatDate } from '@/lib/format';
import { checkRead } from '@/lib/operations/server';
import type { Building } from '@/types';

/**
 * Parc immobilier et onboarding (PRD §6.3.2) : le super-admin voit tous
 * les immeubles et en crée un — avec son concierge — en moins de cinq
 * minutes ; l'admin d'immeuble n'y retrouve que le sien. Le périmètre
 * vient de la RLS, pas d'un filtre applicatif.
 */

const SERVICES_PER_BUILDING = 5;

const planLabels: Record<string, string> = {
  essentiel: 'Essentiel',
  premium: 'Premium',
  signature: 'Signature',
};
const planTones = { essentiel: 'grey', premium: 'blue', signature: 'gold' } as const;

export default async function BuildingsPage() {
  const { db, session, buildingId } = await managerContext();

  const [buildings, residents, staff, requests, services] = await Promise.all([
    db.from('buildings').select('id, name, address, b2b_plan, enabled_services, created_at').order('name'),
    db.from('residents').select('building_id'),
    db.from('profiles').select('building_id, role'),
    db.from('service_requests').select('building_id, status'),
    db.from('building_services').select('building_id, enabled'),
  ]);
  checkRead(buildings.error);
  checkRead(residents.error);
  checkRead(staff.error);
  checkRead(requests.error);
  checkRead(services.error);

  const rows = (buildings.data ?? []) as Building[];
  const tally = (list: { building_id: string }[]) =>
    list.reduce<Map<string, number>>((acc, row) => acc.set(row.building_id, (acc.get(row.building_id) ?? 0) + 1), new Map());

  const residentsPer = tally(residents.data ?? []);
  const staffPer = tally((staff.data ?? []).filter((row) => row.role === 'concierge' || row.role === 'admin'));
  const openPer = tally((requests.data ?? []).filter((row) => row.status !== 'termine'));
  const servicesPer = tally((services.data ?? []).filter((row) => row.enabled));

  const total = (map: Map<string, number>) => [...map.values()].reduce((sum, value) => sum + value, 0);
  const isSuperAdmin = session.role === 'super_admin';

  return (
    <div className="space-y-7 fade-up">
      <PageHeader
        title="Immeubles"
        subtitle={
          isSuperAdmin
            ? `${count(rows.length, 'immeuble')} sous contrat · l’immeuble piloté alimente le reste de la console (services, finance, loge).`
            : `${count(rows.length, 'immeuble')} sous votre administration.`
        }
      />

      <StatGrid>
        <StatCard value={rows.length} label="immeubles" icon={IconBuilding} accent="violet" />
        <StatCard value={total(residentsPer)} label="résidents" icon={IconUsers} accent="green" />
        <StatCard value={total(openPer)} label="demandes en cours" icon={IconGrid} accent="blue" />
        <StatCard
          value={`${total(servicesPer)}/${rows.length * SERVICES_PER_BUILDING}`}
          label="services actifs"
          hint="catalogue cumulé du parc"
          icon={IconTag}
          accent="orange"
        />
      </StatGrid>

      <section className="space-y-2.5">
        <SectionTitle hint={isSuperAdmin ? 'Un seul immeuble piloté à la fois' : undefined}>Parc</SectionTitle>
        {rows.length === 0 ? (
          <EmptyState
            title="Aucun immeuble"
            description="Créez le premier immeuble pour provisionner son catalogue de services et son équipe."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Immeuble</TH>
                <TH>Formule</TH>
                <TH className="text-right">Résidents</TH>
                <TH className="text-right">Équipe</TH>
                <TH className="text-right">En cours</TH>
                <TH className="text-right">Services</TH>
                <TH>Créé le</TH>
                <TH className="text-right">Piloter</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((building) => {
                const active = building.id === buildingId;
                const enabled = servicesPer.get(building.id) ?? building.enabled_services?.length ?? 0;
                const plan = building.b2b_plan ?? '';
                return (
                  <TR key={building.id} className={active ? 'bg-gold/[0.05]' : undefined}>
                    <TD>
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${
                            active ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.04] text-muted'
                          }`}
                        >
                          <IconBuilding size={13} />
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                            {building.name}
                            {active && (
                              <span className="text-[9px] uppercase tracking-[1.2px] text-gold-deep">piloté</span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">{building.address}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={planTones[plan as keyof typeof planTones] ?? 'grey'}>
                        {planLabels[plan] ?? 'Sans formule'}
                      </Badge>
                    </TD>
                    <TD className="text-right text-[12.5px]">{residentsPer.get(building.id) ?? 0}</TD>
                    <TD className="text-right text-[12.5px]">{staffPer.get(building.id) ?? 0}</TD>
                    <TD className="text-right text-[12.5px]">{openPer.get(building.id) ?? 0}</TD>
                    <TD className="text-right text-[12.5px] text-muted">
                      {enabled}/{SERVICES_PER_BUILDING}
                    </TD>
                    <TD className="text-[11.5px] text-muted">{formatDate(building.created_at)}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end">
                        <SwitchBuildingButton buildingId={building.id} active={active} />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      {isSuperAdmin && (
        <section className="space-y-2.5">
          <SectionTitle hint="Immeuble, concierge et syndic en une seule étape">Onboarding</SectionTitle>
          <Disclosure
            summary="Créer un immeuble"
            hint="moins de 5 minutes, catalogue provisionné"
            bodyClassName="bg-surface-2/40"
          >
            <BuildingOnboardingForm defaultPassword="Cavalier-2026!" />
          </Disclosure>
          <p className="text-[10px] text-muted">
            À la création, l’immeuble devient l’immeuble piloté : tarifs, modèles de notification et loge sont
            immédiatement accessibles. Les comptes créés reçoivent un mot de passe temporaire, à changer à la première
            connexion.
          </p>
        </section>
      )}
    </div>
  );
}
