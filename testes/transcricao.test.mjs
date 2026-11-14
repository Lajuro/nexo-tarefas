// Testes da transcrição de vídeo: lib/transcricao.ts (ler VTT, SRT e texto com tempos, acompanhar o vídeo, prompt).
// Uso: node testes/transcricao.test.mjs
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/transcricao.test.mjs)

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

const X = await import("../lib/transcricao.ts");
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

teste("tempo: ler e escrever", () => {
  assert.deepEqual(["12:34", "1:02:03", "02:03.500", "00:02:03,250", " 0:05 "].map(X.lerTempo), [754, 3723, 123.5, 123.25, 5]);
  for (const mau of ["", "12", "1:2", "12:99", "1:99:00", "abc", "12:34:56:78", null]) assert.equal(X.lerTempo(mau), null, String(mau));
  assert.deepEqual([0, 5, 754, 3723, 36000, -3, NaN].map(X.formatarTempo), ["0:00", "0:05", "12:34", "1:02:03", "10:00:00", "0:00", "0:00"]);
});

const VTT = `WEBVTT

NOTE gerado pelo gravador

1
00:00:01.000 --> 00:00:04.000
<v Marina Souza>Bom dia, vamos começar pelo scan.</v>

2
00:00:04.200 --> 00:00:07.500
<v Marina Souza>O primeiro resultado trouxe <i>42 achados</i>.</v>

00:00:12.000 --> 00:00:15.000 align:start position:10%
<v Bruno Lima>Três são críticos &amp; precisam de triagem.</v>

00:01:05.000 --> 00:01:09.000
<v Marina Souza>Combinado: triagem na quinta.</v>
`;

teste("WebVTT: tempos, quem fala pela marca <v>, marcação descartada", () => {
  const f = X.lerTranscricao(VTT);
  assert.equal(f.length, 4);
  assert.deepEqual(f[0], { inicio: 1, fim: 4, quem: "Marina Souza", texto: "Bom dia, vamos começar pelo scan." });
  assert.equal(f[1].texto, "O primeiro resultado trouxe 42 achados.");
  assert.deepEqual([f[2].quem, f[2].texto, f[2].inicio], ["Bruno Lima", "Três são críticos & precisam de triagem.", 12]);
  assert.equal(X.temTempos(f), true);
});

teste("SRT: vírgula nos milésimos, número da legenda fora do texto, 'Nome: fala'", () => {
  const srt = "1\n00:00:01,000 --> 00:00:03,000\nBruno: Olá a todos.\n\n2\n00:00:03,500 --> 00:00:06,000\nlinha um\nlinha dois\n3\n00:00:07,000 --> 00:00:09,000\nA frase diz: nada de nome aqui.\n";
  const f = X.lerTranscricao(srt);
  assert.deepEqual(f.map((x) => [x.inicio, x.fim, x.quem, x.texto]), [
    [1, 3, "Bruno", "Olá a todos."],
    [3.5, 6, "", "linha um linha dois"],
    [7, 9, "", "A frase diz: nada de nome aqui."],
  ]);
});

teste("texto com tempos: colchetes, nome com dois-pontos e o jeito do Teams (nome, tempo, texto embaixo)", () => {
  const a = X.lerTranscricao("[00:05] Marina: Vamos começar.\ncontinua na linha de baixo\n[00:20] Bruno: Combinado.\n(1:02:03) - sem nome\n");
  assert.deepEqual(a.map((x) => [x.inicio, x.fim, x.quem, x.texto]), [
    [5, 20, "Marina", "Vamos começar. continua na linha de baixo"],
    [20, 3723, "Bruno", "Combinado."],
    [3723, 3728, "", "sem nome"],
  ]);
  const teams = X.lerTranscricao("Marina Souza   0:03\nBom dia, vamos começar.\n\nBruno Lima   0:15\nTrês são críticos.\nPrecisam de triagem.\n");
  assert.deepEqual(teams.map((x) => [x.inicio, x.quem, x.texto]), [[3, "Marina Souza", "Bom dia, vamos começar."], [15, "Bruno Lima", "Três são críticos. Precisam de triagem."]]);
  const solto = X.lerTranscricao("0:10 Marina Souza\nA fala vem embaixo.\n0:30\nOutra fala sem nome.");
  assert.deepEqual(solto.map((x) => [x.inicio, x.quem, x.texto]), [[10, "Marina Souza", "A fala vem embaixo."], [30, "", "Outra fala sem nome."]]);
});

teste("sem tempo nenhum: vira parágrafos para ler e buscar; vazio e lixo não quebram", () => {
  const f = X.lerTranscricao("Primeiro parágrafo\ncontinua.\n\nSegundo parágrafo.");
  assert.deepEqual(f, [{ inicio: -1, fim: -1, quem: "", texto: "Primeiro parágrafo continua." }, { inicio: -1, fim: -1, quem: "", texto: "Segundo parágrafo." }]);
  assert.equal(X.temTempos(f), false);
  assert.deepEqual(X.lerTranscricao(""), []);
  assert.deepEqual(X.lerTranscricao(null), []);
  assert.doesNotThrow(() => X.lerTranscricao("00:00:01.000 --> \n-->\n99:99:99 --> 00:00:02.000\n<script>alert(1)</script>"));
  // marcação parecida com HTML some do texto da legenda; nada é interpretado
  const mal = X.lerTranscricao('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<img src=x onerror=alert(1)>oi <b>negrito</b>');
  assert.equal(mal[0].texto, "oi negrito");
  // arquivo gigante é cortado, não trava
  assert.ok(X.lerTranscricao("WEBVTT\n\n" + "00:00:01.000 --> 00:00:02.000\nx\n\n".repeat(40_000)).length <= 30_000);
});

teste("acompanhar o vídeo: fala do instante, trechos de leitura e busca", () => {
  const f = X.lerTranscricao(VTT);
  assert.deepEqual([0, 1, 3.9, 4.1, 10, 12, 70, 9999].map((t) => X.falaNoInstante(f, t)), [-1, 0, 0, 0, 1, 2, 3, 3]);
  assert.equal(X.falaNoInstante([], 5), -1);
  // as duas primeiras falas (mesma pessoa, coladas) viram um trecho; a pausa longa abre outro
  const trechos = X.emTrechos(f);
  assert.deepEqual(trechos.map((t) => [t.quem, t.inicio, t.fim, t.falas]), [["Marina Souza", 1, 7.5, [0, 1]], ["Bruno Lima", 12, 15, [2]], ["Marina Souza", 65, 69, [3]]]);
  assert.deepEqual(X.buscarNaTranscricao(f, "TRIAGEM"), [2, 3]);
  assert.deepEqual(X.buscarNaTranscricao(f, "criticos bruno"), [2]); // sem acento, e o nome de quem fala conta
  assert.deepEqual(X.buscarNaTranscricao(f, "  "), []);
  assert.deepEqual(X.quemFala(f).map((q) => [q.quem, q.segundos, q.falas]), [["Marina Souza", 10.3, 3], ["Bruno Lima", 3, 1]]);
});

teste("texto para copiar, partes que cabem no Copilot e prompt", () => {
  const f = X.lerTranscricao(VTT);
  assert.equal(X.transcricaoEmTexto(f), "[0:01] Marina Souza: Bom dia, vamos começar pelo scan. O primeiro resultado trouxe 42 achados.\n[0:12] Bruno Lima: Três são críticos & precisam de triagem.\n[1:05] Marina Souza: Combinado: triagem na quinta.");
  assert.equal(X.partesDaTranscricao(f).length, 1);
  const partes = X.partesDaTranscricao(f, 110);
  assert.equal(partes.length, 3);
  assert.equal(partes.join("\n"), X.transcricaoEmTexto(f)); // nada se perde ao partir
  assert.ok(partes.every((p) => p.length <= 110));
  const p = X.promptDoVideo("  Revisão do scan ", partes[0], 1, 3);
  assert.match(p, /^Abaixo está a transcrição \(parte 1 de 3\) do vídeo "Revisão do scan"\./);
  assert.match(p, /entre colchetes, exatamente como aparece na transcrição: \[12:34\]/);
  assert.match(p, /Esta é a parte 1 de 3/);
  assert.match(p, /\nTranscrição:\n\n\[0:01\] Marina Souza: /);
  assert.ok(!X.promptDoVideo("x", "y").includes("parte"));
});

teste("vídeo da página: só entra o que tem a forma certa", () => {
  const p = T.normalizarPagina({ id: "v1", tipo: "video", video: {
    arquivo: "2026/abc-gravacao.mp4", transcricao: "../../etc/passwd", capa: "2026/../x.png", url: "javascript:alert(1)", caminho: "C:\\Videos\\reuniao.mp4",
    duracao: "754.6", tamanho: -5, capitulos: [{ t: 90, titulo: "Triagem" }, { t: "abc" }, null, { t: 10, titulo: 7 }, { t: -1, titulo: "negativo" }], campoFuturo: "fica",
  } });
  assert.equal(p.tipo, "video");
  assert.deepEqual([p.video.arquivo, p.video.transcricao, p.video.capa, p.video.url, p.video.caminho, p.video.duracao, p.video.tamanho, p.video.campoFuturo],
    ["2026/abc-gravacao.mp4", undefined, undefined, undefined, "C:\\Videos\\reuniao.mp4", 755, undefined, "fica"]);
  assert.deepEqual(p.video.capitulos, [{ t: 10, titulo: "" }, { t: 90, titulo: "Triagem" }]);
  assert.equal(T.normalizarVideo({ url: " https://exemplo.local/v " }).url, "https://exemplo.local/v");
  for (const mau of [null, 5, "x", []]) assert.equal(T.normalizarVideo(mau), null);
  // página comum não ganha vídeo; página de vídeo sem nada tem um vídeo vazio
  assert.deepEqual([T.normalizarPagina({ id: "d" }).tipo, T.normalizarPagina({ id: "d" }).video], ["doc", null]);
  assert.deepEqual(T.normalizarPagina({ id: "v", tipo: "video" }).video, {});
  assert.equal(T.normalizarPagina({ id: "x", tipo: "qualquer" }).tipo, "doc");
});

console.log(`\n${total - falhas} de ${total} testes passaram.`);
process.exit(falhas ? 1 : 0);
