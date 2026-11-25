// Links e documentos como material de trabalho (3.14). Três coisas moram aqui, todas em funções puras:
//
//   1. Um link serve para várias tarefas: `tarefaIds` (lista) no lugar do antigo `tarefaId` (uma só).
//      O campo antigo continua gravado, igual à primeira tarefa da lista, para uma versão antiga do app
//      ainda mostrar o link em uma tarefa (ver tarefasDoLinkBruto em lib/tipos.ts).
//   2. Um link pode ter status: de leitura (para ler, lido) ou de chamado (aberto, em andamento,
//      aguardando retorno, concluído, cancelado). É um status só por link: o chamado está concluído
//      para todas as tarefas que o usam.
//   3. Um link pode estar travando uma tarefa (`trava`, ids de tarefas): é o chamado de que ela depende.
//      Isso é por tarefa, porque o mesmo chamado pode travar uma e ser só referência em outra.
//      Só trava enquanto o status está em aberto; quando o chamado fecha, a tarefa "destravou".
//
// Páginas e folhas do bloco de notas também podem servir a tarefas (`pagina.tarefaIds`, `nota.tarefaIds`):
// aparecem junto dos links em "Links e documentos" da tarefa (referenciasDaTarefa).

import { anexoDoSrc, hrefInterno, linkPermitido, paraTextoPlano, srcDoAnexo } from "./texto-rico";
import {
  type Dados, ESTADOS_LINK, type EstadoLink, type LinkDoc, MAX_DEPENDENCIAS, type Nota, type Pagina, dataLocal, diasAte,
} from "./tipos";

/** Dias sem mudança de status a partir dos quais um chamado em aberto vira lembrete. */
export const DIAS_CHAMADO_PARADO = 5;

export const estadoInfo = (e: EstadoLink | null | undefined) => ESTADOS_LINK.find((x) => x.id === e) ?? null;

/** Nome do status para mostrar ("Sem status" quando não há). */
export const nomeDoEstado = (e: EstadoLink | null | undefined) => estadoInfo(e)?.nome ?? "Sem status";

/** O link ainda pede alguma coisa (ler, acompanhar)? Sem status não pede nada. */
export const estadoAberto = (l: Pick<LinkDoc, "estado">) => estadoInfo(l.estado)?.aberto === true;

/** Status de chamado ainda em aberto (aberto, em andamento, aguardando): é o que vale acompanhar e cobrar. */
export const chamadoAberto = (l: Pick<LinkDoc, "estado">) => {
  const e = estadoInfo(l.estado);
  return !!e && e.grupo === "chamado" && e.aberto;
};

/** As tarefas em que o link é usado. */
export const tarefasDoLink = (l: Pick<LinkDoc, "tarefaId" | "tarefaIds">): string[] =>
  Array.isArray(l.tarefaIds) ? l.tarefaIds : l.tarefaId ? [l.tarefaId] : [];

export const linkEhDaTarefa = (l: LinkDoc, tarefaId: string) => tarefasDoLink(l).includes(tarefaId);

/** Troca a lista de tarefas do link (sem repetir), mantendo o campo antigo e a trava coerentes. */
export function comTarefasNoLink(l: LinkDoc, ids: string[]): LinkDoc {
  const tarefaIds = [...new Set(ids.filter(Boolean))].slice(0, MAX_DEPENDENCIAS);
  return { ...l, tarefaIds, tarefaId: tarefaIds[0] ?? null, trava: (l.trava ?? []).filter((id) => tarefaIds.includes(id)) };
}

/** Passa a usar (ou deixa de usar) o link numa tarefa. */
export function comTarefaNoLink(l: LinkDoc, tarefaId: string, usar: boolean): LinkDoc {
  const atual = tarefasDoLink(l);
  if (usar) return atual.includes(tarefaId) ? l : comTarefasNoLink(l, [...atual, tarefaId]);
  return atual.includes(tarefaId) ? comTarefasNoLink(l, atual.filter((x) => x !== tarefaId)) : l;
}

/** Ao juntar duas tarefas: o que era da origem passa a ser do destino (inclusive a trava). */
export function comTarefaTrocada<T extends { tarefaIds?: string[] }>(item: T, de: string, para: string): T {
  const atual = item.tarefaIds ?? [];
  if (!atual.includes(de)) return item;
  const tarefaIds = [...new Set(atual.map((x) => (x === de ? para : x)))];
  const out = { ...item, tarefaIds } as T & { tarefaId?: string | null; trava?: string[] };
  if ("tarefaId" in item) out.tarefaId = tarefaIds[0] ?? null;
  const trava = (item as { trava?: string[] }).trava;
  if (Array.isArray(trava)) out.trava = [...new Set(trava.map((x) => (x === de ? para : x)))].filter((x) => tarefaIds.includes(x));
  return out;
}

/** Acrescenta ou tira uma tarefa de uma página ou folha. */
export function comTarefaNoItem<T extends { tarefaIds?: string[] }>(item: T, tarefaId: string, usar: boolean): T {
  const atual = item.tarefaIds ?? [];
  if (usar) return atual.includes(tarefaId) || atual.length >= MAX_DEPENDENCIAS ? item : { ...item, tarefaIds: [...atual, tarefaId] };
  return atual.includes(tarefaId) ? { ...item, tarefaIds: atual.filter((x) => x !== tarefaId) } : item;
}

/** Muda o status. O carimbo só anda quando o status muda de verdade (é dele que sai "há N dias"). */
export function comEstado(l: LinkDoc, estado: EstadoLink | null, agora: string): LinkDoc {
  const novo = estadoInfo(estado)?.id ?? null;
  if ((l.estado ?? null) === novo) return l;
  return { ...l, estado: novo, estadoEm: novo ? agora : null };
}

/**
 * Marca (ou desmarca) que o link está travando uma tarefa. Travar um link sem status, ou com status já
 * fechado, põe "Aberto": travar com algo concluído não faria sentido, e sem status não haveria o que acompanhar.
 */
export function comTrava(l: LinkDoc, tarefaId: string, travando: boolean, agora: string): LinkDoc {
  const atual = l.trava ?? [];
  if (!travando) return atual.includes(tarefaId) ? { ...l, trava: atual.filter((x) => x !== tarefaId) } : l;
  if (!tarefasDoLink(l).includes(tarefaId)) return l;
  const base = estadoAberto(l) ? l : comEstado(l, "aberto", agora);
  return atual.includes(tarefaId) ? base : { ...base, trava: [...atual, tarefaId] };
}

/** O link foi marcado como trava desta tarefa (esteja o chamado aberto ou não)? */
export const marcadoComoTrava = (l: LinkDoc, tarefaId: string) => (l.trava ?? []).includes(tarefaId);

/** Está travando agora: marcado como trava e com o status ainda em aberto. */
export const travando = (l: LinkDoc, tarefaId: string) => marcadoComoTrava(l, tarefaId) && estadoAberto(l);

/** Era trava e o chamado fechou: a tarefa destravou. Devolve o dia (AAAA-MM-DD) em que fechou, ou "". */
export function destravouPeloLink(l: LinkDoc, tarefaId: string): string {
  if (!marcadoComoTrava(l, tarefaId) || estadoAberto(l) || !l.estado) return "";
  return dataLocal(l.estadoEm || "") || "";
}

/** Há quantos dias o link está no status de agora (0 = hoje). Sem status, conta do dia em que foi guardado. */
export function diasNoEstado(l: LinkDoc): number {
  const dia = dataLocal(l.estadoEm || l.criadoEm || "");
  return dia ? Math.max(0, -(diasAte(dia) ?? 0)) : 0;
}

/** Desde quando está no status de agora: "hoje", "desde ontem", "há 3 dias". Sem status (ou sem carimbo), "". */
export function tempoNoEstado(l: LinkDoc): string {
  if (!l.estado || !l.estadoEm) return "";
  const d = diasNoEstado(l);
  return d === 0 ? "hoje" : d === 1 ? "desde ontem" : `há ${d} dias`;
}

/** "Aberto há 3 dias", "Concluído hoje", "Para ler". */
export function resumoDoEstado(l: LinkDoc): string {
  const e = estadoInfo(l.estado);
  return e ? [e.nome, tempoNoEstado(l)].filter(Boolean).join(" ") : "";
}

/** Como chamar uma folha do bloco de notas numa lista: o título, ou o começo do texto. */
export const nomeDaFolha = (n: Pick<Nota, "titulo" | "texto">) => n.titulo.trim() || paraTextoPlano(n.texto).split("\n")[0].slice(0, 80) || "Folha sem título";

export interface Referencias {
  links: LinkDoc[];
  paginas: Pagina[];
  notas: Nota[];
}

/** Tudo o que foi ligado a uma tarefa: links e arquivos, páginas e folhas do bloco de notas. */
export function referenciasDaTarefa(dados: Pick<Dados, "links" | "paginas" | "notas">, tarefaId: string): Referencias {
  return {
    links: dados.links.items.filter((l) => linkEhDaTarefa(l, tarefaId)),
    paginas: (dados.paginas?.items ?? []).filter((p) => (p.tarefaIds ?? []).includes(tarefaId)),
    notas: (dados.notas?.items ?? []).filter((n) => (n.tarefaIds ?? []).includes(tarefaId)),
  };
}

/** Os links que estão travando a tarefa agora. */
export const travasDaTarefa = (links: LinkDoc[], tarefaId: string) => links.filter((l) => travando(l, tarefaId));

/** Filtros de status da tela de Links: cada status, mais "em aberto" (qualquer um que ainda pede algo) e "sem status". */
export type FiltroDeEstado = "" | "abertos" | "sem" | EstadoLink;

export function passaNoFiltro(l: LinkDoc, filtro: FiltroDeEstado): boolean {
  if (!filtro) return true;
  if (filtro === "abertos") return estadoAberto(l);
  if (filtro === "sem") return !l.estado;
  return l.estado === filtro;
}

// ---------- citar com "#" num texto (3.25) ----------
//
// Nas anotações de um registro (e em qualquer editor rico), "#" abre a lista de links e documentos: primeiro o que
// está ligado à tarefa do texto (links do banco, páginas e folhas, como no painel "Links e documentos"), depois o
// resto do banco. O que entra no texto é o mesmo do "@" desde a 3.14: o endereço de verdade (ou o anexo da pasta de
// dados) para um link, e o link interno para uma página ou folha. Caminho de rede (\\servidor) fica de fora:
// o navegador não abre, e o texto só aceita http, https, mailto e anexos.

/** O que vai para o texto quando um link do banco é citado. null = não dá para pôr num texto (caminho de rede, anexo torto). */
export function hrefDoLink(l: Pick<LinkDoc, "tipo" | "url" | "arquivo">): string | null {
  if (l.tipo === "arquivo") {
    // `arquivo` é o caminho dentro de arquivos/ ("2026/abc-contrato.pdf"); no texto vai com a pasta na frente.
    // (Da 3.14 à 3.24 o "@" conferia o caminho sem a pasta, e nenhum documento do banco aparecia para citar.)
    const a = (l.arquivo || "").trim();
    const rel = anexoDoSrc(a) ?? anexoDoSrc(srcDoAnexo(a));
    return rel ? srcDoAnexo(rel) : null;
  }
  return linkPermitido(l.url || "");
}

export interface CitavelDeLink {
  /** "link:<id>", "pagina:<id>" ou "nota:<id>". */
  chave: string;
  tipo: "link" | "arquivo" | "pagina" | "nota";
  titulo: string;
  /** O que entra no Markdown. */
  href: string;
  /** Ligado a uma das tarefas do texto. */
  daTarefa: boolean;
  /** Linha de baixo no menu: de onde vem e o status ("Desta tarefa · Aberto há 3 dias"). */
  dica: string;
  /** Mais palavras para a busca: tags, descrição e o endereço. */
  palavras: string;
}

/**
 * A lista do "#". `tarefaIds` são as tarefas de onde o texto está (a do registro; as que a página ou a folha servem).
 * `naTarefa` diz que o texto é da própria tarefa (registro, reunião): a dica fica "Desta tarefa" em vez do nome dela.
 */
export function linksParaCitar(
  dados: Pick<Dados, "links" | "paginas" | "notas"> & { tarefas?: Pick<Dados, "tarefas">["tarefas"] },
  tarefaIds: string[],
  opcoes: { naTarefa?: boolean; semPagina?: string; semNota?: string } = {},
): CitavelDeLink[] {
  const ids = new Set(tarefaIds.filter(Boolean));
  const titulo = (id: string) => dados.tarefas?.find((t) => t.id === id)?.titulo?.trim() || "";
  const deOnde = (doItem: string[], tipo: "" | "Página" | "Folha") => {
    const id = doItem.find((x) => ids.has(x));
    if (!id) return "";
    const qual = opcoes.naTarefa || !titulo(id) ? "desta tarefa" : `da tarefa «${titulo(id)}»`;
    return tipo ? `${tipo} ${qual}` : qual[0].toUpperCase() + qual.slice(1);
  };
  const daTarefa: CitavelDeLink[] = [];
  const outros: CitavelDeLink[] = [];

  for (const l of [...dados.links.items].sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))) {
    const href = hrefDoLink(l);
    if (!href) continue;
    const origem = deOnde(tarefasDoLink(l), "");
    const dica = [origem || (l.tipo === "arquivo" ? "Documento do banco" : "Link do banco"), resumoDoEstado(l)].filter(Boolean).join(" · ");
    const item: CitavelDeLink = {
      chave: `link:${l.id}`, tipo: l.tipo === "arquivo" ? "arquivo" : "link", titulo: l.titulo.trim() || l.nomeArquivo || l.url || "Link sem título",
      href, daTarefa: !!origem, dica,
      palavras: ["link documento", ...(l.tags ?? []), l.descricao || "", l.url || "", l.nomeArquivo || "", l.estado ? nomeDoEstado(l.estado) : ""].join(" "),
    };
    (origem ? daTarefa : outros).push(item);
  }
  if (ids.size) {
    for (const p of [...(dados.paginas?.items ?? [])].sort((a, b) => (b.atualizadaEm || "").localeCompare(a.atualizadaEm || ""))) {
      if (p.arquivadaEm || p.id === opcoes.semPagina) continue;
      const origem = deOnde(p.tarefaIds ?? [], "Página");
      if (origem) daTarefa.push({ chave: `pagina:${p.id}`, tipo: "pagina", titulo: p.titulo.trim() || "Página sem título", href: hrefInterno("pagina", p.id), daTarefa: true, dica: origem, palavras: `pagina ${(p.tags ?? []).join(" ")}` });
    }
    for (const n of [...(dados.notas?.items ?? [])].sort((a, b) => Number(!!a.arquivadaEm) - Number(!!b.arquivadaEm) || (b.atualizadaEm || "").localeCompare(a.atualizadaEm || ""))) {
      if (n.id === opcoes.semNota) continue;
      const origem = deOnde(n.tarefaIds ?? [], "Folha");
      if (origem) daTarefa.push({ chave: `nota:${n.id}`, tipo: "nota", titulo: nomeDaFolha(n), href: hrefInterno("nota", n.id), daTarefa: true, dica: origem, palavras: "folha nota bloco" });
    }
  }
  return [...daTarefa, ...outros];
}

/**
 * O que foi digitado depois do "#" quando o usuário quer guardar um link novo: um endereço vira o endereço do
 * formulário, o resto vira o título. "www.exemplo.local/x" ganha o https, como no formulário de link.
 */
export function linkDoDigitado(digitado: string): { titulo: string; url: string } {
  const t = (digitado || "").trim().slice(0, 2000);
  if (/^https?:\/\/\S+$/i.test(t) && linkPermitido(t)) return { titulo: "", url: t };
  if (/^www\.[^\s/]+\.\S+$/i.test(t)) return { titulo: "", url: `https://${t}` };
  return { titulo: t.slice(0, 200), url: "" };
}
