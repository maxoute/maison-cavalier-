import "server-only";

import { readMetaConfig } from "./config";
import { MetaWhatsAppProvider } from "./meta-provider";
import { MockWhatsAppProvider } from "./mock-provider";
import type { WhatsAppProvider } from "./types";

export type { WhatsAppOutbound, WhatsAppProvider, WhatsAppSendResult } from "./types";
export { toE164, toWaId } from "./phone";
export { readMetaConfig } from "./config";

const config = readMetaConfig();
const provider: WhatsAppProvider = config
  ? new MetaWhatsAppProvider(config)
  : new MockWhatsAppProvider();

/**
 * Seul point d'entrée vers WhatsApp. Le provider Meta Cloud API prend le
 * relais dès que les quatre variables du compte Business sont présentes
 * (identifiant du numéro, jeton, secret d'application, jeton de
 * vérification) ; il en manque une et l'application reste explicitement en
 * simulation — un envoi silencieusement perdu en production serait pire
 * qu'un log.
 */
export function getWhatsAppProvider(): WhatsAppProvider {
  return provider;
}

/** Vrai quand les envois partent réellement chez Meta. */
export function isWhatsAppLive(): boolean {
  return provider.name !== "mock";
}
