// Testes do que ensina a usar o app (3.22): a ajuda de cada tela (lib/ajuda.ts) e os primeiros passos
// (lib/primeiros-passos.ts).
// Uso: node testes/ajuda.test.mjs   (Node 22.18+ importa .ts direto)

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

const A = await import("../lib/ajuda.ts");
const PP = await import("../lib/primeiros-passos.ts");
const PF = await import("../lib/perfis.ts");
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

// ---------- ajuda de cada tela ----------

teste("toda tela do menu tem ajuda, mais a página da tarefa, o modo reunião, a busca e as configurações", () => {
  const rotas = A.AJUDA.map((a) => a.rota);
  assert.equal(new Set(rotas).size, rotas.length, "rota repetida");
  for (const r of [...PF.INICIOS, "/tarefas/[id]", "/tarefas/[id]/reuniao", "/busca", "/configuracoes"]) assert.ok(rotas.includes(r), `falta a ajuda de ${r}`);
});

teste("cada ajuda diz para que serve e como usar em dois a cinco passos, sem travessão", () => {
  for (const a of A.AJUDA) {
    assert.ok(a.titulo && a.paraQue.length > 30, a.rota);
    assert.ok(a.como.length >= 2 && a.como.length <= 5, `${a.rota}: ${a.como.length} passos`);
    const texto = JSON.stringify(a);
    assert.equal(texto.includes("—"), false, a.rota);
    for (const m of a.mostrar) {
      assert.ok(m.rotulo && m.alvo.titulo && m.alvo.texto && m.alvo.seletor.startsWith("["), `${a.rota}: ${m.rotulo}`);
      assert.ok(m.alvo.rota === null || m.alvo.rota === a.rota, `${a.rota}: "${m.rotulo}" aponta para outra tela (${m.alvo.rota})`);
    }
    for (const at of a.atalhos) assert.ok(at.teclas.length > 0 && at.descricao, a.rota);
  }
});

teste("ajudaDaRota: a tela certa para cada endereço", () => {
  const de = (p) => A.ajudaDaRota(p).rota;
  assert.equal(de("/"), "/");
  assert.equal(de(""), "/");
  assert.equal(de("/tarefas"), "/tarefas");
  assert.equal(de("/tarefas/"), "/tarefas");
  assert.equal(de("/tarefas/t123"), "/tarefas/[id]");
  assert.equal(de("/tarefas/t123/reuniao"), "/tarefas/[id]/reuniao");
  assert.equal(de("/categorias/c9"), "/categorias");
  assert.equal(de("/pendencias"), "/pendencias");
  assert.equal(de("/tela-que-nao-existe"), "/");
});

teste("alvoEstaAqui: alvo sem rota vale em qualquer tela; com rota, só na tela dele", () => {
  const daTarefa = A.AJUDA.find((a) => a.rota === "/tarefas/[id]").mostrar[0].alvo;
  assert.equal(A.alvoEstaAqui(daTarefa, "/tarefas/t1"), true);
  assert.equal(A.alvoEstaAqui(daTarefa, "/tarefas"), false);
  assert.equal(A.alvoEstaAqui({ ...daTarefa, rota: null }, "/radar"), true);
});

teste("glossário: termos sem repetir, explicados em uma frase", () => {
  const termos = A.GLOSSARIO.map((g) => g.termo);
  assert.equal(new Set(termos).size, termos.length);
  for (const g of A.GLOSSARIO) assert.ok(g.explicacao.length > 20 && !g.explicacao.includes("—"), g.termo);
  for (const t of ["Passo", "Checklist", "Pendências", "Foco de hoje", "Lembrete de voltar"]) assert.ok(termos.includes(t), t);
});

// ---------- primeiros passos ----------

const passo = (id, extra = {}) => ({ id, texto: `passo ${id}`, feito: false, ...extra });
const tarefa = (id, extra = {}) => T.normalizarTarefa({ id, titulo: `Tarefa ${id}`, status: "a_fazer", atualizadaEm: "2026-11-20T10:00:00.000Z", ...extra });
const feitos = (lista) => lista.filter((p) => p.feito).map((p) => p.id);

teste("primeiros passos: em pasta vazia nada está feito, e tudo o que depende de tarefa aponta para Nova tarefa", () => {
  const lista = PP.primeirosPassos({ tarefas: [], categorias: [] }, { planejou: false });
  assert.deepEqual(lista.map((p) => p.id), ["tarefa", "registro", "passo", "foco", "planejar", "categoria"]);
  assert.deepEqual(feitos(lista), []);
  for (const id of ["tarefa", "registro", "passo"]) assert.match(lista.find((p) => p.id === id).onde.seletor, /nova-tarefa/, id);
  assert.deepEqual(PP.resumoDosPrimeirosPassos(lista), { feitos: 0, total: 6, completo: false, proximo: lista[0] });
});

teste("primeiros passos: cada item é calculado dos dados, sem nada para marcar", () => {
  const cat = [T.normalizarCategoria({ id: "c1", nome: "Assunto" })];
  // só a tarefa, com o marco de criação: registrar ainda não foi feito (marco não conta)
  const soTarefa = [tarefa("t1", { registros: [{ id: "m", tipo: "marco", titulo: "Tarefa criada" }] })];
  assert.deepEqual(feitos(PP.primeirosPassos({ tarefas: soTarefa, categorias: [] }, { planejou: false })), ["tarefa"]);
  // com um registro e um passo em aberto: o alvo de concluir é a tela de Pendências
  const comRegistro = [tarefa("t1", { registros: [{ id: "r", tipo: "reuniao", titulo: "Conversa", proximosPassos: [passo("a")] }] })];
  const l2 = PP.primeirosPassos({ tarefas: comRegistro, categorias: [] }, { planejou: false });
  assert.deepEqual(feitos(l2), ["tarefa", "registro"]);
  assert.equal(l2.find((p) => p.id === "passo").onde.rota, "/pendencias");
  assert.equal(l2.find((p) => p.id === "registro").onde.rota, "/tarefas/t1");
  // tudo feito
  const tudo = [tarefa("t1", { focoEm: "2026-11-01", registros: [{ id: "r", tipo: "reuniao", titulo: "Conversa", proximosPassos: [passo("a", { feito: true })] }] })];
  const l3 = PP.primeirosPassos({ tarefas: tudo, categorias: cat }, { planejou: true });
  assert.deepEqual(feitos(l3), ["tarefa", "registro", "passo", "foco", "planejar", "categoria"]);
  assert.equal(PP.resumoDosPrimeirosPassos(l3).completo, true);
  assert.equal(PP.resumoDosPrimeirosPassos(l3).proximo, null);
});

teste("primeiros passos: o registro é mostrado na tarefa aberta mexida por último; sem passo em aberto, o caminho é registrar", () => {
  const tarefas = [
    tarefa("antiga", { atualizadaEm: "2026-11-01T10:00:00.000Z" }),
    tarefa("recente", { atualizadaEm: "2026-11-22T10:00:00.000Z" }),
    tarefa("fechada", { status: "concluida", atualizadaEm: "2026-11-23T10:00:00.000Z" }),
  ];
  const lista = PP.primeirosPassos({ tarefas, categorias: [] }, { planejou: false });
  assert.equal(lista.find((p) => p.id === "registro").onde.rota, "/tarefas/recente");
  const doPasso = lista.find((p) => p.id === "passo").onde;
  assert.equal(doPasso.rota, "/tarefas/recente");
  assert.match(doPasso.texto, /Próximos passos/);
});

teste("primeiros passos: os alvos apontam para telas que têm ajuda, e os textos não têm travessão", () => {
  const lista = PP.primeirosPassos({ tarefas: [tarefa("t1", { registros: [{ id: "r", tipo: "nota", proximosPassos: [passo("a")] }] })], categorias: [] }, { planejou: false });
  for (const p of lista) {
    assert.ok(p.titulo && p.porque && p.onde.titulo && p.onde.texto, p.id);
    assert.equal(JSON.stringify(p).includes("—"), false, p.id);
    if (p.onde.rota) assert.notEqual(A.ajudaDaRota(p.onde.rota).rota, "/" === p.onde.rota ? "" : undefined);
  }
});

teste("estado dos primeiros passos: lista fechada", () => {
  for (const [entrada, saida] of [["ativo", "ativo"], ["dispensado", "dispensado"], ["", ""], [null, ""], ["outro", ""], [1, ""]]) assert.equal(PP.normalizarEstadoDosPrimeirosPassos(entrada), saida);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
