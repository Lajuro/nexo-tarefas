// Testes do fechamento do dia, da daily (lib/fechamento.ts) e da transcrição trazida para o modo reunião
// (promptTranscricao em lib/prompts.ts e comRespostaDaTranscricao em lib/reuniao.ts).
// Uso: node testes/fechamento.test.mjs   (Node 22.18+ importa .ts direto)

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

const F = await import("../lib/fechamento.ts");
const P = await import("../lib/prompts.ts");
const R = await import("../lib/reuniao.ts");
const L = await import("../lib/lembretes.ts");
const A = await import("../lib/acoes.ts");
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

/** Carimbo ISO ao meio-dia local do dia pedido (para dataLocal devolver esse mesmo dia em qualquer fuso). */
const carimbo = (data, h = 12) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d, h, 0, 0).toISOString();
};
const SEG_A_SEX = [1, 2, 3, 4, 5];
// 2026-11-20 é sexta; 2026-11-23, segunda.
const SEXTA = "2026-11-20";
const SEGUNDA = "2026-11-23";

const tarefa = (x) => T.normalizarTarefa(x);
const pagamentos = tarefa({
  id: "t1", titulo: "Ferramenta X no squad de Pagamentos", status: "em_andamento", prioridade: 8, focoEm: SEXTA,
  registros: [
    { id: "r0", tipo: "marco", data: "2026-11-10", titulo: "Tarefa criada", alteracoes: { status: { de: "", para: "a_fazer" } } },
    {
      id: "r1", tipo: "reuniao", data: SEXTA, hora: "10:00", titulo: "Alinhamento", criadoEm: carimbo(SEXTA, 10),
      proximosPassos: [
        { id: "p1", texto: "Mandar o guia de instalação", feito: true, feitoEm: carimbo(SEXTA, 15) },
        { id: "p2", texto: "Revisar o pipeline", feito: false, prazo: SEXTA },
        { id: "p3", texto: "Validar com o time", feito: false, responsavel: "Ciclana", prazo: SEXTA },
      ],
    },
  ],
});
const bloqueada = tarefa({
  id: "t2", titulo: "Gestão de vulnerabilidades", status: "bloqueada",
  registros: [{ id: "r2", tipo: "impedimento", data: "2026-11-18", titulo: "Acesso", impedimentos: "Sem acesso ao ambiente de homologação" }],
});
const esperando = tarefa({
  id: "t3", titulo: "Security Champion", status: "aguardando", prazo: SEGUNDA,
  esperando: { quem: "Fulano", oQue: "a lista de squads", desde: "2026-11-17" },
});
const concluida = tarefa({
  id: "t4", titulo: "Relatório mensal", status: "concluida",
  registros: [{ id: "r4", tipo: "marco", data: SEXTA, titulo: "Concluída", alteracoes: { status: { de: "em_andamento", para: "concluida" } } }],
});
const dados = { tarefas: [pagamentos, bloqueada, esperando, concluida] };

teste("próximo dia de trabalho pula o fim de semana", () => {
  assert.equal(F.proximoDiaDeTrabalho(SEXTA, SEG_A_SEX), SEGUNDA);
  assert.equal(F.proximoDiaDeTrabalho("2026-11-18", SEG_A_SEX), "2026-11-19");
  assert.equal(F.proximoDiaDeTrabalho(SEXTA, []), "2026-11-21");
});

teste("fechamento: o que saiu no dia (sem o marco de criação, com a conclusão)", () => {
  const f = F.montarFechamento(dados, SEXTA, SEG_A_SEX);
  assert.equal(f.proximo, SEGUNDA);
  const chaves = f.feitos.map((e) => e.chave);
  assert.ok(chaves.includes("r:r1"));
  assert.ok(chaves.includes("p:p1"));
  assert.ok(chaves.includes("r:r4"), "concluir tarefa conta como feito");
  assert.ok(!chaves.includes("r:r0"), "marco de criação não conta");
});

teste("fechamento: focos abertos, meus passos vencidos e o que vem no próximo dia", () => {
  L.definirMeusNomes([]);
  const f = F.montarFechamento(dados, SEXTA, SEG_A_SEX);
  assert.deepEqual(f.focosAbertos.map((t) => t.id), ["t1"]);
  assert.deepEqual(f.passosAtrasados.map((x) => x.passo.id), ["p2"], "o passo da Ciclana não é meu");
  assert.deepEqual(f.proximoDia.prazos.map((t) => t.id), ["t3"]);
});

teste("fechamento: impedimentos vêm das bloqueadas e de quem se espera", () => {
  const f = F.montarFechamento(dados, SEXTA, SEG_A_SEX);
  const txt = f.impedimentos.map((i) => `${i.tarefa.id}:${i.texto}`);
  assert.ok(txt.includes("t2:Sem acesso ao ambiente de homologação"));
  assert.ok(txt.includes("t3:aguardando Fulano: a lista de squads"));
});

teste("daily do fechamento: uma linha por tarefa, levados e prazos do próximo dia", () => {
  const f = F.montarFechamento(dados, SEXTA, SEG_A_SEX);
  const levado = A.comFocoEm(pagamentos, SEGUNDA);
  const d = F.dailyDoFechamento(f, [levado]);
  assert.match(d, /^O que fiz \(sexta-feira, 20\/11\/26\):/);
  assert.match(d, /- Ferramenta X no squad de Pagamentos: reunião «Alinhamento»; concluí «Mandar o guia de instalação»/);
  assert.match(d, /- Relatório mensal: tarefa concluída/);
  assert.match(d, /O que vou fazer:\n- Ferramenta X no squad de Pagamentos: Revisar o pipeline\n- Security Champion/);
  assert.match(d, /Impedimentos:\n- Gestão de vulnerabilidades: Sem acesso/);
});

teste("daily sem nada: diz que não há registro em vez de inventar", () => {
  const d = F.textoDaDaily({ diaFeito: SEXTA, feitos: [], vouFazer: [], impedimentos: [] });
  assert.match(d, /- Nada registrado no Nexo\./);
  assert.match(d, /- Ainda vou definir\./);
  assert.match(d, /Impedimentos:\n- Nenhum\./);
});

teste("daily da manhã: o último dia com atividade (pulando o fim de semana) e os focos de hoje", () => {
  const hoje = tarefa({ ...pagamentos, focoEm: SEGUNDA });
  const d = F.dailyDaManha({ tarefas: [hoje, bloqueada, esperando, concluida] }, SEGUNDA);
  assert.match(d, /^O que fiz \(sexta-feira, 20\/11\/26\):/);
  assert.match(d, /O que vou fazer:\n- Ferramenta X no squad de Pagamentos: Revisar o pipeline/);
});

teste("comFocoEm deixa a tarefa como foco de outro dia e null solta", () => {
  assert.equal(A.comFocoEm(pagamentos, SEGUNDA).focoEm, SEGUNDA);
  assert.equal(A.comFocoEm(pagamentos, null).focoEm, null);
});

// ---------- transcrição no modo reunião ----------

const pauta = L.passosAbertosDe([pagamentos]).filter((x) => x.tarefa.id === "t1");

teste("prompt da transcrição: contexto, passos em aberto, partes e o formato do registro", () => {
  const p = P.promptTranscricao(pagamentos, undefined, "[00:12] Fulano: bom dia", { titulo: "Alinhamento", participantes: ["Fulano"], numero: 2, total: 3 });
  assert.match(p, /transcrição \(parte 2 de 3\)/);
  assert.match(p, /Tarefa: Ferramenta X no squad de Pagamentos/);
  assert.match(p, /- Revisar o pipeline/);
  assert.match(p, /Participantes informados: Fulano/);
  for (const s of ["RESUMO", "DECISÕES", "PRÓXIMOS PASSOS", "IMPEDIMENTOS", "PARTICIPANTES", "PASSOS CONCLUÍDOS"]) assert.match(p, new RegExp(`## ${s}`));
  assert.match(p, /\[00:12\] Fulano: bom dia/);
});

const resposta = `## RESUMO
- Falamos do prazo da ferramenta X.

## DECISÕES
- Adotar a ferramenta X no squad
- Manter o prazo de dezembro

## PRÓXIMOS PASSOS
- Configurar o pipeline (responsável: Fulano)
- Mandar o guia (responsável: Eu)

## IMPEDIMENTOS
Nenhum

## PARTICIPANTES
- Fulano
- Ciclana

## PASSOS CONCLUÍDOS
- Revisar o pipeline`;

teste("resposta da transcrição entra na reunião sem apagar o que já estava", () => {
  const r0 = { ...R.reuniaoNova(), notas: "Minhas anotações", decisoes: ["Adotar a ferramenta X no squad"], participantes: ["fulano"] };
  const r = R.comRespostaDaTranscricao(r0, [P.interpretarResposta(resposta)], pauta, { arquivo: "arquivos/2026/abc-transcricao.txt", nome: "reuniao.vtt" });
  assert.deepEqual(r.decisoes, ["Adotar a ferramenta X no squad", "Manter o prazo de dezembro"], "decisão repetida não duplica");
  assert.deepEqual(r.passos.map((p) => [p.texto, p.responsavel]), [["Configurar o pipeline", "Fulano"], ["Mandar o guia", "Eu"]]);
  assert.deepEqual(r.participantes, ["fulano", "Ciclana"], "mesmo nome com outra caixa não duplica");
  assert.match(r.notas, /^Minhas anotações\n\n## Resumo da transcrição\n\n- Falamos do prazo/);
  assert.match(r.notas, /Transcrição completa: \[reuniao\.vtt\]\(arquivos\/2026\/abc-transcricao\.txt\)/);
  assert.equal(r.impedimentos, "", "\"Nenhum\" não vira impedimento");
  assert.deepEqual(r.resolvidos, ["r1:p2"], "passo antigo resolvido fica marcado na pauta");
});

teste("várias partes somam, e só anexar não mexe em decisões nem passos", () => {
  const outra = P.interpretarResposta("## DECISÕES\n- Nova decisão\n## IMPEDIMENTOS\n- Falta acesso");
  const r = R.comRespostaDaTranscricao(R.reuniaoNova(), [P.interpretarResposta(resposta), outra], pauta, null);
  assert.equal(r.decisoes.length, 3);
  assert.equal(r.impedimentos, "- Falta acesso");
  const so = R.comRespostaDaTranscricao(R.reuniaoNova(), [], pauta, { arquivo: "arquivos/2026/x.txt", nome: "a[b].txt" });
  assert.deepEqual(so.decisoes, []);
  assert.match(so.notas, /\[ab\.txt\]\(arquivos\/2026\/x\.txt\)/, "colchetes do nome não quebram o link");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
