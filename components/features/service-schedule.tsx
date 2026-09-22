'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SectionTitle } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';
import { TIME_ZONE, formatDate, formatTime } from '@/lib/format';

type ScheduledOperation = {
  id: string;
  resident: string;
  deadline: string | null;
  status: string;
};

const dayMs = 86_400_000;
const dayKey = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });
const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TIME_ZONE });
const weekdayIndex = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIME_ZONE });
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Planning hebdomadaire des créneaux (PRD §6.1.4), en heure de Paris. */
export function ServiceSchedule({ operations, now }: { operations: ScheduledOperation[]; now: number }) {
  const [offset, setOffset] = useState(0);
  // Lundi de la semaine courante (à midi, pour ignorer les changements d'heure), en heure de Paris.
  const todayIndex = weekdays.indexOf(weekdayIndex.format(new Date(now)));
  const monday = now - todayIndex * dayMs + offset * 7 * dayMs;
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday + index * dayMs));
  const todayKey = dayKey.format(new Date(now));
  const scheduled = operations.filter(operation => operation.deadline).sort((a, b) =>
    Date.parse(a.deadline!) - Date.parse(b.deadline!));
  const unscheduled = operations.length - scheduled.length;
  const late = scheduled.filter(operation => Date.parse(operation.deadline!) < now).length;

  return <section aria-label="Planning hebdomadaire" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SectionTitle hint={`${unscheduled} sans créneau · ${late ? `${late} en retard` : 'aucun retard'}`}>Planning de la semaine</SectionTitle>
      <div className="flex flex-wrap gap-1.5" aria-label="Navigation du planning">
        <Button type="button" variant="outline" size="sm" onClick={() => setOffset(value => value - 1)}>‹ Précédente</Button>
        <Button type="button" variant={offset === 0 ? 'ghost' : 'outline'} size="sm" onClick={() => setOffset(0)}>Cette semaine</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOffset(value => value + 1)}>Suivante ›</Button>
      </div>
    </div>
    <p aria-live="polite" className="text-[11px] text-muted">Du {formatDate(days[0])} au {formatDate(days[6])} · heure de Paris</p>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map(day => {
        const key = dayKey.format(day);
        const entries = scheduled.filter(operation => dayKey.format(new Date(operation.deadline!)) === key);
        const isToday = key === todayKey;
        return <section key={key} className={cn('min-w-0 rounded-[8px] border bg-surface p-2.5', isToday ? 'border-gold/40' : 'border-line')} aria-label={formatDate(day)}>
          <h3 className={cn('text-[11px] font-sans font-medium capitalize', isToday ? 'text-gold-deep' : 'text-muted')} aria-current={isToday ? 'date' : undefined}>{dayLabel.format(day)}</h3>
          {entries.length ? <ul className="mt-2 space-y-1.5">{entries.map(operation => {
            const isLate = Date.parse(operation.deadline!) < now;
            return <li key={operation.id}>
              <a href={`#operation-${operation.id}`} className={cn('block rounded-[6px] border px-2 py-1.5 text-[11px] hover:bg-surface-2 transition-colors duration-300', isLate ? 'border-red/40 bg-red/[0.04]' : 'border-line')}>
                <time dateTime={operation.deadline!} className={cn('font-medium', isLate ? 'text-red' : 'text-ink')}>{formatTime(operation.deadline!)}</time>
                <span className="block truncate text-ink">{operation.resident}</span>
                <span className="block truncate text-muted">{operation.status}{isLate ? ' · en retard' : ''}</span>
              </a>
            </li>;
          })}</ul> : <p className="mt-2 text-[10.5px] text-muted">—</p>}
        </section>;
      })}
    </div>
  </section>;
}
