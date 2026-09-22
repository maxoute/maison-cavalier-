"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { IconAlert, IconCheck, IconClose, IconPlus } from "@/components/ui/icons";
import { Select } from "@/components/ui/input";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Meter, StatCard, StatGrid } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import {
  driverStatusLabels,
  getDriverProvider,
  vehicleKindLabels,
  type DriverStatus,
  type DriverTripRecord,
  type FleetSnapshot,
  type VehicleKind,
} from "@/lib/drivers";
import { streetLabel } from "@/lib/drivers/mock-provider";
import { formatDateTime, formatTime } from "@/lib/format";
import type { TripStatus } from "@/types";
import { DriverCard, DriverDetail, driverStatusMeta, freshness } from "./driver-card";
import { FleetMap } from "./fleet-map";

/** Délai Plan B du voiturier — PRD §6.1.3. */
const PLAN_B_DELAY_MS = 3 * 60_000;

const tripStatusLabels: Record<TripStatus, string> = {
  en_attente_chauffeur: "En attente chauffeur",
  acceptee: "Acceptée",
  en_route: "En route",
  arrivee: "Arrivée",
  terminee: "Terminée",
  annulee: "Annulée",
};

const tripStatusTones: Record<TripStatus, "orange" | "blue" | "green" | "grey" | "red"> = {
  en_attente_chauffeur: "orange",
  acceptee: "blue",
  en_route: "blue",
  arrivee: "green",
  terminee: "green",
  annulee: "red",
};

/** Courses proposées par le bouton « Nouvelle course » pendant la démonstration. */
const DEMO_RIDES = [
  { destination: "Aéroport CDG, Terminal 2E", resident: "Mme Delaunay" },
  { destination: "Opéra Bastille", resident: "M. Ferrand" },
  { destination: "Gare de Lyon", resident: "M. et Mme Ostrowski" },
];

interface PendingRide {
  destination: string;
  resident: string;
  /** Création, en ms depuis le début du suivi (même horloge que le flux). */
  createdAt: number;
  outcome: "taxi" | "reassign" | null;
}

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Live Map — suivi temps réel des chauffeurs de l'immeuble (PRD §6.1.2) et
 * garde-fou Plan B du voiturier (PRD §6.1.3).
 *
 * Les positions viennent du `DriverPositionProvider` : simulateur tant que
 * `NEXT_PUBLIC_MAPBOX_TOKEN` n'est pas renseigné, flux réel ensuite, sans
 * que cet écran change. Les courses réellement enregistrées en base sont
 * affichées à part et déclenchent, elles aussi, l'alerte Plan B.
 */
export function LiveMap({
  buildingId,
  buildingName,
  buildingAddress,
  trips,
  planBDelayMs = PLAN_B_DELAY_MS,
}: {
  buildingId: string;
  buildingName: string;
  buildingAddress: string | null;
  trips: DriverTripRecord[];
  planBDelayMs?: number;
}) {
  const provider = useMemo(() => getDriverProvider(), []);
  // Premier état servi par le provider à t = 0 : identique au rendu serveur
  // et au premier rendu client, donc aucun écart d'hydratation. Un provider
  // non implémenté (Mapbox) échoue ici et l'écran l'annonce au lieu de
  // laisser croire à une flotte vide.
  const [feed] = useState<{ snapshot: FleetSnapshot | null; error: string | null }>(() => {
    try {
      return { snapshot: provider.snapshot(buildingId, 0), error: null };
    } catch (error) {
      return { snapshot: null, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const feedError = feed.error;
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(feed.snapshot);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const drivers = snapshotDrivers(snapshot);
    return drivers.find((driver) => driver.trip)?.id ?? drivers[0]?.id ?? null;
  });
  const [follow, setFollow] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"tous" | DriverStatus>("tous");
  const [vehicleFilter, setVehicleFilter] = useState<"tous" | VehicleKind>("tous");
  const [pending, setPending] = useState<PendingRide | null>(null);
  const [rideIndex, setRideIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailsSentFor, setDetailsSentFor] = useState<string | null>(null);
  const [origin, setOrigin] = useState<number | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const lastTick = useRef(0);

  // Abonnement au flux de positions : un point par seconde (cible PRD < 1 s).
  // L'origine de l'horloge est déduite du premier point reçu (`Date.now()`
  // moins l'âge du flux) : c'est ce qui permet de reconvertir les ETA
  // relatifs en heure de Paris sans jamais dater le rendu serveur.
  useEffect(() => {
    if (feedError) return;
    let stop: (() => void) | null = null;
    try {
      stop = provider.subscribe(buildingId, (next) => {
        lastTick.current = Date.now();
        setOrigin((value) => value ?? Date.now() - next.at);
        setSnapshot(next);
      });
    } catch (error) {
      console.error("[live-map] flux de positions indisponible", error);
    }
    return () => stop?.();
  }, [provider, buildingId, feedError]);

  // Horloge de fraîcheur, indépendante du flux : elle continue de tourner si
  // le flux se tait, ce qui est précisément l'information utile en loge.
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastTick.current) setAge(Date.now() - lastTick.current);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6_000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!detailsSentFor) return;
    const timer = setTimeout(() => setDetailsSentFor(null), 6_000);
    return () => clearTimeout(timer);
  }, [detailsSentFor]);

  const drivers = snapshotDrivers(snapshot);
  const at = snapshot?.at ?? 0;
  const visible = drivers.filter(
    (driver) =>
      (statusFilter === "tous" || driver.status === statusFilter) &&
      (vehicleFilter === "tous" || driver.vehicleKind === vehicleFilter),
  );
  const selected = visible.find((driver) => driver.id === selectedId) ?? null;
  const counts = {
    en_mouvement: drivers.filter((d) => d.status === "en_mouvement").length,
    en_attente: drivers.filter((d) => d.status === "en_attente").length,
    hors_ligne: drivers.filter((d) => d.status === "hors_ligne").length,
  };

  // Plan B : courses réelles sans chauffeur depuis plus de 3 min. L'âge est
  // calculé côté serveur puis prolongé par l'horloge du flux — pas d'écart
  // d'hydratation, et le compteur continue d'avancer à l'écran.
  const stalledTrips = trips.filter(
    (trip) => trip.status === "en_attente_chauffeur" && trip.ageMs + at >= planBDelayMs,
  );
  const pendingElapsed = pending ? at - pending.createdAt : 0;
  const pendingLate = Boolean(pending) && pending?.outcome === null && pendingElapsed >= planBDelayMs;
  const planBOpen = pendingLate || stalledTrips.length > 0;

  const newRide = () => {
    const ride = DEMO_RIDES[rideIndex % DEMO_RIDES.length];
    setRideIndex((index) => index + 1);
    setPending({ ...ride, createdAt: at, outcome: null });
    setNotice(`Course créée vers ${ride.destination} — diffusion aux chauffeurs disponibles.`);
  };

  const availableDriver = drivers.find((driver) => driver.status === "en_attente");

  return (
    <div className="space-y-6 fade-up">
      <PageHeader
        title="Live Map"
        subtitle={
          <>
            Positions des chauffeurs de {buildingName}
            {buildingAddress ? ` · ${buildingAddress}` : ""} — flux rafraîchi chaque seconde.
          </>
        }
        actions={
          <Button
            variant="gold"
            size="sm"
            type="button"
            onClick={newRide}
            disabled={Boolean(pending && pending.outcome === null)}
          >
            <IconPlus size={13} /> Nouvelle course
          </Button>
        }
      />

      <StatGrid className="lg:grid-cols-4">
        <StatCard value={counts.en_mouvement} label="En mouvement" accent="green" hint="Chauffeurs en course" />
        <StatCard value={counts.en_attente} label="En attente" accent="orange" hint="Disponibles immédiatement" />
        <StatCard value={counts.hors_ligne} label="Hors ligne" accent="grey" hint="Application déconnectée" />
        <StatCard
          value={snapshot ? `${snapshot.latencyMs} ms` : "—"}
          label="Latence du flux"
          accent="blue"
          hint="Cible PRD : < 1 s"
        />
      </StatGrid>

      {feedError && (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-red/30 bg-red/[0.06] px-4 py-3.5">
          <IconAlert size={15} className="text-red shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-ink/90 leading-relaxed">
            Flux de positions indisponible — {feedError}
          </p>
        </div>
      )}

      {/* Plan B voiturier — PRD §6.1.3 */}
      {pending && pending.outcome === null && !pendingLate && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1">
              <p className="text-[12.5px] text-ink">
                Course proposée aux chauffeurs · <span className="text-muted">{pending.destination}</span>
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Pour {pending.resident} — aucune acceptation pour l&apos;instant. Alerte Plan B dans{" "}
                <span className="text-ink tabular-nums">{countdown(planBDelayMs - pendingElapsed)}</span>.
              </p>
            </span>
            <Button variant="outline" size="sm" type="button" onClick={() => setPending({ ...pending, createdAt: pending.createdAt - planBDelayMs })}>
              Simuler les 3 min
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={() => setPending(null)}>
              <IconClose size={12} /> Annuler
            </Button>
          </div>
          <Meter value={Math.min(1, pendingElapsed / planBDelayMs)} tone="orange" className="mt-3" />
        </Card>
      )}

      {planBOpen && (
        <div className="rounded-[8px] border border-orange/30 bg-orange/[0.06] px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <IconAlert size={16} className="text-orange shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink font-medium">Aucun chauffeur n&apos;a répondu sous 3 min</p>
              <p className="text-[11.5px] text-muted mt-1 leading-relaxed">
                {pendingLate && pending
                  ? `Course vers ${pending.destination} pour ${pending.resident}, en attente depuis ${countdown(pendingElapsed)}.`
                  : `${stalledTrips.length} course${stalledTrips.length > 1 ? "s" : ""} enregistrée${stalledTrips.length > 1 ? "s" : ""} sans chauffeur au-delà du délai d'attribution.`}{" "}
                Plan B : proposer un taxi externe au résident ou réattribuer la course.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setPending((current) => (current ? { ...current, outcome: "taxi" } : current));
                    setNotice("Taxi externe proposé — course G7 simulée, résident prévenu.");
                  }}
                >
                  Proposer un taxi externe
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setPending((current) => (current ? { ...current, outcome: "reassign" } : current));
                    if (availableDriver) setSelectedId(availableDriver.id);
                    setNotice(
                      availableDriver
                        ? `Course réattribuée à ${availableDriver.name} — détails de course envoyés.`
                        : "Aucun chauffeur disponible : réattribution à la prochaine disponibilité.",
                    );
                  }}
                >
                  Réassigner
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pending?.outcome && (
        <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-green/30 bg-green/[0.06] px-4 py-3.5">
          <IconCheck size={15} className="text-green shrink-0" />
          <p className="text-[12px] text-ink/90 min-w-0 flex-1">
            {pending.outcome === "taxi"
              ? `Taxi externe confirmé pour ${pending.resident} — ${pending.destination}, arrivée estimée 6 min (simulation).`
              : `Course vers ${pending.destination} réattribuée${availableDriver ? ` à ${availableDriver.name}` : ""} (simulation).`}
          </p>
          <Button variant="outline" size="sm" type="button" onClick={() => setPending(null)}>
            Clôturer
          </Button>
        </div>
      )}

      {/* Carte */}
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
          <Select
            aria-label="Filtrer par statut"
            className="max-w-[170px] py-1.5 text-[11.5px]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "tous" | DriverStatus)}
          >
            <option value="tous">Tous les statuts</option>
            {(Object.keys(driverStatusLabels) as DriverStatus[]).map((status) => (
              <option key={status} value={status}>
                {driverStatusLabels[status]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrer par véhicule"
            className="max-w-[170px] py-1.5 text-[11.5px]"
            value={vehicleFilter}
            onChange={(event) => setVehicleFilter(event.target.value as "tous" | VehicleKind)}
          >
            <option value="tous">Tous les véhicules</option>
            {(Object.keys(vehicleKindLabels) as VehicleKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {vehicleKindLabels[kind]}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            type="button"
            aria-pressed={follow}
            disabled={!selected}
            onClick={() => setFollow((value) => !value)}
            className={follow ? "border-gold/50 text-gold-deep" : undefined}
          >
            {follow && selected ? `Suivi de ${selected.name.split(" ")[0]}` : "Suivre"}
          </Button>

          <span className="ml-auto flex items-center gap-2 text-[10.5px] text-muted">
            <span className="relative flex w-2 h-2" aria-hidden>
              <span className="absolute inline-flex w-full h-full rounded-full bg-green opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-green" />
            </span>
            {age === null ? "Connexion au flux…" : `Mise à jour ${freshness(age)}`}
            {snapshot && ` · latence simulée ${snapshot.latencyMs} ms`}
          </span>
        </div>

        <div className="relative">
          <FleetMap
            drivers={visible}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setSelectedId(id)}
            follow={follow}
            buildingName={buildingName}
            avenueLabel={streetLabel(buildingAddress) ?? "Avenue Montaigne"}
          />

          {selected?.trip && (
            <div className="absolute bottom-3 right-3 rounded-[8px] border border-line bg-surface/95 px-3 py-2 shadow-[0_8px_24px_-18px_rgba(10,22,40,.5)] backdrop-blur-sm">
              <p className="text-[9px] uppercase tracking-[1.2px] text-muted">
                {selected.name.split(" ")[0]} · ETA
              </p>
              <p className="text-[15px] text-gold-deep font-medium tabular-nums leading-tight">
                {selected.trip.etaMinutes} min
              </p>
              <p className="text-[10px] text-muted truncate max-w-[170px]">{selected.trip.destination}</p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-[8px] border border-line bg-surface/90 px-3 py-1.5 text-[10px] text-muted backdrop-blur-sm">
            {(Object.keys(driverStatusMeta) as DriverStatus[]).map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: driverStatusMeta[status].color }}
                />
                {driverStatusMeta[status].label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Flotte + fiche détail */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-2.5">
            <SectionTitle hint={`${visible.length} sur ${drivers.length} chauffeurs affichés`}>
              Flotte de l&apos;immeuble
            </SectionTitle>
            {visible.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
                <p className="text-[13px] text-ink">Aucun chauffeur pour ce filtre</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  Élargissez le filtre de statut ou de véhicule pour retrouver la flotte.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {visible.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    selected={driver.id === selected?.id}
                    onSelect={() => setSelectedId(driver.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Courses enregistrées en base */}
          <div className="space-y-2.5">
            <SectionTitle hint={`${trips.length} course${trips.length > 1 ? "s" : ""}`}>
              Courses enregistrées
            </SectionTitle>
            {trips.length === 0 ? (
              <p className="text-[11px] text-muted leading-relaxed">
                Aucune course en base pour cet immeuble : la flotte ci-dessus provient du simulateur de
                positions, actif tant que le compte Mapbox n&apos;est pas ouvert. Les courses créées
                depuis l&apos;application Chauffeur apparaîtront ici et déclencheront la même alerte Plan B.
              </p>
            ) : (
              <div className="space-y-2">
                {trips.map((trip) => (
                  <Card key={trip.id} className="p-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge tone={tripStatusTones[trip.status]}>{tripStatusLabels[trip.status]}</Badge>
                      <span className="text-[12px] text-ink min-w-0 flex-1 break-words">
                        {trip.origin ?? "Départ immeuble"} → {trip.destination ?? "Destination à préciser"}
                      </span>
                      <span className="ml-auto text-[10.5px] text-muted">
                        {trip.eta ? `ETA ${formatTime(trip.eta)}` : "ETA non communiqué"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10.5px] text-muted">
                      {trip.resident ?? "Résident non rattaché"}
                      {trip.vehicle ? ` · ${trip.vehicle}` : ""} · créée le {formatDateTime(trip.createdAt)}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <SectionTitle>Fiche chauffeur</SectionTitle>
          {selected ? (
            <DriverDetail
              driver={selected}
              follow={follow}
              onToggleFollow={() => setFollow((value) => !value)}
              arrival={
                origin && selected.trip ? formatTime(origin + selected.trip.etaAt) : null
              }
              ageMs={Math.max(0, at - selected.lastUpdate)}
              detailsSent={detailsSentFor === selected.id}
              onSendDetails={() => {
                setDetailsSentFor(selected.id);
                setNotice(
                  `Détails de course envoyés à ${selected.name} par WhatsApp et SMS (simulation).`,
                );
              }}
            />
          ) : (
            <div className="rounded-[8px] border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
              <p className="text-[13px] text-ink">Aucun chauffeur sélectionné</p>
              <p className="mt-1 text-[11.5px] text-muted">
                Cliquez un marqueur sur la carte ou une carte de la flotte.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-[8px] border border-line bg-ink/[0.02] px-4 py-3">
        <SectionLabel className="shrink-0">Flux</SectionLabel>
        <p className="text-[11px] text-muted leading-relaxed">
          Positions simulées côté client (aucun compte Mapbox ouvert — règle interfaces + mocks).
          Le contrat <code className="text-ink/70">DriverPositionProvider</code> est déjà celui du
          flux réel : brancher Mapbox et le canal temps réel ne changera pas cet écran.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "fixed bottom-5 right-5 z-50 max-w-sm rounded-[8px] border border-green/40 bg-surface",
            "px-4 py-3 text-[11.5px] text-ink shadow-[0_18px_40px_-24px_rgba(10,22,40,.6)]",
            "flex items-start gap-2.5 fade-up",
          )}
        >
          <IconCheck size={14} className="text-green shrink-0 mt-0.5" />
          <span className="min-w-0">{notice}</span>
        </div>
      )}
    </div>
  );
}

function snapshotDrivers(snapshot: FleetSnapshot | null) {
  return snapshot?.drivers ?? [];
}
