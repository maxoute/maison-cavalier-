import { cookies } from "next/headers";
import { PortalShell } from "@/components/features/portal-shell";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { BuildingSwitcher } from "@/components/features/building-switcher";
import {
  IconBuilding,
  IconCoin,
  IconGrid,
  IconTag,
  IconUsers,
} from "@/components/ui/icons";
import type { Building } from "@/types";

const nav = [
  { href: "/admin", label: "Dashboard", icon: <IconGrid size={15} /> },
  { href: "/admin/immeubles", label: "Immeubles", icon: <IconBuilding size={15} /> },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: <IconUsers size={15} /> },
  { href: "/admin/services", label: "Services & tarifs", icon: <IconTag size={15} /> },
  { href: "/admin/finance", label: "Finance", icon: <IconCoin size={15} /> },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const supabase = await createClient();
  const cookieStore = await cookies();
  // Le super_admin voit tous les immeubles (policy RLS), l'admin les siens
  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .order("name");

  return (
    <PortalShell
      portalName="Command Center"
      nav={nav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
      sidebarExtra={
        session?.role === "super_admin" ? (
          <BuildingSwitcher
            buildings={(buildings ?? []) as Building[]}
            current={cookieStore.get("mc-building")?.value}
          />
        ) : undefined
      }
    >
      {children}
    </PortalShell>
  );
}
