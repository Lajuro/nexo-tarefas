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
const H = await import("../lib/tela-hoje.ts");
const P = await import("../lib/personalizacao.ts");
const Pf = await import("../lib/perfis.ts");

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
  dataset: { fonte: "geist", movimento: "completo", lateral: "solida", fundo: "liso", neutros: "frio", escuro: "padrao" },
};

// ---------- aparência ----------

teste("aparência: lixo vira o padrão", () => {
  for (const x of [null, undefined, 7, "texto", [], { acento: 3, cantos: {}, fonte: null, movimento: [], lateral: true, fundo: 1 }])
    assert.deepEqual(A.normalizarAparencia(x), A.APARENCIA_PADRAO);
});

teste("aparência: valores válidos são mantidos e os desconhecidos caem no padrão", () => {
  const a = A.normalizarAparencia({ acento: "verde", cantos: "redondos", fonte: "sistema", movimento: "sutil", lateral: "vidro", fundo: "aurora", extra: "x" });
  // o que a 3.12 guardou continua valendo; os campos novos (3.13) entram com o padrão
  assert.deepEqual(a, { acento: "verde", matiz: 275, intensidade: 1, neutros: "frio", escuro: "padrao", cantos: "redondos", fonte: "sistema", movimento: "sutil", lateral: "vidro", fundo: "aurora" });
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
  assert.deepEqual(r.dataset, { fonte: "serifada", movimento: "nenhum", lateral: "colorida", fundo: "pontilhado", neutros: "frio", escuro: "padrao" });
  const novo = rodarScript(JSON.stringify({ neutros: "quente", escuro: "profundo", fundo: "grade" }));
  assert.deepEqual(novo.dataset, { fonte: "geist", movimento: "completo", lateral: "solida", fundo: "grade", neutros: "quente", escuro: "profundo" });
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
    JSON.stringify({ neutros: "constructor", escuro: "__proto__", matiz: "275;}body{display:none", intensidade: "1)</style>" }),
    JSON.stringify({ neutros: ["quente"], escuro: { profundo: true }, matiz: {}, intensidade: [] }),
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

// ---------- cor livre, tons neutros, escuro profundo e temas prontos (3.13) ----------

const aplicar = (a) => {
  const estilo = {};
  const dataset = {};
  A.aplicarAparencia(a, { style: { setProperty: (k, v) => (estilo[k] = String(v)) }, dataset });
  return { estilo, dataset };
};

teste("cor livre: a tabela de teto tem um valor por dezena de matiz, sempre entre 0 e 1", () => {
  assert.equal(A.TETO_DE_CROMA.length, 36);
  for (const v of A.TETO_DE_CROMA) assert.ok(typeof v === "number" && v > 0.2 && v <= 1, String(v));
  // o amarelo e o ciano aguentam bem menos saturação que o roxo
  assert.ok(A.tetoDeCroma(100) < A.tetoDeCroma(305) && A.tetoDeCroma(200) < A.tetoDeCroma(305));
  // perto do fim da roda, o vizinho é o matiz 0
  assert.equal(A.tetoDeCroma(355), Math.min(A.TETO_DE_CROMA[35], A.TETO_DE_CROMA[0]));
});

teste("cor livre: o croma nunca passa do teto do matiz e a intensidade 0 dá quase cinza", () => {
  for (let matiz = 0; matiz < 360; matiz += 7) {
    const cheia = A.corDeDestaque({ acento: "livre", matiz, intensidade: 1 });
    assert.equal(cheia.matiz, matiz);
    assert.ok(cheia.croma <= A.tetoDeCroma(matiz) + 1e-9 && cheia.croma <= 1, `${matiz}: ${cheia.croma}`);
    assert.equal(A.corDeDestaque({ acento: "livre", matiz, intensidade: 0 }).croma, 0);
  }
  // com uma cor da lista, matiz e intensidade guardados não contam
  assert.deepEqual(A.corDeDestaque({ acento: "verde", matiz: 10, intensidade: 0.1 }), { matiz: 155, croma: 0.72 });
});

teste("cor livre: números fora da faixa, quebrados ou que não são número caem na faixa ou no padrão", () => {
  const n = (x) => A.normalizarAparencia({ acento: "livre", ...x });
  assert.equal(n({ matiz: 400 }).matiz, 359);
  assert.equal(n({ matiz: -30 }).matiz, 0);
  assert.equal(n({ matiz: 120.6 }).matiz, 121);
  assert.equal(n({ intensidade: 7 }).intensidade, 1);
  assert.equal(n({ intensidade: -1 }).intensidade, 0);
  assert.equal(n({ intensidade: 0.456 }).intensidade, 0.46);
  for (const ruim of ["120", null, NaN, Infinity, {}, [], true]) {
    assert.equal(n({ matiz: ruim }).matiz, 275, String(ruim));
    assert.equal(n({ intensidade: ruim }).intensidade, 1, String(ruim));
  }
});

teste("script do head: a cor livre dá o mesmo resultado de aplicarAparencia(), com qualquer número", () => {
  for (let matiz = 0; matiz < 360; matiz += 13)
    for (const intensidade of [0, 0.33, 0.5, 1]) {
      const a = A.normalizarAparencia({ acento: "livre", matiz, intensidade, neutros: "destaque", escuro: "profundo", fundo: "grade" });
      assert.deepEqual(rodarScript(JSON.stringify(a)), aplicar(a), `${matiz} ${intensidade}`);
    }
  // o script recebe o que está no localStorage, não o que o app normalizou: tem que limitar sozinho
  for (const [matiz, intensidade] of [[1e9, 50], [-5, -5], [359.7, 0.999], ["90", "1"], [null, undefined]]) {
    const bruto = { acento: "livre", matiz, intensidade };
    const r = rodarScript(JSON.stringify(bruto));
    assert.deepEqual(r, aplicar(A.normalizarAparencia(bruto)), JSON.stringify(bruto));
    assert.ok(/^\d+$/.test(r.estilo["--matiz"]) && /^\d+(\.\d+)?$/.test(r.estilo["--croma"]) && Number(r.estilo["--croma"]) <= 1, JSON.stringify(r.estilo));
  }
});

teste("temas prontos: ids únicos, visual válido e reconhecidos depois de aplicados", () => {
  const ids = new Set();
  for (const t of A.TEMAS_PRONTOS) {
    assert.ok(/^[a-z-]+$/.test(t.id) && !ids.has(t.id), t.id);
    ids.add(t.id);
    assert.ok(t.tema === undefined || t.tema === "claro" || t.tema === "escuro", t.id);
    // o tema não mexe no movimento e só usa valores das listas fechadas
    assert.ok(!("movimento" in t.visual), t.id);
    const aplicado = A.normalizarAparencia({ ...A.APARENCIA_PADRAO, movimento: "sutil", ...t.visual });
    assert.deepEqual(aplicado, { ...t.visual, movimento: "sutil" }, t.id);
    for (const escuro of [false, true]) {
      const achado = A.temaProntoAtual(aplicado, escuro);
      if (!t.tema || (t.tema === "escuro") === escuro) assert.equal(achado?.id, t.id, `${t.id} ${escuro}`);
      else assert.notEqual(achado?.id, t.id, `${t.id} ${escuro}`);
    }
  }
  assert.equal(A.TEMAS_PRONTOS[0].id, "nexo");
  assert.equal(A.temaProntoAtual(A.APARENCIA_PADRAO, false)?.id, "nexo");
  // um ajuste à mão sai de qualquer tema pronto
  assert.equal(A.temaProntoAtual({ ...A.APARENCIA_PADRAO, cantos: "redondos" }, false), null);
  // a cor livre que sobrou guardada não impede reconhecer um tema que usa cor da lista
  assert.equal(A.temaProntoAtual({ ...A.APARENCIA_PADRAO, matiz: 40, intensidade: 0.2 }, false)?.id, "nexo");
});

// ---------- tela Hoje sob medida (3.13) ----------

teste("tela Hoje: lixo vira o padrão e nada some sem ser pedido", () => {
  for (const x of [null, undefined, 3, "x", [], { ocultos: "precisa", laterais: {}, primeiro: 1, nome: {} }]) assert.deepEqual(H.normalizarTelaHoje(x), H.TELA_HOJE_PADRAO);
  assert.deepEqual(H.TELA_HOJE_PADRAO.ocultos, []);
});

teste("tela Hoje: só blocos conhecidos, sem repetir, e os painéis que faltam voltam no fim", () => {
  const t = H.normalizarTelaHoje({ ocultos: ["semana", "semana", "constructor", 7, "foco"], laterais: ["bloqueadas", "nada", "rotina", "bloqueadas"], primeiro: "foco" });
  assert.deepEqual(t.ocultos, ["semana", "foco"]);
  assert.deepEqual(t.laterais, ["bloqueadas", "rotina", "progresso", "aguardando"]);
  assert.equal(t.primeiro, "foco");
  assert.equal(H.normalizarTelaHoje({ primeiro: "__proto__" }).primeiro, "auto");
  for (const b of H.BLOCOS_HOJE) assert.ok(H.NOME_BLOCO_HOJE[b].nome && H.NOME_BLOCO_HOJE[b].descricao, b);
});

teste("tela Hoje: o nome da saudação é uma linha curta de texto", () => {
  assert.equal(H.nomeDeSaudacao("  Ana   Clara \n"), "Ana Clara");
  assert.equal(H.nomeDeSaudacao("a\tb\rc\u2028d"), "a b c d");
  assert.equal(H.nomeDeSaudacao("x".repeat(200)).length, H.TAMANHO_DO_NOME);
  assert.equal(H.nomeDeSaudacao("<b>Ana</b>"), "<b>Ana</b>"); // é texto: a tela desenha como texto, não como marcação
  for (const ruim of [null, 7, {}, ["Ana"]]) assert.equal(H.nomeDeSaudacao(ruim), "");
});

// ---------- levar a personalização para outro computador (3.13) ----------

teste("personalização: o que é copiado volta igual ao ser colado", () => {
  const p = {
    tema: "escuro",
    aparencia: A.normalizarAparencia({ acento: "livre", matiz: 40, intensidade: 0.5, neutros: "quente", escuro: "profundo", fundo: "grade" }),
    moldura: M.normalizarMoldura({ largura: 300, ocultos: ["/links"], ferramentasOcultas: ["busca"], acompanharSeparado: true }),
    hoje: H.normalizarTelaHoje({ ocultos: ["semana"], laterais: ["progresso"], primeiro: "foco", nome: "Ana" }),
  };
  const texto = P.textoDaPersonalizacao(p);
  assert.ok(texto.length < 3000, String(texto.length));
  const lido = P.lerPersonalizacao(texto);
  assert.ok(lido.ok);
  assert.deepEqual(lido.valor, p);
  // com conversa em volta (colado de um e-mail ou de um chat) também serve
  assert.deepEqual(P.lerPersonalizacao(`segue o código:\n${texto}\nabraço`).valor, p);
});

teste("personalização v2 (3.20): os perfis próprios e a tela inicial vão junto, sem a memória; o código v1 continua valendo", () => {
  const base = {
    tema: "claro", aparencia: A.normalizarAparencia({}), moldura: M.normalizarMoldura({ ocultos: ["/links"] }), hoje: H.normalizarTelaHoje({ nome: "Ana" }),
  };
  const proprio = { id: "ppmeu00001", nome: "Plantão", base: "foco", arranjo: Pf.normalizarArranjo({ inicio: "/pendencias", moldura: { ocultos: ["/notas"] } }) };
  const texto = P.textoDaPersonalizacao({ ...base, perfis: { ativo: "ppmeu00001", proprios: [proprio], memoria: { foco: proprio.arranjo } }, inicio: "/pendencias", lateralRecolhida: true });
  const bruto = JSON.parse(texto);
  assert.equal(bruto.v, 2);
  assert.equal("memoria" in bruto.perfis, false, "a memória de cada perfil é só deste navegador");
  const lido = P.lerPersonalizacao(texto);
  assert.ok(lido.ok);
  assert.deepEqual(lido.valor, { ...base, perfis: { ativo: "ppmeu00001", proprios: [proprio] }, inicio: "/pendencias", lateralRecolhida: true });
  // v1 (de antes dos perfis): lido como sempre, sem mexer nos perfis de quem cola
  const v1 = P.lerPersonalizacao(P.textoDaPersonalizacao(base));
  assert.equal(JSON.parse(P.textoDaPersonalizacao(base)).v, 1);
  assert.deepEqual(v1.valor, base);
  assert.equal("perfis" in v1.valor, false);
  // perfis hostis dentro do código passam pelo normalizador: id ruim fica de fora, ativo que não existe vira o Completo, início fora da lista vira Hoje
  const hostil = P.lerPersonalizacao(JSON.stringify({ nexo: "personalizacao", v: 2, perfis: { ativo: "../x", proprios: [{ id: "../x", nome: "Ruim" }, { id: "ppbom00001", nome: "<b>Bom</b>" }], memoria: { foco: {} } }, inicio: "https://exemplo.invalido" }));
  assert.ok(hostil.ok);
  assert.equal(hostil.valor.perfis.ativo, "completo");
  assert.deepEqual(hostil.valor.perfis.proprios.map((p) => p.id), ["ppbom00001"]);
  assert.equal(hostil.valor.inicio, "/");
  assert.equal(hostil.valor.lateralRecolhida, false);
});

teste("personalização: texto que não é código, cortado ou hostil é recusado ou vira o padrão", () => {
  for (const ruim of ["", "   ", "oi", "{", '{"nexo":"outra coisa"}', "[1,2,3]", '{"aparencia":{}}', "x".repeat(P.TAMANHO_MAXIMO + 1)]) {
    const r = P.lerPersonalizacao(ruim);
    assert.equal(r.ok, false, ruim.slice(0, 30));
    assert.ok(r.erro.length > 10);
  }
  for (const naoTexto of [null, undefined, 7, {}]) assert.equal(P.lerPersonalizacao(naoTexto).ok, false);
  const hostil = P.lerPersonalizacao(JSON.stringify({
    nexo: "personalizacao", v: 99, tema: "<script>", __proto__: { tema: "escuro" },
    aparencia: { acento: "constructor", matiz: "1;}", neutros: ["x"], cantos: "</style>" },
    moldura: { largura: 1e9, secoes: ["x"], ferramentasOcultas: ["constructor"] },
    hoje: { ocultos: ["__proto__"], nome: "a".repeat(500) },
    extra: { caminho: "../../etc" },
  }));
  assert.ok(hostil.ok);
  assert.equal(hostil.valor.tema, "sistema");
  assert.deepEqual(hostil.valor.aparencia, A.APARENCIA_PADRAO);
  assert.equal(hostil.valor.moldura.largura, M.LARGURA_LATERAL.maxima);
  assert.deepEqual(hostil.valor.moldura.ferramentasOcultas, []);
  assert.deepEqual(hostil.valor.hoje.ocultos, []);
  assert.equal(hostil.valor.hoje.nome.length, H.TAMANHO_DO_NOME);
  assert.deepEqual(Object.keys(hostil.valor).sort(), ["aparencia", "hoje", "moldura", "tema"]);
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

teste("moldura: telas de acompanhar juntas por padrão; separadas só com true de verdade (3.9)", () => {
  assert.equal(M.MOLDURA_PADRAO.acompanharSeparado, false);
  assert.equal(M.normalizarMoldura({}).acompanharSeparado, false);
  assert.equal(M.normalizarMoldura({ acompanharSeparado: true }).acompanharSeparado, true);
  for (const x of ["true", 1, "sim", {}, null]) assert.equal(M.normalizarMoldura({ acompanharSeparado: x }).acompanharSeparado, false);
});

teste("moldura: o que a 3.8 guardou continua igual ao abrir na 3.9", () => {
  const da38 = {
    largura: 280, ordem: ["/notas", "/pendencias", "/conquistas", "/radar"], ocultos: ["/relatorios", "/links"], titulosDeGrupo: false, contadores: true,
    secoes: ["recentes", "foco", "fixadas", "assuntos"], secoesOcultas: ["fixadas"], secoesFechadas: ["assuntos"], ferramentasOcultas: ["telaCheia"], barraStatus: false,
  };
  const m = M.normalizarMoldura(da38);
  assert.deepEqual({ ...m, acompanharSeparado: undefined }, { ...da38, acompanharSeparado: undefined });
  assert.equal(m.acompanharSeparado, false);
  // mudar uma coisa depois não apaga as outras
  const depois = M.normalizarMoldura({ ...m, acompanharSeparado: true, ocultos: [...m.ocultos, "/acompanhar"] });
  assert.deepEqual(depois.ordem, da38.ordem);
  assert.deepEqual(depois.ocultos, ["/relatorios", "/links", "/acompanhar"]);
  assert.deepEqual(depois.ferramentasOcultas, ["telaCheia"]);
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
