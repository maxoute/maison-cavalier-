/**
 * Liens d'accès et règles de mot de passe — module pur, testé sans serveur.
 */

export type AccessLinkType = 'invite' | 'recovery';

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Lien vers la page de confirmation de l'application. On n'envoie jamais le
 * lien « action_link » de Supabase : il ouvrirait la session dans le
 * fragment d'URL, inutilisable côté serveur, et serait consommé par les
 * antivirus de messagerie qui visitent les liens à l'avance.
 */
export function accessLink(appUrl: string, tokenHash: string, type: AccessLinkType): string {
  const url = new URL('/auth/confirm', appUrl);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', type);
  return url.toString();
}

export function isAccessLinkType(value: unknown): value is AccessLinkType {
  return value === 'invite' || value === 'recovery';
}

/** Problème du mot de passe choisi, ou `null` s'il convient. */
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Choisissez au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (password.length > 72) return 'Mot de passe trop long : 72 caractères au maximum.';
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/[^A-Za-zÀ-ÿ]/.test(password)) {
    return 'Mélangez des lettres et au moins un chiffre ou un symbole.';
  }
  if (password !== confirmation) return 'Les deux saisies ne correspondent pas.';
  return null;
}
