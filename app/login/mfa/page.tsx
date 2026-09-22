"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Role } from "@/types";

export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!totp) {
      setLoading(false);
      router.push("/login/mfa/enroll");
      return;
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totp.id,
      code,
    });
    if (error) {
      setError("Code incorrect, réessayez.");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const role = (data.user?.app_metadata?.role as Role | undefined) ?? null;
    router.push(role ? roleHome[role] : "/acces-refuse");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl mb-1">Vérification en deux étapes</h2>
        <p className="text-sm text-muted">
          Saisissez le code à 6 chiffres de votre application
          d&apos;authentification.
        </p>
      </div>
      <div>
        <Label htmlFor="code">Code de vérification</Label>
        <Input
          id="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          autoComplete="one-time-code"
          required
        />
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      <Button type="submit" variant="gold" className="w-full" disabled={loading}>
        {loading ? "Vérification…" : "Vérifier"}
      </Button>
      <p className="text-center text-[11px] text-muted"><a href="/login" className="underline underline-offset-4 hover:text-ink">Retour à la connexion</a></p>
    </form>
  );
}
