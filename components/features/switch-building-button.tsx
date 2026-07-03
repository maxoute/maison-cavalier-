"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconArrowRight } from "@/components/ui/icons";

/** Bascule l'immeuble actif du super-admin depuis une ligne de la liste (PRD §6.3.2). */
export function SwitchBuildingButton({
  buildingId,
  active,
}: {
  buildingId: string;
  active?: boolean;
}) {
  const router = useRouter();
  if (active) {
    return (
      <span className="text-[10px] uppercase tracking-[1px] text-gold-light font-medium px-1">
        Actif
      </span>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        document.cookie = `mc-building=${buildingId}; path=/; max-age=${60 * 60 * 24 * 30}`;
        router.refresh();
      }}
    >
      Basculer <IconArrowRight size={12} />
    </Button>
  );
}
