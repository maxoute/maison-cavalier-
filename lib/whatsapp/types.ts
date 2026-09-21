import type { MessageDeliveryStatus } from "@/types";

/**
 * Message sortant vers WhatsApp Business.
 * Hors de la fenêtre de service de 24 h, Meta n'accepte qu'un modèle validé :
 * `template` est donc obligatoire pour toute initiative de la conciergerie
 * (rappel colis, pressing prêt…), `body` seul ne suffit qu'en réponse.
 */
export interface WhatsAppOutbound {
  /** Destinataire au format E.164, avec l'indicatif pays. */
  to: string;
  body: string;
  template?: { name: string; variables: string[] };
}

export interface WhatsAppSendResult {
  /** Id du message chez le provider → `messages.external_message_id`. */
  externalMessageId: string;
  status: MessageDeliveryStatus;
}

/**
 * Contrat du provider WhatsApp. Implémentation réelle à venir : Meta Cloud
 * API. En attendant l'ouverture du compte Business, `MockWhatsAppProvider`
 * tient le rôle sans que les appelants aient à changer.
 */
export interface WhatsAppProvider {
  readonly name: string;
  send(message: WhatsAppOutbound): Promise<WhatsAppSendResult>;
}
