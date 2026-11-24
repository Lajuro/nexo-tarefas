// Tempo em cada status (3.23): quanto tempo a tarefa ficou a fazer, em andamento, aguardando terceiros e
// bloqueada, e há quanto tempo está no status de agora. Responde "quanto disto foi espera?" sem o usuário anotar
// nada: a conta sai dos marcos de mudança de status que o app já grava na linha do tempo (lib/acoes.ts).
//
// É uma CONTA: nada é gravado. E é uma conta honesta: quando o histórico não permite saber (tarefa de antes de os
// marcos existirem, marco faltando no meio, relógio de outro computador adiantado), o trecho é marcado como
// "estimado" em vez de ser apresentado como fato. Quem soma por categoria deixa de fora o que é estimado.
//
// Função pura: "agora" é parâmetro. Testada em testes/tempo-status.test.mjs.

import { STATUS, type Status, type Tarefa } from "./tipos";

export interface TrechoDeStatus {
  status: Status;
  /** Carimbos ISO. */
  inicio: string;
  fim: string;
  dias: number;
  /** O começo, o fim ou o status deste trecho foi deduzido, não lido de um marco. */
  estimado: boolean;
}

export interface TempoPorStatus {
  /** Os trechos com duração, do mais antigo para o mais novo. */
  trechos: TrechoDeStatus[];
  /** Dias somados em cada status (só os que apareceram). */
  porStatus: Partial<Record<Status, number>>;
  /** Dias inteiros no status de agora, desde a última mudança (para tarefa fechada: 0). */
  noStatusAtualHa: number;
  /** Do nascimento ao fechamento (ou até agora). */
  totalDeDias: number;
  /** Algum trecho é estimado: a conta serve para olhar a tarefa, mas não entra em média. */
  estimado: boolean;
}

const ehStatus = (s: unknown): s is Status => STATUS.some((x) => x.id === s);
const DIA = 86_400_000;
const emDias = (ms: number) => Math.max(0, Math.round((ms / DIA) * 10) / 10);
const fechado = (s: Status) => s === "concluida" || s === "cancelada";

/** O instante de um registro: o carimbo de criação; sem ele, o meio-dia da data. NaN se nada serve. */
function instante(r: { criadoEm?: string; data?: string }): number {
  const c = Date.parse(r.criadoEm ?? "");
  return Number.isNaN(c) ? Date.parse(`${r.data ?? ""}T12:00:00`) : c;
}

export function tempoPorStatus(t: Tarefa, agora: Date | string | number = new Date()): TempoPorStatus {
  const fimDoMundo = typeof agora === "number" ? agora : new Date(agora).getTime();
  let estimado = false;

  // as mudanças de status, na ordem em que aconteceram
  const mudancas = t.registros
    .filter((r) => r.tipo === "marco" && r.alteracoes?.status && ehStatus(r.alteracoes.status.para))
    .map((r) => ({ quando: instante(r), de: r.alteracoes!.status!.de as unknown, para: r.alteracoes!.status!.para as Status }))
    .filter((m) => !Number.isNaN(m.quando))
    .sort((a, b) => a.quando - b.quando);

  // o nascimento: a data de criação ou o primeiro marco, o que for mais antigo
  let nascimento = Date.parse(t.criadaEm ?? "");
  if (Number.isNaN(nascimento)) {
    nascimento = mudancas[0]?.quando ?? fimDoMundo;
    estimado = true;
  }
  if (mudancas.length && mudancas[0].quando < nascimento) nascimento = mudancas[0].quando;
  // relógio de outro computador adiantado: nada acontece depois de agora
  if (nascimento > fimDoMundo) {
    nascimento = fimDoMundo;
    estimado = true;
  }

  // o status com que a tarefa nasceu: o do marco "Tarefa criada" (que sai de vazio). Sem ele (tarefa de antes dos
  // marcos, ou importada), o primeiro status é deduzido do "de" da primeira mudança, ou é o de agora.
  let atual: Status;
  if (mudancas[0] && !ehStatus(mudancas[0].de)) atual = mudancas.shift()!.para;
  else {
    atual = mudancas[0] && ehStatus(mudancas[0].de) ? mudancas[0].de : t.status;
    estimado = true;
  }

  const trechos: TrechoDeStatus[] = [];
  let cursor = nascimento;
  let doTrecho = estimado; // o trecho em aberto é estimado?
  const fechar = (ate: number) => {
    if (ate > fimDoMundo) estimado = doTrecho = true;
    const fim = Math.min(Math.max(ate, cursor), fimDoMundo);
    if (fim > cursor) trechos.push({ status: atual, inicio: new Date(cursor).toISOString(), fim: new Date(fim).toISOString(), dias: emDias(fim - cursor), estimado: doTrecho });
    cursor = fim;
    doTrecho = false;
  };

  for (const m of mudancas) {
    // marco faltando no meio: o marco diz que a tarefa saía de um status que não é o que a conta tinha
    if (ehStatus(m.de) && m.de !== atual) estimado = doTrecho = true;
    fechar(m.quando);
    atual = m.para;
  }

  // o status de agora não bate com o último marco (mudança feita por fora do app): o resto do tempo é estimado
  const fechamento = Date.parse(t.concluidaEm ?? "");
  if (atual !== t.status) {
    estimado = doTrecho = true;
    if (fechado(t.status)) {
      fechar(Number.isNaN(fechamento) ? cursor : fechamento);
      doTrecho = true;
    }
    atual = t.status;
  }
  // tarefa aberta conta até agora; fechada parou quando fechou
  if (!fechado(t.status)) fechar(fimDoMundo);

  const porStatus: Partial<Record<Status, number>> = {};
  for (const tr of trechos) porStatus[tr.status] = emDias(((porStatus[tr.status] ?? 0) + tr.dias) * DIA);
  const ultimo = trechos[trechos.length - 1];
  return {
    trechos,
    porStatus,
    noStatusAtualHa: fechado(t.status) || !ultimo || ultimo.status !== t.status ? 0 : Math.floor(ultimo.dias),
    totalDeDias: emDias(cursor - nascimento),
    estimado: estimado || trechos.some((tr) => tr.estimado),
  };
}

/** Quantas tarefas confiáveis são precisas para uma média valer (com menos, a média diz mais sobre uma tarefa do que sobre o assunto). */
export const MINIMO_PARA_MEDIA = 3;

export interface MediaDeEspera {
  /** Média de dias aguardando terceiros, entre as tarefas que passaram por esse status. null = poucas tarefas confiáveis. */
  aguardando: number | null;
  bloqueada: number | null;
  /** Quantas tarefas entraram em cada média. */
  tarefasAguardando: number;
  tarefasBloqueada: number;
  /** Quantas ficaram de fora por terem trecho estimado. */
  estimadas: number;
}

/** A média de dias em espera (aguardando e bloqueada) de um conjunto de tarefas. Tarefa com trecho estimado fica de fora. */
export function mediaDeEspera(tarefas: Tarefa[], agora: Date | string | number = new Date()): MediaDeEspera {
  const dias = { aguardando: [] as number[], bloqueada: [] as number[] };
  let estimadas = 0;
  for (const t of tarefas) {
    const tempo = tempoPorStatus(t, agora);
    if (tempo.estimado) { estimadas++; continue; }
    for (const s of ["aguardando", "bloqueada"] as const) if ((tempo.porStatus[s] ?? 0) > 0) dias[s].push(tempo.porStatus[s]!);
  }
  const media = (l: number[]) => (l.length >= MINIMO_PARA_MEDIA ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : null);
  return { aguardando: media(dias.aguardando), bloqueada: media(dias.bloqueada), tarefasAguardando: dias.aguardando.length, tarefasBloqueada: dias.bloqueada.length, estimadas };
}

/** "3 dias", "1 dia", "menos de 1 dia", "2,5 dias". */
export function diasEmTexto(dias: number): string {
  if (dias < 1) return "menos de 1 dia";
  const n = Math.round(dias * 10) / 10;
  return `${String(n).replace(".", ",")} ${n === 1 ? "dia" : "dias"}`;
}
