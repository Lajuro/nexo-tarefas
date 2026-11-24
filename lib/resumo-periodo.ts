// Resumo de um período, sem IA (3.23): o que foi concluído, o que andou, o que travou, as decisões e os próximos
// passos, em texto simples, pronto para colar num e-mail de status. E o mesmo material arrumado para um 1:1:
// o que andou, o que travou, o que precisa de decisão e o que vem agora.
//
// Até a 3.22 a tela de Relatórios só copiava o PROMPT para o Copilot. Isto é o que dá para dizer sem ele: só o
// que está nos registros, nada inventado, nada resumido por conta própria.
//
// Funções puras: o período e "agora" são parâmetros. Testadas em testes/resumo-periodo.test.mjs.

import { type Decisao, decisoesDe } from "./decisoes";
import { aberta, dataLocal, passoEhMeu } from "./lembretes";
import { tempoPorStatus } from "./tempo-status";
import { paraTextoPlano } from "./texto-rico";
import { type Passo, type Tarefa, formatarData } from "./tipos";

export interface ResumoDoPeriodo {
  inicio: string;
  fim: string;
  /** Tarefas concluídas dentro do período. */
  concluidas: Tarefa[];
  /** Tarefas (não concluídas no período) que tiveram registro ou passo concluído no período. */
  andou: { tarefa: Tarefa; registros: number; passosFeitos: number; ultimo: string }[];
  /** Tarefas abertas que estão bloqueadas ou aguardando terceiros agora. */
  travou: { tarefa: Tarefa; motivo: string; /** O impedimento que entrou no motivo de uma bloqueada (para não repetir em "precisa de decisão"). */ impedimento?: string }[];
  /** Decisões registradas no período. */
  decisoes: Decisao[];
  /** Impedimentos escritos no período, em tarefas que continuam abertas: é o que pede uma decisão ou uma ajuda. */
  precisaDeDecisao: { tarefa: Tarefa; texto: string; data: string }[];
  /** Passos em aberto do próprio usuário, atrasados ou com prazo até sete dias depois do fim do período. */
  proximos: { tarefa: Tarefa; passo: Passo }[];
  numeros: { registros: number; reunioes: number; passos: number; concluidas: number };
}

const umaLinha = (s: string, max = 220) => {
  const t = paraTextoPlano(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const somarDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(a, m - 1, d + n, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export function resumoDoPeriodo(tarefas: Tarefa[], inicio: string, fim: string, agora: Date | string | number = new Date()): ResumoDoPeriodo {
  const dentro = (data?: string | null) => !!data && data >= inicio && data <= fim;
  const concluidas: Tarefa[] = [];
  const andou: ResumoDoPeriodo["andou"] = [];
  const travou: ResumoDoPeriodo["travou"] = [];
  const precisaDeDecisao: ResumoDoPeriodo["precisaDeDecisao"] = [];
  const proximos: ResumoDoPeriodo["proximos"] = [];
  const numeros = { registros: 0, reunioes: 0, passos: 0, concluidas: 0 };
  const limiteDosProximos = somarDias(fim, 7);

  for (const t of tarefas) {
    const doPeriodo = t.registros.filter((r) => r.tipo !== "marco" && dentro(r.data)).sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""));
    const passosFeitos = t.registros.reduce((n, r) => n + r.proximosPassos.filter((p) => p.feito && dentro(dataLocal(p.feitoEm))).length, 0);
    numeros.registros += doPeriodo.length;
    numeros.reunioes += doPeriodo.filter((r) => r.tipo === "reuniao").length;
    numeros.passos += passosFeitos;

    const concluiuAgora = t.status === "concluida" && dentro(dataLocal(t.concluidaEm));
    if (concluiuAgora) {
      concluidas.push(t);
      numeros.concluidas++;
    } else if (doPeriodo.length || passosFeitos) {
      const ult = doPeriodo.at(-1);
      andou.push({ tarefa: t, registros: doPeriodo.length, passosFeitos, ultimo: ult ? umaLinha(ult.resumoIA || ult.titulo || ult.anotacoes, 160) : "" });
    }

    if (!aberta(t)) continue;
    if (t.status === "bloqueada" || t.status === "aguardando") {
      const ha = tempoPorStatus(t, agora).noStatusAtualHa;
      const tempo = ha >= 1 ? ` há ${plural(ha, "dia", "dias")}` : "";
      // o impedimento mais recente (pela data do registro, não pela ordem no arquivo)
      const impedimento = umaLinha([...t.registros].filter((r) => r.impedimentos?.trim()).sort((a, b) => b.data.localeCompare(a.data) || (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""))[0]?.impedimentos ?? "");
      if (t.status === "aguardando")
        travou.push({ tarefa: t, motivo: `aguardando ${t.esperando?.quem || "retorno"}${tempo}${t.esperando?.oQue ? ` (${umaLinha(t.esperando.oQue, 120)})` : ""}` });
      else travou.push({ tarefa: t, motivo: `bloqueada${tempo}${impedimento ? `. Impedimento: ${impedimento}` : ""}`, impedimento: impedimento || undefined });
    }
    for (const r of doPeriodo) if (r.impedimentos?.trim()) precisaDeDecisao.push({ tarefa: t, texto: umaLinha(r.impedimentos), data: r.data });
    for (const r of t.registros)
      for (const p of r.proximosPassos) if (!p.feito && passoEhMeu(p) && p.prazo && p.prazo <= limiteDosProximos) proximos.push({ tarefa: t, passo: p });
  }

  const porPrioridade = (a: Tarefa, b: Tarefa) => b.prioridade - a.prioridade || a.titulo.localeCompare(b.titulo);
  return {
    inicio, fim,
    concluidas: concluidas.sort(porPrioridade),
    andou: andou.sort((a, b) => porPrioridade(a.tarefa, b.tarefa)),
    travou: travou.sort((a, b) => porPrioridade(a.tarefa, b.tarefa)),
    decisoes: decisoesDe(tarefas).filter((d) => dentro(d.data)),
    precisaDeDecisao: precisaDeDecisao.sort((a, b) => b.data.localeCompare(a.data)),
    proximos: proximos.sort((a, b) => (a.passo.prazo ?? "").localeCompare(b.passo.prazo ?? "")),
    numeros,
  };
}

const periodoEmTexto = (r: ResumoDoPeriodo) => (r.inicio === r.fim ? formatarData(r.inicio) : `${formatarData(r.inicio)} a ${formatarData(r.fim)}`);
const linhaDoAndamento = (a: ResumoDoPeriodo["andou"][number]) => {
  const partes = [a.registros ? plural(a.registros, "registro", "registros") : "", a.passosFeitos ? plural(a.passosFeitos, "passo concluído", "passos concluídos") : ""].filter(Boolean).join(", ");
  return `- ${a.tarefa.titulo}: ${partes}.${a.ultimo ? ` Último: ${a.ultimo}` : ""}`;
};
const linhaDoPasso = (x: ResumoDoPeriodo["proximos"][number]) => `- ${x.passo.texto} (${x.tarefa.titulo}${x.passo.prazo ? `, até ${formatarData(x.passo.prazo, false)}` : ""})`;
const vazio = (r: ResumoDoPeriodo) => !r.concluidas.length && !r.andou.length && !r.travou.length && !r.decisoes.length && !r.proximos.length && !r.precisaDeDecisao.length;

/** O resumo do período em texto simples, para um e-mail de status. `sobre`: o recorte (o nome da categoria, por exemplo). */
export function textoDoResumo(r: ResumoDoPeriodo, sobre = ""): string {
  const L = [`Resumo de ${periodoEmTexto(r)}${sobre ? ` (${sobre})` : ""}`];
  if (vazio(r)) return `${L[0]}\n\nNada registrado no período.\n`;
  const n = r.numeros;
  L.push(`${plural(n.registros, "registro", "registros")}, ${plural(n.reunioes, "reunião", "reuniões")}, ${plural(n.passos, "passo concluído", "passos concluídos")}, ${plural(n.concluidas, "tarefa concluída", "tarefas concluídas")}.`);
  if (r.concluidas.length) L.push("", `Concluído (${r.concluidas.length}):`, ...r.concluidas.map((t) => `- ${t.titulo}`));
  if (r.andou.length) L.push("", `Andou (${r.andou.length}):`, ...r.andou.map(linhaDoAndamento));
  if (r.travou.length) L.push("", `Travado ou esperando (${r.travou.length}):`, ...r.travou.map((x) => `- ${x.tarefa.titulo}: ${x.motivo}`));
  if (r.decisoes.length) L.push("", `Decisões (${r.decisoes.length}):`, ...r.decisoes.map((d) => `- ${formatarData(d.data, false)}: ${d.texto} [${d.tarefaTitulo}]`));
  if (r.proximos.length) L.push("", "Meus próximos passos:", ...r.proximos.map(linhaDoPasso));
  return L.join("\n") + "\n";
}

/** O mesmo material arrumado para uma conversa com o gestor: o que andou, o que travou, o que precisa de decisão e o que vem agora. */
export function textoDoUmAUm(r: ResumoDoPeriodo, sobre = ""): string {
  const L = [`Para o 1:1, de ${periodoEmTexto(r)}${sobre ? ` (${sobre})` : ""}`];
  if (vazio(r)) return `${L[0]}\n\nNada registrado no período.\n`;
  if (r.concluidas.length || r.andou.length)
    L.push("", "O que andou:", ...r.concluidas.map((t) => `- Concluída: ${t.titulo}`), ...r.andou.map(linhaDoAndamento));
  if (r.travou.length) L.push("", "O que travou:", ...r.travou.map((x) => `- ${x.tarefa.titulo}: ${x.motivo}`));
  // o impedimento que já está em "O que travou" (o da tarefa bloqueada) não aparece de novo aqui
  const pedem = r.precisaDeDecisao.filter((x) => !r.travou.some((y) => y.tarefa.id === x.tarefa.id && y.impedimento === x.texto));
  if (pedem.length) L.push("", "O que precisa de decisão ou de ajuda:", ...pedem.map((x) => `- ${x.tarefa.titulo}: ${x.texto}`));
  if (r.decisoes.length) L.push("", "Decisões que já foram tomadas:", ...r.decisoes.map((d) => `- ${d.texto} [${d.tarefaTitulo}]`));
  if (r.proximos.length) L.push("", "O que vem agora:", ...r.proximos.map(linhaDoPasso));
  return L.join("\n") + "\n";
}
