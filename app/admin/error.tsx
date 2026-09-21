'use client';

import { useTransition } from 'react';

export default function AdminError({ unstable_retry }: { unstable_retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <div className="space-y-4 text-base" role="alert">
    <h1 className="text-3xl">Chargement interrompu</h1>
    <p>Les données d’administration ne sont pas disponibles pour le moment. Réessayez dans un instant.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(unstable_retry)} className="rounded-3xl border border-navy-3 px-6 py-3 text-cream hover:bg-navy-2 disabled:opacity-50">{pending ? 'Chargement…' : 'Réessayer'}</button>
  </div>;
}
