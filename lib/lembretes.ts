// Motor de lembretes: olha os dados e devolve tudo o que merece a atenção do usuário hoje.
// É função pura (sem estado, sem disco): a interface decide o que mostrar e o que adiar.
// Nada aqui é gravado. "Adiar" um lembrete fica em localStorage (ver components/useLembretes.ts).

import { Passo, Registro, STATUS_ABERTOS, Tarefa, diasAte, formatarData, hojeISO } from "./tipos";

/** Limites, em dias, que disparam cada tipo de lembrete. */
export const LIMITES = {
  /** Prazo chegando: avisa quando faltam até N dias. */
  prazoProximo: 3,
  /** Tarefa a fazer/em andamento sem nenhum registro novo. */
  parada: 7,
  /** Tarefa aguardando terceiros sem novidade: hora de cobrar. */
  aguardando: 5,
  /** Tarefa bloqueada sem novidade. */
  bloqueada: 3,
  /** Próximo passo (sem prazo próprio) aberto há muito tempo. */
  passoAntigo: 14,
};

export type TipoLembrete =
  | "prazo_vencido"
  | "prazo_hoje"
  | "prazo_proximo"
  | "passo_vencido"
  | "passo_hoje"
  | "followup"
  | "bloqueada"
  | "aguardando"
  | "parada"
  | "passos_antigos"
  | "sem_proximo_passo";

export type Gravidade = "critico" | "atencao" | "info";

export interface Lembrete {
  /** Estável entre recargas (usado para adiar). */
  id: string;
  tipo: TipoLembrete;
  gravidade: Gravidade;
  /** Frase curta do que está acontecendo. Ex.: "Prazo venceu há 3 dias". */
  titulo: string;
  /** Complemento. Ex.: o texto do passo ou uma sugestão do que fazer. */
  detalhe: string;
  tarefaId: string;
  tarefaTitulo: string;
  registroId?: string;
  passoId?: string;
  /** Número usado para ordenar dentro da mesma gravidade (quanto maior, mais antigo/urgente). */
  dias: number;
}

export interface PassoAberto {
  tarefa: Tarefa;
  registro: Registro;
  passo: Passo;
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Converte um carimbo ISO (UTC) na data de calendário local AAAA-MM-DD. */
export function dataLocal(carimbo: string | null | undefined): string {
  if (!carimbo) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(carimbo)) return carimbo;
  const d = new Date(carimbo);
  if (Number.isNaN(d.getTime())) return carimbo.slice(0, 10);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export const aberta = (t: Tarefa) => STATUS_ABERTOS.includes(t.status);

/** Data (AAAA-MM-DD) do último sinal de vida da tarefa: registro, passo concluído ou criação. */
export function ultimaAtividade(t: Tarefa): string {
  let ult = dataLocal(t.criadaEm);
  const hoje = hojeISO();
  for (const r of t.registros) {
    if (r.data > ult && r.data <= hoje) ult = r.data;
    for (const p of r.proximosPassos) {
      const f = dataLocal(p.feitoEm);
      if (f && f > ult) ult = f;
    }
  }
  return ult;
}

export function diasSemAtividade(t: Tarefa): number {
  return Math.max(0, -(diasAte(ultimaAtividade(t)) ?? 0));
}

/** Passo sem responsável ou atribuído a "Eu" conta como do próprio usuário. */
export function passoEhMeu(p: Passo): boolean {
  const r = (p.responsavel || "").trim();
  return !r || /^(eu|eu mesmo|eu mesma|me|mim)$/i.test(r);
}

export function passosAbertosDe(tarefas: Tarefa[]): PassoAberto[] {
  const out: PassoAberto[] = [];
  for (const tarefa of tarefas) {
    if (!aberta(tarefa)) continue;
    for (const registro of tarefa.registros)
      for (const passo of registro.proximosPassos) if (!passo.feito) out.push({ tarefa, registro, passo });
  }
  return out;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const dias = (n: number) => plural(n, "dia", "dias");

const PESO: Record<Gravidade, number> = { critico: 0, atencao: 1, info: 2 };

export function gerarLembretes(tarefas: Tarefa[]): Lembrete[] {
  const out: Lembrete[] = [];
  for (const t of tarefas) {
    if (!aberta(t)) continue;
    const base = { tarefaId: t.id, tarefaTitulo: t.titulo };
    const parado = diasSemAtividade(t);

    if (t.prazo) {
      const d = diasAte(t.prazo)!;
      if (d < 0)
        out.push({ ...base, id: `prazo:${t.id}:${t.prazo}`, tipo: "prazo_vencido", gravidade: "critico", dias: -d,
          titulo: `Prazo venceu há ${dias(-d)}`, detalhe: `Era para ${formatarData(t.prazo)}. Renegocie o prazo ou conclua.` });
      else if (d === 0)
        out.push({ ...base, id: `prazo:${t.id}:${t.prazo}`, tipo: "prazo_hoje", gravidade: "critico", dias: 0,
          titulo: "O prazo é hoje", detalhe: "Última chamada para entregar ou avisar que vai atrasar." });
      else if (d <= LIMITES.prazoProximo)
        out.push({ ...base, id: `prazo:${t.id}:${t.prazo}`, tipo: "prazo_proximo", gravidade: "atencao", dias: LIMITES.prazoProximo - d,
          titulo: d === 1 ? "O prazo é amanhã" : `Prazo em ${dias(d)}`, detalhe: `Vence em ${formatarData(t.prazo)}.` });
    }

    if (t.lembrarEm && (diasAte(t.lembrarEm) ?? 1) <= 0) {
      const d = -diasAte(t.lembrarEm)!;
      out.push({ ...base, id: `followup:${t.id}:${t.lembrarEm}`, tipo: "followup", gravidade: "atencao", dias: d,
        titulo: d === 0 ? "Follow-up marcado para hoje" : `Follow-up pendente há ${dias(d)}`,
        detalhe: "Você pediu para ser lembrado de voltar nesta tarefa." });
    }

    let abertos = 0;
    let antigos = 0;
    let maisAntigo = 0;
    for (const r of t.registros)
      for (const p of r.proximosPassos) {
        if (p.feito) continue;
        abertos++;
        if (p.prazo) {
          const d = diasAte(p.prazo)!;
          if (d < 0)
            out.push({ ...base, id: `passo:${p.id}:${p.prazo}`, tipo: "passo_vencido", gravidade: "critico", dias: -d,
              registroId: r.id, passoId: p.id, titulo: `Passo atrasado há ${dias(-d)}`, detalhe: p.texto });
          else if (d === 0)
            out.push({ ...base, id: `passo:${p.id}:${p.prazo}`, tipo: "passo_hoje", gravidade: "atencao", dias: 0,
              registroId: r.id, passoId: p.id, titulo: "Passo para hoje", detalhe: p.texto });
        } else {
          const idade = Math.max(0, -(diasAte(r.data) ?? 0));
          if (idade >= LIMITES.passoAntigo) {
            antigos++;
            maisAntigo = Math.max(maisAntigo, idade);
          }
        }
      }

    if (antigos > 0)
      out.push({ ...base, id: `passos-antigos:${t.id}:${antigos}`, tipo: "passos_antigos", gravidade: "info", dias: maisAntigo,
        titulo: antigos === 1 ? `Um passo em aberto há ${dias(maisAntigo)}` : `${antigos} passos em aberto há mais de ${dias(LIMITES.passoAntigo)}`,
        detalhe: "Conclua, delegue ou descarte o que não faz mais sentido." });

    if (t.status === "bloqueada" && parado >= LIMITES.bloqueada)
      out.push({ ...base, id: `bloqueada:${t.id}`, tipo: "bloqueada", gravidade: "atencao", dias: parado,
        titulo: `Bloqueada há ${dias(parado)} sem novidade`, detalhe: "Vale escalar ou procurar outro caminho." });
    else if (t.status === "aguardando" && parado >= LIMITES.aguardando)
      out.push({ ...base, id: `aguardando:${t.id}`, tipo: "aguardando", gravidade: "atencao", dias: parado,
        titulo: `Aguardando retorno há ${dias(parado)}`, detalhe: "Hora de cobrar quem ficou de responder." });
    else if ((t.status === "a_fazer" || t.status === "em_andamento") && parado >= LIMITES.parada)
      out.push({ ...base, id: `parada:${t.id}`, tipo: "parada", gravidade: "info", dias: parado,
        titulo: `Sem movimento há ${dias(parado)}`, detalhe: "Registre o que aconteceu ou reveja a prioridade." });

    if (abertos === 0 && t.status === "em_andamento")
      out.push({ ...base, id: `sem-passo:${t.id}`, tipo: "sem_proximo_passo", gravidade: "info", dias: parado,
        titulo: "Em andamento sem próximo passo", detalhe: "Defina qual é a próxima ação para não travar." });
  }
  return out.sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade] || b.dias - a.dias);
}

export interface ResumoDia {
  /** Tarefas marcadas como foco de hoje. */
  focos: Tarefa[];
  atrasadas: Tarefa[];
  venceHoje: Tarefa[];
  /** Prazo entre amanhã e daqui a 7 dias. */
  semana: Tarefa[];
  /** lembrarEm chegou (hoje ou antes). */
  followups: Tarefa[];
  /** Passos com prazo próprio vencido ou para hoje. */
  passosDoDia: PassoAberto[];
  /** Passos abertos do próprio usuário, das tarefas em foco. */
  passosDosFocos: PassoAberto[];
  aguardando: Tarefa[];
  bloqueadas: Tarefa[];
  paradas: Tarefa[];
  /** O que já andou hoje (para dar sensação de progresso). */
  feitoHoje: { passos: number; registros: number; concluidas: number };
  totalAbertas: number;
}

export function resumoDoDia(tarefas: Tarefa[]): ResumoDia {
  const hoje = hojeISO();
  const abertas = tarefas.filter(aberta);
  const porPrio = (a: Tarefa, b: Tarefa) => b.prioridade - a.prioridade;
  const porPrazo = (a: Tarefa, b: Tarefa) => (a.prazo ?? "9").localeCompare(b.prazo ?? "9") || porPrio(a, b);
  const focos = abertas.filter((t) => t.focoEm === hoje).sort(porPrio);
  const todosPassos = passosAbertosDe(tarefas);

  const feitoHoje = { passos: 0, registros: 0, concluidas: 0 };
  for (const t of tarefas) {
    if (t.status === "concluida" && dataLocal(t.concluidaEm) === hoje) feitoHoje.concluidas++;
    for (const r of t.registros) {
      if (r.tipo !== "marco" && dataLocal(r.criadoEm) === hoje) feitoHoje.registros++;
      for (const p of r.proximosPassos) if (p.feito && dataLocal(p.feitoEm) === hoje) feitoHoje.passos++;
    }
  }

  return {
    focos,
    atrasadas: abertas.filter((t) => t.prazo && diasAte(t.prazo)! < 0).sort(porPrazo),
    venceHoje: abertas.filter((t) => t.prazo === hoje).sort(porPrio),
    semana: abertas.filter((t) => t.prazo && diasAte(t.prazo)! >= 1 && diasAte(t.prazo)! <= 7).sort(porPrazo),
    followups: abertas.filter((t) => t.lembrarEm && t.lembrarEm <= hoje).sort(porPrio),
    passosDoDia: todosPassos.filter((x) => x.passo.prazo && x.passo.prazo <= hoje)
      .sort((a, b) => (a.passo.prazo ?? "").localeCompare(b.passo.prazo ?? "")),
    passosDosFocos: todosPassos.filter((x) => x.tarefa.focoEm === hoje && passoEhMeu(x.passo)),
    aguardando: abertas.filter((t) => t.status === "aguardando").sort((a, b) => diasSemAtividade(b) - diasSemAtividade(a)),
    bloqueadas: abertas.filter((t) => t.status === "bloqueada").sort((a, b) => diasSemAtividade(b) - diasSemAtividade(a)),
    paradas: abertas
      .filter((t) => (t.status === "a_fazer" || t.status === "em_andamento") && diasSemAtividade(t) >= LIMITES.parada)
      .sort((a, b) => diasSemAtividade(b) - diasSemAtividade(a)),
    feitoHoje,
    totalAbertas: abertas.length,
  };
}

export interface SugestaoFoco {
  tarefa: Tarefa;
  pontos: number;
  /** Por que está sendo sugerida. Ex.: "prazo hoje", "prioridade 9". */
  motivos: string[];
}

/** Ranking das tarefas abertas que mais merecem ser o foco de hoje (para o ritual de planejar o dia). */
export function sugestoesDeFoco(tarefas: Tarefa[], limite = 8): SugestaoFoco[] {
  const hoje = hojeISO();
  return tarefas
    .filter(aberta)
    .map((t) => {
      let pontos = t.prioridade * 10;
      const motivos: string[] = [];
      if (t.prazo) {
        const d = diasAte(t.prazo)!;
        if (d < 0) { pontos += 60; motivos.push(`atrasada há ${dias(-d)}`); }
        else if (d === 0) { pontos += 50; motivos.push("prazo hoje"); }
        else if (d <= LIMITES.prazoProximo) { pontos += 30; motivos.push(d === 1 ? "prazo amanhã" : `prazo em ${dias(d)}`); }
      }
      if (t.lembrarEm && t.lembrarEm <= hoje) { pontos += 35; motivos.push("follow-up marcado"); }
      if (t.status === "em_andamento") pontos += 8;
      if (t.status === "aguardando") { pontos -= 25; if (diasSemAtividade(t) >= LIMITES.aguardando) { pontos += 30; motivos.push("cobrar retorno"); } }
      if (t.status === "bloqueada") pontos -= 20;
      if (t.prioridade >= 8) motivos.push(`prioridade ${t.prioridade}`);
      if (!motivos.length && diasSemAtividade(t) >= LIMITES.parada) motivos.push(`parada há ${dias(diasSemAtividade(t))}`);
      return { tarefa: t, pontos, motivos };
    })
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite);
}

/** "hoje", "ontem", "há 3 dias", "amanhã", "em 5 dias". Aceita data ou carimbo. */
export function dataRelativa(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = diasAte(dataLocal(iso));
  if (d === null) return "";
  if (d === 0) return "hoje";
  if (d === -1) return "ontem";
  if (d === 1) return "amanhã";
  return d < 0 ? `há ${dias(-d)}` : `em ${dias(d)}`;
}

/** Saudação conforme a hora local. */
export function saudacao(agora = new Date()): string {
  const h = agora.getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
