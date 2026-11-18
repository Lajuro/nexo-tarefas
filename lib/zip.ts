// Leitor de ZIP feito em casa (3.15), para ver arquivos por dentro do app sem somar dependência.
// XLSX, DOCX e PPTX são ZIPs com XML dentro; o próprio .zip ganha a lista do que tem nele.
//
// Só lê: acha o índice no fim do arquivo (diretório central), lista as entradas e descompacta uma de cada
// vez com o DecompressionStream do navegador (o Node dos testes também tem). Funções puras, sem disco.
//
// Segurança: arquivo de fora é entrada não confiável. Todo deslocamento é conferido contra o tamanho do
// arquivo, o número de entradas tem teto, e a descompactação para no teto de bytes em vez de confiar no
// tamanho que o arquivo declara (é assim que um "zip bomba" de poucos KB vira gigabytes). Nada do ZIP vira
// caminho: os nomes são só texto para mostrar e para achar a entrada pedida.

export interface EntradaZip {
  /** Caminho dentro do ZIP, com barras ("xl/worksheets/sheet1.xml"). */
  nome: string;
  /** Tamanho descompactado declarado. */
  tamanho: number;
  comprimido: number;
  /** 0 = guardado sem compactar, 8 = deflate. Os outros não são lidos. */
  metodo: number;
  /** Onde começa o cabeçalho local da entrada. */
  deslocamento: number;
  pasta: boolean;
  cifrada: boolean;
}

/** Teto de entradas listadas (um ZIP com centenas de milhares de nomes travaria a tela). */
export const MAX_ENTRADAS_ZIP = 20000;
/** Teto, em bytes, do que uma entrada pode render descompactada. */
export const TETO_DA_ENTRADA = 60 * 1024 * 1024;

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

const FIM = 0x06054b50; // fim do diretório central
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** O arquivo começa como um ZIP? (PK\x03\x04, ou PK\x05\x06 num ZIP vazio) */
export const pareceZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6));

/** Lista as entradas do ZIP. Lança erro com mensagem clara se o arquivo não for um ZIP legível. */
export function lerZip(bytes: Uint8Array): EntradaZip[] {
  if (!pareceZip(bytes)) throw new Error("O arquivo não é um ZIP (ou está corrompido).");
  // o registro de fim fica nos últimos bytes; depois dele pode haver um comentário de até 65535 bytes
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(bytes, i) === FIM) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Não achei o índice do ZIP: o arquivo parece cortado.");
  const total = u16(bytes, fim + 10);
  const tamanhoDoIndice = u32(bytes, fim + 12);
  let pos = u32(bytes, fim + 16);
  if (total === 0xffff || pos === 0xffffffff || tamanhoDoIndice === 0xffffffff) throw new Error("Este ZIP usa o formato estendido (ZIP64), que o Nexo não lê.");
  if (pos + tamanhoDoIndice > bytes.length) throw new Error("O índice do ZIP aponta para fora do arquivo: ele parece cortado.");

  const utf8 = new TextDecoder("utf-8");
  const out: EntradaZip[] = [];
  for (let n = 0; n < total && out.length < MAX_ENTRADAS_ZIP; n++) {
    if (pos + 46 > bytes.length || u32(bytes, pos) !== CENTRAL) break;
    const marcas = u16(bytes, pos + 8);
    const tamanhoDoNome = u16(bytes, pos + 28);
    const extra = u16(bytes, pos + 30);
    const comentario = u16(bytes, pos + 32);
    if (pos + 46 + tamanhoDoNome > bytes.length) break;
    const nome = utf8.decode(bytes.subarray(pos + 46, pos + 46 + tamanhoDoNome)).replace(/\\/g, "/");
    out.push({
      nome,
      metodo: u16(bytes, pos + 10),
      comprimido: u32(bytes, pos + 20),
      tamanho: u32(bytes, pos + 24),
      deslocamento: u32(bytes, pos + 42),
      pasta: nome.endsWith("/"),
      cifrada: (marcas & 1) === 1,
    });
    pos += 46 + tamanhoDoNome + extra + comentario;
  }
  return out;
}

/** Acha uma entrada pelo nome (sem diferenciar maiúsculas: geradores de Office variam). */
export function acharNoZip(entradas: EntradaZip[], nome: string): EntradaZip | null {
  const alvo = nome.replace(/^\/+/, "").toLowerCase();
  return entradas.find((e) => e.nome.toLowerCase() === alvo) ?? null;
}

/** Junta os pedaços lidos num vetor só. */
function juntar(pedacos: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of pedacos) { out.set(p, i); i += p.length; }
  return out;
}

/**
 * Descompacta uma entrada. Para de ler e lança erro se passar do teto, não importa o que o ZIP declare.
 * Entrada cifrada ou com método de compactação que não seja "guardado" ou deflate é recusada.
 */
export async function extrairDoZip(bytes: Uint8Array, e: EntradaZip, teto = TETO_DA_ENTRADA): Promise<Uint8Array> {
  if (e.cifrada) throw new Error("Este arquivo está protegido por senha.");
  if (e.pasta) return new Uint8Array(0);
  const c = e.deslocamento;
  if (c + 30 > bytes.length || u32(bytes, c) !== LOCAL) throw new Error("O ZIP está corrompido (entrada fora do lugar).");
  const inicio = c + 30 + u16(bytes, c + 26) + u16(bytes, c + 28);
  const fim = inicio + e.comprimido;
  if (fim > bytes.length) throw new Error("O ZIP está cortado (falta um pedaço do arquivo).");
  const dados = bytes.subarray(inicio, fim);
  if (e.metodo === 0) {
    if (dados.length > teto) throw new Error("Esta parte do arquivo é grande demais para abrir aqui.");
    return dados.slice();
  }
  if (e.metodo !== 8) throw new Error("Este ZIP usa um tipo de compactação que o Nexo não lê.");
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não consegue descompactar o arquivo. Use o Edge ou o Chrome atualizados.");

  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const leitor = fluxo.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.length;
      if (total > teto) throw new Error("Esta parte do arquivo é grande demais para abrir aqui.");
      pedacos.push(value);
    }
  } catch (erro) {
    await leitor.cancel().catch(() => {});
    if (erro instanceof Error && /grande demais/.test(erro.message)) throw erro;
    throw new Error("Não consegui descompactar o arquivo: ele parece corrompido.");
  }
  return juntar(pedacos, total);
}

/** Lê uma entrada como texto UTF-8 (os XML do Office são UTF-8). null se a entrada não existe. */
export async function textoDoZip(bytes: Uint8Array, entradas: EntradaZip[], nome: string, teto = TETO_DA_ENTRADA): Promise<string | null> {
  const e = acharNoZip(entradas, nome);
  if (!e) return null;
  return new TextDecoder("utf-8").decode(await extrairDoZip(bytes, e, teto));
}

// ---------- XML, o bastante para os arquivos do Office ----------

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Texto de dentro de um XML de volta ao que é: "&amp;" vira "&", "&#10;" vira quebra de linha. */
export function desescaparXml(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,5});/g, (tudo, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // caracteres de controle (menos tab e quebras) e valores fora do Unicode ficam de fora
      if (!Number.isFinite(n) || n > 0x10ffff || (n < 32 && n !== 9 && n !== 10 && n !== 13)) return "";
      return String.fromCodePoint(n);
    }
    return ENTIDADES[e] ?? tudo;
  });
}

/** Valor de um atributo dentro do texto de uma tag (`r="A1" t="s"`). "" se não tem. */
export function atributoXml(tag: string, nome: string): string {
  const m = new RegExp(`(?:^|\\s)${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? desescaparXml(m[1] ?? m[2] ?? "") : "";
}

/** Tira o prefixo de namespace das tags ("<x:row>" vira "<row>"), para os leitores não dependerem dele. */
export const semPrefixoXml = (xml: string) => xml.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, "<$1");
