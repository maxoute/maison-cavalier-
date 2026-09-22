import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Seal } from "@/components/ui/seal";

export default function AccessDeniedPage() {
  return (
    <main className="flex-1 flex items-center justify-center bg-page p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="flex justify-center"><Seal size={44} /></div>
        <p className="text-gold-deep text-[10px] tracking-[3px] uppercase">Maison Cavalier</p>
        <h1 className="text-[24px] text-ink">Accès non autorisé</h1>
        <p className="text-[12.5px] text-muted leading-relaxed">
          Votre compte ne permet pas d&apos;accéder à cette section. Les résidents et chauffeurs utilisent les applications mobiles dédiées.
        </p>
        {/* Déconnexion et non simple lien vers /login : le proxy y renverrait
            l'utilisateur connecté sur cette même page (impasse). */}
        <form action={signOut} className="flex justify-center">
          <Button type="submit" variant="outline" size="sm">Se déconnecter</Button>
        </form>
      </div>
    </main>
  );
}
