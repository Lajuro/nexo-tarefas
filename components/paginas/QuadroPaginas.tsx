"use client";

// Quadro de páginas: uma coluna por estado (rascunho, em revisão, pronta). Arrastar muda o estado.

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, type DragEndEvent, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { PontoCor } from "@/components/comum";
import { dataRelativa } from "@/lib/lembretes";
import { caminhoDaPagina, nomeDaPagina, porEstado } from "@/lib/paginas";
import { paraTextoPlano } from "@/lib/texto-rico";
import { type Categoria, ESTADOS_PAGINA, type EstadoPagina, type Pagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { type AcoesDePagina, IconePagina, MenuContextoPagina } from "./pecas";

function Cartao({ p, paginas, cat, flutuando }: { p: Pagina; paginas: Pagina[]; cat?: Categoria; flutuando?: boolean }) {
  const caminho = caminhoDaPagina(paginas, p.id).map(nomeDaPagina).join(" / ");
  const resumo = paraTextoPlano(p.texto).replace(/\n+/g, " ").slice(0, 140);
  return (
    <div className={cn("rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-[border-color,box-shadow]", flutuando ? "rotate-[1.5deg] border-primary/50 shadow-lg ring-[3px] ring-primary/15" : "hover:border-ring/40 hover:shadow-sm")}>
      {caminho && <div className="mb-0.5 truncate text-[11px] text-muted-foreground">{caminho}</div>}
      <div className="flex items-start gap-1.5">
        <IconePagina pagina={p} className="mt-0.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium">{nomeDaPagina(p)}</span>
      </div>
      {resumo && <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{resumo}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {cat && <span className="inline-flex min-w-0 items-center gap-1"><PontoCor cor={cat.cor} /><span className="truncate">{cat.nome}</span></span>}
        {p.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-muted px-1 font-medium">#{t}</span>)}
        <span className="ml-auto shrink-0">{dataRelativa(p.atualizadaEm)}</span>
      </div>
    </div>
  );
}

function Arrastavel({ p, paginas, cat, acoes, aoAbrir }: { p: Pagina; paginas: Pagina[]; cat?: Categoria; acoes: AcoesDePagina; aoAbrir: (id: string) => void }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: p.id });
  return (
    <MenuContextoPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir}>
      <div ref={setNodeRef} {...listeners} role="button" tabIndex={0} data-slot="cartao-de-pagina" data-id={p.id}
        onClick={() => aoAbrir(p.id)} onKeyDown={(e) => { if (e.key === "Enter") aoAbrir(p.id); }}
        className={cn("cursor-pointer rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35", isDragging && "opacity-35")}>
        <Cartao p={p} paginas={paginas} cat={cat} />
      </div>
    </MenuContextoPagina>
  );
}

function Coluna({ estado, nome, itens, paginas, categorias, arrastando, acoes, aoAbrir }: {
  estado: EstadoPagina; nome: string; itens: Pagina[]; paginas: Pagina[]; categorias: Map<string, Categoria>; arrastando: boolean; acoes: AcoesDePagina; aoAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <section ref={setNodeRef} data-slot="coluna-de-paginas" data-estado={estado}
      className={cn("flex min-h-0 w-[320px] shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", arrastando && "border-dashed", isOver && "border-primary/60 bg-primary/8")}>
      <header className="flex h-10 shrink-0 items-center gap-2 px-3 sem-selecao">
        <span className={cn("size-2 rounded-full", estado === "publicada" ? "bg-sucesso" : estado === "revisao" ? "bg-alerta" : "bg-muted-foreground/50")} />
        <h3 className="text-[13px] font-semibold tracking-tight">{nome}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{itens.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {itens.map((p) => <Arrastavel key={p.id} p={p} paginas={paginas} cat={categorias.get(p.categoriaId ?? "")} acoes={acoes} aoAbrir={aoAbrir} />)}
        {itens.length === 0 && <p className="px-1.5 py-2 text-xs text-muted-foreground">Nenhuma página aqui.</p>}
      </div>
    </section>
  );
}

export function QuadroPaginas({ paginas, categorias, acoes, aoAbrir }: { paginas: Pagina[]; categorias: Categoria[]; acoes: AcoesDePagina; aoAbrir: (id: string) => void }) {
  const ativas = useMemo(() => paginas.filter((p) => !p.arquivadaEm), [paginas]);
  const cats = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const [noAr, setNoAr] = useState<string | null>(null);
  // o cartão aparece na coluna nova enquanto a gravação está a caminho
  const [otimista, setOtimista] = useState<Record<string, EstadoPagina>>({});
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const fimDoArrasto = useRef(0);
  useEffect(() => {
    // só dentro do quadro: um clique em outro lugar da tela (trocar de visão, por exemplo) nunca é engolido
    const guarda = (e: MouseEvent) => {
      if (Date.now() - fimDoArrasto.current < 120 && (e.target as Element | null)?.closest?.("[data-slot=quadro-de-paginas]")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("click", guarda, true);
    return () => window.removeEventListener("click", guarda, true);
  }, []);
  const comOtimista = useMemo(() => ativas.map((p) => (otimista[p.id] ? { ...p, estado: otimista[p.id] } : p)), [ativas, otimista]);

  async function aoSoltar(e: DragEndEvent) {
    fimDoArrasto.current = Date.now();
    setNoAr(null);
    const p = ativas.find((x) => x.id === e.active.id);
    const destino = e.over?.id as EstadoPagina | undefined;
    if (!p || !destino || !ESTADOS_PAGINA.some((x) => x.id === destino) || (p.estado ?? "rascunho") === destino) return;
    setOtimista((o) => ({ ...o, [p.id]: destino }));
    try {
      await acoes.mudar(p.id, { estado: destino });
    } finally {
      setOtimista((o) => { const r = { ...o }; delete r[p.id]; return r; });
    }
  }

  const paginaNoAr = noAr ? ativas.find((p) => p.id === noAr) : null;
  return (
    <DndContext sensors={sensores} collisionDetection={pointerWithin} onDragStart={(e) => setNoAr(String(e.active.id))} onDragEnd={aoSoltar}
      onDragCancel={() => { fimDoArrasto.current = Date.now(); setNoAr(null); }}>
      <div data-slot="quadro-de-paginas" className="flex h-full min-h-0 gap-3 overflow-x-auto p-4">
        {ESTADOS_PAGINA.map((e) => (
          <Coluna key={e.id} estado={e.id} nome={e.nome} itens={porEstado(comOtimista, e.id)} paginas={ativas} categorias={cats} arrastando={!!noAr} acoes={acoes} aoAbrir={aoAbrir} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {paginaNoAr ? <div className="w-[300px] cursor-grabbing"><Cartao p={paginaNoAr} paginas={ativas} cat={cats.get(paginaNoAr.categoriaId ?? "")} flutuando /></div> : null}
      </DragOverlay>
    </DndContext>
  );
}
