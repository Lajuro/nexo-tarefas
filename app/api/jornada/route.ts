import { salvarColecao } from "@/lib/armazenamento";
import { tratar } from "@/lib/resposta";
import { ID_CONFIG_JORNADA, ItemDaJornada, dataReal, normalizarItemDaJornada } from "@/lib/tipos";
export const dynamic = "force-dynamic";

// A jornada (rotina do dia, ponto e configuração) é uma lista só: um item por dia, com a data como id,
// mais o item "config". Qualquer outro id é recusado antes de chegar ao disco.
export const PUT = (req: Request) =>
  tratar(async () => {
    const { items, revEsperada } = await req.json();
    if (!Array.isArray(items)) throw new Error("Lista inválida.");
    for (const i of items) {
      const id = i && typeof i === "object" ? (i as { id?: unknown }).id : null;
      if (id !== ID_CONFIG_JORNADA && !dataReal(id)) throw new Error("Dia inválido na jornada: o id de cada dia tem que ser uma data (AAAA-MM-DD).");
    }
    return salvarColecao<ItemDaJornada>("jornada", items, Number(revEsperada), normalizarItemDaJornada);
  });
