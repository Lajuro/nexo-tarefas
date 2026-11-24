// Registro de decisões (3.23): todas as decisões de todas as tarefas, num lugar só, para responder
// "quando decidimos isso, e com quem?". Nada é gravado: é uma leitura dos registros que já existem.
//
// De onde vêm:
//   - o campo Decisões de qualquer registro (uma decisão por linha, com ou sem marca de lista);
//   - os registros do tipo "decisão": quando o campo Decisões está vazio, a decisão é o título dele.
//
// A mesma decisão escrita em dois registros da MESMA tarefa aparece uma vez (a mais antiga), com "também em".
// Entre tarefas diferentes não se junta: são contextos diferentes.
//
// Funções puras. Testadas em testes/decisoes.test.mjs.

import { paraTextoPlano } from "./texto-rico";
import { type Registro, type Tarefa, type TipoRegistro, formatarData, semAcento } from "./tipos";

export interface Decisao {
  /** Estável: tarefa, registro e posição. */
  chave: string;
  /** AAAA-MM-DD do registro. */
  data: string;
  texto: string;
  tarefaId: string;
  tarefaTitulo: string;
  categoriaId: string | null;
  registroId: string;
  registroTitulo: string;
  tipo: TipoRegistro;
  /** Quem estava no registro em que a decisão foi tomada. */
  participantes: string[];
  /** Outros registros da mesma tarefa que repetem esta decisão (os mais novos). */
  tambemEm: { registroId: string; data: string }[];
}

const MAX_TEXTO = 600;

/** As decisões de um texto: uma por linha, sem a marca de lista, sem linha vazia. */
export function linhasDeDecisao(texto: string): string[] {
  // linha por linha, e só depois a formatação: passar o texto inteiro pelo leitor de Markdown juntaria linhas
  // que ele entende como continuação da mesma lista
  return String(texto ?? "")
    .split("\n")
    .map((l) => paraTextoPlano(l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, MAX_TEXTO));
}

/** O texto para comparar duas decisões: sem acento, maiúsculas e pontuação. */
const chaveDoTexto = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, " ").trim();

/** As decisões de um registro. */
function doRegistro(r: Registro): string[] {
  const doCampo = linhasDeDecisao(r.decisoes);
  if (doCampo.length) return doCampo;
  // registro do tipo "decisão" sem o campo preenchido: a decisão é o título (e o resumo explica)
  return r.tipo === "decisao" && r.titulo.trim() ? [r.titulo.trim().slice(0, MAX_TEXTO)] : [];
}

/** Todas as decisões, da mais nova para a mais antiga. Tarefa na lixeira não chega aqui (não está em dados.tarefas). */
export function decisoesDe(tarefas: Tarefa[]): Decisao[] {
  const out: Decisao[] = [];
  for (const t of tarefas) {
    const vistas = new Map<string, Decisao>();
    // do registro mais antigo para o mais novo: a primeira vez que a decisão aparece é a que vale
    const registros = [...t.registros].sort((a, b) => a.data.localeCompare(b.data) || (a.criadoEm ?? "").localeCompare(b.criadoEm ?? ""));
    for (const r of registros) {
      doRegistro(r).forEach((texto, i) => {
        const k = chaveDoTexto(texto);
        if (!k) return;
        const ja = vistas.get(k);
        if (ja) {
          if (ja.registroId !== r.id && !ja.tambemEm.some((x) => x.registroId === r.id)) ja.tambemEm.push({ registroId: r.id, data: r.data });
          return;
        }
        const d: Decisao = {
          chave: `${t.id}:${r.id}:${i}`, data: r.data, texto, tarefaId: t.id, tarefaTitulo: t.titulo, categoriaId: t.categoriaId ?? null,
          registroId: r.id, registroTitulo: r.titulo, tipo: r.tipo, participantes: r.participantes, tambemEm: [],
        };
        vistas.set(k, d);
        out.push(d);
      });
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data) || a.tarefaTitulo.localeCompare(b.tarefaTitulo) || a.chave.localeCompare(b.chave));
}

export interface FiltroDeDecisoes {
  texto?: string;
  /** Id da categoria, ou "" para "sem categoria". undefined = todas. */
  categoriaId?: string;
  /** Nome de quem estava (comparado sem acento; casa com parte do nome). */
  pessoa?: string;
  /** AAAA-MM-DD, inclusive. */
  desde?: string;
  ate?: string;
}

export function filtrarDecisoes(lista: Decisao[], f: FiltroDeDecisoes): Decisao[] {
  const palavras = semAcento(f.texto ?? "").split(/\s+/).filter(Boolean);
  const pessoa = semAcento(f.pessoa ?? "").trim();
  return lista.filter((d) => {
    if (f.categoriaId !== undefined && (d.categoriaId ?? "") !== f.categoriaId) return false;
    if (f.desde && d.data < f.desde) return false;
    if (f.ate && d.data > f.ate) return false;
    if (pessoa && !d.participantes.some((p) => semAcento(p).includes(pessoa))) return false;
    if (palavras.length) {
      const onde = semAcento(`${d.texto} ${d.tarefaTitulo} ${d.registroTitulo}`);
      if (!palavras.every((p) => onde.includes(p))) return false;
    }
    return true;
  });
}

/** As decisões agrupadas por mês ("2026-11"), do mês mais novo para o mais antigo. */
export function decisoesPorMes(lista: Decisao[]): { mes: string; decisoes: Decisao[] }[] {
  const grupos = new Map<string, Decisao[]>();
  for (const d of lista) {
    const mes = d.data.slice(0, 7);
    grupos.set(mes, [...(grupos.get(mes) ?? []), d]);
  }
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mes, decisoes]) => ({ mes, decisoes }));
}

/** Quem aparece nas decisões, do mais frequente para o menos (para o filtro por pessoa). */
export function pessoasDasDecisoes(lista: Decisao[]): string[] {
  const vezes = new Map<string, { nome: string; n: number }>();
  for (const d of lista)
    for (const p of d.participantes) {
      const k = semAcento(p).trim();
      if (!k) continue;
      const x = vezes.get(k) ?? { nome: p.trim(), n: 0 };
      x.n++;
      vezes.set(k, x);
    }
  return [...vezes.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)).map((x) => x.nome);
}

/** As decisões em texto simples, para colar num e-mail ou numa ata. Só o que está nos registros. */
export function textoDasDecisoes(lista: Decisao[], titulo = "Decisões"): string {
  if (!lista.length) return `${titulo}: nenhuma no período.\n`;
  const L = [`${titulo} (${lista.length}):`, ""];
  for (const d of lista) {
    const gente = d.participantes.length ? `, com ${d.participantes.join(", ")}` : "";
    L.push(`- ${formatarData(d.data, false)}: ${d.texto} [${d.tarefaTitulo}${gente}]`);
  }
  return L.join("\n") + "\n";
}
