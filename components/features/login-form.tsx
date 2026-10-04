"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mfaRequiredRoles, roleHome } from "@/lib/rbac";
import { Input, Label } from "@/components/ui/input";
import styles from "./login-form.module.css";
import {
  IconBuilding,
  IconChat,
  IconGrid,
  IconKey,
  IconUsers,
} from "@/components/ui/icons";
import type { Role } from "@/types";

const demoAccounts: {
  email: string;
  label: string;
  building: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { email: "concierge@demo.mc", label: "Concierge", building: "Le Marly", icon: IconGrid },
  { email: "admin@demo.mc", label: "Administrateur", building: "Le Marly", icon: IconKey },
  { email: "super@demo.mc", label: "Super-administrateur", building: "Tous les immeubles", icon: IconBuilding },
  { email: "syndic@demo.mc", label: "Syndic", building: "Le Marly", icon: IconChat },
  { email: "concierge3@demo.mc", label: "Concierge", building: "Hôtel Malesherbes", icon: IconUsers },
];

/**
 * Formulaire de connexion. Les comptes de démonstration ne s'affichent que
 * si le serveur fournit leur mot de passe (`DEMO_LOGIN=true` et
 * `DEMO_PASSWORD`) — jamais en production réelle, et jamais écrit en dur
 * dans le code envoyé au navigateur.
 */
export function LoginForm({ demoPassword, linkError }: { demoPassword: string | null; linkError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "Lien expiré ou déjà utilisé. Demandez-en un nouveau à votre administrateur ou via « Mot de passe oublié »." : null,
  );
  const [loading, setLoading] = useState<string | null>(null);

  async function login(loginEmail: string, loginPassword: string) {
    setError(null);
    setLoading(loginEmail);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setError("Identifiants incorrects.");
      setLoading(null);
      return;
    }

    const role = (data.user?.app_metadata?.role as Role | undefined) ?? null;

    // 2FA obligatoire pour le staff (PRD §7.1)
    if (role && mfaRequiredRoles.includes(role)) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasTotp = (factors?.totp ?? []).some(
        (f) => f.status === "verified",
      );
      router.push(hasTotp ? "/login/mfa" : "/login/mfa/enroll");
      return;
    }

    router.push(role ? roleHome[role] : "/acces-refuse");
  }

  return (
    <div className={styles.login}>
      <header className={styles.welcome}>
        <h1>Heureux de vous retrouver.</h1>
        <p>Connectez-vous pour retrouver les services et la vie de vos immeubles.</p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(email, password);
        }}
        className="space-y-5"
        aria-busy={loading !== null}
      >
        <div>
          <Label htmlFor="email" className={styles.label}>Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            autoComplete="email"
            className={styles.field}
            required
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password" className={styles.label}>Mot de passe</Label>
          </div>
          <div className={styles.password}>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={styles.field}
            required
          />
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            aria-controls="password"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="m3 3 18 18" />}
            </svg>
          </button>
          </div>
          <div className={styles.recovery}>
            <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
          </div>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button
          type="submit"
          className={styles.submit}
          disabled={loading !== null}
        >
          {loading !== null ? "Connexion en cours…" : "Se connecter"}
        </button>
      </form>

      <div className={styles.help}>
        <p>Première connexion ?</p>
        <p>Utilisez le lien d’invitation reçu par e-mail ou contactez votre administrateur.</p>
      </div>

      {demoPassword && <details className={styles.demo}>
        <summary>Comptes de démonstration</summary>
        <div className="grid gap-1.5">
          {demoAccounts.map((acc) => {
            const Icon = acc.icon;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => login(acc.email, demoPassword)}
                disabled={loading !== null}
                className="group flex items-center gap-3 rounded-[8px] border border-line bg-ink/[0.03] px-3.5 py-2.5 text-left transition-colors duration-300 hover:border-muted hover:bg-ink/[0.06] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink/5 text-ink shrink-0">
                  <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-ink truncate">
                    {acc.label}
                  </span>
                  <span className="block text-[9.5px] text-muted truncate">
                    {acc.building}
                  </span>
                </span>
                <span className="text-[9.5px] text-muted group-hover:text-ink transition-colors duration-300 shrink-0">
                  {loading === acc.email ? "Connexion…" : "Se connecter →"}
                </span>
              </button>
            );
          })}
        </div>
      </details>}
    </div>
  );
}
