// Testes do checklist próprio da tarefa (3.17): lib/checklist.ts, a leitura do campo (lib/tipos.ts), o espelho em
// Markdown e o que acontece com o checklist ao juntar duas tarefas.
// Uso: node testes/checklist.test.mjs   (Node 22.18+ importa .ts direto)

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

const C = await import("../lib/checklist.ts");
const T = await import("../lib/tipos.ts");
const A = await import("../lib/acoes.ts");
const M = await import("../lib/markdown.ts");

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

const tarefa = (checklist) => T.normalizarTarefa({ id: "t1", titulo: "Levar a Ferramenta X ao squad", checklist });
const textos = (t) => C.checklistDe(t).map((i) => `${i.feito ? "x" : " "} ${i.texto}`);

// ---------- leitura do arquivo ----------

teste("tarefa antiga, sem o campo, abre com o checklist vazio", () => {
  assert.deepEqual(T.normalizarTarefa({ id: "t0", titulo: "Antiga" }).checklist, []);
  assert.deepEqual(T.normalizarChecklist("texto"), []);
  assert.deepEqual(T.normalizarChecklist({ length: 2 }), []);
});

teste("leitura: item sem texto cai fora, id ruim ou repetido ganha outro, campo desconhecido fica", () => {
  const lido = T.normalizarChecklist([
    { id: "ck1", texto: "  Pedir   os acessos ", feito: true, feitoEm: "2026-11-20T10:00:00.000Z", campoFuturo: "x" },
    { id: "ck1", texto: "Repetido" },
    { id: "../x", texto: "Id ruim" },
    { id: "ck4", texto: "   " },
    { texto: "Sem id", feito: "sim", feitoEm: "2026-11-20T10:00:00.000Z" },
    "solto", null, 7,
  ]);
  assert.deepEqual(lido.map((i) => i.texto), ["Pedir os acessos", "Repetido", "Id ruim", "Sem id"]);
  assert.equal(new Set(lido.map((i) => i.id)).size, 4, "os ids têm que ser únicos");
  assert.ok(lido.every((i) => T.ID_VALIDO.test(i.id)));
  assert.equal(lido[0].campoFuturo, "x");
  assert.equal(lido[0].feitoEm, "2026-11-20T10:00:00.000Z");
  assert.deepEqual([lido[3].feito, lido[3].feitoEm], [false, null], "só o booleano true marca como feito, e sem feito não há data");
});

teste("leitura: tem teto de itens e de tamanho do texto", () => {
  const muitos = Array.from({ length: T.MAX_ITENS_NO_CHECKLIST + 50 }, (_, i) => ({ id: `ck${i}`, texto: `item ${i}` }));
  assert.equal(T.normalizarChecklist(muitos).length, T.MAX_ITENS_NO_CHECKLIST);
  assert.equal(T.normalizarChecklist([{ texto: "a".repeat(5000) }])[0].texto.length, T.MAX_TEXTO_DO_ITEM);
});

// ---------- colar uma lista ----------

teste("texto colado: uma linha vira um item e a marca de lista sai", () => {
  const itens = C.itensDoTexto("- Pedir acesso\n* Abrir o chamado\n1. Rodar o scan\n2) Revisar\n[ ] Avisar o squad\n- [x] Agendar a abertura\n\n   \n• Fechar");
  assert.deepEqual(itens.map((i) => i.texto), ["Pedir acesso", "Abrir o chamado", "Rodar o scan", "Revisar", "Avisar o squad", "Agendar a abertura", "Fechar"]);
  assert.deepEqual(itens.filter((i) => i.feito).map((i) => i.texto), ["Agendar a abertura"]);
});

teste("texto colado: número que não é marca de lista fica no texto", () => {
  assert.deepEqual(C.itensDoTexto("1.5 GB de memória\n2026 em revisão\n[link] do runbook").map((i) => i.texto), ["1.5 GB de memória", "2026 em revisão", "[link] do runbook"]);
  assert.deepEqual(C.itensDoTexto(null), []);
});

// ---------- mudanças ----------

teste("adicionar: um item, vários de uma vez, e texto vazio não muda a tarefa", () => {
  let t = tarefa();
  assert.equal(C.comItensNoChecklist(t, "   "), t, "texto vazio devolve a mesma tarefa");
  t = C.comItensNoChecklist(t, "Pedir os acessos");
  t = C.comItensNoChecklist(t, "Abrir o chamado\n- [x] Agendar a abertura");
  assert.deepEqual(textos(t), ["  Pedir os acessos", "  Abrir o chamado", "x Agendar a abertura"]);
  assert.ok(C.checklistDe(t)[2].feitoEm, "item que entra feito ganha a data");
  assert.deepEqual(C.progressoDoChecklist(t), { feitos: 1, total: 3 });
});

teste("adicionar respeita o teto e diz quantas vagas há", () => {
  const cheia = tarefa(Array.from({ length: T.MAX_ITENS_NO_CHECKLIST - 1 }, (_, i) => ({ id: `ck${i}`, texto: `item ${i}` })));
  assert.equal(C.vagasNoChecklist(cheia), 1);
  const depois = C.comItensNoChecklist(cheia, "um\ndois\ntrês");
  assert.equal(C.checklistDe(depois).length, T.MAX_ITENS_NO_CHECKLIST);
  assert.equal(C.checklistDe(depois).at(-1).texto, "um");
  assert.equal(C.comItensNoChecklist(depois, "mais um"), depois, "sem vaga, nada muda");
});

teste("marcar, reabrir, editar, mover e tirar", () => {
  let t = tarefa([{ id: "a", texto: "Um" }, { id: "b", texto: "Dois" }, { id: "c", texto: "Três" }]);
  t = C.comItemAlternado(t, "b", true);
  assert.ok(C.checklistDe(t)[1].feito && C.checklistDe(t)[1].feitoEm);
  t = C.comItemAlternado(t, "b", false);
  assert.deepEqual([C.checklistDe(t)[1].feito, C.checklistDe(t)[1].feitoEm], [false, null]);
  t = C.comItemEditado(t, "a", "  Um   de verdade ");
  assert.equal(C.checklistDe(t)[0].texto, "Um de verdade");
  t = C.comItemMovido(t, "c", -1);
  assert.deepEqual(C.checklistDe(t).map((i) => i.id), ["a", "c", "b"]);
  t = C.comItemMovido(t, "a", 1);
  assert.deepEqual(C.checklistDe(t).map((i) => i.id), ["c", "a", "b"]);
  t = C.semItemDoChecklist(t, "a");
  assert.deepEqual(C.checklistDe(t).map((i) => i.id), ["c", "b"]);
});

teste("o que não muda nada devolve a mesma tarefa (para a tela não gravar à toa)", () => {
  const t = tarefa([{ id: "a", texto: "Um", feito: true, feitoEm: "2026-11-20T10:00:00.000Z" }, { id: "b", texto: "Dois" }]);
  assert.equal(C.comItemAlternado(t, "a", true), t);
  assert.equal(C.comItemAlternado(t, "nao-existe", true), t);
  assert.equal(C.comItemEditado(t, "a", "Um"), t);
  assert.equal(C.comItemEditado(t, "a", "   "), t, "texto vazio não apaga o item");
  assert.equal(C.comItemMovido(t, "a", -1), t);
  assert.equal(C.comItemMovido(t, "b", 1), t);
  assert.equal(C.semItemDoChecklist(t, "nao-existe"), t);
});

teste("as mudanças não tocam no resto da tarefa", () => {
  const t = T.normalizarTarefa({ id: "t1", titulo: "X", tags: ["a"], registros: [{ id: "r1", tipo: "nota", titulo: "N", proximosPassos: [{ id: "p1", texto: "passo" }] }], campoFuturo: "x" });
  const depois = C.comItemAlternado(C.comItensNoChecklist(t, "Item"), C.checklistDe(C.comItensNoChecklist(t, "Item"))[0]?.id ?? "", true);
  assert.deepEqual(depois.registros, t.registros);
  assert.equal(depois.campoFuturo, "x");
  assert.equal(T.passosAbertos(depois).length, 1, "item do checklist não é passo: Pendências não muda");
});

// ---------- para fora ----------

teste("o checklist em texto: busca, prompt e Markdown", () => {
  const t = tarefa([{ id: "a", texto: "Pedir os acessos", feito: true, feitoEm: "2026-11-20T10:00:00.000Z" }, { id: "b", texto: "Rodar o scan" }]);
  assert.equal(C.textoDoChecklist(t), "Pedir os acessos · Rodar o scan");
  assert.equal(C.checklistEmLinha(t), "[feito] Pedir os acessos; [aberto] Rodar o scan");
  assert.deepEqual(C.checklistEmMarkdown(t), ["- [x] Pedir os acessos", "- [ ] Rodar o scan"]);
});

teste("o espelho em Markdown ganha a seção Checklist (e não ganha quando não há itens)", () => {
  const com = M.tarefaParaMarkdown(tarefa([{ id: "a", texto: "Pedir os acessos", feito: true }, { id: "b", texto: "Rodar o scan" }]));
  assert.match(com, /## Checklist\n\n- \[x\] Pedir os acessos\n- \[ \] Rodar o scan\n/);
  assert.ok(com.indexOf("## Checklist") < com.indexOf("## Linha do tempo"));
  assert.doesNotMatch(M.tarefaParaMarkdown(tarefa()), /Checklist/);
});

teste("juntar duas tarefas traz o checklist da outra, sem duplicar se rodar de novo", () => {
  const destino = tarefa([{ id: "a", texto: "Do destino" }]);
  const origem = T.normalizarTarefa({ id: "t2", titulo: "Outra", checklist: [{ id: "z", texto: "Da origem", feito: true, feitoEm: "2026-11-20T10:00:00.000Z" }] });
  const junta = A.comTarefaJuntada(destino, origem);
  assert.deepEqual(textos(junta), ["  Do destino", "x Da origem"]);
  assert.deepEqual(textos(A.comTarefaJuntada(junta, origem)), ["  Do destino", "x Da origem"]);
});

// ---------- checklist nos modelos de tarefa (3.18) ----------

const Mo = await import("../lib/modelos.ts");

teste("modelo antigo, sem o campo, abre com o checklist vazio; o que vem do arquivo é conferido", () => {
  assert.deepEqual(T.normalizarModelo({ id: "mo1", nome: "Antigo" }).checklist, []);
  const m = T.normalizarModelo({ id: "mo2", nome: "Torto", checklist: ["  Scan   rodando ", "", 7, null, "a".repeat(5000), { x: 1 }] });
  assert.deepEqual([m.checklist.length, m.checklist[0], m.checklist[1].length], [2, "Scan rodando", T.MAX_TEXTO_DO_ITEM]);
  assert.deepEqual(T.normalizarModelo({ nome: "x", checklist: "não é lista" }).checklist, []);
  assert.equal(T.normalizarModelo({ nome: "x", checklist: Array.from({ length: 500 }, (_, i) => `item ${i}`) }).checklist.length, T.MAX_ITENS_NO_CHECKLIST);
});

teste("salvar uma tarefa como modelo leva o checklist dela, sem o que já foi feito", () => {
  const m = Mo.modeloDaTarefa(tarefa([{ id: "a", texto: "Scan rodando na pipeline", feito: true, feitoEm: "2026-11-20T10:00:00.000Z" }, { id: "b", texto: "Squad treinado" }]));
  assert.deepEqual(m.checklist, ["Scan rodando na pipeline", "Squad treinado"]);
  assert.deepEqual(Mo.modeloDaTarefa(tarefa()).checklist, []);
});

teste("o campo do formulário do modelo: um item por linha, sem marca de lista, sem vazio e sem repetir", () => {
  assert.deepEqual(Mo.checklistDoTexto("- Scan rodando\n\n1. Gate configurado\n  scan RODANDO  \n[x] Squad treinado"), ["Scan rodando", "Gate configurado", "Squad treinado"]);
  assert.deepEqual(Mo.checklistDoTexto(""), []);
});

teste("a tarefa criada pelo modelo nasce com os itens escolhidos, todos em aberto e com id próprio", () => {
  const itens = Mo.checklistDoModelo(["Scan rodando", "Squad treinado"]);
  assert.deepEqual(itens.map((i) => [i.texto, i.feito, i.feitoEm]), [["Scan rodando", false, null], ["Squad treinado", false, null]]);
  assert.equal(new Set(itens.map((i) => i.id)).size, 2);
  // é o que o formulário grava: passa pela leitura do campo sem mudar nada
  const t = T.normalizarTarefa({ id: "t9", titulo: "Do modelo", checklist: itens });
  assert.deepEqual(t.checklist, itens);
  assert.deepEqual(Mo.checklistDoModelo([]), []);
  // duas tarefas do mesmo modelo não dividem ids
  assert.notEqual(Mo.checklistDoModelo(["Scan rodando"])[0].id, Mo.checklistDoModelo(["Scan rodando"])[0].id);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
