import 'server-only';

import type { MetaConfig } from './config';
import type { WhatsAppOutbound, WhatsAppProvider, WhatsAppSendResult } from './types';

/**
 * Provider Meta Cloud API. Hors de la fenêtre de service de 24 h, Meta
 * n'accepte qu'un modèle validé : `template` produit donc un envoi de type
 * `template`, et `body` seul un message texte de réponse.
 */
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta';

  constructor(private readonly config: MetaConfig) {}

  async send(message: WhatsAppOutbound): Promise<WhatsAppSendResult> {
    const payload = message.template
      ? {
          messaging_product: 'whatsapp', to: message.to, type: 'template',
          template: {
            name: message.template.name,
            language: { code: 'fr' },
            components: message.template.variables.length
              ? [{ type: 'body', parameters: message.template.variables.map(text => ({ type: 'text', text })) }]
              : [],
          },
        }
      : { messaging_product: 'whatsapp', to: message.to, type: 'text', text: { preview_url: false, body: message.body } };

    const response = await fetch(
      `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      // Le corps d'erreur de Meta peut contenir le numéro : on ne le relaie pas.
      throw new Error(`WhatsApp a refusé l’envoi (HTTP ${response.status}).`);
    }
    const result = (await response.json()) as { messages?: { id?: string }[] };
    const externalMessageId = result.messages?.[0]?.id;
    if (!externalMessageId) throw new Error('WhatsApp n’a pas renvoyé d’identifiant de message.');
    return { externalMessageId, status: 'envoye' };
  }
}
