// Jornada: a rotina do dia em blocos de horário, o ponto (entrada, pausas, saída) e o banco de horas.
// Tudo aqui é função pura sobre os dados: a hora de saída, o saldo e o "bloco de agora" são contas feitas
// na hora, nunca gravadas. O que é gravado (jornada.json) é só o que o usuário informou: o plano e o ponto.
//
// Regras da conta (se mudar, mude testes/jornada.test.mjs junto):
//   saída prevista = entrada + jornada do dia + pausa
//     pausa = a planejada (config) enquanto nenhuma pausa foi registrada; depois, as pausas de verdade
//   trabalhado     = (saída ou agora) − entrada − pausas
//     sem pausa registrada num dia de mais de 6h, a pausa planejada é descontada (config.descontarPausa)
//   saldo do dia   = trabalhado − jornada do dia; só entra no banco de horas o dia com entrada e saída
//   dia sem registro não conta (nem a favor, nem contra): quem não usou o app num dia não fica devendo 8h
//   folga, feriado e dia fora dos dias de trabalho: nada é esperado, tudo o que for trabalhado é extra
// Limite conhecido: o expediente cabe num dia de calendário (turno que atravessa a meia-noite não é atendido).

import { ID_CONFIG_JORNADA, agoraISO, dataReal, horaValida, normalizarBloco, normalizarConfigDaJornada, normalizarDiaDaJornada, novoId } from "./tipos";
import type { BlocoDaJornada, Colecao, ConfigDaJornada, DiaDaJornada, ItemDaJornada, PontoDoDia } from "./tipos";

// ---------- horas e datas ----------

/** "08:30" → 510 */
export const emMinutos = (h: string | null | undefined) => (horaValida(h) ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : 0);

const p2 = (n: number) => String(n).padStart(2, "0");

/** 510 → "08:30". Passou da meia-noite, dá a volta (1500 → "01:00"). */
export function emHora(min: number) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
}

/** 90 → "1h30", 480 → "8h", 45 → "45 min", 0 → "0 min" */
export function duracao(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${p2(m % 60)}` : `${m / 60}h`;
}

/** Saldo com sinal: 90 → "+1h30", −20 → "−0h20", 0 → "0h00" */
export function saldoEmTexto(min: number) {
  const m = Math.round(min);
  const a = Math.abs(m);
  return `${m > 0 ? "+" : m < 0 ? "−" : ""}${Math.floor(a / 60)}h${p2(a % 60)}`;
}

/** "8", "815", "8:15", "08h15" → "08:15". O que não é hora vira "". */
export function lerHora(texto: string) {
  const t = texto.trim().toLowerCase().replace(/h/, ":").replace(/[^\d:]/g, "");
  if (!t) return "";
  let h: number;
  let m: number;
  if (t.includes(":")) {
    const [a, b = ""] = t.split(":");
    if (!a || a.length > 2 || b.length > 2) return "";
    h = Number(a);
    m = b ? Number(b.padEnd(2, "0")) : 0;
  } else if (t.length <= 2) {
    h = Number(t);
    m = 0;
  } else if (t.length <= 4) {
    h = Number(t.slice(0, t.length - 2));
    m = Number(t.slice(-2));
  } else return "";
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${p2(h)}:${p2(m)}` : "";
}

/** "1:30", "-0:45", "+2", "90min" não: aceita horas e minutos com sinal → minutos. Texto torto → null. */
export function lerSaldo(texto: string): number | null {
  const t = texto.trim().replace("−", "-").replace(/h/i, ":");
  if (!t) return 0;
  const m = /^([+-]?)(\d{1,4})(?::(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const min = Number(m[3] ?? 0);
  if (min > 59) return null;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + min);
}

const deData = (data: string) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d);
};
const paraData = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** 0 = domingo ... 6 = sábado */
export const diaDaSemana = (data: string) => deData(data).getDay();

export function somarDiasA(data: string, n: number) {
  const d = deData(data);
  d.setDate(d.getDate() + n);
  return paraData(d);
}

/** A semana de segunda a domingo que contém a data. */
export function semanaDe(data: string): string[] {
  const seg = somarDiasA(data, -((diaDaSemana(data) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => somarDiasA(seg, i));
}

/** Todos os dias do mês da data. */
export function mesDe(data: string): string[] {
  const [a, m] = data.split("-").map(Number);
  const n = new Date(a, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${a}-${p2(m)}-${p2(i + 1)}`);
}

export const NOME_DO_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// ---------- ler a coleção ----------

export interface Jornada {
  config: ConfigDaJornada;
  dias: Map<string, DiaDaJornada>;
}

const VAZIA: Jornada = { config: normalizarConfigDaJornada(null), dias: new Map() };
const lidas = new WeakMap<object, Jornada>();

/** Separa a configuração dos dias. Coleção ausente (dados de versão antiga) vale como vazia. */
export function lerJornada(col: Colecao<ItemDaJornada> | null | undefined): Jornada {
  if (!col) return VAZIA;
  const pronta = lidas.get(col);
  if (pronta) return pronta;
  let config: ConfigDaJornada | null = null;
  const dias = new Map<string, DiaDaJornada>();
  for (const item of col.items ?? []) {
    if (item.id === ID_CONFIG_JORNADA) config = item as ConfigDaJornada;
    else if (dataReal(item.id)) dias.set(item.id, item as DiaDaJornada);
  }
  const jornada = { config: config ?? normalizarConfigDaJornada(null), dias };
  lidas.set(col, jornada);
  return jornada;
}

export function diaVazio(data: string): DiaDaJornada {
  return normalizarDiaDaJornada({ id: data, data });
}

/** O dia gravado ou, se ainda não existe, um dia em branco (que só passa a existir quando for gravado). */
export const diaDe = (j: Jornada, data: string) => j.dias.get(data) ?? diaVazio(data);

/** O plano do dia: o do próprio dia, se o usuário já mexeu nele, ou o dia padrão daquele dia da semana. */
export function blocosDoDia(j: Jornada, data: string): { blocos: BlocoDaJornada[]; doPadrao: boolean } {
  const dia = j.dias.get(data);
  if (dia?.planejado) return { blocos: dia.blocos, doPadrao: false };
  const padrao = j.config.padrao[String(diaDaSemana(data))] ?? [];
  return { blocos: padrao, doPadrao: padrao.length > 0 };
}

// ---------- o que é esperado num dia ----------

/** Quantos minutos de trabalho são esperados neste dia. */
export function esperadoNoDia(config: ConfigDaJornada, dia: DiaDaJornada | undefined, data: string) {
  if (dia?.folga) return 0;
  if (dia?.jornadaMin != null) return dia.jornadaMin;
  return config.diasDeTrabalho.includes(diaDaSemana(data)) ? config.jornadaMin : 0;
}

export const pausaPlanejada = (config: ConfigDaJornada, dia: DiaDaJornada | undefined) => dia?.pausaMin ?? config.pausaMin;

// ---------- o ponto ----------

export type EstadoDoPonto = "sem-registro" | "aberto" | "fechado" | "sem-saida";

export interface ContaDoPonto {
  estado: EstadoDoPonto;
  /** Jornada esperada no dia. */
  esperado: number;
  /** Da entrada até a saída (ou até agora), sem tirar nada. */
  bruto: number;
  /** O que foi tirado como pausa: as registradas ou, sem registro, a planejada. */
  pausas: number;
  /** A pausa não foi registrada e a planejada foi descontada. */
  pausaDescontada: boolean;
  emPausa: boolean;
  trabalhado: number;
  /** trabalhado − esperado. null enquanto o dia não fecha. */
  saldo: number | null;
  /** Minuto do dia em que a jornada se completa (pode passar de 1439). null sem entrada ou em dia sem jornada. */
  saidaPrevista: number | null;
  /** Quanto falta para a saída prevista (0 se já passou). */
  falta: number;
  /** Quanto já passou da saída prevista, com o dia aberto. */
  extra: number;
  /** A pausa somada na previsão de saída. */
  pausaNaPrevisao: number;
}

const SEIS_HORAS = 360;

/**
 * Faz a conta do ponto de um dia. "agora" é o minuto do dia (só faz sentido para hoje);
 * passe null para um dia que já passou: sem saída registrada, ele fica como "sem-saida" e não conta.
 */
export function contarPonto(config: ConfigDaJornada, dia: DiaDaJornada | undefined, data: string, agora: number | null): ContaDoPonto {
  const esperado = esperadoNoDia(config, dia, data);
  const planejada = pausaPlanejada(config, dia);
  const p: PontoDoDia | undefined = dia?.ponto;
  const nada = { esperado, bruto: 0, pausas: 0, pausaDescontada: false, emPausa: false, trabalhado: 0, saldo: null, saidaPrevista: null, falta: 0, extra: 0, pausaNaPrevisao: 0 };
  if (!p?.entrada) return { estado: "sem-registro", ...nada };
  const entrada = emMinutos(p.entrada);
  const aberto = !p.saida;
  if (aberto && agora == null) return { estado: "sem-saida", ...nada, saidaPrevista: esperado > 0 ? entrada + esperado + planejada : null, pausaNaPrevisao: planejada };
  const fim = Math.max(entrada, aberto ? (agora as number) : emMinutos(p.saida));
  const bruto = fim - entrada;

  let fechadas = 0;
  let emAberto = 0;
  let emPausa = false;
  for (const q of p.pausas) {
    const ini = Math.min(fim, Math.max(entrada, emMinutos(q.inicio)));
    if (q.fim) fechadas += Math.max(0, Math.min(fim, emMinutos(q.fim)) - ini);
    else {
      emAberto += fim - ini;
      emPausa = aberto;
    }
  }
  const registrou = p.pausas.length > 0;
  const pausaDescontada = !registrou && config.descontarPausa && planejada > 0 && bruto > SEIS_HORAS;
  const pausas = registrou ? fechadas + emAberto : pausaDescontada ? planejada : 0;
  const trabalhado = Math.max(0, bruto - pausas);

  // previsão: enquanto nada foi registrado vale a pausa planejada; pausa em andamento conta pelo que
  // falta da planejada (ou pelo que já durou, se passou); pausas encerradas contam pelo que duraram
  const pausaNaPrevisao = !registrou ? planejada : fechadas + (emPausa ? Math.max(emAberto, planejada - fechadas, 0) : emAberto);
  const saidaPrevista = esperado > 0 ? entrada + esperado + pausaNaPrevisao : null;
  return {
    estado: aberto ? "aberto" : "fechado",
    esperado,
    bruto,
    pausas,
    pausaDescontada,
    emPausa,
    trabalhado,
    saldo: aberto ? null : trabalhado - esperado,
    saidaPrevista,
    falta: saidaPrevista != null && aberto ? Math.max(0, saidaPrevista - fim) : 0,
    extra: aberto ? (saidaPrevista != null ? Math.max(0, fim - saidaPrevista) : trabalhado) : Math.max(0, trabalhado - esperado),
    pausaNaPrevisao,
  };
}

// ---------- mexer no ponto (devolvem um dia novo; use dentro de salvarDia) ----------

const tocar = (dia: DiaDaJornada): DiaDaJornada => ({ ...dia, atualizadoEm: agoraISO() });

/** Registra a entrada e fixa a jornada e a pausa esperadas no dia, para o saldo não mudar se a configuração mudar. */
export function comEntrada(dia: DiaDaJornada, hora: string, config: ConfigDaJornada): DiaDaJornada {
  if (!horaValida(hora)) return dia;
  return tocar({
    ...dia,
    ponto: { ...dia.ponto, entrada: hora },
    // a folga é uma marca à parte: se ela for desmarcada depois, a jornada do dia tem que continuar lá
    jornadaMin: dia.jornadaMin ?? esperadoNoDia(config, { ...dia, folga: false }, dia.data),
    pausaMin: dia.pausaMin ?? config.pausaMin,
  });
}

export function comPausaIniciada(dia: DiaDaJornada, hora: string): DiaDaJornada {
  const p = dia.ponto;
  if (!horaValida(hora) || !p.entrada || p.saida || p.pausas.some((q) => !q.fim) || hora < p.entrada) return dia;
  return tocar({ ...dia, ponto: { ...p, pausas: [...p.pausas, { inicio: hora, fim: null }] } });
}

export function comPausaEncerrada(dia: DiaDaJornada, hora: string): DiaDaJornada {
  const p = dia.ponto;
  const i = p.pausas.findIndex((q) => !q.fim);
  if (!horaValida(hora) || i < 0) return dia;
  // voltou no mesmo minuto em que saiu: a pausa não aconteceu
  const pausas = hora <= p.pausas[i].inicio ? p.pausas.filter((_, k) => k !== i) : p.pausas.map((q, k) => (k === i ? { ...q, fim: hora } : q));
  return tocar({ ...dia, ponto: { ...p, pausas } });
}

/** Registra a saída. Uma pausa ainda aberta termina na saída. */
export function comSaida(dia: DiaDaJornada, hora: string): DiaDaJornada {
  const p = dia.ponto;
  if (!horaValida(hora) || !p.entrada || hora <= p.entrada) return dia;
  const pausas = p.pausas.filter((q) => q.inicio < hora).map((q) => (q.fim && q.fim <= hora ? q : { ...q, fim: hora }));
  return tocar({ ...dia, ponto: { ...p, saida: hora, pausas } });
}

/** Desfaz a saída (saiu e voltou, ou clicou sem querer). */
export function comDiaReaberto(dia: DiaDaJornada): DiaDaJornada {
  return tocar({ ...dia, ponto: { ...dia.ponto, saida: null } });
}

// ---------- o plano do dia ----------

export function novoBloco(b: Partial<BlocoDaJornada>): BlocoDaJornada {
  return normalizarBloco({ ...b, id: novoId("bl") });
}

const ordenar = (blocos: BlocoDaJornada[]) => [...blocos].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));

/**
 * Antes da primeira mudança no plano de um dia, o dia padrão é copiado para ele: daí em diante o que
 * vale é o plano do próprio dia, e mexer no dia padrão não muda mais este dia.
 */
export function comPlanoProprio(dia: DiaDaJornada, config: ConfigDaJornada): DiaDaJornada {
  if (dia.planejado) return dia;
  const padrao = config.padrao[String(diaDaSemana(dia.data))] ?? [];
  return { ...dia, planejado: true, blocos: padrao.map((b) => ({ ...b, feito: false })) };
}

/** Acrescenta ou troca um bloco (pelo id). */
export function comBloco(dia: DiaDaJornada, config: ConfigDaJornada, bloco: BlocoDaJornada): DiaDaJornada {
  const d = comPlanoProprio(dia, config);
  const b = normalizarBloco(bloco);
  return tocar({ ...d, blocos: ordenar(d.blocos.some((x) => x.id === b.id) ? d.blocos.map((x) => (x.id === b.id ? b : x)) : [...d.blocos, b]) });
}

export function semBloco(dia: DiaDaJornada, config: ConfigDaJornada, id: string): DiaDaJornada {
  const d = comPlanoProprio(dia, config);
  return tocar({ ...d, blocos: d.blocos.filter((x) => x.id !== id) });
}

/** Volta o dia a seguir o dia padrão (os blocos próprios saem). */
export function comDiaPadrao(dia: DiaDaJornada): DiaDaJornada {
  return tocar({ ...dia, planejado: false, blocos: [] });
}

/** Grava (ou cria) um dia na lista de itens da coleção. */
export function comDia(items: ItemDaJornada[], data: string, fn: (dia: DiaDaJornada) => DiaDaJornada): ItemDaJornada[] {
  const atual = items.find((x) => x.id === data) as DiaDaJornada | undefined;
  const novo = fn(atual ? normalizarDiaDaJornada(atual) : diaVazio(data));
  return atual ? items.map((x) => (x.id === data ? novo : x)) : [...items, novo];
}

export function comConfig(items: ItemDaJornada[], fn: (c: ConfigDaJornada) => ConfigDaJornada): ItemDaJornada[] {
  const atual = items.find((x) => x.id === ID_CONFIG_JORNADA) as ConfigDaJornada | undefined;
  const novo = normalizarConfigDaJornada({ ...fn(normalizarConfigDaJornada(atual)), atualizadoEm: agoraISO() });
  return atual ? items.map((x) => (x.id === ID_CONFIG_JORNADA ? novo : x)) : [novo, ...items];
}

/** Minutos cobertos pelos blocos, sem contar duas vezes onde eles se sobrepõem. */
export function minutosCobertos(blocos: BlocoDaJornada[]) {
  let total = 0;
  let ate = -1;
  for (const b of ordenar(blocos)) {
    const ini = Math.max(emMinutos(b.inicio), ate);
    const fim = emMinutos(b.fim);
    if (fim > ini) {
      total += fim - ini;
      ate = fim;
    }
  }
  return total;
}

export interface ResumoDoPlano {
  /** Minutos de trabalho planejados (tarefas e atividades). */
  trabalho: number;
  /** Minutos de pausa planejados. */
  pausa: number;
  inicio: number | null;
  fim: number | null;
  /** Minuto em que o expediente termina: entrada (a real, ou o começo do plano) + jornada + pausa. null sem plano ou sem jornada. */
  fimDoExpediente: number | null;
  /** Trabalho planejado além da jornada do dia. */
  extra: number;
  /** Jornada do dia que ainda não tem plano. */
  livre: number;
  /** Ids dos blocos de trabalho que passam do fim do expediente. */
  alemDoExpediente: Set<string>;
}

/**
 * Resume o plano de um dia e diz o que é hora extra: o trabalho planejado além da jornada do dia e os
 * blocos que passam do fim do expediente. Em dia sem jornada (folga, fim de semana), tudo é extra.
 */
export function resumoDoPlano(blocos: BlocoDaJornada[], esperado: number, pausaDoDia: number, saidaPrevista: number | null = null): ResumoDoPlano {
  const trabalhos = blocos.filter((b) => b.tipo !== "pausa");
  const pausas = blocos.filter((b) => b.tipo === "pausa");
  const trabalho = minutosCobertos(trabalhos);
  const pausa = minutosCobertos(pausas);
  const inicio = blocos.length ? Math.min(...blocos.map((b) => emMinutos(b.inicio))) : null;
  const fim = blocos.length ? Math.max(...blocos.map((b) => emMinutos(b.fim))) : null;
  const comeco = trabalhos.length ? Math.min(...trabalhos.map((b) => emMinutos(b.inicio))) : null;
  const fimDoExpediente = saidaPrevista ?? (esperado > 0 && comeco != null ? comeco + esperado + (pausas.length ? pausa : pausaDoDia) : null);
  const alemDoExpediente = new Set<string>();
  for (const b of trabalhos) if (esperado <= 0 || (fimDoExpediente != null && emMinutos(b.fim) > fimDoExpediente)) alemDoExpediente.add(b.id);
  return { trabalho, pausa, inicio, fim, fimDoExpediente, extra: Math.max(0, trabalho - esperado), livre: Math.max(0, esperado - trabalho), alemDoExpediente };
}

export interface Agora {
  /** O bloco em andamento (se dois se sobrepõem, o que começou por último). */
  atual: BlocoDaJornada | null;
  /** Minutos até o fim do bloco em andamento. */
  restante: number;
  proximo: BlocoDaJornada | null;
  /** Minutos até o próximo bloco começar. */
  emQuanto: number;
}

export function blocoNoInstante(blocos: BlocoDaJornada[], agora: number): Agora {
  let atual: BlocoDaJornada | null = null;
  let proximo: BlocoDaJornada | null = null;
  for (const b of ordenar(blocos)) {
    const ini = emMinutos(b.inicio);
    if (ini <= agora && agora < emMinutos(b.fim)) atual = b;
    else if (ini > agora && !proximo) proximo = b;
  }
  return { atual, restante: atual ? emMinutos(atual.fim) - agora : 0, proximo, emQuanto: proximo ? emMinutos(proximo.inicio) - agora : 0 };
}

// ---------- reuniões (3.21) ----------

/** A tarefa a que a reunião do bloco serve: a escolhida na reunião ou, num bloco de tarefa, a do próprio bloco. */
export const tarefaDaReuniao = (b: BlocoDaJornada): string | null => (b.reuniao ? b.reuniao.tarefaId || (b.tipo === "tarefa" ? b.tarefaId ?? null : null) : null);

export type MomentoDaReuniao = "depois" | "em-breve" | "agora" | "passou";
export const MINUTOS_ANTES_DA_REUNIAO = 15;

export interface ReuniaoDoDia {
  bloco: BlocoDaJornada;
  tarefaId: string | null;
  momento: MomentoDaReuniao;
  /** Minutos até começar (0 se já começou). */
  emQuanto: number;
}

/** As reuniões do plano do dia, na ordem do horário, com o momento de cada uma em relação a "agora" (minutos do dia). */
export function reunioesDoDia(blocos: BlocoDaJornada[], agora: number): ReuniaoDoDia[] {
  return ordenar(blocos)
    .filter((b) => !!b.reuniao)
    .map((bloco) => {
      const [ini, fim] = [emMinutos(bloco.inicio), emMinutos(bloco.fim)];
      const momento: MomentoDaReuniao = agora >= fim || bloco.feito ? "passou" : agora >= ini ? "agora" : ini - agora <= MINUTOS_ANTES_DA_REUNIAO ? "em-breve" : "depois";
      return { bloco, tarefaId: tarefaDaReuniao(bloco), momento, emQuanto: Math.max(0, ini - agora) };
    });
}

/**
 * As tarefas que têm reunião marcada de hoje até daqui a "dias" (contando o dia padrão, que é a reunião que se
 * repete). Os lembretes "parada" e "sem próximo passo" não valem para elas: o assunto tem data para andar.
 */
export function tarefasComReuniaoMarcada(j: Jornada, hoje: string, dias = 7): Set<string> {
  const out = new Set<string>();
  for (let n = 0; n <= dias; n++) {
    const data = somarDiasA(hoje, n);
    if (j.dias.get(data)?.folga) continue;
    for (const b of blocosDoDia(j, data).blocos) {
      const id = tarefaDaReuniao(b);
      if (id && !b.feito) out.add(id);
    }
  }
  return out;
}

/** O primeiro horário vago de pelo menos "minutos", a partir de "desde", sem passar de "ate". null se não há. */
export function proximoVago(blocos: BlocoDaJornada[], desde: number, minutos: number, ate = 23 * 60): { inicio: number; fim: number } | null {
  let cursor = Math.ceil(desde / 15) * 15;
  for (const b of ordenar(blocos)) {
    const ini = emMinutos(b.inicio);
    const fim = emMinutos(b.fim);
    if (fim <= cursor) continue;
    if (ini - cursor >= minutos) break;
    cursor = Math.max(cursor, fim);
  }
  return cursor + minutos <= ate ? { inicio: cursor, fim: cursor + minutos } : null;
}

/** Para desenhar blocos que se sobrepõem lado a lado: em que coluna cada um fica e quantas colunas o grupo tem. */
export function emColunas(blocos: BlocoDaJornada[]): Map<string, { coluna: number; colunas: number }> {
  const out = new Map<string, { coluna: number; colunas: number }>();
  let grupo: { b: BlocoDaJornada; coluna: number }[] = [];
  let fimDoGrupo = -1;
  const fechar = () => {
    const colunas = Math.max(1, ...grupo.map((g) => g.coluna + 1));
    for (const g of grupo) out.set(g.b.id, { coluna: g.coluna, colunas });
    grupo = [];
  };
  for (const b of ordenar(blocos)) {
    const ini = emMinutos(b.inicio);
    if (grupo.length && ini >= fimDoGrupo) fechar();
    const ocupadas = new Set(grupo.filter((g) => emMinutos(g.b.fim) > ini).map((g) => g.coluna));
    let coluna = 0;
    while (ocupadas.has(coluna)) coluna++;
    grupo.push({ b, coluna });
    fimDoGrupo = Math.max(fimDoGrupo, emMinutos(b.fim));
  }
  if (grupo.length) fechar();
  return out;
}

// ---------- avisos ----------

export interface AvisoDaJornada {
  /** Para não repetir o mesmo aviso no mesmo dia. */
  chave: string;
  titulo: string;
  detalhe: string;
  tipo: "comeca" | "termina" | "saida" | "pausa" | "reuniao";
  blocoId?: string;
}

export const MINUTOS_ANTES_DO_FIM = 5;
/** Um aviso vale por alguns minutos depois do instante dele (a janela pode ter ficado em segundo plano). */
const TOLERANCIA = 3;
const naHora = (instante: number, agora: number) => agora >= instante && agora <= instante + TOLERANCIA;

/** Os avisos que cabem neste minuto: bloco que começa, bloco que está acabando, jornada cumprida e pausa que terminou. */
export function avisosDoMinuto(blocos: BlocoDaJornada[], conta: ContaDoPonto, dia: DiaDaJornada | undefined, pausaDoDia: number, agora: number): AvisoDaJornada[] {
  const out: AvisoDaJornada[] = [];
  const ordenados = ordenar(blocos);
  for (const b of ordenados) {
    const ini = emMinutos(b.inicio);
    const fim = emMinutos(b.fim);
    if (naHora(ini, agora) && agora < fim) {
      out.push({
        chave: `comeca:${b.id}:${b.inicio}`,
        tipo: "comeca",
        blocoId: b.id,
        titulo: b.tipo === "pausa" ? `Hora da pausa: ${b.titulo || "Pausa"}` : `Agora: ${b.titulo || "Bloco sem nome"}`,
        detalhe: `Até as ${b.fim} (${duracao(fim - ini)}).`,
      });
    }
    // reunião chegando: dá tempo de abrir a pauta (3.21)
    if (b.reuniao && !b.feito && naHora(ini - MINUTOS_ANTES_DA_REUNIAO, agora)) {
      const gente = b.reuniao.participantes;
      out.push({
        chave: `reuniao:${b.id}:${b.inicio}`,
        tipo: "reuniao",
        blocoId: b.id,
        titulo: `Reunião em ${ini - agora} min: ${b.titulo || "sem nome"}`,
        detalhe: `Às ${b.inicio}${gente.length ? `, com ${gente.slice(0, 3).join(", ")}${gente.length > 3 ? ` e mais ${gente.length - 3}` : ""}` : ""}. A pauta está na tela Hoje.`,
      });
    }
    if (fim - ini >= 15 && naHora(fim - MINUTOS_ANTES_DO_FIM, agora) && agora < fim) {
      const depois = ordenados.find((x) => emMinutos(x.inicio) >= fim);
      out.push({
        chave: `termina:${b.id}:${b.fim}`,
        tipo: "termina",
        blocoId: b.id,
        titulo: `${b.titulo || "O bloco"} termina às ${b.fim}`,
        detalhe: depois ? `Depois: ${depois.titulo || "Bloco sem nome"}, às ${depois.inicio}.` : "Depois disso, o plano de hoje acaba.",
      });
    }
  }
  if (conta.estado === "aberto" && conta.saidaPrevista != null && !conta.emPausa && naHora(conta.saidaPrevista, agora)) {
    out.push({ chave: `saida:${emHora(conta.saidaPrevista)}`, tipo: "saida", titulo: `Você completou as ${duracao(conta.esperado)} de hoje`, detalhe: "Dá para encerrar o dia. O que passar daqui conta como hora extra." });
  }
  const aberta = conta.emPausa ? dia?.ponto.pausas.find((q) => !q.fim) : undefined;
  if (aberta && pausaDoDia > 0 && naHora(emMinutos(aberta.inicio) + pausaDoDia, agora)) {
    out.push({ chave: `pausa:${aberta.inicio}`, tipo: "pausa", titulo: `Sua pausa de ${duracao(pausaDoDia)} terminou`, detalhe: "Registre a volta quando retomar." });
  }
  return out;
}

// ---------- banco de horas ----------

export interface LinhaDoBanco {
  data: string;
  diaSemana: number;
  estado: EstadoDoPonto | "folga";
  esperado: number;
  entrada: string | null;
  saida: string | null;
  pausas: number;
  pausaDescontada: boolean;
  trabalhado: number;
  /** null: o dia não entra no saldo (sem registro, em aberto ou sem saída). */
  saldo: number | null;
  obs: string;
}

/** A linha de um dia no banco de horas. Hoje, em aberto, aparece com o trabalhado até agora, mas sem saldo. */
export function linhaDoDia(j: Jornada, data: string, hoje: string, agora: number | null): LinhaDoBanco {
  const dia = j.dias.get(data);
  const conta = contarPonto(j.config, dia, data, data === hoje ? agora : null);
  return {
    data,
    diaSemana: diaDaSemana(data),
    estado: conta.estado === "sem-registro" && (dia?.folga || conta.esperado === 0) ? "folga" : conta.estado,
    esperado: conta.esperado,
    entrada: dia?.ponto.entrada ?? null,
    saida: dia?.ponto.saida ?? null,
    pausas: conta.pausas,
    pausaDescontada: conta.pausaDescontada,
    trabalhado: conta.trabalhado,
    saldo: conta.saldo,
    obs: dia?.obs ?? "",
  };
}

export interface Periodo {
  saldo: number;
  trabalhado: number;
  esperado: number;
  /** Dias que entraram na conta (com entrada e saída). */
  dias: number;
}

const somar = (linhas: LinhaDoBanco[]): Periodo => {
  const fechadas = linhas.filter((l) => l.saldo != null);
  return {
    saldo: fechadas.reduce((n, l) => n + (l.saldo as number), 0),
    trabalhado: fechadas.reduce((n, l) => n + l.trabalhado, 0),
    esperado: fechadas.reduce((n, l) => n + l.esperado, 0),
    dias: fechadas.length,
  };
};

export interface BancoDeHoras {
  semana: Periodo;
  mes: Periodo;
  /** Tudo o que já foi registrado, mais o saldo inicial informado na configuração. */
  total: Periodo;
  /** Dias anteriores a hoje com entrada e sem saída: não contam até serem corrigidos. */
  semSaida: string[];
}

/** O banco de horas visto de uma data de referência: a semana e o mês dela, e o acumulado até ela. */
export function bancoDeHoras(j: Jornada, referencia: string, hoje: string): BancoDeHoras {
  const linha = (data: string) => linhaDoDia(j, data, hoje, null);
  const registradas = [...j.dias.keys()].filter((d) => d <= referencia).sort().map(linha);
  const total = somar(registradas);
  return {
    semana: somar(semanaDe(referencia).map(linha)),
    mes: somar(mesDe(referencia).map(linha)),
    total: { ...total, saldo: total.saldo + j.config.saldoInicialMin },
    semSaida: [...j.dias.keys()].filter((d) => d < hoje && linha(d).estado === "sem-saida").sort(),
  };
}

const DATA_CURTA = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}`;

/** O mês em texto simples, para colar numa planilha, num e-mail ou no sistema de ponto. Sem IA. */
export function textoDoBanco(j: Jornada, referencia: string, hoje: string): string {
  const linhas = mesDe(referencia).map((d) => linhaDoDia(j, d, hoje, null));
  const banco = bancoDeHoras(j, linhas[linhas.length - 1].data, hoje);
  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(deData(referencia));
  const out = [`Banco de horas de ${mes}`, ""];
  for (const l of linhas) {
    if (l.saldo == null && l.estado !== "sem-saida") continue;
    const dia = `${DATA_CURTA(l.data)} (${DIA_CURTO[l.diaSemana]})`;
    if (l.estado === "sem-saida") out.push(`${dia}: entrada ${l.entrada}, sem saída registrada (não entra no saldo)`);
    else out.push(`${dia}: ${l.entrada} a ${l.saida}, pausa ${duracao(l.pausas)}${l.pausaDescontada ? " (não registrada, descontada)" : ""}, trabalhado ${duracao(l.trabalhado)}, saldo ${saldoEmTexto(l.saldo as number)}`);
  }
  if (out.length === 2) out.push("Nenhum dia registrado neste mês.");
  out.push("", `Saldo do mês: ${saldoEmTexto(banco.mes.saldo)} (${banco.mes.dias} ${banco.mes.dias === 1 ? "dia" : "dias"}, ${duracao(banco.mes.trabalhado)} trabalhadas)`);
  out.push(`Saldo acumulado: ${saldoEmTexto(banco.total.saldo)}`);
  return out.join("\n");
}
