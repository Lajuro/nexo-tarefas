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
  alteracoes?: {
    status?: Alteracao<string>;
    prioridade?: Alteracao<number>;
    prazo?: Alteracao<string | null>;
  };
  criadoEm: string;
  atualizadoEm: string;
  [extra: string]: unknown;
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

export interface Dados {
  tarefas: Tarefa[];
  categorias: Colecao<Categoria>;
  links: Colecao<LinkDoc>;
  pessoas: Colecao<Pessoa>;
  times: Colecao<Time>;
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
  };
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

export const ID_VALIDO = /^[a-zA-Z0-9_-]{1,80}$/;

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
