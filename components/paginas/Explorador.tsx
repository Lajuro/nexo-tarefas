"use client";

// Explorador de páginas: a árvore da documentação (arrastar muda a ordem e a página mãe), as favoritas,
// as arquivadas e a busca dentro das páginas, que mostra em que seção cada trecho está.
//
// Arrastar: cada linha tem três zonas pela altura do ponteiro. No terço de cima a página vai ANTES dela, no
// meio vai para DENTRO dela (no fim), no terço de baixo vai DEPOIS dela (ou, se ela está aberta e tem páginas
// dentro, vira a primeira de dentro, que é onde a linha guia aparece). Parar sobre uma página fechada a abre.
// Teclado, com o foco numa página: Alt+↑/↓ sobe e desce entre as irmãs, Alt+Shift+→ põe para dentro da de cima
// e Alt+Shift+← tira de dentro da mãe. O mesmo está no menu da página (Mover), e tudo tem Desfazer (Ctrl Z).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, type DragEndEvent, type DragMoveEvent, DragOverlay, type DragStartEvent, MeasuringStrategy, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { Archive, Bookmark, ChevronDown, ChevronRight, ChevronsDownUp, CornerDownRight, Hash, Plus, Search, X } from "lucide-react";
import { Destaque } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { MODELOS_DE_PAGINA, type NoDePagina, type Reposicao, buscarNasPaginas, descendentes, emOrdemDeLeitura, montarArvore, nomeDaPagina } from "@/lib/paginas";
import type { Pagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { type AcoesDePagina, BotaoMenuPagina, IconePagina, MenuContextoPagina } from "./pecas";

type Zona = "antes" | "dentro" | "depois";
interface AlvoDoArrasto { id: string; zona: Zona }
/** Até 30% da altura da linha é "antes"; a partir de 70%, "depois"; o meio é "dentro". */
const zonaPelaAltura = (fracao: number): Zona => (fracao < 0.3 ? "antes" : fracao > 0.7 ? "depois" : "dentro");
/** Quanto tempo parado sobre uma página fechada até ela abrir sozinha. */
const ABRIR_AO_PARAR_MS = 650;

/** Onde cada página está na árvore que está na tela (para traduzir "depois de X" em mãe e posição). */
interface LugarNaTela { mae: string | null; proxima: string | null; primeiraFilha: string | null; temFilhas: boolean }

interface PropsDaLinha {
  no: NoDePagina;
  ativaId: string | null;
  recolhidas: Set<string>;
  arrastando: string | null;
  alvo: AlvoDoArrasto | null;
  proibidas: Set<string>;
  acoes: AcoesDePagina;
  aoAbrir: (id: string) => void;
  aoAlternar: (id: string) => void;
  aoFechar: (id: string) => void;
  aoMoverPeloTeclado: (id: string, para: Reposicao) => void;
}

/** A tecla de mover que foi apertada (Alt+↑/↓, Alt+Shift+→/←), ou null. */
function reposicaoDaTecla(e: React.KeyboardEvent): Reposicao | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.shiftKey) return e.key === "ArrowRight" ? "dentro" : e.key === "ArrowLeft" ? "fora" : null;
  return e.key === "ArrowUp" ? "acima" : e.key === "ArrowDown" ? "abaixo" : null;
}

function Linha({ no, ativaId, recolhidas, arrastando, alvo, proibidas, acoes, aoAbrir, aoAlternar, aoFechar, aoMoverPeloTeclado }: PropsDaLinha) {
  const p = no.pagina;
  const temFilhas = no.filhos.length > 0;
  const aberta = temFilhas && !recolhidas.has(p.id);
  const { setNodeRef: arrasto, listeners, isDragging } = useDraggable({ id: p.id });
  const podeReceber = !!arrastando && !proibidas.has(p.id);
  const linha = useDroppable({ id: `linha:${p.id}`, disabled: !podeReceber });
  const ativa = p.id === ativaId;
  const zona = podeReceber && alvo?.id === p.id ? alvo.zona : null;
  // "depois" de uma página aberta com filhas = a primeira de dentro: a guia fica com o recuo das filhas
  const recuoDepois = zona === "depois" && aberta ? no.nivel + 1 : no.nivel;

  return (
    <li role="treeitem" aria-expanded={temFilhas ? aberta : undefined} aria-selected={ativa} aria-level={no.nivel + 1}>
      <div className="relative">
        {zona === "antes" && <div data-slot="soltar-antes" aria-hidden className="pointer-events-none absolute right-1 -top-px z-10 h-0.5 rounded-full bg-primary" style={{ left: no.nivel * 14 + 8 }} />}
        {zona === "depois" && <div data-slot="soltar-depois" aria-hidden className="pointer-events-none absolute right-1 -bottom-px z-10 h-0.5 rounded-full bg-primary" style={{ left: recuoDepois * 14 + 8 }} />}
        <MenuContextoPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir} aoExcluir={() => aoFechar(p.id)}>
          <div
            ref={(el) => { arrasto(el); linha.setNodeRef(el); }}
            {...listeners}
            data-slot="item-pagina"
            data-id={p.id}
            data-ativa={ativa || undefined}
            data-nivel={no.nivel}
            data-soltar={zona ?? undefined}
            className={cn(
              "group/linha flex h-7 cursor-pointer items-center gap-1 rounded-md pr-1 text-[13px] transition-colors outline-none sem-selecao hover:bg-accent/60",
              ativa && "bg-accent font-medium",
              zona === "dentro" && "bg-primary/10 ring-1 ring-primary/50",
              isDragging && "opacity-40",
            )}
            style={{ paddingLeft: no.nivel * 14 + 2 }}
            onClick={() => aoAbrir(p.id)}
            onKeyDown={(e) => {
              const para = reposicaoDaTecla(e);
              if (!para) return;
              e.preventDefault();
              e.stopPropagation();
              aoMoverPeloTeclado(p.id, para);
            }}
          >
            <button type="button" tabIndex={-1} aria-label={aberta ? "Recolher" : "Abrir"} disabled={!temFilhas}
              onClick={(e) => { e.stopPropagation(); aoAlternar(p.id); }}
              className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-foreground/8", !temFilhas && "invisible")}>
              {aberta ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            <IconePagina pagina={p} temFilhas={temFilhas} className={cn("text-muted-foreground", ativa && "text-primary")} />
            <button type="button" data-slot="nome-pagina" className="min-w-0 flex-1 truncate rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
            <Linha key={f.pagina.id} no={f} ativaId={ativaId} recolhidas={recolhidas} arrastando={arrastando} alvo={alvo} proibidas={proibidas} acoes={acoes}
              aoAbrir={aoAbrir} aoAlternar={aoAlternar} aoFechar={aoFechar} aoMoverPeloTeclado={aoMoverPeloTeclado} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FimDaRaiz({ ligado }: { ligado: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "fim-da-raiz", disabled: !ligado });
  return (
    <div ref={setNodeRef} className={cn("mt-1 min-h-8 flex-1 rounded-md border border-dashed border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-colors", ligado && "border-border", isOver && "border-primary/60 bg-primary/8 text-foreground")}>
      {ligado && "Soltar aqui leva para o fim da raiz"}
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
  const [alvo, setAlvo] = useState<AlvoDoArrasto | null>(null);
  const alvoAgora = useRef<AlvoDoArrasto | null>(null);
  const sobreAgora = useRef<string>("");
  const ponteiro = useRef({ y: 0 });
  const raiz = useRef<HTMLElement>(null);
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
  const lugares = useMemo(() => {
    const out = new Map<string, LugarNaTela>();
    const andar = (nos: NoDePagina[], mae: string | null) =>
      nos.forEach((n, i) => {
        out.set(n.pagina.id, { mae, proxima: nos[i + 1]?.pagina.id ?? null, primeiraFilha: n.filhos[0]?.pagina.id ?? null, temFilhas: n.filhos.length > 0 });
        andar(n.filhos, n.pagina.id);
      });
    andar(arvore, null);
    return out;
  }, [arvore]);

  // A zona sai da posição de verdade do ponteiro sobre a linha (getBoundingClientRect), que não se perde com a
  // rolagem do explorador nem quando uma página se abre no meio do arrasto.
  function mudarAlvo(novo: AlvoDoArrasto | null) {
    const velho = alvoAgora.current;
    if (velho?.id === novo?.id && velho?.zona === novo?.zona) return;
    alvoAgora.current = novo;
    setAlvo(novo);
  }
  function recalcularAlvo() {
    const sobre = sobreAgora.current;
    if (!sobre.startsWith("linha:")) return mudarAlvo(null);
    const id = sobre.slice("linha:".length);
    const el = raiz.current?.querySelector(`[data-slot=item-pagina][data-id="${CSS.escape(id)}"]`);
    if (!el) return mudarAlvo(null);
    const r = el.getBoundingClientRect();
    mudarAlvo({ id, zona: zonaPelaAltura(r.height ? (ponteiro.current.y - r.top) / r.height : 0.5) });
  }
  useEffect(() => {
    if (!arrastando) return;
    const mexeu = (e: PointerEvent) => { ponteiro.current.y = e.clientY; recalcularAlvo(); };
    window.addEventListener("pointermove", mexeu);
    return () => window.removeEventListener("pointermove", mexeu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando]);

  // parado sobre o meio de uma página fechada, ela abre (para soltar entre as de dentro). A função vem da tela,
  // nova a cada render: fica numa ref para o tempo não recomeçar à toa.
  const alternar = useRef(aoAlternar);
  alternar.current = aoAlternar;
  useEffect(() => {
    if (!alvo || alvo.zona !== "dentro" || !lugares.get(alvo.id)?.temFilhas || !fechadas.has(alvo.id)) return;
    const t = window.setTimeout(() => alternar.current(alvo.id), ABRIR_AO_PARAR_MS);
    return () => window.clearTimeout(t);
  }, [alvo, lugares, fechadas]);

  /** Para onde vai a página, dado onde ela foi solta. */
  function destinoDoAlvo(a: AlvoDoArrasto): { mae: string | null; antes: string | null } | null {
    const lugar = lugares.get(a.id);
    if (!lugar) return null;
    if (a.zona === "antes") return { mae: lugar.mae, antes: a.id };
    if (a.zona === "dentro") return { mae: a.id, antes: null };
    if (lugar.temFilhas && !fechadas.has(a.id)) return { mae: a.id, antes: lugar.primeiraFilha };
    return { mae: lugar.mae, antes: lugar.proxima };
  }

  /** O que aparece embaixo da página arrastada: onde ela vai cair se soltar agora. */
  function textoDoDestino(): string {
    if (sobreAgora.current === "fim-da-raiz") return "no fim da raiz";
    if (!alvo) return "";
    const nome = `“${nomeDaPagina(ativas.find((p) => p.id === alvo.id) ?? { titulo: "", texto: "" })}”`;
    if (alvo.zona === "antes") return `antes de ${nome}`;
    if (alvo.zona === "dentro") return `dentro de ${nome}`;
    return lugares.get(alvo.id)?.temFilhas && !fechadas.has(alvo.id) ? `primeira dentro de ${nome}` : `depois de ${nome}`;
  }

  /** Alt+setas numa página: um passo, sem aviso (a mudança está à vista e o Ctrl Z desfaz). O foco fica nela. */
  async function moverPeloTeclado(id: string, para: Reposicao) {
    const novaMae = para === "dentro" ? acoes.possiveis(id).acimaId : null;
    const mexeu = await acoes.passo(id, para, { semAviso: true });
    if (!mexeu) return;
    if (novaMae && fechadas.has(novaMae)) aoAlternar(novaMae);
    const focar = () => raiz.current?.querySelector<HTMLElement>(`[data-slot=item-pagina][data-id="${CSS.escape(id)}"] [data-slot=nome-pagina]`)?.focus();
    requestAnimationFrame(() => requestAnimationFrame(focar));
  }

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
    const a = alvoAgora.current;
    const sobre = e.over ? String(e.over.id) : "";
    setArrastando(null);
    mudarAlvo(null);
    sobreAgora.current = "";
    const id = String(e.active.id);
    if (sobre === "fim-da-raiz") return void acoes.mover(id, null);
    if (!a || a.id === id || descendentes(ativas, id).has(a.id)) return;
    const destino = destinoDoAlvo(a);
    if (!destino) return;
    if (a.zona === "dentro" && fechadas.has(a.id)) aoAlternar(a.id);
    void acoes.mover(id, destino.mae, destino.antes);
  }

  const paginaNoAr = arrastando ? ativas.find((p) => p.id === arrastando) : null;

  return (
    <aside ref={raiz} data-slot="explorador" className="flex h-full w-[272px] shrink-0 flex-col border-r bg-sidebar/40">
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
                    <span className="block text-xs leading-snug text-muted-foreground">{m.descricao}</span>
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
            <p className="px-2 py-1.5 text-xs text-muted-foreground sem-selecao">
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
                    {t.secao && <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Hash className="size-3" /><span className="truncate"><Destaque texto={t.secao} termo={busca} /></span></span>}
                    <span className="line-clamp-2 text-xs leading-snug text-muted-foreground [&_mark]:text-foreground"><Destaque texto={t.trecho} termo={busca} /></span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensores} collisionDetection={pointerWithin}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={(e: DragStartEvent) => {
              ponteiro.current.y = (e.activatorEvent as PointerEvent | null)?.clientY ?? 0;
              setArrastando(String(e.active.id));
            }}
            onDragMove={(e: DragMoveEvent) => { sobreAgora.current = e.over ? String(e.over.id) : ""; recalcularAlvo(); }}
            onDragOver={(e) => { sobreAgora.current = e.over ? String(e.over.id) : ""; recalcularAlvo(); }}
            onDragEnd={aoSoltar}
            onDragCancel={() => { fimDoArrasto.current = Date.now(); setArrastando(null); mudarAlvo(null); sobreAgora.current = ""; }}>
            <div className="flex min-h-full flex-col">
              {favoritas.length > 0 && (
                <section className="mb-2">
                  <h3 className="flex h-6 items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao"><Bookmark className="size-3" /> Favoritas</h3>
                  {favoritas.map((p) => <ItemSimples key={p.id} p={p} ativa={p.id === ativaId} acoes={acoes} aoAbrir={aoAbrir} aoFechar={aoFechar} />)}
                </section>
              )}

              <div className="flex h-6 items-center px-2 sem-selecao">
                <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Páginas</h3>
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{ativas.length}</span>
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
                    <Linha key={n.pagina.id} no={n} ativaId={ativaId} recolhidas={fechadas} arrastando={arrastando} alvo={alvo} proibidas={proibidas} acoes={acoes}
                      aoAbrir={aoAbrir} aoAlternar={aoAlternar} aoFechar={aoFechar} aoMoverPeloTeclado={(id, para) => void moverPeloTeclado(id, para)} />
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
                <div className="pointer-events-none inline-flex max-w-[260px] flex-col rounded-md border border-primary/50 bg-card px-2 py-1 shadow-lg">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                    <IconePagina pagina={paginaNoAr} className="text-primary" /><span className="truncate">{nomeDaPagina(paginaNoAr)}</span>
                  </span>
                  {textoDoDestino() && (
                    <span data-slot="destino-do-arrasto" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CornerDownRight className="size-3 shrink-0" /><span className="truncate">{textoDoDestino()}</span>
                    </span>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </aside>
  );
}
