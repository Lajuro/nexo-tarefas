// Ler o texto de um documento do Word (.docx) e de uma apresentação do PowerPoint (.pptx) para mostrar
// dentro do app (3.15). Funções puras.
//
// Os dois são ZIPs com XML. O que sai daqui é só o TEXTO, na ordem em que aparece: títulos, parágrafos,
// itens de lista e tabelas no Word; o título e as linhas de cada slide no PowerPoint. Formatação, imagens,
// cabeçalho, rodapé, comentários e revisões ficam de fora: é uma leitura rápida, não o documento fiel.
// Para ver com a cara original, o caminho continua sendo baixar e abrir no Office.
//
// Entrada não confiável: tudo é devolvido como texto (a tela desenha como texto) e há teto de blocos.

import { atributoXml, desescaparXml, lerZip, textoDoZip } from "./zip";

export type BlocoDoDocumento =
  | { t: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { t: "paragrafo"; texto: string }
  | { t: "item"; nivel: number; texto: string }
  | { t: "tabela"; linhas: string[][] };

export interface Documento {
  blocos: BlocoDoDocumento[];
  /** O documento tinha mais blocos do que o teto. */
  cortado: boolean;
}

export interface Slide {
  numero: number;
  titulo: string;
  linhas: string[];
}

export interface Apresentacao {
  slides: Slide[];
}

export const MAX_BLOCOS = 8000;
const MAX_SLIDES = 500;

// ---------- Word ----------

/** O texto de um parágrafo do Word: junta os trechos, com tabulação e quebra de linha onde o documento tem. */
function textoDoParagrafo(xml: string): string {
  let s = "";
  for (const m of xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<w:noBreakHyphen\b[^>]*\/>/g)) {
    if (m[1] !== undefined) s += m[1];
    else if (m[0].startsWith("<w:tab")) s += "\t";
    else if (m[0].startsWith("<w:no")) s += "-";
    else s += "\n";
  }
  return desescaparXml(s);
}

/** Nível do título pelo nome do estilo ("Heading1", "Ttulo2", "Title"), ou 0 se é parágrafo comum. */
function nivelDoTitulo(paragrafo: string): 0 | 1 | 2 | 3 {
  const estilo = /<w:pStyle\b[^>]*\bw:val="([^"]*)"/.exec(paragrafo)?.[1] ?? "";
  if (/^(title|ttulo|titulo)$/i.test(estilo)) return 1;
  const m = /^(?:heading|ttulo|titulo|berschrift|titre)\s*([1-9])$/i.exec(estilo);
  if (!m) return 0;
  return Math.min(3, Number(m[1])) as 1 | 2 | 3;
}

/** Os blocos de "word/document.xml", na ordem. */
export function blocosDoWord(xml: string): Documento {
  const corpo = /<w:body\b[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const blocos: BlocoDoDocumento[] = [];
  // tabelas: pilha, porque uma célula pode ter outra tabela dentro (o texto dela entra na célula de fora)
  const tabelas: { linhas: string[][]; linha: string[] | null; celula: string[] | null }[] = [];
  let cortado = false;
  const marcas = /<w:tbl>|<w:tbl\s[^>]*>|<\/w:tbl>|<w:tr(?:\s[^>]*)?>|<\/w:tr>|<w:tc(?:\s[^>]*)?>|<\/w:tc>|<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  for (const m of corpo.matchAll(marcas)) {
    const x = m[0];
    const topo = tabelas[tabelas.length - 1];
    if (x.startsWith("<w:tbl")) tabelas.push({ linhas: [], linha: null, celula: null });
    else if (x === "</w:tbl>") {
      const t = tabelas.pop();
      if (!t) continue;
      const fora = tabelas[tabelas.length - 1];
      if (fora?.celula) fora.celula.push(t.linhas.map((l) => l.join(" | ")).join("\n"));
      else if (t.linhas.length) blocos.push({ t: "tabela", linhas: t.linhas });
    } else if (x.startsWith("<w:tr")) { if (topo) topo.linha = []; }
    else if (x === "</w:tr>") { if (topo?.linha) { topo.linhas.push(topo.linha); topo.linha = null; } }
    else if (x.startsWith("<w:tc")) { if (topo) topo.celula = []; }
    else if (x === "</w:tc>") { if (topo?.linha && topo.celula) { topo.linha.push(topo.celula.filter(Boolean).join("\n")); topo.celula = null; } }
    else {
      const texto = textoDoParagrafo(x).replace(/[ \t]+$/gm, "");
      if (topo?.celula) { topo.celula.push(texto); continue; }
      if (!texto.trim()) continue;
      const nivel = nivelDoTitulo(x);
      if (nivel) blocos.push({ t: "titulo", nivel, texto: texto.trim() });
      else if (/<w:numPr\b/.test(x)) blocos.push({ t: "item", nivel: Math.min(8, Number(/<w:ilvl\b[^>]*\bw:val="(\d+)"/.exec(x)?.[1] ?? 0)), texto: texto.trim() });
      else blocos.push({ t: "paragrafo", texto });
    }
    if (blocos.length >= MAX_BLOCOS) {
      cortado = true;
      break;
    }
  }
  return { blocos, cortado };
}

/** Lê um .docx (os bytes do arquivo). */
export async function lerDocx(bytes: Uint8Array): Promise<Documento> {
  let xml: string | null;
  try {
    xml = await textoDoZip(bytes, lerZip(bytes), "word/document.xml");
  } catch (e) {
    if (e instanceof Error && /senha|grande demais/.test(e.message)) throw e;
    throw new Error("Este arquivo não é um documento do Word no formato novo (.docx). Se for um .doc antigo, salve como .docx para ver aqui.");
  }
  if (!xml) throw new Error("Este arquivo não é um documento do Word (.docx): não achei o texto dentro dele.");
  return blocosDoWord(xml);
}

/** O documento inteiro como texto simples (para copiar). */
export function documentoComoTexto(d: Documento): string {
  return d.blocos
    .map((b) => (b.t === "tabela" ? b.linhas.map((l) => l.map((c) => c.replace(/\s*\n\s*/g, " ")).join("\t")).join("\n") : b.t === "item" ? `${"  ".repeat(b.nivel)}- ${b.texto}` : b.texto))
    .join("\n\n");
}

// ---------- PowerPoint ----------

/** As linhas de texto de um trecho de slide: um parágrafo (<a:p>) por linha. */
function linhasDoSlide(xml: string): string[] {
  const out: string[] = [];
  for (const p of xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    let s = "";
    for (const m of p[1].matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>/g)) s += m[1] !== undefined ? m[1] : " ";
    const texto = desescaparXml(s).replace(/\s+/g, " ").trim();
    if (texto) out.push(texto);
  }
  return out;
}

/** O texto de um "slideN.xml": o título (a caixa marcada como título) e as outras linhas. */
export function textoDoSlide(xml: string, numero: number): Slide {
  let titulo = "";
  const linhas: string[] = [];
  for (const forma of xml.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/g)) {
    const doTitulo = /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/.test(forma[1]);
    const texto = linhasDoSlide(forma[1]);
    if (doTitulo && !titulo) titulo = texto.join(" ");
    else linhas.push(...texto);
  }
  // texto dentro de tabela ou de grupo (fora de <p:sp>): entra também, sem repetir o que já veio
  const vistas = new Set([titulo, ...linhas]);
  for (const quadro of xml.matchAll(/<p:graphicFrame\b[^>]*>([\s\S]*?)<\/p:graphicFrame>/g))
    for (const l of linhasDoSlide(quadro[1])) if (!vistas.has(l)) { vistas.add(l); linhas.push(l); }
  return { numero, titulo, linhas };
}

/** Lê um .pptx (os bytes do arquivo): os slides na ordem da apresentação. */
export async function lerPptx(bytes: Uint8Array): Promise<Apresentacao> {
  let entradas;
  try {
    entradas = lerZip(bytes);
  } catch {
    throw new Error("Este arquivo não é uma apresentação do PowerPoint no formato novo (.pptx). Se for um .ppt antigo, salve como .pptx para ver aqui.");
  }
  // a ordem dos slides está em presentation.xml (lista de r:id) e o arquivo de cada um nos relacionamentos
  const apresentacao = await textoDoZip(bytes, entradas, "ppt/presentation.xml");
  const rels = await textoDoZip(bytes, entradas, "ppt/_rels/presentation.xml.rels");
  const alvos = new Map<string, string>();
  for (const m of (rels ?? "").matchAll(/<Relationship\b([^>]*?)\/?>/g)) alvos.set(atributoXml(m[1], "Id"), atributoXml(m[1], "Target"));
  let caminhos: string[] = [];
  for (const m of (apresentacao ?? "").matchAll(/<p:sldId\b([^>]*?)\/?>/g)) {
    const alvo = alvos.get(atributoXml(m[1], "r:id"));
    if (alvo) caminhos.push(alvo.startsWith("/") ? alvo.slice(1) : `ppt/${alvo.replace(/^\.\//, "")}`);
  }
  // sem a lista (arquivo fora do padrão): os slides pelo número do nome
  if (!caminhos.length)
    caminhos = entradas
      .map((e) => e.nome)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]));
  if (!caminhos.length) throw new Error("Este arquivo não é uma apresentação do PowerPoint (.pptx): não achei os slides dentro dele.");
  const slides: Slide[] = [];
  for (const c of caminhos.slice(0, MAX_SLIDES)) {
    const xml = await textoDoZip(bytes, entradas, c);
    if (xml !== null) slides.push(textoDoSlide(xml, slides.length + 1));
  }
  return { slides };
}

/** A apresentação como texto simples (para copiar). */
export function apresentacaoComoTexto(a: Apresentacao): string {
  return a.slides.map((s) => [`Slide ${s.numero}${s.titulo ? `: ${s.titulo}` : ""}`, ...s.linhas.map((l) => `- ${l}`)].join("\n")).join("\n\n");
}
