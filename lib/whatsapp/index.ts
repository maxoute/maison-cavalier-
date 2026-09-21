import "server-only";

import { MockWhatsAppProvider } from "./mock-provider";
import type { WhatsAppProvider } from "./types";

export type { WhatsAppOutbound, WhatsAppProvider, WhatsAppSendResult } from "./types";
export { toE164, toWaId } from "./phone";

const provider: WhatsAppProvider = new MockWhatsAppProvider();

/**
 * Seul point d'entrée vers WhatsApp. Le provider Meta Cloud API se
 * substituera ici quand le compte Business sera ouvert : aucun appelant
 * n'aura à bouger. Tant qu'il n'existe pas, on rend explicitement le mock
 * plutôt qu'une bascule sur variables d'environnement — un envoi
 * silencieusement perdu en production serait pire qu'un log.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  return provider;
}
