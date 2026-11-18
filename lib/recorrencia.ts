// Tarefas que se repetem: um modelo com `repetir` (lib/tipos.ts, RepeticaoDoModelo) lembra de criar uma
// tarefa dele no dia certo. O app nunca cria sozinho: o lembrete traz "Criar agora" e "Pular esta vez",
// e as duas coisas só anotam qual ocorrência foi atendida (`repetir.ultima`). Funções puras.

import type { Modelo, RepeticaoDoModelo } from "./tipos";

const p2 = (n: number) => String(n).padStart(2, "0");
const deIso = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
};
const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const somar = (s: string, n: number) => {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const diasEntre = (a: string, b: string) => Math.round((deIso(b).getTime() - deIso(a).getTime()) / 86_400_000);

/** A data daquele dia do mês, ou o último dia do mês se ele for mais curto (dia 31 em fevereiro = 28 ou 29). */
function diaNoMes(ano: number, mes: number, dia: number) {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return iso(new Date(ano, mes, Math.min(dia, ultimo)));
}

/** A primeira ocorrência que cai em `data` ou depois. */
export function ocorrenciaEmOuDepois(r: RepeticaoDoModelo, data: string): string {
  const base = data < r.desde ? r.desde : data;
  if (r.tipo === "semana") {
    const dia = r.diaDaSemana ?? 1;
    return somar(base, (dia - deIso(base).getDay() + 7) % 7);
  }
  if (r.tipo === "mes") {
    const d = deIso(base);
    const neste = diaNoMes(d.getFullYear(), d.getMonth(), r.diaDoMes ?? 1);
    return neste >= base ? neste : diaNoMes(d.getFullYear(), d.getMonth() + 1, r.diaDoMes ?? 1);
  }
  const cada = Math.max(1, r.cadaDias ?? 7);
  const passados = Math.max(0, diasEntre(r.desde, base));
  return somar(r.desde, Math.ceil(passados / cada) * cada);
}

/** A última ocorrência que cai em `data` ou antes (vazio se ainda não houve nenhuma desde `desde`). */
export function ocorrenciaEmOuAntes(r: RepeticaoDoModelo, data: string): string {
  if (data < r.desde) return "";
  if (r.tipo === "semana") {
    const dia = r.diaDaSemana ?? 1;
    const x = somar(data, -((deIso(data).getDay() - dia + 7) % 7));
    return x >= r.desde ? x : "";
  }
  if (r.tipo === "mes") {
    const d = deIso(data);
    const neste = diaNoMes(d.getFullYear(), d.getMonth(), r.diaDoMes ?? 1);
    const x = neste <= data ? neste : diaNoMes(d.getFullYear(), d.getMonth() - 1, r.diaDoMes ?? 1);
    return x >= r.desde ? x : "";
  }
  const cada = Math.max(1, r.cadaDias ?? 7);
  return somar(r.desde, Math.floor(diasEntre(r.desde, data) / cada) * cada);
}

/**
 * A ocorrência que está esperando o usuário: a mais recente até hoje que ainda não foi atendida.
 * Várias perdidas (férias) viram UMA: o lembrete é da mais recente, não uma fila de atrasadas.
 */
export function ocorrenciaDevida(r: RepeticaoDoModelo | null | undefined, hoje: string): string {
  if (!r) return "";
  const x = ocorrenciaEmOuAntes(r, hoje);
  if (!x || (r.ultima && r.ultima >= x)) return "";
  return x;
}

/** A próxima ocorrência: a que está esperando, ou a primeira depois de hoje (para mostrar "próxima: seg, 24/11"). */
export function proximaOcorrencia(r: RepeticaoDoModelo, hoje: string): string {
  return ocorrenciaDevida(r, hoje) || ocorrenciaEmOuDepois(r, somar(hoje, 1));
}

/** Anota que uma ocorrência foi atendida (criada ou pulada). Nunca volta atrás. */
export function comOcorrenciaAtendida(m: Modelo, data: string): Modelo {
  const r = m.repetir;
  if (!r || !data) return m;
  return { ...m, repetir: { ...r, ultima: r.ultima && r.ultima > data ? r.ultima : data } };
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "Toda segunda", "Todo dia 5 do mês", "A cada 14 dias". */
export function textoDaRepeticao(r: RepeticaoDoModelo): string {
  if (r.tipo === "semana") {
    const d = r.diaDaSemana ?? 1;
    return `${d === 0 || d === 6 ? "Todo" : "Toda"} ${DIAS[d]}`;
  }
  if (r.tipo === "mes") return `Todo dia ${r.diaDoMes ?? 1} do mês`;
  return r.cadaDias === 1 ? "Todo dia" : `A cada ${r.cadaDias ?? 7} dias`;
}

/** Os modelos com uma ocorrência esperando hoje. */
export function recorrenciasDevidas(modelos: Modelo[], hoje: string): { modelo: Modelo; data: string }[] {
  return modelos.flatMap((modelo) => {
    const data = ocorrenciaDevida(modelo.repetir, hoje);
    return data ? [{ modelo, data }] : [];
  });
}
