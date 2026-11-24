// Testes do tempo em cada status (3.23): lib/tempo-status.ts. A conta sai dos marcos da linha do tempo, e o que
// não dá para saber é marcado como estimado em vez de virar fato.
// Uso: node testes/tempo-status.test.mjs   (Node 22.18+ importa .ts direto)

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

const S = await import("../lib/tempo-status.ts");
const T = await import("../lib/tipos.ts");
const A = await import("../lib/acoes.ts");

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

// ---------- cenário: dias contados a partir de 1º de março, ao meio-dia ----------
const dia = (n) => new Date(Date.UTC(2026, 2, n, 12)).toISOString();
const AGORA = dia(31);
let seq = 0;
const marco = (n, de, para) => ({ id: `m${++seq}`, tipo: "marco", data: dia(n).slice(0, 10), titulo: para, criadoEm: dia(n), alteracoes: { status: { de, para } } });
const tarefa = (status, registros, extra = {}) => T.normalizarTarefa({ id: "t1", titulo: "Tarefa", status, criadaEm: dia(1), registros, ...extra });
const resumo = (r) => r.trechos.map((t) => `${t.status}:${t.dias}${t.estimado ? "?" : ""}`).join(" ");

teste("caminho comum: criada, andou, esperou, voltou e segue aberta", () => {
  const t = tarefa("em_andamento", [marco(1, "", "a_fazer"), marco(4, "a_fazer", "em_andamento"), marco(10, "em_andamento", "aguardando"), marco(20, "aguardando", "em_andamento")]);
  const r = S.tempoPorStatus(t, AGORA);
  assert.equal(resumo(r), "a_fazer:3 em_andamento:6 aguardando:10 em_andamento:11");
  assert.deepEqual(r.porStatus, { a_fazer: 3, em_andamento: 17, aguardando: 10 });
  assert.equal(r.noStatusAtualHa, 11);
  assert.equal(r.totalDeDias, 30);
  assert.equal(r.estimado, false);
});

teste("tarefa concluída: o tempo para na conclusão e 'neste status há' não se aplica", () => {
  const t = tarefa("concluida", [marco(1, "", "a_fazer"), marco(3, "a_fazer", "em_andamento"), marco(9, "em_andamento", "concluida")], { concluidaEm: dia(9) });
  const r = S.tempoPorStatus(t, AGORA);
  assert.equal(resumo(r), "a_fazer:2 em_andamento:6");
  assert.equal(r.totalDeDias, 8);
  assert.equal(r.noStatusAtualHa, 0);
  assert.equal(r.estimado, false);
  assert.equal(S.tempoPorStatus(t, dia(90)).totalDeDias, 8, "o tempo de uma tarefa fechada não cresce com o calendário");
});

teste("tarefa reaberta: o tempo fechada aparece como trecho, e ela volta a contar", () => {
  const t = tarefa("em_andamento", [marco(1, "", "a_fazer"), marco(5, "a_fazer", "concluida"), marco(8, "concluida", "em_andamento")]);
  const r = S.tempoPorStatus(t, AGORA);
  assert.equal(resumo(r), "a_fazer:4 concluida:3 em_andamento:23");
  assert.equal(r.estimado, false);
});

teste("tarefa só com o marco de criação: tudo no primeiro status, e é fato", () => {
  const r = S.tempoPorStatus(tarefa("a_fazer", [marco(1, "", "a_fazer")]), AGORA);
  assert.equal(resumo(r), "a_fazer:30");
  assert.equal(r.noStatusAtualHa, 30);
  assert.equal(r.estimado, false);
});

teste("tarefa sem nenhum marco (de antes dos marcos, ou importada): conta, mas é estimada", () => {
  const r = S.tempoPorStatus(tarefa("aguardando", [{ id: "n", tipo: "nota", data: dia(5).slice(0, 10), criadoEm: dia(5) }]), AGORA);
  assert.equal(resumo(r), "aguardando:30?");
  assert.equal(r.estimado, true);
});

teste("falta o marco de criação: o primeiro status é deduzido do 'de' da primeira mudança, e o primeiro trecho é estimado", () => {
  const r = S.tempoPorStatus(tarefa("em_andamento", [marco(6, "a_fazer", "em_andamento")]), AGORA);
  assert.equal(resumo(r), "a_fazer:5? em_andamento:25");
  assert.equal(r.estimado, true);
});

teste("marco faltando no meio: o trecho que não bate é estimado, os outros continuam valendo", () => {
  // de em_andamento direto para "bloqueada -> em_andamento": ninguém registrou a entrada no bloqueio
  const t = tarefa("em_andamento", [marco(1, "", "a_fazer"), marco(4, "a_fazer", "em_andamento"), marco(12, "bloqueada", "em_andamento")]);
  const r = S.tempoPorStatus(t, AGORA);
  assert.equal(resumo(r), "a_fazer:3 em_andamento:8? em_andamento:19");
  assert.equal(r.estimado, true);
});

teste("status de agora diferente do último marco (mudança por fora do app): o resto é estimado", () => {
  const aberta = S.tempoPorStatus(tarefa("bloqueada", [marco(1, "", "a_fazer"), marco(4, "a_fazer", "em_andamento")]), AGORA);
  assert.equal(resumo(aberta), "a_fazer:3 bloqueada:27?");
  const fechada = S.tempoPorStatus(tarefa("concluida", [marco(1, "", "a_fazer"), marco(4, "a_fazer", "em_andamento")], { concluidaEm: dia(11) }), AGORA);
  assert.equal(resumo(fechada), "a_fazer:3 em_andamento:7?");
  assert.equal(fechada.totalDeDias, 10);
});

teste("relógio adiantado em outro computador: nada passa de agora, e a conta vira estimada", () => {
  const futuro = S.tempoPorStatus(tarefa("em_andamento", [marco(1, "", "a_fazer"), marco(40, "a_fazer", "em_andamento")]), AGORA);
  assert.equal(resumo(futuro), "a_fazer:30?");
  assert.equal(futuro.estimado, true);
  const nascida = S.tempoPorStatus(tarefa("a_fazer", [marco(45, "", "a_fazer")], { criadaEm: dia(45) }), AGORA);
  assert.equal(nascida.totalDeDias, 0);
  assert.equal(nascida.estimado, true);
});

teste("entrada torta não quebra: marco sem data, status que não existe, sem data de criação", () => {
  const t = tarefa("a_fazer", [
    marco(1, "", "a_fazer"),
    { id: "x1", tipo: "marco", titulo: "Sem carimbo", criadoEm: "ontem", data: "nunca", alteracoes: { status: { de: "a_fazer", para: "em_andamento" } } },
    { id: "x2", tipo: "marco", titulo: "Status inventado", criadoEm: dia(5), data: dia(5).slice(0, 10), alteracoes: { status: { de: "a_fazer", para: "voando" } } },
    { id: "x3", tipo: "marco", titulo: "Sem alteração", criadoEm: dia(6), data: dia(6).slice(0, 10) },
  ]);
  const r = S.tempoPorStatus(t, AGORA);
  assert.ok(r.trechos.length >= 1 && r.trechos.every((x) => x.dias >= 0));
  assert.equal(r.trechos.at(-1).status, "a_fazer");
  const semCriacao = S.tempoPorStatus({ ...tarefa("a_fazer", []), criadaEm: "" }, AGORA);
  assert.equal(semCriacao.estimado, true);
  assert.equal(semCriacao.totalDeDias, 0);
});

teste("os marcos que o próprio app grava (aplicarStatus) dão uma conta sem estimativa", () => {
  let t = tarefa("a_fazer", [marco(1, "", "a_fazer")]);
  t = A.aplicarStatus(t, "aguardando");
  t = A.aplicarStatus(t, "em_andamento");
  const r = S.tempoPorStatus(t, Date.now() + 5 * 86_400_000);
  assert.equal(r.estimado, false);
  assert.deepEqual(r.trechos.map((x) => x.status), ["a_fazer", "em_andamento"], "o trecho de aguardando durou zero e não aparece");
  assert.equal(r.noStatusAtualHa, 5);
});

teste("média de espera: só com três tarefas confiáveis ou mais; as estimadas ficam de fora e são contadas", () => {
  const esperou = (id, dias) => T.normalizarTarefa({ id, titulo: id, status: "em_andamento", criadaEm: dia(1), registros: [marco(1, "", "a_fazer"), marco(2, "a_fazer", "aguardando"), marco(2 + dias, "aguardando", "em_andamento")] });
  const duas = S.mediaDeEspera([esperou("a", 4), esperou("b", 6)], AGORA);
  assert.equal(duas.aguardando, null);
  assert.equal(duas.tarefasAguardando, 2);
  const semMarco = T.normalizarTarefa({ id: "velha", titulo: "Velha", status: "aguardando", criadaEm: dia(1) });
  const tres = S.mediaDeEspera([esperou("a", 4), esperou("b", 6), esperou("c", 8), semMarco], AGORA);
  assert.equal(tres.aguardando, 6);
  assert.equal(tres.bloqueada, null);
  assert.equal(tres.estimadas, 1);
});

teste("diasEmTexto: como se lê em português", () => {
  assert.equal(S.diasEmTexto(0.4), "menos de 1 dia");
  assert.equal(S.diasEmTexto(1), "1 dia");
  assert.equal(S.diasEmTexto(2.5), "2,5 dias");
  assert.equal(S.diasEmTexto(30), "30 dias");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
