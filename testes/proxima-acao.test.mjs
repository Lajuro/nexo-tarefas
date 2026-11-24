// Testes da próxima ação (3.21): lib/proxima-acao.ts. A ordem de decisão, o que vai em "depois", o "Agora não"
// e os comandos (só dados, nunca funções).
// Uso: node testes/proxima-acao.test.mjs   (Node 22.18+ importa .ts direto)

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

const PA = await import("../lib/proxima-acao.ts");
const L = await import("../lib/lembretes.ts");
const J = await import("../lib/jornada.ts");
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

// ---------- cenário (datas em relação a hoje, porque os lembretes usam o relógio) ----------

L.definirMeusNomes([]);
const HOJE = T.hojeISO();
const dia = (n) => J.somarDiasA(HOJE, n);
const m = J.emMinutos;
const passo = (id, texto, extra = {}) => ({ id, texto, feito: false, ...extra });
const tarefa = (id, titulo, extra = {}) =>
  T.normalizarTarefa({
    id, titulo, status: "em_andamento", prioridade: 5, criadaEm: `${dia(-3)}T10:00:00.000Z`, atualizadaEm: `${dia(-1)}T10:00:00.000Z`,
    registros: [{ id: `r-${id}`, tipo: "nota", data: dia(-1), titulo: "Nota", criadoEm: `${dia(-1)}T10:00:00.000Z`, proximosPassos: [passo(`p-${id}`, `Passo de ${titulo}`)] }],
    ...extra,
  });
const bloco = (id, inicio, fim, titulo, extra = {}) => T.normalizarBloco({ id, inicio, fim, titulo, tipo: "atividade", ...extra });
const entrada = (tarefas, extra = {}) => ({
  hoje: HOJE, agoraMin: m("10:00"), tarefas, blocos: [], grupos: L.agruparLembretes(L.gerarLembretes(tarefas)), jornadaCumprida: false, planejouHoje: true, ...extra,
});
const tipos = (r) => [r.agora?.tipo ?? null, ...r.depois.map((a) => a.tipo)];

const emFoco = tarefa("foco1", "Escrever o relatório", { focoEm: HOJE, prioridade: 7 });
const atrasada = tarefa("atr1", "Renovar o certificado", { prazo: dia(-2) });
const comum = tarefa("com1", "Organizar a pasta", { prioridade: 3 });

// ---------- a ordem ----------

teste("nada aberto: não há próxima ação", () => {
  assert.deepEqual(PA.proximaAcao(entrada([])), { agora: null, depois: [] });
  assert.deepEqual(PA.proximaAcao(entrada([tarefa("f", "Fechada", { status: "concluida" })])), { agora: null, depois: [] });
});

teste("5. foco escolhido e nada estourado: o próximo passo seu no foco, com o botão de concluir", () => {
  const r = PA.proximaAcao(entrada([comum, emFoco]));
  assert.equal(r.agora.tipo, "passo");
  assert.equal(r.agora.titulo, "Passo de Escrever o relatório");
  assert.match(r.agora.motivo, /foco de hoje: Escrever o relatório/);
  assert.deepEqual(r.agora.comando, { tipo: "concluir_passo", tarefaId: "foco1", registroId: "r-foco1", passoId: "p-foco1" });
  assert.deepEqual(r.agora.outro.comando, { tipo: "abrir_tarefa", tarefaId: "foco1" });
});

teste("5. foco sem passo seu: abre a tarefa e diz o que falta", () => {
  const deOutro = tarefa("foco2", "Aprovar o orçamento", { focoEm: HOJE });
  deOutro.registros[0].proximosPassos[0].responsavel = "Marina";
  const r = PA.proximaAcao(entrada([deOutro]));
  assert.equal(r.agora.tipo, "foco_sem_passo");
  assert.deepEqual(r.agora.comando, { tipo: "abrir_tarefa", tarefaId: "foco2" });
});

teste("proximoPassoMeu: com prazo primeiro, depois o do registro mais antigo; passo de outra pessoa não conta", () => {
  const t = T.normalizarTarefa({ id: "t", titulo: "T", registros: [
    { id: "r2", data: dia(-1), proximosPassos: [passo("b", "Sem prazo, novo"), passo("c", "Com prazo", { prazo: dia(3) }), passo("x", "Da Marina", { responsavel: "Marina", prazo: dia(-5) })] },
    { id: "r1", data: dia(-9), proximosPassos: [passo("a", "Sem prazo, antigo"), passo("f", "Feito", { feito: true })] },
  ] });
  assert.equal(PA.proximoPassoMeu(t).passo.id, "c");
  t.registros[0].proximosPassos[1].feito = true;
  assert.equal(PA.proximoPassoMeu(t).passo.id, "a");
});

teste("4. o que está estourado vem antes do passo do foco; tarefa em foco estourada vem antes das outras", () => {
  const r = PA.proximaAcao(entrada([emFoco, atrasada]));
  assert.deepEqual(tipos(r), ["critico", "passo"]);
  assert.equal(r.agora.tarefaId, "atr1");
  assert.match(r.agora.motivo, /Prazo venceu há 2 dias/);
  assert.deepEqual(r.agora.comando, { tipo: "abrir_tarefa", tarefaId: "atr1" });
  const focoAtrasado = tarefa("foco3", "Entregar a proposta", { focoEm: HOJE, prazo: dia(-1) });
  const r2 = PA.proximaAcao(entrada([atrasada, focoAtrasado]));
  assert.equal(r2.agora.tarefaId, "foco3");
  assert.equal(r2.depois[0].tarefaId, "atr1");
  // a mesma tarefa não aparece duas vezes (crítico e passo do foco)
  assert.equal([r2.agora, ...r2.depois].filter((a) => a.tarefaId === "foco3").length, 1);
});

teste("4. passo seu atrasado: o botão conclui o passo; passo atrasado de outra pessoa abre a tarefa", () => {
  const meu = tarefa("pm", "Publicar a ata");
  meu.registros[0].proximosPassos[0].prazo = dia(-3);
  const r = PA.proximaAcao(entrada([meu]));
  assert.equal(r.agora.tipo, "critico");
  assert.equal(r.agora.titulo, "Passo de Publicar a ata");
  assert.match(r.agora.motivo, /Passo atrasado há 3 dias em “Publicar a ata”/);
  assert.equal(r.agora.comando.tipo, "concluir_passo");
  const dela = tarefa("pd", "Cobrar a planilha");
  Object.assign(dela.registros[0].proximosPassos[0], { prazo: dia(-3), responsavel: "Marina" });
  assert.deepEqual(PA.proximaAcao(entrada([dela])).agora.comando, { tipo: "abrir_tarefa", tarefaId: "pd" });
});

teste("6. sem foco: planejar o dia; depois de planejar (ou dispensar), a melhor sugestão de foco", () => {
  const urgente = tarefa("urg", "Responder a auditoria", { prioridade: 9, prazo: dia(2) });
  const r = PA.proximaAcao(entrada([comum, urgente], { planejouHoje: false }));
  assert.equal(r.agora.tipo, "planejar");
  assert.match(r.agora.motivo, /2 tarefas abertas/);
  assert.deepEqual(r.agora.comando, { tipo: "planejar_dia" });
  assert.equal(r.depois[0].tipo, "sugestao");
  assert.equal(r.depois[0].tarefaId, "urg");
  const r2 = PA.proximaAcao(entrada([comum, urgente], { planejouHoje: true }));
  assert.equal(r2.agora.tipo, "sugestao");
  assert.deepEqual(r2.agora.comando, { tipo: "focar", tarefaId: "urg" });
  assert.match(r2.agora.motivo, /Sugestão de foco: .*prioridade 9/);
  // tarefa esperando alguém ou bloqueada não é sugerida como foco
  const esperando = tarefa("esp", "Contrato novo", { status: "aguardando", prioridade: 10 });
  assert.ok(!PA.proximaAcao(entrada([esperando, comum])).depois.concat(PA.proximaAcao(entrada([esperando, comum])).agora).some((a) => a.tipo === "sugestao" && a.tarefaId === "esp"));
});

teste("7. o que pede atenção sem ser crítico entra depois, com cobrar retorno na frente", () => {
  const semRetorno = tarefa("sr", "Parecer do jurídico", { status: "aguardando", esperando: { quem: "Bruno", oQue: "o parecer", desde: dia(-9) } });
  semRetorno.registros[0].data = dia(-9);
  semRetorno.registros[0].criadoEm = `${dia(-9)}T10:00:00.000Z`;
  semRetorno.criadaEm = `${dia(-12)}T10:00:00.000Z`;
  semRetorno.atualizadaEm = `${dia(-9)}T10:00:00.000Z`;
  const amanha = tarefa("am", "Enviar o convite", { prazo: dia(1) });
  const r = PA.proximaAcao(entrada([emFoco, amanha, semRetorno]));
  assert.equal(r.agora.tipo, "passo");
  const atencao = r.depois.filter((a) => a.tipo === "atencao");
  assert.deepEqual(atencao.map((a) => a.tarefaId), ["sr", "am"]);
  assert.match(atencao[0].motivo, /Sem retorno de Bruno há 9 dias/);
});

teste("3. o bloco de agora na rotina vale mais que os lembretes, e o que é crítico entra no motivo", () => {
  const blocos = [bloco("b1", "09:30", "11:00", "Revisar o material", { tipo: "tarefa", tarefaId: "com1" }), bloco("b2", "13:00", "14:00", "Depois")];
  const r = PA.proximaAcao(entrada([comum, atrasada, emFoco], { blocos }));
  assert.deepEqual(tipos(r), ["bloco", "critico", "passo"]);
  assert.equal(r.agora.titulo, "Revisar o material");
  assert.match(r.agora.motivo, /até as 11:00 \(faltam 1h\)/);
  assert.match(r.agora.motivo, /Próximo passo: Passo de Organizar a pasta/);
  assert.match(r.agora.motivo, /1 tarefa com prazo estourado espera/);
  assert.deepEqual(r.agora.comando, { tipo: "abrir_tarefa", tarefaId: "com1" });
  // bloco sem tarefa leva à rotina; bloco marcado como feito ou fora do horário não conta
  assert.deepEqual(PA.proximaAcao(entrada([comum], { blocos: [bloco("b3", "09:00", "10:30", "Chamados")] })).agora.comando, { tipo: "rotina" });
  assert.notEqual(PA.proximaAcao(entrada([emFoco], { blocos: [bloco("b4", "09:00", "10:30", "Feito", { feito: true })] })).agora.tipo, "bloco");
  assert.notEqual(PA.proximaAcao(entrada([emFoco], { blocos, agoraMin: m("11:00") })).agora.tipo, "bloco");
});

teste("3. na pausa da rotina, a próxima ação é a pausa", () => {
  const r = PA.proximaAcao(entrada([emFoco, atrasada], { blocos: [bloco("alm", "09:45", "10:45", "Almoço", { tipo: "pausa" })] }));
  assert.equal(r.agora.tipo, "pausa");
  assert.equal(r.agora.titulo, "Almoço");
  assert.equal(r.depois[0].tipo, "critico");
});

teste("1 e 2. reunião acontecendo e reunião em até 15 minutos vêm antes de tudo", () => {
  const daReuniao = tarefa("reu", "Migração do cadastro");
  const reuniao = (id, inicio, fim, extra = {}) => bloco(id, inicio, fim, "Alinhamento semanal", { reuniao: { participantes: ["Marina", "Bruno"], tarefaId: "reu" }, ...extra });
  const tarefas = [daReuniao, atrasada, emFoco];
  // acontecendo
  const agora = PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r1", "09:30", "10:30")] }));
  assert.equal(agora.agora.tipo, "reuniao_agora");
  assert.equal(agora.agora.titulo, "Reunião: Alinhamento semanal");
  assert.match(agora.agora.motivo, /Começou às 09:30 e vai até as 10:30, com Marina e Bruno/);
  assert.deepEqual(agora.agora.comando, { tipo: "reuniao", tarefaId: "reu", blocoId: "r1" });
  assert.equal(agora.agora.rotulo, "Entrar no modo reunião");
  // em 15 minutos: a pauta
  const breve = PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r2", "10:15", "11:00")] }));
  assert.equal(breve.agora.tipo, "reuniao_em_breve");
  assert.match(breve.agora.motivo, /Começa em 15 min, às 10:15/);
  assert.equal(breve.agora.rotulo, "Ver a pauta");
  // em 16 minutos ainda não; reunião que já acabou ou foi marcada como feita também não
  assert.equal(PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r3", "10:16", "11:00")] })).agora.tipo, "critico");
  assert.equal(PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r4", "08:00", "10:00")] })).agora.tipo, "critico");
  assert.equal(PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r5", "09:30", "10:30", { feito: true })] })).agora.tipo, "critico");
  // a que está acontecendo vem antes da que vai começar; reunião sem tarefa leva à rotina
  const duas = PA.proximaAcao(entrada(tarefas, { blocos: [reuniao("r6", "10:10", "11:00"), reuniao("r7", "09:00", "10:10")] }));
  assert.deepEqual(tipos(duas).slice(0, 2), ["reuniao_agora", "reuniao_em_breve"]);
  const semTarefa = PA.proximaAcao(entrada(tarefas, { blocos: [bloco("r8", "09:30", "10:30", "Café com o time", { reuniao: { participantes: [] } })] }));
  assert.deepEqual(semTarefa.agora.comando, { tipo: "rotina" });
  // um bloco que é reunião não aparece de novo como "bloco de agora"
  assert.equal([agora.agora, ...agora.depois].filter((a) => a.tipo === "bloco").length, 0);
});

teste("8. jornada cumprida: fechar o dia entra na lista, por último", () => {
  const r = PA.proximaAcao(entrada([emFoco], { jornadaCumprida: true }));
  assert.deepEqual(tipos(r), ["passo", "fechar"]);
  assert.deepEqual(r.depois[0].comando, { tipo: "fechar_dia" });
  assert.equal(PA.proximaAcao(entrada([], { jornadaCumprida: true })).agora.tipo, "fechar");
});

// ---------- depois, dispensar e formato ----------

teste("depois: até três, sem repetir a tarefa de agora", () => {
  const muitas = [emFoco, ...[1, 2, 3, 4, 5].map((n) => tarefa(`a${n}`, `Atrasada ${n}`, { prazo: dia(-n) }))];
  const r = PA.proximaAcao(entrada(muitas));
  assert.equal(r.depois.length, PA.MAX_DEPOIS);
  const ids = [r.agora, ...r.depois].map((a) => a.tarefaId);
  assert.equal(new Set(ids).size, ids.length);
});

teste("Agora não: a ação dispensada sai e a seguinte assume; a chave é estável", () => {
  const e = entrada([emFoco, atrasada]);
  const antes = PA.proximaAcao(e);
  assert.equal(PA.proximaAcao(e).agora.chave, antes.agora.chave);
  const depois = PA.proximaAcao({ ...e, dispensadas: [antes.agora.chave] });
  assert.equal(depois.agora.chave, antes.depois[0].chave);
  assert.equal(PA.proximaAcao({ ...e, dispensadas: [antes.agora.chave, antes.depois[0].chave] }).agora, null);
  // todas as chaves de um resultado são diferentes
  const chaves = [antes.agora, ...antes.depois].map((a) => a.chave);
  assert.equal(new Set(chaves).size, chaves.length);
});

teste("só dados: nenhuma ação leva função, e os textos não têm travessão", () => {
  const blocos = [bloco("r1", "09:30", "10:30", "Reunião", { reuniao: { participantes: ["Marina"], tarefaId: "com1" } })];
  const r = PA.proximaAcao(entrada([comum, emFoco, atrasada], { blocos, jornadaCumprida: true }));
  const texto = JSON.stringify(r);
  assert.deepEqual(JSON.parse(texto), r, "o resultado sobrevive a ir e voltar por JSON");
  assert.equal(texto.includes("—"), false);
  for (const a of [r.agora, ...r.depois]) assert.ok(a.titulo && a.motivo && a.rotulo && a.chave, a.tipo);
});

teste("lembrete de modelo que se repete (sem tarefa) não vira próxima ação", () => {
  const grupos = [{ id: "modelo:m1", tarefaId: "", tarefaTitulo: "Relatório mensal", gravidade: "atencao", lembretes: [{ id: "x", tipo: "recorrencia", gravidade: "atencao", titulo: "Hora de criar", detalhe: "", tarefaId: "", tarefaTitulo: "Relatório mensal", dias: 0, modeloId: "m1" }], modeloId: "m1" }];
  const r = PA.proximaAcao(entrada([emFoco], { grupos }));
  assert.deepEqual(tipos(r), ["passo"]);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
