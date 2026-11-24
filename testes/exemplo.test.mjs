// Testes dos dados de exemplo (3.22): lib/exemplo.ts. O cenário é um export válido, inteiro, e mostra cada coisa
// que o app sabe mostrar (o que vence hoje, o que atrasou, quem espera retorno, a reunião do dia).
// Uso: node testes/exemplo.test.mjs   (Node 22.18+ importa .ts direto)

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

const E = await import("../lib/exemplo.ts");
const I = await import("../lib/importar-dados.ts");
const T = await import("../lib/tipos.ts");
const L = await import("../lib/lembretes.ts");
const J = await import("../lib/jornada.ts");

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

const HOJE = T.hojeISO();
const exemplo = E.gerarExemplo(HOJE);
const texto = JSON.stringify(exemplo);

teste("o exemplo é um export válido: nenhum item fica de fora ao ser lido", () => {
  const lido = I.lerExportacao(texto);
  assert.equal(lido.ignorados, 0);
  assert.equal(lido.schema, 1);
  assert.equal(lido.grupos.tarefas.length, exemplo.tarefas.length);
  for (const grupo of I.COLECOES_IMPORTAVEIS) assert.equal(lido.grupos[grupo].length, exemplo[grupo].items.length, grupo);
});

teste("todas as coleções importáveis têm algo no exemplo, e os ids não se repetem", () => {
  for (const grupo of I.COLECOES_IMPORTAVEIS) assert.ok(exemplo[grupo].items.length > 0, `o exemplo não tem nada em ${grupo}`);
  const ids = [...exemplo.tarefas, ...I.COLECOES_IMPORTAVEIS.flatMap((g) => exemplo[g].items)].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  const idsDeDentro = exemplo.tarefas.flatMap((t) => t.registros.flatMap((r) => [r.id, ...r.proximosPassos.map((p) => p.id)]));
  assert.equal(new Set(idsDeDentro).size, idsDeDentro.length, "registro ou passo com id repetido");
});

teste("o mesmo dia dá sempre o mesmo exemplo, e as datas acompanham o dia", () => {
  assert.deepEqual(E.gerarExemplo(HOJE), exemplo);
  const outro = E.gerarExemplo("2026-03-10");
  assert.equal(outro.tarefas.find((t) => t.id === "tex5").prazo, "2026-03-10");
  assert.equal(outro.tarefas.find((t) => t.id === "tex3").prazo, "2026-03-08");
  assert.ok(outro.jornada.items.some((d) => d.id === "2026-03-10" && d.planejado));
  // virada de mês e de ano
  assert.equal(E.gerarExemplo("2027-01-01").tarefas.find((t) => t.id === "tex3").prazo, "2026-12-30");
});

teste("o exemplo mostra cada situação: foco, atraso, prazo de hoje, espera, bloqueio, concluída e reunião do dia", () => {
  const tarefas = exemplo.tarefas.map(T.normalizarTarefa);
  const status = new Set(tarefas.map((t) => t.status));
  for (const s of ["a_fazer", "em_andamento", "aguardando", "bloqueada", "concluida"]) assert.ok(status.has(s), s);
  assert.ok(tarefas.filter((t) => t.focoEm === HOJE).length >= 2, "foco de hoje");
  const tipos = new Set(L.gerarLembretes(tarefas).map((l) => l.tipo));
  for (const tipo of ["prazo_vencido", "prazo_hoje", "passo_vencido", "passo_hoje", "followup", "aguardando", "bloqueada"]) assert.ok(tipos.has(tipo), `falta um lembrete de ${tipo}`);
  assert.ok(tarefas.some((t) => (t.checklist ?? []).length > 0), "checklist");
  const jornada = J.lerJornada({ rev: 0, items: exemplo.jornada.items.map(T.normalizarItemDaJornada) });
  const reunioes = J.reunioesDoDia(J.blocosDoDia(jornada, HOJE).blocos, 0);
  assert.equal(reunioes.length, 1);
  assert.equal(reunioes[0].tarefaId, "tex1");
  assert.ok(reunioes[0].bloco.reuniao.participantes.length >= 2);
});

teste("tudo o que o exemplo aponta existe nele (tarefa, categoria, pessoa)", () => {
  const tarefas = new Set(exemplo.tarefas.map((t) => t.id));
  const categorias = new Set(exemplo.categorias.items.map((c) => c.id));
  const pessoas = new Set(exemplo.pessoas.items.map((p) => p.id));
  for (const t of exemplo.tarefas) assert.ok(t.categoriaId === null || categorias.has(t.categoriaId), `categoria de ${t.id}`);
  for (const l of exemplo.links.items) {
    for (const id of l.tarefaIds) assert.ok(tarefas.has(id), `tarefa do link ${l.id}`);
    assert.ok(categorias.has(l.categoriaId), `categoria do link ${l.id}`);
  }
  for (const p of [...exemplo.paginas.items, ...exemplo.notas.items]) for (const id of p.tarefaIds) assert.ok(tarefas.has(id), `tarefa de ${p.id}`);
  for (const t of exemplo.times.items) for (const id of [...t.responsavelIds, ...t.membroIds]) assert.ok(pessoas.has(id), `pessoa do time ${t.id}`);
  for (const d of exemplo.jornada.items) for (const b of d.blocos ?? []) {
    if (b.tarefaId) assert.ok(tarefas.has(b.tarefaId), `tarefa do bloco ${b.id}`);
    if (b.reuniao?.tarefaId) assert.ok(tarefas.has(b.reuniao.tarefaId), `tarefa da reunião ${b.id}`);
  }
});

teste("nomes genéricos e textos do jeito do app: e-mail só de exemplo, endereço só de exemplo, sem travessão", () => {
  const emails = texto.match(/[\w.+-]+@[\w.-]+/g) ?? [];
  assert.ok(emails.length > 0 && emails.every((e) => e.endsWith("@exemplo.local")), emails.join(", "));
  const enderecos = texto.match(/https?:\/\/[^"\s\\]+/g) ?? [];
  assert.ok(enderecos.every((u) => u.startsWith("https://exemplo.local/")), enderecos.join(", "));
  assert.equal(texto.includes("—"), false);
  assert.ok(texto.length < 60_000, "o exemplo é pequeno");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
