// Ler uma planilha para mostrar dentro do app (3.15): XLSX (e XLSM), CSV e TSV. Funções puras.
//
// XLSX é um ZIP com XML: "xl/workbook.xml" diz quais abas existem, "xl/sharedStrings.xml" guarda os textos
// (as células apontam para eles por número), "xl/styles.xml" diz quais células são data, hora ou percentual
// e cada "xl/worksheets/sheetN.xml" tem as linhas e células. O leitor pega o VALOR de cada célula (o
// resultado já calculado das fórmulas, que o Excel grava junto) e o escreve como texto, do jeito que se lê
// em português: 1,5 e não 1.5, 18/11/2026 e não 46344. Não lê cores, larguras, gráficos nem macros.
//
// Entrada não confiável: tudo o que sai daqui é texto, que a tela desenha como texto. Há teto de abas, de
// linhas, de colunas e de tamanho de célula, e os tetos de descompactação de lib/zip.ts.

import { lerCsv } from "./importar-pessoas";
import { type EntradaZip, atributoXml, desescaparXml, lerZip, semPrefixoXml, textoDoZip } from "./zip";

export interface Aba {
  nome: string;
  /** Linha a linha, coluna a coluna; célula vazia é "". Todas as linhas têm `colunas` posições. */
  linhas: string[][];
  colunas: number;
  /** A aba tinha mais linhas ou colunas do que o teto: o que passou ficou de fora. */
  cortada: boolean;
  /** Aba escondida no arquivo original. */
  oculta: boolean;
}

export interface Planilha {
  abas: Aba[];
}

export const MAX_ABAS = 60;
export const MAX_LINHAS = 20000;
export const MAX_COLUNAS = 200;
const MAX_CELULA = 2000;

// ---------- CSV e TSV ----------

/** O separador mais provável de um texto em colunas: o que mais aparece, fora de aspas, nas primeiras linhas. */
export function separadorDoCsv(texto: string): string {
  const amostra = texto.slice(0, 20000);
  const conta: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  let aspas = false;
  let linhas = 0;
  for (let i = 0; i < amostra.length && linhas < 30; i++) {
    const c = amostra[i];
    if (c === '"') aspas = !aspas;
    else if (!aspas && c in conta) conta[c]++;
    else if (!aspas && c === "\n") linhas++;
  }
  // empate: ponto e vírgula primeiro (é o que o Excel em português grava), depois tab, vírgula e barra
  return ([";", "\t", ",", "|"] as const).reduce((melhor, s) => (conta[s] > conta[melhor] ? s : melhor), ";" as string);
}

/** Deixa todas as linhas com o mesmo número de colunas, corta no teto e tira as linhas vazias do fim. */
function arrumar(nome: string, bruto: string[][], oculta = false): Aba {
  let cortada = bruto.length > MAX_LINHAS;
  const linhas = bruto.slice(0, MAX_LINHAS);
  while (linhas.length && linhas[linhas.length - 1].every((c) => !c)) linhas.pop();
  let colunas = 0;
  for (const l of linhas) {
    let ultima = l.length;
    while (ultima > 0 && !l[ultima - 1]) ultima--;
    if (ultima > colunas) colunas = ultima;
  }
  if (colunas > MAX_COLUNAS) {
    colunas = MAX_COLUNAS;
    cortada = true;
  }
  return {
    nome,
    colunas,
    cortada,
    oculta,
    linhas: linhas.map((l) => Array.from({ length: colunas }, (_, i) => (l[i] ?? "").slice(0, MAX_CELULA))),
  };
}

/** CSV ou TSV (o texto já decodificado) como uma planilha de uma aba só. */
export function lerTabelaDeTexto(texto: string, nomeDoArquivo = ""): Planilha {
  const sep = /\.tsv$/i.test(nomeDoArquivo) ? "\t" : separadorDoCsv(texto);
  return { abas: [arrumar("Dados", lerCsv(texto, sep))] };
}

// ---------- números e datas do Excel ----------

type Formato = "normal" | "data" | "hora" | "datahora" | "percentual";

/** Formatos de número que já vêm no Excel (pelo número) e são data ou hora. */
function formatoEmbutido(id: number): Formato {
  if (id === 9 || id === 10) return "percentual";
  if ((id >= 14 && id <= 17) || (id >= 27 && id <= 31) || (id >= 34 && id <= 36) || (id >= 50 && id <= 58)) return "data";
  if ((id >= 18 && id <= 21) || id === 32 || id === 33 || (id >= 45 && id <= 47)) return "hora";
  if (id === 22) return "datahora";
  return "normal";
}

/** Formato escrito à mão ("dd/mm/yyyy hh:mm", "0.0%"): olha as letras que sobram tirando texto fixo e cores. */
export function formatoDoCodigo(codigo: string): Formato {
  // "Geral" (o padrão) aparece com o nome em inglês ou em alemão, que têm letras de data dentro
  if (/^\s*(general|standard)\s*$/i.test(codigo)) return "normal";
  const limpo = codigo
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, "")
    .toLowerCase();
  if (limpo.includes("%")) return "percentual";
  const temData = /[dy]/.test(limpo);
  const temHora = /[hs]/.test(limpo) || /am\/pm/.test(limpo);
  if (temData && temHora) return "datahora";
  if (temData) return "data";
  if (temHora) return "hora";
  // só "m" (mmm/yy sem ano não existe; "mm:ss" tem s): mês sozinho é data
  return /m/.test(limpo) && !/[0#?]/.test(limpo) ? "data" : "normal";
}

/** Lê "xl/styles.xml": para cada estilo de célula (o número do atributo s), que tipo de valor ele mostra. */
export function formatosDosEstilos(xml: string): Formato[] {
  const proprios = new Map<number, Formato>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/?>/g)) {
    const id = Number(atributoXml(m[1], "numFmtId"));
    if (Number.isFinite(id)) proprios.set(id, formatoDoCodigo(atributoXml(m[1], "formatCode")));
  }
  const bloco = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  const out: Formato[] = [];
  for (const m of bloco.matchAll(/<xf\b([^>]*?)\/?>/g)) {
    const id = Number(atributoXml(m[1], "numFmtId") || 0);
    out.push(proprios.get(id) ?? formatoEmbutido(id));
  }
  return out;
}

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Número de série do Excel (dias desde 30/12/1899, com a hora na parte decimal) para texto.
 * `base1904`: o arquivo usa o calendário que começa em 1904 (Excel antigo do Mac).
 */
export function dataDoExcel(serie: number, formato: Formato, base1904 = false): string {
  if (!Number.isFinite(serie)) return "";
  const dias = Math.floor(serie);
  const ms = Math.round((serie - dias) * 86400000);
  const d = new Date((base1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + dias * 86400000 + ms);
  if (Number.isNaN(d.getTime())) return String(serie);
  const data = `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const hora = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}${d.getUTCSeconds() ? `:${p2(d.getUTCSeconds())}` : ""}`;
  if (formato === "hora") {
    // duração de mais de um dia (soma de horas): mostra as horas inteiras
    const horas = dias * 24 + d.getUTCHours();
    return dias > 0 ? `${horas}:${p2(d.getUTCMinutes())}${d.getUTCSeconds() ? `:${p2(d.getUTCSeconds())}` : ""}` : hora;
  }
  if (formato === "datahora") return ms === 0 ? data : `${data} ${hora}`;
  return data;
}

/** Número como se lê em português, sem ponto de milhar (2026 é 2026) e sem a sujeira da conta binária. */
export function numeroDoExcel(bruto: string, formato: Formato, base1904 = false): string {
  const n = Number(bruto);
  if (!Number.isFinite(n)) return bruto;
  if (formato === "data" || formato === "hora" || formato === "datahora") return dataDoExcel(n, formato, base1904);
  if (formato === "percentual") return `${Number((n * 100).toPrecision(12)).toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 6 })}%`;
  return Number(n.toPrecision(15)).toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 10 });
}

// ---------- XLSX ----------

/** "A" → 0, "Z" → 25, "AA" → 26. */
export function colunaDaLetra(letras: string): number {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** 0 → "A", 26 → "AA": o rótulo da coluna, como no Excel. */
export function letraDaColuna(indice: number): string {
  let s = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Todo o texto de um trecho de XML: junta os <t> (texto com formatação vem em vários) e ignora a leitura fonética. */
function textoDosT(xml: string): string {
  const semFonetica = xml.includes("<rPh") ? xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "") : xml;
  let s = "";
  for (const m of semFonetica.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) s += m[1];
  return desescaparXml(s);
}

/** Lê "xl/sharedStrings.xml": a lista de textos a que as células apontam. */
export function textosCompartilhados(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) out.push(m[1] ? textoDosT(m[1]) : "");
  return out;
}

/** Lê as linhas de um "sheetN.xml". */
export function linhasDaAba(xmlBruto: string, textos: string[], formatos: Formato[], base1904 = false): { linhas: string[][]; cortada: boolean } {
  const xml = xmlBruto.includes("<row") || xmlBruto.includes("<sheetData") ? xmlBruto : semPrefixoXml(xmlBruto);
  const linhas: string[][] = [];
  let cortada = false;
  let proxima = 0;
  for (const linha of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(atributoXml(linha[1], "r"));
    const indice = Number.isFinite(numero) && numero > 0 ? numero - 1 : proxima;
    proxima = indice + 1;
    if (indice >= MAX_LINHAS) {
      cortada = true;
      break;
    }
    if (!linha[2]) continue;
    const celulas: string[] = [];
    let coluna = 0;
    for (const c of linha[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /(?:^|\s)r="([A-Z]{1,3})\d+"/.exec(c[1]);
      if (ref) coluna = colunaDaLetra(ref[1]);
      const onde = coluna++;
      if (onde >= MAX_COLUNAS) {
        cortada = true;
        continue;
      }
      if (!c[2]) continue;
      const tipo = atributoXml(c[1], "t");
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(c[2])?.[1] ?? "";
      let texto = "";
      if (tipo === "s") texto = textos[Number(v)] ?? "";
      else if (tipo === "inlineStr") texto = textoDosT(c[2]);
      else if (tipo === "str" || tipo === "e") texto = desescaparXml(v);
      else if (tipo === "b") texto = v === "1" ? "VERDADEIRO" : v === "0" ? "FALSO" : "";
      else if (tipo === "d") texto = desescaparXml(v).replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1");
      else if (v) texto = numeroDoExcel(v, formatos[Number(atributoXml(c[1], "s") || 0)] ?? "normal", base1904);
      if (texto) celulas[onde] = texto;
    }
    // célula pulada vira "" (e não um buraco na lista)
    if (celulas.length) linhas[indice] = Array.from(celulas, (c) => c ?? "");
  }
  // linhas puladas no arquivo (vazias) viram linhas em branco, para a numeração bater com a do Excel
  for (let i = 0; i < linhas.length; i++) if (!linhas[i]) linhas[i] = [];
  return { linhas, cortada };
}

/** Caminho de uma parte do ZIP a partir do "Target" de um relacionamento (relativo a xl/ ou absoluto). */
function caminhoNoPacote(base: string, alvo: string): string {
  const partes = (alvo.startsWith("/") ? alvo.slice(1) : `${base}/${alvo}`).split("/");
  const out: string[] = [];
  for (const p of partes) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

/** Lê um XLSX (os bytes do arquivo). Lança erro com mensagem clara se não for uma planilha legível. */
export async function lerXlsx(bytes: Uint8Array): Promise<Planilha> {
  let entradas: EntradaZip[];
  try {
    entradas = lerZip(bytes);
  } catch {
    throw new Error("Este arquivo não é uma planilha do Excel no formato novo (.xlsx). Se for um .xls antigo, salve como .xlsx para ver aqui.");
  }
  const pasta = await textoDoZip(bytes, entradas, "xl/workbook.xml");
  if (!pasta) throw new Error("Este arquivo não é uma planilha do Excel (.xlsx): não achei a lista de abas dentro dele.");
  const livro = pasta.includes("<sheet") ? pasta : semPrefixoXml(pasta);

  const relacoes = new Map<string, string>();
  const rels = await textoDoZip(bytes, entradas, "xl/_rels/workbook.xml.rels");
  for (const m of (rels ?? "").matchAll(/<Relationship\b([^>]*?)\/?>/g)) relacoes.set(atributoXml(m[1], "Id"), atributoXml(m[1], "Target"));

  const compartilhados = await textoDoZip(bytes, entradas, "xl/sharedStrings.xml");
  const textos = compartilhados ? textosCompartilhados(compartilhados.includes("<si") ? compartilhados : semPrefixoXml(compartilhados)) : [];
  const estilos = await textoDoZip(bytes, entradas, "xl/styles.xml");
  const formatos = estilos ? formatosDosEstilos(estilos.includes("<cellXfs") ? estilos : semPrefixoXml(estilos)) : [];
  const base1904 = /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(livro);

  const abas: Aba[] = [];
  let n = 0;
  for (const m of livro.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    n++;
    if (abas.length >= MAX_ABAS) break;
    const nome = atributoXml(m[1], "name") || `Planilha ${n}`;
    const alvo = relacoes.get(atributoXml(m[1], "r:id") || atributoXml(m[1], "id"));
    const caminho = alvo ? caminhoNoPacote("xl", alvo) : `xl/worksheets/sheet${n}.xml`;
    // aba de gráfico ou de macro não tem linhas e colunas: fica de fora
    if (!/worksheets\//i.test(caminho)) continue;
    const xml = await textoDoZip(bytes, entradas, caminho);
    if (xml === null) continue;
    const { linhas, cortada } = linhasDaAba(xml, textos, formatos, base1904);
    const aba = arrumar(nome.slice(0, 80), linhas, /^(hidden|veryHidden)$/.test(atributoXml(m[1], "state")));
    abas.push({ ...aba, cortada: aba.cortada || cortada });
  }
  if (!abas.length) throw new Error("Não achei nenhuma aba com dados nesta planilha.");
  return { abas };
}

// ---------- busca ----------

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Os números (a partir de 0) das linhas que têm todas as palavras procuradas, em qualquer coluna. */
export function linhasComOTexto(aba: Aba, busca: string): number[] | null {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) return null;
  const out: number[] = [];
  aba.linhas.forEach((l, i) => {
    const texto = semAcento(l.join("\u0001"));
    if (palavras.every((p) => texto.includes(p))) out.push(i);
  });
  return out;
}

/** A aba como texto separado por tabulação (para colar no Excel ou num e-mail). */
export function abaComoTexto(aba: Aba, linhas?: number[]): string {
  const quais = linhas ?? aba.linhas.map((_, i) => i);
  return quais.map((i) => aba.linhas[i].map((c) => c.replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
}
