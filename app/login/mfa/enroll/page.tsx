"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { roleHome } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Role } from "@/types";

/**
 * Enrôlement TOTP (MFA obligatoire staff, PRD §7.1).
 * Le SMS (Twilio) remplacera/complétera le TOTP quand le compte sera ouvert —
 * seul cet écran changera, le reste du flux est identique.
 */
export default function MfaEnrollPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const enrollStarted = useRef(false);

  useEffect(() => {
    // Garde contre le double montage de React en dev (un seul enrôlement)
    if (enrollStarted.current) return;
    enrollStarted.current = true;
    const supabase = createClient();
    supabase.auth.mfa
      .enroll({ factorType: "totp", friendlyName: "Authenticator" })
      .then(({ data, error }) => {
        if (error || !data) {
          setError("Impossible de démarrer l'enrôlement 2FA.");
          return;
        }
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
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
        <h2 className="text-xl mb-1">Activer la double authentification</h2>
        <p className="text-sm text-muted">
          Recommandée pour les comptes concierge et administrateur. Scannez le
          QR code avec Google Authenticator, 1Password ou équivalent.
        </p>
      </div>
      {qr && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code d'enrôlement 2FA" className="w-44 h-44" />
        </div>
      )}
      {secret && (
        <p className="text-xs text-muted text-center break-all">
          Clé manuelle : {secret}
        </p>
      )}
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
          required
        />
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      <Button
        type="submit"
        variant="gold"
        className="w-full"
        disabled={loading || !factorId}
      >
        {loading ? "Activation…" : "Activer la 2FA"}
      </Button>
      <p className="text-center text-[11px] text-muted"><a href="/login" className="underline underline-offset-4 hover:text-ink">Retour à la connexion</a></p>
    </form>
  );
}
