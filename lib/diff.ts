// Comparação de duas versões de um texto (3.7): o que saiu, o que entrou e o que ficou igual, linha a linha,
// com as palavras que mudaram destacadas dentro das linhas alteradas. Feito em casa (maior subsequência comum),
// sem biblioteca. Função pura: a tela está em components/paginas/Historico.tsx.

export type TipoDiff = "igual" | "saiu" | "entrou";

export interface PedacoDePalavra { tipo: TipoDiff; texto: string }

export interface LinhaDiff {
  tipo: TipoDiff;
  texto: string;
  /** Linha alterada que tem par do outro lado: as palavras que mudaram vêm marcadas. */
  palavras?: PedacoDePalavra[];
}

/** Acima disso a tabela da subsequência comum fica pesada: o miolo diferente é mostrado como "saiu tudo, entrou tudo". */
const LIMITE_CELULAS = 4_000_000;

/** Diferença genérica entre duas listas (iguais por ===), aparando começo e fim iguais antes da tabela. */
function diffDeListas<T>(a: T[], b: T[]): { tipo: TipoDiff; item: T }[] {
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > ini && fimB > ini && a[fimA - 1] === b[fimB - 1]) { fimA--; fimB--; }
  const antes = a.slice(0, ini).map((item) => ({ tipo: "igual" as const, item }));
  const depois = a.slice(fimA).map((item) => ({ tipo: "igual" as const, item }));
  const x = a.slice(ini, fimA);
  const y = b.slice(ini, fimB);
  const meio: { tipo: TipoDiff; item: T }[] = [];
  if ((x.length + 1) * (y.length + 1) > LIMITE_CELULAS) {
    meio.push(...x.map((item) => ({ tipo: "saiu" as const, item })), ...y.map((item) => ({ tipo: "entrou" as const, item })));
  } else {
    // tabela da maior subsequência comum, de trás para frente
    const n = x.length;
    const m = y.length;
    const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { meio.push({ tipo: "igual", item: x[i] }); i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) meio.push({ tipo: "saiu", item: x[i++] });
      else meio.push({ tipo: "entrou", item: y[j++] });
    }
    while (i < n) meio.push({ tipo: "saiu", item: x[i++] });
    while (j < m) meio.push({ tipo: "entrou", item: y[j++] });
  }
  return [...antes, ...meio, ...depois];
}

/** Palavras e os espaços entre elas (os espaços também são pedaços, para o texto voltar igual). */
const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

export function diffDePalavras(a: string, b: string): PedacoDePalavra[] {
  const out: PedacoDePalavra[] = [];
  for (const { tipo, item } of diffDeListas(tokens(a), tokens(b))) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.texto += item;
    else out.push({ tipo, texto: item });
  }
  return out;
}

/**
 * Diferença linha a linha de `antes` para `depois`. Num trecho em que saem e entram linhas, as que
 * ficam frente a frente ganham a diferença por palavra (para achar a vírgula que mudou numa linha longa).
 */
export function diffDeTexto(antes: string, depois: string): LinhaDiff[] {
  const a = (antes ?? "").replace(/\r\n?/g, "\n").split("\n");
  const b = (depois ?? "").replace(/\r\n?/g, "\n").split("\n");
  const brutas = diffDeListas(a, b).map(({ tipo, item }) => ({ tipo, texto: item }) as LinhaDiff);
  // pareia blocos "saiu... entrou..." vizinhos
  for (let i = 0; i < brutas.length; ) {
    if (brutas[i].tipo !== "saiu") { i++; continue; }
    let s = i;
    while (s < brutas.length && brutas[s].tipo === "saiu") s++;
    let e = s;
    while (e < brutas.length && brutas[e].tipo === "entrou") e++;
    const pares = Math.min(s - i, e - s);
    for (let k = 0; k < pares; k++) {
      const saiu = brutas[i + k];
      const entrou = brutas[s + k];
      if (saiu.texto.length + entrou.texto.length > 4000) continue;
      const p = diffDePalavras(saiu.texto, entrou.texto);
      saiu.palavras = p.filter((x) => x.tipo !== "entrou");
      entrou.palavras = p.filter((x) => x.tipo !== "saiu");
    }
    i = e;
  }
  return brutas;
}

export interface ResumoDoDiff { entraram: number; sairam: number; iguais: number }

export const resumoDoDiff = (linhas: LinhaDiff[]): ResumoDoDiff => ({
  entraram: linhas.filter((l) => l.tipo === "entrou").length,
  sairam: linhas.filter((l) => l.tipo === "saiu").length,
  iguais: linhas.filter((l) => l.tipo === "igual").length,
});

/** Para mostrar: trechos iguais longos viram "N linhas iguais" (fica o contexto de `contexto` linhas de cada lado). */
export function comTrechosRecolhidos(linhas: LinhaDiff[], contexto = 2): (LinhaDiff | { tipo: "recolhido"; quantas: number })[] {
  const out: (LinhaDiff | { tipo: "recolhido"; quantas: number })[] = [];
  for (let i = 0; i < linhas.length; ) {
    if (linhas[i].tipo !== "igual") { out.push(linhas[i++]); continue; }
    let f = i;
    while (f < linhas.length && linhas[f].tipo === "igual") f++;
    const n = f - i;
    const primeiro = i === 0;
    const ultimo = f === linhas.length;
    const manterAntes = primeiro ? 0 : contexto;
    const manterDepois = ultimo ? 0 : contexto;
    if (n > manterAntes + manterDepois + 2) {
      out.push(...linhas.slice(i, i + manterAntes), { tipo: "recolhido", quantas: n - manterAntes - manterDepois }, ...linhas.slice(f - manterDepois, f));
    } else out.push(...linhas.slice(i, f));
    i = f;
  }
  return out;
}
