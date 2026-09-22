import { LiveMap } from "@/components/features/live-map";
import type { DriverTripRecord } from "@/lib/drivers";
import { check, staffContext } from "@/lib/operations/server";
import type { TripStatus } from "@/types";

/** Objet lié : PostgREST rend une relation « plusieurs-à-un » seule ou en tableau. */
type Embed<T> = T | T[] | null;

/** Ligne de `driver_trips` avec le résident de la demande d'origine. */
interface TripRow {
  id: string;
  vehicle: string | null;
  status: TripStatus;
  origin: string | null;
  destination: string | null;
  eta: string | null;
  created_at: string;
  service_requests: Embed<{ residents: Embed<{ full_name: string }> }>;
}

function first<T>(value: Embed<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function residentOf(row: TripRow): string | null {
  return first(first(row.service_requests)?.residents ?? null)?.full_name ?? null;
}

/**
 * Live Map — suivi des chauffeurs de l'immeuble (PRD §6.1.2) et alerte
 * Plan B du voiturier (PRD §6.1.3).
 *
 * Le serveur ne fournit que le contexte immeuble et les courses réellement
 * enregistrées ; les positions arrivent par le `DriverPositionProvider`
 * côté client (simulateur tant que le compte Mapbox n'est pas ouvert).
 */
export default async function LiveMapPage() {
  const { db, session, now } = await staffContext();

  const [{ data: building, error: buildingError }, { data: tripRows, error: tripsError }] =
    await Promise.all([
      db.from("buildings").select("name, address").eq("id", session.buildingId).single(),
      db
        .from("driver_trips")
        .select(
          "id, vehicle, status, origin, destination, eta, created_at, service_requests(residents!requests_resident_tenant(full_name))",
        )
        .eq("building_id", session.buildingId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
  check(buildingError);
  check(tripsError);

  // Le client Supabase n'a pas de types générés : la forme des relations
  // imbriquées est décrite ici plutôt que devinée à la lecture.
  const trips: DriverTripRecord[] = ((tripRows ?? []) as unknown as TripRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    vehicle: row.vehicle,
    origin: row.origin,
    destination: row.destination,
    eta: row.eta,
    createdAt: row.created_at,
    resident: residentOf(row),
    ageMs: Math.max(0, now - Date.parse(row.created_at)),
  }));

  return (
    <LiveMap
      buildingId={session.buildingId}
      buildingName={building?.name ?? "Immeuble"}
      buildingAddress={building?.address ?? null}
      trips={trips}
    />
  );
}
