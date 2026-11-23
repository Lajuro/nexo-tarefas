// Tipos e regras puras da lista de tarefas (filtro, ordenação, números do topo).
// Ficam fora dos componentes para as três visões (grade, lista, quadro) usarem exatamente a mesma conta.

import { ehFocoHoje } from "@/lib/acoes";
import { aberta, dataLocal, ultimaAtividade } from "@/lib/lembretes";
import { chaveDaTag, limparTag, temATag } from "@/lib/tags";
import { STATUS, type Status, type Tarefa, diasAte, hojeISO, passosAbertos, semAcento } from "@/lib/tipos";

export type Ordem = "prioridade" | "prazo" | "atividade" | "titulo";
export type FiltroStatus = "abertas" | "todas" | Status;
export type Visao = "grade" | "lista" | "quadro";
/** Filtros prontos que não são um status: prazo vencido, foco de hoje e concluídas no mês. */
export type Especial = "" | "atrasadas" | "foco" | "mes";

export const ORDENS: { id: Ordem; nome: string }[] = [
  { id: "prioridade", nome: "Prioridade" },
  { id: "prazo", nome: "Prazo" },
  { id: "atividade", nome: "Última atividade" },
  { id: "titulo", nome: "A-Z" },
];

export const NOME_ESPECIAL: Record<Exclude<Especial, "">, string> = {
  atrasadas: "Com prazo vencido",
  foco: "Foco de hoje",
  mes: "Concluídas neste mês",
};

/** Valor da categoria no filtro para "tarefas sem categoria". */
export const SEM_CATEGORIA = "__sem";

/** Quantos dias para trás a coluna "Concluída" do quadro mostra. */
export const DIAS_CONCLUIDAS_NO_QUADRO = 30;

export const ehOrdem = (v: unknown): v is Ordem => ORDENS.some((o) => o.id === v);
export const ehVisao = (v: unknown): v is Visao => v === "grade" || v === "lista" || v === "quadro";
export const ehFiltroStatus = (v: unknown): v is FiltroStatus =>
  v === "abertas" || v === "todas" || STATUS.some((s) => s.id === v);
export const ehEspecial = (v: unknown): v is Exclude<Especial, ""> => v === "atrasadas" || v === "foco" || v === "mes";

export const atrasada = (t: Tarefa) => aberta(t) && !!t.prazo && (diasAte(t.prazo) ?? 0) < 0;
export const concluidaNoMes = (t: Tarefa) =>
  t.status === "concluida" && dataLocal(t.concluidaEm).startsWith(hojeISO().slice(0, 7));

/** Concluída há pouco (entra na coluna "Concluída" do quadro). */
export function concluidaRecente(t: Tarefa) {
  if (t.status !== "concluida") return false;
  const d = diasAte(dataLocal(t.concluidaEm || t.atualizadaEm));
  return d === null || d >= -DIAS_CONCLUIDAS_NO_QUADRO;
}

export function numerosDoTopo(tarefas: Tarefa[]) {
  const abertas = tarefas.filter(aberta);
  return {
    abertas: abertas.length,
    atrasadas: abertas.filter(atrasada).length,
    bloqueadas: abertas.filter((t) => t.status === "bloqueada").length,
    pendencias: abertas.reduce((n, t) => n + passosAbertos(t).length, 0),
    concluidasMes: tarefas.filter(concluidaNoMes).length,
  };
}

export interface Filtros {
  texto: string;
  /** "" = todas, SEM_CATEGORIA = sem categoria, ou o id. */
  categoria: string;
  status: FiltroStatus;
  especial: Especial;
  /** Tags escolhidas (3.17): a tarefa precisa ter todas. Vazio ou ausente = não filtra por tag. */
  tags?: string[];
}

/** Quantas tags o filtro aceita de uma vez (o endereço e a visão salva são entrada não confiável). */
export const MAX_TAGS_NO_FILTRO = 8;

/** As tags de um filtro como vieram do endereço ou do navegador: nomes limpos, sem repetir, com teto. */
export function normalizarTagsDoFiltro(v: unknown): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const nome = limparTag(x);
    if (!nome || out.some((t) => chaveDaTag(t) === chaveDaTag(nome))) continue;
    out.push(nome);
    if (out.length >= MAX_TAGS_NO_FILTRO) break;
  }
  return out;
}

/** Os dois filtros têm as mesmas tags, em qualquer ordem e grafia de maiúsculas? */
export function mesmasTags(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  const [x, y] = [(a ?? []).map(chaveDaTag).sort(), (b ?? []).map(chaveDaTag).sort()];
  return x.length === y.length && x.every((t, i) => t === y[i]);
}

/** A lista com a tag posta, ou sem ela se já estava (o clique num filtro de tag). */
export function comTagAlternada(tags: readonly string[], tag: string): string[] {
  return temATag(tags, tag) ? tags.filter((t) => chaveDaTag(t) !== chaveDaTag(tag)) : normalizarTagsDoFiltro([...tags, tag]);
}

/** As tags que aparecem numa lista de itens, com quantos itens têm cada uma, da mais usada para a menos. */
export function tagsEmUso(itens: readonly { tags?: string[] }[]): { nome: string; n: number }[] {
  const mapa = new Map<string, { nome: string; n: number }>();
  for (const item of itens) {
    const vistas = new Set<string>();
    for (const bruta of item.tags ?? []) {
      const chave = chaveDaTag(bruta);
      if (!chave || vistas.has(chave)) continue;
      vistas.add(chave);
      const e = mapa.get(chave);
      if (e) e.n += 1;
      else mapa.set(chave, { nome: limparTag(bruta), n: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O item tem todas as tags pedidas? (lista vazia: passa) */
export const temTodasAsTags = (item: { tags?: string[] }, tags: readonly string[] | undefined) =>
  !tags?.length || tags.every((tag) => temATag(item.tags, tag));

/** Texto, categoria, tags e filtro especial. O status fica de fora (o quadro trata status por coluna). */
export function passaSemStatus(t: Tarefa, f: Filtros, textoNormalizado: string) {
  if (f.categoria && (f.categoria === SEM_CATEGORIA ? t.categoriaId : t.categoriaId !== f.categoria)) return false;
  if (!temTodasAsTags(t, f.tags)) return false;
  if (f.especial === "atrasadas" && !atrasada(t)) return false;
  if (f.especial === "foco" && !(aberta(t) && ehFocoHoje(t))) return false;
  if (f.especial === "mes" && !concluidaNoMes(t)) return false;
  if (textoNormalizado) {
    // Todas as palavras digitadas precisam aparecer, em qualquer ordem ("politica excecoes" acha "política de exceções").
    const alvo = semAcento(`${t.titulo} ${t.descricao} ${t.tags.join(" ")}`);
    if (!textoNormalizado.split(/\s+/).every((palavra) => alvo.includes(palavra))) return false;
  }
  return true;
}

/** O filtro especial já define quais status entram; por isso, com ele ligado, o filtro de status não se aplica. */
export function passaStatus(t: Tarefa, f: Filtros) {
  if (f.especial) return true;
  if (f.status === "todas") return true;
  if (f.status === "abertas") return aberta(t);
  return t.status === f.status;
}

export function filtrar(tarefas: Tarefa[], f: Filtros) {
  const q = semAcento(f.texto.trim());
  return tarefas.filter((t) => passaSemStatus(t, f, q) && passaStatus(t, f));
}

/**
 * O que aparece no quadro: abertas e concluídas recentes que passam nos filtros.
 * Com "Só abertas" ou "Todas" o quadro mostra todas as colunas; com um status específico, só ele.
 */
export function filtrarParaQuadro(tarefas: Tarefa[], f: Filtros) {
  const q = semAcento(f.texto.trim());
  const especifico = !f.especial && f.status !== "abertas" && f.status !== "todas" ? f.status : null;
  const base = tarefas.filter((t) => passaSemStatus(t, f, q) && (!especifico || t.status === especifico));
  return {
    visiveis: base.filter((t) => aberta(t) || concluidaRecente(t)),
    concluidasAntigas: base.filter((t) => t.status === "concluida" && !concluidaRecente(t)).length,
  };
}

/** Devolve uma cópia ordenada. A data da última atividade é calculada uma vez por tarefa. */
export function ordenar(tarefas: Tarefa[], ordem: Ordem) {
  if (ordem === "atividade") {
    return tarefas
      .map((t) => ({ t, ult: ultimaAtividade(t) }))
      .sort((a, b) => b.ult.localeCompare(a.ult) || b.t.prioridade - a.t.prioridade)
      .map((x) => x.t);
  }
  return [...tarefas].sort((a, b) => {
    if (ordem === "prioridade") return b.prioridade - a.prioridade || (a.prazo ?? "9").localeCompare(b.prazo ?? "9") || a.titulo.localeCompare(b.titulo, "pt-BR");
    if (ordem === "prazo") return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || b.prioridade - a.prioridade;
    return a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" });
  });
}

// ---------- visões salvas (preferência do navegador: "nexo:visoesTarefas") ----------

/** Uma combinação de filtros guardada com nome, para abrir de novo com um clique (ou pela paleta). */
export interface VisaoSalva {
  id: string;
  nome: string;
  texto: string;
  categoria: string;
  status: FiltroStatus;
  especial: Especial;
  ordem: Ordem;
  visao: Visao;
  /** Tags do filtro (3.17). Visão guardada antes disso não tem o campo: vale como nenhuma. */
  tags: string[];
}

export const MAX_VISOES = 20;

/** Lê a lista do localStorage: tudo é conferido (listas fechadas, tamanhos), o que não bate vira padrão ou cai fora. */
export function normalizarVisoes(x: unknown): VisaoSalva[] {
  if (!Array.isArray(x)) return [];
  const out: VisaoSalva[] = [];
  for (const v of x) {
    if (!v || typeof v !== "object") continue;
    const o = v as Partial<Record<keyof VisaoSalva, unknown>>;
    const id = typeof o.id === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(o.id) ? o.id : "";
    const nome = typeof o.nome === "string" ? o.nome.trim().slice(0, 60) : "";
    if (!id || !nome || out.some((x) => x.id === id)) continue;
    out.push({
      id,
      nome,
      texto: typeof o.texto === "string" ? o.texto.slice(0, 200) : "",
      categoria: typeof o.categoria === "string" && /^[a-zA-Z0-9_-]{0,80}$/.test(o.categoria) ? o.categoria : "",
      status: ehFiltroStatus(o.status) ? o.status : "abertas",
      especial: ehEspecial(o.especial) ? o.especial : "",
      ordem: ehOrdem(o.ordem) ? o.ordem : "prioridade",
      visao: ehVisao(o.visao) ? o.visao : "grade",
      tags: normalizarTagsDoFiltro(o.tags),
    });
    if (out.length >= MAX_VISOES) break;
  }
  return out;
}
