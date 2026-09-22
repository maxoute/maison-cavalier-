'use client';

import { useState } from 'react';
import { OperationForm } from './operation-form';
import { Input, Select, Textarea } from '@/components/ui/input';
import { publishAnnouncement } from '@/app/actions/announcements';

interface Template { slug: string; label: string; title: string; body: string }

/** Modèles intégrés, complétés par ceux paramétrés pour l'immeuble. */
const builtInTemplates: Template[] = [
  { slug: 'travaux', label: 'Travaux', title: 'Travaux dans votre immeuble', body: 'Des travaux sont prévus le [date] de [heure] à [heure] dans [zone]. Votre concierge reste à votre disposition pour organiser vos accès.' },
  { slug: 'incident', label: 'Incident technique', title: 'Information : incident technique', body: 'Un incident affecte [équipement ou zone]. Une intervention est prévue à [heure]. Merci de [consigne]. Votre concierge vous tiendra informés.' },
  { slug: 'evenement', label: 'Événement', title: 'Votre prochain rendez-vous à la résidence', body: 'Nous vous invitons à [événement], le [date] à [heure], dans [lieu]. Contactez votre concierge pour confirmer votre présence.' },
];

export function AnnouncementForm({ audience, templates = [], live = false }: { audience: { floor: string | null; owner_status: string; count: number }[]; templates?: Template[]; live?: boolean }) {
  // Un modèle de l'immeuble remplace le modèle intégré de même identifiant.
  const available = [...templates, ...builtInTemplates.filter(model => !templates.some(custom => custom.slug === model.slug))];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [floor, setFloor] = useState('');
  const [owner, setOwner] = useState('');
  const [urgent, setUrgent] = useState(false);
  const count = audience.filter(group => (!floor || group.floor === floor) && (!owner || group.owner_status === owner)).reduce((sum, group) => sum + group.count, 0);
  const floors = [...new Set(audience.map(group => group.floor).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const hasPlaceholders = /\[[^\]]+\]/.test(`${title} ${body}`);
  const labelClass = 'block space-y-1 text-[12.5px] text-ink';
  return <OperationForm action={publishAnnouncement} primary submit={live ? 'Diffuser' : 'Diffuser (simulation)'}>
    <label className={labelClass}><span>Modèle</span><Select defaultValue="" onChange={event => {
      const template = available.find(model => model.slug === event.target.value);
      if (template) { setTitle(template.title); setBody(template.body); }
    }}><option value="">Rédiger librement</option>{available.map(template => <option key={template.slug} value={template.slug}>{template.label}</option>)}</Select></label>
    <label className={labelClass}><span>Titre</span><Input name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={200} placeholder="Coupure d’eau programmée" /></label>
    <label className={labelClass}><span>Message</span><Textarea name="body" value={body} onChange={event => setBody(event.target.value)} required maxLength={4000} rows={5} /></label>
    {hasPlaceholders && <p className="text-[11px] text-orange">Complétez les éléments entre crochets avant de diffuser.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}><span>Étage</span><Select name="target_floor" value={floor} onChange={event => setFloor(event.target.value)}><option value="">Tous les étages</option>{floors.map(value => <option key={value} value={value}>Étage {value}</option>)}</Select></label>
      <label className={labelClass}><span>Résidents</span><Select name="target_owner_status" value={owner} onChange={event => setOwner(event.target.value)}><option value="">Tous les résidents</option><option value="proprietaire">Propriétaires</option><option value="locataire">Locataires</option></Select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line bg-surface-2/60 px-3.5 py-2.5">
      <p role="status" className="text-[12px] text-ink"><span className="font-medium">{count}</span> résident{count > 1 ? 's' : ''} dans cette audience</p>
      <label className="flex items-center gap-2 text-[12px] text-ink cursor-pointer"><input type="checkbox" name="urgent" checked={urgent} onChange={event => setUrgent(event.target.checked)} className="accent-[#b9452f]" /><span>Annonce urgente</span></label>
    </div>
    <p className="text-[11px] text-muted">Canaux : {urgent ? 'push, WhatsApp, email et SMS' : 'push et email'}{urgent ? '' : ' · cochez « urgente » pour ajouter WhatsApp et SMS'}.</p>
  </OperationForm>;
}
