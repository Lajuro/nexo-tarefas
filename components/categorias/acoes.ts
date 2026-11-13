"use client";

import { toast as sonner } from "sonner";
import { useNexo } from "@/components/Provider";
import { ultimaAtividade } from "@/lib/lembretes";
import { Categoria, STATUS_ABERTOS, Tarefa, agoraISO } from "@/lib/tipos";

/** Ações de categoria iguais em todo lugar (cartão, menu de contexto, página da categoria). */
export function useAcoesCategoria() {
  const { salvarCategorias } = useNexo();

  const definirArquivada = (id: string, arquivada: boolean) =>
    salvarCategorias((items) => items.map((i) => (i.id === id ? { ...i, arquivada, atualizadaEm: agoraISO() } : i)));

  return {
    /** Arquiva ou desarquiva e oferece "Desfazer" no aviso. Nada é apagado: as tarefas continuam onde estão. */
    alternarArquivada: async (cat: Categoria) => {
      const arquivar = !cat.arquivada;
      if (!(await definirArquivada(cat.id, arquivar))) return false;
      sonner(arquivar ? "Categoria arquivada" : "Categoria desarquivada", {
        description: arquivar
          ? `"${cat.nome}" sai da lista do dia a dia. As tarefas continuam onde estão.`
          : `"${cat.nome}" voltou para a lista.`,
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void definirArquivada(cat.id, !arquivar) },
      });
      return true;
    },
  };
}

export interface NumerosCategoria {
  total: number;
  abertas: number;
  fechadas: number;
  concluidas: number;
  /** 0 a 100: concluídas sobre o total que não foi cancelado. */
  conclusao: number;
  /** AAAA-MM-DD do último sinal de vida em qualquer tarefa do assunto, ou "" se não há tarefas. */
  ultima: string;
}

export function numerosDaCategoria(tarefas: Tarefa[]): NumerosCategoria {
  const abertas = tarefas.filter((t) => STATUS_ABERTOS.includes(t.status)).length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const validas = tarefas.filter((t) => t.status !== "cancelada").length;
  let ultima = "";
  for (const t of tarefas) {
    const u = ultimaAtividade(t);
    if (u > ultima) ultima = u;
  }
  return {
    total: tarefas.length,
    abertas,
    fechadas: tarefas.length - abertas,
    concluidas,
    conclusao: validas ? Math.round((concluidas / validas) * 100) : 0,
    ultima,
  };
}
