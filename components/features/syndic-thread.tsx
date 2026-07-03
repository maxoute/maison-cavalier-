import { sendSyndicMessage } from "@/app/actions/syndic";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconSend } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import type { SyndicMessage } from "@/types";

type Msg = SyndicMessage & { profiles: { full_name: string } | null };

/**
 * Fil concierge ↔ syndic en bulles de chat (maquette client, PRD §6.1.8).
 * `viewerId` aligne à droite les messages de l'utilisateur courant.
 */
export async function SyndicThread({ viewerId }: { viewerId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("syndic_messages")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: true });

  const messages = (data ?? []) as Msg[];

  return (
    <div className="max-w-[600px] space-y-4 fade-up">
      <p className="text-[10px] text-grey">
        Canal sécurisé · historisé · signé numériquement — accès syndic en
        lecture + réponse uniquement
      </p>

      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.sender_profile_id === viewerId;
          const name = m.profiles?.full_name ?? "—";
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                mine ? "justify-end" : "justify-start",
              )}
            >
              {!mine && <Avatar name={name} size={26} className="mb-0.5" />}
              <div
                className={cn(
                  "max-w-[78%] rounded-[12px] border p-3 shadow-[0_4px_16px_-8px_rgba(0,0,0,.5)]",
                  mine
                    ? "bg-gradient-to-br from-gold/[0.14] to-gold/[0.06] border-gold/25 rounded-br-[3px]"
                    : "bg-navy-2 border-navy-3 rounded-bl-[3px]",
                )}
              >
                <p className="text-[9.5px] font-semibold text-gold-light mb-1">
                  {name}{" "}
                  <span className="text-grey font-normal">
                    ·{" "}
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {m.is_incident && (
                    <Badge tone="red" className="ml-2">
                      Incident
                    </Badge>
                  )}
                </p>
                <p className="text-[11.5px] text-cream-dark leading-relaxed">
                  {m.body}
                </p>
              </div>
              {mine && <Avatar name={name} size={26} className="mb-0.5" />}
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-grey">Aucun message.</p>
        )}
      </div>

      <form action={sendSyndicMessage} className="flex gap-2 items-center pt-1">
        <input
          name="body"
          placeholder="Écrire un message…"
          required
          className="flex-1 bg-navy-2 border border-navy-3 rounded-[22px] px-4 py-2.5 text-[11.5px] text-cream placeholder:text-grey/60 focus:outline-none focus:border-gold/40 transition-colors duration-300"
        />
        <label className="flex items-center gap-1.5 text-[10px] text-grey cursor-pointer shrink-0">
          <input type="checkbox" name="is_incident" className="accent-[#c2503f]" />
          Incident
        </label>
        <Button type="submit" size="sm">
          Envoyer <IconSend size={12} />
        </Button>
      </form>
    </div>
  );
}
