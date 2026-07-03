import { PortalShell } from "@/components/features/portal-shell";
import {
  IconAnnounce,
  IconChat,
  IconCheck,
  IconDoc,
  IconGrid,
  IconMap,
  IconUsers,
} from "@/components/ui/icons";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// Icônes pré-rendues en éléments : un composant fonction ne peut pas
// traverser la frontière Server → Client Component (SidebarNav), un
// élément React déjà rendu le peut.
const nav = [
  { href: "/concierge", label: "Demandes", icon: <IconGrid size={15} /> },
  { href: "/concierge/live-map", label: "Live Map", icon: <IconMap size={15} /> },
  { href: "/concierge/residents", label: "Résidents", icon: <IconUsers size={15} /> },
  { href: "/concierge/devis", label: "Devis", icon: <IconDoc size={15} /> },
  { href: "/concierge/interventions", label: "Interventions", icon: <IconCheck size={15} /> },
  { href: "/concierge/messagerie", label: "Syndic", icon: <IconChat size={15} /> },
  { href: "/concierge/annonces", label: "Annonces", icon: <IconAnnounce size={15} /> },
];

export default async function ConciergeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const supabase = await createClient();
  const { data: building } = await supabase
    .from("buildings")
    .select("name")
    .eq("id", session?.buildingId ?? "")
    .single();

  return (
    <PortalShell
      portalName={building?.name ?? "Espace Concierge"}
      nav={nav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
    >
      {children}
    </PortalShell>
  );
}
