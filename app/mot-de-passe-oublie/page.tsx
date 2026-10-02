import Link from "next/link";
import { AuthShell } from "@/components/features/auth-shell";
import { ForgotPasswordForm } from "@/components/features/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-tight">Mot de passe oublié</h1>
          <p className="text-[13px] text-muted leading-relaxed">
            Indiquez l’adresse e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-[12px]">
          <Link href="/login" className="text-muted hover:text-gold-deep transition-colors duration-300">← Retour à la connexion</Link>
        </p>
      </div>
    </AuthShell>
  );
}
