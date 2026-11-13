// Testes da personalização: aparência (lib/aparencia.ts) e moldura (lib/moldura.ts).
// Uso: node testes/aparencia.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/aparencia.test.mjs)
// O localStorage é entrada não confiável (qualquer extensão ou aba no mesmo endereço escreve nele):
// estes testes cobrem valores absurdos e, principalmente, o script que roda antes da primeira
// pintura, que só pode aplicar valores das listas fechadas do próprio app.

import assert from "node:assert/strict";
import { register } from "node:module";
import vm from "node:vm";

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

const A = await import("../lib/aparencia.ts");
const M = await import("../lib/moldura.ts");

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

/** Roda o script do <head> num documento de mentira e devolve o que ele aplicou. */
function rodarScript(guardado) {
  const estilo = {};
  const dataset = {};
  const contexto = {
    localStorage: { getItem: (k) => (k === "nexo:aparencia" ? guardado : null) },
    document: { documentElement: { style: { setProperty: (k, v) => (estilo[k] = String(v)) }, dataset } },
  };
  vm.runInNewContext(A.SCRIPT_APARENCIA, contexto);
  return { estilo, dataset };
}
const PADRAO_APLICADO = {
  estilo: { "--matiz": "275", "--croma": "1", "--radius": "0.625rem" },
  dataset: { fonte: "geist", movimento: "completo", lateral: "solida", fundo: "liso" },
};

// ---------- aparência ----------

teste("aparência: lixo vira o padrão", () => {
  for (const x of [null, undefined, 7, "texto", [], { acento: 3, cantos: {}, fonte: null, movimento: [], lateral: true, fundo: 1 }])
    assert.deepEqual(A.normalizarAparencia(x), A.APARENCIA_PADRAO);
});

teste("aparência: valores válidos são mantidos e os desconhecidos caem no padrão", () => {
  const a = A.normalizarAparencia({ acento: "verde", cantos: "redondos", fonte: "sistema", movimento: "sutil", lateral: "vidro", fundo: "aurora", extra: "x" });
  assert.deepEqual(a, { acento: "verde", cantos: "redondos", fonte: "sistema", movimento: "sutil", lateral: "vidro", fundo: "aurora" });
  assert.equal(A.normalizarAparencia({ acento: "neon" }).acento, "indigo");
  assert.equal(A.normalizarAparencia({ cantos: "__proto__" }).cantos, "suaves");
});

teste("aparência: toda cor da lista tem matiz e croma dentro do esperado", () => {
  const ids = new Set();
  for (const c of A.ACENTOS) {
    assert.ok(/^[a-z]+$/.test(c.id) && !ids.has(c.id), c.id);
    ids.add(c.id);
    assert.ok(c.matiz >= 0 && c.matiz <= 360 && c.croma > 0 && c.croma <= 1, c.id);
  }
});

teste("script do head: sem nada guardado aplica o padrão", () => {
  assert.deepEqual(rodarScript(null), PADRAO_APLICADO);
  assert.deepEqual(rodarScript("{}"), PADRAO_APLICADO);
  for (const x of ["null", "[]", '"texto"', "7"]) assert.deepEqual(rodarScript(x), PADRAO_APLICADO);
});

teste("script do head: aplica a escolha guardada", () => {
  const r = rodarScript(JSON.stringify({ acento: "verde", cantos: "retos", fonte: "serifada", movimento: "nenhum", lateral: "colorida", fundo: "pontilhado" }));
  assert.deepEqual(r.estilo, { "--matiz": "155", "--croma": "0.72", "--radius": "0.3rem" });
  assert.deepEqual(r.dataset, { fonte: "serifada", movimento: "nenhum", lateral: "colorida", fundo: "pontilhado" });
});

teste("script do head: o mesmo resultado de aplicarAparencia()", () => {
  for (const acento of A.ACENTOS.map((c) => c.id)) {
    const a = A.normalizarAparencia({ acento, cantos: "redondos", fonte: "sistema", movimento: "sutil", lateral: "vidro", fundo: "aurora" });
    const estilo = {};
    const dataset = {};
    A.aplicarAparencia(a, { style: { setProperty: (k, v) => (estilo[k] = String(v)) }, dataset });
    assert.deepEqual(rodarScript(JSON.stringify(a)), { estilo, dataset });
  }
});

teste("script do head: JSON quebrado, tipos errados e valores hostis nunca passam", () => {
  const hostis = [
    "{não é json",
    "null",
    "[]",
    '"texto"',
    JSON.stringify({ acento: "constructor", cantos: "toString", fonte: "__proto__", movimento: "hasOwnProperty", lateral: "valueOf", fundo: "constructor" }),
    JSON.stringify({ acento: "indigo;background:url(//exemplo.local)", cantos: "0;}</style><script>alert(1)</script>", fonte: "\"><img src=x>", movimento: {}, lateral: 1, fundo: ["liso"] }),
  ];
  for (const h of hostis) {
    const r = rodarScript(h);
    if (h === "{não é json") {
      // JSON ilegível: o script não aplica nada e valem os padrões do CSS
      assert.deepEqual(r, { estilo: {}, dataset: {} }, h);
      continue;
    }
    // nada do que veio do localStorage é aplicado: só o padrão, tirado das listas fechadas
    assert.deepEqual(r, PADRAO_APLICADO, h);
  }
});

teste("script do head: texto fixo, sem fechar a tag e sem chamada externa", () => {
  assert.ok(!/<\/script/i.test(A.SCRIPT_APARENCIA));
  assert.ok(!/https?:|fetch\(|import\(|eval\(|Function\(/.test(A.SCRIPT_APARENCIA));
});

// ---------- moldura ----------

teste("moldura: lixo vira o padrão", () => {
  for (const x of [null, 3, "x", [], { largura: "larga", ordem: 5, ocultos: {}, secoes: "foco", ferramentasOcultas: null }])
    assert.deepEqual(M.normalizarMoldura(x), M.MOLDURA_PADRAO);
});

teste("moldura: largura fica dentro dos limites", () => {
  assert.equal(M.normalizarMoldura({ largura: 10 }).largura, M.LARGURA_LATERAL.minima);
  assert.equal(M.normalizarMoldura({ largura: 99999 }).largura, M.LARGURA_LATERAL.maxima);
  assert.equal(M.normalizarMoldura({ largura: 300.4 }).largura, 300);
  assert.equal(M.normalizarMoldura({ largura: NaN }).largura, M.LARGURA_LATERAL.padrao);
});

teste("moldura: seções desconhecidas saem, repetidas somem e as que faltam voltam no fim", () => {
  const m = M.normalizarMoldura({ secoes: ["assuntos", "inventada", "foco", "assuntos"], secoesOcultas: ["recentes", "x"], secoesFechadas: ["foco", "foco"] });
  assert.deepEqual(m.secoes, ["assuntos", "foco", "fixadas", "recentes"]);
  assert.deepEqual(m.secoesOcultas, ["recentes"]);
  assert.deepEqual(m.secoesFechadas, ["foco"]);
});

teste("moldura: ferramentas escondidas só da lista conhecida", () => {
  assert.deepEqual(M.normalizarMoldura({ ferramentasOcultas: ["agenda", "sino", 4, "ajuda"] }).ferramentasOcultas, ["agenda", "ajuda"]);
});

teste("moldura: listas de texto ignoram o que não é texto e têm tamanho limitado", () => {
  const m = M.normalizarMoldura({ ocultos: ["/links", 3, null, "/links"], ordem: Array.from({ length: 500 }, (_, i) => "/x" + i) });
  assert.deepEqual(m.ocultos, ["/links"]);
  assert.ok(m.ordem.length <= 60);
});

teste("naOrdem: respeita a ordem escolhida e mantém o resto como estava", () => {
  const itens = [{ h: "/a" }, { h: "/b" }, { h: "/c" }, { h: "/d" }];
  const chave = (i) => i.h;
  assert.deepEqual(M.naOrdem(itens, ["/c", "/a"], chave).map(chave), ["/c", "/a", "/b", "/d"]);
  assert.deepEqual(M.naOrdem(itens, [], chave).map(chave), ["/a", "/b", "/c", "/d"]);
  assert.deepEqual(M.naOrdem(itens, ["/z", "/d"], chave).map(chave), ["/d", "/a", "/b", "/c"]);
});

teste("alternarNa: liga e desliga sem repetir", () => {
  assert.deepEqual(M.alternarNa(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(M.alternarNa(["a", "b"], "b", true), ["a", "b"]);
  assert.deepEqual(M.alternarNa(["a", "b"], "a", false), ["b"]);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
