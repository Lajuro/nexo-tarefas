import type { NextConfig } from "next";

// Cabeçalhos de segurança das telas. A política de conteúdo (CSP) só vale no build de produção:
// o modo de desenvolvimento do Next usa eval e WebSocket, que ela barraria.
//
// O que a CSP garante aqui: o app não busca nem envia nada para fora da própria máquina (connect-src, img-src,
// font-src, form-action 'self'), não pode ser embutido em outra página (frame-ancestors) e não carrega plugin.
// script-src mantém 'unsafe-inline' porque o Next injeta scripts em linha para iniciar cada tela, e o app injeta
// o do tema: a defesa contra script injetado continua sendo não interpretar HTML de usuário (ver lib/texto-rico.ts).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const CABECALHOS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
];

const nextConfig: NextConfig = {
  // Ferramenta local: sem telemetria de imagem, sem otimizações remotas.
  images: { unoptimized: true },
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS }];
  },
};

export default nextConfig;
