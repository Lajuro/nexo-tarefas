// Testes do motor de lembretes: lib/lembretes.ts (o que pede atenção e o agrupamento por tarefa).
// Uso: node testes/lembretes.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/lembretes.test.mjs)

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

const L = await import("../lib/lembretes.ts");
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

// O motor usa o dia de hoje, então as datas do teste são relativas a ele (no fuso de quem roda).
const p2 = (n) => String(n).padStart(2, "0");
const dia = (delta) => { const d = new Date(); d.setDate(d.getDate() + delta); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const meioDia = (delta) => { const d = new Date(); d.setDate(d.getDate() + delta); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const tarefa = (x) => T.normalizarTarefa({ criadaEm: meioDia(-40), atualizadaEm: meioDia(-40), status: "em_andamento", ...x });
const passo = (id, extra = {}) => ({ id, texto: `passo ${id}`, feito: false, ...extra });
const reg = (id, delta, passos = []) => ({ id, tipo: "atividade", data: dia(delta), titulo: id, proximosPassos: passos });

// Uma tarefa com tudo estourando, uma só com prazo chegando, uma só "para ficar de olho" e uma em dia.
const tarefas = [
  tarefa({ id: "olho", titulo: "Só de olho", registros: [reg("r1", -20)] }), // parada e sem próximo passo: só info
  tarefa({
    id: "fogo", titulo: "Tudo estourando", status: "aguardando", prazo: dia(-2), lembrarEm: dia(0),
    esperando: { quem: "Bruno", oQue: "a correção", desde: dia(-8) },
    registros: [reg("r2", -8, [passo("p1", { prazo: dia(-3) })])],
  }),
  tarefa({ id: "perto", titulo: "Prazo chegando", prazo: dia(2), registros: [reg("r3", -1, [passo("p2")])] }),
  tarefa({ id: "emdia", titulo: "Em dia", prazo: dia(30), registros: [reg("r4", 0, [passo("p3")])] }),
  tarefa({ id: "fechada", titulo: "Concluída", status: "concluida", prazo: dia(-10) }),
];

teste("gerarLembretes: um lembrete por motivo, do mais grave para o menos, e nada para tarefa fechada ou em dia", () => {
  const ls = L.gerarLembretes(tarefas);
  const doFogo = ls.filter((l) => l.tarefaId === "fogo").map((l) => l.tipo).sort();
  assert.deepEqual(doFogo, ["aguardando", "followup", "passo_vencido", "prazo_vencido"]);
  assert.ok(!ls.some((l) => l.tarefaId === "fechada" || l.tarefaId === "emdia"));
  const pesos = ls.map((l) => ({ critico: 0, atencao: 1, info: 2 })[l.gravidade]);
  assert.deepEqual(pesos, [...pesos].sort((a, b) => a - b), "os mais graves vêm primeiro");
});

teste("tarefa com reunião marcada não é cobrada por estar parada nem por não ter próximo passo (3.21)", () => {
  const tipos = (extras) => L.gerarLembretes(tarefas, extras).filter((l) => l.tarefaId === "olho").map((l) => l.tipo).sort();
  assert.deepEqual(tipos(), ["parada", "sem_proximo_passo"]);
  assert.deepEqual(tipos({ comReuniao: new Set(["olho"]) }), []);
  assert.deepEqual(tipos({ comReuniao: new Set(["outra"]) }), ["parada", "sem_proximo_passo"]);
  // o que é prazo e retorno continua valendo, com reunião ou sem
  const doFogo = L.gerarLembretes(tarefas, { comReuniao: new Set(["fogo"]) }).filter((l) => l.tarefaId === "fogo").map((l) => l.tipo).sort();
  assert.deepEqual(doFogo, ["aguardando", "followup", "passo_vencido", "prazo_vencido"]);
});

teste("o lembrete de voltar usa o nome do glossário (sem \"follow-up\")", () => {
  const l = L.gerarLembretes(tarefas).find((x) => x.tipo === "followup");
  assert.equal(l.titulo, "Lembrete de voltar: é hoje");
  const atrasado = L.gerarLembretes([tarefa({ id: "a", titulo: "A", lembrarEm: dia(-3), registros: [reg("r", 0, [passo("p")])] })]).find((x) => x.tipo === "followup");
  assert.equal(atrasado.titulo, "Lembrete de voltar: era há 3 dias");
  assert.ok(!L.gerarLembretes(tarefas).some((x) => /follow-up/i.test(x.titulo + x.detalhe)));
});

teste("agruparLembretes: uma linha por tarefa, com todos os motivos dentro", () => {
  const ls = L.gerarLembretes(tarefas);
  const gs = L.agruparLembretes(ls);
  assert.deepEqual(gs.map((g) => g.tarefaId), ["fogo", "perto", "olho"]);
  assert.equal(gs.reduce((n, g) => n + g.lembretes.length, 0), ls.length, "nenhum lembrete se perde ao agrupar");
  const fogo = gs[0];
  assert.equal(fogo.lembretes.length, 4);
  assert.equal(fogo.tarefaTitulo, "Tudo estourando");
  assert.equal(new Set(gs.map((g) => g.id)).size, gs.length, "o id do grupo é único");
});

teste("agruparLembretes: a gravidade do grupo é a do motivo mais grave, e é ela que ordena", () => {
  const gs = L.agruparLembretes(L.gerarLembretes(tarefas));
  assert.deepEqual(gs.map((g) => g.gravidade), ["critico", "atencao", "info"]);
  // dentro do grupo, o mais grave vem primeiro
  const fogo = gs[0].lembretes.map((l) => l.gravidade);
  assert.deepEqual(fogo.slice(0, 2), ["critico", "critico"]);
  assert.deepEqual(fogo.slice(2), ["atencao", "atencao"]);
  // quem pede atenção é quem tem algo acima de "info": é o número do sino e da tela Hoje
  assert.equal(gs.filter((g) => g.gravidade !== "info").length, 2);
});

teste("agruparLembretes: motivo leve não tira a tarefa de onde o motivo grave a pôs", () => {
  // prazo vencido (crítico) + passos antigos (info) na mesma tarefa
  const t = tarefa({ id: "mista", titulo: "Mista", prazo: dia(-1), registros: [reg("r", -20, [passo("p")])] });
  const [g, ...resto] = L.agruparLembretes(L.gerarLembretes([t]));
  assert.equal(resto.length, 0);
  assert.equal(g.gravidade, "critico");
  assert.ok(g.lembretes.some((l) => l.gravidade === "info"), "o motivo leve continua dentro do grupo");
  assert.equal(g.lembretes[0].tipo, "prazo_vencido");
});

teste("agruparLembretes: lista vazia e lembretes adiados (filtrados antes) não quebram", () => {
  assert.deepEqual(L.agruparLembretes([]), []);
  const ls = L.gerarLembretes(tarefas).filter((l) => l.tipo !== "prazo_vencido" && l.tipo !== "passo_vencido");
  const fogo = L.agruparLembretes(ls).find((g) => g.tarefaId === "fogo");
  assert.equal(fogo.gravidade, "atencao", "sem os críticos (adiados), o grupo cai para atenção");
});

// ---------- regra única de data na tela (3.10, lib/tipos.ts) ----------
const diaDaqui = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

teste("dataCurta: dia/mês no ano corrente, com o ano (2 dígitos) só em outro ano", () => {
  assert.equal(T.dataCurta("2026-11-20", "2026-11-18"), "20/11");
  assert.equal(T.dataCurta("2025-12-31", "2026-01-02"), "31/12/25");
  assert.equal(T.dataCurta("2027-01-05", "2026-12-30"), "05/01/27");
  assert.equal(T.dataCurta(""), "");
  assert.equal(T.dataCurta(null), "");
});

teste("dataRelativa: sempre por extenso, do mesmo jeito", () => {
  assert.equal(T.dataRelativa(diaDaqui(0)), "hoje");
  assert.equal(T.dataRelativa(diaDaqui(1)), "amanhã");
  assert.equal(T.dataRelativa(diaDaqui(-1)), "ontem");
  assert.equal(T.dataRelativa(diaDaqui(2)), "em 2 dias");
  assert.equal(T.dataRelativa(diaDaqui(-4)), "há 4 dias");
  assert.equal(L.dataRelativa(diaDaqui(-4)), "há 4 dias", "lib/lembretes continua exportando a mesma função");
});

teste("prazoRelativo e dataComRelativo: prazo que passou é atraso; relativo só perto da data", () => {
  assert.equal(T.prazoRelativo(diaDaqui(-1)), "1 dia de atraso");
  assert.equal(T.prazoRelativo(diaDaqui(-3)), "3 dias de atraso");
  assert.equal(T.prazoRelativo(diaDaqui(0)), "hoje");
  const curta = (n) => T.dataCurta(diaDaqui(n));
  assert.equal(T.dataComRelativo(diaDaqui(2), { prazo: true }), `${curta(2)} · em 2 dias`);
  assert.equal(T.dataComRelativo(diaDaqui(-30), { prazo: true }), `${curta(-30)} · 30 dias de atraso`, "atraso aparece mesmo longe");
  assert.equal(T.dataComRelativo(diaDaqui(30)), curta(30), "longe da data, só a data");
  assert.equal(T.dataComRelativo(diaDaqui(30), { ate: Infinity }), `${curta(30)} · em 30 dias`);
  assert.ok(!/\d+d\b/.test(T.dataComRelativo(diaDaqui(3), { prazo: true })), "nada de abreviação como 3d");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
