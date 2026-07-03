import type { MetadataRoute } from "next";

/** PWA pour l'usage tablette en loge (PRD §6.1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maison Cavalier — Espace Concierge",
    short_name: "Cavalier",
    description:
      "Cockpit opérationnel de la conciergerie d'immeuble haut de gamme",
    start_url: "/concierge",
    display: "standalone",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
