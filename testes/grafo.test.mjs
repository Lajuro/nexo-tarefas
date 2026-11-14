// Testes do mapa das páginas: lib/grafo.ts (nós, ligações e a disposição determinística).
// Uso: node testes/grafo.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/grafo.test.mjs)

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

const G = await import("../lib/grafo.ts");
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
const dados = {
  links: { rev: 0, items: [] }, pessoas: { rev: 0, items: [] }, times: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, notas: { rev: 0, items: [] }, avisos: [],
  categorias: { rev: 1, items: [T.normalizarCategoria({ id: "c1", nome: "Ferramenta X", cor: "#123456" })] },
  tarefas: [T.normalizarTarefa({ id: "t1", titulo: "Onboarding", categoriaId: "c1" })],
  paginas: { rev: 1, items: [
    pg("a", "Guia", { categoriaId: "c1", texto: "ver [Proxy](nexo:pagina/b) e [Proxy de novo](nexo:pagina/b), a [tarefa](nexo:tarefa/t1), [@Marina Souza](nexo:pessoa/Marina%20Souza), ela mesma [x](nexo:pagina/a) e uma que sumiu [y](nexo:pagina/nao-existe)" }),
    pg("b", "Proxy", { paiId: "a", texto: "volta para o [Guia](nexo:pagina/a)" }),
    pg("c", "Runbook", { paiId: "a", tipo: "video" }),
    pg("d", "Solta"),
    pg("e", "Arquivada", { arquivadaEm: "2026-11-02T10:00:00Z", texto: "[Guia](nexo:pagina/a)" }),
  ] },
};

teste("nós e ligações: uma por par, citação vale mais que árvore, arquivada fica de fora", () => {
  const g = G.montarGrafo(dados);
  assert.deepEqual(g.nos.map((n) => n.id), ["pagina:a", "pagina:b", "pagina:c", "pagina:d"]);
  assert.deepEqual(g.arestas.map((a) => [a.de, a.para, a.tipo]).sort(), [["pagina:a", "pagina:b", "link"], ["pagina:a", "pagina:c", "arvore"]]);
  assert.deepEqual(g.nos.map((n) => n.grau), [2, 1, 1, 0]);
  assert.equal(g.soltas, 1);
  assert.deepEqual([g.nos[0].cor, g.nos[0].rota, g.nos[2].video], ["#123456", "/paginas?p=a", true]);
  // sem a árvore, só as citações
  assert.deepEqual(G.montarGrafo(dados, { arvore: false }).arestas.length, 1);
});

teste("tarefas e pessoas citadas entram só quando pedidas", () => {
  const g = G.montarGrafo(dados, { tarefas: true, pessoas: true });
  assert.deepEqual(g.nos.map((n) => [n.id, n.tipo]).filter(([, t]) => t !== "pagina"), [["pessoa:marina souza", "pessoa"], ["tarefa:t1", "tarefa"]]);
  assert.equal(g.nos.find((n) => n.id === "tarefa:t1").rota, "/tarefas/t1");
  assert.equal(g.nos.find((n) => n.tipo === "pessoa").rotulo, "Marina Souza");
  assert.equal(g.arestas.length, 4);
  assert.deepEqual([...G.vizinhosDe(g, "pagina:a")].sort(), ["pagina:a", "pagina:b", "pagina:c", "pessoa:marina souza", "tarefa:t1"]);
  assert.deepEqual([...G.vizinhosDe(g, "pagina:d")], ["pagina:d"]);
});

teste("disposição: sempre a mesma, dentro da tela, sem nós empilhados", () => {
  const g = G.montarGrafo(dados, { tarefas: true, pessoas: true });
  const a = G.disporGrafo(g, 1000, 700);
  const b = G.disporGrafo(g, 1000, 700);
  assert.deepEqual([...a], [...b]);
  assert.equal(a.size, g.nos.length);
  const pontos = [...a.values()];
  for (const p of pontos) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 700, JSON.stringify(p));
  for (let i = 0; i < pontos.length; i++) for (let j = i + 1; j < pontos.length; j++) assert.ok(Math.hypot(pontos[i].x - pontos[j].x, pontos[i].y - pontos[j].y) > 25, "nós em cima um do outro");
  // quem está ligado fica mais perto do que quem não está
  const d = (x, y) => Math.hypot(a.get(x).x - a.get(y).x, a.get(x).y - a.get(y).y);
  assert.ok(d("pagina:a", "pagina:b") < d("pagina:b", "pagina:d"));
});

teste("casos de borda: vazio, um nó, muitos nós e dados antigos", () => {
  const vazio = G.montarGrafo({ ...dados, paginas: { rev: 0, items: [] } });
  assert.deepEqual([vazio.nos, vazio.arestas, vazio.soltas], [[], [], 0]);
  assert.equal(G.disporGrafo(vazio).size, 0);
  const um = G.montarGrafo({ ...dados, paginas: { rev: 0, items: [pg("x", "Só uma")] } });
  assert.deepEqual([...G.disporGrafo(um, 800, 600)], [["pagina:x", { x: 400, y: 300 }]]);
  const muitas = { ...dados, paginas: { rev: 0, items: Array.from({ length: 120 }, (_, i) => pg(`p${i}`, `Página ${i}`, { texto: i ? `[x](nexo:pagina/p${Math.floor(i / 3)})` : "" })) } };
  const g = G.montarGrafo(muitas);
  const t0 = Date.now();
  const pos = G.disporGrafo(g);
  assert.ok(Date.now() - t0 < 2500, "a disposição de 120 páginas demorou demais");
  assert.ok([...pos.values()].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  assert.doesNotThrow(() => G.montarGrafo({ tarefas: [], categorias: { rev: 0, items: [] } }));
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
