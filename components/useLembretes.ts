"use client";

import { useCallback, useMemo } from "react";
import { useNexo } from "./Provider";
import { Lembrete, gerarLembretes } from "@/lib/lembretes";
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

  const todos = useMemo(() => gerarLembretes(dados?.tarefas ?? []), [dados?.tarefas]);
  const hoje = hojeISO();
  const ativos = useMemo(() => todos.filter((l) => !(adiados[l.id] && adiados[l.id] > hoje)), [todos, adiados, hoje]);

  /** Esconde o lembrete pelos próximos `dias` (1 = volta amanhã). */
  const adiar = useCallback(
    (l: Lembrete | string, dias = 1) => {
      const id = typeof l === "string" ? l : l.id;
      setAdiados((a) => {
        const limpo: Record<string, string> = {};
        for (const [k, v] of Object.entries(a)) if (v > hojeISO()) limpo[k] = v; // descarta os vencidos
        return { ...limpo, [id]: daquiA(dias) };
      });
    },
    [setAdiados],
  );

  const reativarTodos = useCallback(() => setAdiados({}), [setAdiados]);

  return {
    /** O que merece atenção agora, do mais grave para o menos. */
    lembretes: ativos,
    criticos: ativos.filter((l) => l.gravidade === "critico").length,
    /** Quantos estão escondidos por terem sido adiados. */
    adiados: todos.length - ativos.length,
    adiar,
    reativarTodos,
  };
}
