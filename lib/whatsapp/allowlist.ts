import { toE164 } from "./phone.ts";

/**
 * Liste de destinataires autorisés pour les envois WhatsApp réels
 * (`WHATSAPP_ALLOWED_RECIPIENTS`, numéros séparés par des virgules).
 *
 * Garde-fou des environnements de test : la base de démonstration contient
 * des numéros au format réel, qui ne doivent jamais recevoir de message.
 * - variable absente : aucune restriction (production) ;
 * - variable présente : seuls les numéros listés reçoivent, et une liste
 *   sans numéro valide (« a_remplir ») bloque tout envoi.
 */
export function parseAllowedRecipients(value: string | undefined): Set<string> | null {
  if (value === undefined) return null;
  const numbers = value
    // Virgules et points-virgules seulement : un numéro saisi contient
    // souvent des espaces (« 06 12 34 56 78 »).
    .split(/[,;]+/)
    .map((entry) => toE164(entry.trim()))
    .filter((entry): entry is string => Boolean(entry));
  return new Set(numbers);
}

export function recipientAllowed(to: string, allowed: Set<string> | null): boolean {
  if (!allowed) return true;
  const normalised = toE164(to);
  return Boolean(normalised && allowed.has(normalised));
}
