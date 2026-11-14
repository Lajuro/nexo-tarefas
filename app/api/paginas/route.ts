import { espelharPaginas, guardarVersoesDasPaginas, salvarColecao } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { Pagina, normalizarPagina } from "@/lib/tipos";
export const dynamic = "force-dynamic";
export const PUT = (req: Request) =>
  tratar(async () => {
    const { items, revEsperada } = await req.json();
    if (!Array.isArray(items)) throw new Error("Lista inválida.");
    // antes de mudar, guarda como estava cada página que vai mudar (histórico de versões)
    await guardarVersoesDasPaginas(items);
    const col = await salvarColecao<Pagina>("paginas", items, Number(revEsperada), normalizarPagina);
    await espelharPaginas(col.items);
    return col;
  });
