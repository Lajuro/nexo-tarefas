import { importarExportacao, previaDeImportar } from "@/lib/armazenamento";
import { MAX_BYTES_DA_IMPORTACAO, ehModoDeImportacao } from "@/lib/importar-dados";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";
// POST com o texto de um nexo-export-*.json no corpo.
//   sem parâmetro: a prévia do que entraria e do que conflita (só lê);
//   ?aplicar=1&modo=manter|recente|arquivo: importa. Antes, tira uma foto do estado de agora
//   (_backups/pre-importacao-*). Nada do que está na pasta é apagado. Modo desconhecido vale "manter".
export const POST = (req: Request) =>
  tratar(async () => {
    if (Number(req.headers.get("content-length")) > MAX_BYTES_DA_IMPORTACAO) throw new Error("O arquivo é grande demais para ser um export do Nexo.");
    const p = new URL(req.url).searchParams;
    const texto = await req.text();
    if (p.get("aplicar") !== "1") return { previa: await previaDeImportar(texto) };
    const modo = p.get("modo");
    return importarExportacao(texto, ehModoDeImportacao(modo) ? modo : "manter");
  });
