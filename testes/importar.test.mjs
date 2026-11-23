// Testes de "importar um arquivo exportado" (3.17): lib/importar-dados.ts. O arquivo como entrada não confiável,
// o que entra, o que é igual, o que conflita, os três modos de resolver conflito e a regra de que importar
// nunca tira nada do que está aqui.
// Uso: node testes/importar.test.mjs   (Node 22.18+ importa .ts direto)

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

const I = await import("../lib/importar-dados.ts");
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

const D1 = "2026-11-10T10:00:00.000Z";
const D2 = "2026-11-20T10:00:00.000Z";
const tarefa = (id, titulo, atualizadaEm = D1, extra = {}) => T.normalizarTarefa({ id, titulo, criadaEm: D1, atualizadaEm, ...extra });
const cat = (id, nome, atualizadaEm = D1) => T.normalizarCategoria({ id, nome, criadaEm: D1, atualizadaEm });

/** Um export como o /api/exportar escreve. */
const exportar = (partes = {}) =>
  JSON.stringify({
    exportadoEm: "2026-11-23T12:00:00.000Z", schema: 1, tarefas: [], avisos: [],
    ...Object.fromEntries(I.COLECOES_IMPORTAVEIS.map((c) => [c, { rev: 3, items: [] }])),
    ...partes,
  });
const aquiVazio = () => Object.fromEntries(I.GRUPOS_IMPORTAVEIS.map((g) => [g, []]));
const doGrupo = (previa, grupo) => previa.find((p) => p.grupo === grupo);

// ---------- o arquivo ----------

teste("arquivo que não é um export do Nexo é recusado com mensagem clara", () => {
  assert.throws(() => I.lerExportacao(""), /vazio/);
  assert.throws(() => I.lerExportacao("{ quebrado"), /JSON válido/);
  assert.throws(() => I.lerExportacao("[1,2,3]"), /não parece um export/);
  assert.throws(() => I.lerExportacao('{"qualquer":"coisa"}'), /não parece um export/);
  assert.throws(() => I.lerExportacao('"texto"'), /não parece um export/);
  assert.doesNotThrow(() => I.lerExportacao('{"tarefas":[]}'));
  assert.doesNotThrow(() => I.lerExportacao('﻿{"categorias":{"rev":1,"items":[]}}'), "com BOM no começo também abre");
});

teste("lê as tarefas e as coleções, com a versão do formato e a data do export", () => {
  const a = I.lerExportacao(exportar({ tarefas: [tarefa("t1", "Uma")], categorias: { rev: 2, items: [cat("c1", "Pipeline")] } }));
  assert.deepEqual([a.schema, a.exportadoEm, a.ignorados], [1, "2026-11-23T12:00:00.000Z", 0]);
  assert.deepEqual(a.grupos.tarefas.map((t) => t.titulo), ["Uma"]);
  assert.deepEqual(a.grupos.categorias.map((c) => c.nome), ["Pipeline"]);
  assert.equal(I.lerExportacao('{"tarefas":[]}').schema, null);
});

teste("item sem id que sirva fica de fora e é contado; o resto do arquivo vale", () => {
  const a = I.lerExportacao(exportar({
    tarefas: [tarefa("t1", "Boa"), { id: "../x", titulo: "Sai da pasta" }, { titulo: "Sem id" }, tarefa("t1", "Repetida"), "texto", null, { id: "con", titulo: "ok" }],
    pessoas: { rev: 1, items: [{ id: "pe1", nome: "Ana" }, { id: "a b", nome: "Espaço no id" }] },
    jornada: { rev: 1, items: [{ id: "2026-11-23", tipo: "dia" }, { id: "config", tipo: "config" }, { id: "2026-02-30", tipo: "dia" }, { id: "qualquer", tipo: "dia" }] },
  }));
  assert.deepEqual(a.grupos.tarefas.map((t) => t.id), ["t1", "con"]);
  assert.equal(a.grupos.tarefas[0].titulo, "Boa", "no id repetido, vale o primeiro");
  assert.deepEqual(a.grupos.pessoas.map((p) => p.id), ["pe1"]);
  assert.deepEqual(a.grupos.jornada.map((d) => d.id), ["2026-11-23", "config"], "dia da rotina só com data de verdade");
  assert.equal(a.ignorados, 5 + 1 + 2);
});

teste("o que entra passa pelo normalizador e o campo que o app não conhece é preservado", () => {
  const a = I.lerExportacao(exportar({ tarefas: [{ id: "t1", titulo: "Crua", prioridade: 99, status: "<script>", campoFuturo: { x: 1 }, checklist: [{ texto: "item" }] }] }));
  const t = a.grupos.tarefas[0];
  assert.deepEqual([t.prioridade, t.status, t.campoFuturo, t.checklist.length], [10, "a_fazer", { x: 1 }, 1]);
});

// ---------- a prévia ----------

teste("prévia: o que não está aqui entra, o que é igual não conta e o diferente é conflito", () => {
  const arquivo = I.lerExportacao(exportar({
    tarefas: [tarefa("t1", "Igual"), tarefa("t2", "Mudou no arquivo", D2), tarefa("t3", "Nova"), tarefa("t4", "Mais velha no arquivo", D1)],
    categorias: { rev: 1, items: [cat("c1", "Pipeline"), cat("c2", "Nova categoria")] },
  }));
  const aqui = { ...aquiVazio(), tarefas: [tarefa("t1", "Igual"), tarefa("t2", "Como está aqui", D1), tarefa("t4", "Mexida aqui depois", D2), tarefa("t9", "Só existe aqui")], categorias: [cat("c1", "Pipeline")] };
  const previa = I.previaDaImportacao(arquivo, aqui);
  const t = doGrupo(previa, "tarefas");
  assert.deepEqual(t.entram.map((x) => x.titulo), ["Nova"]);
  assert.equal(t.iguais, 1);
  assert.deepEqual(t.conflitos.map((c) => `${c.id}:${c.maisNovo}`), ["t2:arquivo", "t4:aqui"]);
  assert.deepEqual(doGrupo(previa, "categorias").entram.map((x) => x.titulo), ["Nova categoria"]);
  assert.deepEqual(I.totaisDaPrevia(previa, "manter"), { entram: 2, trocam: 0, mantidos: 2, iguais: 2 });
  assert.deepEqual(I.totaisDaPrevia(previa, "recente"), { entram: 2, trocam: 1, mantidos: 1, iguais: 2 });
  assert.deepEqual(I.totaisDaPrevia(previa, "arquivo"), { entram: 2, trocam: 2, mantidos: 0, iguais: 2 });
});

teste("prévia: revisão, carimbo de gravação, ordem das chaves e campo com valor padrão não fazem conflito", () => {
  const noArquivo = tarefa("t1", "Mesma", D2, { rev: 9 });
  // aqui: gravada por uma versão antiga (sem o campo checklist), com outra revisão e as chaves em outra ordem
  const { checklist: _fora, ...antiga } = tarefa("t1", "Mesma", D1, { rev: 2 });
  const aqui = { ...aquiVazio(), tarefas: [Object.fromEntries(Object.entries(antiga).reverse())] };
  const t = doGrupo(I.previaDaImportacao(I.lerExportacao(exportar({ tarefas: [noArquivo] })), aqui), "tarefas");
  assert.deepEqual([t.entram.length, t.conflitos.length, t.iguais], [0, 0, 1]);
});

teste("prévia: item gravado à mão, sem data de criação, não vira conflito com o próprio export", () => {
  // no disco: só id e nome. O export (feito mais cedo) já saiu com as datas que o normalizador inventou naquela hora.
  const exportado = T.normalizarCategoria({ id: "c1", nome: "Escrita à mão", criadaEm: "2026-11-01T08:00:00.000Z", atualizadaEm: "2026-11-01T08:00:00.000Z" });
  const previa = I.previaDaImportacao(I.lerExportacao(exportar({ categorias: { rev: 1, items: [exportado] } })), { ...aquiVazio(), categorias: [{ id: "c1", nome: "Escrita à mão" }] });
  assert.deepEqual([doGrupo(previa, "categorias").iguais, doGrupo(previa, "categorias").conflitos.length], [1, 0]);
  // mas se o nome mudou, continua sendo conflito
  const outra = I.previaDaImportacao(I.lerExportacao(exportar({ categorias: { rev: 1, items: [exportado] } })), { ...aquiVazio(), categorias: [{ id: "c1", nome: "Outro nome" }] });
  assert.equal(doGrupo(outra, "categorias").conflitos.length, 1);
});

teste("arquivo montado à mão, sem datas: importar duas vezes não inventa diferença nem ganha no modo recente", () => {
  const texto = JSON.stringify({ exportadoEm: "2026-11-23T12:00:00.000Z", tarefas: [{ id: "t1", titulo: "Sem datas" }], categorias: { rev: 1, items: [{ id: "c1", nome: "Sem datas" }] } });
  const primeira = I.lerExportacao(texto);
  assert.deepEqual([primeira.grupos.tarefas[0].criadaEm, primeira.grupos.categorias[0].atualizadaEm], ["2026-11-23T12:00:00.000Z", "2026-11-23T12:00:00.000Z"], "a data que falta é a do export");
  // o que foi gravado na primeira importação é o que está aqui na segunda
  const aqui = { ...aquiVazio(), tarefas: primeira.grupos.tarefas, categorias: primeira.grupos.categorias };
  assert.deepEqual(I.totaisDaPrevia(I.previaDaImportacao(I.lerExportacao(texto), aqui), "arquivo"), { entram: 0, trocam: 0, mantidos: 0, iguais: 2 });
  // sem a data do export, vale uma data antiga: o item nunca passa na frente do que está aqui
  const semNada = I.lerExportacao(JSON.stringify({ tarefas: [{ id: "t1", titulo: "Do arquivo" }] }));
  assert.equal(semNada.grupos.tarefas[0].atualizadaEm, "2000-01-01T00:00:00.000Z");
  const previa = I.previaDaImportacao(semNada, { ...aquiVazio(), tarefas: [tarefa("t1", "Daqui", D1)] });
  assert.equal(doGrupo(previa, "tarefas").conflitos[0].maisNovo, "aqui");
  assert.equal(I.lerExportacao(JSON.stringify({ exportadoEm: "<script>", tarefas: [] })).exportadoEm, null, "data do export que não é data não passa adiante");
});

teste("prévia: mesmo carimbo dos dois lados com conteúdo diferente é empate (só troca no modo arquivo)", () => {
  const previa = I.previaDaImportacao(I.lerExportacao(exportar({ tarefas: [tarefa("t1", "Do arquivo", D1)] })), { ...aquiVazio(), tarefas: [tarefa("t1", "Daqui", D1)] });
  const c = doGrupo(previa, "tarefas").conflitos[0];
  assert.equal(c.maisNovo, "empate");
  assert.deepEqual([I.trocaNoModo(c, "manter"), I.trocaNoModo(c, "recente"), I.trocaNoModo(c, "arquivo")], [false, false, true]);
});

// ---------- o plano ----------

const cenario = () => {
  const arquivo = I.lerExportacao(exportar({
    tarefas: [tarefa("t2", "Mudou no arquivo", D2), tarefa("t3", "Nova"), tarefa("t4", "Mais velha no arquivo", D1)],
    pessoas: { rev: 1, items: [T.normalizarPessoa({ id: "pe1", nome: "Ana do arquivo", criadaEm: D1, atualizadaEm: D2 }), T.normalizarPessoa({ id: "pe3", nome: "Carla", criadaEm: D1, atualizadaEm: D1 })] },
  }));
  const aqui = {
    ...aquiVazio(),
    tarefas: [tarefa("t2", "Como está aqui", D1), tarefa("t4", "Mexida aqui depois", D2), tarefa("t9", "Só existe aqui")],
    pessoas: [T.normalizarPessoa({ id: "pe1", nome: "Ana daqui", criadaEm: D1, atualizadaEm: D1 }), T.normalizarPessoa({ id: "pe2", nome: "Bruno", criadaEm: D1, atualizadaEm: D1 })],
  };
  return { arquivo, aqui };
};

teste("plano: manter só acrescenta, recente troca o que o arquivo mexeu por último, arquivo troca tudo", () => {
  const { arquivo, aqui } = cenario();
  const resumo = (modo) => {
    const p = doGrupo(I.planoDaImportacao(arquivo, aqui, modo), "tarefas");
    return { entram: p.entram.map((x) => x.id), trocam: p.trocam.map((x) => x.id), mantidos: p.mantidos };
  };
  assert.deepEqual(resumo("manter"), { entram: ["t3"], trocam: [], mantidos: 2 });
  assert.deepEqual(resumo("recente"), { entram: ["t3"], trocam: ["t2"], mantidos: 1 });
  assert.deepEqual(resumo("arquivo"), { entram: ["t3"], trocam: ["t2", "t4"], mantidos: 0 });
});

teste("importar nunca tira nada: a coleção depois tem tudo o que tinha, na mesma ordem, mais o que entrou", () => {
  const { arquivo, aqui } = cenario();
  for (const modo of I.MODOS_DE_IMPORTACAO) {
    const p = doGrupo(I.planoDaImportacao(arquivo, aqui, modo), "pessoas");
    const depois = I.colecaoComPlano(aqui.pessoas, p);
    assert.deepEqual(depois.map((x) => x.id), ["pe1", "pe2", "pe3"], `modo ${modo}`);
    assert.equal(depois[0].nome, modo === "manter" ? "Ana daqui" : "Ana do arquivo", `modo ${modo}`);
    assert.equal(depois[1].nome, "Bruno", "quem só existe aqui fica como está");
  }
  const tarefas = doGrupo(I.planoDaImportacao(arquivo, aqui, "arquivo"), "tarefas");
  assert.ok(![...tarefas.entram, ...tarefas.trocam].some((x) => x.id === "t9"), "tarefa que só existe aqui nem aparece no plano");
});

teste("coleção ilegível nesta pasta trava a importação daquele grupo (e só se o arquivo trazia algo para ele)", () => {
  const arquivo = I.lerExportacao(exportar({ tarefas: [tarefa("t1", "Nova")], categorias: { rev: 1, items: [cat("c1", "Pipeline")] } }));
  const aqui = { ...aquiVazio(), categorias: null, links: null };
  const previa = I.previaDaImportacao(arquivo, aqui);
  assert.equal(doGrupo(previa, "categorias").ilegivelAqui, true);
  assert.deepEqual(I.gruposTravados(previa), ["categorias"], "links está ilegível, mas o arquivo não traz links");
  assert.ok(!I.planoDaImportacao(arquivo, aqui, "arquivo").some((p) => p.grupo === "categorias"), "grupo ilegível fica fora do plano");
});

teste("o resumo que vai para a tela bate com a prévia inteira nos três modos", () => {
  const { arquivo, aqui } = cenario();
  const previa = I.previaDaImportacao(arquivo, aqui);
  const resumo = I.resumoDaPrevia(previa, 1);
  const t = resumo.find((g) => g.grupo === "tarefas");
  assert.deepEqual([t.noArquivo, t.entram, t.conflitos, t.maisNovosNoArquivo, t.iguais], [3, 1, 2, 1, 0]);
  assert.deepEqual([t.exemplosDeEntrada, t.exemplosDeConflito], [["Nova"], ["Mudou no arquivo"]], "os exemplos têm teto");
  for (const modo of I.MODOS_DE_IMPORTACAO) {
    assert.equal(resumo.reduce((n, g) => n + I.trocasNoResumo(g, modo), 0), I.totaisDaPrevia(previa, modo).trocam, `modo ${modo}`);
  }
});

teste("o nome de cada tipo de item na prévia", () => {
  assert.equal(I.tituloDoItem("tarefas", { id: "t1", titulo: "  Uma   tarefa " }), "Uma tarefa");
  assert.equal(I.tituloDoItem("pessoas", { id: "pe1", nome: "Ana" }), "Ana");
  assert.equal(I.tituloDoItem("jornada", { id: "config" }), "Configuração da jornada");
  assert.equal(I.tituloDoItem("jornada", { id: "2026-11-23" }), "Dia 23/11/2026");
  assert.equal(I.tituloDoItem("assuntos", { id: "as1", pessoa: "Ana", texto: "falar do gate" }), "Ana: falar do gate");
  assert.equal(I.tituloDoItem("notas", { id: "n1", titulo: "" }), "(sem título)");
  assert.equal(I.ehModoDeImportacao("arquivo") && !I.ehModoDeImportacao("apagar-tudo") && !I.ehModoDeImportacao(null), true);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
