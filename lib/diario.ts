// Diário: tudo o que aconteceu em todas as tarefas, dia a dia. Função pura sobre os dados
// (nada é gravado: é só outro jeito de olhar os registros e os passos concluídos).

import { dataLocal } from "./lembretes";
import { type Passo, type Registro, type Tarefa, type TipoRegistro, formatarData, semAcento, tipoInfo } from "./tipos";

export type EventoDiario =
  | { tipo: "registro"; chave: string; data: string; ordem: string; tarefa: Tarefa; registro: Registro }
  | { tipo: "passo"; chave: string; data: string; ordem: string; tarefa: Tarefa; registro: Registro; passo: Passo };

export interface DiaDoDiario {
  data: string;
  eventos: EventoDiario[];
}

/** "tudo", um tipo de registro, ou "passos" (só passos concluídos). */
export type TipoNoDiario = "tudo" | TipoRegistro | "passos";

export interface FiltroDiario {
  categoriaId?: string;
  tipo?: TipoNoDiario;
  /** Nome de quem participou (registro) ou era responsável (passo). */
  pessoa?: string;
}

const chave = (s: string) => semAcento(s || "").replace(/\s+/g, " ").trim();

/** Todos os eventos que passam no filtro, sem agrupar. */
export function eventosDoDiario(tarefas: Tarefa[], filtro: FiltroDiario = {}): EventoDiario[] {
  const tipo = filtro.tipo ?? "tudo";
  const pessoa = filtro.pessoa ? chave(filtro.pessoa) : "";
  const out: EventoDiario[] = [];
  for (const tarefa of tarefas) {
    if (filtro.categoriaId && tarefa.categoriaId !== filtro.categoriaId) continue;
    for (const registro of tarefa.registros) {
      const entraRegistro = tipo === "tudo" ? true : tipo === registro.tipo;
      if (entraRegistro && (!pessoa || registro.participantes.some((p) => chave(p) === pessoa)))
        out.push({ tipo: "registro", chave: `r:${registro.id}`, data: registro.data, ordem: `${registro.hora || "99:99"} ${registro.criadoEm}`, tarefa, registro });
      if (tipo !== "tudo" && tipo !== "passos") continue;
      for (const passo of registro.proximosPassos) {
        if (!passo.feito || !passo.feitoEm) continue;
        if (pessoa && chave(passo.responsavel || "") !== pessoa) continue;
        out.push({ tipo: "passo", chave: `p:${passo.id}`, data: dataLocal(passo.feitoEm), ordem: `zz ${passo.feitoEm}`, tarefa, registro, passo });
      }
    }
  }
  return out;
}

/** Eventos agrupados por dia, do mais recente para o mais antigo. Dentro do dia, na ordem em que aconteceram. */
export function montarDiario(tarefas: Tarefa[], filtro: FiltroDiario = {}): DiaDoDiario[] {
  const porDia = new Map<string, EventoDiario[]>();
  for (const e of eventosDoDiario(tarefas, filtro)) {
    if (!e.data) continue;
    const lista = porDia.get(e.data);
    if (lista) lista.push(e);
    else porDia.set(e.data, [e]);
  }
  return [...porDia.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, eventos]) => ({ data, eventos: eventos.sort((a, b) => a.ordem.localeCompare(b.ordem)) }));
}

/** Marco "Tarefa criada" e mudanças de status não contam como trabalho feito, exceto concluir. */
const contaComoAtividade = (e: EventoDiario) =>
  e.tipo === "passo" || e.registro.tipo !== "marco" || e.registro.alteracoes?.status?.para === "concluida";

/** Quantas coisas andaram em cada dia (para o mapa de atividade e a sequência). */
export function atividadePorDia(tarefas: Tarefa[], categoriaId?: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of eventosDoDiario(tarefas, { categoriaId })) if (e.data && contaComoAtividade(e)) m.set(e.data, (m.get(e.data) ?? 0) + 1);
  return m;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const deIso = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
};
const diaUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/**
 * Dias úteis seguidos com alguma atividade. Fim de semana não quebra a sequência (nem conta).
 * Hoje ainda sem nada também não quebra: o dia não acabou.
 */
export function sequencia(atividade: Map<string, number>, hoje: string): { atual: number; melhor: number } {
  const d = deIso(hoje);
  let atual = 0;
  if (!atividade.get(hoje)) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 2000; i++, d.setDate(d.getDate() - 1)) {
    if (!diaUtil(d)) {
      if (atividade.get(iso(d))) atual++;
      continue;
    }
    if (!atividade.get(iso(d))) break;
    atual++;
  }
  // melhor sequência da história: anda do dia mais antigo até hoje
  const datas = [...atividade.keys()].filter((x) => x <= hoje).sort();
  let melhor = 0;
  if (datas.length) {
    let corrente = 0;
    const fim = deIso(hoje);
    for (const x = deIso(datas[0]); x <= fim; x.setDate(x.getDate() + 1)) {
      const tem = !!atividade.get(iso(x));
      if (tem) corrente++;
      else if (diaUtil(x) && iso(x) !== hoje) corrente = 0;
      if (corrente > melhor) melhor = corrente;
    }
  }
  return { atual, melhor: Math.max(melhor, atual) };
}

/** Semanas (segunda a domingo) que terminam na semana de hoje, para desenhar o mapa. Dias futuros vêm como null. */
export function semanasDoMapa(hoje: string, semanas: number): (string | null)[][] {
  const fim = deIso(hoje);
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7) - (semanas - 1) * 7); // segunda da primeira semana
  const out: (string | null)[][] = [];
  const d = new Date(inicio);
  for (let s = 0; s < semanas; s++) {
    const semana: (string | null)[] = [];
    for (let i = 0; i < 7; i++, d.setDate(d.getDate() + 1)) semana.push(d <= fim ? iso(d) : null);
    out.push(semana);
  }
  return out;
}

/** 0 a 4, para a intensidade da cor no mapa. */
export function nivelDeAtividade(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 6) return 3;
  return 4;
}

const resumo = (r: Registro, max = 220) => {
  const t = (r.resumoIA || r.anotacoes).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

const DIA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const tituloDoDia = (data: string) => `${DIA_SEMANA[deIso(data).getDay()]}, ${formatarData(data)}`;

function linhaDoEvento(e: EventoDiario): string {
  if (e.tipo === "passo") return `- Passo concluído: ${e.passo.texto} (${e.tarefa.titulo})`;
  const r = e.registro;
  if (r.tipo === "marco") return `- ${r.titulo} (${e.tarefa.titulo})`;
  const partes = [`- [${tipoInfo(r.tipo).nome}] ${r.titulo || "Sem título"} (${e.tarefa.titulo})`];
  const texto = resumo(r);
  if (texto) partes[0] += `: ${texto}`;
  if (r.participantes.length) partes.push(`  Com: ${r.participantes.join(", ")}`);
  return partes.join("\n");
}

/** Texto simples de um dia, pronto para colar num e-mail ou no chat. Sem IA: só o que está registrado. */
export function textoDoDia(dia: DiaDoDiario): string {
  const t = tituloDoDia(dia.data);
  return [t.charAt(0).toUpperCase() + t.slice(1), ...dia.eventos.map(linhaDoEvento)].join("\n");
}

export const textoDosDias = (dias: DiaDoDiario[]) => dias.map(textoDoDia).join("\n\n");
