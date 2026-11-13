// Bloco de notas: o usuário escreve solto, o Copilot organiza e o app aplica.
//
//   1. promptNotas()      monta o prompt com a nota e as tarefas abertas (cada uma com um apelido T1, T2...)
//   2. o Copilot responde com um JSON (contrato abaixo)
//   3. interpretarNotas() lê esse JSON e devolve PROPOSTAS, sem gravar nada
//   4. a tela mostra as propostas, o usuário escolhe e só então elas são aplicadas
//
// A resposta da IA é entrada não confiável: pode vir cortada, com texto em volta, com tarefa
// trocada ou com campo inventado. Por isso tudo aqui é validado (tipos, datas, tamanhos, tarefa
// existente) e nada do que vem dela vira caminho de arquivo, id ou código. Funções puras.
//
// Contrato da resposta (se mudar, mude o prompt, o leitor e testes/notas.test.mjs juntos):
//   { "nexo": 1,
//     "itens": [
//       { "tipo": "registro", "tarefa": "T1", "tarefaTitulo": "...", "registroTipo": "reuniao",
//         "data": "AAAA-MM-DD", "titulo": "...", "participantes": ["..."], "resumo": "...",
//         "decisoes": ["..."], "impedimentos": ["..."],
//         "passos": [{ "texto": "...", "responsavel": "Eu", "prazo": "AAAA-MM-DD" | null }], "trecho": "..." },
//       { "tipo": "tarefa", "titulo": "...", "descricao": "...", "categoria": "...", "prioridade": 5,
//         "prazo": null, "passos": [...], "trecho": "..." },
//       { "tipo": "passo_concluido", "tarefa": "T1", "tarefaTitulo": "...", "passo": "texto do passo" } ],
//     "sobras": "o que não coube em lugar nenhum" }

import { mesmoTexto } from "./prompts";
import {
  type Categoria, type FrutoDaNota, type Nota, type Passo, type Registro, STATUS_ABERTOS, TIPOS_REGISTRO, type Tarefa, type TipoRegistro,
  formatarData, hojeISO, nomeStatus, normalizarPasso, normalizarRegistro, normalizarTarefa, novoId, ordenarRegistros, passosAbertos,
  semAcento, tipoInfo,
} from "./tipos";

// ---------- limites (a resposta da IA não manda no tamanho do que é gravado) ----------

const MAX_RESPOSTA = 300_000;
const MAX_ITENS = 60;
const MAX_PASSOS = 30;
const MAX_PESSOAS = 30;
const MAX_TITULO = 300;
const MAX_TEXTO = 12_000;

// ---------- apelidos das tarefas ----------

/**
 * Tarefas abertas com um apelido curto (T1, T2...). A IA copia "T3" com muito mais segurança do
 * que um id como "tmwf5f0fqgrq2ga". A ordem é estável (criação, depois id), então o mesmo
 * conjunto de tarefas dá sempre os mesmos apelidos, ao montar o prompt e ao ler a resposta.
 */
export function apelidosDasTarefas(tarefas: Tarefa[]): { apelido: string; tarefa: Tarefa }[] {
  return tarefas
    .filter((t) => STATUS_ABERTOS.includes(t.status))
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm) || a.id.localeCompare(b.id))
    .map((tarefa, i) => ({ apelido: `T${i + 1}`, tarefa }));
}

// ---------- prompt ----------

const EXEMPLO = `{
  "nexo": 1,
  "itens": [
    {
      "tipo": "registro",
      "tarefa": "T1",
      "tarefaTitulo": "título da tarefa, copiado da lista",
      "registroTipo": "reuniao",
      "data": "AAAA-MM-DD",
      "titulo": "resumo em uma linha",
      "participantes": ["Nome"],
      "resumo": "3 a 6 linhas com o que aconteceu e qual foi o avanço",
      "decisoes": ["uma decisão por item"],
      "impedimentos": ["bloqueios, riscos ou dependências"],
      "passos": [{ "texto": "ação", "responsavel": "Eu", "prazo": null }],
      "trecho": "o pedaço das notas que virou este item, copiado como está"
    },
    {
      "tipo": "tarefa",
      "titulo": "nome da tarefa nova",
      "descricao": "o que precisa ser entregue e quem pediu",
      "categoria": "nome de uma categoria da lista, ou vazio",
      "prioridade": 5,
      "prazo": null,
      "passos": [{ "texto": "primeira ação", "responsavel": "Eu", "prazo": null }],
      "trecho": "o pedaço das notas que virou este item"
    },
    {
      "tipo": "passo_concluido",
      "tarefa": "T1",
      "tarefaTitulo": "título da tarefa",
      "passo": "texto do passo em aberto, copiado da lista"
    }
  ],
  "sobras": "o que você não conseguiu encaixar em nenhum item"
}`;

export function promptNotas(nota: Nota, tarefas: Tarefa[], categorias: Categoria[]): string {
  const lista = apelidosDasTarefas(tarefas).map(({ apelido, tarefa: t }) => {
    const cat = categorias.find((c) => c.id === t.categoriaId);
    const L = [`[${apelido}] ${t.titulo}`, `  Categoria: ${cat?.nome || "Sem categoria"} | Status: ${nomeStatus(t.status)}${t.prazo ? ` | Prazo: ${formatarData(t.prazo)}` : ""}`];
    if (t.descricao) L.push(`  Descrição: ${t.descricao.replace(/\s+/g, " ").slice(0, 300)}`);
    const ult = ordenarRegistros(t.registros).filter((r) => r.tipo !== "marco").slice(-1)[0];
    if (ult) L.push(`  Último registro: ${formatarData(ult.data)}, ${tipoInfo(ult.tipo).nome}${ult.titulo ? `: ${ult.titulo}` : ""}`);
    const abertos = passosAbertos(t);
    if (abertos.length) L.push("  Passos em aberto:", ...abertos.map((x) => `    - ${x.passo.texto}${x.passo.responsavel ? ` (${x.passo.responsavel})` : ""}`));
    return L.join("\n");
  });
  const cats = categorias.filter((c) => !c.arquivada).map((c) => c.nome);

  return `Você é meu assistente de organização de trabalho. Abaixo estão minhas anotações soltas e a lista das minhas tarefas em aberto. Separe as anotações em itens e diga onde cada um se encaixa.

Hoje é ${formatarData(hojeISO())} (${hojeISO()}).

=== MINHAS TAREFAS EM ABERTO ===
${lista.join("\n\n") || "Nenhuma tarefa em aberto."}

=== CATEGORIAS QUE JÁ EXISTEM ===
${cats.join(", ") || "Nenhuma"}

=== MINHAS ANOTAÇÕES${nota.titulo ? ` (${nota.titulo})` : ""} ===
${nota.texto.trim() || "(vazio)"}

=== O QUE FAZER ===
- Cada assunto das anotações vira um item. Uma mesma anotação pode render itens em tarefas diferentes.
- Se o assunto é de uma tarefa da lista, crie um item "registro" e indique a tarefa pelo código entre colchetes (T1, T2...). Em "registroTipo" use: reuniao, atividade, impedimento, decisao ou nota.
- Se o assunto é uma demanda nova, que não cabe em nenhuma tarefa da lista, crie um item "tarefa".
- Se as anotações dizem que um dos "passos em aberto" foi resolvido, crie um item "passo_concluido" copiando o texto do passo.
- O que não der para encaixar com segurança vai em "sobras". Na dúvida, prefira "sobras" a chutar a tarefa.

=== REGRAS ===
- Use SOMENTE o que está nas anotações. Não invente nomes, datas, decisões ou passos.
- Quando o responsável por um passo for eu (quem escreveu as anotações), escreva "Eu".
- Datas no formato AAAA-MM-DD. Se as anotações não disserem a data, use a de hoje. Sem prazo, use null.
- Prioridade de 1 a 10 (10 é o mais urgente). Sem pista nas anotações, use 5.
- Listas vazias ficam como [] e textos vazios como "".
- Escreva em português do Brasil.

=== FORMATO DA RESPOSTA ===
Responda SOMENTE com um bloco de código JSON, sem texto antes nem depois, neste formato:

${EXEMPLO}`;
}

// ---------- leitura da resposta ----------

export type Proposta =
  | {
      chave: string; tipo: "registro";
      /** null quando a tarefa não foi reconhecida: o usuário escolhe na tela. */
      tarefaId: string | null;
      /** Motivo para conferir a tarefa com atenção (ex.: o título citado não bate). */
      duvida: string;
      registro: Registro; trecho: string;
    }
  | {
      chave: string; tipo: "tarefa"; titulo: string; descricao: string; categoriaId: string | null; categoriaCitada: string;
      prioridade: number; prazo: string | null; passos: Passo[]; trecho: string;
    }
  | { chave: string; tipo: "passo_concluido"; tarefaId: string; registroId: string; passoId: string; texto: string };

export interface LeituraNotas {
  /** false quando não deu para ler nada (resposta vazia, cortada ou fora do formato). */
  ok: boolean;
  erro: string;
  propostas: Proposta[];
  /** O que foi ignorado ou ajustado, para o usuário saber. */
  avisos: string[];
  sobras: string;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const txt = (v: unknown, max = MAX_TEXTO) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim().slice(0, max);
/** Texto de várias linhas: aceita string ou lista de strings (a IA costuma mandar lista). */
const linhas = (v: unknown) =>
  (Array.isArray(v) ? v.map((x) => txt(x, 1000)).filter(Boolean).join("\n") : txt(v)).slice(0, MAX_TEXTO);
const vazio = (s: string) => !s || /^(nenhum|nenhuma|n\/a|nada|-)\.?$/i.test(s.trim());

function dataValida(v: unknown): string | null {
  const s = txt(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime()) || d.getMonth() + 1 !== Number(s.slice(5, 7))) return null;
  return s;
}

function lerPassos(v: unknown): Passo[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_PASSOS)
    .map((p) => (typeof p === "string" ? { texto: p } : obj(p) ? p : {}))
    .map((p) => ({ texto: txt(p.texto, 500), responsavel: txt(p.responsavel, 120), prazo: dataValida(p.prazo) }))
    .filter((p) => !vazio(p.texto))
    .map((p) => normalizarPasso({ id: novoId("p"), ...p }));
}

/** Acha o JSON dentro do que foi colado: puro, dentro de ```cercas``` ou com texto em volta. */
export function extrairJson(texto: string): unknown {
  const t = texto.replace(/\r/g, "").trim();
  const tentativas = [t];
  const cerca = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (cerca) tentativas.push(cerca[1].trim());
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini >= 0 && fim > ini) tentativas.push(t.slice(ini, fim + 1));
  for (const s of tentativas) {
    try {
      return JSON.parse(s);
    } catch {}
  }
  return undefined;
}

export function interpretarNotas(resposta: string, tarefas: Tarefa[], categorias: Categoria[]): LeituraNotas {
  const falha = (erro: string): LeituraNotas => ({ ok: false, erro, propostas: [], avisos: [], sobras: "" });
  if (!resposta.trim()) return falha("Cole a resposta do Copilot.");
  if (resposta.length > MAX_RESPOSTA) return falha("A resposta colada é grande demais. Organize as notas em partes menores.");
  const bruto = extrairJson(resposta);
  if (bruto === undefined)
    return falha("Não achei um JSON válido na resposta. Ela pode ter vindo cortada: peça ao Copilot para repetir só o JSON e cole de novo.");
  const itens = Array.isArray(bruto) ? bruto : obj(bruto) && Array.isArray(bruto.itens) ? bruto.itens : null;
  if (!itens) return falha('O JSON não tem a lista "itens". Peça ao Copilot para seguir o formato do prompt.');

  const avisos: string[] = [];
  const propostas: Proposta[] = [];
  const abertas = apelidosDasTarefas(tarefas);
  const hoje = hojeISO();

  /** Tarefa citada no item: pelo apelido, conferindo com o título; se não bater, tenta só pelo título. */
  const acharTarefa = (item: Record<string, unknown>): { tarefa: Tarefa | null; duvida: string } => {
    const cod = txt(item.tarefa, 100);
    const titulo = txt(item.tarefaTitulo, MAX_TITULO);
    const porApelido = abertas.find((a) => a.apelido.toLowerCase() === cod.toLowerCase())?.tarefa
      ?? abertas.find((a) => a.tarefa.id === cod)?.tarefa ?? null;
    const porTitulo = titulo ? abertas.filter((a) => mesmoTexto(a.tarefa.titulo, titulo)).map((a) => a.tarefa) : [];
    if (porApelido && (!titulo || mesmoTexto(porApelido.titulo, titulo))) return { tarefa: porApelido, duvida: "" };
    if (porTitulo.length === 1) return { tarefa: porTitulo[0], duvida: porApelido ? "O código e o título vieram diferentes. Usei o título: confira." : "" };
    if (porApelido) return { tarefa: porApelido, duvida: `A IA citou o título “${titulo}”, que não bate com esta tarefa. Confira.` };
    return { tarefa: null, duvida: titulo ? `Não reconheci a tarefa “${titulo}”. Escolha uma.` : "A IA não disse de qual tarefa é. Escolha uma." };
  };

  if (itens.length > MAX_ITENS) avisos.push(`A resposta tinha ${itens.length} itens. Li só os primeiros ${MAX_ITENS}.`);
  for (const item of itens.slice(0, MAX_ITENS)) {
    if (!obj(item)) continue;
    const tipo = semAcento(txt(item.tipo, 40)).replace(/[^a-z]+/g, "_");
    const chave = novoId("x");

    if (tipo === "registro") {
      const rt = semAcento(txt(item.registroTipo, 40));
      const tipoReg: TipoRegistro = TIPOS_REGISTRO.some((x) => x.id === rt && x.id !== "marco") ? (rt as TipoRegistro) : "nota";
      const trecho = txt(item.trecho);
      const registro = normalizarRegistro({
        id: novoId("r"),
        tipo: tipoReg,
        data: dataValida(item.data) ?? hoje,
        titulo: txt(item.titulo, MAX_TITULO),
        participantes: Array.isArray(item.participantes) ? [...new Set(item.participantes.map((p) => txt(p, 120)).filter((p) => !vazio(p)))].slice(0, MAX_PESSOAS) : [],
        anotacoes: trecho,
        resumoIA: vazio(txt(item.resumo)) ? "" : txt(item.resumo),
        decisoes: vazio(linhas(item.decisoes)) ? "" : linhas(item.decisoes),
        impedimentos: vazio(linhas(item.impedimentos)) ? "" : linhas(item.impedimentos),
        proximosPassos: lerPassos(item.passos),
      });
      if (!registro.titulo && !registro.resumoIA && !registro.anotacoes && !registro.proximosPassos.length) {
        avisos.push("Ignorei um registro vazio.");
        continue;
      }
      if (item.data !== undefined && item.data !== null && !dataValida(item.data)) avisos.push(`Data inválida em “${registro.titulo || "um registro"}”. Usei a de hoje.`);
      const { tarefa, duvida } = acharTarefa(item);
      propostas.push({ chave, tipo: "registro", tarefaId: tarefa?.id ?? null, duvida, registro, trecho });
    } else if (tipo === "tarefa") {
      const titulo = txt(item.titulo, MAX_TITULO);
      if (!titulo) {
        avisos.push("Ignorei uma tarefa nova sem título.");
        continue;
      }
      const citada = txt(item.categoria, 120);
      const cat = citada ? categorias.find((c) => !c.arquivada && semAcento(c.nome) === semAcento(citada)) : undefined;
      const prio = Math.round(Number(item.prioridade));
      propostas.push({
        chave, tipo: "tarefa", titulo,
        descricao: txt(item.descricao),
        categoriaId: cat?.id ?? null,
        categoriaCitada: cat ? "" : citada,
        prioridade: Number.isFinite(prio) ? Math.min(10, Math.max(1, prio)) : 5,
        prazo: dataValida(item.prazo),
        passos: lerPassos(item.passos),
        trecho: txt(item.trecho),
      });
    } else if (tipo === "passo_concluido") {
      const { tarefa } = acharTarefa(item);
      const citado = txt(item.passo, 500);
      const achado = tarefa && citado ? passosAbertos(tarefa).find((x) => mesmoTexto(x.passo.texto, citado)) : undefined;
      if (!tarefa || !achado) {
        avisos.push(`Não achei o passo em aberto “${citado || "(sem texto)"}”. Marque à mão se for o caso.`);
        continue;
      }
      if (propostas.some((p) => p.tipo === "passo_concluido" && p.passoId === achado.passo.id)) continue;
      propostas.push({ chave, tipo: "passo_concluido", tarefaId: tarefa.id, registroId: achado.registro.id, passoId: achado.passo.id, texto: achado.passo.texto });
    } else {
      avisos.push(`Ignorei um item de tipo desconhecido (“${txt(item.tipo, 40) || "sem tipo"}”).`);
    }
  }

  const sobras = obj(bruto) && !vazio(linhas(bruto.sobras)) ? linhas(bruto.sobras) : "";
  if (!propostas.length && !sobras) return { ok: false, erro: "A resposta não trouxe nenhum item aproveitável.", propostas, avisos, sobras };
  return { ok: true, erro: "", propostas, avisos, sobras };
}

// ---------- aplicação (transformações puras; quem grava é a tela, via Provider) ----------

/** Acrescenta à tarefa o registro proposto. Use dentro de atualizarTarefa(id, fn). */
export function comRegistroDaNota(t: Tarefa, registro: Registro): Tarefa {
  if (t.registros.some((r) => r.id === registro.id)) return t;
  return { ...t, registros: [...t.registros, registro] };
}

/** Monta a tarefa nova: marco "Tarefa criada" e, se houver passos ou trecho, uma nota inicial com eles. */
export function tarefaDaProposta(p: Extract<Proposta, { tipo: "tarefa" }>, nota: Nota): Tarefa {
  const t = normalizarTarefa({
    id: novoId("t"), titulo: p.titulo, descricao: p.descricao, categoriaId: p.categoriaId, prioridade: p.prioridade, prazo: p.prazo, status: "a_fazer",
  });
  t.registros.push(
    normalizarRegistro({ tipo: "marco", data: hojeISO(), titulo: "Tarefa criada", anotacoes: "", alteracoes: { status: { de: "", para: "a_fazer" } } }),
  );
  if (p.passos.length || p.trecho)
    t.registros.push(
      normalizarRegistro({
        id: novoId("r"), tipo: "nota", data: hojeISO(), titulo: nota.titulo ? `Do bloco de notas: ${nota.titulo}` : "Do bloco de notas",
        anotacoes: p.trecho, proximosPassos: p.passos,
      }),
    );
  return t;
}

/** O que registrar na nota arquivada sobre cada coisa que nasceu dela. */
export function frutoDe(p: Proposta, tarefa: Tarefa): FrutoDaNota {
  if (p.tipo === "registro")
    return { tipo: "registro", tarefaId: tarefa.id, registroId: p.registro.id, rotulo: `${tipoInfo(p.registro.tipo).nome} em ${tarefa.titulo}` };
  if (p.tipo === "tarefa") return { tipo: "tarefa", tarefaId: tarefa.id, rotulo: `Tarefa nova: ${tarefa.titulo}` };
  return { tipo: "passo", tarefaId: tarefa.id, registroId: p.registroId, rotulo: `Passo concluído em ${tarefa.titulo}` };
}
