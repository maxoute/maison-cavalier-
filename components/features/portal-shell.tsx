"use client";

import { useEffect, useState } from "react";
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
  /** Accès prioritaire affiché dans la barre de navigation mobile. */
  mobile?: boolean;
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
  const mobileNav = nav.filter((item) => item.mobile).slice(0, 4);
  const mobileActive = mobileNav
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

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
      <header className="sticky top-0 z-20 md:hidden flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] border-b border-line bg-surface/95 backdrop-blur-md">
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
          className="grid size-11 shrink-0 place-items-center rounded-[8px] text-ink hover:bg-ink/5 transition-colors duration-300 cursor-pointer"
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
        aria-label="Navigation principale"
        className={`w-[min(86vw,320px)] md:w-[236px] shrink-0 border-r border-line bg-surface flex flex-col
          fixed inset-y-0 left-0 z-40 transition-[transform,visibility] duration-300 ease-out
          md:sticky md:top-0 md:h-screen md:z-auto md:translate-x-0 md:visible
          ${mobileOpen ? "translate-x-0 visible" : "-translate-x-full invisible"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] md:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Seal size={30} />
            <div className="min-w-0">
              <p className="font-serif text-base leading-tight text-ink">Maison Cavalier</p>
              <p className="mt-0.5 truncate text-xs text-muted">{portalName}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="grid size-11 shrink-0 place-items-center rounded-[8px] text-ink cursor-pointer"
          >
            <IconClose size={20} />
          </button>
        </div>
        <div className="hidden md:flex px-5 py-5 items-center gap-2.5 border-b border-line/80">
          <Seal size={32} />
          <div className="min-w-0">
            <p className="font-serif text-ink text-base leading-tight truncate">
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
            <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted">Autres espaces</p>
            {secondaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm text-muted hover:text-ink hover:bg-ink/[0.03] transition-colors duration-300"
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
          <Link
            href="/compte"
            title="Mon compte : changer de mot de passe"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] -m-1 p-1 hover:bg-ink/[0.03] transition-colors duration-300"
          >
            <Avatar name={userName || "?"} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate leading-tight">
                {userName}
              </p>
              <p className="mt-1 text-xs text-muted truncate">
                {role ? (roleLabels[role] ?? role) : ""}
              </p>
            </div>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Déconnexion"
              title="Déconnexion"
              className="grid size-11 place-items-center rounded-[8px] text-muted hover:text-ink hover:bg-ink/5 transition-colors duration-300 cursor-pointer"
            >
              <IconLogout size={15} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:px-10 md:py-9 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid md:hidden border-t border-line bg-surface/95 px-2 pt-1.5 pb-[calc(.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(10,22,40,.06)] backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length + 1}, minmax(0, 1fr))` }}
      >
        {mobileNav.map((item) => {
          const active = item.href === mobileActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] px-1 text-[11px] font-medium ${active ? "text-ink" : "text-muted"}`}
            >
              <span className={`grid size-7 place-items-center rounded-[8px] ${active ? "bg-surface-2" : ""}`}>
                {item.icon}
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[8px] px-1 text-[11px] font-medium cursor-pointer ${mobileOpen ? "text-ink" : "text-muted"}`}
        >
          <span className={`grid size-7 place-items-center rounded-[8px] ${mobileOpen ? "bg-surface-2" : ""}`}>
            <IconMenu size={17} />
          </span>
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
