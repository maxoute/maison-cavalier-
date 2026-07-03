import "server-only";

import type { NotificationChannelType } from "@/types";
import type { NotificationChannel, NotificationMessage } from "./types";

/**
 * Canal de développement : logge l'envoi au lieu de contacter un provider.
 * L'historisation en base est faite par le routeur, pas par le canal —
 * elle doit avoir lieu quel que soit le provider (PRD §7.3).
 */
export class MockChannel implements NotificationChannel {
  constructor(readonly type: NotificationChannelType) {}

  async send(message: NotificationMessage): Promise<void> {
    console.log(
      `[notification:${this.type}] event=${message.event} building=${message.buildingId} → ${
        message.recipient.email ?? message.recipient.phone ?? message.recipient.residentId ?? "?"
      } : ${message.title}`,
    );
  }
}
