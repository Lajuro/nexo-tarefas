// Teste ponta a ponta da interface (Playwright para Node + Chromium/Chrome).
//
// Pré-requisito: o pacote "playwright" acessível pelo Node (global ou NODE_PATH)
// e um navegador: o Chromium do Playwright (npx playwright install chromium) ou
// o Google Chrome instalado (usado sozinho se o Chromium não existir) ou, sem os dois, o Microsoft Edge.
//
// Rode SEMPRE com uma pasta de dados VAZIA e descartável (nunca os dados reais):
//   npm run build
//   HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-dados npx next start -p 3311 -H 127.0.0.1
//   NEXO_URL=http://127.0.0.1:3311 node testes/e2e.cjs
//
// Imprime "ok <passo>" a cada etapa e termina com código 1 se algo falhar,
// inclusive erro ou aviso do React no console do navegador.
// NEXO_E2E_FOTOS=<pasta> salva screenshots de cada etapa (opcional).
// NEXO_E2E_SO=<trecho do nome> roda só as etapas cujo nome contém o trecho (para depurar uma etapa que não depende
// das anteriores, como as que montam o próprio cenário pela API). Sem a variável, roda tudo, que é o que vale.
//
// Cobre: categorias, nova tarefa pelo atalho N ("Mais opções" recolhido, lembrado e aberto ao editar,
// faixa da prioridade), registro de reunião com o fluxo do Copilot (Copilot na primeira tela, campos
// recolhidos que abrem com a resposta e ao editar), rascunho do registro (Esc, F5, continuar, descartar,
// campo recolhido que volta aberto), atividade que
// conclui passo antigo, passo marcado na página da tarefa, troca de status com
// marco, conclusão, lista/quadro/filtro em /tarefas, pendências, busca, pessoas,
// pessoas e times (cadastro, time, importar do Outlook, busca), links, relatórios, revisão, configurações, tela Hoje (captura rápida e foco),
// ritual "Planejar o dia", bloco de notas (escrever, prompt, JSON, prévia, aplicar), paleta Ctrl+K,
// moldura (fixar tarefa na barra lateral, anotar rápido pelo atalho A, foco na barra superior,
// painel Personalizar: cor de destaque, esconder item e ferramenta, separar as telas de acompanhar),
// "Acompanhar" (item único no menu, abas em comum, última aba lembrada), menu "Mais", esperando quem (cobrança),
// modelos de tarefa, sessão de foco, diário, editor de texto rico (blocos, imagem colada que amplia num visor por cima do app, conteúdo
// perigoso barrado), páginas de conhecimento (citar com @, quem aponta para cá), links e documentos como
// material de trabalho (um link em várias tarefas, status de chamado, trava, página e folha ligadas à tarefa,
// folha que vira página, Ctrl + clique num link do editor), arquivos vistos por dentro do app (planilha, CSV,
// Word, PowerPoint, PDF, Markdown, HTML como texto, ZIP), conquistas (nível, meta do dia, desligar),
// as novidades da 3.17 (checklist da tarefa, e-mail colado no registro, participante cadastrado pelo campo,
// filtro por tag em tarefas e páginas, importar um arquivo exportado), as da 3.19 (passos repetidos: juntar,
// desfazer, separar, a prevenção no registro e no modo reunião, e a cobrança por pessoa), as da 3.20 (perfis de uso), as da 3.21
// (próxima ação, reunião como campo do bloco da rotina, reuniões de hoje com pauta e modo reunião), as da 3.18 (modelo de tarefa com
// checklist, tarefa nova a partir de um e-mail) e tema escuro (pelo menu "Mais").

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
    try {
      return await chromium.launch({ args, channel: "chrome" });
    } catch {
      // máquina com Windows e sem Chrome: o Edge serve (é o navegador em que o app roda no dia a dia)
      return await chromium.launch({ args, channel: "msedge" });
    }
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
  const SO = process.env.NEXO_E2E_SO || "";
  const etapa = async (nome, fn) => {
    if (SO && !nome.includes(SO)) return;
    passoAtual = nome;
    await fn();
    await foto(nome.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
    ok(nome);
  };
  const dialogo = () => pg.locator('[role=dialog][data-state=open], [role=alertdialog][data-state=open]').last();
  const dados = async () => lista(await (await pg.request.get(B + "/api/dados")).json());
  // Espera até os dados gravados ficarem do jeito pedido. (pg.waitForFunction com função async NÃO serve
  // para isso: a Promise devolvida já conta como "verdadeiro" e a espera volta na hora.)
  const ateOsDados = async (cond, msg, limite = 10000) => {
    const fim = Date.now() + limite;
    for (;;) {
      if (cond(await dados())) return;
      if (Date.now() > fim) throw new Error("os dados não ficaram como esperado: " + msg);
      await new Promise((r) => setTimeout(r, 150));
    }
  };
  const escolherData = async (escopo, rotulo, texto) => {
    await escopo.locator(`[data-slot=seletor-data][aria-label="${rotulo}"]`).click();
    const campo = pg.getByLabel("Digitar data");
    await campo.fill(texto);
    await campo.press("Enter");
  };
  // Desde a 3.20 o painel Personalizar tem duas voltas: "Redefinir este perfil" (menu, barras, tela Hoje) e
  // "Voltar a aparência ao padrão" (cores, cantos, letra). Esta ajudante faz as duas e termina na aba Aparência.
  const voltarAoPadrao = async (painel) => {
    await painel.getByRole("radio", { name: "Perfis" }).click();
    const redefinir = painel.locator("[data-slot=redefinir-perfil]");
    if (await redefinir.isEnabled()) await redefinir.click();
    await pg.waitForFunction(() => document.querySelector("[data-slot=redefinir-perfil]")?.disabled === true);
    await painel.getByRole("radio", { name: "Aparência" }).click();
    await painel.locator("[data-slot=restaurar-aparencia]").click();
    await pg.getByRole("button", { name: "Voltar ao padrão", exact: true }).click();
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
    // essencial à vista; status, lembrete, tags e descrição ficam em "Mais opções", recolhido na primeira vez
    const mais = d.locator("[data-slot=mais-opcoes]");
    afirmar((await mais.getAttribute("data-aberto")) === null, "Mais opções devia começar recolhido");
    afirmar((await d.locator('[data-slot=select-trigger][aria-label="Status"]').count()) === 0, "o status apareceu fora de Mais opções");
    await d.locator("[data-slot=mais-opcoes-botao]").click();
    await mais.locator('[data-slot=select-trigger][aria-label="Status"]').waitFor();
    afirmar(await pg.evaluate(() => localStorage.getItem("nexo:tarefaMaisOpcoes")) === "true", "a escolha de abrir Mais opções não ficou lembrada");
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
    // editar: com status, tags ou descrição preenchidos, "Mais opções" já abre mostrando o que tem
    await pg.getByRole("button", { name: "Editar", exact: true }).first().click();
    const e = dialogo();
    await e.locator("[data-slot=form-tarefa]").waitFor();
    await e.locator("[data-slot=mais-opcoes][data-aberto]").waitFor();
    afirmar((await e.getByPlaceholder("O que precisa ser entregue, quem pediu, contexto...").inputValue()).startsWith("Colocar o scan"), "a descrição não apareceu ao editar");
    // a prioridade mostra a faixa: 8 é "alta"
    afirmar((await e.locator("[data-slot=seletor-prioridade]").getAttribute("data-nivel")) === "alta", "a faixa da prioridade 8 devia ser alta");
    await e.locator('[data-faixa-nome=alta][data-atual]').waitFor();
    await fecharDialogo();
  });

  // ---------- registro de reunião com o Copilot ----------
  await etapa("registro de reunião com Copilot", async () => {
    await pg.locator('[data-slot=registrar][data-tipo=reuniao]').click();
    const d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    // registro novo: os campos organizados ficam recolhidos e o Copilot inteiro cabe sem rolar
    afirmar((await d.locator("[data-slot=editor-campos]").getAttribute("data-aberto")) === null, "os campos organizados deviam começar recolhidos");
    afirmar((await d.getByPlaceholder("Preenchido pela IA ou por você").count()) === 0, "o resumo vazio apareceu num registro novo");
    afirmar(await pg.evaluate(() => document.activeElement?.getAttribute("placeholder") === "Ex.: Alinhamento com o time de arquitetura"), "o foco inicial devia ir para o título");
    for (const alvo of [d.getByRole("button", { name: "Copiar prompt para o Copilot" }), d.getByRole("button", { name: "Preencher campos com a resposta" })]) {
      const dentro = await alvo.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const c = el.closest("[data-slot=editor-organizado]").getBoundingClientRect();
        return r.top >= c.top && r.bottom <= c.bottom && r.bottom <= innerHeight;
      });
      afirmar(dentro, "a ação do Copilot não está inteira na primeira tela do editor");
    }
    await d.getByPlaceholder("Ex.: Alinhamento com o time de arquitetura").fill("Kickoff com o squad");
    const chips = d.locator("[data-slot=campo-chips] input").first();
    await chips.fill("Marina");
    await chips.press("Enter");
    await d.locator("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]").fill(ANOTACOES);
    await d.getByRole("button", { name: "Copiar prompt para o Copilot" }).click();
    await d.locator("[data-slot=retorno-copia]").waitFor();
    const prompt = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(prompt.includes(TITULO), "prompt sem o título da tarefa");
    afirmar(prompt.includes("felipe da arquitetura"), "prompt sem as anotações");
    await d.getByPlaceholder("Cole a resposta aqui...").fill(RESP);
    await d.getByRole("button", { name: "Preencher campos com a resposta" }).click();
    await d.locator("[data-slot=retorno-preenchimento]").waitFor();
    // a resposta aplicada abre os campos sozinha
    await d.locator("[data-slot=editor-campos][data-aberto]").waitFor();
    await d.getByPlaceholder("Preenchido pela IA ou por você").waitFor();
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
    // editar um registro cheio: tudo o que tem conteúdo aparece aberto
    await card.locator("[data-slot=registro-menu]").click();
    await pg.getByRole("menuitem", { name: "Editar registro" }).click();
    const ed = dialogo();
    await ed.locator("[data-slot=editor-campos][data-aberto]").waitFor();
    afirmar((await ed.getByPlaceholder("Uma decisão por linha").inputValue()).includes("checkout"), "as decisões não apareceram ao editar");
    afirmar((await ed.locator('[data-slot=editor-passo] input[aria-label="Ação"]').count()) === 3, "os passos não apareceram ao editar");
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });
  });

  // ---------- atividade que conclui passo antigo ----------
  await etapa("rascunho do registro sobrevive a Esc e F5", async () => {
    await pg.locator('[data-slot=registrar][data-tipo=reuniao]').click();
    let d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.locator("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]").fill("anotação que não pode sumir");
    // um campo que começa recolhido: abre à mão, escreve, e o rascunho tem que trazer de volta no lugar certo
    await d.locator("[data-slot=editor-campos-botao]").click();
    // Ao abrir a seção, o app leva o foco para o Resumo um instante depois. O fill() escreve no campo que tem o foco
    // naquela hora: sem esperar, o texto às vezes caía no Resumo e a etapa falhava de vez em quando.
    await pg.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Resumo");
    await d.getByPlaceholder("Uma decisão por linha").fill("decisão que também não pode sumir");
    await d.locator("[data-slot=rascunho-estado]").waitFor();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=rascunho-aviso]").waitFor();
    await pg.reload();
    await pg.locator("[data-slot=rascunho-aviso]").getByRole("button", { name: "Continuar" }).click();
    d = dialogo();
    await d.locator("[data-slot=rascunho-recuperado]").waitFor();
    const anotacoes = d.locator("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]");
    await anotacoes.getByText("anotação que não pode sumir").waitFor();
    afirmar((await anotacoes.innerText()).trim() === "anotação que não pode sumir", "o rascunho não voltou depois do F5");
    await d.locator("[data-slot=editor-campos][data-aberto]").waitFor();
    afirmar((await d.getByPlaceholder("Uma decisão por linha").inputValue()) === "decisão que também não pode sumir", "o campo recolhido não voltou do rascunho");
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
    await ateOsDados((d) => d.tarefas.find((x) => x.id === idTarefa).registros.flatMap((r) => r.proximosPassos).some((p) => p.texto.startsWith("Agendar follow-up") && p.feito), "o passo não foi gravado como feito");
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
    // 3.12: título de página em 22px e cada motivo de "Precisa de você" é um selo
    afirmar((await pg.locator("[data-slot=pagina] h1").evaluate((h) => getComputedStyle(h).fontSize)) === "22px", "o título da tela não está em 22px");
    const semSelo = await pg.locator("[data-slot=lembrete] [data-slot=motivo]").evaluateAll((els) => els.filter((e) => !e.querySelector("[data-slot=badge]")).length);
    afirmar(semSelo === 0, "há motivo de lembrete sem selo na tela Hoje");
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
    const texto = pg.locator("[data-slot=texto-da-folha] [data-slot=editor-rico-conteudo]");
    await texto.waitFor();
    await texto.click();
    await pg.keyboard.type("squad confirmou a data do treinamento. preciso mandar o convite.");
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("auditoria pediu um relatório novo.");
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

  // ---------- editor de texto rico ----------
  await etapa("editor rico: blocos pelo menu /, imagem colada e leitura na linha do tempo", async () => {
    const externas = [];
    const olheiro = (r) => { if (!r.url().startsWith(B) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) externas.push(r.url()); };
    pg.on("request", olheiro);
    await pg.goto(B + "/tarefas/" + idTarefa);
    await pg.locator('[data-slot=registrar][data-tipo=atividade]').click();
    const d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.getByPlaceholder("Resumo em uma linha").fill("Evidência da varredura");
    const ed = d.locator("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]");
    await ed.click();
    await pg.keyboard.type("## Resultado");            // atalho de Markdown vira título
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("Rodei a varredura e 3 < 5 achados eram críticos.");
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("/taref");                   // menu de blocos
    const menu = d.locator("[data-slot=menu-editor]");
    await menu.locator("[data-item=tarefas]").waitFor();
    // Esc com o menu aberto fecha só o menu, não a janela do registro
    await pg.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    await d.locator("[data-slot=editor-registro]").waitFor();
    for (let i = 0; i < 6; i++) await pg.keyboard.press("Backspace");
    await pg.keyboard.type("/taref");
    await menu.locator("[data-item=tarefas]").waitFor();
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("abrir chamado da correção");
    await ed.locator("ul[data-type=taskList] > li input").first().waitFor();
    await pg.keyboard.press("Enter");
    await pg.keyboard.press("Enter");
    // colar um print (PNG de 2x2)
    await pg.evaluate(() => {
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP8z8DAwMDAxAAAAAYAAfc5cLUAAAAASUVORK5CYII=";
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], "image.png", { type: "image/png" }));
      document.querySelector("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await ed.locator("img[data-anexo]").waitFor();
    await pg.waitForFunction(() => { const i = document.querySelector("[data-slot=anotacoes] img[data-anexo]"); return i && i.complete && i.naturalWidth > 0; });
    // colar HTML de uma página: imagem de fora, link perigoso e script não entram
    await pg.keyboard.press("Control+End");
    await pg.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData("text/html", '<p>trecho colado</p><img src="https://exemplo.invalid/pixel.png" onerror="window.__xss=1"><a href="javascript:window.__xss=2">link ruim</a><script>window.__xss=3</script>');
      dt.setData("text/plain", "trecho colado link ruim");
      document.querySelector("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await ed.getByText("trecho colado").waitFor();
    const perigo = await ed.evaluate((e) => ({
      // (o ProseMirror usa um <img class="ProseMirror-separator"> sem endereço como marcador de cursor: esse não conta)
      imgs: [...e.querySelectorAll("img:not(.ProseMirror-separator)")].filter((i) => !(i.getAttribute("src") || "").startsWith("/api/arquivos?p=")).length,
      links: [...e.querySelectorAll("a")].filter((a) => /^javascript:/i.test(a.getAttribute("href") || "")).length,
      scripts: e.querySelectorAll("script").length,
      xss: window.__xss ?? null,
    }));
    afirmar(perigo.imgs === 0 && perigo.links === 0 && perigo.scripts === 0 && perigo.xss === null, "conteúdo perigoso entrou no editor: " + JSON.stringify(perigo));
    await d.getByRole("button", { name: "Salvar registro" }).click();
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });

    // o que foi gravado é Markdown, com a imagem apontando para a pasta de anexos
    const reg = (await dados()).tarefas.find((t) => t.id === idTarefa).registros.find((r) => r.titulo === "Evidência da varredura");
    afirmar(/^## Resultado/.test(reg.anotacoes), "o título não foi gravado como Markdown: " + reg.anotacoes.slice(0, 60));
    afirmar(reg.anotacoes.includes("- [ ] abrir chamado da correção"), "a lista de tarefas não foi gravada como Markdown");
    afirmar(/!\[[^\]]*\]\(arquivos\/\d{4}\/[^)]+\.png\)/.test(reg.anotacoes), "a imagem colada não foi gravada como anexo");
    afirmar(!/exemplo\.invalid\/pixel|javascript:/.test(reg.anotacoes), "sobrou endereço perigoso no texto gravado");
    // e aparece formatado na linha do tempo
    const card = pg.locator("[data-slot=registro]", { hasText: "Evidência da varredura" }).first();
    await card.locator("[data-slot=texto] h2", { hasText: "Resultado" }).waitFor();
    await card.getByText("3 < 5 achados").waitFor();
    await card.locator("[data-slot=texto] ul[data-type=taskList]").waitFor();
    await pg.waitForFunction(() => {
      const i = [...document.querySelectorAll("[data-slot=registro] [data-slot=imagem-anexada] img")][0];
      return i && i.complete && i.naturalWidth > 0;
    });
    // clicar na imagem amplia por cima do app: a tela de baixo não muda, e fechar devolve o usuário ao mesmo lugar
    const endereco = pg.url();
    const miniatura = card.locator("[data-slot=imagem-anexada]").first();
    await miniatura.scrollIntoViewIfNeeded();
    const rolagem = () => pg.evaluate(() => [...document.querySelectorAll("*")].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join());
    const rolagemAntes = await rolagem();
    await miniatura.click();
    const visor = pg.locator("[data-slot=visor-de-imagem]");
    await visor.waitFor();
    await pg.waitForFunction(() => { const i = document.querySelector("[data-slot=visor-imagem]"); return i && i.complete && i.naturalWidth > 0; });
    afirmar(pg.url() === endereco, "abrir a imagem não pode trocar de tela");
    afirmar((await ctx.pages()).length === 1, "abrir a imagem não pode abrir outra aba");
    afirmar(await card.isVisible(), "a tarefa tem que continuar atrás do visor");
    afirmar((await visor.locator("[data-slot=visor-baixar]").getAttribute("href")).endsWith("&baixar=1"), "o visor não oferece baixar a imagem");
    // um clique na imagem (ou a tecla +) sai do ajuste à janela; 0 volta
    await visor.locator("[data-slot=visor-escala][data-escala=ajustada]").waitFor();
    await visor.locator("[data-slot=visor-imagem]").click();
    await visor.locator('[data-slot=visor-escala][data-escala="1"]').waitFor();
    await pg.keyboard.press("+");
    await visor.locator('[data-slot=visor-escala][data-escala="1.5"]').waitFor();
    await pg.keyboard.press("0");
    await visor.locator("[data-slot=visor-escala][data-escala=ajustada]").waitFor();
    await pg.keyboard.press("Escape");
    await visor.waitFor({ state: "detached" });
    afirmar(pg.url() === endereco, "fechar o visor tem que deixar na mesma tela");
    afirmar((await rolagem()) === rolagemAntes, "fechar o visor mudou a rolagem da tela");
    afirmar(await miniatura.evaluate((el) => el === document.activeElement), "o foco tem que voltar para a imagem que foi aberta");
    // clicar fora da imagem também fecha
    await miniatura.click();
    await visor.waitFor();
    await visor.locator("[data-slot=visor-area]").click({ position: { x: 8, y: 8 } });
    await visor.waitFor({ state: "detached" });
    // no editor, dois cliques na imagem ampliam (um só seleciona)
    await card.locator("[data-slot=registro-menu]").click();
    await pg.getByRole("menuitem", { name: "Editar registro" }).click();
    const noEditor = dialogo().locator("[data-slot=anotacoes] img[data-anexo]").first();
    await noEditor.scrollIntoViewIfNeeded();
    await noEditor.dblclick();
    await visor.waitFor();
    await pg.keyboard.press("Escape");
    await visor.waitFor({ state: "detached" });
    afirmar(await dialogo().locator("[data-slot=anotacoes]").isVisible(), "fechar o visor não pode fechar o editor que estava aberto por baixo");
    await fecharDialogo();
    // o espelho em Markdown aponta para a pasta de anexos ao lado
    pg.off("request", olheiro);
    afirmar(externas.length === 0, "o editor fez chamada externa: " + externas.join(", "));
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
    await ateOsDados((d) => d.tarefas.some((t) => t.titulo === "Conferir o relatório de cobertura" && t.status === "a_fazer"), "o anotar rápido não criou a tarefa");
    // agora uma nota, que vira folha do bloco de notas
    await pg.getByRole("radio", { name: "Nota" }).click();
    await pg.locator("[data-slot=anotar-nota]").fill("lembrar de pedir o acesso ao painel\nfalar com o time de plataforma");
    await pg.keyboard.press("Control+Enter");
    await ateOsDados((d) => d.notas.items.some((n) => !n.arquivadaEm && n.texto.startsWith("lembrar de pedir o acesso")), "o anotar rápido não criou a folha");
    await pg.keyboard.press("Escape");
  });

  await etapa("foco de hoje na barra superior", async () => {
    await pg.locator("[data-slot=ferramenta-foco]").click();
    await pg.getByText("Foco de hoje", { exact: true }).last().waitFor();
    await pg.getByRole("button", { name: "Planejar o dia" }).last().waitFor();
    await pg.keyboard.press("Escape");
    // a ficha da agenda mostra só o dia; a hora fica dentro do balão
    afirmar(!/\d{2}:\d{2}/.test(await pg.locator("[data-slot=ferramenta-agenda]").innerText()), "a ficha da agenda voltou a mostrar a hora");
    await pg.locator("[data-slot=ferramenta-agenda]").click();
    await pg.getByRole("group", { name: "Escolher um dia" }).waitFor();
    afirmar(/^\d{2}:\d{2}$/.test((await pg.locator("[data-slot=agenda-hora]").innerText()).trim()), "a hora não apareceu dentro do balão da agenda");
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
    // a última escolha (aberto) foi lembrada: "Mais opções" já abre
    await pg.locator("[data-slot=form-tarefa] [data-slot=mais-opcoes][data-aberto]").waitFor();
    await pg.locator("[data-slot=escolher-modelo]", { hasText: "Levar a Ferramenta X" }).click();
    // o "..." do título sugerido já vem selecionado: é só digitar o que muda
    await pg.waitForFunction(() => {
      const c = document.querySelector("[data-slot=form-tarefa] input[aria-label='Título da tarefa']");
      return c && document.activeElement === c && c.value.slice(c.selectionStart, c.selectionEnd) === "...";
    });
    await pg.keyboard.type("de Crédito");
    afirmar((await pg.getByLabel("Título da tarefa").inputValue()) === "Onboarding do squad de Crédito na Ferramenta X", "digitar por cima do ... não deu o título esperado");
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

  // ---------- modo reunião ----------
  await etapa("modo reunião: pauta, captura, rascunho que sobrevive ao F5, salvar e ata", async () => {
    const antes = (await dados()).tarefas.find((t) => t.id === idDoModelo);
    const abertos = antes.registros.flatMap((r) => r.proximosPassos.filter((p) => !p.feito).map((p) => `${r.id}:${p.id}`));
    afirmar(abertos.length > 0, "a tarefa do modelo deveria ter passos em aberto para a pauta");
    await pg.locator("[data-slot=modo-reuniao]").click();
    await pg.locator("[data-slot=reuniao]").waitFor();
    afirmar((await pg.locator("[data-slot=pauta] [data-slot=passo]").count()) === abertos.length, "a pauta não trouxe os passos em aberto da tarefa");
    afirmar(await pg.locator("[data-slot=encerrar-reuniao]").isDisabled(), "reunião em branco não deveria poder ser salva");
    await pg.getByLabel("Título da reunião").fill("Alinhamento do onboarding");
    await pg.locator("[data-slot=comecar-reuniao]").click();
    await pg.locator("[data-slot=relogio-reuniao]").waitFor();
    await pg.locator("[data-slot=notas-da-reuniao] [data-slot=editor-rico-conteudo]").click();
    await pg.keyboard.type("Passamos pelo cronograma.");
    await pg.keyboard.press("Alt+1");
    await pg.keyboard.type("Começar pelo squad de Pagamentos");
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=decisao-capturada]").waitFor();
    await pg.keyboard.press("Alt+2");
    await pg.keyboard.type("Enviar o convite da próxima conversa");
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=passo-capturado]").waitFor();
    await pg.getByLabel("Responsável pelo passo").fill("Marina");
    await pg.locator("[data-slot=pauta] [data-slot=passo] button[role=checkbox]").first().click();
    // nada vai para a tarefa antes de encerrar
    afirmar((await dados()).tarefas.find((t) => t.id === idDoModelo).registros.length === antes.registros.length, "a reunião gravou na tarefa antes de ser encerrada");
    // F5 no meio da reunião: tudo volta
    await pg.reload();
    await pg.locator("[data-slot=passo-capturado]").waitFor();
    afirmar((await pg.getByLabel("Título da reunião").inputValue()) === "Alinhamento do onboarding", "o título da reunião se perdeu no F5");
    afirmar((await pg.locator("[data-slot=decisao-capturada]").count()) === 1, "a decisão capturada se perdeu no F5");
    afirmar((await pg.locator("[data-slot=notas-da-reuniao]").innerText()).includes("Passamos pelo cronograma."), "as anotações da reunião se perderam no F5");
    afirmar((await pg.locator("[data-slot=pauta] [data-slot=passo][data-feito]").count()) === 1, "o passo marcado como resolvido se perdeu no F5");
    await pg.locator("[data-slot=relogio-reuniao]").waitFor();
    // sair da tela também não perde: a tarefa avisa e leva de volta
    await pg.goto(`${B}/tarefas/${idDoModelo}`);
    await pg.locator("[data-slot=reuniao-aviso]").getByRole("link", { name: "Continuar" }).click();
    await pg.locator("[data-slot=reuniao]").waitFor();
    // o que ficou digitado sem Enter também entra
    await pg.locator("[data-slot=novo-passo]").fill("Revisar os acessos");
    await pg.locator("[data-slot=encerrar-reuniao]").click();
    const ata = await pg.locator("[data-slot=ata]").innerText();
    for (const trecho of ["Ata: Alinhamento do onboarding", "Decisões:", "- Começar pelo squad de Pagamentos", "- Enviar o convite da próxima conversa (responsável: Marina)", "- Revisar os acessos", "Pendências resolvidas:", "Passamos pelo cronograma."])
      afirmar(ata.includes(trecho), `a ata não tem "${trecho}":\n${ata}`);
    const depois = (await dados()).tarefas.find((t) => t.id === idDoModelo);
    const reg = depois.registros.at(-1);
    afirmar(reg.tipo === "reuniao" && reg.titulo === "Alinhamento do onboarding" && /^\d\d:\d\d$/.test(reg.hora || ""), "a reunião não virou registro de reunião com hora");
    afirmar(reg.decisoes === "- Começar pelo squad de Pagamentos", "as decisões não foram para o registro");
    afirmar(reg.proximosPassos.length === 2 && reg.proximosPassos[0].responsavel === "Marina" && reg.proximosPassos.every((p) => !p.feito), "os próximos passos não foram para o registro");
    afirmar(reg.anotacoes.includes("Passamos pelo cronograma."), "as anotações não foram para o registro");
    const feitos = depois.registros.flatMap((r) => r.proximosPassos.filter((p) => p.feito).map((p) => `${r.id}:${p.id}`));
    afirmar(abertos.filter((k) => feitos.includes(k)).length === 1, "o passo resolvido na reunião não foi concluído (ou concluiu mais de um)");
    afirmar((await pg.evaluate((id) => localStorage.getItem("nexo:reuniao:" + id), idDoModelo)) === null, "o rascunho da reunião ficou no navegador depois de salvar");
    await pg.locator("[data-slot=copiar-ata]").click();
    afirmar((await pg.evaluate(() => navigator.clipboard.readText())).startsWith("Ata: Alinhamento do onboarding"), "a ata não foi para a área de transferência");
    await pg.getByRole("link", { name: "Ver na linha do tempo" }).click();
    await pg.locator("[data-slot=registro]", { hasText: "Alinhamento do onboarding" }).first().waitFor();
    afirmar((await pg.locator("[data-slot=reuniao-aviso]").count()) === 0, "o aviso de reunião não salva continuou depois de salvar");
  });

  await etapa("modo reunião: transcrição do Teams organizada pelo Copilot entra na captura", async () => {
    await pg.goto(`${B}/tarefas/${idDoModelo}/reuniao`);
    await pg.locator("[data-slot=reuniao]").waitFor();
    await pg.locator("[data-slot=abrir-transcricao]").click();
    await pg.locator("[data-slot=transcricao-colada]").fill("Marina  0:12\nBom dia, vamos falar do pipeline.\n\nBruno  0:40\nFicou decidido ligar o gate em dezembro.\n");
    afirmar((await pg.locator("[data-slot=resumo-transcricao]").innerText()).includes("Falaram: Marina, Bruno"), "a transcrição não foi lida (quem falou)");
    await pg.locator("[data-slot=copiar-parte]").click();
    const prompt = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(prompt.includes("## PASSOS CONCLUÍDOS") && prompt.includes("Marina: Bom dia"), "o prompt da transcrição não tem o formato ou a fala");
    await pg.locator("[data-slot=resposta-transcricao]").fill("## RESUMO\n- Pipeline discutido.\n## DECISÕES\n- Ligar o gate em dezembro\n## PRÓXIMOS PASSOS\n- Configurar o scan noturno (responsável: Bruno)\n## IMPEDIMENTOS\nNenhum\n## PARTICIPANTES\n- Marina\n- Bruno\n## PASSOS CONCLUÍDOS\nNenhum");
    await pg.locator("[data-slot=trazer-transcricao]").click();
    await pg.locator("[data-slot=decisao-capturada]", { hasText: "Ligar o gate em dezembro" }).waitFor();
    await pg.locator("[data-slot=passo-capturado]", { hasText: "Configurar o scan noturno" }).waitFor();
    const notas = await pg.locator("[data-slot=notas-da-reuniao]").innerText();
    afirmar(notas.includes("Resumo da transcrição") && notas.includes("Transcrição completa"), "o resumo e o link da transcrição não entraram nas anotações");
    afirmar((await dados()).tarefas.find((t) => t.id === idDoModelo).registros.every((r) => !r.decisoes.includes("Ligar o gate")), "a transcrição gravou na tarefa antes de encerrar a reunião");
    // descarta: nada disso era para ficar
    await pg.getByRole("button", { name: "Descartar reunião" }).click();
    await pg.getByRole("button", { name: "Descartar", exact: true }).click();
    await pg.locator("[data-slot=propriedades]").waitFor();
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

  // ---------- páginas de conhecimento e links internos ----------
  await etapa("páginas: escrever, citar uma tarefa com @ e ver quem aponta para ela", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("a");
    await pg.waitForURL("**/paginas");
    await pg.locator("[data-slot=nova-pagina]").click();
    await pg.getByLabel("Título da página").fill("Como pedir exceção de vulnerabilidade");
    const ed = pg.locator("[data-slot=texto-da-pagina] [data-slot=editor-rico-conteudo]");
    await ed.click();
    await pg.keyboard.type("O passo a passo nasceu no ");
    await pg.keyboard.type("@Onboarding do squad Pag");
    const menu = pg.locator("[data-slot=menu-editor]");
    await menu.locator("[role=option]", { hasText: "Onboarding do squad Pagamentos" }).first().waitFor();
    await pg.keyboard.press("Enter");
    await ed.locator('a[href="nexo:tarefa/' + idTarefa + '"]').waitFor();
    await pg.keyboard.type("e quem aprova é a ");
    await pg.keyboard.type("@Marina");
    await menu.locator("[role=option]", { hasText: "Marina" }).first().waitFor();
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();
    const d = await dados();
    afirmar(d.paginas.items.length === 1, "a página não foi gravada sozinha");
    const p = d.paginas.items[0];
    afirmar(p.texto.includes("](nexo:tarefa/" + idTarefa + ")") && /\]\(nexo:pessoa\/Marina/.test(p.texto), "as citações não foram gravadas como links internos: " + p.texto);
    // a tarefa citada mostra quem aponta para ela, e o link leva de volta à página
    await pg.goto(B + "/tarefas/" + idTarefa);
    const citacao = pg.locator("[data-slot=citacoes] [data-slot=citacao]", { hasText: "Como pedir exceção" });
    await citacao.waitFor();
    await citacao.click();
    await pg.waitForURL("**/paginas");
    await pg.locator("[data-slot=item-pagina][data-ativa]", { hasText: "Como pedir exceção" }).waitFor();
    // a busca acha a página pelo texto
    await pg.goto(B + "/busca?q=" + encodeURIComponent("passo a passo nasceu"));
    await pg.locator("[data-slot=resultado][data-tipo=pagina]", { hasText: "Como pedir exceção" }).waitFor();
  });

  // ---------- documentação: árvore, abas, modelos, [[, leitura, quadro e lista ----------
  await etapa("documentação: modelo, subpágina, [[ que liga e cria, árvore, abas e busca por seção", async () => {
    await pg.goto(B + "/paginas");
    await pg.locator("[data-slot=explorador]").waitFor();
    const idDe = async (titulo) => (await dados()).paginas.items.find((p) => p.titulo === titulo)?.id;
    const idExcecao = await idDe("Como pedir exceção de vulnerabilidade");

    // página nova a partir de um modelo
    await pg.locator("[data-slot=nova-de-modelo]").click();
    await pg.locator("[data-modelo=guia]").click();
    const titulo = pg.getByLabel("Título da página");
    await pg.waitForFunction(() => document.querySelector("[data-slot=titulo-da-pagina]")?.value === "Como fazer ...");
    await titulo.fill("Guia do scan");
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();
    const idGuia = await idDe("Guia do scan");
    afirmar(idGuia, "a página do modelo não foi gravada com o título novo");
    const guia = (await dados()).paginas.items.find((p) => p.id === idGuia);
    afirmar(guia.icone === "lista" && guia.texto.includes("## Antes de começar") && guia.estado === "rascunho", "o modelo não trouxe ícone, texto e estado");

    // página dentro da página, e nela "[[" liga a uma que existe e cria uma que não existe
    await pg.locator("[data-slot=nova-subpagina]").click();
    await pg.waitForFunction(() => document.querySelector("[data-slot=titulo-da-pagina]")?.value === "");
    await titulo.fill("Instalar o agente");
    afirmar((await pg.locator("[data-slot=caminho-da-pagina]").innerText()).includes("Guia do scan"), "o caminho da página não mostra a página mãe");
    const ed = pg.locator("[data-slot=texto-da-pagina] [data-slot=editor-rico-conteudo]");
    await ed.click();
    await pg.keyboard.type("Antes, veja [[Como pedir exce");
    const menu = pg.locator("[data-slot=menu-editor]");
    await menu.locator("[role=option]", { hasText: "Como pedir exceção de vulnerabilidade" }).first().waitFor();
    await pg.keyboard.press("Enter");
    await ed.locator(`a[href="nexo:pagina/${idExcecao}"]`).waitFor();
    await pg.keyboard.type("e depois [[Lista de agentes homologados");
    await menu.locator("[data-item=nova]").waitFor();
    afirmar((await menu.locator("[role=option]").count()) === 1, "o menu de [[ ofereceu página errada para um título que não existe");
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();
    await ateOsDados((d) => d.paginas.items.some((p) => p.titulo === "Lista de agentes homologados"), "o [[ não criou a página");
    let d = await dados();
    const instalar = d.paginas.items.find((p) => p.titulo === "Instalar o agente");
    const criada = d.paginas.items.find((p) => p.titulo === "Lista de agentes homologados");
    afirmar(instalar.paiId === idGuia, "a subpágina não ficou dentro da página mãe");
    afirmar(criada && criada.paiId === instalar.id, "a página criada por [[ não nasceu dentro da página em que foi citada");
    afirmar(instalar.texto.includes(`](nexo:pagina/${idExcecao})`) && instalar.texto.includes(`](nexo:pagina/${criada.id})`), "os links de [[ não foram gravados: " + instalar.texto);

    // árvore: níveis, recolher e abrir
    const item = (id) => pg.locator(`[data-slot=item-pagina][data-id="${id}"]`);
    afirmar((await item(instalar.id).getAttribute("data-nivel")) === "1" && (await item(criada.id).getAttribute("data-nivel")) === "2", "a árvore não mostra os níveis certos");
    await item(idGuia).getByRole("button", { name: "Recolher" }).click();
    await item(instalar.id).waitFor({ state: "detached" });
    await item(idGuia).getByRole("button", { name: "Abrir" }).click();
    await item(instalar.id).waitFor();

    // abas: cada página aberta ganha uma, e fechar tira
    await item(criada.id).click();
    await pg.locator(`[data-slot=aba-de-pagina][data-id="${criada.id}"][data-ativa]`).waitFor();
    const antes = await pg.locator("[data-slot=aba-de-pagina]").count();
    afirmar(antes >= 3, `esperava pelo menos 3 abas abertas, achei ${antes}`);
    await pg.locator(`[data-slot=aba-de-pagina][data-id="${criada.id}"] [data-slot=fechar-aba]`).click();
    await pg.waitForFunction((n) => document.querySelectorAll("[data-slot=aba-de-pagina]").length === n - 1, antes);
    // as abas voltam depois de recarregar
    await pg.reload();
    await pg.locator(`[data-slot=aba-de-pagina][data-id="${instalar.id}"]`).waitFor();

    // busca dentro da documentação: acha pela seção e abre nela
    await pg.locator("[data-slot=busca-paginas]").fill("resultado esperado");
    const achada = pg.locator("[data-slot=pagina-achada]", { hasText: "Guia do scan" });
    await achada.locator("[data-slot=trecho-achado]", { hasText: "Como saber se deu certo" }).click();
    await pg.locator(`[data-slot=editor-pagina][data-id="${idGuia}"]`).waitFor();
    await pg.locator("[data-slot=busca-paginas]").fill("");

    // arrastar na árvore: "Como pedir exceção" vai para dentro de "Guia do scan"
    const origem = await item(idExcecao).boundingBox();
    const destino = await item(idGuia).boundingBox();
    await pg.mouse.move(origem.x + 60, origem.y + origem.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(origem.x + 70, origem.y + origem.height / 2 + 8, { steps: 4 });
    await pg.mouse.move(destino.x + 90, destino.y + destino.height / 2 + 4, { steps: 12 });
    await pg.mouse.up();
    await ateOsDados((d) => d.paginas.items.find((p) => p.id === idExcecao)?.paiId === idGuia, "arrastar não pôs a página dentro da outra");
    // a tela acompanha quando a resposta da gravação chega: espera por ela, em vez de olhar no mesmo instante
    await pg.locator(`[data-slot=item-pagina][data-id="${idExcecao}"][data-nivel="1"]`).waitFor();
    d = await dados();
    afirmar(d.paginas.items.length === 4, "arrastar mudou a quantidade de páginas");
  });

  await etapa("documentação: ler com sumário, favoritar, quadro por estado, lista e arquivar", async () => {
    const d0 = await dados();
    const guia = d0.paginas.items.find((p) => p.titulo === "Guia do scan");
    await pg.locator(`[data-slot=item-pagina][data-id="${guia.id}"]`).click();
    const visao = pg.locator(`[data-slot=editor-pagina][data-id="${guia.id}"]`);
    await visao.waitFor();
    // modo leitura: títulos com âncora, sumário ao lado, anterior e próxima
    await pg.getByRole("radio", { name: "Ler" }).click();
    await pg.locator(`[data-slot=editor-pagina][data-id="${guia.id}"][data-modo=ler]`).waitFor();
    afirmar((await visao.locator("[data-slot=corpo-da-pagina] h2[id=antes-de-comecar]").count()) === 1, "o título não ganhou âncora no modo leitura");
    afirmar((await visao.locator("[data-slot=texto-da-pagina]").count()) === 0, "o editor continuou na tela no modo leitura");
    const itens = await visao.locator("[data-slot=item-do-sumario]").allInnerTexts();
    afirmar(itens.includes("Antes de começar") && itens.includes("Se der errado") && itens.length >= 6, "o sumário não lista os títulos da página: " + itens.join(" | "));
    afirmar((await visao.locator("[data-slot=paginas-de-dentro] button").count()) === 2, "a página não lista as páginas de dentro dela");
    await visao.locator("[data-slot=vizinhas]").waitFor();
    await pg.getByRole("radio", { name: "Editar" }).click();
    await visao.locator("[data-slot=texto-da-pagina]").waitFor();
    // só de abrir e trocar de modo, o texto não muda (o editor não regrava o Markdown do jeito dele)
    await pg.waitForTimeout(1800);
    afirmar((await dados()).paginas.items.find((p) => p.id === guia.id).texto === guia.texto, "abrir a página no editor mudou o texto guardado");

    // favorita aparece no topo do explorador
    await pg.locator("[data-slot=favoritar-pagina]").click();
    await pg.locator(`[data-slot=item-favorita][data-id="${guia.id}"]`).waitFor();

    // quadro: arrastar o cartão para "Pronta" muda o estado
    await pg.getByRole("radio", { name: "Quadro" }).click();
    await pg.locator("[data-slot=quadro-de-paginas]").waitFor();
    afirmar((await pg.locator("[data-slot=cartao-de-pagina]").count()) === 4, "o quadro não mostra um cartão por página");
    const cartao = await pg.locator(`[data-slot=cartao-de-pagina][data-id="${guia.id}"]`).boundingBox();
    const coluna = await pg.locator("[data-slot=coluna-de-paginas][data-estado=publicada]").boundingBox();
    await pg.mouse.move(cartao.x + 40, cartao.y + 20);
    await pg.mouse.down();
    await pg.mouse.move(cartao.x + 60, cartao.y + 30, { steps: 4 });
    await pg.mouse.move(coluna.x + coluna.width / 2, coluna.y + 120, { steps: 14 });
    await pg.mouse.up();
    await ateOsDados((d) => d.paginas.items.find((p) => p.id === guia.id)?.estado === "publicada", "arrastar no quadro não mudou o estado");
    await pg.locator(`[data-slot=coluna-de-paginas][data-estado=publicada] [data-slot=cartao-de-pagina][data-id="${guia.id}"]`).waitFor();

    // lista: filtra, ordena e abre
    // O dnd-kit engole qualquer clique da página nos 50 ms depois de soltar um cartão (é como ele evita o clique
    // do próprio arrasto). Ninguém clica tão rápido, mas o teste clicava: numa máquina rápida, o "Lista" abaixo
    // caía nessa janela e a visão não trocava. Espera a janela passar.
    await pg.waitForTimeout(150);
    await pg.getByRole("radio", { name: "Lista" }).click();
    await pg.locator("[data-slot=lista-de-paginas]").waitFor();
    afirmar((await pg.locator("[data-slot=linha-de-pagina]").count()) === 4, "a lista não mostra todas as páginas");
    await pg.getByLabel("Filtrar a lista de páginas").fill("pronta");
    await pg.waitForFunction(() => document.querySelectorAll("[data-slot=linha-de-pagina]").length === 1);
    await pg.locator("[data-slot=linha-de-pagina]").first().click();
    await pg.locator(`[data-slot=editor-pagina][data-id="${guia.id}"]`).waitFor();

    // arquivar leva junto o que está dentro; desarquivar traz a página de volta
    await pg.locator("[data-slot=editor-pagina]").getByRole("button", { name: "Mais ações da página" }).click();
    await pg.getByRole("menuitem", { name: "Arquivar" }).click();
    await pg.locator("[data-slot=ver-arquivadas]").waitFor();
    let d = await dados();
    afirmar(d.paginas.items.filter((p) => p.arquivadaEm).length === 4, "arquivar a página mãe não levou as páginas de dentro");
    afirmar((await pg.locator("[data-slot=arvore-de-paginas] [data-slot=item-pagina]").count()) === 0, "páginas arquivadas continuaram na árvore");
    for (const p of d.paginas.items) await pg.request.put(`${B}/api/paginas`, { data: { items: (await dados()).paginas.items.map((x) => ({ ...x, arquivadaEm: null })), revEsperada: (await (await pg.request.get(B + "/api/dados")).json()).paginas.rev } }).then(() => p);
    await pg.reload();
    await pg.locator("[data-slot=arvore-de-paginas] [data-slot=item-pagina]").first().waitFor();
    d = await dados();
    afirmar(d.paginas.items.every((p) => !p.arquivadaEm) && d.paginas.items.find((p) => p.titulo === "Instalar o agente").paiId === guia.id, "desarquivar perdeu a árvore");
  });

  // ---------- componentes do documento ----------
  await etapa("componentes: destaque, índice, código com linguagem, anexo e cartão vivo", async () => {
    await pg.goto(B + "/paginas");
    await pg.locator("[data-slot=nova-pagina]").click();
    const titulo = pg.getByLabel("Título da página");
    await pg.waitForFunction(() => document.querySelector("[data-slot=titulo-da-pagina]")?.value === "");
    await titulo.fill("Componentes do documento");
    const ed = pg.locator("[data-slot=texto-da-pagina] [data-slot=editor-rico-conteudo]");
    const menu = pg.locator("[data-slot=menu-editor]");
    // o menu "/" filtra por uma palavra só (espaço fecha o menu) e Enter escolhe o primeiro
    const bloco = async (busca, id) => {
      await pg.keyboard.type("/" + busca);
      await menu.locator(`[role=option][aria-selected=true][data-item=${id}]`).waitFor();
      await pg.keyboard.press("Enter");
      await menu.waitFor({ state: "detached" });
    };
    await ed.click();
    await bloco("indice", "indice");
    await ed.locator("p.marca-de-indice").waitFor();
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("## Primeira parte");
    await pg.keyboard.press("Enter");
    // destaque: a citação ganha a cara do tipo, e a marca continua sendo texto comum
    await bloco("dica", "dica");
    await pg.keyboard.type("Use o atalho");
    await ed.locator("blockquote[data-destaque=dica] .marca-de-destaque").waitFor();
    await pg.keyboard.press("Enter");
    await pg.keyboard.press("Enter");
    // bloco que abre e fecha
    await bloco("recolher", "detalhes");
    await pg.keyboard.type("Ver os detalhes");
    await pg.keyboard.press("Enter");
    await pg.keyboard.type("Texto escondido");
    await pg.keyboard.press("Enter");
    await pg.keyboard.press("Enter");
    // código com linguagem
    await bloco("codigo", "codigo");
    await pg.keyboard.type("# comentario");
    await pg.locator("[data-slot=linguagem-do-codigo]").click();
    await pg.locator("[data-linguagem=bash]").click();
    await pg.keyboard.press("Control+End");
    await pg.keyboard.press("ArrowDown");
    await pg.keyboard.press("Control+Enter");
    // anexo: um arquivo qualquer vai para a pasta de dados e vira link
    await ed.click();
    await pg.keyboard.press("Control+End");
    await pg.locator("[data-slot=anexar-arquivo]").setInputFiles({ name: "Laudo final.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste") });
    await ed.locator('a[href^="arquivos/"]').waitFor();
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();
    let p = (await dados()).paginas.items.find((x) => x.titulo === "Componentes do documento");
    for (const trecho of ["[TOC", "## Primeira parte", "!DICA", "Use o atalho", "!DETALHES", "```bash", "# comentario", "](arquivos/"])
      afirmar(p.texto.includes(trecho), `o Markdown gravado não tem "${trecho}":\n${p.texto}`);
    // acrescenta, pelos dados, um link interno sozinho numa linha e um HTML colado dentro de um destaque
    const d = await (await pg.request.get(B + "/api/dados")).json();
    const textoFinal = p.texto + `\n\n[Tarefa citada](nexo:tarefa/${idTarefa})\n\n> [!PERIGO] Cuidado <img src=x onerror="window.__xss=2">\n> corpo\n`;
    await pg.request.put(`${B}/api/paginas`, { data: { items: d.paginas.items.map((x) => (x.id === p.id ? { ...x, texto: textoFinal } : x)), revEsperada: d.paginas.rev } });
    await pg.goto(B + "/paginas?p=" + p.id);
    await pg.getByRole("radio", { name: "Ler" }).click();
    const visao = pg.locator(`[data-slot=editor-pagina][data-id="${p.id}"][data-modo=ler]`);
    await visao.waitFor();
    await visao.locator("[data-slot=indice] button", { hasText: "Primeira parte" }).waitFor();
    await visao.locator("[data-slot=destaque][data-tipo=dica]", { hasText: "Use o atalho" }).waitFor();
    // abre e fecha: começa fechado
    const detalhes = visao.locator("[data-slot=destaque][data-tipo=detalhes]");
    afirmar((await detalhes.locator("[data-slot=destaque-corpo]").count()) === 0, "o bloco que abre e fecha deveria começar fechado");
    await detalhes.locator("[data-slot=destaque-titulo]").click();
    await detalhes.locator("[data-slot=destaque-corpo]", { hasText: "Texto escondido" }).waitFor();
    // código: linguagem no canto, cores e copiar
    const codigo = visao.locator("[data-slot=bloco-de-codigo][data-linguagem=bash]");
    await codigo.locator("[data-rc=comentario]", { hasText: "# comentario" }).waitFor();
    await codigo.locator("[data-slot=copiar-codigo]").click();
    afirmar((await pg.evaluate(() => navigator.clipboard.readText())) === "# comentario", "copiar o código não levou o texto do bloco");
    // anexo abre pela API local; cartão mostra o estado de agora da tarefa
    const anexo = visao.locator("a[data-slot=anexo]");
    afirmar((await anexo.getAttribute("href")).startsWith("/api/arquivos?p="), "o anexo não aponta para a pasta de dados");
    afirmar((await pg.request.get(B + (await anexo.getAttribute("href")))).ok(), "o arquivo anexado não foi servido");
    const cartao = visao.locator(`[data-slot=cartao-interno][data-tipo=tarefa]`);
    await cartao.waitFor();
    afirmar((await cartao.innerText()).includes("Onboarding do squad Pagamentos"), "o cartão não mostra o título de agora da tarefa");
    // HTML dentro de um destaque continua sendo texto
    await visao.locator("[data-slot=destaque][data-tipo=perigo]", { hasText: "<img src=x" }).waitFor();
    afirmar((await visao.locator("[data-slot=texto] img").count()) === 0 && !(await pg.evaluate(() => window.__xss)), "HTML dentro de um destaque foi interpretado");
    await pg.getByRole("radio", { name: "Editar" }).click();
    await pg.locator("[data-slot=texto-da-pagina]").waitFor();
    await pg.waitForTimeout(1800);
    p = (await dados()).paginas.items.find((x) => x.id === p.id);
    afirmar(p.texto === textoFinal, "abrir a página com componentes no editor mudou o texto guardado");
  });

  // ---------- página de vídeo ----------
  await etapa("página de vídeo: enviar, transcrição que acompanha, anotar o instante, capítulo e galeria", async () => {
    // um áudio de 40 segundos feito aqui mesmo (WAV, 8 kHz, mono): o player toca áudio e vídeo do mesmo jeito
    const wav = (segundos) => {
      const taxa = 8000;
      const n = taxa * segundos;
      const b = Buffer.alloc(44 + n, 128);
      b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
      b.writeUInt32LE(taxa, 24); b.writeUInt32LE(taxa, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40);
      return b;
    };
    await pg.goto(B + "/paginas");
    await pg.locator("[data-slot=nova-de-modelo]").click();
    await pg.locator("[data-modelo=video]").click();
    await pg.locator("[data-slot=fonte-do-video]").waitFor();
    await pg.getByLabel("Título da página").fill("Gravação do alinhamento");
    await pg.locator("[data-slot=fonte-do-video] [data-slot=area-arquivo] input[type=file]").setInputFiles({ name: "alinhamento.wav", mimeType: "audio/wav", buffer: wav(40) });
    const tempo = pg.locator("[data-slot=player-tempo]");
    await pg.locator("[data-slot=player]").waitFor();
    await pg.waitForFunction(() => document.querySelector("[data-slot=player-tempo]")?.textContent?.includes("0:40"));

    // transcrição colada, com o tempo no começo de cada fala
    await pg.locator("[data-slot=colar-transcricao]").fill("[00:02] Marina: Vamos começar pelo scan.\n[00:10] Bruno: Três achados são críticos.\n[00:25] Marina: Triagem na quinta.");
    await pg.locator("[data-slot=usar-transcricao-colada]").click();
    await pg.locator("[data-slot=trecho]").nth(2).waitFor();
    afirmar((await pg.locator("[data-slot=trecho]").first().innerText()).includes("Marina"), "a transcrição não mostrou quem fala");

    // clicar numa fala leva o player até ela, e a fala passa a ser a de agora
    await pg.locator("[data-fala='1']").click();
    await pg.waitForFunction(() => /^0:1\d/.test(document.querySelector("[data-slot=player-tempo]")?.textContent ?? ""));
    await pg.locator("[data-fala='1'][data-agora]").waitFor();
    await pg.locator("[data-slot=player] [data-slot=player-tocar]").click({ force: true });
    await pg.waitForFunction(() => !document.querySelector("[data-slot=player]")?.hasAttribute("data-tocando"));

    // busca na transcrição
    await pg.locator("[data-slot=busca-na-transcricao]").fill("triagem");
    await pg.waitForFunction(() => document.querySelector("[data-slot=contagem-da-transcricao]")?.textContent === "1 de 1");
    await pg.locator("[data-slot=busca-na-transcricao]").fill("");

    // anotar neste instante e marcar um capítulo
    await pg.locator("[data-slot=anotar-instante]").click();
    await pg.locator('[data-slot=texto-da-pagina] a[href^="nexo:tempo/1"]').waitFor();
    await pg.locator("[data-slot=marcar-capitulo]").click();
    const nomeDoCapitulo = pg.getByLabel(/Nome do capítulo/);
    await nomeDoCapitulo.fill("Achados críticos");
    await nomeDoCapitulo.press("Enter");
    await pg.locator("[data-slot=player-marca]").waitFor();
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();

    const p = (await dados()).paginas.items.find((x) => x.titulo === "Gravação do alinhamento");
    afirmar(p && p.tipo === "video" && p.video.arquivo && p.video.transcricao && p.video.duracao === 40, "a página de vídeo não guardou o vídeo, a transcrição e a duração: " + JSON.stringify(p && p.video));
    afirmar(p.video.capitulos.length === 1 && p.video.capitulos[0].titulo === "Achados críticos" && p.video.capitulos[0].t >= 10 && p.video.capitulos[0].t <= 16, "o capítulo não foi gravado no instante certo");
    afirmar(/\]\(nexo:tempo\/1\d\)/.test(p.texto), "o instante anotado não foi para o texto: " + p.texto);
    const pedaco = await pg.request.get(`${B}/api/midia?p=${encodeURIComponent(p.video.arquivo)}`, { headers: { Range: "bytes=0-9" } });
    afirmar(pedaco.status() === 206 && (await pedaco.body()).length === 10, "o vídeo não foi servido em pedaços (Range)");

    // na leitura, o instante anotado é um botão que leva o player até lá
    await pg.locator("[data-slot=player-barra]").click({ position: { x: 2, y: 8 }, force: true });
    await pg.waitForFunction(() => (document.querySelector("[data-slot=player-tempo]")?.textContent ?? "").startsWith("0:00"));
    await pg.getByRole("radio", { name: "Ler" }).click();
    await pg.locator("[data-slot=texto] [data-slot=tempo]").first().click();
    await pg.waitForFunction(() => /^0:1\d/.test(document.querySelector("[data-slot=player-tempo]")?.textContent ?? ""));
    await pg.locator("[data-slot=player] [data-slot=player-tocar]").click({ force: true });
    await pg.getByRole("radio", { name: "Editar" }).click();

    // a galeria mostra a página de vídeo, com a duração
    await pg.getByRole("radio", { name: "Vídeos" }).click();
    const cartao = pg.locator(`[data-slot=cartao-de-video][data-id="${p.id}"]`);
    await cartao.waitFor();
    afirmar((await cartao.innerText()).includes("0:40") && (await cartao.innerText()).includes("transcrição"), "o cartão do vídeo não mostra a duração e a transcrição");
    await cartao.click();
    await pg.locator(`[data-slot=editor-pagina][data-id="${p.id}"][data-tipo=video] [data-slot=player]`).waitFor();
  });

  // ---------- mapa das páginas e histórico de versões ----------
  await etapa("mapa das páginas e histórico de versões", async () => {
    await pg.goto(B + "/paginas");
    await pg.getByRole("radio", { name: "Mapa" }).click();
    await pg.locator("[data-slot=mapa-de-paginas]").waitFor();
    const d = await dados();
    const ativas = d.paginas.items.filter((p) => !p.arquivadaEm);
    await pg.waitForFunction((n) => document.querySelectorAll("[data-slot=no-do-mapa][data-tipo=pagina]").length === n, ativas.length);
    afirmar((await pg.locator("[data-slot=ligacao-do-mapa]").count()) >= 3, "o mapa não desenhou as ligações entre as páginas");
    // as tarefas citadas entram quando pedidas
    afirmar((await pg.locator("[data-slot=no-do-mapa][data-tipo=tarefa]").count()) === 0, "tarefa apareceu no mapa sem ser pedida");
    await pg.getByText("Tarefas citadas").click();
    await pg.locator(`[data-slot=no-do-mapa][data-id="tarefa:${idTarefa}"]`).waitFor();
    // clicar num ponto abre a página
    const guia = ativas.find((p) => p.titulo === "Guia do scan");
    await pg.locator(`[data-slot=no-do-mapa][data-id="pagina:${guia.id}"]`).click();
    await pg.locator(`[data-slot=editor-pagina][data-id="${guia.id}"]`).waitFor();

    // histórico: escrever, apagar tudo sem querer e voltar ao que estava
    await pg.getByRole("radio", { name: "Editar" }).click();
    const ed = pg.locator("[data-slot=texto-da-pagina] [data-slot=editor-rico-conteudo]");
    await ed.click();
    await pg.keyboard.press("Control+End");
    await pg.keyboard.type(" Frase que não pode sumir.");
    const textoDoGuia = (d) => d.paginas.items.find((p) => p.id === guia.id).texto;
    await ateOsDados((d) => textoDoGuia(d).includes("Frase que não pode sumir."), "a frase nova não foi gravada");
    const antes = textoDoGuia(await dados());
    await pg.keyboard.press("Control+A");
    await pg.keyboard.press("Delete");
    await ateOsDados((d) => textoDoGuia(d).trim() === "", "apagar tudo não foi gravado");
    await pg.locator("[data-slot=abrir-historico]").click();
    await pg.locator("[data-slot=versao]").first().waitFor();
    await pg.locator("[data-slot=titulo-da-versao]", { hasText: "Guia do scan" }).waitFor();
    afirmar((await pg.locator("[data-slot=historico-de-versoes]").innerText()).includes("Frase que não pode sumir."), "a versão mais nova do histórico não é o texto de antes do apagão");
    // comparar com agora: o texto que sumiu aparece como linha que saiu
    await pg.getByRole("radio", { name: "Comparar com agora" }).click();
    await pg.locator("[data-slot=comparacao]").waitFor();
    afirmar((await pg.locator("[data-slot=linha-saiu]").allInnerTexts()).some((t) => t.includes("Frase que não pode sumir.")), "a comparação não mostrou o que saiu");
    await pg.getByRole("radio", { name: "Ver a versão" }).click();
    await pg.locator("[data-slot=restaurar-versao]").click();
    await ateOsDados((d) => textoDoGuia(d) === antes, "restaurar não devolveu o texto de antes");
    await ed.getByText("Frase que não pode sumir.").waitFor();
  });

  // ---------- rotina: blocos do dia, ponto, hora de sair e banco de horas ----------
  await etapa("rotina: entrada e hora de sair, blocos, hora extra, pausa, aviso, banco de horas e dia padrão", async () => {
    // Um navegador à parte, com o relógio na mão: o dia é fixado numa terça a sexta (para ontem também ser
    // dia útil) e a hora anda só quando o teste manda. setFixedTime fixa a data e deixa os temporizadores
    // e as animações andando.
    const p2 = (n) => String(n).padStart(2, "0");
    const base = new Date();
    // (e nunca o dia 1º, para ontem cair no mesmo mês)
    while (base.getDay() < 2 || base.getDay() > 5 || base.getDate() === 1) base.setDate(base.getDate() + 1);
    const noDia = (delta) => { const d = new Date(base); d.setDate(d.getDate() + delta); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
    const hojeR = noDia(0);
    const ontemR = noDia(-1);
    const as = (h, m) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
    const ctxR = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
    await ctxR.addInitScript((v) => {
      try {
        localStorage.setItem("nexo:rotina", v);
        localStorage.setItem("nexo:novidadesVistas", JSON.stringify("99.0"));
      } catch {}
    }, ROTINA_DESLIGADA);
    const r = await ctxR.newPage();
    const errosR = [];
    r.on("pageerror", (e) => errosR.push(String(e)));
    try {
      await r.clock.setFixedTime(as(10, 20));
      await r.goto(B + "/rotina");
      await r.locator(`[data-slot=rotina][data-data="${hojeR}"]`).waitFor();
      afirmar((await r.locator("[data-slot=painel-do-ponto]").getAttribute("data-estado")) === "sem-registro", "o dia deveria começar sem ponto");

      // entrada digitada: 8h de trabalho + 1h de pausa = sai 9h depois
      const entrei = r.getByLabel("Hora em que entrei");
      await entrei.fill("812");
      await entrei.press("Enter");
      await r.locator("[data-slot=saida-prevista]", { hasText: "17:12" }).waitFor();
      afirmar((await r.locator("[data-slot=conta-da-saida]").innerText()).includes("08:12 + 8h de trabalho + 1h de pausa (planejada)"), "a conta da hora de saída não está explicada");
      const diaR = async () => (await dados()).jornada.items.find((x) => x.id === hojeR);
      await ateOsDados((d) => d.jornada.items.find((x) => x.id === hojeR)?.ponto.entrada === "08:12", "a entrada não foi gravada");
      afirmar((await diaR()).jornadaMin === 480, "a jornada do dia não foi fixada na entrada");

      // blocos do dia
      const novoBloco = async (tipo, titulo, ini, fim) => {
        await r.locator("[data-slot=novo-bloco]").click();
        const f = r.locator("[data-slot=bloco-form]");
        await f.waitFor();
        await f.getByRole("radio", { name: tipo }).click();
        await f.locator("[data-slot=titulo-do-bloco]").fill(titulo);
        await f.getByLabel("Início do bloco").fill(ini);
        await f.getByLabel("Início do bloco").press("Tab");
        await f.getByLabel("Fim do bloco").fill(fim);
        await f.getByLabel("Fim do bloco").press("Tab");
        await r.locator("[data-slot=salvar-bloco]").click();
        await f.waitFor({ state: "detached" });
        await r.locator("[data-slot=bloco]", { hasText: titulo }).first().waitFor();
      };
      await novoBloco("Atividade", "Chamados da manhã", "815", "10:00");
      await novoBloco("Atividade", "Projeto do scan", "10:00", "12:00");
      await novoBloco("Pausa", "Almoço", "12:00", "13:00");
      await novoBloco("Atividade", "Chamados da tarde", "13:00", "16:30");
      await novoBloco("Atividade", "Janela de mudança", "16:30", "19:00");
      await ateOsDados((d) => d.jornada.items.find((x) => x.id === hojeR)?.blocos.length === 5, "os cinco blocos não foram gravados");
      afirmar((await diaR()).planejado === true, "o dia não ficou com plano próprio");

      // o bloco de agora, na linha do tempo e na barra superior
      afirmar((await r.locator("[data-slot=bloco][data-agora]").innerText()).includes("Projeto do scan"), "o bloco de agora não é o das 10:00");
      const ficha = await r.locator("[data-slot=ferramenta-rotina]").innerText();
      afirmar(ficha.includes("Projeto do scan") && ficha.includes("1h40"), "a barra superior não mostra o bloco de agora e quanto falta: " + ficha);

      // hora extra planejada: 9h45 de trabalho para 8h de jornada, e o bloco que passa do fim do expediente
      await r.locator("[data-slot=plano-extra]", { hasText: "1h45" }).waitFor();
      afirmar((await r.locator("[data-slot=fim-do-expediente]").innerText()).includes("17:12"), "o fim do expediente não está na linha do tempo");
      afirmar((await r.locator("[data-slot=bloco][data-extra]").count()) === 1, "só o bloco que passa do expediente deveria estar marcado como extra");
      afirmar((await r.locator("[data-slot=aviso-de-extra]").innerText()).includes("hora extra planejada"), "o aviso de hora extra planejada não apareceu");

      // arrastar um bloco muda o horário (de 5 em 5 minutos) e não abre o formulário
      const arrastado = r.locator("[data-slot=bloco]", { hasText: "Chamados da manhã" });
      await arrastado.scrollIntoViewIfNeeded();
      const cx = await arrastado.boundingBox();
      await r.mouse.move(cx.x + cx.width / 2, cx.y + 40);
      await r.mouse.down();
      await r.mouse.move(cx.x + cx.width / 2, cx.y + 10, { steps: 5 });
      await r.mouse.move(cx.x + cx.width / 2, cx.y - 20, { steps: 5 });
      await r.mouse.up();
      await ateOsDados((d) => {
        const b = d.jornada.items.find((x) => x.id === hojeR)?.blocos.find((x) => x.titulo === "Chamados da manhã");
        return b?.inicio === "07:25" && b?.fim === "09:10";
      }, "arrastar o bloco 60 px para cima deveria levá-lo de 08:15 para 07:25");
      afirmar((await r.locator("[data-slot=bloco-form]").count()) === 0, "arrastar um bloco não deveria abrir o formulário");

      // editar um bloco pelo clique: encurta a janela, e o nome com HTML continua sendo texto
      await r.locator("[data-slot=bloco]", { hasText: "Janela de mudança" }).click();
      const f = r.locator("[data-slot=bloco-form]");
      await f.waitFor();
      await f.locator("[data-slot=titulo-do-bloco]").fill('Janela <img src=x onerror="window.__xss=3">');
      await f.getByLabel("Fim do bloco").fill("18:00");
      await f.getByLabel("Fim do bloco").press("Tab");
      await r.locator("[data-slot=salvar-bloco]").click();
      await f.waitFor({ state: "detached" });
      await r.locator("[data-slot=plano-extra]", { hasText: "45 min" }).waitFor();
      afirmar((await r.locator("[data-slot=linha-do-dia] img").count()) === 0 && (await r.evaluate(() => window.__xss)) === undefined, "HTML no nome do bloco foi interpretado");

      // marcar um bloco como cumprido
      const manha = r.locator("[data-slot=bloco]", { hasText: "Chamados da manhã" });
      await manha.hover();
      await manha.locator("[data-slot=bloco-feito]").click();
      await r.locator("[data-slot=bloco][data-feito]", { hasText: "Chamados da manhã" }).waitFor();

      // pausa de 45 minutos: a hora de saída acompanha (15 min mais cedo)
      await r.locator("[data-slot=sair-para-pausa]").click();
      await r.locator("[data-slot=em-pausa]").waitFor();
      await r.clock.setFixedTime(as(11, 5));
      await r.locator("[data-slot=voltar-da-pausa]").click();
      await r.locator("[data-slot=saida-prevista]", { hasText: "16:57" }).waitFor();
      afirmar((await r.locator("[data-slot=conta-da-saida]").innerText()).includes("45 min de pausa (registrada)"), "a pausa registrada não entrou na conta da saída");

      // o app avisa quando um bloco começa
      await r.clock.setFixedTime(as(12, 0));
      await r.evaluate(() => window.dispatchEvent(new Event("focus")));
      await r.getByText("Hora da pausa: Almoço").waitFor();

      // encerrar o dia: 17:27 − 08:12 − 45 min de pausa = 8h30, saldo de +0h30
      await r.clock.setFixedTime(as(17, 27));
      await r.evaluate(() => window.dispatchEvent(new Event("focus")));
      await r.locator("[data-slot=encerrar-o-dia]").click();
      // encerrar o dia de hoje abre o "Fechar o dia" com a daily pronta
      const fechar = r.locator("[data-ritual=fechar-dia]");
      await fechar.waitFor();
      afirmar((await fechar.locator("[data-slot=texto-daily]").innerText()).includes("O que vou fazer:"), "o fechamento do dia não mostrou a daily");
      afirmar((await fechar.locator("[data-slot=fechar-o-dia]").innerText()).includes("Pronto"), "com a saída já batida, o botão do fechamento deveria ser só \"Pronto\"");
      await fechar.locator("[data-slot=fechar-o-dia]").click();
      await fechar.waitFor({ state: "detached" });
      await r.locator("[data-slot=painel-do-ponto][data-estado=fechado]").waitFor();
      await r.locator("[data-slot=saldo-do-dia]", { hasText: "+0h30" }).waitFor();
      const fechado = await diaR();
      afirmar(fechado.ponto.saida === "17:27" && fechado.ponto.pausas.length === 1 && fechado.ponto.pausas[0].fim === "11:05", "o ponto do dia não foi gravado como esperado: " + JSON.stringify(fechado.ponto));

      // ontem, informado depois: 08:00 a 16:00 sem pausa registrada desconta 1h, saldo de −1h00
      await r.getByRole("button", { name: "Dia anterior" }).click();
      await r.locator(`[data-slot=rotina][data-data="${ontemR}"]`).waitFor();
      await r.locator("[data-slot=ajustar-horarios]").click();
      const aj = r.locator("[data-slot=ajustar-ponto]");
      await aj.waitFor();
      await aj.getByLabel("Entrada", { exact: true }).fill("0800");
      await aj.getByLabel("Saída", { exact: true }).fill("1600");
      await aj.getByLabel("Saída", { exact: true }).press("Tab");
      await r.locator("[data-slot=salvar-ponto]").click();
      await aj.waitFor({ state: "detached" });
      await r.locator("[data-slot=saldo-do-dia]", { hasText: "−1h00" }).waitFor();
      afirmar((await r.locator("[data-slot=ponto-trabalhado]").innerText()).includes("não registrada, descontada"), "a pausa não registrada deveria ter sido descontada");
      await r.locator("[data-slot=saldo-da-semana]", { hasText: "−0h30" }).waitFor();

      // banco de horas: o mês e o acumulado
      await r.getByRole("radio", { name: "Banco de horas" }).click();
      await r.locator("[data-slot=banco-de-horas]").waitFor();
      await r.locator("[data-slot=banco-total]", { hasText: "−0h30" }).waitFor();
      afirmar((await r.locator(`[data-slot=linha-do-banco][data-data="${ontemR}"]`).getAttribute("data-estado")) === "fechado", "ontem não aparece fechado no banco de horas");
      await r.locator("[data-slot=copiar-banco]").click();

      // dia padrão: um bloco que se repete aparece na semana que vem, e o dia de hoje (que já tem plano) não muda
      await r.getByRole("radio", { name: "Dia", exact: true }).click();
      await r.locator("[data-slot=abrir-dia-padrao]").click();
      const dp = r.locator("[data-slot=dia-padrao]");
      await dp.waitFor();
      await r.locator("[data-slot=padrao-nova-atividade]").click();
      await dp.locator("[data-slot=linha-do-padrao]").getByLabel("Nome do bloco").fill("Chamados de sempre");
      await r.locator("[data-slot=salvar-dia-padrao]").click();
      await dp.waitFor({ state: "detached" });
      await r.goto(B + "/rotina?d=" + noDia(6));
      await r.locator("[data-slot=selo-dia-padrao]").waitFor();
      await r.locator("[data-slot=linha-do-dia][data-padrao] [data-slot=bloco]", { hasText: "Chamados de sempre" }).waitFor();
      afirmar(!(await dados()).jornada.items.some((x) => x.id === noDia(6)), "ver um dia que segue o padrão não deveria gravar nada");
      afirmar((await diaR()).blocos.length === 5, "mexer no dia padrão mudou um dia que já tinha plano próprio");

      // a tela Hoje mostra o resumo do dia
      await r.goto(B + "/");
      await r.locator("[data-slot=cartao-da-rotina-ponto]", { hasText: "08:12 a 17:27" }).waitFor();
      afirmar(errosR.length === 0, "erro de JavaScript na rotina: " + errosR.join(" | "));
    } finally {
      await ctxR.close();
    }
  });

  // ---------- perguntar ao Nexo ----------
  await etapa("perguntar: achar os trechos, copiar o prompt, colar a resposta e guardar como página", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("u");
    await pg.waitForURL(/\/perguntar$/);
    const pergunta = "O que ficou decidido no alinhamento do onboarding?";
    await pg.locator("[data-slot=pergunta]").fill(pergunta);
    const fonte = pg.locator(`[data-slot=fonte][data-chave^="registro:${idDoModelo}:"]`).first();
    await fonte.waitFor();
    const rotulo = await fonte.getAttribute("data-rotulo");
    const total = await pg.locator("[data-slot=fonte]").count();
    // tirar uma fonte do prompt e pôr de volta
    if (total > 1) {
      const outra = pg.locator(`[data-slot=fonte]:not([data-rotulo=${rotulo}])`).first();
      await outra.getByRole("checkbox").click();
      await pg.locator("[data-slot=fonte][data-fora]").waitFor();
      afirmar((await pg.locator("[data-slot=resumo-fontes]").innerText()).startsWith(`${total - 1} de ${total}`), "a fonte desmarcada continuou contando no prompt");
      await outra.getByRole("checkbox").click();
    }
    await pg.locator("[data-slot=copiar-prompt-pergunta]").click();
    const prompt = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(prompt.includes(`Pergunta: ${pergunta}`) && prompt.includes("SOMENTE as fontes") && prompt.includes(`[${rotulo}] Reunião: Alinhamento do onboarding`), "o prompt não tem a pergunta, as regras e a fonte");
    afirmar(prompt.includes("Começar pelo squad de Pagamentos"), "o trecho da decisão não foi para o prompt");
    // a resposta colada: citação vira link interno; HTML não é interpretado
    const colada = pg.locator("[data-slot=resposta-colada]");
    await colada.fill(`Ficou decidido começar pelo squad de Pagamentos [${rotulo}]. <img src=x onerror="window.__xss=1">`);
    const resposta = pg.locator("[data-slot=resposta]");
    await resposta.locator("[data-slot=link-interno]").first().waitFor();
    afirmar((await resposta.locator("img").count()) === 0 && !(await pg.evaluate(() => window.__xss)), "HTML da resposta colada foi interpretado");
    afirmar((await pg.locator("[data-slot=citada]").count()) === 1, "a fonte citada não apareceu na lista");
    // F5 não perde a pergunta nem a resposta
    await pg.reload();
    await resposta.waitFor();
    afirmar((await pg.locator("[data-slot=pergunta]").inputValue()) === pergunta, "a pergunta se perdeu no F5");
    await pg.locator("[data-slot=guardar-resposta]").click();
    await pg.locator("[data-slot=editor-pagina]").waitFor();
    const d = await dados();
    const pagina = d.paginas.items.find((x) => x.titulo === pergunta);
    afirmar(pagina && pagina.texto.includes(`[${rotulo}](nexo:tarefa/${idDoModelo})`) && pagina.texto.includes("**Fontes**"), "a resposta não virou página com as fontes ligadas");
    afirmar(!pagina.texto.includes("<img"), "o HTML colado foi gravado sem escapar na página");
    const guardado = await pg.evaluate(() => JSON.parse(localStorage.getItem("nexo:pergunta") || "{}"));
    afirmar(!guardado.resposta && !guardado.pergunta, "a consulta não foi limpa depois de guardar");
  });

  // ---------- radar das frentes ----------
  await etapa("radar: saúde das frentes, filtro e status em texto", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("f");
    await pg.waitForURL(/\/radar$/);
    await pg.locator("[data-slot=frente]").first().waitFor();
    const d = await dados();
    const abertos = ["a_fazer", "em_andamento", "aguardando", "bloqueada"];
    const comAberta = new Set(d.tarefas.filter((t) => abertos.includes(t.status)).map((t) => (d.categorias.some((c) => c.id === t.categoriaId) ? t.categoriaId : "sem")));
    const esperadas = d.categorias.filter((c) => !c.arquivada || comAberta.has(c.id)).length + (comAberta.has("sem") ? 1 : 0);
    afirmar((await pg.locator("[data-slot=frente]").count()) === esperadas, "o radar não mostrou uma frente por categoria (mais a de tarefas sem categoria)");
    // toda frente tem um selo de saúde, e os números do topo somam as frentes com tarefa aberta
    afirmar((await pg.locator("[data-slot=frente] [data-slot=saude]").count()) === esperadas, "faltou o selo de saúde em alguma frente");
    const semAbertas = await pg.locator("[data-slot=frente][data-saude=sem_abertas]").count();
    // os números do topo contam animados até o valor: espera a soma fechar
    await pg.waitForFunction(
      (alvo) => [...document.querySelectorAll("[data-slot=estatistica]")].reduce((n, e) => n + Number(e.textContent.replace(/\D/g, "")), 0) === alvo,
      esperadas - semAbertas,
    ).catch(() => afirmar(false, "os contadores de saúde não batem com as frentes"));
    // filtrar por uma saúde que existe
    const saude = await pg.locator("[data-slot=frente]").first().getAttribute("data-saude");
    const quantas = await pg.locator(`[data-slot=frente][data-saude=${saude}]`).count();
    const nomes = { risco: "Em risco", atencao: "Pede atenção", parada: "Parada", em_dia: "Em dia" };
    if (nomes[saude]) {
      await pg.locator("[data-slot=estatistica]", { hasText: nomes[saude] }).click();
      await pg.waitForFunction((n) => document.querySelectorAll("[data-slot=frente]").length === n, quantas);
      await pg.getByRole("button", { name: "Mostrar todas" }).click();
      await pg.waitForFunction((n) => document.querySelectorAll("[data-slot=frente]").length === n, esperadas);
    }
    await pg.locator("[data-slot=copiar-status]").click();
    const texto = await pg.evaluate(() => navigator.clipboard.readText());
    // \r?\n: no Windows a área de transferência devolve as quebras de linha como CRLF
    afirmar(/^Status das frentes em \d\d\/\d\d\/\d\d\r?\n/.test(texto), "o status copiado não começa pelo título com a data");
    const comTarefa = d.categorias.find((c) => comAberta.has(c.id));
    afirmar(!comTarefa || texto.includes(`\n${comTarefa.nome}: `), "o status copiado não traz a frente que tem tarefa aberta");
    // o cartão leva para a categoria
    if (comTarefa) {
      await pg.locator("[data-slot=frente]", { hasText: comTarefa.nome }).first().getByRole("link", { name: comTarefa.nome }).click();
      await pg.waitForURL(new RegExp(`/categorias/${comTarefa.id}$`));
    }
  });

  // ---------- conquistas (gamificação) ----------
  await etapa("conquistas: nível, meta do dia, conquistas e desligar", async () => {
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("q");
    await pg.waitForURL("**/conquistas");
    await pg.locator("[data-slot=cartao-nivel]").waitFor();
    // o placar bate com os dados: o XP mostrado é o mesmo que sai da conta feita aqui, direto da API
    const d = await dados();
    let xp = 0;
    for (const t of d.tarefas)
      for (const r of t.registros) {
        if (r.tipo === "marco") { if (r.alteracoes?.status?.para === "concluida") xp += 50; }
        else xp += (r.tipo === "reuniao" ? 20 : 15) + Math.min(60, r.duracaoMin || 0);
        xp += 10 * r.proximosPassos.filter((p) => p.feito && p.feitoEm).length;
      }
    afirmar(xp > 0, "o cenário do teste devia ter rendido algum XP");
    await pg.waitForFunction((esperado) => document.querySelector("[data-slot=xp]")?.textContent.trim() === String(esperado), xp);
    afirmar(Number(await pg.locator("[data-slot=nivel]").innerText()) >= 2, "com tudo o que o teste fez, o nível devia ter passado de 1");
    await pg.locator("[data-slot=conquista][data-id=passo-1][data-feita]").waitFor();
    await pg.locator("[data-slot=conquista][data-id=tarefa-1][data-feita]").waitFor();
    await pg.locator("[data-slot=conquista][data-id=foco-1][data-feita]").waitFor();
    afirmar((await pg.locator("[data-slot=conquista][data-id=passo-500][data-feita]").count()) === 0, "conquista distante apareceu como feita");
    await pg.locator("[data-slot=meta-do-dia]").getByText("Meta de hoje").waitFor();
    // o que já foi comemorado fica anotado no navegador (para não comemorar de novo)
    const visto = JSON.parse(await pg.evaluate(() => localStorage.getItem("nexo:jogoVisto")));
    afirmar(visto.conquistas.includes("passo-1") && visto.nivel >= 2, "as comemorações não foram anotadas: " + JSON.stringify(visto));
    // o placar fica à vista na barra lateral e na tela Hoje
    await pg.locator("[data-slot=lateral] [data-slot=nivel-lateral]").waitFor();
    await pg.goto(B + "/");
    await pg.locator("[data-slot=meta-hoje]").waitFor();
    // desligar esconde tudo, sem tocar nos dados
    await pg.goto(B + "/configuracoes");
    await pg.locator("[data-slot=painel-jogo]").getByRole("switch").first().click();
    await pg.locator("[data-slot=nivel-lateral]").waitFor({ state: "detached" });
    // com a gamificação desligada, a aba Conquistas some das abas de Acompanhar
    await pg.goto(B + "/radar");
    await pg.locator("[data-slot=abas-acompanhar]").waitFor();
    afirmar((await pg.locator("[data-slot=aba-acompanhar]").count()) === 4, "com as conquistas desligadas, as abas deviam ser quatro");
    afirmar((await pg.locator("[data-slot=aba-acompanhar][data-href='/conquistas']").count()) === 0, "a aba Conquistas apareceu com a gamificação desligada");
    await pg.goto(B + "/conquistas");
    await pg.locator("[data-slot=ligar-jogo]").click();
    await pg.locator("[data-slot=cartao-nivel]").waitFor();
    await pg.locator("[data-slot=lateral] [data-slot=nivel-lateral]").waitFor();
  });

  // ---------- Acompanhar: um item no menu, abas em comum e a última aba lembrada ----------
  await etapa("acompanhar: item único no menu, abas e última aba usada", async () => {
    await pg.goto(B + "/");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    // pelo começo do texto: o item Acompanhar traz "(revisão semanal atrasada)" para leitor de tela
    const nav = (nome) => pg.locator("[data-slot=lateral] [data-slot=nav-item]", { hasText: new RegExp("^" + nome) });
    // no menu padrão as cinco telas viram um item só
    await nav("Acompanhar").waitFor();
    for (const nome of ["Radar", "Diário", "Revisão semanal", "Relatórios", "Conquistas"])
      afirmar((await nav(nome).count()) === 0, `"${nome}" não devia aparecer solto no menu padrão`);
    // a última aba usada foi Conquistas (a etapa anterior terminou nela): o item abre nela
    await nav("Acompanhar").click();
    await pg.waitForURL("**/conquistas");
    await pg.locator("[data-slot=lateral] [data-slot=nav-item][data-ativo]", { hasText: "Acompanhar" }).waitFor();
    const abas = pg.locator("[data-slot=abas-acompanhar] [data-slot=aba-acompanhar]");
    afirmar((await abas.allInnerTexts()).map((t) => t.split("\n")[0].trim()).join(",") === "Radar,Diário,Revisão,Relatórios,Conquistas", "as abas de Acompanhar não são as cinco esperadas");
    afirmar((await pg.locator("[data-slot=aba-acompanhar][aria-current=page]").innerText()).startsWith("Conquistas"), "a aba da tela aberta não ficou marcada");
    // trocar de aba: o item continua marcado e passa a abrir a nova aba
    await pg.locator("[data-slot=aba-acompanhar][data-href='/relatorios']").click();
    await pg.waitForURL("**/relatorios");
    await pg.locator("[data-slot=lateral] [data-slot=nav-item][data-ativo]", { hasText: "Acompanhar" }).waitFor();
    await pg.goto(B + "/tarefas");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    afirmar((await pg.locator("[data-slot=abas-acompanhar]").count()) === 0, "as abas de Acompanhar apareceram fora das cinco telas");
    await nav("Acompanhar").click();
    await pg.waitForURL("**/relatorios");
    // os atalhos de cada tela continuam valendo
    await pg.locator("[data-slot=pagina] h1").first().click();
    await pg.keyboard.press("g");
    await pg.keyboard.press("s");
    await pg.waitForURL("**/revisao");
    afirmar((await pg.locator("[data-slot=aba-acompanhar][aria-current=page]").innerText()).startsWith("Revisão"), "G S não marcou a aba Revisão");
  });

  // ---------- confiança: saúde dos dados, restaurar backup e novidades ----------
  await etapa("configurações: verificar a saúde dos dados, restaurar um backup e ver as novidades", async () => {
    await pg.goto(`${B}/configuracoes`);
    await pg.locator("[data-slot=verificar-dados]").click();
    const saude = pg.locator("[data-slot=saude-dos-dados]");
    await saude.waitFor();
    const erros = await pg.locator("[data-slot=achado][data-gravidade=erro]").evaluateAll((els) => els.map((e) => e.textContent));
    afirmar(erros.length === 0, `a verificação acusou erro nos dados do teste: ${erros.join(" | ")}`);
    afirmar(/\d+ tarefas, \d+ registros/.test(await saude.innerText()), "a verificação não mostrou os números da pasta");

    // backup de agora, depois uma mudança, depois volta
    const antes = await dados();
    await pg.getByRole("button", { name: "Fazer backup agora" }).click();
    await pg.getByText("Backup manual criado.").waitFor();
    const alvo = antes.tarefas[0];
    const nova = { id: "e2erestaurar", titulo: "Criada depois do backup (e2e)" };
    await pg.request.put(`${B}/api/tarefas/${nova.id}`, { data: { tarefa: nova, revEsperada: null } });
    await pg.request.put(`${B}/api/tarefas/${alvo.id}`, { data: { tarefa: { ...alvo, titulo: "Mudou depois do backup (e2e)" }, revEsperada: alvo.rev } });
    await pg.locator("[data-slot=lista-backups]").click();
    const linha = pg.locator("[data-slot=backup]", { hasText: "manual-" }).first();
    await linha.locator("[data-slot=restaurar-backup]").click();
    const previa = pg.locator("[data-slot=previa-backup]");
    await previa.waitFor();
    const texto = await previa.innerText();
    afirmar(texto.includes("1 tarefa criada depois vai para a lixeira") && texto.includes(nova.titulo), `a prévia não avisou da tarefa que sai:\n${texto}`);
    afirmar(texto.includes("1 tarefa volta ao que era") && texto.includes(alvo.titulo), `a prévia não avisou da tarefa que volta:\n${texto}`);
    await pg.locator("[data-slot=confirmar-restauracao]").click();
    await pg.getByText(/Backup restaurado\. O estado anterior ficou guardado em _backups\/pre-restauracao-/).waitFor();
    const depois = await dados();
    afirmar(!depois.tarefas.some((t) => t.id === nova.id), "a tarefa criada depois do backup continuou na pasta");
    afirmar(depois.tarefas.find((t) => t.id === alvo.id).titulo === alvo.titulo, "a tarefa não voltou ao título do backup");
    afirmar(depois.tarefas.length === antes.tarefas.length, "a restauração mudou a quantidade de tarefas");
    // a foto do estado anterior aparece na lista, e a tarefa que saiu está na lixeira
    await pg.locator("[data-slot=backup]", { hasText: "pre-restauracao-" }).first().waitFor();
    await pg.getByText(nova.titulo).first().waitFor();

    await pg.locator("[data-slot=ver-novidades]").click();
    await pg.locator("[data-slot=novidades]").waitFor();
    afirmar((await pg.locator("[data-slot=novidades] li").count()) >= 6, "a janela de novidades veio vazia");
    // o que é desta versão vem em destaque; o histórico por versão abre ao clicar, um item por vez
    afirmar((await pg.locator("[data-slot=novidade-atual]").count()) >= 1, "a novidade desta versão não veio em destaque");
    afirmar((await pg.locator("[data-slot=versao-anterior]").count()) === 5, "o histórico devia abrir com as cinco versões mais recentes");
    await pg.locator("[data-slot=novidades-antigas]").click();
    afirmar((await pg.locator("[data-slot=versao-anterior]").count()) >= 10, "o histórico completo veio curto");
    const antigas = pg.locator("[data-slot=novidade-anterior]");
    await antigas.nth(0).click();
    await pg.locator("[data-slot=novidade-anterior][data-state=open]").waitFor();
    await antigas.nth(1).click();
    await pg.waitForFunction(() => document.querySelectorAll("[data-slot=novidade-anterior][data-state=open]").length === 1);
    afirmar((await antigas.nth(1).getAttribute("data-state")) === "open", "o segundo item do histórico não abriu");
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=novidades]").waitFor({ state: "detached" });
    // as etapas seguintes contam com estar fora de Configurações (lá há um segundo seletor de tema)
    await pg.goto(`${B}/tarefas`);
    await pg.locator("[data-slot=pagina]").first().waitFor();
  });

  await etapa("personalizar: cor, item da lateral e ferramenta", async () => {
    await pg.locator("[data-slot=abrir-personalizar]").click();
    const painel = pg.locator("[data-slot=personalizar]");
    await painel.waitFor();
    const nav = (nome) => pg.locator("[data-slot=lateral] [data-slot=nav-item]", { hasText: new RegExp("^" + nome) });
    // separar as telas de acompanhar: as cinco voltam ao menu e o item "Acompanhar" sai
    await painel.getByRole("radio", { name: "Lateral" }).click();
    await nav("Acompanhar").waitFor();
    afirmar((await nav("Relatórios").count()) === 0, "Relatórios apareceu solto no menu padrão");
    await painel.getByRole("switch", { name: "Mostrar as cinco telas separadas no menu" }).click();
    await nav("Relatórios").waitFor();
    await nav("Acompanhar").waitFor({ state: "detached" });
    afirmar(JSON.parse(await pg.evaluate(() => localStorage.getItem("nexo:moldura"))).acompanharSeparado === true, "a escolha de separar não foi guardada");
    // esconder um item de navegação e trazê-lo de volta
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
    // ferramenta que mora no menu "Mais": escondida, some também de dentro dele
    await painel.getByRole("switch", { name: "Mostrar Atalhos" }).click();
    await pg.locator("[data-slot=menu-mais]").click();
    await pg.locator("[data-slot=mais-tela-cheia]").waitFor();
    afirmar((await pg.locator("[data-slot=mais-atalhos]").count()) === 0, "Atalhos escondido continuou no menu Mais");
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=menu]").waitFor({ state: "detached" });
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
    // voltar tudo ao padrão: o perfil em uso e a aparência
    await pg.locator("[data-slot=abrir-personalizar]").click();
    // as mudanças feitas até aqui são do perfil em uso (Completo): o seletor mostra que ele foi mexido
    await pg.locator("[data-slot=seletor-perfil][data-perfil=completo][data-modificado]").waitFor();
    await voltarAoPadrao(painel);
    await pg.waitForFunction(() => document.documentElement.style.getPropertyValue("--matiz") === "275");
    await pg.locator("[data-slot=seletor-perfil][data-perfil=completo]:not([data-modificado])").waitFor();
    await pg.locator("[data-slot=ferramenta-agenda]").waitFor();
    // o padrão volta a juntar as telas de acompanhar
    await nav("Acompanhar").waitFor();
    afirmar((await nav("Relatórios").count()) === 0, "depois de voltar ao padrão, Relatórios continuou solto no menu");
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });
    // o menu "Mais" leva aos atalhos de novo e ao Personalizar
    await pg.locator("[data-slot=menu-mais]").click();
    await pg.locator("[data-slot=mais-atalhos]").click();
    await pg.getByRole("dialog").filter({ hasText: "Atalhos" }).first().waitFor();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=menu-mais]").click();
    await pg.locator("[data-slot=mais-personalizar]").click();
    await painel.waitFor();
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });
  });

  // ---------- personalização (3.13): temas prontos, cor livre, tons neutros, tela Hoje e código ----------
  await etapa("personalizar: temas prontos, cor livre, tela Hoje sob medida e código para outro computador", async () => {
    await pg.goto(B + "/");
    await pg.locator("[data-slot=hoje]").waitFor();
    const raiz = (fn, arg) => pg.waitForFunction(fn, arg);
    const blocos = () => pg.evaluate(() => [...document.querySelectorAll("[data-slot=hoje] [data-bloco]")].map((e) => e.dataset.bloco));
    // o botão da tela Hoje abre o painel já na aba dela
    await pg.locator("[data-acao=personalizar-hoje]").click();
    const painel = pg.locator("[data-slot=personalizar]");
    await painel.locator("[data-slot=aba-hoje]").waitFor();
    // nome na saudação
    await painel.getByLabel("Seu nome na saudação").fill("  Ana  ");
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=pagina] h1", { hasText: /, Ana$/ }).waitFor();
    // esconder um bloco, mudar a ordem da coluna da direita e pôr o foco primeiro
    afirmar((await blocos()).includes("semana"), "a semana devia aparecer por padrão");
    await painel.getByRole("switch", { name: "Mostrar Próximos 7 dias" }).click();
    await pg.locator("[data-bloco=semana]").waitFor({ state: "detached" });
    await painel.getByRole("button", { name: /^Mover Progresso de hoje/ }).press("ArrowUp");
    await raiz(() => {
      const b = [...document.querySelectorAll("[data-slot=hoje] aside [data-bloco]")].map((e) => e.dataset.bloco);
      return b.indexOf("progresso") >= 0 && b.indexOf("progresso") < b.indexOf("rotina");
    });
    await painel.getByRole("radio", { name: "Foco", exact: true }).click();
    await raiz(() => {
      const b = [...document.querySelectorAll("[data-slot=hoje] [data-bloco]")].map((e) => e.dataset.bloco);
      return b.indexOf("foco") >= 0 && b.indexOf("foco") < b.indexOf("precisa");
    });
    // tema pronto: troca cor, fundo, escuro profundo e o próprio tema de uma vez
    await painel.getByRole("radio", { name: "Aparência" }).click();
    afirmar((await painel.locator("[data-tema-pronto]").count()) >= 8, "faltam temas prontos");
    await painel.locator("[data-tema-pronto=meia-noite]").click();
    await raiz(() => {
      const h = document.documentElement;
      return h.classList.contains("dark") && h.dataset.escuro === "profundo" && h.dataset.fundo === "aurora" && h.style.getPropertyValue("--matiz") === "252";
    });
    afirmar((await painel.locator("[data-tema-pronto=meia-noite]").getAttribute("aria-checked")) === "true", "o tema aplicado não ficou marcado");
    // a miniatura tem as cores do próprio tema: a do Papel continua clara com o app escuro
    const luz = await pg.evaluate(() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const cx = cv.getContext("2d");
      const brilho = (el) => {
        cx.fillStyle = getComputedStyle(el).backgroundColor;
        cx.fillRect(0, 0, 1, 1);
        const [r, g, b] = cx.getImageData(0, 0, 1, 1).data;
        return r + g + b;
      };
      return { papel: brilho(document.querySelector("[data-tema-pronto=papel] .tema-claro")), app: brilho(document.body) };
    });
    afirmar(luz.papel > 600 && luz.app < 150, "a miniatura do tema claro não usou as cores dela: " + JSON.stringify(luz));
    // cor livre: parte da cor atual e aceita qualquer matiz, com a intensidade limitada
    await painel.locator("[data-acento=livre]").click();
    await painel.locator("[data-slot=cor-livre]").waitFor();
    await raiz(() => document.documentElement.style.getPropertyValue("--matiz") === "252");
    await painel.getByRole("slider", { name: "Matiz da cor de destaque" }).press("Home");
    await raiz(() => document.documentElement.style.getPropertyValue("--matiz") === "0");
    const croma = Number(await pg.evaluate(() => document.documentElement.style.getPropertyValue("--croma")));
    afirmar(croma > 0.3 && croma <= 1, "croma da cor livre fora da faixa: " + croma);
    afirmar((await painel.locator("[data-tema-pronto][aria-checked=true]").count()) === 0, "com a cor livre, nenhum tema pronto devia ficar marcado");
    await painel.getByRole("radio", { name: "Quentes" }).click();
    await raiz(() => document.documentElement.dataset.neutros === "quente");
    // copiar o código, voltar ao padrão e colar: tudo volta
    await painel.locator("[data-acao=copiar-personalizacao]").click();
    await pg.waitForFunction(async () => (await navigator.clipboard.readText()).includes('"personalizacao"'));
    const codigo = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(codigo.length < 3000 && JSON.parse(codigo).hoje.nome === "Ana", "o código copiado não traz a personalização");
    afirmar(JSON.parse(codigo).v === 2 && JSON.parse(codigo).perfis.ativo === "completo" && !("memoria" in JSON.parse(codigo).perfis), "o código não leva os perfis (ou leva a memória deles)");
    await voltarAoPadrao(painel);
    await raiz(() => document.documentElement.style.getPropertyValue("--matiz") === "275" && document.documentElement.dataset.neutros === "frio");
    await pg.locator("[data-bloco=semana]").waitFor();
    // o nome da saudação é da pessoa, não do perfil nem da aparência: nenhuma das duas voltas apaga
    afirmar((await pg.locator("[data-slot=pagina] h1").innerText()).includes("Ana"), "voltar ao padrão apagou o nome da saudação");
    await painel.getByRole("radio", { name: "Hoje", exact: true }).click();
    await painel.getByLabel("Seu nome na saudação").fill("");
    await pg.keyboard.press("Enter");
    await pg.waitForFunction(() => !document.querySelector("[data-slot=pagina] h1").innerText.includes("Ana"));
    await painel.getByRole("radio", { name: "Aparência" }).click();
    await painel.locator("[data-acao=colar-personalizacao]").click();
    const campo = pg.getByRole("textbox", { name: "Código de personalização" });
    await campo.fill("isto não é um código");
    await pg.locator("[data-acao=aplicar-personalizacao]").click();
    await pg.getByRole("alert").filter({ hasText: "código de personalização" }).waitFor();
    afirmar((await pg.evaluate(() => document.documentElement.style.getPropertyValue("--matiz"))) === "275", "um texto qualquer mudou a aparência");
    await campo.fill("segue o código:\n" + codigo);
    await pg.locator("[data-acao=aplicar-personalizacao]").click();
    await raiz(() => document.documentElement.style.getPropertyValue("--matiz") === "0" && document.documentElement.dataset.neutros === "quente" && document.documentElement.classList.contains("dark"));
    await pg.locator("[data-slot=pagina] h1", { hasText: /, Ana$/ }).waitFor();
    await pg.locator("[data-bloco=semana]").waitFor({ state: "detached" });
    // depois de recarregar, o script do <head> aplica a mesma coisa antes da primeira pintura
    await pg.reload();
    await pg.locator("[data-slot=hoje]").waitFor();
    const depois = await pg.evaluate(() => ({ ...document.documentElement.dataset, matiz: document.documentElement.style.getPropertyValue("--matiz") }));
    afirmar(depois.matiz === "0" && depois.neutros === "quente" && depois.escuro === "profundo", "a personalização não voltou depois de recarregar: " + JSON.stringify(depois));
    // deixa tudo como veio para as próximas etapas
    await pg.locator("[data-acao=personalizar-hoje]").click();
    await painel.getByLabel("Seu nome na saudação").fill("");
    await pg.keyboard.press("Enter");
    await voltarAoPadrao(painel);
    await painel.getByRole("radio", { name: "Sistema", exact: true }).click();
    await raiz(() => !document.documentElement.classList.contains("dark") && document.documentElement.style.getPropertyValue("--matiz") === "275");
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });
  });

  await etapa("tarefas: seleção em lote, desfazer com Ctrl Z, visão salva e teclado", async () => {
    await pg.goto(`${B}/tarefas`);
    await pg.locator("[data-slot=contador-tarefas]").waitFor();
    await pg.getByRole("radio", { name: "Grade" }).click();
    await pg.locator("[data-slot=selecionavel]").first().waitFor();
    const itens = pg.locator("[data-slot=selecionavel]");
    const n = await itens.count();
    afirmar(n >= 2, "deveria haver pelo menos duas tarefas abertas na lista");
    // teclado: J foca a primeira, X seleciona; Ctrl + clique seleciona outra sem abrir
    await pg.evaluate(() => document.activeElement?.blur());
    await pg.keyboard.press("j");
    await pg.keyboard.press("x");
    await itens.nth(1).locator("a[href]").first().click({ modifiers: ["Control"] });
    afirmar(new URL(pg.url()).pathname === "/tarefas", "Ctrl + clique abriu a tarefa em vez de selecionar");
    await pg.locator("[data-slot=contagem-lote]", { hasText: "2 tarefas" }).waitFor();
    const ids = await itens.evaluateAll((els) => els.filter((e) => e.dataset.selecionada).map((e) => e.dataset.id));
    const antes = Object.fromEntries((await dados()).tarefas.filter((t) => ids.includes(t.id)).map((t) => [t.id, t.prioridade]));
    await pg.locator("[data-slot=barra-lote]").getByRole("button", { name: "Prioridade" }).click();
    await pg.getByRole("menuitem", { name: "1", exact: true }).click();
    await ateOsDados((d) => ids.every((id) => d.tarefas.find((t) => t.id === id).prioridade === 1), "a prioridade em lote não foi gravada");
    // o desfazer entra na pilha quando as duas gravações voltam: o aviso com "Desfazer" é o sinal
    await pg.locator("[data-sonner-toast]", { hasText: "Prioridade 1 em 2 tarefas" }).waitFor();
    await pg.evaluate(() => document.activeElement?.blur());
    await pg.keyboard.press("Control+z");
    await ateOsDados((d) => ids.every((id) => d.tarefas.find((t) => t.id === id).prioridade === antes[id]), "Ctrl Z não desfez a prioridade em lote");
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=barra-lote]").waitFor({ state: "detached" });
    // visão salva: ordenar por prazo, salvar, mudar e voltar pela paleta
    await pg.locator("[data-slot=ordenacao]").click();
    await pg.getByRole("menuitemradio", { name: "Prazo" }).click();
    await pg.locator("[data-slot=visoes-salvas]").click();
    await pg.locator("[data-slot=salvar-visao]").click();
    await pg.getByLabel("Nome da visão").fill("Abertas por prazo");
    await pg.keyboard.press("Enter");
    await pg.locator("[data-slot=visoes-salvas]", { hasText: "Abertas por prazo" }).waitFor();
    await pg.locator("[data-slot=ordenacao]").click();
    await pg.getByRole("menuitemradio", { name: "A-Z" }).click();
    await pg.locator("[data-slot=visoes-salvas]", { hasText: "Visões" }).waitFor();
    await pg.keyboard.press("Control+k");
    await dialogo().locator("input").first().fill("abertas por prazo");
    await pg.locator('[data-paleta-item^="visao:"]').first().click();
    await pg.locator("[data-slot=ordenacao][data-valor=prazo]").waitFor();
    await pg.locator("[data-slot=visoes-salvas]", { hasText: "Abertas por prazo" }).waitFor();
  });

  await etapa("busca e perguntar acham a fala dentro da transcrição do vídeo", async () => {
    await pg.goto(`${B}/busca?q=${encodeURIComponent("achados críticos")}`);
    const achado = pg.locator("[data-slot=resultado][data-tipo=video]").first();
    await achado.waitFor();
    afirmar((await achado.innerText()).includes("Bruno"), "o resultado do vídeo não mostra quem falou");
    afirmar(((await achado.locator("a").getAttribute("href")) || "").includes("&t=10"), "o resultado do vídeo não leva ao instante da fala");
  });

  await etapa("dependências, tarefa que se repete e falar com alguém", async () => {
    const d0 = await dados();
    const abertas = d0.tarefas.filter((t) => !["concluida", "cancelada"].includes(t.status));
    afirmar(abertas.length >= 2, "precisa de duas tarefas abertas");
    const [a, b] = abertas;
    // a depende de b; b ligar em a seria ciclo
    await pg.goto(`${B}/tarefas/${a.id}`);
    await pg.locator("[data-slot=dependencias] [data-slot=combobox]").click();
    await pg.keyboard.type(b.titulo.slice(0, 12));
    await pg.keyboard.press("Enter");
    await ateOsDados((d) => (d.tarefas.find((t) => t.id === a.id).dependeDe || []).includes(b.id), "a dependência não foi gravada");
    await pg.goto(`${B}/tarefas/${b.id}`);
    await pg.locator("[data-slot=segura]").waitFor();
    await pg.locator("[data-slot=dependencias] [data-slot=combobox]").click();
    await pg.keyboard.type(a.titulo.slice(0, 12));
    await pg.keyboard.press("Enter");
    await pg.getByText("criaria um ciclo").first().waitFor();
    // modelo que se repete todo dia: vira lembrete com "Criar agora" e "Pular esta vez"
    await pg.goto(`${B}/configuracoes`);
    await pg.locator("[data-slot=novo-modelo]").click();
    await pg.getByLabel("Nome do modelo").fill("Conferir os alertas");
    await pg.getByLabel("Como o modelo se repete").click();
    await pg.getByRole("option", { name: "A cada N dias" }).click();
    await pg.getByLabel("De quantos em quantos dias").fill("1");
    await pg.locator("[data-slot=salvar-modelo]").click();
    await ateOsDados((d) => d.modelos.items.some((m) => m.nome === "Conferir os alertas" && m.repetir?.tipo === "dias"), "a repetição do modelo não foi gravada");
    await pg.locator("[data-slot=sino]").click();
    const lembrete = pg.getByRole("button", { name: /Hora de criar a tarefa de sempre/ });
    await lembrete.waitFor();
    await pg.keyboard.press("Escape");
    // falar com: anota na pessoa e aparece na pauta da reunião com ela
    await pg.goto(`${B}/pessoas?p=${encodeURIComponent("Marina")}`);
    await pg.locator("[data-slot=falar-com]").waitFor();
    await pg.getByLabel("Novo assunto para falar com Marina").fill("Pedir o calendário de treinamentos");
    await pg.keyboard.press("Enter");
    await ateOsDados((d) => (d.assuntos?.items || []).some((x) => x.texto === "Pedir o calendário de treinamentos" && !x.resolvidoEm), "o assunto não foi gravado");
    await pg.goto(`${B}/tarefas/${a.id}/reuniao`);
    await pg.locator("[data-slot=reuniao] input[placeholder='Nome e Enter']").fill("Marina");
    await pg.keyboard.press("Enter");
    await pg.getByText("Para falar com Marina").first().waitFor();
    await pg.getByRole("button", { name: "Descartar reunião" }).click();
    await pg.getByRole("button", { name: "Descartar", exact: true }).click();
    await pg.locator("[data-slot=propriedades]").waitFor();
  });

  // ---------- links e documentos como material de trabalho (3.14) ----------
  await etapa("links e documentos: um link em duas tarefas, status de chamado, trava, página e folha ligadas", async () => {
    const d0 = await dados();
    const abertas = d0.tarefas.filter((t) => !["concluida", "cancelada"].includes(t.status));
    afirmar(abertas.length >= 2, "precisa de duas tarefas abertas");
    const [a, b] = abertas;
    const GUIA = "Guia de integração da Ferramenta X";
    const guia0 = d0.links.find((l) => l.titulo === GUIA);
    afirmar(guia0, "o link criado na etapa de links sumiu");
    const guia = (d) => d.links.find((l) => l.id === guia0.id);
    const painel = pg.locator("[data-slot=links-tarefa]");
    const linha = painel.locator("[data-slot=link]", { hasText: GUIA });
    // os menus fecham com animação: espera sumirem antes de abrir outro (senão o clique pega o menu fechando)
    const semMenu = () => pg.waitForFunction(() => !document.querySelector("[role=menu]"));
    const ligarDoBanco = async () => {
      await painel.locator("[data-slot=adicionar-referencia]").click();
      await pg.keyboard.type("Guia de integ");
      await pg.locator("[data-slot=ligar-link]", { hasText: GUIA }).click();
      await linha.waitFor();
    };

    // o mesmo link passa a servir às duas tarefas (antes só dava para uma)
    await pg.goto(`${B}/tarefas/${a.id}`);
    await ligarDoBanco();
    await ateOsDados((d) => guia(d).tarefaId === a.id && (guia(d).tarefaIds || []).join() === a.id, "o link não foi ligado à primeira tarefa");
    await pg.goto(`${B}/tarefas/${b.id}`);
    await ligarDoBanco();
    await ateOsDados((d) => (guia(d).tarefaIds || []).join() === `${a.id},${b.id}` && guia(d).tarefaId === a.id, "o link não ficou nas duas tarefas (o campo antigo tem que ser a primeira)");
    await linha.locator("[data-slot=tambem-em]", { hasText: "em mais 1 tarefa" }).waitFor();

    // status de chamado, pelo menu do link
    await linha.locator("[data-slot=link-menu]").click();
    await pg.locator("[data-slot=menu-status]").click();
    await pg.getByRole("menuitemradio", { name: "Aberto" }).click();
    await semMenu();
    await ateOsDados((d) => guia(d).estado === "aberto" && !!guia(d).estadoEm, "o status não foi gravado");
    await linha.locator("[data-slot=seletor-estado-link][data-estado=aberto]").waitFor();
    await linha.locator("[data-slot=resumo-estado]", { hasText: "Aberto hoje" }).waitFor();

    // travando esta tarefa (e só esta): faixa no cabeçalho e o impedimento na linha do tempo
    await linha.locator("[data-slot=link-menu]").click();
    await pg.getByRole("menuitemcheckbox", { name: "Está travando esta tarefa" }).click();
    await semMenu();
    await ateOsDados((d) => (guia(d).trava || []).join() === b.id, "a trava não foi gravada só para esta tarefa");
    await ateOsDados((d) => d.tarefas.find((t) => t.id === b.id).registros.some((r) => r.tipo === "impedimento" && r.titulo.includes(GUIA)), "o impedimento não foi para a linha do tempo");
    const faixa = pg.locator("[data-slot=faixa-travas]");
    await faixa.locator("[data-slot=trava]", { hasText: GUIA }).waitFor();
    await linha.locator("[data-slot=trava-link]").waitFor();
    await pg.locator("[data-slot=timeline]", { hasText: `Travada por “${GUIA}”` }).first().waitFor();

    // o chamado foi concluído: a faixa some e o link mostra que não trava mais
    await faixa.locator("[data-slot=seletor-estado-link]").click();
    await pg.getByRole("menuitemradio", { name: "Concluído" }).click();
    await semMenu();
    await ateOsDados((d) => guia(d).estado === "concluido", "o status concluído não foi gravado");
    await faixa.waitFor({ state: "detached" });
    await linha.locator("[data-slot=destravou-link]").waitFor();
    await linha.locator("[data-slot=seletor-estado-link][data-estado=concluido]").waitFor();

    // na tela de Links: as duas tarefas na linha e o filtro por status
    await pg.goto(B + "/links");
    const naLista = pg.locator("[data-slot=link]", { hasText: GUIA });
    await naLista.waitFor();
    afirmar((await naLista.locator("[data-slot=tarefa-do-link]").count()) === 2, "a tela de Links não mostra as duas tarefas do link");
    await naLista.locator("[data-slot=seletor-estado-link][data-estado=concluido]").waitFor();
    await pg.getByLabel("Filtrar por status").click();
    await pg.getByRole("option", { name: "Concluído" }).click();
    await pg.waitForFunction(() => document.querySelectorAll("[data-slot=link]").length === 1);
    await pg.getByLabel("Filtrar por status").click();
    await pg.getByRole("option", { name: "Em aberto" }).click();
    await pg.getByText("Nada encontrado").waitFor();

    // página nova para a tarefa: nasce ligada, e a própria página escolhe mais tarefas
    await pg.goto(`${B}/tarefas/${a.id}`);
    await painel.locator("[data-slot=adicionar-referencia]").click();
    await pg.locator("[data-slot=nova-pagina-da-tarefa]").click();
    await pg.waitForURL("**/paginas**");
    const daTarefa = (d) => d.paginas.items.find((p) => p.titulo === a.titulo && (p.tarefaIds || []).includes(a.id));
    await ateOsDados((d) => !!daTarefa(d), "a página não nasceu ligada à tarefa");
    const seletor = pg.locator("[data-slot=editor-pagina] [data-slot=seletor-de-tarefas]");
    await pg.locator('[data-slot=editor-pagina] [data-slot=seletor-de-tarefas][data-quantas="1"]').waitFor();
    await seletor.click();
    await pg.keyboard.type(b.titulo.slice(0, 14));
    await pg.keyboard.press("Enter");
    await ateOsDados((d) => (daTarefa(d).tarefaIds || []).join() === `${a.id},${b.id}`, "a página não ficou ligada às duas tarefas");
    await pg.keyboard.press("Escape");
    await pg.goto(`${B}/tarefas/${b.id}`);
    const paginaLigada = painel.locator("[data-slot=pagina-da-tarefa]", { hasText: a.titulo });
    await paginaLigada.waitFor();
    await paginaLigada.hover();
    await paginaLigada.getByRole("button", { name: /^Desvincular/ }).click();
    await ateOsDados((d) => (daTarefa(d).tarefaIds || []).join() === a.id, "a página não foi desvinculada só desta tarefa");

    // folha nova para a tarefa, citando o link do banco com @; depois ela vira página e leva tudo junto
    await painel.locator("[data-slot=adicionar-referencia]").click();
    await pg.locator("[data-slot=nova-folha-da-tarefa]").click();
    await pg.waitForURL("**/notas**");
    const folha = (d) => d.notas.items.find((n) => (n.tarefaIds || []).join() === b.id && !n.arquivadaEm);
    await ateOsDados((d) => !!folha(d), "a folha não nasceu ligada à tarefa");
    await pg.locator('[data-slot=editor-nota] [data-slot=seletor-de-tarefas][data-quantas="1"]').waitFor();
    const texto = pg.locator("[data-slot=texto-da-folha] [data-slot=editor-rico-conteudo]");
    await texto.click();
    await pg.keyboard.type("Seguir o ");
    await pg.keyboard.type("@Guia de integ");
    await pg.locator("[data-slot=menu-editor] [role=option]", { hasText: GUIA }).first().click();
    await texto.locator('a[href="https://exemplo.com/guia-ferramenta-x"]').waitFor();
    await pg.locator("[data-slot=nota-situacao][data-situacao=salvo]").waitFor();
    const idDaFolha = folha(await dados()).id;
    afirmar(folha(await dados()).texto.includes("](https://exemplo.com/guia-ferramenta-x)"), "o link do banco não entrou no texto como link de verdade");
    await pg.locator("[data-slot=contagem-de-palavras]").waitFor();
    await pg.locator("[data-slot=virar-pagina]").click();
    await pg.waitForURL("**/paginas**");
    await ateOsDados((d) => !!d.notas.items.find((n) => n.id === idDaFolha).arquivadaEm, "a folha que virou página não foi arquivada");
    const virou = (d) => d.paginas.items.find((p) => p.texto.includes("](https://exemplo.com/guia-ferramenta-x)") && (p.tarefaIds || []).join() === b.id);
    await ateOsDados((d) => !!virou(d), "a página criada da folha não levou o texto e a tarefa ligada");

    // Ctrl + clique num link do texto abre o destino (clique simples só põe o cursor)
    await pg.locator("[data-slot=editor-pagina]").waitFor();
    if (await pg.locator("[data-slot=editor-pagina][data-modo=ler]").count()) await pg.getByRole("radio", { name: "Editar" }).click();
    await pg.evaluate(() => { window.open = (u) => { window.__abriu = String(u); return null; }; });
    const noTexto = pg.locator('[data-slot=texto-da-pagina] a[href="https://exemplo.com/guia-ferramenta-x"]');
    await noTexto.click();
    afirmar(!(await pg.evaluate(() => window.__abriu)), "clique simples num link do editor não pode abrir nada");
    await noTexto.click({ modifiers: ["Control"] });
    await pg.waitForFunction(() => window.__abriu === "https://exemplo.com/guia-ferramenta-x");
    await pg.locator("[data-slot=pagina-situacao][data-situacao=salvo]").waitFor();
  });

  // ---------- ver arquivos por dentro do app (3.15) ----------
  await etapa("arquivos por dentro do app: planilha, CSV, Word, PowerPoint, PDF, Markdown, HTML como texto e ZIP", async () => {
    const { montarDocx, montarPdf, montarPptx, montarXlsx, montarZip } = await import("./zip-de-teste.mjs");
    const XSS = "<img src=x onerror=window.__xss=1>";
    const exemplos = [
      ["achados.xlsx", montarXlsx([
        { nome: "Achados", linhas: [["Id", "Título", "Aberta em", "% corrigido"], [1001, "Injeção de SQL em /busca", { v: 46344, s: 1 }, { v: 0.5, s: 2 }], [1002, XSS, { v: 46345, s: 1 }, { v: 0.125, s: 2 }], [1003, "Cabeçalho ausente", null, 1.5]] },
        { nome: "Resumo", linhas: [["Squad", "Abertos"], ["Pagamentos", 34]] },
      ]), "Planilha de achados"],
      // CSV em ANSI (como o Excel em português grava), com ponto e vírgula e um campo entre aspas
      ["chamados.csv", Buffer.from('Chamado;Assunto;Status\n4521;Janela de mudança;Concluído\n4544;"Usuário de serviço; teste";Aberto\n', "latin1"), "Chamados em CSV"],
      ["plano.docx", montarDocx('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Plano de adoção</w:t></w:r></w:p><w:p><w:r><w:t>O scan roda na pipeline. ' + XSS.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Squad</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Prazo</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'), "Plano em Word"],
      ["kickoff.pptx", montarPptx([{ titulo: "Abertura do kickoff", linhas: ["Por que agora"] }, { titulo: "Cronograma", linhas: ["Piloto em novembro", "Treinamento"] }]), "Kickoff em PowerPoint"],
      ["laudo.pdf", montarPdf("Laudo de teste"), "Laudo em PDF"],
      ["LEIAME.md", Buffer.from("# Runbook de triagem\n\nComece pelos **críticos**.\n\n" + XSS + "\n"), "Runbook em Markdown"],
      ["relatorio.html", Buffer.from("<h1>Relatório exportado</h1>\n<script>window.__xss = 1</script>\n"), "Relatório em HTML"],
      ["evidencias.zip", montarZip({ "prints/": "", "prints/tela.png": Buffer.alloc(3000, 1), "logs/scan.log": "linha\n".repeat(50) }), "Evidências em ZIP"],
      ["antiga.xls", Buffer.from("planilha no formato antigo"), "Planilha antiga"],
    ];
    const novos = [];
    for (const [nome, bytes, titulo] of exemplos) {
      const r = await (await pg.request.post(B + "/api/arquivos", { multipart: { arquivo: { name: nome, mimeType: "application/octet-stream", buffer: Buffer.from(bytes) } } })).json();
      afirmar(r.arquivo, "o arquivo de exemplo não subiu: " + nome);
      novos.push({ id: "lver" + novos.length, tipo: "arquivo", titulo, arquivo: r.arquivo, nomeArquivo: r.nomeArquivo, tamanho: r.tamanho, descricao: "", tags: [], criadoEm: new Date().toISOString() });
    }
    const bruto = await (await pg.request.get(B + "/api/dados")).json();
    const gravou = await pg.request.put(B + "/api/links", { data: { items: [...bruto.links.items, ...novos], revEsperada: bruto.links.rev } });
    afirmar(gravou.ok(), "os links dos arquivos de exemplo não foram gravados");

    await pg.goto(B + "/links");
    const endereco = pg.url();
    const visor = pg.locator("[data-slot=visor-de-arquivo]");
    const abrir = async (titulo, jeito) => {
      await pg.locator("[data-slot=link]", { hasText: titulo }).locator("[data-slot=link-titulo]").click();
      await pg.locator(`[data-slot=visor-de-arquivo][data-jeito=${jeito}] [data-slot=visor-corpo][data-fase=pronto]`).waitFor();
      afirmar(pg.url() === endereco && (await ctx.pages()).length === 1, "abrir o arquivo não pode trocar de tela nem abrir outra aba: " + titulo);
    };
    const fecharVisor = async () => {
      await pg.keyboard.press("Escape");
      await visor.waitFor({ state: "detached" });
    };

    // planilha: abas, valores como se lê em português, célula inteira, filtro
    await abrir("Planilha de achados", "planilha");
    afirmar((await visor.locator("[data-slot=aba-da-planilha]").count()) === 2, "a planilha devia mostrar as duas abas");
    const celula = (ref) => visor.locator(`[data-slot=celula][data-ref=${ref}]`);
    afirmar((await celula("B2").innerText()) === "Injeção de SQL em /busca", "o texto da célula B2 não veio");
    afirmar((await celula("C2").innerText()) === "18/11/2026", "a data da planilha tem que aparecer como data, não como número: " + (await celula("C2").innerText()));
    afirmar((await celula("D2").innerText()) === "50%" && (await celula("D4").innerText()) === "1,5", "percentual e decimal têm que sair como se lê em português");
    afirmar((await celula("B3").innerText()) === XSS, "conteúdo com cara de HTML tem que aparecer como texto");
    await celula("B2").click();
    await visor.locator("[data-slot=celula-escolhida]", { hasText: "Injeção de SQL em /busca" }).waitFor();
    await visor.getByLabel("Filtrar as linhas da planilha").fill("cabecalho");
    await visor.locator("[data-slot=contagem-de-linhas]", { hasText: "1 de 3 linhas" }).waitFor();
    afirmar((await visor.locator("[data-slot=linha-da-planilha]").count()) === 2, "com o filtro, ficam o cabeçalho e a linha achada");
    await visor.locator("[data-slot=aba-da-planilha]", { hasText: "Resumo" }).click();
    await visor.locator("[data-slot=celula][data-ref=A2]", { hasText: "Pagamentos" }).waitFor();
    await fecharVisor();
    afirmar(await pg.locator("[data-slot=link-titulo]", { hasText: "Planilha de achados" }).evaluate((el) => el === document.activeElement), "ao fechar, o foco volta para o link do arquivo");

    // CSV em ANSI: acentos certos, separador achado, campo entre aspas inteiro
    await abrir("Chamados em CSV", "tabela");
    afirmar((await celula("C2").innerText()) === "Concluído" && (await celula("B2").innerText()) === "Janela de mudança", "os acentos do CSV em ANSI vieram errados");
    afirmar((await celula("B3").innerText()) === "Usuário de serviço; teste", "o campo entre aspas do CSV foi partido");
    await fecharVisor();

    // Word e PowerPoint: o texto, na ordem
    await abrir("Plano em Word", "documento");
    await visor.locator("[data-slot=visor-documento] h1", { hasText: "Plano de adoção" }).waitFor();
    await visor.locator("[data-slot=visor-documento] td", { hasText: "Prazo" }).waitFor();
    await visor.getByText("O scan roda na pipeline. " + XSS).waitFor();
    await fecharVisor();
    await abrir("Kickoff em PowerPoint", "slides");
    afirmar((await visor.locator("[data-slot=slide]").count()) === 2, "a apresentação devia ter dois slides");
    afirmar((await visor.locator("[data-slot=slide]").first().innerText()).includes("Abertura do kickoff"), "o primeiro slide tem que ser o primeiro da apresentação, não o primeiro arquivo");
    await fecharVisor();

    // PDF: embutido pelo leitor do navegador, só com o pedido do visor
    await abrir("Laudo em PDF", "pdf");
    const srcDoPdf = await visor.locator("iframe[data-slot=visor-pdf]").getAttribute("src");
    afirmar(/^\/api\/arquivos\?p=[^&]+&ver=1$/.test(srcDoPdf), "o PDF tem que ser pedido pela rota de anexos com ver=1: " + srcDoPdf);
    const cabDoPdf = (await pg.request.get(B + srcDoPdf)).headers();
    afirmar(cabDoPdf["content-security-policy"] === "frame-ancestors 'self'" && cabDoPdf["content-type"] === "application/pdf", "o PDF do visor veio com cabeçalhos errados");
    await fecharVisor();

    // Markdown desenhado pelo leitor do app (HTML dentro dele é texto) e o texto cru
    await abrir("Runbook em Markdown", "markdown");
    await visor.locator("[data-slot=visor-markdown] h1", { hasText: "Runbook de triagem" }).waitFor();
    await visor.locator("[data-slot=visor-markdown] strong", { hasText: "críticos" }).waitFor();
    await visor.getByRole("radio", { name: "Texto cru" }).click();
    await visor.locator("[data-slot=visor-codigo]", { hasText: "# Runbook de triagem" }).waitFor();
    await fecharVisor();

    // HTML anexado aparece como código-fonte: nada dele roda
    await abrir("Relatório em HTML", "texto");
    await visor.locator("[data-slot=visor-codigo]", { hasText: "<script>window.__xss = 1</script>" }).waitFor();
    afirmar((await visor.locator("[data-slot=visor-texto] h1").count()) === 0, "o HTML anexado não pode ser interpretado");
    await fecharVisor();

    // ZIP: a lista do que tem dentro
    await abrir("Evidências em ZIP", "zip");
    afirmar((await visor.locator("[data-slot=entrada-do-zip]").count()) === 2, "o ZIP devia listar os dois arquivos (a pasta não conta)");
    await visor.locator("[data-slot=entrada-do-zip]", { hasText: "logs/scan.log" }).waitFor();
    await fecharVisor();

    afirmar(!(await pg.evaluate(() => window.__xss)), "conteúdo de um arquivo anexado foi executado");

    // os anexos abertos direto no navegador vão em sandbox (a política das telas não passa por cima)
    const direto = (await pg.request.get(B + "/api/arquivos?p=" + encodeURIComponent(novos[6].arquivo))).headers();
    afirmar(/^sandbox/.test(direto["content-security-policy"] || "") && direto["x-frame-options"] === "DENY", "o anexo aberto direto tem que ir em sandbox: " + direto["content-security-policy"]);

    // formato antigo do Office não abre por dentro: o link segue (baixa) e um aviso diz o que fazer
    // (o teste segura a navegação do link depois de o app tratar o clique, para não baixar nada de verdade)
    await pg.evaluate(() => window.addEventListener("click", (e) => { window.__seguiuOLink = !e.defaultPrevented; e.preventDefault(); }, { once: true }));
    await pg.locator("[data-slot=link]", { hasText: "Planilha antiga" }).locator("[data-slot=link-titulo]").click();
    await pg.getByText("salve como .xlsx para ver aqui").waitFor();
    afirmar(await pg.evaluate(() => window.__seguiuOLink === true), "para o formato antigo, o link tem que seguir normalmente (baixar)");
    afirmar((await visor.count()) === 0, "planilha no formato antigo não abre o visor");
  });

  await etapa("criar sem sair de onde está: categoria, tarefa e tags na hora, menu Criar, paleta e a tela de tags", async () => {
    const d0 = await dados();
    const abertas = d0.tarefas.filter((t) => !["concluida", "cancelada"].includes(t.status));
    afirmar(abertas.length >= 2, "precisa de duas tarefas abertas");
    const comRegistro = abertas.find((t) => t.registros.some((r) => r.tipo !== "marco"));
    afirmar(comRegistro, "precisa de uma tarefa aberta com um registro");
    const a = comRegistro;
    const b = abertas.find((t) => t.id !== a.id);
    const tarefa = (d, id) => d.tarefas.find((t) => t.id === id);
    const cat = (d, nome) => d.categorias.find((c) => c.nome === nome);
    const semBalao = () => pg.waitForFunction(() => !document.querySelector("[data-radix-popper-content-wrapper]"));
    const aviso = (texto) => pg.locator("[data-sonner-toast]", { hasText: texto }).first();

    // ---- categoria que ainda não existe, criada da faixa de propriedades da tarefa (antes: ir à tela de Categorias) ----
    await pg.goto(`${B}/tarefas/${a.id}`);
    await pg.locator("[data-slot=prop-categoria]").click();
    await pg.keyboard.type("Fluxo sem sair");
    await pg.locator("[data-slot=criar-categoria]").click();
    await ateOsDados((d) => cat(d, "Fluxo sem sair") && tarefa(d, a.id).categoriaId === cat(d, "Fluxo sem sair").id, "a categoria criada no lugar não foi gravada na tarefa");
    await aviso("Categoria “Fluxo sem sair” criada").waitFor();
    afirmar(new URL(pg.url()).pathname === `/tarefas/${a.id}`, "criar a categoria tirou o usuário da tarefa");
    await pg.locator("[data-slot=prop-categoria]", { hasText: "Fluxo sem sair" }).waitFor();
    // digitar de novo o mesmo nome (com outra caixa) não duplica: a opção de criar nem aparece
    await pg.locator("[data-slot=prop-categoria]").click();
    await pg.keyboard.type("fluxo SEM sair");
    await pg.locator("[data-slot=lista-de-categorias] [role=option]", { hasText: "Fluxo sem sair" }).waitFor();
    afirmar((await pg.locator("[data-slot=criar-categoria]").count()) === 0, "ofereceu criar uma categoria que já existe");
    await pg.keyboard.press("Escape");
    await semBalao();

    // ---- depender de uma tarefa que ainda não está no app: ela nasce no seletor, na mesma categoria, já ligada ----
    await pg.getByRole("combobox", { name: "Ligar uma tarefa de que esta depende" }).click();
    await pg.keyboard.type("Liberar o acesso de leitura");
    await pg.getByRole("option", { name: /Criar .*Liberar o acesso de leitura/ }).click();
    await ateOsDados((d) => {
      const nova = d.tarefas.find((t) => t.titulo === "Liberar o acesso de leitura");
      return nova && (tarefa(d, a.id).dependeDe || []).includes(nova.id) && nova.categoriaId === tarefa(d, a.id).categoriaId && nova.registros.some((r) => r.tipo === "marco");
    }, "a tarefa criada no seletor de dependências não nasceu ligada (ou sem o marco de criação)");
    await semBalao();

    // ---- mover um registro para uma tarefa que ainda não existe ----
    const registro = a.registros.find((r) => r.tipo !== "marco");
    await pg.locator(`#reg-${registro.id} [data-slot=registro-menu]`).click();
    await pg.getByRole("menuitem", { name: /Mover para outra tarefa/ }).click();
    await dialogo().getByRole("combobox", { name: "Tarefa de destino" }).click();
    await pg.keyboard.type("Demanda que faltava cadastrar");
    await pg.getByRole("option", { name: /Criar .*Demanda que faltava cadastrar/ }).click();
    await dialogo().getByRole("combobox", { name: "Tarefa de destino" }).filter({ hasText: "Demanda que faltava cadastrar" }).waitFor();
    const antesDeMover = tarefa(await dados(), a.id).registros.length;
    await dialogo().locator("[data-slot=confirmar-mover]").click();
    await ateOsDados((d) => {
      const nova = d.tarefas.find((t) => t.titulo === "Demanda que faltava cadastrar");
      return nova && nova.registros.filter((r) => r.tipo !== "marco").length === 1 && tarefa(d, a.id).registros.length === antesDeMover - 1;
    }, "o registro não foi para a tarefa criada no seletor");

    // ---- menu "Criar" da barra lateral: categoria nova por cima da tela em que se está ----
    await pg.goto(`${B}/pendencias`);
    await pg.locator("[data-slot=criar-outra-coisa]").click();
    await pg.locator("[data-slot=criar-categoria]").click();
    await dialogo().locator("input").first().fill("Criada pelo menu");
    await pg.keyboard.press("Control+Enter");
    await ateOsDados((d) => !!cat(d, "Criada pelo menu"), "a categoria criada pelo menu da barra lateral não foi gravada");
    await dialogo().waitFor({ state: "detached" });
    afirmar(new URL(pg.url()).pathname === "/pendencias", "criar pelo menu tirou o usuário da tela");

    // ---- link novo pelo menu, com categoria e tarefa criadas dentro do próprio formulário ----
    await pg.locator("[data-slot=criar-outra-coisa]").click();
    await pg.locator("[data-slot=criar-link]").click();
    await dialogo().getByPlaceholder(/https/).first().fill("https://exemplo.local/padrao-de-acesso");
    await dialogo().getByRole("combobox", { name: "Vincular à categoria" }).click();
    await pg.keyboard.type("Acessos");
    await pg.locator("[data-slot=criar-categoria]").click();
    await dialogo().getByRole("combobox", { name: "Vincular à categoria" }).filter({ hasText: "Acessos" }).waitFor();
    await dialogo().getByRole("combobox", { name: "Usar nas tarefas" }).click();
    await pg.keyboard.type("Revisar o padrão de acesso");
    await pg.getByRole("option", { name: /Criar .*Revisar o padrão de acesso/ }).click();
    await ateOsDados((d) => d.tarefas.some((t) => t.titulo === "Revisar o padrão de acesso" && t.categoriaId === cat(d, "Acessos")?.id), "a tarefa criada no formulário de link não nasceu na categoria escolhida");
    await pg.keyboard.press("Escape");
    await semBalao();
    await dialogo().getByPlaceholder("Como você vai reconhecer isso depois").fill("Padrão de acesso");
    await pg.keyboard.press("Control+Enter");
    await ateOsDados((d) => {
      const l = d.links.find((x) => x.titulo === "Padrão de acesso");
      const t = d.tarefas.find((x) => x.titulo === "Revisar o padrão de acesso");
      return l && t && l.categoriaId === cat(d, "Acessos").id && (l.tarefaIds || []).join() === t.id;
    }, "o link criado pelo menu não ficou com a categoria e a tarefa criadas no formulário");

    // ---- paleta: criar página e chegar à tela de tags ----
    const nPaginas = (await dados()).paginas.items.length;
    await pg.keyboard.press("Control+k");
    await pg.locator("[data-slot=paleta] input").first().fill("nova pagina");
    await pg.locator('[data-paleta-item="criar:pagina"]').click();
    await pg.waitForURL(/\/paginas(\?|$)/);
    await ateOsDados((d) => d.paginas.items.length === nPaginas + 1, "a paleta não criou a página");
    await pg.keyboard.press("Control+k");
    await pg.locator("[data-slot=paleta] input").first().fill("gerenciar tags");
    await pg.locator('[data-paleta-item="acao:tags"]').click();
    await pg.waitForURL(/\/categorias\?aba=tags/);

    // ---- ações em lote: tag e categoria novas em duas tarefas de uma vez ----
    await pg.goto(`${B}/tarefas`);
    await pg.locator("[data-slot=contador-tarefas]").waitFor();
    await pg.getByRole("radio", { name: "Grade" }).click();
    const itens = pg.locator("[data-slot=selecionavel]");
    await itens.first().waitFor();
    await pg.evaluate(() => document.activeElement?.blur());
    await pg.keyboard.press("j");
    await pg.keyboard.press("x");
    await itens.nth(1).locator("a[href]").first().click({ modifiers: ["Control"] });
    await pg.locator("[data-slot=contagem-lote]", { hasText: "2 tarefas" }).waitFor();
    const ids = await itens.evaluateAll((els) => els.filter((e) => e.dataset.selecionada).map((e) => e.dataset.id));
    await pg.locator("[data-slot=lote-tags]").click();
    await pg.keyboard.type("Esteira");
    await pg.locator("[data-slot=criar-tag]").click();
    await ateOsDados((d) => ids.every((id) => tarefa(d, id).tags.includes("Esteira")), "a tag em lote não foi gravada nas duas tarefas");
    await pg.keyboard.press("Escape");
    await semBalao();
    await pg.locator("[data-slot=lote-categoria]").click();
    await pg.keyboard.type("Lote novo");
    await pg.locator("[data-slot=criar-categoria]").click();
    await ateOsDados((d) => cat(d, "Lote novo") && ids.every((id) => tarefa(d, id).categoriaId === cat(d, "Lote novo").id), "a categoria criada na barra de lote não foi para as duas tarefas");
    await aviso("2 tarefas em Lote novo").waitFor();
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=barra-lote]").waitFor({ state: "detached" });
    // e a categoria também muda pelo botão direito da tarefa
    await itens.filter({ has: pg.locator(`a[href="/tarefas/${ids[0]}"]`) }).first().click({ button: "right" });
    await pg.getByRole("menuitem", { name: "Categoria" }).click();
    await pg.getByRole("menuitemradio", { name: "Criada pelo menu" }).click();
    await ateOsDados((d) => tarefa(d, ids[0]).categoriaId === cat(d, "Criada pelo menu").id, "o submenu Categoria do menu da tarefa não gravou");

    // ---- a tela de tags: parecidas, juntar, desfazer, renomear e tirar de tudo ----
    // a segunda tarefa do lote ganha a mesma tag escrita no plural, pelo campo de tags da própria tarefa
    await pg.goto(`${B}/tarefas/${ids[1]}`);
    await pg.locator("[data-slot=prop-tags] button").first().click();
    await pg.keyboard.type("esteiras,");
    await ateOsDados((d) => tarefa(d, ids[1]).tags.includes("esteiras"), "a tag digitada na tarefa não foi gravada");
    // o campo sugere as tags do app inteiro (a do link entra na lista da tarefa)
    await pg.locator("[data-slot=gerenciar-tags]").click();
    await pg.waitForURL(/\/categorias\?aba=tags/);
    const grupo = pg.locator("[data-slot=tags-parecidas]", { hasText: "esteiras" });
    await grupo.waitFor();
    await grupo.locator("[data-slot=juntar-parecidas]", { hasText: "Esteira" }).click();
    await dialogo().getByRole("button", { name: "Juntar" }).click();
    await ateOsDados((d) => ids.every((id) => tarefa(d, id).tags.includes("Esteira")) && !d.tarefas.some((t) => t.tags.includes("esteiras")), "juntar as tags parecidas não gravou");
    afirmar(tarefa(await dados(), ids[1]).tags.filter((t) => t === "Esteira").length === 1, "juntar deixou a tag repetida no mesmo item");
    await pg.locator("[data-slot=tag-aberta]", { hasText: "Esteira" }).waitFor();
    // desfazer devolve a grafia que cada item tinha
    await aviso("juntada em “Esteira”").waitFor();
    await pg.evaluate(() => document.activeElement?.blur());
    await pg.keyboard.press("Control+z");
    await ateOsDados((d) => tarefa(d, ids[1]).tags.includes("esteiras") && tarefa(d, ids[1]).tags.includes("Esteira"), "Ctrl Z não devolveu a tag que tinha sido juntada");
    // renomear para um nome que já existe avisa que vai juntar
    await pg.locator("[data-slot=tag-do-inventario][data-tag=esteiras]").click();
    await pg.locator("[data-slot=tag-aberta]", { hasText: "esteiras" }).waitFor();
    await pg.locator("[data-slot=nome-da-tag]").fill("esteira");
    await pg.locator("[data-slot=renomear-tag]", { hasText: "Juntar" }).click();
    await dialogo().getByRole("button", { name: "Juntar" }).click();
    await ateOsDados((d) => !d.tarefas.some((t) => t.tags.includes("esteiras")), "renomear para uma tag que já existe não juntou as duas");
    // renomear de verdade: muda em todos os itens de uma vez, e o endereço acompanha
    await pg.locator("[data-slot=tag-aberta]", { hasText: "Esteira" }).waitFor();
    await pg.locator("[data-slot=nome-da-tag]").fill("  esteira de entrega, ");
    await pg.locator("[data-slot=renomear-tag]", { hasText: "Renomear" }).click();
    await ateOsDados((d) => ids.every((id) => tarefa(d, id).tags.includes("esteira de entrega")) && !d.tarefas.some((t) => t.tags.includes("Esteira")), "renomear a tag não gravou em todos os itens");
    await pg.waitForURL(/tag=esteira(%20|\+)de(%20|\+)entrega/);
    afirmar((await pg.locator("[data-slot=itens-da-tag][data-onde=Tarefas] li").count()) === 2, "a tag aberta deveria listar as duas tarefas");
    // tirar de tudo pede confirmação e tem volta pelo aviso
    await pg.locator("[data-slot=tirar-tag]").click();
    await dialogo().getByRole("button", { name: "Tirar a tag" }).click();
    await ateOsDados((d) => !d.tarefas.some((t) => t.tags.includes("esteira de entrega")), "tirar a tag de tudo não gravou");
    await aviso("Tag “esteira de entrega” tirada de 2 itens").getByRole("button", { name: "Desfazer" }).click();
    await ateOsDados((d) => ids.every((id) => tarefa(d, id).tags.includes("esteira de entrega")), "desfazer não devolveu a tag tirada");
    // nada do que não tinha a tag foi tocado: as outras tags continuam onde estavam
    const fim = await dados();
    afirmar(tarefa(fim, a.id).categoriaId === cat(fim, "Fluxo sem sair").id || ids.includes(a.id), "a categoria da primeira tarefa mudou sem ninguém pedir");
  });

  // ---------- 3.17 ----------
  await etapa("3.17: checklist da tarefa, e-mail colado, participante cadastrado, filtro por tag e importar um export", async () => {
    const J = { "Content-Type": "application/json" };
    const tarefa = (d, id) => d.tarefas.find((t) => t.id === id);
    const itens = (d, id) => (tarefa(d, id).checklist || []).map((i) => `${i.feito ? "x" : " "} ${i.texto}`).join("|");
    const aviso = (texto) => pg.locator("[data-sonner-toast]", { hasText: texto }).first();
    const contador = (n) => pg.locator("[data-slot=contador-tarefas]", { hasText: new RegExp(`^${n} de `) }).waitFor();

    // duas tarefas e uma página com tags, criadas pela API para a etapa não depender do que as outras deixaram
    for (const t of [
      { id: "e2e317a", titulo: "Tarefa do checklist 317", tags: ["tag317", "outra317"] },
      { id: "e2e317b", titulo: "Outra com a tag 317", tags: ["TAG317"] },
    ]) {
      afirmar((await pg.request.put(`${B}/api/tarefas/${t.id}`, { headers: J, data: { tarefa: t, revEsperada: null } })).ok(), "não consegui criar a tarefa da etapa");
    }
    const pags = (await dados()).paginas;
    afirmar(
      (await pg.request.put(`${B}/api/paginas`, { headers: J, data: { items: [...pags.items, { id: "pg317", titulo: "Página com a tag 317", texto: "texto", tags: ["tag317"] }], revEsperada: pags.rev } })).ok(),
      "não consegui criar a página da etapa",
    );

    // ---- checklist: Enter adiciona, colar uma lista cria um item por linha, marcar, editar no lugar e tirar com Desfazer ----
    await pg.goto(`${B}/tarefas/e2e317a`);
    await pg.locator("[data-slot=comecar-checklist]").click();
    const novo = pg.locator("[data-slot=novo-item-do-checklist]");
    await novo.fill("Pedir os acessos");
    await novo.press("Enter");
    await ateOsDados((d) => itens(d, "e2e317a") === "  Pedir os acessos", "o primeiro item do checklist não foi gravado");
    await pg.evaluate(() => navigator.clipboard.writeText("- Rodar o scan\n- [x] Agendar a abertura\n\n2. Treinar o squad"));
    await novo.focus();
    await pg.keyboard.press("Control+V");
    await ateOsDados((d) => itens(d, "e2e317a") === "  Pedir os acessos|  Rodar o scan|x Agendar a abertura|  Treinar o squad", "a lista colada não virou um item por linha");
    await pg.getByRole("checkbox", { name: "Marcar como feito: Pedir os acessos" }).click();
    await pg.locator("[data-slot=progresso-do-checklist]", { hasText: "2 de 4" }).waitFor();
    await pg.locator("[data-slot=texto-do-item]", { hasText: "Rodar o scan" }).click();
    await pg.getByLabel("Texto do item").fill("Rodar o primeiro scan");
    await pg.getByLabel("Texto do item").press("Enter");
    await ateOsDados((d) => itens(d, "e2e317a").includes("  Rodar o primeiro scan"), "a edição do item não foi gravada");
    await pg.getByRole("button", { name: "Ações do item: Treinar o squad" }).click();
    await pg.locator("[data-slot=tirar-item]").click();
    await ateOsDados((d) => tarefa(d, "e2e317a").checklist.length === 3, "o item não saiu do checklist");
    await aviso("Item tirado do checklist").getByRole("button", { name: "Desfazer" }).click();
    await ateOsDados((d) => itens(d, "e2e317a") === "x Pedir os acessos|  Rodar o primeiro scan|x Agendar a abertura|  Treinar o squad", "desfazer não devolveu o item");
    afirmar(tarefa(await dados(), "e2e317a").registros.every((r) => r.proximosPassos.length === 0), "item do checklist virou passo");

    // ---- e-mail colado: preenche título, data, hora e participantes; o texto entra sem virar formatação ----
    await pg.locator('[data-slot=registrar][data-tipo=reuniao]').click();
    await dialogo().locator("[data-slot=editor-registro]").waitFor();
    await pg.locator("[data-slot=colar-email-botao]").click();
    await pg.locator("[data-slot=colar-email]").getByLabel("Texto do e-mail").fill(
      "De: Otto Teste <otto.teste@exemplo.local>\nEnviada em: quinta-feira, 19 de novembro de 2026 14:32\nPara: Prado, Zuleica <zuleica.prado@exemplo.local>\nAssunto: RES: Acesso ao repositório 317\n\nOi.\n\n# não é título\n- nem lista\nLiberamos **até sexta**. <script>window.__vazou = 1</script>\n",
    );
    const lido = pg.locator("[data-slot=email-reconhecido]");
    await lido.getByText("Acesso ao repositório 317").waitFor();
    afirmar((await lido.innerText()).includes("19/11/26 14:32"), "a data do e-mail não foi lida");
    afirmar((await lido.innerText()).includes("Otto Teste, Zuleica Prado"), "as pessoas do e-mail não foram lidas (ou “Sobrenome, Nome” não foi desinvertido)");
    await pg.locator("[data-slot=trazer-email]").click();
    await pg.locator("[data-slot=colar-email]").waitFor({ state: "detached" });
    const ed = pg.locator("[data-slot=editor-registro]");
    await ed.locator("[data-slot=campo-chips] [data-slot=chip]", { hasText: "Zuleica Prado" }).waitFor();
    afirmar((await ed.locator("[data-foco-inicial]").inputValue()) === "Acesso ao repositório 317", "o assunto não virou o título");
    const anot = ed.locator("[data-slot=anotacoes] [data-slot=editor-rico-conteudo]");
    await anot.getByText("# não é título").waitFor();
    afirmar((await anot.locator("h1, h2, h3, ul, ol, script").count()) === 0, "o texto do e-mail virou formatação no editor");
    afirmar((await anot.innerText()).includes("<script>window.__vazou = 1</script>"), "a marcação do e-mail não ficou como texto");
    afirmar(!(await pg.evaluate(() => "__vazou" in window)), "script do e-mail foi executado");

    // ---- quem não está no cadastro entra com um clique, sem sair do registro ----
    const semCadastro = ed.locator('[data-slot=cadastrar-participante][data-nome="Zuleica Prado"]');
    await semCadastro.click();
    await ateOsDados((d) => d.pessoas.items.some((p) => p.nome === "Zuleica Prado" && p.origem === "registros"), "a pessoa não foi para o cadastro");
    await semCadastro.waitFor({ state: "detached" });
    await aviso("Zuleica Prado agora está no cadastro de pessoas").waitFor();
    await ed.locator('[data-slot=cadastrar-participante][data-nome="Otto Teste"]').waitFor();
    await dialogo().getByRole("button", { name: "Salvar registro" }).click();
    await pg.locator("[data-slot=editor-registro]").waitFor({ state: "detached" });
    await ateOsDados((d) => {
      const r = tarefa(d, "e2e317a").registros.find((x) => x.titulo === "Acesso ao repositório 317");
      return r && r.tipo === "nota" && r.data === "2026-11-19" && r.hora === "14:32" && r.participantes.join("|") === "Otto Teste|Zuleica Prado" && r.anotacoes.includes("\\# não é título") && r.anotacoes.includes("&lt;script>");
    }, "o registro com o e-mail não foi gravado como esperado");
    afirmar((await pg.locator("[data-slot=timeline] script").count()) === 0, "a linha do tempo desenhou marcação do e-mail");

    // ---- filtro por tag na lista de tarefas: uma tag, duas (precisa ter as duas), tirar pela etiqueta ----
    await pg.goto(`${B}/tarefas?status=todas`);
    await pg.locator("[data-slot=filtro-de-tags]").click();
    await pg.locator("[data-slot=opcao-de-tag]", { hasText: /^tag317/i }).click();
    await contador(2);
    afirmar(new URL(pg.url()).searchParams.getAll("tag").length === 1, "a tag escolhida não foi para o endereço");
    await pg.locator("[data-slot=opcao-de-tag]", { hasText: "outra317" }).click();
    await contador(1);
    await pg.keyboard.press("Escape");
    await pg.locator("[data-slot=filtro-de-tags][data-ativas='2']").waitFor();
    await pg.getByRole("button", { name: "Tirar o filtro tag outra317" }).click();
    await contador(2);
    // da aba Tags, "Ver na lista" abre a lista já filtrada
    await pg.goto(`${B}/categorias?aba=tags&tag=tag317`);
    await pg.locator("[data-slot=ver-na-lista]").first().click();
    await pg.waitForURL(/\/tarefas\?.*tag=tag317/i);
    await contador(2);
    // páginas: /paginas?tag= abre a Lista filtrada, e a tag da linha tira o filtro
    await pg.goto(`${B}/paginas?tag=tag317`);
    await pg.locator("[data-slot=lista-de-paginas] [data-slot=filtro-de-tags][data-ativas='1']").waitFor();
    await pg.waitForFunction(() => document.querySelectorAll("[data-slot=linha-de-pagina]").length === 1);
    afirmar((await pg.locator("[data-slot=linha-de-pagina]").innerText()).includes("Página com a tag 317"), "a lista de páginas não filtrou pela tag");
    await pg.locator("[data-slot=linha-de-pagina] [data-slot=tag][data-ativa]").click();
    await pg.waitForFunction(() => document.querySelectorAll("[data-slot=linha-de-pagina]").length > 1);

    // ---- importar um export: entra o que falta, o diferente fica como está (padrão) e nada é apagado ----
    const antes = await dados();
    const lixoAntes = (await (await pg.request.get(`${B}/api/lixeira`)).json()).itens.length;
    const arquivo = JSON.parse(await (await pg.request.get(`${B}/api/exportar`)).text());
    const doArquivo = arquivo.tarefas.find((t) => t.id === "e2e317a");
    doArquivo.titulo = "Título que veio do arquivo";
    doArquivo.atualizadaEm = "2020-01-01T00:00:00.000Z";
    arquivo.tarefas.push(
      { id: "e2e317novo", titulo: "Só existe no arquivo 317", criadaEm: "2026-11-01T10:00:00.000Z", atualizadaEm: "2026-11-01T10:00:00.000Z" },
      { id: "../fora317", titulo: "Sai da pasta" },
    );
    const entregar = async () => {
      await pg.locator("[data-slot=importar-export]").click();
      await pg.locator("[data-slot=importar-exportacao] input[type=file]").setInputFiles({ name: "nexo-export-317.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(arquivo)) });
    };
    await pg.goto(`${B}/configuracoes`);
    await entregar();
    await pg.locator("[data-slot=previa-importacao][data-entram='1'][data-conflitos='1']").waitFor();
    await pg.locator("[data-slot=previa-importacao]").getByText("ficou de fora").waitFor();
    afirmar(!tarefa(await dados(), "e2e317novo"), "a prévia da importação gravou alguma coisa");
    await pg.locator("[data-slot=confirmar-importacao]").click();
    await pg.locator("[data-slot=importar-exportacao]").waitFor({ state: "detached" });
    await ateOsDados(
      (d) => tarefa(d, "e2e317novo") && tarefa(d, "e2e317a").titulo === "Tarefa do checklist 317" && d.tarefas.length === antes.tarefas.length + 1,
      "importar (manter o daqui) não trouxe a tarefa nova ou mexeu na que já existia",
    );
    // de novo, agora escolhendo ficar com o do arquivo
    await entregar();
    await pg.locator("[data-slot=previa-importacao][data-entram='0'][data-conflitos='1']").waitFor();
    await pg.locator("[data-slot=modo-da-importacao]").getByText("O do arquivo").click();
    await pg.locator("[data-slot=modo-da-importacao] [role=status]", { hasText: "1 item daqui é trocado" }).waitFor();
    await pg.locator("[data-slot=confirmar-importacao]").click();
    await pg.locator("[data-slot=importar-exportacao]").waitFor({ state: "detached" });
    await ateOsDados((d) => tarefa(d, "e2e317a").titulo === "Título que veio do arquivo" && tarefa(d, "e2e317a").checklist.length === 4, "importar (o do arquivo) não trocou a tarefa");
    const fim = await dados();
    afirmar(antes.tarefas.every((t) => tarefa(fim, t.id)), "importar tirou uma tarefa que estava aqui");
    afirmar((await (await pg.request.get(`${B}/api/lixeira`)).json()).itens.length === lixoAntes, "importar mandou alguma coisa para a lixeira");
    const fotos = (await (await pg.request.get(`${B}/api/backup`)).json()).backups.filter((n) => n.startsWith("pre-importacao-"));
    afirmar(fotos.length === 2, "cada importação que grava deveria ter deixado a sua foto");
    // a foto aparece na lista de backups, como "antes de importar"
    await pg.locator("[data-slot=lista-backups]").click();
    await pg.locator("[data-slot=backup]", { hasText: "antes de importar" }).first().waitFor();
  });

  // ---------- 3.18 ----------
  await etapa("3.18: modelo com checklist e tarefa nova a partir de um e-mail", async () => {
    const itens = (t) => (t.checklist || []).map((i) => `${i.feito ? "x" : " "} ${i.texto}`).join("|");
    const colarEmail = async (texto, assunto) => {
      await pg.locator("[data-slot=tarefa-de-email]").click();
      await pg.getByLabel("Texto do e-mail").fill(texto);
      await pg.locator("[data-slot=email-reconhecido]").getByText(assunto).waitFor();
      await pg.locator("[data-slot=trazer-email]", { hasText: "Usar na tarefa" }).click();
      await pg.locator("[data-slot=colar-email]").waitFor({ state: "detached" });
    };

    // ---- o modelo ganha um checklist: um item por linha, sem marca de lista e sem repetir ----
    await pg.goto(`${B}/configuracoes`);
    await pg.locator("[data-slot=novo-modelo]").click();
    const fm = dialogo();
    await fm.getByLabel("Nome do modelo").fill("Modelo 318 com checklist");
    await fm.getByLabel("Título sugerido").fill("Onboarding 318 do squad ...");
    await fm.getByLabel("Passos de sempre").fill("Agendar a abertura 318");
    await fm.getByLabel("Checklist de sempre").fill("- Scan rodando 318\n- Gate configurado 318\n\n- scan RODANDO 318\nSquad treinado 318");
    await fm.locator("[data-slot=salvar-modelo]").click();
    await ateOsDados(
      (d) => (d.modelos.items.find((m) => m.nome === "Modelo 318 com checklist")?.checklist || []).join("|") === "Scan rodando 318|Gate configurado 318|Squad treinado 318",
      "o checklist do modelo não foi gravado como esperado",
    );
    const linha = pg.locator("[data-slot=modelo]", { hasText: "Modelo 318 com checklist" });
    await linha.getByText("checklist de 3 itens").waitFor();

    // ---- tarefa pelo modelo: um item desmarcado fica de fora, e o e-mail colado vira o primeiro registro ----
    await linha.locator("[data-slot=usar-modelo]").click();
    await dialogo().locator("[data-slot=form-tarefa]").waitFor();
    await pg.locator("[data-slot=checklist-do-modelo] label", { hasText: "Gate configurado 318" }).click();
    await colarEmail("De: Otto Teste <otto.teste@exemplo.local>\nEnviada em: 18/11/2026 09:15\nPara: Zuleica Prado\nAssunto: ENC: Pedido 318 de onboarding\n\nPrecisamos entrar na Ferramenta X.", "Pedido 318 de onboarding");
    await pg.locator("[data-slot=email-da-tarefa]", { hasText: "E-mail de Otto Teste, 18/11/26 09:15" }).waitFor();
    const titulo = pg.getByLabel("Título da tarefa");
    afirmar((await titulo.inputValue()) === "Onboarding 318 do squad ...", "o assunto do e-mail passou por cima do título que o modelo já tinha posto");
    await titulo.fill("Onboarding 318 do squad Cartões");
    await titulo.press("Enter");
    await pg.waitForURL(/\/tarefas\/t[a-z0-9]+$/);
    await ateOsDados((d) => {
      const t = d.tarefas.find((x) => x.titulo === "Onboarding 318 do squad Cartões");
      const doEmail = t?.registros.find((r) => r.titulo === "Pedido 318 de onboarding");
      return (
        !!doEmail && itens(t) === "  Scan rodando 318|  Squad treinado 318" &&
        doEmail.tipo === "nota" && doEmail.data === "2026-11-18" && doEmail.hora === "09:15" && doEmail.participantes.join("|") === "Otto Teste|Zuleica Prado" &&
        doEmail.anotacoes.includes("Precisamos entrar na Ferramenta X.") &&
        t.registros.some((r) => r.proximosPassos.some((p) => p.texto === "Agendar a abertura 318")) &&
        t.registros.some((r) => r.tipo === "marco" && r.titulo === "Tarefa criada")
      );
    }, "a tarefa do modelo não nasceu com o checklist escolhido, os passos e o e-mail como registro");
    await pg.locator("[data-slot=progresso-do-checklist]", { hasText: "0 de 2" }).waitFor();

    // ---- sem modelo: o assunto do e-mail vira o título, e dá para desistir do e-mail antes de salvar ----
    await pg.goto(B + "/tarefas");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    await pg.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await pg.keyboard.press("n");
    await dialogo().locator("[data-slot=form-tarefa]").waitFor();
    const email = "De: Otto Teste <otto.teste@exemplo.local>\nEnviada em: 18/11/2026 09:15\nAssunto: RES: Demanda 318 que chegou por e-mail\n\nSegue o pedido.";
    await colarEmail(email, "Demanda 318 que chegou por e-mail");
    afirmar((await titulo.inputValue()) === "Demanda 318 que chegou por e-mail", "o assunto do e-mail não virou o título da tarefa");
    await pg.getByRole("button", { name: "Não usar este e-mail" }).click();
    await pg.locator("[data-slot=email-da-tarefa]").waitFor({ state: "detached" });
    await colarEmail(email, "Demanda 318 que chegou por e-mail");
    await titulo.press("Enter");
    await pg.waitForURL(/\/tarefas\/t[a-z0-9]+$/);
    await ateOsDados((d) => {
      const t = d.tarefas.find((x) => x.titulo === "Demanda 318 que chegou por e-mail");
      return !!t && itens(t) === "" && t.registros.filter((r) => r.tipo === "nota" && r.data === "2026-11-18" && r.participantes.join("|") === "Otto Teste").length === 1;
    }, "a tarefa criada só do e-mail não ficou como esperado");
  });

  await etapa("3.19: passos sem repetição (juntar, desfazer, separar, prevenção) e cobrança por pessoa", async () => {
    const J = { "Content-Type": "application/json" };
    const ID = "e2e319a";
    const aviso = (texto) => pg.locator("[data-sonner-toast]", { hasText: texto }).first();
    const tarefa = (d) => d.tarefas.find((t) => t.id === ID);
    const abertos = (d) => tarefa(d).registros.flatMap((r) => r.proximosPassos.filter((p) => !p.feito).map((p) => p.id)).sort().join(",");
    const juntados = (d) => tarefa(d).registros.flatMap((r) => (r.passosJuntados || []).map((p) => p.id)).sort().join(",");
    const passo = (id, texto, extra = {}) => ({ id, texto, feito: false, ...extra });

    // a folha organizada e a reunião do mesmo dia trouxeram os mesmos três passos (o defeito que a versão corrige)
    const nova = {
      id: ID, titulo: "Tarefa dos passos 319", status: "em_andamento",
      registros: [
        { id: "r319n", tipo: "nota", data: "2026-11-10", titulo: "Folha 319", proximosPassos: [passo("n1", "Validar o layout 319"), passo("n2", "Enviar a planilha 319", { responsavel: "Zuleica Prado" }), passo("n3", "Agendar a revisão 319")] },
        { id: "r319r", tipo: "reuniao", data: "2026-11-10", titulo: "Reunião 319", proximosPassos: [
          passo("m1", "Validar o layout 319."), passo("m2", "enviar a planilha 319", { responsavel: "Zuleica Prado" }), passo("m3", "Agendar a revisão 319"),
          passo("m4", "Agendar a revisão 319 com o time todo"),
        ] },
      ],
    };
    afirmar((await pg.request.put(`${B}/api/tarefas/${ID}`, { headers: J, data: { tarefa: nova, revEsperada: null } })).ok(), "não consegui criar a tarefa da etapa");

    // ---- o painel Pendências avisa, e a janela mostra os pares antes de juntar ----
    await pg.goto(`${B}/tarefas/${ID}`);
    const painel = pg.locator("[data-slot=aviso-repetidos]").first();
    await painel.getByText("3 passos repetidos e 1 par parecido").waitFor();
    await painel.locator("[data-slot=abrir-juntar]").click();
    const janela = dialogo();
    await janela.locator("[data-slot=juntar-passos]").waitFor();
    afirmar((await janela.locator("[data-slot=grupo-repetido]").count()) === 3, "a janela não listou os três passos repetidos");
    afirmar((await janela.locator("[data-slot=par-parecido]").count()) === 1, "a janela não mostrou o par parecido");
    // texto contido em outro nunca junta sozinho: "São diferentes" tira o par da lista e fica lembrado
    await janela.locator("[data-slot=sao-diferentes]").click();
    await janela.locator("[data-slot=par-parecido]").waitFor({ state: "detached" });
    afirmar(abertos(await dados()) === "m1,m2,m3,m4,n1,n2,n3", "dizer que são diferentes mexeu nos dados");
    await janela.locator("[data-slot=juntar-repetidos]").click();
    await ateOsDados((d) => abertos(d) === "m1,m2,m3,m4" && juntados(d) === "n1,n2,n3", "os repetidos não foram juntados (fica o da reunião, sai o da folha)");
    await pg.locator("[data-slot=juntar-passos]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=aviso-repetidos]").waitFor({ state: "detached" });
    const guardado = tarefa(await dados()).registros.find((r) => r.id === "r319n").passosJuntados.find((p) => p.id === "n2");
    afirmar(guardado.juntadoCom.registroId === "r319r" && guardado.juntadoCom.passoId === "m2" && !!guardado.juntadoEm && guardado.responsavel === "Zuleica Prado", "a cópia juntada não guardou com quem nem quando");

    // ---- juntar tem Desfazer, e depois de desfazer o aviso volta (sem o par dispensado) ----
    await aviso("3 passos repetidos juntados").getByRole("button", { name: "Desfazer" }).click();
    await ateOsDados((d) => abertos(d) === "m1,m2,m3,m4,n1,n2,n3" && juntados(d) === "", "desfazer não devolveu os passos");
    await pg.locator("[data-slot=aviso-repetidos]").first().getByText(/^3 passos repetidos$/).waitFor();
    await pg.locator("[data-slot=abrir-juntar]").first().click();
    await dialogo().locator("[data-slot=juntar-repetidos]").click();
    await ateOsDados((d) => abertos(d) === "m1,m2,m3,m4" && juntados(d) === "n1,n2,n3", "juntar de novo não funcionou");

    // ---- a linha do tempo mostra o que foi juntado, e Separar devolve o passo ----
    const folha = pg.locator("[data-slot=registro]", { hasText: "Folha 319" });
    await folha.locator("[data-slot=registro-juntados] button", { hasText: "3 passos juntados com outros iguais" }).click();
    afirmar((await folha.locator("[data-slot=passo-juntado]").count()) === 3, "a linha do tempo não listou os três passos juntados");
    await folha.locator("[data-slot=passo-juntado]", { hasText: "Enviar a planilha 319" }).locator("[data-slot=separar-passo]").click();
    await ateOsDados((d) => abertos(d) === "m1,m2,m3,m4,n2" && juntados(d) === "n1,n3", "separar não devolveu o passo para as pendências");
    const voltou = tarefa(await dados()).registros.find((r) => r.id === "r319n").proximosPassos.find((p) => p.id === "n2");
    afirmar(voltou && !("juntadoEm" in voltou) && voltou.responsavel === "Zuleica Prado", "o passo separado não voltou como era");
    await pg.locator("[data-slot=aviso-repetidos]").first().getByText(/^1 passo repetido$/).waitFor();
    await pg.locator("[data-slot=abrir-juntar]").first().click();
    await dialogo().locator("[data-slot=juntar-repetidos]").click();
    await ateOsDados((d) => abertos(d) === "m1,m2,m3,m4", "o passo separado não foi juntado de novo");

    // ---- prevenção no registro: a resposta do Copilot traz um passo que já está em aberto ----
    await pg.locator("[data-slot=registrar][data-tipo=atividade]").click();
    const d = dialogo();
    await d.locator("[data-slot=editor-registro]").waitFor();
    await d.getByPlaceholder("Resumo em uma linha").fill("Atividade 319");
    await d.getByPlaceholder("Cole a resposta aqui...").fill("## RESUMO\nAndou.\n## PRÓXIMOS PASSOS\n- validar o layout 319\n- Passo inédito 319\n## PASSOS CONCLUÍDOS\nNenhum\n");
    await d.getByRole("button", { name: "Preencher campos com a resposta" }).click();
    await d.locator("[data-slot=passos-ja-abertos]").getByText("1 passo da resposta já está em aberto nesta tarefa e não foi criado de novo.").waitFor();
    const acoes = () => d.locator('[data-slot=editor-passo] input[aria-label="Ação"]').evaluateAll((els) => els.map((e) => e.value).join("|"));
    afirmar((await acoes()) === "Passo inédito 319", "o passo que já estava em aberto entrou de novo no registro: " + (await acoes()));
    // dá para incluir mesmo assim (e tirar de novo)
    await d.locator("[data-slot=passos-ja-abertos]").getByRole("button", { name: "Incluir mesmo assim" }).click();
    await d.locator("[data-slot=passos-ja-abertos]").waitFor({ state: "detached" });
    afirmar((await acoes()) === "Passo inédito 319|validar o layout 319", "incluir mesmo assim não trouxe o passo: " + (await acoes()));
    await d.locator("[data-slot=editor-passo]").nth(1).getByRole("button", { name: "Remover passo" }).click();
    await d.locator("[data-slot=editor-passo]").nth(1).waitFor({ state: "detached" });
    await d.getByRole("button", { name: "Salvar registro" }).click();
    await dialogo().waitFor({ state: "detached" }).catch(() => {});
    await ateOsDados((x) => {
      const reg = tarefa(x).registros.find((r) => r.titulo === "Atividade 319");
      return !!reg && reg.proximosPassos.map((p) => p.texto).join("|") === "Passo inédito 319";
    }, "o registro da atividade não ficou só com o passo novo");
    afirmar((await pg.locator("[data-slot=aviso-repetidos]").count()) === 0, "o registro novo criou um passo repetido");

    // ---- prevenção no modo reunião: o passo que já está em aberto é avisado e não é criado de novo ----
    await pg.goto(`${B}/tarefas/${ID}/reuniao`);
    await pg.locator("[data-slot=reuniao]").waitFor();
    const novoPasso = pg.locator("[data-slot=novo-passo]");
    await novoPasso.fill("Validar o layout 319");
    await novoPasso.press("Enter");
    await novoPasso.fill("Passo da reunião 319");
    await novoPasso.press("Enter");
    await novoPasso.fill("agendar a revisão 319");
    await novoPasso.press("Enter");
    afirmar((await pg.locator("[data-slot=passo-capturado]").count()) === 3, "os passos da reunião não foram capturados");
    afirmar((await pg.locator("[data-slot=passo-ja-aberto]").count()) === 2, "a reunião não avisou dos passos que já estão em aberto");
    // um deles o usuário quer mesmo de novo
    await pg.locator("[data-slot=passo-capturado]", { hasText: "agendar a revisão 319" }).getByRole("button", { name: "Criar mesmo assim" }).click();
    await pg.locator("[data-slot=passo-capturado]", { hasText: "agendar a revisão 319" }).locator("[data-slot=passo-ja-aberto]").waitFor({ state: "detached" });
    await pg.locator("[data-slot=encerrar-reuniao]").click();
    await pg.locator("[data-slot=ata]").waitFor();
    await aviso("1 passo já estava em aberto na tarefa e não foi repetido").waitFor();
    const reuniao = tarefa(await dados()).registros.at(-1);
    afirmar(
      reuniao.tipo === "reuniao" && reuniao.proximosPassos.map((p) => p.texto).join("|") === "Passo da reunião 319|agendar a revisão 319",
      "a reunião gravou o passo que já estava em aberto: " + reuniao.proximosPassos.map((p) => p.texto).join("|"),
    );
    // o que foi pedido de novo virou repetido de verdade: limpa pela tela de Pendências, no cabeçalho da tarefa
    await pg.goto(B + "/pendencias");
    await pg.getByRole("radio", { name: "Por tarefa" }).click();
    const grupo = pg.locator("[data-slot=grupo-pendencias]", { hasText: "Tarefa dos passos 319" });
    await grupo.locator("[data-slot=aviso-repetidos]", { hasText: "1 repetido" }).click();
    await dialogo().locator("[data-slot=juntar-repetidos]").click();
    await ateOsDados((x) => tarefa(x).registros.at(-1).proximosPassos.map((p) => p.texto).join("|") === "Passo da reunião 319", "juntar pelo cabeçalho do grupo não funcionou");
    await grupo.locator("[data-slot=aviso-repetidos]").waitFor({ state: "detached" });

    // ---- cobrança em lote: por pessoa, cada grupo tem a mensagem pronta ----
    await pg.getByRole("radio", { name: "Por pessoa" }).click();
    await pg.locator("[data-slot=lista-pendencias][data-agrupamento=pessoa]").waitFor();
    const daZuleica = pg.locator("[data-slot=grupo-pendencias]", { hasText: "Zuleica Prado" });
    await daZuleica.locator("[data-slot=copiar-mensagem]").click();
    await aviso("Mensagem para Zuleica Prado copiada").waitFor();
    const msg = (await pg.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
    afirmar(msg.startsWith("Pendências com Zuleica Prado:\n- "), "a mensagem de cobrança não começa pelo nome: " + msg);
    afirmar(/- enviar a planilha 319 \(Tarefa dos passos 319, desde [^)]+\)/.test(msg), "a mensagem não trouxe o passo com a tarefa e a data: " + msg);
    if (await pg.locator("[data-slot=copiar-todas]").count()) {
      await pg.locator("[data-slot=copiar-todas]").click();
      await aviso("mensagens copiadas").waitFor();
      const todas = (await pg.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
      afirmar(todas.includes("Pendências com Zuleica Prado:") && todas.split("Pendências com ").length > 2 && todas.includes("\n\nPendências com "), "copiar todas não juntou uma mensagem por pessoa");
    }
    await pg.getByRole("radio", { name: "Por tarefa" }).click();
    await pg.locator("[data-slot=lista-pendencias][data-agrupamento=tarefa]").waitFor();
  });

  await etapa("3.20: perfis de uso (trocar, lembrar, redefinir, salvar, código, tecla P, paleta e tela inicial)", async () => {
    const perfis = () => pg.evaluate(() => JSON.parse(localStorage.getItem("nexo:perfis")));
    const pref = (chave) => pg.evaluate((k) => JSON.parse(localStorage.getItem("nexo:" + k)), chave);
    const seletor = (id) => pg.locator(`[data-slot=seletor-perfil][data-perfil${id ? `=${id}` : ""}]`);
    const nav = (nome) => pg.locator("[data-slot=lateral] [data-slot=nav-item]", { hasText: new RegExp("^" + nome) });
    const menu = pg.locator("[data-slot=menu-perfis]");
    const painel = pg.locator("[data-slot=personalizar]");
    const lateralEstreita = (estreita) => pg.waitForFunction((e) => (document.querySelector("[data-slot=lateral]").getBoundingClientRect().width < 100) === e, estreita);
    const pelaTecla = async (numero) => {
      await pg.locator("body").click({ position: { x: 700, y: 5 } }).catch(() => {});
      await pg.evaluate(() => document.activeElement?.blur());
      await pg.keyboard.press("p");
      await menu.waitFor();
      await pg.keyboard.press(String(numero));
      await menu.waitFor({ state: "detached" });
    };

    await pg.goto(B + "/");
    await pg.locator("[data-slot=hoje]").waitFor();
    // as etapas anteriores voltaram tudo ao padrão: o perfil em uso é o Completo, sem mudanças
    await seletor("completo").waitFor();
    afirmar((await perfis()).ativo === "completo" && (await perfis()).proprios.length === 0, "o app não começou no perfil Completo");

    // ---- o menu mostra os cinco prontos; Gestão troca o menu, as barras, a tela Hoje e as visões ----
    await seletor().click();
    await menu.waitFor();
    afirmar((await menu.locator("[data-slot=opcao-perfil]").count()) === 5, "o menu não mostrou os cinco perfis prontos");
    afirmar((await menu.locator("[data-slot=perfil-redefinir]").getAttribute("data-disabled")) !== null, "Redefinir devia estar desligado num perfil sem mudanças");
    await menu.locator("[data-slot=opcao-perfil][data-perfil=gestao]").click();
    await seletor("gestao").waitFor();
    await nav("Radar").waitFor();
    await nav("Relatórios").waitFor();
    await nav("Notas").waitFor({ state: "detached" });
    await nav("Acompanhar").waitFor({ state: "detached" });
    await pg.locator("[data-slot=hoje] [data-bloco=captura]").waitFor({ state: "detached" });
    afirmar((await pref("visaoTarefas")) === "quadro" && (await pref("agrupamentoPendencias")) === "pessoa" && (await pref("telaInicial")) === "/radar", "o perfil Gestão não ajustou as visões e a tela inicial");
    afirmar(Object.keys((await perfis()).memoria).join() === "completo", "sair do Completo não guardou como ele estava");

    // ---- mexer no perfil pelo painel: a faixa diz de quem é a mudança e o seletor marca que foi mexido ----
    await seletor().click();
    await menu.locator("[data-slot=perfil-gerenciar]").click();
    await painel.locator("[data-slot=aba-perfis]").waitFor();
    afirmar((await painel.locator("[data-slot=cartao-perfil]").count()) === 5, "a aba Perfis não mostrou os cinco cartões");
    await painel.locator("[data-slot=cartao-perfil][data-perfil=gestao][data-em-uso]").waitFor();
    afirmar((await painel.locator("[data-slot=miniatura-perfil]").count()) === 5, "faltou a miniatura de algum perfil");
    await painel.getByRole("radio", { name: "Lateral" }).click();
    await painel.locator("[data-slot=faixa-do-perfil]", { hasText: "Gestão" }).waitFor();
    await painel.getByRole("switch", { name: "Mostrar Diário" }).click();
    await nav("Diário").waitFor({ state: "detached" });
    await pg.locator("[data-slot=seletor-perfil][data-perfil=gestao][data-modificado]").waitFor();

    // ---- trocar para o Foco pelo cartão: barra lateral recolhida e sem barra de status ----
    await painel.getByRole("radio", { name: "Perfis" }).click();
    await painel.locator("[data-slot=cartao-perfil][data-perfil=foco] [data-slot=usar-perfil]").click();
    await seletor("foco").waitFor();
    await lateralEstreita(true);
    await pg.locator("[data-slot=barra-status]").waitFor({ state: "detached" });
    afirmar((await pref("soMeus")) === true && (await pref("visaoTarefas")) === "lista", "o perfil Foco não ajustou as visões");
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });

    // ---- tecla P e o número: volta para Gestão, que lembra como foi deixada (sem o Diário) ----
    await pelaTecla(4);
    await seletor("gestao").waitFor();
    await lateralEstreita(false);
    await nav("Radar").waitFor();
    afirmar((await nav("Diário").count()) === 0, "o perfil Gestão não lembrou como foi deixado");
    await pg.locator("[data-slot=seletor-perfil][data-perfil=gestao][data-modificado]").waitFor();

    // ---- redefinir volta ao original, e tem Desfazer ----
    await seletor().click();
    await menu.locator("[data-slot=perfil-redefinir]").click();
    await nav("Diário").waitFor();
    await pg.locator("[data-slot=seletor-perfil][data-perfil=gestao]:not([data-modificado])").waitFor();
    await pg.locator("[data-sonner-toast]", { hasText: "Perfil Gestão redefinido" }).getByRole("button", { name: "Desfazer" }).click();
    await nav("Diário").waitFor({ state: "detached" });

    // ---- salvar o arranjo de agora como perfil próprio: ele passa a ser o perfil em uso, e Gestão volta a ser como era ----
    await seletor().click();
    await menu.locator("[data-slot=perfil-salvar-como]").click();
    await dialogo().getByLabel("Nome do perfil").fill("  Perfil 320  ");
    await dialogo().locator("[data-slot=confirmar-nome-do-perfil]").click();
    await pg.locator("[data-slot=seletor-perfil]:not([data-modificado])", { hasText: "Perfil 320" }).waitFor();
    const comProprio = await perfis();
    afirmar(comProprio.proprios.length === 1 && comProprio.proprios[0].nome === "Perfil 320" && comProprio.proprios[0].base === "gestao" && comProprio.ativo === comProprio.proprios[0].id, "o perfil próprio não foi salvo como esperado");
    afirmar(comProprio.proprios[0].arranjo.moldura.ocultos.includes("/diario") && !("largura" in comProprio.proprios[0].arranjo.moldura) && !("nome" in comProprio.proprios[0].arranjo.hoje), "o arranjo salvo não é o de agora (ou levou a largura ou o nome)");
    afirmar(!("gestao" in comProprio.memoria), "as mudanças que viraram o perfil novo ficaram também na memória do Gestão");

    // ---- código de um perfil: copiar e colar acrescenta um perfil à lista, sem trocar o que está em uso ----
    await seletor().click();
    await menu.locator("[data-slot=perfil-gerenciar]").click();
    const cartaoProprio = painel.locator("[data-slot=cartao-perfil]", { hasText: "Perfil 320" }).first();
    await cartaoProprio.locator("[data-slot=menu-do-perfil]").click();
    await pg.locator("[data-slot=copiar-codigo-do-perfil]").click();
    await pg.waitForFunction(async () => (await navigator.clipboard.readText()).includes('"nexo":"perfil"'));
    const codigo = await pg.evaluate(() => navigator.clipboard.readText());
    afirmar(codigo.length < 3000 && !codigo.includes('"tema"') && !codigo.includes('"largura"'), "o código do perfil leva o que não devia: " + codigo.slice(0, 200));
    await painel.locator("[data-slot=colar-codigo-do-perfil]").click();
    const campo = pg.getByRole("textbox", { name: "Código do perfil" });
    await campo.fill("isto não é um código");
    await pg.locator("[data-slot=aplicar-codigo-do-perfil]").click();
    await pg.getByRole("alert").filter({ hasText: "código de perfil" }).waitFor();
    await campo.fill("segue o perfil: " + codigo);
    await pg.locator("[data-slot=aplicar-codigo-do-perfil]").click();
    await painel.locator("[data-slot=cartao-perfil]", { hasText: "Perfil 320 (2)" }).waitFor();
    const comDois = await perfis();
    afirmar(comDois.proprios.length === 2 && comDois.ativo === comProprio.ativo, "colar um código trocou o perfil em uso (ou não acrescentou o perfil)");

    // ---- excluir um perfil próprio tem Desfazer; excluir o que está em uso leva para o pronto de origem ----
    await painel.locator("[data-slot=cartao-perfil]", { hasText: "Perfil 320 (2)" }).locator("[data-slot=menu-do-perfil]").click();
    await pg.locator("[data-slot=excluir-perfil]").click();
    await pg.waitForFunction(() => JSON.parse(localStorage.getItem("nexo:perfis")).proprios.length === 1);
    await pg.locator("[data-sonner-toast]", { hasText: "Perfil “Perfil 320 (2)” excluído" }).getByRole("button", { name: "Desfazer" }).click();
    await pg.waitForFunction(() => JSON.parse(localStorage.getItem("nexo:perfis")).proprios.length === 2);
    await painel.locator("[data-slot=cartao-perfil][data-em-uso]").locator("[data-slot=menu-do-perfil]").click();
    await pg.locator("[data-slot=excluir-perfil]").click();
    await seletor("gestao").waitFor();
    await nav("Diário").waitFor();
    await painel.getByRole("button", { name: "Pronto" }).click();
    await painel.waitFor({ state: "detached" });

    // ---- a tela inicial do perfil vale ao abrir o app; clicar em Hoje continua indo para Hoje ----
    await pg.evaluate(() => sessionStorage.removeItem("nexo:sessao"));
    await pg.goto(B + "/");
    await pg.waitForURL(/\/radar$/);
    await nav("Hoje").click();
    await pg.waitForURL(B + "/");
    await pg.locator("[data-slot=hoje]").waitFor();
    // quem abre um endereço direto fica onde pediu
    await pg.evaluate(() => sessionStorage.removeItem("nexo:sessao"));
    await pg.goto(B + "/tarefas");
    await pg.locator("[data-slot=pagina]").first().waitFor();
    afirmar(new URL(pg.url()).pathname === "/tarefas", "a tela inicial do perfil passou por cima de um endereço direto");

    // ---- paleta: "Perfil: Completo" ----
    await pg.keyboard.press("Control+k");
    await pg.locator("[data-slot=paleta] input").first().fill("perfil completo");
    await pg.locator('[data-paleta-item="perfil:completo"]').click();
    await seletor("completo").waitFor();
    await nav("Acompanhar").waitFor();
    await nav("Notas").waitFor();

    // ---- a escolha vale depois de recarregar; e o seletor escondido não tira a tecla P (ela abre a aba Perfis) ----
    await pelaTecla(3);
    await seletor("reunioes").waitFor();
    await pg.reload();
    await seletor("reunioes").waitFor();
    afirmar((await pref("agrupamentoPendencias")) === "pessoa", "o perfil Reuniões não ficou depois de recarregar");
    await pelaTecla(1);
    await seletor("completo").waitFor();

    // deixa tudo como veio para as próximas etapas: sem perfis próprios, sem memórias e com as visões padrão
    await pg.evaluate(() => {
      localStorage.setItem("nexo:perfis", JSON.stringify({ v: 1, ativo: "completo", proprios: [], memoria: {} }));
      for (const k of ["visaoTarefas", "agrupamentoPendencias", "soMeus", "telaInicial", "moldura", "telaHoje", "lateralRecolhida"]) localStorage.removeItem("nexo:" + k);
    });
    await pg.reload();
    await pg.locator("[data-slot=seletor-perfil][data-perfil=completo]:not([data-modificado])").waitFor();
  });

  await etapa("3.21: próxima ação (reunião de agora, passo do foco, Agora não) e reuniões de hoje com pauta e modo reunião", async () => {
    // Um navegador à parte, com o relógio na mão (como a etapa da rotina): o dia é uma terça a sexta da semana
    // que vem, às 10:00, para a reunião das 09:30 estar acontecendo de forma determinística.
    const J = { "Content-Type": "application/json" };
    const p2 = (n) => String(n).padStart(2, "0");
    const base = new Date();
    base.setDate(base.getDate() + 7);
    while (base.getDay() < 2 || base.getDay() > 5 || base.getDate() === 1) base.setDate(base.getDate() + 1);
    const dia = `${base.getFullYear()}-${p2(base.getMonth() + 1)}-${p2(base.getDate())}`;
    const as = (h, m) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d; };
    const ID = "e2e321a";

    // a tarefa em foco naquele dia, com um passo do usuário, e a rotina do dia com duas reuniões
    const tarefa = {
      id: ID, titulo: "Tarefa da próxima ação 321", status: "em_andamento", prioridade: 6, focoEm: dia,
      registros: [{ id: "r321", tipo: "nota", data: dia, titulo: "Combinado", proximosPassos: [{ id: "p321", texto: "Passo 321 do foco", feito: false }] }],
    };
    afirmar((await pg.request.put(`${B}/api/tarefas/${ID}`, { headers: J, data: { tarefa, revEsperada: null } })).ok(), "não consegui criar a tarefa da etapa");
    const jornada = (await dados()).jornada;
    const blocos = [
      { id: "bl321r", tipo: "atividade", titulo: "Reunião 321", inicio: "09:30", fim: "10:30", reuniao: { participantes: ["Otto Teste", "Zuleica Prado"], tarefaId: ID } },
      { id: "bl321c", tipo: "atividade", titulo: "Café 321", inicio: "15:00", fim: "15:30", reuniao: { participantes: [] } },
    ];
    const itens = [...jornada.items.filter((x) => x.id !== dia), { id: dia, tipo: "dia", data: dia, planejado: true, blocos }];
    afirmar((await pg.request.put(`${B}/api/jornada`, { headers: J, data: { items: itens, revEsperada: jornada.rev } })).ok(), "não consegui montar a rotina da etapa");
    const gravado = (await dados()).jornada.items.find((x) => x.id === dia).blocos;
    afirmar(gravado[0].reuniao.tarefaId === ID && gravado[0].reuniao.participantes.join("|") === "Otto Teste|Zuleica Prado" && gravado[1].reuniao.tarefaId === null, "a reunião do bloco não foi gravada como campo do bloco");

    const ctxP = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", permissions: ["clipboard-read", "clipboard-write"] });
    await ctxP.addInitScript((v) => {
      try {
        localStorage.setItem("nexo:rotina", v);
        localStorage.setItem("nexo:novidadesVistas", JSON.stringify("99.0"));
      } catch {}
    }, ROTINA_DESLIGADA);
    const p = await ctxP.newPage();
    p.setDefaultTimeout(T);
    const errosP = [];
    p.on("pageerror", (e) => errosP.push(String(e)));
    const proxima = p.locator("[data-slot=proxima-acao]");
    const titulo = () => p.locator("[data-slot=proxima-acao-titulo]").innerText();
    try {
      const em = (trecho) => { passoAtual = "3.21: " + trecho; };
      em("abrir a tela Hoje com o relógio fixo");
      await p.clock.setFixedTime(as(10, 0));
      await p.goto(B + "/");
      await p.locator("[data-slot=hoje]").waitFor();
      // Navegador novo: o aviso "O Nexo chegou à versão..." apareceria por 15 segundos por cima dos outros avisos
      // (e do Desfazer que esta etapa clica). O app marca a versão como vista na primeira abertura; recarregar tira o aviso.
      await p.waitForFunction(() => !(localStorage.getItem("nexo:novidadesVistas") || "99.0").includes("99.0"));
      await p.reload();
      await p.locator("[data-slot=hoje]").waitFor();

      // ---- 1. a reunião que está acontecendo vem antes de tudo ----
      em("reunião em andamento como próxima ação");
      await p.locator("[data-slot=proxima-acao][data-tipo=reuniao_agora]").waitFor();
      afirmar((await titulo()) === "Reunião: Reunião 321", "a próxima ação não é a reunião em andamento: " + (await titulo()));
      afirmar((await p.locator("[data-slot=proxima-acao-motivo]").innerText()).includes("Começou às 09:30 e vai até as 10:30, com Otto Teste e Zuleica Prado"), "o motivo da próxima ação não diz quando e com quem");
      afirmar((await p.locator("[data-slot=proxima-acao-botao]").innerText()) === "Entrar no modo reunião", "o botão da reunião em andamento não é o de entrar");
      // o bloco fica no topo da tela, antes da captura
      const ordem = await p.evaluate(() => [...document.querySelectorAll("[data-slot=hoje] [data-bloco]")].map((e) => e.dataset.bloco));
      afirmar(ordem[0] === "proxima" && ordem.includes("reunioes"), "a próxima ação não é o primeiro bloco da tela Hoje (ou faltaram as reuniões): " + ordem.join(","));

      // ---- reuniões de hoje: as duas, a pauta da que tem tarefa e o aviso da que não tem ----
      em("reuniões de hoje e pauta");
      const reunioes = p.locator("[data-bloco=reunioes] [data-slot=reuniao-de-hoje]");
      afirmar((await reunioes.count()) === 2, "o bloco Reuniões de hoje não mostrou as duas reuniões");
      afirmar((await reunioes.nth(0).getAttribute("data-momento")) === "agora" && (await reunioes.nth(1).getAttribute("data-momento")) === "depois", "o momento de cada reunião veio errado");
      afirmar((await reunioes.nth(1).innerText()).includes("Sem tarefa"), "a reunião sem tarefa não avisou que falta ligar uma");
      await reunioes.nth(0).locator("[data-slot=pauta-da-reuniao]").click();
      const pauta = p.locator("[data-slot=texto-da-pauta]");
      await pauta.getByText("Pauta: Tarefa da próxima ação 321").waitFor();
      afirmar((await pauta.innerText()).includes("- Passo 321 do foco"), "a pauta não trouxe o passo em aberto da tarefa");
      await p.locator("[data-slot=copiar-pauta]").click();
      await p.waitForFunction(async () => (await navigator.clipboard.readText()).startsWith("Pauta: Tarefa da próxima ação 321"));
      await p.keyboard.press("Escape");
      await pauta.waitFor({ state: "detached" });

      // ---- o balão do Foco usa a mesma conta ----
      em("balão do Foco");
      await p.locator("[data-slot=ferramenta-foco]").click();
      await p.locator("[data-slot=foco-proxima-acao]", { hasText: "Reunião: Reunião 321" }).waitFor();
      await p.keyboard.press("Escape");

      // ---- entrar no modo reunião: o título e os participantes do bloco já vêm, sem criar rascunho antes da hora ----
      em("modo reunião pelo bloco");
      await p.locator("[data-slot=proxima-acao-botao]").click();
      await p.waitForURL(/\/tarefas\/e2e321a\/reuniao\?bloco=bl321r$/);
      await p.locator("[data-slot=reuniao]").waitFor();
      await p.waitForFunction(() => document.querySelector('[aria-label="Título da reunião"]')?.value === "Reunião 321");
      await p.locator("[data-slot=reuniao]").getByText("Otto Teste").first().waitFor();
      await p.locator("[data-slot=reuniao]").getByText("Zuleica Prado").first().waitFor();
      await p.waitForTimeout(400);
      afirmar((await p.evaluate((id) => localStorage.getItem("nexo:reuniao:" + id), ID)) === null, "abrir a reunião pelo bloco criou um rascunho antes de qualquer coisa ser escrita");
      // escrever qualquer coisa já guarda, com o que veio do bloco
      await p.locator("[data-slot=novo-passo]").fill("Passo anotado na reunião 321");
      await p.locator("[data-slot=novo-passo]").press("Enter");
      await p.waitForFunction((id) => (localStorage.getItem("nexo:reuniao:" + id) || "").includes("Otto Teste"), ID);
      await p.evaluate((id) => localStorage.removeItem("nexo:reuniao:" + id), ID);

      // ---- "Agora não" dispensa a sugestão por hoje; o passo do foco tem o botão de concluir, com Desfazer ----
      em("Agora não até o passo do foco");
      await p.goto(B + "/");
      await p.locator("[data-slot=proxima-acao][data-tipo=reuniao_agora]").waitFor();
      let achou = false;
      for (let i = 0; i < 30 && !achou; i++) {
        const chave = await proxima.getAttribute("data-chave");
        if ((await titulo()) === "Passo 321 do foco") { achou = true; break; }
        await p.locator("[data-slot=agora-nao]").click();
        await p.waitForFunction((c) => document.querySelector("[data-slot=proxima-acao]")?.getAttribute("data-chave") !== c, chave);
        if ((await proxima.getAttribute("data-vazio")) !== null) break;
      }
      afirmar(achou, "o passo do foco não apareceu como próxima ação depois de dispensar as anteriores");
      afirmar((await proxima.getAttribute("data-tipo")) === "passo" && (await p.locator("[data-slot=proxima-acao-botao]").innerText()) === "Concluir o passo", "o passo do foco não veio com o botão de concluir");
      const feito = (d) => d.tarefas.find((t) => t.id === ID).registros[0].proximosPassos[0].feito;
      await p.locator("[data-slot=proxima-acao-botao]").click();
      await ateOsDados((d) => feito(d) === true, "concluir pela próxima ação não gravou o passo");
      // o aviso com "Desfazer" aparece; com o relógio parado deste navegador ele não para de animar, então a volta
      // é pelo Ctrl Z, que é o mesmo desfazer (o clique no aviso é coberto pelas etapas que não mexem no relógio)
      await p.locator("[data-sonner-toast]", { hasText: "Passo concluído" }).waitFor();
      await p.evaluate(() => document.activeElement?.blur());
      await p.keyboard.press("Control+z");
      await ateOsDados((d) => feito(d) === false, "desfazer não reabriu o passo concluído pela próxima ação");

      // ---- dispensar tudo não muda nada nas tarefas, e "Mostrar de novo" traz as sugestões de volta ----
      em("dispensar tudo e mostrar de novo");
      for (let i = 0; i < 40 && (await proxima.getAttribute("data-vazio")) === null; i++) {
        const chave = await proxima.getAttribute("data-chave");
        await p.locator("[data-slot=agora-nao]").click();
        await p.waitForFunction((c) => document.querySelector("[data-slot=proxima-acao]")?.getAttribute("data-chave") !== c, chave);
      }
      await p.locator("[data-slot=proxima-acao][data-vazio]").getByText("Você dispensou as sugestões de agora").waitFor();
      afirmar(feito(await dados()) === false, "dispensar sugestões mexeu na tarefa");
      await p.locator("[data-slot=mostrar-sugestoes]").click();
      await p.locator("[data-slot=proxima-acao][data-tipo=reuniao_agora]").waitFor();

      // ---- o bloco pode ser escondido em Personalizar > Hoje ----
      em("esconder os blocos em Personalizar");
      await p.locator("[data-acao=personalizar-hoje]").click();
      const painel = p.locator("[data-slot=personalizar]");
      await painel.getByRole("switch", { name: "Mostrar Próxima ação" }).click();
      await p.locator("[data-bloco=proxima]").waitFor({ state: "detached" });
      await painel.getByRole("switch", { name: "Mostrar Reuniões de hoje" }).click();
      await p.locator("[data-bloco=reunioes]").waitFor({ state: "detached" });
      await painel.getByRole("switch", { name: "Mostrar Próxima ação" }).click();
      await painel.getByRole("switch", { name: "Mostrar Reuniões de hoje" }).click();
      await p.locator("[data-bloco=proxima]").waitFor();
      await p.locator("[data-bloco=reunioes]").waitFor();
      await painel.getByRole("button", { name: "Pronto" }).click();
      await painel.waitFor({ state: "detached" });

      // ---- quinze minutos antes da outra reunião, o app avisa e a próxima ação passa a ser prepará-la ----
      em("aviso de 15 minutos");
      await p.clock.setFixedTime(as(14, 45));
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await p.locator("[data-sonner-toast]", { hasText: "Reunião em 15 min: Café 321" }).waitFor();
      await p.locator("[data-slot=proxima-acao][data-tipo=reuniao_em_breve]").waitFor();
      afirmar((await titulo()) === "Preparar a reunião: Café 321", "a próxima ação não passou a ser a reunião que vai começar");

      // ---- o formulário do bloco marca a reunião, com participantes e tarefa ----
      em("formulário do bloco de reunião");
      await p.goto(B + "/rotina");
      await p.locator(`[data-slot=rotina][data-data="${dia}"]`).waitFor();
      await p.locator("[data-slot=bloco]", { hasText: "Café 321" }).click();
      const f = p.locator("[data-slot=bloco-form]");
      await f.waitFor();
      afirmar((await f.getByRole("switch", { name: "É uma reunião" }).getAttribute("data-state")) === "checked", "o formulário não mostrou que o bloco é uma reunião");
      const chips = f.locator("[data-slot=reuniao-do-bloco] [data-slot=campo-chips] input").first();
      await chips.fill("Otto Teste");
      await chips.press("Enter");
      // a lista de sugestões de nomes fica aberta enquanto o campo tem foco e cobre o seletor de baixo: sai do campo antes
      await chips.press("Tab");
      await f.getByRole("combobox", { name: "Tarefa da reunião" }).click();
      await p.getByRole("option", { name: /Tarefa da próxima ação 321/ }).click();
      await p.locator("[data-slot=salvar-bloco]").click();
      await f.waitFor({ state: "detached" });
      await ateOsDados((d) => {
        const b = d.jornada.items.find((x) => x.id === dia)?.blocos.find((x) => x.id === "bl321c");
        return !!b?.reuniao && b.reuniao.participantes.join("|") === "Otto Teste" && b.reuniao.tarefaId === ID;
      }, "os participantes e a tarefa da reunião não foram gravados pelo formulário");
      // desligar "É uma reunião" tira o campo do bloco
      await p.locator("[data-slot=bloco]", { hasText: "Café 321" }).click();
      await f.waitFor();
      await f.getByRole("switch", { name: "É uma reunião" }).click();
      await p.locator("[data-slot=salvar-bloco]").click();
      await f.waitFor({ state: "detached" });
      await ateOsDados((d) => !("reuniao" in (d.jornada.items.find((x) => x.id === dia)?.blocos.find((x) => x.id === "bl321c") ?? { reuniao: 1 })), "desligar a reunião não tirou o campo do bloco");
      afirmar(errosP.length === 0, "erro de página na etapa da próxima ação: " + errosP.join(" | "));
    } finally {
      await ctxP.close();
    }
  });

  await etapa("imprimir a tarefa: a folha aparece só na impressão", async () => {
    const t = (await dados()).tarefas[0];
    await pg.goto(`${B}/tarefas/${t.id}`);
    await pg.locator("[data-slot=propriedades]").waitFor();
    await pg.evaluate(() => { window.print = () => { window.__imprimiu = (window.__imprimiu || 0) + 1; }; });
    await pg.locator("button[aria-label='Mais ações da tarefa']").first().click();
    await pg.getByRole("menuitem", { name: "Imprimir ou salvar em PDF" }).click();
    await pg.waitForFunction(() => window.__imprimiu === 1);
    afirmar((await pg.locator("[data-impressao]").innerText()).includes(t.titulo), "a folha de impressão não tem a tarefa");
    await pg.emulateMedia({ media: "print" });
    afirmar(await pg.locator("[data-impressao]").isVisible(), "a folha não aparece na impressão");
    afirmar(!(await pg.locator("[data-slot=app]").isVisible()), "o app aparece junto na impressão");
    await pg.emulateMedia({ media: "screen" });
    await pg.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await pg.locator("[data-impressao]").waitFor({ state: "detached" });
  });

  // ---------- tema ----------
  await etapa("tema escuro", async () => {
    await pg.locator("[data-slot=menu-mais]").click();
    await pg.getByRole("menuitemradio", { name: "Escuro" }).click();
    await pg.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await pg.locator("[data-slot=menu]").waitFor({ state: "detached" });
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
