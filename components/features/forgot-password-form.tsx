"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { FormResult } from "@/components/features/account-fields";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/operations/shared";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={160} placeholder="vous@exemple.fr" />
      </div>
      <Button type="submit" variant="gold" className="w-full" disabled={pending || Boolean(state.success)}>
        {pending ? "Envoi…" : "Recevoir le lien"}
      </Button>
      <FormResult state={state} />
    </form>
  );
}
