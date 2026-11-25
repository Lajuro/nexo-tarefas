// Testes de "Links e documentos" como material de trabalho (3.14): lib/links.ts, a leitura do campo antigo
// (normalizarLink em lib/tipos.ts), os lembretes de chamado (lib/lembretes.ts), o link interno para folhas
// (lib/texto-rico.ts, lib/ligacoes.ts) e os vínculos órfãos (lib/integridade.ts).
// Uso: node testes/links.test.mjs   (Node 22.18+ importa .ts direto)

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

const K = await import("../lib/links.ts");
const L = await import("../lib/lembretes.ts");
const T = await import("../lib/tipos.ts");
const R = await import("../lib/texto-rico.ts");
const G = await import("../lib/ligacoes.ts");
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

// As contas usam o dia de hoje: as datas do teste são relativas a ele (no fuso de quem roda).
const p2 = (n) => String(n).padStart(2, "0");
const dia = (delta) => { const d = new Date(); d.setDate(d.getDate() + delta); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const meioDia = (delta) => { const d = new Date(); d.setDate(d.getDate() + delta); d.setHours(12, 0, 0, 0); return d.toISOString(); };
const tarefa = (x) => T.normalizarTarefa({ criadaEm: meioDia(-40), atualizadaEm: meioDia(-1), status: "em_andamento", registros: [{ id: `r-${x.id}`, tipo: "atividade", data: dia(0), titulo: "hoje", proximosPassos: [{ id: `p-${x.id}`, texto: "seguir", feito: false }] }], ...x });
const link = (x) => T.normalizarLink({ tipo: "link", titulo: "Chamado 123", url: "https://exemplo.local/chamado/123", criadoEm: meioDia(-30), ...x });

// ---------- dados antigos e versões antigas ----------

teste("link gravado até a 3.13 (só tarefaId) abre com a tarefa na lista, sem perder nada", () => {
  const l = T.normalizarLink({ id: "l1", titulo: "Runbook", url: "https://exemplo.local", tarefaId: "t1", campoDoFuturo: { x: 1 } });
  assert.deepEqual(l.tarefaIds, ["t1"]);
  assert.equal(l.tarefaId, "t1");
  assert.equal(l.estado, null);
  assert.equal(l.estadoEm, null);
  assert.deepEqual(l.trava, []);
  assert.deepEqual(l.campoDoFuturo, { x: 1 }, "campo desconhecido continua lá");
  assert.deepEqual(T.normalizarLink({ id: "l2", titulo: "Solto" }).tarefaIds, []);
  assert.equal(T.normalizarLink({ id: "l2", titulo: "Solto" }).tarefaId, null);
});

teste("o campo antigo é sempre gravado igual à primeira tarefa da lista (uma versão antiga ainda mostra o link)", () => {
  const l = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: ["t1", "t2", "t3"], tarefaId: "t1" });
  assert.equal(l.tarefaId, "t1");
  assert.deepEqual(l.tarefaIds, ["t1", "t2", "t3"]);
  assert.equal(K.comTarefasNoLink(l, ["t2", "t3"]).tarefaId, "t2");
  assert.equal(K.comTarefasNoLink(l, []).tarefaId, null);
});

teste("versão antiga mexeu no vínculo: o que ela fez vale (desvincular não volta, trocar troca)", () => {
  // a versão antiga só conhece tarefaId e preserva tarefaIds sem entender
  const desvinculou = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: ["t1", "t2"], tarefaId: null });
  assert.deepEqual(desvinculou.tarefaIds, ["t2"], "tirou a primeira, que era a que ela mostrava");
  assert.equal(desvinculou.tarefaId, "t2");
  const trocou = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: ["t1", "t2"], tarefaId: "t9" });
  assert.deepEqual(trocou.tarefaIds, ["t9", "t2"]);
  const trocouPorUmaQueJaTinha = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: ["t1", "t2"], tarefaId: "t2" });
  assert.deepEqual(trocouPorUmaQueJaTinha.tarefaIds, ["t2"]);
  const vinculou = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: [], tarefaId: "t5" });
  assert.deepEqual(vinculou.tarefaIds, ["t5"]);
  // normalizar de novo não muda nada (idempotente)
  for (const l of [desvinculou, trocou, trocouPorUmaQueJaTinha, vinculou]) assert.deepEqual(T.normalizarLink(l).tarefaIds, l.tarefaIds);
});

teste("entrada torta não vira vínculo: ids inválidos, repetidos, status e trava desconhecidos", () => {
  const l = T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: ["t1", "t1", "../etc", 7, null, "t2"], tarefaId: "t1", estado: "explodiu", estadoEm: "2026-01-01T10:00:00Z", trava: ["t2", "t9", "../x"] });
  assert.deepEqual(l.tarefaIds, ["t1", "t2"]);
  assert.equal(l.estado, null);
  assert.equal(l.estadoEm, null, "sem status não há carimbo");
  assert.deepEqual(l.trava, ["t2"], "só trava tarefa em que o link é usado");
  assert.deepEqual(T.normalizarLink({ id: "l1", titulo: "x", tarefaIds: "t1", tarefaId: "t1" }).tarefaIds, ["t1"]);
  assert.deepEqual(T.normalizarPagina({ id: "pg1", tarefaIds: ["t1", "t1", "a b", {}] }).tarefaIds, ["t1"]);
  assert.deepEqual(T.normalizarNota({ id: "n1", tarefaIds: "t1" }).tarefaIds, []);
  assert.deepEqual(T.normalizarNota({ id: "n1" }).tarefaIds, [], "folha antiga: lista vazia");
});

// ---------- um link em várias tarefas ----------

teste("usar e deixar de usar um link numa tarefa", () => {
  let l = link({ id: "l1" });
  l = K.comTarefaNoLink(l, "t1", true);
  l = K.comTarefaNoLink(l, "t2", true);
  assert.deepEqual(K.tarefasDoLink(l), ["t1", "t2"]);
  assert.equal(K.comTarefaNoLink(l, "t2", true), l, "já estava: nada muda");
  assert.ok(K.linkEhDaTarefa(l, "t2") && !K.linkEhDaTarefa(l, "t3"));
  const sem = K.comTarefaNoLink(l, "t1", false);
  assert.deepEqual(sem.tarefaIds, ["t2"]);
  assert.equal(sem.tarefaId, "t2");
  assert.equal(K.comTarefaNoLink(sem, "t1", false), sem);
});

teste("referenciasDaTarefa junta links, páginas e folhas ligados", () => {
  const dados = {
    links: { rev: 1, items: [link({ id: "l1", tarefaIds: ["t1", "t2"] }), link({ id: "l2", tarefaId: "t2" }), link({ id: "l3" })] },
    paginas: { rev: 1, items: [T.normalizarPagina({ id: "pg1", titulo: "Processo", tarefaIds: ["t1"] }), T.normalizarPagina({ id: "pg2", titulo: "Outra" })] },
    notas: { rev: 1, items: [T.normalizarNota({ id: "n1", texto: "rascunho", tarefaIds: ["t2", "t1"] })] },
  };
  const r1 = K.referenciasDaTarefa(dados, "t1");
  assert.deepEqual([r1.links.map((x) => x.id), r1.paginas.map((x) => x.id), r1.notas.map((x) => x.id)], [["l1"], ["pg1"], ["n1"]]);
  const r2 = K.referenciasDaTarefa(dados, "t2");
  assert.deepEqual(r2.links.map((x) => x.id), ["l1", "l2"]);
  assert.deepEqual(K.referenciasDaTarefa({ links: { rev: 0, items: [] } }, "t1"), { links: [], paginas: [], notas: [] }, "sem páginas nem notas (dado antigo)");
  assert.equal(K.nomeDaFolha({ titulo: "", texto: "## Reunião das 10h\ncorpo" }), "Reunião das 10h");
});

teste("juntar tarefas: o que servia à origem passa a servir ao destino, sem repetir e levando a trava", () => {
  const l = K.comTrava(link({ id: "l1", tarefaIds: ["t1", "t2"], estado: "aberto", estadoEm: meioDia(-1) }), "t1", true, meioDia(0));
  const j = K.comTarefaTrocada(l, "t1", "t9");
  assert.deepEqual(j.tarefaIds, ["t9", "t2"]);
  assert.equal(j.tarefaId, "t9");
  assert.deepEqual(j.trava, ["t9"]);
  const repetiria = K.comTarefaTrocada(link({ id: "l2", tarefaIds: ["t1", "t2"] }), "t1", "t2");
  assert.deepEqual(repetiria.tarefaIds, ["t2"]);
  const pagina = K.comTarefaTrocada(T.normalizarPagina({ id: "pg1", tarefaIds: ["t1"] }), "t1", "t9");
  assert.deepEqual(pagina.tarefaIds, ["t9"]);
  assert.ok(!("tarefaId" in pagina), "página não ganha o campo antigo dos links");
  const outro = link({ id: "l3", tarefaIds: ["t5"] });
  assert.equal(K.comTarefaTrocada(outro, "t1", "t9"), outro, "quem não era da origem fica igual");
});

// ---------- status ----------

teste("status: o carimbo só anda quando o status muda de verdade", () => {
  const l0 = link({ id: "l1" });
  const l1 = K.comEstado(l0, "aberto", "2026-11-10T12:00:00.000Z");
  assert.equal(l1.estado, "aberto");
  assert.equal(l1.estadoEm, "2026-11-10T12:00:00.000Z");
  assert.equal(K.comEstado(l1, "aberto", "2026-11-12T12:00:00.000Z"), l1, "mesmo status: nada muda");
  const l2 = K.comEstado(l1, "concluido", "2026-11-13T12:00:00.000Z");
  assert.equal(l2.estadoEm, "2026-11-13T12:00:00.000Z");
  const l3 = K.comEstado(l2, null, "2026-11-14T12:00:00.000Z");
  assert.equal(l3.estado, null);
  assert.equal(l3.estadoEm, null);
  assert.equal(K.comEstado(l0, "inventado", "x").estado, null, "status de fora da lista não entra");
});

teste("o que cada status quer dizer: em aberto, chamado em aberto, filtros e textos", () => {
  const com = (estado) => link({ id: "l", estado, estadoEm: meioDia(-3) });
  assert.deepEqual(T.ESTADOS_LINK.filter((e) => K.estadoAberto({ estado: e.id })).map((e) => e.id), ["para_ler", "aberto", "em_andamento", "aguardando"]);
  assert.deepEqual(T.ESTADOS_LINK.filter((e) => K.chamadoAberto({ estado: e.id })).map((e) => e.id), ["aberto", "em_andamento", "aguardando"]);
  assert.ok(!K.estadoAberto(link({ id: "l" })), "sem status não pede nada");
  assert.equal(K.resumoDoEstado(com("aberto")), "Aberto há 3 dias");
  assert.equal(K.resumoDoEstado(link({ id: "l", estado: "lido", estadoEm: meioDia(0) })), "Lido hoje");
  assert.equal(K.resumoDoEstado(link({ id: "l", estado: "aguardando", estadoEm: meioDia(-1) })), "Aguardando retorno desde ontem");
  assert.equal(K.resumoDoEstado(link({ id: "l" })), "");
  assert.equal(K.nomeDoEstado(null), "Sem status");
  assert.ok(K.passaNoFiltro(com("aberto"), "abertos") && !K.passaNoFiltro(com("concluido"), "abertos"));
  assert.ok(K.passaNoFiltro(link({ id: "l" }), "sem") && !K.passaNoFiltro(com("lido"), "sem"));
  assert.ok(K.passaNoFiltro(com("lido"), "lido") && !K.passaNoFiltro(com("lido"), "para_ler") && K.passaNoFiltro(com("lido"), ""));
});

// ---------- trava ----------

teste("travar: é por tarefa, põe Aberto em quem não tinha status e só vale enquanto o chamado está em aberto", () => {
  const agora = meioDia(0);
  const l0 = link({ id: "l1", tarefaIds: ["t1", "t2"] });
  const l1 = K.comTrava(l0, "t1", true, agora);
  assert.equal(l1.estado, "aberto", "sem status, travar põe Aberto");
  assert.ok(K.travando(l1, "t1") && !K.travando(l1, "t2"), "trava a t1, é só referência na t2");
  assert.deepEqual(K.travasDaTarefa([l1], "t1").map((x) => x.id), ["l1"]);
  assert.deepEqual(K.travasDaTarefa([l1], "t2"), []);
  assert.equal(K.comTrava(l0, "t7", true, agora), l0, "não trava tarefa em que o link não é usado");
  const mantem = K.comTrava(link({ id: "l2", tarefaIds: ["t1"], estado: "aguardando", estadoEm: meioDia(-4) }), "t1", true, agora);
  assert.equal(mantem.estado, "aguardando", "status em aberto continua o mesmo");
  assert.equal(mantem.estadoEm, meioDia(-4));
  const concluido = K.comEstado(l1, "concluido", agora);
  assert.ok(!K.travando(concluido, "t1"), "chamado concluído não trava");
  assert.ok(K.marcadoComoTrava(concluido, "t1"));
  assert.equal(K.destravouPeloLink(concluido, "t1"), dia(0));
  assert.equal(K.destravouPeloLink(concluido, "t2"), "", "não travava a t2");
  assert.equal(K.destravouPeloLink(l1, "t1"), "", "ainda em aberto: não destravou");
  const reaberto = K.comTrava(concluido, "t1", true, agora);
  assert.equal(reaberto.estado, "aberto", "travar de novo algo fechado reabre");
  const solto = K.comTrava(l1, "t1", false, agora);
  assert.deepEqual(solto.trava, []);
  assert.equal(solto.estado, "aberto", "soltar a trava não mexe no status");
  assert.deepEqual(K.comTarefaNoLink(l1, "t1", false).trava, [], "desvincular da tarefa tira a trava dela");
});

teste("o impedimento do chamado vira registro na linha do tempo, só com o que o usuário escreveu", () => {
  const t = A.comImpedimentoDoLink(tarefa({ id: "t1", titulo: "Onboarding" }), "Chamado 123", "https://exemplo.local/chamado/123");
  const r = t.registros.at(-1);
  assert.equal(r.tipo, "impedimento");
  assert.equal(r.titulo, "Travada por “Chamado 123”");
  assert.equal(r.data, dia(0));
  assert.match(r.impedimentos, /Chamado 123/);
  assert.equal(r.anotacoes, "https://exemplo.local/chamado/123");
  const rede = A.comImpedimentoDoLink(tarefa({ id: "t2", titulo: "x" }), "Pasta", "\\\\servidor\\pasta").registros.at(-1);
  assert.equal(rede.anotacoes, "", "só endereço da web vai para as anotações");
});

// ---------- lembretes ----------

teste("lembrete: chamado em aberto há dias, uma vez por tarefa aberta que o usa", () => {
  const tarefas = [tarefa({ id: "t1", titulo: "Onboarding" }), tarefa({ id: "t2", titulo: "Hardening" }), tarefa({ id: "t3", titulo: "Fechada", status: "concluida" })];
  const parado = K.comTrava(link({ id: "l1", tarefaIds: ["t1", "t2", "t3"], estado: "aguardando", estadoEm: meioDia(-6) }), "t1", true, meioDia(0));
  const ls = L.gerarLembretes(tarefas, { links: [parado] }).filter((x) => x.tipo === "chamado_parado");
  assert.deepEqual(ls.map((x) => x.tarefaId).sort(), ["t1", "t2"], "tarefa fechada não lembra");
  const [daT1] = ls.filter((x) => x.tarefaId === "t1");
  const [daT2] = ls.filter((x) => x.tarefaId === "t2");
  assert.equal(daT1.gravidade, "atencao", "o que trava pede atenção");
  assert.match(daT1.titulo, /Chamado que trava: sem novidade há 6 dias/);
  assert.match(daT1.detalhe, /está travando a tarefa/);
  assert.equal(daT2.gravidade, "info", "o que é só referência fica de olho");
  assert.match(daT2.detalhe, /“Chamado 123” está como aguardando retorno\. Confira/);
  assert.notEqual(daT1.id, daT2.id);
});

teste("lembrete: chamado recente, leitura pendente e link sem status não lembram", () => {
  const tarefas = [tarefa({ id: "t1", titulo: "Onboarding" })];
  const quietos = [
    link({ id: "l1", tarefaIds: ["t1"], estado: "aberto", estadoEm: meioDia(-(L.LIMITES.chamadoParado - 1)) }),
    link({ id: "l2", tarefaIds: ["t1"], estado: "para_ler", estadoEm: meioDia(-30) }),
    link({ id: "l3", tarefaIds: ["t1"] }),
    link({ id: "l4", estado: "aberto", estadoEm: meioDia(-30) }), // em tarefa nenhuma
  ];
  assert.deepEqual(L.gerarLembretes(tarefas, { links: quietos }).filter((x) => x.tipo === "chamado_parado" || x.tipo === "destravou"), []);
  assert.deepEqual(L.gerarLembretes(tarefas).filter((x) => x.tipo === "chamado_parado"), [], "sem a lista de links, nada muda");
  const noLimite = link({ id: "l5", tarefaIds: ["t1"], estado: "aberto", estadoEm: meioDia(-L.LIMITES.chamadoParado) });
  assert.equal(L.gerarLembretes(tarefas, { links: [noLimite] }).filter((x) => x.tipo === "chamado_parado").length, 1);
});

teste("lembrete: o chamado que travava fechou, a tarefa destravou (some depois de uns dias, a não ser que ela siga bloqueada)", () => {
  const fechado = (haDias) => K.comEstado(K.comTrava(link({ id: "l1", tarefaIds: ["t1"], estado: "aberto", estadoEm: meioDia(-20) }), "t1", true, meioDia(-20)), "concluido", meioDia(-haDias));
  const de = (t, l) => L.gerarLembretes([t], { links: [l] }).filter((x) => x.tipo === "destravou");
  const [d] = de(tarefa({ id: "t1", titulo: "Onboarding" }), fechado(1));
  assert.match(d.titulo, /Destravou: “Chamado 123” está como concluído/);
  assert.equal(d.detalhe, "Ela pode andar agora.");
  assert.deepEqual(de(tarefa({ id: "t1", titulo: "Onboarding" }), fechado(20)), [], "faz tempo: não fica lembrando");
  const [ainda] = de(tarefa({ id: "t1", titulo: "Onboarding", status: "bloqueada" }), fechado(20));
  assert.match(ainda.detalhe, /tirar do status de espera/, "mas se a tarefa segue bloqueada, continua avisando");
  const semTrava = K.comEstado(link({ id: "l2", tarefaIds: ["t1"], estado: "aberto", estadoEm: meioDia(-9) }), "concluido", meioDia(-1));
  assert.deepEqual(de(tarefa({ id: "t1", titulo: "Onboarding" }), semTrava), [], "chamado que não travava não gera destravou");
  // o agrupamento por tarefa continua valendo: os motivos novos entram no grupo da tarefa
  const g = L.agruparLembretes(L.gerarLembretes([tarefa({ id: "t1", titulo: "Onboarding" })], { links: [fechado(1)] }));
  assert.equal(g.length, 1);
});

// ---------- citar uma folha ----------

teste("link interno para folha do bloco de notas: lê, monta e entra no índice de citações", () => {
  assert.equal(R.hrefInterno("nota", "n1abc"), "nexo:nota/n1abc");
  assert.deepEqual(R.linkInterno("nexo:nota/n1abc"), { tipo: "nota", alvo: "n1abc", rota: "/notas?n=n1abc" });
  for (const mau of ["nexo:nota/", "nexo:nota/a b", "nexo:nota/../x", "nexo:nota/n1?x=1", "nexo:notas/n1"]) assert.equal(R.linkInterno(mau), null, mau);
  assert.deepEqual(G.alvosDoTexto("ver [rascunho](nexo:nota/n1) e [a tarefa](nexo:tarefa/t1)").sort(), ["nota:n1", "tarefa:t1"]);
  const dados = {
    tarefas: [tarefa({ id: "t1", titulo: "Onboarding", descricao: "anotações soltas em [rascunho](nexo:nota/n1)" })],
    categorias: { rev: 1, items: [] }, links: { rev: 1, items: [] },
    notas: { rev: 1, items: [T.normalizarNota({ id: "n1", titulo: "rascunho", texto: "eu mesma [x](nexo:nota/n1)" })] },
    paginas: { rev: 1, items: [T.normalizarPagina({ id: "pg1", titulo: "Processo", texto: "saiu de [rascunho](nexo:nota/n1)" })] },
  };
  const citam = G.citacoesDe(G.indiceDeCitacoes(dados), "nota", "n1");
  assert.deepEqual(citam.map((c) => c.origem).sort(), ["pagina", "tarefa"], "a folha citar a si mesma não conta");
  assert.equal(R.paraTextoPlano("ver [rascunho](nexo:nota/n1)"), "ver rascunho");
});

// ---------- citar com "#" (3.25) ----------

teste("# lista primeiro o que é da tarefa (links, páginas, folhas) e depois o resto do banco", () => {
  const dados = {
    tarefas: [tarefa({ id: "t1", titulo: "Onboarding" }), tarefa({ id: "t2", titulo: "Pagamentos" })],
    links: { rev: 1, items: [
      link({ id: "l1", titulo: "Planilha de riscos", tarefaIds: ["t2"], criadoEm: meioDia(-1) }),
      link({ id: "l2", titulo: "Chamado 123", tarefaIds: ["t1"], estado: "aberto", estadoEm: meioDia(-3), criadoEm: meioDia(-20) }),
      link({ id: "l3", tipo: "arquivo", titulo: "Contrato", url: "", arquivo: "2026/abc-contrato.pdf", nomeArquivo: "contrato.pdf", tarefaIds: ["t1"], criadoEm: meioDia(-10) }),
      link({ id: "l4", titulo: "Pasta da rede", url: "\\\\servidor\\pasta", tarefaIds: ["t1"] }),
      link({ id: "l5", tipo: "arquivo", titulo: "Anexo torto", url: "", arquivo: "../fora.pdf", tarefaIds: ["t1"] }),
    ] },
    paginas: { rev: 1, items: [
      T.normalizarPagina({ id: "pg1", titulo: "Como pedir acesso", tarefaIds: ["t1"] }),
      T.normalizarPagina({ id: "pg2", titulo: "Sem tarefa" }),
      T.normalizarPagina({ id: "pg3", titulo: "Arquivada", tarefaIds: ["t1"], arquivadaEm: meioDia(-1) }),
    ] },
    notas: { rev: 1, items: [T.normalizarNota({ id: "n1", titulo: "Rascunho da reunião", tarefaIds: ["t1"] })] },
  };
  const lista = K.linksParaCitar(dados, ["t1"], { naTarefa: true });
  assert.deepEqual(lista.map((c) => c.chave), ["link:l3", "link:l2", "pagina:pg1", "nota:n1", "link:l1"], "da tarefa primeiro; caminho de rede, anexo torto, página arquivada e página sem tarefa ficam de fora");
  assert.deepEqual(lista.map((c) => c.daTarefa), [true, true, true, true, false]);
  const porChave = Object.fromEntries(lista.map((c) => [c.chave, c]));
  assert.equal(porChave["link:l2"].href, "https://exemplo.local/chamado/123", "o link entra com o endereço de verdade");
  assert.equal(porChave["link:l3"].href, "arquivos/2026/abc-contrato.pdf", "o arquivo entra como anexo da pasta de dados");
  assert.equal(R.anexoDoSrc(porChave["link:l3"].href), "2026/abc-contrato.pdf");
  assert.equal(porChave["pagina:pg1"].href, "nexo:pagina/pg1");
  assert.equal(porChave["nota:n1"].href, "nexo:nota/n1");
  assert.equal(porChave["link:l2"].dica, "Desta tarefa · Aberto há 3 dias");
  assert.equal(porChave["pagina:pg1"].dica, "Página desta tarefa");
  assert.equal(porChave["link:l1"].dica, "Link do banco");
  assert.match(porChave["link:l2"].palavras, /exemplo\.local/, "dá para achar pelo endereço");
  assert.match(porChave["link:l2"].palavras, /Aberto/, "e pelo status");

  // de uma página que serve à tarefa: a dica diz qual tarefa, e a própria página não aparece
  const daPagina = K.linksParaCitar(dados, ["t1"], { semPagina: "pg1" });
  assert.equal(daPagina.find((c) => c.chave === "link:l2").dica, "Da tarefa «Onboarding» · Aberto há 3 dias");
  assert.equal(daPagina.find((c) => c.chave === "nota:n1").dica, "Folha da tarefa «Onboarding»");
  assert.equal(daPagina.some((c) => c.chave === "pagina:pg1"), false);
  assert.equal(K.linksParaCitar(dados, ["t1"], { semNota: "n1" }).some((c) => c.chave === "nota:n1"), false, "a folha não cita a si mesma");

  // sem tarefa em volta (uma folha solta): só o banco, sem páginas nem folhas
  assert.deepEqual(K.linksParaCitar(dados, []).map((c) => c.chave), ["link:l1", "link:l3", "link:l2"]);
  // dado antigo, só com o campo tarefaId, também conta como da tarefa
  const antigo = { ...dados, links: { rev: 1, items: [T.normalizarLink({ id: "lv", tipo: "link", titulo: "Velho", url: "https://exemplo.local/v", tarefaId: "t1", criadoEm: meioDia(-5) })] } };
  assert.equal(K.linksParaCitar(antigo, ["t1"], { naTarefa: true })[0].daTarefa, true);
});

teste("# com um link novo: endereço vira endereço, o resto vira título", () => {
  assert.deepEqual(K.linkDoDigitado("https://exemplo.local/chamados/4521"), { titulo: "", url: "https://exemplo.local/chamados/4521" });
  assert.deepEqual(K.linkDoDigitado("  www.exemplo.local/a  "), { titulo: "", url: "https://www.exemplo.local/a" });
  assert.deepEqual(K.linkDoDigitado("Planilha de riscos"), { titulo: "Planilha de riscos", url: "" });
  assert.deepEqual(K.linkDoDigitado("javascript:alert(1)"), { titulo: "javascript:alert(1)", url: "" }, "esquema que não é http vira só texto do título");
  assert.deepEqual(K.linkDoDigitado(""), { titulo: "", url: "" });
  assert.equal(K.linkDoDigitado("x".repeat(500)).titulo.length, 200);
  assert.equal(K.hrefDoLink({ tipo: "link", url: "mailto:time@exemplo.local" }), "mailto:time@exemplo.local");
  assert.equal(K.hrefDoLink({ tipo: "link", url: "javascript:alert(1)" }), null);
  assert.equal(K.hrefDoLink({ tipo: "arquivo", arquivo: "2026/a b.pdf" }), "arquivos/2026/a%20b.pdf");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
