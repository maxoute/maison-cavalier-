'use client';

import { useState, useTransition } from 'react';
import { setUserActive } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Désactivation / réactivation d'un compte (PRD §6.3.3). La désactivation
 * bannit le compte côté auth : la connexion est refusée, le profil et son
 * historique restent intacts. Le serveur revérifie le périmètre.
 */
export function UserStatusButton({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`${active ? 'Désactiver' : 'Réactiver'} le compte de ${name}`}
        onClick={() =>
          startTransition(async () => {
            setResult({});
            try {
              setResult(await setUserActive(id, !active));
            } catch {
              setResult({ error: 'Connexion interrompue. Réessayez.' });
            }
          })
        }
      >
        {pending ? 'En cours…' : active ? 'Désactiver' : 'Réactiver'}
      </Button>
      {result.error && (
        <p role="alert" className="max-w-[180px] text-[11px] leading-snug text-red">
          {result.error}
        </p>
      )}
    </div>
  );
}
