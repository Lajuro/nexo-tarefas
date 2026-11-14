// Texto rico do Nexo: os campos de texto longo (folha do bloco de notas, anotações do registro) guardam
// **Markdown**. Continua sendo texto puro dentro do JSON, então versões antigas do app abrem sem perder nada,
// o espelho em .md fica nativo e os prompts do Copilot recebem o texto como ele é.
//
// Este arquivo transforma Markdown numa árvore própria, já saneada, que a tela só precisa desenhar
// (components/tarefa/Texto.tsx). O texto pode ter vindo de qualquer lugar (colado do Copilot, de um e-mail,
// de uma página): é entrada não confiável. Por isso:
//   - HTML nunca é interpretado: aparece como texto, do jeito que foi escrito;
//   - imagem só carrega se for um anexo da pasta de dados ("arquivos/AAAA/nome"). Imagem de fora não é
//     buscada (seria uma chamada externa e um jeito de rastrear a leitura): vira texto;
//   - link só com http, https ou mailto. O resto perde o endereço e fica só o texto.
// Nada daqui usa innerHTML.

import { marked, type Token, type Tokens } from "marked";

export type Inline =
  | { t: "texto"; v: string }
  | { t: "negrito" | "italico" | "riscado"; f: Inline[] }
  | { t: "codigo"; v: string }
  | { t: "quebra" }
  | { t: "link"; href: string; f: Inline[] }
  | { t: "interno"; tipo: TipoDeAlvo; alvo: string; rota: string; f: Inline[] }
  | { t: "imagem"; url: string; alt: string };

export type Bloco =
  | { t: "paragrafo"; f: Inline[] }
  | { t: "titulo"; nivel: 1 | 2 | 3; f: Inline[] }
  | { t: "lista"; ordenada: boolean; inicio: number; itens: { tarefa: boolean; feito: boolean; f: Bloco[] }[] }
  | { t: "citacao"; f: Bloco[] }
  | { t: "codigo"; v: string; lang: string }
  | { t: "divisor" }
  | { t: "tabela"; cabecalho: { f: Inline[]; alinhar: "left" | "center" | "right" | null }[]; linhas: Inline[][][] };

const MAX_TEXTO = 300_000;
const MAX_NIVEL = 12;

// ---------- imagens: só anexos da pasta de dados ----------

const ANEXO = /^arquivos\/(\d{4}\/[^/\\?#]+)$/;

/** Endereço que vai para o Markdown quando uma imagem é anexada: "arquivos/2026/abc-print.png" (espaços viram %20). */
export function srcDoAnexo(relativo: string): string {
  return "arquivos/" + relativo.split("/").map(encodeURIComponent).join("/");
}

/** Caminho relativo dentro de arquivos/ ("2026/abc-print.png"), ou null se o endereço não é um anexo válido. */
export function anexoDoSrc(src: string): string | null {
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(src.trim());
  } catch {
    return null;
  }
  const m = ANEXO.exec(decodificado);
  if (!m || m[1].includes("..")) return null;
  return m[1];
}

/** De onde o navegador carrega a imagem. null = não é um anexo nosso, então não carrega. */
export function urlDaImagem(src: string): string | null {
  const rel = anexoDoSrc(src);
  return rel ? `/api/arquivos?p=${encodeURIComponent(rel)}` : null;
}

// ---------- links ----------

/** Só http, https e mailto. Devolve o endereço limpo ou null. */
export function linkPermitido(href: string): string | null {
  const h = (href || "").trim();
  if (!/^(https?:\/\/|mailto:)/i.test(h) || /[\u0000-\u001f\s]/.test(h)) return null;
  return h;
}

// ---------- links internos (citar uma tarefa, uma página, uma pessoa ou uma categoria) ----------

export type TipoDeAlvo = "tarefa" | "pagina" | "pessoa" | "categoria";
const INTERNO = /^nexo:(tarefa|pagina|categoria)\/([a-zA-Z0-9_-]{1,80})$/;
const INTERNO_PESSOA = /^nexo:pessoa\/([^/?#\s]{1,300})$/;

/** Endereço que vai para o Markdown quando algo é citado: "nexo:tarefa/<id>", "nexo:pessoa/<nome codificado>". */
export function hrefInterno(tipo: TipoDeAlvo, alvo: string): string {
  return `nexo:${tipo}/${tipo === "pessoa" ? encodeURIComponent(alvo.trim()) : alvo}`;
}

/** Lê um link interno. Devolve para onde ele leva dentro do app, ou null se não for um link interno válido. */
export function linkInterno(href: string): { tipo: TipoDeAlvo; alvo: string; rota: string } | null {
  const h = (href || "").trim();
  const m = INTERNO.exec(h);
  if (m) {
    const tipo = m[1] as TipoDeAlvo;
    const rota = tipo === "tarefa" ? `/tarefas/${m[2]}` : tipo === "pagina" ? `/paginas?p=${m[2]}` : `/categorias/${m[2]}`;
    return { tipo, alvo: m[2], rota };
  }
  const p = INTERNO_PESSOA.exec(h);
  if (!p) return null;
  try {
    const nome = decodeURIComponent(p[1]).trim();
    return nome ? { tipo: "pessoa", alvo: nome, rota: `/pessoas?p=${encodeURIComponent(nome)}` } : null;
  } catch {
    return null;
  }
}

// ---------- entidades ----------

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** O Markdown gravado pelo editor escreve "<" como "&lt;" (para não virar HTML ao reler). Aqui volta a ser "<". */
export function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (tudo, e: string) => {
    if (e[0] !== "#") return ENTIDADES[e.toLowerCase()] ?? tudo;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : tudo;
  });
}

// ---------- Markdown → árvore ----------

const texto = (v: string): Inline => ({ t: "texto", v });

function inlines(tokens: Token[] | undefined, nivel: number): Inline[] {
  if (!tokens || nivel > MAX_NIVEL) return [];
  const out: Inline[] = [];
  for (const tk of tokens) {
    switch (tk.type) {
      case "text": {
        const x = tk as Tokens.Text;
        if (x.tokens?.length) out.push(...inlines(x.tokens, nivel + 1));
        else out.push(texto(decodificarEntidades(x.text)));
        break;
      }
      case "escape":
        out.push(texto((tk as Tokens.Escape).text));
        break;
      case "strong":
        out.push({ t: "negrito", f: inlines((tk as Tokens.Strong).tokens, nivel + 1) });
        break;
      case "em":
        out.push({ t: "italico", f: inlines((tk as Tokens.Em).tokens, nivel + 1) });
        break;
      case "del":
        out.push({ t: "riscado", f: inlines((tk as Tokens.Del).tokens, nivel + 1) });
        break;
      case "codespan":
        out.push({ t: "codigo", v: decodificarEntidades((tk as Tokens.Codespan).text) });
        break;
      case "br":
        out.push({ t: "quebra" });
        break;
      case "link": {
        const l = tk as Tokens.Link;
        const href = linkPermitido(l.href);
        const filhos = inlines(l.tokens, nivel + 1);
        const interno = linkInterno(l.href);
        if (interno) out.push({ t: "interno", ...interno, f: filhos });
        else if (href) out.push({ t: "link", href, f: filhos });
        else out.push(...filhos); // endereço proibido (javascript:, arquivo local...): fica só o texto
        break;
      }
      case "image": {
        const i = tk as Tokens.Image;
        const url = urlDaImagem(i.href);
        if (url) out.push({ t: "imagem", url, alt: decodificarEntidades(i.text || "") });
        // imagem de fora não é carregada: o que foi escrito aparece como texto, para nada sumir em silêncio
        else out.push(texto(i.raw));
        break;
      }
      case "html":
        // HTML não é interpretado em hipótese nenhuma
        out.push(texto((tk as Tokens.HTML).raw));
        break;
      default:
        if ("raw" in tk && typeof tk.raw === "string") out.push(texto(tk.raw));
    }
  }
  return out;
}

function blocos(tokens: Token[] | undefined, nivel: number): Bloco[] {
  if (!tokens || nivel > MAX_NIVEL) return [];
  const out: Bloco[] = [];
  for (const tk of tokens) {
    switch (tk.type) {
      case "space":
        break;
      case "paragraph":
        out.push({ t: "paragrafo", f: inlines((tk as Tokens.Paragraph).tokens, nivel + 1) });
        break;
      case "text": {
        // texto solto dentro de item de lista
        const x = tk as Tokens.Text;
        out.push({ t: "paragrafo", f: x.tokens?.length ? inlines(x.tokens, nivel + 1) : [texto(decodificarEntidades(x.text))] });
        break;
      }
      case "heading": {
        const h = tk as Tokens.Heading;
        out.push({ t: "titulo", nivel: Math.min(3, Math.max(1, h.depth)) as 1 | 2 | 3, f: inlines(h.tokens, nivel + 1) });
        break;
      }
      case "list": {
        const l = tk as Tokens.List;
        out.push({
          t: "lista",
          ordenada: !!l.ordered,
          inicio: typeof l.start === "number" && Number.isFinite(l.start) ? l.start : 1,
          itens: l.items.map((it) => ({
            tarefa: !!it.task,
            feito: !!it.checked,
            f: blocos(it.tokens.filter((x) => (x as { type: string }).type !== "checkbox"), nivel + 1),
          })),
        });
        break;
      }
      case "blockquote":
        out.push({ t: "citacao", f: blocos((tk as Tokens.Blockquote).tokens, nivel + 1) });
        break;
      case "code": {
        const c = tk as Tokens.Code;
        out.push({ t: "codigo", v: c.text, lang: (c.lang || "").replace(/[^a-zA-Z0-9+#_-]/g, "").slice(0, 20) });
        break;
      }
      case "hr":
        out.push({ t: "divisor" });
        break;
      case "table": {
        const tb = tk as Tokens.Table;
        out.push({
          t: "tabela",
          cabecalho: tb.header.map((c) => ({ f: inlines(c.tokens, nivel + 1), alinhar: c.align ?? null })),
          linhas: tb.rows.map((linha) => linha.map((c) => inlines(c.tokens, nivel + 1))),
        });
        break;
      }
      case "html":
        out.push({ t: "paragrafo", f: [texto((tk as Tokens.HTML).raw.replace(/\s+$/, ""))] });
        break;
      default:
        if ("raw" in tk && typeof tk.raw === "string" && tk.raw.trim()) out.push({ t: "paragrafo", f: [texto(tk.raw)] });
    }
  }
  return out;
}

/** Markdown → blocos prontos para desenhar. Uma quebra de linha simples conta como quebra (o texto antigo era texto puro). */
export function analisarMarkdown(md: string): Bloco[] {
  const fonte = (md || "").replace(/\r\n?/g, "\n").slice(0, MAX_TEXTO);
  if (!fonte.trim()) return [];
  try {
    return blocos(marked.lexer(fonte, { gfm: true, breaks: true }), 0);
  } catch {
    // se o leitor de Markdown tropeçar em algo estranho, o texto aparece como foi escrito
    return [{ t: "paragrafo", f: [texto(fonte)] }];
  }
}

// ---------- Markdown → texto simples (trechos de busca, resumos de uma linha) ----------

/** O texto de um trecho já lido (título, célula), sem a marcação. */
export function textoDosInlines(f: Inline[]): string {
  return f
    .map((i) => {
      switch (i.t) {
        case "texto":
        case "codigo":
          return i.v;
        case "quebra":
          return " ";
        case "imagem":
          return i.alt ? `[imagem: ${i.alt}]` : "[imagem]";
        default:
          return textoDosInlines(i.f);
      }
    })
    .join("");
}

function textoDosBlocos(bs: Bloco[]): string[] {
  const out: string[] = [];
  for (const b of bs) {
    switch (b.t) {
      case "paragrafo":
      case "titulo":
        out.push(textoDosInlines(b.f));
        break;
      case "lista":
        for (const it of b.itens) out.push(...textoDosBlocos(it.f));
        break;
      case "citacao":
        out.push(...textoDosBlocos(b.f));
        break;
      case "codigo":
        out.push(b.v);
        break;
      case "tabela":
        out.push(b.cabecalho.map((c) => textoDosInlines(c.f)).join(" · "));
        for (const l of b.linhas) out.push(l.map(textoDosInlines).join(" · "));
        break;
    }
  }
  return out;
}

/** O caminho completo: lê o Markdown e junta o texto de cada bloco. É o que define o resultado certo. */
export function paraTextoPlanoPeloLeitor(md: string): string {
  return textoDosBlocos(analisarMarkdown(md)).map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

// Qualquer caractere ou começo de linha que o Markdown trate de forma especial. Texto sem nada disso
// (a maior parte das anotações antigas, digitadas como texto puro) sai igual pelo leitor, só que bem mais devagar.
const TEM_MARCACAO = /[*_`~[\]<>&\\#|!=]|^[ \t]*(?:[-+]|\d+[.)])(?:[ \t]|$)|^(?: {4}|\t)|^[ \t]*-{2,}[ \t]*$|:\/\/|www\.|@/m;

/** O texto sem a marcação: sem asteriscos, barras de escape, "&lt;" nem endereço de imagem. Um bloco por linha. */
export function paraTextoPlano(md: string): string {
  if (!md) return "";
  // sem marcação: cada parágrafo (separado por linha em branco) vira uma linha, como no leitor
  if (!TEM_MARCACAO.test(md)) return md.split(/\n[ \t\r]*\n/).map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return paraTextoPlanoPeloLeitor(md);
}

/** Há alguma imagem anexada neste texto? */
export const temImagem = (md: string) => /!\[[^\]]*\]\(arquivos\//.test(md || "");
