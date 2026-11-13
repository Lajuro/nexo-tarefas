// Contas da revisão semanal: o "retrato" de cada tarefa quando a revisão começa
// (para depois dizer o que mudou) e o resumo dos últimos 7 dias. Funções puras.

import { ehFocoHoje } from "@/lib/acoes";
import { aberta, dataLocal, diasSemAtividade } from "@/lib/lembretes";
import { Status, Tarefa, formatarData, hojeISO, nomeStatus } from "@/lib/tipos";

/** Como a tarefa estava quando a revisão começou. */
export interface Retrato {
  status: Status;
  prioridade: number;
  prazo: string | null;
  lembrarEm: string | null;
  foco: boolean;
  /** IDs dos próximos passos que estavam em aberto. */
  passosAbertos: string[];
  /** Registros feitos pelo usuário (sem contar marcos do sistema). */
  registros: number;
  /** Dias sem atividade no começo da revisão (não muda enquanto o usuário mexe). */
  parado: number;
}

const registrosProprios = (t: Tarefa) => t.registros.filter((r) => r.tipo !== "marco").length;

export function tirarRetrato(t: Tarefa): Retrato {
  return {
    status: t.status,
    prioridade: t.prioridade,
    prazo: t.prazo,
    lembrarEm: t.lembrarEm ?? null,
    foco: ehFocoHoje(t),
    passosAbertos: t.registros.flatMap((r) => r.proximosPassos.filter((p) => !p.feito).map((p) => p.id)),
    registros: registrosProprios(t),
    parado: diasSemAtividade(t),
  };
}

/** Tarefas abertas, das mais esquecidas para as mais recentes (empate: a mais prioritária primeiro). */
export function filaDeRevisao(tarefas: Tarefa[]): Tarefa[] {
  return tarefas
    .filter(aberta)
    .sort((a, b) => diasSemAtividade(b) - diasSemAtividade(a) || b.prioridade - a.prioridade || a.titulo.localeCompare(b.titulo));
}

export interface Mudancas {
  /** Frases curtas do que mudou. Vazio = a tarefa ficou como estava. */
  itens: string[];
  /** Passos que estavam abertos e foram concluídos durante a revisão. */
  passosConcluidos: number;
}

/** Compara a tarefa de agora com o retrato do começo. `agora` indefinida = foi para a lixeira. */
export function mudancasDesde(antes: Retrato, agora: Tarefa | undefined): Mudancas {
  if (!agora) return { itens: ["Movida para a lixeira"], passosConcluidos: 0 };
  const itens: string[] = [];
  if (agora.status !== antes.status) itens.push(`Status: ${nomeStatus(antes.status)} → ${nomeStatus(agora.status)}`);
  if (agora.prioridade !== antes.prioridade) itens.push(`Prioridade: ${antes.prioridade} → ${agora.prioridade}`);
  if (agora.prazo !== antes.prazo) {
    itens.push(
      !agora.prazo ? "Prazo removido"
        : antes.prazo ? `Prazo: ${formatarData(antes.prazo)} → ${formatarData(agora.prazo)}`
        : `Prazo definido para ${formatarData(agora.prazo)}`,
    );
  }
  const lembrar = agora.lembrarEm ?? null;
  if (lembrar !== antes.lembrarEm) itens.push(lembrar ? `Follow-up marcado para ${formatarData(lembrar)}` : "Follow-up removido");
  const foco = ehFocoHoje(agora);
  if (foco !== antes.foco) itens.push(foco ? "Entrou no foco de hoje" : "Saiu do foco de hoje");

  const eramAbertos = new Set(antes.passosAbertos);
  let passosConcluidos = 0;
  for (const r of agora.registros) for (const p of r.proximosPassos) if (p.feito && eramAbertos.has(p.id)) passosConcluidos++;
  if (passosConcluidos) itens.push(passosConcluidos === 1 ? "1 passo concluído" : `${passosConcluidos} passos concluídos`);

  const novos = registrosProprios(agora) - antes.registros;
  if (novos > 0) itens.push(novos === 1 ? "1 registro novo" : `${novos} registros novos`);
  return { itens, passosConcluidos };
}

export interface RetratoSemana {
  concluidas: number;
  registros: number;
  passos: number;
  criadas: number;
  /** Primeiro dia da janela (hoje menos 6). */
  desde: string;
}

/** O que andou nos últimos 7 dias (contando hoje). */
export function retratoDaSemana(tarefas: Tarefa[]): RetratoSemana {
  const hoje = hojeISO();
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const desde = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const dentro = (data: string) => Boolean(data) && data >= desde && data <= hoje;

  const out: RetratoSemana = { concluidas: 0, registros: 0, passos: 0, criadas: 0, desde };
  for (const t of tarefas) {
    if (dentro(dataLocal(t.criadaEm))) out.criadas++;
    if (t.status === "concluida" && dentro(dataLocal(t.concluidaEm))) out.concluidas++;
    for (const r of t.registros) {
      if (r.tipo !== "marco" && dentro(r.data)) out.registros++;
      for (const p of r.proximosPassos) if (p.feito && dentro(dataLocal(p.feitoEm))) out.passos++;
    }
  }
  return out;
}
