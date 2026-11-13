// Lógica pura da tela de Pendências: junta os passos em aberto e os organiza
// por tarefa, por prazo ou por pessoa. Nada aqui grava dados.

import { LIMITES, aberta, passoEhMeu } from "@/lib/lembretes";
import { Passo, Registro, Tarefa, diasAte, semAcento } from "@/lib/tipos";

export type Agrupamento = "tarefa" | "prazo" | "pessoa";
export const AGRUPAMENTOS: Agrupamento[] = ["tarefa", "prazo", "pessoa"];

export type Faixa = "atrasados" | "hoje" | "semana" | "depois" | "sem";

export interface Pendencia {
  tarefa: Tarefa;
  registro: Registro;
  passo: Passo;
  /** Dias desde o registro que criou o passo. */
  idade: number;
  /** Aberto há tempo demais (LIMITES.passoAntigo): merece um empurrão. */
  antigo: boolean;
  meu: boolean;
}

export interface Grupo {
  chave: string;
  tipo: Agrupamento;
  itens: Pendencia[];
  tarefa?: Tarefa;
  faixa?: Faixa;
  /** Nome do responsável, ou "" para o grupo "Meus". */
  pessoa?: string;
}

/**
 * Todos os passos de tarefas abertas que ainda não foram feitos.
 * `manter` segura na lista os passos recém-marcados, para o visto aparecer antes de o item sair.
 */
export function coletarPendencias(tarefas: Tarefa[], manter?: ReadonlySet<string>): Pendencia[] {
  const out: Pendencia[] = [];
  for (const tarefa of tarefas) {
    if (!aberta(tarefa)) continue;
    for (const registro of tarefa.registros) {
      const idade = Math.max(0, -(diasAte(registro.data) ?? 0));
      for (const passo of registro.proximosPassos) {
        if (passo.feito && !manter?.has(passo.id)) continue;
        out.push({ tarefa, registro, passo, idade, antigo: idade >= LIMITES.passoAntigo, meu: passoEhMeu(passo) });
      }
    }
  }
  return out;
}

export function combinaComFiltro(p: Pendencia, termo: string) {
  const t = semAcento(termo.trim());
  if (!t) return true;
  return [p.passo.texto, p.passo.responsavel ?? "", p.tarefa.titulo, p.registro.titulo].some((s) => semAcento(s).includes(t));
}

export function faixaDoPasso(p: Passo): Faixa {
  if (!p.prazo) return "sem";
  const d = diasAte(p.prazo);
  if (d === null) return "sem";
  if (d < 0) return "atrasados";
  if (d === 0) return "hoje";
  return d <= 7 ? "semana" : "depois";
}

const ORDEM_FAIXAS: Faixa[] = ["atrasados", "hoje", "semana", "depois", "sem"];

// Com prazo primeiro (o mais próximo antes); sem prazo, o mais antigo antes.
const porPrazoDoPasso = (a: Pendencia, b: Pendencia) =>
  (a.passo.prazo ?? "9999").localeCompare(b.passo.prazo ?? "9999") || b.idade - a.idade;

const porTarefa = (a: Tarefa, b: Tarefa) =>
  b.prioridade - a.prioridade || (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || a.titulo.localeCompare(b.titulo);

export function agrupar(itens: Pendencia[], modo: Agrupamento): Grupo[] {
  if (modo === "tarefa") {
    const mapa = new Map<string, Grupo>();
    for (const p of itens) {
      let g = mapa.get(p.tarefa.id);
      if (!g) mapa.set(p.tarefa.id, (g = { chave: `t:${p.tarefa.id}`, tipo: "tarefa", tarefa: p.tarefa, itens: [] }));
      g.itens.push(p);
    }
    return [...mapa.values()]
      .map((g) => ({ ...g, itens: g.itens.sort(porPrazoDoPasso) }))
      .sort((a, b) => porTarefa(a.tarefa!, b.tarefa!));
  }

  if (modo === "prazo") {
    return ORDEM_FAIXAS.map<Grupo>((faixa) => ({
      chave: `f:${faixa}`,
      tipo: "prazo",
      faixa,
      itens: itens
        .filter((p) => faixaDoPasso(p.passo) === faixa)
        .sort((a, b) => porPrazoDoPasso(a, b) || porTarefa(a.tarefa, b.tarefa)),
    })).filter((g) => g.itens.length);
  }

  const meus: Grupo = { chave: "p:", tipo: "pessoa", pessoa: "", itens: [] };
  const outros = new Map<string, Grupo>();
  for (const p of itens) {
    if (p.meu) {
      meus.itens.push(p);
      continue;
    }
    const nome = (p.passo.responsavel ?? "").trim();
    const chave = semAcento(nome);
    let g = outros.get(chave);
    if (!g) outros.set(chave, (g = { chave: `p:${chave}`, tipo: "pessoa", pessoa: nome, itens: [] }));
    g.itens.push(p);
  }
  const ordenar = (g: Grupo) => ({ ...g, itens: g.itens.sort((a, b) => porPrazoDoPasso(a, b) || porTarefa(a.tarefa, b.tarefa)) });
  return [
    ...(meus.itens.length ? [ordenar(meus)] : []),
    ...[...outros.values()].map(ordenar).sort((a, b) => b.itens.length - a.itens.length || a.pessoa!.localeCompare(b.pessoa!)),
  ];
}
