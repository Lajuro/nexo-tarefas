// Páginas de conhecimento como documentação: árvore (página dentro de página), ordem de leitura, sumário de
// cada página, busca dentro da documentação e modelos de página. Funções puras sobre a lista de páginas:
// nada aqui grava, e uma árvore estranha nos dados (mãe que sumiu, ciclo) nunca faz uma página desaparecer.

import { type Bloco, analisarMarkdown, paraTextoPlano, textoDosInlines } from "./texto-rico";
import { type EstadoPagina, type Pagina, agoraISO, normalizarPagina, novoId, semAcento } from "./tipos";

/** Ícones que uma página pode ter. A tela liga cada chave a um ícone (components/paginas/pecas.tsx). */
export const ICONES_DE_PAGINA = [
  "arquivo", "livro", "pasta", "processo", "lista", "video", "chave", "escudo", "bug", "terminal", "nuvem", "banco",
  "grafico", "lampada", "estrela", "bandeira", "alvo", "calendario", "pessoas", "conversa", "ferramenta", "foguete",
  "mapa", "cadeado", "olho", "codigo", "link", "raio", "casa", "duvida", "caixa", "cerebro",
] as const;
export type IconeDePagina = (typeof ICONES_DE_PAGINA)[number];

export const nomeDaPagina = (p: Pick<Pagina, "titulo" | "texto">) =>
  p.titulo.trim() || paraTextoPlano(p.texto).split("\n")[0].slice(0, 80) || "Página sem título";

// ---------- árvore ----------

export interface NoDePagina {
  pagina: Pagina;
  filhos: NoDePagina[];
  nivel: number;
}

const porOrdem = (a: Pagina, b: Pagina) => (a.ordem ?? 0) - (b.ordem ?? 0) || nomeDaPagina(a).localeCompare(nomeDaPagina(b), "pt-BR") || a.id.localeCompare(b.id);

/** A mãe de verdade de cada página: null se não tem, se a mãe não está na lista ou se seguir as mães dá num ciclo. */
function maes(paginas: Pagina[]): Map<string, string | null> {
  const porId = new Map(paginas.map((p) => [p.id, p]));
  const out = new Map<string, string | null>();
  for (const p of paginas) {
    let mae = p.paiId && porId.has(p.paiId) && p.paiId !== p.id ? p.paiId : null;
    // sobe até a raiz: se voltar à própria página, é um ciclo e ela vira raiz
    const vistos = new Set([p.id]);
    let cursor = mae;
    while (cursor) {
      if (vistos.has(cursor)) { mae = null; break; }
      vistos.add(cursor);
      const acima = porId.get(cursor)?.paiId;
      cursor = acima && porId.has(acima) ? acima : null;
    }
    out.set(p.id, mae);
  }
  return out;
}

/** As páginas em árvore. Toda página da lista aparece exatamente uma vez. */
export function montarArvore(paginas: Pagina[]): NoDePagina[] {
  const mae = maes(paginas);
  const filhosDe = new Map<string | null, Pagina[]>();
  for (const p of paginas) {
    const k = mae.get(p.id) ?? null;
    const lista = filhosDe.get(k);
    if (lista) lista.push(p);
    else filhosDe.set(k, [p]);
  }
  const montar = (k: string | null, nivel: number): NoDePagina[] =>
    (filhosDe.get(k) ?? []).sort(porOrdem).map((pagina) => ({ pagina, nivel, filhos: montar(pagina.id, nivel + 1) }));
  return montar(null, 0);
}

/** A árvore achatada, na ordem em que se lê a documentação (mãe, depois as filhas). */
export function emOrdemDeLeitura(arvore: NoDePagina[]): NoDePagina[] {
  const out: NoDePagina[] = [];
  const andar = (nos: NoDePagina[]) => {
    for (const n of nos) {
      out.push(n);
      andar(n.filhos);
    }
  };
  andar(arvore);
  return out;
}

/** As ancestrais de uma página, da raiz até a mãe (sem a própria). */
export function caminhoDaPagina(paginas: Pagina[], id: string): Pagina[] {
  const porId = new Map(paginas.map((p) => [p.id, p]));
  const mae = maes(paginas);
  const out: Pagina[] = [];
  let cursor = mae.get(id) ?? null;
  while (cursor) {
    const p = porId.get(cursor);
    if (!p) break;
    out.unshift(p);
    cursor = mae.get(cursor) ?? null;
  }
  return out;
}

/** Ids de tudo o que está abaixo de uma página. */
export function descendentes(paginas: Pagina[], id: string): Set<string> {
  const mae = maes(paginas);
  const out = new Set<string>();
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const p of paginas) {
      const m = mae.get(p.id);
      if (m && !out.has(p.id) && (m === id || out.has(m))) {
        out.add(p.id);
        mudou = true;
      }
    }
  }
  return out;
}

/** A anterior e a próxima na ordem de leitura, só entre as páginas dadas (as ativas, em geral). */
export function vizinhas(paginas: Pagina[], id: string): { anterior: Pagina | null; proxima: Pagina | null } {
  const ordem = emOrdemDeLeitura(montarArvore(paginas)).map((n) => n.pagina);
  const i = ordem.findIndex((p) => p.id === id);
  return { anterior: i > 0 ? ordem[i - 1] : null, proxima: i >= 0 && i < ordem.length - 1 ? ordem[i + 1] : null };
}

/**
 * Move uma página para dentro de outra (ou para a raiz, com `novaMae` null), antes de `antesDe` ou no fim.
 * Devolve a lista com `paiId` e `ordem` acertados, ou a mesma lista se o movimento não vale (para dentro de si
 * mesma ou de uma descendente).
 */
export function moverPagina(paginas: Pagina[], id: string, novaMae: string | null, antesDe: string | null = null): Pagina[] {
  if (!paginas.some((p) => p.id === id)) return paginas;
  if (novaMae && (novaMae === id || !paginas.some((p) => p.id === novaMae) || descendentes(paginas, id).has(novaMae))) return paginas;
  if (antesDe === id) return paginas;
  const mae = maes(paginas);
  const agora = agoraISO();
  // as irmãs no destino, na ordem em que aparecem hoje, sem a página que está sendo movida
  const irmas = paginas.filter((p) => p.id !== id && (mae.get(p.id) ?? null) === novaMae).sort(porOrdem).map((p) => p.id);
  const onde = antesDe ? irmas.indexOf(antesDe) : -1;
  irmas.splice(onde < 0 ? irmas.length : onde, 0, id);
  const posicao = new Map(irmas.map((x, i) => [x, i]));
  return paginas.map((p) => {
    if (!posicao.has(p.id)) return p;
    const ordem = posicao.get(p.id)!;
    if (p.id === id) return { ...p, paiId: novaMae, ordem, atualizadaEm: p.paiId === novaMae ? p.atualizadaEm : agora };
    return (p.ordem ?? 0) === ordem ? p : { ...p, ordem };
  });
}

/** Tira uma página da lista; as filhas dela sobem para a mãe dela (nunca ficam órfãs nem somem). */
export function semPagina(paginas: Pagina[], id: string): Pagina[] {
  const alvo = paginas.find((p) => p.id === id);
  if (!alvo) return paginas;
  const acima = maes(paginas).get(id) ?? null;
  return paginas.filter((p) => p.id !== id).map((p) => (p.paiId === id ? { ...p, paiId: acima } : p));
}

/** Página nova, pronta para gravar. */
export function paginaNova(parte: Partial<Pagina> = {}): Pagina {
  const agora = agoraISO();
  return normalizarPagina({ id: novoId("pg"), titulo: "", texto: "", criadaEm: agora, atualizadaEm: agora, ...parte });
}

/** Cópia de uma página (sem as filhas), ao lado da original. */
export function duplicarPagina(p: Pagina): Pagina {
  return paginaNova({ ...p, id: novoId("pg"), titulo: `${nomeDaPagina(p)} (cópia)`, ordem: (p.ordem ?? 0) + 0.5, fixada: false, arquivadaEm: null, estado: "rascunho" });
}

// ---------- sumário de uma página ----------

export interface ItemDoSumario {
  nivel: 1 | 2 | 3;
  texto: string;
  /** Âncora única dentro da página ("como-pedir", "como-pedir-2"). */
  id: string;
  /** Posição entre os títulos da página (para achar o elemento na tela). */
  indice: number;
}

/** Texto → âncora: sem acento, sem símbolo, com hífen. */
export function ancora(texto: string): string {
  return semAcento(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "secao";
}

const TITULO = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const CERCA = /^ {0,3}(```|~~~)/;

/**
 * Os títulos de um texto já lido, na ordem. Só os de primeiro nível do documento (título dentro de citação ou de
 * lista não entra): é o que a tela consegue achar pela posição, tanto no leitor quanto no editor.
 */
export function sumarioDosBlocos(blocos: Bloco[]): ItemDoSumario[] {
  const out: ItemDoSumario[] = [];
  const usadas = new Map<string, number>();
  for (const b of blocos) {
    if (b.t !== "titulo") continue;
    const texto = textoDosInlines(b.f).replace(/\s+/g, " ").trim() || "Sem título";
    const base = ancora(texto);
    const n = (usadas.get(base) ?? 0) + 1;
    usadas.set(base, n);
    out.push({ nivel: b.nivel, texto, id: n === 1 ? base : `${base}-${n}`, indice: out.length });
  }
  return out;
}

/** Os títulos de um texto em Markdown, na ordem. */
export const sumarioDoMarkdown = (md: string): ItemDoSumario[] => sumarioDosBlocos(analisarMarkdown(md || ""));

/** Palavras do texto (sem marcação) e minutos de leitura, a 200 palavras por minuto. */
export function tamanhoDaLeitura(md: string): { palavras: number; minutos: number } {
  const palavras = (paraTextoPlano(md).match(/\S+/g) ?? []).length;
  return { palavras, minutos: palavras ? Math.max(1, Math.round(palavras / 200)) : 0 };
}

// ---------- busca dentro da documentação ----------

export interface TrechoAchado {
  /** Título da seção em que o trecho está (null = antes do primeiro título). */
  secao: string | null;
  /** Posição do título da seção no sumário da página (-1 = antes do primeiro título). */
  indiceDoTitulo: number;
  trecho: string;
}

export interface PaginaAchada {
  pagina: Pagina;
  /** As palavras estão no título? */
  noTitulo: boolean;
  trechos: TrechoAchado[];
  pontos: number;
}

const palavrasDaBusca = (termo: string) => [...new Set(semAcento(termo).split(/\s+/).filter(Boolean))].slice(0, 8);

function recorte(texto: string, palavras: string[], raio = 70): string {
  const n = semAcento(texto);
  const i = Math.min(...palavras.map((w) => n.indexOf(w)).filter((x) => x >= 0));
  if (!Number.isFinite(i)) return texto.slice(0, raio * 2);
  const de = Math.max(0, i - raio);
  const ate = Math.min(texto.length, i + raio * 1.6);
  return `${de > 0 ? "..." : ""}${texto.slice(de, ate).trim()}${ate < texto.length ? "..." : ""}`;
}

// O texto de cada página, partido em seções, fica guardado por página (o objeto só muda quando ela é regravada).
interface SecaoDeTexto { titulo: string | null; indice: number; texto: string; normal: string }
const secoesGuardadas = new WeakMap<Pagina, SecaoDeTexto[]>();
function secoesDaPagina(p: Pagina): SecaoDeTexto[] {
  let s = secoesGuardadas.get(p);
  if (s) return s;
  s = [];
  let atual: { titulo: string | null; indice: number; linhas: string[] } = { titulo: null, indice: -1, linhas: [] };
  const fechar = () => {
    const texto = paraTextoPlano(atual.linhas.join("\n")).replace(/\n+/g, " ");
    if (texto || atual.titulo) s!.push({ titulo: atual.titulo, indice: atual.indice, texto, normal: semAcento(`${atual.titulo ?? ""} ${texto}`) });
  };
  let emCodigo = false;
  let indice = -1;
  for (const linha of (p.texto || "").replace(/\r\n?/g, "\n").split("\n")) {
    if (CERCA.test(linha)) emCodigo = !emCodigo;
    const m = !emCodigo ? TITULO.exec(linha) : null;
    const titulo = m ? paraTextoPlano(m[2]).trim() : "";
    if (m && titulo) {
      fechar();
      indice++;
      atual = { titulo, indice, linhas: [] };
    } else atual.linhas.push(linha);
  }
  fechar();
  secoesGuardadas.set(p, s);
  return s;
}

/**
 * Procura nas páginas. Com várias palavras, a página precisa ter todas (no título, nas tags ou no texto);
 * os trechos mostram as seções em que elas aparecem. Sem acento nem maiúscula.
 */
export function buscarNasPaginas(paginas: Pagina[], termo: string, maxTrechos = 3): PaginaAchada[] {
  const palavras = palavrasDaBusca(termo);
  if (!palavras.length) return [];
  const out: PaginaAchada[] = [];
  for (const p of paginas) {
    const titulo = semAcento(`${nomeDaPagina(p)} ${p.tags.join(" ")}`);
    const secoes = secoesDaPagina(p);
    const tudo = `${titulo} ${secoes.map((s) => s.normal).join(" ")}`;
    if (!palavras.every((w) => tudo.includes(w))) continue;
    const noTitulo = palavras.every((w) => titulo.includes(w));
    const comPontos = secoes
      .map((s) => ({ s, n: palavras.filter((w) => s.normal.includes(w)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || a.s.indice - b.s.indice);
    const trechos = comPontos.slice(0, maxTrechos).sort((a, b) => a.s.indice - b.s.indice).map(({ s }) => ({
      secao: s.titulo,
      indiceDoTitulo: s.indice,
      trecho: recorte(s.texto || s.titulo || "", palavras),
    }));
    out.push({ pagina: p, noTitulo, trechos, pontos: (noTitulo ? 100 : 0) + palavras.filter((w) => titulo.includes(w)).length * 10 + comPontos.length });
  }
  return out.sort((a, b) => b.pontos - a.pontos || b.pagina.atualizadaEm.localeCompare(a.pagina.atualizadaEm));
}

// ---------- modelos de página ----------

export interface ModeloDePagina {
  id: string;
  nome: string;
  descricao: string;
  icone: IconeDePagina;
  /** Título sugerido ("..." é o que o usuário troca). */
  titulo: string;
  texto: string;
  /** "video": a página nasce como página de vídeo. */
  tipo?: "video";
}

export const MODELOS_DE_PAGINA: ModeloDePagina[] = [
  { id: "branco", nome: "Em branco", descricao: "Só o título e o cursor.", icone: "arquivo", titulo: "", texto: "" },
  {
    id: "video", nome: "Página de vídeo", descricao: "Um vídeo com player, transcrição sincronizada e anotações.", icone: "video", titulo: "", tipo: "video",
    texto: "## Do que se trata\n\n\n## Pontos principais\n\n- \n\n## O que fazer com isso\n\n- [ ] ",
  },
  {
    id: "processo", nome: "Processo", descricao: "Como algo funciona, do pedido à entrega.", icone: "processo", titulo: "Como funciona ...",
    texto: "> [!NOTA] Para que serve\n> Em uma frase: o que este processo resolve e para quem.\n\n## Quando usar\n\n- \n\n## Quem participa\n\n| Papel | Quem | O que faz |\n| --- | --- | --- |\n|  |  |  |\n\n## Passo a passo\n\n1. \n2. \n3. \n\n## Prazos e exceções\n\n> [!ATENCAO] Atenção\n> O que costuma dar errado e como evitar.\n\n## Onde está cada coisa\n\n- ",
  },
  {
    id: "guia", nome: "Guia passo a passo", descricao: "Um tutorial para repetir sem pensar.", icone: "lista", titulo: "Como fazer ...",
    texto: "## Antes de começar\n\n- [ ] Acesso necessário:\n- [ ] Ferramenta instalada:\n\n## Passos\n\n### 1. \n\n### 2. \n\n### 3. \n\n## Como saber se deu certo\n\n> [!SUCESSO] Resultado esperado\n> \n\n## Se der errado\n\n> [!DICA] Dica\n> ",
  },
  {
    id: "runbook", nome: "Runbook", descricao: "O que fazer quando o alerta toca.", icone: "terminal", titulo: "Runbook: ...",
    texto: "> [!PERIGO] Impacto\n> O que para de funcionar e quem é afetado.\n\n## Sintomas\n\n- \n\n## Diagnóstico\n\n```bash\n# comando para conferir\n```\n\n## Correção\n\n1. \n\n## Quem acionar\n\n| Situação | Pessoa ou time | Como |\n| --- | --- | --- |\n|  |  |  |\n\n## Depois do incidente\n\n- [ ] Registrar o que aconteceu na tarefa\n- [ ] Atualizar este runbook",
  },
  {
    id: "decisao", nome: "Registro de decisão", descricao: "Por que escolhemos isto e o que ficou de fora.", icone: "bandeira", titulo: "Decisão: ...",
    texto: "## Contexto\n\nO que estava acontecendo e por que foi preciso decidir.\n\n## Decisão\n\n> [!IMPORTANTE] O que foi decidido\n> \n\n## Alternativas consideradas\n\n| Alternativa | A favor | Contra |\n| --- | --- | --- |\n|  |  |  |\n\n## Consequências\n\n- \n\n## Quem decidiu e quando\n\n- ",
  },
  {
    id: "faq", nome: "Perguntas frequentes", descricao: "As dúvidas que sempre voltam, com a resposta.", icone: "duvida", titulo: "Perguntas frequentes sobre ...",
    texto: "> [!PERGUNTA]- Primeira pergunta?\n> Resposta.\n\n> [!PERGUNTA]- Segunda pergunta?\n> Resposta.\n\n> [!PERGUNTA]- Terceira pergunta?\n> Resposta.",
  },
  {
    id: "glossario", nome: "Glossário", descricao: "Siglas e termos do assunto.", icone: "livro", titulo: "Glossário de ...",
    texto: "| Termo | O que é | Onde aparece |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n|  |  |  |",
  },
];

/** Uma página nova a partir de um modelo. */
export function paginaDoModelo(modeloId: string, parte: Partial<Pagina> = {}): Pagina {
  const m = MODELOS_DE_PAGINA.find((x) => x.id === modeloId) ?? MODELOS_DE_PAGINA[0];
  return paginaNova({ titulo: m.titulo, texto: m.texto, icone: m.icone === "arquivo" || m.tipo === "video" ? "" : m.icone, ...(m.tipo === "video" ? { tipo: "video" as const, video: {} } : {}), ...parte });
}

// ---------- quadro (páginas por estado) ----------

export const porEstado = (paginas: Pagina[], estado: EstadoPagina) =>
  paginas.filter((p) => (p.estado ?? "rascunho") === estado).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm));
