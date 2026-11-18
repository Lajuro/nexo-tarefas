// Aparência escolhida pelo usuário: cor de destaque, tons neutros, cantos, fonte, quanto a interface se mexe,
// o estilo da barra lateral e o fundo das telas. É preferência (localStorage "nexo:aparencia"), não dado.
//
// Tudo vira atributo ou variável CSS no <html>, e o app/globals.css faz o resto:
//   --matiz, --croma     → cor de destaque (os tokens --primary, --ring e --accent derivam delas)
//   --radius             → cantos
//   data-fonte           → família tipográfica
//   data-movimento       → "nenhum" zera transições e animações em CSS
//   data-lateral         → estilo da barra lateral
//   data-fundo           → fundo da área de trabalho (liso, aurora, pontilhado, grade)
//   data-neutros         → tom dos fundos, bordas e texto (frio, neutro, quente ou puxado para a cor de destaque)
//   data-escuro          → "profundo" deixa os fundos do tema escuro mais perto do preto
//
// Fica fora dos arquivos "use client" porque o layout (servidor) precisa da string do script
// que aplica isso antes da primeira pintura, para a tela não piscar na cor padrão.

export const ACENTOS = [
  { id: "indigo", nome: "Índigo", matiz: 275, croma: 1 },
  { id: "azul", nome: "Azul", matiz: 252, croma: 0.95 },
  { id: "ciano", nome: "Ciano", matiz: 215, croma: 0.6 },
  { id: "verde", nome: "Verde", matiz: 155, croma: 0.72 },
  { id: "ambar", nome: "Âmbar", matiz: 68, croma: 0.62 },
  { id: "laranja", nome: "Laranja", matiz: 45, croma: 0.85 },
  { id: "vermelho", nome: "Vermelho", matiz: 22, croma: 0.98 },
  { id: "rosa", nome: "Rosa", matiz: 355, croma: 0.95 },
  { id: "roxo", nome: "Roxo", matiz: 305, croma: 1 },
  { id: "grafite", nome: "Grafite", matiz: 265, croma: 0.12 },
] as const;
export type IdAcento = (typeof ACENTOS)[number]["id"];
/** Cor de destaque escolhida à mão (3.13): vale aparencia.matiz e aparencia.intensidade. */
export const ACENTO_LIVRE = "livre";
export type Acento = IdAcento | typeof ACENTO_LIVRE;

export const CANTOS = { retos: "0.3rem", suaves: "0.625rem", redondos: "0.95rem" } as const;
export type Cantos = keyof typeof CANTOS;
export const FONTES = ["geist", "sistema", "serifada"] as const;
export type Fonte = (typeof FONTES)[number];
export const MOVIMENTOS = ["completo", "sutil", "nenhum"] as const;
export type Movimento = (typeof MOVIMENTOS)[number];
export const ESTILOS_LATERAL = ["solida", "vidro", "colorida"] as const;
export type EstiloLateral = (typeof ESTILOS_LATERAL)[number];
export const FUNDOS = ["liso", "aurora", "pontilhado", "grade"] as const;
export type Fundo = (typeof FUNDOS)[number];
export const NEUTROS = ["frio", "neutro", "quente", "destaque"] as const;
export type Neutros = (typeof NEUTROS)[number];
export const ESCUROS = ["padrao", "profundo"] as const;
export type Escuro = (typeof ESCUROS)[number];

export interface Aparencia {
  acento: Acento;
  /** Só vale com acento "livre": matiz da cor de destaque, de 0 a 359. */
  matiz: number;
  /** Só vale com acento "livre": de 0 (quase cinza) a 1 (o mais vivo que aquele matiz aguenta). */
  intensidade: number;
  neutros: Neutros;
  escuro: Escuro;
  cantos: Cantos;
  fonte: Fonte;
  /** completo: tudo se mexe (respeitando o "reduzir movimento" do Windows); sutil: só esmaecer, nada desliza; nenhum: nada anima. */
  movimento: Movimento;
  lateral: EstiloLateral;
  fundo: Fundo;
}

export const APARENCIA_PADRAO: Aparencia = {
  acento: "indigo", matiz: 275, intensidade: 1, neutros: "frio", escuro: "padrao",
  cantos: "suaves", fonte: "geist", movimento: "completo", lateral: "solida", fundo: "liso",
};

// ---------- Cor livre: até onde cada matiz pode ir ----------
//
// Os tokens de cor têm a luminosidade fixa e multiplicam a saturação por --croma. Cada matiz aguenta uma
// saturação diferente antes de sair do que a tela consegue mostrar (o amarelo e o ciano bem menos que o roxo).
// O teto abaixo é essa conta, feita uma vez: para cada matiz, de 10 em 10 graus, o maior --croma em que todas
// as cores derivadas ainda cabem no sRGB, com a mesma folga que as cores prontas da lista ACENTOS já usam.

/** OKLCH → sRGB linear (matrizes do OKLab). */
function emRgbLinear(l: number, c: number, h: number) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S];
}

/** Luminosidade e fator de saturação dos tokens que derivam da cor de destaque (app/globals.css). */
const DERIVADAS: [number, number][] = [[0.48, 0.215], [0.51, 0.215], [0.63, 0.2], [0.52, 0.2], [0.66, 0.19]];
/** As cores prontas passam um pouco do sRGB (o navegador ajusta) e foram medidas assim; a cor livre usa a mesma folga. */
const FOLGA = 1.4;

function tetoExato(matiz: number) {
  let teto = 1 / FOLGA;
  for (const [l, fator] of DERIVADAS) {
    let dentro = 0;
    let fora = 0.4;
    for (let i = 0; i < 24; i++) {
      const meio = (dentro + fora) / 2;
      if (emRgbLinear(l, meio, matiz).every((v) => v >= -0.0005 && v <= 1.0005)) dentro = meio;
      else fora = meio;
    }
    teto = Math.min(teto, dentro / fator);
  }
  return Math.round(Math.min(1, teto * FOLGA) * 100) / 100;
}

/** Teto de --croma para os matizes 0, 10, 20... 350. Vai embutido no script do <head>. */
export const TETO_DE_CROMA: readonly number[] = Array.from({ length: 36 }, (_, i) => tetoExato(i * 10));

/** O maior --croma que o matiz aguenta (o menor entre os dois vizinhos da tabela). */
export function tetoDeCroma(matiz: number) {
  const i = Math.floor(matiz / 10) % 36;
  return Math.min(TETO_DE_CROMA[i], TETO_DE_CROMA[(i + 1) % 36]);
}

const numero = (v: unknown, min: number, max: number, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

/** Matiz e croma que a aparência pede: da lista, ou da cor livre já limitada ao teto do matiz. */
export function corDeDestaque(a: Pick<Aparencia, "acento" | "matiz" | "intensidade">): { matiz: number; croma: number } {
  if (a.acento === ACENTO_LIVRE) return { matiz: a.matiz, croma: Math.round(a.intensidade * tetoDeCroma(a.matiz) * 1000) / 1000 };
  const cor = ACENTOS.find((c) => c.id === a.acento) ?? ACENTOS[0];
  return { matiz: cor.matiz, croma: cor.croma };
}

const dentro = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T => (lista.includes(v as T) ? (v as T) : padrao);

/** Aceita qualquer coisa que venha do localStorage e devolve uma aparência válida. */
export function normalizarAparencia(x: unknown): Aparencia {
  const a = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Aparencia, unknown>>;
  return {
    acento: dentro([...ACENTOS.map((c) => c.id), ACENTO_LIVRE] as Acento[], a.acento, APARENCIA_PADRAO.acento),
    matiz: Math.round(numero(a.matiz, 0, 359, APARENCIA_PADRAO.matiz)),
    intensidade: Math.round(numero(a.intensidade, 0, 1, APARENCIA_PADRAO.intensidade) * 100) / 100,
    neutros: dentro(NEUTROS, a.neutros, APARENCIA_PADRAO.neutros),
    escuro: dentro(ESCUROS, a.escuro, APARENCIA_PADRAO.escuro),
    cantos: dentro(Object.keys(CANTOS) as Cantos[], a.cantos, APARENCIA_PADRAO.cantos),
    fonte: dentro(FONTES, a.fonte, APARENCIA_PADRAO.fonte),
    movimento: dentro(MOVIMENTOS, a.movimento, APARENCIA_PADRAO.movimento),
    lateral: dentro(ESTILOS_LATERAL, a.lateral, APARENCIA_PADRAO.lateral),
    fundo: dentro(FUNDOS, a.fundo, APARENCIA_PADRAO.fundo),
  };
}

/** Aplica a aparência no <html>. Roda no cliente a cada mudança. */
export function aplicarAparencia(a: Aparencia, raiz: HTMLElement = document.documentElement) {
  const cor = corDeDestaque(a);
  raiz.style.setProperty("--matiz", String(cor.matiz));
  raiz.style.setProperty("--croma", String(cor.croma));
  raiz.style.setProperty("--radius", CANTOS[a.cantos]);
  raiz.dataset.fonte = a.fonte;
  raiz.dataset.movimento = a.movimento;
  raiz.dataset.lateral = a.lateral;
  raiz.dataset.fundo = a.fundo;
  raiz.dataset.neutros = a.neutros;
  raiz.dataset.escuro = a.escuro;
}

/**
 * Mesmo efeito de aplicarAparencia(), em texto, para rodar inline no <head> antes da primeira pintura.
 * O localStorage é entrada não confiável: o script só aplica valores das listas fechadas daqui
 * (consulta com hasOwnProperty, para "constructor" e afins não escaparem pela cadeia de protótipos)
 * e, na cor livre, números conferidos e limitados (matiz de 0 a 359, intensidade de 0 a 1, teto da tabela).
 */
export const SCRIPT_APARENCIA = `(function(){try{var a=JSON.parse(localStorage.getItem("nexo:aparencia")||"{}");if(!a||typeof a!=="object")a={};var C=${JSON.stringify(
  Object.fromEntries(ACENTOS.map((c) => [c.id, [c.matiz, c.croma]])),
)},R=${JSON.stringify(CANTOS)},T=${JSON.stringify(TETO_DE_CROMA)},h=document.documentElement,tem=function(o,k){return typeof k==="string"&&Object.prototype.hasOwnProperty.call(o,k)},de=function(l,v,p){return typeof v==="string"&&l.indexOf(v)>=0?v:p},nu=function(v,a,b,p){return typeof v==="number"&&isFinite(v)?Math.min(b,Math.max(a,v)):p},c=tem(C,a.acento)?C[a.acento]:C.${APARENCIA_PADRAO.acento};if(a.acento==="${ACENTO_LIVRE}"){var m=Math.round(nu(a.matiz,0,359,${APARENCIA_PADRAO.matiz})),i=Math.round(nu(a.intensidade,0,1,${APARENCIA_PADRAO.intensidade})*100)/100,k=Math.floor(m/10)%36;c=[m,Math.round(i*Math.min(T[k],T[(k+1)%36])*1000)/1000]}h.style.setProperty("--matiz",c[0]);h.style.setProperty("--croma",c[1]);h.style.setProperty("--radius",tem(R,a.cantos)?R[a.cantos]:R.${APARENCIA_PADRAO.cantos});h.dataset.fonte=de(${JSON.stringify(
  FONTES,
)},a.fonte,"${APARENCIA_PADRAO.fonte}");h.dataset.movimento=de(${JSON.stringify(MOVIMENTOS)},a.movimento,"${APARENCIA_PADRAO.movimento}");h.dataset.lateral=de(${JSON.stringify(
  ESTILOS_LATERAL,
)},a.lateral,"${APARENCIA_PADRAO.lateral}");h.dataset.fundo=de(${JSON.stringify(FUNDOS)},a.fundo,"${APARENCIA_PADRAO.fundo}");h.dataset.neutros=de(${JSON.stringify(NEUTROS)},a.neutros,"${APARENCIA_PADRAO.neutros}");h.dataset.escuro=de(${JSON.stringify(
  ESCUROS,
)},a.escuro,"${APARENCIA_PADRAO.escuro}")}catch(_){}})()`;

// ---------- Temas prontos ----------

/** O que um tema pronto define: tudo o que é visual, menos o movimento (que é conforto, não gosto). */
export type VisualDoTema = Omit<Aparencia, "movimento">;

export interface TemaPronto {
  id: string;
  nome: string;
  /** Se informado, o tema também troca entre claro e escuro. Sem isso, vale nos dois. */
  tema?: "claro" | "escuro";
  visual: VisualDoTema;
}

const visual = (v: Partial<VisualDoTema>): VisualDoTema => {
  const { movimento: _fica, ...padrao } = APARENCIA_PADRAO;
  return { ...padrao, ...v };
};

export const TEMAS_PRONTOS: readonly TemaPronto[] = [
  { id: "nexo", nome: "Nexo", visual: visual({}) },
  { id: "grafite", nome: "Grafite", visual: visual({ acento: "grafite", neutros: "neutro", cantos: "retos" }) },
  { id: "oceano", nome: "Oceano", visual: visual({ acento: "azul", lateral: "vidro", fundo: "aurora" }) },
  { id: "floresta", nome: "Floresta", visual: visual({ acento: "verde", neutros: "destaque", lateral: "colorida" }) },
  { id: "por-do-sol", nome: "Pôr do sol", visual: visual({ acento: "laranja", neutros: "quente", cantos: "redondos", lateral: "vidro", fundo: "aurora" }) },
  { id: "papel", nome: "Papel", tema: "claro", visual: visual({ acento: "ambar", neutros: "quente", fonte: "serifada", fundo: "pontilhado" }) },
  { id: "ameixa", nome: "Ameixa", visual: visual({ acento: "roxo", neutros: "destaque", cantos: "redondos", lateral: "colorida" }) },
  { id: "meia-noite", nome: "Meia-noite", tema: "escuro", visual: visual({ acento: "azul", escuro: "profundo", lateral: "vidro", fundo: "aurora" }) },
  { id: "terminal", nome: "Terminal", tema: "escuro", visual: visual({ acento: "verde", neutros: "neutro", escuro: "profundo", cantos: "retos", fonte: "sistema", fundo: "grade" }) },
];

/** O tema pronto que bate com a aparência de agora (e com o claro/escuro, quando o tema define), ou null. */
export function temaProntoAtual(a: Aparencia, escuroAgora: boolean): TemaPronto | null {
  return (
    TEMAS_PRONTOS.find(
      (t) =>
        (!t.tema || (t.tema === "escuro") === escuroAgora) &&
        // matiz e intensidade só contam na cor livre, e nenhum tema pronto usa a cor livre
        (Object.keys(t.visual) as (keyof VisualDoTema)[]).every((k) => k === "matiz" || k === "intensidade" || t.visual[k] === a[k]),
    ) ?? null
  );
}
