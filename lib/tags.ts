// Tags (3.16): o inventário de todas as tags do app e as trocas em lote (renomear, juntar, tirar).
//
// Tag não é coleção: é um texto dentro de `tags` de tarefas, links, páginas, pessoas e modelos. Por isso nada
// aqui é gravado como "cadastro de tags": o inventário é conta feita na hora, e renomear uma tag é regravar
// os itens que a usam (cada um pela gravação normal, com rev). Funções puras, testadas em testes/tags.test.mjs.
//
// Duas tags são a mesma quando só mudam maiúsculas e espaços em volta ("Pipeline" e "pipeline "): é a mesma
// regra do campo de tags, que não deixa pôr as duas no mesmo item. Acento, plural e hífen diferentes continuam
// sendo tags diferentes, mas aparecem como "parecidas" para o usuário decidir se junta.

import { type Dados, type LinkDoc, type Modelo, type Pagina, type Pessoa, type Tarefa, semAcento } from "./tipos";

/** Onde uma tag pode estar. */
export type OndeTemTag = "tarefas" | "links" | "paginas" | "pessoas" | "modelos";

export const ONDE_TEM_TAG: { id: OndeTemTag; um: string; varios: string }[] = [
  { id: "tarefas", um: "tarefa", varios: "tarefas" },
  { id: "links", um: "link", varios: "links" },
  { id: "paginas", um: "página", varios: "páginas" },
  { id: "pessoas", um: "pessoa", varios: "pessoas" },
  { id: "modelos", um: "modelo", varios: "modelos" },
];

/** Tamanho máximo do nome de uma tag ao renomear. */
export const MAX_TAG = 60;

/** O nome como é guardado: sem espaço nas pontas, espaços seguidos viram um, sem vírgula nem ponto e vírgula (que separam tags). */
export const limparTag = (t: unknown) => (typeof t === "string" ? t : "").replace(/[,;\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TAG);

/** O que identifica uma tag: o nome limpo, em minúsculas. */
export const chaveDaTag = (t: unknown) => limparTag(t).toLowerCase();

/** A lista tem esta tag (em qualquer grafia de maiúsculas)? */
export const temATag = (tags: readonly string[] | undefined, tag: string) => {
  const k = chaveDaTag(tag);
  return !!k && (tags ?? []).some((t) => chaveDaTag(t) === k);
};

export interface TagDoInventario {
  chave: string;
  /** A grafia mais usada (no empate, a que vem primeiro em ordem alfabética). */
  nome: string;
  /** Todas as grafias encontradas ("Pipeline", "pipeline"). */
  grafias: string[];
  total: number;
  em: Record<OndeTemTag, number>;
}

type ComTags = { id: string; tags?: string[] };

function colecoes(dados: Dados | null | undefined): Record<OndeTemTag, ComTags[]> {
  return {
    tarefas: dados?.tarefas ?? [],
    links: dados?.links?.items ?? [],
    paginas: dados?.paginas?.items ?? [],
    pessoas: dados?.pessoas?.items ?? [],
    modelos: dados?.modelos?.items ?? [],
  };
}

/** Todas as tags do app com a contagem de uso, da mais usada para a menos. */
export function inventarioDeTags(dados: Dados | null | undefined): TagDoInventario[] {
  const mapa = new Map<string, { grafias: Map<string, number>; em: Record<OndeTemTag, number> }>();
  const todas = colecoes(dados);
  for (const { id } of ONDE_TEM_TAG) {
    for (const item of todas[id]) {
      const vistas = new Set<string>();
      for (const bruta of item.tags ?? []) {
        const chave = chaveDaTag(bruta);
        if (!chave || vistas.has(chave)) continue;
        vistas.add(chave);
        let e = mapa.get(chave);
        if (!e) mapa.set(chave, (e = { grafias: new Map(), em: { tarefas: 0, links: 0, paginas: 0, pessoas: 0, modelos: 0 } }));
        e.em[id] += 1;
        const grafia = limparTag(bruta);
        e.grafias.set(grafia, (e.grafias.get(grafia) ?? 0) + 1);
      }
    }
  }
  const out: TagDoInventario[] = [];
  for (const [chave, e] of mapa) {
    const grafias = [...e.grafias.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map(([g]) => g);
    const total = e.em.tarefas + e.em.links + e.em.paginas + e.em.pessoas + e.em.modelos;
    out.push({ chave, nome: grafias[0], grafias, total, em: e.em });
  }
  return out.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Os nomes de todas as tags, da mais usada para a menos: o vocabulário único que os campos de tag sugerem. */
export const nomesDasTags = (dados: Dados | null | undefined): string[] => inventarioDeTags(dados).map((t) => t.nome);

/** "3 tarefas · 1 link": onde a tag está, só com o que tem. */
export function resumoDeUso(em: Record<OndeTemTag, number>): string {
  return ONDE_TEM_TAG.filter((o) => em[o.id] > 0).map((o) => `${em[o.id]} ${em[o.id] === 1 ? o.um : o.varios}`).join(" · ");
}

export interface ItensDaTag {
  tarefas: Tarefa[];
  links: LinkDoc[];
  paginas: Pagina[];
  pessoas: Pessoa[];
  modelos: Modelo[];
}

/** Tudo o que tem a tag. */
export function itensDaTag(dados: Dados | null | undefined, tag: string): ItensDaTag {
  const tem = <T extends ComTags>(lista: T[] | undefined) => (lista ?? []).filter((x) => temATag(x.tags, tag));
  return {
    tarefas: tem(dados?.tarefas),
    links: tem(dados?.links?.items),
    paginas: tem(dados?.paginas?.items),
    pessoas: tem(dados?.pessoas?.items),
    modelos: tem(dados?.modelos?.items),
  };
}

/**
 * A lista de tags de um item depois da troca. `para` null (ou vazio) tira a tag; com nome, renomeia.
 * Se o item já tem a tag de destino, as duas viram uma (é assim que "juntar" funciona), na posição da primeira.
 * Devolve a MESMA lista quando nada muda, para quem chama saber que não precisa gravar.
 */
export function comTagTrocada(tags: readonly string[] | undefined, de: string, para: string | null): string[] {
  const original = (tags ?? []) as string[];
  const lista = [...original];
  const kDe = chaveDaTag(de);
  if (!kDe || !lista.some((t) => chaveDaTag(t) === kDe)) return original;
  const novo = para ? limparTag(para) : "";
  const kNovo = novo.toLowerCase();
  const out: string[] = [];
  let posto = false;
  for (const t of lista) {
    const k = chaveDaTag(t);
    if (k === kDe || (kNovo && k === kNovo)) {
      if (novo && !posto) { out.push(novo); posto = true; }
      continue;
    }
    out.push(t);
  }
  return out.length === lista.length && out.every((t, i) => t === lista[i]) ? original : out;
}

/** O que muda num item: as tags de antes e as de depois. */
export interface MudancaDeTags { id: string; antes: string[]; depois: string[] }

/** Tudo o que uma troca muda, por coleção. É o que a tela grava e o que o desfazer usa para voltar. */
export type PlanoDeTags = Record<OndeTemTag, MudancaDeTags[]>;

/** O plano de renomear (ou juntar, ou tirar: `para` null) uma tag no app inteiro. Não grava nada. */
export function planoDaTroca(dados: Dados | null | undefined, de: string, para: string | null): PlanoDeTags {
  const todas = colecoes(dados);
  const plano: PlanoDeTags = { tarefas: [], links: [], paginas: [], pessoas: [], modelos: [] };
  for (const { id } of ONDE_TEM_TAG) {
    for (const item of todas[id]) {
      const antes = item.tags ?? [];
      const depois = comTagTrocada(antes, de, para);
      if (depois !== antes) plano[id].push({ id: item.id, antes: [...antes], depois });
    }
  }
  return plano;
}

export const tamanhoDoPlano = (p: PlanoDeTags) => ONDE_TEM_TAG.reduce((n, o) => n + p[o.id].length, 0);

const iguais = (a: readonly string[] | undefined, b: readonly string[]) => !!a && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Aplica o plano a um item (ida) ou volta (desfazer). Só mexe no item se as tags dele ainda são as que o plano
 * espera: na ida, as de antes; na volta, as que a troca gravou. Se alguém mudou as tags no meio do caminho,
 * o item fica como está. Devolve o mesmo objeto quando nada muda.
 */
export function comPlano<T extends ComTags>(item: T, mudancas: Map<string, MudancaDeTags>, sentido: "ida" | "volta"): T {
  const m = mudancas.get(item.id);
  if (!m) return item;
  const espera = sentido === "ida" ? m.antes : m.depois;
  const novo = sentido === "ida" ? m.depois : m.antes;
  return iguais(item.tags, espera) ? { ...item, tags: [...novo] } : item;
}

export const porId = (lista: MudancaDeTags[]) => new Map(lista.map((m) => [m.id, m]));

/** A raiz usada para achar tags parecidas: sem acento, sem hífen, espaço ou sublinhado, sem o "s" do plural. */
export function raizDaTag(t: string): string {
  const r = semAcento(chaveDaTag(t)).replace(/[\s_\-./]+/g, "");
  return r.length > 3 && r.endsWith("s") ? r.slice(0, -1) : r;
}

/** Grupos de tags que parecem a mesma (acento, plural, hífen), cada grupo da mais usada para a menos. */
export function tagsParecidas(inventario: TagDoInventario[]): TagDoInventario[][] {
  const grupos = new Map<string, TagDoInventario[]>();
  for (const t of inventario) {
    const r = raizDaTag(t.chave);
    if (!r) continue;
    const g = grupos.get(r);
    if (g) g.push(t);
    else grupos.set(r, [t]);
  }
  return [...grupos.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")))
    .sort((a, b) => b[0].total - a[0].total || a[0].nome.localeCompare(b[0].nome, "pt-BR"));
}

/** Filtra o inventário pelo texto digitado (sem acento, todas as palavras). */
export function tagsComOTexto(inventario: TagDoInventario[], texto: string): TagDoInventario[] {
  const termos = semAcento(texto).split(/\s+/).filter(Boolean);
  if (!termos.length) return inventario;
  return inventario.filter((t) => termos.every((q) => t.grafias.some((g) => semAcento(g).includes(q))));
}
