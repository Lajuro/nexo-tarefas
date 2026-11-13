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
