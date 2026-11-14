// Testes de "Perguntar ao Nexo": lib/perguntar.ts (achar trechos, montar o prompt, ligar as citações da resposta).
// Uso: node testes/perguntar.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/perguntar.test.mjs)

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

const P = await import("../lib/perguntar.ts");
const T = await import("../lib/tipos.ts");
const R = await import("../lib/texto-rico.ts");

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

const HOJE = "2026-11-14";
const longo = Array.from({ length: 60 }, (_, i) => `Linha ${i} de conversa sobre o cronograma e os acessos do time.`).join("\n\n");
const dados = {
  times: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, avisos: [],
  categorias: { rev: 1, items: [T.normalizarCategoria({ id: "c1", nome: "Ferramenta X" }), T.normalizarCategoria({ id: "c2", nome: "Formação" })] },
  links: { rev: 1, items: [T.normalizarLink({ id: "l1", tipo: "link", titulo: "Guia de integração do scan", url: "https://exemplo.local/guia", descricao: "passo a passo da pipeline", tarefaId: "t1" })] },
  pessoas: { rev: 1, items: [
    T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", apelidos: ["Marina"], cargo: "Tech lead", ajudaCom: "liberar acessos e priorizar o backlog", categoriaIds: ["c1"] }),
    T.normalizarPessoa({ id: "pe2", nome: "Bruno Lima", cargo: "Dev", ajudaCom: "pipeline e falso positivo" }),
    T.normalizarPessoa({ id: "pe3", nome: "Camila Torres", cargo: "Arquiteta", ajudaCom: "desenho de solução" }),
  ] },
  paginas: { rev: 1, items: [
    T.normalizarPagina({ id: "pg1", titulo: "Processo de exceção de vulnerabilidade", texto: "## Quando pedir\n\nSe o prazo não couber, abrir uma **exceção** com o aceite do gestor.", categoriaId: "c1", atualizadaEm: "2026-11-01T10:00:00Z" }),
  ] },
  notas: { rev: 1, items: [
    T.normalizarNota({ id: "n1", titulo: "Rascunho", texto: "lembrar do gate de bloqueio na conversa de sexta", atualizadaEm: "2026-11-12T10:00:00Z" }),
    T.normalizarNota({ id: "n2", titulo: "Antiga", texto: "gate de bloqueio: anotado antes de virar registro", arquivadaEm: "2026-10-28T10:00:00Z", atualizadaEm: "2026-10-28T10:00:00Z" }),
  ] },
  tarefas: [
    T.normalizarTarefa({ id: "t1", titulo: "Onboarding do squad de Pagamentos na Ferramenta X", categoriaId: "c1", status: "em_andamento", descricao: "Levar o squad a usar o scan na pipeline.", criadaEm: "2026-10-20T10:00:00Z", registros: [
      { id: "m0", tipo: "marco", data: "2026-10-20", titulo: "Tarefa criada" },
      { id: "r1", tipo: "reuniao", data: "2026-10-27", titulo: "Kickoff com o squad", participantes: ["Marina", "Bruno"], resumoIA: "Alinhamos o escopo.", decisoes: "Gate de bloqueio só para severidade crítica no início", proximosPassos: [{ id: "p1", texto: "Liberar acesso ao repositório", feito: false, responsavel: "Marina" }], anotacoes: "gate só crítica no começo. ![print](arquivos/2026/abc-print.png)" },
      { id: "r2", tipo: "reuniao", data: "2026-11-10", titulo: "Revisão dos resultados", decisoes: "Triagem conjunta dos críticos antes de ligar o gate", impedimentos: "Sem acesso ao painel", anotacoes: longo + "\n\nNo fim combinamos a triagem dos críticos para quinta." },
      { id: "r3", tipo: "nota", data: "2026-11-11", titulo: "Como funciona a triagem", anotacoes: "Explicação do processo de triagem.", referencia: true },
    ] }),
    T.normalizarTarefa({ id: "t2", titulo: "Trilha de formação", categoriaId: "c2", status: "a_fazer", criadaEm: "2026-11-01T10:00:00Z", registros: [
      { id: "r4", tipo: "atividade", data: "2026-11-05", titulo: "Roteiro do encontro", anotacoes: "Falar de gate de qualidade no encontro 2." },
    ] }),
  ],
};
const buscar = (q, o = {}) => P.buscarFontes(q, dados, { hoje: HOJE, ...o });
const chaves = (r) => r.fontes.map((f) => f.chave);

teste("termos: sem acento, sem palavras vazias, sem repetição, e plural acha singular", () => {
  assert.deepEqual(P.termosDaPergunta("O que ficou decidido sobre o Gate de bloqueio?").map((t) => t.palavra), ["decidido", "gate", "bloqueio"]);
  const rad = (s) => P.termosDaPergunta(s).map((t) => t.radical);
  assert.deepEqual(rad("exceções"), rad("exceção"));
  assert.deepEqual(rad("squads"), rad("squad"));
  assert.deepEqual(rad("críticos criticos CRÍTICO"), ["critico"]);
  assert.deepEqual(P.termosDaPergunta("o que e de para com?"), []);
  assert.equal(P.termosDaPergunta(Array.from({ length: 50 }, (_, i) => `palavra${i}`).join(" ")).length, 16);
  assert.deepEqual(P.termosDaPergunta(null), []);
});

teste("busca: acha o registro certo, numera as fontes e ordena pela relevância", () => {
  const r = buscar("O que ficou decidido sobre o gate de bloqueio?");
  assert.deepEqual(r.termos, ["decidido", "gate", "bloqueio"]);
  assert.equal(r.fontes[0].chave, "registro:t1:r1"); // tem "gate" e "bloqueio", e tem decisões (a pergunta é sobre o que foi decidido)
  assert.deepEqual(r.fontes.map((f) => f.rotulo), r.fontes.map((_, i) => `F${i + 1}`));
  assert.equal(r.fontes[0].rota, "/tarefas/t1?r=r1");
  assert.equal(r.fontes[0].interno, "nexo:tarefa/t1");
  assert.match(r.fontes[0].contexto, /tarefa "Onboarding do squad de Pagamentos na Ferramenta X", categoria "Ferramenta X"/);
  assert.match(r.fontes[0].trecho, /Decisões: Gate de bloqueio só para severidade crítica/);
  assert.match(r.fontes[0].trecho, /Liberar acesso ao repositório \(Marina\) \[em aberto\]/);
  assert.ok(!r.fontes[0].trecho.includes("arquivos/")); // o endereço da imagem não vai para o prompt
  // a folha aberta entra; a arquivada vale menos que o registro que saiu dela
  assert.ok(chaves(r).includes("nota:n1"));
  const pos = (k) => chaves(r).indexOf(k);
  assert.ok(pos("nota:n2") === -1 || pos("nota:n2") > pos("registro:t1:r1"));
  // marco sem texto ("Tarefa criada") nunca é fonte
  assert.ok(!chaves(buscar("tarefa criada onboarding")).includes("registro:t1:m0"));
  // a mesma pergunta dá sempre a mesma lista (os rótulos F1, F2 dependem disso)
  assert.deepEqual(chaves(buscar("O que ficou decidido sobre o gate de bloqueio?")), chaves(r));
});

teste("busca: página de conhecimento, pessoa e link também respondem", () => {
  assert.equal(buscar("como funciona a exceção de vulnerabilidade?").fontes[0].chave, "pagina:pg1");
  assert.equal(buscar("exceções").fontes[0].chave, "pagina:pg1"); // plural acha o singular
  const quem = buscar("quem pode ajudar com falso positivo?");
  assert.equal(quem.fontes[0].chave, "pessoa:pe2");
  // o rótulo que o app acrescenta ("Pode ajudar com:") não conta: senão toda pessoa apareceria
  assert.ok(!chaves(quem).includes("pessoa:pe3"));
  assert.equal(quem.fontes[0].rota, "/pessoas?p=Bruno%20Lima");
  assert.ok(chaves(buscar("guia de integração")).includes("link:l1"));
  // registro marcado como referência do assunto sobe
  assert.equal(buscar("triagem processo").fontes[0].chave, "registro:t1:r3");
});

teste("busca: filtro por categoria e pergunta sem palavra útil", () => {
  const todos = chaves(buscar("gate"));
  assert.ok(todos.includes("registro:t2:r4") && todos.includes("registro:t1:r1"));
  const soC2 = chaves(buscar("gate", { categoriaId: "c2" }));
  assert.deepEqual(soC2, ["registro:t2:r4"]);
  const soC1 = chaves(buscar("marina acessos", { categoriaId: "c1" }));
  assert.ok(soC1.includes("pessoa:pe1") && !soC1.some((k) => k.startsWith("nota:")));
  assert.deepEqual(buscar("o que e como?"), { termos: [], fontes: [], deFora: 0 });
  assert.deepEqual(buscar("palavrainexistente").fontes, []);
});

teste("recorte e tamanho: texto longo vira as linhas que importam, e o total respeita o limite", () => {
  const r = buscar("triagem dos críticos quinta");
  const f = r.fontes.find((x) => x.chave === "registro:t1:r2");
  assert.ok(f.trecho.length < longo.length / 2, "o trecho deveria ser um recorte");
  assert.match(f.trecho, /combinamos a triagem dos críticos para quinta/);
  assert.match(f.trecho, /\[\.\.\.\]/);
  const curto = buscar("gate cronograma triagem acesso squad", { limite: 900, maxFontes: 20 });
  assert.ok(curto.fontes.reduce((n, x) => n + x.trecho.length, 0) <= 900);
  assert.ok(curto.deFora > 0);
  const um = buscar("gate cronograma triagem acesso squad", { maxFontes: 1 });
  assert.equal(um.fontes.length, 1);
  assert.ok(um.deFora > 0);
});

teste("prompt: pergunta, regras de citação e fontes numeradas", () => {
  const r = buscar("O que ficou decidido sobre o gate de bloqueio?");
  const p = P.promptPergunta("  O que ficou decidido sobre o gate de bloqueio?  ", r.fontes.slice(0, 2), HOJE);
  assert.match(p, /^Vou te fazer uma pergunta sobre o meu trabalho\. Responda usando SOMENTE as fontes abaixo/);
  assert.match(p, /\nPergunta: O que ficou decidido sobre o gate de bloqueio\?\n/);
  assert.match(p, /cite de onde ela veio entre colchetes, assim: \[F2\]/);
  assert.match(p, /Hoje é 14\/11\/26\./);
  assert.match(p, /\n\[F1\] Reunião: Kickoff com o squad \(27\/10\/26\), tarefa "Onboarding/);
  assert.ok(p.includes("[F2] ") && !p.includes("[F3] "));
  assert.ok(!/\n\n\n/.test(p));
});

const citaveis = [
  { rotulo: "F1", tipo: "registro", chave: "registro:t1:r1", titulo: "Reunião: Kickoff [1]", contexto: 'tarefa "Onboarding"', data: "2026-10-27", rota: "/tarefas/t1?r=r1", interno: "nexo:tarefa/t1" },
  { rotulo: "F2", tipo: "pagina", chave: "pagina:pg1", titulo: "Página: Processo", contexto: "", data: null, rota: "/paginas?p=pg1", interno: "nexo:pagina/pg1" },
  { rotulo: "F3", tipo: "nota", chave: "nota:n1", titulo: "Folha", contexto: "", data: null, rota: "/notas?n=n1", interno: null },
];

teste("resposta: as citações viram links calculados das fontes, nunca do texto colado", () => {
  const resp = "O gate é só crítico [F1]. Ver processo [F2][F3] e [F1, F2]; também [ F1 e F3 ]. Fonte que não existe [F9]. Link pronto [F1](https://exemplo.local/x) e [F2](javascript:alert(1)).";
  assert.deepEqual(P.fontesCitadas(resp), ["F1", "F2", "F3", "F9"]);
  const ligada = P.ligarFontes(resp, citaveis);
  assert.match(ligada, /crítico \[F1\]\(nexo:tarefa\/t1\)\./);
  assert.match(ligada, /processo \[F2\]\(nexo:pagina\/pg1\)\\\[F3\\\] e \[F1\]\(nexo:tarefa\/t1\) \[F2\]\(nexo:pagina\/pg1\);/);
  assert.match(ligada, /também \[F1\]\(nexo:tarefa\/t1\) \\\[F3\\\]\./);
  assert.match(ligada, /não existe \\\[F9\\\]\./);
  // o que já veio como link no texto colado não é tocado aqui, e o leitor de Markdown barra o que não presta
  assert.ok(ligada.includes("[F1](https://exemplo.local/x)") && ligada.includes("[F2](javascript:alert(1))"));
  const inlines = R.analisarMarkdown(ligada).flatMap((b) => b.f ?? []);
  assert.ok(!inlines.some((i) => i.t === "link" && /^javascript:/i.test(i.href ?? "")));
  assert.deepEqual([...new Set(inlines.filter((i) => i.t === "interno").map((i) => i.rota))], ["/tarefas/t1", "/paginas?p=pg1"]);
  assert.equal(P.ligarFontes(null, citaveis), "");
  assert.deepEqual(P.fontesCitadas(""), []);
});

teste("guardar como página: a pergunta vira o título e as fontes citadas vão ligadas no fim", () => {
  const pg = P.paginaDaResposta("  O que ficou\n decidido?  ", "Só crítico [F1]. Sem fonte [F3].", citaveis, HOJE);
  assert.equal(pg.titulo, "O que ficou decidido?");
  assert.match(pg.texto, /^Só crítico \[F1\]\(nexo:tarefa\/t1\)\. Sem fonte \\\[F3\\\]\.\n\n---\n\n\*\*Fontes\*\* \(resposta do Copilot à pergunta feita em 14\/11\/26/);
  assert.match(pg.texto, /- \*\*F1\*\*: \[Reunião: Kickoff \\\[1\\\] \(27\/10\/26\)\]\(nexo:tarefa\/t1\), tarefa "Onboarding"/); // colchete do título não quebra o link
  assert.match(pg.texto, /- \*\*F3\*\*: Folha\n/);
  assert.ok(!pg.texto.includes("**F2**")); // não foi citada
  // o que veio com cara de HTML fica como texto (menos dentro de bloco de código, onde "<" é só um caractere)
  const html = P.paginaDaResposta("x", "a <img src=x onerror=alert(1)> b </script> 2 < 3\n\n```\n<div>\n```\n\nfim <b>", citaveis, HOJE).texto;
  assert.match(html, /^a &lt;img src=x onerror=alert\(1\)> b &lt;\/script> 2 < 3\n\n```\n<div>\n```\n\nfim &lt;b>/);
  // resposta sem citação nenhuma: lista todas as fontes que foram para o prompt
  assert.equal((P.paginaDaResposta("x", "sem citar", citaveis, HOJE).texto.match(/^- \*\*F\d\*\*/gm) ?? []).length, 3);
});

teste("o que vem do navegador é entrada não confiável: forma conferida, rota nunca guardada", () => {
  for (const mau of [null, 7, "x", [], undefined]) assert.deepEqual(P.normalizarConsulta(mau), P.CONSULTA_VAZIA);
  const c = P.normalizarConsulta({
    pergunta: "p".repeat(5000), categoriaId: "../x", tamanho: "constructor", fora: ["registro:t1:r1", "registro:../x:y", 5, "pagina:pg1", "config:x"], resposta: { a: 1 }, perguntaCopiada: 9,
    copiadas: [
      { rotulo: "F1", chave: "registro:t1:r1", titulo: "ok", contexto: 3, data: "ontem", rota: "javascript:alert(1)", interno: "https://exemplo.local" },
      { rotulo: "F99x", chave: "pagina:pg1" }, { rotulo: "F2", chave: "pagina:../../etc" }, null, "x", { rotulo: "F3", chave: "pessoa:pe2", titulo: "Bruno", data: "2026-11-01" },
    ],
  });
  assert.equal(c.pergunta.length, 2000);
  assert.deepEqual([c.categoriaId, c.tamanho, c.resposta, c.perguntaCopiada], ["", "medio", "", ""]);
  assert.deepEqual(c.fora, ["registro:t1:r1", "pagina:pg1"]);
  assert.deepEqual(c.copiadas, [
    { rotulo: "F1", chave: "registro:t1:r1", titulo: "ok", contexto: "", data: null },
    { rotulo: "F3", chave: "pessoa:pe2", titulo: "Bruno", contexto: "", data: "2026-11-01" },
  ]);
  // o destino é recalculado dos dados de agora
  const cit = P.citadasDaConsulta({ ...c, copiadas: [...c.copiadas, { rotulo: "F4", chave: "tarefa:sumiu", titulo: "x", contexto: "", data: null }] }, dados);
  assert.deepEqual(cit.map((f) => [f.rotulo, f.tipo, f.rota, f.interno]), [
    ["F1", "registro", "/tarefas/t1?r=r1", "nexo:tarefa/t1"],
    ["F3", "pessoa", "/pessoas?p=Bruno%20Lima", "nexo:pessoa/Bruno%20Lima"],
    ["F4", "tarefa", "", null],
  ]);
  assert.deepEqual(P.destinoDaChave("registro:t1:apagado", dados), { tipo: "registro", rota: "/tarefas/t1", interno: "nexo:tarefa/t1" });
  assert.deepEqual(P.destinoDaChave("nota:n1", dados), { tipo: "nota", rota: "/notas?n=n1", interno: null });
  for (const mau of ["", "tarefa:", "tarefa:a/b", "x:t1", "registro:t1", "pagina:pg1:extra", "pessoa:nao-existe"]) assert.equal(P.destinoDaChave(mau, dados), null, mau);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
