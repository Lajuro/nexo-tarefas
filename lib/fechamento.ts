// Fechamento do dia e daily: o que saiu no dia, o que ficou do foco, o que vem no próximo dia de
// trabalho e os impedimentos. Funções puras sobre os dados: nada é gravado aqui, e o texto da daily
// é montado só com o que está registrado (sem IA), como a ata e o status do Radar.

import { type EventoDiario, eventosDoDiario, tituloDoDia } from "./diario";
import { type PassoAberto, aberta, passoEhMeu, passosAbertosDe } from "./lembretes";
import { paraTextoPlano } from "./texto-rico";
import { type Dados, type Tarefa, ordenarRegistros, tipoInfo } from "./tipos";

const p2 = (n: number) => String(n).padStart(2, "0");
const deIso = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
};
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** O próximo dia (depois de `data`) que está entre os dias de trabalho. Sem dias de trabalho, o dia seguinte. */
export function proximoDiaDeTrabalho(data: string, diasDeTrabalho: number[]): string {
  const d = deIso(data);
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1);
    if (!diasDeTrabalho.length || diasDeTrabalho.includes(d.getDay())) return iso(d);
  }
  return iso(d);
}

/** O último dia antes de `data` em que algo andou (até 14 dias para trás). Vazio se não houver. */
export function ultimoDiaComAtividade(tarefas: Tarefa[], data: string): string {
  const dias = new Set(eventosDoDiario(tarefas).filter(contaComoFeito).map((e) => e.data));
  const d = deIso(data);
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() - 1);
    if (dias.has(iso(d))) return iso(d);
  }
  return "";
}

/** Marco "Tarefa criada" e mudanças de status não são trabalho feito; concluir a tarefa é. */
const contaComoFeito = (e: EventoDiario) =>
  e.tipo === "passo" || e.registro.tipo !== "marco" || e.registro.alteracoes?.status?.para === "concluida";

export interface Fechamento {
  dia: string;
  /** O próximo dia de trabalho, para onde vai o que ficou. */
  proximo: string;
  /** O que andou no dia (registros, passos concluídos, tarefas concluídas), na ordem em que aconteceu. */
  feitos: EventoDiario[];
  /** Tarefas que eram foco do dia e continuam abertas. */
  focosAbertos: Tarefa[];
  /** Meus passos com prazo até o dia que não foram feitos. */
  passosAtrasados: PassoAberto[];
  /** O que já está marcado para o próximo dia de trabalho. */
  proximoDia: { prazos: Tarefa[]; passos: PassoAberto[]; followups: Tarefa[]; focos: Tarefa[] };
  /** Bloqueadas e esperando alguém: o que vale dizer na daily. */
  impedimentos: { tarefa: Tarefa; texto: string }[];
}

/** Impedimento de uma tarefa aberta: bloqueada (com o último impedimento registrado) ou esperando alguém. */
function impedimentoDe(t: Tarefa): string | null {
  if (t.status === "bloqueada") {
    const ultimo = ordenarRegistros(t.registros, true).find((r) => r.impedimentos.trim() && !/^nenhum\.?$/i.test(r.impedimentos.trim()));
    return ultimo ? paraTextoPlano(ultimo.impedimentos).replace(/\s+/g, " ").trim().slice(0, 200) : "bloqueada";
  }
  if (t.status === "aguardando" && t.esperando) return `aguardando ${[t.esperando.quem, t.esperando.oQue].filter(Boolean).join(": ")}`;
  return null;
}

export function montarFechamento(dados: Pick<Dados, "tarefas">, dia: string, diasDeTrabalho: number[]): Fechamento {
  const tarefas = dados.tarefas;
  const proximo = proximoDiaDeTrabalho(dia, diasDeTrabalho);
  const abertas = tarefas.filter(aberta);
  const meus = passosAbertosDe(tarefas).filter((x) => passoEhMeu(x.passo));
  return {
    dia,
    proximo,
    feitos: eventosDoDiario(tarefas)
      .filter((e) => e.data === dia && contaComoFeito(e))
      .sort((a, b) => a.ordem.localeCompare(b.ordem)),
    focosAbertos: abertas.filter((t) => t.focoEm === dia).sort((a, b) => b.prioridade - a.prioridade),
    passosAtrasados: meus.filter((x) => x.passo.prazo && x.passo.prazo <= dia),
    proximoDia: {
      prazos: abertas.filter((t) => t.prazo === proximo),
      passos: meus.filter((x) => x.passo.prazo === proximo),
      followups: abertas.filter((t) => t.lembrarEm === proximo),
      focos: abertas.filter((t) => t.focoEm === proximo),
    },
    impedimentos: abertas.flatMap((t) => {
      const texto = impedimentoDe(t);
      return texto ? [{ tarefa: t, texto }] : [];
    }),
  };
}

/** Um evento em poucas palavras, para a lista do que foi feito ("reunião «Alinhamento»", "concluiu «X»"). */
function oQueFoi(e: EventoDiario): string {
  if (e.tipo === "passo") return `concluí «${e.passo.texto}»`;
  const r = e.registro;
  if (r.tipo === "marco") return "tarefa concluída";
  const tipo = tipoInfo(r.tipo).nome.toLowerCase();
  return r.titulo ? `${tipo} «${r.titulo}»` : tipo;
}

/** O que foi feito, uma linha por tarefa, na ordem em que a tarefa apareceu no dia. */
export function linhasDoQueFoiFeito(feitos: EventoDiario[]): string[] {
  const porTarefa = new Map<string, { titulo: string; itens: string[] }>();
  for (const e of feitos) {
    const x = porTarefa.get(e.tarefa.id) ?? { titulo: e.tarefa.titulo, itens: [] };
    const item = oQueFoi(e);
    if (!x.itens.includes(item)) x.itens.push(item);
    porTarefa.set(e.tarefa.id, x);
  }
  return [...porTarefa.values()].map((x) => `- ${x.titulo}: ${x.itens.join("; ")}`);
}

/** Próximo passo em aberto de uma tarefa (o mais antigo), para dizer o que vai ser feito nela. */
function proximoPassoDe(t: Tarefa): string {
  for (const r of ordenarRegistros(t.registros)) for (const p of r.proximosPassos) if (!p.feito && passoEhMeu(p)) return p.texto;
  return "";
}

/** "o que vou fazer": as tarefas, sem repetir, com o próximo passo de cada uma quando houver. */
export function linhasDoQueVouFazer(tarefas: Tarefa[], passos: PassoAberto[] = []): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const t of tarefas) {
    if (vistas.has(t.id)) continue;
    vistas.add(t.id);
    const passo = proximoPassoDe(t);
    out.push(`- ${t.titulo}${passo ? `: ${passo}` : ""}`);
  }
  for (const x of passos) {
    if (vistas.has(x.tarefa.id)) continue;
    vistas.add(x.tarefa.id);
    out.push(`- ${x.tarefa.titulo}: ${x.passo.texto}`);
  }
  return out;
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Daily em texto simples: o que fiz (num dia), o que vou fazer e os impedimentos.
 * `diaFeito` é o dia do que foi feito; `vouFazer` já vem montado por quem chama.
 */
export function textoDaDaily(x: { diaFeito: string; feitos: EventoDiario[]; vouFazer: string[]; impedimentos: { tarefa: Tarefa; texto: string }[] }): string {
  const fiz = linhasDoQueFoiFeito(x.feitos);
  const L = [
    `O que fiz (${tituloDoDia(x.diaFeito)}):`,
    ...(fiz.length ? fiz : ["- Nada registrado no Nexo."]),
    "",
    "O que vou fazer:",
    ...(x.vouFazer.length ? x.vouFazer : ["- Ainda vou definir."]),
    "",
    "Impedimentos:",
    ...(x.impedimentos.length ? x.impedimentos.map((i) => `- ${i.tarefa.titulo}: ${i.texto}`) : ["- Nenhum."]),
  ];
  return maiuscula(L.join("\n")) + "\n";
}

/** Daily do fim do dia: o que fiz hoje e o que vou fazer no próximo dia de trabalho. */
export function dailyDoFechamento(f: Fechamento, levados: Tarefa[] = f.focosAbertos): string {
  const p = f.proximoDia;
  return textoDaDaily({
    diaFeito: f.dia,
    feitos: f.feitos,
    vouFazer: linhasDoQueVouFazer([...levados, ...p.focos, ...p.prazos, ...p.followups], p.passos),
    impedimentos: f.impedimentos,
  });
}

/**
 * Daily da manhã: o que fiz no último dia com atividade e o que vou fazer hoje (focos de hoje,
 * prazos de hoje e meus passos que vencem hoje).
 */
export function dailyDaManha(dados: Pick<Dados, "tarefas">, hoje: string): string {
  const tarefas = dados.tarefas;
  const ontem = ultimoDiaComAtividade(tarefas, hoje);
  const abertas = tarefas.filter(aberta);
  const meus = passosAbertosDe(tarefas).filter((x) => passoEhMeu(x.passo) && x.passo.prazo && x.passo.prazo <= hoje);
  return textoDaDaily({
    diaFeito: ontem || hoje,
    feitos: ontem ? eventosDoDiario(tarefas).filter((e) => e.data === ontem && contaComoFeito(e)).sort((a, b) => a.ordem.localeCompare(b.ordem)) : [],
    vouFazer: linhasDoQueVouFazer(
      [...abertas.filter((t) => t.focoEm === hoje).sort((a, b) => b.prioridade - a.prioridade), ...abertas.filter((t) => t.prazo === hoje)],
      meus,
    ),
    impedimentos: abertas.flatMap((t) => {
      const texto = impedimentoDe(t);
      return texto ? [{ tarefa: t, texto }] : [];
    }),
  });
}
