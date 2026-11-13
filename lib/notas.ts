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
//       { "tipo": "tarefa", "ref": "N1", "titulo": "...", ... }           tarefa nova, com um código próprio
//       { "tipo": "registro", "tarefa": "T1" (existente) ou "N1" (nova), "tarefaTitulo": "...", "registroTipo": "reuniao",
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
      "resumo": "tudo o que as anotações dizem sobre este assunto, organizado. Pode ser longo e ter tópicos.",
      "decisoes": ["uma decisão por item"],
      "impedimentos": ["bloqueios, riscos ou dependências"],
      "passos": [{ "texto": "ação", "responsavel": "Eu", "prazo": null }],
      "trecho": "o pedaço das notas que virou este item, copiado INTEIRO, sem resumir"
    },
    {
      "tipo": "tarefa",
      "ref": "N1",
      "titulo": "nome da tarefa nova",
      "descricao": "o que precisa ser entregue e quem pediu",
      "categoria": "nome de uma categoria da lista, ou vazio",
      "prioridade": 5,
      "prazo": null,
      "passos": [{ "texto": "primeira ação", "responsavel": "Eu", "prazo": null }],
      "trecho": ""
    },
    {
      "tipo": "registro",
      "tarefa": "N1",
      "tarefaTitulo": "nome da tarefa nova",
      "registroTipo": "reuniao",
      "data": "AAAA-MM-DD",
      "titulo": "a reunião ou atividade que aconteceu dentro da tarefa nova",
      "participantes": ["Nome"],
      "resumo": "...",
      "decisoes": [],
      "impedimentos": [],
      "passos": [],
      "trecho": "..."
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
- Uma tarefa é o trabalho maior (a demanda). Um registro é algo que ACONTECEU dentro dela: uma reunião, uma atividade, uma decisão. Reunião nunca vira tarefa: vira um registro dentro da tarefa a que ela pertence.
- Se o assunto é de uma tarefa da lista, crie um item "registro" e indique a tarefa pelo código entre colchetes (T1, T2...).
- Se o assunto não cabe em nenhuma tarefa da lista, crie um item "tarefa" para a demanda, com um código próprio em "ref" (N1, N2...), e depois os registros do que aconteceu apontando para esse código no campo "tarefa".
- Em "registroTipo" use: reuniao (teve conversa com outras pessoas), atividade (algo que eu fiz), impedimento, decisao ou nota. Se as anotações falam de uma reunião ou de quem participou, é reuniao, e os nomes vão em "participantes" (sem me incluir).
- Se as anotações dizem que um dos "passos em aberto" foi resolvido, crie um item "passo_concluido" copiando o texto do passo.
- Só vai em "sobras" o que não tem relação com nenhum item. Não jogue em "sobras" detalhes do próprio assunto: eles pertencem ao "resumo" do item.

=== NÃO PERCA INFORMAÇÃO ===
- O "resumo" é uma versão organizada, não encurtada. Tudo o que as anotações dizem sobre o assunto tem que estar nele: explicações, etapas, nomes, siglas, prazos, números, dúvidas e o que eu disse que não lembro ou que preciso conferir depois.
- Quando as anotações explicam como algo funciona, escreva o resumo em tópicos, passo a passo, na ordem em que acontece. Use quebras de linha.
- O que eu marquei como dúvida ou "depois eu vejo" vira também um passo em "passos".
- Em "trecho", copie o pedaço das anotações inteiro, do jeito que está, sem resumir nem corrigir.

=== REGRAS ===
- Use SOMENTE o que está nas anotações. Não invente nomes, datas, decisões ou passos.
- Quando o responsável por um passo for eu (quem escreveu as anotações), escreva "Eu".
- Datas no formato AAAA-MM-DD. Se as anotações não disserem quando aconteceu, use null em "data" (eu ajusto depois). Sem prazo, use null.
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
      /** Tarefa existente que recebe o registro. null quando vai para uma tarefa nova ou não foi reconhecida. */
      tarefaId: string | null;
      /** Chave da proposta de tarefa nova (desta mesma resposta) que recebe o registro. */
      novaChave: string | null;
      /** Motivo para conferir a tarefa com atenção (ex.: o título citado não bate). */
      duvida: string;
      registro: Registro; trecho: string;
      /** "sobras": montada pelo app com o que a IA não encaixou, para o usuário poder guardar numa tarefa. */
      origem: "ia" | "sobras";
      /** true quando a IA não informou a data e o app usou hoje: a tela chama a atenção para conferir. */
      semData: boolean;
    }
  | {
      chave: string; tipo: "tarefa"; ref: string; titulo: string; descricao: string; categoriaId: string | null; categoriaCitada: string;
      prioridade: number; prazo: string | null; passos: Passo[]; trecho: string;
    }
  | { chave: string; tipo: "passo_concluido"; tarefaId: string; registroId: string; passoId: string; texto: string };

export type PropostaRegistro = Extract<Proposta, { tipo: "registro" }>;
export type PropostaTarefa = Extract<Proposta, { tipo: "tarefa" }>;

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

const tipoDe = (item: Record<string, unknown>) => semAcento(txt(item.tipo, 40)).replace(/[^a-z]+/g, "_");
const refDe = (v: unknown) => txt(v, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Lê a resposta da IA e devolve propostas. `textoDaNota` (opcional) serve para avisar quando a IA
 * aproveitou só uma parte pequena do que foi escrito.
 */
export function interpretarNotas(resposta: string, tarefas: Tarefa[], categorias: Categoria[], textoDaNota = ""): LeituraNotas {
  const falha = (erro: string): LeituraNotas => ({ ok: false, erro, propostas: [], avisos: [], sobras: "" });
  if (!resposta.trim()) return falha("Cole a resposta do Copilot.");
  if (resposta.length > MAX_RESPOSTA) return falha("A resposta colada é grande demais. Organize as notas em partes menores.");
  const bruto = extrairJson(resposta);
  if (bruto === undefined)
    return falha("Não achei um JSON válido na resposta. Ela pode ter vindo cortada: peça ao Copilot para repetir só o JSON e cole de novo.");
  const todos = Array.isArray(bruto) ? bruto : obj(bruto) && Array.isArray(bruto.itens) ? bruto.itens : null;
  if (!todos) return falha('O JSON não tem a lista "itens". Peça ao Copilot para seguir o formato do prompt.');

  const avisos: string[] = [];
  const propostas: Proposta[] = [];
  const abertas = apelidosDasTarefas(tarefas);
  const hoje = hojeISO();
  if (todos.length > MAX_ITENS) avisos.push(`A resposta tinha ${todos.length} itens. Li só os primeiros ${MAX_ITENS}.`);
  const itens = todos.slice(0, MAX_ITENS).map((item) => ({ item, chave: novoId("x") }));

  // Tarefas novas primeiro: os registros podem apontar para elas pelo "ref" (N1, N2...), em qualquer ordem.
  const novasPorRef = new Map<string, string>();
  for (const { item, chave } of itens) {
    if (!obj(item) || tipoDe(item) !== "tarefa" || !txt(item.titulo, MAX_TITULO)) continue;
    const ref = refDe(item.ref);
    if (ref && !abertas.some((a) => a.apelido === ref) && !novasPorRef.has(ref)) novasPorRef.set(ref, chave);
  }

  /** Tarefa citada no item: nova (pelo ref), ou existente pelo apelido conferido com o título, ou só pelo título. */
  const acharTarefa = (item: Record<string, unknown>): { tarefa: Tarefa | null; novaChave: string | null; duvida: string } => {
    const cod = txt(item.tarefa, 100);
    const titulo = txt(item.tarefaTitulo, MAX_TITULO);
    const nova = novasPorRef.get(refDe(cod));
    if (nova) return { tarefa: null, novaChave: nova, duvida: "" };
    const porApelido = abertas.find((a) => a.apelido.toLowerCase() === cod.toLowerCase())?.tarefa
      ?? abertas.find((a) => a.tarefa.id === cod)?.tarefa ?? null;
    const porTitulo = titulo ? abertas.filter((a) => mesmoTexto(a.tarefa.titulo, titulo)).map((a) => a.tarefa) : [];
    const com = (tarefa: Tarefa | null, duvida: string) => ({ tarefa, novaChave: null, duvida });
    if (porApelido && (!titulo || mesmoTexto(porApelido.titulo, titulo))) return com(porApelido, "");
    if (porTitulo.length === 1) return com(porTitulo[0], porApelido ? "O código e o título vieram diferentes. Usei o título: confira." : "");
    if (porApelido) return com(porApelido, `A IA citou o título “${titulo}”, que não bate com esta tarefa. Confira.`);
    return com(null, titulo ? `Não reconheci a tarefa “${titulo}”. Escolha uma.` : "A IA não disse de qual tarefa é. Escolha uma.");
  };

  for (const { item, chave } of itens) {
    if (!obj(item)) continue;
    const tipo = tipoDe(item);

    if (tipo === "registro") {
      const rt = semAcento(txt(item.registroTipo, 40));
      const tipoReg: TipoRegistro = TIPOS_REGISTRO.some((x) => x.id === rt && x.id !== "marco") ? (rt as TipoRegistro) : "nota";
      const trecho = txt(item.trecho);
      const data = dataValida(item.data);
      const registro = normalizarRegistro({
        id: novoId("r"),
        tipo: tipoReg,
        data: data ?? hoje,
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
      const dataRuim = item.data !== undefined && item.data !== null && item.data !== "" && !data;
      if (dataRuim) avisos.push(`Data inválida em “${registro.titulo || "um registro"}”. Usei a de hoje: confira.`);
      const { tarefa, novaChave, duvida } = acharTarefa(item);
      propostas.push({ chave, tipo: "registro", tarefaId: tarefa?.id ?? null, novaChave, duvida, registro, trecho, origem: "ia", semData: !data });
    } else if (tipo === "tarefa") {
      const titulo = txt(item.titulo, MAX_TITULO);
      if (!titulo) {
        avisos.push("Ignorei uma tarefa nova sem título.");
        continue;
      }
      const citada = txt(item.categoria, 120);
      const cat = citada ? categorias.find((c) => !c.arquivada && semAcento(c.nome) === semAcento(citada)) : undefined;
      const prio = Math.round(Number(item.prioridade));
      const ref = refDe(item.ref);
      propostas.push({
        chave, tipo: "tarefa", titulo,
        ref: novasPorRef.get(ref) === chave ? ref : "",
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

  // A IA tende a encurtar. Se os trechos que ela copiou somam bem menos que a folha, avisa:
  // o texto inteiro continua guardado na folha e fica ligado a cada registro criado.
  const tamanho = textoDaNota.trim().length;
  if (tamanho >= 300) {
    const usado = propostas.reduce((n, p) => n + (p.tipo === "passo_concluido" ? 0 : p.trecho.length), 0) + sobras.length;
    const parte = Math.round((usado / tamanho) * 100);
    if (parte < 60)
      avisos.push(`A IA copiou só cerca de ${parte}% do seu texto nos trechos. Nada se perde: o texto inteiro continua na folha, e cada registro criado aponta para ela.`);
  }

  // O que não coube vira uma proposta a mais (desmarcada): o usuário escolhe uma tarefa e guarda como nota.
  if (sobras)
    propostas.push({
      chave: novoId("x"), tipo: "registro", tarefaId: null, novaChave: null, duvida: "", trecho: sobras, origem: "sobras", semData: false,
      registro: normalizarRegistro({ id: novoId("r"), tipo: "nota", data: hoje, titulo: "Anotações soltas do bloco de notas", anotacoes: sobras }),
    });
  return { ok: true, erro: "", propostas, avisos, sobras };
}

// ---------- aplicação (transformações puras; quem grava é a tela, via Provider) ----------

/**
 * Quantas propostas marcadas levam "o conteúdo" da folha. Quando é uma só (o caso comum: uma
 * folha, uma reunião), o registro guarda o texto INTEIRO da folha em vez do trecho que a IA copiou.
 */
export function levaTextoInteiro(escolhidas: Proposta[]): boolean {
  const registros = escolhidas.filter((p) => p.tipo === "registro" && p.origem === "ia");
  const tarefasSozinhas = escolhidas.filter(
    (p) => p.tipo === "tarefa" && !escolhidas.some((r) => r.tipo === "registro" && r.novaChave === p.chave),
  );
  return registros.length + tarefasSozinhas.length === 1;
}

/** O registro como vai ser gravado: ligado à folha de origem e com as anotações originais. */
export function registroDaProposta(p: PropostaRegistro, nota: Nota, opcoes: { textoInteiro: boolean; data?: string }): Registro {
  return {
    ...p.registro,
    data: opcoes.data && dataValida(opcoes.data) ? opcoes.data : p.registro.data,
    notaId: nota.id,
    anotacoes: p.origem === "ia" && opcoes.textoInteiro ? nota.texto : p.registro.anotacoes,
  };
}

/** Acrescenta à tarefa o registro proposto. Use dentro de atualizarTarefa(id, fn). */
export function comRegistroDaNota(t: Tarefa, registro: Registro): Tarefa {
  if (t.registros.some((r) => r.id === registro.id)) return t;
  return { ...t, registros: [...t.registros, registro] };
}

/**
 * Monta a tarefa nova: marco "Tarefa criada" e, se for o caso, uma nota inicial.
 * `temRegistros`: há registros desta folha que vão entrar nela. Nesse caso a nota inicial só existe
 * se houver passos, para não repetir o texto que já vai nos registros.
 */
export function tarefaDaProposta(
  p: PropostaTarefa, nota: Nota,
  opcoes: {
    textoInteiro?: boolean; temRegistros?: boolean;
    /** Data do marco "Tarefa criada". Use a do registro mais antigo que vai entrar nela, para a
     *  linha do tempo não mostrar uma reunião acontecendo antes de a tarefa existir. */
    dataMarco?: string;
  } = {},
): Tarefa {
  const t = normalizarTarefa({
    id: novoId("t"), titulo: p.titulo, descricao: p.descricao, categoriaId: p.categoriaId, prioridade: p.prioridade, prazo: p.prazo, status: "a_fazer",
  });
  t.registros.push(
    normalizarRegistro({
      tipo: "marco", data: opcoes.dataMarco && dataValida(opcoes.dataMarco) && opcoes.dataMarco < hojeISO() ? opcoes.dataMarco : hojeISO(),
      titulo: "Tarefa criada", anotacoes: "", alteracoes: { status: { de: "", para: "a_fazer" } },
    }),
  );
  const texto = opcoes.temRegistros ? "" : opcoes.textoInteiro ? nota.texto : p.trecho;
  if (p.passos.length || texto)
    t.registros.push(
      normalizarRegistro({
        id: novoId("r"), tipo: "nota", data: hojeISO(), titulo: nota.titulo ? `Do bloco de notas: ${nota.titulo}` : "Do bloco de notas",
        anotacoes: texto, proximosPassos: p.passos, notaId: nota.id,
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
