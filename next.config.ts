import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image de production Docker minimale (ne copie que le nécessaire à l'exécution)
  output: "standalone",
};

export default nextConfig;
