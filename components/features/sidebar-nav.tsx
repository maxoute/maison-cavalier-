"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavItem } from "./portal-shell";

export function SidebarNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  // L'onglet le plus spécifique correspondant à l'URL est actif
  const active = nav
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Sections" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
      {nav.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm font-medium",
              "transition-colors duration-300",
              isActive
                ? "text-ink bg-surface-2"
                : "text-muted hover:text-ink hover:bg-ink/[0.03]",
            )}
          >
            {isActive && (
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-navy" />
            )}
            {item.icon && <span className="shrink-0 [&>svg]:block">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
