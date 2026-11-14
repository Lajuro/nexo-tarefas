// Testes do texto rico (lib/texto-rico.ts): o leitor que transforma Markdown na árvore que a tela desenha.
// Uso: node testes/texto-rico.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/texto-rico.test.mjs)
// O texto pode ter sido colado de qualquer lugar (Copilot, e-mail, página): é entrada não confiável.
// O que estes testes garantem: HTML nunca é interpretado, imagem só de anexo da pasta de dados,
// link só http/https/mailto, e o texto antigo (texto puro) continua aparecendo como era.

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

const R = await import("../lib/texto-rico.ts");
const P = await import("../lib/prompts.ts");
const MD = await import("../lib/markdown.ts");
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

/** Todos os nós da árvore, em lista, para procurar o que não devia existir. */
function achatar(blocos) {
  const out = [];
  const inl = (f) => f.forEach((i) => { out.push(i); if (i.f) inl(i.f); });
  const blo = (bs) => bs.forEach((b) => {
    out.push(b);
    if (b.t === "paragrafo" || b.t === "titulo") inl(b.f);
    if (b.t === "lista") b.itens.forEach((it) => blo(it.f));
    if (b.t === "citacao") blo(b.f);
    if (b.t === "tabela") { b.cabecalho.forEach((c) => inl(c.f)); b.linhas.forEach((l) => l.forEach(inl)); }
  });
  blo(blocos);
  return out;
}
const nos = (md) => achatar(R.analisarMarkdown(md));
const tipos = (md) => R.analisarMarkdown(md).map((b) => b.t);

// ---------- formatação ----------

teste("blocos básicos do Markdown", () => {
  const md = "# Título\n\nparágrafo com **negrito**, *itálico*, ~~riscado~~ e `código`\n\n- a\n- b\n\n1. um\n2. dois\n\n> citação\n\n```bash\nnpm run build\n```\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |";
  assert.deepEqual(tipos(md), ["titulo", "paragrafo", "lista", "lista", "citacao", "codigo", "divisor", "tabela"]);
  const t = nos(md).map((n) => n.t);
  for (const esperado of ["negrito", "italico", "riscado", "codigo"]) assert.ok(t.includes(esperado), esperado);
});

teste("lista de tarefas guarda o que está feito", () => {
  const [lista] = R.analisarMarkdown("- [ ] abrir chamado\n- [x] pedir acesso");
  assert.equal(lista.t, "lista");
  assert.deepEqual(lista.itens.map((i) => [i.tarefa, i.feito]), [[true, false], [true, true]]);
  assert.equal(R.paraTextoPlano("- [ ] abrir chamado\n- [x] pedir acesso"), "abrir chamado\npedir acesso");
});

teste("texto antigo (texto puro) continua igual: quebra simples é quebra", () => {
  const b = R.analisarMarkdown("linha um\nlinha dois\n\noutro parágrafo");
  assert.deepEqual(b.map((x) => x.t), ["paragrafo", "paragrafo"]);
  assert.deepEqual(b[0].f.map((i) => i.t), ["texto", "quebra", "texto"]);
  assert.equal(R.paraTextoPlano("linha um\nlinha dois"), "linha um linha dois");
});

teste("texto vazio e lixo não quebram", () => {
  for (const x of ["", "   \n  ", null, undefined]) assert.deepEqual(R.analisarMarkdown(x), []);
  assert.ok(R.analisarMarkdown("x".repeat(400_000)).length >= 1);
  // aninhamento absurdo não estoura a pilha
  assert.ok(Array.isArray(R.analisarMarkdown(Array.from({ length: 200 }, (_, i) => `${"  ".repeat(i)}- n${i}`).join("\n"))));
  assert.ok(Array.isArray(R.analisarMarkdown("> ".repeat(300) + "fundo")));
});

teste("o que o editor grava volta a ser lido como o usuário escreveu", () => {
  // o editor escreve "<" como "&lt;" e põe barra antes de * _ [ ] para não virarem formatação
  assert.equal(R.paraTextoPlano("prazo &lt; 30 dias &amp; custo, 2 \\* 3 e \\[colchete\\]"), "prazo < 30 dias & custo, 2 * 3 e [colchete]");
  assert.equal(R.decodificarEntidades("&lt;&gt;&amp;&quot;&#39;&#x41;&nbsp;&naoexiste;"), "<>&\"'A\u00a0&naoexiste;");
});

// ---------- segurança ----------

teste("HTML nunca é interpretado: vira texto", () => {
  const md = 'antes <b>negrito</b> <img src="https://exemplo.invalid/p.png" onerror="alert(1)">\n\n<script>alert(1)</script>\n\n<iframe src="https://exemplo.invalid"></iframe>';
  const todos = nos(md);
  assert.ok(!todos.some((n) => n.t === "imagem"), "HTML gerou imagem");
  assert.ok(!todos.some((n) => n.t === "link"), "HTML gerou link");
  const texto = todos.filter((n) => n.t === "texto").map((n) => n.v).join(" ");
  assert.ok(texto.includes("<script>") && texto.includes("onerror"), "o HTML devia aparecer como texto");
});

teste("imagem só carrega se for anexo da pasta de dados", () => {
  const ok = nos("![print](arquivos/2026/abc-print.png)").find((n) => n.t === "imagem");
  assert.deepEqual(ok, { t: "imagem", url: "/api/arquivos?p=2026%2Fabc-print.png", alt: "print" });
  const comEspaco = nos("![x](arquivos/2026/abc-Captura%20de%20tela.png)").find((n) => n.t === "imagem");
  assert.equal(comEspaco.url, "/api/arquivos?p=2026%2Fabc-Captura%20de%20tela.png");
  const proibidas = [
    "https://exemplo.invalid/pixel.png", "http://exemplo.invalid/a.png", "//exemplo.invalid/a.png", "data:image/png;base64,AAAA",
    "arquivos/../nexo.json", "arquivos/2026/../../nexo.json", "arquivos/2026/%2e%2e/x.png", "arquivos/2026/a/b.png", "arquivos/x.png",
    "/api/arquivos?p=2026/x.png", "arquivos/2026/x.png?baixar=1", "file:///c:/x.png", "javascript:alert(1)", "arquivos\\\\2026\\\\x.png",
  ];
  for (const src of proibidas) {
    assert.equal(R.urlDaImagem(src), null, src);
    assert.ok(!nos(`![x](${src})`).some((n) => n.t === "imagem"), "virou imagem: " + src);
  }
  // imagem por referência também não escapa
  assert.ok(!nos("![x][r]\n\n[r]: https://exemplo.invalid/pixel.png").some((n) => n.t === "imagem"));
});

teste("imagem barrada aparece como texto (nada some em silêncio)", () => {
  assert.ok(R.paraTextoPlano("veja ![grafico](https://exemplo.invalid/g.png) aqui").includes("https://exemplo.invalid/g.png"));
});

teste("link só com http, https ou mailto", () => {
  for (const h of ["https://exemplo.local/a", "http://exemplo.local", "mailto:ana@exemplo.local", "HTTPS://EXEMPLO.LOCAL"]) assert.equal(R.linkPermitido(h), h);
  for (const h of ["javascript:alert(1)", " javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "vbscript:x", "file:///c:/x", "//exemplo.local", "/api/exportar", "https://exemplo.local/a b", "java\tscript:alert(1)", ""])
    assert.equal(R.linkPermitido(h), null, JSON.stringify(h));
  const links = nos("[ok](https://exemplo.local) [mau](javascript:alert(1)) [mau2](data:text/html,x)").filter((n) => n.t === "link");
  assert.deepEqual(links.map((l) => l.href), ["https://exemplo.local"]);
  // o texto do link proibido continua lá, só sem o endereço
  assert.ok(R.paraTextoPlano("[clique aqui](javascript:alert(1))").includes("clique aqui"));
  // link por referência
  assert.ok(!nos("[x][r]\n\n[r]: javascript:alert(1)").some((n) => n.t === "link"));
});

teste("srcDoAnexo e anexoDoSrc vão e voltam", () => {
  for (const rel of ["2026/abc-print.png", "2026/abc-Captura de tela (1).png", "2025/x-relatório.png"]) {
    const src = R.srcDoAnexo(rel);
    assert.ok(!/\s/.test(src), "endereço com espaço quebra o Markdown: " + src);
    assert.equal(R.anexoDoSrc(src), rel);
  }
  assert.equal(R.anexoDoSrc("%E0%A4%A"), null); // escape inválido
});

// ---------- prompts e espelho ----------

teste("prompt: imagem anexada vira só uma menção", () => {
  assert.equal(P.semImagens("antes ![print da tela](arquivos/2026/a-b.png) depois"), "antes [imagem anexada: print da tela] depois");
  assert.equal(P.semImagens("![](arquivos/2026/a.png)"), "[imagem anexada]");
  assert.equal(P.semImagens("sem imagem ![x](https://exemplo.invalid/a.png)"), "sem imagem ![x](https://exemplo.invalid/a.png)");
});

teste("espelho em Markdown: a imagem aponta para a pasta de anexos ao lado", () => {
  const t = T.normalizarTarefa({ id: "t1", titulo: "X", registros: [{ id: "r1", tipo: "atividade", data: "2026-11-10", titulo: "Evidência", anotacoes: "veja\n\n![print](arquivos/2026/a-print.png)" }] });
  assert.ok(MD.tarefaParaMarkdown(t).includes("![print](../arquivos/2026/a-print.png)"));
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
