import { Knight } from "./knight";

/**
 * Sceau — signature visuelle Maison Cavalier : médaillon doré cerclé,
 * décliné en logo (header), pastille de statut et vignette d'état vide.
 * Référence directe au monde du sceau de cire / chevalière, cohérente
 * avec le positionnement conciergerie haute couture.
 */
export function Seal({
  size = 34,
  ring = true,
  glow = false,
  className,
}: {
  size?: number;
  ring?: boolean;
  glow?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 28%, var(--navy-3), var(--navy) 70%)",
        boxShadow: ring
          ? `inset 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent), 0 1px 2px rgba(0,0,0,.4)`
          : undefined,
        animation: glow ? "seal-glow 2.8s ease-in-out infinite" : undefined,
      }}
    >
      <Knight size={size * 0.52} />
    </span>
  );
}
