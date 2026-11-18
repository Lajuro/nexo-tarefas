// Tipos compartilhados entre o servidor (que grava os JSON) e a interface.
// Regra de ouro: campos novos SEMPRE entram como opcionais e ganham valor padrão
// em normalizar*(). Assim um arquivo antigo continua abrindo numa versão nova.

export type Status =
  | "a_fazer"
  | "em_andamento"
  | "aguardando"
  | "bloqueada"
  | "concluida"
  | "cancelada";

export const STATUS: { id: Status; nome: string }[] = [
  { id: "a_fazer", nome: "A fazer" },
  { id: "em_andamento", nome: "Em andamento" },
  { id: "aguardando", nome: "Aguardando terceiros" },
  { id: "bloqueada", nome: "Bloqueada" },
  { id: "concluida", nome: "Concluída" },
  { id: "cancelada", nome: "Cancelada" },
];

export const STATUS_ABERTOS: Status[] = ["a_fazer", "em_andamento", "aguardando", "bloqueada"];

export type TipoRegistro = "reuniao" | "atividade" | "impedimento" | "decisao" | "nota" | "marco";

export const TIPOS_REGISTRO: { id: TipoRegistro; nome: string; icone: string }[] = [
  { id: "reuniao", nome: "Reunião", icone: "👥" },
  { id: "atividade", nome: "Atividade", icone: "🛠️" },
  { id: "impedimento", nome: "Impedimento", icone: "⛔" },
  { id: "decisao", nome: "Decisão", icone: "✅" },
  { id: "nota", nome: "Nota", icone: "📝" },
  { id: "marco", nome: "Marco", icone: "🚩" },
];

export interface Passo {
  id: string;
  texto: string;
  feito: boolean;
  feitoEm?: string | null;
  responsavel?: string;
  prazo?: string | null;
  [extra: string]: unknown;
}

export interface Alteracao<T = string | number | null> {
  de: T;
  para: T;
}

export interface Registro {
  id: string;
  tipo: TipoRegistro;
  data: string; // AAAA-MM-DD
  hora?: string; // HH:MM
  titulo: string;
  participantes: string[];
  anotacoes: string; // anotações brutas
  resumoIA: string;
  decisoes: string;
  proximosPassos: Passo[];
  impedimentos: string;
  respostaIABruta?: string;
  /** Folha do bloco de notas de onde este registro nasceu (para voltar ao texto original). */
  notaId?: string;
  /** Conhecimento que vale além desta tarefa: aparece em "Referência do assunto" na página da categoria. */
  referencia?: boolean;
  /** Minutos de uma sessão de foco registrada (0 ou ausente = não veio de uma sessão). */
  duracaoMin?: number;
  alteracoes?: {
    status?: Alteracao<string>;
    prioridade?: Alteracao<number>;
    prazo?: Alteracao<string | null>;
  };
  criadoEm: string;
  atualizadoEm: string;
  [extra: string]: unknown;
}

/** De quem (e do quê) a tarefa está esperando retorno. Só faz sentido com status "aguardando". */
export interface Espera {
  quem: string;
  oQue: string;
  /** AAAA-MM-DD em que a espera começou. */
  desde: string;
  /** AAAA-MM-DD da última cobrança, se houve. */
  cobradoEm?: string | null;
}

export interface Tarefa {
  id: string;
  rev: number;
  titulo: string;
  descricao: string;
  categoriaId: string | null;
  status: Status;
  prioridade: number; // 1 a 10, quanto maior mais urgente
  prazo: string | null;
  tags: string[];
  registros: Registro[];
  panoramaIA?: { texto: string; geradoEm: string } | null;
  criadaEm: string;
  atualizadaEm: string;
  concluidaEm?: string | null;
  /** Data (AAAA-MM-DD) em que o usuário quer ser lembrado de voltar nesta tarefa (follow-up). */
  lembrarEm?: string | null;
  /** Dia (AAAA-MM-DD) em que a tarefa foi escolhida como foco. Só vale como foco se for hoje. */
  focoEm?: string | null;
  /** Presa na barra lateral, para abrir com um clique. */
  fixada?: boolean;
  /** Quem ficou de responder e o quê. Limpo quando a tarefa sai de "aguardando" (vira observação do marco). */
  esperando?: Espera | null;
  /** Ids das tarefas de que esta depende (3.6). As contas (quem segura quem, o que destravou) estão em lib/dependencias.ts. */
  dependeDe?: string[];
  [extra: string]: unknown;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  arquivada?: boolean;
  criadaEm: string;
  atualizadaEm: string;
  [extra: string]: unknown;
}

export interface LinkDoc {
  id: string;
  tipo: "link" | "arquivo";
  titulo: string;
  url?: string;
  arquivo?: string; // caminho relativo dentro de /arquivos
  nomeArquivo?: string;
  tamanho?: number;
  descricao: string;
  tags: string[];
  tarefaId?: string | null;
  categoriaId?: string | null;
  criadoEm: string;
  [extra: string]: unknown;
}

/**
 * Pessoa cadastrada (pessoas.json). Os registros e passos continuam guardando nomes como texto;
 * a ligação com o cadastro é feita na leitura, comparando o nome normalizado com `nome` e `apelidos`.
 */
export interface Pessoa {
  id: string; // novoId("pe")
  nome: string;
  /** Outros nomes pelos quais aparece nos registros (ex.: "Marina", "Marina S."). */
  apelidos: string[];
  email: string;
  /** Função ou papel. */
  cargo: string;
  /** Área, squad ou empresa (texto livre). */
  area: string;
  /** Com o que essa pessoa pode ajudar. */
  ajudaCom: string;
  anotacoes: string;
  /** Assuntos (categorias) aos quais está ligada. */
  categoriaIds: string[];
  tags: string[];
  arquivada?: boolean;
  origem?: "manual" | "registros" | "outlook";
  criadaEm: string;
  atualizadaEm: string;
  [extra: string]: unknown;
}

/** Time (times.json). Os vínculos com pessoas ficam aqui, não na Pessoa. */
export interface Time {
  id: string; // novoId("ti")
  nome: string;
  descricao: string;
  /** Uma das CORES. */
  cor: string;
  responsavelIds: string[];
  /** Inclui os responsáveis. */
  membroIds: string[];
  categoriaIds: string[];
  arquivado?: boolean;
  criadoEm: string;
  atualizadoEm: string;
  [extra: string]: unknown;
}

export interface Colecao<T> {
  rev: number;
  items: T[];
  [extra: string]: unknown;
}

/** O que nasceu de uma nota quando ela foi organizada (para achar depois de onde veio cada coisa). */
export interface FrutoDaNota {
  tipo: "registro" | "tarefa" | "passo";
  tarefaId: string;
  registroId?: string;
  /** Texto curto para mostrar na nota arquivada. Ex.: "Reunião em Onboarding do squad X". */
  rotulo: string;
}

/**
 * Folha do bloco de notas: texto livre, escrito sem escolher tarefa nem campo.
 * Depois o Copilot organiza (prompt + JSON de volta) e a folha é arquivada, nunca apagada.
 */
export interface Nota {
  id: string; // novoId("n")
  titulo: string;
  texto: string;
  /** Preenchido quando a nota foi organizada ou guardada à mão. Arquivada sai da lista do dia. */
  arquivadaEm?: string | null;
  /** O que foi criado a partir dela. */
  gerou?: FrutoDaNota[];
  /** O que a IA não conseguiu encaixar e o usuário não guardou em nenhuma tarefa. */
  sobras?: string;
  criadaEm: string;
  atualizadaEm: string;
  [extra: string]: unknown;
}

/**
 * Modelo de tarefa: o esqueleto de uma demanda que se repete (ex.: levar uma ferramenta para mais um squad).
 * Criar uma tarefa a partir dele preenche o formulário e já traz os passos de sempre.
 */
export interface Modelo {
  id: string; // novoId("mo")
  nome: string;
  /** Quando usar este modelo (aparece na lista de modelos). */
  quando: string;
  /** Título sugerido para a tarefa. O usuário completa (ex.: o nome do squad). */
  titulo: string;
  descricao: string;
  categoriaId: string | null;
  prioridade: number;
  tags: string[];
  /** Próximos passos que toda tarefa deste modelo começa tendo. */
  passos: string[];
  /** Prazo sugerido, em dias a partir da criação (null = sem prazo). */
  prazoEmDias?: number | null;
  /** Quantas tarefas já nasceram dele. */
  usos?: number;
  /** Demanda que se repete (3.6): de quanto em quanto tempo o app lembra de criar uma tarefa dele. */
  repetir?: RepeticaoDoModelo | null;
  criadoEm: string;
  atualizadoEm: string;
  [extra: string]: unknown;
}

/**
 * De quanto em quanto tempo um modelo vira tarefa. O app só LEMBRA (lembrete com "Criar agora" e "Pular esta vez"):
 * nunca cria tarefa sozinho, para não aparecer tarefa fantasma nas férias. As contas estão em lib/recorrencia.ts.
 */
export interface RepeticaoDoModelo {
  /** "semana": num dia da semana; "mes": num dia do mês; "dias": a cada N dias contados de `desde`. */
  tipo: "semana" | "mes" | "dias";
  /** 0 = domingo ... 6 = sábado (tipo "semana"). */
  diaDaSemana?: number;
  /** 1 a 31 (tipo "mes"). Mês mais curto: o último dia dele. */
  diaDoMes?: number;
  /** 1 a 365 (tipo "dias"). */
  cadaDias?: number;
  /** A partir de quando vale (AAAA-MM-DD). */
  desde: string;
  /** A última ocorrência já atendida, criada ou pulada (AAAA-MM-DD). */
  ultima?: string | null;
}

/**
 * Página de conhecimento: um documento em Markdown que não é tarefa nem reunião (um processo, um "como fazer",
 * os contatos de um assunto). Pode citar tarefas, pessoas e outras páginas com links internos ("nexo:...").
 */
export interface Pagina {
  id: string; // novoId("pg")
  titulo: string;
  texto: string; // Markdown
  categoriaId: string | null;
  tags: string[];
  /** Arquivada sai da lista, mas continua existindo (e os links para ela continuam funcionando). */
  arquivadaEm?: string | null;
  /** Página mãe (3.1): as páginas formam uma árvore. null = raiz. Mãe que não existe mais = raiz. */
  paiId?: string | null;
  /** Posição entre as irmãs (menor primeiro). Empate: ordem alfabética. */
  ordem?: number;
  /** Ícone escolhido, uma das chaves de ICONES_DE_PAGINA (lib/paginas.ts). "" = o padrão do tipo. */
  icone?: string;
  /** Em que pé está o documento (colunas do quadro de páginas). */
  estado?: EstadoPagina;
  /** Presa em "Favoritas" no explorador. É dado, para valer em qualquer PC. */
  fixada?: boolean;
  /** "video": a página gira em torno de um vídeo (player, transcrição, capítulos). Ausente = documento. */
  tipo?: "doc" | "video";
  /** O vídeo da página (3.3). O texto da página são as anotações sobre ele. */
  video?: VideoDaPagina | null;
  criadaEm: string;
  atualizadaEm: string;
  [extra: string]: unknown;
}

/**
 * O vídeo (ou áudio) de uma página de vídeo. De onde ele vem, em ordem de preferência:
 * `arquivo` (copiado para a pasta de dados), `caminho` (um arquivo deste computador, não copiado: só toca aqui)
 * ou `url` (link de fora: o app não toca, só abre em outra aba).
 */
export interface VideoDaPagina {
  /** Caminho relativo dentro de arquivos/ ("2026/abc-gravacao.mp4"). */
  arquivo?: string;
  nomeArquivo?: string;
  tamanho?: number;
  /** Caminho completo de um arquivo neste computador. Não é copiado nem vai para o backup. */
  caminho?: string;
  /** Link de fora (http ou https). */
  url?: string;
  /** Duração em segundos, anotada quando o vídeo abre. */
  duracao?: number;
  /** Transcrição: arquivo dentro de arquivos/ (VTT, SRT ou texto com tempos). */
  transcricao?: string;
  nomeTranscricao?: string;
  /** Capa: imagem dentro de arquivos/ (um quadro do vídeo). */
  capa?: string;
  /** Capítulos marcados pelo usuário, em ordem de tempo. */
  capitulos?: { t: number; titulo: string }[];
  [extra: string]: unknown;
}

const ANEXO_VALIDO = /^\d{4}\/[^/\\?#]{1,200}$/;
const anexo = (x: unknown) => (typeof x === "string" && ANEXO_VALIDO.test(x) && !x.includes("..") ? x : undefined);

export function normalizarVideo(v: unknown): VideoDaPagina | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const x = v as Partial<VideoDaPagina>;
  const duracao = Number(x.duracao);
  const url = typeof x.url === "string" && /^https?:\/\/[^\s]{1,2000}$/i.test(x.url.trim()) ? x.url.trim() : undefined;
  const caminho = typeof x.caminho === "string" && x.caminho.trim() && x.caminho.length <= 1000 && !/[\u0000-\u001f]/.test(x.caminho) ? x.caminho.trim() : undefined;
  const capitulos = (Array.isArray(x.capitulos) ? x.capitulos : [])
    .filter((c): c is { t: number; titulo: string } => !!c && typeof c === "object" && Number.isFinite(Number((c as { t?: unknown }).t)) && Number((c as { t: unknown }).t) >= 0)
    .slice(0, 200)
    .map((c) => ({ t: Math.round(Number(c.t)), titulo: str(c.titulo).slice(0, 200) }))
    .sort((a, b) => a.t - b.t);
  return {
    ...x,
    arquivo: anexo(x.arquivo),
    nomeArquivo: typeof x.nomeArquivo === "string" ? x.nomeArquivo.slice(0, 300) : undefined,
    tamanho: Number.isFinite(Number(x.tamanho)) && Number(x.tamanho) > 0 ? Number(x.tamanho) : undefined,
    caminho,
    url,
    duracao: Number.isFinite(duracao) && duracao > 0 ? Math.round(duracao) : undefined,
    transcricao: anexo(x.transcricao),
    nomeTranscricao: typeof x.nomeTranscricao === "string" ? x.nomeTranscricao.slice(0, 300) : undefined,
    capa: anexo(x.capa),
    capitulos,
  };
}

export type EstadoPagina = "rascunho" | "revisao" | "publicada";
export const ESTADOS_PAGINA: { id: EstadoPagina; nome: string }[] = [
  { id: "rascunho", nome: "Rascunho" },
  { id: "revisao", nome: "Em revisão" },
  { id: "publicada", nome: "Pronta" },
];

// ---------- jornada: a rotina do dia em blocos de horário e o ponto ----------

/** "tarefa": um bloco para uma tarefa do app. "atividade": trabalho que não é tarefa (chamados, e-mails). "pausa": almoço, jantar, intervalo. */
export type TipoDeBloco = "tarefa" | "atividade" | "pausa";
export const TIPOS_DE_BLOCO: TipoDeBloco[] = ["tarefa", "atividade", "pausa"];

/** Um bloco de horário do plano do dia. Sempre dentro do mesmo dia: o fim vem depois do início. */
export interface BlocoDaJornada {
  id: string;
  /** "HH:MM" */
  inicio: string;
  /** "HH:MM", depois do início */
  fim: string;
  titulo: string;
  tipo: TipoDeBloco;
  tarefaId?: string | null;
  nota?: string;
  /** O usuário marcou que cumpriu o bloco. */
  feito?: boolean;
}

export interface PausaDoPonto {
  inicio: string;
  /** null = a pausa ainda não acabou */
  fim: string | null;
}

/** O ponto do dia: a que horas entrou, as pausas e a que horas saiu. */
export interface PontoDoDia {
  entrada: string | null;
  saida: string | null;
  pausas: PausaDoPonto[];
}

/** Um dia da jornada. O id é a própria data (AAAA-MM-DD). */
export interface DiaDaJornada {
  id: string;
  tipo: "dia";
  data: string;
  /** false: o plano ainda é o dia padrão daquele dia da semana. true: "blocos" é o plano deste dia (mesmo vazio). */
  planejado: boolean;
  blocos: BlocoDaJornada[];
  ponto: PontoDoDia;
  /** Folga, feriado, férias: nada é esperado; o que for trabalhado conta como extra. */
  folga: boolean;
  /** Jornada esperada neste dia, em minutos, fixada quando a entrada é registrada (a configuração pode mudar depois). */
  jornadaMin: number | null;
  /** Pausa planejada neste dia, em minutos, fixada junto com a jornada. */
  pausaMin: number | null;
  obs: string;
  criadoEm: string;
  atualizadoEm: string;
}

export const ID_CONFIG_JORNADA = "config";

/** A configuração da jornada e o dia padrão de cada dia da semana. Mora na mesma coleção, com o id "config". */
export interface ConfigDaJornada {
  id: typeof ID_CONFIG_JORNADA;
  tipo: "config";
  /** Minutos de trabalho por dia (padrão 480 = 8h). */
  jornadaMin: number;
  /** Minutos de pausa por dia (padrão 60 = 1h de almoço). */
  pausaMin: number;
  /** Dias da semana em que há expediente: 0 = domingo ... 6 = sábado. */
  diasDeTrabalho: number[];
  /** Se a pausa não for registrada num dia de mais de 6h, desconta a pausa planejada. */
  descontarPausa: boolean;
  /** Saldo de banco de horas que já existia antes de começar a usar o app, em minutos. */
  saldoInicialMin: number;
  /** O dia padrão de cada dia da semana ("0" a "6"). */
  padrao: Record<string, BlocoDaJornada[]>;
  atualizadoEm: string;
}

export type ItemDaJornada = DiaDaJornada | ConfigDaJornada;

export interface Dados {
  tarefas: Tarefa[];
  categorias: Colecao<Categoria>;
  links: Colecao<LinkDoc>;
  pessoas: Colecao<Pessoa>;
  times: Colecao<Time>;
  notas: Colecao<Nota>;
  /** Ausente em dados lidos por código antigo: trate como vazio. */
  modelos: Colecao<Modelo>;
  /** Páginas de conhecimento. Ausente em dados lidos por código antigo: trate como vazio. */
  paginas: Colecao<Pagina>;
  /** Rotina do dia e ponto. Ausente em dados lidos por código antigo: trate como vazio. */
  jornada: Colecao<ItemDaJornada>;
  avisos: string[];
}

export interface EstadoApp {
  configurado: boolean;
  dataDir: string | null;
  sugestao: string;
  origem: "env" | "config" | null;
  schemaApp: number;
  schemaDados: number | null;
  somenteLeitura: boolean;
  erro: string | null;
}

export const CORES = [
  "#e5484d", "#f76b15", "#ffb224", "#46a758", "#12a594",
  "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f", "#8d8d86",
];

// ---------- helpers ----------

export function agoraISO() {
  return new Date().toISOString();
}

export function hojeISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function novoId(prefixo = "") {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefixo}${t}${r}`;
}

const str = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);
const arrStr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export function normalizarPasso(p: Partial<Passo>): Passo {
  return {
    ...p,
    id: str(p.id) || novoId("p"),
    texto: str(p.texto),
    feito: Boolean(p.feito),
    feitoEm: p.feitoEm ?? null,
    responsavel: str(p.responsavel),
    prazo: p.prazo ?? null,
  };
}

export function normalizarRegistro(r: Partial<Registro>): Registro {
  const tipo = TIPOS_REGISTRO.some((t) => t.id === r.tipo) ? (r.tipo as TipoRegistro) : "nota";
  return {
    ...r,
    id: str(r.id) || novoId("r"),
    tipo,
    data: str(r.data) || hojeISO(),
    hora: str(r.hora),
    titulo: str(r.titulo),
    participantes: arrStr(r.participantes),
    anotacoes: str(r.anotacoes),
    resumoIA: str(r.resumoIA),
    decisoes: str(r.decisoes),
    proximosPassos: Array.isArray(r.proximosPassos) ? r.proximosPassos.map(normalizarPasso) : [],
    impedimentos: str(r.impedimentos),
    respostaIABruta: str(r.respostaIABruta),
    notaId: str(r.notaId),
    referencia: Boolean(r.referencia),
    duracaoMin: Number.isFinite(Number(r.duracaoMin)) ? Math.min(24 * 60, Math.max(0, Math.round(Number(r.duracaoMin)))) : 0,
    criadoEm: str(r.criadoEm) || agoraISO(),
    atualizadoEm: str(r.atualizadoEm) || agoraISO(),
  };
}

export function normalizarTarefa(t: Partial<Tarefa>): Tarefa {
  const status = STATUS.some((s) => s.id === t.status) ? (t.status as Status) : "a_fazer";
  const prio = Number(t.prioridade);
  return {
    ...t,
    id: str(t.id) || novoId("t"),
    rev: Number(t.rev) || 0,
    titulo: str(t.titulo, "Sem título"),
    descricao: str(t.descricao),
    categoriaId: typeof t.categoriaId === "string" && t.categoriaId ? t.categoriaId : null,
    status,
    prioridade: Number.isFinite(prio) ? Math.min(10, Math.max(1, Math.round(prio))) : 5,
    prazo: typeof t.prazo === "string" && t.prazo ? t.prazo : null,
    tags: arrStr(t.tags),
    registros: Array.isArray(t.registros) ? t.registros.map(normalizarRegistro) : [],
    panoramaIA: t.panoramaIA ?? null,
    criadaEm: str(t.criadaEm) || agoraISO(),
    atualizadaEm: str(t.atualizadaEm) || agoraISO(),
    concluidaEm: t.concluidaEm ?? null,
    lembrarEm: typeof t.lembrarEm === "string" && t.lembrarEm ? t.lembrarEm : null,
    focoEm: typeof t.focoEm === "string" && t.focoEm ? t.focoEm : null,
    fixada: t.fixada === true,
    esperando: normalizarEspera(t.esperando),
    dependeDe: normalizarDependencias(t.dependeDe, typeof t.id === "string" ? t.id : undefined),
  };
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Espera sem "quem" e sem "o quê" não diz nada: vira null. */
export function normalizarEspera(e: unknown): Espera | null {
  if (!e || typeof e !== "object") return null;
  const x = e as Partial<Espera>;
  const quem = str(x.quem).trim().slice(0, 120);
  const oQue = str(x.oQue).trim().slice(0, 300);
  if (!quem && !oQue) return null;
  return {
    ...x,
    quem,
    oQue,
    desde: DATA_ISO.test(str(x.desde)) ? str(x.desde) : hojeISO(),
    cobradoEm: DATA_ISO.test(str(x.cobradoEm)) ? str(x.cobradoEm) : null,
  };
}

export function normalizarPagina(p: Partial<Pagina>): Pagina {
  return {
    ...p,
    id: str(p.id) || novoId("pg"),
    titulo: str(p.titulo),
    texto: str(p.texto),
    categoriaId: typeof p.categoriaId === "string" && p.categoriaId ? p.categoriaId : null,
    tags: arrStr(p.tags),
    arquivadaEm: typeof p.arquivadaEm === "string" && p.arquivadaEm ? p.arquivadaEm : null,
    paiId: typeof p.paiId === "string" && ID_VALIDO.test(p.paiId) && p.paiId !== p.id ? p.paiId : null,
    ordem: Number.isFinite(Number(p.ordem)) ? Number(p.ordem) : 0,
    icone: typeof p.icone === "string" && /^[a-z0-9-]{1,30}$/.test(p.icone) ? p.icone : "",
    estado: ESTADOS_PAGINA.some((e) => e.id === p.estado) ? (p.estado as EstadoPagina) : "rascunho",
    fixada: p.fixada === true,
    tipo: p.tipo === "video" ? "video" : "doc",
    video: p.tipo === "video" ? normalizarVideo(p.video) ?? {} : p.video ? normalizarVideo(p.video) : null,
    criadaEm: str(p.criadaEm) || agoraISO(),
    atualizadaEm: str(p.atualizadaEm) || agoraISO(),
  };
}

// ---------- jornada ----------

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const horaValida = (v: unknown): v is string => typeof v === "string" && HORA_VALIDA.test(v);
const emMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const emHora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Data de calendário que existe de verdade (2026-02-30 não vale). */
export function dataReal(v: unknown): v is string {
  if (typeof v !== "string" || !DATA_ISO.test(v)) return false;
  const [a, m, d] = v.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const inteiro = (v: unknown, padrao: number, minimo: number, maximo: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? Math.min(maximo, Math.max(minimo, Math.round(n))) : padrao;
};

export function normalizarBloco(b: Partial<BlocoDaJornada>): BlocoDaJornada {
  // horário torto não some com o bloco: volta para um horário válido, com o fim depois do início
  let inicio = horaValida(b.inicio) ? emMin(b.inicio) : 8 * 60;
  if (inicio > 23 * 60 + 54) inicio = 23 * 60 + 54;
  let fim = horaValida(b.fim) ? emMin(b.fim) : inicio + 60;
  if (fim <= inicio) fim = inicio + 60;
  if (fim > 23 * 60 + 59) fim = 23 * 60 + 59;
  const tipo = TIPOS_DE_BLOCO.includes(b.tipo as TipoDeBloco) ? (b.tipo as TipoDeBloco) : "atividade";
  return {
    ...b,
    id: typeof b.id === "string" && ID_VALIDO.test(b.id) ? b.id : novoId("bl"),
    inicio: emHora(inicio),
    fim: emHora(fim),
    titulo: str(b.titulo).trim().slice(0, 160),
    tipo,
    tarefaId: tipo === "tarefa" && typeof b.tarefaId === "string" && ID_VALIDO.test(b.tarefaId) ? b.tarefaId : null,
    nota: str(b.nota).slice(0, 600),
    feito: b.feito === true,
  };
}

const MAX_BLOCOS = 60;
const blocos = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .filter((x) => x && typeof x === "object")
    .slice(0, MAX_BLOCOS)
    .map((x) => normalizarBloco(x as Partial<BlocoDaJornada>))
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));

export function normalizarPonto(p: unknown): PontoDoDia {
  const x = (p && typeof p === "object" ? p : {}) as Partial<PontoDoDia>;
  const entrada = horaValida(x.entrada) ? x.entrada : null;
  return {
    ...x,
    entrada,
    // sem entrada não há saída; saída antes da entrada não é saída
    saida: entrada && horaValida(x.saida) && x.saida > entrada ? x.saida : null,
    pausas: (Array.isArray(x.pausas) ? x.pausas : [])
      .filter((q) => q && typeof q === "object" && horaValida((q as PausaDoPonto).inicio))
      .slice(0, 20)
      .map((q) => {
        const pausa = q as PausaDoPonto;
        return { ...pausa, inicio: pausa.inicio, fim: horaValida(pausa.fim) && pausa.fim > pausa.inicio ? pausa.fim : null };
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
  };
}

export function normalizarConfigDaJornada(c: Partial<ConfigDaJornada> | null | undefined): ConfigDaJornada {
  const x = (c && typeof c === "object" ? c : {}) as Partial<ConfigDaJornada>;
  const dias = [...new Set((Array.isArray(x.diasDeTrabalho) ? x.diasDeTrabalho : [1, 2, 3, 4, 5]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const padrao: Record<string, BlocoDaJornada[]> = {};
  const bruto = (x.padrao && typeof x.padrao === "object" ? x.padrao : {}) as Record<string, unknown>;
  for (const d of ["0", "1", "2", "3", "4", "5", "6"]) padrao[d] = blocos(bruto[d]).map((b) => ({ ...b, feito: false }));
  return {
    ...x,
    id: ID_CONFIG_JORNADA,
    tipo: "config",
    jornadaMin: inteiro(x.jornadaMin, 480, 30, 16 * 60),
    pausaMin: inteiro(x.pausaMin, 60, 0, 4 * 60),
    diasDeTrabalho: dias,
    descontarPausa: x.descontarPausa !== false,
    saldoInicialMin: inteiro(x.saldoInicialMin, 0, -600000, 600000),
    padrao,
    atualizadoEm: str(x.atualizadoEm) || agoraISO(),
  };
}

export function normalizarDiaDaJornada(d: Partial<DiaDaJornada>): DiaDaJornada {
  const data = dataReal(d.id) ? d.id : dataReal(d.data) ? d.data : str(d.id);
  return {
    ...d,
    id: str(d.id) || data,
    tipo: "dia",
    data,
    planejado: d.planejado === true,
    blocos: blocos(d.blocos),
    ponto: normalizarPonto(d.ponto),
    folga: d.folga === true,
    jornadaMin: d.jornadaMin == null ? null : inteiro(d.jornadaMin, 480, 0, 16 * 60),
    pausaMin: d.pausaMin == null ? null : inteiro(d.pausaMin, 60, 0, 4 * 60),
    obs: str(d.obs).slice(0, 600),
    criadoEm: str(d.criadoEm) || agoraISO(),
    atualizadoEm: str(d.atualizadoEm) || agoraISO(),
  };
}

/** O item de id "config" é a configuração; qualquer outro é um dia. */
export function normalizarItemDaJornada(x: Partial<ItemDaJornada>): ItemDaJornada {
  return x && x.id === ID_CONFIG_JORNADA ? normalizarConfigDaJornada(x as Partial<ConfigDaJornada>) : normalizarDiaDaJornada(x as Partial<DiaDaJornada>);
}

export function normalizarModelo(m: Partial<Modelo>): Modelo {
  const prio = Number(m.prioridade);
  const dias = Number(m.prazoEmDias);
  return {
    ...m,
    id: str(m.id) || novoId("mo"),
    nome: str(m.nome, "Modelo sem nome"),
    quando: str(m.quando),
    titulo: str(m.titulo),
    descricao: str(m.descricao),
    categoriaId: typeof m.categoriaId === "string" && m.categoriaId ? m.categoriaId : null,
    prioridade: Number.isFinite(prio) ? Math.min(10, Math.max(1, Math.round(prio))) : 5,
    tags: arrStr(m.tags),
    passos: arrStr(m.passos).map((p) => p.trim()).filter(Boolean),
    prazoEmDias: m.prazoEmDias != null && Number.isFinite(dias) && dias > 0 ? Math.min(3650, Math.round(dias)) : null,
    usos: Number.isFinite(Number(m.usos)) ? Math.max(0, Math.round(Number(m.usos))) : 0,
    repetir: normalizarRepeticao(m.repetir),
    criadoEm: str(m.criadoEm) || agoraISO(),
    atualizadoEm: str(m.atualizadoEm) || agoraISO(),
  };
}

const inteiroEntre = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Repetição sem forma válida vira null (o modelo continua existindo, só não lembra mais). */
export function normalizarRepeticao(r: unknown): RepeticaoDoModelo | null {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const x = r as Partial<Record<keyof RepeticaoDoModelo, unknown>>;
  const desde = dataReal(x.desde) ? (x.desde as string) : null;
  if (!desde) return null;
  const ultima = dataReal(x.ultima) ? (x.ultima as string) : null;
  if (x.tipo === "semana") {
    const d = inteiroEntre(x.diaDaSemana, 0, 6);
    return d == null ? null : { tipo: "semana", diaDaSemana: d, desde, ultima };
  }
  if (x.tipo === "mes") {
    const d = inteiroEntre(x.diaDoMes, 1, 31);
    return d == null ? null : { tipo: "mes", diaDoMes: d, desde, ultima };
  }
  if (x.tipo === "dias") {
    const d = inteiroEntre(x.cadaDias, 1, 365);
    return d == null ? null : { tipo: "dias", cadaDias: d, desde, ultima };
  }
  return null;
}

export function normalizarCategoria(c: Partial<Categoria>): Categoria {
  return {
    ...c,
    id: str(c.id) || novoId("c"),
    nome: str(c.nome, "Sem nome"),
    descricao: str(c.descricao),
    cor: str(c.cor) || CORES[5],
    arquivada: Boolean(c.arquivada),
    criadaEm: str(c.criadaEm) || agoraISO(),
    atualizadaEm: str(c.atualizadaEm) || agoraISO(),
  };
}

export function normalizarLink(l: Partial<LinkDoc>): LinkDoc {
  return {
    ...l,
    id: str(l.id) || novoId("l"),
    tipo: l.tipo === "arquivo" ? "arquivo" : "link",
    titulo: str(l.titulo, "Sem título"),
    url: str(l.url),
    arquivo: str(l.arquivo),
    nomeArquivo: str(l.nomeArquivo),
    tamanho: typeof l.tamanho === "number" ? l.tamanho : undefined,
    descricao: str(l.descricao),
    tags: arrStr(l.tags),
    tarefaId: l.tarefaId || null,
    categoriaId: l.categoriaId || null,
    criadoEm: str(l.criadoEm) || agoraISO(),
  };
}

const ORIGENS_PESSOA = ["manual", "registros", "outlook"] as const;
const semRepetir = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

export function normalizarPessoa(p: Partial<Pessoa>): Pessoa {
  return {
    ...p,
    id: str(p.id) || novoId("pe"),
    nome: str(p.nome).trim() || "Sem nome",
    apelidos: semRepetir(arrStr(p.apelidos)),
    email: str(p.email).trim(),
    cargo: str(p.cargo),
    area: str(p.area),
    ajudaCom: str(p.ajudaCom),
    anotacoes: str(p.anotacoes),
    categoriaIds: semRepetir(arrStr(p.categoriaIds)),
    tags: arrStr(p.tags),
    arquivada: Boolean(p.arquivada),
    origem: ORIGENS_PESSOA.includes(p.origem as (typeof ORIGENS_PESSOA)[number]) ? p.origem : "manual",
    criadaEm: str(p.criadaEm) || agoraISO(),
    atualizadaEm: str(p.atualizadaEm) || agoraISO(),
  };
}

export function normalizarTime(t: Partial<Time>): Time {
  const responsavelIds = semRepetir(arrStr(t.responsavelIds));
  return {
    ...t,
    id: str(t.id) || novoId("ti"),
    nome: str(t.nome).trim() || "Sem nome",
    descricao: str(t.descricao),
    cor: str(t.cor) || CORES[6],
    responsavelIds,
    // os responsáveis também são membros
    membroIds: semRepetir([...arrStr(t.membroIds), ...responsavelIds]),
    categoriaIds: semRepetir(arrStr(t.categoriaIds)),
    arquivado: Boolean(t.arquivado),
    criadoEm: str(t.criadoEm) || agoraISO(),
    atualizadoEm: str(t.atualizadoEm) || agoraISO(),
  };
}

const TIPOS_FRUTO = ["registro", "tarefa", "passo"] as const;

export function normalizarNota(n: Partial<Nota>): Nota {
  const gerou = Array.isArray(n.gerou)
    ? n.gerou
        .filter((f): f is FrutoDaNota => !!f && typeof f === "object" && typeof f.tarefaId === "string" && !!f.tarefaId)
        .map((f) => ({
          ...f,
          tipo: TIPOS_FRUTO.includes(f.tipo) ? f.tipo : "registro",
          tarefaId: f.tarefaId,
          registroId: typeof f.registroId === "string" && f.registroId ? f.registroId : undefined,
          rotulo: str(f.rotulo),
        }))
    : [];
  return {
    ...n,
    id: str(n.id) || novoId("n"),
    titulo: str(n.titulo),
    texto: str(n.texto),
    arquivadaEm: typeof n.arquivadaEm === "string" && n.arquivadaEm ? n.arquivadaEm : null,
    gerou,
    sobras: str(n.sobras),
    criadaEm: str(n.criadaEm) || agoraISO(),
    atualizadaEm: str(n.atualizadaEm) || agoraISO(),
  };
}

export const ID_VALIDO = /^[a-zA-Z0-9_-]{1,80}$/;

export const MAX_DEPENDENCIAS = 50;

/** Lê tarefa.dependeDe do arquivo: só ids válidos, sem repetir, sem a própria tarefa. */
export function normalizarDependencias(v: unknown, proprioId?: string): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(x) || x === proprioId || out.includes(x)) continue;
    out.push(x);
    if (out.length >= MAX_DEPENDENCIAS) break;
  }
  return out;
}

export function nomeStatus(s: Status) {
  return STATUS.find((x) => x.id === s)?.nome ?? s;
}

export function tipoInfo(t: TipoRegistro) {
  return TIPOS_REGISTRO.find((x) => x.id === t) ?? TIPOS_REGISTRO[4];
}

export function formatarData(iso: string | null | undefined, comAno = true) {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  if (!a || !m || !d) return iso;
  return comAno ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`;
}

// Carimbo ISO (UTC) mostrado no fuso local, ex.: "13/11 14:32".
export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function slugify(s: string) {
  return semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "tarefa";
}

export function diasAte(iso: string | null | undefined) {
  if (!iso) return null;
  const alvo = new Date(iso.slice(0, 10) + "T00:00:00");
  const hoje = new Date(hojeISO() + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function ordenarRegistros(regs: Registro[], recentesPrimeiro = false) {
  const ord = [...regs].sort((a, b) => {
    const ka = `${a.data} ${a.hora || "99:99"} ${a.criadoEm}`;
    const kb = `${b.data} ${b.hora || "99:99"} ${b.criadoEm}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return recentesPrimeiro ? ord.reverse() : ord;
}

export function passosAbertos(t: Tarefa) {
  const out: { registro: Registro; passo: Passo }[] = [];
  for (const r of t.registros) for (const p of r.proximosPassos) if (!p.feito) out.push({ registro: r, passo: p });
  return out;
}

export function ultimoRegistro(t: Tarefa) {
  const o = ordenarRegistros(t.registros, true);
  return o[0] ?? null;
}
