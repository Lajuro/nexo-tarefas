// Testes da documentação: lib/paginas.ts (árvore de páginas, ordem de leitura, sumário, busca e modelos).
// Uso: node testes/paginas.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/paginas.test.mjs)

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

const P = await import("../lib/paginas.ts");
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

const pg = (id, titulo, extra = {}) => T.normalizarPagina({ id, titulo, texto: "", criadaEm: "2026-11-01T10:00:00Z", atualizadaEm: "2026-11-01T10:00:00Z", ...extra });
const base = () => [
  pg("a", "Ferramenta X", { ordem: 0 }),
  pg("a1", "Instalação", { paiId: "a", ordem: 1 }),
  pg("a2", "Configuração", { paiId: "a", ordem: 0 }),
  pg("a2x", "Proxy", { paiId: "a2" }),
  pg("b", "Processos", { ordem: 1 }),
  pg("b1", "Exceção de vulnerabilidade", { paiId: "b" }),
];
const ids = (nos) => nos.map((n) => n.pagina.id);
const forma = (nos) => nos.map((n) => (n.filhos.length ? [n.pagina.id, forma(n.filhos)] : n.pagina.id));

teste("normalizar: campos novos têm padrão, lixo vira padrão e o desconhecido fica", () => {
  const p = T.normalizarPagina({ id: "x", titulo: "T", paiId: "../etc", ordem: "abc", icone: "<script>", estado: "publicado", fixada: "sim", campoFuturo: 7 });
  assert.deepEqual([p.paiId, p.ordem, p.icone, p.estado, p.fixada, p.campoFuturo], [null, 0, "", "rascunho", false, 7]);
  const q = T.normalizarPagina({ id: "y", paiId: "x", ordem: "2.5", icone: "livro", estado: "revisao", fixada: true });
  assert.deepEqual([q.paiId, q.ordem, q.icone, q.estado, q.fixada], ["x", 2.5, "livro", "revisao", true]);
  assert.equal(T.normalizarPagina({ id: "z", paiId: "z" }).paiId, null); // não pode ser mãe de si mesma
  // página gravada por versão antiga (sem os campos) continua valendo
  const antiga = T.normalizarPagina({ id: "v", titulo: "Antiga", texto: "t", categoriaId: null, tags: [] });
  assert.deepEqual([antiga.paiId, antiga.estado, antiga.fixada], [null, "rascunho", false]);
});

teste("árvore: filhas dentro das mães, na ordem escolhida e depois alfabética", () => {
  const arvore = P.montarArvore(base());
  assert.deepEqual(forma(arvore), [["a", [["a2", ["a2x"]], "a1"]], ["b", ["b1"]]]);
  assert.deepEqual(arvore[0].filhos[0].filhos[0].nivel, 2);
  assert.deepEqual(ids(P.emOrdemDeLeitura(arvore)), ["a", "a2", "a2x", "a1", "b", "b1"]);
  // mesma ordem: desempata pelo nome, sem se perder com acento
  const empate = P.montarArvore([pg("1", "Zebra"), pg("2", "Água"), pg("3", "abacaxi")]);
  assert.deepEqual(ids(empate), ["3", "2", "1"]);
});

teste("árvore estranha nunca some com página: mãe que não existe, ciclo e mãe de si mesma viram raiz", () => {
  const torta = [
    pg("orfa", "Órfã", { paiId: "nao-existe" }),
    { ...pg("c1", "Ciclo 1"), paiId: "c2" },
    { ...pg("c2", "Ciclo 2"), paiId: "c1" },
    { ...pg("eu", "Eu mesma"), paiId: "eu" },
    pg("filha", "Filha do ciclo", { paiId: "c1" }),
  ];
  const todos = ids(P.emOrdemDeLeitura(P.montarArvore(torta))).sort();
  assert.deepEqual(todos, ["c1", "c2", "eu", "filha", "orfa"]); // todas aparecem, uma vez só
  assert.ok(P.montarArvore(torta).some((n) => n.pagina.id === "orfa"));
  assert.deepEqual(P.caminhoDaPagina(torta, "orfa"), []);
  assert.doesNotThrow(() => P.descendentes(torta, "c1"));
  assert.doesNotThrow(() => P.caminhoDaPagina(torta, "c2"));
});

teste("caminho, descendentes e vizinhas", () => {
  const ps = base();
  assert.deepEqual(P.caminhoDaPagina(ps, "a2x").map((p) => p.id), ["a", "a2"]);
  assert.deepEqual(P.caminhoDaPagina(ps, "a"), []);
  assert.deepEqual([...P.descendentes(ps, "a")].sort(), ["a1", "a2", "a2x"]);
  assert.deepEqual([...P.descendentes(ps, "b1")], []);
  const v = P.vizinhas(ps, "a1");
  assert.deepEqual([v.anterior.id, v.proxima.id], ["a2x", "b"]);
  assert.deepEqual([P.vizinhas(ps, "a").anterior, P.vizinhas(ps, "b1").proxima], [null, null]);
  assert.deepEqual(P.vizinhas(ps, "nao-existe"), { anterior: null, proxima: null });
});

teste("mover: para dentro, para a raiz, antes de outra, e nunca para dentro de si mesma", () => {
  const ps = base();
  // b1 vira filha de "a", antes de a1
  let m = P.moverPagina(ps, "b1", "a", "a1");
  assert.deepEqual(forma(P.montarArvore(m)), [["a", [["a2", ["a2x"]], "b1", "a1"]], "b"]);
  // para o fim de "a"
  m = P.moverPagina(ps, "b1", "a");
  assert.deepEqual(forma(P.montarArvore(m))[0], ["a", [["a2", ["a2x"]], "a1", "b1"]]);
  // a2x para a raiz, antes de "b"
  m = P.moverPagina(ps, "a2x", null, "b");
  assert.deepEqual(ids(P.montarArvore(m)), ["a", "a2x", "b"]);
  // reordenar entre irmãs: a1 antes de a2
  m = P.moverPagina(ps, "a1", "a", "a2");
  assert.deepEqual(ids(P.montarArvore(m)[0].filhos), ["a1", "a2"]);
  // inválidos: devolve a mesma lista
  assert.equal(P.moverPagina(ps, "a", "a"), ps);
  assert.equal(P.moverPagina(ps, "a", "a2x"), ps); // para dentro de uma neta
  assert.equal(P.moverPagina(ps, "a", "nao-existe"), ps);
  assert.equal(P.moverPagina(ps, "nao-existe", null), ps);
  assert.equal(P.moverPagina(ps, "a", null, "a"), ps);
  // só quem mudou de lugar ganha data nova; ninguém some
  m = P.moverPagina(ps, "b1", "a", "a1");
  assert.equal(m.length, ps.length);
  assert.notEqual(m.find((p) => p.id === "b1").atualizadaEm, "2026-11-01T10:00:00Z");
  assert.equal(m.find((p) => p.id === "a2x").atualizadaEm, "2026-11-01T10:00:00Z");
});

teste("excluir uma página sobe as filhas para a avó", () => {
  const sem = P.semPagina(base(), "a2");
  assert.equal(sem.length, 5);
  assert.equal(sem.find((p) => p.id === "a2x").paiId, "a");
  const semRaiz = P.semPagina(base(), "a");
  assert.deepEqual(ids(P.montarArvore(semRaiz)).sort(), ["a1", "a2", "b"]);
  assert.equal(P.semPagina(base(), "nao-existe").length, 6);
});

teste("sumário: títulos em ordem, âncoras únicas, sem contar o que está em bloco de código", () => {
  const md = "# Visão geral\n\ntexto\n\n## Como pedir\n\n```bash\n# isto é comentário, não título\n```\n\n## Como pedir\n\n### **Prazo** de _aprovação_\n\n#### Nível quatro vira três\n\n#semespaço\n\n## Título com [link](nexo:tarefa/t1) e `código` ##\n\n~~~\n## também não\n~~~\n";
  const s = P.sumarioDoMarkdown(md);
  assert.deepEqual(s.map((i) => [i.nivel, i.texto, i.id]), [
    [1, "Visão geral", "visao-geral"],
    [2, "Como pedir", "como-pedir"],
    [2, "Como pedir", "como-pedir-2"],
    [3, "Prazo de aprovação", "prazo-de-aprovacao"],
    [3, "Nível quatro vira três", "nivel-quatro-vira-tres"],
    [2, "Título com link e código", "titulo-com-link-e-codigo"],
  ]);
  assert.deepEqual(s.map((i) => i.indice), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(P.sumarioDoMarkdown(""), []);
  assert.deepEqual(P.sumarioDoMarkdown(null), []);
  assert.equal(P.ancora("  Ação & Reação!!  "), "acao-reacao");
  assert.equal(P.ancora("???"), "secao");
  assert.deepEqual(P.tamanhoDaLeitura("uma **duas** três\n\n- quatro"), { palavras: 4, minutos: 1 });
  assert.deepEqual(P.tamanhoDaLeitura(""), { palavras: 0, minutos: 0 });
});

teste("busca: todas as palavras, em qualquer seção; título vale mais; trecho diz a seção", () => {
  const ps = [
    pg("p1", "Exceção de vulnerabilidade", { tags: ["processo"], texto: "Introdução geral.\n\n## Quando pedir\n\nSe o prazo não couber, abrir uma **exceção** com o aceite do gestor.\n\n## Quem aprova\n\nO gestor da área e o time de segurança." }),
    pg("p2", "Guia do scan", { texto: "## Instalar\n\nBaixar o agente.\n\n## Exceção\n\nPara excluir um diretório do scan, use a lista de exceção.", atualizadaEm: "2026-11-10T10:00:00Z" }),
    pg("p3", "Outra coisa", { texto: "nada a ver" }),
  ];
  const r = P.buscarNasPaginas(ps, "excecao");
  assert.deepEqual(r.map((x) => x.pagina.id), ["p1", "p2"]); // no título vem primeiro
  assert.equal(r[0].noTitulo, true);
  assert.deepEqual(r[1].trechos.map((t) => [t.secao, t.indiceDoTitulo]), [["Exceção", 1]]);
  assert.match(r[1].trechos[0].trecho, /lista de exceção/);
  // duas palavras em seções diferentes da mesma página
  const dois = P.buscarNasPaginas(ps, "prazo seguranca");
  assert.deepEqual(dois.map((x) => x.pagina.id), ["p1"]);
  assert.deepEqual(dois[0].trechos.map((t) => t.secao), ["Quando pedir", "Quem aprova"]);
  assert.ok(!dois[0].trechos[0].trecho.includes("**")); // sem a marcação
  // texto antes do primeiro título
  assert.deepEqual(P.buscarNasPaginas(ps, "introducao")[0].trechos[0], { secao: null, indiceDoTitulo: -1, trecho: "Introdução geral." });
  // por tag
  assert.deepEqual(P.buscarNasPaginas(ps, "PROCESSO").map((x) => x.pagina.id), ["p1"]);
  assert.deepEqual(P.buscarNasPaginas(ps, "   "), []);
  assert.deepEqual(P.buscarNasPaginas(ps, "inexistente"), []);
});

teste("modelos e cópias", () => {
  assert.ok(P.MODELOS_DE_PAGINA.length >= 6);
  for (const m of P.MODELOS_DE_PAGINA) assert.ok(P.ICONES_DE_PAGINA.includes(m.icone), m.id);
  const p = P.paginaDoModelo("processo", { paiId: "a", categoriaId: "c1" });
  assert.match(p.id, /^pg/);
  assert.deepEqual([p.titulo, p.icone, p.paiId, p.categoriaId, p.estado], ["Como funciona ...", "processo", "a", "c1", "rascunho"]);
  assert.ok(P.sumarioDoMarkdown(p.texto).length >= 4);
  assert.equal(P.paginaDoModelo("nao-existe").texto, "");
  const copia = P.duplicarPagina(pg("o", "Original", { fixada: true, estado: "publicada", paiId: "a", ordem: 3, texto: "t" }));
  assert.notEqual(copia.id, "o");
  assert.deepEqual([copia.titulo, copia.fixada, copia.estado, copia.paiId, copia.texto, copia.ordem], ["Original (cópia)", false, "rascunho", "a", "t", 3.5]);
  assert.deepEqual(P.porEstado([pg("1", "A", { estado: "publicada" }), pg("2", "B"), pg("3", "C", { estado: "publicada", atualizadaEm: "2026-12-01T10:00:00Z" })], "publicada").map((x) => x.id), ["3", "1"]);
  assert.equal(P.nomeDaPagina({ titulo: " ", texto: "# Primeira linha\n\nresto" }), "Primeira linha");
  assert.equal(P.nomeDaPagina({ titulo: "", texto: "" }), "Página sem título");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
