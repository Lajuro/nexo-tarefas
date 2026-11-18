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
