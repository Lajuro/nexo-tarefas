// Transformações puras sobre uma Tarefa. Sempre use dentro de atualizarTarefa(id, fn):
//   atualizarTarefa(t.id, (x) => comFoco(x, true))
// Assim toda tela muda a tarefa do mesmo jeito (e os marcos da timeline nunca são esquecidos).

import { type Registro, type Status, type Tarefa, agoraISO, formatarData, hojeISO, nomeStatus, normalizarRegistro, normalizarTarefa, novoId } from "./tipos";

/** Muda o status e registra um marco na timeline (o marco de "concluida" é o card verde do fim). */
export function aplicarStatus(t: Tarefa, novo: Status, anterior: Tarefa = t, obs = ""): Tarefa {
  if (anterior.status === novo) return t;
  const fim = novo === "concluida" || novo === "cancelada";
  // Saiu de "aguardando": de quem se esperava deixa de valer, mas fica escrito no marco para a história não se perder.
  const espera = novo !== "aguardando" ? t.esperando : null;
  const notaDaEspera = espera
    ? `Estava esperando ${[espera.quem, espera.oQue].filter(Boolean).join(": ")} (desde ${formatarData(espera.desde, false)}${espera.cobradoEm ? `, cobrado em ${formatarData(espera.cobradoEm, false)}` : ""}).`
    : "";
  return {
    ...t,
    status: novo,
    concluidaEm: fim ? agoraISO() : null,
    focoEm: fim ? null : t.focoEm,
    esperando: novo === "aguardando" ? t.esperando ?? null : null,
    registros: [
      ...t.registros,
      normalizarRegistro({
        tipo: "marco",
        data: hojeISO(),
        titulo: nomeStatus(novo),
        anotacoes: [obs, notaDaEspera].filter(Boolean).join("\n"),
        alteracoes: { status: { de: anterior.status, para: novo } },
      }),
    ],
  };
}

/** Diz de quem (e do quê) a tarefa está esperando. Sem os dois, limpa. Mantém a data em que a espera começou. */
export function comEspera(t: Tarefa, espera: { quem: string; oQue: string } | null): Tarefa {
  const quem = espera?.quem.trim() ?? "";
  const oQue = espera?.oQue.trim() ?? "";
  if (!quem && !oQue) return { ...t, esperando: null };
  const mesma = t.esperando && t.esperando.quem === quem && t.esperando.oQue === oQue;
  return {
    ...t,
    esperando: {
      ...t.esperando,
      quem,
      oQue,
      desde: t.esperando?.desde ?? hojeISO(),
      // mudou quem ou o quê: a cobrança antiga era de outra coisa
      cobradoEm: mesma ? t.esperando?.cobradoEm ?? null : null,
    },
  };
}

/** "Cobrei hoje": anota na timeline e zera a contagem de dias sem retorno. */
export function comCobranca(t: Tarefa): Tarefa {
  const e = t.esperando;
  return {
    ...t,
    esperando: e ? { ...e, cobradoEm: hojeISO() } : e,
    registros: [
      ...t.registros,
      normalizarRegistro({
        tipo: "atividade",
        data: hojeISO(),
        titulo: e?.quem ? `Cobrei ${e.quem}` : "Cobrei o retorno",
        anotacoes: e?.oQue ? `Sobre: ${e.oQue}` : "",
      }),
    ],
  };
}

/** Registra uma sessão de foco na timeline: uma atividade com a duração e o que o usuário escreveu que saiu dela. */
export function comSessaoDeFoco(t: Tarefa, minutos: number, nota: string): Tarefa {
  const min = Math.max(1, Math.round(minutos));
  return {
    ...t,
    registros: [
      ...t.registros,
      normalizarRegistro({
        tipo: "atividade",
        data: hojeISO(),
        hora: new Date().toTimeString().slice(0, 5),
        titulo: `Sessão de foco (${min} min)`,
        anotacoes: nota.trim(),
        duracaoMin: min,
      }),
    ],
  };
}

/** Minutos somados de todas as sessões de foco registradas na tarefa. */
export const minutosEmFoco = (t: Tarefa) => t.registros.reduce((n, r) => n + (r.duracaoMin || 0), 0);

/** "45 min", "1h", "2h 15min". */
export function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** Tarefa "A fazer" só com o título e o marco de criação: a captura rápida (tela Hoje e barra superior). */
export function tarefaRapida(titulo: string): Tarefa {
  const base = normalizarTarefa({ id: novoId("t"), titulo, status: "a_fazer" });
  base.registros.push(
    normalizarRegistro({
      tipo: "marco", data: hojeISO(), titulo: "Tarefa criada",
      anotacoes: "", alteracoes: { status: { de: "", para: "a_fazer" } },
    }),
  );
  return base;
}

/** Marca (ou desmarca) a tarefa como foco de hoje. */
export function comFoco(t: Tarefa, ligado: boolean): Tarefa {
  return { ...t, focoEm: ligado ? hojeISO() : null };
}

export const ehFocoHoje = (t: Tarefa) => t.focoEm === hojeISO();

/** Prende (ou solta) a tarefa na barra lateral. */
export function comFixada(t: Tarefa, ligado: boolean): Tarefa {
  return { ...t, fixada: ligado };
}

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

/**
 * Marca (ou desmarca) um registro como referência do assunto: conhecimento que vale para várias
 * tarefas (como um processo funciona, quem cuida do quê). Aparece na página da categoria.
 */
export function comReferencia(t: Tarefa, registroId: string, ligado: boolean): Tarefa {
  return { ...t, registros: t.registros.map((r) => (r.id === registroId ? { ...r, referencia: ligado } : r)) };
}
