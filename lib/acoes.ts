// Transformações puras sobre uma Tarefa. Sempre use dentro de atualizarTarefa(id, fn):
//   atualizarTarefa(t.id, (x) => comFoco(x, true))
// Assim toda tela muda a tarefa do mesmo jeito (e os marcos da timeline nunca são esquecidos).

import { Registro, Status, Tarefa, agoraISO, hojeISO, nomeStatus, normalizarRegistro } from "./tipos";

/** Muda o status e registra um marco na timeline (o marco de "concluida" é o card verde do fim). */
export function aplicarStatus(t: Tarefa, novo: Status, anterior: Tarefa = t, obs = ""): Tarefa {
  if (anterior.status === novo) return t;
  const fim = novo === "concluida" || novo === "cancelada";
  return {
    ...t,
    status: novo,
    concluidaEm: fim ? agoraISO() : null,
    focoEm: fim ? null : t.focoEm,
    registros: [
      ...t.registros,
      normalizarRegistro({
        tipo: "marco",
        data: hojeISO(),
        titulo: nomeStatus(novo),
        anotacoes: obs,
        alteracoes: { status: { de: anterior.status, para: novo } },
      }),
    ],
  };
}

/** Marca (ou desmarca) a tarefa como foco de hoje. */
export function comFoco(t: Tarefa, ligado: boolean): Tarefa {
  return { ...t, focoEm: ligado ? hojeISO() : null };
}

export const ehFocoHoje = (t: Tarefa) => t.focoEm === hojeISO();

/** Define a data de follow-up ("me lembre de voltar nisso em..."). null remove. */
export function comLembrete(t: Tarefa, data: string | null): Tarefa {
  return { ...t, lembrarEm: data || null };
}

/** Marca um próximo passo como feito ou reabre. */
export function comPassoAlternado(t: Tarefa, registroId: string, passoId: string, feito: boolean): Tarefa {
  return {
    ...t,
    registros: t.registros.map((r) =>
      r.id !== registroId
        ? r
        : { ...r, proximosPassos: r.proximosPassos.map((p) => (p.id === passoId ? { ...p, feito, feitoEm: feito ? agoraISO() : null } : p)) },
    ),
  };
}

/** Define o prazo próprio de um próximo passo. null remove. */
export function comPrazoDoPasso(t: Tarefa, registroId: string, passoId: string, prazo: string | null): Tarefa {
  return {
    ...t,
    registros: t.registros.map((r) =>
      r.id !== registroId ? r : { ...r, proximosPassos: r.proximosPassos.map((p) => (p.id === passoId ? { ...p, prazo: prazo || null } : p)) },
    ),
  };
}

/** Tira um registro da timeline guardando-o em registrosRemovidos (nada é apagado de verdade). */
export function semRegistro(t: Tarefa, registroId: string): Tarefa {
  const r = t.registros.find((x) => x.id === registroId);
  if (!r) return t;
  return {
    ...t,
    registros: t.registros.filter((x) => x.id !== registroId),
    registrosRemovidos: [...((t.registrosRemovidos as Registro[]) || []), { ...r, removidoEm: agoraISO() }],
  };
}

/** Recebe um registro vindo de outra tarefa. Não duplica se ele já estiver aqui. */
export function comRegistroRecebido(t: Tarefa, r: Registro): Tarefa {
  if (t.registros.some((x) => x.id === r.id)) return t;
  return { ...t, registros: [...t.registros, r] };
}

/**
 * Tira um registro que foi MOVIDO para outra tarefa. Diferente de semRegistro(): ele não vai
 * para registrosRemovidos, porque continua existindo na tarefa de destino.
 */
export function semRegistroMovido(t: Tarefa, registroId: string): Tarefa {
  return { ...t, registros: t.registros.filter((x) => x.id !== registroId) };
}

/**
 * Junta `origem` dentro de `destino`: os registros (menos os marcos, que contam a história da
 * outra tarefa) e as tags vêm para cá, e um marco registra a junção com a descrição que a outra
 * tinha. Prazo e follow-up só são herdados se o destino não tiver os seus.
 * Pode rodar duas vezes sem duplicar nada (o marco tem id fixo).
 */
export function comTarefaJuntada(destino: Tarefa, origem: Tarefa): Tarefa {
  const ja = new Set(destino.registros.map((r) => r.id));
  const vindos = origem.registros.filter((r) => r.tipo !== "marco" && !ja.has(r.id));
  const idMarco = `junta-${origem.id}`;
  const marco = ja.has(idMarco)
    ? []
    : [
        normalizarRegistro({
          id: idMarco, tipo: "marco", data: hojeISO(), titulo: `Juntou a tarefa “${origem.titulo}”`,
          anotacoes: origem.descricao ? `Descrição que ela tinha: ${origem.descricao}` : "",
        }),
      ];
  return {
    ...destino,
    registros: [...destino.registros, ...vindos, ...marco],
    tags: [...new Set([...destino.tags, ...origem.tags])],
    prazo: destino.prazo ?? origem.prazo,
    lembrarEm: destino.lembrarEm ?? origem.lembrarEm ?? null,
  };
}
