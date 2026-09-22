import { cn } from "@/lib/cn";
import type { ServiceType } from "@/types";

/* Badge du prototype : pill uppercase 9px, fond couleur à 10 %,
   bordure couleur à 33 %. */

type Tone = "gold" | "green" | "orange" | "red" | "violet" | "blue" | "grey";

const tones: Record<Tone, string> = {
  gold: "text-gold-deep bg-gold/10 border-gold/40",
  green: "text-green bg-green/10 border-green/40",
  orange: "text-orange bg-orange/10 border-orange/40",
  red: "text-red bg-red/10 border-red/40",
  violet: "text-violet bg-violet/10 border-violet/40",
  blue: "text-blue bg-blue/10 border-blue/40",
  grey: "text-muted bg-grey/10 border-grey/40",
};

export function Badge({
  tone = "gold",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[20px] border px-2 py-[3px]",
        "text-[9px] font-medium uppercase tracking-[1.2px]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* Code couleur par service — PRD §6.1.1 + prototype */
const serviceTones: Record<ServiceType, Tone> = {
  chauffeur: "blue",
  pressing: "green",
  colis: "orange",
  billetterie: "violet",
  personal_shopper: "gold",
};

export { serviceLabels } from "@/lib/requests";
import { serviceLabels } from "@/lib/requests";

export const serviceColors: Record<ServiceType, string> = {
  chauffeur: "var(--blue)",
  pressing: "var(--green)",
  colis: "var(--orange)",
  billetterie: "var(--violet)",
  personal_shopper: "var(--gold)",
};

export function ServiceBadge({ service }: { service: ServiceType }) {
  return <Badge tone={serviceTones[service]}>{serviceLabels[service]}</Badge>;
}
