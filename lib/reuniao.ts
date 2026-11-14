// Modo reunião: o antes (pauta), o durante (captura) e o depois (registro e ata) de uma reunião de uma tarefa.
// Funções puras. A tela está em app/tarefas/[id]/reuniao/page.tsx e o que está sendo digitado fica no
// navegador ("nexo:reuniao:<tarefaId>") até virar registro.

import { type PassoAberto, aberta, passosAbertosDe } from "./lembretes";
import { acharPessoa, chavesDaPessoa, chaveNome } from "./pessoas";
import { paraTextoPlano } from "./texto-rico";
import { type Dados, type Registro, type Tarefa, formatarData, hojeISO, normalizarRegistro, novoId, ordenarRegistros } from "./tipos";

export interface PassoNovo { id: string; texto: string; responsavel: string; prazo: string }

/** O que está sendo capturado na reunião em andamento. */
export interface Reuniao {
  /** Quando começou (ms). 0 = ainda preparando: o relógio não está correndo. */
  inicio: number;
  titulo: string;
  participantes: string[];
  /** Anotações livres, em Markdown. */
  notas: string;
  decisoes: string[];
  passos: PassoNovo[];
  impedimentos: string;
  /** Passos antigos da tarefa resolvidos nesta reunião ("registroId:passoId"). */
  resolvidos: string[];
}

export const reuniaoNova = (): Reuniao => ({ inicio: 0, titulo: "", participantes: [], notas: "", decisoes: [], passos: [], impedimentos: "", resolvidos: [] });

const textos = (x: unknown, max: number) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").map((v) => v.slice(0, 500)).slice(0, max) : []);

/** O rascunho da reunião vem do localStorage: só entra o que tem a forma certa. */
export function normalizarReuniao(x: unknown): Reuniao | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Partial<Record<keyof Reuniao, unknown>>;
  const inicio = Number(r.inicio);
  if (!Number.isFinite(inicio) || inicio < 0) return null;
  return {
    inicio,
    titulo: typeof r.titulo === "string" ? r.titulo.slice(0, 300) : "",
    participantes: textos(r.participantes, 40),
    notas: typeof r.notas === "string" ? r.notas.slice(0, 200_000) : "",
    decisoes: textos(r.decisoes, 60),
    passos: (Array.isArray(r.passos) ? r.passos : [])
      .filter((p): p is Partial<PassoNovo> => !!p && typeof p === "object" && typeof (p as PassoNovo).texto === "string")
      .slice(0, 60)
      .map((p) => ({
        id: typeof p.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ? p.id : novoId("p"),
        texto: String(p.texto).slice(0, 500),
        responsavel: typeof p.responsavel === "string" ? p.responsavel.slice(0, 120) : "",
        prazo: typeof p.prazo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.prazo) ? p.prazo : "",
      })),
    impedimentos: typeof r.impedimentos === "string" ? r.impedimentos.slice(0, 20_000) : "",
    resolvidos: textos(r.resolvidos, 200),
  };
}

/** Há algo digitado que valha guardar? */
export const reuniaoTemConteudo = (r: Reuniao) =>
  !!(r.titulo.trim() || r.notas.trim() || r.decisoes.length || r.passos.length || r.impedimentos.trim() || r.participantes.length || r.resolvidos.length);

export interface Pauta {
  /** Passos em aberto desta tarefa (dá para marcar como resolvidos na reunião). */
  passosDaTarefa: PassoAberto[];
  /** Para cada participante: o que está com ele em OUTRAS tarefas e o que você espera dele. */
  porPessoa: { nome: string; passos: PassoAberto[]; esperas: Tarefa[] }[];
  /** As últimas decisões registradas nesta tarefa. */
  decisoes: { data: string; titulo: string; texto: string }[];
  /** O último registro (para lembrar onde a conversa parou). */
  ultimo: Registro | null;
}

export function montarPauta(dados: Dados, tarefa: Tarefa, participantes: string[]): Pauta {
  const todos = passosAbertosDe(dados.tarefas);
  const recentes = ordenarRegistros(tarefa.registros, true).filter((r) => r.tipo !== "marco");
  const pessoas = dados.pessoas?.items ?? [];
  const vistos = new Set<string>();
  return {
    passosDaTarefa: todos.filter((x) => x.tarefa.id === tarefa.id),
    porPessoa: participantes.flatMap((bruto) => {
      const nome = bruto.trim();
      if (!nome) return [];
      // quem está cadastrado é reconhecido também pelos apelidos ("Marina" e "Marina Souza" são a mesma pessoa)
      const pessoa = acharPessoa(pessoas, nome);
      const chaves = [chaveNome(nome), ...(pessoa ? chavesDaPessoa(pessoa) : [])];
      if (chaves.some((k) => vistos.has(k))) return []; // a mesma pessoa escrita duas vezes entra uma vez
      for (const k of chaves) vistos.add(k);
      const ehEla = (n?: string | null) => !!n && chaves.includes(chaveNome(n));
      return [{
        nome,
        passos: todos.filter((x) => x.tarefa.id !== tarefa.id && ehEla(x.passo.responsavel)),
        esperas: dados.tarefas.filter((t) => t.id !== tarefa.id && aberta(t) && t.status === "aguardando" && ehEla(t.esperando?.quem)),
      }];
    }),
    decisoes: recentes.filter((r) => r.decisoes.trim()).slice(0, 3).map((r) => ({ data: r.data, titulo: r.titulo, texto: r.decisoes })),
    ultimo: recentes[0] ?? null,
  };
}

const linhaDoPasso = (texto: string, responsavel?: string | null, prazo?: string | null) =>
  `- ${texto}${responsavel || prazo ? ` (${[responsavel ? `responsável: ${responsavel}` : "", prazo ? `até ${formatarData(prazo)}` : ""].filter(Boolean).join(", ")})` : ""}`;

/** Pauta em texto simples, para mandar antes da reunião. */
export function textoDaPauta(tarefa: Tarefa, pauta: Pauta): string {
  const L = [`Pauta: ${tarefa.titulo}`, ""];
  if (pauta.passosDaTarefa.length) L.push("Pendências para revisar:", ...pauta.passosDaTarefa.map((x) => linhaDoPasso(x.passo.texto, x.passo.responsavel, x.passo.prazo)), "");
  if (tarefa.esperando) L.push(`Aguardando ${[tarefa.esperando.quem, tarefa.esperando.oQue].filter(Boolean).join(": ")}`, "");
  if (pauta.decisoes.length) L.push("Últimas decisões:", ...pauta.decisoes.map((d) => `- ${formatarData(d.data)}: ${paraTextoPlano(d.texto).replace(/\n/g, "; ")}`), "");
  for (const p of pauta.porPessoa) {
    if (!p.passos.length && !p.esperas.length) continue;
    L.push(`Com ${p.nome}, de outras frentes:`);
    L.push(...p.passos.map((x) => `${linhaDoPasso(x.passo.texto, null, x.passo.prazo)} [${x.tarefa.titulo}]`));
    L.push(...p.esperas.map((t) => `- retorno pendente: ${t.esperando?.oQue || t.titulo} [${t.titulo}]`));
    L.push("");
  }
  return L.join("\n").trim() + "\n";
}

/** Minutos de reunião até agora (0 se o relógio não foi ligado). */
const minutosDe = (r: Reuniao, fim = Date.now()) => (r.inicio > 0 ? Math.max(1, Math.round((fim - r.inicio) / 60_000)) : 0);

/** O registro que a reunião vira na linha do tempo. */
export function registroDaReuniao(r: Reuniao): Registro {
  const d = new Date(r.inicio || Date.now());
  const p2 = (n: number) => String(n).padStart(2, "0");
  return normalizarRegistro({
    id: novoId("r"),
    tipo: "reuniao",
    data: hojeISO(),
    hora: `${p2(d.getHours())}:${p2(d.getMinutes())}`,
    titulo: r.titulo.trim() || "Reunião",
    participantes: r.participantes.map((p) => p.trim()).filter(Boolean),
    anotacoes: r.notas,
    decisoes: r.decisoes.map((x) => x.trim()).filter(Boolean).map((x) => `- ${x}`).join("\n"),
    proximosPassos: r.passos.filter((p) => p.texto.trim()).map((p) => ({ id: p.id, texto: p.texto.trim(), feito: false, responsavel: p.responsavel.trim(), prazo: p.prazo || null })),
    impedimentos: r.impedimentos.trim(),
  });
}

/** Grava a reunião na tarefa: o registro novo e os passos antigos que foram resolvidos nela. */
export function comReuniao(t: Tarefa, r: Reuniao, registro: Registro = registroDaReuniao(r)): Tarefa {
  const resolvidos = new Set(r.resolvidos);
  const agora = new Date().toISOString();
  return {
    ...t,
    registros: [
      ...t.registros.map((reg) =>
        reg.proximosPassos.some((p) => resolvidos.has(`${reg.id}:${p.id}`) && !p.feito)
          ? { ...reg, proximosPassos: reg.proximosPassos.map((p) => (resolvidos.has(`${reg.id}:${p.id}`) && !p.feito ? { ...p, feito: true, feitoEm: agora } : p)) }
          : reg,
      ),
      registro,
    ],
  };
}

/** Ata em texto simples, para mandar depois da reunião. Só o que foi registrado: nada é inventado. */
export function textoDaAta(tarefa: Tarefa, r: Reuniao, fim = Date.now()): string {
  const min = minutosDe(r, fim);
  const L = [`Ata: ${r.titulo.trim() || "Reunião"} (${formatarData(hojeISO())}${min ? `, ${min} min` : ""})`, `Assunto: ${tarefa.titulo}`];
  const gente = r.participantes.map((p) => p.trim()).filter(Boolean);
  if (gente.length) L.push(`Participantes: ${gente.join(", ")}`);
  const decisoes = r.decisoes.map((x) => x.trim()).filter(Boolean);
  if (decisoes.length) L.push("", "Decisões:", ...decisoes.map((x) => `- ${x}`));
  const passos = r.passos.filter((p) => p.texto.trim());
  if (passos.length) L.push("", "Próximos passos:", ...passos.map((p) => linhaDoPasso(p.texto.trim(), p.responsavel.trim(), p.prazo)));
  const marcados = new Set(r.resolvidos);
  const resolvidos = tarefa.registros.flatMap((reg) => reg.proximosPassos.filter((p) => marcados.has(`${reg.id}:${p.id}`)).map((p) => p.texto));
  if (resolvidos.length) L.push("", "Pendências resolvidas:", ...resolvidos.map((x) => `- ${x}`));
  if (r.impedimentos.trim()) L.push("", "Impedimentos:", r.impedimentos.trim());
  const notas = paraTextoPlano(r.notas);
  if (notas) L.push("", "Anotações:", notas);
  return L.join("\n") + "\n";
}

export const duracaoDaReuniao = minutosDe;
