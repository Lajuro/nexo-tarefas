// Testes das páginas de conhecimento e dos links internos: lib/ligacoes.ts (quem cita quem) e a parte de
// links internos de lib/texto-rico.ts. Uso: node testes/ligacoes.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/ligacoes.test.mjs)

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

const L = await import("../lib/ligacoes.ts");
const R = await import("../lib/texto-rico.ts");
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

teste("link interno: vai e volta, e só aceita o formato do app", () => {
  assert.equal(R.hrefInterno("tarefa", "t1abc"), "nexo:tarefa/t1abc");
  assert.equal(R.hrefInterno("pessoa", " Marina Souza "), "nexo:pessoa/Marina%20Souza");
  assert.deepEqual(R.linkInterno("nexo:tarefa/t1abc"), { tipo: "tarefa", alvo: "t1abc", rota: "/tarefas/t1abc" });
  assert.deepEqual(R.linkInterno("nexo:pagina/pg9"), { tipo: "pagina", alvo: "pg9", rota: "/paginas?p=pg9" });
  assert.deepEqual(R.linkInterno("nexo:categoria/c2"), { tipo: "categoria", alvo: "c2", rota: "/categorias/c2" });
  assert.deepEqual(R.linkInterno("nexo:pessoa/Marina%20Souza"), { tipo: "pessoa", alvo: "Marina Souza", rota: "/pessoas?p=Marina%20Souza" });
  for (const mau of ["nexo:tarefa/../x", "nexo:tarefa/a/b", "nexo:tarefa/", "nexo:config/x", "nexo:tarefa/t1?x=1", "nexo:pessoa/", "nexo:pessoa/%E0%A4%A", "javascript:alert(1)", "https://exemplo.local", "nexo:pagina/a b", ""])
    assert.equal(R.linkInterno(mau), null, mau);
  // um link interno nunca passa como link externo
  assert.equal(R.linkPermitido("nexo:tarefa/t1"), null);
});

teste("leitor: link interno vira navegação dentro do app, com a rota calculada aqui (não vinda do texto)", () => {
  const [p] = R.analisarMarkdown("veja [Onboarding](nexo:tarefa/t1) e [@Marina](nexo:pessoa/Marina) e [mau](nexo:tarefa/../../api/exportar)");
  const internos = p.f.filter((i) => i.t === "interno");
  assert.deepEqual(internos.map((i) => [i.tipo, i.rota]), [["tarefa", "/tarefas/t1"], ["pessoa", "/pessoas?p=Marina"]]);
  assert.ok(!p.f.some((i) => i.t === "link"));
  assert.equal(R.paraTextoPlano("veja [Onboarding](nexo:tarefa/t1)"), "veja Onboarding");
});

// Datas fixas em tudo: sem elas a tarefa nasce com a hora de agora e a ordem das citações muda conforme o relógio.
const dados = {
  categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] }, pessoas: { rev: 0, items: [] }, times: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, avisos: [],
  tarefas: [
    T.normalizarTarefa({ id: "t1", titulo: "Onboarding", criadaEm: "2026-11-01T10:00:00Z", atualizadaEm: "2026-11-12T10:00:00Z", descricao: "depende de [Hardening](nexo:tarefa/t2) e cita a si mesma [x](nexo:tarefa/t1)", registros: [
      { id: "r1", tipo: "reuniao", data: "2026-11-10", titulo: "Kickoff", anotacoes: "falei com [@Marina Souza](nexo:pessoa/Marina%20Souza), ver [Processo](nexo:pagina/pg1)" },
      { id: "r2", tipo: "nota", data: "2026-11-12", titulo: "", resumoIA: "de novo [Processo](nexo:pagina/pg1) e [Processo](nexo:pagina/pg1)" },
    ] }),
    T.normalizarTarefa({ id: "t2", titulo: "Hardening" }),
  ],
  paginas: { rev: 1, items: [
    T.normalizarPagina({ id: "pg1", titulo: "Processo de exceção", texto: "usado em [Onboarding](nexo:tarefa/t1). Quem aprova: [@marina souza](nexo:pessoa/marina%20souza). Eu mesma: [x](nexo:pagina/pg1)", atualizadaEm: "2026-11-13T10:00:00Z" }),
  ] },
  notas: { rev: 1, items: [T.normalizarNota({ id: "n1", titulo: "", texto: "lembrar de [Hardening](nexo:tarefa/t2)", atualizadaEm: "2026-11-14T10:00:00Z" })] },
};

teste("citações: quem aponta para uma tarefa, sem contar a própria", () => {
  const i = L.indiceDeCitacoes(dados);
  const t1 = L.citacoesDe(i, "tarefa", "t1");
  assert.deepEqual(t1.map((c) => [c.origem, c.rota]), [["pagina", "/paginas?p=pg1"]]);
  const t2 = L.citacoesDe(i, "tarefa", "t2");
  assert.deepEqual(t2.map((c) => c.origem), ["nota", "tarefa"]); // a mais recente primeiro
  assert.equal(t2[1].rota, "/tarefas/t1");
});

teste("citações: página citada em dois registros aparece uma vez por registro", () => {
  const pg = L.citacoesDe(L.indiceDeCitacoes(dados), "pagina", "pg1");
  assert.deepEqual(pg.map((c) => c.rota), ["/tarefas/t1?r=r2", "/tarefas/t1?r=r1"]);
  assert.ok(pg[1].detalhe.includes("Reunião") && pg[1].detalhe.includes("Onboarding"));
  assert.equal(pg[0].rotulo, "Nota"); // registro sem título usa o tipo
});

teste("citações: pessoa é encontrada sem acento, sem maiúscula e pelos apelidos", () => {
  const i = L.indiceDeCitacoes(dados);
  assert.equal(L.citacoesDe(i, "pessoa", "MARINA SOUZA").length, 2);
  assert.equal(L.citacoesDe(i, "pessoa", "Marina").length, 0);
  assert.equal(L.citacoesDe(i, "pessoa", "Marina", ["Marina Souza"]).length, 2); // sem repetir
  assert.equal(L.citacoesDe(i, "pessoa", "Ninguém").length, 0);
});

teste("citações: dados antigos sem páginas nem notas não quebram, e link torto é ignorado", () => {
  const antigo = { ...dados, paginas: undefined, notas: undefined };
  assert.doesNotThrow(() => L.indiceDeCitacoes(antigo));
  assert.deepEqual(L.alvosDoTexto("[a](nexo:tarefa/../x) [b](nexo:outra/1) [c](https://exemplo.local) texto nexo:tarefa/t9 solto"), []);
  assert.deepEqual(L.alvosDoTexto(null), []);
});

teste("página: normalizar dá os padrões e preserva o que não conhece", () => {
  const p = T.normalizarPagina({ titulo: 7, texto: null, categoriaId: "", tags: "x", campoFuturo: "fica" });
  assert.ok(p.id.startsWith("pg"));
  assert.deepEqual([p.titulo, p.texto, p.categoriaId, p.tags, p.arquivadaEm, p.campoFuturo], ["", "", null, [], null, "fica"]);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
