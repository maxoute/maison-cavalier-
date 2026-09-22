"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { IconCheck, IconClock, IconMap, IconSend } from "@/components/ui/icons";
import { Meter } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { driverStatusLabels, vehicleKindLabels, type Driver, type DriverStatus } from "@/lib/drivers";

/** Code couleur des statuts chauffeur — PRD §6.1.2 (vert / orange / gris). */
export const driverStatusMeta: Record<
  DriverStatus,
  { label: string; tone: "green" | "orange" | "grey"; color: string; text: string }
> = {
  en_mouvement: {
    label: driverStatusLabels.en_mouvement,
    tone: "green",
    color: "var(--green)",
    text: "text-green",
  },
  en_attente: {
    label: driverStatusLabels.en_attente,
    tone: "orange",
    color: "var(--orange)",
    text: "text-orange",
  },
  hors_ligne: {
    label: driverStatusLabels.hors_ligne,
    tone: "grey",
    color: "var(--grey)",
    text: "text-muted",
  },
};

/** Ancienneté d'un point GPS en langage de loge. */
export function freshness(ageMs: number): string {
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `il y a ${minutes} min`;
}

/** Une ligne de la liste : identité, statut, course en cours. */
export function DriverCard({
  driver,
  selected,
  onSelect,
}: {
  driver: Driver;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = driverStatusMeta[driver.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-[8px] border bg-surface px-3.5 py-3 cursor-pointer",
        "transition-all duration-300 ease-in-out hover:-translate-y-px",
        selected
          ? "border-gold/60 shadow-[0_0_0_1px_var(--gold)_inset,0_10px_24px_-18px_rgba(184,146,42,.9)]"
          : "border-line hover:border-ink/20",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative shrink-0">
          <Avatar name={driver.name} size={30} />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-surface"
            style={{ background: meta.color }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] text-ink font-medium truncate">{driver.name}</span>
          <span className="block text-[10.5px] text-muted truncate">{driver.vehicle}</span>
        </span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <p className="mt-2.5 text-[11px] text-muted flex items-center gap-1.5 min-w-0">
        {driver.trip ? (
          <>
            <IconMap size={12} className={cn("shrink-0", meta.text)} />
            <span className="truncate text-ink/80">{driver.trip.destination}</span>
            <span className="ml-auto shrink-0 text-gold-deep font-medium tabular-nums">
              {driver.trip.etaMinutes} min
            </span>
          </>
        ) : (
          <>
            <IconClock size={12} className="shrink-0" />
            <span className="truncate">{driver.note ?? "Sans course"}</span>
          </>
        )}
      </p>
      {driver.trip && <Meter value={driver.trip.progress} className="mt-2" />}
    </button>
  );
}

/** Fiche détail du chauffeur sélectionné — PRD §6.1.2. */
export function DriverDetail({
  driver,
  follow,
  onToggleFollow,
  arrival,
  ageMs,
  onSendDetails,
  detailsSent,
}: {
  driver: Driver;
  follow: boolean;
  onToggleFollow: () => void;
  /** Heure d'arrivée estimée déjà formatée (« 16:42 »), ou null. */
  arrival: string | null;
  ageMs: number;
  onSendDetails: () => void;
  detailsSent: boolean;
}) {
  const meta = driverStatusMeta[driver.status];
  return (
    <Card className="p-4 lg:sticky lg:top-6" data-driver-detail={driver.id}>
      <div className="flex items-start gap-3">
        <Avatar name={driver.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-ink font-medium leading-tight truncate">{driver.name}</p>
          <p className="text-[11px] text-muted mt-0.5 truncate">
            {driver.vehicle} · {vehicleKindLabels[driver.vehicleKind]}
          </p>
          <p className="text-[10.5px] text-muted mt-1 tracking-[0.5px] tabular-nums">{driver.plate}</p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      <div className="mt-4 pt-3.5 border-t border-line">
        <SectionLabel>Course en cours</SectionLabel>
        {driver.trip ? (
          <div className="mt-2.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1 flex flex-col items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                <span className="w-px h-4 bg-line" />
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
              </span>
              <span className="min-w-0 text-[12px] leading-[1.45]">
                <span className="block text-muted truncate">{driver.trip.origin}</span>
                <span className="block text-ink truncate">{driver.trip.destination}</span>
              </span>
            </div>
            {driver.trip.resident && (
              <p className="text-[11px] text-muted">
                Pour <span className="text-ink/80">{driver.trip.resident}</span>
              </p>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted">
                ETA <span className="text-gold-deep font-medium tabular-nums">{driver.trip.etaMinutes} min</span>
                {arrival && <span className="text-muted"> · arrivée ≈ {arrival}</span>}
              </span>
              <span className="text-[10.5px] text-muted tabular-nums">
                {Math.round(driver.trip.progress * 100)} %
              </span>
            </div>
            <Meter value={driver.trip.progress} />
          </div>
        ) : (
          <p className="mt-2.5 text-[12px] text-ink/80">{driver.note ?? "Aucune course affectée."}</p>
        )}
      </div>

      <p className="mt-3.5 text-[10.5px] text-muted">
        Dernier point GPS {freshness(ageMs)} · {driver.phone}
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <a
          href={`tel:${driver.phone.replace(/\s/g, "")}`}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[24px] px-4 py-2",
            "text-[11px] font-medium tracking-[0.4px] border border-line bg-ink/[0.03] text-ink/80",
            "transition-all duration-300 hover:border-grey/50 hover:text-ink",
          )}
        >
          Appeler
        </a>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={onSendDetails}
          disabled={!driver.trip}
        >
          {detailsSent ? <IconCheck size={13} /> : <IconSend size={13} />}
          {detailsSent ? "Détails envoyés" : "Envoyer les détails de course"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={onToggleFollow}
          aria-pressed={follow}
          className={follow ? "border-gold/50 text-gold-deep" : undefined}
        >
          {follow ? "Suivi activé" : "Suivre"}
        </Button>
      </div>
    </Card>
  );
}
