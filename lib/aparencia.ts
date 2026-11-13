// Aparência escolhida pelo usuário: cor de destaque, cantos, fonte, quanto a interface se mexe
// e o estilo da barra lateral. É preferência (localStorage "nexo:aparencia"), não dado.
//
// Tudo vira atributo ou variável CSS no <html>, e o app/globals.css faz o resto:
//   --matiz, --croma     → cor de destaque (os tokens --primary, --ring e --accent derivam delas)
//   --radius             → cantos
//   data-fonte           → família tipográfica
//   data-movimento       → "nenhum" zera transições e animações em CSS
//   data-lateral         → estilo da barra lateral
//   data-fundo           → fundo da área de trabalho (liso, aurora, pontilhado)
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

export const CANTOS = { retos: "0.3rem", suaves: "0.625rem", redondos: "0.95rem" } as const;
export type Cantos = keyof typeof CANTOS;
export const FONTES = ["geist", "sistema", "serifada"] as const;
export type Fonte = (typeof FONTES)[number];
export const MOVIMENTOS = ["completo", "sutil", "nenhum"] as const;
export type Movimento = (typeof MOVIMENTOS)[number];
export const ESTILOS_LATERAL = ["solida", "vidro", "colorida"] as const;
export type EstiloLateral = (typeof ESTILOS_LATERAL)[number];
export const FUNDOS = ["liso", "aurora", "pontilhado"] as const;
export type Fundo = (typeof FUNDOS)[number];

export interface Aparencia {
  acento: IdAcento;
  cantos: Cantos;
  fonte: Fonte;
  /** completo: tudo se mexe (respeitando o "reduzir movimento" do Windows); sutil: só esmaecer, nada desliza; nenhum: nada anima. */
  movimento: Movimento;
  lateral: EstiloLateral;
  fundo: Fundo;
}

export const APARENCIA_PADRAO: Aparencia = { acento: "indigo", cantos: "suaves", fonte: "geist", movimento: "completo", lateral: "solida", fundo: "liso" };

const dentro = <T extends string>(lista: readonly T[], v: unknown, padrao: T): T => (lista.includes(v as T) ? (v as T) : padrao);

/** Aceita qualquer coisa que venha do localStorage e devolve uma aparência válida. */
export function normalizarAparencia(x: unknown): Aparencia {
  const a = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Aparencia, unknown>>;
  return {
    acento: dentro(ACENTOS.map((c) => c.id), a.acento, APARENCIA_PADRAO.acento),
    cantos: dentro(Object.keys(CANTOS) as Cantos[], a.cantos, APARENCIA_PADRAO.cantos),
    fonte: dentro(FONTES, a.fonte, APARENCIA_PADRAO.fonte),
    movimento: dentro(MOVIMENTOS, a.movimento, APARENCIA_PADRAO.movimento),
    lateral: dentro(ESTILOS_LATERAL, a.lateral, APARENCIA_PADRAO.lateral),
    fundo: dentro(FUNDOS, a.fundo, APARENCIA_PADRAO.fundo),
  };
}

/** Aplica a aparência no <html>. Roda no cliente a cada mudança. */
export function aplicarAparencia(a: Aparencia, raiz: HTMLElement = document.documentElement) {
  const cor = ACENTOS.find((c) => c.id === a.acento) ?? ACENTOS[0];
  raiz.style.setProperty("--matiz", String(cor.matiz));
  raiz.style.setProperty("--croma", String(cor.croma));
  raiz.style.setProperty("--radius", CANTOS[a.cantos]);
  raiz.dataset.fonte = a.fonte;
  raiz.dataset.movimento = a.movimento;
  raiz.dataset.lateral = a.lateral;
  raiz.dataset.fundo = a.fundo;
}

/** Mesmo efeito de aplicarAparencia(), em texto, para rodar inline no <head> antes da primeira pintura. */
export const SCRIPT_APARENCIA = `(function(){try{var a=JSON.parse(localStorage.getItem("nexo:aparencia")||"{}")||{};var C=${JSON.stringify(
  Object.fromEntries(ACENTOS.map((c) => [c.id, [c.matiz, c.croma]])),
)},R=${JSON.stringify(CANTOS)},h=document.documentElement,c=C[a.acento]||C.${APARENCIA_PADRAO.acento};h.style.setProperty("--matiz",c[0]);h.style.setProperty("--croma",c[1]);h.style.setProperty("--radius",R[a.cantos]||R.${APARENCIA_PADRAO.cantos});h.dataset.fonte=${JSON.stringify(
  FONTES,
)}.indexOf(a.fonte)<0?"${APARENCIA_PADRAO.fonte}":a.fonte;h.dataset.movimento=${JSON.stringify(MOVIMENTOS)}.indexOf(a.movimento)<0?"${APARENCIA_PADRAO.movimento}":a.movimento;h.dataset.lateral=${JSON.stringify(
  ESTILOS_LATERAL,
)}.indexOf(a.lateral)<0?"${APARENCIA_PADRAO.lateral}":a.lateral;h.dataset.fundo=${JSON.stringify(FUNDOS)}.indexOf(a.fundo)<0?"${APARENCIA_PADRAO.fundo}":a.fundo}catch(_){}})()`;
