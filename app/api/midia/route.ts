import { Readable } from "node:stream";
import { abrirMidia, salvarMidia } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

// POST ?nome=<nome do arquivo>, corpo = o arquivo cru: grava o vídeo na pasta de dados, em pedaços.
export const POST = (req: Request) =>
  tratar(async () => {
    const nome = new URL(req.url).searchParams.get("nome") || "";
    return salvarMidia(nome, req.body);
  });

// GET ?p=<arquivo de arquivos/> ou ?pagina=<id>: toca o vídeo, com suporte a Range (pular para qualquer ponto).
export const GET = (req: Request) =>
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
