// Ligações entre as coisas do Nexo: quem cita quem. Os textos em Markdown podem ter links internos
// ("nexo:tarefa/<id>", "nexo:pagina/<id>", "nexo:pessoa/<nome>", "nexo:categoria/<id>"); aqui eles são
// lidos para responder "quem aponta para cá?". Função pura: nada é gravado, o índice é montado na hora.

import { type TipoDeAlvo, linkInterno } from "./texto-rico";
import { type Dados, formatarData, semAcento, tipoInfo } from "./tipos";

export interface Citacao {
  /** De onde vem a citação. */
  origem: "registro" | "pagina" | "nota" | "tarefa";
  rotulo: string;
  detalhe: string;
  /** Para onde ir ao clicar. */
  rota: string;
  /** AAAA-MM-DD (ou carimbo) para ordenar: o mais recente primeiro. */
  data: string;
}

const LINK = /\]\((nexo:(?:tarefa|pagina|categoria|pessoa)\/[^)\s]+)\)/g;

/** Chave única de um alvo. Pessoa é comparada sem acento nem maiúscula, como no resto do app. */
export function chaveDoAlvo(tipo: TipoDeAlvo, alvo: string): string {
  return `${tipo}:${tipo === "pessoa" ? semAcento(alvo).replace(/\s+/g, " ").trim() : alvo}`;
}

/** Os alvos citados num texto (sem repetir). */
export function alvosDoTexto(md: string): string[] {
  const out = new Set<string>();
  for (const m of (md || "").matchAll(LINK)) {
    const l = linkInterno(m[1]);
    if (l) out.add(chaveDoAlvo(l.tipo, l.alvo));
  }
  return [...out];
}

/** Índice: chave do alvo → todas as citações a ele. */
export function indiceDeCitacoes(dados: Dados): Map<string, Citacao[]> {
  const indice = new Map<string, Citacao[]>();
  const anotar = (texto: string, c: Citacao, propria?: string) => {
    for (const chave of alvosDoTexto(texto)) {
      if (chave === propria) continue; // citar a si mesmo não conta
      const lista = indice.get(chave);
      if (lista) lista.push(c);
      else indice.set(chave, [c]);
    }
  };
  for (const t of dados.tarefas) {
    const propria = chaveDoAlvo("tarefa", t.id);
    anotar(t.descricao, { origem: "tarefa", rotulo: t.titulo, detalhe: "Na descrição da tarefa", rota: `/tarefas/${t.id}`, data: t.atualizadaEm }, propria);
    for (const r of t.registros)
      anotar(`${r.anotacoes}\n${r.resumoIA}\n${r.decisoes}\n${r.impedimentos}`, {
        origem: "registro",
        rotulo: r.titulo || tipoInfo(r.tipo).nome,
        detalhe: `${tipoInfo(r.tipo).nome} de ${formatarData(r.data)} em “${t.titulo}”`,
        rota: `/tarefas/${t.id}?r=${r.id}`,
        data: r.data,
      }, propria);
  }
  for (const p of dados.paginas?.items ?? [])
    anotar(p.texto, { origem: "pagina", rotulo: p.titulo || "Página sem título", detalhe: "Página de conhecimento", rota: `/paginas?p=${p.id}`, data: p.atualizadaEm }, chaveDoAlvo("pagina", p.id));
  for (const n of dados.notas?.items ?? [])
    anotar(n.texto, { origem: "nota", rotulo: n.titulo || "Folha do bloco de notas", detalhe: n.arquivadaEm ? "Folha arquivada" : "Folha aberta", rota: `/notas?n=${n.id}`, data: n.atualizadaEm });
  for (const lista of indice.values()) lista.sort((a, b) => b.data.localeCompare(a.data));
  return indice;
}

export function citacoesDe(indice: Map<string, Citacao[]>, tipo: TipoDeAlvo, alvo: string, outrosNomes: string[] = []): Citacao[] {
  const chaves = [chaveDoAlvo(tipo, alvo), ...outrosNomes.map((n) => chaveDoAlvo(tipo, n))];
  const vistas = new Set<string>();
  const out: Citacao[] = [];
  for (const k of new Set(chaves))
    for (const c of indice.get(k) ?? []) {
      const id = `${c.rota}|${c.rotulo}`;
      if (!vistas.has(id)) {
        vistas.add(id);
        out.push(c);
      }
    }
  return out.sort((a, b) => b.data.localeCompare(a.data));
}
