// Testes da jornada: lib/jornada.ts (plano do dia, ponto, saída prevista, hora extra, avisos e banco de horas)
// e os normalizadores da jornada em lib/tipos.ts.
// Uso: node testes/jornada.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/jornada.test.mjs)

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

// 2026-11-16 é segunda; 2026-11-21 é sábado
const SEG = "2026-11-16";
const TER = "2026-11-17";
const SAB = "2026-11-21";
const config = (extra = {}) => T.normalizarConfigDaJornada(extra);
const dia = (data, extra = {}) => T.normalizarDiaDaJornada({ id: data, ...extra });
const ponto = (entrada, saida = null, pausas = []) => ({ entrada, saida, pausas });
const bloco = (inicio, fim, titulo, tipo = "atividade", extra = {}) => T.normalizarBloco({ id: "b" + inicio.replace(":", "") + titulo.replace(/\W/g, ""), inicio, fim, titulo, tipo, ...extra });
const jornada = (items) => J.lerJornada({ rev: 1, items: items.map(T.normalizarItemDaJornada) });
const m = J.emMinutos;

teste("horas: ler, escrever e durar", () => {
  assert.equal(m("08:30"), 510);
  assert.equal(J.emHora(510), "08:30");
  assert.equal(J.emHora(1500), "01:00", "passou da meia-noite dá a volta");
  assert.equal(J.duracao(480), "8h");
  assert.equal(J.duracao(90), "1h30");
  assert.equal(J.duracao(45), "45 min");
  assert.equal(J.saldoEmTexto(90), "+1h30");
  assert.equal(J.saldoEmTexto(-20), "−0h20");
  assert.equal(J.saldoEmTexto(0), "0h00");
  for (const [entra, sai] of [["8", "08:00"], ["815", "08:15"], ["8:15", "08:15"], ["08h15", "08:15"], ["1730", "17:30"], ["8:5", "08:50"], ["24:00", ""], ["8:61", ""], ["abc", ""], ["", ""], ["12345", ""]])
    assert.equal(J.lerHora(entra), sai, `lerHora(${JSON.stringify(entra)})`);
  assert.equal(J.lerSaldo("1:30"), 90);
  assert.equal(J.lerSaldo("-0:45"), -45);
  assert.equal(J.lerSaldo("+2"), 120);
  assert.equal(J.lerSaldo("−3h10"), -190);
  assert.equal(J.lerSaldo(""), 0);
  assert.equal(J.lerSaldo("1:75"), null);
  assert.equal(J.lerSaldo("muito"), null);
});

teste("semana de segunda a domingo e os dias do mês", () => {
  assert.deepEqual(J.semanaDe("2026-11-19"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.equal(J.semanaDe("2026-11-22")[0], "2026-11-16", "domingo fecha a semana, não abre");
  assert.equal(J.mesDe("2026-02-10").length, 28);
  assert.equal(J.diaDaSemana(SEG), 1);
});

teste("padrão Brasil: 8h de trabalho + 1h de almoço = 9h; entrou 08:12, sai 17:12", () => {
  const c = config();
  assert.equal(c.jornadaMin, 480);
  assert.equal(c.pausaMin, 60);
  assert.deepEqual(c.diasDeTrabalho, [1, 2, 3, 4, 5]);
  const d = J.comEntrada(dia(SEG), "08:12", c);
  const conta = J.contarPonto(c, d, SEG, m("10:00"));
  assert.equal(conta.estado, "aberto");
  assert.equal(J.emHora(conta.saidaPrevista), "17:12");
  assert.equal(conta.trabalhado, 108);
  assert.equal(conta.falta, m("17:12") - m("10:00"));
  assert.equal(conta.saldo, null, "dia aberto ainda não tem saldo");
});

teste("a pausa de verdade ajusta a hora de saída", () => {
  const c = config();
  let d = J.comEntrada(dia(SEG), "08:00", c);
  d = J.comPausaIniciada(d, "12:00");
  // em pausa há 20 min: ainda vale a 1h planejada
  let conta = J.contarPonto(c, d, SEG, m("12:20"));
  assert.equal(conta.emPausa, true);
  assert.equal(J.emHora(conta.saidaPrevista), "17:00");
  assert.equal(conta.trabalhado, 240, "o tempo em pausa não conta como trabalho");
  // a pausa passou de 1h: a saída vai junto
  conta = J.contarPonto(c, d, SEG, m("13:25"));
  assert.equal(J.emHora(conta.saidaPrevista), "17:25");
  // voltou com 45 min: sai 15 min mais cedo
  d = J.comPausaEncerrada(d, "12:45");
  conta = J.contarPonto(c, d, SEG, m("14:00"));
  assert.equal(conta.emPausa, false);
  assert.equal(J.emHora(conta.saidaPrevista), "16:45");
  assert.equal(conta.trabalhado, m("14:00") - m("08:00") - 45);
});

teste("fechar o dia: saldo, pausa aberta que termina na saída e reabrir", () => {
  const c = config();
  let d = J.comEntrada(dia(SEG), "08:00", c);
  d = J.comPausaEncerrada(J.comPausaIniciada(d, "12:00"), "13:00");
  d = J.comSaida(d, "17:30");
  let conta = J.contarPonto(c, d, SEG, null);
  assert.equal(conta.estado, "fechado");
  assert.equal(conta.trabalhado, 510);
  assert.equal(conta.saldo, 30);
  assert.equal(conta.extra, 30);
  // saiu no meio de uma pausa: a pausa termina na saída
  let e = J.comPausaIniciada(J.comEntrada(dia(TER), "08:00", c), "16:00");
  e = J.comSaida(e, "16:30");
  assert.deepEqual(e.ponto.pausas, [{ inicio: "16:00", fim: "16:30" }]);
  assert.equal(J.contarPonto(c, e, TER, null).trabalhado, 480);
  // reabrir tira só a saída
  const r = J.comDiaReaberto(d);
  assert.equal(r.ponto.saida, null);
  assert.equal(r.ponto.entrada, "08:00");
  assert.equal(r.ponto.pausas.length, 1);
});

teste("pausa não registrada: desconta a planejada em dia de mais de 6h (e dá para desligar)", () => {
  const c = config();
  const d = dia(SEG, { ponto: ponto("08:00", "17:00") });
  let conta = J.contarPonto(c, d, SEG, null);
  assert.equal(conta.pausaDescontada, true);
  assert.equal(conta.trabalhado, 480);
  assert.equal(conta.saldo, 0);
  // meio período: não desconta
  conta = J.contarPonto(c, dia(SEG, { ponto: ponto("08:00", "12:00") }), SEG, null);
  assert.equal(conta.pausaDescontada, false);
  assert.equal(conta.trabalhado, 240);
  assert.equal(conta.saldo, -240);
  // desligado: 9h contam como 9h
  conta = J.contarPonto(config({ descontarPausa: false }), d, SEG, null);
  assert.equal(conta.trabalhado, 540);
  assert.equal(conta.saldo, 60);
});

teste("ações do ponto recusam o que não faz sentido", () => {
  const c = config();
  const vazio = dia(SEG);
  assert.equal(J.comPausaIniciada(vazio, "12:00"), vazio, "pausa sem entrada");
  assert.equal(J.comSaida(vazio, "17:00"), vazio, "saída sem entrada");
  const d = J.comEntrada(vazio, "08:00", c);
  assert.equal(J.comSaida(d, "07:00"), d, "saída antes da entrada");
  assert.equal(J.comEntrada(vazio, "25:00", c), vazio, "hora que não existe");
  const emPausa = J.comPausaIniciada(d, "12:00");
  assert.equal(J.comPausaIniciada(emPausa, "12:10"), emPausa, "duas pausas abertas");
  assert.equal(J.comPausaEncerrada(emPausa, "12:00").ponto.pausas.length, 0, "voltou no mesmo minuto: a pausa não aconteceu");
});

teste("a jornada do dia fica fixada na entrada: mudar a configuração depois não mexe no saldo antigo", () => {
  const d = J.comSaida(J.comEntrada(dia(SEG), "08:00", config()), "17:00");
  assert.equal(d.jornadaMin, 480);
  const nova = config({ jornadaMin: 360 });
  assert.equal(J.contarPonto(nova, d, SEG, null).saldo, 0, "o dia antigo continua com 8h esperadas");
  assert.equal(J.contarPonto(nova, dia(TER, { ponto: ponto("08:00", "15:00") }), TER, null).esperado, 360);
});

teste("folga e fim de semana: nada é esperado, tudo o que trabalhar é extra", () => {
  const c = config();
  assert.equal(J.esperadoNoDia(c, undefined, SAB), 0);
  assert.equal(J.esperadoNoDia(c, dia(SEG, { folga: true }), SEG), 0);
  const conta = J.contarPonto(c, dia(SAB, { ponto: ponto("09:00", "12:00") }), SAB, null);
  assert.equal(conta.saldo, 180);
  assert.equal(conta.saidaPrevista, null);
  // sábado em aberto: sem hora de saída, e o trabalhado já é extra
  const aberto = J.contarPonto(c, dia(SAB, { ponto: ponto("09:00") }), SAB, m("10:30"));
  assert.equal(aberto.extra, 90);
});

teste("plano do dia: o dia padrão vale até a primeira mudança, e mexer copia o padrão para o dia", () => {
  const padraoSeg = [bloco("08:00", "10:00", "Chamados"), bloco("12:00", "13:00", "Almoço", "pausa")];
  const j = jornada([{ id: "config", padrao: { 1: padraoSeg } }]);
  let plano = J.blocosDoDia(j, SEG);
  assert.equal(plano.doPadrao, true);
  assert.deepEqual(plano.blocos.map((b) => b.titulo), ["Chamados", "Almoço"]);
  assert.equal(J.blocosDoDia(j, TER).blocos.length, 0, "terça não tem dia padrão");
  // acrescentar um bloco: o dia passa a ter plano próprio, com o padrão dentro
  const d = J.comBloco(J.diaDe(j, SEG), j.config, bloco("14:00", "15:00", "Revisar exceções", "tarefa", { tarefaId: "t1" }));
  assert.equal(d.planejado, true);
  assert.deepEqual(d.blocos.map((b) => b.titulo), ["Chamados", "Almoço", "Revisar exceções"]);
  // trocar pelo id e remover
  const trocado = J.comBloco(d, j.config, { ...d.blocos[0], fim: "11:00" });
  assert.equal(trocado.blocos.length, 3);
  assert.equal(trocado.blocos[0].fim, "11:00");
  assert.deepEqual(J.semBloco(trocado, j.config, trocado.blocos[1].id).blocos.map((b) => b.titulo), ["Chamados", "Revisar exceções"]);
  // limpar tudo é um plano vazio de propósito: o padrão não volta sozinho
  let limpo = d;
  for (const b of d.blocos) limpo = J.semBloco(limpo, j.config, b.id);
  const j2 = jornada([{ id: "config", padrao: { 1: padraoSeg } }, limpo]);
  assert.equal(J.blocosDoDia(j2, SEG).blocos.length, 0);
  assert.equal(J.blocosDoDia(j2, SEG).doPadrao, false);
  // voltar ao dia padrão
  const j3 = jornada([{ id: "config", padrao: { 1: padraoSeg } }, J.comDiaPadrao(limpo)]);
  assert.equal(J.blocosDoDia(j3, SEG).doPadrao, true);
});

teste("comDia e comConfig gravam na lista sem perder os outros itens", () => {
  let items = [];
  items = J.comConfig(items, (c) => ({ ...c, jornadaMin: 360 }));
  items = J.comDia(items, SEG, (d) => J.comEntrada(d, "08:00", J.lerJornada({ rev: 1, items }).config));
  items = J.comDia(items, TER, (d) => ({ ...d, folga: true }));
  items = J.comDia(items, SEG, (d) => J.comSaida(d, "15:00"));
  assert.deepEqual(items.map((i) => i.id), ["config", SEG, TER]);
  const j = J.lerJornada({ rev: 2, items });
  assert.equal(j.config.jornadaMin, 360);
  assert.equal(j.dias.get(SEG).ponto.saida, "15:00");
  assert.equal(j.dias.get(SEG).jornadaMin, 360);
  assert.equal(j.dias.get(TER).folga, true);
});

teste("hora extra planejada: trabalho além da jornada e blocos que passam do fim do expediente", () => {
  const plano = [
    bloco("08:00", "12:00", "Chamados"),
    bloco("12:00", "13:00", "Almoço", "pausa"),
    bloco("13:00", "17:00", "Projeto"),
    bloco("17:00", "18:30", "Janela de mudança"),
  ];
  const r = J.resumoDoPlano(plano, 480, 60);
  assert.equal(r.trabalho, 570);
  assert.equal(r.pausa, 60);
  assert.equal(r.extra, 90);
  assert.equal(r.livre, 0);
  assert.equal(J.emHora(r.fimDoExpediente), "17:00");
  assert.deepEqual([...r.alemDoExpediente], [plano[3].id]);
  // dentro da jornada: nada é extra, e o que sobra sem plano aparece
  const curto = J.resumoDoPlano(plano.slice(0, 2), 480, 60);
  assert.equal(curto.extra, 0);
  assert.equal(curto.livre, 240);
  assert.equal(curto.alemDoExpediente.size, 0);
  // com a entrada de verdade, vale a saída prevista do ponto
  const atrasado = J.resumoDoPlano(plano, 480, 60, m("17:40"));
  assert.equal(J.emHora(atrasado.fimDoExpediente), "17:40");
  assert.deepEqual([...atrasado.alemDoExpediente], [plano[3].id]);
  // folga: tudo é extra
  const folga = J.resumoDoPlano(plano.slice(0, 1), 0, 60);
  assert.equal(folga.extra, 240);
  assert.equal(folga.alemDoExpediente.size, 1);
  // blocos sobrepostos não contam em dobro
  assert.equal(J.minutosCobertos([bloco("08:00", "10:00", "A"), bloco("09:00", "11:00", "B")]), 180);
});

teste("o bloco de agora, o próximo e o primeiro horário vago", () => {
  const plano = [bloco("08:00", "10:00", "Chamados"), bloco("10:30", "12:00", "Projeto"), bloco("12:00", "13:00", "Almoço", "pausa")];
  let a = J.blocoNoInstante(plano, m("09:20"));
  assert.equal(a.atual.titulo, "Chamados");
  assert.equal(a.restante, 40);
  assert.equal(a.proximo.titulo, "Projeto");
  assert.equal(a.emQuanto, 70);
  a = J.blocoNoInstante(plano, m("10:10"));
  assert.equal(a.atual, null);
  assert.equal(a.proximo.titulo, "Projeto");
  assert.equal(a.emQuanto, 20);
  a = J.blocoNoInstante(plano, m("13:00"));
  assert.equal(a.atual, null, "o fim do bloco já não é do bloco");
  assert.equal(a.proximo, null);
  assert.deepEqual(J.proximoVago(plano, m("08:05"), 30), { inicio: m("10:00"), fim: m("10:30") });
  assert.deepEqual(J.proximoVago(plano, m("08:05"), 60), { inicio: m("13:00"), fim: m("14:00") });
  assert.equal(J.proximoVago(plano, m("22:30"), 60), null, "não inventa horário depois das 23h");
});

teste("blocos sobrepostos ficam lado a lado", () => {
  const plano = [bloco("08:00", "10:00", "A"), bloco("09:00", "11:00", "B"), bloco("10:00", "10:30", "C"), bloco("14:00", "15:00", "D")];
  const col = J.emColunas(plano);
  assert.deepEqual(col.get(plano[0].id), { coluna: 0, colunas: 2 });
  assert.deepEqual(col.get(plano[1].id), { coluna: 1, colunas: 2 });
  assert.deepEqual(col.get(plano[2].id), { coluna: 0, colunas: 2 });
  assert.deepEqual(col.get(plano[3].id), { coluna: 0, colunas: 1 });
});

teste("avisos: bloco que começa, que está acabando, jornada cumprida e pausa que terminou", () => {
  const c = config();
  const plano = [bloco("08:00", "10:00", "Chamados"), bloco("10:00", "12:00", "Projeto"), bloco("12:00", "13:00", "Almoço", "pausa")];
  let d = J.comEntrada(dia(SEG), "08:00", c);
  const em = (hora, diaAtual = d) => J.avisosDoMinuto(plano, J.contarPonto(c, diaAtual, SEG, m(hora)), diaAtual, 60, m(hora));
  assert.deepEqual(em("09:30"), [], "no meio de um bloco não há aviso");
  let a = em("09:55");
  assert.equal(a.length, 1);
  assert.equal(a[0].tipo, "termina");
  assert.match(a[0].titulo, /Chamados termina às 10:00/);
  assert.match(a[0].detalhe, /Depois: Projeto, às 10:00/);
  a = em("10:00");
  assert.deepEqual(a.map((x) => x.tipo), ["comeca"]);
  assert.match(a[0].titulo, /^Agora: Projeto/);
  assert.match(a[0].detalhe, /Até as 12:00 \(2h\)/);
  assert.equal(em("10:02")[0].chave, a[0].chave, "a mesma chave nos minutos seguintes, para não repetir");
  assert.deepEqual(em("10:05"), [], "depois da tolerância o aviso não aparece mais");
  assert.match(em("12:00")[0].titulo, /^Hora da pausa: Almoço/);
  assert.match(em("12:56")[0].detalhe, /o plano de hoje acaba/);
  // jornada cumprida
  a = em("17:00");
  assert.deepEqual(a.map((x) => x.tipo), ["saida"]);
  assert.match(a[0].titulo, /completou as 8h/);
  // pausa que terminou
  d = J.comPausaIniciada(d, "12:10");
  a = em("13:10", d).filter((x) => x.tipo === "pausa");
  assert.equal(a.length, 1);
  assert.match(a[0].titulo, /pausa de 1h terminou/);
  // dia fechado não avisa de saída
  const fechado = J.comSaida(J.comEntrada(dia(SEG), "08:00", c), "16:00");
  assert.deepEqual(J.avisosDoMinuto([], J.contarPonto(c, fechado, SEG, m("17:00")), fechado, 60, m("17:00")), []);
});

teste("banco de horas: semana, mês e acumulado; dia sem registro e dia sem saída não contam", () => {
  const j = jornada([
    { id: "config", saldoInicialMin: 120 },
    { id: "2026-10-30", ponto: ponto("08:00", "18:00") },                    // +1h, mês anterior
    { id: "2026-11-09", ponto: ponto("08:00", "16:30") },                    // −0h30, semana anterior
    { id: SEG, ponto: ponto("08:00", "17:45") },                             // +0h45
    { id: TER, ponto: ponto("08:00", "17:00", [{ inicio: "12:00", fim: "13:30" }]) }, // −0h30
    { id: "2026-11-18", ponto: ponto("08:00") },                             // esqueceu a saída
    { id: "2026-11-19", folga: true },                                       // feriado, sem ponto
    { id: SAB, ponto: ponto("09:00", "11:00") },                             // +2h (sábado)
  ]);
  const hoje = "2026-11-23";
  const b = J.bancoDeHoras(j, "2026-11-22", hoje);
  assert.equal(b.semana.saldo, 45 - 30 + 120);
  assert.equal(b.semana.dias, 3);
  assert.equal(b.mes.saldo, -30 + 45 - 30 + 120);
  assert.equal(b.total.saldo, 120 + 60 - 30 + 45 - 30 + 120, "o acumulado soma o saldo inicial");
  assert.deepEqual(b.semSaida, ["2026-11-18"]);
  // visto de uma data anterior, o acumulado para nela
  assert.equal(J.bancoDeHoras(j, "2026-10-31", hoje).total.saldo, 120 + 60);
  // as linhas dizem por que um dia não entra
  assert.equal(J.linhaDoDia(j, "2026-11-18", hoje, null).estado, "sem-saida");
  assert.equal(J.linhaDoDia(j, "2026-11-18", hoje, null).saldo, null);
  assert.equal(J.linhaDoDia(j, "2026-11-19", hoje, null).estado, "folga");
  assert.equal(J.linhaDoDia(j, "2026-11-20", hoje, null).estado, "sem-registro");
  assert.equal(J.linhaDoDia(j, "2026-11-20", hoje, null).saldo, null, "sexta sem registro não vira −8h");
  assert.equal(J.linhaDoDia(j, "2026-11-22", hoje, null).estado, "folga", "domingo sem ponto é folga");
  // hoje em aberto: mostra o trabalhado até agora, sem saldo
  const j2 = jornada([{ id: hoje, ponto: ponto("08:00") }]);
  const l = J.linhaDoDia(j2, hoje, hoje, m("10:00"));
  assert.equal(l.estado, "aberto");
  assert.equal(l.trabalhado, 120);
  assert.equal(l.saldo, null);
  assert.equal(J.bancoDeHoras(j2, hoje, hoje).total.saldo, 0);
});

teste("o mês em texto: só o que foi registrado, com os saldos", () => {
  const j = jornada([
    { id: SEG, ponto: ponto("08:00", "17:45") },
    { id: "2026-11-18", ponto: ponto("08:00") },
  ]);
  const t = J.textoDoBanco(j, SEG, "2026-11-23");
  assert.match(t, /^Banco de horas de novembro de 2026/);
  assert.match(t, /16\/11 \(seg\): 08:00 a 17:45, pausa 1h \(não registrada, descontada\), trabalhado 8h45, saldo \+0h45/);
  assert.match(t, /18\/11 \(qua\): entrada 08:00, sem saída registrada/);
  assert.match(t, /Saldo do mês: \+0h45 \(1 dia, 8h45 trabalhadas\)/);
  assert.ok(!t.includes("17/11"), "dia sem registro não aparece");
  assert.ok(!t.includes("—"), "sem travessão");
  assert.match(J.textoDoBanco(jornada([]), SEG, "2026-11-23"), /Nenhum dia registrado/);
});

teste("normalizadores: o que vem torto vira algo válido, sem perder o que é desconhecido", () => {
  const b = T.normalizarBloco({ id: "../x", inicio: "25:00", fim: "07:00", titulo: "  Algo  ", tipo: "festa", tarefaId: "t1", campoNovo: 7 });
  assert.match(b.id, /^bl/, "id que não serve é trocado");
  assert.equal(b.inicio, "08:00");
  assert.equal(b.fim, "09:00", "fim antes do início vira início + 1h");
  assert.equal(b.tipo, "atividade");
  assert.equal(b.tarefaId, null, "só bloco de tarefa aponta para tarefa");
  assert.equal(b.titulo, "Algo");
  assert.equal(b.campoNovo, 7, "campo de versão mais nova é preservado");
  assert.equal(T.normalizarBloco({ inicio: "23:58", fim: "23:59" }).inicio, "23:54");
  const d = T.normalizarDiaDaJornada({ id: SEG, ponto: { entrada: "08:00", saida: "07:00", pausas: [{ inicio: "12:00", fim: "11:00" }, { inicio: "xx" }, null], futuro: 1 }, blocos: "nada", jornadaMin: "abc", extra: true });
  assert.equal(d.tipo, "dia");
  assert.equal(d.data, SEG);
  assert.equal(d.ponto.saida, null, "saída antes da entrada não vale");
  assert.deepEqual(d.ponto.pausas, [{ inicio: "12:00", fim: null }]);
  assert.equal(d.ponto.futuro, 1);
  assert.deepEqual(d.blocos, []);
  assert.equal(d.jornadaMin, 480);
  assert.equal(d.extra, true);
  assert.equal(T.normalizarPonto({ saida: "17:00" }).saida, null, "sem entrada não há saída");
  const c = T.normalizarConfigDaJornada({ jornadaMin: 99999, pausaMin: -5, diasDeTrabalho: [5, 5, 9, "2", -1], saldoInicialMin: "x", padrao: { 1: [{ inicio: "08:00", fim: "09:00", titulo: "A", feito: true }], 9: [{}], __proto__: { 2: [{}] } } });
  assert.equal(c.jornadaMin, 960);
  assert.equal(c.pausaMin, 0);
  assert.deepEqual(c.diasDeTrabalho, [2, 5]);
  assert.equal(c.saldoInicialMin, 0);
  assert.deepEqual(Object.keys(c.padrao), ["0", "1", "2", "3", "4", "5", "6"]);
  assert.equal(c.padrao["1"][0].feito, false, "o dia padrão não guarda o que foi cumprido");
  assert.equal(T.normalizarItemDaJornada({ id: "config" }).tipo, "config");
  assert.equal(T.normalizarItemDaJornada({ id: SEG }).tipo, "dia");
  assert.equal(T.dataReal("2026-02-30"), false);
  assert.equal(T.dataReal("2026-02-28"), true);
  // coleção ausente (dados de versão antiga) vale como vazia
  assert.equal(J.lerJornada(undefined).dias.size, 0);
  assert.equal(J.lerJornada(undefined).config.jornadaMin, 480);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
