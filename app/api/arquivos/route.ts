import fs from "node:fs/promises";
import path from "node:path";
import { caminhoArquivo, salvarArquivo } from "@/lib/armazenamento";
import { recusaDaRota } from "@/lib/origem";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

// Esta rota não passa pelo proxy.ts (ver lib/origem.ts): lá o Next cortaria em 10 MB o anexo enviado.
// Por isso cada pedido confere aqui mesmo quem está pedindo, com a mesma regra do proxy.

const TIPOS: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8",
  ".html": "text/plain; charset=utf-8",
};

// O arquivo inteiro passa pela memória do servidor: um teto evita travar o app com um arquivo enorme por engano.
const TETO = 200 * 1024 * 1024;
const grande = () => new Error("Arquivo grande demais (o limite é 200 MB). Guarde o arquivo numa pasta e salve aqui o link para ele.");

export const POST = (req: Request) =>
  recusaDaRota(req) ??
  tratar(async () => {
    if (Number(req.headers.get("content-length")) > TETO + 1024 * 1024) throw grande();
    const form = await req.formData();
    const f = form.get("arquivo");
    if (!(f instanceof File)) throw new Error("Nenhum arquivo enviado.");
    if (f.size > TETO) throw grande();
    return salvarArquivo(f.name, Buffer.from(await f.arrayBuffer()));
  });

// Política dos anexos. São arquivos de terceiros guardados pelo usuário, então por padrão a resposta vai em
// "sandbox": aberta direto no navegador, não roda script nem tem acesso à origem do app (um SVG ou HTML anexado
// fica inofensivo), e não pode ser embutida em página nenhuma. O next.config.ts deixa a CSP e o X-Frame-Options
// deste caminho por conta daqui.
const FECHADO = { "Content-Security-Policy": "sandbox; frame-ancestors 'none'", "X-Frame-Options": "DENY" };
// A única exceção é o PDF pedido pelo visor do app (?ver=1): o leitor de PDF do navegador não funciona dentro de
// "sandbox", então ele vai sem, mas só pode ser embutido pelo próprio app. O tipo é sempre application/pdf com
// nosniff (um HTML renomeado para .pdf é lido como PDF e não abre), e script de PDF não alcança a origem do app.
const PDF_NO_VISOR = { "Content-Security-Policy": "frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN" };

export const GET = (req: Request) =>
  recusaDaRota(req) ??
  tratar(async () => {
    const url = new URL(req.url);
    const rel = url.searchParams.get("p") || "";
    const baixar = url.searchParams.get("baixar") === "1";
    const alvo = await caminhoArquivo(rel);
    const dados = await fs.readFile(alvo);
    const ext = path.extname(alvo).toLowerCase();
    const nome = path.basename(alvo).replace(/^[a-z0-9]+-/, "");
    const noVisor = ext === ".pdf" && !baixar && url.searchParams.get("ver") === "1";
    return new Response(new Uint8Array(dados), {
      headers: {
        "Content-Type": TIPOS[ext] || "application/octet-stream",
        "Content-Disposition": `${baixar || !TIPOS[ext] ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
        // O visor confere o tamanho antes de ler um arquivo para a memória do navegador. Vai num cabeçalho próprio
        // porque o Next manda a resposta em pedaços e tira o Content-Length.
        "X-Nexo-Tamanho": String(dados.length),
        "X-Content-Type-Options": "nosniff",
        ...(noVisor ? PDF_NO_VISOR : FECHADO),
      },
    });
  });
