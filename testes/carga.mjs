// Medição de desempenho com um ano de uso simulado: o app continua rápido quando a pasta cresce?
// Enche uma pasta de dados VAZIA e DESCARTÁVEL com dados fictícios (nomes genéricos) e mede a leitura,
// a gravação e as contas que as telas fazem a cada render.
//
//   npm run build
//   HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-carga npx next start -H 127.0.0.1 -p 3311
//   NEXO_URL=http://127.0.0.1:3311 node testes/carga.mjs            (um ano: 300 tarefas)
//   NEXO_URL=http://127.0.0.1:3311 node testes/carga.mjs --telas    (mede também a abertura das telas, com Playwright)
//   NEXO_TAREFAS=900 ... node testes/carga.mjs                      (três anos)
//
// Recusa rodar se já existir alguma tarefa, para nunca misturar com dados de verdade.
// Sai com erro se alguma medida passar do teto (constante TETOS), para servir de alarme em mudanças futuras.
// (Node 22.18+ importa .ts direto; em versões mais antigas: node --experimental-strip-types testes/carga.mjs)

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

const B = process.env.NEXO_URL || "http://127.0.0.1:3210";
const N_TAREFAS = Math.max(10, Number(process.env.NEXO_TAREFAS) || 300);
const COM_TELAS = process.argv.includes("--telas");
const J = { "Content-Type": "application/json" };

/** Tetos em milissegundos. Folgados de propósito: é alarme de regressão, não cronômetro de corrida. */
const TETOS = { leitura: 2500, gravacao: 400, conta: 400, tela: 4000 };

// ---------- gerador determinístico (a mesma carga a cada rodada) ----------
let semente = 20261114;
const rnd = () => {
  semente = (semente * 1664525 + 1013904223) % 4294967296;
  return semente / 4294967296;
};
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const um = (lista) => lista[Math.floor(rnd() * lista.length)];
const p2 = (n) => String(n).padStart(2, "0");
const dia = (delta) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const carimbo = (delta) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  d.setHours(entre(8, 18), entre(0, 59), 0, 0);
  return d.toISOString();
};

const FRENTES = ["Ferramenta X", "Ferramenta Y", "Security Champion", "Gestão de vulnerabilidades", "Hardening", "Pipeline", "Treinamento", "Auditoria", "Acessos", "Inventário", "Resposta a incidentes", "Arquitetura"];
const SQUADS = ["Pagamentos", "Cadastro", "Crédito", "Cartões", "Atendimento", "Dados", "Plataforma", "Mobile"];
const NOMES = ["Ana", "Bruno", "Camila", "Diego", "Elisa", "Felipe", "Gabriela", "Heitor", "Isabela", "João", "Karina", "Lucas", "Marina", "Nuno", "Olívia", "Paulo", "Quésia", "Rafael", "Sofia", "Tiago"];
const SOBRENOMES = ["Souza", "Lima", "Torres", "Rocha", "Melo", "Prado", "Alves", "Nunes"];
const VERBOS = ["Levar", "Revisar", "Corrigir", "Implantar", "Documentar", "Mapear", "Automatizar", "Validar", "Planejar", "Treinar"];
const OBJETOS = ["o scan na pipeline", "a política de exceções", "o inventário de aplicações", "os acessos privilegiados", "o painel de indicadores", "a trilha de formação", "o processo de triagem", "o gate de qualidade", "o relatório mensal", "o desenho da solução"];
const FRASES = [
  "Alinhamos o escopo e os próximos marcos com o time.", "O squad pediu ajuda para priorizar os achados críticos.", "Ficou combinado revisar o cronograma na próxima semana.",
  "A arquitetura validou o desenho proposto.", "Faltou acesso ao repositório para concluir a análise.", "O gate de bloqueio fica só para severidade crítica no início.",
  "Revisamos os indicadores do mês e o que mudou desde a última conversa.", "A correção depende de uma janela de mudança.", "O time vai integrar a ferramenta até o fim do mês.",
  "Levantamos os falsos positivos e abrimos um guia rápido para o squad.", "A triagem conjunta ficou marcada para quinta.", "O responsável pelo sistema pediu mais prazo para a correção.",
];
const paragrafos = (n) => Array.from({ length: n }, () => Array.from({ length: entre(2, 5) }, () => um(FRASES)).join(" ")).join("\n\n");

const pessoas = Array.from({ length: 40 }, (_, i) => {
  const nome = `${NOMES[i % NOMES.length]} ${SOBRENOMES[Math.floor(i / NOMES.length) % SOBRENOMES.length]}${i >= NOMES.length ? ` ${um(SOBRENOMES)}` : ""}`;
  return { id: `pecarga${i}`, nome, apelidos: [nome.split(" ")[0]], email: `pessoa${i}@exemplo.local`, cargo: um(["Tech lead", "Dev", "Arquiteta", "Analista", "Gestor"]), area: `squad de ${um(SQUADS)}`, ajudaCom: um(FRASES), categoriaIds: [], tags: [] };
});
const categorias = FRENTES.map((nome, i) => ({ id: `ccarga${i}`, nome, descricao: `Frente ${nome}`, cor: `hsl(${i * 30} 65% 50%)` }));

function tarefa(i) {
  const idT = `tcarga${i}`;
  const inicio = -entre(5, 365);
  const fechada = rnd() < 0.7;
  const status = fechada ? (rnd() < 0.9 ? "concluida" : "cancelada") : um(["a_fazer", "em_andamento", "em_andamento", "aguardando", "bloqueada"]);
  const nRegs = entre(8, 34);
  const fim = fechada ? Math.min(-1, inicio + entre(10, 120)) : 0;
  const registros = [{ id: `${idT}m0`, tipo: "marco", data: dia(inicio), titulo: "Tarefa criada", participantes: [], anotacoes: "", resumoIA: "", decisoes: "", proximosPassos: [], impedimentos: "", criadoEm: carimbo(inicio), atualizadoEm: carimbo(inicio) }];
  for (let k = 0; k < nRegs; k++) {
    const d = Math.round(inicio + ((fim - inicio) * (k + 1)) / (nRegs + 1));
    const tipo = um(["reuniao", "reuniao", "atividade", "atividade", "nota", "decisao", "impedimento"]);
    const gente = Array.from({ length: tipo === "reuniao" ? entre(2, 5) : 0 }, () => um(pessoas).apelidos[0]);
    registros.push({
      id: `${idT}r${k}`, tipo, data: dia(d), hora: tipo === "reuniao" ? `${p2(entre(9, 17))}:00` : undefined,
      titulo: `${um(["Alinhamento", "Revisão", "Acompanhamento", "Análise", "Conversa"])} ${k + 1} com o squad de ${um(SQUADS)}`,
      participantes: [...new Set(gente)],
      anotacoes: paragrafos(entre(1, 4)) + (rnd() < 0.15 ? `\n\nVer [outra tarefa](nexo:tarefa/tcarga${entre(0, N_TAREFAS - 1)}).` : ""),
      resumoIA: rnd() < 0.6 ? paragrafos(1) : "",
      decisoes: rnd() < 0.4 ? `- ${um(FRASES)}\n- ${um(FRASES)}` : "",
      impedimentos: tipo === "impedimento" || rnd() < 0.1 ? um(FRASES) : "",
      proximosPassos: Array.from({ length: entre(0, 4) }, (_, j) => {
        const feito = fechada || rnd() < 0.75;
        return { id: `${idT}r${k}p${j}`, texto: `${um(VERBOS)} ${um(OBJETOS)}`, feito, feitoEm: feito ? carimbo(Math.min(-0, d + entre(0, 12))) : undefined, responsavel: rnd() < 0.5 ? um(pessoas).apelidos[0] : "", prazo: rnd() < 0.3 ? dia(d + entre(3, 30)) : null };
      }),
      duracaoMin: tipo === "atividade" && rnd() < 0.3 ? um([15, 25, 50]) : 0,
      referencia: rnd() < 0.03,
      criadoEm: carimbo(d), atualizadoEm: carimbo(d),
    });
  }
  if (fechada) registros.push({ id: `${idT}mf`, tipo: "marco", data: dia(fim), titulo: status === "concluida" ? "Concluída" : "Cancelada", participantes: [], anotacoes: "", resumoIA: "", decisoes: "", proximosPassos: [], impedimentos: "", alteracoes: { status: { de: "em_andamento", para: status } }, criadoEm: carimbo(fim), atualizadoEm: carimbo(fim) });
  return {
    id: idT, titulo: `${um(VERBOS)} ${um(OBJETOS)} no squad de ${um(SQUADS)} (${i + 1})`, descricao: paragrafos(1),
    categoriaId: rnd() < 0.92 ? um(categorias).id : null, status, prioridade: entre(1, 10),
    prazo: rnd() < 0.5 ? dia(fechada ? fim + entre(-5, 10) : entre(-10, 45)) : null, tags: [um(["q1", "q2", "q3", "q4"]), um(SQUADS).toLowerCase()],
    esperando: status === "aguardando" ? { quem: um(pessoas).nome, oQue: `${um(VERBOS).toLowerCase()} ${um(OBJETOS)}`, desde: dia(-entre(1, 20)) } : null,
    registros, criadaEm: carimbo(inicio), atualizadaEm: carimbo(fim), concluidaEm: status === "concluida" ? carimbo(fim) : undefined,
  };
}

async function api(caminho, init) {
  const r = await fetch(B + caminho, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${caminho}: ${j.erro || r.status}`);
  return j;
}
const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const medir = async (vezes, fn) => {
  const tempos = [];
  let ultimo;
  for (let i = 0; i < vezes; i++) {
    const t0 = performance.now();
    ultimo = await fn();
    tempos.push(performance.now() - t0);
  }
  return { ms: mediana(tempos), valor: ultimo };
};

const linhas = [];
let estouros = 0;
function anotar(grupo, nome, ms, teto, extra = "") {
  const passou = ms <= teto;
  if (!passou) estouros++;
  linhas.push(`${passou ? "ok   " : "LENTO"} ${grupo.padEnd(9)} ${nome.padEnd(46)} ${String(Math.round(ms)).padStart(6)} ms  (teto ${teto})${extra ? `  ${extra}` : ""}`);
}

// ---------- 1) encher a pasta ----------
const inicial = await api("/api/dados");
if (inicial.tarefas.length) {
  console.error("A pasta de dados já tem tarefas. Rode a carga numa pasta vazia e descartável (veja o cabeçalho deste arquivo).");
  process.exit(2);
}
console.log(`Gerando ${N_TAREFAS} tarefas em ${B} ...`);
const t0 = performance.now();
await api("/api/categorias", { method: "PUT", headers: J, body: JSON.stringify({ items: categorias, revEsperada: inicial.categorias.rev }) });
await api("/api/pessoas", { method: "PUT", headers: J, body: JSON.stringify({ items: pessoas, revEsperada: inicial.pessoas.rev }) });
await api("/api/paginas", { method: "PUT", headers: J, body: JSON.stringify({ revEsperada: inicial.paginas.rev, items: Array.from({ length: Math.round(N_TAREFAS / 5) }, (_, i) => ({ id: `pgcarga${i}`, titulo: `Processo de ${um(OBJETOS).replace(/^(o|a|os|as) /, "")} (${i + 1})`, texto: `## Quando usar\n\n${paragrafos(3)}\n\n## Passo a passo\n\n- ${um(FRASES)}\n- ${um(FRASES)}\n- ${um(FRASES)}\n\nVer [tarefa](nexo:tarefa/tcarga${entre(0, N_TAREFAS - 1)}).`, categoriaId: um(categorias).id })) }) });
await api("/api/notas", { method: "PUT", headers: J, body: JSON.stringify({ revEsperada: inicial.notas.rev, items: Array.from({ length: Math.round(N_TAREFAS / 2.5) }, (_, i) => ({ id: `ncarga${i}`, titulo: `Folha ${i + 1}`, texto: paragrafos(entre(1, 4)), arquivadaEm: i > 6 ? carimbo(-entre(1, 300)) : null })) }) });
await api("/api/links", { method: "PUT", headers: J, body: JSON.stringify({ revEsperada: inicial.links.rev, items: Array.from({ length: Math.round(N_TAREFAS / 4) }, (_, i) => ({ id: `lcarga${i}`, tipo: "link", titulo: `Documento ${i + 1}: ${um(OBJETOS)}`, url: `https://exemplo.local/doc/${i}`, descricao: um(FRASES), tags: [um(SQUADS).toLowerCase()], tarefaId: `tcarga${entre(0, N_TAREFAS - 1)}` })) }) });
let registros = 0;
const temposDeGravacao = [];
for (let i = 0; i < N_TAREFAS; i++) {
  const t = tarefa(i);
  registros += t.registros.length;
  const g0 = performance.now();
  await api(`/api/tarefas/${t.id}`, { method: "PUT", headers: J, body: JSON.stringify({ tarefa: t, revEsperada: null }) });
  temposDeGravacao.push(performance.now() - g0);
}
console.log(`  ${N_TAREFAS} tarefas, ${registros} registros, em ${((performance.now() - t0) / 1000).toFixed(1)} s`);

// ---------- 2) servidor: ler tudo, gravar uma tarefa, verificar, backup ----------
let bytes = 0;
const leitura = await medir(5, async () => {
  const txt = await (await fetch(B + "/api/dados")).text();
  bytes = txt.length;
  return JSON.parse(txt);
});
const dados = leitura.valor;
anotar("servidor", "ler tudo (GET /api/dados)", leitura.ms, TETOS.leitura, `${(bytes / 1_048_576).toFixed(1)} MB`);
anotar("servidor", "criar uma tarefa (mediana)", mediana(temposDeGravacao), TETOS.gravacao);
const maior = [...dados.tarefas].sort((a, b) => b.registros.length - a.registros.length)[0];
let rev = maior.rev;
const regravar = await medir(5, async () => {
  const r = await api(`/api/tarefas/${maior.id}`, { method: "PUT", headers: J, body: JSON.stringify({ tarefa: { ...maior, rev }, revEsperada: rev }) });
  rev = r.rev;
});
anotar("servidor", `regravar a maior tarefa (${maior.registros.length} registros)`, regravar.ms, TETOS.gravacao);
anotar("servidor", "verificar a saúde dos dados", (await medir(3, () => api("/api/verificar"))).ms, TETOS.leitura);
anotar("servidor", "backup manual", (await medir(1, () => api("/api/backup", { method: "POST" }))).ms, TETOS.leitura * 2);

// ---------- 3) as contas que as telas fazem ----------
const raiz = new URL("../lib/", import.meta.url).href;
const [L, Jg, Rd, Pg, Lg, Di, Pe, Tp] = await Promise.all(["lembretes", "jogo", "radar", "perguntar", "ligacoes", "diario", "pessoas", "tipos"].map((m) => import(`${raiz}${m}.ts`)));
const hoje = Tp.hojeISO();
const conta = async (nome, fn) => anotar("tela", nome, (await medir(7, async () => fn())).ms, TETOS.conta);
await conta("lembretes (sino, Hoje, barra lateral)", () => L.gerarLembretes(dados.tarefas));
await conta("passos em aberto (Pendências)", () => L.passosAbertosDe(dados.tarefas));
await conta("placar das conquistas", () => Jg.calcularJogo(dados, hoje));
await conta("radar das frentes", () => Rd.montarRadar(dados, hoje));
await conta("diário (todos os eventos)", () => Di.montarDiario(dados.tarefas));
await conta("diretório de pessoas", () => Pe.montarDiretorio(dados));
await conta("quem cita quem (índice de citações)", () => Lg.indiceDeCitacoes(dados));
// perguntar: a primeira busca prepara os textos (uma vez por mudança nos dados); as seguintes são as de cada letra digitada
anotar("tela", "perguntar: primeira busca (prepara os textos)", (await medir(1, async () => Pg.buscarFontes("gate de bloqueio", dados))).ms, TETOS.leitura);
await conta("perguntar: buscas seguintes (a cada letra)", () => Pg.buscarFontes("O que ficou decidido sobre o gate de bloqueio no squad de Pagamentos?", dados));
await conta("busca por texto em tudo", () => {
  const q = Tp.semAcento("triagem conjunta");
  let n = 0;
  for (const t of dados.tarefas) for (const r of t.registros) if (Tp.semAcento(`${r.titulo} ${r.anotacoes} ${r.resumoIA} ${r.decisoes} ${r.impedimentos}`).includes(q)) n++;
  return n;
});

// ---------- 4) abrir as telas de verdade ----------
if (COM_TELAS) {
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright");
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((h) => {
    try {
      localStorage.setItem("nexo:rotina", JSON.stringify({ ultimoPlanejamento: h, ultimaRevisao: h, abrirSozinho: false }));
      localStorage.setItem("nexo:novidadesVistas", JSON.stringify("3.0"));
    } catch {}
  }, hoje);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on("pageerror", (e) => erros.push(e.message));
  const abrir = async (nome, caminho, seletor) => {
    const t = performance.now();
    await pg.goto(B + caminho);
    await pg.locator(seletor).first().waitFor({ timeout: 30000 });
    anotar("abrir", nome, performance.now() - t, TETOS.tela);
  };
  await abrir("Hoje (primeira carga do app)", "/", "[data-slot=pagina]");
  await abrir("Tarefas", "/tarefas", "[data-slot=pagina] a[href^='/tarefas/']");
  await abrir(`Tarefa com ${maior.registros.length} registros`, `/tarefas/${maior.id}`, "[data-slot=registro]");
  await abrir("Pendências", "/pendencias", "[data-slot=passo]");
  await abrir("Diário", "/diario", "[data-slot=pagina]");
  await abrir("Radar", "/radar", "[data-slot=frente]");
  await abrir("Busca por um termo comum", "/busca?q=squad", "[data-slot=contagem]");
  await abrir("Perguntar com a pergunta escrita", "/perguntar?q=" + encodeURIComponent("O que ficou decidido sobre o gate de bloqueio?"), "[data-slot=fonte]");
  await abrir("Conquistas", "/conquistas", "[data-slot=xp]");
  await abrir("Pessoas", "/pessoas", "[data-slot=pagina]");
  // digitar na busca: cada tecla refaz a busca em tudo
  await pg.goto(B + "/busca");
  const campo = pg.locator("[data-slot=pagina] input").first();
  await campo.waitFor();
  const d0 = performance.now();
  await campo.pressSequentially("triagem conjunta", { delay: 0 });
  await pg.locator("[data-slot=contagem]").waitFor();
  anotar("abrir", "digitar 16 letras na busca", performance.now() - d0, TETOS.tela);
  if (erros.length) {
    estouros++;
    linhas.push(`ERRO  nas telas: ${erros.join(" | ")}`);
  }
  await nav.close();
}

console.log(`\nCarga: ${dados.tarefas.length} tarefas, ${registros} registros, ${dados.paginas.items.length} páginas, ${dados.notas.items.length} folhas, ${dados.links.items.length} links, ${dados.pessoas.items.length} pessoas.\n`);
console.log(linhas.join("\n"));
console.log(estouros ? `\n${estouros} medida(s) acima do teto.` : "\nTudo dentro do teto.");
process.exit(estouros ? 1 : 0);
