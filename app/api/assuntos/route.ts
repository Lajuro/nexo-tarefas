import { salvarColecao } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { AssuntoParaFalar, normalizarAssunto } from "@/lib/tipos";
export const dynamic = "force-dynamic";

// Assuntos para falar com alguém na próxima conversa (assuntos.json). Lista inteira, com rev, como as outras coleções.
export const PUT = (req: Request) =>
  tratar(async () => {
    const { items, revEsperada } = await req.json();
    if (!Array.isArray(items)) throw new Error("Lista inválida.");
    if (items.length > 5000) throw new Error("Assuntos demais numa lista só.");
    return salvarColecao<AssuntoParaFalar>("assuntos", items, Number(revEsperada), normalizarAssunto);
  });
