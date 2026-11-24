// Auditoria visual (3.24): abre cada tela em 1366x768, nos dois temas, e mede o que dá para medir sem olho humano.
// Também abre as janelas e os painéis de uso mais comum (nova tarefa, ajuda, paleta, perfis, Personalizar, sino, planejar o dia).
//
// O que acusa, em cada tela:
//   - rolagem horizontal da página e barra superior transbordando (o sino e o "Mais" ficariam cortados);
//   - atributo title (dica nativa do navegador, proibida: use Dica);
//   - botão, link ou campo sem nome acessível;
//   - título da tela cortado, travessão no texto, imagem sem alt;
//   - texto com contraste abaixo de 4,5:1 (3:1 no texto grande), medido contra o fundo de verdade;
//   - erro de script ou de console.
// Fundo com gradiente ou imagem e texto esmaecido de propósito (opacidade) ficam de fora: não dá para medir.
// É uma régua, não um teste de comportamento: o que ela não vê (alinhamento, hierarquia, gosto) continua pedindo as fotos.
//
// Uso (num servidor de teste, NUNCA no de uso diário), com o cenário de testes/semear.mjs numa pasta descartável:
//   NEXO_URL=http://127.0.0.1:3312 node testes/auditoria.cjs [trecho do nome da tela | abertos]
// As fotos e o relatorio.txt vão para NEXO_AUDITORIA_SAIDA (padrão: uma pasta "nexo-auditoria" na pasta temporária do sistema).
// Sai com código 1 se houver algum achado. Precisa do Playwright para Node, achado por NODE_PATH, como o e2e.
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");

const B = process.env.NEXO_URL;
if (!B || /:3210(\D|$)/.test(B)) {
  console.error("Informe NEXO_URL com o endereço de um servidor de teste (nunca o 3210, que é o de uso diário).");
  process.exit(2);
}
const SAIDA = process.env.NEXO_AUDITORIA_SAIDA || path.join(os.tmpdir(), "nexo-auditoria");
fs.mkdirSync(SAIDA, { recursive: true });
const filtro = process.argv[2] || "";
// a versão das novidades que o app tem agora: marcada como vista, para o aviso de novidades não cobrir a tela
const VERSAO = (fs.readFileSync(path.join(__dirname, "..", "components", "shell", "Novidades.tsx"), "utf8").match(/VERSAO_NOVIDADES = "([^"]+)"/) || [])[1] || "";

const hoje = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

// A auditoria roda dentro da página. Só mede: não muda nada.
const AUDITORIA = () => {
  const visivel = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    return true;
  };
  const onde = (e) => {
    const slot = e.closest("[data-slot]")?.getAttribute("data-slot") || "";
    return `${e.tagName.toLowerCase()}${slot ? `[${slot}]` : ""} "${(e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 50)}"`;
  };
  const achados = [];
  // 1. rolagem horizontal da página
  if (document.documentElement.scrollWidth > innerWidth + 1) achados.push(`rolagem horizontal: ${document.documentElement.scrollWidth} > ${innerWidth}`);
  // 1b. a barra superior não pode transbordar (o sino e o Mais ficariam cortados)
  const barraTopo = document.querySelector("[data-slot=barra-superior]");
  if (barraTopo && barraTopo.scrollWidth > barraTopo.clientWidth + 1) achados.push(`barra superior transborda: ${barraTopo.scrollWidth} > ${barraTopo.clientWidth}`);
  // 2. dica nativa do navegador (atributo title) é proibida
  for (const e of document.querySelectorAll("[title]")) if (e.tagName !== "IFRAME" && visivel(e)) achados.push(`atributo title: ${onde(e)}`);
  // 3. controle sem nome acessível
  for (const e of document.querySelectorAll("button, a[href], [role=button], [role=switch], [role=checkbox], input, textarea, select")) {
    if (!visivel(e) || e.closest("[aria-hidden=true]")) continue;
    const nome = (e.getAttribute("aria-label") || "").trim() || (e.getAttribute("aria-labelledby") ? "x" : "") || (e.innerText || "").trim() || (e.getAttribute("placeholder") || "").trim() || (e.labels && e.labels.length ? "x" : "") || (e.querySelector("img[alt]:not([alt=''])") ? "x" : "");
    if (!nome && e.getAttribute("type") !== "hidden" && e.getAttribute("tabindex") !== "-1") achados.push(`sem nome acessível: ${onde(e)} ${e.outerHTML.slice(0, 90)}`);
  }
  // 4. título da tela cortado
  for (const e of document.querySelectorAll("[data-slot=pagina] h1")) if (visivel(e) && e.scrollWidth > e.clientWidth + 1) achados.push(`título cortado: ${onde(e)}`);
  // 5. travessão no texto da interface
  const texto = document.body.innerText;
  const i = texto.indexOf("—");
  if (i >= 0) achados.push(`travessão no texto: "...${texto.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, " ")}..."`);
  // 6. imagem sem alt
  for (const e of document.querySelectorAll("img:not([alt])")) if (visivel(e)) achados.push(`imagem sem alt: ${onde(e)}`);
  // 7. contraste dos selos e do texto pequeno: cor do texto contra o fundo de verdade (composto pelos ancestrais)
  const tela = document.createElement("canvas");
  tela.width = tela.height = 1;
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  const rgba = (cor) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = cor; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const sobre = (cima, baixo) => { const a = cima[3]; return [cima[0] * a + baixo[0] * (1 - a), cima[1] * a + baixo[1] * (1 - a), cima[2] * a + baixo[2] * (1 - a), 1]; };
  const fundoDe = (e) => {
    const pilha = [];
    for (let x = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.backgroundImage && s.backgroundImage !== "none") return null; // gradiente ou imagem: não dá para medir
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) pilha.push(c);
      if (c[3] >= 0.999) break;
    }
    let base = [255, 255, 255, 1];
    for (const c of pilha.reverse()) base = sobre(c, base);
    return base;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const baixos = new Map();
  const caminhante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = caminhante.nextNode(); n; n = caminhante.nextNode()) {
    const t = n.nodeValue.trim();
    const e = n.parentElement;
    if (t.length < 2 || !e || !visivel(e) || e.closest("[aria-hidden=true], [disabled], [aria-disabled=true], [data-disabled], .sr-only, kbd")) continue;
    const s = getComputedStyle(e);
    let op = 1;
    for (let x = e; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    if (op < 0.99) continue; // texto esmaecido de propósito (concluído, desligado)
    const fundo = fundoDe(e);
    if (!fundo) continue;
    const cor = sobre(rgba(s.color), fundo);
    const a = lum(cor), b = lum(fundo);
    const razao = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const grande = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (razao < (grande ? 3 : 4.5)) {
      const chave = `${e.closest("[data-slot]")?.getAttribute("data-slot") || e.tagName}|${s.color}|${Math.round(razao * 10) / 10}`;
      if (!baixos.has(chave)) baixos.set(chave, `contraste ${razao.toFixed(2)}:1 (${s.fontSize}): ${onde(e)}`);
    }
  }
  achados.push(...[...baixos.values()].slice(0, 12));
  return achados;
};

(async () => {
  const dados = await (await fetch(B + "/api/dados")).json();
  if (!dados.tarefas || !dados.tarefas.length) {
    console.error("A pasta de dados do servidor está vazia. Rode antes: NEXO_URL=" + B + " node testes/semear.mjs");
    process.exit(2);
  }
  // Chromium do Playwright; sem ele, o Chrome; sem ele, o Edge (como no e2e)
  let navegador;
  for (const channel of [undefined, "chrome", "msedge"]) {
    try { navegador = await chromium.launch({ args: ["--no-sandbox"], channel }); break; } catch {}
  }
  if (!navegador) throw new Error("Não achei Chromium, Chrome nem Edge para abrir.");
  const cat = (dados.categorias.items || dados.categorias)[0];
  const tarefa = dados.tarefas.find((t) => t.id === "tdemo1") || dados.tarefas[0];
  const pessoa = ((dados.pessoas && dados.pessoas.items) || [])[0];
  const ROTAS = [
    ["hoje", "/"], ["tarefas", "/tarefas"], ["tarefas-lista", "/tarefas", { "nexo:visaoTarefas": "lista" }], ["tarefas-quadro", "/tarefas", { "nexo:visaoTarefas": "quadro" }],
    ["tarefa", `/tarefas/${tarefa.id}`], ["reuniao", `/tarefas/${tarefa.id}/reuniao`], ["rotina", "/rotina"], ["banco", "/rotina?v=banco"], ["pendencias", "/pendencias"], ["notas", "/notas"],
    ["paginas", "/paginas"], ["perguntar", "/perguntar"], ["categorias", "/categorias"], ["tags", "/categorias?aba=tags"], ["categoria", `/categorias/${cat.id}`],
    ["pessoas", "/pessoas"], ...(pessoa ? [["pessoa", `/pessoas?p=${encodeURIComponent(pessoa.nome)}`]] : []), ["links", "/links"],
    ["radar", "/radar"], ["diario", "/diario"], ["decisoes", "/decisoes"], ["revisao", "/revisao"], ["relatorios", "/relatorios"], ["conquistas", "/conquistas"],
    ["configuracoes", "/configuracoes"], ["busca", "/busca?q=scan"],
  ].filter(([nome]) => !filtro || nome.includes(filtro));

  const relatorio = [];
  for (const tema of ["dark", "light"]) {
    const ctx = await navegador.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR", colorScheme: tema });
    await ctx.addInitScript(([h, t, v]) => {
      try {
        localStorage.setItem("nexo:rotina", JSON.stringify({ ultimoPlanejamento: h, ultimaRevisao: h, abrirSozinho: false }));
        localStorage.setItem("nexo:novidadesVistas", JSON.stringify(v));
        localStorage.setItem("nexo:boasVindas", JSON.stringify("feito"));
        localStorage.setItem("nexo:tema", JSON.stringify(t));
      } catch {}
    }, [hoje, tema === "dark" ? "escuro" : "claro", VERSAO]);
    const pg = await ctx.newPage();
    const errosDaPagina = [];
    pg.on("pageerror", (e) => errosDaPagina.push(`pageerror: ${e.message}`));
    pg.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errosDaPagina.push(`console: ${m.text().slice(0, 200)}`); });
    for (const [nome, rota, prefs] of ROTAS) {
      errosDaPagina.length = 0;
      await pg.goto(B + rota);
      if (prefs) {
        await pg.evaluate((extra) => { for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v)); }, prefs);
        errosDaPagina.length = 0;
        await pg.reload();
      }
      await pg.locator("[data-slot=pagina], [data-slot=app] main").first().waitFor({ timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(1200);
      const achados = await pg.evaluate(AUDITORIA).catch((e) => [`a auditoria falhou: ${e.message}`]);
      await pg.screenshot({ path: path.join(SAIDA, `${nome}-${tema === "dark" ? "escuro" : "claro"}.png`) });
      const temaAplicado = await pg.evaluate(() => document.documentElement.classList.contains("dark") ? "escuro" : "claro");
      relatorio.push({ tela: nome, tema: temaAplicado, achados: [...errosDaPagina, ...achados] });
      for (const k of Object.keys(prefs || {})) await pg.evaluate((c) => localStorage.removeItem(c), k);
    }
    const ABERTOS = [
      ["nova-tarefa", async () => { await pg.keyboard.press("n"); await pg.locator("[data-slot=form-tarefa]").waitFor(); }],
      ["ajuda", async () => { await pg.keyboard.press("?"); await pg.locator("[data-slot=ajuda]").waitFor(); }],
      ["paleta", async () => { await pg.keyboard.press("Control+k"); await pg.locator("[cmdk-root], [data-slot=paleta]").first().waitFor(); }],
      ["perfis", async () => { await pg.keyboard.press("p"); await pg.locator("[role=menu]").first().waitFor(); }],
      ["personalizar", async () => { await pg.locator("[data-slot=menu-mais]").click(); await pg.getByRole("menuitem", { name: /Personalizar/ }).click(); await pg.waitForTimeout(600); }],
      ["sino", async () => { await pg.getByRole("button", { name: /Lembretes|lembretes|Notifica/ }).first().click(); await pg.waitForTimeout(400); }],
      ["planejar", async () => { await pg.keyboard.press("d"); await pg.locator("[role=dialog]").first().waitFor(); }],
    ].filter(([nome]) => !filtro || nome.includes(filtro) || filtro === "abertos");
    for (const [nome, abrir] of ABERTOS) {
      errosDaPagina.length = 0;
      let achados = [];
      try {
        await pg.goto(B + "/");
        await pg.locator("[data-slot=pagina]").first().waitFor();
        await pg.waitForTimeout(600);
        await pg.locator("[data-slot=pagina] h1").first().click();
        await abrir();
        await pg.waitForTimeout(700);
        achados = await pg.evaluate(AUDITORIA);
        await pg.screenshot({ path: path.join(SAIDA, `aberto-${nome}-${tema === "dark" ? "escuro" : "claro"}.png`) });
      } catch (e) { achados = [`não abriu: ${String(e.message).split("\n")[0]}`]; }
      relatorio.push({ tela: "aberto: " + nome, tema: tema === "dark" ? "escuro" : "claro", achados: [...errosDaPagina, ...achados] });
    }
    await ctx.close();
  }
  await navegador.close();
  const linhas = [];
  for (const r of relatorio) { linhas.push(`## ${r.tela} (${r.tema}): ${r.achados.length ? r.achados.length + " achados" : "limpo"}`); for (const a of r.achados) linhas.push(`  - ${a}`); }
  fs.writeFileSync(path.join(SAIDA, "relatorio.txt"), linhas.join("\n") + "\n");
  const comAchado = relatorio.filter((r) => r.achados.length);
  console.log(linhas.join("\n"));
  console.log(`\n${relatorio.length} telas e estados auditados, ${comAchado.length} com achado. Fotos e relatório em ${SAIDA}`);
  process.exit(comAchado.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
