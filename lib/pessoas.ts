// Pessoas: junta o cadastro (pessoas.json, times.json) com os nomes soltos que aparecem nas
// tarefas (registro.participantes e passo.responsavel). Funções puras, sem React e sem disco,
// usadas pelas telas e pelos testes (node testes/pessoas.test.mjs).
//
// As tarefas continuam guardando nomes como texto. A ligação entre um nome solto e uma pessoa
// cadastrada é feita só aqui, na leitura, comparando chaveNome() com o nome e os apelidos.

import { type Dados, type Passo, type Pessoa, type Registro, type Tarefa, type Time, semAcento } from "./tipos";
import { aberta, passoEhMeu } from "./lembretes";

// ---------- nomes ----------

/** Nome normalizado para comparação: sem acento, minúsculas, espaços colapsados. */
export function chaveNome(s: string): string {
  return semAcento(s || "").replace(/\s+/g, " ").trim();
}

/** "Eu", "eu mesmo", vazio... significam o próprio usuário e não viram pessoa. */
export function nomeEhMeu(nome: string): boolean {
  return passoEhMeu({ id: "", texto: "", feito: false, responsavel: nome } as Passo);
}

/** Chaves pelas quais uma pessoa cadastrada é reconhecida (nome e apelidos). */
export function chavesDaPessoa(p: Pessoa): string[] {
  return [p.nome, ...p.apelidos].map(chaveNome).filter(Boolean);
}

/**
 * Acha a pessoa cadastrada por nome, apelido ou e-mail (sem acento e sem maiúsculas).
 * Se mais de uma bater, prefere a que não está arquivada.
 */
export function acharPessoa(pessoas: Pessoa[], nome: string): Pessoa | undefined {
  const k = chaveNome(nome);
  if (!k) return undefined;
  const bate = (p: Pessoa) => chavesDaPessoa(p).includes(k) || (!!p.email && p.email.trim().toLowerCase() === k);
  const achadas = pessoas.filter(bate);
  return achadas.find((p) => !p.arquivada) ?? achadas[0];
}

/** Índice chaveNome -> pessoa, para resolver muitos nomes de uma vez. */
function indicePessoas(pessoas: Pessoa[]): Map<string, Pessoa> {
  const m = new Map<string, Pessoa>();
  // as ativas primeiro: em caso de nome repetido, a ativa ganha
  const ordem = [...pessoas.filter((p) => !p.arquivada), ...pessoas.filter((p) => p.arquivada)];
  for (const p of ordem) {
    for (const k of chavesDaPessoa(p)) if (!m.has(k)) m.set(k, p);
    const e = p.email.trim().toLowerCase();
    if (e && !m.has(e)) m.set(e, p);
  }
  return m;
}

// ---------- diretório unificado ----------

export interface RegistroComTarefa { tarefa: Tarefa; registro: Registro }
export interface PassoComTarefa { tarefa: Tarefa; registro: Registro; passo: Passo }

export interface EntradaPessoa {
  /**
   * Identifica a entrada na lista. Cadastrada: o id da pessoa. Só nos registros: chaveNome(nome).
   * (Ao cadastrar um nome solto a chave muda; para links estáveis use o nome.)
   */
  chave: string;
  /** Nome para mostrar: o do cadastro ou o primeiro jeito como apareceu nos registros. */
  nome: string;
  pessoa?: Pessoa;
  cadastrada: boolean;
  /** Registros em que participou (inclui os apelidos), do mais recente para o mais antigo. */
  registros: RegistroComTarefa[];
  /** Tarefas em que aparece (registros ou passos em aberto), da atividade mais recente para a mais antiga. */
  tarefaIds: string[];
  /** Passos não feitos, de tarefas abertas, cujo responsável é essa pessoa. Do mais antigo para o mais novo. */
  passosAbertos: PassoComTarefa[];
  /** Data (AAAA-MM-DD) do registro mais recente com ela. null = nunca participou de registro. */
  ultimoContato: string | null;
  /** Times dos quais é membro. */
  times: Time[];
  /** Times dos quais é responsável. */
  responsavelDe: Time[];
}

const momento = (r: Registro) => `${r.data} ${r.hora || "99:99"} ${r.criadoEm}`;
const porMomentoDesc = (a: { registro: Registro }, b: { registro: Registro }) =>
  momento(a.registro) < momento(b.registro) ? 1 : momento(a.registro) > momento(b.registro) ? -1 : 0;

/**
 * Lista única de pessoas: todas as cadastradas (inclusive arquivadas; a tela filtra por
 * `pessoa.arquivada`) e todos os nomes que só aparecem nos registros e passos.
 * Uma pessoa cadastrada absorve os registros de todos os seus apelidos.
 * Ordem: por nome (pt-BR).
 */
export function montarDiretorio(dados: Dados): EntradaPessoa[] {
  const pessoas = dados.pessoas?.items ?? [];
  const times = dados.times?.items ?? [];
  const indice = indicePessoas(pessoas);

  type Acumulado = { entrada: EntradaPessoa; regIds: Set<string>; passoIds: Set<string> };
  const porChave = new Map<string, Acumulado>();
  const nova = (chave: string, nome: string, pessoa?: Pessoa): Acumulado => ({
    entrada: {
      chave, nome, pessoa, cadastrada: Boolean(pessoa),
      registros: [], tarefaIds: [], passosAbertos: [], ultimoContato: null,
      times: pessoa ? times.filter((t) => t.membroIds.includes(pessoa.id)) : [],
      responsavelDe: pessoa ? times.filter((t) => t.responsavelIds.includes(pessoa.id)) : [],
    },
    regIds: new Set(),
    passoIds: new Set(),
  });
  for (const p of pessoas) porChave.set(p.id, nova(p.id, p.nome, p));

  const acumuladoDe = (nomeBruto: string): Acumulado | null => {
    const nome = nomeBruto.replace(/\s+/g, " ").trim();
    if (!nome || nomeEhMeu(nome)) return null;
    const k = chaveNome(nome);
    const pessoa = indice.get(k);
    if (pessoa) return porChave.get(pessoa.id)!;
    if (!porChave.has(k)) porChave.set(k, nova(k, nome));
    return porChave.get(k)!;
  };

  for (const tarefa of dados.tarefas) {
    const ehAberta = aberta(tarefa);
    for (const registro of tarefa.registros) {
      for (const nome of registro.participantes) {
        const a = acumuladoDe(nome);
        if (!a || a.regIds.has(`${tarefa.id}/${registro.id}`)) continue;
        a.regIds.add(`${tarefa.id}/${registro.id}`);
        a.entrada.registros.push({ tarefa, registro });
      }
      if (!ehAberta) continue;
      for (const passo of registro.proximosPassos) {
        if (passo.feito || passoEhMeu(passo)) continue;
        const a = acumuladoDe(passo.responsavel || "");
        if (!a || a.passoIds.has(`${tarefa.id}/${passo.id}`)) continue;
        a.passoIds.add(`${tarefa.id}/${passo.id}`);
        a.entrada.passosAbertos.push({ tarefa, registro, passo });
      }
    }
  }

  const out: EntradaPessoa[] = [];
  for (const { entrada } of porChave.values()) {
    entrada.registros.sort(porMomentoDesc);
    entrada.passosAbertos.sort((a, b) => porMomentoDesc(b, a));
    entrada.ultimoContato = entrada.registros[0]?.registro.data ?? null;
    const ids = new Set<string>();
    for (const { tarefa } of entrada.registros) ids.add(tarefa.id);
    for (const { tarefa } of [...entrada.passosAbertos].sort(porMomentoDesc)) ids.add(tarefa.id);
    entrada.tarefaIds = [...ids];
    out.push(entrada);
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

/** Acha uma entrada do diretório pela chave ou por qualquer nome/apelido/e-mail. */
export function acharEntrada(diretorio: EntradaPessoa[], chaveOuNome: string): EntradaPessoa | undefined {
  const porChave = diretorio.find((e) => e.chave === chaveOuNome);
  if (porChave) return porChave;
  const k = chaveNome(chaveOuNome);
  return (
    diretorio.find((e) => e.pessoa && (chavesDaPessoa(e.pessoa).includes(k) || e.pessoa.email.toLowerCase() === k)) ??
    diretorio.find((e) => !e.cadastrada && e.chave === k)
  );
}

// ---------- pessoas de um assunto (categoria) ----------

export type MotivoLigacao =
  | { tipo: "direto"; descricao: string }
  | { tipo: "time"; time: Time; responsavel: boolean; descricao: string }
  | { tipo: "registros"; quantidade: number; tarefaIds: string[]; descricao: string }
  | { tipo: "passos"; quantidade: number; descricao: string };

export interface PessoaDaCategoria {
  entrada: EntradaPessoa;
  motivos: MotivoLigacao[];
}

/**
 * Quem está ligado a um assunto e por quê: direto (pessoa.categoriaIds), por time
 * (time.categoriaIds, times arquivados não contam), por ter participado de registros de
 * tarefas da categoria ou por ter passo em aberto nelas.
 * Ordem: ligações diretas e por time primeiro, depois quem tem mais registros.
 * Passe `diretorio` se já tiver montado, para não montar de novo.
 */
export function pessoasDaCategoria(
  dados: Dados,
  categoriaId: string,
  diretorio: EntradaPessoa[] = montarDiretorio(dados),
): PessoaDaCategoria[] {
  const times = (dados.times?.items ?? []).filter((t) => !t.arquivado && t.categoriaIds.includes(categoriaId));
  const out: PessoaDaCategoria[] = [];
  for (const entrada of diretorio) {
    const motivos: MotivoLigacao[] = [];
    const p = entrada.pessoa;
    if (p?.categoriaIds.includes(categoriaId)) motivos.push({ tipo: "direto", descricao: "Ligada diretamente ao assunto" });
    if (p) {
      for (const time of times) {
        if (!time.membroIds.includes(p.id)) continue;
        const responsavel = time.responsavelIds.includes(p.id);
        motivos.push({
          tipo: "time", time, responsavel,
          descricao: responsavel ? `Responsável pelo time ${time.nome}` : `Membro do time ${time.nome}`,
        });
      }
    }
    const regs = entrada.registros.filter((x) => x.tarefa.categoriaId === categoriaId);
    if (regs.length) {
      const tarefaIds = [...new Set(regs.map((x) => x.tarefa.id))];
      motivos.push({
        tipo: "registros", quantidade: regs.length, tarefaIds,
        descricao: `Participou de ${plural(regs.length, "registro", "registros")} em ${plural(tarefaIds.length, "tarefa", "tarefas")} do assunto`,
      });
    }
    const passos = entrada.passosAbertos.filter((x) => x.tarefa.categoriaId === categoriaId);
    if (passos.length) {
      motivos.push({
        tipo: "passos", quantidade: passos.length,
        descricao: `Responsável por ${plural(passos.length, "passo em aberto", "passos em aberto")} no assunto`,
      });
    }
    if (motivos.length) out.push({ entrada, motivos });
  }
  const peso = (x: PessoaDaCategoria) => (x.motivos.some((m) => m.tipo === "direto" || m.tipo === "time") ? 1 : 0);
  const regs = (x: PessoaDaCategoria) => x.motivos.find((m) => m.tipo === "registros")?.quantidade ?? 0;
  return out.sort(
    (a, b) => peso(b) - peso(a) || regs(b) - regs(a) || a.entrada.nome.localeCompare(b.entrada.nome, "pt-BR", { sensitivity: "base" }),
  );
}

// ---------- autocompletar ----------

/**
 * Nomes para autocompletar: cadastradas ativas primeiro (por nome), depois os nomes soltos
 * (por contato mais recente). Sem repetir: apelidos de cadastradas não aparecem soltos.
 */
export function nomesConhecidos(dados: Dados): string[] {
  const dir = montarDiretorio(dados);
  const vistos = new Set<string>();
  const out: string[] = [];
  const add = (nome: string) => {
    const k = chaveNome(nome);
    if (!k || vistos.has(k)) return;
    vistos.add(k);
    out.push(nome);
  };
  for (const e of dir) if (e.cadastrada && !e.pessoa!.arquivada) add(e.nome);
  const soltos = dir
    .filter((e) => !e.cadastrada)
    .sort((a, b) => (b.ultimoContato ?? "").localeCompare(a.ultimoContato ?? "") || a.nome.localeCompare(b.nome, "pt-BR"));
  for (const e of soltos) add(e.nome);
  return out;
}

// ---------- visão antiga (só registros), usada por /pessoas e /busca ----------
// Movida de components/pessoas/dados.ts, que reexporta tudo isto com os nomes antigos.

export interface RegistroDaPessoa { t: Tarefa; r: Registro }
export interface PassoDaPessoa { t: Tarefa; r: Registro; p: Passo }

/** Pessoa vista só pelos registros (sem cadastro). Em components/pessoas/dados.ts se chama `Pessoa`. */
export interface PessoaDosRegistros {
  /** Nome normalizado (chaveNome): é o que identifica a pessoa. */
  chave: string;
  nome: string;
  /** Registros em que participou. */
  regs: RegistroDaPessoa[];
  /** Tarefas em que aparece, da conversa mais recente para a mais antiga. */
  tarefas: Tarefa[];
  /** Data (AAAA-MM-DD) do registro mais recente com ela. null = só aparece como responsável por um passo. */
  ultima: string | null;
  /** Passos de tarefas abertas atribuídos a ela (feitos ou não). */
  passos: PassoDaPessoa[];
  /** Quantos desses passos ainda estão em aberto. */
  abertos: number;
}

export type OrdemPessoas = "contato" | "nome" | "pendencias";

export const chavePessoa = chaveNome;

export function montarPessoas(tarefas: Tarefa[]): PessoaDosRegistros[] {
  const m = new Map<string, { nome: string; regs: RegistroDaPessoa[]; passos: PassoDaPessoa[] }>();
  const entrada = (nome: string) => {
    const k = chavePessoa(nome);
    if (!m.has(k)) m.set(k, { nome: nome.trim(), regs: [], passos: [] });
    return m.get(k)!;
  };

  for (const t of tarefas)
    for (const r of t.registros)
      for (const nome of r.participantes) if (nome.trim()) entrada(nome).regs.push({ t, r });

  // Passos com responsável: quem já é conhecido recebe todos; quem só aparece como responsável
  // entra na lista apenas se ainda estiver devendo alguma coisa.
  for (const t of tarefas) {
    if (!aberta(t)) continue;
    for (const r of t.registros)
      for (const p of r.proximosPassos) {
        if (passoEhMeu(p)) continue;
        const k = chavePessoa(p.responsavel || "");
        if (m.has(k) || !p.feito) entrada(p.responsavel || "").passos.push({ t, r, p });
      }
  }

  return [...m.entries()].map(([chave, e]) => {
    const regs = [...e.regs].sort((a, b) => (momento(a.r) < momento(b.r) ? 1 : momento(a.r) > momento(b.r) ? -1 : 0));
    const vistas = new Map<string, Tarefa>();
    for (const { t } of regs) if (!vistas.has(t.id)) vistas.set(t.id, t);
    for (const { t, p } of e.passos) if (!p.feito && !vistas.has(t.id)) vistas.set(t.id, t);
    return {
      chave,
      nome: e.nome,
      regs,
      tarefas: [...vistas.values()],
      ultima: regs[0]?.r.data ?? null,
      passos: [...e.passos].sort((a, b) => (momento(a.r) < momento(b.r) ? -1 : 1)),
      abertos: e.passos.filter((x) => !x.p.feito).length,
    };
  });
}

export function ordenarPessoas(pessoas: PessoaDosRegistros[], ordem: OrdemPessoas): PessoaDosRegistros[] {
  type P = PessoaDosRegistros;
  const porNome = (a: P, b: P) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  const porContato = (a: P, b: P) => (b.ultima ?? "").localeCompare(a.ultima ?? "") || porNome(a, b);
  const comparar = ordem === "nome" ? porNome : ordem === "pendencias" ? (a: P, b: P) => b.abertos - a.abertos || porContato(a, b) : porContato;
  return [...pessoas].sort(comparar);
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
