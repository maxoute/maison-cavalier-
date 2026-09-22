import { redirect } from "next/navigation";
import { SyndicThread } from "@/components/features/syndic-thread";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";

export default async function SyndicHome() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messagerie"
        subtitle="Vos échanges avec la conciergerie de l'immeuble. Les incidents graves vous sont signalés ici."
      />
      <SyndicThread viewerId={session.userId} buildingId={session.buildingId} />
    </div>
  );
}
