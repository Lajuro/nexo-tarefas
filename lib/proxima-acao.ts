// Próxima ação (3.21): uma coisa a fazer agora, com o motivo, e o que vem depois dela.
//
// "O que eu faço agora?" estava espalhado em cinco lugares (o cartão da rotina, o foco, "Precisa de você", o
// balão do Foco e a agenda), cada um com a sua resposta. Aqui fica uma conta só, que os outros lugares usam.
//
// A ordem, a primeira que valer:
//   1. reunião em andamento;
//   2. reunião que começa em até 15 minutos (abrir a pauta);
//   3. outro bloco da rotina em andamento (o plano do usuário vale mais que os lembretes; o que é crítico entra no motivo);
//   4. lembrete crítico (prazo vencido ou de hoje, passo atrasado), com as tarefas em foco primeiro;
//   5. próximo passo do usuário numa tarefa em foco;
//   6. sem foco: planejar o dia, ou a melhor sugestão de foco;
//   7. o que pede atenção sem ser crítico (cobrar retorno primeiro);
//   8. jornada cumprida: fechar o dia.
//
// O app nunca age sozinho: a função devolve DADOS (o que fazer, por quê e um Comando), nunca funções. Quem executa
// o comando é a tela, com o clique do usuário. "Agora não" dispensa aquela sugestão por hoje (a chave dela).
//
// Função pura: o dia e o minuto de agora são parâmetros. Testada em testes/proxima-acao.test.mjs.

import { MINUTOS_ANTES_DA_REUNIAO, duracao, emMinutos, reunioesDoDia } from "./jornada";
import { type GrupoDeLembretes, aberta, passoEhMeu, sugestoesDeFoco } from "./lembretes";
import type { BlocoDaJornada, Passo, Registro, Tarefa } from "./tipos";

/** O que o botão faz. Só dados: a tela decide como executar. */
export type Comando =
  | { tipo: "abrir_tarefa"; tarefaId: string; registroId?: string }
  | { tipo: "concluir_passo"; tarefaId: string; registroId: string; passoId: string }
  | { tipo: "focar"; tarefaId: string }
  | { tipo: "reuniao"; tarefaId: string; blocoId: string }
  | { tipo: "rotina" }
  | { tipo: "planejar_dia" }
  | { tipo: "fechar_dia" };

export type TipoDaAcao = "reuniao_agora" | "reuniao_em_breve" | "bloco" | "pausa" | "critico" | "passo" | "foco_sem_passo" | "planejar" | "sugestao" | "atencao" | "fechar";

export interface Acao {
  /** Estável durante o dia: é o que "Agora não" guarda. */
  chave: string;
  tipo: TipoDaAcao;
  /** O que fazer, em uma linha. */
  titulo: string;
  /** Por que isto agora, em uma linha. */
  motivo: string;
  tarefaId?: string;
  tarefaTitulo?: string;
  comando: Comando;
  /** O texto do botão principal. */
  rotulo: string;
  /** Um segundo caminho, quando faz sentido (abrir a tarefa de um passo, por exemplo). */
  outro?: { comando: Comando; rotulo: string };
}

export interface EntradaDaProximaAcao {
  /** AAAA-MM-DD */
  hoje: string;
  /** Minutos desde a meia-noite. */
  agoraMin: number;
  tarefas: Tarefa[];
  /** Os blocos do plano de hoje. */
  blocos: BlocoDaJornada[];
  /** Os lembretes de agora, por tarefa, já sem os adiados (de useLembretes). */
  grupos: GrupoDeLembretes[];
  /** O ponto está aberto e as horas do dia já foram cumpridas. */
  jornadaCumprida: boolean;
  /** O ritual de planejar o dia já foi feito (ou dispensado) hoje. */
  planejouHoje: boolean;
  /** Chaves das ações que o usuário dispensou hoje com "Agora não". */
  dispensadas?: readonly string[];
}

export const MAX_DEPOIS = 3;

const lista = (nomes: string[]) => (nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`);
const com = (gente: string[]) => (gente.length ? `, com ${lista(gente.slice(0, 3))}${gente.length > 3 ? ` e mais ${gente.length - 3}` : ""}` : "");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O primeiro passo em aberto do usuário na tarefa: com prazo primeiro (o mais cedo), depois o do registro mais antigo. */
export function proximoPassoMeu(t: Tarefa): { registro: Registro; passo: Passo } | null {
  const meus = t.registros
    .flatMap((registro) => registro.proximosPassos.filter((p) => !p.feito && passoEhMeu(p)).map((passo) => ({ registro, passo })))
    .sort((a, b) => (a.passo.prazo ?? "9999").localeCompare(b.passo.prazo ?? "9999") || a.registro.data.localeCompare(b.registro.data));
  return meus[0] ?? null;
}

export function proximaAcao(e: EntradaDaProximaAcao): { agora: Acao | null; depois: Acao[] } {
  const candidatas: Acao[] = [];
  const porId = new Map(e.tarefas.map((t) => [t.id, t]));
  const abertas = e.tarefas.filter(aberta);
  const focos = abertas.filter((t) => t.focoEm === e.hoje).sort((a, b) => b.prioridade - a.prioridade);
  const ehFoco = (id: string) => focos.some((t) => t.id === id);
  const criticos = e.grupos.filter((g) => g.gravidade === "critico" && g.tarefaId && !g.modeloId);
  const esperam = criticos.length ? ` ${plural(criticos.length, "tarefa com prazo estourado espera", "tarefas com prazo estourado esperam")}.` : "";
  const abrir = (tarefaId: string): Comando => ({ tipo: "abrir_tarefa", tarefaId });

  // 1 e 2. reuniões: a que está acontecendo e a que começa em instantes
  const reunioes = reunioesDoDia(e.blocos, e.agoraMin);
  for (const r of reunioes) {
    if (r.momento !== "agora" && r.momento !== "em-breve") continue;
    const t = r.tarefaId ? porId.get(r.tarefaId) : undefined;
    const nome = r.bloco.titulo || "Reunião";
    const gente = com(r.bloco.reuniao?.participantes ?? []);
    const agora = r.momento === "agora";
    candidatas.push({
      chave: `reuniao:${r.bloco.id}:${agora ? "agora" : "antes"}`,
      tipo: agora ? "reuniao_agora" : "reuniao_em_breve",
      titulo: agora ? `Reunião: ${nome}` : `Preparar a reunião: ${nome}`,
      motivo: agora ? `Começou às ${r.bloco.inicio} e vai até as ${r.bloco.fim}${gente}.` : `Começa em ${r.emQuanto} min, às ${r.bloco.inicio}${gente}.`,
      tarefaId: t?.id,
      tarefaTitulo: t?.titulo,
      comando: t ? { tipo: "reuniao", tarefaId: t.id, blocoId: r.bloco.id } : { tipo: "rotina" },
      rotulo: t ? (agora ? "Entrar no modo reunião" : "Ver a pauta") : "Abrir a rotina",
      outro: t ? { comando: abrir(t.id), rotulo: "Abrir a tarefa" } : undefined,
    });
  }
  candidatas.sort((a, b) => Number(b.tipo === "reuniao_agora") - Number(a.tipo === "reuniao_agora"));

  // 3. o bloco de agora na rotina (se dois se sobrepõem, o que começou por último), sem contar o que é reunião
  const blocoAgora = [...e.blocos]
    .filter((b) => !b.reuniao && !b.feito && emMinutos(b.inicio) <= e.agoraMin && e.agoraMin < emMinutos(b.fim))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
  if (blocoAgora) {
    const resta = duracao(emMinutos(blocoAgora.fim) - e.agoraMin);
    if (blocoAgora.tipo === "pausa") {
      candidatas.push({
        chave: `bloco:${blocoAgora.id}`, tipo: "pausa", titulo: blocoAgora.titulo || "Pausa",
        motivo: `É a pausa da sua rotina, até as ${blocoAgora.fim} (faltam ${resta}).`, comando: { tipo: "rotina" }, rotulo: "Abrir a rotina",
      });
    } else {
      const t = blocoAgora.tipo === "tarefa" && blocoAgora.tarefaId ? porId.get(blocoAgora.tarefaId) : undefined;
      const passo = t && aberta(t) ? proximoPassoMeu(t) : null;
      candidatas.push({
        chave: `bloco:${blocoAgora.id}`, tipo: "bloco", titulo: blocoAgora.titulo || t?.titulo || "Bloco da rotina",
        motivo: `É o bloco de agora na sua rotina, até as ${blocoAgora.fim} (faltam ${resta}).${passo ? ` Próximo passo: ${passo.passo.texto}` : ""}${esperam}`,
        tarefaId: t?.id, tarefaTitulo: t?.titulo,
        comando: t ? abrir(t.id) : { tipo: "rotina" }, rotulo: t ? "Abrir a tarefa" : "Abrir a rotina",
        outro: t ? { comando: { tipo: "rotina" }, rotulo: "Ver a rotina" } : undefined,
      });
    }
  }

  // 4. o que está estourado: as tarefas em foco primeiro
  const jaTem = new Set<string>();
  for (const g of [...criticos].sort((a, b) => Number(ehFoco(b.tarefaId)) - Number(ehFoco(a.tarefaId)))) {
    const principal = g.lembretes[0];
    const t = porId.get(g.tarefaId);
    if (!t) continue;
    // passo atrasado que é do próprio usuário: o botão conclui; o resto abre a tarefa
    const doPasso = g.lembretes.find((l) => l.passoId && l.registroId && l.gravidade === "critico");
    const passo = doPasso ? t.registros.find((r) => r.id === doPasso.registroId)?.proximosPassos.find((p) => p.id === doPasso.passoId) : undefined;
    const concluir = principal === doPasso && passo && passoEhMeu(passo);
    jaTem.add(g.tarefaId);
    candidatas.push({
      chave: `critico:${g.tarefaId}`, tipo: "critico",
      titulo: concluir ? passo.texto : g.tarefaTitulo,
      motivo: `${principal.titulo}${concluir ? ` em “${g.tarefaTitulo}”` : ""}${g.lembretes.length > 1 ? ` e mais ${plural(g.lembretes.length - 1, "motivo", "motivos")}` : ""}.`,
      tarefaId: g.tarefaId, tarefaTitulo: g.tarefaTitulo,
      comando: concluir ? { tipo: "concluir_passo", tarefaId: g.tarefaId, registroId: doPasso!.registroId!, passoId: passo.id } : abrir(g.tarefaId),
      rotulo: concluir ? "Concluir o passo" : "Abrir a tarefa",
      outro: concluir ? { comando: abrir(g.tarefaId), rotulo: "Abrir a tarefa" } : undefined,
    });
  }

  // 5. o próximo passo do usuário em cada tarefa em foco
  for (const t of focos) {
    if (jaTem.has(t.id)) continue;
    jaTem.add(t.id);
    const p = proximoPassoMeu(t);
    candidatas.push(
      p
        ? {
            chave: `passo:${p.passo.id}`, tipo: "passo", titulo: p.passo.texto, motivo: `É o próximo passo do seu foco de hoje: ${t.titulo}.`,
            tarefaId: t.id, tarefaTitulo: t.titulo,
            comando: { tipo: "concluir_passo", tarefaId: t.id, registroId: p.registro.id, passoId: p.passo.id }, rotulo: "Concluir o passo",
            outro: { comando: abrir(t.id), rotulo: "Abrir a tarefa" },
          }
        : {
            chave: `foco:${t.id}`, tipo: "foco_sem_passo", titulo: t.titulo, motivo: "Está no seu foco de hoje e não tem próximo passo seu. Registre o que falta fazer.",
            tarefaId: t.id, tarefaTitulo: t.titulo, comando: abrir(t.id), rotulo: "Abrir a tarefa",
          },
    );
  }

  // 6. sem foco escolhido: planejar o dia, ou a melhor sugestão
  if (!focos.length && abertas.length) {
    if (!e.planejouHoje)
      candidatas.push({
        chave: "planejar", tipo: "planejar", titulo: "Planejar o dia",
        motivo: `Você ainda não escolheu o foco de hoje. ${plural(abertas.length, "tarefa aberta", "tarefas abertas")}.`, comando: { tipo: "planejar_dia" }, rotulo: "Planejar o dia",
      });
    for (const s of sugestoesDeFoco(abertas, 2)) {
      if (jaTem.has(s.tarefa.id) || s.tarefa.status === "aguardando" || s.tarefa.status === "bloqueada") continue;
      jaTem.add(s.tarefa.id);
      candidatas.push({
        chave: `sugestao:${s.tarefa.id}`, tipo: "sugestao", titulo: s.tarefa.titulo,
        motivo: s.motivos.length ? `Sugestão de foco: ${s.motivos.join(", ")}.` : "Sugestão de foco: é a de maior prioridade entre as abertas.",
        tarefaId: s.tarefa.id, tarefaTitulo: s.tarefa.titulo, comando: { tipo: "focar", tarefaId: s.tarefa.id }, rotulo: "Pôr no foco de hoje",
        outro: { comando: abrir(s.tarefa.id), rotulo: "Abrir a tarefa" },
      });
    }
  }

  // 7. o que pede atenção sem ser crítico: cobrar retorno primeiro
  const atencao = e.grupos.filter((g) => g.gravidade === "atencao" && g.tarefaId && !g.modeloId && !jaTem.has(g.tarefaId));
  const cobra = (g: GrupoDeLembretes) => g.lembretes.some((l) => l.tipo === "aguardando");
  for (const g of [...atencao].sort((a, b) => Number(cobra(b)) - Number(cobra(a)))) {
    jaTem.add(g.tarefaId);
    const principal = g.lembretes.find((l) => l.tipo === "aguardando") ?? g.lembretes[0];
    candidatas.push({
      chave: `atencao:${g.tarefaId}`, tipo: "atencao", titulo: g.tarefaTitulo,
      motivo: `${principal.titulo}${g.lembretes.length > 1 ? ` e mais ${plural(g.lembretes.length - 1, "motivo", "motivos")}` : ""}.`,
      tarefaId: g.tarefaId, tarefaTitulo: g.tarefaTitulo, comando: abrir(g.tarefaId), rotulo: "Abrir a tarefa",
    });
  }

  // 8. as horas do dia já foram cumpridas
  if (e.jornadaCumprida)
    candidatas.push({
      chave: "fechar", tipo: "fechar", titulo: "Fechar o dia", motivo: "Você completou as horas de hoje. Veja o que saiu e o que fica para amanhã.",
      comando: { tipo: "fechar_dia" }, rotulo: "Fechar o dia",
    });

  const fora = new Set(e.dispensadas ?? []);
  // só dados de verdade: campo sem valor não vai (o resultado pode ir para uma preferência ou para um teste sem surpresa)
  const limpa = (a: Acao) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as unknown as Acao;
  const validas = candidatas.filter((a) => !fora.has(a.chave)).map(limpa);
  return { agora: validas[0] ?? null, depois: validas.slice(1, 1 + MAX_DEPOIS) };
}

/** A janela, em minutos, em que uma reunião conta como "em breve" (para a tela explicar o que vê). */
export const JANELA_DA_REUNIAO = MINUTOS_ANTES_DA_REUNIAO;
