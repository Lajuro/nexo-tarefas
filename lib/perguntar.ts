// Perguntar ao Nexo: o usuário escreve uma pergunta, o app acha os trechos do histórico que têm a ver
// e monta um prompt para o Copilot responder SÓ com esses trechos, citando cada um ([F1], [F2]...).
// Não há API de IA nem índice gravado: tudo é calculado na hora, em funções puras sobre os dados.
// A resposta colada de volta é entrada não confiável: só é mostrada pelo leitor de Markdown, e os
// links das citações são calculados aqui a partir das fontes, nunca lidos do texto.

import { quemSouEu } from "./prompts";
import { hrefInterno, paraTextoPlano } from "./texto-rico";
import { type Dados, type Registro, type Tarefa, formatarData, hojeISO, nomeStatus, semAcento, tipoInfo } from "./tipos";

export type TipoFonte = "registro" | "tarefa" | "pagina" | "nota" | "link" | "pessoa";

export interface Fonte {
  /** Como a fonte é citada: "F1", "F2"... */
  rotulo: string;
  tipo: TipoFonte;
  /** Chave única da fonte ("registro:<tarefaId>:<registroId>", "pagina:<id>"...). */
  chave: string;
  titulo: string;
  /** De onde veio: tarefa, categoria. */
  contexto: string;
  /** AAAA-MM-DD, quando a fonte tem data. */
  data: string | null;
  /** O texto que vai para o prompt (sem marcação). */
  trecho: string;
  /** Para abrir a fonte dentro do app. */
  rota: string;
  /** Link interno ("nexo:...") para guardar numa página, quando o tipo tem um. */
  interno: string | null;
  pontos: number;
  /** Palavras da pergunta que esta fonte tem. */
  termos: string[];
}

/** O que se guarda de uma fonte depois que o prompt foi copiado (o trecho não precisa ficar). */
export type FonteCitada = Pick<Fonte, "rotulo" | "tipo" | "chave" | "titulo" | "contexto" | "data" | "rota" | "interno">;

export const TAMANHOS = { curto: 6000, medio: 12000, longo: 24000 } as const;
export type Tamanho = keyof typeof TAMANHOS;

// Palavras que não ajudam a achar nada (já sem acento).
const VAZIAS = new Set(
  ("a o as os um uma uns umas de do da dos das e em no na nos nas por para pra pro com sem que qual quais quem quando onde como porque " +
    "foi foram era eram ser sao esta estao estava tem tinha ter teve houve ha ja nao sim mais menos sobre entre ate ao aos se me eu meu minha " +
    "meus minhas isso isto esse essa esses essas este estes estas aquele aquela la ou mas tambem so ficou ficaram fazer feito fez fiz " +
    "pode podem posso preciso precisa devo deve tudo todo toda todos todas algum alguma alguns algo cada pelo pela pelos pelas num numa dele dela deles delas nosso nossa " +
    "the of and to in is").split(" "),
);

/** Tira o plural e algumas terminações, para "exceções" achar "exceção" e "squads" achar "squad". */
function radical(palavra: string): string {
  for (const fim of ["coes", "cao", "oes", "aes", "ao", "es", "s"]) {
    if (palavra.length - fim.length >= 4 && palavra.endsWith(fim)) return palavra.slice(0, -fim.length) + (fim === "coes" || fim === "cao" ? "c" : "");
  }
  return palavra;
}

/** As palavras da pergunta que valem para a busca (sem acento, sem palavras vazias, sem repetição). */
export function termosDaPergunta(pergunta: string): { palavra: string; radical: string }[] {
  const vistos = new Set<string>();
  const out: { palavra: string; radical: string }[] = [];
  for (const palavra of semAcento(pergunta || "").split(/[^a-z0-9]+/)) {
    if (palavra.length < 2 || VAZIAS.has(palavra)) continue;
    const r = radical(palavra);
    if (vistos.has(r)) continue;
    vistos.add(r);
    out.push({ palavra, radical: r });
    if (out.length >= 16) break;
  }
  return out;
}

const ehLetra = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);

/** Quantas vezes uma palavra que começa com o radical aparece no texto (já normalizado). */
function contar(texto: string, rad: string, max = 3): number {
  let n = 0;
  let i = texto.indexOf(rad);
  while (i !== -1 && n < max) {
    if (!ehLetra(texto[i - 1])) n++;
    i = texto.indexOf(rad, i + rad.length);
  }
  return n;
}

interface Candidata {
  tipo: TipoFonte;
  chave: string;
  titulo: string;
  contexto: string;
  data: string | null;
  rota: string;
  interno: string | null;
  /** Texto completo que vai para o prompt, em linhas, sem marcação. */
  corpo: string;
  /** Só o conteúdo do usuário, sem os rótulos que o app acrescenta ("Decisões:", "Pode ajudar com:"), para a pontuação. */
  busca?: string;
  /** Multiplicador: referência do assunto, página de conhecimento... */
  peso: number;
  /** Para as dicas de intenção da pergunta. */
  tem?: { decisoes?: boolean; pendencias?: boolean; impedimentos?: boolean };
}

const buscaDoRegistro = (r: Registro) =>
  [r.participantes.join(", "), r.resumoIA, r.decisoes, ...r.proximosPassos.map((p) => `${p.texto} ${p.responsavel ?? ""}`), r.impedimentos, r.anotacoes].map((x) => paraTextoPlano(x || "")).filter(Boolean).join("\n");

function corpoDoRegistro(r: Registro): string {
  const L: string[] = [];
  const bloco = (rotulo: string, texto: string) => {
    const t = paraTextoPlano(texto);
    if (t) L.push(`${rotulo}: ${t}`);
  };
  if (r.participantes.length) L.push(`Participantes: ${r.participantes.join(", ")}`);
  bloco("Resumo", r.resumoIA);
  bloco("Decisões", r.decisoes);
  if (r.proximosPassos.length)
    L.push("Próximos passos:", ...r.proximosPassos.map((p) => `- ${p.texto}${p.responsavel ? ` (${p.responsavel})` : ""}${p.prazo ? ` até ${formatarData(p.prazo)}` : ""} [${p.feito ? "feito" : "em aberto"}]`));
  bloco("Impedimentos", r.impedimentos);
  bloco("Anotações", r.anotacoes);
  return L.join("\n");
}

// Tirar a marcação de cada registro é a parte cara. O resultado fica guardado por registro (o objeto só muda
// quando a tarefa é regravada) e a lista pronta fica guardada por conjunto de dados, para a busca não refazer
// tudo a cada letra digitada na pergunta.
const textosGuardados = new WeakMap<Registro, { corpo: string; busca: string }>();
function textosDoRegistro(r: Registro) {
  let t = textosGuardados.get(r);
  if (!t) {
    t = { corpo: corpoDoRegistro(r), busca: buscaDoRegistro(r) };
    textosGuardados.set(r, t);
  }
  return t;
}

interface Preparadas {
  todas: Candidata[];
  normalizadas: { titulo: string; contexto: string; corpo: string }[];
}
const preparadasGuardadas = new WeakMap<Dados, Map<string, Preparadas>>();
function preparar(dados: Dados, categoriaId: string | null): Preparadas {
  let porCategoria = preparadasGuardadas.get(dados);
  if (!porCategoria) preparadasGuardadas.set(dados, (porCategoria = new Map()));
  const chave = categoriaId ?? "";
  let p = porCategoria.get(chave);
  if (!p) {
    const todas = candidatas(dados, categoriaId);
    p = { todas, normalizadas: todas.map((c) => ({ titulo: semAcento(c.titulo), contexto: semAcento(c.contexto), corpo: semAcento(c.busca ?? c.corpo) })) };
    porCategoria.set(chave, p);
  }
  return p;
}

function candidatas(dados: Dados, categoriaId: string | null): Candidata[] {
  const out: Candidata[] = [];
  const nomeCat = (id?: string | null) => dados.categorias.items.find((c) => c.id === id)?.nome ?? "";
  const daCategoria = (id?: string | null) => !categoriaId || id === categoriaId;
  const tarefaPorId = new Map(dados.tarefas.map((t) => [t.id, t]));

  for (const t of dados.tarefas) {
    if (!daCategoria(t.categoriaId)) continue;
    const cat = nomeCat(t.categoriaId);
    const ctx = `tarefa "${t.titulo}"${cat ? `, categoria "${cat}"` : ""}`;
    const cab = [
      `Status: ${nomeStatus(t.status)}`,
      t.prazo ? `Prazo: ${formatarData(t.prazo)}` : "",
      t.esperando ? `Aguardando ${[t.esperando.quem, t.esperando.oQue].filter(Boolean).join(": ")} desde ${formatarData(t.esperando.desde)}` : "",
      t.tags.length ? `Tags: ${t.tags.join(", ")}` : "",
    ].filter(Boolean);
    const corpoTarefa = [...cab, paraTextoPlano(t.descricao), t.panoramaIA?.texto ? `Panorama (${formatarData(t.panoramaIA.geradoEm)}): ${paraTextoPlano(t.panoramaIA.texto)}` : ""].filter(Boolean).join("\n");
    out.push({
      tipo: "tarefa", chave: `tarefa:${t.id}`, titulo: `Tarefa: ${t.titulo}`, contexto: cat ? `categoria "${cat}"` : "", data: (t.atualizadaEm || t.criadaEm || "").slice(0, 10) || null,
      rota: `/tarefas/${t.id}`, interno: hrefInterno("tarefa", t.id), corpo: corpoTarefa, peso: 1,
      busca: [paraTextoPlano(t.descricao), paraTextoPlano(t.panoramaIA?.texto ?? ""), t.esperando?.quem ?? "", t.esperando?.oQue ?? "", t.tags.join(" ")].join("\n"),
    });
    for (const r of t.registros) {
      const { corpo, busca } = textosDoRegistro(r);
      if (!corpo && !r.titulo) continue;
      if (r.tipo === "marco" && !corpo) continue; // "Tarefa criada", "Status alterado": não respondem nada
      out.push({
        tipo: "registro", chave: `registro:${t.id}:${r.id}`, titulo: `${tipoInfo(r.tipo).nome}${r.titulo ? `: ${r.titulo}` : ""}`, contexto: ctx, data: r.data || null,
        rota: `/tarefas/${t.id}?r=${r.id}`, interno: hrefInterno("tarefa", t.id), corpo, busca, peso: r.referencia ? 1.25 : 1,
        tem: { decisoes: !!r.decisoes.trim(), pendencias: r.proximosPassos.some((p) => !p.feito), impedimentos: !!r.impedimentos.trim() || r.tipo === "impedimento" },
      });
    }
  }
  for (const p of dados.paginas?.items ?? []) {
    if (!daCategoria(p.categoriaId)) continue;
    const cat = nomeCat(p.categoriaId);
    out.push({
      tipo: "pagina", chave: `pagina:${p.id}`, titulo: `Página: ${p.titulo || "sem título"}`, contexto: cat ? `categoria "${cat}"` : "", data: (p.atualizadaEm || "").slice(0, 10) || null,
      rota: `/paginas?p=${p.id}`, interno: hrefInterno("pagina", p.id), corpo: paraTextoPlano(p.texto), peso: 1.15,
    });
  }
  if (!categoriaId)
    for (const n of dados.notas?.items ?? []) {
      const corpo = [paraTextoPlano(n.texto), n.sobras ? `Sobras: ${paraTextoPlano(n.sobras)}` : ""].filter(Boolean).join("\n");
      if (!corpo) continue;
      out.push({
        tipo: "nota", chave: `nota:${n.id}`, titulo: `Folha do bloco de notas${n.titulo ? `: ${n.titulo}` : ""}`, contexto: n.arquivadaEm ? "arquivada" : "", data: (n.atualizadaEm || "").slice(0, 10) || null,
        rota: `/notas?n=${n.id}`, interno: null, corpo, peso: n.arquivadaEm ? 0.8 : 1, // a folha arquivada já virou registro: vale menos que ele
      });
    }
  for (const l of dados.links.items) {
    const t = l.tarefaId ? tarefaPorId.get(l.tarefaId) : undefined;
    if (!daCategoria(l.categoriaId ?? t?.categoriaId)) continue;
    const corpo = [l.descricao, l.url ?? l.nomeArquivo ?? "", l.tags.length ? `Tags: ${l.tags.join(", ")}` : ""].filter(Boolean).join("\n");
    out.push({
      tipo: "link", chave: `link:${l.id}`, titulo: `${l.tipo === "arquivo" ? "Documento" : "Link"}: ${l.titulo}`, contexto: t ? `tarefa "${t.titulo}"` : "", data: (l.criadoEm || "").slice(0, 10) || null,
      rota: "/links", interno: null, corpo, peso: 0.9,
    });
  }
  for (const p of dados.pessoas?.items ?? []) {
    if (categoriaId && !p.categoriaIds.includes(categoriaId)) continue;
    const corpo = [
      [p.cargo, p.area].filter(Boolean).join(", "),
      p.apelidos.length ? `Também aparece como: ${p.apelidos.join(", ")}` : "",
      p.ajudaCom ? `Pode ajudar com: ${p.ajudaCom}` : "",
      p.anotacoes,
    ].filter(Boolean).join("\n");
    if (!corpo) continue;
    out.push({
      tipo: "pessoa", chave: `pessoa:${p.id}`, titulo: `Pessoa: ${p.nome}`, contexto: "", data: null,
      rota: `/pessoas?p=${encodeURIComponent(p.nome)}`, interno: hrefInterno("pessoa", p.nome), corpo, peso: 1,
      busca: [p.cargo, p.area, p.apelidos.join(" "), p.ajudaCom, p.anotacoes].join("\n"),
    });
  }
  return out;
}

/** O pedaço do texto que vai para o prompt: inteiro se couber, senão as linhas que têm as palavras e as vizinhas. */
function recortar(corpo: string, radicais: string[], teto: number): string {
  if (corpo.length <= teto) return corpo;
  const linhas = corpo.split("\n");
  const boas = new Set<number>();
  linhas.forEach((l, i) => {
    const n = semAcento(l);
    if (radicais.some((r) => contar(n, r, 1) > 0)) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < linhas.length) boas.add(j);
  });
  if (!boas.size) return corpo.slice(0, teto).trimEnd() + " [...]";
  const out: string[] = [];
  let usado = 0;
  let ultimo = -1;
  for (const i of [...boas].sort((a, b) => a - b)) {
    const l = linhas[i].length > 600 ? linhas[i].slice(0, 600).trimEnd() + " [...]" : linhas[i];
    if (usado + l.length > teto) break;
    if (ultimo !== -1 && i > ultimo + 1) out.push("[...]");
    else if (ultimo === -1 && i > 0) out.push("[...]");
    out.push(l);
    usado += l.length + 1;
    ultimo = i;
  }
  if (ultimo < linhas.length - 1) out.push("[...]");
  return out.join("\n");
}

const diasEntre = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000);

export interface ResultadoDaBusca {
  termos: string[];
  fontes: Fonte[];
  /** Fontes que tinham a ver mas não couberam no tamanho escolhido. */
  deFora: number;
}

/** Acha, em tudo o que está guardado, os trechos que mais têm a ver com a pergunta. */
export function buscarFontes(
  pergunta: string,
  dados: Dados,
  opcoes: { categoriaId?: string | null; limite?: number; maxFontes?: number; hoje?: string } = {},
): ResultadoDaBusca {
  const termos = termosDaPergunta(pergunta);
  if (!termos.length) return { termos: [], fontes: [], deFora: 0 };
  const limite = opcoes.limite ?? TAMANHOS.medio;
  const maxFontes = opcoes.maxFontes ?? Math.max(6, Math.round(limite / 900));
  const hoje = opcoes.hoje ?? hojeISO();
  const { todas, normalizadas } = preparar(dados, opcoes.categoriaId ?? null);

  // Em quantas fontes cada palavra aparece: palavra rara vale mais do que palavra que está em todo lugar.
  const emQuantas = termos.map((t) => normalizadas.filter((n) => contar(n.titulo, t.radical, 1) || contar(n.contexto, t.radical, 1) || contar(n.corpo, t.radical, 1)).length);
  const raridade = emQuantas.map((n) => Math.log(1 + todas.length / Math.max(1, n)));

  // Dicas de intenção: "o que foi decidido", "o que está pendente", "o que está travando".
  const p = semAcento(pergunta);
  const quer = {
    decisoes: /\bdecid|\bdecis|\bcombin|\bacord/.test(p),
    pendencias: /\bpenden|\bfalta|\bproxim|\bem aberto|\ba fazer/.test(p),
    impedimentos: /\bimpedi|\bbloque|\btrav|\bproblema|\brisco/.test(p),
  };

  const pontuadas = todas
    .map((c, i) => {
      const n = normalizadas[i];
      let pontos = 0;
      const achados: string[] = [];
      termos.forEach((t, j) => {
        const noTitulo = contar(n.titulo, t.radical, 1);
        const noContexto = contar(n.contexto, t.radical, 1);
        const noCorpo = contar(n.corpo, t.radical, 3);
        if (!noTitulo && !noContexto && !noCorpo) return;
        achados.push(t.palavra);
        pontos += raridade[j] * (noCorpo + 3 * noTitulo + 1.5 * noContexto);
      });
      if (!achados.length) return null;
      pontos *= (achados.length / termos.length) ** 1.5; // quem tem mais palavras da pergunta sobe
      pontos *= c.peso;
      if (c.data) pontos *= 1 + 0.2 * Math.max(0, 1 - Math.max(0, diasEntre(c.data, hoje)) / 365); // o recente desempata
      if (c.tem && ((quer.decisoes && c.tem.decisoes) || (quer.pendencias && c.tem.pendencias) || (quer.impedimentos && c.tem.impedimentos))) pontos *= 1.3;
      return { c, pontos, achados };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.pontos - a.pontos || (b.c.data ?? "").localeCompare(a.c.data ?? "") || a.c.chave.localeCompare(b.c.chave));

  const melhor = pontuadas[0]?.pontos ?? 0;
  const relevantes = pontuadas.filter((x) => x.pontos >= melhor * 0.12);
  const radicais = termos.map((t) => t.radical);
  const tetoPorFonte = Math.max(700, Math.round(limite / 5));

  const fontes: Fonte[] = [];
  let usado = 0;
  let deFora = 0;
  for (const x of relevantes) {
    if (fontes.length >= maxFontes) { deFora++; continue; }
    const resto = limite - usado;
    if (resto < 250) { deFora++; continue; }
    const trecho = recortar(x.c.corpo, radicais, Math.min(tetoPorFonte, resto));
    usado += trecho.length + x.c.titulo.length + x.c.contexto.length + 30;
    fontes.push({
      rotulo: `F${fontes.length + 1}`, tipo: x.c.tipo, chave: x.c.chave, titulo: x.c.titulo, contexto: x.c.contexto, data: x.c.data,
      trecho, rota: x.c.rota, interno: x.c.interno, pontos: Math.round(x.pontos * 100) / 100, termos: x.achados,
    });
  }
  return { termos: termos.map((t) => t.palavra), fontes, deFora };
}

const cabecalhoDaFonte = (f: Pick<Fonte, "rotulo" | "titulo" | "contexto" | "data">) =>
  `[${f.rotulo}] ${f.titulo}${f.data ? ` (${formatarData(f.data)})` : ""}${f.contexto ? `, ${f.contexto}` : ""}`;

/** O prompt para o Copilot: a pergunta, as regras e as fontes numeradas. */
export function promptPergunta(pergunta: string, fontes: Fonte[], hoje = hojeISO()): string {
  return [
    "Vou te fazer uma pergunta sobre o meu trabalho. Responda usando SOMENTE as fontes abaixo, tiradas do meu organizador de tarefas.",
    quemSouEu().trim(),
    "",
    `Pergunta: ${pergunta.trim()}`,
    "",
    "Regras:",
    "- Responda em português do Brasil. Comece pela resposta direta; depois, se ajudar, detalhe em tópicos curtos.",
    "- Use SOMENTE o que está nas fontes. Não invente nomes, datas, números nem conclusões.",
    "- Depois de cada afirmação, cite de onde ela veio entre colchetes, assim: [F2]. Se veio de mais de uma fonte: [F1][F4].",
    "- Se as fontes não responderem, ou responderem só em parte, diga isso com clareza e aponte o que faltou.",
    "- Se duas fontes disserem coisas diferentes, mostre as duas com as datas e diga qual é a mais recente.",
    `- Hoje é ${formatarData(hoje)}.`,
    "",
    "Fontes:",
    "",
    ...fontes.flatMap((f) => [cabecalhoDaFonte(f), f.trecho || "(sem texto)", ""]),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}

const CITACAO = /\[\s*(F\d{1,2}(?:\s*(?:,|;|\be\b)\s*F\d{1,2})*)\s*\](?!\()/g;

/** Os rótulos de fonte que a resposta cita, na ordem em que aparecem. */
export function fontesCitadas(resposta: string): string[] {
  const out: string[] = [];
  for (const m of (resposta || "").matchAll(CITACAO)) for (const r of m[1].match(/F\d{1,2}/g) ?? []) if (!out.includes(r)) out.push(r);
  return out;
}

/**
 * Troca cada citação "[F2]" da resposta por um link interno para a fonte, quando o tipo tem link interno.
 * O destino vem da lista de fontes do app, nunca do texto da resposta.
 */
export function ligarFontes(resposta: string, fontes: FonteCitada[]): string {
  const porRotulo = new Map(fontes.map((f) => [f.rotulo, f]));
  return (resposta || "").replace(CITACAO, (_tudo, dentro: string) =>
    (dentro.match(/F\d{1,2}/g) ?? []).map((r) => {
      const f = porRotulo.get(r);
      return f?.interno ? `[${r}](${f.interno})` : `\\[${r}\\]`;
    }).join(" "),
  );
}

/**
 * Escreve "<" como "&lt;" fora dos blocos de código, do jeito que o editor rico grava: o que veio colado
 * com cara de HTML fica como texto na página, em qualquer versão do app.
 */
export function semHtml(md: string): string {
  return (md || "").split(/(^```[\s\S]*?^```[^\n]*$)/m).map((parte, i) => (i % 2 ? parte : parte.replace(/<(?=[a-zA-Z/!?])/g, "&lt;"))).join("");
}

/** A resposta pronta para virar uma página de conhecimento: o texto com as citações ligadas e a lista das fontes. */
export function paginaDaResposta(pergunta: string, resposta: string, fontes: FonteCitada[], hoje = hojeISO()): { titulo: string; texto: string } {
  const citadas = new Set(fontesCitadas(resposta));
  const usadas = fontes.filter((f) => citadas.has(f.rotulo));
  const lista = (usadas.length ? usadas : fontes).map((f) => {
    const nome = `${f.titulo}${f.data ? ` (${formatarData(f.data)})` : ""}`.replace(/([\\[\]*_~`])/g, "\\$1");
    return `- **${f.rotulo}**: ${f.interno ? `[${nome}](${f.interno})` : nome}${f.contexto ? `, ${f.contexto.replace(/([\\[\]*_~`])/g, "\\$1")}` : ""}`;
  });
  return {
    titulo: pergunta.trim().replace(/\s+/g, " ").slice(0, 200),
    texto: [
      ligarFontes(semHtml(resposta.trim()), fontes),
      "",
      "---",
      "",
      `**Fontes** (resposta do Copilot à pergunta feita em ${formatarData(hoje)}, só com trechos do Nexo)`,
      "",
      ...lista,
    ].join("\n") + "\n",
  };
}

// ---------- o que fica guardado no navegador entre uma cópia do prompt e a colagem da resposta ----------

export interface Consulta {
  pergunta: string;
  /** "" = em tudo. */
  categoriaId: string;
  tamanho: Tamanho;
  /** Chaves das fontes que o usuário tirou do prompt. */
  fora: string[];
  resposta: string;
  /** A pergunta e as fontes do último prompt copiado: é a elas que os [F1] da resposta se referem. */
  perguntaCopiada: string;
  copiadas: { rotulo: string; chave: string; titulo: string; contexto: string; data: string | null }[];
}

export const CONSULTA_VAZIA: Consulta = { pergunta: "", categoriaId: "", tamanho: "medio", fora: [], resposta: "", perguntaCopiada: "", copiadas: [] };

const ID = "[a-zA-Z0-9_-]{1,80}";
const CHAVE = new RegExp(`^(?:registro:${ID}:${ID}|(?:tarefa|pagina|nota|link|pessoa):${ID})$`);
const texto = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");

/** A consulta vem do localStorage: só entra o que tem a forma certa. Rotas e links nunca são guardados, são recalculados. */
export function normalizarConsulta(x: unknown): Consulta {
  if (!x || typeof x !== "object" || Array.isArray(x)) return CONSULTA_VAZIA;
  const c = x as Partial<Record<keyof Consulta, unknown>>;
  const chaves = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === "string" && CHAVE.test(k)).slice(0, max) : []);
  return {
    pergunta: texto(c.pergunta, 2000),
    categoriaId: typeof c.categoriaId === "string" && new RegExp(`^${ID}$`).test(c.categoriaId) ? c.categoriaId : "",
    tamanho: typeof c.tamanho === "string" && Object.prototype.hasOwnProperty.call(TAMANHOS, c.tamanho) ? (c.tamanho as Tamanho) : "medio",
    fora: chaves(c.fora, 200),
    resposta: texto(c.resposta, 100_000),
    perguntaCopiada: texto(c.perguntaCopiada, 2000),
    copiadas: (Array.isArray(c.copiadas) ? c.copiadas : [])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object" && typeof (f as { rotulo?: unknown }).rotulo === "string" && /^F\d{1,2}$/.test((f as { rotulo: string }).rotulo) && typeof (f as { chave?: unknown }).chave === "string" && CHAVE.test((f as { chave: string }).chave))
      .slice(0, 40)
      .map((f) => ({
        rotulo: f.rotulo as string,
        chave: f.chave as string,
        titulo: texto(f.titulo, 300),
        contexto: texto(f.contexto, 400),
        data: typeof f.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.data) ? f.data : null,
      })),
  };
}

/** Para onde uma fonte leva, calculado da chave e dos dados de agora (null se ela não existe mais). */
export function destinoDaChave(chave: string, dados: Dados): { tipo: TipoFonte; rota: string; interno: string | null } | null {
  if (!CHAVE.test(chave)) return null;
  const [tipo, a, b] = chave.split(":") as [TipoFonte, string, string | undefined];
  if (tipo === "registro") {
    const t = dados.tarefas.find((x) => x.id === a);
    if (!t) return null;
    return { tipo, rota: t.registros.some((r) => r.id === b) ? `/tarefas/${a}?r=${b}` : `/tarefas/${a}`, interno: hrefInterno("tarefa", a) };
  }
  if (tipo === "tarefa") return dados.tarefas.some((x) => x.id === a) ? { tipo, rota: `/tarefas/${a}`, interno: hrefInterno("tarefa", a) } : null;
  if (tipo === "pagina") return (dados.paginas?.items ?? []).some((x) => x.id === a) ? { tipo, rota: `/paginas?p=${a}`, interno: hrefInterno("pagina", a) } : null;
  if (tipo === "nota") return (dados.notas?.items ?? []).some((x) => x.id === a) ? { tipo, rota: `/notas?n=${a}`, interno: null } : null;
  if (tipo === "link") return dados.links.items.some((x) => x.id === a) ? { tipo, rota: "/links", interno: null } : null;
  const pessoa = (dados.pessoas?.items ?? []).find((x) => x.id === a);
  return pessoa ? { tipo, rota: `/pessoas?p=${encodeURIComponent(pessoa.nome)}`, interno: hrefInterno("pessoa", pessoa.nome) } : null;
}

/** As fontes do último prompt copiado, com o destino de cada uma recalculado. Fonte que sumiu fica sem link. */
export function citadasDaConsulta(c: Consulta, dados: Dados): FonteCitada[] {
  return c.copiadas.map((f) => {
    const d = destinoDaChave(f.chave, dados);
    return { ...f, tipo: d?.tipo ?? (f.chave.split(":")[0] as TipoFonte), rota: d?.rota ?? "", interno: d?.interno ?? null };
  });
}
