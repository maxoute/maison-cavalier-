import { sendSyndicMessage } from "@/app/actions/syndic";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconSend } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { SyndicMessage } from "@/types";

type Msg = SyndicMessage & { profiles: { full_name: string; role: string } | null };

/**
 * Fil concierge ↔ syndic en bulles de chat (maquette client, PRD §6.1.8).
 * `viewerId` aligne à droite les messages de l'utilisateur courant ;
 * `buildingId` cantonne le fil à l'immeuble piloté (le super-admin voit
 * sinon tous les immeubles).
 */
export async function SyndicThread({ viewerId, buildingId }: { viewerId: string; buildingId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("syndic_messages")
    .select("*, profiles(full_name, role)")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: true });

  const messages = (data ?? []) as Msg[];
  const incidents = messages.filter((m) => m.is_incident).length;

  return (
    <div className="max-w-[640px] space-y-4 fade-up">
      <p className="text-[11px] text-muted">
        Canal sécurisé et horodaté · {messages.length} message{messages.length > 1 ? "s" : ""}
        {incidents > 0 && <> · <span className="text-red">{incidents} incident{incidents > 1 ? "s" : ""} signalé{incidents > 1 ? "s" : ""}</span></>}
      </p>

      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.sender_profile_id === viewerId;
          const name = m.profiles?.full_name ?? "—";
          const isSyndic = m.profiles?.role === "syndic";
          return (
            <div key={m.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <Avatar name={name} size={26} className="mb-0.5" />}
              <div
                className={cn(
                  "max-w-[78%] rounded-[12px] border p-3 shadow-[0_4px_16px_-10px_rgba(10,22,40,.2)]",
                  mine
                    ? "bg-gradient-to-br from-gold/[0.14] to-gold/[0.06] border-gold/25 rounded-br-[3px]"
                    : "bg-surface border-line rounded-bl-[3px]",
                )}
              >
                <p className="text-[9.5px] font-semibold text-gold-deep mb-1">
                  {name}{" "}
                  <span className="text-muted font-normal">· {isSyndic ? "Syndic" : "Conciergerie"} · {formatDateTime(m.created_at)}</span>
                  {m.is_incident && <Badge tone="red" className="ml-2">Incident</Badge>}
                </p>
                <p className="text-[12px] text-ink/85 leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
              </div>
              {mine && <Avatar name={name} size={26} className="mb-0.5" />}
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-[12.5px] text-muted rounded-[8px] border border-dashed border-line px-4 py-6 text-center">Aucun message. Écrivez le premier.</p>
        )}
      </div>

      <form action={sendSyndicMessage} className="flex gap-2 items-center pt-1">
        <Input name="body" placeholder="Écrire un message…" required maxLength={4000} className="flex-1 rounded-[22px] text-[12.5px]" />
        <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer shrink-0">
          <input type="checkbox" name="is_incident" className="accent-[#b9452f]" />
          Incident
        </label>
        <Button type="submit" size="sm">Envoyer <IconSend size={12} /></Button>
      </form>
    </div>
  );
}
