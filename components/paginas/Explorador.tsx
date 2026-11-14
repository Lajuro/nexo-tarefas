"use client";

// Explorador de páginas: a árvore da documentação (arrastar muda a ordem e a página mãe), as favoritas,
// as arquivadas e a busca dentro das páginas, que mostra em que seção cada trecho está.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CollisionDetection, DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { Archive, Bookmark, ChevronDown, ChevronRight, ChevronsDownUp, Hash, Plus, Search, X } from "lucide-react";
import { Destaque } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { MODELOS_DE_PAGINA, type NoDePagina, buscarNasPaginas, descendentes, emOrdemDeLeitura, montarArvore, nomeDaPagina } from "@/lib/paginas";
import type { Pagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { type AcoesDePagina, BotaoMenuPagina, IconePagina, MenuContextoPagina } from "./pecas";

// zona fina "antes de" ganha da linha inteira ("dentro de") quando o ponteiro está nas duas
const colisao: CollisionDetection = (args) => {
  const dentro = pointerWithin(args);
  return [...dentro].sort((a, b) => Number(String(b.id).startsWith("antes:")) - Number(String(a.id).startsWith("antes:")));
};

interface PropsDaLinha {
  no: NoDePagina;
  ativaId: string | null;
  recolhidas: Set<string>;
  arrastando: string | null;
  proibidas: Set<string>;
  acoes: AcoesDePagina;
  aoAbrir: (id: string) => void;
  aoAlternar: (id: string) => void;
  aoFechar: (id: string) => void;
}

function Linha({ no, ativaId, recolhidas, arrastando, proibidas, acoes, aoAbrir, aoAlternar, aoFechar }: PropsDaLinha) {
  const p = no.pagina;
  const temFilhas = no.filhos.length > 0;
  const aberta = temFilhas && !recolhidas.has(p.id);
  const { setNodeRef: arrasto, listeners, isDragging } = useDraggable({ id: p.id });
  const podeReceber = !!arrastando && !proibidas.has(p.id);
  const dentro = useDroppable({ id: `dentro:${p.id}`, disabled: !podeReceber });
  const antes = useDroppable({ id: `antes:${p.id}`, disabled: !podeReceber });
  const ativa = p.id === ativaId;

  return (
    <li role="treeitem" aria-expanded={temFilhas ? aberta : undefined} aria-selected={ativa} aria-level={no.nivel + 1}>
      <div className="relative">
        <div ref={antes.setNodeRef} aria-hidden className="absolute inset-x-0 -top-[3px] z-10 h-[7px]">
          {antes.isOver && <div data-slot="soltar-antes" className="absolute inset-x-1 top-[3px] h-0.5 rounded-full bg-primary" style={{ marginLeft: no.nivel * 14 + 8 }} />}
        </div>
        <MenuContextoPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir} aoExcluir={() => aoFechar(p.id)}>
          <div
            ref={(el) => { arrasto(el); dentro.setNodeRef(el); }}
            {...listeners}
            data-slot="item-pagina"
            data-id={p.id}
            data-ativa={ativa || undefined}
            data-nivel={no.nivel}
            className={cn(
              "group/linha flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-[13px] transition-colors outline-none sem-selecao hover:bg-accent/60",
              ativa && "bg-accent font-medium",
              dentro.isOver && "bg-primary/10 ring-1 ring-primary/50",
              isDragging && "opacity-40",
            )}
            style={{ paddingLeft: no.nivel * 14 + 2 }}
            onClick={() => aoAbrir(p.id)}
          >
            <button type="button" tabIndex={-1} aria-label={aberta ? "Recolher" : "Abrir"} disabled={!temFilhas}
              onClick={(e) => { e.stopPropagation(); aoAlternar(p.id); }}
              className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/8", !temFilhas && "invisible")}>
              {aberta ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            <IconePagina pagina={p} temFilhas={temFilhas} className={cn("text-muted-foreground", ativa && "text-primary")} />
            <button type="button" className="min-w-0 flex-1 truncate rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              onClick={(e) => { e.stopPropagation(); aoAbrir(p.id); }}>
              {nomeDaPagina(p)}
            </button>
            <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/linha:opacity-100 group-hover/linha:opacity-100 has-[[data-state=open]]:opacity-100">
              <Dica texto="Nova página dentro desta">
                <Button variant="ghost" size="icon-sm" className="size-5" aria-label={`Nova página dentro de ${nomeDaPagina(p)}`}
                  onClick={async (e) => { e.stopPropagation(); const id = await acoes.criar({ paiId: p.id, categoriaId: p.categoriaId }); if (id) aoAbrir(id); }}>
                  <Plus />
                </Button>
              </Dica>
              <BotaoMenuPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir} aoExcluir={() => aoFechar(p.id)} className="size-5" />
            </span>
          </div>
        </MenuContextoPagina>
      </div>
      {aberta && (
        <ul role="group">
          {no.filhos.map((f) => (
            <Linha key={f.pagina.id} no={f} ativaId={ativaId} recolhidas={recolhidas} arrastando={arrastando} proibidas={proibidas} acoes={acoes} aoAbrir={aoAbrir} aoAlternar={aoAlternar} aoFechar={aoFechar} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FimDaRaiz({ ligado }: { ligado: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "fim-da-raiz", disabled: !ligado });
  return (
    <div ref={setNodeRef} className={cn("mt-1 min-h-8 flex-1 rounded-md border border-dashed border-transparent px-2 py-1.5 text-[11px] text-muted-foreground transition-colors", ligado && "border-border", isOver && "border-primary/60 bg-primary/8 text-foreground")}>
      {ligado && "Soltar aqui leva para a raiz"}
    </div>
  );
}

function ItemSimples({ p, ativa, acoes, aoAbrir, aoFechar, icone }: { p: Pagina; ativa: boolean; acoes: AcoesDePagina; aoAbrir: (id: string) => void; aoFechar: (id: string) => void; icone?: React.ReactNode }) {
  return (
    <MenuContextoPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir} aoExcluir={() => aoFechar(p.id)}>
      <button type="button" data-slot="item-favorita" data-id={p.id} onClick={() => aoAbrir(p.id)}
        className={cn("flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40", ativa && "bg-accent font-medium")}>
        {icone ?? <IconePagina pagina={p} className="text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate">{nomeDaPagina(p)}</span>
      </button>
    </MenuContextoPagina>
  );
}

export function Explorador({
  paginas, ativaId, recolhidas, acoes, aoAbrir, aoAlternar, aoRecolherTudo, aoFechar, aoNova,
}: {
  paginas: Pagina[];
  ativaId: string | null;
  recolhidas: string[];
  acoes: AcoesDePagina;
  /** Abre a página; `titulo` leva direto a uma seção (posição no sumário). */
  aoAbrir: (id: string, titulo?: number) => void;
  aoAlternar: (id: string) => void;
  aoRecolherTudo: (ids: string[]) => void;
  aoFechar: (id: string) => void;
  aoNova: (modeloId?: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [arquivadasAbertas, setArquivadasAbertas] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const ativas = useMemo(() => paginas.filter((p) => !p.arquivadaEm), [paginas]);
  const arquivadas = useMemo(() => paginas.filter((p) => p.arquivadaEm).sort((a, b) => (b.arquivadaEm ?? "").localeCompare(a.arquivadaEm ?? "")), [paginas]);
  const arvore = useMemo(() => montarArvore(ativas), [ativas]);
  const favoritas = useMemo(() => ativas.filter((p) => p.fixada).sort((a, b) => nomeDaPagina(a).localeCompare(nomeDaPagina(b), "pt-BR")), [ativas]);
  const achadas = useMemo(() => (busca.trim() ? buscarNasPaginas(paginas, busca) : []), [paginas, busca]);
  const fechadas = useMemo(() => new Set(recolhidas), [recolhidas]);
  // não dá para soltar uma página dentro dela mesma nem de uma descendente
  const proibidas = useMemo(() => (arrastando ? new Set([arrastando, ...descendentes(ativas, arrastando)]) : new Set<string>()), [arrastando, ativas]);
  const comFilhas = useMemo(() => emOrdemDeLeitura(arvore).filter((n) => n.filhos.length).map((n) => n.pagina.id), [arvore]);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // soltar em cima do próprio lugar dispararia o clique que abre a página: cancela logo depois de um arrasto
  const fimDoArrasto = useRef(0);
  useEffect(() => {
    // só dentro do explorador: um clique em outro lugar da tela nunca é engolido
    const guarda = (e: MouseEvent) => {
      if (Date.now() - fimDoArrasto.current < 120 && (e.target as Element | null)?.closest?.("[data-slot=explorador]")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("click", guarda, true);
    return () => window.removeEventListener("click", guarda, true);
  }, []);

  // Ctrl+Shift+F (ou Ctrl+P): buscar nas páginas
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === "f") || (!e.shiftKey && e.key.toLowerCase() === "p"))) {
        e.preventDefault();
        campo.current?.focus();
        campo.current?.select();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  function aoSoltar(e: DragEndEvent) {
    fimDoArrasto.current = Date.now();
    setArrastando(null);
    const id = String(e.active.id);
    const sobre = e.over ? String(e.over.id) : "";
    if (!sobre) return;
    if (sobre === "fim-da-raiz") return void acoes.mover(id, null);
    const [modo, alvo] = [sobre.slice(0, sobre.indexOf(":")), sobre.slice(sobre.indexOf(":") + 1)];
    if (alvo === id || descendentes(ativas, id).has(alvo)) return;
    if (modo === "dentro") {
      if (fechadas.has(alvo)) aoAlternar(alvo);
      return void acoes.mover(id, alvo);
    }
    const irma = ativas.find((p) => p.id === alvo);
    if (irma) void acoes.mover(id, irma.paiId && ativas.some((p) => p.id === irma.paiId) ? irma.paiId : null, alvo);
  }

  const paginaNoAr = arrastando ? ativas.find((p) => p.id === arrastando) : null;

  return (
    <aside data-slot="explorador" className="flex h-full w-[272px] shrink-0 flex-col border-r bg-sidebar/40">
      <div className="flex items-center gap-1.5 px-2.5 pt-3 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input ref={campo} data-slot="busca-paginas" value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape" && busca) { e.stopPropagation(); setBusca(""); } else if (e.key === "Enter" && achadas[0]) aoAbrir(achadas[0].pagina.id, achadas[0].trechos[0]?.indiceDoTitulo); }}
            placeholder="Buscar nas páginas" aria-label="Buscar nas páginas" className="h-8 pr-7 pl-8" />
          {busca && (
            <button type="button" aria-label="Limpar a busca" onClick={() => { setBusca(""); campo.current?.focus(); }}
              className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex shrink-0">
          <Dica texto="Nova página">
            <Button data-slot="nova-pagina" size="icon" className="rounded-r-none" aria-label="Nova página" onClick={() => aoNova()}><Plus /></Button>
          </Dica>
          <DropdownMenu>
            <Dica texto="Começar de um modelo">
              <DropdownMenuTrigger asChild>
                <Button data-slot="nova-de-modelo" size="icon" className="w-6 rounded-l-none border-l border-primary-foreground/25" aria-label="Nova página de um modelo"><ChevronDown /></Button>
              </DropdownMenuTrigger>
            </Dica>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Começar de um modelo</DropdownMenuLabel>
              {MODELOS_DE_PAGINA.map((m) => (
                <DropdownMenuItem key={m.id} data-modelo={m.id} onSelect={() => aoNova(m.id)} className="items-start">
                  <IconePagina pagina={{ icone: m.icone }} className="mt-0.5 size-4" />
                  <span className="min-w-0">
                    <span className="block text-[13px]">{m.nome}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{m.descricao}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {busca.trim() ? (
          <div data-slot="resultados-paginas">
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground sem-selecao">
              {achadas.length === 0 ? "Nenhuma página com esse texto." : `${achadas.length} ${achadas.length === 1 ? "página" : "páginas"}`}
            </p>
            {achadas.slice(0, 40).map((a) => (
              <div key={a.pagina.id} data-slot="pagina-achada" className="mb-1.5">
                <button type="button" onClick={() => aoAbrir(a.pagina.id)}
                  className={cn("flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] font-medium outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40", a.pagina.id === ativaId && "bg-accent")}>
                  <IconePagina pagina={a.pagina} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate"><Destaque texto={nomeDaPagina(a.pagina)} termo={busca} /></span>
                  {a.pagina.arquivadaEm && <Archive className="size-3 shrink-0 text-muted-foreground" />}
                </button>
                {a.trechos.map((t, i) => (
                  <button key={i} type="button" data-slot="trecho-achado" onClick={() => aoAbrir(a.pagina.id, t.indiceDoTitulo)}
                    className="ml-5 block w-[calc(100%-1.25rem)] rounded-md border-l px-2 py-1 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40">
                    {t.secao && <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><Hash className="size-3" /><span className="truncate"><Destaque texto={t.secao} termo={busca} /></span></span>}
                    <span className="line-clamp-2 text-xs leading-snug text-muted-foreground [&_mark]:text-foreground"><Destaque texto={t.trecho} termo={busca} /></span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensores} collisionDetection={colisao}
            onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))}
            onDragEnd={aoSoltar}
            onDragCancel={() => { fimDoArrasto.current = Date.now(); setArrastando(null); }}>
            <div className="flex min-h-full flex-col">
              {favoritas.length > 0 && (
                <section className="mb-2">
                  <h3 className="flex h-6 items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao"><Bookmark className="size-3" /> Favoritas</h3>
                  {favoritas.map((p) => <ItemSimples key={p.id} p={p} ativa={p.id === ativaId} acoes={acoes} aoAbrir={aoAbrir} aoFechar={aoFechar} />)}
                </section>
              )}

              <div className="flex h-6 items-center px-2 sem-selecao">
                <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Páginas</h3>
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{ativas.length}</span>
                {comFilhas.length > 0 && (
                  <Dica texto={comFilhas.every((id) => fechadas.has(id)) ? "Abrir tudo" : "Recolher tudo"}>
                    <Button variant="ghost" size="icon-sm" className="ml-auto size-5" aria-label="Recolher ou abrir tudo"
                      onClick={() => aoRecolherTudo(comFilhas.every((id) => fechadas.has(id)) ? [] : comFilhas)}>
                      <ChevronsDownUp />
                    </Button>
                  </Dica>
                )}
              </div>
              {arvore.length === 0 ? (
                <p className="px-2 py-2 text-xs leading-snug text-muted-foreground">Nenhuma página ainda. Crie a primeira no botão acima.</p>
              ) : (
                <ul role="tree" aria-label="Páginas" data-slot="arvore-de-paginas">
                  {arvore.map((n) => (
                    <Linha key={n.pagina.id} no={n} ativaId={ativaId} recolhidas={fechadas} arrastando={arrastando} proibidas={proibidas} acoes={acoes} aoAbrir={aoAbrir} aoAlternar={aoAlternar} aoFechar={aoFechar} />
                  ))}
                </ul>
              )}
              <FimDaRaiz ligado={!!arrastando} />

              {arquivadas.length > 0 && (
                <section className="mt-2">
                  <button type="button" data-slot="ver-arquivadas" onClick={() => setArquivadasAbertas((v) => !v)}
                    className="flex h-6 w-full items-center gap-1 rounded px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase outline-none sem-selecao hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
                    {arquivadasAbertas ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />} Arquivadas
                    <span className="ml-0.5 font-normal tabular-nums">{arquivadas.length}</span>
                  </button>
                  {arquivadasAbertas && arquivadas.map((p) => (
                    <ItemSimples key={p.id} p={p} ativa={p.id === ativaId} acoes={acoes} aoAbrir={aoAbrir} aoFechar={aoFechar} icone={<Archive className="size-3.5 shrink-0 text-muted-foreground" />} />
                  ))}
                </section>
              )}
            </div>
            <DragOverlay dropAnimation={null}>
              {paginaNoAr ? (
                <div className="inline-flex h-7 max-w-[240px] items-center gap-1.5 rounded-md border border-primary/50 bg-card px-2 text-[13px] font-medium shadow-lg">
                  <IconePagina pagina={paginaNoAr} className="text-primary" /><span className="truncate">{nomeDaPagina(paginaNoAr)}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </aside>
  );
}
