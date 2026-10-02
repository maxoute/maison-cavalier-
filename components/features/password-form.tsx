"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/actions/auth";
import { FormResult } from "@/components/features/account-fields";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/links";
import type { ActionResult } from "@/lib/operations/shared";

/**
 * Choix du mot de passe. `continueToPortal` : après une invitation ou une
 * réinitialisation, l'enregistrement mène directement au portail du rôle.
 */
export function PasswordForm({ continueToPortal, submitLabel }: { continueToPortal: boolean; submitLabel: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(setPassword, {});
  return (
    <form action={action} className="space-y-4">
      {continueToPortal && <input type="hidden" name="continuer" value="1" />}
      <div>
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={72} />
        <p className="mt-1 text-[11px] text-muted">{MIN_PASSWORD_LENGTH} caractères minimum, lettres et au moins un chiffre ou un symbole.</p>
      </div>
      <div>
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={72} />
      </div>
      <Button type="submit" variant="gold" className="w-full" disabled={pending}>
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
      <FormResult state={state} />
    </form>
  );
}
