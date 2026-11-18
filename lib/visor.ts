// Visor de imagem (3.14.1): as regras puras por trás da janela que amplia uma imagem sem tirar o usuário de onde
// ele estava. A janela em si está em components/VisorDeImagem.tsx.
//
// Segurança: o visor só mostra imagem servida pela rota de anexos do próprio app ("/api/arquivos?p=..."),
// que é de onde vêm as imagens do texto e os arquivos do banco de links. Qualquer outro endereço é recusado:
// nada de fora é carregado, como no resto do app.

export interface ImagemDoVisor {
  /** Endereço na rota de anexos ("/api/arquivos?p=2026%2Fabc-print.png"). */
  url: string;
  /** Nome para mostrar (o texto alternativo da imagem ou o título do arquivo). */
  alt: string;
}

const ROTA_DE_ANEXO = /^\/api\/arquivos\?p=[A-Za-z0-9%._~!*'()-]+$/;

/** O endereço é um anexo do próprio app (e nada além disso: sem outro parâmetro, sem outro site)? */
export const ehUrlDeAnexo = (url: unknown): url is string => typeof url === "string" && url.length <= 2000 && ROTA_DE_ANEXO.test(url);

/** Pelo nome, o arquivo é uma imagem que o navegador desenha? (SVG fica de fora: continua abrindo como arquivo.) */
export const ehNomeDeImagem = (nome: string | null | undefined) => /\.(png|jpe?g|gif|webp|bmp)$/i.test((nome || "").trim());

/** O nome do arquivo de um endereço da rota de anexos (para saber se é imagem). "" se não der para ler. */
export function nomeNaUrl(url: string): string {
  if (!ehUrlDeAnexo(url)) return "";
  try {
    return decodeURIComponent(url.slice(url.indexOf("=") + 1));
  } catch {
    return "";
  }
}

/** Só o que é anexo válido entra na lista; o nome vira uma linha curta. */
export function imagensValidas(lista: unknown): ImagemDoVisor[] {
  if (!Array.isArray(lista)) return [];
  const out: ImagemDoVisor[] = [];
  for (const x of lista) {
    if (!x || typeof x !== "object") continue;
    const { url, alt } = x as { url?: unknown; alt?: unknown };
    if (!ehUrlDeAnexo(url)) continue;
    out.push({ url, alt: typeof alt === "string" ? alt.replace(/\s+/g, " ").trim().slice(0, 200) : "" });
    if (out.length >= 200) break;
  }
  return out;
}

/** De onde baixar o arquivo da imagem. */
export const urlParaBaixar = (url: string) => `${url}&baixar=1`;

/** Os degraus do zoom, em relação ao tamanho real da imagem (1 = 100%). */
export const ESCALAS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const;

/**
 * O próximo degrau do zoom. `atual` é a escala de agora (quando a imagem está ajustada à janela, é a escala
 * em que ela está sendo desenhada). Devolve o mesmo valor quando já está no fim da escada.
 */
export function proximaEscala(atual: number, sentido: 1 | -1): number {
  const a = Number.isFinite(atual) && atual > 0 ? atual : 1;
  if (sentido === 1) return ESCALAS.find((e) => e > a + 0.001) ?? ESCALAS[ESCALAS.length - 1];
  return [...ESCALAS].reverse().find((e) => e < a - 0.001) ?? ESCALAS[0];
}

/** A posição depois de andar na lista, dando a volta nas pontas. */
export const indiceVizinho = (indice: number, total: number, passo: 1 | -1) => (total <= 0 ? 0 : (indice + passo + total) % total);

// ---------- visor de arquivos (3.15): o que dá para ver por dentro do app ----------

/** Como um arquivo é mostrado dentro do app. null = não dá: continua abrindo fora (baixar ou outra aba). */
export type JeitoDeVer = "imagem" | "pdf" | "planilha" | "tabela" | "documento" | "slides" | "markdown" | "texto" | "zip" | "midia";

const POR_EXTENSAO: Record<string, JeitoDeVer> = {
  pdf: "pdf",
  xlsx: "planilha", xlsm: "planilha",
  csv: "tabela", tsv: "tabela",
  docx: "documento",
  pptx: "slides",
  md: "markdown", markdown: "markdown",
  zip: "zip",
  mp4: "midia", m4v: "midia", webm: "midia", ogv: "midia", mov: "midia", mkv: "midia",
  mp3: "midia", m4a: "midia", aac: "midia", wav: "midia", ogg: "midia", oga: "midia", opus: "midia", flac: "midia",
};

/** Extensões mostradas como texto (com as cores do bloco de código, quando a linguagem é conhecida). */
const DE_TEXTO =
  "txt log json jsonl ndjson xml yaml yml ini conf cfg toml properties env sql sh bash zsh ps1 psm1 bat cmd py js mjs cjs ts tsx jsx css scss html htm xhtml svg java kt cs go rb php rs c h cpp hpp swift tf hcl gradle dockerfile makefile eml vtt srt diff patch csproj sln gitignore editorconfig rego";
for (const e of DE_TEXTO.split(" ")) POR_EXTENSAO[e] = "texto";

/** A extensão de um nome de arquivo, em minúsculas e sem o ponto ("" se não tem). */
export function extensaoDe(nome: string | null | undefined): string {
  const base = (nome || "").trim().split(/[\\/]/).pop() ?? "";
  const ponto = base.lastIndexOf(".");
  // "Dockerfile" e "Makefile" não têm extensão: vale o nome inteiro
  return (ponto > 0 ? base.slice(ponto + 1) : base).toLowerCase();
}

/** Como este arquivo é visto dentro do app, pelo nome. null = só abre fora. */
export function jeitoDeVer(nome: string | null | undefined): JeitoDeVer | null {
  if (ehNomeDeImagem(nome)) return "imagem";
  const e = extensaoDe(nome);
  return Object.prototype.hasOwnProperty.call(POR_EXTENSAO, e) ? POR_EXTENSAO[e] : null;
}

/** O nome do jeito de ver, para o cabeçalho do visor. */
export const NOME_DO_JEITO: Record<JeitoDeVer, string> = {
  imagem: "Imagem", pdf: "PDF", planilha: "Planilha", tabela: "Tabela", documento: "Documento do Word", slides: "Apresentação",
  markdown: "Markdown", texto: "Texto", zip: "Arquivo compactado", midia: "Áudio ou vídeo",
};

/** Formatos antigos do Office que o app não lê por dentro, com o que fazer. "" para o resto. */
export function avisoDeFormatoAntigo(nome: string | null | undefined): string {
  const e = extensaoDe(nome);
  if (e === "xls" || e === "xlsb") return "Planilha no formato antigo do Excel: salve como .xlsx para ver aqui.";
  if (e === "doc" || e === "rtf") return "Documento no formato antigo do Word: salve como .docx para ver aqui.";
  if (e === "ppt") return "Apresentação no formato antigo do PowerPoint: salve como .pptx para ver aqui.";
  return "";
}

/** A linguagem (de lib/realce.ts) para colorir um arquivo de texto, pelo nome. "" = sem cores. */
export function linguagemDoArquivo(nome: string | null | undefined): string {
  const e = extensaoDe(nome);
  if (e === "json" || e === "jsonl" || e === "ndjson") return "json";
  if (e === "yaml" || e === "yml") return "yaml";
  if (e === "py") return "python";
  if (e === "js" || e === "mjs" || e === "cjs" || e === "jsx") return "javascript";
  if (e === "ts" || e === "tsx") return "typescript";
  if (e === "sql") return "sql";
  if (e === "xml" || e === "html" || e === "htm" || e === "xhtml" || e === "svg" || e === "csproj") return "xml";
  if (e === "sh" || e === "bash" || e === "zsh" || e === "dockerfile" || e === "makefile") return "bash";
  if (e === "ps1" || e === "psm1" || e === "bat" || e === "cmd") return "powershell";
  if (e === "ini" || e === "conf" || e === "cfg" || e === "toml" || e === "properties" || e === "env" || e === "editorconfig") return "ini";
  if (e === "diff" || e === "patch") return "diff";
  return "";
}

/** Áudio (sem imagem) ou vídeo? Só vale para o jeito "midia". */
export const ehSoAudio = (nome: string | null | undefined) => /^(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/.test(extensaoDe(nome));

/** De onde o PDF é carregado para aparecer dentro do app (a rota de anexos só deixa embutir PDF, e só com este pedido). */
export const urlDoPdf = (url: string) => `${url}&ver=1`;

/** De onde o áudio ou vídeo toca: a rota de mídia, que deixa pular para qualquer ponto. "" se o endereço não é anexo. */
export const urlDaMidia = (url: string) => (ehUrlDeAnexo(url) ? url.replace(/^\/api\/arquivos\?/, "/api/midia?") : "");

/** Teto do que o app baixa para ler por dentro (planilha, documento, texto, zip). Acima disso, só abrindo fora. */
export const TETO_PARA_LER = 40 * 1024 * 1024;
/** Teto do texto desenhado de uma vez num arquivo de texto (o resto fica atrás de "mostrar mais"). */
export const TETO_DO_TEXTO = 400_000;

/** "12,4 MB", "830 KB", "512 bytes". */
export function tamanhoLegivel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
