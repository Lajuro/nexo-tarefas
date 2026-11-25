import { Readable } from "node:stream";
import { abrirMidia, salvarMidia } from "@/lib/armazenamento";
import { recusaDaRota } from "@/lib/origem";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

// Esta rota não passa pelo proxy.ts (ver lib/origem.ts): lá o Next cortaria em 10 MB o vídeo enviado.
// Por isso cada pedido confere aqui mesmo quem está pedindo, com a mesma regra do proxy.

// POST ?nome=<nome do arquivo>, corpo = o arquivo cru: grava o vídeo na pasta de dados, em pedaços.
// O tamanho anunciado (Content-Length) é conferido no fim: se chegar menos, nada fica gravado.
export const POST = (req: Request) =>
  recusaDaRota(req) ??
  tratar(async () => {
    const nome = new URL(req.url).searchParams.get("nome") || "";
    const anunciado = Number(req.headers.get("content-length"));
    return salvarMidia(nome, req.body, Number.isFinite(anunciado) && anunciado > 0 ? anunciado : null);
  });

// GET ?p=<arquivo de arquivos/> ou ?pagina=<id>: toca o vídeo, com suporte a Range (pular para qualquer ponto).
export const GET = (req: Request) =>
  recusaDaRota(req) ??
  tratar(async () => {
    const url = new URL(req.url);
    const m = await abrirMidia({ rel: url.searchParams.get("p"), paginaId: url.searchParams.get("pagina") }, req.headers.get("range"));
    const base = { "Content-Type": m.tipo, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-cache" };
    if (m.foraDaFaixa) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${m.tamanho}` } });
    return new Response(Readable.toWeb(m.fluxo) as ReadableStream, {
      status: m.parcial ? 206 : 200,
      headers: { ...base, "Content-Length": String(m.fim - m.inicio + 1), ...(m.parcial ? { "Content-Range": `bytes ${m.inicio}-${m.fim}/${m.tamanho}` } : {}) },
    });
  });
