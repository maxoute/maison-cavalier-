"use client";

import { useRouter } from "next/navigation";
import { IconChevronDown } from "@/components/ui/icons";
import type { Building } from "@/types";

/**
 * Bascule d'immeuble sans déconnexion pour le super-admin (PRD §6.3.2).
 * Le choix est stocké en cookie et lu par les pages admin.
 */
export function BuildingSwitcher({
  buildings,
  current,
}: {
  buildings: Building[];
  current?: string;
}) {
  const router = useRouter();

  return (
    <div>
      <p className="px-1 pb-1.5 text-[9px] uppercase tracking-[1.5px] text-muted">
        Immeuble actif
      </p>
      <div className="relative">
        <select
          key={current ?? buildings[0]?.id}
          aria-label="Immeuble"
          defaultValue={current ?? buildings[0]?.id}
          onChange={(e) => {
            document.cookie = `mc-building=${e.target.value}; path=/; max-age=${60 * 60 * 24 * 30}`;
            router.refresh();
          }}
          className="w-full appearance-none bg-ink/[0.03] border border-line rounded-[8px] pl-3 pr-8 py-2 text-[11.5px] text-ink cursor-pointer focus:outline-none focus:border-gold/40 hover:border-grey/40 transition-colors duration-300"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id} className="bg-surface text-ink">
              {b.name}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={13}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
