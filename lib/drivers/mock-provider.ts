import type {
  Driver,
  DriverPositionProvider,
  DriverTripView,
  FleetSnapshot,
  MapPoint,
  VehicleKind,
} from './types.ts';

/**
 * Flux de positions simulé — tient lieu de Mapbox tant que le compte n'est
 * pas ouvert (règle AGENTS.md : interfaces + mocks pour les intégrations
 * externes).
 *
 * La simulation est **déterministe** : à immeuble et instant donnés, la
 * flotte est toujours la même. C'est ce qui permet de la tester unitairement
 * et de rejouer exactement la même démonstration. Le mouvement est calculé
 * par distance parcourue le long d'une polyligne (vitesse constante), ce qui
 * donne un déplacement régulier et un cap cohérent avec la rue empruntée.
 *
 * Deux échelles de temps cohabitent, volontairement :
 * - le temps de simulation (quelques dizaines de secondes par trajet), pour
 *   que la carte vive pendant une démonstration ;
 * - l'ETA affiché au concierge (`etaMinutes`), qui reste réaliste (42 min
 *   pour Roissy). L'un anime, l'autre informe.
 */

/* ------------------------------------------------------------------ */
/* Carte stylisée                                                      */
/* ------------------------------------------------------------------ */

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 470;

/** Pied d'immeuble : origine et terminus de toutes les courses. */
export const LODGE: MapPoint = { x: 330, y: 300 };

/** Trame viaire : rues secondaires, en unités de `viewBox`. */
export const MAP_GRID = {
  horizontal: [60, 140, 220, 300, 380],
  vertical: [80, 180, 330, 480, 620, 760, 900],
};

/** Axes structurants, tracés plus épais et nommés. */
export const MAP_AVENUES: {
  orientation: 'h' | 'v';
  at: number;
  label: string;
}[] = [
  { orientation: 'h', at: 300, label: 'Avenue Montaigne' },
  { orientation: 'v', at: 620, label: 'Boulevard Haussmann' },
];

/** Points d'intérêt affichés en repères de lecture. */
export const MAP_LANDMARKS: { label: string; x: number; y: number }[] = [
  { label: 'A1 · Roissy', x: 900, y: 60 },
  { label: 'Opéra Bastille', x: 620, y: 140 },
  { label: 'Gare de Lyon', x: 760, y: 380 },
];

/** Bande de Seine, purement décorative. */
export const MAP_RIVER = 'M 0 424 C 180 404, 340 452, 520 428 S 860 402, 1000 434 L 1000 470 L 0 470 Z';

const STREET_PATTERN = /\b(avenue|rue|boulevard|quai|place|cours|allée)\b\s+([^,]+)/i;

/**
 * « 12 avenue Montaigne, 75008 Paris » → « Avenue Montaigne ».
 * Sert à nommer l'axe principal de la carte avec la vraie voie de
 * l'immeuble : le concierge se repère à sa rue, pas à un fond générique.
 */
export function streetLabel(address: string | null | undefined): string | null {
  const match = STREET_PATTERN.exec(address ?? '');
  if (!match) return null;
  const kind = match[1].toLocaleLowerCase('fr-FR');
  const name = match[2].trim().replace(/\s+/g, ' ');
  if (!name) return null;
  return `${kind.charAt(0).toLocaleUpperCase('fr-FR')}${kind.slice(1)} ${name}`;
}

/* ------------------------------------------------------------------ */
/* Géométrie — fonctions pures, testées unitairement                   */
/* ------------------------------------------------------------------ */

export function segmentLength(a: MapPoint, b: MapPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Longueur cumulée d'une polyligne. */
export function pathLength(path: MapPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += segmentLength(path[i - 1], path[i]);
  return total;
}

/** Cap en degrés dans le repère écran : 0 = nord, 90 = est. */
export function headingDegrees(from: MapPoint, to: MapPoint): number {
  const degrees = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/**
 * Position à `distance` du départ, cap du segment courant. La distance est
 * bornée aux extrémités : un chauffeur ne dépasse jamais son terminus.
 */
export function pointAtDistance(
  path: MapPoint[],
  distance: number,
): { x: number; y: number; heading: number } {
  if (path.length === 0) return { x: 0, y: 0, heading: 0 };
  if (path.length === 1) return { x: path[0].x, y: path[0].y, heading: 0 };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const length = segmentLength(from, to);
    const heading = headingDegrees(from, to);
    if (length === 0) continue;
    if (remaining <= length) {
      const ratio = remaining / length;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        heading,
      };
    }
    remaining -= length;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y, heading: headingDegrees(path[path.length - 2], last) };
}

/**
 * Itinéraire restant : position courante puis tous les points encore à
 * venir. C'est la polyligne dorée tracée pour le chauffeur sélectionné.
 */
export function remainingPath(path: MapPoint[], distance: number): MapPoint[] {
  if (path.length < 2) return path.slice();
  const here = pointAtDistance(path, distance);
  const rest: MapPoint[] = [{ x: here.x, y: here.y }];
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    travelled += segmentLength(path[i - 1], path[i]);
    if (travelled > Math.max(0, distance)) rest.push(path[i]);
  }
  if (rest.length === 1) rest.push(path[path.length - 1]);
  return rest;
}

/** Minutes restantes affichées : jamais 0 tant que la course n'est pas finie. */
export function etaMinutesFromProgress(progress: number, legMinutes: number): number {
  const ratio = Math.min(1, Math.max(0, progress));
  return Math.max(1, Math.ceil(legMinutes * (1 - ratio)));
}

/* ------------------------------------------------------------------ */
/* Plan de roulement                                                   */
/* ------------------------------------------------------------------ */

interface Leg {
  origin: string;
  destination: string;
  resident: string | null;
  path: MapPoint[];
  /** Durée de simulation du trajet. */
  travelMs: number;
  /** Durée annoncée au concierge en début de course. */
  etaMinutes: number;
}

export interface DriverPhase {
  legIndex: number;
  /** 0 → 1 sur le trajet courant. */
  progress: number;
  moving: boolean;
  /** Temps déjà passé à l'arrêt au terminus du trajet. */
  waitedMs: number;
}

/**
 * Découpe le temps écoulé en trajets séparés par une pause au terminus :
 * le chauffeur roule, dépose, patiente, repart. C'est ce qui fait bouger
 * les compteurs de statut pendant la démonstration.
 */
export function phaseAt(elapsedMs: number, legs: Leg[], dwellMs: number): DriverPhase {
  const cycle = legs.reduce((sum, leg) => sum + leg.travelMs + dwellMs, 0);
  if (legs.length === 0 || cycle <= 0) {
    return { legIndex: 0, progress: 0, moving: false, waitedMs: 0 };
  }
  let t = ((elapsedMs % cycle) + cycle) % cycle;
  for (let i = 0; i < legs.length; i++) {
    if (t < legs[i].travelMs) {
      return { legIndex: i, progress: t / legs[i].travelMs, moving: true, waitedMs: 0 };
    }
    t -= legs[i].travelMs;
    if (t < dwellMs) {
      return { legIndex: i, progress: 1, moving: false, waitedMs: t };
    }
    t -= dwellMs;
  }
  return { legIndex: legs.length - 1, progress: 1, moving: false, waitedMs: dwellMs };
}

const route = (...points: [number, number][]): MapPoint[] =>
  points.map(([x, y]) => ({ x, y }));

type Plan =
  | {
      kind: 'course';
      id: string;
      name: string;
      vehicle: string;
      vehicleKind: VehicleKind;
      plate: string;
      phone: string;
      legs: Leg[];
      dwellMs: number;
      phaseMs: number;
    }
  | {
      kind: 'loge' | 'hors_ligne';
      id: string;
      name: string;
      vehicle: string;
      vehicleKind: VehicleKind;
      plate: string;
      phone: string;
      position: MapPoint;
      heading: number;
      note: string;
      /** Ancienneté du dernier point GPS reçu. */
      staleMs: number;
    };

const PLANS: Plan[] = [
  {
    kind: 'course',
    id: 'karim',
    name: 'Karim Belhadj',
    vehicle: 'Van Mercedes Classe V',
    vehicleKind: 'van',
    plate: 'FX-482-KM',
    phone: '+33 6 12 44 07 91',
    dwellMs: 10_000,
    phaseMs: 0,
    legs: [
      {
        origin: 'Loge',
        destination: 'Aéroport CDG, Terminal 2E',
        resident: 'Mme Delaunay',
        path: route([330, 300], [330, 140], [620, 140], [620, 60], [900, 60]),
        travelMs: 78_000,
        etaMinutes: 42,
      },
      {
        origin: 'Aéroport CDG, Terminal 2E',
        destination: 'Opéra Bastille',
        resident: 'M. Ferrand',
        path: route([900, 60], [760, 60], [760, 140], [620, 140]),
        travelMs: 38_000,
        etaMinutes: 24,
      },
      {
        origin: 'Opéra Bastille',
        destination: 'Loge — retour immeuble',
        resident: null,
        path: route([620, 140], [620, 220], [480, 220], [480, 300], [330, 300]),
        travelMs: 46_000,
        etaMinutes: 14,
      },
    ],
  },
  {
    kind: 'course',
    id: 'ines',
    name: 'Inès Rahmani',
    vehicle: 'Berline BMW Série 5',
    vehicleKind: 'berline',
    plate: 'GQ-107-RA',
    phone: '+33 6 71 90 22 38',
    dwellMs: 12_000,
    phaseMs: 26_000,
    legs: [
      {
        origin: 'Loge',
        destination: 'Gare de Lyon',
        resident: 'M. et Mme Ostrowski',
        path: route([330, 300], [480, 300], [480, 380], [760, 380]),
        travelMs: 58_000,
        etaMinutes: 17,
      },
      {
        origin: 'Gare de Lyon',
        destination: 'Loge — retour immeuble',
        resident: null,
        path: route([760, 380], [620, 380], [620, 220], [180, 220], [180, 300], [330, 300]),
        travelMs: 84_000,
        etaMinutes: 21,
      },
    ],
  },
  {
    kind: 'loge',
    id: 'sofiane',
    name: 'Sofiane Kadri',
    vehicle: 'Berline Mercedes Classe E',
    vehicleKind: 'berline',
    plate: 'DR-655-SK',
    phone: '+33 6 08 55 13 02',
    position: { x: 296, y: 324 },
    heading: 45,
    note: 'À la loge — disponible immédiatement',
    staleMs: 2_000,
  },
  {
    kind: 'hors_ligne',
    id: 'david',
    name: 'David Mercier',
    vehicle: 'SUV Range Rover',
    vehicleKind: 'suv',
    plate: 'AT-330-DM',
    phone: '+33 6 34 77 65 20',
    position: { x: 180, y: 220 },
    heading: 315,
    note: 'Hors ligne — application chauffeur déconnectée',
    staleMs: 12 * 60_000,
  },
];

/** Empreinte stable de l'immeuble : deux immeubles ne roulent pas en phase. */
export function buildingSeed(buildingId: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < buildingId.length; i++) {
    hash ^= buildingId.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

/** Latence du flux, déterministe et toujours sous la cible PRD d'une seconde. */
export function simulatedLatencyMs(elapsedMs: number, seed: number): number {
  const tick = Math.floor(Math.max(0, elapsedMs) / 1000);
  return 180 + ((seed + tick * 37) % 25) * 10;
}

function tripFor(leg: Leg, driverId: string, legIndex: number, progress: number, at: number): DriverTripView {
  const etaMinutes = etaMinutesFromProgress(progress, leg.etaMinutes);
  return {
    id: `${driverId}-${legIndex}`,
    origin: leg.origin,
    destination: leg.destination,
    resident: leg.resident,
    progress,
    etaMinutes,
    etaAt: at + etaMinutes * 60_000,
  };
}

/**
 * Flotte de l'immeuble à `elapsedMs` du début du suivi. Fonction pure :
 * mêmes entrées, même sortie — c'est le cœur testable du simulateur.
 */
export function fleetAt(buildingId: string, elapsedMs: number): FleetSnapshot {
  const seed = buildingSeed(buildingId);
  const at = Math.max(0, elapsedMs);
  const drivers: Driver[] = PLANS.map((plan, planIndex) => {
    const identity = {
      id: plan.id,
      name: plan.name,
      vehicle: plan.vehicle,
      vehicleKind: plan.vehicleKind,
      plate: plan.plate,
      phone: plan.phone,
    };
    if (plan.kind !== 'course') {
      return {
        ...identity,
        status: plan.kind === 'loge' ? ('en_attente' as const) : ('hors_ligne' as const),
        position: plan.position,
        heading: plan.heading,
        route: [],
        trip: null,
        note: plan.note,
        lastUpdate: at - plan.staleMs,
      };
    }
    // Décalage de phase par immeuble : la démonstration ne montre pas deux
    // fois la même chorégraphie d'un tenant à l'autre.
    const offset = plan.phaseMs + ((seed >>> (planIndex * 5)) % 23) * 1000;
    const phase = phaseAt(at + offset, plan.legs, plan.dwellMs);
    const leg = plan.legs[phase.legIndex];
    const distance = pathLength(leg.path) * phase.progress;
    const here = pointAtDistance(leg.path, distance);
    return {
      ...identity,
      status: phase.moving ? ('en_mouvement' as const) : ('en_attente' as const),
      position: { x: here.x, y: here.y },
      heading: here.heading,
      route: phase.moving ? remainingPath(leg.path, distance) : [],
      trip: phase.moving ? tripFor(leg, plan.id, phase.legIndex, phase.progress, at) : null,
      note: phase.moving ? null : `En attente · ${leg.destination}`,
      lastUpdate: at - (phase.moving ? 0 : Math.min(phase.waitedMs, 4_000)),
    };
  });
  return { at, latencyMs: simulatedLatencyMs(at, seed), drivers };
}

/**
 * Provider de démonstration : pousse un point par seconde, comme le fera le
 * canal temps réel. L'appelant ne voit qu'un abonnement et un désabonnement.
 */
export class MockDriverPositionProvider implements DriverPositionProvider {
  readonly name = 'mock';
  private readonly intervalMs: number;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  snapshot(buildingId: string, elapsedMs: number): FleetSnapshot {
    return fleetAt(buildingId, elapsedMs);
  }

  subscribe(buildingId: string, listener: (snapshot: FleetSnapshot) => void): () => void {
    const startedAt = Date.now();
    let stopped = false;
    const push = () => {
      if (stopped) return;
      listener(fleetAt(buildingId, Date.now() - startedAt));
    };
    push();
    const timer = setInterval(push, this.intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}
