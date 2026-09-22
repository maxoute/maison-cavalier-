import { PortalShell, type NavItem } from "@/components/features/portal-shell";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { BuildingSwitcher } from "@/components/features/building-switcher";
import {
  IconBuilding,
  IconChart,
  IconCoin,
  IconGrid,
  IconHome,
  IconTag,
  IconUsers,
} from "@/components/ui/icons";
import type { Building } from "@/types";

const nav: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: <IconGrid size={15} /> },
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
  // Le super_admin voit tous les immeubles (policy RLS), l'admin les siens
  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .order("name");

  const secondaryNav: NavItem[] = [
    { href: "/concierge", label: "Espace concierge", icon: <IconHome size={14} /> },
  ];
  if (session?.role === "super_admin") {
    secondaryNav.push({ href: "/syndic/reporting", label: "Portail syndic", icon: <IconChart size={14} /> });
  }

  return (
    <PortalShell
      portalName="Administration"
      nav={nav}
      secondaryNav={secondaryNav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
      sidebarExtra={
        session?.role === "super_admin" ? (
          <BuildingSwitcher
            buildings={(buildings ?? []) as Building[]}
            current={session.buildingId}
          />
        ) : undefined
      }
    >
      {children}
    </PortalShell>
  );
}
