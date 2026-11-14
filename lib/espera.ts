// "Esperando quem?": quando a tarefa está aguardando terceiros, o app guarda de quem e o quê
// (tarefa.esperando), conta os dias e ajuda a cobrar. Funções puras, usadas na tela e nos lembretes.

import { type Tarefa, diasAte, formatarData } from "./tipos";

/** Dias desde a última cobrança (ou desde que a espera começou). null se a tarefa não está esperando ninguém. */
export function diasEsperando(t: Tarefa): number | null {
  if (t.status !== "aguardando" || !t.esperando) return null;
  const d = diasAte(t.esperando.cobradoEm || t.esperando.desde);
  return d === null ? null : Math.max(0, -d);
}

/** "Marina: liberar o acesso ao repositório", "Marina" ou "liberar o acesso". */
export function resumoEspera(t: Tarefa): string {
  const e = t.esperando;
  if (!e) return "";
  return [e.quem, e.oQue].filter(Boolean).join(": ");
}

/** "desde 10/11 · cobrado em 13/11". */
export function historicoEspera(t: Tarefa): string {
  const e = t.esperando;
  if (!e) return "";
  return [`desde ${formatarData(e.desde, false)}`, e.cobradoEm ? `cobrado em ${formatarData(e.cobradoEm, false)}` : ""].filter(Boolean).join(" · ");
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";

/**
 * Mensagem pronta para colar no chat ou no e-mail. Curta e educada, sem inventar nada:
 * só usa o que o usuário escreveu (quem, o quê) e o título da tarefa.
 */
export function mensagemCobranca(t: Tarefa): string {
  const e = t.esperando;
  const nome = e?.quem ? primeiroNome(e.quem) : "";
  const saudacao = nome ? `Oi, ${nome}! Tudo bem?` : "Oi! Tudo bem?";
  const assunto = e?.oQue
    ? `Passando para saber de: ${e.oQue}.`
    : `Passando para saber se tem novidade sobre "${t.titulo}".`;
  const contexto = e?.oQue ? ` É sobre "${t.titulo}".` : "";
  const jaCobrou = e?.cobradoEm ? " Sei que já falamos disso, mas ainda preciso desse retorno para seguir." : "";
  return `${saudacao} ${assunto}${contexto}${jaCobrou} Consegue me dar uma posição? Agradeço desde já!`;
}
