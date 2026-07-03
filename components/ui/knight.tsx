/** Cavalier d'échecs détouré — logo officiel Maison Cavalier. */
export function Knight({
  size = 22,
  color = "var(--gold)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={(size * 190) / 120}
      viewBox="0 0 120 190"
      fill="none"
      stroke={color}
      strokeWidth="9"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {/* crinière/oreilles + face plongeante + poitrail */}
      <path d="M30 21 L34 14 L40 25 L55 10 C66 17 77 30 84 45 C88 53 92 61 93 67 L77 72 C80 77 85 80 89 81 C94 96 98 114 100 131" />
      {/* ligne arrière (nuque -> dos) */}
      <path d="M30 21 C25 44 23 68 25 90 C26 104 26 116 25 128" />
      {/* crinière intérieure */}
      <path d="M42 38 C50 54 54 71 52 89 C51 100 49 108 47 116" />
      {/* bande intermédiaire + socle */}
      <path d="M38 138 L90 138" strokeWidth="8" />
      <rect x="14" y="152" width="94" height="24" rx="4" strokeWidth="9" />
    </svg>
  );
}
