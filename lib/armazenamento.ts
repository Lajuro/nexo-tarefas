import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  Categoria, Colecao, Dados, EstadoApp, LinkDoc, Pessoa, Tarefa, Time, ID_VALIDO,
  agoraISO, hojeISO, slugify, normalizarCategoria, normalizarLink, normalizarPessoa, normalizarTarefa,
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
export const COLECOES = ["categorias", "links", "pessoas", "times"] as const;
export type NomeColecao = (typeof COLECOES)[number];
/** Coleções novas: cada item precisa ter id válido (ID_VALIDO) e único para ser gravado. */
const COLECOES_COM_ID_ESTRITO: NomeColecao[] = ["pessoas", "times"];

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
  return { tarefas, categorias, links, pessoas, times, avisos };
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
  const cats = await lerJson<Colecao<Categoria>>(path.join(dir, "categorias.json"), { rev: 0, items: [] });
  const cat = cats.items?.find((c) => c.id === t.categoriaId);
  await removerMarkdown(dir, t.id);
  await escreverAtomico(
    path.join(dir, "markdown", `${slugify(t.titulo)}--${t.id}.md`),
    tarefaParaMarkdown(t, cat?.nome),
  );
}
