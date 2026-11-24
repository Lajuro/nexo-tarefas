// Perfis de uso (3.20): jeitos diferentes de usar o mesmo app, como os espaços de trabalho de um editor de imagem.
//
// Um perfil é um ARRANJO da interface com nome: o que aparece no menu e em que ordem, as seções da barra lateral,
// as ferramentas da barra superior, os blocos da tela Hoje, a tela em que o app abre e três visões padrão.
// Não inclui tema nem cores (isso é a aparência, com os temas prontos) nem dado nenhum.
//
// As preferências que já existiam ("moldura", "telaHoje", "lateralRecolhida"...) CONTINUAM sendo a verdade do que
// está na tela: nenhum leitor delas mudou. A preferência nova, "perfis", guarda só qual perfil está em uso, os
// perfis próprios e como cada perfil foi deixado da última vez (a memória). Perder a chave "perfis" perde os nomes
// e as memórias, nunca o arranjo em uso.
//
// Cada perfil lembra como você o deixou: mexeu no perfil Foco, trocou para Reuniões e voltou, o Foco está como
// ficou. "Redefinir este perfil" volta ao original. A memória só é escrita ao trocar de perfil.
//
// Tudo aqui é função pura e entrada não confiável (localStorage e código colado): listas fechadas, tamanhos
// limitados e nada vira caminho, HTML ou código. Os hooks ficam em components/shell/Perfis.tsx.
// Testado em testes/perfis.test.mjs.

import { type Moldura, MOLDURA_PADRAO, naOrdem, normalizarMoldura } from "./moldura";
import { type TelaHoje, TELA_HOJE_PADRAO, normalizarTelaHoje } from "./tela-hoje";

// ---------- o arranjo ----------

/** As telas em que o app pode abrir: só as do menu (lista fechada; um código colado nunca escolhe um endereço). */
export const INICIOS = [
  "/", "/tarefas", "/rotina", "/pendencias", "/notas", "/paginas", "/perguntar", "/categorias", "/pessoas", "/links", "/radar", "/diario", "/revisao",
  "/relatorios", "/conquistas",
] as const;
export type Inicio = (typeof INICIOS)[number];

export const VISOES_DE_TAREFAS = ["grade", "lista", "quadro"] as const;
export const AGRUPAMENTOS_DE_PENDENCIAS = ["tarefa", "prazo", "pessoa"] as const;

/** Visões que o perfil ajusta ao entrar. Campo ausente = o perfil não mexe nisso. */
export interface TelasDoPerfil {
  visaoTarefas?: (typeof VISOES_DE_TAREFAS)[number];
  agrupamentoPendencias?: (typeof AGRUPAMENTOS_DE_PENDENCIAS)[number];
  soMeus?: boolean;
}

export type MolduraDoPerfil = Omit<Moldura, "largura">;
export type HojeDoPerfil = Omit<TelaHoje, "nome">;

export interface Arranjo {
  /** A moldura sem a largura da barra lateral (largura é do monitor, não do jeito de trabalhar). */
  moldura: MolduraDoPerfil;
  /** A tela Hoje sem o nome da saudação (o nome é da pessoa, não do perfil). */
  hoje: HojeDoPerfil;
  /** A tela em que o app abre. Vale só na primeira entrada da sessão. */
  inicio: Inicio;
  lateralRecolhida: boolean;
  telas: TelasDoPerfil;
}

const semLargura = ({ largura: _largura, ...resto }: Moldura): MolduraDoPerfil => resto;
const semNome = ({ nome: _nome, ...resto }: TelaHoje): HojeDoPerfil => resto;

export const ARRANJO_PADRAO: Arranjo = { moldura: semLargura(MOLDURA_PADRAO), hoje: semNome(TELA_HOJE_PADRAO), inicio: "/", lateralRecolhida: false, telas: {} };

const objeto = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export const normalizarInicio = (x: unknown): Inicio => (INICIOS.includes(x as Inicio) ? (x as Inicio) : "/");

export function normalizarTelas(x: unknown): TelasDoPerfil {
  const t = objeto(x);
  const out: TelasDoPerfil = {};
  if (VISOES_DE_TAREFAS.includes(t.visaoTarefas as never)) out.visaoTarefas = t.visaoTarefas as TelasDoPerfil["visaoTarefas"];
  if (AGRUPAMENTOS_DE_PENDENCIAS.includes(t.agrupamentoPendencias as never)) out.agrupamentoPendencias = t.agrupamentoPendencias as TelasDoPerfil["agrupamentoPendencias"];
  if (typeof t.soMeus === "boolean") out.soMeus = t.soMeus;
  return out;
}

/** Aceita qualquer coisa (localStorage, código colado) e devolve um arranjo válido. */
export function normalizarArranjo(x: unknown): Arranjo {
  const a = objeto(x);
  return {
    moldura: semLargura(normalizarMoldura(a.moldura)),
    hoje: semNome(normalizarTelaHoje(a.hoje)),
    inicio: normalizarInicio(a.inicio),
    lateralRecolhida: a.lateralRecolhida === true,
    telas: normalizarTelas(a.telas),
  };
}

/** O arranjo que está na tela agora, montado das preferências vivas. */
export function arranjoVivo(partes: { moldura: Moldura; hoje: TelaHoje; inicio: unknown; lateralRecolhida: unknown; telas?: unknown }): Arranjo {
  return {
    moldura: semLargura(normalizarMoldura(partes.moldura)),
    hoje: semNome(normalizarTelaHoje(partes.hoje)),
    inicio: normalizarInicio(partes.inicio),
    lateralRecolhida: partes.lateralRecolhida === true,
    telas: normalizarTelas(partes.telas),
  };
}

const conjunto = (lista: readonly string[]) => [...new Set(lista)].sort().join("|");

/**
 * Os dois arranjos dão a mesma tela? Compara pelo que se vê: a ordem EFETIVA do menu (uma ordem vazia e a ordem
 * padrão escrita por extenso são a mesma coisa) e as listas de escondidos como conjunto. As visões por tela ficam
 * de fora: trocar a lista de tarefas para quadro não é "mexer no perfil".
 * `hrefs`: todos os itens do menu, na ordem original (de components/shell/navegacao.ts).
 */
export function mesmoArranjo(a: Arranjo, b: Arranjo, hrefs: readonly string[] = []): boolean {
  const ordem = (m: MolduraDoPerfil) => naOrdem([...hrefs], m.ordem, (h) => h).join("|");
  const visiveis = (m: MolduraDoPerfil) => conjunto(m.ocultos.filter((h) => !hrefs.length || hrefs.includes(h)));
  const [ma, mb, ha, hb] = [a.moldura, b.moldura, a.hoje, b.hoje];
  return (
    ordem(ma) === ordem(mb) &&
    visiveis(ma) === visiveis(mb) &&
    ma.titulosDeGrupo === mb.titulosDeGrupo &&
    ma.contadores === mb.contadores &&
    ma.secoes.join("|") === mb.secoes.join("|") &&
    conjunto(ma.secoesOcultas) === conjunto(mb.secoesOcultas) &&
    conjunto(ma.secoesFechadas) === conjunto(mb.secoesFechadas) &&
    conjunto(ma.ferramentasOcultas) === conjunto(mb.ferramentasOcultas) &&
    ma.barraStatus === mb.barraStatus &&
    ma.acompanharSeparado === mb.acompanharSeparado &&
    conjunto(ha.ocultos) === conjunto(hb.ocultos) &&
    ha.laterais.join("|") === hb.laterais.join("|") &&
    ha.primeiro === hb.primeiro &&
    a.inicio === b.inicio &&
    a.lateralRecolhida === b.lateralRecolhida
  );
}

// ---------- os perfis prontos ----------

export interface PerfilPronto {
  id: string;
  nome: string;
  /** Uma linha: para que serve. */
  descricao: string;
  arranjo: Arranjo;
}

/** Monta o arranjo de um perfil pronto: só o que muda em relação ao padrão. */
function arranjo(p: { moldura?: Partial<MolduraDoPerfil>; hoje?: Partial<HojeDoPerfil>; inicio?: Inicio; lateralRecolhida?: boolean; telas?: TelasDoPerfil }): Arranjo {
  return normalizarArranjo({
    moldura: { ...ARRANJO_PADRAO.moldura, ...p.moldura },
    hoje: { ...ARRANJO_PADRAO.hoje, ...p.hoje },
    inicio: p.inicio ?? "/",
    lateralRecolhida: p.lateralRecolhida ?? false,
    telas: p.telas ?? {},
  });
}

/** A chave do item único "Acompanhar" no menu (igual a ITEM_ACOMPANHAR.href de components/shell/navegacao.ts). */
const ACOMPANHAR = "/acompanhar";

export const PERFIL_COMPLETO = "completo";

export const PERFIS_PRONTOS: readonly PerfilPronto[] = [
  { id: PERFIL_COMPLETO, nome: "Completo", descricao: "Tudo à vista, como o Nexo vem.", arranjo: arranjo({}) },
  {
    id: "foco", nome: "Foco", descricao: "Dia de execução: o foco de hoje na frente e o resto fora do caminho.",
    arranjo: arranjo({
      moldura: {
        ocultos: ["/perguntar", "/categorias", "/pessoas", "/links", ACOMPANHAR], titulosDeGrupo: false, contadores: false, secoesOcultas: ["assuntos"],
        ferramentasOcultas: ["agenda", "telaCheia", "ajuda"], barraStatus: false,
      },
      hoje: { primeiro: "foco", ocultos: ["aguardando", "bloqueadas", "semana"] },
      lateralRecolhida: true,
      telas: { visaoTarefas: "lista", agrupamentoPendencias: "prazo", soMeus: true },
    }),
  },
  {
    id: "reunioes", nome: "Reuniões", descricao: "Dia de conversas: rotina, pendências por pessoa e o bloco de notas à mão.",
    arranjo: arranjo({
      moldura: {
        ordem: ["/", "/rotina", "/pendencias", "/notas", "/tarefas"], ocultos: ["/perguntar", "/links", "/categorias"], secoesOcultas: ["assuntos"],
        ferramentasOcultas: ["foco"],
      },
      hoje: { primeiro: "precisa", laterais: ["rotina", "aguardando", "progresso", "bloqueadas"] },
      telas: { agrupamentoPendencias: "pessoa", soMeus: false },
    }),
  },
  {
    id: "gestao", nome: "Gestão", descricao: "Planejamento e status: Radar, Relatórios e o que está esperando alguém.",
    arranjo: arranjo({
      moldura: { ocultos: ["/conquistas", "/perguntar", "/notas", "/rotina"], secoesOcultas: ["foco"], ferramentasOcultas: ["foco"], acompanharSeparado: true },
      hoje: { primeiro: "precisa", ocultos: ["captura"], laterais: ["aguardando", "bloqueadas", "rotina", "progresso"] },
      inicio: "/radar",
      telas: { visaoTarefas: "quadro", agrupamentoPendencias: "pessoa", soMeus: false },
    }),
  },
  {
    id: "estudo", nome: "Estudo", descricao: "Ler, escrever e perguntar: páginas, links e categorias na frente.",
    arranjo: arranjo({
      moldura: {
        ordem: ["/", "/tarefas", "/notas", "/paginas", "/perguntar", "/links", "/categorias"], ocultos: ["/pendencias", "/rotina", "/pessoas", ACOMPANHAR],
        secoesOcultas: ["foco"], ferramentasOcultas: ["rotina", "agenda", "foco"],
      },
      hoje: { primeiro: "foco", ocultos: ["reunioes", "aguardando", "bloqueadas", "rotina"] },
      inicio: "/paginas",
    }),
  },
];

// ---------- o estado guardado ----------

export const MAX_PERFIS_PROPRIOS = 12;
export const TAMANHO_DO_NOME_DO_PERFIL = 32;

export interface PerfilProprio {
  /** "pp" + letras e números. */
  id: string;
  nome: string;
  /** De qual perfil pronto ele veio (blocos criados em versões futuras seguem o pronto de origem). */
  base: string;
  arranjo: Arranjo;
}

export interface EstadoDosPerfis {
  v: 1;
  /** O perfil em uso (id de um pronto ou de um próprio). */
  ativo: string;
  proprios: PerfilProprio[];
  /** Como cada perfil foi deixado da última vez que se saiu dele. Sem entrada = como veio. */
  memoria: Record<string, Arranjo>;
}

export const ESTADO_INICIAL: EstadoDosPerfis = { v: 1, ativo: PERFIL_COMPLETO, proprios: [], memoria: {} };

const ID_DE_PROPRIO = /^pp[a-z0-9]{4,24}$/;
const ehPronto = (id: unknown): id is string => typeof id === "string" && PERFIS_PRONTOS.some((p) => p.id === id);

/** Nome de perfil: uma linha curta de texto. É desenhado como texto pelo React. */
export function nomeDePerfil(x: unknown): string {
  if (typeof x !== "string") return "";
  return x.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, TAMANHO_DO_NOME_DO_PERFIL).trim();
}

export function novoIdDePerfil(): string {
  return `pp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function normalizarProprios(x: unknown): PerfilProprio[] {
  const out: PerfilProprio[] = [];
  const vistos = new Set<string>();
  for (const bruto of Array.isArray(x) ? x.slice(0, 60) : []) {
    const p = objeto(bruto);
    const nome = nomeDePerfil(p.nome);
    if (typeof p.id !== "string" || !ID_DE_PROPRIO.test(p.id) || vistos.has(p.id) || !nome) continue;
    vistos.add(p.id);
    out.push({ id: p.id, nome, base: ehPronto(p.base) ? p.base : PERFIL_COMPLETO, arranjo: normalizarArranjo(p.arranjo) });
    if (out.length >= MAX_PERFIS_PROPRIOS) break;
  }
  return out;
}

/** Aceita qualquer coisa que venha do localStorage e devolve um estado válido. */
export function normalizarPerfis(x: unknown): EstadoDosPerfis {
  const e = objeto(x);
  const proprios = normalizarProprios(e.proprios);
  const existe = (id: unknown): id is string => ehPronto(id) || proprios.some((p) => p.id === id);
  const memoria: Record<string, Arranjo> = {};
  for (const [id, arr] of Object.entries(objeto(e.memoria)).slice(0, 60)) if (existe(id)) memoria[id] = normalizarArranjo(arr);
  return { v: 1, ativo: existe(e.ativo) ? e.ativo : PERFIL_COMPLETO, proprios, memoria };
}

// ---------- perguntas ----------

export interface PerfilNaLista { id: string; nome: string; descricao: string; proprio: boolean; base: string }

/** Todos os perfis, na ordem do menu: os prontos e depois os próprios. */
export function listaDePerfis(e: EstadoDosPerfis): PerfilNaLista[] {
  return [
    ...PERFIS_PRONTOS.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, proprio: false, base: p.id })),
    ...e.proprios.map((p) => ({ id: p.id, nome: p.nome, descricao: `Seu, feito a partir de ${PERFIS_PRONTOS.find((x) => x.id === p.base)?.nome ?? "Completo"}.`, proprio: true, base: p.base })),
  ];
}

/** O arranjo original do perfil: o do pronto, ou o que foi salvo no próprio. */
export function baseDoPerfil(e: EstadoDosPerfis, id: string): Arranjo {
  return e.proprios.find((p) => p.id === id)?.arranjo ?? PERFIS_PRONTOS.find((p) => p.id === id)?.arranjo ?? ARRANJO_PADRAO;
}

/** O arranjo com que o perfil abre: como foi deixado da última vez, ou o original. */
export const arranjoDoPerfil = (e: EstadoDosPerfis, id: string): Arranjo => e.memoria[id] ?? baseDoPerfil(e, id);

/** O perfil em uso foi mexido em relação ao original? (É o que habilita "Redefinir este perfil".) */
export const perfilModificado = (e: EstadoDosPerfis, agora: Arranjo, hrefs: readonly string[] = []) => !mesmoArranjo(agora, baseDoPerfil(e, e.ativo), hrefs);

// ---------- mudanças (puras: devolvem o estado novo e, quando é o caso, o arranjo a aplicar na tela) ----------

export interface Mudanca { estado: EstadoDosPerfis; aplicar?: Arranjo }

/** Troca de perfil: guarda como o de agora ficou e abre o outro como foi deixado. Trocar para o mesmo não faz nada. */
export function trocarPerfil(e: EstadoDosPerfis, para: string, agora: Arranjo): Mudanca {
  if (para === e.ativo || !listaDePerfis(e).some((p) => p.id === para)) return { estado: e };
  const estado: EstadoDosPerfis = { ...e, ativo: para, memoria: { ...e.memoria, [e.ativo]: agora } };
  return { estado, aplicar: arranjoDoPerfil(estado, para) };
}

/** Volta o perfil em uso a como veio (ou a como foi salvo, se é um perfil próprio). */
export function redefinirPerfil(e: EstadoDosPerfis): Mudanca {
  const { [e.ativo]: _esquecida, ...memoria } = e.memoria;
  return { estado: { ...e, memoria }, aplicar: baseDoPerfil(e, e.ativo) };
}

/**
 * Salva o arranjo de agora como um perfil novo, que passa a ser o perfil em uso. O perfil de onde se saiu volta
 * a ser como estava antes das mudanças (elas foram para o perfil novo). Devolve o estado igual se não cabe mais.
 */
export function salvarComoPerfil(e: EstadoDosPerfis, nome: string, agora: Arranjo, id = novoIdDePerfil()): Mudanca {
  const limpo = nomeDePerfil(nome);
  if (!limpo || e.proprios.length >= MAX_PERFIS_PROPRIOS || !ID_DE_PROPRIO.test(id) || e.proprios.some((p) => p.id === id)) return { estado: e };
  const origem = e.proprios.find((p) => p.id === e.ativo)?.base ?? (ehPronto(e.ativo) ? e.ativo : PERFIL_COMPLETO);
  // o perfil de origem esquece também o que lembrava de uma saída anterior: as mudanças agora moram no perfil novo
  const { [e.ativo]: _esquecida, ...memoria } = e.memoria;
  return { estado: { ...e, ativo: id, memoria, proprios: [...e.proprios, { id, nome: limpo, base: origem, arranjo: normalizarArranjo(agora) }] } };
}

/** Grava o arranjo de agora como o original de um perfil próprio ("Atualizar este perfil com o arranjo de agora"). */
export function atualizarPerfilProprio(e: EstadoDosPerfis, id: string, agora: Arranjo): Mudanca {
  if (!e.proprios.some((p) => p.id === id)) return { estado: e };
  const { [id]: _esquecida, ...memoria } = e.memoria;
  return { estado: { ...e, memoria, proprios: e.proprios.map((p) => (p.id === id ? { ...p, arranjo: normalizarArranjo(agora) } : p)) } };
}

export function renomearPerfil(e: EstadoDosPerfis, id: string, nome: string): Mudanca {
  const limpo = nomeDePerfil(nome);
  if (!limpo || !e.proprios.some((p) => p.id === id)) return { estado: e };
  return { estado: { ...e, proprios: e.proprios.map((p) => (p.id === id ? { ...p, nome: limpo } : p)) } };
}

/** Uma cópia de qualquer perfil (pronto ou próprio), como ele abre hoje. A cópia não vira o perfil em uso. */
export function duplicarPerfil(e: EstadoDosPerfis, id: string, nome: string, novoId = novoIdDePerfil()): Mudanca {
  const origem = listaDePerfis(e).find((p) => p.id === id);
  const limpo = nomeDePerfil(nome);
  if (!origem || !limpo || e.proprios.length >= MAX_PERFIS_PROPRIOS || !ID_DE_PROPRIO.test(novoId) || e.proprios.some((p) => p.id === novoId)) return { estado: e };
  return { estado: { ...e, proprios: [...e.proprios, { id: novoId, nome: limpo, base: origem.base, arranjo: arranjoDoPerfil(e, id) }] } };
}

/** Acrescenta um perfil recebido de fora (código colado) aos próprios. Não vira o perfil em uso. */
export function acrescentarPerfil(e: EstadoDosPerfis, recebido: { nome: string; base: string; arranjo: Arranjo }, id = novoIdDePerfil()): Mudanca {
  const limpo = nomeDePerfil(recebido.nome);
  if (!limpo || e.proprios.length >= MAX_PERFIS_PROPRIOS || !ID_DE_PROPRIO.test(id) || e.proprios.some((p) => p.id === id)) return { estado: e };
  // dois perfis com o mesmo nome confundem o menu: o que chega ganha um número
  const nomes = new Set(listaDePerfis(e).map((p) => p.nome.toLowerCase()));
  let nome = limpo;
  for (let n = 2; nomes.has(nome.toLowerCase()) && n < 99; n++) nome = `${limpo.slice(0, TAMANHO_DO_NOME_DO_PERFIL - 4).trim()} (${n})`;
  return { estado: { ...e, proprios: [...e.proprios, { id, nome, base: ehPronto(recebido.base) ? recebido.base : PERFIL_COMPLETO, arranjo: normalizarArranjo(recebido.arranjo) }] } };
}

/** Exclui um perfil próprio. Se era o perfil em uso, o app volta para o pronto de onde ele veio. */
export function excluirPerfil(e: EstadoDosPerfis, id: string): Mudanca {
  const alvo = e.proprios.find((p) => p.id === id);
  if (!alvo) return { estado: e };
  const { [id]: _esquecida, ...memoria } = e.memoria;
  const estado: EstadoDosPerfis = { ...e, memoria, proprios: e.proprios.filter((p) => p.id !== id), ativo: e.ativo === id ? alvo.base : e.ativo };
  return e.ativo === id ? { estado, aplicar: arranjoDoPerfil(estado, estado.ativo) } : { estado };
}

/**
 * A primeira vez que o app abre com perfis (a chave "perfis" ainda não existe). Quem nunca personalizou está no
 * Completo. Quem já tinha arrumado as barras ou a tela Hoje não perde nada: o arranjo vira o perfil próprio
 * "Meu arranjo", já em uso.
 */
export function perfisIniciais(agora: Arranjo, hrefs: readonly string[] = [], id = novoIdDePerfil()): EstadoDosPerfis {
  if (mesmoArranjo(agora, ARRANJO_PADRAO, hrefs)) return ESTADO_INICIAL;
  return salvarComoPerfil(ESTADO_INICIAL, "Meu arranjo", agora, id).estado;
}

// ---------- levar um perfil para outro computador ----------

const MARCA_DO_PERFIL = "perfil";
export const TAMANHO_MAXIMO_DO_CODIGO = 20_000;

/** O texto para copiar: um perfil só (nome e arranjo). Não leva tema, nome da saudação nem dado nenhum. */
export function textoDoPerfil(nome: string, arr: Arranjo, base = PERFIL_COMPLETO): string {
  return JSON.stringify({ nexo: MARCA_DO_PERFIL, v: 1, nome: nomeDePerfil(nome), base: ehPronto(base) ? base : PERFIL_COMPLETO, arranjo: normalizarArranjo(arr) });
}

/** Lê o código colado de um perfil. Devolve o perfil já conferido ou o motivo de não ter servido. */
export function lerPerfil(texto: string): { ok: true; valor: { nome: string; base: string; arranjo: Arranjo } } | { ok: false; erro: string } {
  if (typeof texto !== "string" || !texto.trim()) return { ok: false, erro: "Cole o código do perfil." };
  if (texto.length > TAMANHO_MAXIMO_DO_CODIGO) return { ok: false, erro: "Esse texto é grande demais para ser um código de perfil." };
  const [inicio, fim] = [texto.indexOf("{"), texto.lastIndexOf("}")];
  if (inicio < 0 || fim <= inicio) return { ok: false, erro: "Não achei um código de perfil nesse texto. Copie de novo." };
  let lido: unknown;
  try {
    lido = JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return { ok: false, erro: "O código veio cortado ou alterado. Copie de novo." };
  }
  const x = objeto(lido);
  if (x.nexo === "personalizacao") return { ok: false, erro: "Esse é um código de personalização inteira. Cole em Aparência, em \"Levar para outro computador\"." };
  if (x.nexo !== MARCA_DO_PERFIL) return { ok: false, erro: "Esse texto não é um código de perfil do Nexo." };
  return { ok: true, valor: { nome: nomeDePerfil(x.nome) || "Perfil recebido", base: ehPronto(x.base) ? x.base : PERFIL_COMPLETO, arranjo: normalizarArranjo(x.arranjo) } };
}

/** Os perfis como viajam no código de personalização inteira: sem a memória (que é só deste navegador). */
export function perfisParaLevar(e: EstadoDosPerfis): { ativo: string; proprios: PerfilProprio[] } {
  return { ativo: e.ativo, proprios: e.proprios };
}
