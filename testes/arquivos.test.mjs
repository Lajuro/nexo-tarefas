// Testes do que o app lê para mostrar arquivos por dentro (3.15): lib/zip.ts (ZIP feito em casa),
// lib/planilha.ts (XLSX, CSV, TSV), lib/documento.ts (DOCX, PPTX) e a classificação de lib/visor.ts.
// Os arquivos de teste são montados na memória por testes/zip-de-teste.mjs.
// Uso: node testes/arquivos.test.mjs   (Node 22.18+ importa .ts direto)

import assert from "node:assert/strict";
import { register } from "node:module";
import { montarDocx, montarPptx, montarXlsx, montarZip } from "./zip-de-teste.mjs";

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

const Z = await import("../lib/zip.ts");
const P = await import("../lib/planilha.ts");
const D = await import("../lib/documento.ts");
const V = await import("../lib/visor.ts");

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

const u32 = (b, i, v) => { b[i] = v & 255; b[i + 1] = (v >>> 8) & 255; b[i + 2] = (v >>> 16) & 255; b[i + 3] = (v >>> 24) & 255; };

// ---------- ZIP ----------

await teste("zip: lista as entradas e devolve o conteúdo, compactado ou não", async () => {
  const texto = "linha com acento: ação\n".repeat(500);
  for (const semCompactar of [false, true]) {
    const zip = montarZip({ "pasta/": "", "pasta/a.txt": texto, "raiz.xml": "<a>1</a>" }, { semCompactar });
    assert.ok(Z.pareceZip(zip));
    const entradas = Z.lerZip(zip);
    assert.deepEqual(entradas.map((e) => e.nome), ["pasta/", "pasta/a.txt", "raiz.xml"]);
    assert.ok(entradas[0].pasta && !entradas[1].pasta);
    assert.equal(entradas[1].tamanho, Buffer.byteLength(texto));
    assert.equal(await Z.textoDoZip(zip, entradas, "PASTA/A.TXT"), texto, "acha sem diferenciar maiúsculas");
    assert.equal(await Z.textoDoZip(zip, entradas, "nao-existe.xml"), null);
    if (!semCompactar) assert.ok(entradas[1].comprimido < entradas[1].tamanho / 10, "o texto repetido foi compactado");
  }
});

await teste("zip: o que não é ZIP, está cortado ou aponta para fora é recusado com erro claro", async () => {
  assert.throws(() => Z.lerZip(new Uint8Array(Buffer.from("isto é um texto qualquer, não um zip"))), /não é um ZIP/);
  assert.throws(() => Z.lerZip(new Uint8Array(0)), /não é um ZIP/);
  const zip = montarZip({ "a.txt": "conteúdo ".repeat(200) });
  assert.throws(() => Z.lerZip(zip.slice(0, zip.length - 30)), /cortado|índice/);
  // índice apontando para depois do fim do arquivo
  const torto = zip.slice();
  u32(torto, torto.length - 22 + 16, 0x7fffffff);
  assert.throws(() => Z.lerZip(torto), /fora do arquivo/);
  // entrada cujo conteúdo foi cortado no meio
  const [e] = Z.lerZip(zip);
  await assert.rejects(() => Z.extrairDoZip(zip, { ...e, comprimido: e.comprimido + 100000 }), /cortado/);
  await assert.rejects(() => Z.extrairDoZip(zip, { ...e, deslocamento: 7 }), /corrompido/);
  await assert.rejects(() => Z.extrairDoZip(zip, { ...e, cifrada: true }), /senha/);
  await assert.rejects(() => Z.extrairDoZip(zip, { ...e, metodo: 14 }), /compactação/);
});

await teste("zip bomba: a descompactação para no teto, não importa o tamanho que o arquivo declara", async () => {
  // 30 MB de zeros cabem em uns 30 KB compactados
  const bomba = montarZip({ "tudo-zero.bin": Buffer.alloc(30 * 1024 * 1024) });
  assert.ok(bomba.length < 100 * 1024, "o arquivo compactado é pequeno");
  const [e] = Z.lerZip(bomba);
  await assert.rejects(() => Z.extrairDoZip(bomba, e, 1024 * 1024), /grande demais/);
  // mentir no tamanho declarado não engana: quem manda é o que sai da descompactação
  await assert.rejects(() => Z.extrairDoZip(bomba, { ...e, tamanho: 10 }, 1024 * 1024), /grande demais/);
  assert.equal((await Z.extrairDoZip(bomba, e, 64 * 1024 * 1024)).length, 30 * 1024 * 1024, "dentro do teto, abre");
  // dados compactados corrompidos viram erro, não travam
  const estragado = bomba.slice();
  for (let i = 60; i < 400; i++) estragado[i] = 0xff;
  await assert.rejects(() => Z.extrairDoZip(estragado, e, 64 * 1024 * 1024), /corrompido|grande demais/);
});

await teste("xml: entidades e atributos", () => {
  assert.equal(Z.desescaparXml("a &amp; b &lt;c&gt; &quot;d&quot; &#233; &#x41; &apos;"), "a & b <c> \"d\" é A '");
  assert.equal(Z.desescaparXml("linha&#10;outra"), "linha\noutra");
  assert.equal(Z.desescaparXml("&#0;&#1;&#8;x&#x110000;"), "x", "caractere de controle e fora do Unicode ficam de fora");
  assert.equal(Z.desescaparXml("&desconhecida; &amp;amp;"), "&desconhecida; &amp;", "não desescapa duas vezes");
  assert.equal(Z.atributoXml(' r="A1" t="s" name="A &amp; B"', "name"), "A & B");
  assert.equal(Z.atributoXml(' sr="X" r="A1"', "r"), "A1", "não confunde com um atributo que termina igual");
  assert.equal(Z.atributoXml(' r="A1"', "t"), "");
  assert.equal(Z.semPrefixoXml('<x:row r="1"><x:c xml:space="preserve"/></x:row>'), '<row r="1"><c xml:space="preserve"/></row>');
});

// ---------- planilha ----------

await teste("xlsx: abas, textos, números como se lê em português, datas, percentual, fórmula e célula vazia", async () => {
  const bytes = montarXlsx([
    { nome: "Vulnerabilidades", linhas: [
      ["Id", "Título", "Severidade", "Aberta em", "% corrigido", "Ativo"],
      [1001, "SQL injection em /busca", "Crítica", { v: 46344, s: 1 }, { v: 0.5, s: 2 }, true],
      [1002, "Cabeçalho <ausente> & \"aspas\"", null, { v: 46344.75, s: 3 }, { v: 0.125, s: 2 }, false],
      [],
      [2026, 1.5, 0.1 + 0.2, { f: "resultado da fórmula" }, { embutido: "texto embutido" }, { v: 0.5, s: 4 }],
    ] },
    { nome: "Resumo & totais", linhas: [["Total", 2]], oculta: true },
  ]);
  const { abas } = await P.lerXlsx(bytes);
  assert.deepEqual(abas.map((a) => [a.nome, a.oculta, a.colunas, a.linhas.length]), [["Vulnerabilidades", false, 6, 5], ["Resumo & totais", true, 2, 1]]);
  const [v] = abas;
  assert.deepEqual(v.linhas[0], ["Id", "Título", "Severidade", "Aberta em", "% corrigido", "Ativo"]);
  assert.deepEqual(v.linhas[1], ["1001", "SQL injection em /busca", "Crítica", "18/11/2026", "50%", "VERDADEIRO"]);
  assert.deepEqual(v.linhas[2], ["1002", "Cabeçalho <ausente> & \"aspas\"", "", "18/11/2026 18:00", "12,5%", "FALSO"]);
  assert.deepEqual(v.linhas[3], ["", "", "", "", "", ""], "linha pulada no arquivo vira linha em branco, para a numeração bater");
  assert.deepEqual(v.linhas[4], ["2026", "1,5", "0,3", "resultado da fórmula", "texto embutido", "12:00"]);
  assert.ok(!v.cortada);
});

await teste("xlsx: datas (inclusive antes de março de 1900 e no calendário de 1904) e formatos escritos à mão", () => {
  assert.equal(P.dataDoExcel(46344, "data"), "18/11/2026");
  assert.equal(P.dataDoExcel(61, "data"), "01/03/1900");
  assert.equal(P.dataDoExcel(45000.5, "datahora"), "15/03/2023 12:00");
  assert.equal(P.dataDoExcel(45000, "datahora"), "15/03/2023", "sem hora, só a data");
  assert.equal(P.dataDoExcel(0.75, "hora"), "18:00");
  assert.equal(P.dataDoExcel(1.5, "hora"), "36:00", "soma de horas que passa de um dia");
  assert.equal(P.dataDoExcel(44882, "data", true), "18/11/2026", "calendário de 1904");
  assert.equal(P.dataDoExcel(NaN, "data"), "");
  for (const [codigo, tipo] of [
    ["General", "normal"], ["Standard", "normal"], ["0.00", "normal"], ["#,##0", "normal"], ["0.00E+00", "normal"], ['#,##0.00 "dias"', "normal"],
    ["[$R$-416] #,##0.00", "normal"], ["_-* #,##0.00_-;\\-* #,##0.00_-", "normal"], ["[Red]0.00", "normal"],
    ["dd/mm/yyyy", "data"], ["[$-416]d-mmm-yy", "data"], ["mmm-yy", "data"], ["yyyy-mm-dd", "data"],
    ["hh:mm:ss", "hora"], ["[h]:mm", "hora"], ["h:mm AM/PM", "hora"], ["dd/mm/yyyy hh:mm", "datahora"],
    ["0%", "percentual"], ["0.0%", "percentual"],
  ])
    assert.equal(P.formatoDoCodigo(codigo), tipo, codigo);
  assert.equal(P.numeroDoExcel("1234567.891", "normal"), "1234567,891", "sem ponto de milhar");
  assert.equal(P.numeroDoExcel("-0.07", "percentual"), "-7%");
  assert.equal(P.numeroDoExcel("texto", "normal"), "texto");
});

await teste("xlsx: colunas por letra, células fora de ordem e prefixo de namespace", () => {
  assert.deepEqual(["A", "Z", "AA", "AZ", "BA", "ZZ", "AAA"].map(P.colunaDaLetra), [0, 25, 26, 51, 52, 701, 702]);
  assert.deepEqual([0, 25, 26, 51, 52, 701, 702].map(P.letraDaColuna), ["A", "Z", "AA", "AZ", "BA", "ZZ", "AAA"]);
  // só C2 e A4 preenchidas; a posição vem da referência, não da ordem
  const r = P.linhasDaAba('<worksheet><sheetData><row r="2"><c r="C2" t="inlineStr"><is><t>c2</t></is></c></row><row r="4"><c r="A4"><v>7</v></c></row></sheetData></worksheet>', [], []);
  assert.deepEqual(r.linhas, [[], ["", "", "c2"], [], ["7"]]);
  // sem referência nas células: vale a ordem
  const semRef = P.linhasDaAba("<sheetData><row><c><v>1</v></c><c><v>2</v></c></row><row><c><v>3</v></c></row></sheetData>", [], []);
  assert.deepEqual(semRef.linhas, [["1", "2"], ["3"]]);
  // gerador que põe prefixo nas tags
  const comPrefixo = P.linhasDaAba('<x:worksheet><x:sheetData><x:row r="1"><x:c r="A1"><x:v>9</x:v></x:c></x:row></x:sheetData></x:worksheet>', [], []);
  assert.deepEqual(comPrefixo.linhas, [["9"]]);
  // texto com formatação (vários trechos) e leitura fonética ignorada
  assert.deepEqual(P.textosCompartilhados("<sst><si><r><t>Olá, </t></r><r><t>mundo</t></r><rPh><t>fonetica</t></rPh></si><si/><si><t>a &amp; b</t></si></sst>"), ["Olá, mundo", "", "a & b"]);
});

await teste("xlsx: tetos de linhas e colunas avisam que cortou, e o que não é planilha diz o que fazer", async () => {
  const muitas = Array.from({ length: P.MAX_LINHAS + 50 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c></row>`).join("");
  const r = P.linhasDaAba(`<sheetData>${muitas}</sheetData>`, [], []);
  assert.equal(r.linhas.length, P.MAX_LINHAS);
  assert.ok(r.cortada);
  const larga = P.linhasDaAba('<sheetData><row r="1"><c r="A1"><v>1</v></c><c r="ZZ1"><v>2</v></c></row></sheetData>', [], []);
  assert.ok(larga.cortada, "coluna além do teto avisa");
  assert.deepEqual(larga.linhas, [["1"]]);
  await assert.rejects(() => P.lerXlsx(new Uint8Array(Buffer.from("isto era um .xls antigo"))), /formato novo|\.xlsx/);
  await assert.rejects(() => P.lerXlsx(montarZip({ "outra-coisa.txt": "x" })), /lista de abas/);
  await assert.rejects(() => P.lerXlsx(montarDocx("<w:p><w:r><w:t>sou um docx</w:t></w:r></w:p>")), /lista de abas/);
});

await teste("csv e tsv: acha o separador, respeita aspas e deixa as linhas com o mesmo número de colunas", () => {
  assert.equal(P.separadorDoCsv("a;b;c\n1;2;3"), ";");
  assert.equal(P.separadorDoCsv("a,b,c\n1,2,3"), ",");
  assert.equal(P.separadorDoCsv("a\tb\tc\n1\t2\t3"), "\t");
  assert.equal(P.separadorDoCsv('"x;y;z;w","b"\n"1;2;3;4","2"'), ",", "separador dentro de aspas não conta");
  assert.equal(P.separadorDoCsv("uma coluna só"), ";");
  const { abas: [a] } = P.lerTabelaDeTexto('Nome;Valor;Obs\n"Silva; Ana";1,5;"linha 1\nlinha 2"\nBruno;2\n\n');
  assert.deepEqual(a.linhas, [["Nome", "Valor", "Obs"], ["Silva; Ana", "1,5", "linha 1\nlinha 2"], ["Bruno", "2", ""]]);
  assert.equal(a.colunas, 3);
  const { abas: [t] } = P.lerTabelaDeTexto("a\tb;c\n1\t2", "dados.tsv");
  assert.deepEqual(t.linhas, [["a", "b;c"], ["1", "2"]], "em .tsv o separador é a tabulação, mesmo com ponto e vírgula no texto");
  assert.deepEqual(P.lerTabelaDeTexto("").abas[0].linhas, []);
});

await teste("planilha: busca por todas as palavras, sem acento, e cópia como texto com tabulação", async () => {
  const { abas: [a] } = P.lerTabelaDeTexto("Id;Título;Squad\n1;Injeção de SQL;Pagamentos\n2;Cabeçalho ausente;Cartões\n3;Injeção de comando;Cartões");
  assert.deepEqual(P.linhasComOTexto(a, "injecao"), [1, 3]);
  assert.deepEqual(P.linhasComOTexto(a, "INJEÇÃO cartoes"), [3], "todas as palavras, em qualquer coluna");
  assert.deepEqual(P.linhasComOTexto(a, "nada disso"), []);
  assert.equal(P.linhasComOTexto(a, "   "), null, "busca vazia não filtra");
  assert.equal(P.abaComoTexto(a, [0, 2]), "Id\tTítulo\tSquad\n2\tCabeçalho ausente\tCartões");
});

// ---------- Word e PowerPoint ----------

await teste("docx: títulos, parágrafos, itens de lista e tabela, na ordem, só como texto", async () => {
  const p = (texto, extra = "") => `<w:p>${extra}<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;
  const corpo =
    p("Plano de adoção", '<w:pPr><w:pStyle w:val="Title"/></w:pPr>') +
    p("Contexto", '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>') +
    '<w:p><w:r><w:t>Primeira parte, </w:t></w:r><w:r><w:t>segunda &amp; terceira.</w:t></w:r><w:r><w:br/><w:t>Outra linha</w:t><w:tab/><w:t>com tabulação</w:t></w:r></w:p>' +
    "<w:p/>" +
    p("Ligar o scan", '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>') +
    p("Só nos repositórios críticos", '<w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr>') +
    p("Próximos passos", '<w:pPr><w:pStyle w:val="Ttulo2"/></w:pPr>') +
    `<w:tbl><w:tblPr/><w:tr><w:tc>${p("Squad")}</w:tc><w:tc>${p("Prazo")}</w:tc></w:tr><w:tr><w:tc>${p("Pagamentos")}${p("(piloto)")}</w:tc><w:tc><w:tbl><w:tr><w:tc>${p("dentro")}</w:tc><w:tc>${p("da célula")}</w:tc></w:tr></w:tbl>${p("30/11")}</w:tc></w:tr></w:tbl>` +
    p("<script>alert(1)</script>".replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const { blocos, cortado } = await D.lerDocx(montarDocx(corpo));
  assert.ok(!cortado);
  assert.deepEqual(blocos, [
    { t: "titulo", nivel: 1, texto: "Plano de adoção" },
    { t: "titulo", nivel: 1, texto: "Contexto" },
    { t: "paragrafo", texto: "Primeira parte, segunda & terceira.\nOutra linha\tcom tabulação" },
    { t: "item", nivel: 0, texto: "Ligar o scan" },
    { t: "item", nivel: 1, texto: "Só nos repositórios críticos" },
    { t: "titulo", nivel: 2, texto: "Próximos passos" },
    { t: "tabela", linhas: [["Squad", "Prazo"], ["Pagamentos\n(piloto)", "dentro | da célula\n30/11"]] },
    { t: "paragrafo", texto: "<script>alert(1)</script>" },
  ]);
  assert.match(D.documentoComoTexto({ blocos, cortado }), /Plano de adoção\n\nContexto\n\nPrimeira parte/);
  await assert.rejects(() => D.lerDocx(new Uint8Array(Buffer.from("um .doc antigo"))), /formato novo|\.docx/);
  await assert.rejects(() => D.lerDocx(montarXlsx([{ nome: "a", linhas: [["x"]] }])), /não achei o texto/);
});

await teste("pptx: os slides na ordem da apresentação (não a dos arquivos), com título e linhas", async () => {
  const a = await D.lerPptx(montarPptx([
    { titulo: "Abertura", linhas: ["Por que agora", "O que muda & o que fica"] },
    { titulo: "Cronograma", linhas: ["Piloto em novembro"] },
    { titulo: "", linhas: ["Dúvidas?"] },
  ]));
  assert.deepEqual(a.slides, [
    { numero: 1, titulo: "Abertura", linhas: ["Por que agora", "O que muda & o que fica"] },
    { numero: 2, titulo: "Cronograma", linhas: ["Piloto em novembro"] },
    { numero: 3, titulo: "", linhas: ["Dúvidas?"] },
  ]);
  assert.equal(D.apresentacaoComoTexto(a), "Slide 1: Abertura\n- Por que agora\n- O que muda & o que fica\n\nSlide 2: Cronograma\n- Piloto em novembro\n\nSlide 3\n- Dúvidas?");
  await assert.rejects(() => D.lerPptx(montarDocx("<w:p/>")), /não achei os slides/);
  await assert.rejects(() => D.lerPptx(new Uint8Array(Buffer.from("um .ppt antigo"))), /formato novo|\.pptx/);
});

// ---------- o que abre por dentro do app ----------

await teste("jeito de ver: cada tipo de arquivo, e o que continua abrindo fora", () => {
  const esperado = {
    "print.PNG": "imagem", "laudo.pdf": "pdf", "achados.xlsx": "planilha", "macro.XLSM": "planilha", "export.csv": "tabela", "dados.tsv": "tabela",
    "ata.docx": "documento", "kickoff.pptx": "slides", "LEIAME.md": "markdown", "pacote.zip": "zip", "reuniao.mp4": "midia", "audio.m4a": "midia",
    "saida.log": "texto", "config.yaml": "texto", "resposta.json": "texto", "script.ps1": "texto", "pagina.html": "texto", "desenho.svg": "texto", "Dockerfile": "texto", "transcricao.vtt": "texto",
  };
  for (const [nome, jeito] of Object.entries(esperado)) assert.equal(V.jeitoDeVer(nome), jeito, nome);
  for (const fora of ["antigo.xls", "antigo.doc", "antigo.ppt", "instalador.exe", "base.mdb", "email.msg", "sem-extensao", "", null, undefined, "constructor", "toString", "x.__proto__"])
    assert.equal(V.jeitoDeVer(fora), null, String(fora));
  assert.match(V.avisoDeFormatoAntigo("antigo.xls"), /\.xlsx/);
  assert.match(V.avisoDeFormatoAntigo("antigo.doc"), /\.docx/);
  assert.match(V.avisoDeFormatoAntigo("antigo.ppt"), /\.pptx/);
  assert.equal(V.avisoDeFormatoAntigo("novo.xlsx"), "");
  assert.equal(V.extensaoDe("C:\\pasta\\Arquivo.Final.XLSX"), "xlsx");
  assert.deepEqual(["a.json", "b.yml", "c.py", "d.ts", "e.html", "f.ps1", "g.sh", "h.ini", "i.txt"].map(V.linguagemDoArquivo), ["json", "yaml", "python", "typescript", "xml", "powershell", "bash", "ini", ""]);
  assert.ok(V.ehSoAudio("a.mp3") && !V.ehSoAudio("a.mp4"));
});

await teste("endereços do visor: PDF e mídia só a partir de um anexo do app", () => {
  const url = "/api/arquivos?p=2026%2Flaudo.pdf";
  assert.equal(V.urlDoPdf(url), "/api/arquivos?p=2026%2Flaudo.pdf&ver=1");
  assert.equal(V.urlDaMidia("/api/arquivos?p=2026%2Freuniao.mp4"), "/api/midia?p=2026%2Freuniao.mp4");
  assert.equal(V.urlDaMidia("https://exemplo.local/video.mp4"), "");
  assert.equal(V.urlDaMidia("/api/arquivos?p=a.mp4&pagina=x"), "");
  assert.equal(V.tamanhoLegivel(512), "512 bytes");
  assert.equal(V.tamanhoLegivel(830 * 1024), "830 KB");
  assert.equal(V.tamanhoLegivel(13002342), "12,4 MB");
  assert.equal(V.tamanhoLegivel(-1), "");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
