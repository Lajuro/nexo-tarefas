// Testes das peças de apoio da 3.7: comparação de versões das páginas (lib/diff.ts), transcrição dos vídeos
// como fonte do Perguntar (lib/perguntar.ts) e os normalizadores das preferências novas, que leem o
// localStorage (entrada não confiável): visões salvas da lista de tarefas e avisos do Windows.
// Uso: node testes/versoes.test.mjs   (Node 22.18+ importa .ts direto)

import assert from "node:assert/strict";
import { register } from "node:module";

const RAIZ = new URL("../", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
    export async function resolve(especificador, contexto, proximo) {
      try { return await proximo(especificador, contexto); }
      catch (e) {
        if (especificador.startsWith(".") && !/\\.[cm]?[jt]s$/.test(especificador)) return proximo(especificador + ".ts", contexto);
        if (especificador.startsWith("@/")) return proximo(new URL(especificador.slice(2) + (/\\.[cm]?[jt]s$/.test(especificador) ? "" : ".ts"), ${JSON.stringify(RAIZ)}).href, contexto);
        throw e;
      }
    }
    export async function load(url, contexto, proximo) {
      if (url.startsWith("file:") && url.endsWith(".ts")) return proximo(url, { ...contexto, format: "module-typescript" });
      return proximo(url, contexto);
    }`),
);

const Df = await import("../lib/diff.ts");
const P = await import("../lib/perguntar.ts");
const Tr = await import("../lib/transcricao.ts");
const T = await import("../lib/tipos.ts");
const F = await import("../components/tarefas/filtros.ts");
const N = await import("../lib/notificar.ts");

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

// ---------- comparação de versões ----------

teste("diff: texto igual não tem mudança", () => {
  const l = Df.diffDeTexto("a\nb\nc", "a\nb\nc");
  assert.deepEqual(Df.resumoDoDiff(l), { entraram: 0, sairam: 0, iguais: 3 });
});

teste("diff: linha que entrou, linha que saiu e o resto igual", () => {
  const l = Df.diffDeTexto("um\ndois\ntrês\nquatro", "um\ntrês\nquatro\ncinco");
  assert.deepEqual(l.map((x) => `${x.tipo[0]}:${x.texto}`), ["i:um", "s:dois", "i:três", "i:quatro", "e:cinco"]);
});

teste("diff: linha alterada ganha a diferença por palavra", () => {
  const l = Df.diffDeTexto("O prazo é dia 10 de dezembro.", "O prazo é dia 15 de dezembro.");
  const saiu = l.find((x) => x.tipo === "saiu");
  const entrou = l.find((x) => x.tipo === "entrou");
  assert.deepEqual(saiu.palavras.filter((p) => p.tipo === "saiu").map((p) => p.texto), ["10"]);
  assert.deepEqual(entrou.palavras.filter((p) => p.tipo === "entrou").map((p) => p.texto), ["15"]);
  assert.equal(entrou.palavras.map((p) => p.texto).join(""), "O prazo é dia 15 de dezembro.", "as palavras recompõem a linha inteira");
});

teste("diff: trechos iguais longos são recolhidos com contexto", () => {
  const antes = Array.from({ length: 30 }, (_, i) => `linha ${i}`).join("\n");
  const depois = antes.replace("linha 15", "linha QUINZE");
  const m = Df.comTrechosRecolhidos(Df.diffDeTexto(antes, depois), 2);
  const recolhidos = m.filter((x) => x.tipo === "recolhido");
  assert.equal(recolhidos.length, 2);
  assert.equal(recolhidos[0].quantas + recolhidos[1].quantas + m.filter((x) => x.tipo === "igual").length, 29);
});

teste("diff: texto enorme e todo diferente não trava (cai no saiu tudo, entrou tudo)", () => {
  const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join("\n");
  const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join("\n");
  const ini = Date.now();
  const r = Df.resumoDoDiff(Df.diffDeTexto(a, b));
  assert.deepEqual([r.entraram, r.sairam], [3000, 3000]);
  assert.ok(Date.now() - ini < 3000, "demorou demais");
});

// ---------- vídeos no Perguntar ----------

const pagina = T.normalizarPagina({ id: "pg1", titulo: "Treinamento do scan", tipo: "video", video: { transcricao: "2026/abc.vtt" } });
const dados = {
  tarefas: [], categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] }, pessoas: { rev: 0, items: [] }, times: { rev: 0, items: [] },
  notas: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, paginas: { rev: 0, items: [pagina] }, jornada: { rev: 0, items: [] }, avisos: [],
};
const falas = Tr.lerTranscricao("WEBVTT\n\n00:00:05.000 --> 00:00:09.000\n<v Marina>Bom dia, hoje é o treinamento.\n\n00:12:30.000 --> 00:12:40.000\n<v Bruno>O gate bloqueia severidade crítica no pipeline.\n");

teste("perguntar: trecho da transcrição vira fonte de vídeo com o instante", () => {
  const r = P.buscarFontes("gate pipeline", dados, { transcricoes: [{ paginaId: "pg1", falas }] });
  const f = r.fontes.find((x) => x.tipo === "video");
  assert.ok(f, "a fonte de vídeo não apareceu");
  assert.match(f.titulo, /^Vídeo: Treinamento do scan \(0:05\)$/);
  assert.match(f.trecho, /\[12:30\] Bruno: O gate bloqueia/);
  assert.equal(f.rota, "/paginas?p=pg1&t=5");
  assert.equal(P.buscarFontes("gate pipeline", dados).fontes.filter((x) => x.tipo === "video").length, 0, "sem transcrições, sem fonte de vídeo");
});

teste("perguntar: a chave de vídeo leva de volta à página no instante (e só ela)", () => {
  assert.deepEqual(P.destinoDaChave("video:pg1:750", dados)?.rota, "/paginas?p=pg1&t=750");
  assert.equal(P.destinoDaChave("video:pg1:abc", dados), null);
  assert.equal(P.destinoDaChave("video:../x:1", dados), null);
  assert.equal(P.destinoDaChave("video:nao-existe:1", dados), null);
});

// ---------- preferências novas (localStorage) ----------

teste("visões salvas: valores hostis viram padrão ou caem fora", () => {
  const v = F.normalizarVisoes([
    { id: "v1", nome: "Atrasadas", status: "abertas", especial: "atrasadas", ordem: "prazo", visao: "lista", categoria: "c1", texto: "x" },
    { id: "v2", nome: "Torta", status: "<script>", especial: "qualquer", ordem: "constructor", visao: "__proto__", categoria: "../x" },
    { id: "../x", nome: "id ruim" },
    { id: "v3", nome: "" },
    { id: "v1", nome: "repetida" },
    "texto solto", null,
  ]);
  assert.deepEqual(v.map((x) => x.id), ["v1", "v2"]);
  assert.deepEqual([v[1].status, v[1].especial, v[1].ordem, v[1].visao, v[1].categoria], ["abertas", "", "prioridade", "grade", ""]);
  assert.deepEqual(F.normalizarVisoes({ length: 3 }), []);
  assert.equal(F.normalizarVisoes(Array.from({ length: 50 }, (_, i) => ({ id: `v${i}`, nome: `n${i}` }))).length, F.MAX_VISOES);
});

teste("avisos do Windows: só booleanos valem e o padrão é desligado", () => {
  assert.deepEqual(N.normalizarNotificacoes(null), { ligado: false, rotina: true, lembretes: true });
  assert.deepEqual(N.normalizarNotificacoes({ ligado: "true", rotina: 0, lembretes: false }), { ligado: false, rotina: true, lembretes: false });
  assert.deepEqual(N.normalizarNotificacoes({ ligado: true }), { ligado: true, rotina: true, lembretes: true });
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
