'use client';

import { useState } from 'react';

type ScheduledOperation = {
  id: string;
  resident: string;
  deadline: string | null;
  status: string;
};

const dayMs = 86_400_000;
const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });

export function ServiceSchedule({ operations, now }: { operations: ScheduledOperation[]; now: number }) {
  const [offset, setOffset] = useState(0);
  const today = new Date(now);
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const monday = midnight - ((today.getUTCDay() + 6) % 7) * dayMs + offset * 7 * dayMs;
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday + index * dayMs));
  const scheduled = operations.filter(operation => operation.deadline).sort((a, b) =>
    Date.parse(a.deadline!) - Date.parse(b.deadline!));
  const unscheduled = operations.length - scheduled.length;
  const late = scheduled.filter(operation => Date.parse(operation.deadline!) < now).length;
  const buttonClass = 'rounded-3xl border border-navy-3 px-4 py-2 text-base text-cream hover:bg-navy-2 focus-visible:outline-2 focus-visible:outline-cream';

  return <section aria-label="Planning hebdomadaire" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl">Planning des opérations en cours</h2>
        <p className="text-grey">Horaires UTC · {unscheduled} sans créneau · {late} en retard</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Navigation du planning">
        <button type="button" className={buttonClass} onClick={() => setOffset(value => value - 1)}>Semaine précédente</button>
        <button type="button" className={buttonClass} onClick={() => setOffset(0)}>Cette semaine</button>
        <button type="button" className={buttonClass} onClick={() => setOffset(value => value + 1)}>Semaine suivante</button>
      </div>
    </div>
    <p aria-live="polite">Du {dateLabel(days[0], { day: 'numeric', month: 'long', year: 'numeric' })} au {dateLabel(days[6], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {days.map(day => {
        const start = day.getTime();
        const entries = scheduled.filter(operation => {
          const deadline = Date.parse(operation.deadline!);
          return deadline >= start && deadline < start + dayMs;
        });
        return <section key={start} className="min-w-0 rounded-lg border border-navy-3 bg-navy-2 p-3" aria-label={dateLabel(day, { dateStyle: 'full' })}>
          <h3 className="text-lg" aria-current={start === midnight ? 'date' : undefined}>{dateLabel(day, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>
          {entries.length ? <ul className="mt-3 space-y-3">{entries.map(operation => <li key={operation.id}>
            <a href={`#operation-${operation.id}`} className="block rounded-lg border border-navy-3 p-2 hover:bg-navy focus-visible:outline-2 focus-visible:outline-cream">
              <time dateTime={operation.deadline!}>{new Date(operation.deadline!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</time>
              <p className="break-words">{operation.resident}</p>
              <p className="text-grey">{operation.status}</p>
              {Date.parse(operation.deadline!) < now && <p className="text-red">En retard</p>}
            </a>
          </li>)}</ul> : <p className="mt-3 text-grey">Aucune opération</p>}
        </section>;
      })}
    </div>
  </section>;
}
