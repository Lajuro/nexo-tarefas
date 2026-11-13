// Testes do bloco de notas: o prompt e, principalmente, o leitor do JSON que a IA devolve.
// Uso: node testes/notas.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/notas.test.mjs)
// A resposta da IA é entrada não confiável: estes testes cobrem JSON cortado, com texto em
// volta, tarefa trocada, datas inválidas, tipos desconhecidos e tamanhos absurdos.

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

const N = await import("../lib/notas.ts");
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

// ---------- cenário ----------
const cats = [T.normalizarCategoria({ id: "c1", nome: "Ferramenta X" }), T.normalizarCategoria({ id: "c2", nome: "Antiga", arquivada: true })];
const tarefas = [
  T.normalizarTarefa({
    id: "ta", titulo: "Onboarding do squad de Pagamentos na Ferramenta X", categoriaId: "c1", status: "em_andamento", criadaEm: "2026-10-01T10:00:00.000Z",
    registros: [{ id: "r1", tipo: "reuniao", data: "2026-10-20", titulo: "Kickoff", proximosPassos: [
      { id: "p1", texto: "Enviar documentação de integração para o squad", responsavel: "Eu" },
      { id: "p2", texto: "Liberar acesso ao repositório de checkout", responsavel: "Marina" },
      { id: "p3", texto: "Passo já feito", feito: true },
    ] }],
  }),
  T.normalizarTarefa({ id: "tb", titulo: "Trilha de formação dos Security Champions", status: "a_fazer", criadaEm: "2026-10-05T10:00:00.000Z" }),
  T.normalizarTarefa({ id: "tc", titulo: "Tarefa já concluída", status: "concluida", criadaEm: "2026-09-01T10:00:00.000Z" }),
];
const nota = T.normalizarNota({ id: "n1", titulo: "Reunião das 10h", texto: "marina liberou o acesso. squad topou o piloto.\nnova demanda: auditoria quer evidência de acessos" });
const ler = (obj) => N.interpretarNotas(typeof obj === "string" ? obj : JSON.stringify(obj), tarefas, cats);

// ---------- apelidos e prompt ----------
teste("apelidos: só tarefas abertas, em ordem de criação", () => {
  const a = N.apelidosDasTarefas(tarefas);
  assert.deepEqual(a.map((x) => [x.apelido, x.tarefa.id]), [["T1", "ta"], ["T2", "tb"]]);
});
teste("prompt: traz notas, tarefas com apelido, passos em aberto e o formato", () => {
  const p = N.promptNotas(nota, tarefas, cats);
  assert.match(p, /\[T1\] Onboarding do squad de Pagamentos/);
  assert.match(p, /\[T2\] Trilha de formação/);
  assert.ok(!p.includes("Tarefa já concluída"), "tarefa concluída não entra");
  assert.match(p, /Liberar acesso ao repositório de checkout \(Marina\)/);
  assert.ok(!p.includes("Passo já feito"), "passo feito não entra");
  assert.match(p, /marina liberou o acesso/);
  assert.match(p, /"nexo": 1/);
  assert.ok(p.includes("Ferramenta X") && !p.includes("Antiga"), "categoria arquivada não entra");
  assert.ok(!p.includes("—"), "sem travessão");
});

// ---------- extração do JSON ----------
const MINIMO = { nexo: 1, itens: [{ tipo: "registro", tarefa: "T1", registroTipo: "reuniao", data: "2026-11-10", titulo: "Piloto aprovado", resumo: "Squad topou." }] };
teste("lê JSON puro", () => assert.equal(ler(MINIMO).propostas.length, 1));
teste("lê JSON dentro de cerca de código", () => assert.equal(ler("```json\n" + JSON.stringify(MINIMO, null, 2) + "\n```").propostas.length, 1));
teste("lê JSON com conversa antes e depois", () =>
  assert.equal(ler("Claro! Aqui está:\n\n" + JSON.stringify(MINIMO) + "\n\nQuer que eu ajuste algo?").propostas.length, 1));
teste("aceita a lista de itens sem o envelope", () => assert.equal(ler(MINIMO.itens).propostas.length, 1));
teste("JSON cortado no meio: erro claro, nada proposto", () => {
  const r = ler(JSON.stringify(MINIMO).slice(0, 60));
  assert.equal(r.ok, false);
  assert.match(r.erro, /cortada/);
  assert.equal(r.propostas.length, 0);
});
teste("resposta vazia, sem JSON ou sem itens", () => {
  assert.equal(ler("   ").ok, false);
  assert.equal(ler("não consegui organizar").ok, false);
  assert.match(ler({ nexo: 1 }).erro, /itens/);
  assert.equal(ler({ nexo: 1, itens: [] }).ok, false);
});
teste("resposta gigante é recusada", () => assert.match(ler("x".repeat(300_001)).erro, /grande demais/));

// ---------- registro ----------
teste("registro completo vira Registro normalizado na tarefa certa", () => {
  const r = ler({ itens: [{
    tipo: "registro", tarefa: "T1", tarefaTitulo: "Onboarding do squad de Pagamentos na Ferramenta X", registroTipo: "reuniao", data: "2026-11-10",
    titulo: "Piloto aprovado", participantes: ["Marina", "Felipe", "Marina", ""], resumo: "Squad topou o piloto.",
    decisoes: ["Começar pelo checkout", "Gate só para crítica"], impedimentos: "Nenhum",
    passos: [{ texto: "Agendar treinamento", responsavel: "Eu", prazo: "2026-11-20" }, "Mandar convite", { texto: "" }],
    trecho: "squad topou o piloto",
  }] });
  assert.equal(r.ok, true);
  const p = r.propostas[0];
  assert.equal(p.tipo, "registro");
  assert.equal(p.tarefaId, "ta");
  assert.equal(p.duvida, "");
  assert.equal(p.registro.tipo, "reuniao");
  assert.equal(p.registro.data, "2026-11-10");
  assert.deepEqual(p.registro.participantes, ["Marina", "Felipe"]);
  assert.equal(p.registro.decisoes, "Começar pelo checkout\nGate só para crítica");
  assert.equal(p.registro.impedimentos, "", '"Nenhum" vira vazio');
  assert.equal(p.registro.anotacoes, "squad topou o piloto");
  assert.deepEqual(p.registro.proximosPassos.map((x) => [x.texto, x.responsavel, x.prazo, x.feito]),
    [["Agendar treinamento", "Eu", "2026-11-20", false], ["Mandar convite", "", null, false]]);
  assert.match(p.registro.id, /^r/);
  assert.ok(T.ID_VALIDO.test(p.registro.id) && p.registro.proximosPassos.every((x) => T.ID_VALIDO.test(x.id)), "ids gerados pelo app");
});
teste("tipo de registro desconhecido ou 'marco' vira nota", () => {
  for (const rt of ["marco", "qualquer", undefined])
    assert.equal(ler({ itens: [{ tipo: "registro", tarefa: "T1", registroTipo: rt, titulo: "x" }] }).propostas[0].registro.tipo, "nota");
});
teste("data inválida vira hoje e gera aviso", () => {
  for (const d of ["10/11/2026", "2026-13-40", "2026-02-31", "amanhã"]) {
    const r = ler({ itens: [{ tipo: "registro", tarefa: "T1", data: d, titulo: "x" }] });
    assert.equal(r.propostas[0].registro.data, T.hojeISO(), d);
    assert.ok(r.avisos.some((a) => a.includes("Data inválida")), d);
  }
});
teste("registro vazio é ignorado com aviso", () => {
  const r = ler({ itens: [{ tipo: "registro", tarefa: "T1" }, MINIMO.itens[0]] });
  assert.equal(r.propostas.length, 1);
  assert.ok(r.avisos.some((a) => a.includes("vazio")));
});

// ---------- achar a tarefa ----------
teste("apelido em minúsculas e id real também servem", () => {
  assert.equal(ler({ itens: [{ tipo: "registro", tarefa: "t2", titulo: "x" }] }).propostas[0].tarefaId, "tb");
  assert.equal(ler({ itens: [{ tipo: "registro", tarefa: "tb", titulo: "x" }] }).propostas[0].tarefaId, "tb");
});
teste("apelido errado mas título certo: vale o título, com aviso para conferir", () => {
  const p = ler({ itens: [{ tipo: "registro", tarefa: "T1", tarefaTitulo: "Trilha de formação dos Security Champions", titulo: "x" }] }).propostas[0];
  assert.equal(p.tarefaId, "tb");
  assert.match(p.duvida, /confira/i);
});
teste("apelido certo e título que não bate com nada: mantém, mas pede conferência", () => {
  const p = ler({ itens: [{ tipo: "registro", tarefa: "T1", tarefaTitulo: "Outra coisa qualquer", titulo: "x" }] }).propostas[0];
  assert.equal(p.tarefaId, "ta");
  assert.match(p.duvida, /não bate/);
});
teste("tarefa inexistente ou concluída: sem tarefa, usuário escolhe", () => {
  for (const cod of ["T9", "tc", "../../etc", ""]) {
    const p = ler({ itens: [{ tipo: "registro", tarefa: cod, titulo: "x" }] }).propostas[0];
    assert.equal(p.tarefaId, null, cod);
    assert.match(p.duvida, /Escolha uma/);
  }
});

// ---------- tarefa nova ----------
teste("tarefa nova: categoria por nome, prioridade limitada, prazo validado", () => {
  const r = ler({ itens: [
    { tipo: "tarefa", titulo: "Evidências para a auditoria", descricao: "Auditoria pediu.", categoria: "ferramenta x", prioridade: 99, prazo: "2026-12-01", passos: [{ texto: "Pedir relatório" }], trecho: "auditoria quer evidência" },
    { tipo: "tarefa", titulo: "Outra", categoria: "Categoria que não existe", prioridade: "alta", prazo: "logo" },
    { tipo: "tarefa", titulo: "Com categoria arquivada", categoria: "Antiga", prioridade: -3 },
    { tipo: "tarefa", titulo: "" },
  ] });
  assert.equal(r.propostas.length, 3);
  const [a, b, c] = r.propostas;
  assert.deepEqual([a.categoriaId, a.categoriaCitada, a.prioridade, a.prazo], ["c1", "", 10, "2026-12-01"]);
  assert.deepEqual([b.categoriaId, b.categoriaCitada, b.prioridade, b.prazo], [null, "Categoria que não existe", 5, null]);
  assert.deepEqual([c.categoriaId, c.prioridade], [null, 1]);
  assert.ok(r.avisos.some((x) => x.includes("sem título")));
});
teste("tarefaDaProposta: marco de criação e nota inicial com os passos", () => {
  const p = ler({ itens: [{ tipo: "tarefa", titulo: "Evidências", passos: [{ texto: "Pedir relatório" }], trecho: "auditoria quer evidência" }] }).propostas[0];
  const t = N.tarefaDaProposta(p, nota);
  assert.equal(t.status, "a_fazer");
  assert.deepEqual(t.registros.map((r) => r.tipo), ["marco", "nota"]);
  assert.equal(t.registros[1].anotacoes, "auditoria quer evidência");
  assert.equal(t.registros[1].proximosPassos[0].texto, "Pedir relatório");
  assert.ok(T.ID_VALIDO.test(t.id));
  const semNada = N.tarefaDaProposta(ler({ itens: [{ tipo: "tarefa", titulo: "Só título" }] }).propostas[0], nota);
  assert.deepEqual(semNada.registros.map((r) => r.tipo), ["marco"]);
});

// ---------- passo concluído ----------
teste("passo concluído: casa pelo texto com um passo em aberto", () => {
  const r = ler({ itens: [
    { tipo: "passo_concluido", tarefa: "T1", passo: "Liberar acesso ao repositório de checkout" },
    { tipo: "passo concluído", tarefa: "T1", passo: "liberar acesso ao repositorio de checkout" },
    { tipo: "passo_concluido", tarefa: "T1", passo: "Passo que não existe" },
    { tipo: "passo_concluido", tarefa: "T1", passo: "Passo já feito" },
    { tipo: "passo_concluido", tarefa: "T2", passo: "Liberar acesso ao repositório de checkout" },
  ] });
  assert.equal(r.propostas.length, 1, "não repete o mesmo passo nem aceita passo de outra tarefa");
  assert.deepEqual([r.propostas[0].tarefaId, r.propostas[0].registroId, r.propostas[0].passoId], ["ta", "r1", "p2"]);
  assert.equal(r.avisos.filter((a) => a.includes("Não achei o passo")).length, 3);
});

// ---------- robustez ----------
teste("itens estranhos são ignorados sem quebrar", () => {
  const r = ler({ itens: [null, 7, "texto", [], { tipo: "apagar_tudo" }, { sem: "tipo" }, MINIMO.itens[0]], sobras: ["fofoca do café", ""] });
  assert.equal(r.propostas.length, 1);
  assert.equal(r.avisos.filter((a) => a.includes("tipo desconhecido")).length, 2);
  assert.equal(r.sobras, "fofoca do café");
});
teste("tamanhos absurdos são cortados", () => {
  const r = ler({ itens: [{
    tipo: "registro", tarefa: "T1", titulo: "t".repeat(5000), resumo: "r".repeat(50_000),
    participantes: Array.from({ length: 200 }, (_, i) => "Pessoa " + i), passos: Array.from({ length: 200 }, (_, i) => ({ texto: "passo " + i })),
  }] });
  const reg = r.propostas[0].registro;
  assert.equal(reg.titulo.length, 300);
  assert.equal(reg.resumoIA.length, 12_000);
  assert.equal(reg.participantes.length, 30);
  assert.equal(reg.proximosPassos.length, 30);
});
teste("mais de 60 itens: lê os 60 primeiros e avisa", () => {
  const r = ler({ itens: Array.from({ length: 80 }, (_, i) => ({ tipo: "registro", tarefa: "T1", titulo: "item " + i })) });
  assert.equal(r.propostas.length, 60);
  assert.ok(r.avisos.some((a) => a.includes("80 itens")));
});
teste("campos extras e tipos trocados não vazam para o registro", () => {
  const p = ler({ itens: [{ tipo: "registro", tarefa: "T1", titulo: { x: 1 }, resumo: 42, id: "../../hack", feito: true, rev: 99, __proto__: { poluido: true }, passos: [{ texto: "ok", id: "../x", feito: true }] }] }).propostas[0];
  assert.equal(p.registro.titulo, "");
  assert.equal(p.registro.resumoIA, "42");
  assert.ok(T.ID_VALIDO.test(p.registro.id) && p.registro.id !== "../../hack");
  assert.ok(T.ID_VALIDO.test(p.registro.proximosPassos[0].id));
  assert.equal(p.registro.proximosPassos[0].feito, false, "a IA não marca passo novo como feito");
  assert.equal({}.poluido, undefined);
});
teste("só sobras também é uma leitura válida", () => {
  const r = ler({ itens: [], sobras: "não consegui encaixar isto" });
  assert.equal(r.ok, true);
  assert.equal(r.propostas.length, 0);
});

// ---------- aplicação ----------
teste("comRegistroDaNota acrescenta uma vez só", () => {
  const p = ler(MINIMO).propostas[0];
  const t1 = N.comRegistroDaNota(tarefas[0], p.registro);
  assert.equal(t1.registros.length, tarefas[0].registros.length + 1);
  assert.equal(N.comRegistroDaNota(t1, p.registro).registros.length, t1.registros.length);
});
teste("frutoDe descreve o que nasceu da nota", () => {
  const p = ler(MINIMO).propostas[0];
  const f = N.frutoDe(p, tarefas[0]);
  assert.deepEqual([f.tipo, f.tarefaId, f.registroId], ["registro", "ta", p.registro.id]);
  assert.match(f.rotulo, /Reunião em Onboarding/);
  assert.equal(T.normalizarNota({ gerou: [f, { tipo: "x" }, null] }).gerou.length, 1, "normalizarNota descarta fruto sem tarefa");
});

console.log(`\n${total - falhas}/${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
