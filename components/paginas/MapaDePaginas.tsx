"use client";

// Mapa das páginas: cada página é um ponto, cada citação é uma linha. Mostra o que está ligado a quê,
// quais páginas são o centro de um assunto e quais ficaram soltas. A disposição é calculada em lib/grafo.ts
// (sempre a mesma para os mesmos dados); aqui é só desenho, zoom e arrasto.

import { useRouter } from "next/navigation";
import { type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useMemo, useRef, useState } from "react";
import { Minus, Plus, Scan, Search, Waypoints } from "lucide-react";
import { Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { disporGrafo, montarGrafo, vizinhosDe } from "@/lib/grafo";
import { type Dados, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const L = 1000;
const A = 700;

export function MapaDePaginas({ dados, aoAbrir }: { dados: Dados; aoAbrir: (id: string) => void }) {
  const router = useRouter();
  const [comTarefas, setComTarefas] = useState(false);
  const [comPessoas, setComPessoas] = useState(false);
  const [comArvore, setComArvore] = useState(true);
  const [busca, setBusca] = useState("");
  const [sobre, setSobre] = useState<string | null>(null);
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const svg = useRef<SVGSVGElement>(null);

  const grafo = useMemo(() => montarGrafo(dados, { tarefas: comTarefas, pessoas: comPessoas, arvore: comArvore }), [dados, comTarefas, comPessoas, comArvore]);
  const pos = useMemo(() => disporGrafo(grafo, L, A), [grafo]);
  const vizinhos = useMemo(() => (sobre ? vizinhosDe(grafo, sobre) : null), [grafo, sobre]);
  const q = semAcento(busca.trim());
  const achados = useMemo(() => (q ? new Set(grafo.nos.filter((n) => semAcento(n.rotulo).includes(q)).map((n) => n.id)) : null), [grafo, q]);

  // ---------- zoom e arrasto ----------
  const ponto = (clientX: number, clientY: number) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    // a caixa L x A é ajustada à tela com sobra (xMidYMid meet)
    const escala = Math.min(r.width / L, r.height / A);
    return { x: (clientX - r.left - (r.width - L * escala) / 2) / escala, y: (clientY - r.top - (r.height - A * escala) / 2) / escala };
  };
  const zoom = (fator: number, em?: { x: number; y: number }) =>
    setVista((v) => {
      const k = Math.min(4, Math.max(0.4, v.k * fator));
      const c = em ?? { x: L / 2, y: A / 2 };
      // o ponto sob o ponteiro continua sob o ponteiro
      return { k, x: c.x - ((c.x - v.x) / v.k) * k, y: c.y - ((c.y - v.y) / v.k) * k };
    });
  const aoRolar = (e: ReactWheelEvent<SVGSVGElement>) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, ponto(e.clientX, e.clientY));
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const aoPressionar = (e: ReactPointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest("[data-slot=no-do-mapa]")) return;
    const p = ponto(e.clientX, e.clientY);
    arrasto.current = { x: p.x, y: p.y, vx: vista.x, vy: vista.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: ReactPointerEvent<SVGSVGElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const p = ponto(e.clientX, e.clientY);
    setVista((v) => ({ ...v, x: a.vx + (p.x - a.x), y: a.vy + (p.y - a.y) }));
  };

  const abrir = (id: string, rota: string) => {
    if (id.startsWith("pagina:")) aoAbrir(id.slice(7));
    else router.push(rota);
  };

  if ((dados.paginas?.items ?? []).filter((p) => !p.arquivadaEm).length === 0) {
    return <div className="p-6"><Vazio titulo="O mapa aparece quando houver páginas" icone={<Waypoints />}><p>Cada página vira um ponto, e cada citação entre elas ([[ ou @), uma linha.</p></Vazio></div>;
  }

  return (
    <div data-slot="mapa-de-paginas" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
        <div className="relative w-56 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Destacar no mapa" aria-label="Destacar no mapa" className="h-8 pl-8" />
        </div>
        <CampoSwitch marcado={comArvore} aoMudar={setComArvore}>Página dentro de página</CampoSwitch>
        <CampoSwitch marcado={comTarefas} aoMudar={setComTarefas}>Tarefas citadas</CampoSwitch>
        <CampoSwitch marcado={comPessoas} aoMudar={setComPessoas}>Pessoas citadas</CampoSwitch>
        <span data-slot="resumo-do-mapa" className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
          {grafo.nos.length} {grafo.nos.length === 1 ? "ponto" : "pontos"} · {grafo.arestas.length} {grafo.arestas.length === 1 ? "ligação" : "ligações"}
          {grafo.soltas > 0 && ` · ${grafo.soltas} ${grafo.soltas === 1 ? "página solta" : "páginas soltas"}`}
        </span>
        <div className="flex items-center gap-0.5">
          <Dica texto="Aproximar"><Button variant="ghost" size="icon-sm" aria-label="Aproximar" onClick={() => zoom(1.25)}><Plus /></Button></Dica>
          <Dica texto="Afastar"><Button variant="ghost" size="icon-sm" aria-label="Afastar" onClick={() => zoom(0.8)}><Minus /></Button></Dica>
          <Dica texto="Ver tudo"><Button variant="ghost" size="icon-sm" aria-label="Ver tudo" onClick={() => setVista({ x: 0, y: 0, k: 1 })}><Scan /></Button></Dica>
        </div>
      </div>

      <svg ref={svg} viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de ligações entre as páginas"
        className={cn("min-h-0 w-full flex-1 touch-none select-none bg-muted/20", arrasto.current ? "cursor-grabbing" : "cursor-grab")}
        onWheel={aoRolar} onPointerDown={aoPressionar} onPointerMove={aoMover}
        onPointerUp={(e) => { arrasto.current = null; e.currentTarget.releasePointerCapture(e.pointerId); }}>
        <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
          {grafo.arestas.map((a) => {
            const de = pos.get(a.de);
            const para = pos.get(a.para);
            if (!de || !para) return null;
            const viva = !vizinhos || (vizinhos.has(a.de) && vizinhos.has(a.para) && (a.de === sobre || a.para === sobre));
            return (
              <line key={`${a.de} ${a.para}`} x1={de.x} y1={de.y} x2={para.x} y2={para.y} data-slot="ligacao-do-mapa" data-tipo={a.tipo}
                strokeDasharray={a.tipo === "arvore" ? "3 4" : undefined} strokeWidth={(viva && vizinhos ? 1.8 : 1) / vista.k}
                className={cn("transition-opacity", viva && vizinhos ? "stroke-primary" : "stroke-muted-foreground/45", !viva && "opacity-15")} />
            );
          })}
          {grafo.nos.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const r = (n.tipo === "pagina" ? 6 + Math.min(9, n.grau * 1.4) : 5) / Math.sqrt(vista.k);
            const apagado = (vizinhos && !vizinhos.has(n.id)) || (achados && !achados.has(n.id));
            const comRotulo = !apagado && (n.grau >= 2 || vista.k >= 1.5 || n.id === sobre || !!vizinhos?.has(n.id) || !!achados?.has(n.id) || grafo.nos.length <= 24);
            return (
              <g key={n.id} data-slot="no-do-mapa" data-id={n.id} data-tipo={n.tipo} role="button" tabIndex={0} aria-label={n.rotulo}
                transform={`translate(${p.x} ${p.y})`}
                className={cn("cursor-pointer outline-none transition-opacity [&:focus-visible>circle]:stroke-ring [&:focus-visible>rect]:stroke-ring", apagado && "opacity-20")}
                onPointerEnter={() => setSobre(n.id)} onPointerLeave={() => setSobre(null)}
                onClick={() => abrir(n.id, n.rota)}
                onKeyDown={(e) => { if (e.key === "Enter") abrir(n.id, n.rota); }}>
                {/* área de clique maior que o ponto (e que pega o rótulo), para não exigir pontaria */}
                <circle r={r + 12 / vista.k} className="fill-transparent" />
                {n.tipo === "tarefa" ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} strokeWidth={1.5 / vista.k} className="fill-alerta stroke-background" />
                ) : (
                  <circle r={r} strokeWidth={(n.video ? 2.5 : 1.5) / vista.k} style={n.tipo === "pagina" && n.cor ? { fill: n.cor } : undefined}
                    className={cn(n.tipo === "pessoa" ? "fill-sucesso stroke-background" : n.video ? "fill-primary stroke-foreground" : "fill-primary stroke-background")} />
                )}
                {comRotulo && (
                  <text y={r + 11 / vista.k} textAnchor="middle" fontSize={10.5 / vista.k} className={cn("pointer-events-none fill-foreground", (n.id === sobre || achados?.has(n.id)) && "font-semibold")}
                    style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 / vista.k, strokeLinejoin: "round" }}>
                    {n.rotulo.length > 30 ? `${n.rotulo.slice(0, 29)}…` : n.rotulo}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5 text-xs text-muted-foreground sem-selecao">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> página (a cor é a da categoria)</span>
        {comTarefas && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-alerta" /> tarefa</span>}
        {comPessoas && <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sucesso" /> pessoa</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-px w-5 bg-muted-foreground" /> citação</span>
        {comArvore && <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-muted-foreground" /> página dentro de página</span>}
        <span className="ml-auto">Role para aproximar, arraste o fundo para mover, clique num ponto para abrir.</span>
      </div>
    </div>
  );
}
