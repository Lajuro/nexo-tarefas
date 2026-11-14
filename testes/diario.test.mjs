// Testes das funções puras das novidades da 2.8: Diário (lib/diario.ts), "esperando quem" (lib/espera.ts e
// lib/acoes.ts), modelos de tarefa (lib/modelos.ts) e sessão de foco (lib/acoes.ts).
// Uso: node testes/diario.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/diario.test.mjs)

import assert from "node:assert/strict";
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
    export async function resolve(especificador, contexto, proximo) {
      try { return await proximo(especificador, contexto); }
      catch (e) {
        if (especificador.startsWith(".") && !/\\.[cm]?[jt]s$/.test(especificador)) return proximo(especificador + ".ts", contexto);
        throw e;
      }
    }
    export async function load(url, contexto, proximo) {
      if (url.startsWith("file:") && url.endsWith(".ts")) return proximo(url, { ...contexto, format: "module-typescript" });
      return proximo(url, contexto);
    }`),
);

const D = await import("../lib/diario.ts");
const E = await import("../lib/espera.ts");
const A = await import("../lib/acoes.ts");
const M = await import("../lib/modelos.ts");
const T = await import("../lib/tipos.ts");

let falhas = 0;
let total = 0;
function teste(nome, fn) {
  total++;
  try {
    fn();
    console.log("ok   " + nome);
  } catch (e) {
    falhas++;
    console.log("FALHA " + nome + "\n      " + String(e.message).split("\n").join("\n      "));
  }
}

const p2 = (n) => String(n).padStart(2, "0");
const dia = (delta, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
/** Carimbo ISO ao meio-dia local do dia pedido (para dataLocal devolver esse mesmo dia em qualquer fuso). */
const carimbo = (data) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d, 12, 0, 0).toISOString();
};

const tarefa = (x) => T.normalizarTarefa(x);
const T1 = tarefa({
  id: "t1", titulo: "Onboarding do squad de Pagamentos", categoriaId: "c1", status: "em_andamento",
  registros: [
    { id: "r1", tipo: "marco", data: "2026-11-02", titulo: "Tarefa criada" },
    { id: "r2", tipo: "reuniao", data: "2026-11-03", hora: "10:00", titulo: "Kickoff", participantes: ["Marina Souza", "Felipe"], resumoIA: "Alinhamos o escopo.",
      proximosPassos: [
        { id: "p1", texto: "Enviar a documentação", feito: true, feitoEm: carimbo("2026-11-04") },
        { id: "p2", texto: "Liberar o acesso", feito: false, responsavel: "Marina Souza" },
        { id: "p3", texto: "Agendar a revisão", feito: true, feitoEm: carimbo("2026-11-04"), responsavel: "Marina Souza" },
      ] },
    { id: "r3", tipo: "atividade", data: "2026-11-04", titulo: "Enviei a documentação", anotacoes: "Mandei por e-mail." },
  ],
});
const T2 = tarefa({
  id: "t2", titulo: "Revisar a política de exceções", categoriaId: "c2", status: "concluida",
  registros: [
    { id: "r4", tipo: "decisao", data: "2026-11-04", titulo: "Prazo máximo de 90 dias" },
    { id: "r5", tipo: "marco", data: "2026-11-05", titulo: "Concluída", alteracoes: { status: { de: "em_andamento", para: "concluida" } } },
  ],
});

// ---------- Diário ----------

teste("diário: agrupa por dia, do mais recente para o mais antigo", () => {
  const dias = D.montarDiario([T1, T2]);
  assert.deepEqual(dias.map((d) => d.data), ["2026-11-05", "2026-11-04", "2026-11-03", "2026-11-02"]);
  // dia 04: atividade e decisão (registros) e dois passos concluídos, com os passos por último
  const d4 = dias[1].eventos;
  assert.equal(d4.length, 4);
  assert.deepEqual(d4.map((e) => e.tipo), ["registro", "registro", "passo", "passo"]);
});

teste("diário: passo concluído cai no dia em que foi feito, não no dia do registro", () => {
  const passos = D.eventosDoDiario([T1], { tipo: "passos" });
  assert.equal(passos.length, 2);
  assert.ok(passos.every((e) => e.tipo === "passo" && e.data === "2026-11-04"));
});

teste("diário: filtro por tipo, categoria e pessoa", () => {
  assert.deepEqual(D.eventosDoDiario([T1, T2], { tipo: "reuniao" }).map((e) => e.chave), ["r:r2"]);
  assert.deepEqual(D.eventosDoDiario([T1, T2], { categoriaId: "c2" }).map((e) => e.chave), ["r:r4", "r:r5"]);
  // por pessoa: a reunião em que ela estava e o passo dela que foi concluído (sem acento e sem maiúscula)
  assert.deepEqual(D.eventosDoDiario([T1, T2], { pessoa: "marina souza" }).map((e) => e.chave).sort(), ["p:p3", "r:r2"]);
});

teste("diário: mapa de atividade não conta marco de criação, mas conta concluir", () => {
  const m = D.atividadePorDia([T1, T2]);
  assert.equal(m.get("2026-11-02"), undefined); // só "Tarefa criada"
  assert.equal(m.get("2026-11-03"), 1);
  assert.equal(m.get("2026-11-04"), 4);
  assert.equal(m.get("2026-11-05"), 1); // concluir conta
  assert.equal(D.atividadePorDia([T1, T2], "c2").get("2026-11-04"), 1);
});

teste("diário: sequência de dias úteis ignora o fim de semana e não quebra com hoje vazio", () => {
  // 2026-11-13 é sexta. Atividade de terça (10) a sexta (13), e na segunda seguinte (16).
  const m = new Map([["2026-11-10", 1], ["2026-11-11", 2], ["2026-11-12", 1], ["2026-11-13", 1], ["2026-11-16", 1]]);
  assert.deepEqual(D.sequencia(m, "2026-11-16"), { atual: 5, melhor: 5 }); // sábado e domingo não quebram
  assert.deepEqual(D.sequencia(m, "2026-11-17"), { atual: 5, melhor: 5 }); // terça ainda sem nada: o dia não acabou
  assert.deepEqual(D.sequencia(m, "2026-11-18"), { atual: 0, melhor: 5 }); // terça passou em branco
  assert.deepEqual(D.sequencia(new Map(), "2026-11-18"), { atual: 0, melhor: 0 });
});

teste("diário: semanas do mapa começam na segunda e não passam de hoje", () => {
  const s = D.semanasDoMapa("2026-11-13", 4); // sexta
  assert.equal(s.length, 4);
  assert.ok(s.every((sem) => sem.length === 7));
  assert.equal(s[0][0], "2026-10-19"); // segunda, três semanas antes
  assert.deepEqual(s[3], ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", null, null]);
});

teste("diário: níveis de intensidade", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 50].map(D.nivelDeAtividade), [0, 1, 2, 2, 3, 3, 4, 4]);
});

teste("diário: texto do dia só tem o que está registrado", () => {
  const dias = D.montarDiario([T1, T2]);
  const texto = D.textoDoDia(dias.find((d) => d.data === "2026-11-03"));
  assert.ok(texto.startsWith("Terça-feira, 03/11/26"));
  assert.ok(texto.includes("- [Reunião] Kickoff (Onboarding do squad de Pagamentos): Alinhamos o escopo."));
  assert.ok(texto.includes("  Com: Marina Souza, Felipe"));
  const d4 = D.textoDoDia(dias.find((d) => d.data === "2026-11-04"));
  assert.ok(d4.includes("- Passo concluído: Enviar a documentação (Onboarding do squad de Pagamentos)"));
  assert.ok(D.textoDosDias(dias).split("\n\n").length === 4);
});

// ---------- esperando quem ----------

const hoje = T.hojeISO();

teste("espera: normalizar aceita só o que faz sentido", () => {
  assert.equal(T.normalizarEspera(null), null);
  assert.equal(T.normalizarEspera("Marina"), null);
  assert.equal(T.normalizarEspera({ quem: "  ", oQue: "" }), null);
  const e = T.normalizarEspera({ quem: " Marina ", oQue: "o acesso", desde: "31/12", cobradoEm: 5 });
  assert.deepEqual(e, { quem: "Marina", oQue: "o acesso", desde: hoje, cobradoEm: null });
  assert.equal(T.normalizarEspera({ quem: "x".repeat(500) }).quem.length, 120);
});

teste("espera: comEspera guarda desde quando e zera a cobrança se mudou o assunto", () => {
  let t = tarefa({ id: "t3", titulo: "X", status: "aguardando", esperando: { quem: "Marina", oQue: "o acesso", desde: "2026-11-01", cobradoEm: "2026-11-05" } });
  t = A.comEspera(t, { quem: "Marina", oQue: "o acesso" });
  assert.deepEqual(t.esperando, { quem: "Marina", oQue: "o acesso", desde: "2026-11-01", cobradoEm: "2026-11-05" });
  t = A.comEspera(t, { quem: "Bruno", oQue: "a correção" });
  assert.deepEqual(t.esperando, { quem: "Bruno", oQue: "a correção", desde: "2026-11-01", cobradoEm: null });
  assert.equal(A.comEspera(t, { quem: " ", oQue: "" }).esperando, null);
  assert.equal(A.comEspera(t, null).esperando, null);
});

teste("espera: cobrar anota na timeline e marca a data", () => {
  const t = A.comCobranca(tarefa({ id: "t3", titulo: "X", status: "aguardando", esperando: { quem: "Marina", oQue: "o acesso", desde: "2026-11-01" } }));
  assert.equal(t.esperando.cobradoEm, hoje);
  const r = t.registros.at(-1);
  assert.equal(r.tipo, "atividade");
  assert.equal(r.titulo, "Cobrei Marina");
  assert.equal(r.anotacoes, "Sobre: o acesso");
  assert.equal(E.diasEsperando(t), 0);
});

teste("espera: sair de aguardando limpa a espera e escreve no marco de quem se esperava", () => {
  const t = tarefa({ id: "t3", titulo: "X", status: "aguardando", esperando: { quem: "Marina", oQue: "o acesso", desde: "2026-11-01", cobradoEm: "2026-11-05" } });
  const depois = A.aplicarStatus(t, "em_andamento", t);
  assert.equal(depois.esperando, null);
  assert.equal(depois.registros.at(-1).anotacoes, "Estava esperando Marina: o acesso (desde 01/11, cobrado em 05/11).");
  // entrar em aguardando não apaga o que já estava anotado na mesma mudança
  const entrando = A.aplicarStatus({ ...tarefa({ id: "t4", titulo: "Y" }), esperando: { quem: "Bruno", oQue: "", desde: hoje } }, "aguardando");
  assert.equal(entrando.esperando.quem, "Bruno");
});

teste("espera: dias contam desde a última cobrança, e só em aguardando", () => {
  const base = { id: "t5", titulo: "Z", esperando: { quem: "Marina", oQue: "", desde: dia(-10), cobradoEm: dia(-3) } };
  assert.equal(E.diasEsperando(tarefa({ ...base, status: "aguardando" })), 3);
  assert.equal(E.diasEsperando(tarefa({ ...base, status: "aguardando", esperando: { ...base.esperando, cobradoEm: null } })), 10);
  assert.equal(E.diasEsperando(tarefa({ ...base, status: "em_andamento" })), null);
  assert.equal(E.diasEsperando(tarefa({ id: "t6", titulo: "W", status: "aguardando" })), null);
});

teste("espera: mensagem de cobrança só usa o que o usuário escreveu", () => {
  const t = tarefa({ id: "t7", titulo: "Onboarding do squad", status: "aguardando", esperando: { quem: "Marina Souza", oQue: "liberar o acesso", desde: hoje } });
  const m = E.mensagemCobranca(t);
  assert.ok(m.startsWith("Oi, Marina! Tudo bem?"));
  assert.ok(m.includes("liberar o acesso") && m.includes('"Onboarding do squad"'));
  assert.ok(!m.includes("já falamos"));
  assert.ok(E.mensagemCobranca({ ...t, esperando: { ...t.esperando, cobradoEm: hoje } }).includes("já falamos disso"));
  const semNome = E.mensagemCobranca(tarefa({ id: "t8", titulo: "Relatório", status: "aguardando" }));
  assert.ok(semNome.startsWith("Oi! Tudo bem?") && semNome.includes('"Relatório"'));
});

// ---------- modelos de tarefa ----------

teste("modelo: passos do texto tiram marcadores, vazios e repetidos", () => {
  assert.deepEqual(
    M.passosDoTexto("- Agendar a abertura\n\n* Pedir os acessos\n1. Rodar a primeira análise\n[ ] Treinar o time\n- [x] Fechar\nagendar a abertura\n   "),
    ["Agendar a abertura", "Pedir os acessos", "Rodar a primeira análise", "Treinar o time", "Fechar"],
  );
  assert.equal(M.passosDoTexto(Array.from({ length: 80 }, (_, i) => `passo ${i}`).join("\n")).length, 40);
  assert.equal(M.passosDoTexto("x".repeat(900))[0].length, 300);
});

teste("modelo: tirado de uma tarefa leva campos e todos os passos, sem repetir", () => {
  const m = M.modeloDaTarefa(T1);
  assert.equal(m.nome, T1.titulo);
  assert.equal(m.categoriaId, "c1");
  assert.deepEqual(m.passos, ["Enviar a documentação", "Liberar o acesso", "Agendar a revisão"]);
  assert.ok(m.id.startsWith("mo") && m.id !== T1.id);
  assert.equal(m.usos, 0);
});

teste("modelo: registro dos passos entra como nota com passos em aberto", () => {
  assert.equal(M.registroDosPassos({ nome: "X" }, []), null);
  const r = M.registroDosPassos({ nome: "Levar a ferramenta" }, ["A", "B"]);
  assert.equal(r.tipo, "nota");
  assert.equal(r.titulo, "Passos do modelo “Levar a ferramenta”");
  assert.deepEqual(r.proximosPassos.map((p) => [p.texto, p.feito]), [["A", false], ["B", false]]);
  assert.equal(new Set(r.proximosPassos.map((p) => p.id)).size, 2);
});

teste("modelo: normalizar limita prioridade e prazo", () => {
  const m = T.normalizarModelo({ nome: "M", prioridade: 0, prazoEmDias: -4, passos: "não é lista", tags: [1, "a"] });
  assert.equal(m.prioridade, 1);
  assert.equal(m.prazoEmDias, null);
  assert.deepEqual(m.passos, []);
  assert.deepEqual(m.tags, ["a"]);
  assert.equal(T.normalizarModelo({ prazoEmDias: 99999 }).prazoEmDias, 3650);
});

// ---------- sessão de foco ----------

teste("sessão de foco: vira atividade com a duração e soma no total da tarefa", () => {
  let t = A.comSessaoDeFoco(tarefa({ id: "t9", titulo: "Foco" }), 24.6, "  Terminei o roteiro.  ");
  const r = t.registros.at(-1);
  assert.equal(r.tipo, "atividade");
  assert.equal(r.titulo, "Sessão de foco (25 min)");
  assert.equal(r.duracaoMin, 25);
  assert.equal(r.anotacoes, "Terminei o roteiro.");
  assert.equal(r.data, hoje);
  t = A.comSessaoDeFoco(t, 0, "");
  assert.equal(t.registros.at(-1).duracaoMin, 1); // nunca menos de 1 minuto
  assert.equal(A.minutosEmFoco(t), 26);
});

teste("sessão de foco: formatar minutos", () => {
  assert.deepEqual([5, 59, 60, 75, 120, 135].map(A.formatarMinutos), ["5 min", "59 min", "1h", "1h 15min", "2h", "2h 15min"]);
});

teste("registro: duração inválida vira 0 e nunca passa de um dia", () => {
  assert.equal(T.normalizarRegistro({ duracaoMin: "abc" }).duracaoMin, 0);
  assert.equal(T.normalizarRegistro({}).duracaoMin, 0);
  assert.equal(T.normalizarRegistro({ duracaoMin: 999999 }).duracaoMin, 1440);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
