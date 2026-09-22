"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { IconArrowRight, IconClose, IconLogout, IconMenu } from "@/components/ui/icons";
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
 * Coquille commune aux trois portails : sidebar à gauche (nav + identité +
 * déconnexion) et contenu principal — vrai gabarit d'app web, pas une
 * simple page. Sur mobile, la sidebar devient un tiroir hors-écran ouvert
 * via le bouton hamburger de la barre supérieure.
 */
export function PortalShell({
  portalName,
  nav,
  secondaryNav = [],
  userName,
  role,
  sidebarExtra,
  children,
}: {
  portalName: string;
  nav: NavItem[];
  /** Passerelles vers les autres portails accessibles au rôle. */
  secondaryNav?: NavItem[];
  userName: string;
  role?: string;
  sidebarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Referme le tiroir à chaque changement de page (la sidebar persiste
  // entre navigations puisqu'elle vit dans le layout). Ajusté pendant le
  // rendu plutôt que dans un effet : pas de rendu intermédiaire tiroir
  // ouvert sur la nouvelle page.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen md:flex-row">
      <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-surface">
        <div className="flex items-center gap-2.5 min-w-0">
          <Seal size={28} />
          <div className="min-w-0">
            <p className="font-serif text-ink text-[13px] leading-tight truncate">
              Maison Cavalier
            </p>
            <p className="text-[9px] uppercase tracking-[1.5px] text-gold-deep/80 truncate">
              {portalName}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="shrink-0 p-2 rounded-[8px] text-ink hover:bg-ink/5 transition-colors duration-300 cursor-pointer"
        >
          {mobileOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
        </button>
      </header>

      {mobileOpen && (
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-ink/40 backdrop-blur-[1px]"
        />
      )}

      <aside
        className={`w-[236px] shrink-0 border-r border-line bg-surface flex flex-col
          fixed inset-y-0 left-0 z-40 transition-[transform,visibility] duration-300 ease-out
          md:sticky md:top-0 md:h-screen md:z-auto md:translate-x-0 md:visible
          ${mobileOpen ? "translate-x-0 visible" : "-translate-x-full invisible"}`}
      >
        <div className="hidden md:flex px-5 py-5 items-center gap-2.5 border-b border-line/80">
          <Seal size={32} />
          <div className="min-w-0">
            <p className="font-serif text-ink text-[14px] leading-tight truncate">
              Maison Cavalier
            </p>
            <p className="text-[9px] uppercase tracking-[1.5px] text-gold-deep/80 truncate">
              {portalName}
            </p>
          </div>
        </div>

        <SidebarNav nav={nav} />

        {secondaryNav.length > 0 && (
          <div className="px-3 pb-2 pt-1 border-t border-line/60">
            <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-[1.5px] text-muted">Autres espaces</p>
            {secondaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[12px] text-muted hover:text-ink hover:bg-ink/[0.03] transition-colors duration-300"
              >
                {item.icon && <span className="shrink-0 [&>svg]:block">{item.icon}</span>}
                <span className="truncate flex-1">{item.label}</span>
                <IconArrowRight size={11} className="shrink-0 opacity-60" />
              </Link>
            ))}
          </div>
        )}

        {sidebarExtra && (
          <div className="px-3.5 pb-3 pt-2 border-t border-line/60">
            {sidebarExtra}
          </div>
        )}

        <div className="px-3.5 py-3.5 border-t border-line/80 flex items-center gap-2.5">
          <Avatar name={userName || "?"} size={30} />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink truncate leading-tight">
              {userName}
            </p>
            <p className="text-[9px] uppercase tracking-[1px] text-muted truncate">
              {role ? (roleLabels[role] ?? role) : ""}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Déconnexion"
              title="Déconnexion"
              className="p-1.5 rounded-[8px] text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-300 cursor-pointer"
            >
              <IconLogout size={15} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7 max-w-[1180px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
