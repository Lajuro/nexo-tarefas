// Radar das frentes: como está cada assunto (categoria) sem abrir tarefa por tarefa.
// Função pura sobre os dados, com o dia de hoje como parâmetro. Nada é gravado: a "saúde" de uma frente
// é sempre uma conta feita na hora, com as mesmas réguas dos lembretes (LIMITES).

import { resumoEspera } from "./espera";
import { LIMITES, aberta, dataLocal } from "./lembretes";
import { type Dados, type Tarefa, formatarData, hojeISO } from "./tipos";

export type Saude = "risco" | "parada" | "atencao" | "em_dia" | "sem_abertas";

export const SAUDES: { id: Saude; nome: string; frase: string }[] = [
  { id: "risco", nome: "Em risco", frase: "em risco" },
  { id: "parada", nome: "Parada", frase: "parada" },
  { id: "atencao", nome: "Pede atenção", frase: "pede atenção" },
  { id: "em_dia", nome: "Em dia", frase: "em dia" },
  { id: "sem_abertas", nome: "Sem tarefa aberta", frase: "sem tarefa aberta" },
];
export const nomeSaude = (s: Saude) => SAUDES.find((x) => x.id === s)?.nome ?? s;

/** Réguas próprias do radar (as demais vêm de LIMITES, as mesmas dos lembretes). */
export const RADAR = {
  /** Frente com tarefa aberta e nenhum movimento há N dias está parada. */
  parada: 14,
  /** Quantas semanas de atividade o gráfico de cada frente mostra. */
  semanasDeAtividade: 8,
  /** Quantas semanas à frente a linha de prazos mostra. */
  semanasDePrazo: 6,
};

export interface Frente {
  /** Id da categoria; null = tarefas sem categoria. */
  id: string | null;
  nome: string;
  cor: string;
  saude: Saude;
  /** Por que a frente está com essa saúde, do mais grave para o menos. */
  motivos: string[];
  abertas: Tarefa[];
  atrasadas: Tarefa[];
  bloqueadas: Tarefa[];
  aguardando: Tarefa[];
  passosAbertos: number;
  passosAtrasados: number;
  /** Tarefas concluídas nos últimos 30 dias. */
  concluidas30: number;
  proximoPrazo: { tarefa: Tarefa; data: string } | null;
  /** Dia do último movimento (registro ou passo concluído) em qualquer tarefa da frente. */
  ultima: string | null;
  diasSemMovimento: number | null;
  /** Movimentos por semana, da mais antiga para a atual. */
  semanas: number[];
}

export interface ItemPrazo {
  data: string;
  tipo: "tarefa" | "passo" | "lembrar";
  titulo: string;
  tarefaId: string;
  tarefaTitulo: string;
  frenteId: string | null;
  atrasado: boolean;
}

export interface Radar {
  hoje: string;
  frentes: Frente[];
  /** Prazos de tarefa, de passo e follow-ups: os vencidos e os das próximas semanas. */
  prazos: ItemPrazo[];
  /** As semanas da linha de prazos (segunda a domingo), começando pela atual. */
  semanas: { inicio: string; fim: string }[];
  contagem: Record<Saude, number>;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const paraData = (iso: string) => new Date(iso + "T12:00:00");
const paraISO = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const somar = (iso: string, dias: number) => {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
};
const diasEntre = (de: string, ate: string) => Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000);
/** A segunda-feira da semana de um dia. */
export const inicioDaSemana = (iso: string) => somar(iso, -((paraData(iso).getDay() + 6) % 7));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os dias em que a tarefa teve movimento: registro (menos marco) e passo concluído, até hoje. */
function movimentos(t: Tarefa, hoje: string): string[] {
  const out: string[] = [];
  for (const r of t.registros) {
    if (r.tipo !== "marco" && r.data && r.data <= hoje) out.push(r.data);
    for (const p of r.proximosPassos) {
      const f = p.feito ? dataLocal(p.feitoEm) : "";
      if (f && f <= hoje) out.push(f);
    }
  }
  return out;
}

function montarFrente(id: string | null, nome: string, cor: string, tarefas: Tarefa[], hoje: string): Frente {
  const abertas = tarefas.filter(aberta).sort((a, b) => b.prioridade - a.prioridade || a.titulo.localeCompare(b.titulo));
  const atrasadas = abertas.filter((t) => !!t.prazo && t.prazo < hoje);
  const bloqueadas = abertas.filter((t) => t.status === "bloqueada");
  const aguardando = abertas.filter((t) => t.status === "aguardando");

  let passosAbertos = 0;
  let passosAtrasados = 0;
  for (const t of abertas)
    for (const r of t.registros)
      for (const p of r.proximosPassos) {
        if (p.feito) continue;
        passosAbertos++;
        if (p.prazo && p.prazo < hoje) passosAtrasados++;
      }

  const ha30 = somar(hoje, -30);
  const concluidas30 = tarefas.filter((t) => t.status === "concluida" && dataLocal(t.concluidaEm) > ha30 && dataLocal(t.concluidaEm) <= hoje).length;

  const comPrazo = abertas.filter((t) => !!t.prazo && t.prazo >= hoje).sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));
  const proximoPrazo = comPrazo[0] ? { tarefa: comPrazo[0], data: comPrazo[0].prazo as string } : null;

  // movimento: registros e passos concluídos; se não houver nenhum, vale a criação da tarefa mais recente
  const dias = tarefas.flatMap((t) => movimentos(t, hoje));
  const criacoes = tarefas.map((t) => dataLocal(t.criadaEm)).filter((d) => d && d <= hoje);
  const ultima = [...dias, ...criacoes].sort().at(-1) ?? null;
  const diasSemMovimento = ultima ? Math.max(0, diasEntre(ultima, hoje)) : null;

  const semanaAtual = inicioDaSemana(hoje);
  const semanas = Array.from({ length: RADAR.semanasDeAtividade }, () => 0);
  for (const d of dias) {
    const atras = Math.round(diasEntre(inicioDaSemana(d), semanaAtual) / 7);
    if (atras >= 0 && atras < semanas.length) semanas[semanas.length - 1 - atras]++;
  }

  // ---------- saúde ----------
  const graves: string[] = [];
  const leves: string[] = [];
  if (atrasadas.length) graves.push(plural(atrasadas.length, "tarefa com prazo vencido", "tarefas com prazo vencido"));
  if (bloqueadas.length) graves.push(plural(bloqueadas.length, "tarefa bloqueada", "tarefas bloqueadas"));
  if (passosAtrasados) leves.push(plural(passosAtrasados, "passo com prazo vencido", "passos com prazo vencido"));
  if (proximoPrazo && diasEntre(hoje, proximoPrazo.data) <= LIMITES.prazoProximo) {
    const d = diasEntre(hoje, proximoPrazo.data);
    leves.push(`Prazo ${d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`}: ${proximoPrazo.tarefa.titulo}`);
  }
  for (const t of aguardando) {
    const desde = t.esperando?.cobradoEm || t.esperando?.desde || movimentos(t, hoje).sort().at(-1) || dataLocal(t.criadaEm);
    const d = desde ? diasEntre(desde, hoje) : 0;
    if (d >= LIMITES.aguardando) leves.push(`${t.esperando?.quem ? `Esperando ${t.esperando.quem}` : "Aguardando retorno"} há ${d} dias`);
  }
  const semProximo = abertas.filter((t) => t.status === "em_andamento" && !t.registros.some((r) => r.proximosPassos.some((p) => !p.feito))).length;
  if (semProximo) leves.push(plural(semProximo, "tarefa em andamento sem próximo passo", "tarefas em andamento sem próximo passo"));

  let saude: Saude = "em_dia";
  let motivos = [...graves, ...leves];
  if (!abertas.length) {
    saude = "sem_abertas";
    motivos = [];
  } else if (graves.length) saude = "risco";
  else if (diasSemMovimento !== null && diasSemMovimento >= RADAR.parada) {
    saude = "parada";
    motivos = [`Sem movimento há ${diasSemMovimento} dias`, ...leves];
  } else if (leves.length) saude = "atencao";

  return { id, nome, cor, saude, motivos, abertas, atrasadas, bloqueadas, aguardando, passosAbertos, passosAtrasados, concluidas30, proximoPrazo, ultima, diasSemMovimento, semanas };
}

const ORDEM: Saude[] = ["risco", "parada", "atencao", "em_dia", "sem_abertas"];

export function montarRadar(dados: Dados, hoje = hojeISO()): Radar {
  const cats = dados.categorias.items;
  const conhecidas = new Set(cats.map((c) => c.id));
  const porCat = new Map<string | null, Tarefa[]>();
  for (const t of dados.tarefas) {
    const k = t.categoriaId && conhecidas.has(t.categoriaId) ? t.categoriaId : null;
    porCat.set(k, [...(porCat.get(k) ?? []), t]);
  }

  const frentes: Frente[] = [];
  for (const c of cats) {
    const tarefas = porCat.get(c.id) ?? [];
    // categoria arquivada só aparece se ainda tiver tarefa aberta (aí é sinal de algo esquecido)
    if (c.arquivada && !tarefas.some(aberta)) continue;
    frentes.push(montarFrente(c.id, c.nome, c.cor, tarefas, hoje));
  }
  const soltas = porCat.get(null) ?? [];
  if (soltas.some(aberta)) frentes.push(montarFrente(null, "Sem categoria", "", soltas, hoje));
  frentes.sort((a, b) => ORDEM.indexOf(a.saude) - ORDEM.indexOf(b.saude) || b.abertas.length - a.abertas.length || a.nome.localeCompare(b.nome));

  // ---------- prazos ----------
  const inicio = inicioDaSemana(hoje);
  const semanas = Array.from({ length: RADAR.semanasDePrazo }, (_, i) => ({ inicio: somar(inicio, i * 7), fim: somar(inicio, i * 7 + 6) }));
  const fim = semanas[semanas.length - 1].fim;
  const prazos: ItemPrazo[] = [];
  for (const t of dados.tarefas) {
    if (!aberta(t)) continue;
    const frenteId = t.categoriaId && conhecidas.has(t.categoriaId) ? t.categoriaId : null;
    const por = (data: string | null | undefined, tipo: ItemPrazo["tipo"], titulo: string) => {
      if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data) || data > fim) return;
      prazos.push({ data, tipo, titulo, tarefaId: t.id, tarefaTitulo: t.titulo, frenteId, atrasado: data < hoje });
    };
    por(t.prazo, "tarefa", t.titulo);
    // follow-up vencido não é atraso de entrega: só entra enquanto está por vir
    if (t.lembrarEm && t.lembrarEm >= hoje) por(t.lembrarEm, "lembrar", `Voltar em: ${t.titulo}`);
    for (const r of t.registros) for (const p of r.proximosPassos) if (!p.feito) por(p.prazo, "passo", p.texto);
  }
  prazos.sort((a, b) => a.data.localeCompare(b.data) || a.tarefaTitulo.localeCompare(b.tarefaTitulo) || a.titulo.localeCompare(b.titulo));

  const contagem = { risco: 0, parada: 0, atencao: 0, em_dia: 0, sem_abertas: 0 } as Record<Saude, number>;
  for (const f of frentes) contagem[f.saude]++;
  return { hoje, frentes, prazos, semanas, contagem };
}

/** Em que coluna da linha de prazos um item cai: -1 = atrasado, 0 = semana atual, 1 = a seguinte... */
export function colunaDoPrazo(radar: Radar, item: ItemPrazo): number {
  if (item.atrasado) return -1;
  return radar.semanas.findIndex((s) => item.data >= s.inicio && item.data <= s.fim);
}

/**
 * Status das frentes em texto simples, para mandar ao gestor. Só o que está nos dados: nada é inventado e não há IA.
 * `ids` limita às frentes escolhidas (null = todas as que têm tarefa aberta ou concluíram algo no mês).
 */
export function textoDoRadar(radar: Radar, ids: (string | null)[] | null = null): string {
  const escolhidas = radar.frentes.filter((f) => (ids ? ids.includes(f.id) : f.abertas.length > 0 || f.concluidas30 > 0));
  const L: string[] = [`Status das frentes em ${formatarData(radar.hoje)}`];
  const resumo = SAUDES.filter((s) => s.id !== "sem_abertas")
    .map((s) => ({ s, n: escolhidas.filter((f) => f.saude === s.id).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${x.s.frase}`);
  if (resumo.length) L.push(`${plural(escolhidas.length, "frente", "frentes")}: ${resumo.join(", ")}.`);
  if (!escolhidas.length) L.push("Nenhuma frente com tarefa aberta.");

  for (const f of escolhidas) {
    L.push("", `${f.nome}: ${SAUDES.find((s) => s.id === f.saude)?.frase ?? f.saude}`);
    const partes = [
      f.atrasadas.length ? plural(f.atrasadas.length, "atrasada", "atrasadas") : "",
      f.bloqueadas.length ? plural(f.bloqueadas.length, "bloqueada", "bloqueadas") : "",
      f.aguardando.length ? `${f.aguardando.length} aguardando retorno` : "",
    ].filter(Boolean);
    L.push(`- ${plural(f.abertas.length, "tarefa aberta", "tarefas abertas")}${partes.length ? ` (${partes.join(", ")})` : ""}${f.concluidas30 ? `; ${plural(f.concluidas30, "concluída", "concluídas")} nos últimos 30 dias` : ""}.`);
    for (const t of f.atrasadas) L.push(`- Atrasada: ${t.titulo} (prazo ${formatarData(t.prazo)})`);
    for (const t of f.bloqueadas) L.push(`- Bloqueada: ${t.titulo}`);
    for (const t of f.aguardando) L.push(`- Aguardando retorno: ${t.titulo}${resumoEspera(t) ? ` (${resumoEspera(t)})` : ""}`);
    if (f.proximoPrazo) L.push(`- Próximo prazo: ${formatarData(f.proximoPrazo.data)}, ${f.proximoPrazo.tarefa.titulo}`);
    if (f.passosAbertos) L.push(`- ${plural(f.passosAbertos, "próximo passo em aberto", "próximos passos em aberto")}${f.passosAtrasados ? `, ${f.passosAtrasados} com prazo vencido` : ""}.`);
    if (f.ultima) L.push(`- Último movimento: ${formatarData(f.ultima)}${f.diasSemMovimento ? ` (há ${plural(f.diasSemMovimento, "dia", "dias")})` : " (hoje)"}.`);
  }
  return L.join("\n") + "\n";
}
