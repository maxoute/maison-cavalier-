import { redirect } from "next/navigation";
import { SyndicThread } from "@/components/features/syndic-thread";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";

export default async function ConciergeMessageriePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Messagerie syndic"
        subtitle="Canal dédié au syndic de copropriété, séparé des échanges résidents. Cochez « Incident » pour signaler un événement grave."
      />
      <SyndicThread viewerId={session.userId} buildingId={session.buildingId} />
    </div>
  );
}
