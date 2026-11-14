// Teste ponta a ponta da interface (Playwright para Node + Chromium/Chrome).
//
// Pré-requisito: o pacote "playwright" acessível pelo Node (global ou NODE_PATH)
// e um navegador: o Chromium do Playwright (npx playwright install chromium) ou
// o Google Chrome instalado (usado sozinho se o Chromium não existir).
//
// Rode SEMPRE com uma pasta de dados VAZIA e descartável (nunca os dados reais):
//   npm run build
//   HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-dados npx next start -p 3311 -H 127.0.0.1
//   NEXO_URL=http://127.0.0.1:3311 node testes/e2e.cjs
//
// Imprime "ok <passo>" a cada etapa e termina com código 1 se algo falhar,
// inclusive erro ou aviso do React no console do navegador.
// NEXO_E2E_FOTOS=<pasta> salva screenshots de cada etapa (opcional).
//
// Cobre: categorias, nova tarefa pelo atalho N, registro de reunião com o fluxo
// do Copilot (copiar prompt, colar resposta, preencher campos), rascunho do registro
// (Esc, F5, continuar, descartar), atividade que
// conclui passo antigo, passo marcado na página da tarefa, troca de status com
// marco, conclusão, lista/quadro/filtro em /tarefas, pendências, busca, pessoas,
// pessoas e times (cadastro, time, importar do Outlook, busca), links, relatórios, revisão, configurações, tela Hoje (captura rápida e foco),
// ritual "Planejar o dia", bloco de notas (escrever, prompt, JSON, prévia, aplicar), paleta Ctrl+K,
// moldura (fixar tarefa na barra lateral, anotar rápido pelo atalho A, foco na barra superior,
// painel Personalizar: cor de destaque, esconder item e ferramenta), esperando quem (cobrança),
// modelos de tarefa, sessão de foco, diário e tema escuro.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const B = process.env.NEXO_URL || "http://127.0.0.1:3210";
const FOTOS = process.env.NEXO_E2E_FOTOS || "";
const T = 10000;

const TITULO = "Onboarding do squad Pagamentos no Ferramenta X";
const ANOTACOES =
  "marina topou, felipe da arquitetura validou desenho. falta acesso ao repo checkout. gate só critica no começo. eu mando doc.";
const RESP = `## RESUMO
Alinhamos o escopo do onboarding da Ferramenta X no squad de Pagamentos. O time vai integrar o scan na pipeline até o fim do mês e a arquitetura validou o desenho.

## DECISÕES
- Começar pelo repositório de checkout
- Gate de bloqueio só para severidade crítica no início

## PRÓXIMOS PASSOS
- Enviar documentação de integração para o squad (responsável: Eu)
- Liberar acesso ao repositório de checkout (responsável: Marina)
- Agendar follow-up em 15 dias

## IMPEDIMENTOS
- Aguardando liberação de acesso pelo time de plataforma

## PARTICIPANTES
- Marina
- Felipe

## PASSOS CONCLUÍDOS
- Nenhum
`;
const RESP_ATIVIDADE = `## RESUMO
Documentação enviada por e-mail ao squad.
## PRÓXIMOS PASSOS
Nenhum
## PASSOS CONCLUÍDOS
- Enviar documentação de integração para o squad (responsável: Eu)
`;
const ROTINA_DESLIGADA = JSON.stringify({ ultimoPlanejamento: "2999-01-01", ultimaRevisao: "", abrirSozinho: false });

let passoAtual = "início";
const erros = [];
const ok = (p) => console.log("ok " + p);
function afirmar(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function abrirNavegador() {
  const args = ["--no-sandbox"];
  try {
    return await chromium.launch({ args });
  } catch {
    return await chromium.launch({ args, channel: "chrome" });
  }
}

async function main() {
  const estado = await (await fetch(B + "/api/estado")).json();
  afirmar(estado.configurado, "o app não tem pasta de dados configurada (use NEXO_DATA_DIR)");
  const lista = (d) => ({ ...d, categorias: d.categorias.items || d.categorias, links: d.links.items || d.links });
  const dados0 = lista(await (await fetch(B + "/api/dados")).json());
  afirmar(
    (dados0.tarefas || []).length === 0 && (dados0.categorias || []).length === 0,
    "a pasta de dados não está vazia. Rode o teste numa pasta descartável e vazia.",
  );

  const navegador = await abrirNavegador();
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    locale: "pt-BR",
  });
  // Desliga o ritual automático (o próprio ritual é testado pela tecla D).
  await ctx.addInitScript((v) => {
    try {
      if (!sessionStorage.getItem("e2e-rotina")) {
        localStorage.setItem("nexo:rotina", v);
        sessionStorage.setItem("e2e-rotina", "1");
      }
    } catch {}
  }, ROTINA_DESLIGADA);
  const pg = await ctx.newPage();
  pg.setDefaultTimeout(T);
  pg.on("pageerror", (e) => erros.push(`[${passoAtual}] pageerror: ${e.message}`));
  pg.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || (m.type() === "warning" && /react|key|hydrat|aria|DialogContent|Description/i.test(t)))
      erros.push(`[${passoAtual}] console.${m.type()}: ${t.slice(0, 400)}`);
  });

  let nFoto = 0;
  const foto = async (nome) => {
    if (!FOTOS) return;
    fs.mkdirSync(FOTOS, { recursive: true });
    await pg.screenshot({ path: path.join(FOTOS, `${String(++nFoto).padStart(2, "0")}-${nome}.png`) });
  };
  const etapa = async (nome, fn) => {
    passoAtual = nome;
    await fn();
    await foto(nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
    ok(nome);
  };
  const dialogo = () => pg.locator('[role=dialog][data-state=open], [role=alertdialog][data-state=open]').last();
  const dados = async () => lista(await (await pg.request.get(B + "/api/dados")).json());
  const escolherData = async (escopo, rotulo, texto) => {
    await escopo.locator(`[data-slot=seletor-data][aria-label="${rotulo}"]`).click();
    const campo = pg.getByLabel("Digitar data");
    await campo.fill(texto);
    await campo.press("Enter");
  };
  const fecharDialogo = async () => {
    await pg.keyboard.press("Escape");
    await pg.locator("[role=dialog][data-state=open]").waitFor({ state: "detached" }).catch(() => {});
  };

  // ---------- categorias ----------
  await etapa("criar 2 categorias", async () => {
    await pg.goto(B + "/categorias");
    for (const [nome, desc] of [
      ["Ferramenta X", "Programa de adoção da Ferramenta X pelos squads"],
      ["Security Champion", "Formação e acompanhamento dos champions"],
    ]) {
      await pg.getByRole("button", { name: "Nova categoria" }).first().click();
      const d = dialogo();
      await d.getByPlaceholder("Ex.: Security Champion").fill(nome);
      await d.locator("textarea").first().fill(desc);
      await d.getByRole("button", { name: "Salvar", exact: true }).click();
      await pg.locator("[data-slot=card-categoria]", { hasText: nome }).waitFor();
    }
    const d = await dados();
    afirmar(d.categorias.length === 2, "esperava 2 categorias, veio " + d.categorias.length);
  });

  // ---------- nova tarefa pelo atalho N ----------
  let urlTarefa = "";
  let idTarefa = "";
  await etapa("criar tarefa pelo atalho N", async () => {
    await pg.goto(B + "/tarefas");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    await pg.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await pg.keyboard.press("n");
    const d = dialogo();
    await d.locator("[data-slot=form-tarefa]").waitFor();
    await d.getByLabel("Título da tarefa").fill(TITULO);
    await d.locator('[data-slot=combobox][aria-label="Categoria"]').click();
    await pg.locator("[data-slot=command-item]", { hasText: "Ferramenta X" }).first().click();
    await d.locator('[data-slot=select-trigger][aria-label="Status"]').click();
    await pg.locator("[data-slot=select-item]", { hasText: "Em andamento" }).click();
    await d.locator('[data-slot=seletor-prioridade] button[aria-label="Prioridade 8"]').click();
    await escolherData(d, "Prazo", "28/11/2026");
    await d.getByPlaceholder("O que precisa ser entregue, quem pediu, contexto...").fill(
      "Colocar o scan da Ferramenta X na pipeline do squad de Pagamentos e treinar o time.",
    );
    await d.getByRole("button", { name: "Salvar", exact: true }).click();
    await pg.waitForURL(/\/tarefas\/[^/]+$/);
    urlTarefa = pg.url();
    idTarefa = urlTarefa.split("/").pop();
    await pg.getByText(TITULO).first().waitFor();
    const t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(t, "tarefa não foi gravada");
    afirmar(t.status === "em_andamento", "status errado: " + t.status);
    afirmar(t.prioridade === 8, "prioridade errada: " + t.prioridade);
    afirmar(t.prazo === "2026-11-28", "prazo errado: " + t.prazo);
    const cat = (await dados()).categorias.find((c) => c.id === t.categoriaId);
    afirmar(cat && cat.nome === "Ferramenta X", "categoria errada");
    afirmar(t.registros.some((r) => r.tipo === "marco"), "faltou o marco de tarefa criada");
  });

  // ---------- registro de reunião com o Copilot ----------
  await etapa("registro de reunião com Copilot", async () => {
    await pg.locator('[data-slot=registrar][data-tipo=reuniao]').click();
    const d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.getByPlaceholder("Ex.: Alinhamento com o time de arquitetura").fill("Kickoff com o squad");
    const chips = d.locator("[data-slot=campo-chips] input").first();
    await chips.fill("Marina");
    await chips.press("Enter");
    await d.getByPlaceholder("O que foi falado, combinado, o que ficou pendente...").fill(ANOTACOES);
    await d.getByRole("button", { name: "Copiar prompt para o Copilot" }).click();
    await d.locator("[data-slot=retorno-copia]").waitFor();
    const prompt = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(prompt.includes(TITULO), "prompt sem o título da tarefa");
    afirmar(prompt.includes("felipe da arquitetura"), "prompt sem as anotações");
    await d.getByPlaceholder("Cole a resposta aqui...").fill(RESP);
    await d.getByRole("button", { name: "Preencher campos com a resposta" }).click();
    await d.locator("[data-slot=retorno-preenchimento]").waitFor();
    const acoes = await d.locator('[data-slot=editor-passo] input[aria-label="Ação"]').evaluateAll((els) => els.map((e) => e.value));
    afirmar(acoes.length === 3, "esperava 3 passos preenchidos, veio " + acoes.length);
    await d.getByRole("button", { name: "Salvar registro" }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    const card = pg.locator("[data-slot=registro]", { hasText: "Kickoff com o squad" });
    await card.waitFor();
    await card.getByText("Liberar acesso ao repositório de checkout").first().waitFor();
    const t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    const r = t.registros.find((x) => x.titulo === "Kickoff com o squad");
    afirmar(r && r.proximosPassos.length === 3, "registro sem os 3 passos");
    afirmar(r.participantes.includes("Marina") && r.participantes.includes("Felipe"), "participantes: " + r.participantes);
    afirmar(r.decisoes.includes("checkout"), "decisões não vieram");
  });

  // ---------- atividade que conclui passo antigo ----------
  await etapa("rascunho do registro sobrevive a Esc e F5", async () => {
    await pg.locator('[data-slot=registrar][data-tipo=reuniao]').click();
    let d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.getByPlaceholder("O que foi falado").fill("anotação que não pode sumir");
    await d.locator("[data-slot=rascunho-estado]").waitFor();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=rascunho-aviso]").waitFor();
    await pg.reload();
    await pg.locator("[data-slot=rascunho-aviso]").getByRole("button", { name: "Continuar" }).click();
    d = dialogo();
    await d.locator("[data-slot=rascunho-recuperado]").waitFor();
    afirmar((await d.getByPlaceholder("O que foi falado").inputValue()) === "anotação que não pode sumir", "o rascunho não voltou depois do F5");
    await d.getByRole("button", { name: "Descartar", exact: true }).click();
    await pg.locator("[role=alertdialog][data-state=open]").getByRole("button", { name: "Descartar" }).click();
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=rascunho-aviso]").waitFor({ state: "detached" });
    await pg.locator("[role=alertdialog]").waitFor({ state: "detached" });
    const sobras = await pg.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("nexo:rascunho:")).length);
    afirmar(sobras === 0, "o rascunho descartado continuou guardado");
  });

  await etapa("atividade conclui passo antigo", async () => {
    await pg.locator('[data-slot=registrar][data-tipo=atividade]').click();
    const d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.getByPlaceholder("Resumo em uma linha").fill("Enviei a documentação de integração");
    await d.getByPlaceholder("Cole a resposta aqui...").fill(RESP_ATIVIDADE);
    await d.getByRole("button", { name: "Preencher campos com a resposta" }).click();
    const marcado = d.locator("[data-slot=passos-anteriores] li", { hasText: "Enviar documentação de integração" }).locator("[data-slot=checkbox]");
    await marcado.waitFor();
    afirmar((await marcado.getAttribute("data-state")) === "checked", "o passo antigo não veio marcado para concluir");
    await d.getByRole("button", { name: "Salvar registro" }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    await pg.locator("[data-slot=registro]", { hasText: "Enviei a documentação de integração" }).waitFor();
    const t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    const p = t.registros.flatMap((r) => r.proximosPassos).find((x) => x.texto.startsWith("Enviar documentação"));
    afirmar(p && p.feito, "o passo não foi concluído no disco");
    await pg.goto(B + "/pendencias");
    await pg.locator("[data-slot=passo]", { hasText: "Liberar acesso" }).first().waitFor();
    afirmar((await pg.locator("[data-slot=passo]:not([data-feito])", { hasText: "Enviar documentação de integração" }).count()) === 0, "passo concluído continua em pendências");
  });

  // ---------- marcar passo na página da tarefa ----------
  await etapa("marcar passo como feito na tarefa", async () => {
    await pg.goto(urlTarefa);
    const passo = pg.locator("[data-slot=lateral] [data-slot=passo], [data-slot=tarefa-lateral] [data-slot=passo]", { hasText: "Agendar follow-up" }).first();
    const alvo = (await passo.count()) ? passo : pg.locator("[data-slot=passo]", { hasText: "Agendar follow-up" }).first();
    await alvo.locator("[data-slot=checkbox]").click();
    await pg.waitForFunction(async ({ id }) => {
      const d = await (await fetch("/api/dados")).json();
      const t = d.tarefas.find((x) => x.id === id);
      return t.registros.flatMap((r) => r.proximosPassos).some((p) => p.texto.startsWith("Agendar follow-up") && p.feito);
    }, { id: idTarefa }, { polling: 300 });
  });

  // ---------- status e conclusão ----------
  await etapa("mudar status gera marco", async () => {
    await pg.locator("[data-slot=seletor-status]").first().click();
    await pg.getByRole("menuitemradio", { name: "Aguardando terceiros" }).click();
    await pg.locator("[role=menu]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=registro]", { hasText: "Aguardando terceiros" }).first().waitFor();
    const t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(t.status === "aguardando", "status não gravou: " + t.status);
  });
  await etapa("esperando quem: anotar, copiar a cobrança e cobrar", async () => {
    // ir para "aguardando" abre sozinho a pergunta "esperando quem?"
    const form = pg.locator("[data-slot=form-espera]");
    await form.waitFor();
    await pg.getByLabel("Quem ficou de responder").fill("Marina");
    await pg.getByLabel("O que você está esperando").fill("liberar o acesso ao repositório");
    await pg.getByRole("button", { name: "em 5 dias" }).click();
    await pg.locator("[data-slot=salvar-espera]").click();
    await form.waitFor({ state: "detached" });
    const faixa = pg.locator("[data-slot=faixa-espera]");
    await faixa.getByText("Marina").first().waitFor();
    let t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(t.esperando && t.esperando.quem === "Marina" && t.esperando.oQue === "liberar o acesso ao repositório", "a espera não foi gravada");
    afirmar(!!t.lembrarEm, "o lembrete de cobrar não foi gravado");
    await pg.locator("[data-slot=copiar-cobranca]").click();
    const msg = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(msg.startsWith("Oi, Marina!") && msg.includes("liberar o acesso ao repositório"), "mensagem de cobrança errada: " + msg);
    await pg.locator("[data-slot=cobrei]").click();
    await pg.locator("[data-slot=registro]", { hasText: "Cobrei Marina" }).first().waitFor();
    t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(!!t.esperando.cobradoEm, "a cobrança não ficou marcada");
    // na tela Hoje a linha mostra de quem se espera
    await pg.goto(B + "/");
    await pg.locator("[data-slot=linha-espera]", { hasText: "Marina" }).first().waitFor();
    await pg.goto(B + "/tarefas/" + idTarefa);
    await faixa.waitFor();
  });
  await etapa("concluir tarefa mostra card Concluída", async () => {
    await pg.locator("[data-slot=seletor-status]").first().click();
    await pg.getByRole("menuitemradio", { name: "Concluída" }).click();
    await pg.locator("[role=menu]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=registro]", { hasText: "Concluída" }).first().waitFor();
    // saiu de "aguardando": a faixa some, mas de quem se esperava fica escrito no marco
    await pg.locator("[data-slot=faixa-espera]").waitFor({ state: "detached" });
    const fechada = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(fechada.esperando === null, "a espera devia ter sido limpa ao concluir");
    afirmar(fechada.registros.at(-1).anotacoes.includes("Estava esperando Marina"), "o marco não guardou de quem se esperava");
    const t = (await dados()).tarefas.find((x) => x.id === idTarefa);
    afirmar(t.status === "concluida" && t.concluidaEm, "conclusão não gravou");
  });

  // ---------- /tarefas ----------
  await etapa("lista de tarefas, visões e filtro", async () => {
    await pg.goto(B + "/tarefas");
    await pg.getByLabel("Filtrar tarefas por texto").fill("Pagamentos");
    // a tarefa já foi concluída e o padrão é "Só abertas": pede "Todas"
    await pg.locator('[data-slot=select-trigger][aria-label="Filtrar por status"]').click();
    await pg.locator("[data-slot=select-item]", { hasText: /^\s*Todas\s*$/ }).click();
    // só a área de conteúdo: o título também aparece em "Recentes", na barra lateral
    const conteudo = pg.locator("[data-slot=conteudo]");
    await conteudo.getByText(TITULO).first().waitFor();
    for (const v of ["Lista", "Quadro"]) {
      await pg.getByRole("radio", { name: v }).click();
      await pg.waitForTimeout(300);
    }
    await pg.locator("[data-slot=quadro-tarefas]").waitFor();
    await pg.getByLabel("Filtrar tarefas por texto").fill("nada-que-exista-xyz");
    await pg.waitForTimeout(300);
    afirmar((await conteudo.getByText(TITULO).count()) === 0, "filtro por texto não escondeu a tarefa");
    await pg.getByLabel("Filtrar tarefas por texto").fill("");
  });

  // ---------- telas ----------
  await etapa("pendências abre", async () => {
    await pg.goto(B + "/pendencias");
    await pg.locator("[data-slot=passo]", { hasText: "Liberar acesso" }).first().waitFor({ state: "attached" }).catch(() => {});
    await pg.locator("[data-slot=pagina]").first().waitFor();
  });
  await etapa("busca encontra anotações", async () => {
    await pg.goto(B + "/busca?q=checkout");
    await pg.locator("[data-slot=resultado]").first().waitFor();
  });
  await etapa("pessoas mostra a participante", async () => {
    await pg.goto(B + "/pessoas");
    await pg.locator("[data-slot=pessoa], [data-slot=nome-solto]", { hasText: "Marina" }).first().waitFor();
  });
  await etapa("links: adicionar e ver na lista", async () => {
    await pg.goto(B + "/links");
    await pg.getByRole("button", { name: "Adicionar" }).first().click();
    const d = dialogo();
    await d.getByPlaceholder("https://...").fill("https://exemplo.com/guia-ferramenta-x");
    await d.getByPlaceholder("Como você vai reconhecer isso depois").fill("Guia de integração da Ferramenta X");
    await d.getByRole("button", { name: "Salvar", exact: true }).click();
    await pg.locator("[data-slot=link]", { hasText: "Guia de integração da Ferramenta X" }).first().waitFor();
    afirmar((await dados()).links.length === 1, "link não gravou");
  });
  for (const [rota, nome] of [["/relatorios", "relatórios"], ["/revisao", "revisão"], ["/configuracoes", "configurações"], ["/categorias", "categorias"]]) {
    await etapa(`${nome} abre`, async () => {
      await pg.goto(B + rota);
      await pg.locator("[data-slot=pagina]").first().waitFor();
      await pg.waitForTimeout(300);
    });
  }

  // ---------- tela Hoje ----------
  const CAPTURA = "Revisar achados críticos do squad de Pagamentos";
  await etapa("captura rápida cria tarefa", async () => {
    await pg.goto(B + "/");
    const c = pg.getByLabel("Captura rápida de tarefa");
    await c.fill(CAPTURA);
    await c.press("Enter");
    await pg.locator("[data-slot=anotada]", { hasText: CAPTURA }).waitFor();
    afirmar((await dados()).tarefas.some((t) => t.titulo === CAPTURA), "captura não gravou");
  });
  await etapa("focar tarefa aparece em Foco de hoje", async () => {
    await pg.locator("[data-slot=anotada]", { hasText: CAPTURA }).getByRole("button", { name: "Focar hoje" }).click();
    await pg.locator("#foco-hoje", { hasText: CAPTURA }).waitFor();
  });

  // ---------- ritual ----------
  await etapa("ritual Planejar o dia até o fim", async () => {
    await pg.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await pg.keyboard.press("d");
    const d = dialogo();
    await d.locator("[data-slot=ritual-conteudo]").waitFor();
    for (let i = 0; i < 6; i++) {
      const b = d.locator("[data-acao=ritual-avancar]");
      if (!(await b.count())) break;
      const txt = await b.innerText();
      await b.click();
      if (/Começar o dia/.test(txt)) break;
      await pg.waitForTimeout(250);
    }
    await pg.locator("[data-slot=ritual-conteudo]").waitFor({ state: "detached" });
  });

  // ---------- pessoas e times ----------
  const pessoasDe = async () => (await dados()).pessoas?.items || [];
  const timesDe = async () => (await dados()).times?.items || [];
  const escolherMultiplo = async (d, rotulo, nome) => {
    await d.getByRole("combobox", { name: rotulo, exact: true }).click();
    await pg.locator("[data-slot=command-item]", { hasText: nome }).first().click();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=command-item]").first().waitFor({ state: "detached" }).catch(() => {});
  };
  await etapa("pessoas: cadastrar nome solto", async () => {
    await pg.goto(B + "/pessoas");
    const solto = pg.locator("[data-slot=nomes-soltos] [data-slot=nome-solto]", { hasText: "Marina" }).first();
    await solto.waitFor();
    await solto.getByRole("button", { name: "Cadastrar" }).click();
    const d = dialogo();
    await d.locator("[data-slot=pessoa-form]").waitFor();
    await d.getByPlaceholder("Ex.: Libera acessos, conhece a pipeline de deploy").fill("Libera a homologacao e conhece a pipeline");
    await d.getByRole("button", { name: "Salvar", exact: true }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    const p = (await pessoasDe()).find((x) => /^Marina/.test(x.nome));
    afirmar(p && /homologacao/.test(p.ajudaCom), "pessoa Marina sem ajudaCom no disco");
    await pg.locator("[data-slot=pessoa]", { hasText: "Marina" }).first().waitFor();
  });
  await etapa("pessoas: nova pessoa", async () => {
    await pg.goto(B + "/pessoas");
    await pg.getByRole("button", { name: "Nova pessoa" }).first().click();
    const d = dialogo();
    await d.locator("[data-slot=pessoa-form]").waitFor();
    await d.getByPlaceholder("Nome completo").fill("Renata Alves");
    await d.getByLabel("E-mail", { exact: true }).fill("renata.alves@exemplo.local");
    await d.getByLabel("Cargo", { exact: true }).fill("Product Owner");
    await d.getByRole("button", { name: "Salvar", exact: true }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    const p = (await pessoasDe()).find((x) => x.nome === "Renata Alves");
    afirmar(p && p.email === "renata.alves@exemplo.local" && p.cargo === "Product Owner", "Renata Alves não gravou direito");
    await pg.locator("[data-slot=pessoa]", { hasText: "Renata Alves" }).first().waitFor();
  });
  let idTime = "";
  await etapa("times: novo time", async () => {
    await pg.goto(B + "/pessoas");
    await pg.getByRole("radio", { name: /Times/ }).click();
    await pg.getByRole("button", { name: "Novo time" }).first().click();
    const d = dialogo();
    await d.locator("[data-slot=time-form]").waitFor();
    await d.getByPlaceholder("Ex.: Squad de Pagamentos").fill("Squad de Pagamentos");
    await escolherMultiplo(d, "Membros", "Marina");
    await escolherMultiplo(d, "Membros", "Renata Alves");
    await escolherMultiplo(d, "Responsáveis", "Renata Alves");
    await d.getByRole("button", { name: "Salvar", exact: true }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    const t = (await timesDe())[0];
    afirmar(t && t.membroIds.length === 2 && t.responsavelIds.length === 1, "time sem 2 membros e 1 responsável: " + JSON.stringify(t));
    idTime = t.id;
    await pg.locator("[data-slot=time]").first().waitFor();
  });
  await etapa("times: detalhe do time", async () => {
    await pg.locator("[data-slot=time]", { hasText: "Squad de Pagamentos" }).getByRole("link", { name: "Squad de Pagamentos" }).first().click();
    await pg.waitForURL(/\/pessoas\?.*time=/);
    afirmar(pg.url().includes(idTime), "URL do time sem o id");
    await pg.locator("[data-slot=membro]").first().waitFor();
    await pg.locator("[data-slot=responsavel]").first().waitFor();
  });
  await etapa("pessoas: importar do Outlook por colagem", async () => {
    await pg.goto(B + "/pessoas");
    await pg.getByRole("button", { name: "Importar do Outlook" }).first().click();
    const d = dialogo();
    await d.locator("[data-slot=importar-pessoas]").waitFor();
    await d.locator("[data-slot=importar-colagem]").fill("Paula Dias <paula.dias@exemplo.local>; Renata Alves <renata.alves@exemplo.local>");
    await d.locator("[data-slot=importar-continuar]").click();
    await d.locator("[data-slot=importado]").first().waitFor();
    afirmar((await d.locator("[data-slot=importado]").count()) === 2, "esperava 2 linhas importadas");
    afirmar((await d.locator('[data-slot=importado][data-situacao="nova"]').count()) === 1, "esperava exatamente 1 pessoa nova");
    await d.locator("[data-slot=importar-confirmar]").click();
    await pg.locator("[data-slot=importar-resumo]").waitFor();
    const ps = await pessoasDe();
    const paula = ps.find((x) => x.nome === "Paula Dias");
    afirmar(paula && paula.origem === "outlook", "Paula Dias não entrou com origem outlook");
    afirmar(ps.filter((x) => x.nome === "Renata Alves").length === 1, "Renata Alves duplicada");
    await fecharDialogo();
  });
  await etapa("busca acha pessoa pelo que ela ajuda", async () => {
    await pg.goto(B + "/busca?q=homologacao");
    await pg.locator("[data-slot=resultado][data-tipo=pessoa]").first().waitFor();
  });

  // ---------- paleta ----------
  await etapa("bloco de notas: escrever, organizar com o Copilot e aplicar", async () => {
    await pg.goto(B + "/notas");
    const texto = pg.locator("[data-slot=editor-nota] textarea");
    await texto.waitFor();
    await texto.fill("squad confirmou a data do treinamento. preciso mandar o convite.\nauditoria pediu um relatório novo.");
    await pg.locator("[data-slot=nota-situacao][data-situacao=salvo]").waitFor();
    afirmar((await dados()).notas.items.length === 1, "a folha não foi gravada sozinha");
    await pg.locator("[data-slot=organizar]").click();
    const d = dialogo();
    await d.locator("[data-slot=organizar-nota]").waitFor();
    await d.getByRole("button", { name: "Copiar prompt" }).click();
    await pg.waitForTimeout(300);
    const prompt = await pg.evaluate(() => navigator.clipboard.readText());
    const m = prompt.match(/\[(T\d+)\] (.+)/);
    afirmar(m && prompt.includes("squad confirmou a data"), "o prompt não trouxe a folha e as tarefas abertas");
    const antes = await dados();
    const resposta = "Aqui está:\n```json\n" + JSON.stringify({
      nexo: 1,
      itens: [
        { tipo: "registro", tarefa: m[1], tarefaTitulo: m[2], registroTipo: "atividade", titulo: "Data do treinamento confirmada",
          resumo: "O squad confirmou a data.", passos: [{ texto: "Mandar o convite do treinamento", responsavel: "Eu", prazo: null }], trecho: "squad confirmou a data do treinamento" },
        { tipo: "tarefa", titulo: "Relatório novo para a auditoria", descricao: "Pedido da auditoria.", prioridade: 6, passos: [] },
        { tipo: "comando_estranho" },
      ],
      sobras: "",
    }) + "\n```";
    await d.getByLabel("Resposta do Copilot").fill(resposta);
    await d.getByRole("button", { name: "Ler resposta" }).click();
    await d.locator("[data-slot=proposta]").first().waitFor();
    afirmar((await d.locator("[data-slot=proposta]").count()) === 2, "a prévia deveria ter 2 propostas");
    afirmar((await dados()).tarefas.length === antes.tarefas.length, "a prévia gravou algo antes de aplicar");
    await d.locator("[data-slot=aplicar-notas]").click();
    await pg.locator("[data-slot=organizar-nota]").waitFor({ state: "detached" });
    const depois = await dados();
    afirmar(depois.tarefas.some((t) => t.registros.some((r) => r.titulo === "Data do treinamento confirmada" && r.proximosPassos.length === 1)), "o registro não entrou na tarefa");
    afirmar(depois.tarefas.some((t) => t.titulo === "Relatório novo para a auditoria"), "a tarefa nova não foi criada");
    const folha = depois.notas.items[0];
    afirmar(folha.arquivadaEm && folha.gerou.length === 2, "a folha não foi arquivada com o que criou");
  });

  await etapa("paleta Ctrl+K abre a tarefa", async () => {
    await pg.goto(B + "/");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    await pg.keyboard.press("Control+k");
    const p = pg.locator("[data-slot=paleta]");
    await p.waitFor();
    await p.locator("[data-slot=command-input]").fill("Onboarding do squad");
    await pg.waitForTimeout(250);
    await pg.keyboard.press("Enter");
    await pg.waitForURL("**/tarefas/" + idTarefa);
  });

  // ---------- moldura: barra lateral e barra superior ----------
  await etapa("fixar a tarefa na barra lateral", async () => {
    const lateral = pg.locator("[data-slot=lateral]");
    // abrir a tarefa já a colocou em "Recentes"
    await lateral.locator("[data-secao=recentes] [data-slot=tarefa-nav]", { hasText: "Onboarding do squad" }).waitFor();
    await pg.getByRole("button", { name: "Mais ações" }).first().click();
    await pg.getByRole("menuitem", { name: "Fixar na barra lateral" }).click();
    const fixada = lateral.locator("[data-secao=fixadas] [data-slot=tarefa-nav]", { hasText: "Onboarding do squad" });
    await fixada.waitFor();
    const d = await (await pg.request.get(B + "/api/dados")).json();
    afirmar(d.tarefas.find((t) => t.id === idTarefa).fixada === true, "a tarefa não foi gravada como fixada");
    // recolher a seção guarda a escolha e esconde as linhas
    await lateral.locator("[data-secao=fixadas] button[aria-expanded]").click();
    await fixada.waitFor({ state: "detached" });
    await lateral.locator("[data-secao=fixadas] button[aria-expanded]").click();
    await fixada.waitFor();
  });

  await etapa("anotar rápido pelo atalho A", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click(); // tira o foco de qualquer campo
    await pg.keyboard.press("a");
    const campo = pg.locator("[data-slot=anotar-tarefa]");
    await campo.waitFor();
    await campo.fill("Conferir o relatório de cobertura");
    // o que foi digitado sobrevive a fechar o balão
    await pg.keyboard.press("Escape");
    await campo.waitFor({ state: "detached" });
    await pg.locator("[data-slot=ferramenta-anotar]").click();
    afirmar((await campo.inputValue()) === "Conferir o relatório de cobertura", "o texto do anotar rápido se perdeu ao fechar");
    await campo.press("Enter");
    await pg.waitForFunction(async (b) => {
      const d = await (await fetch(b + "/api/dados")).json();
      return d.tarefas.some((t) => t.titulo === "Conferir o relatório de cobertura" && t.status === "a_fazer");
    }, B);
    // agora uma nota, que vira folha do bloco de notas
    await pg.getByRole("radio", { name: "Nota" }).click();
    await pg.locator("[data-slot=anotar-nota]").fill("lembrar de pedir o acesso ao painel\nfalar com o time de plataforma");
    await pg.keyboard.press("Control+Enter");
    await pg.waitForFunction(async (b) => {
      const d = await (await fetch(b + "/api/dados")).json();
      return d.notas.items.some((n) => !n.arquivadaEm && n.texto.startsWith("lembrar de pedir o acesso"));
    }, B);
    await pg.keyboard.press("Escape");
  });

  await etapa("foco de hoje na barra superior", async () => {
    await pg.locator("[data-slot=ferramenta-foco]").click();
    await pg.getByText("Foco de hoje", { exact: true }).last().waitFor();
    await pg.getByRole("button", { name: "Planejar o dia" }).last().waitFor();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=ferramenta-agenda]").click();
    await pg.getByRole("group", { name: "Escolher um dia" }).waitFor();
    await pg.keyboard.press("Escape");
  });

  // ---------- modelos de tarefa, sessão de foco e diário ----------
  let idDoModelo = "";
  await etapa("modelo de tarefa: salvar de uma tarefa e criar outra por ele", async () => {
    await pg.goto(B + "/tarefas/" + idTarefa);
    await pg.locator("[data-slot=pagina]").first().waitFor();
    await pg.getByRole("button", { name: "Mais ações" }).first().click();
    await pg.getByRole("menuitem", { name: "Salvar como modelo..." }).click();
    const form = pg.locator("[data-slot=form-modelo]");
    await form.waitFor();
    // os passos da tarefa de origem já vêm listados
    const passos = (await pg.getByLabel("Passos de sempre").inputValue()).split("\n").filter(Boolean);
    afirmar(passos.length >= 3 && passos.some((p) => p.startsWith("Enviar documentação")), "o modelo não trouxe os passos da tarefa: " + passos.join(" | "));
    await pg.getByLabel("Nome do modelo").fill("Levar a Ferramenta X para um squad");
    await pg.getByLabel("Título sugerido").fill("Onboarding do squad ... na Ferramenta X");
    await pg.getByLabel("Prazo sugerido em dias").fill("30");
    await pg.locator("[data-slot=salvar-modelo]").click();
    await form.waitFor({ state: "detached" });
    afirmar((await dados()).modelos.items.length === 1, "o modelo não foi gravado");

    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("n");
    await pg.locator("[data-slot=form-tarefa]").waitFor();
    await pg.locator("[data-slot=escolher-modelo]", { hasText: "Levar a Ferramenta X" }).click();
    const titulo = pg.getByLabel("Título da tarefa");
    await pg.waitForFunction(() => document.querySelector("[data-slot=form-tarefa] input")?.value.includes("..."));
    await titulo.fill("Onboarding do squad de Crédito na Ferramenta X");
    const caixas = pg.locator("[data-slot=passos-do-modelo] [data-slot=checkbox]");
    afirmar((await caixas.count()) === passos.length, "os passos do modelo não apareceram no formulário");
    await caixas.last().click(); // este não vale para a tarefa nova
    await pg.getByRole("button", { name: "Salvar", exact: true }).click();
    await pg.waitForURL((u) => /\/tarefas\/t/.test(u.pathname) && !u.pathname.endsWith(idTarefa));
    idDoModelo = new URL(pg.url()).pathname.split("/").pop();
    await pg.locator("[data-slot=registro]", { hasText: "Passos do modelo" }).first().waitFor();
    const d = await dados();
    const nova = d.tarefas.find((t) => t.id === idDoModelo);
    afirmar(nova.titulo === "Onboarding do squad de Crédito na Ferramenta X" && !!nova.prazo, "a tarefa do modelo não veio com título e prazo");
    const abertos = nova.registros.flatMap((r) => r.proximosPassos);
    afirmar(abertos.length === passos.length - 1 && abertos.every((p) => !p.feito), "os passos do modelo não entraram em aberto: " + abertos.length);
    afirmar(d.modelos.items[0].usos === 1, "o uso do modelo não foi contado");
  });

  await etapa("sessão de foco: começar, encerrar e registrar", async () => {
    await pg.getByRole("button", { name: "Mais ações" }).first().click();
    await pg.getByRole("menuitem", { name: "Sessão de foco" }).hover();
    await pg.getByRole("menuitem", { name: "15 minutos" }).click();
    const ficha = pg.locator("[data-slot=sessao-foco]");
    await ficha.waitFor();
    await pg.waitForFunction(() => /foco · Nexo$/.test(document.title));
    // sobrevive a recarregar a página
    await pg.reload();
    await ficha.waitFor();
    await ficha.click();
    await pg.locator("[data-slot=encerrar-sessao]").click();
    const nota = pg.locator("[data-slot=nota-sessao]");
    await nota.fill("Montei o cronograma e pedi os acessos.");
    // fechar a janela não joga fora o que foi escrito
    await pg.keyboard.press("Escape");
    await nota.waitFor({ state: "detached" });
    await ficha.click();
    await pg.locator("[data-slot=encerrar-sessao]").click();
    afirmar((await nota.inputValue()) === "Montei o cronograma e pedi os acessos.", "o texto da sessão se perdeu ao fechar a janela");
    await pg.locator("[data-slot=registrar-sessao]").click();
    await ficha.waitFor({ state: "detached" });
    await pg.locator("[data-slot=registro]", { hasText: "Sessão de foco" }).first().waitFor();
    const r = (await dados()).tarefas.find((t) => t.id === idDoModelo).registros.at(-1);
    afirmar(r.tipo === "atividade" && r.duracaoMin >= 1 && r.anotacoes === "Montei o cronograma e pedi os acessos.", "a sessão não virou atividade com duração");
    await pg.locator("[data-slot=tempo-em-foco]").waitFor();
  });

  await etapa("diário mostra o que aconteceu hoje", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("d");
    await pg.waitForURL("**/diario");
    const hojeIso = await pg.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    const dia = pg.locator(`[data-slot=dia-diario][data-data="${hojeIso}"]`);
    await dia.locator("[data-slot=evento-diario]", { hasText: "Sessão de foco" }).waitFor();
    await dia.locator("[data-slot=evento-diario]", { hasText: "Cobrei Marina" }).waitFor();
    afirmar((await pg.locator(`[data-slot=dia-mapa][data-data="${hojeIso}"]`).getAttribute("data-nivel")) !== "0", "o mapa de atividade não marcou o dia de hoje");
    // só os passos concluídos
    await pg.getByRole("radio", { name: "Passos feitos" }).click();
    await dia.locator("[data-slot=evento-diario][data-tipo=passo]").first().waitFor();
    afirmar((await dia.locator("[data-slot=evento-diario]:not([data-tipo=passo])").count()) === 0, "o filtro de passos deixou passar outro tipo de evento");
    // copiar o que está na tela
    await pg.getByRole("radio", { name: "Tudo" }).click();
    await pg.locator("[data-slot=copiar-diario]").click();
    const texto = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(texto.includes("Sessão de foco") && texto.includes("Cobrei Marina"), "o texto copiado do diário veio incompleto");
    // clicar num dia do mapa mostra só ele
    await pg.locator(`[data-slot=dia-mapa][data-data="${hojeIso}"]`).click();
    await pg.locator("[data-slot=dia-escolhido]").waitFor();
    afirmar((await pg.locator("[data-slot=dia-diario]").count()) === 1, "escolher um dia no mapa não filtrou o diário");
  });

  await etapa("personalizar: cor, item da lateral e ferramenta", async () => {
    await pg.locator("[data-slot=abrir-personalizar]").click();
    const painel = pg.locator("[data-slot=personalizar]");
    await painel.waitFor();
    // esconder um item de navegação e trazê-lo de volta
    const nav = (nome) => pg.locator("[data-slot=lateral] [data-slot=nav-item]", { hasText: nome });
    await nav("Relatórios").waitFor();
    await painel.getByRole("switch", { name: "Mostrar Relatórios" }).click();
    await nav("Relatórios").waitFor({ state: "detached" });
    afirmar(JSON.parse(await pg.evaluate(() => localStorage.getItem("nexo:moldura"))).ocultos.includes("/relatorios"), "o item escondido não foi guardado");
    await painel.getByRole("switch", { name: "Mostrar Relatórios" }).click();
    await nav("Relatórios").waitFor();
    // mudar a ordem pelo teclado: Notas sobe uma posição
    await painel.getByRole("button", { name: /^Mover Notas/ }).press("ArrowUp");
    await pg.waitForFunction(() => {
      const nomes = [...document.querySelectorAll("[data-slot=lateral] [data-slot=nav-item]")].map((e) => e.textContent);
      return nomes.findIndex((n) => n.startsWith("Notas")) < nomes.findIndex((n) => n.startsWith("Pendências"));
    });
    // ferramenta da barra superior
    await painel.getByRole("radio", { name: "Superior" }).click();
    await painel.getByRole("switch", { name: "Mostrar Data e agenda" }).click();
    await pg.locator("[data-slot=ferramenta-agenda]").waitFor({ state: "detached" });
    // cor de destaque
    await painel.getByRole("radio", { name: "Aparência" }).click();
    await painel.getByRole("radio", { name: "Verde" }).click();
    await pg.waitForFunction(() => document.documentElement.style.getPropertyValue("--matiz") === "155");
    await painel.getByRole("radio", { name: "Redondos" }).click();
    await pg.waitForFunction(() => document.documentElement.style.getPropertyValue("--radius") === "0.95rem");
    // a escolha vale depois de recarregar, antes mesmo de o app montar
    await pg.reload();
    await pg.waitForFunction(() => document.documentElement.style.getPropertyValue("--matiz") === "155");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    afirmar((await pg.locator("[data-slot=ferramenta-agenda]").count()) === 0, "a ferramenta escondida voltou depois de recarregar");
    // voltar tudo ao padrão
    await pg.locator("[data-slot=abrir-personalizar]").click();
    await painel.getByRole("button", { name: "Voltar tudo ao padrão" }).click();
    await pg.getByRole("button", { name: "Voltar ao padrão", exact: true }).click();
    await pg.waitForFunction(() => document.documentElement.style.getPropertyValue("--matiz") === "275");
    await pg.locator("[data-slot=ferramenta-agenda]").waitFor();
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });
  });

  // ---------- tema ----------
  await etapa("tema escuro", async () => {
    await pg.locator("[data-slot=botao-tema]").click();
    await pg.getByRole("radio", { name: "Escuro" }).click();
    await pg.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await pg.keyboard.press("Escape");
  });

  await navegador.close();
}

main()
  .then(() => {
    if (erros.length) {
      console.error("FALHOU: erros no console do navegador:\n" + erros.join("\n"));
      process.exit(1);
    }
    console.log("TUDO OK");
  })
  .catch((e) => {
    console.error(`FALHOU em "${passoAtual}": ${e.message}`);
    if (erros.length) console.error("Erros do console:\n" + erros.join("\n"));
    process.exit(1);
  });
