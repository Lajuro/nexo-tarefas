import { salvarColecao } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { LinkDoc, normalizarLink } from "@/lib/tipos";
export const dynamic = "force-dynamic";
export const PUT = (req: Request) =>
  tratar(async () => {
    const { items, revEsperada } = await req.json();
    if (!Array.isArray(items)) throw new Error("Lista inválida.");
    return salvarColecao<LinkDoc>("links", items, Number(revEsperada), normalizarLink);
  });
