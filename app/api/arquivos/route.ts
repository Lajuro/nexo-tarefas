import fs from "node:fs/promises";
import path from "node:path";
import { caminhoArquivo, salvarArquivo } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8",
  ".html": "text/plain; charset=utf-8",
};

export const POST = (req: Request) =>
  tratar(async () => {
    const form = await req.formData();
    const f = form.get("arquivo");
    if (!(f instanceof File)) throw new Error("Nenhum arquivo enviado.");
    return salvarArquivo(f.name, Buffer.from(await f.arrayBuffer()));
  });

export const GET = (req: Request) =>
  tratar(async () => {
    const url = new URL(req.url);
    const rel = url.searchParams.get("p") || "";
    const baixar = url.searchParams.get("baixar") === "1";
    const alvo = await caminhoArquivo(rel);
    const dados = await fs.readFile(alvo);
    const ext = path.extname(alvo).toLowerCase();
    const nome = path.basename(alvo).replace(/^[a-z0-9]+-/, "");
    return new Response(new Uint8Array(dados), {
      headers: {
        "Content-Type": TIPOS[ext] || "application/octet-stream",
        "Content-Disposition": `${baixar || !TIPOS[ext] ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  });
