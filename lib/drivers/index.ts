import { MockDriverPositionProvider } from './mock-provider.ts';
import type { DriverPositionProvider, FleetSnapshot } from './types.ts';

export type {
  Driver,
  DriverPositionProvider,
  DriverStatus,
  DriverTripRecord,
  DriverTripView,
  FleetSnapshot,
  MapPoint,
  VehicleKind,
} from './types.ts';
export { driverStatusLabels, vehicleKindLabels } from './types.ts';

/**
 * Le jeton Mapbox est la bascule : tant qu'il n'est pas renseigné, la Live
 * Map tourne sur le simulateur (règle AGENTS.md). Référence statique à
 * `process.env.NEXT_PUBLIC_*` pour que Next l'inline au build.
 */
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const NOT_IMPLEMENTED =
  "Suivi GPS Mapbox non implémenté : le flux temps réel des chauffeurs reste à brancher (PRD §6.1.2). Retirez NEXT_PUBLIC_MAPBOX_TOKEN pour repasser sur le simulateur.";

/**
 * Emplacement réservé de l'implémentation réelle : positions poussées par le
 * canal Supabase Realtime et projetées sur un fond Mapbox. Elle échoue
 * bruyamment plutôt que d'afficher une carte vide — une flotte figée serait
 * plus dangereuse pour la loge qu'une erreur franche.
 */
export class MapboxDriverPositionProvider implements DriverPositionProvider {
  readonly name = 'mapbox';

  // TODO(sprint 3) : abonnement `driver_positions` + projection Mapbox GL.
  snapshot(): FleetSnapshot {
    throw new Error(NOT_IMPLEMENTED);
  }

  subscribe(): () => void {
    throw new Error(NOT_IMPLEMENTED);
  }
}

const provider: DriverPositionProvider = mapboxToken
  ? new MapboxDriverPositionProvider()
  : new MockDriverPositionProvider();

/** Seul point d'entrée vers le flux de positions chauffeurs. */
export function getDriverProvider(): DriverPositionProvider {
  return provider;
}

/** Vrai quand les positions viennent réellement du terrain. */
export function isDriverFeedLive(): boolean {
  return provider.name !== 'mock';
}
