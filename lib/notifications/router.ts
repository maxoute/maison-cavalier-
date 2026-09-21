import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationChannelType, NotificationEvent } from "@/types";
import { MockChannel } from "./mock-channel";
import { WhatsAppChannel } from "./whatsapp-channel";
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
  annonce_immeuble: ["push", "email"],
  confirmation_paiement: ["email"],
  // Recommandation poussée au résident sur son canal de conversation.
  recommandation_partagee: ["push", "whatsapp"],
  // Destinataire : la loge, pas le résident — un devis vient d'arriver dans
  // la boîte partagée et attend d'être qualifié (PRD §6.1.6).
  devis_recu: ["push", "email"],
};

/**
 * Canaux actifs. WhatsApp passe par son canal dédié — il porte le chat
 * opérationnel et a sa propre normalisation de numéro ; les autres restent
 * en MockChannel jusqu'à l'ouverture des comptes FCM, Resend et Twilio.
 */
const channels: Record<NotificationChannelType, NotificationChannel> = {
  push: new MockChannel("push"),
  whatsapp: new WhatsAppChannel(),
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
