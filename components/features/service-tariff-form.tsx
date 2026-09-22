'use client';

import { OperationForm } from './operation-form';
import { Input, Select } from '@/components/ui/input';
import { saveBuildingService } from '@/app/actions/catalog';
import { formatSla, formatTariff, pricingUnitLabels } from '@/lib/catalog';
import type { BuildingService } from '@/types';

/** Une ligne du catalogue : état, tarif, commission et engagement (PRD §6.3.4). */
export function ServiceTariffForm({
  row, label, revenueCents, commissionCents,
}: { row: BuildingService; label: string; revenueCents: number; commissionCents: number }) {
  const euros = (row.base_price_cents / 100).toFixed(2).replace('.', ',');
  const rate = String(row.commission_rate).replace('.', ',');
  return (
    <details className="rounded-[8px] border border-line bg-surface/60 px-4 py-3">
      <summary className="cursor-pointer list-none">
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] text-ink">{label}</span>
            <span className="block text-[11px] text-muted mt-0.5">
              {formatTariff(row.base_price_cents, row.pricing_unit)} · commission {rate} % · {formatSla(row.sla_minutes)}
              {row.partner_name ? ` · ${row.partner_name}` : ''}
            </span>
          </span>
          <span className="flex items-center gap-4 shrink-0">
            <span className="text-[11px] text-muted">
              <span className="text-ink">{(revenueCents / 100).toLocaleString('fr-FR')} €</span> réalisés ·{' '}
              <span className="text-ink">{(commissionCents / 100).toLocaleString('fr-FR')} €</span> de commission
            </span>
            <span className={`text-[10px] uppercase tracking-[1px] ${row.enabled ? 'text-green' : 'text-muted'}`}>
              {row.enabled ? 'Actif' : 'Désactivé'}
            </span>
          </span>
        </span>
      </summary>
      <div className="mt-4 border-t border-line pt-4 text-[12.5px]">
        <OperationForm action={saveBuildingService} submit="Enregistrer ce service">
          <input type="hidden" name="service" value={row.service} />
          <label className="flex items-start gap-2">
            <input className="mt-1" type="checkbox" name="enabled" defaultChecked={row.enabled} />
            <span>Service proposé dans cet immeuble. Désactivé, il disparaît de la loge et aucune nouvelle demande n’est acceptée.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span>Unité tarifaire</span>
              <Select name="pricing_unit" defaultValue={row.pricing_unit}>
                {Object.entries(pricingUnitLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </Select>
            </label>
            <label className="block space-y-1"><span>Tarif en euros</span>
              <Input name="base_price" defaultValue={euros} inputMode="decimal" required maxLength={20} />
            </label>
            <label className="block space-y-1"><span>Commission Maison Cavalier (%)</span>
              <Input name="commission_rate" defaultValue={rate} inputMode="decimal" required maxLength={10} />
            </label>
            <label className="block space-y-1"><span>Engagement SLA (minutes, vide = aucun)</span>
              <Input name="sla_minutes" type="number" min={5} max={10080} defaultValue={row.sla_minutes ?? ''} />
            </label>
          </div>
          <label className="block space-y-1"><span>Prestataire local</span>
            <Input name="partner_name" defaultValue={row.partner_name ?? ''} maxLength={200} placeholder="Pressing Montaigne, VTC Étoile…" />
          </label>
        </OperationForm>
      </div>
    </details>
  );
}
