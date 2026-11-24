// Levar a personalização para outro computador (3.13): tudo o que é gosto (tema, aparência, barras e a tela
// Hoje) vira um texto que o usuário copia aqui e cola lá. As preferências moram no navegador, então é assim
// que elas viajam; nada disto é dado e nada passa pela pasta de dados.
//
// O texto colado é entrada não confiável: só é lido como JSON e cada parte passa pelo mesmo normalizador,
// com listas fechadas, que já lê o localStorage. Nada do que vem nele vira código, CSS, caminho ou HTML.

import { type Aparencia, normalizarAparencia } from "./aparencia";
import { type Moldura, normalizarMoldura } from "./moldura";
import { type Inicio, type PerfilProprio, normalizarInicio, normalizarPerfis } from "./perfis";
import { type TelaHoje, normalizarTelaHoje } from "./tela-hoje";

export const TEMAS = ["sistema", "claro", "escuro"] as const;
export type TemaGuardado = (typeof TEMAS)[number];

export interface Personalizacao {
  tema: TemaGuardado;
  aparencia: Aparencia;
  moldura: Moldura;
  hoje: TelaHoje;
  /** Desde a 3.20 (código v2): os perfis próprios e qual está em uso. A memória de cada perfil não viaja. */
  perfis?: { ativo: string; proprios: PerfilProprio[] };
  /** A tela em que o app abre (v2). */
  inicio?: Inicio;
  lateralRecolhida?: boolean;
}

const MARCA = "personalizacao";
/** Um código de verdade tem menos de 3 mil caracteres; o teto só evita processar um texto enorme colado por engano. */
export const TAMANHO_MAXIMO = 20_000;

export const normalizarTema = (x: unknown): TemaGuardado => (TEMAS.includes(x as TemaGuardado) ? (x as TemaGuardado) : "sistema");

/** O texto para copiar. */
export function textoDaPersonalizacao(p: Omit<Personalizacao, "inicio" | "lateralRecolhida"> & { inicio?: unknown; lateralRecolhida?: unknown }) {
  const comPerfis = p.perfis ? { perfis: { ativo: p.perfis.ativo, proprios: p.perfis.proprios }, inicio: normalizarInicio(p.inicio), lateralRecolhida: p.lateralRecolhida === true } : {};
  return JSON.stringify({ nexo: MARCA, v: p.perfis ? 2 : 1, tema: p.tema, aparencia: p.aparencia, moldura: p.moldura, hoje: p.hoje, ...comPerfis });
}

/** Lê o texto colado. Devolve a personalização já conferida ou o motivo de não ter servido. */
export function lerPersonalizacao(texto: string): { ok: true; valor: Personalizacao } | { ok: false; erro: string } {
  if (typeof texto !== "string" || !texto.trim()) return { ok: false, erro: "Cole o código copiado no outro computador." };
  if (texto.length > TAMANHO_MAXIMO) return { ok: false, erro: "Esse texto é grande demais para ser um código de personalização." };
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return { ok: false, erro: "Não achei um código de personalização nesse texto. Copie de novo no outro computador." };
  let lido: unknown;
  try {
    lido = JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return { ok: false, erro: "O código veio cortado ou alterado. Copie de novo no outro computador." };
  }
  const x = (lido && typeof lido === "object" && !Array.isArray(lido) ? lido : {}) as Record<string, unknown>;
  if (x.nexo !== MARCA) return { ok: false, erro: "Esse texto não é um código de personalização do Nexo." };
  const valor: Personalizacao = { tema: normalizarTema(x.tema), aparencia: normalizarAparencia(x.aparencia), moldura: normalizarMoldura(x.moldura), hoje: normalizarTelaHoje(x.hoje) };
  // v2: os perfis passam pelo mesmo normalizador do localStorage (ids, nomes, limite de 12, listas fechadas).
  // Um código v1, de antes dos perfis, continua valendo: só não mexe neles.
  if (x.perfis && typeof x.perfis === "object") {
    const lidos = normalizarPerfis({ ...(x.perfis as Record<string, unknown>), memoria: {} });
    valor.perfis = { ativo: lidos.ativo, proprios: lidos.proprios };
    valor.inicio = normalizarInicio(x.inicio);
    valor.lateralRecolhida = x.lateralRecolhida === true;
  }
  return { ok: true, valor };
}
