import { PortalShell, type NavItem } from "@/components/features/portal-shell";
import { IconChart, IconChat, IconDoc, IconHome, IconSettings } from "@/components/ui/icons";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const nav: NavItem[] = [
  { href: "/syndic", label: "Messagerie", icon: <IconChat size={15} /> },
  { href: "/syndic/documents", label: "Documents", icon: <IconDoc size={15} /> },
  { href: "/syndic/reporting", label: "Reporting", icon: <IconChart size={15} /> },
];

export default async function SyndicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const supabase = await createClient();
  const { data: building } = session
    ? await supabase.from("buildings").select("name").eq("id", session.buildingId).maybeSingle()
    : { data: null };

  const secondaryNav: NavItem[] = session?.role === "super_admin"
    ? [
        { href: "/admin", label: "Administration", icon: <IconSettings size={14} /> },
        { href: "/concierge", label: "Espace concierge", icon: <IconHome size={14} /> },
      ]
    : [];

  return (
    <PortalShell
      portalName={building?.name ? `Syndic · ${building.name}` : "Portail Syndic"}
      nav={nav}
      secondaryNav={secondaryNav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
    >
      {children}
    </PortalShell>
  );
}
