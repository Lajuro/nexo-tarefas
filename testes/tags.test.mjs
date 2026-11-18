// Testes das tags (3.16): lib/tags.ts. O inventário (o que existe e onde), a troca em lote (renomear, juntar,
// tirar) com o plano que a tela grava e o desfazer usa, e as tags parecidas.
// Uso: node testes/tags.test.mjs   (Node 22.18+ importa .ts direto)

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

const G = await import("../lib/tags.ts");
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

const dados = () => ({
  tarefas: [
    T.normalizarTarefa({ id: "t1", titulo: "Adoção da Ferramenta X", tags: ["pipeline", "Auditoria"] }),
    T.normalizarTarefa({ id: "t2", titulo: "Revisar o gate", tags: ["Pipeline", "pipelines"] }),
    T.normalizarTarefa({ id: "t3", titulo: "Sem tag" }),
  ],
  categorias: { rev: 1, items: [] },
  links: { rev: 1, items: [T.normalizarLink({ id: "l1", titulo: "Runbook", url: "https://exemplo.local", tags: ["pipeline", "runbook"] })] },
  pessoas: { rev: 1, items: [T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", tags: ["auditoria"] })] },
  times: { rev: 0, items: [] },
  notas: { rev: 0, items: [] },
  modelos: { rev: 1, items: [T.normalizarModelo({ id: "mo1", nome: "Onboarding", tags: ["onboarding"] })] },
  paginas: { rev: 1, items: [T.normalizarPagina({ id: "pg1", titulo: "Como o gate funciona", tags: ["pipeline", "segurança"] }), T.normalizarPagina({ id: "pg2", titulo: "Guia", tags: ["seguranca"] })] },
  jornada: { rev: 0, items: [] },
  avisos: [],
});

// ---------- inventário ----------

teste("o inventário junta as cinco coleções e conta cada item uma vez", () => {
  const inv = G.inventarioDeTags(dados());
  const p = inv.find((t) => t.chave === "pipeline");
  assert.equal(p.total, 4, "duas tarefas, um link e uma página");
  assert.deepEqual(p.em, { tarefas: 2, links: 1, paginas: 1, pessoas: 0, modelos: 0 });
  assert.equal(inv[0].chave, "pipeline", "a mais usada vem primeiro");
  assert.equal(G.resumoDeUso(p.em), "2 tarefas · 1 link · 1 página");
});

teste("maiúsculas não fazem outra tag, e o nome mostrado é a grafia mais usada", () => {
  const inv = G.inventarioDeTags(dados());
  const p = inv.find((t) => t.chave === "pipeline");
  assert.equal(p.nome, "pipeline", "3 vezes em minúsculas contra 1 com maiúscula");
  assert.deepEqual(p.grafias, ["pipeline", "Pipeline"]);
  const a = inv.find((t) => t.chave === "auditoria");
  assert.equal(a.total, 2);
  assert.equal(a.nome, "auditoria", "empate: ordem alfabética do português (minúscula antes)");
});

teste("dados vazios, coleção ausente e tag torta não quebram o inventário", () => {
  assert.deepEqual(G.inventarioDeTags(null), []);
  assert.deepEqual(G.inventarioDeTags({ tarefas: [] }), []);
  const inv = G.inventarioDeTags({ tarefas: [{ id: "t", tags: ["  ", "a  b", "A B", ""] }] });
  assert.equal(inv.length, 1);
  assert.equal(inv[0].nome, "a b");
  assert.equal(inv[0].total, 1, "duas grafias da mesma tag no mesmo item contam uma vez");
});

teste("nomesDasTags é o vocabulário único, da mais usada para a menos", () => {
  const nomes = G.nomesDasTags(dados());
  assert.equal(nomes[0], "pipeline");
  assert.ok(nomes.includes("onboarding") && nomes.includes("runbook") && nomes.includes("segurança"));
  assert.equal(new Set(nomes.map((n) => n.toLowerCase())).size, nomes.length, "sem repetir");
});

teste("itensDaTag acha tudo o que tem a tag, em qualquer grafia", () => {
  const it = G.itensDaTag(dados(), "PIPELINE");
  assert.deepEqual(it.tarefas.map((t) => t.id), ["t1", "t2"]);
  assert.deepEqual(it.links.map((l) => l.id), ["l1"]);
  assert.deepEqual(it.paginas.map((p) => p.id), ["pg1"]);
  assert.equal(it.pessoas.length + it.modelos.length, 0);
});

// ---------- a troca num item ----------

teste("renomear troca no lugar e mantém as outras tags na ordem", () => {
  assert.deepEqual(G.comTagTrocada(["a", "pipeline", "z"], "Pipeline", "esteira"), ["a", "esteira", "z"]);
});

teste("juntar em uma tag que o item já tem não duplica (fica na posição da primeira)", () => {
  assert.deepEqual(G.comTagTrocada(["Pipeline", "x", "pipelines"], "pipelines", "pipeline"), ["pipeline", "x"]);
  assert.deepEqual(G.comTagTrocada(["x", "pipelines", "pipeline"], "pipelines", "Pipeline"), ["x", "Pipeline"]);
});

teste("tirar remove só a tag pedida", () => {
  assert.deepEqual(G.comTagTrocada(["a", "Pipeline", "b"], "pipeline", null), ["a", "b"]);
  assert.deepEqual(G.comTagTrocada(["pipeline"], "pipeline", ""), []);
});

teste("item sem a tag volta com a MESMA lista (nada a gravar)", () => {
  const tags = ["a", "b"];
  assert.equal(G.comTagTrocada(tags, "pipeline", "x"), tags);
  assert.equal(G.comTagTrocada(tags, "", "x"), tags);
  const mesmo = ["pipeline"];
  assert.equal(G.comTagTrocada(mesmo, "pipeline", "pipeline"), mesmo, "renomear para o mesmo nome não muda nada");
});

teste("acertar só as maiúsculas conta como mudança", () => {
  assert.deepEqual(G.comTagTrocada(["pipeline"], "pipeline", "Pipeline"), ["Pipeline"]);
});

teste("o nome novo é limpo: sem vírgula, sem espaço sobrando, com teto de tamanho", () => {
  assert.deepEqual(G.comTagTrocada(["a"], "a", "  nova,  tag ; aqui \n"), ["nova tag aqui"]);
  assert.equal(G.comTagTrocada(["a"], "a", "x".repeat(200))[0].length, G.MAX_TAG);
  assert.deepEqual(G.comTagTrocada(["a", "b"], "a", " ,; "), ["b"], "nome que não sobra nada vale como tirar");
});

// ---------- o plano no app inteiro ----------

teste("o plano lista só o que muda, por coleção, com antes e depois", () => {
  const plano = G.planoDaTroca(dados(), "pipeline", "esteira");
  assert.deepEqual(plano.tarefas.map((m) => m.id), ["t1", "t2"]);
  assert.deepEqual(plano.tarefas[1], { id: "t2", antes: ["Pipeline", "pipelines"], depois: ["esteira", "pipelines"] });
  assert.deepEqual(plano.links.map((m) => m.id), ["l1"]);
  assert.deepEqual(plano.paginas.map((m) => m.id), ["pg1"]);
  assert.equal(plano.pessoas.length + plano.modelos.length, 0);
  assert.equal(G.tamanhoDoPlano(plano), 4);
});

teste("juntar duas tags pelo plano: quem tinha as duas fica com uma", () => {
  const plano = G.planoDaTroca(dados(), "pipelines", "pipeline");
  assert.equal(G.tamanhoDoPlano(plano), 1);
  assert.deepEqual(plano.tarefas[0].depois, ["pipeline"]);
});

teste("aplicar o plano e voltar devolve exatamente as tags de antes", () => {
  const d = dados();
  const plano = G.planoDaTroca(d, "pipeline", null);
  const mapa = G.porId(plano.tarefas);
  const depois = d.tarefas.map((t) => G.comPlano(t, mapa, "ida"));
  assert.deepEqual(depois.map((t) => t.tags), [["Auditoria"], ["pipelines"], []]);
  assert.equal(depois[2], d.tarefas[2], "quem não está no plano volta o mesmo objeto");
  const volta = depois.map((t) => G.comPlano(t, mapa, "volta"));
  assert.deepEqual(volta.map((t) => t.tags), d.tarefas.map((t) => t.tags));
});

teste("o plano não passa por cima de quem mudou no meio do caminho", () => {
  const d = dados();
  const mapa = G.porId(G.planoDaTroca(d, "pipeline", "esteira").tarefas);
  const mexida = { ...d.tarefas[0], tags: ["pipeline", "Auditoria", "nova"] };
  assert.equal(G.comPlano(mexida, mapa, "ida"), mexida, "ida: as tags já não são as de antes");
  const aplicada = G.comPlano(d.tarefas[0], mapa, "ida");
  const depoisMexida = { ...aplicada, tags: [...aplicada.tags, "outra"] };
  assert.equal(G.comPlano(depoisMexida, mapa, "volta"), depoisMexida, "volta: alguém mexeu depois da troca");
});

teste("comPlano preserva os outros campos do item (inclusive os que o app não conhece)", () => {
  const item = { id: "t1", tags: ["a"], titulo: "x", campoDoFuturo: { y: 1 } };
  const r = G.comPlano(item, G.porId([{ id: "t1", antes: ["a"], depois: ["b"] }]), "ida");
  assert.deepEqual(r, { id: "t1", tags: ["b"], titulo: "x", campoDoFuturo: { y: 1 } });
});

// ---------- parecidas e busca ----------

teste("tags parecidas: acento, plural e hífen caem no mesmo grupo, a mais usada na frente", () => {
  const grupos = G.tagsParecidas(G.inventarioDeTags(dados()));
  const nomes = grupos.map((g) => g.map((t) => t.nome));
  assert.deepEqual(nomes, [["pipeline", "pipelines"], ["seguranca", "segurança"]]);
  assert.equal(G.raizDaTag("Code-Review"), G.raizDaTag("code review"));
  assert.equal(G.raizDaTag("code_reviews"), G.raizDaTag("codereview"));
});

teste("tag curta não perde o s (não é plural) e tags diferentes não se juntam", () => {
  assert.notEqual(G.raizDaTag("aws"), G.raizDaTag("aw"));
  assert.deepEqual(G.tagsParecidas(G.inventarioDeTags({ tarefas: [{ id: "t", tags: ["rede", "redis", "api", "apim"] }] })), []);
});

teste("a busca do inventário ignora acento e exige todas as palavras", () => {
  const inv = G.inventarioDeTags(dados());
  assert.deepEqual(G.tagsComOTexto(inv, "SEGURANCA").map((t) => t.nome).sort(), ["seguranca", "segurança"]);
  assert.deepEqual(G.tagsComOTexto(inv, "pipe s").map((t) => t.nome), ["pipelines"]);
  assert.equal(G.tagsComOTexto(inv, "  ").length, inv.length);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
