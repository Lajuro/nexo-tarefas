// Enche uma pasta de dados DESCARTÁVEL com um cenário de demonstração (nomes genéricos),
// para desenvolver e conferir telas sem tocar em dados reais.
//
//   HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-dados npm run dev
//   node testes/semear.mjs            (usa NEXO_URL ou http://127.0.0.1:3210)
//   node testes/semear.mjs --so-pessoas  (só as pessoas e os times de demonstração, numa pasta
//                                         que já tem o cenário mas ainda não tem pessoas/times)
//
// Recusa rodar se já existir alguma tarefa (ou, com --so-pessoas, se já houver pessoas ou times),
// para nunca misturar com dados de verdade.

const B = process.env.NEXO_URL || "http://127.0.0.1:3210";
const J = { "Content-Type": "application/json" };

const p2 = (n) => String(n).padStart(2, "0");
const dia = (delta) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const carimbo = (delta) => {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString();
};
let seq = 0;
const id = (p) => `${p}demo${(++seq).toString(36)}`;

async function api(caminho, init) {
  const r = await fetch(B + caminho, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${caminho}: ${j.erro || r.status}`);
  return j;
}

const passo = (texto, extra = {}) => ({ id: id("p"), texto, feito: false, responsavel: "", prazo: null, ...extra });
const reg = (tipo, delta, titulo, extra = {}) => ({
  id: id("r"), tipo, data: dia(delta), titulo, participantes: [], anotacoes: "", resumoIA: "", decisoes: "",
  proximosPassos: [], impedimentos: "", criadoEm: carimbo(delta), atualizadoEm: carimbo(delta), ...extra,
});
const criada = (delta, status = "a_fazer") =>
  reg("marco", delta, "Tarefa criada", { alteracoes: { status: { de: "", para: status } } });

// Pessoas cadastradas e times. Diego e Letícia ficam de fora de propósito (aparecem só nos registros).
const pessoas = [
  {
    id: "pedemomarina", nome: "Marina Souza", apelidos: ["Marina"], email: "marina.souza@exemplo.local",
    cargo: "Product Owner", area: "Squad de Pagamentos", ajudaCom: "Priorizar o backlog do squad e liberar acessos aos repositórios.",
    anotacoes: "Prefere alinhar por mensagem antes de marcar reunião.", categoriaIds: ["cdemoferr"], tags: ["pagamentos"],
  },
  {
    id: "pedemofelipe", nome: "Felipe Rocha", apelidos: ["Felipe"], email: "felipe.rocha@exemplo.local",
    cargo: "Arquiteto de soluções", area: "Arquitetura", ajudaCom: "Validar desenho de integração e padrões de pipeline.",
    anotacoes: "", categoriaIds: ["cdemoferr", "cdemohard"], tags: ["arquitetura"],
  },
  {
    id: "pedemobruno", nome: "Bruno Lima", apelidos: ["Bruno"], email: "bruno.lima@exemplo.local",
    cargo: "Desenvolvedor sênior", area: "Squad de Pagamentos", ajudaCom: "Corrigir achados no código do checkout e testar regras do scan.",
    anotacoes: "", categoriaIds: [], tags: ["pagamentos", "dev"],
  },
  {
    id: "pedemocamila", nome: "Camila Torres", apelidos: ["Camila"], email: "camila.torres@exemplo.local",
    cargo: "Coordenadora de capacitação", area: "Pessoas e Cultura", ajudaCom: "Agenda, salas e comunicação da trilha de champions.",
    anotacoes: "", categoriaIds: ["cdemochamp"], tags: ["treinamento"],
  },
  {
    id: "pedemorafael", nome: "Rafael Melo", apelidos: ["Rafael"], email: "rafael.melo@exemplo.local",
    cargo: "Gerente de segurança", area: "Segurança da Informação", ajudaCom: "Aprovar exceções, destravar janelas de mudança e falar com a liderança.",
    anotacoes: "Gestor direto.", categoriaIds: ["cdemochamp", "cdemovuln", "cdemohard"], tags: ["liderança"],
  },
].map((p) => ({ ...p, origem: "manual", criadaEm: carimbo(-40), atualizadaEm: carimbo(-40) }));

const times = [
  {
    id: "tidemopagamentos", nome: "Squad de Pagamentos", descricao: "Squad dono do checkout e da API de pagamentos.", cor: "#0090ff",
    responsavelIds: ["pedemomarina"], membroIds: ["pedemomarina", "pedemobruno"], categoriaIds: ["cdemoferr"],
  },
  {
    id: "tidemoarquitetura", nome: "Arquitetura", descricao: "Time de arquitetura de soluções.", cor: "#8e4ec6",
    responsavelIds: ["pedemofelipe"], membroIds: ["pedemofelipe"], categoriaIds: ["cdemoferr", "cdemohard"],
  },
].map((t) => ({ ...t, criadoEm: carimbo(-40), atualizadoEm: carimbo(-40) }));

async function semearPessoas() {
  const d = await api("/api/dados");
  if (!d.pessoas || !d.times) throw new Error("Este servidor ainda não conhece pessoas e times. Atualize o app.");
  if (d.pessoas.items.length || d.times.items.length) {
    console.error("Esta pasta já tem pessoas ou times cadastrados. Nada foi alterado.");
    process.exit(1);
  }
  await api("/api/pessoas", { method: "PUT", headers: J, body: JSON.stringify({ items: pessoas, revEsperada: d.pessoas.rev }) });
  await api("/api/times", { method: "PUT", headers: J, body: JSON.stringify({ items: times, revEsperada: d.times.rev }) });
}

if (process.argv.includes("--so-pessoas")) {
  await semearPessoas();
  console.log(`Pessoas e times de demonstração criados em ${B}: ${pessoas.length} pessoas, ${times.length} times.`);
  process.exit(0);
}

const dados = await api("/api/dados");
if (dados.tarefas.length) {
  console.error("Esta pasta já tem tarefas. O cenário de demonstração só entra em pasta vazia.");
  process.exit(1);
}

const cats = [
  { id: "cdemoferr", nome: "Ferramenta X", descricao: "Adoção da ferramenta de análise de código pelos squads", cor: "#3e63dd" },
  { id: "cdemochamp", nome: "Security Champion", descricao: "Formação e acompanhamento dos champions", cor: "#46a758" },
  { id: "cdemovuln", nome: "Gestão de vulnerabilidades", descricao: "Triagem, priorização e acompanhamento de correções", cor: "#e5484d" },
  { id: "cdemohard", nome: "Hardening", descricao: "Demandas de endurecimento de ambientes", cor: "#f76b15" },
].map((c) => ({ ...c, criadaEm: carimbo(-60), atualizadaEm: carimbo(-60) }));
await api("/api/categorias", { method: "PUT", headers: J, body: JSON.stringify({ items: cats, revEsperada: dados.categorias.rev }) });

const tarefas = [
  {
    id: "tdemo1", titulo: "Onboarding do squad de Pagamentos na Ferramenta X", categoriaId: "cdemoferr", status: "em_andamento",
    prioridade: 9, prazo: dia(2), tags: ["pipeline", "onboarding"], focoEm: dia(0),
    descricao: "Colocar o scan da Ferramenta X na pipeline do squad de Pagamentos e treinar o time.",
    registros: [
      criada(-21, "a_fazer"),
      reg("reuniao", -18, "Kickoff com o squad", {
        hora: "10:00", participantes: ["Marina", "Felipe", "Bruno"],
        anotacoes: "marina topou, felipe da arquitetura validou desenho. falta acesso ao repo checkout. gate só crítica no começo.",
        resumoIA: "Alinhamos o escopo do onboarding. O time vai integrar o scan na pipeline até o fim do mês e a arquitetura validou o desenho.",
        decisoes: "- Começar pelo repositório de checkout\n- Gate de bloqueio só para severidade crítica no início",
        proximosPassos: [
          passo("Enviar documentação de integração para o squad", { responsavel: "Eu", feito: true, feitoEm: carimbo(-16) }),
          passo("Liberar acesso ao repositório de checkout", { responsavel: "Marina" }),
        ],
        impedimentos: "Aguardando liberação de acesso pelo time de plataforma",
      }),
      reg("marco", -18, "Em andamento", { alteracoes: { status: { de: "a_fazer", para: "em_andamento" } } }),
      reg("atividade", -16, "Enviei a documentação de integração", { resumoIA: "Documentação enviada por e-mail ao squad, com o passo a passo da pipeline." }),
      reg("reuniao", -4, "Revisão dos primeiros resultados do scan", {
        hora: "15:30", participantes: ["Marina", "Bruno"],
        resumoIA: "O primeiro scan trouxe 42 achados, 3 críticos. O squad pediu ajuda para priorizar e quer uma sessão de triagem.",
        decisoes: "- Triagem conjunta dos críticos antes de ligar o gate",
        proximosPassos: [
          passo("Agendar sessão de triagem dos 3 críticos", { responsavel: "Eu", prazo: dia(0) }),
          passo("Montar guia rápido de falso positivo", { responsavel: "Eu", prazo: dia(3) }),
          passo("Corrigir os críticos do checkout", { responsavel: "Bruno" }),
        ],
      }),
    ],
  },
  {
    id: "tdemo2", titulo: "Trilha de formação dos Security Champions (turma 2)", categoriaId: "cdemochamp", status: "em_andamento",
    prioridade: 7, prazo: dia(12), tags: ["treinamento"], focoEm: dia(0),
    descricao: "Montar e rodar a segunda turma da trilha, com 6 encontros.",
    registros: [
      criada(-30, "em_andamento"),
      reg("reuniao", -12, "Definição do conteúdo com a liderança", {
        participantes: ["Camila", "Rafael"],
        resumoIA: "Fechamos os 6 temas da trilha e o formato de 1h por encontro, com exercício prático.",
        proximosPassos: [
          passo("Escrever o roteiro do encontro 1 (modelagem de ameaças)", { responsavel: "Eu" }),
          passo("Reservar sala e agenda dos 6 encontros", { responsavel: "Camila", feito: true, feitoEm: carimbo(-9) }),
        ],
      }),
      reg("decisao", -9, "Certificado interno ao final", { resumoIA: "Quem completar 5 de 6 encontros recebe o selo de champion." }),
    ],
  },
  {
    id: "tdemo3", titulo: "Correção da vulnerabilidade crítica na API de cadastro", categoriaId: "cdemovuln", status: "aguardando",
    prioridade: 10, prazo: dia(-2), tags: ["crítico"], lembrarEm: dia(0),
    esperando: { quem: "Bruno Lima", oQue: "subir a correção para homologação", desde: dia(-8), cobradoEm: dia(-4) },
    descricao: "Injeção encontrada no teste de intrusão. Squad de Cadastro precisa corrigir e eu valido.",
    registros: [
      criada(-14, "a_fazer"),
      reg("reuniao", -13, "Apresentação do achado ao squad de Cadastro", {
        participantes: ["Diego", "Letícia"],
        resumoIA: "Squad entendeu o risco e se comprometeu a corrigir em uma sprint. Pediram exemplo de correção.",
        proximosPassos: [
          passo("Enviar exemplo de correção com query parametrizada", { responsavel: "Eu", feito: true, feitoEm: carimbo(-12) }),
          passo("Subir a correção para homologação", { responsavel: "Diego", prazo: dia(-3) }),
        ],
      }),
      reg("marco", -8, "Aguardando terceiros", { alteracoes: { status: { de: "a_fazer", para: "aguardando" } } }),
    ],
  },
  {
    id: "tdemo4", titulo: "Hardening dos servidores do ambiente de homologação", categoriaId: "cdemohard", status: "bloqueada",
    prioridade: 6, prazo: dia(20), tags: ["infra"],
    descricao: "Aplicar o baseline nos servidores de homologação.",
    registros: [
      criada(-25, "a_fazer"),
      reg("impedimento", -6, "Janela de mudança negada", {
        participantes: ["Rafael"],
        resumoIA: "O comitê negou a janela desta semana por causa do fechamento do mês.",
        impedimentos: "Sem janela de mudança até o dia 5.",
        proximosPassos: [passo("Reabrir o pedido de janela depois do fechamento", { responsavel: "Eu" })],
      }),
      reg("marco", -6, "Bloqueada", { alteracoes: { status: { de: "a_fazer", para: "bloqueada" } } }),
    ],
  },
  {
    id: "tdemo5", titulo: "Revisar política de exceções de vulnerabilidade", categoriaId: "cdemovuln", status: "a_fazer",
    prioridade: 5, prazo: dia(0), tags: ["política"],
    descricao: "A política atual não define prazo máximo de exceção.",
    registros: [criada(-10, "a_fazer"), reg("nota", -10, "Pontos a revisar", { anotacoes: "prazo máximo, quem aprova, renovação automática não pode." })],
  },
  {
    id: "tdemo6", titulo: "Painel de métricas de adoção da Ferramenta X", categoriaId: "cdemoferr", status: "a_fazer",
    prioridade: 4, prazo: null, tags: ["métricas"],
    descricao: "Mostrar por squad: repositórios cobertos, achados abertos e tempo médio de correção.",
    registros: [
      criada(-19, "a_fazer"),
      reg("reuniao", -19, "Levantamento com o time de dados", {
        participantes: ["Letícia"],
        resumoIA: "Os dados já existem na API da ferramenta. Falta decidir onde o painel vai morar.",
        proximosPassos: [passo("Definir onde hospedar o painel", { responsavel: "Eu" }), passo("Mapear os campos da API", { responsavel: "Letícia" })],
      }),
    ],
  },
  {
    id: "tdemo7", titulo: "Onboarding do squad de Cartões na Ferramenta X", categoriaId: "cdemoferr", status: "concluida",
    prioridade: 6, prazo: dia(-15), tags: ["pipeline", "onboarding"], concluidaEm: carimbo(-3),
    descricao: "Primeiro squad a entrar. Serviu de piloto.",
    registros: [
      criada(-50, "em_andamento"),
      reg("reuniao", -45, "Kickoff do piloto", { participantes: ["Felipe", "Camila"], resumoIA: "Piloto aprovado. Squad de Cartões integra em duas semanas." }),
      reg("atividade", -30, "Pipeline integrada", { resumoIA: "Scan rodando em todos os repositórios do squad." }),
      reg("marco", -3, "Concluída", { alteracoes: { status: { de: "em_andamento", para: "concluida" } } }),
    ],
  },
  {
    id: "tdemo8", titulo: "Responder questionário de auditoria sobre gestão de acessos", categoriaId: null, status: "a_fazer",
    prioridade: 8, prazo: dia(5), tags: ["auditoria"],
    descricao: "Questionário com 30 perguntas. Preciso de evidências do time de identidade.",
    registros: [criada(-2, "a_fazer")],
  },
];

for (const t of tarefas) {
  const tarefa = { criadaEm: t.registros[0].criadoEm, atualizadaEm: carimbo(0), ...t };
  await api(`/api/tarefas/${t.id}`, { method: "PUT", headers: J, body: JSON.stringify({ tarefa, revEsperada: null }) });
}

const links = [
  { id: "ldemo1", tipo: "link", titulo: "Documentação de integração da Ferramenta X", url: "https://exemplo.local/docs/ferramenta-x", descricao: "Passo a passo da pipeline", tags: ["runbook"], tarefaId: "tdemo1", categoriaId: "cdemoferr" },
  { id: "ldemo2", tipo: "link", titulo: "Baseline de hardening", url: "https://exemplo.local/baseline", descricao: "Padrão aprovado", tags: ["padrão"], tarefaId: "tdemo4", categoriaId: "cdemohard" },
  { id: "ldemo3", tipo: "link", titulo: "Política de exceções (versão atual)", url: "https://exemplo.local/politica-excecoes", descricao: "", tags: ["política"], tarefaId: "tdemo5", categoriaId: "cdemovuln" },
  { id: "ldemo4", tipo: "link", titulo: "Pasta da trilha de champions", url: "\\\\servidor\\seguranca\\champions", descricao: "Slides e exercícios", tags: ["treinamento"], tarefaId: null, categoriaId: "cdemochamp" },
].map((l) => ({ ...l, criadoEm: carimbo(-7) }));
const atual = await api("/api/dados");
await api("/api/links", { method: "PUT", headers: J, body: JSON.stringify({ items: links, revEsperada: atual.links.rev }) });

await semearPessoas();

// um modelo de tarefa, para a demanda que se repete (levar a ferramenta a mais um squad)
const modelos = [
  {
    id: "modemo1", nome: "Levar a Ferramenta X para um squad", quando: "sempre que um squad novo entrar",
    titulo: "Onboarding do squad ... na Ferramenta X", descricao: "Colocar o scan da Ferramenta X na pipeline do squad e treinar o time.",
    categoriaId: "cdemoferr", prioridade: 7, tags: ["pipeline", "onboarding"], prazoEmDias: 30, usos: 1,
    passos: ["Agendar a conversa de abertura com o squad", "Pedir acesso aos repositórios", "Ligar o scan na pipeline", "Fazer a triagem dos primeiros achados", "Treinar o time"],
    criadoEm: carimbo(-20), atualizadoEm: carimbo(-20),
  },
];
const comModelos = await api("/api/dados");
await api("/api/modelos", { method: "PUT", headers: J, body: JSON.stringify({ items: modelos, revEsperada: comModelos.modelos?.rev ?? 0 }) });

console.log(
  `Cenário de demonstração criado em ${B}: ${tarefas.length} tarefas, ${cats.length} categorias, ${links.length} links, ` +
    `${pessoas.length} pessoas, ${times.length} times.`,
);
