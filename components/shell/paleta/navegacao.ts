// Navegação por setas na paleta. Os itens ficam em grades e listas misturadas, então o vizinho
// é calculado pela posição real de cada item na tela, não pela ordem no código.

export type Direcao = "cima" | "baixo" | "esquerda" | "direita";

const centro = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * Devolve o índice do vizinho de `atual` na direção pedida, ou null se não houver
 * (quem chama decide se dá a volta). `colunaAlvo` é o x que o usuário "quer manter"
 * ao subir e descer: assim, passar por uma lista de largura cheia não perde a coluna.
 */
export function vizinho(els: HTMLElement[], atual: number, dir: Direcao, colunaAlvo: number | null): number | null {
  const el = els[atual];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const c = centro(r);
  const rects = els.map((e) => e.getBoundingClientRect());

  if (dir === "cima" || dir === "baixo") {
    const desce = dir === "baixo";
    const candidatos = rects
      .map((rr, i) => ({ rr, i }))
      .filter(({ rr, i }) => i !== atual && (desce ? rr.top >= r.bottom - 2 : rr.bottom <= r.top + 2));
    if (!candidatos.length) return null;
    // a linha mais próxima: o menor topo para baixo, o maior fundo para cima
    const borda = desce ? Math.min(...candidatos.map((x) => x.rr.top)) : Math.max(...candidatos.map((x) => x.rr.bottom));
    const linha = candidatos.filter((x) => Math.abs((desce ? x.rr.top : x.rr.bottom) - borda) < 6);
    const alvoX = colunaAlvo ?? c.x;
    // dentro da linha, o que cobre a coluna; se nenhum cobre, o de centro mais perto
    const cobre = linha.find((x) => x.rr.left <= alvoX && x.rr.right >= alvoX);
    if (cobre) return cobre.i;
    linha.sort((a, b) => Math.abs(centro(a.rr).x - alvoX) - Math.abs(centro(b.rr).x - alvoX));
    return linha[0].i;
  }

  const paraDireita = dir === "direita";
  const mesmaLinha = rects
    .map((rr, i) => ({ rr, i }))
    .filter(({ rr, i }) => {
      if (i === atual) return false;
      const cc = centro(rr);
      if (Math.abs(cc.y - c.y) > Math.max(r.height, rr.height) / 2) return false;
      return paraDireita ? cc.x > c.x + 1 : cc.x < c.x - 1;
    })
    .sort((a, b) => Math.abs(centro(a.rr).x - c.x) - Math.abs(centro(b.rr).x - c.x));
  if (mesmaLinha.length) return mesmaLinha[0].i;
  // fim da linha: segue para o próximo (ou anterior) na ordem de leitura, sem dar a volta
  const seq = atual + (paraDireita ? 1 : -1);
  return seq >= 0 && seq < els.length ? seq : null;
}
