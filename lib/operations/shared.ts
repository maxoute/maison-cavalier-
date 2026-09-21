export const parcelLabels: Record<string, string> = { recu: 'Reçu', stocke: 'Stocké', notifie: 'Résident notifié', remis: 'Remis', retourne: 'Retourné' };
export const pressingLabels: Record<string, string> = { collecte: 'Collecté', chez_le_pressing: 'Chez le pressing', pret: 'Prêt', livre: 'Livré' };
export const categories = { restaurant: 'Restaurant', artisan: 'Artisan', bien_etre: 'Bien-être', culture: 'Culture', transport: 'Transport', shopping: 'Shopping', autre: 'Autre' };
export type ActionResult = { error?: string; success?: string };
