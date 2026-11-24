// Ajuda desta tela (3.22): para que serve cada tela, como usar em poucos passos, o que dá para "mostrar na tela"
// e os atalhos que só valem ali. É o conteúdo do painel de ajuda (tecla ?), em components/shell/Ajuda.tsx.
//
// Só dados e funções puras: o painel desenha, o holofote aponta. Toda tela do menu tem uma entrada
// (testes/ajuda.test.mjs confere), e o e2e confere que cada alvo de "mostrar na tela" existe na tela dele.
// Textos em português do Brasil, com os nomes do glossário da seção 13 do AGENTS.md, e sem travessão.

/** Um lugar da interface para o holofote apontar. */
export interface Alvo {
  /** A tela em que o lugar fica. null = a tela em que o usuário já está (o lugar existe em todas, como a barra lateral). */
  rota: string | null;
  /** Seletor CSS do elemento. Use data-slot ou data-acao, que não mudam com o texto. */
  seletor: string;
  titulo: string;
  texto: string;
}

export interface AjudaDaTela {
  /** A rota do menu ("/tarefas"), ou um padrão com [id] ("/tarefas/[id]"). */
  rota: string;
  titulo: string;
  /** Para que serve, em uma ou duas frases. */
  paraQue: string;
  /** Como usar, em três a cinco passos curtos. */
  como: string[];
  mostrar: { rotulo: string; alvo: Alvo }[];
  /** Atalhos que só valem nesta tela (os gerais ficam em components/shell/navegacao.ts). */
  atalhos: { teclas: string[]; descricao: string }[];
}

const NOVA_TAREFA: Alvo = {
  rota: null, seletor: "[data-slot=nova-tarefa], [data-slot=lateral] [aria-label='Nova tarefa']", titulo: "Nova tarefa",
  texto: "Cria uma tarefa de qualquer tela. A tecla N faz o mesmo. A setinha ao lado cria categoria, página, folha, link, pessoa, time ou modelo.",
};
const PERFIL: Alvo = {
  rota: null, seletor: "[data-slot=seletor-perfil]", titulo: "Perfil de uso",
  texto: "Troca o arranjo do app para o dia que você tem: Completo, Foco, Reuniões, Gestão, Estudo ou os seus. A tecla P abre este menu.",
};

export const AJUDA: AjudaDaTela[] = [
  {
    rota: "/", titulo: "Hoje",
    paraQue: "É por onde o dia começa. Mostra a próxima ação, o que precisa de você, o foco que você escolheu e a semana que vem pela frente.",
    como: [
      "Comece pela Próxima ação: uma coisa a fazer, com o motivo e um botão. \"Agora não\" passa para a seguinte.",
      "Use Planejar o dia para escolher poucas tarefas como foco de hoje.",
      "Em Precisa de você, resolva ou adie o que está com prazo estourado, passo atrasado ou retorno pendente.",
      "Anote o que surgir no campo de captura e aperte Enter: vira tarefa na hora.",
      "No fim do expediente, Fechar o dia mostra o que saiu e monta a daily.",
    ],
    mostrar: [
      { rotulo: "A próxima ação", alvo: { rota: "/", seletor: "[data-slot=proxima-acao]", titulo: "Próxima ação", texto: "Uma coisa a fazer agora, escolhida por uma ordem fixa: reunião, o bloco da rotina, o que está estourado, o próximo passo do seu foco. O botão faz; \"Agora não\" dispensa por hoje." } },
      { rotulo: "Planejar o dia", alvo: { rota: "/", seletor: "[data-acao=planejar-o-dia]", titulo: "Planejar o dia", texto: "Um ritual curto: o que ficou para trás, quais tarefas são o foco de hoje e pronto. A tecla D abre de qualquer tela." } },
      { rotulo: "O campo de captura", alvo: { rota: "/", seletor: "[data-slot=captura-rapida]", titulo: "Captura rápida", texto: "Escreva e aperte Enter. A tarefa nasce sem formulário, para você não perder o que lembrou." } },
      { rotulo: "O perfil de uso", alvo: PERFIL },
    ],
    atalhos: [],
  },
  {
    rota: "/tarefas", titulo: "Tarefas",
    paraQue: "Todas as tarefas, com filtros, ordenação e três visões: grade, lista e quadro por status.",
    como: [
      "Crie com Nova tarefa (tecla N). Só o título é obrigatório.",
      "Filtre por texto, categoria, status ou tag. A combinação que você usa sempre pode virar uma visão salva.",
      "No quadro, arrastar um cartão muda o status.",
      "Marque várias tarefas para mudar status, prioridade, categoria, prazo ou foco de uma vez. Tem um desfazer só.",
    ],
    mostrar: [
      { rotulo: "Nova tarefa", alvo: NOVA_TAREFA },
      { rotulo: "Ordenar", alvo: { rota: "/tarefas", seletor: "[data-slot=ordenacao]", titulo: "Ordenação", texto: "Muda a ordem em que as tarefas aparecem. A escolha fica lembrada." } },
      { rotulo: "Visões salvas", alvo: { rota: "/tarefas", seletor: "[data-slot=visoes-salvas]", titulo: "Visões salvas", texto: "Guarda a combinação de filtros e ordem de agora com um nome, para voltar com um clique ou pela paleta." } },
    ],
    atalhos: [
      { teclas: ["J"], descricao: "Próxima tarefa (ou seta para baixo)" },
      { teclas: ["K"], descricao: "Tarefa anterior (ou seta para cima)" },
      { teclas: ["Enter"], descricao: "Abrir a tarefa" },
      { teclas: ["F"], descricao: "Pôr ou tirar do foco de hoje" },
      { teclas: ["M"], descricao: "Abrir o menu da tarefa" },
      { teclas: ["X"], descricao: "Marcar a tarefa para ações em lote" },
      { teclas: ["Ctrl", "A"], descricao: "Marcar todas as que estão na tela" },
    ],
  },
  {
    rota: "/tarefas/[id]", titulo: "Página da tarefa",
    paraQue: "A história da tarefa numa linha do tempo: cada reunião, atividade, decisão e impedimento vira um registro, com os próximos passos que ficaram combinados.",
    como: [
      "Registre o que aconteceu com os botões Reunião, Atividade e os outros tipos. Pode escrever solto, do seu jeito.",
      "Se quiser, copie o prompt, cole no Copilot e traga a resposta: os campos se preenchem e você revisa antes de salvar.",
      "Os próximos passos de cada registro aparecem em Pendências, à direita. Marque quando fizer.",
      "O Checklist é a lista do que a tarefa precisa para ficar pronta. Não tem responsável nem prazo.",
      "Modo reunião abre a pauta e captura decisões e passos durante a conversa.",
    ],
    mostrar: [
      { rotulo: "Registrar uma reunião", alvo: { rota: "/tarefas/[id]", seletor: "[data-slot=registrar][data-tipo=reuniao]", titulo: "Registrar", texto: "Cada conversa vira um registro na linha do tempo, com resumo, decisões, próximos passos e impedimentos." } },
      { rotulo: "O checklist", alvo: { rota: "/tarefas/[id]", seletor: "[data-slot=checklist-tarefa]", titulo: "Checklist", texto: "O que a entrega precisa ter. Enter adiciona, e colar uma lista cria um item por linha." } },
    ],
    atalhos: [{ teclas: ["Ctrl", "Enter"], descricao: "Salvar o registro aberto" }],
  },
  {
    rota: "/tarefas/[id]/reuniao", titulo: "Modo reunião",
    paraQue: "O antes, o durante e o depois de uma reunião da tarefa: a pauta à esquerda, as anotações no meio e as decisões e os passos à direita.",
    como: [
      "Antes: confira a pauta (pendências, últimas decisões e o que está com cada participante) e copie para mandar.",
      "Durante: anote solto no meio. Decisão e próximo passo têm campo próprio à direita.",
      "Marque na pauta os passos antigos que foram resolvidos na conversa.",
      "Encerrar grava tudo como um registro de reunião e monta a ata para copiar.",
    ],
    mostrar: [],
    atalhos: [
      { teclas: ["Alt", "1"], descricao: "Ir para o campo de decisão" },
      { teclas: ["Alt", "2"], descricao: "Ir para o campo de próximo passo" },
    ],
  },
  {
    rota: "/rotina", titulo: "Rotina",
    paraQue: "O dia em blocos de horário, o ponto (entrada, pausas e saída) e o banco de horas.",
    como: [
      "Registre a entrada: o app calcula a hora de sair e avisa quando as horas forem cumpridas.",
      "Reserve horários com Novo bloco: para uma tarefa, uma atividade ou uma pausa. Arraste para mudar o horário.",
      "Marque um bloco como reunião para ele aparecer na tela Hoje com a pauta.",
      "O dia padrão é o que se repete em cada dia da semana. Mexer num dia não muda o padrão.",
    ],
    mostrar: [
      { rotulo: "Novo bloco", alvo: { rota: "/rotina", seletor: "[data-slot=novo-bloco]", titulo: "Novo bloco", texto: "Reserva um horário do dia. Ligue \"É uma reunião\" para informar os participantes e a tarefa." } },
      { rotulo: "O ponto de hoje", alvo: { rota: "/rotina", seletor: "[data-slot=painel-do-ponto]", titulo: "Ponto", texto: "Entrada, pausas e saída. A conta da hora de sair aparece explicada, e o saldo vai para o banco de horas." } },
    ],
    atalhos: [],
  },
  {
    rota: "/pendencias", titulo: "Pendências",
    paraQue: "Todos os passos em aberto, de todas as tarefas, para bater o olho e ir marcando.",
    como: [
      "Agrupe por tarefa, por prazo ou por pessoa.",
      "Marque o passo quando fizer. Dá para desfazer logo em seguida.",
      "Por pessoa, Copiar mensagem gera a cobrança pronta para colar na conversa.",
      "Se o mesmo passo aparecer duas vezes, o aviso de passos repetidos junta sem perder nada.",
    ],
    mostrar: [{ rotulo: "Agrupar", alvo: { rota: "/pendencias", seletor: "[data-slot=pagina] [data-slot=segmentado]", titulo: "Agrupar", texto: "Por tarefa, por prazo ou por pessoa. \"Só os meus\" esconde o que é de outras pessoas." } }],
    atalhos: [],
  },
  {
    rota: "/notas", titulo: "Notas",
    paraQue: "Um bloco de notas para escrever sem pensar em onde guardar. Depois, o Copilot ajuda a transformar a folha em registros e tarefas.",
    como: [
      "Abra uma folha e escreva. Salva sozinho.",
      "Organizar com o Copilot monta um prompt com a folha e as tarefas abertas. Você cola a resposta e confere a prévia.",
      "Nada é gravado antes de você aplicar, e a folha original fica arquivada com o texto inteiro.",
    ],
    mostrar: [],
    atalhos: [{ teclas: ["A"], descricao: "Anotar rápido, de qualquer tela" }],
  },
  {
    rota: "/paginas", titulo: "Páginas",
    paraQue: "O conhecimento que vale além de uma tarefa: como se faz, decisões que ficam, guias. Em árvore, com links entre páginas.",
    como: [
      "Crie uma página e escreva com títulos, listas, tabelas, imagens e anexos.",
      "Digite [[ para ligar a outra página e @ para citar tarefa, pessoa, folha ou link.",
      "Uma página pode ter subpáginas e servir a várias tarefas.",
      "O histórico guarda as versões: dá para comparar e restaurar.",
    ],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/perguntar", titulo: "Perguntar",
    paraQue: "Acha a resposta no que você já registrou. O Nexo junta os trechos certos num prompt para o Copilot responder com base no seu histórico.",
    como: ["Escreva a pergunta.", "Confira os trechos que o Nexo separou e copie o prompt.", "Cole no Copilot. A resposta cita de onde veio cada parte."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/categorias", titulo: "Categorias",
    paraQue: "Os assuntos em que as tarefas se agrupam. Cada categoria tem a sua página, com as tarefas, as pessoas e a referência do assunto. A aba Tags cuida das etiquetas livres.",
    como: [
      "Crie uma categoria com nome e cor.",
      "Abra a categoria para ver tudo o que é dela e gerar um panorama com o Copilot.",
      "Na aba Tags, renomeie, junte as parecidas e tire as que não servem mais.",
    ],
    mostrar: [{ rotulo: "Nova categoria", alvo: { rota: "/categorias", seletor: "[data-slot=nova-categoria]", titulo: "Nova categoria", texto: "Um nome e uma cor. Onde se escolhe uma categoria também dá para criar a que falta, digitando o nome." } }],
    atalhos: [],
  },
  {
    rota: "/pessoas", titulo: "Pessoas",
    paraQue: "Com quem você trabalha: o que cada pessoa faz, em que pode ajudar, o que está com ela e o que você anotou para falar com ela.",
    como: [
      "As pessoas aparecem sozinhas a partir dos participantes dos registros. Cadastre as que importam.",
      "Na página da pessoa: os passos em aberto com ela, as tarefas em que você espera retorno e os assuntos para a próxima conversa.",
      "Times juntam pessoas e categorias.",
    ],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/links", titulo: "Links e docs",
    paraQue: "O material de trabalho: links, documentos e arquivos, ligados às tarefas e às categorias a que servem, com status para o que é chamado ou leitura.",
    como: [
      "Adicione um link ou arraste um arquivo. Um mesmo item pode servir a várias tarefas.",
      "Dê um status (para ler, em andamento, aguardando retorno, concluído) e filtre por ele.",
      "Um chamado pode ser marcado como trava de uma tarefa: aparece no cabeçalho dela.",
      "Clique num arquivo para ver por dentro do app, sem baixar.",
    ],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/radar", titulo: "Radar",
    paraQue: "A saúde de cada categoria e os prazos, num olhar: o que está em dia, o que pede atenção e o que travou.",
    como: ["Veja cada categoria com o que está aberto, atrasado e parado.", "Copie o status de uma categoria para mandar.", "Use a linha de prazos para ver o que vence nas próximas semanas."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/diario", titulo: "Diário",
    paraQue: "O que aconteceu, dia a dia: registros, passos concluídos e tarefas fechadas, na ordem em que foram feitos.",
    como: ["Role pelos dias, do mais recente para o mais antigo.", "Clique num item para ir à tarefa."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/revisao", titulo: "Revisão semanal",
    paraQue: "Uma passada por todas as tarefas abertas, das mais esquecidas para as mais recentes, para nada ficar parado sem você saber.",
    como: ["Para cada tarefa: registre o que mudou, ajuste prazo e status, ou marque um lembrete de voltar.", "A barra lateral avisa quando faz sete dias da última revisão."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/relatorios", titulo: "Relatórios",
    paraQue: "O que foi feito num período, pronto para virar status report: entregas, reuniões, pendências e impedimentos.",
    como: ["Escolha o período.", "Confira os números e a lista do que andou.", "Copie o prompt para o Copilot escrever o relatório com base só nos seus registros."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/conquistas", titulo: "Conquistas",
    paraQue: "O seu progresso: o nível e a meta do dia. É um incentivo, não uma cobrança.",
    como: ["A meta do dia é quantos passos e registros você quer fechar.", "Dá para ajustar a meta ou desligar as comemorações em Configurações."],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/configuracoes", titulo: "Configurações",
    paraQue: "Onde os dados moram, os backups, a lixeira, os modelos de tarefa, os lembretes e como você aparece nos passos.",
    como: [
      "A pasta de dados é sua: de preferência no OneDrive, para ter backup e histórico.",
      "Em \"Como você aparece nos passos\", ponha os nomes pelos quais você é citado. É isso que faz \"só os meus\" funcionar.",
      "Backups são diários e automáticos. Qualquer um pode ser restaurado, com prévia.",
      "Exportar gera um arquivo com tudo. Importar soma o que falta e nunca apaga.",
    ],
    mostrar: [],
    atalhos: [],
  },
  {
    rota: "/busca", titulo: "Busca",
    paraQue: "Procura em tudo: tarefas, registros, checklist, links, pessoas e times, sem diferenciar acento nem maiúscula.",
    como: ["Com várias palavras, o resultado precisa ter todas.", "O resultado de um registro abre a tarefa já no ponto certo.", "Perguntar ao Copilot leva o termo para a tela Perguntar."],
    mostrar: [],
    atalhos: [{ teclas: ["/"], descricao: "Buscar, de qualquer tela" }],
  },
];

/** A ajuda da tela em que o usuário está. Cai na da tela Hoje se a rota não tiver uma (não deveria acontecer). */
export function ajudaDaRota(pathname: string): AjudaDaTela {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (/^\/tarefas\/[^/]+\/reuniao$/.test(p)) return AJUDA.find((a) => a.rota === "/tarefas/[id]/reuniao")!;
  if (/^\/tarefas\/[^/]+$/.test(p)) return AJUDA.find((a) => a.rota === "/tarefas/[id]")!;
  const exata = AJUDA.find((a) => a.rota === p);
  if (exata) return exata;
  // "/categorias/abc" usa a ajuda de "/categorias"
  const porPrefixo = AJUDA.filter((a) => a.rota !== "/" && !a.rota.includes("[") && p.startsWith(a.rota + "/")).sort((a, b) => b.rota.length - a.rota.length)[0];
  return porPrefixo ?? AJUDA[0];
}

/** O alvo está na tela em que o usuário está? (Rota nula = existe em todas.) */
export function alvoEstaAqui(alvo: Alvo, pathname: string): boolean {
  if (alvo.rota === null) return true;
  return ajudaDaRota(pathname).rota === alvo.rota;
}

/** As palavras do app que confundem quem está chegando. */
export const GLOSSARIO: { termo: string; explicacao: string }[] = [
  { termo: "Registro", explicacao: "Um acontecimento na linha do tempo da tarefa: reunião, atividade, decisão, impedimento ou nota." },
  { termo: "Passo", explicacao: "O que ficou combinado de fazer num registro, com responsável e prazo. Os não feitos são os passos em aberto." },
  { termo: "Pendências", explicacao: "A lista de todos os passos em aberto. É uma tela e também um painel na página da tarefa." },
  { termo: "Checklist", explicacao: "A lista do que a tarefa precisa para ficar pronta. Não tem responsável nem prazo, e não entra em Pendências." },
  { termo: "Foco de hoje", explicacao: "As poucas tarefas que você escolheu para o dia. No dia seguinte deixam de ser foco sozinhas." },
  { termo: "Próxima ação", explicacao: "A coisa a fazer agora, escolhida pelo app por uma ordem fixa. Você pode dispensar com \"Agora não\"." },
  { termo: "Lembrete de voltar", explicacao: "Uma data para a tarefa voltar a aparecer em \"Precisa de você\"." },
  { termo: "Perfil de uso", explicacao: "Um arranjo do app com nome: o que aparece no menu, nas barras e na tela Hoje. Não muda suas tarefas." },
  { termo: "Rotina", explicacao: "O dia em blocos de horário, com o ponto e o banco de horas." },
];
