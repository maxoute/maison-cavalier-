import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationChannelType, NotificationEvent } from "@/types";
import { MockChannel } from "./mock-channel";
import type { NotificationChannel, NotificationMessage } from "./types";

/** Matrice de routage par type d'événement — PRD Annexe A. */
const routing: Record<NotificationEvent, NotificationChannelType[]> = {
  colis_recu: ["push", "whatsapp", "email"],
  chauffeur_en_route: ["push"],
  chauffeur_arrive: ["push", "whatsapp", "sms"],
  pressing_pret: ["push", "whatsapp", "email"],
  rappel_colis_non_retire: ["push", "whatsapp"],
  offre_billetterie: ["push", "email"],
  annonce_urgente: ["push", "whatsapp", "email", "sms"],
  confirmation_paiement: ["email"],
};

/**
 * Canaux actifs. En dev, tout passe par MockChannel ; les vrais providers
 * (FCM, WhatsApp Business, Twilio…) remplaceront ces entrées un par un
 * sans toucher au routeur ni aux appelants.
 */
const channels: Record<NotificationChannelType, NotificationChannel> = {
  push: new MockChannel("push"),
  whatsapp: new MockChannel("whatsapp"),
  email: new MockChannel("email"),
  sms: new MockChannel("sms"),
};

/**
 * Envoie une notification sur tous les canaux prévus pour l'événement,
 * et historise chaque envoi pour audit (PRD §7.3).
 */
export async function dispatchNotification(
  message: NotificationMessage,
): Promise<void> {
  const targets = routing[message.event];
  const supabase = createAdminClient();

  await Promise.all(
    targets.map(async (type) => {
      await channels[type].send(message);
      await supabase.from("notifications").insert({
        building_id: message.buildingId,
        recipient_resident_id: message.recipient.residentId ?? null,
        recipient_profile_id: message.recipient.profileId ?? null,
        event: message.event,
        channel: type,
        payload: {
          title: message.title,
          body: message.body,
          ...message.data,
        },
      });
    }),
  );
}
