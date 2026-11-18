// Testes do visor de imagem (lib/visor.ts): o que ele aceita mostrar, o zoom e a navegação entre imagens.
// Uso: node testes/visor.test.mjs   (Node 22.18+ importa .ts direto)

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

const V = await import("../lib/visor.ts");
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

teste("o visor só aceita anexo do próprio app: o endereço que o leitor e o banco de links geram", () => {
  const doLeitor = R.urlDaImagem("arquivos/2026/abc-print 1 (2).png");
  assert.equal(doLeitor, "/api/arquivos?p=2026%2Fabc-print%201%20(2).png");
  assert.ok(V.ehUrlDeAnexo(doLeitor));
  assert.ok(V.ehUrlDeAnexo(`/api/arquivos?p=${encodeURIComponent("2026/mwx1-diagrama_v2.final~1!.jpg")}`));
  assert.ok(V.ehUrlDeAnexo(`/api/arquivos?p=${encodeURIComponent("2026/relatório de março.png")}`), "nome com acento");
});

teste("endereço de fora, outra rota, parâmetro a mais ou valor torto: recusado", () => {
  for (const mau of [
    "https://exemplo.local/foto.png", "//exemplo.local/api/arquivos?p=x", "http://127.0.0.1:3210/api/arquivos?p=2026%2Fa.png",
    "/api/arquivos?p=2026%2Fa.png&baixar=1", "/api/arquivos?p=2026%2Fa.png#x", "/api/arquivos?p=", "/api/arquivos", "/api/exportar?p=a.png",
    "/api/arquivos?p=2026/a.png", "/api/arquivos?p=a b.png", "/api/arquivos?p=a.png\n", " /api/arquivos?p=a.png",
    "javascript:alert(1)", "data:image/png;base64,AAAA", "blob:http://127.0.0.1/x", "", null, undefined, 7, {}, ["/api/arquivos?p=a.png"],
    "/api/arquivos?p=" + "a".repeat(3000),
  ])
    assert.equal(V.ehUrlDeAnexo(mau), false, String(mau).slice(0, 60));
});

teste("a lista que chega pelo evento é conferida item a item", () => {
  const lista = V.imagensValidas([
    { url: "/api/arquivos?p=2026%2Fa.png", alt: "  print\n da   tela " },
    { url: "https://exemplo.local/x.png", alt: "de fora" },
    { url: "/api/arquivos?p=2026%2Fb.png", alt: 7 },
    null, "texto", { alt: "sem endereço" },
    { url: "/api/arquivos?p=2026%2Fc.png", alt: "x".repeat(500) },
  ]);
  assert.deepEqual(lista.map((i) => i.url), ["/api/arquivos?p=2026%2Fa.png", "/api/arquivos?p=2026%2Fb.png", "/api/arquivos?p=2026%2Fc.png"]);
  assert.equal(lista[0].alt, "print da tela", "o nome vira uma linha");
  assert.equal(lista[1].alt, "");
  assert.equal(lista[2].alt.length, 200);
  assert.deepEqual(V.imagensValidas("nada"), []);
  assert.deepEqual(V.imagensValidas(null), []);
  assert.equal(V.imagensValidas(Array.from({ length: 500 }, () => ({ url: "/api/arquivos?p=a.png", alt: "" }))).length, 200, "teto de itens");
});

teste("quais arquivos abrem no visor: imagens que o navegador desenha (SVG continua abrindo como arquivo)", () => {
  for (const sim of ["print.png", "FOTO.JPG", "a.jpeg", "anim.gif", "x.webp", "velho.bmp", " tela.png "]) assert.ok(V.ehNomeDeImagem(sim), sim);
  for (const nao of ["laudo.pdf", "planilha.xlsx", "desenho.svg", "png", "foto.png.exe", "", null, undefined]) assert.ok(!V.ehNomeDeImagem(nao), String(nao));
  assert.equal(V.nomeNaUrl("/api/arquivos?p=2026%2Fabc-print%201.png"), "2026/abc-print 1.png");
  assert.equal(V.nomeNaUrl("https://exemplo.local/x.png"), "", "só lê nome de anexo do app");
  assert.equal(V.nomeNaUrl("/api/arquivos?p=%E0%A4%A"), "", "codificação quebrada não estoura");
  assert.equal(V.urlParaBaixar("/api/arquivos?p=2026%2Fa.png"), "/api/arquivos?p=2026%2Fa.png&baixar=1");
});

teste("zoom: sobe e desce pelos degraus, a partir de qualquer escala, e para nas pontas", () => {
  assert.equal(V.proximaEscala(1, 1), 1.5);
  assert.equal(V.proximaEscala(1, -1), 0.75);
  assert.equal(V.proximaEscala(0.62, 1), 0.75, "imagem ajustada à janela em 62%: o próximo degrau");
  assert.equal(V.proximaEscala(0.62, -1), 0.5);
  assert.equal(V.proximaEscala(4, 1), 4);
  assert.equal(V.proximaEscala(9, 1), 4);
  assert.equal(V.proximaEscala(0.25, -1), 0.25);
  assert.equal(V.proximaEscala(0.01, -1), 0.25);
  for (const torto of [NaN, 0, -3, Infinity]) assert.equal(V.proximaEscala(torto, 1), 1.5, String(torto));
  // subir até o fim e descer até o começo passa por todos os degraus, sem pular nem repetir
  const subida = [];
  for (let e = V.ESCALAS[0]; ; ) { subida.push(e); const p = V.proximaEscala(e, 1); if (p === e) break; e = p; }
  assert.deepEqual(subida, [...V.ESCALAS]);
});

teste("setas: andam pela lista e dão a volta nas pontas", () => {
  assert.equal(V.indiceVizinho(0, 3, 1), 1);
  assert.equal(V.indiceVizinho(2, 3, 1), 0);
  assert.equal(V.indiceVizinho(0, 3, -1), 2);
  assert.equal(V.indiceVizinho(0, 1, 1), 0);
  assert.equal(V.indiceVizinho(0, 0, 1), 0);
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
