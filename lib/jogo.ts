// Gamificação do Nexo: nível, XP, meta do dia e conquistas. Tudo é CALCULADO a partir dos dados que já existem
// (registros, passos concluídos, tarefas concluídas, sessões de foco). Nada disso é gravado: não há o que perder,
// vale retroativamente para quem já usava o app e não dá para "ficar dessincronizado".
// Função pura (a tela está em components/jogo/ e app/conquistas/).

import { sequencia } from "./diario";
import { dataLocal } from "./lembretes";
import type { Dados } from "./tipos";

/** Quanto vale cada coisa. Registrar o que aconteceu vale mais do que marcar um passo: é o hábito mais difícil. */
export const XP = { passo: 10, registro: 15, reuniao: 20, concluida: 50, minutoDeFoco: 1, maxFocoPorSessao: 60 } as const;

export const META_PADRAO = 3;
export const META_MAXIMA = 12;

const NOMES_DE_NIVEL = [
  "Começando", "Pegando o jeito", "Organizado", "Constante", "Confiável", "Afiado", "Veterano", "Referência", "Maestro", "Lenda",
];

/** XP total necessário para ESTAR no nível n (n começa em 1). Cada nível pede um pouco mais que o anterior. */
export const xpDoNivel = (n: number) => 60 * n * (n - 1);

export function nivelDoXp(xp: number) {
  let n = 1;
  while (xpDoNivel(n + 1) <= xp) n++;
  const inicio = xpDoNivel(n);
  const proximo = xpDoNivel(n + 1);
  return {
    n,
    nome: n <= NOMES_DE_NIVEL.length ? NOMES_DE_NIVEL[n - 1] : `Lenda ${n - NOMES_DE_NIVEL.length + 1}`,
    xpInicio: inicio,
    xpProximo: proximo,
    /** 0 a 1: quanto do caminho até o próximo nível já foi andado. */
    parte: (xp - inicio) / (proximo - inicio),
    falta: proximo - xp,
  };
}

export type GrupoDeConquista = "passos" | "registros" | "tarefas" | "ritmo" | "foco" | "organizacao";
export const NOME_DO_GRUPO: Record<GrupoDeConquista, string> = {
  passos: "Passos", registros: "Registros", tarefas: "Tarefas", ritmo: "Ritmo", foco: "Foco", organizacao: "Organização",
};

export interface Conquista {
  id: string;
  grupo: GrupoDeConquista;
  nome: string;
  descricao: string;
  /** Chave do ícone (a tela escolhe o desenho). */
  icone: string;
  atual: number;
  alvo: number;
  feita: boolean;
  /** Dia (AAAA-MM-DD) em que foi alcançada, quando dá para saber pelos dados. */
  em: string | null;
}

export interface EstadoDoJogo {
  xp: number;
  nivel: ReturnType<typeof nivelDoXp>;
  hoje: { avancos: number; xp: number; meta: number; bateu: boolean };
  sequencia: { atual: number; melhor: number };
  /** Dia com mais avanços até hoje. */
  recorde: { data: string; avancos: number } | null;
  totais: { passos: number; registros: number; reunioes: number; concluidas: number; sessoes: number; minutosDeFoco: number; cobrancas: number };
  conquistas: Conquista[];
  /** XP dos últimos 14 dias, do mais antigo para hoje (para o gráfico). */
  ultimosDias: { data: string; xp: number; avancos: number }[];
}

type Contador = "passos" | "registros" | "reunioes" | "concluidas" | "sessoes" | "minutosDeFoco" | "cobrancas" | "referencias";
interface Evento { data: string; xp: number; conta: Partial<Record<Contador, number>> }

const p2 = (n: number) => String(n).padStart(2, "0");
function diasAtras(hoje: string, n: number): string {
  const [a, m, d] = hoje.split("-").map(Number);
  const x = new Date(a, (m || 1) - 1, (d || 1) - n);
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
}

/** Tudo o que pontua, com a data em que aconteceu. O que tem data no futuro ainda não aconteceu: não conta. */
function eventosQuePontuam(dados: Dados, hoje: string): Evento[] {
  const out: Evento[] = [];
  for (const t of dados.tarefas) {
    for (const r of t.registros) {
      if (r.tipo === "marco") {
        if (r.alteracoes?.status?.para === "concluida" && r.data <= hoje) out.push({ data: r.data, xp: XP.concluida, conta: { concluidas: 1 } });
      } else if (r.data && r.data <= hoje) {
        const minutos = r.duracaoMin || 0;
        out.push({
          data: r.data,
          xp: (r.tipo === "reuniao" ? XP.reuniao : XP.registro) + Math.min(XP.maxFocoPorSessao, minutos * XP.minutoDeFoco),
          conta: {
            registros: 1,
            reunioes: r.tipo === "reuniao" ? 1 : 0,
            sessoes: minutos > 0 ? 1 : 0,
            minutosDeFoco: minutos,
            cobrancas: r.tipo === "atividade" && /^Cobrei\b/.test(r.titulo) ? 1 : 0,
            referencias: r.referencia ? 1 : 0,
          },
        });
      }
      for (const p of r.proximosPassos) {
        if (!p.feito || !p.feitoEm) continue;
        const data = dataLocal(p.feitoEm);
        if (data && data <= hoje) out.push({ data, xp: XP.passo, conta: { passos: 1 } });
      }
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

interface Molde {
  id: string;
  grupo: GrupoDeConquista;
  nome: string;
  descricao: string;
  icone: string;
  alvo: number;
  /** Contador acumulado ao longo do tempo (dá para saber o dia em que bateu). */
  contador?: Contador;
  /** Para o que não é contador de eventos: valor atual, direto. */
  valor?: (c: { melhorSequencia: number; recorde: number; modelos: number; pessoas: number; folhas: number }) => number;
}

const MOLDES: Molde[] = [
  { id: "passo-1", grupo: "passos", nome: "Primeiro passo", descricao: "Concluir um próximo passo.", icone: "passo", alvo: 1, contador: "passos" },
  { id: "passo-25", grupo: "passos", nome: "Mão na massa", descricao: "Concluir 25 passos.", icone: "passo", alvo: 25, contador: "passos" },
  { id: "passo-100", grupo: "passos", nome: "Cem passos", descricao: "Concluir 100 passos.", icone: "passo", alvo: 100, contador: "passos" },
  { id: "passo-500", grupo: "passos", nome: "Maratonista", descricao: "Concluir 500 passos.", icone: "passo", alvo: 500, contador: "passos" },

  { id: "registro-1", grupo: "registros", nome: "Ficou anotado", descricao: "Registrar o primeiro acontecimento numa tarefa.", icone: "registro", alvo: 1, contador: "registros" },
  { id: "registro-25", grupo: "registros", nome: "Nada se perde", descricao: "Fazer 25 registros na linha do tempo.", icone: "registro", alvo: 25, contador: "registros" },
  { id: "registro-100", grupo: "registros", nome: "Memória de elefante", descricao: "Fazer 100 registros.", icone: "registro", alvo: 100, contador: "registros" },
  { id: "reuniao-10", grupo: "registros", nome: "Ata em dia", descricao: "Registrar 10 reuniões.", icone: "reuniao", alvo: 10, contador: "reunioes" },
  { id: "reuniao-50", grupo: "registros", nome: "Dono da pauta", descricao: "Registrar 50 reuniões.", icone: "reuniao", alvo: 50, contador: "reunioes" },
  { id: "referencia-3", grupo: "registros", nome: "Base de conhecimento", descricao: "Marcar 3 registros como referência do assunto.", icone: "referencia", alvo: 3, contador: "referencias" },

  { id: "tarefa-1", grupo: "tarefas", nome: "Primeira entrega", descricao: "Concluir uma tarefa.", icone: "tarefa", alvo: 1, contador: "concluidas" },
  { id: "tarefa-10", grupo: "tarefas", nome: "Dez entregas", descricao: "Concluir 10 tarefas.", icone: "tarefa", alvo: 10, contador: "concluidas" },
  { id: "tarefa-50", grupo: "tarefas", nome: "Entrega em série", descricao: "Concluir 50 tarefas.", icone: "tarefa", alvo: 50, contador: "concluidas" },
  { id: "cobranca-5", grupo: "tarefas", nome: "Não deixa passar", descricao: "Cobrar um retorno 5 vezes.", icone: "cobranca", alvo: 5, contador: "cobrancas" },

  { id: "sequencia-3", grupo: "ritmo", nome: "Três em linha", descricao: "3 dias úteis seguidos com algum avanço.", icone: "chama", alvo: 3, valor: (c) => c.melhorSequencia },
  { id: "sequencia-5", grupo: "ritmo", nome: "Semana cheia", descricao: "5 dias úteis seguidos com algum avanço.", icone: "chama", alvo: 5, valor: (c) => c.melhorSequencia },
  { id: "sequencia-20", grupo: "ritmo", nome: "Mês redondo", descricao: "20 dias úteis seguidos com algum avanço.", icone: "chama", alvo: 20, valor: (c) => c.melhorSequencia },
  { id: "dia-5", grupo: "ritmo", nome: "Dia produtivo", descricao: "5 avanços no mesmo dia.", icone: "raio", alvo: 5, valor: (c) => c.recorde },
  { id: "dia-12", grupo: "ritmo", nome: "Dia imparável", descricao: "12 avanços no mesmo dia.", icone: "raio", alvo: 12, valor: (c) => c.recorde },

  { id: "foco-1", grupo: "foco", nome: "Sem interrupção", descricao: "Registrar a primeira sessão de foco.", icone: "foco", alvo: 1, contador: "sessoes" },
  { id: "foco-10", grupo: "foco", nome: "Foco de hábito", descricao: "Registrar 10 sessões de foco.", icone: "foco", alvo: 10, contador: "sessoes" },
  { id: "foco-600", grupo: "foco", nome: "Dez horas de foco", descricao: "Somar 10 horas em sessões de foco.", icone: "relogio", alvo: 600, contador: "minutosDeFoco" },

  { id: "modelo-1", grupo: "organizacao", nome: "Atalho esperto", descricao: "Criar um modelo de tarefa.", icone: "modelo", alvo: 1, valor: (c) => c.modelos },
  { id: "folha-5", grupo: "organizacao", nome: "Do rascunho ao registro", descricao: "Organizar 5 folhas do bloco de notas.", icone: "folha", alvo: 5, valor: (c) => c.folhas },
  { id: "pessoa-10", grupo: "organizacao", nome: "Rede de contatos", descricao: "Cadastrar 10 pessoas.", icone: "pessoas", alvo: 10, valor: (c) => c.pessoas },
];

export function calcularJogo(dados: Dados, hoje: string, meta: number = META_PADRAO): EstadoDoJogo {
  const alvoDoDia = Math.min(META_MAXIMA, Math.max(1, Math.round(meta) || META_PADRAO));
  const eventos = eventosQuePontuam(dados, hoje);

  const total: Record<Contador, number> = { passos: 0, registros: 0, reunioes: 0, concluidas: 0, sessoes: 0, minutosDeFoco: 0, cobrancas: 0, referencias: 0 };
  const quando = new Map<string, string>(); // id da conquista → dia em que bateu
  const porDia = new Map<string, { xp: number; avancos: number }>();
  const contadoras = MOLDES.filter((m) => m.contador);
  let xp = 0;

  for (const e of eventos) {
    xp += e.xp;
    const dia = porDia.get(e.data) ?? { xp: 0, avancos: 0 };
    dia.xp += e.xp;
    dia.avancos += 1;
    porDia.set(e.data, dia);
    for (const [k, v] of Object.entries(e.conta) as [Contador, number][]) total[k] += v;
    for (const m of contadoras) if (!quando.has(m.id) && total[m.contador!] >= m.alvo) quando.set(m.id, e.data);
  }

  const atividade = new Map([...porDia].map(([d, v]) => [d, v.avancos]));
  const seq = sequencia(atividade, hoje);
  let recorde: EstadoDoJogo["recorde"] = null;
  for (const [data, v] of porDia) if (!recorde || v.avancos > recorde.avancos) recorde = { data, avancos: v.avancos };

  const contexto = {
    melhorSequencia: seq.melhor,
    recorde: recorde?.avancos ?? 0,
    modelos: dados.modelos?.items.length ?? 0,
    pessoas: (dados.pessoas?.items ?? []).filter((p) => !p.arquivada).length,
    folhas: (dados.notas?.items ?? []).filter((n) => n.arquivadaEm && (n.gerou?.length ?? 0) > 0).length,
  };

  const conquistas: Conquista[] = MOLDES.map((m) => {
    const atual = m.contador ? total[m.contador] : m.valor!(contexto);
    return {
      id: m.id, grupo: m.grupo, nome: m.nome, descricao: m.descricao, icone: m.icone,
      atual: Math.min(atual, m.alvo), alvo: m.alvo, feita: atual >= m.alvo,
      em: m.id === "dia-5" || m.id === "dia-12" ? (atual >= m.alvo ? recorde?.data ?? null : null) : quando.get(m.id) ?? null,
    };
  });

  const doDia = porDia.get(hoje) ?? { xp: 0, avancos: 0 };
  return {
    xp,
    nivel: nivelDoXp(xp),
    hoje: { avancos: doDia.avancos, xp: doDia.xp, meta: alvoDoDia, bateu: doDia.avancos >= alvoDoDia },
    sequencia: seq,
    recorde,
    totais: {
      passos: total.passos, registros: total.registros, reunioes: total.reunioes, concluidas: total.concluidas,
      sessoes: total.sessoes, minutosDeFoco: total.minutosDeFoco, cobrancas: total.cobrancas,
    },
    conquistas,
    ultimosDias: Array.from({ length: 14 }, (_, i) => {
      const data = diasAtras(hoje, 13 - i);
      return { data, ...(porDia.get(data) ?? { xp: 0, avancos: 0 }) };
    }),
  };
}
