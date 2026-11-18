// Testes das novidades de organização da 3.7: dependências entre tarefas (lib/dependencias.ts), tarefas que se
// repetem (lib/recorrencia.ts), "falar com Fulano" (lib/assuntos.ts) e os lembretes que nascem delas (lib/lembretes.ts).
// Uso: node testes/dependencias.test.mjs   (Node 22.18+ importa .ts direto)

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

const D = await import("../lib/dependencias.ts");
const Rc = await import("../lib/recorrencia.ts");
const As = await import("../lib/assuntos.ts");
const L = await import("../lib/lembretes.ts");
const Re = await import("../lib/reuniao.ts");
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
const dia = (delta) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const carimbo = (data) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d, 12).toISOString();
};
const tarefa = (x) => T.normalizarTarefa(x);

// ---------- dependências ----------

teste("dependeDe: só ids válidos, sem repetir e sem a própria tarefa", () => {
  const t = tarefa({ id: "t1", dependeDe: ["t2", "t2", "t1", "../x", 5, "t3"] });
  assert.deepEqual(t.dependeDe, ["t2", "t3"]);
  assert.deepEqual(tarefa({ id: "t9" }).dependeDe, [], "tarefa antiga sem o campo vale como lista vazia");
  assert.equal(tarefa({ id: "t1", dependeDe: ["t2"], campoNovo: 1 }).campoNovo, 1, "campo desconhecido é preservado");
});

const a = tarefa({ id: "a", titulo: "A", status: "em_andamento", dependeDe: ["b"] });
const b = tarefa({ id: "b", titulo: "B", status: "a_fazer", dependeDe: ["c"] });
const c = tarefa({ id: "c", titulo: "C", status: "concluida", concluidaEm: carimbo(dia(-2)) });

teste("dependências: abertas, fechadas, sumidas e quem segura quem", () => {
  const d = D.dependenciasDe(tarefa({ id: "x", dependeDe: ["a", "c", "zz"] }), [a, b, c]);
  assert.deepEqual(d.abertas.map((t) => t.id), ["a"]);
  assert.deepEqual(d.fechadas.map((t) => t.id), ["c"]);
  assert.deepEqual(d.sumidas, ["zz"]);
  assert.deepEqual(D.quemDependeDe("b", [a, b, c]).map((t) => t.id), ["a"]);
});

teste("dependências: ligar que fecharia um ciclo é detectado (direto e indireto)", () => {
  assert.equal(D.criaCiclo([a, b, c], "c", "a"), true, "c → a → b → c");
  assert.equal(D.criaCiclo([a, b, c], "b", "a"), true, "b → a → b");
  assert.equal(D.criaCiclo([a, b, c], "a", "c"), false);
  assert.equal(D.criaCiclo([a, b, c], "a", "a"), true, "a si mesma");
});

teste("dependências: comDependencia acrescenta, não repete e tira", () => {
  const x = D.comDependencia(a, "c", true);
  assert.deepEqual(x.dependeDe, ["b", "c"]);
  assert.deepEqual(D.comDependencia(x, "c", true).dependeDe, ["b", "c"]);
  assert.deepEqual(D.comDependencia(x, "b", false).dependeDe, ["c"]);
  assert.deepEqual(D.comDependencia(a, "a", true).dependeDe, ["b"], "não liga a si mesma");
});

teste("lembrete 'destravou' quando tudo de que ela dependia terminou", () => {
  const presa = tarefa({ id: "p", titulo: "Presa", status: "bloqueada", dependeDe: ["c"], criadaEm: carimbo(dia(-30)) });
  const ls = L.gerarLembretes([presa, c]);
  const l = ls.find((x) => x.tipo === "destravou");
  assert.ok(l, "o lembrete não apareceu");
  assert.match(l.titulo, /Destravou: “C” terminou/);
  assert.equal(l.tarefaId, "p");
  assert.ok(!L.gerarLembretes([tarefa({ ...presa, dependeDe: ["b"] }), b]).some((x) => x.tipo === "destravou"), "com dependência aberta não destrava");
  const antiga = tarefa({ id: "c2", titulo: "C2", status: "concluida", concluidaEm: carimbo(dia(-20)) });
  const andando = tarefa({ id: "q", titulo: "Q", status: "em_andamento", dependeDe: ["c2"] });
  assert.ok(!L.gerarLembretes([andando, antiga]).some((x) => x.tipo === "destravou"), "destravou há muito tempo e já andando: não lembra mais");
});

// ---------- recorrência ----------

const semana = (desde, diaDaSemana, ultima = null) => T.normalizarRepeticao({ tipo: "semana", diaDaSemana, desde, ultima });

teste("repetição inválida vira null; válida é conferida", () => {
  assert.equal(T.normalizarRepeticao({ tipo: "semana", diaDaSemana: 9, desde: "2026-11-01" }), null);
  assert.equal(T.normalizarRepeticao({ tipo: "mes", diaDoMes: 0, desde: "2026-11-01" }), null);
  assert.equal(T.normalizarRepeticao({ tipo: "dias", cadaDias: 3, desde: "2026-02-30" }), null, "data que não existe");
  assert.equal(T.normalizarRepeticao({ tipo: "hora", desde: "2026-11-01" }), null);
  assert.deepEqual(T.normalizarRepeticao({ tipo: "dias", cadaDias: "14", desde: "2026-11-01", ultima: "x" }), { tipo: "dias", cadaDias: 14, desde: "2026-11-01", ultima: null });
  assert.equal(T.normalizarModelo({ nome: "M" }).repetir, null, "modelo antigo continua sem repetir");
});

teste("toda segunda: a devida é a segunda mais recente ainda não atendida", () => {
  // 2026-11-16 e 2026-11-23 são segundas
  const r = semana("2026-11-01", 1);
  assert.equal(Rc.ocorrenciaDevida(r, "2026-11-18"), "2026-11-16");
  assert.equal(Rc.ocorrenciaDevida({ ...r, ultima: "2026-11-16" }, "2026-11-18"), "", "já atendida");
  assert.equal(Rc.proximaOcorrencia({ ...r, ultima: "2026-11-16" }, "2026-11-18"), "2026-11-23");
  assert.equal(Rc.ocorrenciaDevida(r, "2026-11-23"), "2026-11-23", "no próprio dia");
});

teste("várias perdidas (férias) viram um lembrete só, da mais recente", () => {
  const r = semana("2026-10-01", 1, "2026-10-05");
  assert.equal(Rc.ocorrenciaDevida(r, "2026-11-18"), "2026-11-16");
});

teste("todo dia 31: em mês curto vale o último dia", () => {
  const r = T.normalizarRepeticao({ tipo: "mes", diaDoMes: 31, desde: "2026-01-01" });
  assert.equal(Rc.ocorrenciaEmOuDepois(r, "2026-02-10"), "2026-02-28");
  assert.equal(Rc.ocorrenciaEmOuAntes(r, "2026-03-15"), "2026-02-28");
  assert.equal(Rc.ocorrenciaEmOuDepois(r, "2026-03-01"), "2026-03-31");
});

teste("a cada 14 dias conta a partir do começo; antes do começo não há nada", () => {
  const r = T.normalizarRepeticao({ tipo: "dias", cadaDias: 14, desde: "2026-11-02" });
  assert.equal(Rc.ocorrenciaEmOuAntes(r, "2026-11-20"), "2026-11-16");
  assert.equal(Rc.ocorrenciaEmOuDepois(r, "2026-11-17"), "2026-11-30");
  assert.equal(Rc.ocorrenciaDevida(r, "2026-11-01"), "");
});

teste("atender uma ocorrência nunca volta atrás", () => {
  const m = T.normalizarModelo({ nome: "M", repetir: { tipo: "semana", diaDaSemana: 1, desde: "2026-11-01", ultima: "2026-11-16" } });
  assert.equal(Rc.comOcorrenciaAtendida(m, "2026-11-09").repetir.ultima, "2026-11-16");
  assert.equal(Rc.comOcorrenciaAtendida(m, "2026-11-23").repetir.ultima, "2026-11-23");
  assert.equal(Rc.comOcorrenciaAtendida(T.normalizarModelo({ nome: "x" }), "2026-11-23").repetir, null);
});

teste("textos da repetição", () => {
  assert.equal(Rc.textoDaRepeticao(semana("2026-11-01", 1)), "Toda segunda");
  assert.equal(Rc.textoDaRepeticao(semana("2026-11-01", 6)), "Todo sábado");
  assert.equal(Rc.textoDaRepeticao({ tipo: "mes", diaDoMes: 5, desde: "2026-01-01" }), "Todo dia 5 do mês");
  assert.equal(Rc.textoDaRepeticao({ tipo: "dias", cadaDias: 14, desde: "2026-01-01" }), "A cada 14 dias");
});

teste("lembrete de repetição: sem tarefa, com o modelo e a data", () => {
  const hoje = dia(0);
  const m = T.normalizarModelo({ id: "mo1", nome: "Relatório mensal", repetir: { tipo: "dias", cadaDias: 1, desde: dia(-3) } });
  const l = L.gerarLembretes([], { modelos: [m] }).find((x) => x.tipo === "recorrencia");
  assert.ok(l);
  assert.equal(l.modeloId, "mo1");
  assert.equal(l.data, hoje);
  assert.equal(l.tarefaId, "");
  assert.equal(l.id, `recorrencia:mo1:${hoje}`);
  assert.ok(!L.gerarLembretes([], { modelos: [Rc.comOcorrenciaAtendida(m, hoje)] }).some((x) => x.tipo === "recorrencia"), "depois de criar ou pular, sai");
});

teste("agrupar por tarefa: cada modelo que se repete é um grupo próprio, com o modelo e a data", () => {
  const m1 = T.normalizarModelo({ id: "mo1", nome: "Relatório", repetir: { tipo: "dias", cadaDias: 1, desde: dia(-3) } });
  const m2 = T.normalizarModelo({ id: "mo2", nome: "Backup", repetir: { tipo: "dias", cadaDias: 1, desde: dia(-3) } });
  const grupos = L.agruparLembretes(L.gerarLembretes([], { modelos: [m1, m2] }));
  assert.equal(grupos.length, 2, "os dois modelos não podem cair no mesmo grupo de tarefa vazia");
  assert.deepEqual(grupos.map((g) => g.modeloId).sort(), ["mo1", "mo2"]);
  assert.ok(grupos.every((g) => g.data === dia(0)));
});

// ---------- falar com ----------

const dados = {
  pessoas: { rev: 1, items: [T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", apelidos: ["Marina"] })] },
  assuntos: {
    rev: 1,
    items: [
      T.normalizarAssunto({ id: "as1", pessoa: "Marina", texto: "Pedir a lista de squads", criadoEm: "2026-11-10T12:00:00.000Z" }),
      T.normalizarAssunto({ id: "as2", pessoa: "marina souza", texto: "Prazo do gate", criadoEm: "2026-11-11T12:00:00.000Z" }),
      T.normalizarAssunto({ id: "as3", pessoa: "Bruno", texto: "Acesso", criadoEm: "2026-11-11T12:00:00.000Z" }),
      T.normalizarAssunto({ id: "as4", pessoa: "Marina", texto: "Já tratado", resolvidoEm: "2026-11-12T12:00:00.000Z" }),
    ],
  },
};

teste("assunto: normalização limita tamanho e confere ids", () => {
  const x = T.normalizarAssunto({ pessoa: "  Fulano  ", texto: "a".repeat(2000), tarefaId: "../x", registroId: "r1", extra: 1 });
  assert.equal(x.pessoa, "Fulano");
  assert.equal(x.texto.length, 1000);
  assert.equal(x.tarefaId, null);
  assert.equal(x.registroId, "r1");
  assert.equal(x.extra, 1);
  assert.match(x.id, /^as/);
});

teste("assuntos com uma pessoa reconhecem apelidos e escondem os tratados", () => {
  assert.deepEqual(As.assuntosCom(dados, "Marina Souza").map((a) => a.id), ["as1", "as2"]);
  assert.deepEqual(As.assuntosCom(dados, "Marina").map((a) => a.id), ["as1", "as2"]);
  assert.deepEqual(As.assuntosCom(dados, "Marina", true).map((a) => a.id), ["as1", "as2", "as4"]);
  assert.deepEqual([...As.contagemPorPessoa(dados).values()].sort(), [1, 2], "Marina (pelo nome e pelo apelido) conta 2, Bruno 1");
});

teste("tratar e reabrir assunto guarda onde foi tratado", () => {
  const r = As.comAssuntoResolvido(dados.assuntos.items, ["as1"], true, "r9");
  const a1 = r.find((a) => a.id === "as1");
  assert.ok(a1.resolvidoEm);
  assert.equal(a1.registroId, "r9");
  const volta = As.comAssuntoResolvido(r, ["as1"], false).find((a) => a.id === "as1");
  assert.equal(volta.resolvidoEm, null);
  assert.equal(volta.registroId, null);
});

teste("modo reunião: assuntos do participante entram na pauta, no texto e na ata", () => {
  const t = tarefa({ id: "t1", titulo: "Onboarding" });
  const pauta = Re.montarPauta({ ...dados, tarefas: [t] }, t, ["Marina"]);
  assert.deepEqual(pauta.porPessoa[0].assuntos.map((a) => a.id), ["as1", "as2"]);
  assert.match(Re.textoDaPauta(t, pauta), /Para falar com Marina:\n- Pedir a lista de squads\n- Prazo do gate/);
  const r = { ...Re.reuniaoNova(), titulo: "Conversa", resolvidos: [As.chaveDoAssunto("as2")] };
  assert.deepEqual(As.idsDeAssuntos(r.resolvidos), ["as2"]);
  assert.match(Re.textoDaAta(t, r, Date.now(), dados.assuntos.items), /Assuntos tratados:\n- marina souza: Prazo do gate/);
  // marcar um assunto não mexe nos passos da tarefa
  assert.deepEqual(Re.comReuniao(t, r).registros.length, 1);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
