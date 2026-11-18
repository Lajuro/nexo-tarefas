// Dependências entre tarefas: "T3 depende de T7". O vínculo mora na tarefa que espera (tarefa.dependeDe,
// lista de ids, campo opcional). O resto é conta feita na hora: quem segura quem, o que destravou e se
// um vínculo novo fecharia um ciclo. Funções puras.

import { dataLocal } from "./lembretes";
import { MAX_DEPENDENCIAS, STATUS_ABERTOS, type Tarefa } from "./tipos";

export { MAX_DEPENDENCIAS, normalizarDependencias } from "./tipos";

const aberta = (t: Tarefa) => STATUS_ABERTOS.includes(t.status);

export interface Dependencias {
  /** Ainda abertas: são elas que seguram a tarefa. */
  abertas: Tarefa[];
  /** Concluídas ou canceladas: não seguram mais. */
  fechadas: Tarefa[];
  /** Ids que não existem mais (a tarefa foi para a lixeira). */
  sumidas: string[];
}

export function dependenciasDe(t: Tarefa, tarefas: Tarefa[]): Dependencias {
  const porId = new Map(tarefas.map((x) => [x.id, x]));
  const out: Dependencias = { abertas: [], fechadas: [], sumidas: [] };
  for (const id of t.dependeDe ?? []) {
    const d = porId.get(id);
    if (!d) out.sumidas.push(id);
    else if (aberta(d)) out.abertas.push(d);
    else out.fechadas.push(d);
  }
  return out;
}

/** As tarefas que dependem desta (que ela está segurando). */
export const quemDependeDe = (id: string, tarefas: Tarefa[]) => tarefas.filter((t) => (t.dependeDe ?? []).includes(id));

/** Ligar `de` → `para` fecharia um ciclo? (para já depende, direta ou indiretamente, de `de`) */
export function criaCiclo(tarefas: Tarefa[], de: string, para: string): boolean {
  if (de === para) return true;
  const porId = new Map(tarefas.map((x) => [x.id, x]));
  const vistos = new Set<string>();
  const fila = [para];
  while (fila.length) {
    const atual = fila.pop()!;
    if (atual === de) return true;
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    for (const prox of porId.get(atual)?.dependeDe ?? []) fila.push(prox);
  }
  return false;
}

/** Acrescenta ou tira uma dependência. Não deixa ligar a si mesma; o ciclo é conferido por quem chama (criaCiclo). */
export function comDependencia(t: Tarefa, id: string, ligar: boolean): Tarefa {
  const atual = t.dependeDe ?? [];
  if (ligar) {
    if (id === t.id || atual.includes(id) || atual.length >= MAX_DEPENDENCIAS) return t;
    return { ...t, dependeDe: [...atual, id] };
  }
  return { ...t, dependeDe: atual.filter((x) => x !== id) };
}

/** Quantos dias depois da última dependência fechar a tarefa ainda aparece como "destravou". */
export const DIAS_DESTRAVOU = 7;

/**
 * A tarefa aberta que dependia de outras e todas já fecharam: destravou. Devolve a data em que destravou
 * (a última conclusão), ou "" se ela continua presa ou não depende de nada que exista.
 */
export function destravouEm(t: Tarefa, tarefas: Tarefa[]): string {
  if (!aberta(t) || !(t.dependeDe ?? []).length) return "";
  const d = dependenciasDe(t, tarefas);
  if (d.abertas.length || !d.fechadas.length) return "";
  return d.fechadas.map((x) => dataLocal(x.concluidaEm || x.atualizadaEm)).sort().at(-1) ?? "";
}
