import { NextRequest, NextResponse } from "next/server";

// Proteções de um servidor local:
// 1) só aceita Host localhost/127.0.0.1 (barra DNS rebinding);
// 2) em escrita, recusa requisições vindas de outros sites (CSRF).
const HOSTS_OK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!HOSTS_OK.test(host)) {
    return NextResponse.json({ erro: "Acesso permitido só pela própria máquina." }, { status: 403 });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    const origemRuim = origin && (() => { try { return new URL(origin).host !== host; } catch { return true; } })();
    if (origemRuim || (site && site !== "same-origin" && site !== "none")) {
      return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
