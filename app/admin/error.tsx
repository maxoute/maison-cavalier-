'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconAlert } from '@/components/ui/icons';

export default function PortalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const [pending, startTransition] = useTransition();
  const known = error?.message && !/digest|Server Components render/i.test(error.message) ? error.message : null;
  return (
    <Card role="alert" accent="orange" className="max-w-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-orange/10 text-orange shrink-0"><IconAlert size={16} /></span>
        <h1 className="text-[20px] text-ink">Une erreur est survenue</h1>
      </div>
      <p className="text-[12.5px] text-muted leading-relaxed">{known ?? 'Les données ne sont pas disponibles pour le moment. Réessayez dans un instant.'}</p>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(unstable_retry)}>{pending ? 'Chargement…' : 'Réessayer'}</Button>
    </Card>
  );
}
