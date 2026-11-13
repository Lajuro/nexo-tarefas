// Testes das funções puras de pessoas e do importador do Outlook.
// Uso: node testes/pessoas.test.mjs   (Node 22.18+ importa .ts direto; em versões mais
// antigas: node --experimental-strip-types testes/pessoas.test.mjs)
// Só nomes e domínios fictícios (exemplo.local).

import assert from "node:assert/strict";
import { register } from "node:module";

// O código do app importa "./tipos" sem extensão (padrão do TypeScript/Next). O Node puro exige a
// extensão, então este gancho tenta ".ts" quando o arquivo sem extensão não existe. E, como o
// package.json não tem "type": "module", diz ao Node que os .ts são ESM (evita o aviso).
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

const P = await import("../lib/pessoas.ts");
const I = await import("../lib/importar-pessoas.ts");
const T = await import("../lib/tipos.ts");

let falhas = 0;
let total = 0;
async function teste(nome, fn) {
  total++;
  try {
    await fn();
    console.log("ok   " + nome);
  } catch (e) {
    falhas++;
    console.log("FALHA " + nome + "\n      " + String(e.message).split("\n").join("\n      "));
  }
}
const resumo = (xs) => xs.map((p) => `${p.nome}|${p.email}|${p.cargo}|${p.area}`);

// ---------- chaveNome / acharPessoa ----------

await teste("chaveNome tira acento, maiúsculas e colapsa espaços", () => {
  assert.equal(P.chaveNome("  Letícia   SOUZA "), "leticia souza");
  assert.equal(P.chaveNome("João\tda  Silva"), "joao da silva");
});

const pessoaMarina = T.normalizarPessoa({ id: "pe1", nome: "Marina Souza", apelidos: ["Marina", "Marina S."], email: "Marina.Souza@exemplo.local" });
const pessoaFelipe = T.normalizarPessoa({ id: "pe2", nome: "Felipe Rocha", apelidos: ["Felipe"], email: "felipe@exemplo.local" });
const pessoaVelha = T.normalizarPessoa({ id: "pe3", nome: "Felipe", arquivada: true });

await teste("acharPessoa por nome, apelido e e-mail; prefere a ativa", () => {
  const ps = [pessoaVelha, pessoaMarina, pessoaFelipe];
  assert.equal(P.acharPessoa(ps, "marina souza")?.id, "pe1");
  assert.equal(P.acharPessoa(ps, "Marina S.")?.id, "pe1");
  assert.equal(P.acharPessoa(ps, "MARINA.SOUZA@EXEMPLO.LOCAL")?.id, "pe1");
  assert.equal(P.acharPessoa(ps, "Felipe")?.id, "pe2");
  assert.equal(P.acharPessoa(ps, "Ninguém"), undefined);
  assert.equal(P.acharPessoa(ps, "  "), undefined);
});

await teste("normalizarPessoa e normalizarTime: padrões, spread e responsáveis viram membros", () => {
  const p = T.normalizarPessoa({ nome: " Ana ", campoFuturo: 1, apelidos: ["A", "A", " "], origem: "xyz" });
  assert.match(p.id, /^pe/);
  assert.equal(p.nome, "Ana");
  assert.deepEqual(p.apelidos, ["A"]);
  assert.equal(p.origem, "manual");
  assert.equal(p.campoFuturo, 1);
  assert.equal(p.email, "");
  const t = T.normalizarTime({ nome: "X", responsavelIds: ["pe1"], membroIds: ["pe2"] });
  assert.match(t.id, /^ti/);
  assert.deepEqual(t.membroIds, ["pe2", "pe1"]);
  assert.ok(T.CORES.includes(t.cor));
});

// ---------- diretório unificado ----------

const reg = (id, data, participantes, passos = []) =>
  T.normalizarRegistro({ id, tipo: "reuniao", data, titulo: id, participantes, proximosPassos: passos, criadoEm: data + "T10:00:00Z" });
const passo = (id, responsavel, feito = false) => ({ id, texto: id, feito, responsavel });

function dadosExemplo() {
  const tarefas = [
    T.normalizarTarefa({
      id: "t1", titulo: "Onboarding", categoriaId: "c1", status: "em_andamento",
      registros: [
        reg("r1", "2026-10-01", ["Marina", "Felipe", "Diego"], [passo("p1", "Marina"), passo("p2", "Eu"), passo("p3", "Diego", true)]),
        reg("r2", "2026-10-20", ["Marina S.", "Marina Souza", "Eu"], [passo("p4", "Letícia")]),
      ],
    }),
    T.normalizarTarefa({
      id: "t2", titulo: "Antiga", categoriaId: "c2", status: "concluida",
      registros: [reg("r3", "2026-11-01", ["diego", "Felipe Rocha"], [passo("p5", "Felipe")])],
    }),
  ];
  const times = [
    T.normalizarTime({ id: "ti1", nome: "Squad de Pagamentos", responsavelIds: ["pe1"], membroIds: ["pe2"], categoriaIds: ["c1"] }),
    T.normalizarTime({ id: "ti2", nome: "Arquivado", membroIds: ["pe2"], categoriaIds: ["c1"], arquivado: true }),
  ];
  const pessoas = [pessoaMarina, { ...pessoaFelipe, categoriaIds: ["c2"] }];
  return {
    tarefas, categorias: { rev: 0, items: [] }, links: { rev: 0, items: [] },
    pessoas: { rev: 1, items: pessoas }, times: { rev: 1, items: times }, avisos: [],
  };
}

await teste("montarDiretorio junta cadastradas e soltos, absorvendo apelidos", () => {
  const dir = P.montarDiretorio(dadosExemplo());
  const nomes = dir.map((e) => `${e.nome}:${e.cadastrada}`);
  assert.deepEqual(nomes, ["Diego:false", "Felipe Rocha:true", "Letícia:false", "Marina Souza:true"]);
  const marina = dir.find((e) => e.chave === "pe1");
  // r2 tem "Marina S." e "Marina Souza": conta uma vez só
  assert.deepEqual(marina.registros.map((x) => x.registro.id), ["r2", "r1"]);
  assert.equal(marina.ultimoContato, "2026-10-20");
  assert.deepEqual(marina.passosAbertos.map((x) => x.passo.id), ["p1"]);
  assert.deepEqual(marina.times.map((t) => t.id), ["ti1"]);
  assert.deepEqual(marina.responsavelDe.map((t) => t.id), ["ti1"]);
  assert.deepEqual(marina.tarefaIds, ["t1"]);
});

await teste("montarDiretorio: 'Eu' não vira pessoa; passo de tarefa fechada e passo feito não contam", () => {
  const dir = P.montarDiretorio(dadosExemplo());
  assert.ok(!dir.some((e) => P.chaveNome(e.nome) === "eu"));
  const felipe = dir.find((e) => e.chave === "pe2");
  assert.equal(felipe.passosAbertos.length, 0); // p5 é de tarefa concluída
  assert.deepEqual(felipe.registros.map((x) => x.registro.id), ["r3", "r1"]);
  assert.deepEqual(felipe.tarefaIds, ["t2", "t1"]);
  const diego = dir.find((e) => e.chave === "diego");
  assert.equal(diego.passosAbertos.length, 0); // p3 já feito
  assert.equal(diego.registros.length, 2); // "Diego" e "diego"
  const leticia = dir.find((e) => e.chave === "leticia");
  assert.equal(leticia.ultimoContato, null);
  assert.deepEqual(leticia.passosAbertos.map((x) => x.passo.id), ["p4"]);
  assert.deepEqual(leticia.tarefaIds, ["t1"]);
});

await teste("montarDiretorio aceita Dados sem pessoas/times (dados antigos)", () => {
  const d = dadosExemplo();
  delete d.pessoas;
  delete d.times;
  const dir = P.montarDiretorio(d);
  assert.ok(dir.every((e) => !e.cadastrada));
  assert.ok(dir.some((e) => e.nome === "Marina S."));
});

await teste("pessoasDaCategoria diz o motivo de cada um", () => {
  const d = dadosExemplo();
  const c1 = P.pessoasDaCategoria(d, "c1");
  const porNome = Object.fromEntries(c1.map((x) => [x.entrada.nome, x.motivos.map((m) => m.tipo).join(",")]));
  assert.equal(porNome["Marina Souza"], "time,registros,passos");
  assert.equal(porNome["Felipe Rocha"], "time,registros"); // o time arquivado não conta
  assert.equal(porNome["Diego"], "registros");
  assert.equal(porNome["Letícia"], "passos");
  assert.equal(c1[0].entrada.nome, "Marina Souza");
  const marina = c1.find((x) => x.entrada.chave === "pe1");
  assert.match(marina.motivos[0].descricao, /Responsável pelo time Squad de Pagamentos/);
  const c2 = P.pessoasDaCategoria(d, "c2");
  assert.equal(c2.find((x) => x.entrada.chave === "pe2").motivos[0].tipo, "direto");
});

await teste("nomesConhecidos: cadastradas primeiro, sem repetir apelidos", () => {
  assert.deepEqual(P.nomesConhecidos(dadosExemplo()), ["Felipe Rocha", "Marina Souza", "Diego", "Letícia"]);
});

await teste("montarPessoas (visão antiga) continua igual", () => {
  const ps = P.montarPessoas(dadosExemplo().tarefas);
  const marina = ps.find((p) => p.chave === "marina");
  assert.equal(marina.regs.length, 1);
  assert.equal(P.ordenarPessoas(ps, "nome")[0].nome, "Diego");
});

// ---------- colagem ----------

await teste("colagem: formato do Outlook com ; e nomes com acento", () => {
  const r = I.interpretarColagem("Marina Souza <marina.souza@exemplo.local>; Letícia Prado <leticia@exemplo.local>;");
  assert.deepEqual(resumo(r), ["Marina Souza|marina.souza@exemplo.local||", "Letícia Prado|leticia@exemplo.local||"]);
});

await teste("colagem: 'Sobrenome, Nome <email>' separado por vírgula", () => {
  const r = I.interpretarColagem("Souza, Marina <marina@exemplo.local>, Rocha, Felipe <felipe@exemplo.local>");
  assert.deepEqual(resumo(r), ["Marina Souza|marina@exemplo.local||", "Felipe Rocha|felipe@exemplo.local||"]);
});

await teste("colagem: aspas, sufixos (Empresa) e [Área], e-mail em maiúsculas", () => {
  const r = I.interpretarColagem(
    '"Prado, Letícia" <Leticia.Prado@Exemplo.Local>; Bruno Lima (Fornecedor Y) <bruno@exemplo.local>\n' +
      "Camila Torres [Arquitetura] <camila@exemplo.local>",
  );
  assert.deepEqual(resumo(r), [
    "Letícia Prado|leticia.prado@exemplo.local||",
    "Bruno Lima|bruno@exemplo.local||Fornecedor Y",
    "Camila Torres|camila@exemplo.local||Arquitetura",
  ]);
});

await teste("colagem: e-mails soltos viram nomes legíveis", () => {
  const r = I.interpretarColagem("maria.silva@exemplo.local, joao_da-costa2@exemplo.local\nrafa@exemplo.local rafael.melo@exemplo.local");
  assert.deepEqual(r.map((p) => p.nome), ["Maria Silva", "Joao da Costa", "Rafa", "Rafael Melo"]);
});

await teste("colagem: misto de e-mail solto, nome invertido e linhas vazias", () => {
  const r = I.interpretarColagem("\n\nana@exemplo.local, Souza, Marina <marina@exemplo.local>\n\n  Diego Alves  \nmailto:bia@exemplo.local");
  assert.deepEqual(resumo(r), [
    "Ana|ana@exemplo.local||",
    "Marina Souza|marina@exemplo.local||",
    "Diego Alves|||",
    "Bia|bia@exemplo.local||",
  ]);
});

await teste("colagem: nome igual ao e-mail e e-mail entre parênteses", () => {
  const r = I.interpretarColagem("'felipe.rocha@exemplo.local' <felipe.rocha@exemplo.local>; Bruno Lima (bruno@exemplo.local)");
  assert.deepEqual(resumo(r), ["Felipe Rocha|felipe.rocha@exemplo.local||", "Bruno Lima|bruno@exemplo.local||"]);
});

await teste("colagem: duplicados por e-mail e por nome, completando campos", () => {
  const r = I.interpretarColagem(
    "Marina <MARINA@exemplo.local>; Marina Souza <marina@exemplo.local>; Diego Alves; diego  alves; Camila Torres; Camila Torres <camila@exemplo.local>",
  );
  assert.deepEqual(resumo(r), ["Marina|marina@exemplo.local||", "Diego Alves|||", "Camila Torres|camila@exemplo.local||"]);
});

await teste("colagem vazia ou só separadores", () => {
  assert.deepEqual(I.interpretarColagem(""), []);
  assert.deepEqual(I.interpretarColagem(" ;;\n,, "), []);
});

// ---------- CSV ----------

await teste("CSV do Outlook em inglês (vírgula, aspas, quebra de linha dentro de aspas, BOM)", () => {
  const csv =
    "﻿" +
    '"First Name","Middle Name","Last Name","Title","Job Title","Department","Company","E-mail Address","E-mail Display Name","Notes"\r\n' +
    '"Marina","","Souza","Ms.","Product Owner","Pagamentos","Exemplo SA","marina@exemplo.local","Marina Souza (marina@exemplo.local)","linha 1\r\nlinha 2, com vírgula"\r\n' +
    '"Felipe","A.","Rocha","","Arquiteto","","","felipe@exemplo.local","",""\r\n' +
    '"","","","","","","","","",""\r\n';
  const r = I.interpretarCsv(csv);
  assert.deepEqual(resumo(r), [
    "Marina Souza|marina@exemplo.local|Product Owner|Pagamentos · Exemplo SA",
    "Felipe A. Rocha|felipe@exemplo.local|Arquiteto|",
  ]);
});

await teste("CSV em português com ; e cabeçalhos com acento", () => {
  const csv =
    "Nome;Sobrenome;Cargo;Departamento;Empresa;Endereço de email\n" +
    "Letícia;Prado;Analista de dados;;Exemplo SA;leticia@exemplo.local\n" +
    '"Camila";"Torres";"Gerente; Segurança";"Arquitetura";;"camila@exemplo.local"\n';
  const r = I.interpretarCsv(csv);
  assert.deepEqual(resumo(r), [
    "Letícia Prado|leticia@exemplo.local|Analista de dados|Exemplo SA",
    "Camila Torres|camila@exemplo.local|Gerente; Segurança|Arquitetura",
  ]);
});

await teste("CSV do Outlook web (Display Name, E-mail 1 - Value) e e-mail reserva", () => {
  const csv =
    "Display Name,E-mail 1 - Value,E-mail 2 Address,Título\n" +
    "\"Rocha, Felipe\",,felipe@exemplo.local,Arquiteto\n" +
    ",rafael.melo@exemplo.local,,\n";
  const r = I.interpretarCsv(csv);
  assert.deepEqual(resumo(r), ["Felipe Rocha|felipe@exemplo.local|Arquiteto|", "Rafael Melo|rafael.melo@exemplo.local||"]);
});

await teste("CSV com duplicados", () => {
  const csv = "Name,Email\nMarina Souza,marina@exemplo.local\nMarina S.,MARINA@exemplo.local\n";
  assert.equal(I.interpretarCsv(csv).length, 1);
});

// ---------- vCard ----------

await teste("vCard com dois contatos (3.0 e 2.1 com QUOTED-PRINTABLE e linha dobrada)", () => {
  const vcf = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Souza;Marina;;;",
    "FN:Marina Souza",
    "ORG:Exemplo SA;Pagamentos",
    "TITLE:Product Owner",
    "EMAIL;TYPE=INTERNET:marina.antigo@exemplo.local",
    "EMAIL;TYPE=INTERNET,PREF:marina@exemp",
    " lo.local",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Prado;Let=C3=ADcia",
    "TITLE;ENCODING=QUOTED-PRINTABLE:Analista de seguran=C3=A7a da inform=",
    "a=C3=A7=C3=A3o",
    "item1.EMAIL;INTERNET:leticia@exemplo.local",
    "END:VCARD",
    "",
  ].join("\r\n");
  const r = I.interpretarVcf(vcf);
  assert.deepEqual(resumo(r), [
    "Marina Souza|marina@exemplo.local|Product Owner|Pagamentos · Exemplo SA",
    "Letícia Prado|leticia@exemplo.local|Analista de segurança da informação|",
  ]);
});

await teste("vCard 4.0 com escapes e sem FN", () => {
  const vcf = "BEGIN:VCARD\nVERSION:4.0\nN:Lima;Bruno;;;\nORG:Fornecedor Y\\, Ltda\nEMAIL;PREF=1:bruno@exemplo.local\nEND:VCARD\n";
  assert.deepEqual(resumo(I.interpretarVcf(vcf)), ["Bruno Lima|bruno@exemplo.local||Fornecedor Y, Ltda"]);
});

// ---------- arquivos e formato ----------

await teste("decodificarArquivo: UTF-8, UTF-8 com BOM, ANSI (Windows-1252) e UTF-16", () => {
  const utf8 = new TextEncoder().encode("Letícia;Ação");
  assert.equal(I.decodificarArquivo(utf8.buffer), "Letícia;Ação");
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
  assert.equal(I.decodificarArquivo(bom.buffer), "Letícia;Ação");
  // "Letícia;Ação" em Windows-1252
  const ansi = new Uint8Array([0x4c, 0x65, 0x74, 0xed, 0x63, 0x69, 0x61, 0x3b, 0x41, 0xe7, 0xe3, 0x6f]);
  assert.equal(I.decodificarArquivo(ansi.buffer), "Letícia;Ação");
  // aspas "curvas" (0x93/0x94) só existem no 1252, não no latin1
  assert.equal(I.decodificarArquivo(new Uint8Array([0x93, 0x41, 0x94]).buffer), "“A”");
  const u16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0xe7, 0x00]);
  assert.equal(I.decodificarArquivo(u16.buffer), "Aç");
});

await teste("CSV ANSI do Outlook desktop em português, ponta a ponta", () => {
  const texto = "Nome;Sobrenome;Endereço de email;Cargo\r\nJoão;Araújo;joao@exemplo.local;Coordenação\r\n";
  const bytes = new Uint8Array([...texto].map((c) => c.charCodeAt(0))); // latin1 = 1252 nesses caracteres
  const { formato, pessoas } = I.interpretarImportacao("contatos.CSV", I.decodificarArquivo(bytes.buffer));
  assert.equal(formato, "csv");
  assert.deepEqual(resumo(pessoas), ["João Araújo|joao@exemplo.local|Coordenação|"]);
});

await teste("detectarFormato pela extensão e pelo conteúdo", () => {
  assert.equal(I.detectarFormato("a.vcf", ""), "vcf");
  assert.equal(I.detectarFormato("a.csv", ""), "csv");
  assert.equal(I.detectarFormato("", "BEGIN:VCARD\nEND:VCARD"), "vcf");
  assert.equal(I.detectarFormato("", "First Name,Last Name,E-mail Address\nA,B,a@exemplo.local"), "csv");
  assert.equal(I.detectarFormato("", "Nome;Email\nAna;ana@exemplo.local"), "csv");
  assert.equal(I.detectarFormato("", "Ana <ana@exemplo.local>; Bia <bia@exemplo.local>"), "colagem");
  assert.equal(I.detectarFormato("", "Souza, Marina <m@exemplo.local>"), "colagem");
  assert.equal(I.detectarFormato("lista.txt", "ana@exemplo.local"), "colagem");
});

await teste("compararComCadastro: nova, jaExiste e completa", () => {
  const cadastro = [pessoaMarina, T.normalizarPessoa({ id: "pe9", nome: "Bruno Lima", apelidos: ["Bruno"], cargo: "Dev" })];
  const r = I.compararComCadastro(
    [
      { nome: "Marina", email: "MARINA.SOUZA@exemplo.local", cargo: "", area: "" },
      { nome: "Bruno Lima", email: "bruno@exemplo.local", cargo: "Tech lead", area: "Pagamentos" },
      { nome: "Rafael Melo", email: "rafael@exemplo.local", cargo: "", area: "" },
      { nome: "Marina S.", email: "", cargo: "", area: "" },
    ],
    cadastro,
  );
  assert.deepEqual(r.map((x) => x.situacao), ["jaExiste", "completa", "nova", "jaExiste"]);
  assert.deepEqual(r[1].camposNovos, ["email", "area"]);
  assert.equal(r[1].pessoa.id, "pe9");
});

console.log(`\n${total - falhas}/${total} testes passaram.`);
if (falhas) process.exit(1);
