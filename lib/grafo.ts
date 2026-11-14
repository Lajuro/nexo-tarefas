// Mapa das páginas: quem liga para quem. Os nós são as páginas (e, se pedido, as tarefas e pessoas que elas
// citam); as ligações vêm dos links internos do texto e da árvore (página dentro de página).
// Tudo é calculado na hora e a disposição é determinística: os mesmos dados dão sempre o mesmo desenho.

import { alvosDoTexto } from "./ligacoes";
import { nomeDaPagina } from "./paginas";
import type { Dados } from "./tipos";

export interface NoDoGrafo {
  /** "pagina:<id>", "tarefa:<id>" ou "pessoa:<nome sem acento>". */
  id: string;
  tipo: "pagina" | "tarefa" | "pessoa";
  rotulo: string;
  /** Para onde ir ao clicar. */
  rota: string;
  /** Cor da categoria (dado do usuário), quando há. */
  cor: string | null;
  /** Quantas ligações chegam ou saem. */
  grau: number;
  video?: boolean;
}

export interface ArestaDoGrafo {
  de: string;
  para: string;
  /** "link": citação no texto. "arvore": página dentro de página. */
  tipo: "link" | "arvore";
}

export interface Grafo {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Páginas sem nenhuma ligação (nem citam, nem são citadas, nem estão na árvore de outra). */
  soltas: number;
}

export function montarGrafo(dados: Dados, opcoes: { tarefas?: boolean; pessoas?: boolean; arvore?: boolean } = {}): Grafo {
  const paginas = (dados.paginas?.items ?? []).filter((p) => !p.arquivadaEm);
  const cor = new Map(dados.categorias.items.map((c) => [c.id, c.cor]));
  const nos = new Map<string, NoDoGrafo>();
  for (const p of paginas)
    nos.set(`pagina:${p.id}`, { id: `pagina:${p.id}`, tipo: "pagina", rotulo: nomeDaPagina(p), rota: `/paginas?p=${p.id}`, cor: cor.get(p.categoriaId ?? "") ?? null, grau: 0, video: p.tipo === "video" });

  const arestas = new Map<string, ArestaDoGrafo>();
  const ligar = (de: string, para: string, tipo: ArestaDoGrafo["tipo"]) => {
    if (de === para || !nos.has(de) || !nos.has(para)) return;
    // uma ligação por par, em qualquer sentido; a citação vale mais que a árvore
    const chave = [de, para].sort().join(" ");
    const atual = arestas.get(chave);
    if (!atual || (atual.tipo === "arvore" && tipo === "link")) arestas.set(chave, { de, para, tipo });
  };

  const tarefas = new Map(dados.tarefas.map((t) => [t.id, t]));
  for (const p of paginas) {
    const de = `pagina:${p.id}`;
    for (const alvo of alvosDoTexto(p.texto)) {
      const tipo = alvo.slice(0, alvo.indexOf(":"));
      const id = alvo.slice(alvo.indexOf(":") + 1);
      if (tipo === "pagina") ligar(de, `pagina:${id}`, "link");
      else if (tipo === "tarefa" && opcoes.tarefas) {
        const t = tarefas.get(id);
        if (!t) continue;
        if (!nos.has(alvo)) nos.set(alvo, { id: alvo, tipo: "tarefa", rotulo: t.titulo, rota: `/tarefas/${t.id}`, cor: cor.get(t.categoriaId ?? "") ?? null, grau: 0 });
        ligar(de, alvo, "link");
      } else if (tipo === "pessoa" && opcoes.pessoas) {
        if (!nos.has(alvo)) nos.set(alvo, { id: alvo, tipo: "pessoa", rotulo: id.replace(/\b\p{L}/gu, (c) => c.toUpperCase()), rota: `/pessoas?p=${encodeURIComponent(id)}`, cor: null, grau: 0 });
        ligar(de, alvo, "link");
      }
    }
  }
  if (opcoes.arvore !== false) for (const p of paginas) if (p.paiId) ligar(`pagina:${p.paiId}`, `pagina:${p.id}`, "arvore");

  for (const a of arestas.values()) {
    nos.get(a.de)!.grau++;
    nos.get(a.para)!.grau++;
  }
  const lista = [...nos.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { nos: lista, arestas: [...arestas.values()], soltas: lista.filter((n) => n.tipo === "pagina" && n.grau === 0).length };
}

export interface Posicao { x: number; y: number }

/**
 * Espalha os nós: os ligados se aproximam, todos se afastam um pouco uns dos outros (o método de
 * Fruchterman e Reingold, com um número fixo de passos). Começa de um círculo, na ordem dos ids, então o
 * resultado é sempre o mesmo para os mesmos dados. Devolve posições dentro de [0, largura] x [0, altura].
 */
export function disporGrafo(grafo: Grafo, largura = 1000, altura = 700, passos = 260): Map<string, Posicao> {
  const n = grafo.nos.length;
  const pos = new Map<string, Posicao>();
  if (!n) return pos;
  const cx = largura / 2;
  const cy = altura / 2;
  if (n === 1) return pos.set(grafo.nos[0].id, { x: cx, y: cy });
  // espiral de partida: quem tem mais ligações começa mais perto do centro
  const ordem = [...grafo.nos].sort((a, b) => b.grau - a.grau || a.id.localeCompare(b.id));
  ordem.forEach((no, i) => {
    const r = (Math.min(largura, altura) / 2.4) * Math.sqrt((i + 0.5) / n);
    const a = i * 2.399963; // ângulo áureo
    pos.set(no.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
  const k = Math.sqrt((largura * altura) / n) * 0.82;
  const ids = grafo.nos.map((x) => x.id);
  for (let passo = 0; passo < passos; passo++) {
    const temperatura = (Math.min(largura, altura) / 8) * (1 - passo / passos) + 0.5;
    const forca = new Map<string, Posicao>(ids.map((id) => [id, { x: 0, y: 0 }]));
    // todos se afastam
    for (let i = 0; i < n; i++) {
      const a = pos.get(ids[i])!;
      for (let j = i + 1; j < n; j++) {
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = ((i * 7 + j * 13) % 11) - 5 || 1; dy = ((i * 3 + j * 5) % 7) - 3 || 1; d = Math.hypot(dx, dy); }
        const f = (k * k) / d;
        const fa = forca.get(ids[i])!;
        const fb = forca.get(ids[j])!;
        fa.x += (dx / d) * f; fa.y += (dy / d) * f;
        fb.x -= (dx / d) * f; fb.y -= (dy / d) * f;
      }
    }
    // os ligados se aproximam
    for (const e of grafo.arestas) {
      const a = pos.get(e.de)!;
      const b = pos.get(e.para)!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = ((d * d) / k) * (e.tipo === "arvore" ? 0.6 : 1);
      const fa = forca.get(e.de)!;
      const fb = forca.get(e.para)!;
      fa.x -= (dx / d) * f; fa.y -= (dy / d) * f;
      fb.x += (dx / d) * f; fb.y += (dy / d) * f;
    }
    // um puxão leve para o centro segura os grupos soltos na tela
    for (const id of ids) {
      const p = pos.get(id)!;
      const f = forca.get(id)!;
      f.x += (cx - p.x) * 0.09 * (k / 40);
      f.y += (cy - p.y) * 0.09 * (k / 40);
      const d = Math.hypot(f.x, f.y) || 0.01;
      const passoMax = Math.min(d, temperatura);
      p.x += (f.x / d) * passoMax;
      p.y += (f.y / d) * passoMax;
    }
  }
  // encaixa o desenho na tela, com margem e sem deformar (em vez de espremer os nós contra as bordas)
  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margem = 70;
  const escala = Math.min((largura - margem * 2) / Math.max(1, x1 - x0), (altura - margem * 2) / Math.max(1, y1 - y0), 1.4);
  for (const p of pos.values()) {
    p.x = Math.round((cx + (p.x - (x0 + x1) / 2) * escala) * 10) / 10;
    p.y = Math.round((cy + (p.y - (y0 + y1) / 2) * escala) * 10) / 10;
  }
  return pos;
}

/** Os vizinhos de um nó (para destacar ao passar o ponteiro). */
export function vizinhosDe(grafo: Grafo, id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const a of grafo.arestas) {
    if (a.de === id) out.add(a.para);
    else if (a.para === id) out.add(a.de);
  }
  return out;
}
