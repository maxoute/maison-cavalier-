import type { NotificationChannelType, NotificationEvent } from "@/types";

export interface NotificationRecipient {
  residentId?: string;
  profileId?: string;
  email?: string | null;
  phone?: string | null;
}

export interface NotificationMessage {
  buildingId: string;
  event: NotificationEvent;
  recipient: NotificationRecipient;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Contrat commun à tous les canaux (PRD §7.3).
 * Implémentations réelles à venir : FCM (push), WhatsApp Business,
 * Resend/SES (email), Twilio (SMS). En dev : MockChannel.
 */
export interface NotificationChannel {
  readonly type: NotificationChannelType;
  send(message: NotificationMessage): Promise<void>;
}
