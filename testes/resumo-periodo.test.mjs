// Testes do resumo de um período sem IA (3.23): lib/resumo-periodo.ts.
// Uso: node testes/resumo-periodo.test.mjs   (Node 22.18+ importa .ts direto)

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

const R = await import("../lib/resumo-periodo.ts");
const T = await import("../lib/tipos.ts");
const L = await import("../lib/lembretes.ts");

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

L.definirMeusNomes([]);
const meioDia = (d) => `${d}T15:00:00.000Z`;
const reg = (id, data, extra = {}) => ({ id, tipo: "atividade", data, titulo: `Registro ${id}`, criadoEm: meioDia(data), ...extra });
const marco = (id, data, de, para) => ({ id, tipo: "marco", data, titulo: para, criadoEm: meioDia(data), alteracoes: { status: { de, para } } });
const AGORA = meioDia("2026-11-20");
const INI = "2026-11-10";
const FIM = "2026-11-16";

const tarefas = [
  T.normalizarTarefa({
    id: "andou", titulo: "Migrar o cadastro", status: "em_andamento", prioridade: 8, criadaEm: meioDia("2026-11-01"),
    registros: [
      marco("m1", "2026-11-01", "", "em_andamento"),
      reg("a1", "2026-11-05", { resumoIA: "Fora do período" }),
      reg("a2", "2026-11-11", { tipo: "reuniao", resumoIA: "Piloto **aprovado** com dez fornecedores.", decisoes: "- Começar pelo piloto", impedimentos: "Falta o acesso ao ambiente de teste",
        proximosPassos: [{ id: "p1", texto: "Montar a planilha", feito: true, feitoEm: meioDia("2026-11-12") }, { id: "p2", texto: "Enviar o cronograma", prazo: "2026-11-18" }, { id: "p3", texto: "Passo da Marina", responsavel: "Marina", prazo: "2026-11-17" }, { id: "p4", texto: "Longe", prazo: "2026-12-30" }] }),
    ],
  }),
  T.normalizarTarefa({
    id: "feita", titulo: "Renovar o certificado", status: "concluida", prioridade: 5, criadaEm: meioDia("2026-11-02"), concluidaEm: meioDia("2026-11-14"),
    registros: [marco("m2", "2026-11-02", "", "a_fazer"), reg("f1", "2026-11-13"), marco("m3", "2026-11-14", "a_fazer", "concluida")],
  }),
  T.normalizarTarefa({
    id: "espera", titulo: "Parecer do jurídico", status: "aguardando", prioridade: 9, criadaEm: meioDia("2026-11-03"), esperando: { quem: "Bruno", oQue: "o parecer assinado", desde: "2026-11-08" },
    registros: [marco("m4", "2026-11-03", "", "a_fazer"), marco("m5", "2026-11-08", "a_fazer", "aguardando")],
  }),
  T.normalizarTarefa({
    id: "bloq", titulo: "Ajuste dos servidores", status: "bloqueada", prioridade: 6, criadaEm: meioDia("2026-11-03"),
    registros: [marco("m6", "2026-11-03", "", "a_fazer"), reg("b1", "2026-11-04", { tipo: "impedimento", impedimentos: "Sem janela de mudança até o dia 5" }), marco("m7", "2026-11-15", "a_fazer", "bloqueada")],
  }),
  T.normalizarTarefa({ id: "quieta", titulo: "Sem novidade", status: "a_fazer", criadaEm: meioDia("2026-11-01"), registros: [marco("m8", "2026-11-01", "", "a_fazer")] }),
  T.normalizarTarefa({ id: "velha", titulo: "Concluída antes", status: "concluida", criadaEm: meioDia("2026-10-01"), concluidaEm: meioDia("2026-10-20") }),
];
const r = R.resumoDoPeriodo(tarefas, INI, FIM, AGORA);

teste("resumoDoPeriodo: cada tarefa cai no lugar certo", () => {
  assert.deepEqual(r.concluidas.map((t) => t.id), ["feita"]);
  assert.deepEqual(r.andou.map((a) => [a.tarefa.id, a.registros, a.passosFeitos]), [["andou", 1, 1]]);
  assert.equal(r.andou[0].ultimo, "Piloto aprovado com dez fornecedores.", "o último registro entra em texto simples");
  assert.deepEqual(r.travou.map((x) => x.tarefa.id), ["espera", "bloq"], "do mais prioritário para o menos");
  assert.equal(r.travou[0].motivo, "aguardando Bruno há 12 dias (o parecer assinado)");
  assert.equal(r.travou[1].motivo, "bloqueada há 5 dias. Impedimento: Sem janela de mudança até o dia 5");
  assert.deepEqual(r.decisoes.map((d) => d.texto), ["Começar pelo piloto"]);
  assert.deepEqual(r.precisaDeDecisao.map((x) => [x.tarefa.id, x.texto]), [["andou", "Falta o acesso ao ambiente de teste"]]);
  assert.deepEqual(r.proximos.map((x) => x.passo.id), ["p2"], "só passo meu, em aberto, com prazo até sete dias depois do período");
  assert.deepEqual(r.numeros, { registros: 2, reunioes: 1, passos: 1, concluidas: 1 });
});

teste("o período é inclusivo e marco não conta como registro", () => {
  const umDia = R.resumoDoPeriodo(tarefas, "2026-11-11", "2026-11-11", AGORA);
  assert.deepEqual(umDia.andou.map((a) => a.registros), [1]);
  assert.equal(umDia.numeros.passos, 0);
  assert.equal(R.resumoDoPeriodo(tarefas, "2026-11-15", "2026-11-15", AGORA).numeros.registros, 0, "o marco do dia 15 não é registro");
});

teste("textoDoResumo: texto simples, com cada seção só quando tem algo", () => {
  const texto = R.textoDoResumo(r, "Fornecedores");
  const linhas = texto.split("\n");
  assert.equal(linhas[0], "Resumo de 10/11/26 a 16/11/26 (Fornecedores)");
  assert.equal(linhas[1], "2 registros, 1 reunião, 1 passo concluído, 1 tarefa concluída.");
  for (const trecho of ["Concluído (1):\n- Renovar o certificado", "Andou (1):\n- Migrar o cadastro: 1 registro, 1 passo concluído. Último: Piloto aprovado", "Travado ou esperando (2):\n- Parecer do jurídico: aguardando Bruno há 12 dias", "Decisões (1):\n- 11/11: Começar pelo piloto [Migrar o cadastro]", "Meus próximos passos:\n- Enviar o cronograma (Migrar o cadastro, até 18/11)"])
    assert.ok(texto.includes(trecho), `falta: ${trecho}\n---\n${texto}`);
  assert.equal(texto.includes("—"), false);
  assert.equal(texto.includes("**"), false, "sem marcação de formatação");
});

teste("textoDoUmAUm: o que andou, o que travou, o que precisa de decisão e o que vem agora", () => {
  const texto = R.textoDoUmAUm(r);
  assert.ok(texto.startsWith("Para o 1:1, de 10/11/26 a 16/11/26\n"));
  const ordem = ["O que andou:", "- Concluída: Renovar o certificado", "O que travou:", "O que precisa de decisão ou de ajuda:\n- Migrar o cadastro: Falta o acesso ao ambiente de teste", "Decisões que já foram tomadas:", "O que vem agora:"];
  let pos = -1;
  for (const trecho of ordem) {
    const i = texto.indexOf(trecho);
    assert.ok(i > pos, `"${trecho}" faltando ou fora de ordem\n---\n${texto}`);
    pos = i;
  }
});

teste("1:1: o impedimento da tarefa bloqueada aparece em 'O que travou' e não se repete em 'precisa de decisão'", () => {
  const bloqueada = T.normalizarTarefa({
    id: "b2", titulo: "Trocar o balanceador", status: "bloqueada", criadaEm: meioDia("2026-11-01"),
    registros: [
      marco("mb1", "2026-11-01", "", "a_fazer"),
      reg("rb0", "2026-11-11", { impedimentos: "Faltava o orçamento" }),
      reg("rb1", "2026-11-12", { tipo: "impedimento", impedimentos: "Sem janela de mudança" }),
      marco("mb2", "2026-11-12", "a_fazer", "bloqueada"),
    ],
  });
  const x = R.resumoDoPeriodo([bloqueada], INI, FIM, AGORA);
  assert.equal(x.travou[0].motivo, "bloqueada há 8 dias. Impedimento: Sem janela de mudança", "vale o impedimento mais recente");
  assert.deepEqual(x.precisaDeDecisao.map((p) => p.texto), ["Sem janela de mudança", "Faltava o orçamento"]);
  const texto = R.textoDoUmAUm(x);
  assert.equal(texto.split("Sem janela de mudança").length - 1, 1, `o impedimento aparece uma vez só\n---\n${texto}`);
  assert.ok(texto.includes("O que precisa de decisão ou de ajuda:\n- Trocar o balanceador: Faltava o orçamento"), "o outro impedimento do período continua lá");
  assert.equal(texto.includes(": bloqueada há 8 dias:"), false, "sem dois dois-pontos seguidos");
});

teste("período sem nada: diz que não há o que relatar, sem seções vazias", () => {
  const nada = R.resumoDoPeriodo([tarefas[4]], INI, FIM, AGORA);
  assert.equal(R.textoDoResumo(nada), "Resumo de 10/11/26 a 16/11/26\n\nNada registrado no período.\n");
  assert.match(R.textoDoUmAUm(nada), /Nada registrado no período/);
  assert.equal(R.textoDoResumo(R.resumoDoPeriodo([], "2026-11-10", "2026-11-10", AGORA)).split("\n")[0], "Resumo de 10/11/26");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
