// Transcrição de vídeo: lê WebVTT, SRT e texto com tempos (o que o Teams e outros gravadores exportam)
// e devolve as falas com início, fim e quem falou. Funções puras; o arquivo vem da pasta de dados e é
// tratado como texto: marcação dentro dele (<v Nome>, <i>) é lida ou descartada, nunca interpretada como HTML.

import { quemSouEu } from "./prompts";
import { semAcento } from "./tipos";

export interface Fala {
  /** Segundos desde o começo. -1 = a transcrição não tem tempos. */
  inicio: number;
  fim: number;
  quem: string;
  texto: string;
}

const MAX_TEXTO = 3_000_000;
const MAX_FALAS = 30_000;

// ---------- tempo ----------

/** "1:02:03", "02:03", "2:03.500", "00:02:03,500" → segundos. null se não é um tempo. */
export function lerTempo(t: string): number | null {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*$/.exec(t || "");
  if (!m) return null;
  const [h, min, s, ms] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3]), Number((m[4] ?? "0").padEnd(3, "0"))];
  if (s > 59 || (m[1] !== undefined && min > 59)) return null;
  return h * 3600 + min * 60 + s + ms / 1000;
}

const p2 = (n: number) => String(n).padStart(2, "0");
/** 754 → "12:34"; 3723 → "1:02:03". */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}` : `${Math.floor(s / 60)}:${p2(s % 60)}`;
}

// ---------- leitura ----------

const SETA = /^\s*((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/;
const TEMPO_SOLTO = "(?:\\d{1,2}:)?\\d{1,2}:\\d{2}";
// "[00:12] Fulano: texto", "0:12 texto", "(1:02:03) - texto"
const LINHA_COM_TEMPO = new RegExp(`^\\s*[\\[(]?(${TEMPO_SOLTO})[\\])]?\\s*[-–:]?\\s*(.*)$`);
// "Fulano de Tal   0:12" (o Teams copia assim: nome, tempo, e o texto na linha de baixo)
const NOME_E_TEMPO = new RegExp(`^\\s*(.{1,80}?)\\s{2,}(${TEMPO_SOLTO})\\s*$`);
const QUEM = /^([^:]{1,60}):\s+(.+)$/;
/** Parece nome de gente? Até 4 palavras, cada uma começando com maiúscula (fora "de", "da", "dos"...). */
function pareceNome(s: string): boolean {
  const palavras = s.trim().split(/\s+/);
  return palavras.length >= 1 && palavras.length <= 4 && palavras.every((w) => /^(de|da|do|dos|das|e)$/.test(w) || /^[A-ZÀ-Ý][\p{L}.'-]*$/u.test(w)) && /^[A-ZÀ-Ý]/.test(palavras[0]);
}

/** Tira a marcação de uma legenda (<v Nome>, <i>, <00:01.000>) e devolve quem falou, se a marca disser. */
function limparLegenda(linha: string): { quem: string; texto: string } {
  let quem = "";
  const texto = linha
    .replace(/<v(?:\.[^\s>]*)?\s+([^>]+)>/gi, (_t, nome: string) => { quem = quem || nome.trim(); return ""; })
    .replace(/<\/?[a-zA-Z][^>]*>|<\d{1,2}:\d{2}[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { quem: quem.slice(0, 80), texto };
}

function lerLegendas(linhas: string[]): Fala[] {
  const out: Fala[] = [];
  let i = 0;
  while (i < linhas.length && out.length < MAX_FALAS) {
    const m = SETA.exec(linhas[i]);
    if (!m) { i++; continue; }
    const inicio = lerTempo(m[1]);
    const fim = lerTempo(m[2]);
    i++;
    const corpo: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !SETA.test(linhas[i])) corpo.push(linhas[i++]);
    // o número da próxima legenda (SRT) pode ter entrado no fim do corpo
    if (corpo.length > 1 && /^\d+$/.test(corpo[corpo.length - 1].trim()) && i < linhas.length && SETA.test(linhas[i])) corpo.pop();
    if (inicio === null || fim === null) continue;
    let quem = "";
    const partes = corpo.map((l) => { const x = limparLegenda(l); quem = quem || x.quem; return x.texto; }).filter(Boolean);
    let texto = partes.join(" ");
    // "Fulano: texto" numa legenda sem a marca <v>
    if (!quem) {
      const q = QUEM.exec(texto);
      if (q && pareceNome(q[1])) { quem = q[1].trim(); texto = q[2]; }
    }
    if (texto) out.push({ inicio, fim: Math.max(fim, inicio), quem, texto });
  }
  return out;
}

function lerTextoComTempos(linhas: string[]): Fala[] {
  const out: Fala[] = [];
  let atual: Fala | null = null;
  const fechar = () => { if (atual && atual.texto.trim()) out.push({ ...atual, texto: atual.texto.replace(/\s+/g, " ").trim() }); atual = null; };
  for (const bruta of linhas) {
    if (out.length >= MAX_FALAS) break;
    const linha = bruta.replace(/\s+$/, "");
    if (!linha.trim()) continue;
    const nt = NOME_E_TEMPO.exec(linha);
    const tempoDoNome = nt ? lerTempo(nt[2]) : null;
    if (nt && tempoDoNome !== null) {
      fechar();
      atual = { inicio: tempoDoNome, fim: tempoDoNome, quem: nt[1].trim(), texto: "" };
      continue;
    }
    const lt = LINHA_COM_TEMPO.exec(linha);
    const tempo = lt ? lerTempo(lt[1]) : null;
    if (lt && tempo !== null) {
      fechar();
      let texto = lt[2].trim();
      let quem = "";
      const q = QUEM.exec(texto);
      if (q && pareceNome(q[1])) { quem = q[1].trim(); texto = q[2]; }
      // "0:12 Fulano" sozinho numa linha: o texto vem embaixo
      else if (texto && !/[.!?,]$/.test(texto) && pareceNome(texto)) { quem = texto; texto = ""; }
      atual = { inicio: tempo, fim: tempo, quem, texto };
      continue;
    }
    if (atual) atual.texto += (atual.texto ? " " : "") + linha.trim();
  }
  fechar();
  return out;
}

/**
 * Lê uma transcrição. Aceita WebVTT, SRT e texto com um tempo no começo de cada fala. Se não houver tempo
 * nenhum, devolve o texto em parágrafos com `inicio` -1 (dá para ler e buscar, mas não acompanha o vídeo).
 */
export function lerTranscricao(bruto: string): Fala[] {
  const texto = (bruto || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n").slice(0, MAX_TEXTO);
  if (!texto.trim()) return [];
  const linhas = texto.split("\n");
  let falas = linhas.some((l) => SETA.test(l)) ? lerLegendas(linhas) : lerTextoComTempos(linhas.filter((l) => !/^\s*(WEBVTT|NOTE\b)/.test(l)));
  if (!falas.length) {
    return texto.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, MAX_FALAS).map((p) => ({ inicio: -1, fim: -1, quem: "", texto: p }));
  }
  falas = falas.sort((a, b) => a.inicio - b.inicio);
  // sem fim (texto com tempos): vai até a próxima fala
  return falas.map((f, i) => (f.fim > f.inicio ? f : { ...f, fim: falas[i + 1] ? Math.max(f.inicio, falas[i + 1].inicio) : f.inicio + 5 }));
}

export const temTempos = (falas: Fala[]) => falas.some((f) => f.inicio >= 0);

// ---------- acompanhar o vídeo ----------

/** A fala que está sendo dita no instante `t` (ou a última que já começou). -1 se nenhuma começou. */
export function falaNoInstante(falas: Fala[], t: number): number {
  let lo = 0;
  let hi = falas.length - 1;
  let achou = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (falas[meio].inicio <= t) { achou = meio; lo = meio + 1; } else hi = meio - 1;
  }
  return achou;
}

export interface Trecho {
  /** Posição da primeira fala do trecho. */
  de: number;
  quem: string;
  inicio: number;
  fim: number;
  /** Posições das falas deste trecho. */
  falas: number[];
}

/**
 * Junta falas seguidas da mesma pessoa em trechos de leitura (as legendas vêm picadas, de 3 em 3 segundos).
 * Um trecho fecha quando muda quem fala, quando há uma pausa ou quando ele fica longo.
 */
export function emTrechos(falas: Fala[], opcoes: { pausa?: number; maximo?: number } = {}): Trecho[] {
  const pausa = opcoes.pausa ?? 4;
  const maximo = opcoes.maximo ?? 45;
  const out: Trecho[] = [];
  falas.forEach((f, i) => {
    const t = out[out.length - 1];
    const junta = t && f.inicio >= 0 && t.quem === f.quem && f.inicio - t.fim <= pausa && f.fim - t.inicio <= maximo;
    if (junta) { t.falas.push(i); t.fim = f.fim; }
    else out.push({ de: i, quem: f.quem, inicio: f.inicio, fim: f.fim, falas: [i] });
  });
  return out;
}

/** As posições das falas que têm todas as palavras da busca (sem acento nem maiúscula). */
export function buscarNaTranscricao(falas: Fala[], termo: string): number[] {
  const palavras = semAcento(termo || "").split(/\s+/).filter(Boolean).slice(0, 8);
  if (!palavras.length) return [];
  const out: number[] = [];
  falas.forEach((f, i) => {
    const n = semAcento(`${f.quem} ${f.texto}`);
    if (palavras.every((w) => n.includes(w))) out.push(i);
  });
  return out;
}

/** Quem fala e por quanto tempo, do que mais fala para o que menos fala. */
export function quemFala(falas: Fala[]): { quem: string; segundos: number; falas: number }[] {
  const m = new Map<string, { quem: string; segundos: number; falas: number }>();
  for (const f of falas) {
    if (!f.quem) continue;
    const x = m.get(f.quem) ?? { quem: f.quem, segundos: 0, falas: 0 };
    x.segundos += Math.max(0, f.fim - f.inicio);
    x.falas++;
    m.set(f.quem, x);
  }
  return [...m.values()].sort((a, b) => b.segundos - a.segundos || a.quem.localeCompare(b.quem));
}

// ---------- texto para copiar e para o Copilot ----------

/** A transcrição em texto simples, um trecho por linha: "[12:34] Fulano: o que foi dito". */
export function transcricaoEmTexto(falas: Fala[], de = 0, ate = falas.length): string {
  const recorte = falas.slice(de, ate);
  return emTrechos(recorte)
    .map((t) => `${t.inicio >= 0 ? `[${formatarTempo(t.inicio)}] ` : ""}${t.quem ? `${t.quem}: ` : ""}${t.falas.map((i) => recorte[i].texto).join(" ")}`)
    .join("\n");
}

/** Parte a transcrição em pedaços que cabem no Copilot do navegador, sem cortar um trecho no meio. */
export function partesDaTranscricao(falas: Fala[], limite = 14_000): string[] {
  const linhas = transcricaoEmTexto(falas).split("\n").filter(Boolean);
  const partes: string[] = [];
  let atual: string[] = [];
  let tamanho = 0;
  for (const l of linhas) {
    const linha = l.length > limite ? l.slice(0, limite) : l;
    if (tamanho + linha.length + 1 > limite && atual.length) { partes.push(atual.join("\n")); atual = []; tamanho = 0; }
    atual.push(linha);
    tamanho += linha.length + 1;
  }
  if (atual.length) partes.push(atual.join("\n"));
  return partes;
}

/**
 * O prompt para o Copilot resumir o vídeo a partir da transcrição. Pede os tempos entre colchetes, que a página
 * de vídeo transforma em botões que levam o player até aquele instante.
 */
export function promptDoVideo(titulo: string, parte: string, numero = 1, total = 1): string {
  return [
    `Abaixo está a transcrição ${total > 1 ? `(parte ${numero} de ${total}) ` : ""}do vídeo "${titulo.trim() || "sem título"}". Organize o conteúdo para eu guardar nas minhas anotações.`,
    quemSouEu().trim(),
    "",
    "Regras:",
    "- Responda em português do Brasil, em Markdown.",
    "- Use SOMENTE o que está na transcrição. Não invente nomes, números nem decisões.",
    "- Sempre que citar algo, ponha o tempo em que foi dito entre colchetes, exatamente como aparece na transcrição: [12:34].",
    "- Use estas seções, cada título sozinho numa linha: ## Resumo, ## Pontos principais, ## Decisões, ## Próximos passos (com o responsável, se foi dito), ## Dúvidas em aberto.",
    '- Seção sem conteúdo: escreva apenas "Nenhum".',
    total > 1 ? `- Esta é a parte ${numero} de ${total}: resuma só o que está nesta parte.` : "",
    "",
    "Transcrição:",
    "",
    parte,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}
