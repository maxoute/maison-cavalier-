import { signOut } from "@/app/actions/auth";

export default function AccessDeniedPage() {
  return (
    <main className="flex-1 flex items-center justify-center bg-navy p-6">
      <div className="text-center max-w-md">
        <p className="text-gold text-sm tracking-[0.3em] uppercase mb-3">
          Maison Cavalier
        </p>
        <h1 className="text-cream text-3xl mb-4">Accès non autorisé</h1>
        <p className="text-cream/70 mb-8">
          Votre compte ne permet pas d&apos;accéder à cette section. Les
          résidents et chauffeurs utilisent les applications mobiles dédiées.
        </p>
        {/* Déconnexion et non simple lien vers /login : le proxy y renverrait
            l'utilisateur connecté sur cette même page (impasse). */}
        <form action={signOut}>
          <button
            type="submit"
            className="text-gold underline underline-offset-4 cursor-pointer"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
