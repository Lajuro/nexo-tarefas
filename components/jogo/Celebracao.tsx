"use client";

// Comemora o que acabou de ser alcançado: conquista nova, nível novo, meta do dia e tarefa concluída.
// Para saber o que é "novo", guarda no navegador o que já foi comemorado ("nexo:jogoVisto").
// Na primeira vez (ou depois de limpar o navegador) registra o estado atual em silêncio, para não
// soltar de uma vez só a comemoração de tudo o que o usuário já tinha feito antes de a gamificação existir.

import { useEffect } from "react";
import { useNexo } from "@/components/Provider";
import { usePref } from "@/lib/preferencias";
import { soltarConfete } from "./pecas";
import { useJogo } from "./useJogo";

interface Visto { conquistas: string[]; nivel: number; meta: string; concluidas: number }

export function Celebracao() {
  const { toast } = useNexo();
  const { estado, pref, hoje } = useJogo();
  const [visto, setVisto, carregado] = usePref<Visto | null>("jogoVisto", null);

  useEffect(() => {
    if (!estado || !carregado) return;
    const feitas = estado.conquistas.filter((c) => c.feita).map((c) => c.id);
    const agora: Visto = { conquistas: feitas, nivel: estado.nivel.n, meta: estado.hoje.bateu ? hoje : "", concluidas: estado.totais.concluidas };
    const base: Visto | null = visto && Array.isArray(visto.conquistas) ? visto : null;
    if (!base) {
      setVisto(agora);
      return;
    }
    const novas = estado.conquistas.filter((c) => c.feita && !base.conquistas.includes(c.id));
    const subiu = estado.nivel.n > (base.nivel || 1);
    const bateuMeta = estado.hoje.bateu && base.meta !== hoje;
    const concluiu = estado.totais.concluidas > (base.concluidas || 0);
    if (!novas.length && !subiu && !bateuMeta && !concluiu && base.concluidas === agora.concluidas) return;

    if (pref.celebrar) {
      if (subiu) toast(`Nível ${estado.nivel.n}: ${estado.nivel.nome}. Você subiu de nível!`);
      if (novas.length) toast(novas.length === 1 ? `Conquista: ${novas[0].nome}. ${novas[0].descricao}` : `${novas.length} conquistas novas: ${novas.map((c) => c.nome).join(", ")}.`);
      if (bateuMeta && !subiu && !novas.length) toast(`Meta do dia batida: ${estado.hoje.avancos} de ${estado.hoje.meta} avanços.`);
      if (subiu || novas.length || bateuMeta || concluiu) soltarConfete();
    }
    setVisto({
      // o que já foi comemorado nunca sai da lista (desmarcar um passo não faz a conquista ser comemorada de novo)
      conquistas: [...new Set([...base.conquistas, ...feitas])],
      nivel: Math.max(base.nivel || 1, estado.nivel.n),
      meta: bateuMeta ? hoje : base.meta,
      concluidas: agora.concluidas,
    });
    // `visto` fica fora de propósito: o efeito reage ao placar, e gravar o "visto" não pode disparar de novo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, carregado, hoje, pref.celebrar]);

  return null;
}
