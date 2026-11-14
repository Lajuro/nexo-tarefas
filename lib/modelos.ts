// Modelos de tarefa: o esqueleto de uma demanda que se repete. Funções puras (a tela está em components/Modelos.tsx).

import { Modelo, Registro, Tarefa, agoraISO, hojeISO, normalizarModelo, normalizarRegistro, novoId } from "./tipos";

const MAX_PASSOS = 40;

/** Um passo por linha. Tira marcadores de lista ("- ", "* ", "1. ", "[ ] "), linhas vazias e repetidas. */
export function passosDoTexto(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const bruta of texto.split("\n")) {
    const linha = bruta.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)?(?:\[[ xX]?\]\s*)?/, "").trim().replace(/\s+/g, " ");
    const chave = linha.toLowerCase();
    if (!linha || vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(linha.slice(0, 300));
    if (out.length >= MAX_PASSOS) break;
  }
  return out;
}

/** Ponto de partida de um modelo tirado de uma tarefa que já existe: campos e todos os passos, na ordem em que apareceram. */
export function modeloDaTarefa(t: Tarefa): Modelo {
  const passos = passosDoTexto(
    [...t.registros]
      .sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm))
      .flatMap((r) => r.proximosPassos.map((p) => p.texto))
      .join("\n"),
  );
  return normalizarModelo({
    id: novoId("mo"),
    nome: t.titulo,
    titulo: t.titulo,
    descricao: t.descricao,
    categoriaId: t.categoriaId,
    prioridade: t.prioridade,
    tags: t.tags,
    passos,
  });
}

/** Registro que leva os passos do modelo para a tarefa nova (é ele que faz os passos aparecerem em Pendências). */
export function registroDosPassos(modelo: Pick<Modelo, "nome">, passos: string[]): Registro | null {
  if (passos.length === 0) return null;
  const agora = agoraISO();
  return normalizarRegistro({
    tipo: "nota",
    data: hojeISO(),
    titulo: `Passos do modelo “${modelo.nome}”`,
    proximosPassos: passos.map((texto) => ({ id: novoId("p"), texto, feito: false })),
    criadoEm: agora,
    atualizadoEm: agora,
  });
}

/** Modelos mais usados primeiro; empate pelo nome. */
export const porUso = (a: Modelo, b: Modelo) => (b.usos ?? 0) - (a.usos ?? 0) || a.nome.localeCompare(b.nome);
