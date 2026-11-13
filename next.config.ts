import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ferramenta local: sem telemetria de imagem, sem otimizações remotas.
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
