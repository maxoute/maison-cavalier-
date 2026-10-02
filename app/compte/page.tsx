import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { PasswordForm } from "@/components/features/password-form";
import { roleHome } from "@/lib/rbac";
import { getSession } from "@/lib/session";

const roleLabels: Record<string, string> = {
  concierge: "Concierge",
  admin: "Administrateur",
  super_admin: "Super-administrateur",
  syndic: "Syndic de copropriété",
};

/**
 * Mon compte : choix du mot de passe à l'arrivée (invitation,
 * réinitialisation) et changement à tout moment depuis le portail.
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { etape } = await searchParams;
  const arriving = etape === "bienvenue" || etape === "reinitialisation";
  const name = session.profile?.full_name ?? "";

  return (
    <AuthShell>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-tight">
            {etape === "bienvenue" ? `Bienvenue${name ? `, ${name.split(" ")[0]}` : ""}` : etape === "reinitialisation" ? "Nouveau mot de passe" : "Mon compte"}
          </h1>
          <p className="text-[13px] text-muted leading-relaxed">
            {arriving
              ? "Choisissez votre mot de passe : vous l’utiliserez avec votre adresse e-mail pour vous connecter."
              : `${name} · ${roleLabels[session.role] ?? session.role}`}
          </p>
        </div>
        <PasswordForm continueToPortal={arriving} submitLabel={arriving ? "Enregistrer et accéder à mon espace" : "Changer mon mot de passe"} />
        {!arriving && (
          <p className="text-center text-[12px]">
            <Link href={roleHome[session.role]} className="text-muted hover:text-gold-deep transition-colors duration-300">← Retour à mon espace</Link>
          </p>
        )}
      </div>
    </AuthShell>
  );
}
