import { redirect } from 'next/navigation';
import { BarChart } from '@/components/features/bar-chart';
import { MonthPicker } from '@/components/features/month-picker';
import { Badge, serviceColors } from '@/components/ui/badge';
import { Card, SectionLabel } from '@/components/ui/card';
import { IconAlert, IconCheck, IconChat, IconGrid, IconStar } from '@/components/ui/icons';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { Meter, StatCard, StatGrid } from '@/components/ui/stat';
import { serviceOrder } from '@/lib/catalog';
import { monthRange, monthShortLabel, parseMonthParam } from '@/lib/finance';
import { count, formatMonth, formatPercent } from '@/lib/format';
import { serviceLabels } from '@/lib/requests';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { ServiceType } from '@/types';

/**
 * Reporting mensuel du syndic (PRD §6.2, §7.4) : uniquement des agrégats.
 * Le syndic n'a aucune policy sur les résidents, les demandes ou les
 * incidents — le rapport provient donc de `syndic_monthly_report`, fonction
 * SECURITY DEFINER qui ne renvoie ni nom, ni contact, ni montant, ni détail
 * de service. La page est également ouverte au staff et au super-admin,
 * qui y lisent l'immeuble qu'ils pilotent.
 */
export const metadata = { title: 'Reporting mensuel · Maison Cavalier' };

interface SyndicReport {
  month: string;
  requests: { total: number; completed: number; urgent: number; by_service: Partial<Record<ServiceType, number>> };
  sla: { measured: number; respected: number; rate: number | null };
  incidents: { total: number; grave: number; resolved: number };
  announcements: { total: number; urgent: number };
  syndic_messages: { total: number; incidents: number };
  satisfaction: { average: number | null; rated_residents: number };
  residents: number;
  trend: { month: string; total: number }[];
}

function formatScore(value: number | null): string {
  return value == null ? '—' : `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 5`;
}

/** Synthèse rédigée, destinée à être imprimée ou recopiée dans un PV. */
function summary(report: SyndicReport, buildingName: string, periodLabel: string): string {
  const parts: string[] = [];
  parts.push(
    report.requests.total === 0
      ? `En ${periodLabel}, aucune demande de service n’a été enregistrée pour ${buildingName}.`
      : `En ${periodLabel}, la conciergerie a enregistré ${count(report.requests.total, 'demande')} pour ${buildingName}, `
        + `dont ${count(report.requests.completed, 'menée à son terme', 'menées à leur terme')}`
        + (report.requests.urgent > 0 ? ` et ${count(report.requests.urgent, 'traitée en urgence', 'traitées en urgence')}.` : '.'),
  );
  parts.push(
    report.sla.measured > 0
      ? `Les engagements de délai ont été tenus sur ${report.sla.respected} des ${report.sla.measured} interventions mesurées, soit ${formatPercent(report.sla.rate)}.`
      : 'Aucun engagement de délai n’était mesurable sur la période.',
  );
  parts.push(
    report.incidents.total === 0
      ? 'Aucun incident n’a été signalé.'
      : `${count(report.incidents.total, 'incident a été signalé', 'incidents ont été signalés')}, dont ${report.incidents.grave} de gravité élevée ; `
        + `${report.incidents.resolved > 1 ? `${report.incidents.resolved} sont résolus` : `${report.incidents.resolved} est résolu`} à ce jour.`,
  );
  if (report.announcements.total > 0) {
    parts.push(`${count(report.announcements.total, 'annonce a été diffusée', 'annonces ont été diffusées')} aux résidents, dont ${report.announcements.urgent} en urgence.`);
  }
  parts.push(
    report.syndic_messages.total > 0
      ? `${count(report.syndic_messages.total, 'message a été échangé', 'messages ont été échangés')} avec le syndic, dont ${report.syndic_messages.incidents} au titre d’un incident.`
      : 'Aucun échange n’a été nécessaire avec le syndic.',
  );
  if (report.satisfaction.average != null) {
    parts.push(`La satisfaction moyenne des ${count(report.residents, 'résident')} s’établit à ${formatScore(report.satisfaction.average)}.`);
  }
  parts.push('Ce rapport est strictement agrégé : il ne contient aucune donnée individuelle de résident.');
  return parts.join(' ');
}

export default async function SyndicReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string | string[] }>;
}) {
  const { mois } = await searchParams;
  const month = parseMonthParam(mois);
  const session = await getSession();
  if (!session) redirect('/login');

  const db = await createClient();
  const [buildingResult, reportResult] = await Promise.all([
    db.from('buildings').select('name').eq('id', session.buildingId).maybeSingle(),
    db.rpc('syndic_monthly_report', { p_building_id: session.buildingId, p_month: `${month}-01` }),
  ]);

  const buildingName = buildingResult.data?.name ?? 'Votre immeuble';
  const periodLabel = formatMonth(monthRange(month).start);
  const report = reportResult.data as SyndicReport | null;

  const header = (
    <PageHeader
      title="Reporting mensuel"
      subtitle={`${buildingName} · ${periodLabel} · chiffres agrégés, sans donnée individuelle`}
      actions={<MonthPicker month={month} basePath="/syndic/reporting" />}
    />
  );

  if (reportResult.error || !report) {
    return (
      <div className="space-y-6 fade-up">
        {header}
        <EmptyState
          title="Rapport indisponible pour le moment."
          description="Les indicateurs de l’immeuble n’ont pas pu être calculés. Réessayez dans un instant ou signalez-le à votre concierge."
        />
      </div>
    );
  }

  const activity =
    report.requests.total + report.incidents.total + report.announcements.total + report.syndic_messages.total;
  const serviceBars = serviceOrder
    .map(service => ({
      key: service,
      label: serviceLabels[service],
      color: serviceColors[service],
      values: { total: report.requests.by_service[service] ?? 0 },
    }))
    .filter(bar => bar.values.total > 0);

  return (
    <div className="space-y-7 fade-up">
      {header}

      {activity === 0 ? (
        <EmptyState
          title={`Aucune activité enregistrée en ${periodLabel}.`}
          description="Ni demande, ni incident, ni annonce sur la période. Utilisez la navigation ci-dessus pour consulter un autre mois."
        />
      ) : (
        <>
          <StatGrid>
            <StatCard
              value={String(report.requests.total)}
              label="demandes du mois"
              hint={`${report.requests.completed} menées à leur terme`}
              icon={IconGrid}
              accent="blue"
            />
            <StatCard
              value={formatPercent(report.sla.rate)}
              label="engagements de délai tenus"
              hint={report.sla.measured > 0
                ? `${report.sla.respected} sur ${report.sla.measured} interventions mesurées`
                : 'Aucune intervention mesurable'}
              icon={IconCheck}
              accent="green"
            />
            <StatCard
              value={String(report.incidents.total)}
              label="incidents signalés"
              hint={report.incidents.total === 0
                ? 'Aucun incident sur la période'
                : `${report.incidents.grave} grave${report.incidents.grave > 1 ? 's' : ''} · ${report.incidents.resolved} résolu${report.incidents.resolved > 1 ? 's' : ''}`}
              icon={IconAlert}
              accent={report.incidents.grave > 0 ? 'red' : 'orange'}
            />
            <StatCard
              value={formatScore(report.satisfaction.average)}
              label="satisfaction moyenne"
              hint={count(report.residents, 'résident suivi', 'résidents suivis')}
              icon={IconStar}
              accent="gold"
            />
          </StatGrid>

          <div className="grid gap-3 lg:grid-cols-3 items-start">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle hint={count(report.requests.total, 'demande')}>Demandes par service</SectionTitle>
              <BarChart
                className="mt-5"
                data={serviceBars}
                series={[{ key: 'total', label: 'Demandes', color: 'var(--gold)' }]}
                format={value => count(value, 'demande')}
                emptyLabel="Aucune demande sur la période."
              />
            </Card>

            <div className="space-y-3">
              <Card className="p-4" accent={report.incidents.grave > 0 ? 'red' : 'grey'}>
                <SectionLabel className="text-[9px]">Incidents et suivi</SectionLabel>
                <p className="mt-2.5 font-serif text-ink text-[22px] leading-none">
                  {report.incidents.resolved}/{report.incidents.total}
                </p>
                <p className="mt-1.5 text-[11px] text-muted">incidents résolus sur la période</p>
                <Meter
                  value={report.incidents.resolved}
                  max={Math.max(report.incidents.total, 1)}
                  tone={report.incidents.grave > 0 ? 'red' : 'green'}
                  className="mt-3"
                />
                {report.incidents.grave > 0 && (
                  <p className="mt-2.5 text-[11px] text-red">
                    {count(
                      report.incidents.grave,
                      'incident grave porté à votre connaissance',
                      'incidents graves portés à votre connaissance',
                    )}
                    .
                  </p>
                )}
              </Card>
              <Card className="p-4">
                <SectionLabel className="text-[9px]">Échanges et information</SectionLabel>
                <ul className="mt-3 space-y-2 text-[11.5px] text-ink/90">
                  <li className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <IconChat size={13} className="text-gold-deep" /> Messages au syndic
                    </span>
                    <span className="font-medium">{report.syndic_messages.total}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted">dont signalements d’incident</span>
                    <span className="font-medium">{report.syndic_messages.incidents}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted">Annonces diffusées</span>
                    <span className="font-medium">{report.announcements.total}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted">dont annonces urgentes</span>
                    <span className="font-medium">{report.announcements.urgent}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted">Demandes traitées en urgence</span>
                    <span className="font-medium">{report.requests.urgent}</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>

          <Card className="p-5">
            <SectionTitle hint="12 derniers mois">Volume de demandes</SectionTitle>
            <BarChart
              className="mt-5"
              data={report.trend.map(point => ({
                key: point.month,
                label: monthShortLabel(point.month),
                highlight: point.month === month,
                values: { total: point.total },
              }))}
              series={[{ key: 'total', label: 'Demandes', color: 'var(--blue)' }]}
              format={value => count(value, 'demande')}
              emptyLabel="Aucune demande sur les douze derniers mois."
            />
          </Card>
        </>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Synthèse à transmettre au conseil syndical</SectionLabel>
          <Badge tone="grey">Données agrégées</Badge>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink/90 max-w-3xl">
          {summary(report, buildingName, periodLabel)}
        </p>
      </Card>
    </div>
  );
}
