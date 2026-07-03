import { redirect } from "next/navigation";
import { SyndicThread } from "@/components/features/syndic-thread";
import { getSession } from "@/lib/session";

export default async function SyndicHome() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl text-cream">Messagerie</h1>
      <SyndicThread viewerId={session.userId} />
    </div>
  );
}
