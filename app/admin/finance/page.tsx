import { BarChart } from '@/components/features/bar-chart';
import { MonthPicker } from '@/components/features/month-picker';
import { Badge, ServiceBadge } from '@/components/ui/badge';
import { Card, SectionLabel } from '@/components/ui/card';
import { IconChart, IconCoin, IconDoc, IconSend, IconTag } from '@/components/ui/icons';
import { EmptyState, PageHeader, SectionTitle } from '@/components/ui/page-header';
import { Meter, StatCard, StatGrid } from '@/components/ui/stat';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { managerContext } from '@/lib/admin/server';
import {
  buildFinanceReport, monthRange, monthShortLabel, parseMonthParam, shiftMonth,
  type BuildingRow, type QuoteRow, type RequestRow, type ServiceRateRow, type ShareRow,
} from '@/lib/finance';
import { count, formatMoney, formatMonth, formatPercent } from '@/lib/format';

/**
 * Finance (PRD §6.3.5) — revenus, commissions Maison Cavalier, commissions
 * d'affiliation et reversements partenaires du mois consulté.
 * L'admin travaille sur son immeuble, le super-admin sur l'ensemble du parc.
 * Les encaissements Stripe Connect ne sont pas encore raccordés : tous les
 * montants sont ceux des services réellement terminés.
 */
export const metadata = { title: 'Finance · Maison Cavalier' };

const TREND_MONTHS = 6;

function rows<T>({ data, error }: { data: T[] | null; error: { message: string } | null }): T[] {
  if (error) throw new Error('Données financières momentanément indisponibles. Réessayez dans un instant.');
  return data ?? [];
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string | string[] }>;
}) {
  const { mois } = await searchParams;
  const month = parseMonthParam(mois);
  const { db, session, buildingId } = await managerContext();
  // Le super-admin consolide tout le parc ; l'admin reste sur son immeuble
  // (la RLS le contraindrait de toute façon).
  const consolidated = session.role === 'super_admin';
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const trendStart = monthRange(shiftMonth(month, -(TREND_MONTHS - 1))).start;

  // La date d'effet d'une ligne est sa clôture ou, à défaut, sa création :
  // les bornes couvrent donc les deux colonnes.
  const completedQuery = db.from('service_requests')
    .select('building_id, service, status, amount_cents, completed_at, created_at')
    .eq('status', 'termine')
    .lt('created_at', monthEnd)
    .or(`completed_at.gte.${trendStart},created_at.gte.${trendStart}`);
  // Les demandes ouvertes sont lues sans borne de date : elles peuvent avoir
  // été créées avant la fenêtre de tendance. Volume naturellement faible —
  // à convertir en compteur agrégé si un parc dépasse le plafond PostgREST.
  const openQuery = db.from('service_requests').select('building_id').neq('status', 'termine');
  const serviceQuery = db.from('building_services').select('building_id, service, commission_rate');
  const quoteQuery = db.from('quotes')
    .select('building_id, status, amount_cents, decided_at, sent_at, created_at')
    .eq('status', 'accepte')
    .lt('created_at', monthEnd)
    .or(`decided_at.gte.${monthStart},created_at.gte.${monthStart}`);
  const shareQuery = db.from('recommendation_shares')
    .select('building_id, status, commission_cents, status_changed_at, created_at')
    .eq('status', 'reservee')
    .lt('created_at', monthEnd)
    .or(`status_changed_at.gte.${monthStart},created_at.gte.${monthStart}`);

  const [requestRows, openRows, serviceRows, quoteRows, shareRows, buildingRows] = await Promise.all([
    consolidated ? completedQuery : completedQuery.eq('building_id', buildingId),
    consolidated ? openQuery : openQuery.eq('building_id', buildingId),
    consolidated ? serviceQuery : serviceQuery.eq('building_id', buildingId),
    consolidated ? quoteQuery : quoteQuery.eq('building_id', buildingId),
    consolidated ? shareQuery : shareQuery.eq('building_id', buildingId),
    db.from('buildings').select('id, name').order('name'),
  ]);

  const buildings = rows<BuildingRow>(buildingRows);
  const report = buildFinanceReport({
    month,
    requests: rows<RequestRow>(requestRows),
    openRequests: rows<{ building_id: string }>(openRows),
    services: rows<ServiceRateRow>(serviceRows),
    quotes: rows<QuoteRow>(quoteRows),
    shares: rows<ShareRow>(shareRows),
    buildings: consolidated ? buildings : buildings.filter(building => building.id === buildingId),
    trendLength: TREND_MONTHS,
  });

  const activeBuilding = buildings.find(building => building.id === buildingId);
  const effectiveRate = report.revenueCents > 0 ? report.commissionCents / report.revenueCents : null;
  const periodLabel = formatMonth(monthRange(month).start);

  return (
    <div className="space-y-7 fade-up">
      <PageHeader
        title="Finance"
        subtitle={
          consolidated
            ? `Vue consolidée sur ${count(buildings.length, 'immeuble')} · ${periodLabel}`
            : `${activeBuilding?.name ?? 'Votre immeuble'} · ${periodLabel}`
        }
        actions={
          <>
            <MonthPicker month={month} basePath="/admin/finance" />
            <a
              href={`/api/finance/export?mois=${month}`}
              className="inline-flex items-center justify-center gap-2 rounded-[24px] px-4 py-2 text-[11px] font-medium tracking-[0.4px] bg-ink/[0.03] text-ink/80 border border-line hover:border-grey/50 hover:text-ink transition-all duration-300"
            >
              Exporter (CSV)
            </a>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Badge tone="grey">Paiements Stripe Connect : à raccorder</Badge>
        <p className="text-[11px] text-muted">
          Les montants ci-dessous sont ceux des services réellement terminés. Le rapprochement des
          encaissements et des virements partenaires arrivera avec la console de paiement.
        </p>
      </div>

      <StatGrid>
        <StatCard
          value={formatMoney(report.revenueCents, { round: true })}
          label="revenus des services terminés"
          hint={count(report.completedRequests, 'service facturé', 'services facturés')}
          icon={IconCoin}
          accent="gold"
        />
        <StatCard
          value={formatMoney(report.commissionCents, { round: true })}
          label="commissions Maison Cavalier"
          hint={`Taux courant du catalogue · ${formatPercent(effectiveRate)}`}
          icon={IconChart}
          accent="green"
        />
        <StatCard
          value={formatMoney(report.affiliationCents, { round: true })}
          label="commissions d’affiliation"
          hint="Recommandations partenaires réservées"
          icon={IconTag}
          accent="violet"
        />
        <StatCard
          value={formatMoney(report.payoutCents, { round: true })}
          label="reversements partenaires"
          hint="Revenus nets de la commission"
          icon={IconSend}
          accent="blue"
        />
      </StatGrid>

      <div className="grid gap-3 lg:grid-cols-3 items-start">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle hint={`${TREND_MONTHS} derniers mois`}>Revenus et commissions</SectionTitle>
          <BarChart
            className="mt-5"
            data={report.trend.map(point => ({
              key: point.month,
              label: monthShortLabel(point.month),
              highlight: point.month === month,
              values: { revenue: point.revenueCents, commission: point.commissionCents },
            }))}
            series={[
              { key: 'revenue', label: 'Revenus', color: 'var(--gold)' },
              { key: 'commission', label: 'Commissions Maison Cavalier', color: 'var(--blue)' },
            ]}
            format={value => formatMoney(value, { round: true })}
            emptyLabel="Aucun service terminé sur les six derniers mois."
          />
        </Card>

        <div className="space-y-3">
          <StatCard
            value={String(report.acceptedQuotes.count)}
            label="devis acceptés"
            hint={`${formatMoney(report.acceptedQuotes.amountCents)} engagés`}
            icon={IconDoc}
            accent="orange"
          />
          <Card className="p-4">
            <SectionLabel className="text-[9px]">Part revenant à Maison Cavalier</SectionLabel>
            <p className="mt-2 font-serif text-ink text-[22px] leading-none">{formatPercent(effectiveRate)}</p>
            <Meter value={report.commissionCents} max={Math.max(report.revenueCents, 1)} className="mt-3" />
            <p className="mt-2 text-[11px] text-muted">
              {formatMoney(report.commissionCents)} de commission sur {formatMoney(report.revenueCents)} facturés
            </p>
          </Card>
        </div>
      </div>

      <section className="space-y-2.5">
        <SectionTitle hint="commission au taux courant du catalogue">Répartition par service</SectionTitle>
        {report.services.length === 0 ? (
          <EmptyState
            title="Aucun service terminé sur cette période."
            description="Changez de mois ou attendez la clôture des interventions en cours."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Service</TH>
                <TH className="text-right">Demandes</TH>
                <TH className="text-right">Revenus</TH>
                <TH className="text-right">Taux</TH>
                <TH className="text-right">Commission</TH>
              </TR>
            </THead>
            <TBody>
              {report.services.map(line => (
                <TR key={line.service}>
                  <TD><ServiceBadge service={line.service} /></TD>
                  <TD className="text-right text-[12px] text-muted">{line.count}</TD>
                  <TD className="text-right font-serif text-[13px]">{formatMoney(line.revenueCents)}</TD>
                  <TD className="text-right text-[12px] text-muted">{formatPercent(line.rate / 100)}</TD>
                  <TD className="text-right font-serif text-[13px] text-gold-deep">{formatMoney(line.commissionCents)}</TD>
                </TR>
              ))}
            </TBody>
            <tfoot className="border-t border-line bg-surface-2/60">
              <tr>
                <td className="px-4 py-3 text-[10px] uppercase tracking-[1.5px] text-muted">Total</td>
                <td className="px-4 py-3 text-right text-[12px] text-muted">{report.completedRequests}</td>
                <td className="px-4 py-3 text-right font-serif text-[13px]">{formatMoney(report.revenueCents)}</td>
                <td className="px-4 py-3 text-right text-[12px] text-muted">{formatPercent(effectiveRate)}</td>
                <td className="px-4 py-3 text-right font-serif text-[13px] text-gold-deep">{formatMoney(report.commissionCents)}</td>
              </tr>
            </tfoot>
          </Table>
        )}
      </section>

      {consolidated && (
        <section className="space-y-2.5">
          <SectionTitle hint="immeuble piloté en surbrillance">Répartition par immeuble</SectionTitle>
          <Table>
            <THead>
              <TR>
                <TH>Immeuble</TH>
                <TH className="text-right">Revenus</TH>
                <TH className="text-right">Commissions</TH>
                <TH className="text-right">Demandes en cours</TH>
              </TR>
            </THead>
            <TBody>
              {report.buildings.map(line => (
                <TR key={line.id} className={line.id === buildingId ? 'bg-gold/[0.06]' : undefined}>
                  <TD>
                    <span className="inline-flex items-center gap-2 text-[12.5px]">
                      {line.name}
                      {line.id === buildingId && <Badge tone="gold">Piloté</Badge>}
                    </span>
                  </TD>
                  <TD className="text-right font-serif text-[13px]">{formatMoney(line.revenueCents)}</TD>
                  <TD className="text-right font-serif text-[13px] text-gold-deep">{formatMoney(line.commissionCents)}</TD>
                  <TD className="text-right text-[12px] text-muted">{line.openRequests}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}
    </div>
  );
}
