import { NextRequest, NextResponse } from "next/server";
import { motivoDaRecusa } from "@/lib/origem";

// Proteções de um servidor local, para as telas e para a API. A regra está em lib/origem.ts:
// 1) só aceita Host localhost/127.0.0.1 (barra DNS rebinding);
// 2) na API, recusa qualquer requisição que o navegador diga ter vindo de outro site ou de outra porta
//    (Sec-Fetch-Site): em escrita isso barra CSRF, em leitura impede outra página de pedir os dados;
// 3) em escrita, confere também o Origin (navegador antigo, que não manda Sec-Fetch-Site).
export function proxy(req: NextRequest) {
  const motivo = motivoDaRecusa(req.headers, req.method, req.nextUrl.pathname.startsWith("/api/"));
  return motivo ? NextResponse.json({ erro: motivo }, { status: 403 }) : NextResponse.next();
}

// Tudo menos os arquivos estáticos do build (sem dados, e são muitos) e as rotas que recebem arquivo grande
// (ROTAS_DE_ENVIO em lib/origem.ts). Essas ficam de fora porque, passando pelo proxy, o Next copia o corpo do
// pedido e o corta em 10 MB sem avisar; cada uma chama recusaDaRota() e aplica a mesma regra sozinha.
// O matcher precisa ser texto fixo (o Next o lê na hora do build): mudou a lista, mude os dois lugares.
// testes/api.sh confere que um envio de 25 MB chega inteiro e que as três rotas continuam protegidas.
export const config = { matcher: "/((?!_next/static|_next/image|api/midia$|api/arquivos$|api/importar$).*)" };
