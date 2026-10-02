'use client';

import { useState, useTransition } from 'react';
import { sendUserAccess } from '@/app/actions/users';
import { CopyableLink } from '@/components/features/account-fields';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/operations/shared';

/**
 * Nouveau lien d'accès (PRD §6.3.3) : renvoie l'invitation tant qu'elle
 * n'est pas acceptée, envoie un lien de réinitialisation ensuite. Sans
 * e-mail configuré, le lien s'affiche ici pour être transmis à la main.
 */
export function UserAccessButton({ id, name, pending: invitationPending }: { id: string; name: string; pending: boolean }) {
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});
  const label = invitationPending ? 'Renvoyer l’invitation' : 'Lien d’accès';

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        aria-label={`${invitationPending ? 'Renvoyer l’invitation à' : 'Envoyer un lien de réinitialisation à'} ${name}`}
        onClick={() =>
          startTransition(async () => {
            setResult({});
            try {
              setResult(await sendUserAccess(id));
            } catch {
              setResult({ error: 'Connexion interrompue. Réessayez.' });
            }
          })
        }
      >
        {busy ? 'Envoi…' : label}
      </Button>
      {result.error && <p role="alert" className="max-w-[240px] text-left text-[11px] leading-snug text-red">{result.error}</p>}
      {result.success && (
        <div role="status" className="max-w-[340px] whitespace-pre-line text-left text-[11px] leading-snug text-ink">
          {result.success}
          {result.link && <CopyableLink link={result.link} />}
        </div>
      )}
    </div>
  );
}
