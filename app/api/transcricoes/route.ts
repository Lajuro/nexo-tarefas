import fs from "node:fs/promises";
import { caminhoArquivo, lerTudo } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
export const dynamic = "force-dynamic";

// As transcrições das páginas de vídeo (3.8), para a busca global e o Perguntar. Só leitura.
// Elas não vêm em /api/dados de propósito (pesariam a leitura de tudo): a tela pede esta rota quando precisa.
// O caminho de cada arquivo vem da página gravada (normalizarVideo já confere o formato "AAAA/nome") e passa
// por caminhoArquivo(), que recusa qualquer coisa fora de arquivos/.

/** Teto por transcrição e no total, para uma pasta com muitos vídeos não travar a busca. */
const TETO_POR_ARQUIVO = 600_000;
const TETO_TOTAL = 8_000_000;

export const GET = () =>
  tratar(async () => {
    const dados = await lerTudo();
    const out: { paginaId: string; texto: string; cortada: boolean }[] = [];
    let total = 0;
    for (const p of dados.paginas?.items ?? []) {
      const rel = p.video?.transcricao;
      if (!rel || p.arquivadaEm || total >= TETO_TOTAL) continue;
      try {
        const bruto = await fs.readFile(await caminhoArquivo(rel), "utf8");
        const texto = bruto.slice(0, Math.min(TETO_POR_ARQUIVO, TETO_TOTAL - total));
        total += texto.length;
        out.push({ paginaId: p.id, texto, cortada: texto.length < bruto.length });
      } catch {
        // arquivo que sumiu: a verificação de integridade já acusa; a busca só segue sem ele
      }
    }
    return { transcricoes: out };
  });
