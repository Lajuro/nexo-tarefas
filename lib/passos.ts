// Passos sem repetição (3.19).
//
// O mesmo passo aparecia duas vezes na mesma tarefa quando vinha de dois lugares: da folha organizada pelo
// Copilot e da reunião do mesmo dia, ou da resposta do Copilot num registro novo que repetia o que já estava em
// aberto. Passo repetido infla o número de pendências (sino, menu, tela Hoje) e tira a confiança na lista.
//
// Aqui estão as duas metades:
//   - prevenção: antes de criar um passo, ver se ele já está em aberto na tarefa (separarPassosNovos);
//   - limpeza: achar os repetidos que já existem (passosRepetidos, passosParecidos) e juntar (comPassoJuntado).
//
// Juntar não apaga nada: a cópia sai de proximosPassos e fica guardada no próprio registro, em passosJuntados,
// com a data e com quem foi juntada. Dá para separar depois (comPassoSeparado). É o mesmo espírito de
// registrosRemovidos: o que saiu da vista continua no arquivo.
//
// "Repetido" é texto IGUAL (sem contar acento, maiúsculas e pontuação) com o mesmo responsável. Texto contido em
// outro ("Enviar" e "Enviar o relatório ao Bruno") é só "parecido": nunca junta sozinho, o usuário decide.
// Responsáveis diferentes nunca são o mesmo passo.
//
// Funções puras, usadas dentro de atualizarTarefa(id, fn). Testadas em testes/passos.test.mjs.

import { acharPessoa, chaveNome, nomeEhMeu } from "./pessoas";
import { type Passo, type PassoJuntado, type Pessoa, type Registro, type Tarefa, agoraISO, formatarData, semAcento } from "./tipos";

export interface PassoNaTarefa { registro: Registro; passo: Passo }

/** O texto do passo para comparar: sem acento, sem maiúsculas, sem pontuação, espaços colapsados. */
export const chaveDoPasso = (texto: unknown) => semAcento(typeof texto === "string" ? texto : "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Quem responde pelo passo, para comparar. "" = ninguém escrito. "eu" = o próprio usuário ("Eu" ou um dos nomes
 * dele). Quem está no cadastro é reconhecido também pelos apelidos ("Marina" e "Marina Souza" são a mesma pessoa).
 */
export function chaveDoResponsavel(nome: string | null | undefined, pessoas: Pessoa[] = []): string {
  const n = (nome ?? "").replace(/\s+/g, " ").trim();
  if (!n) return "";
  if (nomeEhMeu(n)) return "eu";
  const p = acharPessoa(pessoas, n);
  return p ? `id:${p.id}` : `nome:${chaveNome(n)}`;
}

/** Passo sem responsável é do próprio usuário (a regra de "meu passo" do app): "" e "eu" são o mesmo dono. */
const dono = (chave: string) => (chave === "" ? "eu" : chave);

/** Os dois passos têm o mesmo dono? */
const mesmoDono = (a: string, b: string) => dono(a) === dono(b);

/**
 * A chave que diz se dois passos são o mesmo: texto igual e mesmo dono. "" quando o passo não tem texto
 * (passo em branco nunca é repetido de outro).
 */
export function chaveDeRepeticao(texto: unknown, responsavel: string | null | undefined, pessoas: Pessoa[] = []): string {
  const k = chaveDoPasso(texto);
  return k ? `${k}|${dono(chaveDoResponsavel(responsavel, pessoas))}` : "";
}

/** "Marina" e "Marina Souza": um nome é o começo do outro, palavra por palavra. */
function nomesParecem(a: string | null | undefined, b: string | null | undefined): boolean {
  const [ka, kb] = [chaveNome(a ?? ""), chaveNome(b ?? "")];
  return !!ka && !!kb && ka !== kb && (`${kb} `.startsWith(`${ka} `) || `${ka} `.startsWith(`${kb} `));
}

/** Os registros na ordem em que os passos devem ser lidos: do mais antigo para o mais novo; no mesmo dia, a reunião antes. */
function registrosEmOrdem(t: Tarefa): Registro[] {
  const momento = (r: Registro) => `${r.data} ${r.tipo === "reuniao" ? 0 : 1} ${r.hora || "99:99"} ${r.criadoEm}`;
  return [...t.registros].sort((a, b) => (momento(a) < momento(b) ? -1 : momento(a) > momento(b) ? 1 : 0));
}

/** Os passos em aberto da tarefa, do registro mais antigo para o mais novo. */
export function abertosEmOrdem(t: Tarefa): PassoNaTarefa[] {
  return registrosEmOrdem(t).flatMap((registro) => registro.proximosPassos.filter((p) => !p.feito).map((passo) => ({ registro, passo })));
}

// ---------- prevenção ----------

/**
 * O passo em aberto da tarefa que é o mesmo que este texto: texto igual e mesmo dono. `foraDoRegistro` deixa de
 * fora o registro que está sendo editado (os passos dele são conferidos pelo próprio editor).
 */
export function passoJaAberto(t: Tarefa, texto: string, responsavel: string | null | undefined, pessoas: Pessoa[] = [], foraDoRegistro?: string): PassoNaTarefa | undefined {
  const k = chaveDeRepeticao(texto, responsavel, pessoas);
  if (!k) return undefined;
  return abertosEmOrdem(t).find((x) => x.registro.id !== foraDoRegistro && chaveDeRepeticao(x.passo.texto, x.passo.responsavel, pessoas) === k);
}

/**
 * Separa os passos que vão entrar na tarefa dos que já estão em aberto nela. Também tira os repetidos dentro
 * da própria lista (o segundo igual fica de fora). Quem chama mostra os que ficaram de fora e deixa incluir assim mesmo.
 */
export function separarPassosNovos<P extends { texto: string; responsavel?: string | null }>(
  t: Tarefa, novos: readonly P[], pessoas: Pessoa[] = [], foraDoRegistro?: string,
): { entram: P[]; jaExistiam: P[] } {
  const entram: P[] = [];
  const jaExistiam: P[] = [];
  const vistos = new Set<string>();
  for (const p of novos) {
    const k = chaveDeRepeticao(p.texto, p.responsavel, pessoas);
    if (!k) { entram.push(p); continue; }
    if (vistos.has(k) || passoJaAberto(t, p.texto, p.responsavel, pessoas, foraDoRegistro)) { jaExistiam.push(p); continue; }
    vistos.add(k);
    entram.push(p);
  }
  return { entram, jaExistiam };
}

/** Da lista `passos`, os que também estão em `outros` (texto igual, mesmo dono). Para não repetir entre dois registros que nascem juntos. */
export function semOsRepetidosEm<P extends { texto: string; responsavel?: string | null }>(passos: readonly P[], outros: readonly { texto: string; responsavel?: string | null }[], pessoas: Pessoa[] = []): P[] {
  const chaves = new Set(outros.map((o) => chaveDeRepeticao(o.texto, o.responsavel, pessoas)));
  return passos.filter((p) => !chaveDoPasso(p.texto) || !chaves.has(chaveDeRepeticao(p.texto, p.responsavel, pessoas)));
}

// ---------- achar ----------

/** Um passo que fica e as cópias dele que saem. */
export interface GrupoDeRepetidos { fica: PassoNaTarefa; saem: PassoNaTarefa[] }

/**
 * Os passos em aberto repetidos dentro da tarefa: texto igual e mesmo dono. Fica o do registro mais antigo
 * (assim "aberto há N dias" continua verdadeiro); no mesmo dia, o da reunião.
 */
export function passosRepetidos(t: Tarefa, pessoas: Pessoa[] = []): GrupoDeRepetidos[] {
  const grupos = new Map<string, GrupoDeRepetidos>();
  for (const x of abertosEmOrdem(t)) {
    const k = chaveDeRepeticao(x.passo.texto, x.passo.responsavel, pessoas);
    if (!k) continue;
    const g = grupos.get(k);
    if (g) g.saem.push(x);
    else grupos.set(k, { fica: x, saem: [] });
  }
  return [...grupos.values()].filter((g) => g.saem.length > 0);
}

/** Quantos passos sairiam da lista se os repetidos fossem juntados. */
export const quantosRepetidos = (t: Tarefa, pessoas: Pessoa[] = []) => passosRepetidos(t, pessoas).reduce((n, g) => n + g.saem.length, 0);

/**
 * Um par de passos que parecem o mesmo, mas não são iguais: o usuário decide. `chave` identifica o par para
 * "São diferentes". Ela é feita dos TEXTOS (e donos), não dos ids: se o mesmo passo existe em dois registros,
 * dizer uma vez que "Agendar a revisão" e "Agendar a revisão com o time" são diferentes vale para as duas cópias.
 */
export interface ParParecido { fica: PassoNaTarefa; sai: PassoNaTarefa; chave: string }

/** Um resumo curto e estável de um texto, para a chave do par caber numa preferência. */
function resumoCurto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const MIN_PARA_PARECER = 8;

/**
 * Pares de passos em aberto que parecem o mesmo: um texto está contido no outro (e o menor tem tamanho para não
 * casar por acaso), com o mesmo dono. Os que são iguais ficam de fora (esses estão em passosRepetidos).
 * `dispensados` são as chaves dos pares que o usuário já disse que são diferentes.
 */
export function passosParecidos(t: Tarefa, pessoas: Pessoa[] = [], dispensados: readonly string[] = []): ParParecido[] {
  const abertos = abertosEmOrdem(t);
  const out: ParParecido[] = [];
  const usados = new Set<string>();
  for (let i = 0; i < abertos.length; i++) {
    for (let j = i + 1; j < abertos.length; j++) {
      const [a, b] = [abertos[i], abertos[j]];
      if (usados.has(a.passo.id) || usados.has(b.passo.id)) continue;
      const [ka, kb] = [chaveDoPasso(a.passo.texto), chaveDoPasso(b.passo.texto)];
      if (!ka || !kb) continue;
      const [da, db] = [chaveDoResponsavel(a.passo.responsavel, pessoas), chaveDoResponsavel(b.passo.responsavel, pessoas)];
      if (ka === kb) {
        // texto igual: com o mesmo dono é repetido (não entra aqui). Só parece o mesmo quando um dos dois
        // não tem ninguém escrito e o outro tem um nome (o mesmo passo anotado com menos cuidado), ou quando
        // os nomes parecem a mesma pessoa e o cadastro não diz que são duas ("Marina" e "Marina Souza").
        if (mesmoDono(da, db)) continue;
        const umSemNome = da === "" || db === "";
        const duasDoCadastro = da.startsWith("id:") && db.startsWith("id:");
        if (!umSemNome && (duasDoCadastro || !nomesParecem(a.passo.responsavel, b.passo.responsavel))) continue;
      } else {
        const [menor, maior] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
        if (menor.length < MIN_PARA_PARECER || !maior.includes(menor)) continue;
        if (!mesmoDono(da, db)) continue;
      }
      const chave = `${t.id}:${[`${ka}|${dono(da)}`, `${kb}|${dono(db)}`].map(resumoCurto).sort().join("+")}`;
      if (dispensados.includes(chave)) continue;
      // fica o mais completo (o texto maior); no empate de tamanho, o mais antigo
      const [fica, sai] = kb.length > ka.length ? [b, a] : [a, b];
      out.push({ fica, sai, chave });
      usados.add(a.passo.id);
      usados.add(b.passo.id);
    }
  }
  return out;
}

// ---------- juntar e separar ----------

const maisCedo = (a: string | null | undefined, b: string | null | undefined) => (a && b ? (a <= b ? a : b) : a || b || null);

/** Os passos juntados guardados num registro (campo opcional; registro antigo não tem). */
export const passosJuntadosDe = (r: Registro): PassoJuntado[] => (Array.isArray(r.passosJuntados) ? r.passosJuntados : []);

/**
 * Junta um passo em outro, na mesma tarefa. O que sai deixa de ser pendência e fica guardado em passosJuntados
 * do registro dele. O que fica herda o responsável (se não tinha) e o prazo mais cedo.
 * Só mexe se os dois ainda estão em aberto: devolve a mesma tarefa quando não há o que fazer.
 */
export function comPassoJuntado(t: Tarefa, fica: { registroId: string; passoId: string }, sai: { registroId: string; passoId: string }): Tarefa {
  if (fica.passoId === sai.passoId && fica.registroId === sai.registroId) return t;
  const achar = (ref: { registroId: string; passoId: string }) => t.registros.find((r) => r.id === ref.registroId)?.proximosPassos.find((p) => p.id === ref.passoId && !p.feito);
  const [pFica, pSai] = [achar(fica), achar(sai)];
  if (!pFica || !pSai) return t;
  const guardado: PassoJuntado = { ...pSai, juntadoEm: agoraISO(), juntadoCom: { registroId: fica.registroId, passoId: fica.passoId } };
  return {
    ...t,
    registros: t.registros.map((r) => {
      let novo = r;
      if (r.id === sai.registroId) novo = { ...novo, proximosPassos: novo.proximosPassos.filter((p) => p.id !== sai.passoId), passosJuntados: [...passosJuntadosDe(novo), guardado] };
      if (r.id === fica.registroId)
        novo = {
          ...novo,
          proximosPassos: novo.proximosPassos.map((p) => (p.id === fica.passoId ? { ...p, responsavel: p.responsavel?.trim() ? p.responsavel : pSai.responsavel ?? "", prazo: maisCedo(p.prazo, pSai.prazo) } : p)),
        };
      return novo;
    }),
  };
}

/** Junta todos os repetidos da tarefa de uma vez. Rodar de novo não muda nada. */
export function comRepetidosJuntados(t: Tarefa, pessoas: Pessoa[] = []): Tarefa {
  let atual = t;
  for (const g of passosRepetidos(t, pessoas))
    for (const x of g.saem) atual = comPassoJuntado(atual, { registroId: g.fica.registro.id, passoId: g.fica.passo.id }, { registroId: x.registro.id, passoId: x.passo.id });
  return atual;
}

/** Desfaz uma junção: o passo guardado volta a ser um passo em aberto do registro dele. */
export function comPassoSeparado(t: Tarefa, registroId: string, passoId: string): Tarefa {
  const r = t.registros.find((x) => x.id === registroId);
  const guardado = r ? passosJuntadosDe(r).find((p) => p.id === passoId) : undefined;
  if (!r || !guardado) return t;
  const { juntadoEm: _quando, juntadoCom: _comQuem, ...passo } = guardado;
  // se, por algum caminho, o id voltou a existir entre os passos, não duplica
  const jaEsta = r.proximosPassos.some((p) => p.id === passoId);
  return {
    ...t,
    registros: t.registros.map((x) =>
      x.id !== registroId
        ? x
        : { ...x, proximosPassos: jaEsta ? x.proximosPassos : [...x.proximosPassos, passo as Passo], passosJuntados: passosJuntadosDe(x).filter((p) => p.id !== passoId) },
    ),
  };
}

/** O texto do passo com que um passo guardado foi juntado (para "juntado com ..."). "" se ele não existe mais. */
export function textoDoPassoQueFicou(t: Tarefa, guardado: PassoJuntado): string {
  const alvo = guardado.juntadoCom;
  if (!alvo) return "";
  return t.registros.find((r) => r.id === alvo.registroId)?.proximosPassos.find((p) => p.id === alvo.passoId)?.texto ?? "";
}

// ---------- cobrança ----------

/** A mensagem com tudo o que está em aberto com uma pessoa, em todas as tarefas: é só colar na conversa. */
export function mensagemDePendencias(nome: string, itens: readonly { tarefa: Pick<Tarefa, "titulo">; registro: Pick<Registro, "data">; passo: Pick<Passo, "texto" | "prazo"> }[]): string {
  return [
    `Pendências com ${nome}:`,
    ...itens.map(({ tarefa, registro, passo }) => `- ${passo.texto} (${tarefa.titulo}, desde ${formatarData(registro.data, false)}${passo.prazo ? `, prazo ${formatarData(passo.prazo, false)}` : ""})`),
  ].join("\n");
}
