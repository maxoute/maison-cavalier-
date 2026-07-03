"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mfaRequiredRoles, roleHome } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
const demoPassword = "cavalier123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    <div className="space-y-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(email, password);
        }}
        className="space-y-5"
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button
          type="submit"
          variant="gold"
          className="w-full"
          disabled={loading !== null}
        >
          {loading === email ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-px flex-1 bg-navy-3" />
          <span className="text-[9.5px] uppercase tracking-[1.5px] text-grey">
            Comptes de démonstration
          </span>
          <span className="h-px flex-1 bg-navy-3" />
        </div>
        <div className="grid gap-1.5">
          {demoAccounts.map((acc) => {
            const Icon = acc.icon;
            return (
              <button
                key={acc.email}
                type="button"
                onClick={() => login(acc.email, demoPassword)}
                disabled={loading !== null}
                className="group flex items-center gap-3 rounded-[8px] border border-navy-3 bg-white/[0.02] px-3.5 py-2.5 text-left transition-colors duration-300 hover:border-gold/40 hover:bg-gold/[0.05] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gold/10 text-gold-light shrink-0">
                  <Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-cream truncate">
                    {acc.label}
                  </span>
                  <span className="block text-[9.5px] text-grey truncate">
                    {acc.building}
                  </span>
                </span>
                <span className="text-[9.5px] text-grey group-hover:text-gold-light transition-colors duration-300 shrink-0">
                  {loading === acc.email ? "Connexion…" : "Se connecter →"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
