import { NextRequest, NextResponse } from "next/server";

// Proteções de um servidor local. Valem para as telas e para a API:
// 1) só aceita Host localhost/127.0.0.1 (barra DNS rebinding);
// 2) na API, recusa qualquer requisição que o navegador diga ter vindo de outro site ou de outra porta
//    (Sec-Fetch-Site): em escrita isso barra CSRF, em leitura impede outra página de pedir os dados;
// 3) em escrita, confere também o Origin (navegador antigo, que não manda Sec-Fetch-Site).
const HOSTS_OK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const recusar = (erro: string) => NextResponse.json({ erro }, { status: 403 });

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!HOSTS_OK.test(host)) return recusar("Acesso permitido só pela própria máquina.");
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  // "same-origin": o próprio app. "none": endereço digitado, favorito ou ferramenta sem navegador (curl, testes).
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return recusar("Origem não permitida.");
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const origemRuim = origin && (() => { try { return new URL(origin).host !== host; } catch { return true; } })();
    if (origemRuim) return recusar("Origem não permitida.");
  }
  return NextResponse.next();
}

// Tudo menos os arquivos estáticos do build (sem dados, e são muitos).
export const config = { matcher: "/((?!_next/static|_next/image).*)" };
