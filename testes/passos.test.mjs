// Testes dos passos sem repetição (3.19): lib/passos.ts e a leitura do campo passosJuntados (lib/tipos.ts).
// Uso: node testes/passos.test.mjs   (Node 22.18+ importa .ts direto)

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

const P = await import("../lib/passos.ts");
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

// ---------- cenário ----------

const passo = (id, texto, extra = {}) => ({ id, texto, feito: false, ...extra });
const registro = (id, data, passos, extra = {}) => T.normalizarRegistro({ id, data, tipo: "nota", titulo: id, proximosPassos: passos, criadoEm: `${data}T10:00:00.000Z`, ...extra });
const tarefa = (registros) => T.normalizarTarefa({ id: "t1", titulo: "Migrar o cadastro", registros });
const pessoas = [T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", apelidos: ["Marina"] }), T.normalizarPessoa({ id: "pe2", nome: "Bruno Lima" })];

const abertos = (t) => t.registros.flatMap((r) => r.proximosPassos.filter((p) => !p.feito));
const guardados = (t) => t.registros.flatMap((r) => r.passosJuntados ?? []);
/** A conta que nunca pode cair: todo passo que saiu da lista está guardado. */
const totalDePassos = (t) => t.registros.reduce((n, r) => n + r.proximosPassos.length + (r.passosJuntados?.length ?? 0), 0);

// O caso do defeito: a folha organizada e a reunião do mesmo dia trouxeram os mesmos três passos.
const doDefeito = () =>
  tarefa([
    registro("rNota", "2026-03-10", [passo("n1", "Validar o layout com o time"), passo("n2", "Enviar a planilha para Marina", { responsavel: "Marina" }), passo("n3", "Agendar a revisão")]),
    registro("rReuniao", "2026-03-10", [passo("m1", "Validar o layout com o time."), passo("m2", "enviar a planilha para marina", { responsavel: "Marina Souza" }), passo("m3", "Agendar a revisão", { prazo: "2026-03-20" })], { tipo: "reuniao" }),
  ]);

L.definirMeusNomes([]);

// ---------- chaves ----------

teste("chaveDoPasso: acento, maiúsculas, pontuação e espaços não fazem outro passo", () => {
  assert.equal(P.chaveDoPasso("  Enviar a   planilha, até sexta! "), P.chaveDoPasso("enviar a planilha ate sexta"));
  assert.notEqual(P.chaveDoPasso("Enviar a planilha"), P.chaveDoPasso("Enviar a planilha nova"));
  assert.equal(P.chaveDoPasso(null), "");
  assert.equal(P.chaveDoPasso("..."), "");
});

teste("chaveDoResponsavel: eu, cadastro (com apelido) e nome solto", () => {
  assert.equal(P.chaveDoResponsavel("", pessoas), "");
  assert.equal(P.chaveDoResponsavel("Eu", pessoas), "eu");
  assert.equal(P.chaveDoResponsavel("Marina", pessoas), "id:pe1");
  assert.equal(P.chaveDoResponsavel("marina souza", pessoas), "id:pe1");
  assert.equal(P.chaveDoResponsavel("Carla", pessoas), "nome:carla");
  L.definirMeusNomes(["Rafa"]);
  assert.equal(P.chaveDoResponsavel("rafa", pessoas), "eu");
  L.definirMeusNomes([]);
});

// ---------- achar ----------

teste("passosRepetidos: acha os três do defeito e mantém o da reunião (mesmo dia)", () => {
  const grupos = P.passosRepetidos(doDefeito(), pessoas);
  assert.equal(grupos.length, 3);
  assert.deepEqual(grupos.map((g) => g.fica.passo.id).sort(), ["m1", "m2", "m3"]);
  assert.deepEqual(grupos.map((g) => g.saem.map((x) => x.passo.id)).flat().sort(), ["n1", "n2", "n3"]);
  assert.equal(P.quantosRepetidos(doDefeito(), pessoas), 3);
});

teste("passosRepetidos: em dias diferentes, fica o do registro mais antigo", () => {
  const t = tarefa([registro("novo", "2026-03-12", [passo("b", "Agendar a revisão")]), registro("velho", "2026-03-01", [passo("a", "Agendar a revisão")])]);
  const [g] = P.passosRepetidos(t, pessoas);
  assert.equal(g.fica.passo.id, "a");
  assert.equal(g.saem[0].passo.id, "b");
});

teste("passosRepetidos: responsáveis diferentes nunca são o mesmo passo", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Revisar o contrato", { responsavel: "Marina" })]), registro("r2", "2026-03-02", [passo("b", "Revisar o contrato", { responsavel: "Bruno Lima" })])]);
  assert.equal(P.passosRepetidos(t, pessoas).length, 0);
  assert.equal(P.passosParecidos(t, pessoas).length, 0);
});

teste("passosRepetidos: sem o cadastro, 'Marina' e 'Marina Souza' não se juntam sozinhas", () => {
  assert.equal(P.passosRepetidos(doDefeito(), []).length, 2);
});

teste("passosRepetidos: sem responsável e 'Eu' são o mesmo dono; passo feito fica de fora", () => {
  const t = tarefa([
    registro("r1", "2026-03-01", [passo("a", "Fechar o relatório"), passo("f", "Ligar para o fornecedor", { feito: true })]),
    registro("r2", "2026-03-02", [passo("b", "Fechar o relatório", { responsavel: "Eu" }), passo("g", "Ligar para o fornecedor")]),
  ]);
  const grupos = P.passosRepetidos(t, pessoas);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].fica.passo.id, "a");
});

teste("passosRepetidos: três iguais viram um grupo com duas cópias", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Testar"), passo("b", "testar")]), registro("r2", "2026-03-02", [passo("c", "TESTAR.")])]);
  const [g] = P.passosRepetidos(t, pessoas);
  assert.equal(g.fica.passo.id, "a");
  assert.deepEqual(g.saem.map((x) => x.passo.id), ["b", "c"]);
});

teste("passosParecidos: texto contido em outro, mesmo dono; fica o mais completo", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Enviar o relatório")]), registro("r2", "2026-03-02", [passo("b", "Enviar o relatório ao Bruno até sexta")])]);
  assert.equal(P.passosRepetidos(t, pessoas).length, 0);
  const [par] = P.passosParecidos(t, pessoas);
  assert.equal(par.fica.passo.id, "b");
  assert.equal(par.sai.passo.id, "a");
  assert.equal(P.passosParecidos(t, pessoas, [par.chave]).length, 0, "dispensado não volta");
});

teste("passosParecidos: 'São diferentes' vale pelo texto, então a outra cópia do mesmo passo não volta a perguntar", () => {
  const t = tarefa([
    registro("r1", "2026-03-01", [passo("a", "Agendar a revisão"), passo("b", "Agendar a revisão com o time todo")], { tipo: "reuniao" }),
    registro("r2", "2026-03-01", [passo("c", "agendar a revisão.")]),
  ]);
  const pares = P.passosParecidos(t, pessoas);
  assert.equal(pares.length, 1);
  assert.equal(P.passosParecidos(t, pessoas, [pares[0].chave]).length, 0, "a cópia 'c' formaria o mesmo par com 'b'");
  // a chave é curta (cabe numa preferência) e muda com a tarefa
  assert.ok(pares[0].chave.length < 60);
  assert.notEqual(P.passosParecidos({ ...t, id: "t2" }, pessoas)[0].chave, pares[0].chave);
});

teste("passosParecidos: mesmo texto com nomes que parecem a mesma pessoa, quando o cadastro não diz que são duas", () => {
  assert.equal(P.passosParecidos(doDefeito(), []).length, 1, "'Marina' e 'Marina Souza' sem cadastro: pergunta");
  const duas = [T.normalizarPessoa({ id: "x1", nome: "Marina" }), T.normalizarPessoa({ id: "x2", nome: "Marina Souza" })];
  assert.equal(P.passosParecidos(doDefeito(), duas).length, 0, "duas pessoas diferentes no cadastro: não pergunta");
});

teste("passosParecidos: texto curto não casa por acaso", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Enviar")]), registro("r2", "2026-03-02", [passo("b", "Enviar o relatório ao Bruno")])]);
  assert.equal(P.passosParecidos(t, pessoas).length, 0);
});

teste("passosParecidos: texto igual com um lado sem responsável pergunta, não junta sozinho", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Revisar o contrato")]), registro("r2", "2026-03-02", [passo("b", "Revisar o contrato", { responsavel: "Marina" })])]);
  assert.equal(P.passosRepetidos(t, pessoas).length, 0);
  const pares = P.passosParecidos(t, pessoas);
  assert.equal(pares.length, 1);
  assert.equal(pares[0].fica.passo.id, "a");
});

// ---------- prevenção ----------

teste("passoJaAberto e separarPassosNovos: o que já está em aberto não entra de novo", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Validar o layout com o time"), passo("b", "Cobrar o orçamento", { responsavel: "Marina" }), passo("c", "Publicar a ata", { feito: true })])]);
  assert.equal(P.passoJaAberto(t, "validar o layout com o time.", "", pessoas)?.passo.id, "a");
  assert.equal(P.passoJaAberto(t, "Validar o layout com o time", "Bruno Lima", pessoas), undefined);
  assert.equal(P.passoJaAberto(t, "Publicar a ata", "", pessoas), undefined, "passo feito não impede criar de novo");
  assert.equal(P.passoJaAberto(t, "Validar o layout com o time", "", pessoas, "r1"), undefined, "o próprio registro fica de fora");
  const novos = [
    { texto: "Validar o layout com o time", responsavel: "" },
    { texto: "Cobrar o orçamento", responsavel: "Marina Souza" },
    { texto: "Publicar a ata", responsavel: "" },
    { texto: "Marcar a homologação", responsavel: "" },
    { texto: "marcar a homologação!", responsavel: "Eu" },
  ];
  const { entram, jaExistiam } = P.separarPassosNovos(t, novos, pessoas);
  assert.deepEqual(entram.map((p) => p.texto), ["Publicar a ata", "Marcar a homologação"]);
  assert.equal(jaExistiam.length, 3);
});

teste("semOsRepetidosEm: tira de uma lista o que já vem na outra", () => {
  const sobra = P.semOsRepetidosEm(
    [{ texto: "Agendar a revisão" }, { texto: "Escrever o roteiro" }, { texto: "Enviar a planilha", responsavel: "Marina" }],
    [{ texto: "agendar a revisão." }, { texto: "Enviar a planilha", responsavel: "Bruno Lima" }],
    pessoas,
  );
  assert.deepEqual(sobra.map((p) => p.texto), ["Escrever o roteiro", "Enviar a planilha"]);
});

// ---------- juntar e separar ----------

teste("comRepetidosJuntados: nenhum passo se perde, e rodar de novo não muda nada", () => {
  const antes = doDefeito();
  const depois = P.comRepetidosJuntados(antes, pessoas);
  assert.equal(abertos(depois).length, 3);
  assert.equal(guardados(depois).length, 3);
  assert.equal(totalDePassos(depois), totalDePassos(antes));
  assert.deepEqual(guardados(depois).map((p) => p.id).sort(), ["n1", "n2", "n3"]);
  assert.ok(guardados(depois).every((p) => p.juntadoEm && p.juntadoCom?.registroId === "rReuniao"));
  assert.equal(P.quantosRepetidos(depois, pessoas), 0);
  assert.equal(P.comRepetidosJuntados(depois, pessoas), depois, "sem repetidos devolve a mesma tarefa");
  assert.notEqual(depois, antes);
  assert.equal(abertos(antes).length, 6, "a tarefa de entrada não foi mexida");
});

teste("comPassoJuntado: herda o responsável que faltava e o prazo mais cedo", () => {
  const t = tarefa([
    registro("r1", "2026-03-01", [passo("a", "Revisar o contrato", { prazo: "2026-03-30" })]),
    registro("r2", "2026-03-02", [passo("b", "Revisar o contrato", { responsavel: "Marina", prazo: "2026-03-15" })]),
  ]);
  const d = P.comPassoJuntado(t, { registroId: "r1", passoId: "a" }, { registroId: "r2", passoId: "b" });
  const fica = abertos(d)[0];
  assert.equal(fica.id, "a");
  assert.equal(fica.responsavel, "Marina");
  assert.equal(fica.prazo, "2026-03-15");
  // o responsável que já existia não é trocado
  const d2 = P.comPassoJuntado(t, { registroId: "r2", passoId: "b" }, { registroId: "r1", passoId: "a" });
  assert.equal(abertos(d2)[0].responsavel, "Marina");
  assert.equal(abertos(d2)[0].prazo, "2026-03-15");
});

teste("comPassoJuntado: não mexe quando um dos dois já foi feito, não existe ou é o mesmo", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Testar"), passo("b", "Testar", { feito: true })])]);
  assert.equal(P.comPassoJuntado(t, { registroId: "r1", passoId: "a" }, { registroId: "r1", passoId: "b" }), t);
  assert.equal(P.comPassoJuntado(t, { registroId: "r1", passoId: "a" }, { registroId: "r1", passoId: "zz" }), t);
  assert.equal(P.comPassoJuntado(t, { registroId: "r1", passoId: "a" }, { registroId: "r1", passoId: "a" }), t);
});

teste("comPassoJuntado: dois passos do mesmo registro", () => {
  const t = tarefa([registro("r1", "2026-03-01", [passo("a", "Testar"), passo("b", "Testar")])]);
  const d = P.comRepetidosJuntados(t, pessoas);
  assert.deepEqual(abertos(d).map((p) => p.id), ["a"]);
  assert.deepEqual(guardados(d).map((p) => p.id), ["b"]);
});

teste("comPassoSeparado: devolve o passo como era", () => {
  const antes = doDefeito();
  const juntada = P.comRepetidosJuntados(antes, pessoas);
  let volta = juntada;
  for (const id of ["n1", "n2", "n3"]) volta = P.comPassoSeparado(volta, "rNota", id);
  assert.equal(guardados(volta).length, 0);
  assert.deepEqual(abertos(volta).map((p) => p.id).sort(), ["m1", "m2", "m3", "n1", "n2", "n3"]);
  const n2 = volta.registros.find((r) => r.id === "rNota").proximosPassos.find((p) => p.id === "n2");
  assert.deepEqual(n2, antes.registros.find((r) => r.id === "rNota").proximosPassos.find((p) => p.id === "n2"));
  assert.equal("juntadoEm" in n2, false);
  assert.equal(P.comPassoSeparado(volta, "rNota", "n1"), volta, "separar o que não está guardado não muda nada");
  assert.equal(P.comPassoSeparado(volta, "nao-existe", "n1"), volta);
});

teste("textoDoPassoQueFicou: acha o passo que ficou, ou vazio se ele sumiu", () => {
  const d = P.comRepetidosJuntados(doDefeito(), pessoas);
  const g = guardados(d).find((p) => p.id === "n3");
  assert.equal(P.textoDoPassoQueFicou(d, g), "Agendar a revisão");
  assert.equal(P.textoDoPassoQueFicou({ ...d, registros: d.registros.filter((r) => r.id !== "rReuniao") }, g), "");
});

// ---------- o campo no arquivo ----------

teste("normalizarRegistro: passosJuntados vai e volta, e registro sem junção não ganha o campo", () => {
  const d = P.comRepetidosJuntados(doDefeito(), pessoas);
  const ida = JSON.parse(JSON.stringify(d));
  const volta = T.normalizarTarefa(ida);
  assert.deepEqual(volta.registros.map((r) => r.passosJuntados), d.registros.map((r) => r.passosJuntados));
  assert.equal("passosJuntados" in volta.registros.find((r) => r.id === "rReuniao"), false);
  assert.equal("passosJuntados" in T.normalizarRegistro({ id: "x", passosJuntados: [] }), false);
  assert.equal("passosJuntados" in T.normalizarRegistro({ id: "x", passosJuntados: "lixo" }), false);
  const sujo = T.normalizarRegistro({ id: "x", passosJuntados: [null, 7, { id: "p9", texto: "Algo", feito: true, juntadoCom: { registroId: 3 }, extra: "fica" }] });
  assert.equal(sujo.passosJuntados.length, 1);
  assert.equal(sujo.passosJuntados[0].feito, false);
  assert.equal(sujo.passosJuntados[0].juntadoCom, null);
  assert.equal(sujo.passosJuntados[0].extra, "fica", "campo desconhecido é preservado");
  assert.ok(sujo.passosJuntados[0].juntadoEm);
});

teste("versão antiga: quem não conhece o campo e faz spread no registro não perde os passos juntados", () => {
  const d = P.comRepetidosJuntados(doDefeito(), pessoas);
  // a 3.18 lia o registro assim: spread e os campos que conhecia por cima
  const comoA318 = (r) => ({ ...r, proximosPassos: r.proximosPassos.map((p) => ({ ...p })) });
  const gravado = { ...d, registros: d.registros.map(comoA318) };
  assert.equal(guardados(T.normalizarTarefa(JSON.parse(JSON.stringify(gravado)))).length, 3);
});

// ---------- cobrança ----------

teste("mensagemDePendencias: uma linha por passo, com a tarefa, desde quando e o prazo", () => {
  const texto = P.mensagemDePendencias("Marina Souza", [
    { tarefa: { titulo: "Migrar o cadastro" }, registro: { data: "2026-03-10" }, passo: { texto: "Enviar a planilha", prazo: "2026-03-20" } },
    { tarefa: { titulo: "Contrato novo" }, registro: { data: "2026-03-02" }, passo: { texto: "Revisar a minuta", prazo: null } },
  ]);
  const linhas = texto.split("\n");
  assert.equal(linhas[0], "Pendências com Marina Souza:");
  assert.equal(linhas.length, 3);
  assert.match(linhas[1], /^- Enviar a planilha \(Migrar o cadastro, desde .+, prazo .+\)$/);
  assert.match(linhas[2], /^- Revisar a minuta \(Contrato novo, desde [^,]+\)$/);
  assert.equal(texto.includes("—"), false);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
