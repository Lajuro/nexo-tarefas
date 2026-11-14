// Testes da gamificação (lib/jogo.ts): XP, níveis, meta do dia e conquistas, calculados só a partir dos dados.
// Uso: node testes/jogo.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/jogo.test.mjs)

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

const J = await import("../lib/jogo.ts");
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

/** Carimbo ISO ao meio-dia local do dia pedido (para cair nesse dia em qualquer fuso). */
const carimbo = (data) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d, 12).toISOString();
};
const vazio = { tarefas: [], categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] }, pessoas: { rev: 0, items: [] }, times: { rev: 0, items: [] }, notas: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, avisos: [] };
const dados = (tarefas, extra = {}) => ({ ...vazio, ...extra, tarefas: tarefas.map((t) => T.normalizarTarefa(t)) });
const HOJE = "2026-11-13"; // sexta

teste("níveis: cada um pede mais XP que o anterior e o nome acompanha", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(J.xpDoNivel), [0, 120, 360, 720, 1200]);
  assert.equal(J.nivelDoXp(0).n, 1);
  assert.equal(J.nivelDoXp(119).n, 1);
  assert.equal(J.nivelDoXp(120).n, 2);
  const n = J.nivelDoXp(240);
  assert.deepEqual([n.n, n.xpInicio, n.xpProximo, n.parte, n.falta], [2, 120, 360, 0.5, 120]);
  assert.equal(J.nivelDoXp(0).nome, "Começando");
  assert.ok(J.nivelDoXp(10_000_000).nome.startsWith("Lenda"));
});

teste("sem dados: nível 1, nada alcançado, nada quebra", () => {
  const e = J.calcularJogo(vazio, HOJE);
  assert.equal(e.xp, 0);
  assert.equal(e.nivel.n, 1);
  assert.deepEqual(e.hoje, { avancos: 0, xp: 0, meta: J.META_PADRAO, bateu: false });
  assert.ok(e.conquistas.length >= 20 && e.conquistas.every((c) => !c.feita && c.atual === 0 && c.em === null));
  assert.equal(new Set(e.conquistas.map((c) => c.id)).size, e.conquistas.length, "ids de conquista repetidos");
  assert.equal(e.ultimosDias.length, 14);
  assert.equal(e.ultimosDias.at(-1).data, HOJE);
  // coleções que podem faltar em dados antigos
  assert.doesNotThrow(() => J.calcularJogo({ tarefas: [], categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] }, avisos: [] }, HOJE));
});

teste("XP: passo, registro, reunião, conclusão e sessão de foco", () => {
  const e = J.calcularJogo(dados([{
    id: "t1", titulo: "A", status: "concluida",
    registros: [
      { id: "r0", tipo: "marco", data: "2026-11-10", titulo: "Tarefa criada" },                               // 0
      { id: "r1", tipo: "reuniao", data: "2026-11-10", titulo: "Kickoff",                                     // 20
        proximosPassos: [{ id: "p1", texto: "a", feito: true, feitoEm: carimbo("2026-11-11") },               // 10
                         { id: "p2", texto: "b", feito: false }] },                                           // 0
      { id: "r2", tipo: "atividade", data: "2026-11-12", titulo: "Sessão de foco (25 min)", duracaoMin: 25 }, // 15 + 25
      { id: "r3", tipo: "atividade", data: "2026-11-12", titulo: "Sessão longa", duracaoMin: 200 },           // 15 + 60 (teto)
      { id: "r4", tipo: "marco", data: "2026-11-13", titulo: "Concluída", alteracoes: { status: { de: "em_andamento", para: "concluida" } } }, // 50
    ],
  }]), HOJE);
  assert.equal(e.xp, 20 + 10 + 40 + 75 + 50);
  assert.deepEqual(e.totais, { passos: 1, registros: 3, reunioes: 1, concluidas: 1, sessoes: 2, minutosDeFoco: 225, cobrancas: 0 });
  assert.equal(e.hoje.avancos, 1);
  assert.equal(e.hoje.xp, 50);
});

teste("o que tem data no futuro ainda não conta", () => {
  const e = J.calcularJogo(dados([{ id: "t1", titulo: "A", registros: [{ id: "r1", tipo: "reuniao", data: "2026-12-01", titulo: "Reunião marcada" }] }]), HOJE);
  assert.equal(e.xp, 0);
});

teste("meta do dia: conta os avanços de hoje e respeita o limite", () => {
  const passos = (n, dia) => Array.from({ length: n }, (_, i) => ({ id: `p${dia}${i}`, texto: `p${i}`, feito: true, feitoEm: carimbo(dia) }));
  const d = dados([{ id: "t1", titulo: "A", registros: [{ id: "r1", tipo: "nota", data: "2026-11-01", proximosPassos: [...passos(2, HOJE), ...passos(7, "2026-11-12")] }] }]);
  assert.deepEqual(J.calcularJogo(d, HOJE, 3).hoje, { avancos: 2, xp: 20, meta: 3, bateu: false });
  assert.equal(J.calcularJogo(d, HOJE, 2).hoje.bateu, true);
  assert.equal(J.calcularJogo(d, HOJE, 0).hoje.meta, J.META_PADRAO);
  assert.equal(J.calcularJogo(d, HOJE, 999).hoje.meta, J.META_MAXIMA);
  assert.equal(J.calcularJogo(d, HOJE, "abc").hoje.meta, J.META_PADRAO);
  const e = J.calcularJogo(d, HOJE);
  assert.deepEqual(e.recorde, { data: "2026-11-12", avancos: 7 });
  const dia5 = e.conquistas.find((c) => c.id === "dia-5");
  assert.ok(dia5.feita && dia5.em === "2026-11-12");
  assert.ok(!e.conquistas.find((c) => c.id === "dia-12").feita);
});

teste("conquista por contador guarda o dia em que foi alcançada", () => {
  const passo = (i, dia) => ({ id: `p${i}`, texto: `p${i}`, feito: true, feitoEm: carimbo(dia) });
  const lista = [];
  for (let i = 0; i < 24; i++) lista.push(passo(i, "2026-11-05"));
  lista.push(passo(24, "2026-11-09"), passo(25, "2026-11-10"));
  const e = J.calcularJogo(dados([{ id: "t1", titulo: "A", registros: [{ id: "r1", tipo: "nota", data: "2026-10-01", proximosPassos: lista }] }]), HOJE);
  const c1 = e.conquistas.find((c) => c.id === "passo-1");
  const c25 = e.conquistas.find((c) => c.id === "passo-25");
  const c100 = e.conquistas.find((c) => c.id === "passo-100");
  assert.deepEqual([c1.feita, c1.em], [true, "2026-11-05"]);
  assert.deepEqual([c25.feita, c25.em, c25.atual], [true, "2026-11-09", 25]); // o 25º passo foi no dia 09
  assert.deepEqual([c100.feita, c100.atual, c100.alvo, c100.em], [false, 26, 100, null]);
});

teste("sequência, cobranças, referência e organização viram conquistas", () => {
  const reg = (i, data, extra = {}) => ({ id: `r${i}`, tipo: "atividade", data, titulo: `Atividade ${i}`, ...extra });
  const d = dados(
    [{ id: "t1", titulo: "A", registros: [
      reg(1, "2026-11-09"), reg(2, "2026-11-10"), reg(3, "2026-11-11"), reg(4, "2026-11-12"), reg(5, "2026-11-13"), // seg a sex
      ...Array.from({ length: 5 }, (_, i) => reg(10 + i, "2026-11-03", { titulo: "Cobrei Marina" })),
      ...Array.from({ length: 3 }, (_, i) => reg(20 + i, "2026-11-04", { referencia: true })),
    ] }],
    {
      modelos: { rev: 1, items: [{ id: "mo1", nome: "M" }] },
      pessoas: { rev: 1, items: Array.from({ length: 11 }, (_, i) => ({ id: `pe${i}`, nome: `Pessoa ${i}`, arquivada: i === 0 })) },
      notas: { rev: 1, items: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, titulo: "", texto: "x", arquivadaEm: i < 5 ? "2026-11-01T12:00:00Z" : null, gerou: i < 5 ? [{ tipo: "registro", tarefaId: "t1", rotulo: "x" }] : [] })) },
    },
  );
  const e = J.calcularJogo(d, HOJE);
  const feita = (id) => e.conquistas.find((c) => c.id === id).feita;
  assert.ok(e.sequencia.atual >= 5);
  assert.ok(feita("sequencia-3") && feita("sequencia-5") && !feita("sequencia-20"));
  assert.ok(feita("cobranca-5"));
  assert.ok(feita("referencia-3"));
  assert.ok(feita("modelo-1") && feita("folha-5") && feita("pessoa-10")); // 10 pessoas ativas (a arquivada não conta)
  assert.equal(e.totais.cobrancas, 5);
});

teste("gráfico: 14 dias terminando hoje, com o XP de cada um", () => {
  const e = J.calcularJogo(dados([{ id: "t1", titulo: "A", registros: [{ id: "r1", tipo: "reuniao", data: "2026-11-12", titulo: "x" }, { id: "r2", tipo: "nota", data: "2026-10-01", titulo: "antiga" }] }]), HOJE);
  assert.equal(e.ultimosDias[0].data, "2026-10-31");
  assert.deepEqual(e.ultimosDias.at(-2), { data: "2026-11-12", xp: 20, avancos: 1 });
  assert.equal(e.ultimosDias.reduce((n, d) => n + d.xp, 0), 20); // o registro de outubro está fora da janela
  assert.equal(e.xp, 35);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
