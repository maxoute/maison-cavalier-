import { OperationForm } from './operation-form';
import { Field } from './operation-fields';
import { Select, Textarea } from '@/components/ui/input';
import { saveQuote } from '@/app/actions/quotes';
import type { Quote } from '@/types';

export function QuoteForm({ requests, quote }: { requests: { id: string; label: string }[]; quote?: Quote }) {
  return <OperationForm action={saveQuote} primary={!quote} submit={quote ? 'Enregistrer les informations' : 'Créer le devis'}>
    {quote && <><input type="hidden" name="id" value={quote.id} /><input type="hidden" name="updated_at" value={quote.updated_at} /></>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1 text-[12.5px] text-ink sm:col-span-2"><span>Demande du résident</span><Select name="request_id" required defaultValue={quote?.request_id ?? ''}><option value="" disabled>Choisir une demande</option>{requests.map(request => <option key={request.id} value={request.id}>{request.label}</option>)}</Select></label>
      <Field name="provider" label="Prestataire" required maxLength={200} defaultValue={quote?.provider ?? ''} placeholder="Atelier Bertin" />
      <Field name="amount" label="Montant total proposé (€)" required inputMode="decimal" placeholder="150,00" defaultValue={quote?.amount_cents != null ? (quote.amount_cents / 100).toFixed(2).replace('.', ',') : ''} />
    </div>
    <label className="block space-y-1 text-[12.5px] text-ink"><span>Prestation proposée</span><Textarea name="label" required maxLength={4000} rows={3} defaultValue={quote?.label ?? ''} placeholder="Restauration de deux paires — cuir pleine fleur" /></label>
  </OperationForm>;
}
