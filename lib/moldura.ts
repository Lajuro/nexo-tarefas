"use client";

// Como o usuário montou a moldura do app: barra lateral (largura, itens, seções) e barra superior
// (o que aparece nela). É preferência (localStorage "nexo:moldura"), não dado: pode ser perdida sem prejuízo.

import { useCallback, useMemo } from "react";
import { gravarPref, lerPref, usePref } from "./preferencias";

/** Blocos da barra lateral além da navegação. */
export const SECOES = ["foco", "fixadas", "recentes", "assuntos"] as const;
export type IdSecao = (typeof SECOES)[number];
export const NOME_SECAO: Record<IdSecao, { nome: string; descricao: string }> = {
  foco: { nome: "Foco de hoje", descricao: "As tarefas que você escolheu para hoje, com o próximo passo de cada uma." },
  fixadas: { nome: "Fixadas", descricao: "Tarefas que você prendeu aqui pelo menu da tarefa." },
  recentes: { nome: "Recentes", descricao: "As últimas tarefas que você abriu." },
  assuntos: { nome: "Assuntos", descricao: "Categorias com mais tarefas abertas." },
};

/** Ferramentas opcionais da barra superior. O sino e a aparência ficam sempre. */
export const FERRAMENTAS = ["agenda", "foco", "anotar", "busca", "telaCheia", "ajuda"] as const;
export type IdFerramenta = (typeof FERRAMENTAS)[number];
export const NOME_FERRAMENTA: Record<IdFerramenta, { nome: string; descricao: string }> = {
  agenda: { nome: "Data e agenda", descricao: "O dia e a hora. Ao clicar, os prazos das próximas duas semanas." },
  foco: { nome: "Foco de hoje", descricao: "Quantos passos do foco já saíram. Ao clicar, marca passos sem trocar de tela." },
  anotar: { nome: "Anotar rápido", descricao: "Cria uma tarefa ou uma folha do bloco de notas de qualquer tela (atalho A)." },
  busca: { nome: "Campo de busca", descricao: "Abre a paleta de comandos. O atalho Ctrl K continua valendo sem ele." },
  telaCheia: { nome: "Tela cheia", descricao: "Botão de tela cheia (F11)." },
  ajuda: { nome: "Atalhos", descricao: "Botão da lista de atalhos de teclado (?)." },
};

export const LARGURA_LATERAL = { padrao: 244, minima: 208, maxima: 400, recolhida: 56 };

export interface Moldura {
  /** Largura da barra lateral aberta, em px. */
  largura: number;
  /** Ordem dos itens de navegação (href). Quem não está na lista fica na ordem original, no fim. */
  ordem: string[];
  /** Itens de navegação escondidos (href). Continuam acessíveis pelos atalhos e pela paleta. */
  ocultos: string[];
  titulosDeGrupo: boolean;
  contadores: boolean;
  /** Ordem das seções. */
  secoes: IdSecao[];
  secoesOcultas: IdSecao[];
  /** Seções recolhidas (só o título aparece). */
  secoesFechadas: IdSecao[];
  ferramentasOcultas: IdFerramenta[];
  barraStatus: boolean;
}

export const MOLDURA_PADRAO: Moldura = {
  largura: LARGURA_LATERAL.padrao,
  ordem: [],
  ocultos: [],
  titulosDeGrupo: true,
  contadores: true,
  secoes: [...SECOES],
  secoesOcultas: [],
  secoesFechadas: [],
  ferramentasOcultas: [],
  barraStatus: true,
};

const textos = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").slice(0, 60) : []);
const dentro = <T extends string>(lista: readonly T[], x: unknown) => [...new Set(textos(x))].filter((v): v is T => lista.includes(v as T));

/** Aceita qualquer coisa que venha do localStorage e devolve uma moldura válida. */
export function normalizarMoldura(x: unknown): Moldura {
  const m = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Moldura, unknown>>;
  const largura = Number(m.largura);
  const secoes = dentro(SECOES, m.secoes);
  return {
    largura: Number.isFinite(largura) ? Math.min(LARGURA_LATERAL.maxima, Math.max(LARGURA_LATERAL.minima, Math.round(largura))) : LARGURA_LATERAL.padrao,
    ordem: [...new Set(textos(m.ordem))],
    ocultos: [...new Set(textos(m.ocultos))],
    titulosDeGrupo: m.titulosDeGrupo !== false,
    contadores: m.contadores !== false,
    secoes: [...secoes, ...SECOES.filter((s) => !secoes.includes(s))],
    secoesOcultas: dentro(SECOES, m.secoesOcultas),
    secoesFechadas: dentro(SECOES, m.secoesFechadas),
    ferramentasOcultas: dentro(FERRAMENTAS, m.ferramentasOcultas),
    barraStatus: m.barraStatus !== false,
  };
}

/** Põe uma lista na ordem escolhida pelo usuário; o que não foi ordenado mantém a ordem original, no fim. */
export function naOrdem<T>(itens: T[], ordem: string[], chave: (i: T) => string): T[] {
  const pos = new Map(ordem.map((id, i) => [id, i]));
  return itens
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (pos.get(chave(a.item)) ?? 1000 + a.i) - (pos.get(chave(b.item)) ?? 1000 + b.i))
    .map((x) => x.item);
}

/** Liga ou desliga um valor numa lista (para "ocultos", "fechadas"...). */
export const alternarNa = <T,>(lista: T[], valor: T, presente: boolean): T[] =>
  presente ? (lista.includes(valor) ? lista : [...lista, valor]) : lista.filter((v) => v !== valor);

export function useMoldura() {
  const [bruta, setBruta, carregada] = usePref<unknown>("moldura", {});
  const moldura = useMemo(() => normalizarMoldura(bruta), [bruta]);
  const mudarMoldura = useCallback(
    (parte: Partial<Moldura> | ((atual: Moldura) => Partial<Moldura>)) =>
      setBruta((atual: unknown) => {
        const m = normalizarMoldura(atual);
        return normalizarMoldura({ ...m, ...(typeof parte === "function" ? parte(m) : parte) });
      }),
    [setBruta],
  );
  const restaurarMoldura = useCallback(() => setBruta(MOLDURA_PADRAO), [setBruta]);
  return { moldura, mudarMoldura, restaurarMoldura, carregada };
}

// ---------- Tarefas abertas por último (seção "Recentes") ----------

const MAX_RECENTES = 8;

/** Anota que a tarefa foi aberta agora. Chamado pelo Shell a cada troca de tela. */
export function registrarRecente(tarefaId: string) {
  const atual = textos(lerPref<unknown>("recentes", []));
  if (atual[0] === tarefaId) return;
  gravarPref("recentes", [tarefaId, ...atual.filter((id) => id !== tarefaId)].slice(0, MAX_RECENTES));
}

export function useRecentes() {
  const [bruta] = usePref<unknown>("recentes", []);
  return useMemo(() => textos(bruta), [bruta]);
}

/** Abre o painel "Personalizar" de qualquer lugar, já na aba pedida. */
export type AbaPersonalizar = "aparencia" | "lateral" | "superior";
export function abrirPersonalizar(aba: AbaPersonalizar = "aparencia") {
  window.dispatchEvent(new CustomEvent("nexo:personalizar", { detail: { aba } }));
}
