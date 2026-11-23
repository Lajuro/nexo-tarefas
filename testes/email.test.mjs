// Testes de "colar um e-mail num registro" (3.17): lib/email.ts. O cabeçalho do Outlook em português e em
// inglês, as datas, os nomes, o texto colado como entrada não confiável (nada dele vira marcação) e o que
// entra no registro sem trocar o que o usuário já escreveu.
// Uso: node testes/email.test.mjs   (Node 22.18+ importa .ts direto)

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

const E = await import("../lib/email.ts");
const T = await import("../lib/tipos.ts");
const L = await import("../lib/lembretes.ts");
const R = await import("../lib/texto-rico.ts");

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

const OUTLOOK = `De: Marina Souza <marina.souza@exemplo.local>
Enviada em: quinta-feira, 19 de novembro de 2026 14:32
Para: Bruno Lima <bruno.lima@exemplo.local>; Costa, Ana <ana.costa@exemplo.local>
Cc: felipe.arquitetura@exemplo.local
Assunto: RES: ENC: Gate do pipeline no squad de Pagamentos

Oi, Bruno.

O gate fica só para severidade crítica no começo.
Liberamos o acesso ao repositório até sexta.

Abs,
Marina`;

// ---------- cabeçalho ----------

teste("Outlook em português: assunto, data, hora, quem mandou e para quem", () => {
  const e = E.lerEmail(OUTLOOK);
  assert.equal(e.reconheceu, true);
  assert.equal(e.assunto, "Gate do pipeline no squad de Pagamentos", "RES: e ENC: saem do título");
  assert.deepEqual([e.data, e.hora], ["2026-11-19", "14:32"]);
  assert.deepEqual(e.de, { nome: "Marina Souza", email: "marina.souza@exemplo.local" });
  assert.deepEqual(e.para.map((p) => p.nome), ["Bruno Lima", "Ana Costa"], "“Sobrenome, Nome” é desinvertido");
  assert.deepEqual(e.cc, [{ nome: "Felipe Arquitetura", email: "felipe.arquitetura@exemplo.local" }], "só o e-mail: o nome sai dele");
  assert.match(e.corpo, /^Oi, Bruno\.\n\nO gate fica/);
  assert.doesNotMatch(e.corpo, /Assunto:/);
});

teste("Outlook em inglês, com AM/PM e mês primeiro", () => {
  const e = E.lerEmail("From: Ana Costa <ana@exemplo.local>\r\nSent: Thursday, November 19, 2026 2:05 PM\r\nTo: Bruno Lima <bruno@exemplo.local>, Carla Dias <carla@exemplo.local>\r\nSubject: FW: Access request\r\n\r\nBody here.");
  assert.equal(e.reconheceu, true);
  assert.deepEqual([e.assunto, e.data, e.hora], ["Access request", "2026-11-19", "14:05"]);
  assert.deepEqual(e.para.map((p) => p.nome), ["Bruno Lima", "Carla Dias"]);
  assert.equal(e.corpo, "Body here.");
});

teste("começa por uma linha de separação e tem campo que quebrou a linha", () => {
  const e = E.lerEmail("\n-----Mensagem original-----\nDe: Marina Souza\nEnviado: 19/11/2026 09:07\nPara: Bruno Lima; Ana Costa;\n  Carla Dias\nImportância: Alta\nAssunto: Acesso\n\nTexto.");
  assert.equal(e.reconheceu, true);
  assert.deepEqual(e.para.map((p) => p.nome), ["Bruno Lima", "Ana Costa", "Carla Dias"]);
  assert.deepEqual([e.data, e.hora, e.assunto, e.corpo], ["2026-11-19", "09:07", "Acesso", "Texto."]);
});

teste("texto sem cabeçalho entra inteiro no corpo", () => {
  const e = E.lerEmail("Oi, tudo bem?\nObs: o acesso saiu.\nDe: alguém no meio do texto");
  assert.equal(e.reconheceu, false);
  assert.deepEqual([e.assunto, e.de, e.para.length, e.data], ["", null, 0, ""]);
  assert.match(e.corpo, /^Oi, tudo bem\?/);
  assert.equal(E.lerEmail(null).corpo, "");
  assert.equal(E.lerEmail("Assunto: só um campo não basta\n\ntexto").reconheceu, false);
});

teste("texto enorme é cortado no teto e avisa", () => {
  const e = E.lerEmail("De: A\nAssunto: B\n\n" + "x".repeat(E.MAX_EMAIL + 5000));
  assert.equal(e.cortado, true);
  assert.ok(e.corpo.length <= E.MAX_EMAIL);
  assert.equal(E.lerEmail(OUTLOOK).cortado, false);
});

// ---------- datas ----------

teste("datas: os jeitos mais comuns e o que não é data", () => {
  const d = (s) => { const r = E.dataDoEmail(s); return `${r.data} ${r.hora}`.trim(); };
  assert.equal(d("quinta-feira, 5 de março de 2026 08:03"), "2026-03-05 08:03");
  assert.equal(d("19 de nov. de 2026, 14h32"), "2026-11-19 14:32");
  assert.equal(d("19/11/2026 14:32"), "2026-11-19 14:32");
  assert.equal(d("19/11/26"), "2026-11-19");
  assert.equal(d("11/19/2026 2:32 PM"), "2026-11-19 14:32");
  assert.equal(d("Thu, 19 Nov 2026 14:32:10 -0300"), "2026-11-19 14:32");
  assert.equal(d("2026-11-19 07:05"), "2026-11-19 07:05");
  assert.equal(d("Thursday, November 19, 2026 12:10 AM"), "2026-11-19 00:10");
  assert.equal(d("31/02/2026 10:00"), "", "data que não existe não vale");
  assert.equal(d("ontem à tarde"), "");
  assert.equal(d(""), "");
});

// ---------- nomes ----------

teste("pessoas do campo: ponto e vírgula, vírgula, aspas e repetidos", () => {
  const n = (s) => E.pessoasDoCampo(s).map((p) => p.nome);
  assert.deepEqual(n("Silva, João; Costa, Ana <ana@exemplo.local>; 'Bruno Lima' <bruno@exemplo.local>"), ["João Silva", "Ana Costa", "Bruno Lima"]);
  assert.deepEqual(n("Ana Costa <ana@exemplo.local>, Bruno Lima <bruno@exemplo.local>"), ["Ana Costa", "Bruno Lima"]);
  assert.deepEqual(n("Ana Costa; ana costa; ANA COSTA <ana@exemplo.local>"), ["Ana Costa"], "o mesmo nome não entra duas vezes");
  assert.deepEqual(n(""), []);
  assert.equal(E.pessoasDoCampo(Array.from({ length: 200 }, (_, i) => `Pessoa ${i}`).join("; ")).length, 60, "tem teto");
});

teste("assunto: tira os prefixos de resposta e encaminhamento, e tem teto", () => {
  assert.equal(E.assuntoLimpo("RE: RES: Fwd: ENC:   Acesso ao repositório"), "Acesso ao repositório");
  assert.equal(E.assuntoLimpo("Revisão do gate"), "Revisão do gate", "“Re” no começo de uma palavra fica");
  assert.equal(E.assuntoLimpo("a".repeat(900)).length, 300);
});

// ---------- o texto colado não vira marcação ----------

teste("o corpo vira Markdown sem formatação: o leitor do app devolve o mesmo texto", () => {
  const hostil = [
    "# não é título",
    "- não é lista",
    "1. nem numerada",
    "> nem citação",
    "**sem negrito** e _sem itálico_ e `sem código`",
    "[sem link](https://exemplo.local) ![sem imagem](https://exemplo.local/pixel.png)",
    "<img src=x onerror=alert(1)> <script>alert(1)</script> & pronto",
    "    recuo que viraria bloco de código",
    "Atenciosamente,",
    "-----",
    "| a | b |",
  ].join("\n");
  const md = E.textoComoMarkdown(hostil);
  // os tipos de nó que o leitor do app devolve: do texto colado só pode sair parágrafo, texto e quebra de linha
  const tipos = (texto) => [...new Set((JSON.stringify(R.analisarMarkdown(texto)).match(/"t":"[^"]+"/g) ?? []).map((x) => x.slice(5, -1)))].sort();
  assert.ok(tipos(hostil).some((t) => ["titulo", "lista", "citacao", "negrito", "link"].includes(t)), "sem escapar, o mesmo texto vira marcação (senão este teste não prova nada)");
  // o único "link" que sobra é o endereço escrito por extenso (https://...), que o leitor torna clicável como em
  // qualquer texto do app; o rótulo de um link ("sem link") e a imagem não viram nada
  assert.deepEqual(tipos(md), ["link", "paragrafo", "quebra", "texto"]);
  const links = [...JSON.stringify(R.analisarMarkdown(md)).matchAll(/"t":"link","href":"([^"]*)"/g)].map((m) => m[1]);
  assert.ok(links.length > 0 && links.every((h) => /^https:\/\/exemplo\.local/.test(h)), `link inesperado: ${links.join(", ")}`);
  const plano = R.paraTextoPlano(md);
  for (const trecho of ["# não é título", "- não é lista", "1. nem numerada", "> nem citação", "**sem negrito**", "_sem itálico_", "[sem link](https://exemplo.local)", "<script>alert(1)</script> & pronto", "-----", "| a | b |"]) {
    assert.ok(plano.includes(trecho), `sumiu ou mudou: ${trecho}\n${plano}`);
  }
});

// ---------- do e-mail para o registro ----------

const cadastro = [T.normalizarPessoa({ id: "pe1", nome: "Bruno de Lima", email: "bruno.lima@exemplo.local" }), T.normalizarPessoa({ id: "pe2", nome: "Ana Costa", apelidos: ["Aninha"] })];

teste("participantes: nome do cadastro quando o e-mail bate, e eu fico de fora", () => {
  L.definirMeusNomes(["Marina Souza"]);
  try {
    assert.deepEqual(E.participantesDoEmail(E.lerEmail(OUTLOOK), cadastro), ["Bruno de Lima", "Ana Costa", "Felipe Arquitetura"]);
  } finally {
    L.definirMeusNomes([]);
  }
  assert.deepEqual(E.participantesDoEmail(E.lerEmail(OUTLOOK)), ["Marina Souza", "Bruno Lima", "Ana Costa", "Felipe Arquitetura"]);
});

teste("registro novo e em branco: vira nota, com título, data, hora, participantes e o texto", () => {
  const r = E.comEmailNoRegistro(T.normalizarRegistro({ id: "r1", tipo: "reuniao", data: "2026-11-23" }), E.lerEmail(OUTLOOK), { novo: true, cadastro });
  assert.deepEqual([r.tipo, r.titulo, r.data, r.hora], ["nota", "Gate do pipeline no squad de Pagamentos", "2026-11-19", "14:32"]);
  assert.deepEqual(r.participantes, ["Marina Souza", "Bruno de Lima", "Ana Costa", "Felipe Arquitetura"]);
  assert.match(r.anotacoes, /^\*\*E-mail: Gate do pipeline no squad de Pagamentos\*\*\nDe: Marina Souza · 19\/11\/26 14:32\nPara: Bruno Lima, Ana Costa · Cc: Felipe Arquitetura\n\nOi, Bruno\./);
  assert.match(r.anotacoes, /Abs,\nMarina$/);
});

teste("registro que já tem conteúdo: nada do que estava escrito é trocado", () => {
  const antes = T.normalizarRegistro({ id: "r1", tipo: "reuniao", data: "2026-11-23", hora: "10:00", titulo: "Alinhamento", participantes: ["bruno lima", "Carla"], anotacoes: "minhas notas" });
  const r = E.comEmailNoRegistro(antes, E.lerEmail(OUTLOOK), { novo: true });
  assert.deepEqual([r.tipo, r.titulo, r.data, r.hora], ["reuniao", "Alinhamento", "2026-11-23", "10:00"]);
  assert.deepEqual(r.participantes, ["bruno lima", "Carla", "Marina Souza", "Ana Costa", "Felipe Arquitetura"], "quem já estava não repete, nem com outra caixa");
  assert.ok(r.anotacoes.startsWith("minhas notas\n\n**E-mail: Gate do pipeline"));
  // editar um registro que já existe: a data dele nunca muda, mesmo em branco
  const existente = E.comEmailNoRegistro(T.normalizarRegistro({ id: "r2", tipo: "reuniao", data: "2026-11-23" }), E.lerEmail(OUTLOOK), { novo: false });
  assert.deepEqual([existente.tipo, existente.data], ["reuniao", "2026-11-23"]);
});

teste("texto sem cabeçalho só acrescenta as anotações", () => {
  const r = E.comEmailNoRegistro(T.normalizarRegistro({ id: "r1", tipo: "atividade", data: "2026-11-23" }), E.lerEmail("# só um texto\ncolado"), { novo: true });
  assert.deepEqual([r.tipo, r.titulo, r.data, r.participantes.length], ["atividade", "", "2026-11-23", 0]);
  assert.equal(r.anotacoes, "\\# só um texto\ncolado");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
