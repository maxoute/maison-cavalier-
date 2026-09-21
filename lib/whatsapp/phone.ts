/**
 * Normalisation des numéros pour WhatsApp.
 * Les fiches résident sont saisies à la main : on rencontre aussi bien
 * « 06 98 76 54 01 » que « +33 6 98 76 54 01 » ou « 0033698765401 ».
 */

/** Indicatif appliqué aux numéros nationaux saisis sans indicatif. */
const DEFAULT_COUNTRY_CODE = "33";

/** Retourne le numéro au format E.164 (« +33698765401 »), ou null. */
export function toE164(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Numéro national : « 0698765401 » → « 33698765401 »
    digits = countryCode + digits.slice(1);
  }

  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Identifiant WhatsApp : même chose sans le « + ». */
export function toWaId(
  phone: string | null | undefined,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  const e164 = toE164(phone, countryCode);
  return e164 ? e164.slice(1) : null;
}
