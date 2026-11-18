"use client";

import { useCallback, useMemo } from "react";
import { useNexo } from "./Provider";
import { useHoje } from "./useHoje";
import { type GrupoDeLembretes, Lembrete, agruparLembretes, gerarLembretes } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { hojeISO } from "@/lib/tipos";

const p2 = (n: number) => String(n).padStart(2, "0");
function daquiA(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/**
 * Lembretes ativos (já sem os adiados) e as ações sobre eles.
 * Adiar esconde o lembrete até uma data; fica em localStorage ("nexo:lembretesAdiados"),
 * então é por aparelho e nunca toca nos dados.
 */
export function useLembretes() {
  const { dados } = useNexo();
  const [adiados, setAdiados] = usePref<Record<string, string>>("lembretesAdiados", {});

  // `hoje` entra nas dependências: os lembretes mudam quando o dia vira, mesmo sem mudar os dados.
  const hoje = useHoje();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todos = useMemo(() => gerarLembretes(dados?.tarefas ?? [], { modelos: dados?.modelos?.items ?? [] }), [dados?.tarefas, dados?.modelos?.items, hoje]);
  const ativos = useMemo(() => todos.filter((l) => !(adiados[l.id] && adiados[l.id] > hoje)), [todos, adiados, hoje]);

  // Por tarefa: é assim que a interface mostra e conta (uma tarefa com três motivos é uma coisa só).
  const grupos = useMemo(() => agruparLembretes(ativos), [ativos]);

  /** Esconde o lembrete pelos próximos `dias` (1 = volta amanhã). Com um grupo, adia todos os motivos da tarefa. */
  const adiar = useCallback(
    (l: Lembrete | GrupoDeLembretes | string, dias = 1) => {
      const ids = typeof l === "string" ? [l] : "lembretes" in l ? l.lembretes.map((x) => x.id) : [l.id];
      setAdiados((a) => {
        const limpo: Record<string, string> = {};
        for (const [k, v] of Object.entries(a)) if (v > hojeISO()) limpo[k] = v; // descarta os vencidos
        const ate = daquiA(dias);
        for (const id of ids) limpo[id] = ate;
        return limpo;
      });
    },
    [setAdiados],
  );

  const reativarTodos = useCallback(() => setAdiados({}), [setAdiados]);

  return {
    /** O que merece atenção agora, do mais grave para o menos. */
    lembretes: ativos,
    /** Os mesmos lembretes, juntos por tarefa. É o que o sino, a tela Hoje e os contadores mostram. */
    grupos,
    /** Quantas tarefas pedem atenção (têm algum lembrete crítico ou de atenção). */
    pedemAtencao: grupos.filter((g) => g.gravidade !== "info").length,
    /** Quantas tarefas têm algo crítico (prazo ou passo vencido, prazo hoje). */
    criticos: grupos.filter((g) => g.gravidade === "critico").length,
    /** Quantos lembretes estão escondidos por terem sido adiados. */
    adiados: todos.length - ativos.length,
    adiar,
    reativarTodos,
  };
}
