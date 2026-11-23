// Checklist próprio da tarefa (3.17): a lista do que ela precisa para ficar pronta.
//
// Não é a mesma coisa que os próximos passos. O passo nasce de um registro (o que ficou combinado numa conversa),
// tem responsável e prazo e aparece em Pendências. O item do checklist é da tarefa em si: uma linha, feito ou não.
// Por isso ele não gera lembrete nem entra na tela de Pendências; o que ele dá é o "3 de 5" no cartão da tarefa.
//
// Funções puras, usadas sempre dentro de atualizarTarefa(id, fn). Testadas em testes/checklist.test.mjs.

import { type ItemDoChecklist, MAX_ITENS_NO_CHECKLIST, MAX_TEXTO_DO_ITEM, type Tarefa, agoraISO, novoId } from "./tipos";

/** O texto de um item como é guardado: uma linha, sem espaço sobrando, até o teto. */
export const textoDoItem = (bruto: unknown) => (typeof bruto === "string" ? bruto : "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO_DO_ITEM);

/**
 * Os itens de um texto colado: uma linha vira um item. Tira a marca de lista do começo ("- ", "* ", "1. ",
 * "[ ] ", "- [x] "), para dar para colar uma lista vinda de um e-mail, do Markdown ou do Word.
 */
export function itensDoTexto(texto: unknown): { texto: string; feito: boolean }[] {
  const out: { texto: string; feito: boolean }[] = [];
  for (const linha of (typeof texto === "string" ? texto : "").split(/\r?\n/)) {
    const m = /^\s*(?:[-*•–]\s+|\d{1,3}[.)]\s+)?(?:\[( |x|X)?\]\s*)?(.*)$/.exec(linha);
    const item = textoDoItem(m ? m[2] : linha);
    if (item) out.push({ texto: item, feito: !!m && (m[1] === "x" || m[1] === "X") });
  }
  return out;
}

export const checklistDe = (t: Pick<Tarefa, "checklist">): ItemDoChecklist[] => t.checklist ?? [];

/** Quantos itens a tarefa tem e quantos já foram feitos. */
export function progressoDoChecklist(t: Pick<Tarefa, "checklist">): { feitos: number; total: number } {
  const itens = checklistDe(t);
  return { feitos: itens.filter((i) => i.feito).length, total: itens.length };
}

/** Quantos itens ainda cabem. */
export const vagasNoChecklist = (t: Pick<Tarefa, "checklist">) => Math.max(0, MAX_ITENS_NO_CHECKLIST - checklistDe(t).length);

/**
 * Acrescenta um item no fim, ou vários se o texto tem mais de uma linha. O que passa do teto não entra
 * (quem chama compara com vagasNoChecklist para avisar). Texto vazio devolve a mesma tarefa.
 */
export function comItensNoChecklist(t: Tarefa, texto: string): Tarefa {
  const novos = itensDoTexto(texto).slice(0, vagasNoChecklist(t));
  if (!novos.length) return t;
  const agora = agoraISO();
  return {
    ...t,
    checklist: [...checklistDe(t), ...novos.map((n) => ({ id: novoId("ck"), texto: n.texto, feito: n.feito, feitoEm: n.feito ? agora : null }))],
  };
}

/** Marca um item como feito ou reabre. */
export function comItemAlternado(t: Tarefa, itemId: string, feito: boolean): Tarefa {
  if (!checklistDe(t).some((i) => i.id === itemId && i.feito !== feito)) return t;
  return { ...t, checklist: checklistDe(t).map((i) => (i.id === itemId ? { ...i, feito, feitoEm: feito ? agoraISO() : null } : i)) };
}

/** Troca o texto de um item. Texto vazio não apaga: devolve a mesma tarefa (para tirar existe semItemDoChecklist). */
export function comItemEditado(t: Tarefa, itemId: string, texto: string): Tarefa {
  const novo = textoDoItem(texto);
  if (!novo || !checklistDe(t).some((i) => i.id === itemId && i.texto !== novo)) return t;
  return { ...t, checklist: checklistDe(t).map((i) => (i.id === itemId ? { ...i, texto: novo } : i)) };
}

/** Tira um item. */
export function semItemDoChecklist(t: Tarefa, itemId: string): Tarefa {
  if (!checklistDe(t).some((i) => i.id === itemId)) return t;
  return { ...t, checklist: checklistDe(t).filter((i) => i.id !== itemId) };
}

/** Sobe (-1) ou desce (+1) um item uma posição. Na ponta, devolve a mesma tarefa. */
export function comItemMovido(t: Tarefa, itemId: string, sentido: -1 | 1): Tarefa {
  const itens = [...checklistDe(t)];
  const de = itens.findIndex((i) => i.id === itemId);
  const para = de + sentido;
  if (de < 0 || para < 0 || para >= itens.length) return t;
  [itens[de], itens[para]] = [itens[para], itens[de]];
  return { ...t, checklist: itens };
}

/**
 * O checklist de `destino` com os itens de `origem` no fim (juntar duas tarefas). Não repete item que já veio
 * (mesmo id) e respeita o teto.
 */
export function comChecklistRecebido(destino: Tarefa, origem: Tarefa): ItemDoChecklist[] {
  const atuais = checklistDe(destino);
  const ja = new Set(atuais.map((i) => i.id));
  const vindos = checklistDe(origem).filter((i) => !ja.has(i.id));
  return [...atuais, ...vindos].slice(0, MAX_ITENS_NO_CHECKLIST);
}

/** Os textos dos itens num texto só, para a busca achar a tarefa pelo que está no checklist. */
export const textoDoChecklist = (t: Pick<Tarefa, "checklist">): string => checklistDe(t).map((i) => i.texto).join(" · ");

/** "[feito] A; [aberto] B": o checklist numa linha, do jeito que os prompts do Copilot escrevem os passos. */
export const checklistEmLinha = (t: Pick<Tarefa, "checklist">): string => checklistDe(t).map((i) => `${i.feito ? "[feito]" : "[aberto]"} ${i.texto}`).join("; ");

/** O checklist como linhas de Markdown ("- [x] texto"), para o espelho e o texto copiado da tarefa. */
export const checklistEmMarkdown = (t: Pick<Tarefa, "checklist">): string[] => checklistDe(t).map((i) => `- [${i.feito ? "x" : " "}] ${i.texto}`);
