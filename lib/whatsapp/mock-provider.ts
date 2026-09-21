import "server-only";

import type {
  WhatsAppOutbound,
  WhatsAppProvider,
  WhatsAppSendResult,
} from "./types";

/**
 * Provider de développement : logge l'envoi au lieu d'appeler Meta.
 * Il rend un `externalMessageId` de la même forme que l'API réelle
 * (« wamid.… ») pour que la clé d'idempotence de `messages` soit exercée
 * dès maintenant.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock";

  async send(message: WhatsAppOutbound): Promise<WhatsAppSendResult> {
    const kind = message.template
      ? `template=${message.template.name}`
      : "texte libre";
    console.log(
      `[whatsapp:mock] → ${message.to} (${kind}) : ${message.body}`,
    );
    return {
      externalMessageId: `wamid.mock-${crypto.randomUUID()}`,
      status: "envoye",
    };
  }
}
