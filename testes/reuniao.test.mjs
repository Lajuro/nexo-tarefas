// Testes do modo reunião: lib/reuniao.ts (pauta, rascunho vindo do navegador, registro e ata).
// Uso: node testes/reuniao.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/reuniao.test.mjs)

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

const R = await import("../lib/reuniao.ts");
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

const passo = (id, texto, extra = {}) => ({ id, texto, feito: false, ...extra });
const dados = {
  categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] }, times: { rev: 0, items: [] }, modelos: { rev: 0, items: [] },
  notas: { rev: 0, items: [] }, paginas: { rev: 0, items: [] }, avisos: [],
  pessoas: { rev: 1, items: [T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", apelidos: ["Marina"], email: "marina@exemplo.local" })] },
  tarefas: [
    T.normalizarTarefa({ id: "t1", titulo: "Onboarding na Ferramenta X", status: "em_andamento", registros: [
      { id: "r1", tipo: "reuniao", data: "2026-11-02", titulo: "Kickoff", decisoes: "Começar pelo squad de Pagamentos", proximosPassos: [passo("p1", "Liberar acesso", { responsavel: "Marina" }), passo("p2", "Montar guia", { feito: true })] },
      { id: "r2", tipo: "atividade", data: "2026-11-09", titulo: "Primeiro scan", resumoIA: "42 achados", proximosPassos: [passo("p3", "Triagem dos críticos", { prazo: "2026-11-20" })] },
      { id: "m1", tipo: "marco", data: "2026-11-10", titulo: "Status alterado" },
    ] }),
    T.normalizarTarefa({ id: "t2", titulo: "Trilha de formação", status: "a_fazer", registros: [
      { id: "r3", tipo: "nota", data: "2026-11-05", proximosPassos: [passo("p4", "Revisar o roteiro", { responsavel: "marina souza" }), passo("p5", "Reservar sala", { responsavel: "Bruno" })] },
    ] }),
    T.normalizarTarefa({ id: "t3", titulo: "Exceção de prazo", status: "aguardando", esperando: { quem: "Marina", oQue: "aprovação do risco", desde: "2026-11-01" } }),
    T.normalizarTarefa({ id: "t4", titulo: "Antiga", status: "concluida", registros: [{ id: "r4", tipo: "nota", data: "2026-10-01", proximosPassos: [passo("p6", "Não entra", { responsavel: "Marina" })] }] }),
  ],
};
const t1 = dados.tarefas[0];

teste("pauta: passos da tarefa, últimas decisões, onde parou e o que está com cada participante em outras frentes", () => {
  const p = R.montarPauta(dados, t1, ["Marina Souza", "marina souza", " ", "Bruno"]);
  assert.deepEqual(p.passosDaTarefa.map((x) => x.passo.id), ["p1", "p3"]);
  assert.deepEqual(p.decisoes.map((d) => d.titulo), ["Kickoff"]);
  assert.equal(p.ultimo.id, "r2"); // o marco não conta como "onde a conversa parou"
  // participante repetido entra uma vez; quem tem cadastro é reconhecido pelo apelido
  assert.deepEqual(p.porPessoa.map((x) => x.nome), ["Marina Souza", "Bruno"]);
  assert.deepEqual(p.porPessoa[0].passos.map((x) => x.passo.id), ["p4"]); // p1 é desta tarefa, p6 é de tarefa fechada
  assert.deepEqual(p.porPessoa[0].esperas.map((t) => t.id), ["t3"]);
  assert.deepEqual(p.porPessoa[1].passos.map((x) => x.passo.id), ["p5"]);
});

teste("pauta em texto: só o que existe, sem inventar", () => {
  const txt = R.textoDaPauta(t1, R.montarPauta(dados, t1, ["Marina"]));
  assert.match(txt, /^Pauta: Onboarding na Ferramenta X\n/);
  assert.match(txt, /- Liberar acesso \(responsável: Marina\)/);
  assert.match(txt, /- Triagem dos críticos \(até 20\/11\/26\)/);
  assert.match(txt, /Últimas decisões:\n- 02\/11\/26: Começar pelo squad de Pagamentos/);
  assert.match(txt, /Com Marina, de outras frentes:\n- Revisar o roteiro \[Trilha de formação\]\n- retorno pendente: aprovação do risco \[Exceção de prazo\]/);
  const vazia = R.textoDaPauta(dados.tarefas[1], R.montarPauta(dados, T.normalizarTarefa({ id: "t9", titulo: "Nova" }), []));
  assert.equal(vazia.trim().split("\n").length, 1);
});

const reuniao = () => ({
  ...R.reuniaoNova(),
  inicio: new Date(2026, 10, 14, 9, 5).getTime(),
  titulo: " Alinhamento semanal ",
  participantes: ["Marina Souza", " "],
  notas: "Revisamos o **painel**.\n\n- item",
  decisoes: ["Adotar a Ferramenta X", "  "],
  passos: [{ id: "pn1", texto: " Enviar o guia ", responsavel: " Marina ", prazo: "2026-11-21" }, { id: "pn2", texto: "  ", responsavel: "", prazo: "" }],
  impedimentos: " Falta acesso ",
  resolvidos: ["r1:p1", "r1:nao-existe"],
});

teste("registro: vira uma reunião com hora de início, decisões em lista e passos limpos", () => {
  const reg = R.registroDaReuniao(reuniao());
  assert.equal(reg.tipo, "reuniao");
  assert.equal(reg.hora, "09:05");
  assert.equal(reg.titulo, "Alinhamento semanal");
  assert.deepEqual(reg.participantes, ["Marina Souza"]);
  assert.equal(reg.decisoes, "- Adotar a Ferramenta X");
  assert.deepEqual(reg.proximosPassos.map((p) => [p.id, p.texto, p.responsavel, p.prazo, p.feito]), [["pn1", "Enviar o guia", "Marina", "2026-11-21", false]]);
  assert.equal(reg.impedimentos, "Falta acesso");
  assert.match(reg.anotacoes, /\*\*painel\*\*/); // as anotações continuam em Markdown
  assert.ok(!reg.duracaoMin); // reunião não conta como sessão de foco
  // sem título e sem relógio: ainda assim é um registro válido
  const simples = R.registroDaReuniao({ ...R.reuniaoNova(), notas: "x" });
  assert.equal(simples.titulo, "Reunião");
  assert.match(simples.hora, /^\d\d:\d\d$/);
});

teste("gravar: acrescenta o registro e conclui só os passos marcados, sem mexer no resto", () => {
  const r = reuniao();
  const reg = R.registroDaReuniao(r);
  const depois = R.comReuniao(t1, r, reg);
  assert.equal(depois.registros.length, t1.registros.length + 1);
  assert.equal(depois.registros.at(-1).id, reg.id);
  const p1 = depois.registros[0].proximosPassos[0];
  assert.equal(p1.feito, true);
  assert.ok(p1.feitoEm);
  assert.equal(depois.registros[1], t1.registros[1]); // registro sem passo marcado não é recriado
  assert.equal(t1.registros[0].proximosPassos[0].feito, false); // a tarefa original não muda
  assert.equal(depois.titulo, t1.titulo);
});

teste("ata: texto simples só com o que foi escrito, duração quando o relógio foi ligado", () => {
  const r = reuniao();
  const ata = R.textoDaAta(t1, r, r.inicio + 42 * 60_000);
  assert.match(ata, /^Ata: Alinhamento semanal \(\d\d\/\d\d\/\d\d, 42 min\)\nAssunto: Onboarding na Ferramenta X\nParticipantes: Marina Souza\n/);
  assert.match(ata, /Decisões:\n- Adotar a Ferramenta X\n\nPróximos passos:\n- Enviar o guia \(responsável: Marina, até 21\/11\/26\)\n/);
  assert.match(ata, /Pendências resolvidas:\n- Liberar acesso\n/);
  assert.match(ata, /Impedimentos:\nFalta acesso\n/);
  assert.match(ata, /Anotações:\nRevisamos o painel\./); // sem a marcação do Markdown
  assert.ok(!ata.includes("**"));
  const curta = R.textoDaAta(t1, { ...R.reuniaoNova(), notas: "só isso" });
  assert.match(curta, /^Ata: Reunião \(\d\d\/\d\d\/\d\d\)\n/);
  assert.ok(!/Decisões|Próximos passos|Participantes|Impedimentos|resolvidas/.test(curta));
  assert.equal(R.duracaoDaReuniao(R.reuniaoNova()), 0);
});

teste("rascunho do navegador é entrada não confiável: só entra o que tem a forma certa", () => {
  for (const mau of [null, 7, "x", [], { inicio: "abc" }, { inicio: -5 }, { inicio: Infinity }]) assert.equal(R.normalizarReuniao(mau), null);
  const r = R.normalizarReuniao({
    inicio: 0, titulo: 9, participantes: ["Marina", 3, null, "x".repeat(900)], notas: { a: 1 }, decisoes: "nao-lista",
    passos: [{ texto: "ok", id: "../../x", prazo: "amanhã", responsavel: 5 }, { id: "p1" }, "solto", null, { id: "p_2-b", texto: "bom", prazo: "2026-12-01", responsavel: "Bruno" }],
    impedimentos: [], resolvidos: ["r1:p1", {}], __proto__: { x: 1 }, extra: "<script>",
  });
  assert.equal(r.inicio, 0);
  assert.equal(r.titulo, "");
  assert.deepEqual([r.participantes.length, r.participantes[1].length], [2, 500]);
  assert.equal(r.notas, "");
  assert.deepEqual(r.decisoes, []);
  assert.equal(r.passos.length, 2);
  assert.match(r.passos[0].id, /^p[a-z0-9]+$/i); // id inválido é trocado por um do app
  assert.deepEqual([r.passos[0].prazo, r.passos[0].responsavel], ["", ""]);
  assert.deepEqual(r.passos[1], { id: "p_2-b", texto: "bom", responsavel: "Bruno", prazo: "2026-12-01" });
  assert.deepEqual(r.resolvidos, ["r1:p1"]);
  assert.ok(!("extra" in r));
  // limites
  const grande = R.normalizarReuniao({ inicio: 1, decisoes: Array(500).fill("d"), passos: Array(500).fill({ texto: "p" }), notas: "n".repeat(300_000) });
  assert.deepEqual([grande.decisoes.length, grande.passos.length, grande.notas.length], [60, 60, 200_000]);
});

teste("reunião em branco não tem conteúdo; qualquer coisa escrita tem", () => {
  assert.equal(R.reuniaoTemConteudo(R.reuniaoNova()), false);
  assert.equal(R.reuniaoTemConteudo({ ...R.reuniaoNova(), titulo: "  ", notas: " \n" }), false);
  for (const parte of [{ titulo: "x" }, { notas: "x" }, { decisoes: ["x"] }, { impedimentos: "x" }, { participantes: ["x"] }, { resolvidos: ["a:b"] }, { passos: [{ id: "p", texto: "x", responsavel: "", prazo: "" }] }])
    assert.equal(R.reuniaoTemConteudo({ ...R.reuniaoNova(), ...parte }), true, JSON.stringify(parte));
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
