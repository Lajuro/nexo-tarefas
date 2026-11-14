"use client";

// Uma página de conhecimento aberta: migalhas, ícone, título, propriedades, o texto (editor rico ou leitura),
// as páginas de dentro dela, anterior/próxima e, ao lado, o sumário e quem aponta para cá. Grava sozinha.

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore, ArrowLeft, ArrowRight, BookOpenText, Bookmark, Check, ChevronRight, CloudOff, FilePlus2, LoaderCircle, PanelRight, PencilLine,
} from "lucide-react";
import { PainelCitacoes } from "@/components/Citacoes";
import { useNexo } from "@/components/Provider";
import { ChipsInput, PontoCor } from "@/components/comum";
import { EditorRico } from "@/components/editor/EditorRico";
import { TextoRico } from "@/components/tarefa/Texto";
import { useGravacao } from "@/components/useGravacao";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Segmentado } from "@/components/ui/controles";
import { Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { Seletor } from "@/components/ui/select";
import { dataRelativa } from "@/lib/lembretes";
import { caminhoDaPagina, nomeDaPagina, sumarioDoMarkdown, tamanhoDaLeitura, vizinhas } from "@/lib/paginas";
import { ESTADOS_PAGINA, type EstadoPagina, type Pagina, agoraISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { type AcoesDePagina, BotaoMenuPagina, IconePagina, SeletorDeIcone, SeloEstado } from "./pecas";

export type ModoDaPagina = "editar" | "ler";

/** Os títulos de primeiro nível do documento, na ordem, tanto no leitor quanto no editor. */
const titulosNaTela = (corpo: HTMLElement) =>
  [...corpo.querySelectorAll<HTMLElement>("[data-titulo], .ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3")];

export function EditorPagina({
  pagina, paginas, modo, aoMudarModo, painel, aoAlternarPainel, acoes, aoAbrir, aoFechar, irPara,
}: {
  pagina: Pagina;
  /** Todas as páginas (para o caminho, as filhas e a vizinhança). */
  paginas: Pagina[];
  modo: ModoDaPagina;
  aoMudarModo: (m: ModoDaPagina) => void;
  painel: boolean;
  aoAlternarPainel: () => void;
  acoes: AcoesDePagina;
  aoAbrir: (id: string) => void;
  aoFechar: () => void;
  /** Pedido de ir a uma seção: posição no sumário e um contador, para o mesmo pedido valer duas vezes. */
  irPara: { titulo: number; vez: number } | null;
}) {
  const { dados, salvarPaginas, estado } = useNexo();
  const id = pagina.id;
  const somenteLeitura = !!estado?.somenteLeitura;
  const { valor, mudar, situacao } = useGravacao(id, pagina, (v) => {
    const agora = agoraISO();
    return salvarPaginas((items) => items.map((p) => (p.id === id ? { ...p, titulo: v.titulo, texto: v.texto, atualizadaEm: agora } : p)));
  });

  const ativas = useMemo(() => paginas.filter((p) => !p.arquivadaEm), [paginas]);
  const caminho = useMemo(() => caminhoDaPagina(ativas, id), [ativas, id]);
  const filhas = useMemo(() => ativas.filter((p) => p.paiId === id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || nomeDaPagina(a).localeCompare(nomeDaPagina(b), "pt-BR")), [ativas, id]);
  const { anterior, proxima } = useMemo(() => vizinhas(ativas, id), [ativas, id]);
  const categorias = (dados?.categorias.items ?? []).filter((c) => !c.arquivada || c.id === pagina.categoriaId);
  const cat = categorias.find((c) => c.id === pagina.categoriaId);
  const todasAsTags = useMemo(() => [...new Set(paginas.flatMap((p) => p.tags))].sort(), [paginas]);

  // página em branco abre para escrever, mesmo no modo leitura
  const vazia = !valor.texto.trim();
  const lendo = (modo === "ler" && !vazia) || somenteLeitura || !!pagina.arquivadaEm;

  const textoDoSumario = useDeferredValue(valor.texto);
  const sumario = useMemo(() => sumarioDoMarkdown(textoDoSumario), [textoDoSumario]);
  const leitura = useMemo(() => tamanhoDaLeitura(textoDoSumario), [textoDoSumario]);

  // ---------- rolagem: ir a uma seção e saber em qual se está ----------
  const corpo = useRef<HTMLDivElement>(null);
  const [secaoAtual, setSecaoAtual] = useState(-1);
  const irParaTitulo = useCallback((indice: number) => {
    const el = corpo.current && titulosNaTela(corpo.current)[indice];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else corpo.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    if (!irPara) return;
    // espera o texto estar na tela (aba recém-aberta, editor montando)
    const t = setTimeout(() => irParaTitulo(irPara.titulo), 120);
    return () => clearTimeout(t);
  }, [irPara, irParaTitulo]);
  useEffect(() => {
    const el = corpo.current;
    if (!el) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const topo = el.getBoundingClientRect().top + 96;
      let atual = -1;
      titulosNaTela(el).forEach((t, i) => { if (t.getBoundingClientRect().top <= topo) atual = i; });
      setSecaoAtual(atual);
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    el.addEventListener("scroll", aoRolar, { passive: true });
    medir();
    return () => { el.removeEventListener("scroll", aoRolar); if (quadro) cancelAnimationFrame(quadro); };
  }, [lendo, sumario.length]);

  const titulo = valor.titulo;

  return (
    <div data-slot="editor-pagina" data-id={id} data-modo={lendo ? "ler" : "editar"} className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* faixa fixa: onde estou, se está salvo, ler ou editar */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
          <nav aria-label="Caminho da página" data-slot="caminho-da-pagina" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-xs text-muted-foreground sem-selecao">
            {caminho.map((p) => (
              <span key={p.id} className="flex min-w-0 shrink items-center gap-0.5">
                <button type="button" onClick={() => aoAbrir(p.id)} className="min-w-0 truncate rounded px-1 py-0.5 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">{nomeDaPagina(p)}</button>
                <ChevronRight className="size-3 shrink-0 opacity-50" />
              </span>
            ))}
            <span className="min-w-0 truncate px-1 font-medium text-foreground">{nomeDaPagina({ titulo, texto: valor.texto })}</span>
          </nav>
          <span data-slot="pagina-situacao" data-situacao={situacao} role="status"
            className={cn("hidden shrink-0 items-center gap-1 text-[11px] sem-selecao sm:inline-flex", situacao === "erro" ? "text-alerta" : "text-muted-foreground")}>
            {situacao === "salvo" && <><Check className="size-3.5 text-sucesso" /> Salvo</>}
            {situacao === "pendente" && "Guardando..."}
            {situacao === "salvando" && <><LoaderCircle className="size-3.5 animate-spin" /> Salvando...</>}
            {situacao === "erro" && (
              <Dica texto="Não consegui salvar. O texto está guardado neste navegador e tento de novo quando você digitar.">
                <span className="inline-flex items-center gap-1"><CloudOff className="size-3.5" /> Não salvou</span>
              </Dica>
            )}
          </span>
          {!pagina.arquivadaEm && !somenteLeitura && (
            <Segmentado aria-label="Ler ou editar" tamanho="sm" valor={lendo ? "ler" : "editar"} aoMudar={aoMudarModo}
              opcoes={[{ valor: "editar", rotulo: "Editar", icone: <PencilLine /> }, { valor: "ler", rotulo: "Ler", icone: <BookOpenText /> }]} />
          )}
          <Dica texto={pagina.fixada ? "Tirar das favoritas" : "Pôr nas favoritas"}>
            <Button variant="ghost" size="icon-sm" aria-label="Favorita" aria-pressed={!!pagina.fixada} data-slot="favoritar-pagina" onClick={() => acoes.fixar(pagina)}>
              <Bookmark className={cn(pagina.fixada && "fill-primary text-primary")} />
            </Button>
          </Dica>
          <Dica texto={painel ? "Esconder o sumário" : "Mostrar o sumário"}>
            <Button variant="ghost" size="icon-sm" aria-label="Sumário e citações" aria-pressed={painel} onClick={aoAlternarPainel}><PanelRight className={cn(painel && "text-primary")} /></Button>
          </Dica>
          <BotaoMenuPagina pagina={pagina} acoes={acoes} aoAbrir={aoAbrir} aoExcluir={aoFechar} />
        </div>

        <div ref={corpo} data-slot="corpo-da-pagina" className="min-h-0 flex-1 overflow-y-auto scroll-pt-4">
          <div className="mx-auto w-full max-w-[860px] px-8 pt-7 pb-24">
            {pagina.arquivadaEm && (
              <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-alerta/30 bg-alerta/10 px-3.5 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1">Esta página está arquivada. Os links para ela continuam funcionando.</span>
                <Button size="sm" variant="outline" onClick={() => acoes.arquivar(pagina, false)}><ArchiveRestore /> Desarquivar</Button>
              </div>
            )}

            <div className="flex items-start gap-3">
              {lendo ? (
                <span className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><IconePagina pagina={pagina} temFilhas={filhas.length > 0} className="size-5" /></span>
              ) : (
                <SeletorDeIcone pagina={pagina} aoEscolher={(icone) => acoes.mudar(id, { icone })}>
                  <button type="button" aria-label="Trocar o ícone da página" data-slot="icone-da-pagina"
                    className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors outline-none hover:bg-primary/18 focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    <IconePagina pagina={pagina} temFilhas={filhas.length > 0} className="size-5" />
                  </button>
                </SeletorDeIcone>
              )}
              {lendo ? (
                <h1 data-slot="titulo-da-pagina" className="min-w-0 flex-1 py-1 text-[26px] leading-tight font-semibold tracking-tight">{nomeDaPagina({ titulo, texto: valor.texto })}</h1>
              ) : (
                <Textarea
                  data-slot="titulo-da-pagina"
                  value={titulo}
                  onChange={(e) => mudar({ titulo: e.target.value.replace(/\n/g, " ") })}
                  onKeyDown={(e) => {
                    // Enter no título leva o cursor para o texto
                    if (e.key === "Enter") { e.preventDefault(); corpo.current?.querySelector<HTMLElement>(".ProseMirror")?.focus(); }
                  }}
                  rows={1}
                  maxLength={200}
                  placeholder="Título da página"
                  aria-label="Título da página"
                  className="min-h-0 min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1 text-[26px] leading-tight font-semibold tracking-tight shadow-none [field-sizing:content] placeholder:font-normal placeholder:text-muted-foreground/60 hover:border-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
                />
              )}
            </div>

            {/* propriedades */}
            <div data-slot="propriedades-da-pagina" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b pb-4 text-xs text-muted-foreground">
              {lendo ? (
                <>
                  <SeloEstado estado={pagina.estado ?? "rascunho"} />
                  {cat && <span className="inline-flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span>}
                  {pagina.tags.map((t) => <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">#{t}</span>)}
                </>
              ) : (
                <>
                  <Seletor size="sm" aria-label="Estado da página" className="h-7 w-[124px] text-xs" valor={pagina.estado ?? "rascunho"}
                    aoMudar={(e) => acoes.mudar(id, { estado: e as EstadoPagina })} opcoes={ESTADOS_PAGINA.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
                  <Combobox
                    valor={pagina.categoriaId ?? ""}
                    aoMudar={(v) => acoes.mudar(id, { categoriaId: v || null })}
                    opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> }))}
                    placeholder="Sem categoria" rotuloLimpar="Sem categoria" aria-label="Categoria da página" className="h-7 w-44 text-xs"
                  />
                  <div className="min-w-44 flex-1 [&_[data-slot=campo-chips]>div]:min-h-7 [&_[data-slot=campo-chips]>div]:py-0.5">
                    <ChipsInput valor={pagina.tags} mudar={(tags) => acoes.mudar(id, { tags })} sugestoes={todasAsTags} placeholder="Tags" />
                  </div>
                </>
              )}
              <span className="ml-auto shrink-0 tabular-nums sem-selecao">
                {leitura.palavras > 0 && `${leitura.palavras} ${leitura.palavras === 1 ? "palavra" : "palavras"} · ${leitura.minutos} min de leitura · `}
                editada {dataRelativa(pagina.atualizadaEm)}
              </span>
            </div>

            {/* o texto */}
            <div className="mt-4">
              {lendo ? (
                <TextoRico texto={valor.texto} ancoras className="text-[15px] leading-relaxed [&_h1]:scroll-mt-4 [&_h2]:scroll-mt-4 [&_h3]:scroll-mt-4" />
              ) : (
                <EditorRico
                  data-slot="texto-da-pagina"
                  variante="documento"
                  paginaAtualId={id}
                  valor={valor.texto}
                  aoMudar={(v) => mudar({ texto: v })}
                  desabilitado={somenteLeitura}
                  focoInicial={!!titulo && vazia}
                  placeholder="Escreva o que vale guardar. Digite / para blocos, @ para citar uma tarefa ou pessoa e [[ para ligar a outra página."
                  aria-label="Texto da página"
                  classeConteudo="px-0 pt-4 pb-2 text-[15px] leading-relaxed min-h-[40vh] [&_h1]:scroll-mt-16 [&_h2]:scroll-mt-16 [&_h3]:scroll-mt-16"
                />
              )}
            </div>

            {/* páginas de dentro desta */}
            {(filhas.length > 0 || lendo) && filhas.length > 0 && (
              <section data-slot="paginas-de-dentro" className="mt-10 border-t pt-5">
                <h2 className="mb-2.5 text-[13px] font-semibold tracking-tight sem-selecao">Nesta seção</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {filhas.map((f) => (
                    <button key={f.id} type="button" onClick={() => aoAbrir(f.id)}
                      className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-xs transition-[border-color,box-shadow] outline-none hover:border-ring/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/35">
                      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><IconePagina pagina={f} temFilhas={ativas.some((x) => x.paiId === f.id)} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{nomeDaPagina(f)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">editada {dataRelativa(f.atualizadaEm)}</span>
                      </span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {!lendo && !pagina.arquivadaEm && (
              <Button variant="ghost" size="sm" className="mt-3 -ml-2 text-muted-foreground" data-slot="nova-subpagina"
                onClick={async () => { const novo = await acoes.criar({ paiId: id, categoriaId: pagina.categoriaId }); if (novo) aoAbrir(novo); }}>
                <FilePlus2 /> Nova página dentro desta
              </Button>
            )}

            {/* anterior e próxima, na ordem da árvore */}
            {(anterior || proxima) && (
              <nav aria-label="Página anterior e próxima" data-slot="vizinhas" className="mt-8 grid gap-2 sm:grid-cols-2">
                {anterior ? (
                  <button type="button" onClick={() => aoAbrir(anterior.id)} className="group flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors outline-none hover:border-ring/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                    <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">Anterior</span><span className="block truncate text-[13px] font-medium">{nomeDaPagina(anterior)}</span></span>
                  </button>
                ) : <span />}
                {proxima && (
                  <button type="button" onClick={() => aoAbrir(proxima.id)} className="group flex items-center justify-end gap-2.5 rounded-xl border px-3.5 py-2.5 text-right transition-colors outline-none hover:border-ring/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    <span className="min-w-0"><span className="block text-[11px] text-muted-foreground">Próxima</span><span className="block truncate text-[13px] font-medium">{nomeDaPagina(proxima)}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>

      {painel && (
        <aside data-slot="painel-da-pagina" className="hidden w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-l px-3.5 py-4 lg:flex">
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao">Nesta página</h3>
            {sumario.length === 0 ? (
              <p className="text-xs leading-snug text-muted-foreground">Os títulos do texto aparecem aqui. No editor, use <code className="rounded bg-muted px-1 font-mono text-[11px]">#</code> e espaço, ou o menu <code className="rounded bg-muted px-1 font-mono text-[11px]">/</code>.</p>
            ) : (
              <ul data-slot="sumario" className="border-l">
                {sumario.map((s) => (
                  <li key={s.id}>
                    <button type="button" data-slot="item-do-sumario" data-atual={s.indice === secaoAtual || undefined} onClick={() => irParaTitulo(s.indice)}
                      style={{ paddingLeft: (s.nivel - 1) * 10 + 10 }}
                      className={cn(
                        "-ml-px block w-full truncate border-l py-1 pr-1 text-left text-xs leading-snug text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                        s.nivel === 1 && "font-medium",
                        s.indice === secaoAtual ? "border-primary text-primary" : "border-transparent",
                      )}>
                      {s.texto}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <PainelCitacoes tipo="pagina" alvo={id} titulo="Quem aponta para cá" />
        </aside>
      )}
    </div>
  );
}
