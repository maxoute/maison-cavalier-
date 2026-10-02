import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { confirmAccessLink } from "@/app/actions/auth";
import { isAccessLinkType } from "@/lib/auth/links";

/**
 * Atterrissage des liens d'invitation et de réinitialisation. La page ne
 * consomme rien à l'ouverture : les antivirus de messagerie qui visitent
 * le lien d'avance ne grillent pas le jeton à usage unique. Le clic sur le
 * bouton le vérifie et ouvre la session.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = Boolean(tokenHash) && isAccessLinkType(type);
  const invite = type === "invite";

  return (
    <AuthShell>
      {valid ? (
        <form action={confirmAccessLink} className="space-y-5 text-center">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <div className="space-y-2">
            <h1 className="text-[22px] leading-tight">{invite ? "Bienvenue" : "Nouveau mot de passe"}</h1>
            <p className="text-[13px] text-muted leading-relaxed">
              {invite
                ? "Votre accès à Maison Cavalier est prêt. Activez votre compte, puis choisissez votre mot de passe."
                : "Confirmez pour choisir un nouveau mot de passe."}
            </p>
          </div>
          <Button type="submit" variant="gold" className="w-full">
            {invite ? "Activer mon compte" : "Continuer"}
          </Button>
          <p className="text-[11px] text-muted">Ce lien est personnel et ne sert qu’une fois.</p>
        </form>
      ) : (
        <div className="space-y-3 text-center">
          <h1 className="text-[22px] leading-tight">Lien incomplet</h1>
          <p className="text-[13px] text-muted leading-relaxed">
            Ce lien d’accès est incomplet. Ouvrez-le directement depuis l’e-mail reçu, ou demandez-en un nouveau à votre administrateur.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
