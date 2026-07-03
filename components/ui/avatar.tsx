import { cn } from "@/lib/cn";

const palette = [
  "linear-gradient(135deg, #3E6FB8, #2a4f8a)",
  "linear-gradient(135deg, #3FA776, #2b7a56)",
  "linear-gradient(135deg, #D98E3B, #a8641f)",
  "linear-gradient(135deg, #7B5EA7, #543f78)",
  "linear-gradient(135deg, #B8922A, #8a6c1f)",
  "linear-gradient(135deg, #C2503F, #8f3527)",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Avatar à initiales, couleur dérivée déterministe du nom (pas d'assets à gérer). */
export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const bg = palette[hashName(name) % palette.length];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0 font-medium text-cream/95",
        "ring-1 ring-white/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.36,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
