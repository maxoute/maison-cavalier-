import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { IconLogout } from "@/components/ui/icons";
import { Seal } from "@/components/ui/seal";
import { SidebarNav } from "./sidebar-nav";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

const roleLabels: Record<string, string> = {
  concierge: "Concierge",
  admin: "Administrateur",
  super_admin: "Super-administrateur",
  syndic: "Syndic de copropriété",
};

/**
 * Coquille commune aux trois portails : sidebar fixe à gauche (nav +
 * identité + déconnexion) et contenu principal — vrai gabarit d'app web,
 * pas une simple page. La sidebar hébergera aussi les sélecteurs
 * contextuels (immeuble, filtres persistants) via `sidebarExtra`.
 */
export function PortalShell({
  portalName,
  nav,
  userName,
  role,
  sidebarExtra,
  children,
}: {
  portalName: string;
  nav: NavItem[];
  userName: string;
  role?: string;
  sidebarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex min-h-screen">
      <aside className="w-[236px] shrink-0 border-r border-navy-3 bg-[linear-gradient(180deg,var(--navy-2),var(--navy))] flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-navy-3/80">
          <Seal size={32} />
          <div className="min-w-0">
            <p className="font-serif text-cream text-[14px] leading-tight truncate">
              Maison Cavalier
            </p>
            <p className="text-[9px] uppercase tracking-[1.5px] text-gold-light/80 truncate">
              {portalName}
            </p>
          </div>
        </div>

        <SidebarNav nav={nav} />

        {sidebarExtra && (
          <div className="px-3.5 pb-3 pt-1 border-t border-navy-3/60">
            {sidebarExtra}
          </div>
        )}

        <div className="px-3.5 py-3.5 border-t border-navy-3/80 flex items-center gap-2.5">
          <Avatar name={userName || "?"} size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-cream truncate leading-tight">
              {userName}
            </p>
            <p className="text-[9px] uppercase tracking-[1px] text-grey truncate">
              {role ? (roleLabels[role] ?? role) : ""}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Déconnexion"
              title="Déconnexion"
              className="p-1.5 rounded-[8px] text-grey hover:text-cream hover:bg-white/5 transition-colors duration-300 cursor-pointer"
            >
              <IconLogout size={15} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-8 py-7 max-w-[1180px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
