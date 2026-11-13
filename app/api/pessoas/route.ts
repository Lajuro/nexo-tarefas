import { salvarColecao } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { Pessoa, normalizarPessoa } from "@/lib/tipos";
export const dynamic = "force-dynamic";
export const PUT = (req: Request) =>
  tratar(async () => {
    const { items, revEsperada } = await req.json();
    if (!Array.isArray(items)) throw new Error("Lista inválida.");
    return salvarColecao<Pessoa>("pessoas", items, Number(revEsperada), normalizarPessoa);
  });
