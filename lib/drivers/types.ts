import type { TripStatus } from '@/types';

/**
 * Modèle de vue du suivi chauffeurs (Live Map, PRD §6.1.2).
 *
 * Deux sources cohabitent derrière la même forme :
 * - le flux de positions (aujourd'hui simulé, demain Mapbox + Realtime) ;
 * - les courses réellement enregistrées en base (`driver_trips`), qui
 *   alimentent l'alerte Plan B du voiturier (PRD §6.1.3).
 *
 * Convention d'horodatage : tout ce qui vient du flux est exprimé en
 * millisecondes **depuis le début du suivi**, jamais en temps absolu. Le
 * premier rendu (serveur) part donc toujours de 0 et le rendu client
 * repart du même point : pas d'écart d'hydratation, et les durées
 * affichées (« il y a 2 s », « ETA 12 min ») restent des différences,
 * indépendantes de l'horloge de la machine.
 */

/** Statuts visuels du PRD : vert / orange / gris. */
export type DriverStatus = 'en_mouvement' | 'en_attente' | 'hors_ligne';

export type VehicleKind = 'van' | 'berline' | 'suv';

export const driverStatusLabels: Record<DriverStatus, string> = {
  en_mouvement: 'En mouvement',
  en_attente: 'En attente',
  hors_ligne: 'Hors ligne',
};

export const vehicleKindLabels: Record<VehicleKind, string> = {
  van: 'Van',
  berline: 'Berline',
  suv: 'SUV',
};

/** Point de la carte stylisée, en unités du `viewBox` (1000 × 560). */
export interface MapPoint {
  x: number;
  y: number;
}

/** Course en cours telle qu'elle s'affiche dans la fiche chauffeur. */
export interface DriverTripView {
  id: string;
  origin: string;
  destination: string;
  /** Résident servi, quand la course vient d'une demande identifiée. */
  resident: string | null;
  /** Avancement sur l'itinéraire, 0 → 1. */
  progress: number;
  /** Minutes restantes affichées au concierge. */
  etaMinutes: number;
  /** Arrivée estimée, en ms depuis le début du suivi. */
  etaAt: number;
}

export interface Driver {
  id: string;
  name: string;
  /** Libellé complet, ex. « Van Mercedes Classe V ». */
  vehicle: string;
  vehicleKind: VehicleKind;
  plate: string;
  /** Numéro de démonstration (aucune intégration téléphonie ouverte). */
  phone: string;
  status: DriverStatus;
  position: MapPoint;
  /** Cap en degrés, 0 = nord, sens horaire. */
  heading: number;
  /** Portion d'itinéraire restant à parcourir, pour la polyligne de suivi. */
  route: MapPoint[];
  trip: DriverTripView | null;
  /** Précision de la course quand il n'y en a pas (« À la loge »…). */
  note: string | null;
  /** Dernier point GPS reçu, en ms depuis le début du suivi (≤ `at`). */
  lastUpdate: number;
}

export interface FleetSnapshot {
  /** Horodatage du tick, en ms depuis le début du suivi. */
  at: number;
  /** Latence du flux de positions en ms — cible PRD : < 1 000. */
  latencyMs: number;
  drivers: Driver[];
}

/**
 * Contrat du flux de positions. L'implémentation réelle (Mapbox + canal
 * Supabase Realtime) devra s'y conformer sans que l'écran change : un
 * abonnement par immeuble, une fonction de désabonnement en retour.
 */
export interface DriverPositionProvider {
  readonly name: string;
  /** État de la flotte à un instant donné du suivi — fonction pure. */
  snapshot(buildingId: string, elapsedMs: number): FleetSnapshot;
  /** Abonnement au flux ; la valeur de retour coupe l'abonnement. */
  subscribe(
    buildingId: string,
    listener: (snapshot: FleetSnapshot) => void,
  ): () => void;
}

/** Course réelle lue dans `driver_trips` (sérialisable serveur → client). */
export interface DriverTripRecord {
  id: string;
  status: TripStatus;
  vehicle: string | null;
  origin: string | null;
  destination: string | null;
  /** ISO 8601, tel que stocké en base. */
  eta: string | null;
  createdAt: string;
  resident: string | null;
  /**
   * Ancienneté de la course au moment du rendu serveur, en ms. Le client y
   * ajoute le temps écoulé du flux : le compteur Plan B avance à l'écran
   * sans dépendre de l'horloge du poste, donc sans écart d'hydratation.
   */
  ageMs: number;
}
