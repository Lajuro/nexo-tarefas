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

// Status em que a tarefa está parada na mão de outra pessoa. Só neles valem
// "aguardando quem" e "cobrar em".
export const STATUS_ESPERA: Status[] = ["aguardando", "bloqueada"];

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
  prazo?: string | null; // AAAA-MM-DD
  criadoEm?: string; // só nas pendências avulsas; nos passos de registro vale a data do registro
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
  passos?: Passo[]; // pendências avulsas: criadas direto na tarefa, fora de um registro
  aguardandoQuem?: string; // com quem a tarefa está parada (status de espera)
  cobrarEm?: string | null; // AAAA-MM-DD: quando voltar a cobrar
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

export interface Colecao<T> {
  rev: number;
  items: T[];
  [extra: string]: unknown;
}

export interface Dados {
  tarefas: Tarefa[];
  categorias: Colecao<Categoria>;
  links: Colecao<LinkDoc>;
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
    prazo: typeof p.prazo === "string" && p.prazo ? p.prazo : null,
    criadoEm: str(p.criadoEm),
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
    passos: Array.isArray(t.passos) ? t.passos.map(normalizarPasso) : [],
    aguardandoQuem: str(t.aguardandoQuem),
    cobrarEm: typeof t.cobrarEm === "string" && t.cobrarEm ? t.cobrarEm : null,
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

// Carimbo ISO (UTC) virando data de calendário local (AAAA-MM-DD).
export function dataLocalDe(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Um passo em aberto e de onde ele veio. `registro` é null nas pendências avulsas.
// `desde` é a data (AAAA-MM-DD) em que o passo nasceu.
export interface PassoAberto {
  registro: Registro | null;
  passo: Passo;
  desde: string;
}

export function passosAbertos(t: Tarefa) {
  const out: PassoAberto[] = [];
  for (const r of t.registros)
    for (const p of r.proximosPassos) if (!p.feito) out.push({ registro: r, passo: p, desde: r.data });
  for (const p of t.passos ?? [])
    if (!p.feito) out.push({ registro: null, passo: p, desde: dataLocalDe(p.criadoEm) || dataLocalDe(t.criadaEm) });
  return out;
}

// Aplica `fn` em todos os passos da tarefa, estejam num registro ou avulsos.
export function mapearPassos(t: Tarefa, fn: (p: Passo) => Passo): Tarefa {
  return {
    ...t,
    registros: t.registros.map((r) => ({ ...r, proximosPassos: r.proximosPassos.map(fn) })),
    passos: (t.passos ?? []).map(fn),
  };
}

export function marcarPasso(t: Tarefa, passoId: string, feito: boolean): Tarefa {
  return mapearPassos(t, (p) => (p.id === passoId ? { ...p, feito, feitoEm: feito ? agoraISO() : null } : p));
}

// Um passo é "meu" se não tem responsável, se o responsável é "Eu" ou se bate com um dos
// nomes que o usuário disse que usa (Configurações).
const EU = /^(eu|eu mesmo|eu mesma|me|mim)$/;
export function ehMeu(responsavel: string | undefined, meusNomes: string[] = []) {
  const r = semAcento((responsavel || "").trim());
  if (!r) return true;
  return EU.test(r) || meusNomes.some((n) => semAcento(n.trim()) === r);
}

// Tarefa aberta sem nenhum sinal de vida há este tanto de dias conta como "parada".
export const DIAS_PARADA = 7;

// Data (AAAA-MM-DD) do último sinal de vida da tarefa: registro na timeline, passo concluído
// ou pendência avulsa criada. Editar título ou prioridade não conta.
export function ultimaAtividade(t: Tarefa) {
  let d = dataLocalDe(t.criadaEm);
  const ve = (x: string) => { if (x && x > d) d = x; };
  for (const r of t.registros) {
    ve(r.data);
    for (const p of r.proximosPassos) ve(dataLocalDe(p.feitoEm));
  }
  for (const p of t.passos ?? []) {
    ve(dataLocalDe(p.criadoEm));
    ve(dataLocalDe(p.feitoEm));
  }
  return d;
}

export function diasSemAtividade(t: Tarefa) {
  return Math.max(0, -(diasAte(ultimaAtividade(t)) ?? 0));
}

// "Parada" = aberta e esquecida. Tarefa em espera com cobrança marcada não conta:
// ela está parada de propósito e quem avisa é a data de cobrança.
export function estaParada(t: Tarefa) {
  if (!STATUS_ABERTOS.includes(t.status)) return false;
  if (STATUS_ESPERA.includes(t.status) && t.cobrarEm) return false;
  return diasSemAtividade(t) >= DIAS_PARADA;
}

// Soma dias a hoje e devolve AAAA-MM-DD (fuso local).
export function hojeMais(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ultimoRegistro(t: Tarefa) {
  const o = ordenarRegistros(t.registros, true);
  return o[0] ?? null;
}
