// Testes da verificação de integridade: lib/integridade.ts (o que está estranho nos dados e na pasta).
// Uso: node testes/integridade.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/integridade.test.mjs)

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

const I = await import("../lib/integridade.ts");
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

const HOJE = "2026-11-14";
const base = () => ({
  avisos: [],
  categorias: { rev: 1, items: [T.normalizarCategoria({ id: "c1", nome: "Ferramenta X" })] },
  links: { rev: 1, items: [T.normalizarLink({ id: "l1", tipo: "arquivo", titulo: "Laudo", arquivo: "2026/abc-laudo.pdf", tarefaId: "t1", categoriaId: "c1" })] },
  pessoas: { rev: 1, items: [T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", categoriaIds: ["c1"] })] },
  times: { rev: 1, items: [T.normalizarTime({ id: "ti1", nome: "Squad", membroIds: ["pe1"], responsavelIds: ["pe1"], categoriaIds: ["c1"] })] },
  notas: { rev: 1, items: [T.normalizarNota({ id: "n1", titulo: "Folha", texto: "ok", gerou: [{ tipo: "registro", tarefaId: "t1", registroId: "r1", rotulo: "x" }] })] },
  modelos: { rev: 1, items: [T.normalizarModelo({ id: "mo1", nome: "Modelo", categoriaId: "c1" })] },
  paginas: { rev: 1, items: [T.normalizarPagina({ id: "pg1", titulo: "Processo", texto: "ver [Onboarding](nexo:tarefa/t1) e ![print](arquivos/2026/def-print.png)", categoriaId: "c1" })] },
  tarefas: [
    T.normalizarTarefa({ id: "t1", titulo: "Onboarding", categoriaId: "c1", registros: [
      { id: "r1", tipo: "reuniao", data: "2026-11-10", notaId: "n1", anotacoes: "ver [Processo](nexo:pagina/pg1) com [@Marina](nexo:pessoa/Marina)", proximosPassos: [{ id: "p1", texto: "x", feito: false }] },
    ] }),
  ],
});
const inventario = (extra = {}) => ({
  anexos: [{ rel: "2026/abc-laudo.pdf", tamanho: 2048 }, { rel: "2026/def-print.png", tamanho: 1024 }],
  raiz: ["nexo.json", "categorias.json", "links.json"], tarefas: ["t1.json"], bytes: 5000, maior: { nome: "t1.json", bytes: 3000 },
  lixeira: [], backups: ["2026-11-13", "2026-11-14", "manual-2026-11-14T10-00-00"], espelhos: ["onboarding--t1.md"], ...extra,
});
const ids = (v) => v.achados.map((a) => a.id);
const achado = (v, id) => v.achados.find((a) => a.id === id);

teste("dados inteiros: nenhum achado, e os números batem", () => {
  const v = I.verificarIntegridade(base(), inventario(), HOJE);
  assert.deepEqual(v.achados, []);
  assert.deepEqual(v.numeros, { tarefas: 1, registros: 1, passos: 1, paginas: 1, notas: 1, anexos: 2, bytesDados: 5000, bytesAnexos: 3072, backups: 3, ultimoBackup: "2026-11-14" });
  assert.equal(v.quando, HOJE);
});

teste("arquivo ilegível é erro; conflito do OneDrive e cópia na raiz são aviso; .tmp é só informação", () => {
  const d = base();
  d.avisos = ["O arquivo /x/pessoas.json não é um JSON válido. Nada foi alterado. Restaure uma cópia de _backups.", 'Os arquivos "t1.json" e "t1-PC.json" têm a mesma tarefa (provável conflito do OneDrive).'];
  const v = I.verificarIntegridade(d, inventario({ raiz: ["nexo.json", "categorias.json", "categorias-NOTEBOOK.json", "links (1).json", "categorias.json.123.tmp", "leia-me.txt"], tarefas: ["t1.json", "t1.json.9.tmp"] }), HOJE);
  assert.deepEqual([achado(v, "ilegivel").gravidade, achado(v, "conflito").gravidade, achado(v, "copia-na-raiz").gravidade, achado(v, "tmp").gravidade], ["erro", "aviso", "aviso", "info"]);
  assert.deepEqual(achado(v, "copia-na-raiz").itens, ["categorias-NOTEBOOK.json", "links (1).json"]);
  assert.deepEqual(achado(v, "tmp").itens, ["categorias.json.123.tmp", "t1.json.9.tmp"]);
  // o mais grave vem primeiro
  assert.deepEqual(v.achados.map((a) => a.gravidade), [...v.achados.map((a) => a.gravidade)].sort((a, b) => ["erro", "aviso", "info"].indexOf(a) - ["erro", "aviso", "info"].indexOf(b)));
});

teste("anexo citado que falta é erro; anexo que ninguém cita é só informação", () => {
  const v = I.verificarIntegridade(base(), inventario({ anexos: [{ rel: "2026/abc-laudo.pdf", tamanho: 10 }, { rel: "2025/velho.png", tamanho: 3 * 1024 * 1024 }] }), HOJE);
  assert.equal(achado(v, "anexo-faltando").gravidade, "erro");
  assert.deepEqual(achado(v, "anexo-faltando").itens, ['2026/def-print.png (imagem em página "Processo")']);
  assert.equal(achado(v, "anexo-sem-uso").gravidade, "info");
  assert.match(achado(v, "anexo-sem-uso").detalhe, /Ocupam 3\.0 MB/);
  assert.deepEqual(achado(v, "anexo-sem-uso").itens, ["2025/velho.png"]);
  // endereço de imagem que não é anexo válido (tentativa de sair da pasta) não conta como citado
  const d = base();
  d.paginas.items[0].texto = "![x](arquivos/../../nexo.json) ![y](https://exemplo.local/a.png)";
  assert.equal(achado(I.verificarIntegridade(d, inventario({ anexos: [{ rel: "2026/abc-laudo.pdf", tamanho: 1 }] }), HOJE), "anexo-faltando"), undefined);
});

teste("página de vídeo: o vídeo, a transcrição e a capa contam como anexos citados", () => {
  const d = base();
  d.paginas.items.push(T.normalizarPagina({ id: "pgv", titulo: "Gravação", tipo: "video", video: { arquivo: "2026/v-gravacao.mp4", transcricao: "2026/v-fala.vtt", capa: "2026/v-capa.png", caminho: "C:\\Videos\\x.mp4" } }));
  const tem = I.verificarIntegridade(d, inventario({ anexos: [...inventario().anexos, { rel: "2026/v-gravacao.mp4", tamanho: 9 }, { rel: "2026/v-fala.vtt", tamanho: 1 }, { rel: "2026/v-capa.png", tamanho: 1 }] }), HOJE);
  assert.deepEqual(tem.achados, []); // nada sobrando, nada faltando
  const falta = I.verificarIntegridade(d, inventario(), HOJE);
  assert.deepEqual(achado(falta, "anexo-faltando").itens, [
    '2026/v-gravacao.mp4 (vídeo da página de vídeo "Gravação")', '2026/v-fala.vtt (transcrição da página de vídeo "Gravação")', '2026/v-capa.png (capa da página de vídeo "Gravação")',
  ]);
});

teste("vínculos e citações que apontam para o que não existe mais", () => {
  const d = base();
  d.tarefas.push(T.normalizarTarefa({ id: "t2", titulo: "Solta", categoriaId: "c-sumiu", descricao: "depende de [outra](nexo:tarefa/t-lixo) e de [mais uma](nexo:tarefa/t-nada), ver [pg](nexo:pagina/pg-nada)", registros: [{ id: "r2", tipo: "nota", data: "2026-11-11", notaId: "n-sumiu" }] }));
  d.links.items.push(T.normalizarLink({ id: "l2", tipo: "link", titulo: "Guia", url: "https://exemplo.local", tarefaId: "t-lixo", categoriaId: "c-sumiu" }));
  d.times.items[0].membroIds.push("pe-sumiu");
  d.notas.items[0].gerou.push({ tipo: "tarefa", tarefaId: "t-nada", rotulo: "y" });
  const v = I.verificarIntegridade(d, inventario({ lixeira: ["tarefa-t-lixo-2026-11-01T10-00-00.json"], espelhos: ["onboarding--t1.md", "solta--t2.md"] }), HOJE);
  assert.deepEqual(achado(v, "categoria-sumiu").itens, ["Solta"]);
  assert.equal(achado(v, "categoria-sumiu").gravidade, "aviso");
  const orfaos = achado(v, "referencia-orfa").itens.join("\n");
  assert.match(orfaos, /link "Guia": a tarefa está na lixeira/);
  assert.match(orfaos, /link "Guia": a categoria não existe/);
  assert.match(orfaos, /time "Squad": 1 pessoa que não existe mais/);
  assert.match(orfaos, /folha "Folha": gerou algo numa tarefa que não existe/);
  assert.match(orfaos, /registro de 2026-11-11 em "Solta": a folha original não existe mais/);
  const quebrados = achado(v, "link-interno-quebrado").itens.join("\n");
  assert.match(quebrados, /tarefa "Solta": cita uma tarefa que está na lixeira/);
  assert.match(quebrados, /tarefa "Solta": cita uma tarefa que não existe mais/);
  assert.match(quebrados, /tarefa "Solta": cita uma página que não existe mais/);
  assert.ok(!quebrados.includes("Marina")); // pessoa é texto livre: citar quem não tem cadastro não é quebra
});

teste("ids repetidos, falta de backup, espelho e tarefa grande", () => {
  const d = base();
  d.categorias.items.push(T.normalizarCategoria({ id: "c1", nome: "Repetida" }));
  d.tarefas[0].registros.push({ ...d.tarefas[0].registros[0] });
  const v = I.verificarIntegridade(d, inventario({ backups: [], espelhos: [], maior: { nome: "t1.json", bytes: 2_500_000 } }), HOJE);
  assert.deepEqual(achado(v, "id-repetido").itens, ["categorias: c1", 'registros de "Onboarding": r1']);
  assert.equal(achado(v, "sem-backup").gravidade, "aviso");
  assert.deepEqual(achado(v, "sem-espelho").itens, ["Onboarding"]);
  assert.match(achado(v, "tarefa-grande").detalhe, /t1\.json tem 2\.4 MB/);
  assert.equal(v.numeros.ultimoBackup, null);
  // pasta nova, sem nada: não reclama de falta de backup
  const vazio = I.verificarIntegridade({ ...base(), tarefas: [], links: { rev: 0, items: [] }, notas: { rev: 0, items: [] }, paginas: { rev: 0, items: [] } }, inventario({ backups: [], anexos: [], espelhos: [] }), HOJE);
  assert.deepEqual(ids(vazio), []);
});

teste("lista longa mostra só alguns exemplos; dados antigos sem as coleções novas não quebram", () => {
  const d = base();
  for (let i = 0; i < 30; i++) d.tarefas.push(T.normalizarTarefa({ id: `x${i}`, titulo: `Tarefa ${i}`, categoriaId: "c-sumiu" }));
  const v = I.verificarIntegridade(d, inventario({ espelhos: [] }), HOJE);
  assert.equal(achado(v, "categoria-sumiu").itens.length, 9);
  assert.equal(achado(v, "categoria-sumiu").itens.at(-1), "e mais 22");
  assert.match(achado(v, "categoria-sumiu").titulo, /^30 tarefas apontam/);
  const antigo = { avisos: [], tarefas: base().tarefas, categorias: base().categorias, links: { rev: 0, items: [] } };
  assert.doesNotThrow(() => I.verificarIntegridade(antigo, inventario(), HOJE));
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
