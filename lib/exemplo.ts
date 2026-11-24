// Dados de exemplo (3.22): um cenário pronto para quem quer conhecer o Nexo antes de pôr as próprias tarefas.
//
// O exemplo NUNCA entra na pasta de dados de verdade: ele vive numa pasta separada (~/.nexo/exemplo-<carimbo>),
// montada com o importador da 3.17, e o app só troca de pasta enquanto o usuário quer ver o exemplo
// (lib/armazenamento.ts: entrarNoExemplo e sairDoExemplo). Na pasta real ele sujaria a rotina, as conquistas,
// os relatórios, os backups, a lixeira e o OneDrive.
//
// Esta função só MONTA os dados, no formato de um export do app ("Exportar tudo (JSON)"). É pura: recebe o dia de
// hoje e devolve sempre o mesmo cenário para o mesmo dia, com as datas em relação a ele (o que venceu há dois dias,
// a reunião de hoje, o prazo de daqui a doze dias).
//
// Nomes genéricos, de propósito: o repositório é público. Nada aqui é de empresa, sistema ou pessoa de verdade.
// Testado em testes/exemplo.test.mjs (o cenário inteiro passa pelo leitor de export sem nenhum item ignorado).

import { SCHEMA_APP } from "./migracoes";

const p2 = (n: number) => String(n).padStart(2, "0");

export function gerarExemplo(hoje: string) {
  const [ano, mes, diaDoMes] = hoje.split("-").map(Number);
  const dia = (delta: number) => {
    const d = new Date(ano, mes - 1, diaDoMes + delta, 12);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const carimbo = (delta: number, hora = 12) => `${dia(delta)}T${p2(hora)}:00:00.000Z`;
  const util = (delta: number) => {
    const s = new Date(ano, mes - 1, diaDoMes + delta, 12).getDay();
    return s >= 1 && s <= 5;
  };
  let seq = 0;
  const id = (prefixo: string) => `${prefixo}ex${(++seq).toString(36)}`;

  const passo = (texto: string, extra: Record<string, unknown> = {}) => ({ id: id("p"), texto, feito: false, responsavel: "", prazo: null, ...extra });
  const reg = (tipo: string, delta: number, titulo: string, extra: Record<string, unknown> = {}) => ({
    id: id("r"), tipo, data: dia(delta), titulo, participantes: [], anotacoes: "", resumoIA: "", decisoes: "", proximosPassos: [], impedimentos: "",
    criadoEm: carimbo(delta), atualizadoEm: carimbo(delta), ...extra,
  });
  const criada = (delta: number, status = "a_fazer") => reg("marco", delta, "Tarefa criada", { alteracoes: { status: { de: "", para: status } } });
  const mudou = (delta: number, de: string, para: string, titulo: string) => reg("marco", delta, titulo, { alteracoes: { status: { de, para } } });

  // ---------- categorias, pessoas e times ----------
  const categorias = [
    { id: "cexfer", nome: "Ferramenta X", descricao: "Adoção da ferramenta de análise de código pelos squads", cor: "#3e63dd" },
    { id: "cexcha", nome: "Formação do time", descricao: "Trilha de capacitação e acompanhamento", cor: "#46a758" },
    { id: "cexvul", nome: "Correções prioritárias", descricao: "Triagem, priorização e acompanhamento de correções", cor: "#e5484d" },
    { id: "cexinf", nome: "Infraestrutura", descricao: "Demandas de ambientes e janelas de mudança", cor: "#f76b15" },
  ].map((c) => ({ ...c, criadaEm: carimbo(-60), atualizadaEm: carimbo(-60) }));

  const pessoas = [
    { id: "peexmarina", nome: "Marina Souza", apelidos: ["Marina"], email: "marina.souza@exemplo.local", cargo: "Product Owner", area: "Squad de Pagamentos", ajudaCom: "Priorizar o backlog do squad e liberar acessos aos repositórios.", anotacoes: "Prefere alinhar por mensagem antes de marcar reunião.", categoriaIds: ["cexfer"], tags: ["pagamentos"] },
    { id: "peexfelipe", nome: "Felipe Rocha", apelidos: ["Felipe"], email: "felipe.rocha@exemplo.local", cargo: "Arquiteto de soluções", area: "Arquitetura", ajudaCom: "Validar desenho de integração e padrões de pipeline.", anotacoes: "", categoriaIds: ["cexfer", "cexinf"], tags: ["arquitetura"] },
    { id: "peexbruno", nome: "Bruno Lima", apelidos: ["Bruno"], email: "bruno.lima@exemplo.local", cargo: "Desenvolvedor sênior", area: "Squad de Pagamentos", ajudaCom: "Corrigir achados no código e testar as regras da ferramenta.", anotacoes: "", categoriaIds: [], tags: ["pagamentos", "dev"] },
    { id: "peexcamila", nome: "Camila Torres", apelidos: ["Camila"], email: "camila.torres@exemplo.local", cargo: "Coordenadora de capacitação", area: "Pessoas e Cultura", ajudaCom: "Agenda, salas e comunicação da trilha.", anotacoes: "", categoriaIds: ["cexcha"], tags: ["treinamento"] },
    { id: "peexrafael", nome: "Rafael Melo", apelidos: ["Rafael"], email: "rafael.melo@exemplo.local", cargo: "Gerente da área", area: "Gestão", ajudaCom: "Aprovar exceções, destravar janelas de mudança e falar com a liderança.", anotacoes: "Gestor direto.", categoriaIds: ["cexcha", "cexvul", "cexinf"], tags: ["liderança"] },
  ].map((p) => ({ ...p, origem: "manual", criadaEm: carimbo(-40), atualizadaEm: carimbo(-40) }));

  const times = [
    { id: "tiexpag", nome: "Squad de Pagamentos", descricao: "Squad dono do checkout e da API de pagamentos.", cor: "#0090ff", responsavelIds: ["peexmarina"], membroIds: ["peexmarina", "peexbruno"], categoriaIds: ["cexfer"] },
    { id: "tiexarq", nome: "Arquitetura", descricao: "Time de arquitetura de soluções.", cor: "#8e4ec6", responsavelIds: ["peexfelipe"], membroIds: ["peexfelipe"], categoriaIds: ["cexfer", "cexinf"] },
  ].map((t) => ({ ...t, criadoEm: carimbo(-40), atualizadoEm: carimbo(-40) }));

  // ---------- tarefas: uma de cada situação que o app sabe mostrar ----------
  const tarefas = [
    {
      id: "tex1", titulo: "Onboarding do squad de Pagamentos na Ferramenta X", categoriaId: "cexfer", status: "em_andamento", prioridade: 9, prazo: dia(2),
      tags: ["pipeline", "onboarding"], focoEm: dia(0), descricao: "Colocar a análise da Ferramenta X na pipeline do squad de Pagamentos e treinar o time.",
      checklist: [
        { id: "ckex1", texto: "Acesso aos repositórios liberado", feito: true, feitoEm: carimbo(-10) },
        { id: "ckex2", texto: "Análise rodando na pipeline", feito: true, feitoEm: carimbo(-5) },
        { id: "ckex3", texto: "Triagem dos primeiros achados feita", feito: false },
        { id: "ckex4", texto: "Time treinado", feito: false },
      ],
      registros: [
        criada(-21),
        reg("reuniao", -18, "Kickoff com o squad", {
          hora: "10:00", participantes: ["Marina", "Felipe", "Bruno"],
          anotacoes: "marina topou, felipe da arquitetura validou o desenho. falta acesso ao repositório do checkout. bloqueio só para crítico no começo.",
          resumoIA: "Alinhamos o escopo do onboarding. O time vai integrar a análise na pipeline até o fim do mês e a arquitetura validou o desenho.",
          decisoes: "- Começar pelo repositório de checkout\n- Bloqueio só para severidade crítica no início",
          proximosPassos: [passo("Enviar documentação de integração para o squad", { responsavel: "Eu", feito: true, feitoEm: carimbo(-16) }), passo("Liberar acesso ao repositório de checkout", { responsavel: "Marina" })],
          impedimentos: "Aguardando liberação de acesso pelo time de plataforma",
        }),
        mudou(-18, "a_fazer", "em_andamento", "Em andamento"),
        reg("atividade", -16, "Enviei a documentação de integração", { resumoIA: "Documentação enviada ao squad, com o passo a passo da pipeline." }),
        reg("reuniao", -4, "Revisão dos primeiros resultados", {
          hora: "15:30", participantes: ["Marina", "Bruno"],
          resumoIA: "A primeira análise trouxe 42 achados, 3 críticos. O squad pediu ajuda para priorizar e quer uma sessão de triagem.",
          decisoes: "- Triagem conjunta dos críticos antes de ligar o bloqueio",
          proximosPassos: [
            passo("Agendar sessão de triagem dos 3 críticos", { responsavel: "Eu", prazo: dia(0) }),
            passo("Montar guia rápido de falso positivo", { responsavel: "Eu", prazo: dia(3) }),
            passo("Corrigir os críticos do checkout", { responsavel: "Bruno" }),
          ],
        }),
      ],
    },
    {
      id: "tex2", titulo: "Trilha de formação do time (turma 2)", categoriaId: "cexcha", status: "em_andamento", prioridade: 7, prazo: dia(12), tags: ["treinamento"], focoEm: dia(0),
      descricao: "Montar e rodar a segunda turma da trilha, com 6 encontros.",
      registros: [
        criada(-30, "em_andamento"),
        reg("reuniao", -12, "Definição do conteúdo com a liderança", {
          participantes: ["Camila", "Rafael"], resumoIA: "Fechamos os 6 temas da trilha e o formato de 1h por encontro, com exercício prático.",
          decisoes: "- Seis encontros de uma hora, com exercício prático",
          proximosPassos: [passo("Escrever o roteiro do encontro 1", { responsavel: "Eu" }), passo("Reservar sala e agenda dos 6 encontros", { responsavel: "Camila", feito: true, feitoEm: carimbo(-9) })],
        }),
        reg("decisao", -9, "Certificado interno ao final", { resumoIA: "Quem completar 5 de 6 encontros recebe o certificado.", decisoes: "- Certificado para quem completar 5 de 6 encontros" }),
      ],
    },
    {
      id: "tex3", titulo: "Correção da falha crítica na API de cadastro", categoriaId: "cexvul", status: "aguardando", prioridade: 10, prazo: dia(-2), tags: ["crítico"], lembrarEm: dia(0),
      esperando: { quem: "Bruno Lima", oQue: "subir a correção para homologação", desde: dia(-8), cobradoEm: dia(-4) },
      descricao: "Falha encontrada num teste. O squad precisa corrigir e eu valido.",
      registros: [
        criada(-14),
        reg("reuniao", -13, "Apresentação do achado ao squad", {
          participantes: ["Bruno", "Marina"], resumoIA: "O squad entendeu o risco e se comprometeu a corrigir em uma sprint. Pediram um exemplo de correção.",
          proximosPassos: [passo("Enviar exemplo de correção", { responsavel: "Eu", feito: true, feitoEm: carimbo(-12) }), passo("Subir a correção para homologação", { responsavel: "Bruno", prazo: dia(-3) })],
        }),
        mudou(-8, "a_fazer", "aguardando", "Aguardando terceiros"),
      ],
    },
    {
      id: "tex4", titulo: "Ajuste dos servidores do ambiente de homologação", categoriaId: "cexinf", status: "bloqueada", prioridade: 6, prazo: dia(20), tags: ["infra"],
      descricao: "Aplicar o padrão aprovado nos servidores de homologação.",
      registros: [
        criada(-25),
        reg("impedimento", -6, "Janela de mudança negada", {
          participantes: ["Rafael"], resumoIA: "O comitê negou a janela desta semana por causa do fechamento do mês.", impedimentos: "Sem janela de mudança até o dia 5.",
          proximosPassos: [passo("Reabrir o pedido de janela depois do fechamento", { responsavel: "Eu" })],
        }),
        mudou(-6, "a_fazer", "bloqueada", "Bloqueada"),
      ],
    },
    {
      id: "tex5", titulo: "Revisar a política de exceções", categoriaId: "cexvul", status: "a_fazer", prioridade: 5, prazo: dia(0), tags: ["política"],
      descricao: "A política atual não define prazo máximo de exceção.",
      registros: [criada(-10), reg("nota", -10, "Pontos a revisar", { anotacoes: "prazo máximo, quem aprova, renovação automática não pode." })],
    },
    {
      id: "tex6", titulo: "Painel de métricas de adoção da Ferramenta X", categoriaId: "cexfer", status: "a_fazer", prioridade: 4, prazo: null, tags: ["métricas"],
      descricao: "Mostrar por squad: repositórios cobertos, achados abertos e tempo médio de correção.",
      registros: [
        criada(-19),
        reg("reuniao", -19, "Levantamento com o time de dados", {
          participantes: ["Felipe"], resumoIA: "Os dados já existem na ferramenta. Falta decidir onde o painel vai morar.",
          proximosPassos: [passo("Definir onde hospedar o painel", { responsavel: "Eu" }), passo("Mapear os campos disponíveis", { responsavel: "Felipe" })],
        }),
      ],
    },
    {
      id: "tex7", titulo: "Onboarding do squad de Cartões na Ferramenta X", categoriaId: "cexfer", status: "concluida", prioridade: 6, prazo: dia(-15), tags: ["pipeline", "onboarding"], concluidaEm: carimbo(-3),
      descricao: "Primeiro squad a entrar. Serviu de piloto.",
      registros: [
        criada(-50, "em_andamento"),
        reg("reuniao", -45, "Kickoff do piloto", { participantes: ["Felipe", "Camila"], resumoIA: "Piloto aprovado. O squad de Cartões integra em duas semanas.", decisoes: "- O squad de Cartões é o piloto" }),
        reg("atividade", -30, "Pipeline integrada", { resumoIA: "Análise rodando em todos os repositórios do squad." }),
        mudou(-3, "em_andamento", "concluida", "Concluída"),
      ],
    },
    {
      id: "tex8", titulo: "Responder o questionário de auditoria", categoriaId: null, status: "a_fazer", prioridade: 8, prazo: dia(5), tags: ["auditoria"],
      descricao: "Questionário com 30 perguntas. Preciso de evidências de outro time.", registros: [criada(-2)],
    },
  ].map((t) => ({ ...t, criadaEm: (t.registros[0] as { criadoEm: string }).criadoEm, atualizadaEm: carimbo(0, 9) }));

  // ---------- links, página, folha, modelo ----------
  const links = [
    { id: "lex1", tipo: "link", titulo: "Documentação de integração da Ferramenta X", url: "https://exemplo.local/docs/ferramenta-x", descricao: "Passo a passo da pipeline", tags: ["guia"], tarefaId: "tex1", tarefaIds: ["tex1"], categoriaId: "cexfer" },
    { id: "lex2", tipo: "link", titulo: "Padrão aprovado para os servidores", url: "https://exemplo.local/padrao", descricao: "", tags: ["padrão"], tarefaId: "tex4", tarefaIds: ["tex4"], categoriaId: "cexinf" },
    { id: "lex3", tipo: "link", titulo: "Chamado 4521: janela de mudança em homologação", url: "https://exemplo.local/chamados/4521", descricao: "Aberto com o time de plataforma", tags: ["chamado"], tarefaId: "tex4", tarefaIds: ["tex4"], categoriaId: "cexinf", estado: "aguardando", estadoEm: carimbo(-6), trava: ["tex4"] },
    { id: "lex4", tipo: "link", titulo: "Guia de triagem de achados", url: "https://exemplo.local/docs/triagem", descricao: "Como classificar o que a análise acha", tags: ["guia"], tarefaId: "tex1", tarefaIds: ["tex1", "tex6"], categoriaId: "cexfer", estado: "para_ler", estadoEm: carimbo(-2) },
  ].map((l) => ({ ...l, criadoEm: carimbo(-7), atualizadoEm: carimbo(-7) }));

  const paginas = [
    {
      id: "pgex1", titulo: "Como entra um squad novo na Ferramenta X", categoriaId: "cexfer", tags: ["onboarding"], estado: "publicada", tarefaIds: ["tex1", "tex7"],
      texto: "## Antes de começar\n\nPeça o acesso aos repositórios e combine a conversa de abertura.\n\n## Na pipeline\n\n- Ligar a análise\n- Fazer a triagem dos primeiros achados\n\n> [!DICA] Comece por um repositório pequeno.",
      criadaEm: carimbo(-15), atualizadaEm: carimbo(-3),
    },
  ];
  const notas = [
    { id: "nex1", titulo: "Dúvidas para a próxima conversa com Pagamentos", texto: "- Quem aprova a exceção do repositório legado?\n- A análise roda em todo commit ou só no merge?", tarefaIds: ["tex1"], criadaEm: carimbo(-1), atualizadaEm: carimbo(-1) },
  ];
  const modelos = [
    {
      id: "moex1", nome: "Levar a Ferramenta X para um squad", quando: "sempre que um squad novo entrar", titulo: "Onboarding do squad ... na Ferramenta X",
      descricao: "Colocar a análise da Ferramenta X na pipeline do squad e treinar o time.", categoriaId: "cexfer", prioridade: 7, tags: ["pipeline", "onboarding"], prazoEmDias: 30, usos: 1,
      passos: ["Agendar a conversa de abertura com o squad", "Pedir acesso aos repositórios", "Ligar a análise na pipeline", "Fazer a triagem dos primeiros achados", "Treinar o time"],
      checklist: ["Acesso aos repositórios liberado", "Análise rodando na pipeline", "Time treinado"],
      criadoEm: carimbo(-20), atualizadoEm: carimbo(-20),
    },
  ];
  const assuntos = [
    { id: "asex1", pessoa: "Marina Souza", texto: "Combinar a data da sessão de triagem", tarefaId: "tex1", criadoEm: carimbo(-1), atualizadoEm: carimbo(-1) },
  ];

  // ---------- rotina: o dia padrão, uns dias de ponto e o plano de hoje, com uma reunião ----------
  const padrao = () => [
    { id: id("bl"), inicio: "08:00", fim: "10:00", titulo: "Chamados", tipo: "atividade" },
    { id: id("bl"), inicio: "12:00", fim: "13:00", titulo: "Almoço", tipo: "pausa" },
  ];
  const pontos = [["08:05", "17:20"], ["08:30", "17:10"], ["07:55", "18:15"], ["08:10", "16:40"], ["08:00", "17:00"]];
  const jornada: Record<string, unknown>[] = [{ id: "config", padrao: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, padrao()])) }];
  let usados = 0;
  for (let delta = -9; delta < 0 && usados < pontos.length; delta++) {
    if (!util(delta)) continue;
    const [entrada, saida] = pontos[usados++];
    jornada.push({ id: dia(delta), ponto: { entrada, saida, pausas: [{ inicio: "12:00", fim: "13:00" }] }, jornadaMin: 480, pausaMin: 60 });
  }
  jornada.push({
    id: dia(0), planejado: true,
    blocos: [
      ...padrao(),
      { id: "blex1", inicio: "10:00", fim: "11:30", titulo: "Onboarding do squad de Pagamentos", tipo: "tarefa", tarefaId: "tex1" },
      { id: "blex2", inicio: "14:00", fim: "15:00", titulo: "Alinhamento com o squad de Pagamentos", tipo: "atividade", reuniao: { participantes: ["Marina Souza", "Bruno Lima"], tarefaId: "tex1" } },
      { id: "blex3", inicio: "15:30", fim: "17:00", titulo: "Revisar a política de exceções", tipo: "tarefa", tarefaId: "tex5" },
    ],
  });

  const colecao = <T,>(items: T[]) => ({ rev: 0, items });
  return {
    exportadoEm: carimbo(0, 9),
    schema: SCHEMA_APP,
    tarefas,
    categorias: colecao(categorias),
    links: colecao(links),
    pessoas: colecao(pessoas),
    times: colecao(times),
    notas: colecao(notas),
    modelos: colecao(modelos),
    paginas: colecao(paginas),
    jornada: colecao(jornada),
    assuntos: colecao(assuntos),
  };
}
