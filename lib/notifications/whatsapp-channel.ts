import "server-only";

import { getWhatsAppProvider, toE164 } from "@/lib/whatsapp";
import type { NotificationChannelType } from "@/types";
import type { NotificationChannel, NotificationMessage } from "./types";

/**
 * Canal WhatsApp du routeur de notifications (PRD §7.3).
 * Une seule couture vers WhatsApp dans toute l'application : ce canal
 * délègue au provider, il n'appelle jamais Meta directement.
 */
export class WhatsAppChannel implements NotificationChannel {
  readonly type: NotificationChannelType = "whatsapp";

  async send(message: NotificationMessage): Promise<void> {
    const to = toE164(message.recipient.phone);
    if (!to) {
      // Pas de numéro exploitable : les autres canaux de l'événement
      // prennent le relais, l'historisation garde la trace de la tentative.
      console.warn(
        `[notification:whatsapp] event=${message.event} ignoré — numéro absent ou invalide`,
      );
      return;
    }

    await getWhatsAppProvider().send({
      to,
      body: `${message.title}\n\n${message.body}`,
    });
  }
}
