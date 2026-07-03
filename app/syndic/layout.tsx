import { PortalShell } from "@/components/features/portal-shell";
import { IconChart, IconChat, IconDoc } from "@/components/ui/icons";
import { getSession } from "@/lib/session";

const nav = [
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
  return (
    <PortalShell
      portalName="Portail Syndic"
      nav={nav}
      userName={session?.profile?.full_name ?? ""}
      role={session?.role}
    >
      {children}
    </PortalShell>
  );
}
