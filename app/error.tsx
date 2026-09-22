'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Seal } from '@/components/ui/seal';

export default function RootError({ unstable_retry }: { unstable_retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <main className="flex-1 flex items-center justify-center bg-page p-6" role="alert">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center"><Seal size={44} /></div>
        <h1 className="text-[24px] text-ink">Une erreur est survenue</h1>
        <p className="text-[12.5px] text-muted leading-relaxed">La page n&apos;a pas pu être affichée. Réessayez dans un instant.</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(unstable_retry)}>{pending ? 'Chargement…' : 'Réessayer'}</Button>
          <Link href="/"><Button variant="ghost" size="sm">Retour à l&apos;accueil</Button></Link>
        </div>
      </div>
    </main>
  );
}
