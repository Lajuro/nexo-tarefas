// Testes do Radar das frentes: lib/radar.ts (saúde de cada frente, linha de prazos e status em texto).
// Uso: node testes/radar.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/radar.test.mjs)

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

const R = await import("../lib/radar.ts");
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

// Sábado. A semana (segunda a domingo) começou em 09/11.
const HOJE = "2026-11-14";
// meio-dia no fuso de quem roda o teste: o app converte carimbos para a data local, então o teste vale em qualquer fuso
const meioDia = (d) => { const [a, m, dia] = d.split("-").map(Number); return new Date(a, m - 1, dia, 12).toISOString(); };
const tarefa = (x) => T.normalizarTarefa({ criadaEm: meioDia("2026-09-01"), atualizadaEm: meioDia("2026-09-01"), ...x });
const reg = (id, data, extra = {}) => ({ id, tipo: "atividade", data, titulo: id, ...extra });
const passo = (id, extra = {}) => ({ id, texto: `passo ${id}`, feito: false, ...extra });
const cat = (id, nome, extra = {}) => T.normalizarCategoria({ id, nome, cor: "#123456", ...extra });

const dados = {
  links: { rev: 0, items: [] }, pessoas: { rev: 0, items: [] }, times: { rev: 0, items: [] }, modelos: { rev: 0, items: [] }, notas: { rev: 0, items: [] }, paginas: { rev: 0, items: [] }, avisos: [],
  categorias: { rev: 1, items: [cat("c-risco", "Vulnerabilidades"), cat("c-parada", "Hardening"), cat("c-atencao", "Ferramenta X"), cat("c-dia", "Formação"), cat("c-fim", "Encerrada"), cat("c-arq", "Arquivada vazia", { arquivada: true }), cat("c-arq2", "Arquivada com sobra", { arquivada: true })] },
  tarefas: [
    // em risco: prazo vencido + bloqueada
    tarefa({ id: "t1", titulo: "Corrigir a API", categoriaId: "c-risco", status: "em_andamento", prioridade: 9, prazo: "2026-11-10", registros: [reg("r1", "2026-11-12", { proximosPassos: [passo("p1", { prazo: "2026-11-11" }), passo("p2", { prazo: "2026-11-20" })] })] }),
    tarefa({ id: "t2", titulo: "Ajustar o firewall", categoriaId: "c-risco", status: "bloqueada", prioridade: 5, registros: [reg("r2", "2026-11-13")] }),
    tarefa({ id: "t3", titulo: "Já entregue", categoriaId: "c-risco", status: "concluida", concluidaEm: meioDia("2026-11-01") }),
    tarefa({ id: "t3b", titulo: "Entregue faz tempo", categoriaId: "c-risco", status: "concluida", concluidaEm: meioDia("2026-08-01") }),
    // parada: aberta, sem nada há mais de 14 dias
    tarefa({ id: "t4", titulo: "Endurecer servidores", categoriaId: "c-parada", status: "a_fazer", registros: [reg("r4", "2026-10-20")] }),
    // atenção: prazo em 2 dias, esperando há 6 dias, em andamento sem próximo passo
    tarefa({ id: "t5", titulo: "Onboarding do squad", categoriaId: "c-atencao", status: "em_andamento", prazo: "2026-11-16", lembrarEm: "2026-11-18", registros: [reg("r5", "2026-11-13"), reg("m5", "2026-11-14", { tipo: "marco" })] }),
    tarefa({ id: "t6", titulo: "Licenças", categoriaId: "c-atencao", status: "aguardando", esperando: { quem: "Marina", oQue: "aprovar a compra", desde: "2026-11-08" }, registros: [reg("r6", "2026-11-08")] }),
    // em dia
    tarefa({ id: "t7", titulo: "Trilha de formação", categoriaId: "c-dia", status: "em_andamento", prazo: "2026-12-10", registros: [reg("r7", "2026-11-11", { proximosPassos: [passo("p7"), { id: "p8", texto: "feito", feito: true, feitoEm: meioDia("2026-11-03") }] }), reg("r7b", "2026-09-28")] }),
    // sem abertas
    tarefa({ id: "t8", titulo: "Projeto fechado", categoriaId: "c-fim", status: "cancelada" }),
    // categoria arquivada, mas com tarefa aberta: aparece
    tarefa({ id: "t9", titulo: "Esquecida", categoriaId: "c-arq2", status: "a_fazer", criadaEm: meioDia("2026-11-13") }),
    // sem categoria (e uma com categoria que não existe mais)
    tarefa({ id: "t10", titulo: "Solta", categoriaId: null, status: "a_fazer", criadaEm: meioDia("2026-11-12"), prazo: "2027-03-01" }),
    tarefa({ id: "t11", titulo: "Órfã", categoriaId: "c-sumiu", status: "a_fazer", criadaEm: meioDia("2026-11-12") }),
  ],
};
const radar = R.montarRadar(dados, HOJE);
const frente = (id) => radar.frentes.find((f) => f.id === id);

teste("saúde de cada frente, com os motivos", () => {
  assert.equal(frente("c-risco").saude, "risco");
  assert.deepEqual(frente("c-risco").motivos, ["1 tarefa com prazo vencido", "1 tarefa bloqueada", "1 passo com prazo vencido"]);
  assert.equal(frente("c-parada").saude, "parada");
  assert.deepEqual(frente("c-parada").motivos, ["Sem movimento há 25 dias"]);
  assert.equal(frente("c-atencao").saude, "atencao");
  assert.deepEqual(frente("c-atencao").motivos, ["Prazo em 2 dias: Onboarding do squad", "Esperando Marina há 6 dias", "1 tarefa em andamento sem próximo passo"]);
  assert.equal(frente("c-dia").saude, "em_dia");
  assert.deepEqual(frente("c-dia").motivos, []);
  assert.equal(frente("c-fim").saude, "sem_abertas");
  assert.equal(frente("c-arq"), undefined); // arquivada e sem tarefa aberta: não aparece
  assert.equal(frente("c-arq2").saude, "em_dia"); // arquivada com tarefa aberta: aparece
  // sem categoria junta as soltas e as de categoria que não existe mais
  assert.deepEqual(frente(null).abertas.map((t) => t.id).sort(), ["t10", "t11"]);
  assert.equal(frente(null).nome, "Sem categoria");
  assert.deepEqual(radar.contagem, { risco: 1, parada: 1, atencao: 1, em_dia: 3, sem_abertas: 1 });
  // a ordem vai do que mais precisa de atenção para o que menos precisa
  assert.deepEqual(radar.frentes.map((f) => f.saude), ["risco", "parada", "atencao", "em_dia", "em_dia", "em_dia", "sem_abertas"]);
});

teste("números da frente: abertas, passos, concluídas no mês, próximo prazo e último movimento", () => {
  const f = frente("c-risco");
  assert.deepEqual(f.abertas.map((t) => t.id), ["t1", "t2"]); // por prioridade
  assert.deepEqual([f.atrasadas.length, f.bloqueadas.length, f.aguardando.length, f.passosAbertos, f.passosAtrasados, f.concluidas30], [1, 1, 0, 2, 1, 1]);
  assert.equal(f.proximoPrazo, null); // o único prazo já venceu
  assert.deepEqual([f.ultima, f.diasSemMovimento], ["2026-11-13", 1]);
  const d = frente("c-dia");
  assert.deepEqual([d.proximoPrazo.tarefa.id, d.proximoPrazo.data], ["t7", "2026-12-10"]);
  // movimento por semana: registros e passos concluídos; marco não conta. Da mais antiga para a atual.
  assert.equal(d.semanas.length, R.RADAR.semanasDeAtividade);
  assert.deepEqual(d.semanas, [0, 1, 0, 0, 0, 0, 1, 1]); // 28/09 (seis semanas antes da atual), 03/11 (passo concluído) e 11/11
  assert.deepEqual(frente("c-atencao").semanas.at(-1), 1); // r5 conta, o marco m5 não
  assert.equal(frente("c-atencao").semanas.at(-2), 1); // r6, de 08/11 (domingo da semana anterior)
  // frente só com a criação da tarefa: o último movimento é a criação
  assert.deepEqual([frente("c-arq2").ultima, frente("c-arq2").diasSemMovimento], ["2026-11-13", 1]);
  assert.equal(frente("c-fim").proximoPrazo, null);
});

teste("data no futuro não conta como movimento", () => {
  const d = { ...dados, tarefas: [tarefa({ id: "f1", titulo: "Futuro", categoriaId: "c-dia", status: "a_fazer", criadaEm: meioDia("2026-10-01"), registros: [reg("rf", "2026-12-25")] })] };
  const f = R.montarRadar(d, HOJE).frentes.find((x) => x.id === "c-dia");
  assert.equal(f.ultima, "2026-10-01");
  assert.equal(f.saude, "parada");
  assert.deepEqual(f.semanas, [0, 0, 0, 0, 0, 0, 0, 0]);
});

teste("linha de prazos: semanas de segunda a domingo, atrasados à parte, follow-up só enquanto está por vir", () => {
  assert.equal(R.inicioDaSemana("2026-11-14"), "2026-11-09");
  assert.equal(R.inicioDaSemana("2026-11-09"), "2026-11-09");
  assert.equal(R.inicioDaSemana("2026-11-15"), "2026-11-09");
  assert.equal(radar.semanas.length, R.RADAR.semanasDePrazo);
  assert.deepEqual(radar.semanas[0], { inicio: "2026-11-09", fim: "2026-11-15" });
  assert.deepEqual(radar.semanas[1], { inicio: "2026-11-16", fim: "2026-11-22" });
  const resumo = radar.prazos.map((p) => [p.data, p.tipo, p.tarefaId, p.atrasado, R.colunaDoPrazo(radar, p)]);
  assert.deepEqual(resumo, [
    ["2026-11-10", "tarefa", "t1", true, -1],
    ["2026-11-11", "passo", "t1", true, -1],
    ["2026-11-16", "tarefa", "t5", false, 1],
    ["2026-11-18", "lembrar", "t5", false, 1],
    ["2026-11-20", "passo", "t1", false, 1],
    ["2026-12-10", "tarefa", "t7", false, 4],
  ]); // t10 (março) fica fora da janela; passo sem prazo e tarefa fechada não entram
  assert.equal(radar.prazos.find((p) => p.tipo === "lembrar").titulo, "Voltar em: Onboarding do squad");
  const vencido = R.montarRadar({ ...dados, tarefas: [tarefa({ id: "x", titulo: "X", status: "a_fazer", lembrarEm: "2026-11-01" })] }, HOJE);
  assert.deepEqual(vencido.prazos, []);
});

teste("status em texto: só o que está nos dados, frente por frente", () => {
  const txt = R.textoDoRadar(radar);
  assert.match(txt, /^Status das frentes em 14\/11\/26\n6 frentes: 1 em risco, 1 parada, 1 pede atenção, 3 em dia\.\n/);
  assert.match(txt, /\nVulnerabilidades: em risco\n- 2 tarefas abertas \(1 atrasada, 1 bloqueada\); 1 concluída nos últimos 30 dias\.\n- Atrasada: Corrigir a API \(prazo 10\/11\/26\)\n- Bloqueada: Ajustar o firewall\n- 2 próximos passos em aberto, 1 com prazo vencido\.\n- Último movimento: 13\/11\/26 \(há 1 dia\)\.\n/);
  assert.match(txt, /\nFerramenta X: pede atenção\n- 2 tarefas abertas \(1 aguardando retorno\)\.\n- Aguardando retorno: Licenças \(Marina: aprovar a compra\)\n- Próximo prazo: 16\/11\/26, Onboarding do squad\n/);
  assert.match(txt, /\nHardening: parada\n- 1 tarefa aberta\.\n- Último movimento: 20\/10\/26 \(há 25 dias\)\.\n/);
  assert.ok(!txt.includes("Encerrada")); // sem tarefa aberta e sem nada concluído no mês: não entra
  // só as frentes pedidas
  const uma = R.textoDoRadar(radar, ["c-dia"]);
  assert.match(uma, /^Status das frentes em 14\/11\/26\n1 frente: 1 em dia\.\n\nFormação: em dia\n/);
  assert.ok(!uma.includes("Vulnerabilidades"));
  assert.match(R.textoDoRadar(R.montarRadar({ ...dados, tarefas: [], categorias: { rev: 0, items: [] } }, HOJE)), /Nenhuma frente com tarefa aberta\./);
});

teste("dados vazios ou antigos não quebram", () => {
  const vazio = R.montarRadar({ ...dados, tarefas: [], categorias: { rev: 0, items: [] } }, HOJE);
  assert.deepEqual([vazio.frentes, vazio.prazos], [[], []]);
  const semCat = R.montarRadar({ ...dados, categorias: { rev: 0, items: [] } }, HOJE);
  assert.deepEqual(semCat.frentes.map((f) => f.id), [null]);
  assert.equal(R.nomeSaude("risco"), "Em risco");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
