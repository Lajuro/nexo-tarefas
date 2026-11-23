// Importar de volta um arquivo exportado (nexo-export-*.json), 3.17.
//
// Importar SOMA: o que está no arquivo e não está aqui, entra. Nada do que está aqui é apagado por uma
// importação, e nada vai para a lixeira. A única coisa que pode mudar o que já existe é o conflito, quando o
// mesmo id está nos dois lados com conteúdo diferente. Aí quem decide é o usuário, com uma escolha para a
// importação inteira:
//   - "manter"  (padrão): fica o que está aqui; o do arquivo é ignorado;
//   - "recente": fica o lado que foi mexido por último;
//   - "arquivo": fica o do arquivo.
// Restaurar um backup é outra coisa (lib/armazenamento.ts, restaurarBackup): lá os dados VOLTAM a ser o backup,
// e o que foi criado depois vai para a lixeira.
//
// O arquivo é entrada não confiável: tamanho com teto, JSON conferido, ids no formato dos ids do app (o id vira
// nome de arquivo no caso da tarefa), dia da rotina só com data de verdade. Tudo passa pelos normalizadores de
// lib/tipos.ts antes de ser comparado ou gravado. Aqui não há disco: quem lê e grava é lib/armazenamento.ts.
//
// Funções puras, testadas em testes/importar.test.mjs.

import {
  ID_CONFIG_JORNADA, ID_VALIDO, dataReal, normalizarAssunto, normalizarCategoria, normalizarItemDaJornada, normalizarLink, normalizarModelo, normalizarNota,
  normalizarPagina, normalizarPessoa, normalizarTarefa, normalizarTime,
} from "./tipos";

/** As coleções de arquivo único, na ordem em que a prévia mostra (as mesmas de COLECOES em lib/armazenamento.ts). */
export const COLECOES_IMPORTAVEIS = ["categorias", "links", "pessoas", "times", "notas", "modelos", "paginas", "jornada", "assuntos"] as const;
export type ColecaoImportavel = (typeof COLECOES_IMPORTAVEIS)[number];
export type GrupoImportavel = "tarefas" | ColecaoImportavel;
export const GRUPOS_IMPORTAVEIS: GrupoImportavel[] = ["tarefas", ...COLECOES_IMPORTAVEIS];

export type ModoDeImportacao = "manter" | "recente" | "arquivo";
export const MODOS_DE_IMPORTACAO: ModoDeImportacao[] = ["manter", "recente", "arquivo"];
export const ehModoDeImportacao = (v: unknown): v is ModoDeImportacao => MODOS_DE_IMPORTACAO.includes(v as ModoDeImportacao);

/** Teto do arquivo lido (o JSON de um ano de uso intenso tem perto de 10 MB). */
export const MAX_BYTES_DA_IMPORTACAO = 80 * 1024 * 1024;
/** Teto de itens por grupo: acima disso o arquivo não é um export do Nexo. */
const MAX_ITENS = 100_000;

type Bruto = Record<string, unknown>;

/** Os carimbos de criação e de alteração de um item (o nome muda com o gênero da coleção). */
const CARIMBOS = ["criadaEm", "criadoEm", "atualizadaEm", "atualizadoEm"] as const;

// O normalizador de cada grupo. Devolve o item como o app o gravaria, preservando campos que não conhece.
const NORMALIZAR: Record<GrupoImportavel, (x: Bruto) => Bruto> = {
  tarefas: (x) => normalizarTarefa(x as never) as Bruto,
  categorias: (x) => normalizarCategoria(x as never) as Bruto,
  links: (x) => normalizarLink(x as never) as Bruto,
  pessoas: (x) => normalizarPessoa(x as never) as Bruto,
  times: (x) => normalizarTime(x as never) as Bruto,
  notas: (x) => normalizarNota(x as never) as Bruto,
  modelos: (x) => normalizarModelo(x as never) as Bruto,
  paginas: (x) => normalizarPagina(x as never) as Bruto,
  jornada: (x) => normalizarItemDaJornada(x as never) as unknown as Bruto,
  assuntos: (x) => normalizarAssunto(x as never) as Bruto,
};

export interface ArquivoExportado {
  /** Versão do formato dos dados de onde o arquivo saiu (null = o arquivo não diz). */
  schema: number | null;
  exportadoEm: string | null;
  /** Os itens de cada grupo, já normalizados, com id válido e sem repetir. */
  grupos: Record<GrupoImportavel, Bruto[]>;
  /** Quantos itens do arquivo foram deixados de fora (sem id válido, id repetido, dia da rotina que não é data). */
  ignorados: number;
}

const ehObjeto = (x: unknown): x is Bruto => !!x && typeof x === "object" && !Array.isArray(x);

/** O id serve para este grupo? Tarefa e coleções: o formato dos ids do app. Rotina: uma data de verdade ou "config". */
function idServe(grupo: GrupoImportavel, id: unknown): id is string {
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return false;
  return grupo !== "jornada" || id === ID_CONFIG_JORNADA || dataReal(id);
}

/**
 * Lê o texto de um nexo-export-*.json. Lança erro com mensagem para o usuário se o arquivo não é um export do
 * Nexo. Item sem id válido fica de fora e é contado em `ignorados`: o resto do arquivo continua valendo.
 */
export function lerExportacao(texto: string): ArquivoExportado {
  if (typeof texto !== "string" || !texto.trim()) throw new Error("O arquivo está vazio.");
  if (texto.length > MAX_BYTES_DA_IMPORTACAO) throw new Error("O arquivo é grande demais para ser um export do Nexo.");
  let j: unknown;
  try {
    j = JSON.parse(texto.replace(/^﻿/, ""));
  } catch {
    throw new Error("O arquivo não é um JSON válido. Use o arquivo gerado por “Exportar tudo (JSON)”, sem editar.");
  }
  if (!ehObjeto(j) || (!Array.isArray(j.tarefas) && !COLECOES_IMPORTAVEIS.some((c) => ehObjeto(j[c])))) {
    throw new Error("Este arquivo não parece um export do Nexo (faltam as tarefas e as coleções). Use o arquivo gerado por “Exportar tudo (JSON)”.");
  }

  // Item do arquivo sem data de criação ou de alteração (arquivo montado à mão; o export do app sempre tem): o
  // normalizador inventaria "agora" a cada leitura, e o mesmo arquivo importado duas vezes pareceria diferente, e
  // mais novo, a cada vez. A data que falta passa a ser a do export, que é fixa (sem ela, uma data antiga, para
  // o item nunca ganhar de quem está aqui no modo "o mais recente").
  const exportadoEm = typeof j.exportadoEm === "string" && !Number.isNaN(Date.parse(j.exportadoEm)) ? new Date(j.exportadoEm).toISOString() : null;
  const dataPadrao = exportadoEm ?? "2000-01-01T00:00:00.000Z";
  const normalizar = (grupo: GrupoImportavel, x: Bruto): Bruto => {
    const n = NORMALIZAR[grupo](x);
    for (const k of CARIMBOS) if (typeof n[k] === "string" && !(typeof x[k] === "string" && x[k])) n[k] = dataPadrao;
    return n;
  };

  let ignorados = 0;
  const grupos = {} as Record<GrupoImportavel, Bruto[]>;
  for (const grupo of GRUPOS_IMPORTAVEIS) {
    const bruto = grupo === "tarefas" ? j.tarefas : ehObjeto(j[grupo]) ? (j[grupo] as Bruto).items : undefined;
    const lista = Array.isArray(bruto) ? bruto : [];
    if (lista.length > MAX_ITENS) throw new Error(`O arquivo tem itens demais em “${grupo}” para ser um export do Nexo.`);
    const vistos = new Set<string>();
    const out: Bruto[] = [];
    for (const x of lista) {
      if (!ehObjeto(x) || !idServe(grupo, x.id) || vistos.has(x.id)) { ignorados++; continue; }
      vistos.add(x.id);
      out.push(normalizar(grupo, x));
    }
    grupos[grupo] = out;
  }
  const schema = Number(j.schema);
  return {
    schema: j.schema != null && Number.isFinite(schema) ? schema : null,
    exportadoEm,
    grupos,
    ignorados,
  };
}

// ---------- comparar com o que está aqui ----------

/** JSON com as chaves em ordem, para dois objetos iguais darem o mesmo texto seja qual for a ordem em que foram gravados. */
function emOrdem(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(emOrdem);
  if (!ehObjeto(v)) return v;
  const out: Bruto = {};
  for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = emOrdem(v[k]);
  return out;
}

/** O que importa num item para dizer se ele mudou: tudo menos o número da revisão e o carimbo de gravação. */
const miolo = (x: Bruto) => JSON.stringify(emOrdem({ ...x, rev: 0, atualizadaEm: "", atualizadoEm: "" }));

/** Quando o item foi mexido pela última vez (carimbo ISO; "" se ele não diz). */
export const mexidoEm = (x: Bruto): string => {
  for (const k of ["atualizadaEm", "atualizadoEm", "criadaEm", "criadoEm"]) if (typeof x[k] === "string" && x[k]) return x[k] as string;
  return "";
};

/** O nome de um item para mostrar na prévia. */
export function tituloDoItem(grupo: GrupoImportavel, x: Bruto): string {
  const s = (k: string) => (typeof x[k] === "string" ? (x[k] as string).replace(/\s+/g, " ").trim() : "");
  const nome =
    grupo === "tarefas" || grupo === "links" || grupo === "notas" || grupo === "paginas" ? s("titulo")
    : grupo === "assuntos" ? [s("pessoa"), s("texto")].filter(Boolean).join(": ")
    : grupo === "jornada" ? (x.id === ID_CONFIG_JORNADA ? "Configuração da jornada" : `Dia ${String(x.id).split("-").reverse().join("/")}`)
    : s("nome");
  return (nome || "(sem título)").slice(0, 160);
}

export interface ItemDaPrevia { id: string; titulo: string }
export interface ConflitoDaPrevia extends ItemDaPrevia {
  /** Qual lado foi mexido por último ("empate": os dois dizem o mesmo carimbo, ou nenhum diz). */
  maisNovo: "arquivo" | "aqui" | "empate";
}

export interface GrupoDaPrevia {
  grupo: GrupoImportavel;
  /** Quantos itens o arquivo traz neste grupo. */
  noArquivo: number;
  /** Estão no arquivo e não estão aqui: entram sempre. */
  entram: ItemDaPrevia[];
  /** Estão nos dois lados com conteúdo diferente: o modo decide. */
  conflitos: ConflitoDaPrevia[];
  /** Estão nos dois lados e são iguais. */
  iguais: number;
  /** O arquivo deste grupo, aqui na pasta, não pôde ser lido: nada dele é importado enquanto isso não for resolvido. */
  ilegivelAqui: boolean;
}

/** O que está na pasta hoje, como está no disco. `null` num grupo = o arquivo dele está ilegível. */
export type DadosDaqui = Record<GrupoImportavel, Bruto[] | null>;

/** O conflito troca o que está aqui pelo do arquivo, neste modo? */
export const trocaNoModo = (c: Pick<ConflitoDaPrevia, "maisNovo">, modo: ModoDeImportacao) =>
  modo === "arquivo" || (modo === "recente" && c.maisNovo === "arquivo");

/** O que mudaria se o arquivo fosse importado. Não grava nada. */
export function previaDaImportacao(arquivo: ArquivoExportado, aqui: DadosDaqui): GrupoDaPrevia[] {
  return GRUPOS_IMPORTAVEIS.map((grupo) => {
    const itens = arquivo.grupos[grupo];
    const atuais = aqui[grupo];
    const p: GrupoDaPrevia = { grupo, noArquivo: itens.length, entram: [], conflitos: [], iguais: 0, ilegivelAqui: atuais === null };
    if (atuais === null) return p;
    const porId = new Map<string, Bruto>();
    for (const a of atuais) if (ehObjeto(a) && typeof a.id === "string") porId.set(a.id, a);
    for (const x of itens) {
      const id = x.id as string;
      const atual = porId.get(id);
      if (!atual) { p.entram.push({ id, titulo: tituloDoItem(grupo, x) }); continue; }
      const daqui = NORMALIZAR[grupo](atual);
      // Item gravado à mão, sem a data de criação: o normalizador inventa uma na hora da leitura (agora), e ela
      // nunca bateria com a que o export inventou quando foi gerado. Data que o disco não tem não é diferença.
      for (const k of ["criadaEm", "criadoEm"]) if (!(typeof atual[k] === "string" && atual[k]) && k in x) daqui[k] = x[k];
      if (miolo(daqui) === miolo(x)) { p.iguais++; continue; }
      const [a, b] = [mexidoEm(x), mexidoEm(daqui)];
      p.conflitos.push({ id, titulo: tituloDoItem(grupo, x), maisNovo: a > b ? "arquivo" : a < b ? "aqui" : "empate" });
    }
    return p;
  });
}

export interface PlanoDoGrupo {
  grupo: GrupoImportavel;
  /** Itens novos, na ordem do arquivo. */
  entram: Bruto[];
  /** Itens que substituem o que está aqui (mesmo id). */
  trocam: Bruto[];
  /** Conflitos em que ficou o que está aqui. */
  mantidos: number;
}

/**
 * O que gravar: de cada grupo, o que entra e o que troca, pelo modo escolhido. Grupo ilegível aqui não entra
 * no plano (quem chama recusa a importação se ele tinha algo a trazer).
 */
export function planoDaImportacao(arquivo: ArquivoExportado, aqui: DadosDaqui, modo: ModoDeImportacao): PlanoDoGrupo[] {
  const previa = previaDaImportacao(arquivo, aqui);
  return previa.filter((p) => !p.ilegivelAqui).map((p) => {
    const doArquivo = new Map(arquivo.grupos[p.grupo].map((x) => [x.id as string, x]));
    const trocam = p.conflitos.filter((c) => trocaNoModo(c, modo));
    return {
      grupo: p.grupo,
      entram: p.entram.map((i) => doArquivo.get(i.id)!),
      trocam: trocam.map((i) => doArquivo.get(i.id)!),
      mantidos: p.conflitos.length - trocam.length,
    };
  });
}

/** A lista de uma coleção depois da importação: o que estava aqui na mesma ordem (trocando os conflitos) e, no fim, o que entra. */
export function colecaoComPlano(atuais: Bruto[], plano: Pick<PlanoDoGrupo, "entram" | "trocam">): Bruto[] {
  const trocas = new Map(plano.trocam.map((x) => [x.id as string, x]));
  return [...atuais.map((a) => trocas.get(a.id as string) ?? a), ...plano.entram];
}

/** A prévia de um grupo em números, com alguns nomes de exemplo: é o que vai para a tela (a lista inteira pode ter milhares de itens). */
export interface ResumoDoGrupo {
  grupo: GrupoImportavel;
  noArquivo: number;
  entram: number;
  exemplosDeEntrada: string[];
  conflitos: number;
  /** Dos conflitos, em quantos o lado do arquivo foi mexido por último (é o que troca no modo "recente"). */
  maisNovosNoArquivo: number;
  exemplosDeConflito: string[];
  iguais: number;
  ilegivelAqui: boolean;
}

export const resumoDaPrevia = (previa: GrupoDaPrevia[], exemplos = 6): ResumoDoGrupo[] =>
  previa.map((p) => ({
    grupo: p.grupo,
    noArquivo: p.noArquivo,
    entram: p.entram.length,
    exemplosDeEntrada: p.entram.slice(0, exemplos).map((i) => i.titulo),
    conflitos: p.conflitos.length,
    maisNovosNoArquivo: p.conflitos.filter((c) => c.maisNovo === "arquivo").length,
    exemplosDeConflito: p.conflitos.slice(0, exemplos).map((i) => i.titulo),
    iguais: p.iguais,
    ilegivelAqui: p.ilegivelAqui,
  }));

/** Quantos conflitos de um grupo trocam o que está aqui, no modo escolhido (a mesma conta de trocaNoModo, sobre o resumo). */
export const trocasNoResumo = (r: Pick<ResumoDoGrupo, "conflitos" | "maisNovosNoArquivo">, modo: ModoDeImportacao) =>
  modo === "arquivo" ? r.conflitos : modo === "recente" ? r.maisNovosNoArquivo : 0;

/** Os grupos que o arquivo queria mudar e não pôde, porque o arquivo deles nesta pasta está ilegível. */
export const gruposTravados = (previa: GrupoDaPrevia[]) => previa.filter((p) => p.ilegivelAqui && p.noArquivo > 0).map((p) => p.grupo);

/** Totais da prévia num modo: quantos itens entram, quantos trocam e quantos ficam como estão aqui. */
export function totaisDaPrevia(previa: GrupoDaPrevia[], modo: ModoDeImportacao) {
  let entram = 0, trocam = 0, mantidos = 0, iguais = 0;
  for (const p of previa) {
    entram += p.entram.length;
    iguais += p.iguais;
    for (const c of p.conflitos) trocaNoModo(c, modo) ? trocam++ : mantidos++;
  }
  return { entram, trocam, mantidos, iguais };
}
