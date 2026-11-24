// Testes do registro de decisões (3.23): lib/decisoes.ts.
// Uso: node testes/decisoes.test.mjs   (Node 22.18+ importa .ts direto)

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

const D = await import("../lib/decisoes.ts");
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

const reg = (id, data, extra = {}) => ({ id, tipo: "reuniao", data, titulo: `Registro ${id}`, criadoEm: `${data}T10:00:00.000Z`, ...extra });
const tarefas = [
  T.normalizarTarefa({
    id: "t1", titulo: "Migrar o cadastro", categoriaId: "c1",
    registros: [
      reg("r1", "2026-10-05", { participantes: ["Marina", "Bruno"], decisoes: "- Começar pelo piloto\n- Bloqueio só para o que é crítico\n\n" }),
      reg("r2", "2026-11-12", { participantes: ["Marina"], decisoes: "1. começar pelo piloto.\n2) Adiar a fase dois" }),
      reg("r3", "2026-11-20", { tipo: "decisao", titulo: "Certificado ao final", resumoIA: "Quem completar recebe." }),
      reg("r4", "2026-11-21", { tipo: "decisao", titulo: "Título que não vale", decisoes: "Vale o que está no campo" }),
      reg("r5", "2026-11-22", { tipo: "nota", titulo: "Sem decisão nenhuma" }),
      { id: "m1", tipo: "marco", data: "2026-11-23", titulo: "Concluída" },
    ],
  }),
  T.normalizarTarefa({ id: "t2", titulo: "Contrato novo", categoriaId: null, registros: [reg("r9", "2026-11-12", { participantes: ["Rafael Melo"], decisoes: "Começar pelo piloto" })] }),
  T.normalizarTarefa({ id: "t3", titulo: "Sem registros" }),
];
const todas = D.decisoesDe(tarefas);
const textos = (l) => l.map((d) => d.texto);

teste("linhasDeDecisao: uma por linha, sem marca de lista, sem linha vazia", () => {
  assert.deepEqual(D.linhasDeDecisao("- Uma\n* Duas\n• Três\n1. Quatro\n2) Cinco\n\n   \nSeis"), ["Uma", "Duas", "Três", "Quatro", "Cinco", "Seis"]);
  assert.deepEqual(D.linhasDeDecisao(""), []);
  assert.deepEqual(D.linhasDeDecisao(null), []);
  assert.equal(D.linhasDeDecisao("x".repeat(2000))[0].length, 600);
});

teste("decisoesDe: do campo Decisões e dos registros do tipo decisão, da mais nova para a mais antiga", () => {
  assert.deepEqual(textos(todas), ["Vale o que está no campo", "Certificado ao final", "Começar pelo piloto", "Adiar a fase dois", "Começar pelo piloto", "Bloqueio só para o que é crítico"]);
  const cert = todas.find((d) => d.texto === "Certificado ao final");
  assert.deepEqual([cert.tipo, cert.registroId, cert.tarefaId, cert.categoriaId], ["decisao", "r3", "t1", "c1"]);
  assert.ok(!textos(todas).includes("Título que não vale"), "com o campo preenchido, o título não vira decisão");
  assert.ok(!textos(todas).some((t) => t.includes("Sem decisão") || t === "Concluída"), "nota e marco sem decisão não entram");
});

teste("a mesma decisão repetida na mesma tarefa aparece uma vez, a mais antiga, com 'também em'", () => {
  const doPiloto = todas.filter((d) => d.tarefaId === "t1" && d.texto === "Começar pelo piloto");
  assert.equal(doPiloto.length, 1);
  assert.equal(doPiloto[0].registroId, "r1");
  assert.equal(doPiloto[0].data, "2026-10-05");
  assert.deepEqual(doPiloto[0].tambemEm, [{ registroId: "r2", data: "2026-11-12" }]);
  assert.deepEqual(doPiloto[0].participantes, ["Marina", "Bruno"], "quem estava é de quando a decisão foi tomada");
  // em outra tarefa é outra decisão
  assert.equal(todas.filter((d) => d.texto === "Começar pelo piloto").length, 2);
});

teste("as chaves são estáveis e únicas", () => {
  assert.equal(new Set(todas.map((d) => d.chave)).size, todas.length);
  assert.deepEqual(D.decisoesDe(tarefas).map((d) => d.chave), todas.map((d) => d.chave));
});

teste("filtrarDecisoes: texto (todas as palavras, sem acento), categoria, pessoa e período", () => {
  assert.deepEqual(textos(D.filtrarDecisoes(todas, { texto: "PILOTO comecar" })), ["Começar pelo piloto", "Começar pelo piloto"]);
  assert.deepEqual(textos(D.filtrarDecisoes(todas, { texto: "contrato" })), ["Começar pelo piloto"], "acha pelo título da tarefa");
  assert.equal(D.filtrarDecisoes(todas, { categoriaId: "c1" }).length, 5);
  assert.deepEqual(D.filtrarDecisoes(todas, { categoriaId: "" }).map((d) => d.tarefaId), ["t2"], "sem categoria");
  assert.deepEqual(D.filtrarDecisoes(todas, { pessoa: "rafael" }).map((d) => d.tarefaId), ["t2"]);
  assert.equal(D.filtrarDecisoes(todas, { pessoa: "marina" }).length, 3);
  assert.deepEqual(textos(D.filtrarDecisoes(todas, { desde: "2026-11-01", ate: "2026-11-20" })), ["Certificado ao final", "Começar pelo piloto", "Adiar a fase dois"]);
  assert.deepEqual(D.linhasDeDecisao("- **Começar** pelo `piloto`"), ["Começar pelo piloto"], "a formatação do texto não entra na decisão");
  assert.equal(D.filtrarDecisoes(todas, {}).length, todas.length);
  assert.equal(D.filtrarDecisoes(todas, { texto: "não existe" }).length, 0);
});

teste("decisoesPorMes: do mês mais novo para o mais antigo", () => {
  const meses = D.decisoesPorMes(todas);
  assert.deepEqual(meses.map((m) => [m.mes, m.decisoes.length]), [["2026-11", 4], ["2026-10", 2]]);
  assert.deepEqual(D.decisoesPorMes([]), []);
});

teste("pessoasDasDecisoes: quem mais aparece primeiro, sem repetir por acento ou maiúscula", () => {
  assert.deepEqual(D.pessoasDasDecisoes(todas), ["Marina", "Bruno", "Rafael Melo"]);
});

teste("textoDasDecisoes: texto simples, só o que está nos registros, sem travessão", () => {
  const texto = D.textoDasDecisoes(todas.slice(0, 2), "Decisões de novembro");
  const linhas = texto.trim().split("\n");
  assert.equal(linhas[0], "Decisões de novembro (2):");
  assert.match(linhas[2], /^- .+: Vale o que está no campo \[Migrar o cadastro\]$/);
  assert.equal(texto.includes("—"), false);
  assert.match(D.textoDasDecisoes([todas.at(-1)]), /com Marina, Bruno\]/);
  assert.equal(D.textoDasDecisoes([], "Decisões"), "Decisões: nenhuma no período.\n");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
