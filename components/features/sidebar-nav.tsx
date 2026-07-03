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
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {nav.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-[12.5px] font-medium",
              "transition-colors duration-300",
              isActive
                ? "text-gold-light bg-gold/[0.09]"
                : "text-grey hover:text-cream hover:bg-white/[0.04]",
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-gradient-to-b from-gold-light to-gold"
              />
            )}
            {item.icon && <span className="shrink-0 [&>svg]:block">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
