import { BuildingSwitcher } from "@/components/features/building-switcher";
import { PortalShell, type NavItem } from "@/components/features/portal-shell";
import {
  IconAnnounce,
  IconBuilding,
  IconChat,
  IconDoc,
  IconGrid,
  IconMap,
  IconPackage,
  IconPhone,
  IconSettings,
  IconShirt,
  IconStar,
  IconTag,
  IconTool,
  IconUsers,
} from "@/components/ui/icons";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Building } from "@/types";

// Icônes pré-rendues en éléments : un composant fonction ne peut pas
// traverser la frontière Server → Client Component (SidebarNav), un
// élément React déjà rendu le peut.
const nav: NavItem[] = [
  { href: "/concierge", label: "Demandes", icon: <IconGrid size={15} /> },
  { href: "/concierge/interventions", label: "Interventions", icon: <IconTool size={15} /> },
  { href: "/concierge/colis", label: "Colis", icon: <IconPackage size={15} /> },
  { href: "/concierge/pressing", label: "Pressing", icon: <IconShirt size={15} /> },
  { href: "/concierge/live-map", label: "Live Map", icon: <IconMap size={15} /> },
  { href: "/concierge/residents", label: "Résidents", icon: <IconUsers size={15} /> },
  { href: "/concierge/whatsapp", label: "WhatsApp", icon: <IconPhone size={15} /> },
  { href: "/concierge/devis", label: "Devis", icon: <IconTag size={15} /> },
  { href: "/concierge/recommandations", label: "Recommandations", icon: <IconStar size={15} /> },
  { href: "/concierge/annonces", label: "Annonces", icon: <IconAnnounce size={15} /> },
  { href: "/concierge/messagerie", label: "Messagerie syndic", icon: <IconChat size={15} /> },
  { href: "/concierge/documents", label: "Documents syndic", icon: <IconDoc size={15} /> },
];

export default async function ConciergeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const supabase = await createClient();
  const isSuper = session?.role === "super_admin";
  const [{ data: building }, { data: buildings }] = await Promise.all([
    session
      ? supabase.from("buildings").select("name").eq("id", session.buildingId).maybeSingle()
      : Promise.resolve({ data: null }),
    isSuper ? supabase.from("buildings").select("*").order("name") : Promise.resolve({ data: null }),
  ]);

  const secondaryNav: NavItem[] = [];
  if (session?.role === "admin" || isSuper) {
    secondaryNav.push({ href: "/admin", label: "Administration", icon: <IconSettings size={14} /> });
  }
  if (isSuper) {
    secondaryNav.push({ href: "/syndic", label: "Portail syndic", icon: <IconBuilding size={14} /> });
  }

  return (
    <PortalShell
      portalName={building?.name ?? "Espace Concierge"}
      nav={nav}
      secondaryNav={secondaryNav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
      sidebarExtra={
        isSuper ? (
          <BuildingSwitcher buildings={(buildings ?? []) as Building[]} current={session?.buildingId} />
        ) : undefined
      }
    >
      {children}
    </PortalShell>
  );
}
