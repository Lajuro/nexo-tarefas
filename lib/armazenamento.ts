import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  Categoria, Colecao, Dados, EstadoApp, LinkDoc, Modelo, Nota, Pagina, Pessoa, Tarefa, Time, ID_VALIDO,
  agoraISO, hojeISO, slugify, normalizarCategoria, normalizarLink, normalizarModelo, normalizarNota, normalizarPagina, normalizarPessoa, normalizarTarefa,
  normalizarTime,
} from "./tipos";
import { MIGRACOES, SCHEMA_APP } from "./migracoes";
import { tarefaParaMarkdown } from "./markdown";

/*
  COMO OS DADOS FICAM GUARDADOS (pasta escolhida, ex.: OneDrive\Nexo)

  nexo.json              -> versão do formato dos dados (schemaVersion)
  categorias.json        -> categorias
  links.json             -> banco de links e documentos
  pessoas.json           -> pessoas cadastradas (ausente = nenhuma)
  times.json             -> times, com responsáveis e membros (ausente = nenhum)
  notas.json             -> folhas do bloco de notas (ausente = nenhuma)
  modelos.json           -> modelos de tarefa (ausente = nenhum)
  paginas.json           -> páginas de conhecimento (ausente = nenhuma)
  tarefas/<id>.json      -> uma tarefa por arquivo, com toda a timeline dentro
  arquivos/AAAA/...      -> documentos anexados (nunca são sobrescritos)
  markdown/*.md          -> espelho legível das tarefas (gerado, pode apagar)
  _backups/AAAA-MM-DD/   -> foto diária dos JSON (mantém as últimas 45)
  _backups/pre-migracao-xx e manual-xx -> nunca são apagadas automaticamente
  _lixeira/              -> nada é apagado de verdade, vem pra cá

  O código do app NUNCA fica nessa pasta, e a configuração (qual pasta usar)
  fica em ~/.nexo/config.json. Atualizar o app não encosta em nada disso.
*/

/** Coleções gravadas como arquivo único { rev, items } na raiz da pasta de dados. */
export const COLECOES = ["categorias", "links", "pessoas", "times", "notas", "modelos", "paginas"] as const;
export type NomeColecao = (typeof COLECOES)[number];
/** Coleções novas: cada item precisa ter id válido (ID_VALIDO) e único para ser gravado. */
const COLECOES_COM_ID_ESTRITO: NomeColecao[] = ["pessoas", "times", "notas", "modelos", "paginas"];

const CONFIG_DIR = path.join(os.homedir(), ".nexo");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const BACKUPS_DIARIOS_MANTIDOS = 45;

export class ErroConflito extends Error {}
export class ErroSomenteLeitura extends Error {}

// ---------- configuração ----------

async function lerConfig(): Promise<{ dataDir?: string }> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function obterDataDir(): Promise<{ dir: string | null; origem: EstadoApp["origem"] }> {
  if (process.env.NEXO_DATA_DIR) return { dir: process.env.NEXO_DATA_DIR, origem: "env" };
  const cfg = await lerConfig();
  return cfg.dataDir ? { dir: cfg.dataDir, origem: "config" } : { dir: null, origem: null };
}

export function sugestaoDataDir() {
  const base =
    process.env.OneDriveCommercial || process.env.OneDrive || path.join(os.homedir(), "Documents");
  return path.join(base, "Nexo");
}

export async function definirDataDir(dirBruto: string) {
  const dir = path.resolve(dirBruto.trim().replace(/^["']|["']$/g, ""));
  // A pasta de dados nunca fica dentro da pasta do app: atualizar o app espelha essa pasta e apagaria os dados.
  const app = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  if (dir === app || dir.startsWith(app + path.sep)) {
    throw new Error("A pasta de dados não pode ficar dentro da pasta do app: uma atualização do Nexo apagaria tudo. Escolha outra, de preferência no OneDrive.");
  }
  await fs.mkdir(dir, { recursive: true });
  // testa se dá pra escrever lá
  const teste = path.join(dir, `.teste-escrita-${process.pid}`);
  await fs.writeFile(teste, "ok");
  await fs.unlink(teste);
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const cfg = await lerConfig();
  await escreverAtomico(CONFIG_FILE, JSON.stringify({ ...cfg, dataDir: dir }, null, 2));
  preparos.clear();
  return dir;
}

// ---------- escrita segura ----------

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function escreverAtomico(arquivo: string, conteudo: string | Buffer) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, conteudo);
  // OneDrive/antivírus às vezes seguram o arquivo por alguns ms: tenta de novo.
  for (let i = 0; i < 8; i++) {
    try {
      await fs.rename(tmp, arquivo);
      return;
    } catch (e) {
      if (i === 7) {
        await fs.copyFile(tmp, arquivo);
        await fs.unlink(tmp).catch(() => {});
        return;
      }
      await espera(120 * (i + 1));
    }
  }
}

async function lerJson<T>(arquivo: string, padrao: T): Promise<T> {
  let txt: string;
  try {
    txt = await fs.readFile(arquivo, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return padrao;
    throw e;
  }
  try {
    return JSON.parse(txt.replace(/^﻿/, "")) as T;
  } catch {
    // Nunca trata arquivo corrompido como vazio: isso apagaria dados no próximo save.
    throw new Error(
      `O arquivo ${arquivo} não é um JSON válido. Nada foi alterado. Restaure uma cópia de _backups.`,
    );
  }
}

const json = (o: unknown) => JSON.stringify(o, null, 2) + "\n";

// ---------- preparo da pasta, migrações e backups ----------

interface Meta {
  app: string;
  schemaVersion: number;
  criadoEm: string;
  [k: string]: unknown;
}

type Preparo = { dir: string; schemaDados: number; somenteLeitura: boolean };
const preparos = new Map<string, Promise<Preparo>>();

async function preparar(dir: string): Promise<Preparo> {
  await fs.mkdir(path.join(dir, "tarefas"), { recursive: true });
  const metaPath = path.join(dir, "nexo.json");
  let meta = await lerJson<Meta | null>(metaPath, null);
  if (!meta) {
    meta = { app: "nexo", schemaVersion: SCHEMA_APP, criadoEm: agoraISO() };
    await escreverAtomico(metaPath, json(meta));
  }
  const versao = Number(meta.schemaVersion) || 1;
  if (versao > SCHEMA_APP) {
    // Dados criados por uma versão mais nova do app: abre só para leitura.
    return { dir, schemaDados: versao, somenteLeitura: true };
  }
  if (versao < SCHEMA_APP) {
    await snapshot(dir, `pre-migracao-v${versao}-para-v${SCHEMA_APP}-${carimbo()}`);
    for (const m of MIGRACOES.filter((m) => m.de >= versao && m.de < SCHEMA_APP)) {
      await m.executar(dir, { lerJson, escreverAtomico });
    }
    meta = { ...meta, schemaVersion: SCHEMA_APP, migradoEm: agoraISO() };
    await escreverAtomico(metaPath, json(meta));
  }
  return { dir, schemaDados: SCHEMA_APP, somenteLeitura: false };
}

export async function pastaPronta(): Promise<Preparo> {
  const { dir } = await obterDataDir();
  if (!dir) throw new Error("Pasta de dados ainda não configurada.");
  let p = preparos.get(dir);
  if (!p) {
    p = preparar(dir);
    preparos.set(dir, p);
    p.catch(() => preparos.delete(dir));
  }
  return p;
}

async function paraEscrita(): Promise<string> {
  const p = await pastaPronta();
  if (p.somenteLeitura) {
    throw new ErroSomenteLeitura(
      "Estes dados foram gravados por uma versão mais nova do Nexo. Atualize o app antes de editar.",
    );
  }
  await backupDiario(p.dir);
  return p.dir;
}

function carimbo() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function snapshot(dir: string, nome: string) {
  const destino = path.join(dir, "_backups", nome);
  if (existsSync(destino)) return destino;
  await fs.mkdir(destino, { recursive: true });
  for (const f of ["nexo.json", ...COLECOES.map((c) => `${c}.json`)]) {
    if (existsSync(path.join(dir, f))) await fs.copyFile(path.join(dir, f), path.join(destino, f));
  }
  if (existsSync(path.join(dir, "tarefas"))) {
    await fs.cp(path.join(dir, "tarefas"), path.join(destino, "tarefas"), {
      recursive: true,
      filter: (src) => !src.endsWith(".tmp"),
    });
  }
  return destino;
}

let ultimoDiaBackup = "";
async function backupDiario(dir: string) {
  const hoje = hojeISO();
  const chave = `${dir}|${hoje}`;
  if (ultimoDiaBackup === chave) return;
  await snapshot(dir, hoje);
  ultimoDiaBackup = chave;
  // poda só os backups diários antigos (manuais e pré-migração ficam para sempre)
  const pasta = path.join(dir, "_backups");
  const diarios = (await fs.readdir(pasta)).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  for (const velho of diarios.slice(0, Math.max(0, diarios.length - BACKUPS_DIARIOS_MANTIDOS))) {
    await fs.rm(path.join(pasta, velho), { recursive: true, force: true });
  }
}

export async function backupManual() {
  const p = await pastaPronta();
  return snapshot(p.dir, `manual-${carimbo()}`);
}

export async function listarBackups() {
  const p = await pastaPronta();
  const pasta = path.join(p.dir, "_backups");
  if (!existsSync(pasta)) return [];
  return (await fs.readdir(pasta)).sort().reverse();
}

// ---------- estado ----------

export async function estadoApp(): Promise<EstadoApp> {
  const { dir, origem } = await obterDataDir();
  const base: EstadoApp = {
    configurado: Boolean(dir),
    dataDir: dir,
    sugestao: sugestaoDataDir(),
    origem,
    schemaApp: SCHEMA_APP,
    schemaDados: null,
    somenteLeitura: false,
    erro: null,
  };
  if (!dir) return base;
  try {
    const p = await pastaPronta();
    return { ...base, schemaDados: p.schemaDados, somenteLeitura: p.somenteLeitura };
  } catch (e) {
    return { ...base, erro: (e as Error).message };
  }
}

// ---------- leitura ----------

export async function lerTudo(): Promise<Dados> {
  const { dir } = await pastaPronta();
  const avisos: string[] = [];
  const pastaTarefas = path.join(dir, "tarefas");
  const nomes = (await fs.readdir(pastaTarefas)).filter((n) => n.endsWith(".json"));
  const tarefas: Tarefa[] = [];
  const vistos = new Map<string, string>();
  for (const nome of nomes) {
    try {
      const bruto = await lerJson<Partial<Tarefa>>(path.join(pastaTarefas, nome), {});
      const t = normalizarTarefa(bruto);
      const esperado = `${t.id}.json`;
      if (vistos.has(t.id)) {
        avisos.push(
          `Os arquivos "${vistos.get(t.id)}" e "${nome}" têm a mesma tarefa (provável conflito do OneDrive). Usei "${esperado}". Confira o outro na pasta tarefas.`,
        );
        if (nome !== esperado) continue;
        const i = tarefas.findIndex((x) => x.id === t.id);
        tarefas.splice(i, 1);
      } else if (nome !== esperado) {
        avisos.push(`O arquivo "${nome}" tem um nome diferente do esperado ("${esperado}").`);
      }
      vistos.set(t.id, nome);
      tarefas.push(t);
    } catch (e) {
      avisos.push((e as Error).message);
    }
  }
  const categorias = await lerColecao<Categoria>(dir, "categorias", normalizarCategoria, avisos);
  const links = await lerColecao<LinkDoc>(dir, "links", normalizarLink, avisos);
  const pessoas = await lerColecao<Pessoa>(dir, "pessoas", normalizarPessoa, avisos);
  const times = await lerColecao<Time>(dir, "times", normalizarTime, avisos);
  const notas = await lerColecao<Nota>(dir, "notas", normalizarNota, avisos);
  const modelos = await lerColecao<Modelo>(dir, "modelos", normalizarModelo, avisos);
  const paginas = await lerColecao<Pagina>(dir, "paginas", normalizarPagina, avisos);
  return { tarefas, categorias, links, pessoas, times, notas, modelos, paginas, avisos };
}

async function lerColecao<T>(
  dir: string,
  nome: string,
  norm: (x: Partial<T>) => T,
  avisos: string[],
): Promise<Colecao<T>> {
  try {
    const c = await lerJson<Colecao<Partial<T>>>(path.join(dir, `${nome}.json`), { rev: 0, items: [] });
    return { ...c, rev: Number(c.rev) || 0, items: (c.items || []).map(norm) };
  } catch (e) {
    avisos.push((e as Error).message);
    // marca rev -1 para a interface não deixar salvar por cima de um arquivo ilegível
    return { rev: -1, items: [] };
  }
}

// ---------- escrita: tarefas ----------

export async function salvarTarefa(recebida: Partial<Tarefa>, revEsperada: number | null): Promise<Tarefa> {
  const dir = await paraEscrita();
  if (!recebida.id || !ID_VALIDO.test(recebida.id)) throw new Error("ID de tarefa inválido.");
  const arq = path.join(dir, "tarefas", `${recebida.id}.json`);
  const existente = await lerJson<Partial<Tarefa> | null>(arq, null);
  const revAtual = existente ? Number(existente.rev) || 0 : 0;
  if (existente && revEsperada !== revAtual) {
    throw new ErroConflito("Esta tarefa foi alterada em outro lugar (outra aba ou outro PC). Recarregue.");
  }
  if (!existente && revEsperada) {
    throw new ErroConflito("Esta tarefa não existe mais na pasta. Recarregue.");
  }
  // mescla: campos que esta versão do app não conhece são preservados
  const nova = normalizarTarefa({
    ...(existente || {}),
    ...recebida,
    rev: revAtual + 1,
    atualizadaEm: agoraISO(),
  });
  await escreverAtomico(arq, json(nova));
  await escreverMarkdown(dir, nova).catch(() => {});
  return nova;
}

export async function moverTarefaParaLixeira(id: string) {
  const dir = await paraEscrita();
  if (!ID_VALIDO.test(id)) throw new Error("ID inválido.");
  const origem = path.join(dir, "tarefas", `${id}.json`);
  if (!existsSync(origem)) return;
  const destino = path.join(dir, "_lixeira", `tarefa-${id}-${carimbo()}.json`);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.copyFile(origem, destino);
  await fs.unlink(origem);
  await removerMarkdown(dir, id).catch(() => {});
}

export async function listarLixeira() {
  const { dir } = await pastaPronta();
  const pasta = path.join(dir, "_lixeira");
  if (!existsSync(pasta)) return [];
  const out: { arquivo: string; titulo: string; tipo: string }[] = [];
  for (const n of (await fs.readdir(pasta)).sort().reverse()) {
    if (!n.endsWith(".json")) continue;
    try {
      const j = await lerJson<Record<string, unknown>>(path.join(pasta, n), {});
      out.push({
        arquivo: n,
        tipo: n.startsWith("tarefa-") ? "tarefa" : n.split("-")[0],
        titulo: typeof j.titulo === "string" ? j.titulo : n,
      });
    } catch {
      out.push({ arquivo: n, tipo: "?", titulo: n });
    }
  }
  return out;
}

export async function restaurarDaLixeira(arquivo: string) {
  const dir = await paraEscrita();
  if (!/^tarefa-[a-zA-Z0-9_-]+\.json$/.test(arquivo)) throw new Error("Só tarefas podem ser restauradas por aqui.");
  const origem = path.join(dir, "_lixeira", arquivo);
  const t = normalizarTarefa(await lerJson<Partial<Tarefa>>(origem, {}));
  const destino = path.join(dir, "tarefas", `${t.id}.json`);
  if (existsSync(destino)) throw new Error("Já existe uma tarefa ativa com esse ID.");
  await escreverAtomico(destino, json(t));
  await fs.unlink(origem);
  await escreverMarkdown(dir, t).catch(() => {});
  return t;
}

// ---------- escrita: coleções (categorias, links, pessoas, times) ----------

export async function salvarColecao<T extends { id: string }>(
  nome: NomeColecao,
  items: Partial<T>[],
  revEsperada: number,
  norm: (x: Partial<T>) => T,
): Promise<Colecao<T>> {
  if (COLECOES_COM_ID_ESTRITO.includes(nome)) {
    const vistos = new Set<string>();
    for (const i of items) {
      if (!i || typeof i !== "object" || typeof i.id !== "string" || !ID_VALIDO.test(i.id)) {
        throw new Error(`ID inválido na lista de ${nome}.`);
      }
      if (vistos.has(i.id)) throw new Error(`ID repetido na lista de ${nome}: ${i.id}.`);
      vistos.add(i.id);
    }
  }
  const dir = await paraEscrita();
  const arq = path.join(dir, `${nome}.json`);
  const atual = await lerJson<Colecao<Partial<T>>>(arq, { rev: 0, items: [] });
  const revAtual = Number(atual.rev) || 0;
  if (revEsperada !== revAtual) {
    throw new ErroConflito(`A lista de ${nome} mudou em outro lugar. Recarregue.`);
  }
  const porId = new Map((atual.items || []).map((i) => [i.id as string, i]));
  const novos = items.map((i) => norm({ ...(porId.get(i.id as string) || {}), ...i }));
  const idsNovos = new Set(novos.map((i) => i.id));
  const removidos = (atual.items || []).filter((i) => !idsNovos.has(i.id as string));
  if (removidos.length) {
    await escreverAtomico(
      path.join(dir, "_lixeira", `${nome}-removidos-${carimbo()}.json`),
      json({ removidosEm: agoraISO(), items: removidos }),
    );
  }
  const col: Colecao<T> = { ...atual, rev: revAtual + 1, items: novos };
  await escreverAtomico(arq, json(col));
  return col;
}

/**
 * Espelho das páginas de conhecimento em markdown/paginas/<slug>--<id>.md: se o app morrer, os documentos
 * continuam legíveis no Windows. Só regrava o arquivo cujo conteúdo mudou e apaga o espelho de página removida.
 * Falha aqui nunca derruba a gravação (o dado de verdade já está em paginas.json).
 */
export async function espelharPaginas(paginas: Pagina[]) {
  try {
    const { dir } = await pastaPronta();
    const pasta = path.join(dir, "markdown", "paginas");
    await fs.mkdir(pasta, { recursive: true });
    const esperados = new Map<string, string>();
    for (const p of paginas) {
      const corpo = `# ${p.titulo || "Página sem título"}\n\n${p.texto.replace(/(!\[[^\]]*\]\()(arquivos\/)/g, "$1../../$2")}\n`;
      esperados.set(`${slugify(p.titulo || "pagina")}--${p.id}.md`, corpo);
    }
    for (const nome of await fs.readdir(pasta)) if (nome.endsWith(".md") && !esperados.has(nome)) await fs.unlink(path.join(pasta, nome));
    for (const [nome, corpo] of esperados) {
      const arq = path.join(pasta, nome);
      const atual = existsSync(arq) ? await fs.readFile(arq, "utf8") : null;
      if (atual !== corpo) await escreverAtomico(arq, corpo);
    }
  } catch {
    // o espelho é conveniência: não vale interromper quem está escrevendo
  }
}

// ---------- arquivos anexados ----------

export async function salvarArquivo(nomeOriginal: string, conteudo: Buffer) {
  const dir = await paraEscrita();
  const ano = String(new Date().getFullYear());
  const limpo = nomeOriginal.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(-120) || "arquivo";
  const nome = `${Date.now().toString(36)}-${limpo}`;
  const rel = `${ano}/${nome}`;
  const destino = path.join(dir, "arquivos", ano, nome);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, conteudo, { flag: "wx" }); // nunca sobrescreve
  return { arquivo: rel, nomeArquivo: nomeOriginal, tamanho: conteudo.length };
}

export async function caminhoArquivo(rel: string) {
  const { dir } = await pastaPronta();
  const base = path.resolve(dir, "arquivos");
  const alvo = path.resolve(base, rel);
  if (!alvo.startsWith(base + path.sep)) throw new Error("Caminho inválido.");
  return alvo;
}

// ---------- espelho em markdown ----------

async function removerMarkdown(dir: string, id: string) {
  const pasta = path.join(dir, "markdown");
  if (!existsSync(pasta)) return;
  for (const n of await fs.readdir(pasta)) if (n.endsWith(`--${id}.md`)) await fs.unlink(path.join(pasta, n));
}

async function escreverMarkdown(dir: string, t: Tarefa) {
  // O espelho é só leitura para humanos: se categorias.json estiver ilegível, a tarefa é espelhada assim mesmo,
  // sem o nome da categoria. (Isso não toca no arquivo de categorias, que continua protegido contra sobrescrita.)
  let cat: Categoria | undefined;
  try {
    const cats = await lerJson<Colecao<Categoria>>(path.join(dir, "categorias.json"), { rev: 0, items: [] });
    cat = cats.items?.find((c) => c.id === t.categoriaId);
  } catch {
    cat = undefined;
  }
  await removerMarkdown(dir, t.id);
  await escreverAtomico(
    path.join(dir, "markdown", `${slugify(t.titulo)}--${t.id}.md`),
    tarefaParaMarkdown(t, cat?.nome),
  );
}

// ---------- restaurar um backup ----------

/** Nomes de pasta que o app cria em _backups. Qualquer outra coisa não é restaurada por aqui. */
const NOME_DE_BACKUP = /^(\d{4}-\d{2}-\d{2}|(manual|pre-migracao|pre-restauracao)-[a-zA-Z0-9-]{1,80})$/;

async function pastaDoBackup(dir: string, nome: string): Promise<string> {
  if (typeof nome !== "string" || !NOME_DE_BACKUP.test(nome)) throw new Error("Nome de backup inválido.");
  const base = path.resolve(dir, "_backups");
  const pasta = path.resolve(base, nome);
  if (!pasta.startsWith(base + path.sep)) throw new Error("Nome de backup inválido.");
  const st = await fs.stat(pasta).catch(() => null);
  if (!st?.isDirectory()) throw new Error("Este backup não existe mais na pasta de dados.");
  return pasta;
}

interface ConteudoDoBackup {
  schemaVersion: number;
  /** id -> tarefa como está no backup (objeto bruto, com os campos que este app não conhece). */
  tarefas: Map<string, Record<string, unknown>>;
  /** Só as coleções que existem no backup. */
  colecoes: Map<NomeColecao, Colecao<Record<string, unknown>>>;
}

/** Lê o backup inteiro e confere tudo ANTES de qualquer escrita: se algo estiver ilegível, a restauração nem começa. */
async function lerBackup(pasta: string): Promise<ConteudoDoBackup> {
  const meta = await lerJson<Meta | null>(path.join(pasta, "nexo.json"), null);
  const schemaVersion = Number(meta?.schemaVersion) || 1;
  const tarefas = new Map<string, Record<string, unknown>>();
  const pastaTarefas = path.join(pasta, "tarefas");
  if (existsSync(pastaTarefas)) {
    const nomes = (await fs.readdir(pastaTarefas)).filter((n) => n.endsWith(".json")).sort();
    for (const nome of nomes) {
      const bruto = await lerJson<Record<string, unknown> | null>(path.join(pastaTarefas, nome), null);
      if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new Error(`O arquivo ${nome} do backup não tem uma tarefa.`);
      const id = bruto.id;
      if (typeof id !== "string" || !ID_VALIDO.test(id)) throw new Error(`O arquivo ${nome} do backup tem uma tarefa com ID inválido.`);
      // cópia de conflito do OneDrive dentro do backup: vale o arquivo com o nome certo
      if (tarefas.has(id) && nome !== `${id}.json`) continue;
      tarefas.set(id, bruto);
    }
  }
  const colecoes = new Map<NomeColecao, Colecao<Record<string, unknown>>>();
  for (const nome of COLECOES) {
    const arq = path.join(pasta, `${nome}.json`);
    if (!existsSync(arq)) continue;
    const c = await lerJson<Colecao<Record<string, unknown>> | null>(arq, null);
    if (!c || typeof c !== "object" || !Array.isArray(c.items)) throw new Error(`O arquivo ${nome}.json do backup não tem o formato esperado.`);
    colecoes.set(nome, c);
  }
  return { schemaVersion, tarefas, colecoes };
}

export interface PreviaDoBackup {
  nome: string;
  schemaVersion: number;
  /** Dá para restaurar com esta versão do app? */
  restauravel: boolean;
  motivo: string | null;
  tarefasNoBackup: number;
  /** Tarefas que existem hoje e não estão no backup: vão para a lixeira. */
  saem: { id: string; titulo: string }[];
  /** Tarefas que estão no backup e não existem hoje: voltam. */
  voltam: { id: string; titulo: string }[];
  /** Tarefas que existem nos dois e estão diferentes: voltam ao que eram. */
  mudam: { id: string; titulo: string }[];
  colecoes: { nome: NomeColecao; noBackup: number | null; agora: number | null }[];
}

const tituloDe = (t: Record<string, unknown> | Partial<Tarefa>) => (typeof t.titulo === "string" && t.titulo ? t.titulo : "(sem título)");
/** O que importa numa tarefa para dizer se ela mudou: tudo menos o número da revisão e o carimbo de gravação. */
const miolo = (t: Record<string, unknown>) => JSON.stringify({ ...t, rev: 0, atualizadaEm: "" });

/** O que mudaria se este backup fosse restaurado. Só lê. */
export async function previaDoBackup(nome: string): Promise<PreviaDoBackup> {
  const { dir } = await pastaPronta();
  const backup = await lerBackup(await pastaDoBackup(dir, nome));
  const atuais = new Map<string, Record<string, unknown>>();
  const ilegiveis: string[] = [];
  for (const arq of (await fs.readdir(path.join(dir, "tarefas"))).filter((n) => n.endsWith(".json"))) {
    try {
      const t = await lerJson<Record<string, unknown> | null>(path.join(dir, "tarefas", arq), null);
      if (t && typeof t.id === "string") atuais.set(t.id, t);
    } catch {
      ilegiveis.push(arq);
    }
  }
  const colecoes: PreviaDoBackup["colecoes"] = [];
  for (const c of COLECOES) {
    let agora: number | null = null;
    try {
      const atual = await lerJson<Colecao<unknown> | null>(path.join(dir, `${c}.json`), null);
      agora = atual ? (atual.items || []).length : 0;
    } catch {
      agora = null; // ilegível hoje
    }
    colecoes.push({ nome: c, noBackup: backup.colecoes.has(c) ? backup.colecoes.get(c)!.items.length : null, agora });
  }
  const maisNovo = backup.schemaVersion > SCHEMA_APP;
  return {
    nome,
    schemaVersion: backup.schemaVersion,
    restauravel: !maisNovo,
    motivo: maisNovo ? "Este backup foi feito por uma versão mais nova do Nexo. Atualize o app antes de restaurá-lo." : null,
    tarefasNoBackup: backup.tarefas.size,
    saem: [...atuais].filter(([id]) => !backup.tarefas.has(id)).map(([id, t]) => ({ id, titulo: tituloDe(t) })),
    voltam: [...backup.tarefas].filter(([id]) => !atuais.has(id)).map(([id, t]) => ({ id, titulo: tituloDe(t) })),
    mudam: [...backup.tarefas].filter(([id, t]) => atuais.has(id) && miolo(atuais.get(id)!) !== miolo(t)).map(([id, t]) => ({ id, titulo: tituloDe(t) })),
    colecoes,
  };
}

/**
 * Volta os dados ao que eram num backup.
 * - Antes de tudo, tira uma foto do estado de agora em _backups/pre-restauracao-<carimbo> (nunca é podada):
 *   restaurar também tem volta.
 * - O backup é lido e conferido inteiro antes da primeira escrita.
 * - Tarefa que existe hoje e não está no backup vai para a lixeira (restaurável), não é apagada.
 * - Coleção que não existe no backup (backup de versão antiga) fica como está.
 * - A revisão de tudo o que é regravado sobe além da atual: uma aba aberta com dados velhos recebe 409 e recarrega,
 *   em vez de gravar por cima do que foi restaurado.
 * - Anexos (arquivos/) não entram em backup e nunca são apagados: os links continuam valendo.
 */
export async function restaurarBackup(nome: string) {
  const dir = await paraEscrita();
  const pasta = await pastaDoBackup(dir, nome);
  const backup = await lerBackup(pasta);
  if (backup.schemaVersion > SCHEMA_APP) throw new Error("Este backup foi feito por uma versão mais nova do Nexo. Atualize o app antes de restaurá-lo.");

  const foto = path.basename(await snapshot(dir, `pre-restauracao-${carimbo()}`));

  // 1) o que está no backup volta (tarefas e coleções)
  const pastaTarefas = path.join(dir, "tarefas");
  const revDe = async (arq: string) => {
    try {
      return Number((await lerJson<{ rev?: unknown } | null>(arq, null))?.rev) || 0;
    } catch {
      return 0; // ilegível hoje: é justamente o caso em que restaurar mais ajuda
    }
  };
  const restauradas: Tarefa[] = [];
  for (const [id, bruta] of backup.tarefas) {
    const arq = path.join(pastaTarefas, `${id}.json`);
    const t = normalizarTarefa({ ...bruta, rev: Math.max(Number(bruta.rev) || 0, await revDe(arq)) + 1 } as Partial<Tarefa>);
    await escreverAtomico(arq, json(t));
    restauradas.push(t);
  }
  const colecoesRestauradas: NomeColecao[] = [];
  for (const [nomeCol, col] of backup.colecoes) {
    const arq = path.join(dir, `${nomeCol}.json`);
    await escreverAtomico(arq, json({ ...col, rev: Math.max(Number(col.rev) || 0, await revDe(arq)) + 1 }));
    colecoesRestauradas.push(nomeCol);
  }

  // 2) só depois, o que não existia no backup sai para a lixeira
  const paraLixeira: string[] = [];
  for (const arqNome of (await fs.readdir(pastaTarefas)).filter((n) => n.endsWith(".json"))) {
    const arq = path.join(pastaTarefas, arqNome);
    let id = arqNome.replace(/\.json$/, "");
    try {
      const t = await lerJson<{ id?: unknown } | null>(arq, null);
      if (typeof t?.id === "string") id = t.id;
    } catch {
      // ilegível: sai do caminho do mesmo jeito, e continua guardado na lixeira e na foto
    }
    if (backup.tarefas.has(id) && arqNome === `${id}.json`) continue;
    const destino = path.join(dir, "_lixeira", `tarefa-${ID_VALIDO.test(id) ? id : "ilegivel"}-${carimbo()}${paraLixeira.length ? `-${paraLixeira.length}` : ""}.json`);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.copyFile(arq, destino);
    await fs.unlink(arq);
    if (ID_VALIDO.test(id)) await removerMarkdown(dir, id).catch(() => {});
    paraLixeira.push(id);
  }

  // 3) se o backup é de um formato mais antigo, a versão volta junto e a migração roda na próxima leitura
  if (backup.schemaVersion < SCHEMA_APP && existsSync(path.join(pasta, "nexo.json"))) {
    await fs.copyFile(path.join(pasta, "nexo.json"), path.join(dir, "nexo.json"));
  }
  preparos.delete(dir);

  // 4) espelhos em Markdown (conveniência: falha aqui não desfaz nada)
  for (const t of restauradas) await escreverMarkdown(dir, t).catch(() => {});
  if (backup.colecoes.has("paginas")) await espelharPaginas(backup.colecoes.get("paginas")!.items.map((p) => normalizarPagina(p as Partial<Pagina>)));

  return { backup: nome, foto, tarefas: restauradas.length, paraLixeira: paraLixeira.length, colecoes: colecoesRestauradas };
}

// ---------- verificação de integridade (só leitura) ----------

/** O que existe no disco e os dados não contam: usado por lib/integridade.ts. */
export async function inventarioDaPasta() {
  const { dir } = await pastaPronta();
  const listar = async (pasta: string) => (existsSync(pasta) ? fs.readdir(pasta, { withFileTypes: true }) : []);

  const anexos: { rel: string; tamanho: number }[] = [];
  for (const ano of await listar(path.join(dir, "arquivos"))) {
    if (!ano.isDirectory()) continue;
    for (const f of await listar(path.join(dir, "arquivos", ano.name))) {
      if (!f.isFile()) continue;
      const st = await fs.stat(path.join(dir, "arquivos", ano.name, f.name)).catch(() => null);
      anexos.push({ rel: `${ano.name}/${f.name}`, tamanho: st?.size ?? 0 });
    }
  }

  const raiz = (await listar(dir)).filter((f) => f.isFile()).map((f) => f.name);
  const tarefas = (await listar(path.join(dir, "tarefas"))).filter((f) => f.isFile()).map((f) => f.name);
  let bytes = 0;
  let maior = { nome: "", bytes: 0 };
  for (const n of tarefas.filter((x) => x.endsWith(".json"))) {
    const st = await fs.stat(path.join(dir, "tarefas", n)).catch(() => null);
    bytes += st?.size ?? 0;
    if ((st?.size ?? 0) > maior.bytes) maior = { nome: n, bytes: st?.size ?? 0 };
  }
  for (const n of raiz.filter((x) => x.endsWith(".json"))) bytes += (await fs.stat(path.join(dir, n)).catch(() => null))?.size ?? 0;

  const lixeira = (await listar(path.join(dir, "_lixeira"))).map((f) => f.name);
  const backups = (await listar(path.join(dir, "_backups"))).filter((f) => f.isDirectory()).map((f) => f.name).sort();
  const espelhos = (await listar(path.join(dir, "markdown"))).filter((f) => f.isFile() && f.name.endsWith(".md")).map((f) => f.name);
  return { anexos, raiz, tarefas, bytes, maior, lixeira, backups, espelhos };
}

// ---------- mídia das páginas de vídeo ----------
// Vídeo e áudio são grandes: entram em disco em pedaços (nunca inteiros na memória) e saem em pedaços,
// com suporte a "Range", que é o que deixa o player pular para qualquer ponto.

const TIPOS_DE_MIDIA: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".flac": "audio/flac",
};
export const TETO_DE_MIDIA = 4 * 1024 * 1024 * 1024;
const tipoDeMidia = (arquivo: string) => TIPOS_DE_MIDIA[path.extname(arquivo).toLowerCase()];

/** Grava um vídeo ou áudio na pasta de dados, lendo o corpo do pedido aos poucos. Nunca sobrescreve. */
export async function salvarMidia(nomeOriginal: string, corpo: ReadableStream<Uint8Array> | null) {
  const dir = await paraEscrita();
  if (!corpo) throw new Error("Nenhum arquivo enviado.");
  if (!tipoDeMidia(nomeOriginal)) throw new Error("Esse tipo de arquivo não é aceito como vídeo. Use MP4, WebM, MOV, MKV, MP3, M4A, WAV ou OGG.");
  const ano = String(new Date().getFullYear());
  const limpo = nomeOriginal.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(-120) || "video";
  const nome = `${Date.now().toString(36)}-${limpo}`;
  const destino = path.join(dir, "arquivos", ano, nome);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  const arquivo = await fs.open(destino, "wx"); // nunca sobrescreve
  let tamanho = 0;
  try {
    const leitor = corpo.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > TETO_DE_MIDIA) throw new Error("Arquivo grande demais (o limite é 4 GB). Deixe o vídeo numa pasta do computador e aponte para ele, sem copiar.");
      await arquivo.write(value);
    }
    await arquivo.close();
  } catch (e) {
    // envio interrompido ou grande demais: não fica um arquivo pela metade na pasta
    await arquivo.close().catch(() => {});
    await fs.unlink(destino).catch(() => {});
    throw e;
  }
  if (!tamanho) {
    await fs.unlink(destino).catch(() => {});
    throw new Error("O arquivo chegou vazio.");
  }
  return { arquivo: `${ano}/${nome}`, nomeArquivo: nomeOriginal, tamanho };
}

/**
 * Abre um vídeo para tocar: `rel` é um arquivo de arquivos/; `paginaId` é o vídeo que a página aponta num
 * caminho deste computador. O caminho vem do que está gravado na página, nunca do pedido, e só toca arquivo
 * com extensão de vídeo ou áudio.
 */
export async function abrirMidia(ref: { rel?: string | null; paginaId?: string | null }, faixa: string | null) {
  let alvo: string;
  if (ref.rel) alvo = await caminhoArquivo(ref.rel);
  else {
    const { dir } = await pastaPronta();
    if (!ref.paginaId || !ID_VALIDO.test(ref.paginaId)) throw new Error("Vídeo não informado.");
    const paginas = await lerJson<Colecao<Partial<Pagina>>>(path.join(dir, "paginas.json"), { rev: 0, items: [] });
    const pagina = (paginas.items || []).find((p) => p.id === ref.paginaId);
    const caminho = pagina ? normalizarPagina(pagina).video?.caminho : undefined;
    if (!caminho) throw new Error("Esta página não aponta para um vídeo deste computador.");
    alvo = path.resolve(caminho);
  }
  const tipo = tipoDeMidia(alvo);
  if (!tipo) throw new Error("Esse arquivo não é um vídeo nem um áudio que o Nexo saiba tocar.");
  const st = await fs.stat(alvo).catch(() => null);
  if (!st?.isFile()) throw new Error("O arquivo do vídeo não foi encontrado neste computador.");

  // "bytes=inicio-fim", "bytes=inicio-" ou "bytes=-ultimos"
  let inicio = 0;
  let fim = st.size - 1;
  let parcial = false;
  const m = /^bytes=(\d*)-(\d*)$/.exec((faixa || "").trim());
  if (m && (m[1] || m[2])) {
    if (m[1]) {
      inicio = Number(m[1]);
      if (m[2]) fim = Math.min(Number(m[2]), st.size - 1);
    } else inicio = Math.max(0, st.size - Number(m[2]));
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio > fim || inicio >= st.size) return { tipo, tamanho: st.size, foraDaFaixa: true as const };
    parcial = true;
  }
  const { createReadStream } = await import("node:fs");
  return { tipo, tamanho: st.size, inicio, fim, parcial, foraDaFaixa: false as const, fluxo: createReadStream(alvo, { start: inicio, end: fim }) };
}
