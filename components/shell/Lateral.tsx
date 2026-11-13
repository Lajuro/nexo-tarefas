"use client";

// Barra lateral: navegação (na ordem e com os itens que o usuário escolheu), foco de hoje,
// tarefas fixadas, recentes e assuntos. A largura se ajusta arrastando a borda direita.
// O que aparece aqui é decidido em lib/moldura.ts e no painel "Personalizar".

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, PinOff, Plus, Search, SlidersHorizontal, Target } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { useHoje } from "@/components/useHoje";
import { useLembretes } from "@/components/useLembretes";
import { IconeStatus, PontoCor } from "@/components/comum";
import { Kbd } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { comFixada } from "@/lib/acoes";
import { mola, suave } from "@/lib/animacoes";
import { aberta, passoEhMeu, passosAbertosDe } from "@/lib/lembretes";
import { IdSecao, LARGURA_LATERAL, NOME_SECAO, abrirPersonalizar, alternarNa, naOrdem, useMoldura, useRecentes } from "@/lib/moldura";
import { useRotina } from "@/lib/preferencias";
import { Tarefa, diasAte } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ItemNav, NAV, NAV_CONFIG, rotaAtiva } from "./navegacao";
import { Logo } from "./Logo";

const foco = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35";
const rotulo = "text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase sem-selecao";

/** Número que troca com um pequeno deslize, para a mudança ser notada sem chamar atenção demais. */
function Contagem({ n, tom }: { n: number; tom?: "perigo" | "alerta" }) {
  return (
    <span className={cn(
      "relative z-10 inline-flex h-[18px] min-w-[18px] items-center justify-center overflow-hidden rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
      tom === "perigo" ? "bg-destructive/14 text-destructive" : tom === "alerta" ? "bg-alerta/18 text-alerta" : "bg-foreground/8 text-muted-foreground",
    )}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={n} initial={{ y: 9, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -9, opacity: 0 }} transition={{ duration: 0.18 }}>
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Linha({
  item, ativo, recolhida, contador, tom, ponto,
}: {
  item: ItemNav; ativo: boolean; recolhida: boolean; contador?: number; tom?: "perigo" | "alerta"; ponto?: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      data-slot="nav-item"
      data-ativo={ativo || undefined}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors sem-selecao",
        foco,
        ativo ? "text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        recolhida && "justify-center px-0",
      )}
    >
      {ativo && (
        <motion.span layoutId="nav-ativo" transition={mola} className="absolute inset-0 rounded-md bg-sidebar-accent shadow-xs">
          <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-primary" />
        </motion.span>
      )}
      <span className="relative z-10 inline-flex">
        <item.icone className={cn(
          "size-4 shrink-0 transition-transform duration-200 ease-out group-hover/nav:scale-110 group-active/nav:scale-95",
          ativo ? "text-primary" : "opacity-80",
        )} />
        {recolhida && ((!!contador && tom) || ponto) && (
          <span className={cn("absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-sidebar", tom === "perigo" ? "bg-destructive" : "bg-alerta")} />
        )}
      </span>
      {!recolhida && <span className="relative z-10 flex-1 truncate">{item.nome}</span>}
      {!recolhida && !!contador && <Contagem n={contador} tom={tom} />}
      {!recolhida && !contador && ponto && <span className="relative z-10 size-1.5 rounded-full bg-alerta" />}
    </Link>
  );
  return recolhida ? <Dica texto={item.nome} side="right">{link}</Dica> : link;
}

/** Bloco recolhível da barra lateral (foco, fixadas, recentes, assuntos). */
function Secao({
  id, contagem, acao, fechada, alternar, children,
}: {
  id: IdSecao; contagem?: number; acao?: ReactNode; fechada: boolean; alternar: () => void; children: ReactNode;
}) {
  return (
    <motion.div layout="position" transition={suave} data-slot="secao-lateral" data-secao={id} className="flex flex-col">
      <div className="group/sec flex h-6 items-center gap-1 pr-1">
        <button type="button" onClick={alternar} aria-expanded={!fechada}
          className={cn("flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left transition-colors hover:text-foreground", rotulo, foco)}>
          <span className="truncate">{NOME_SECAO[id].nome}</span>
          {!!contagem && <span className="font-medium tabular-nums opacity-70">{contagem}</span>}
          <ChevronRight className={cn(
            "size-3 shrink-0 transition-[transform,opacity] duration-200",
            fechada ? "opacity-70" : "rotate-90 opacity-0 group-hover/sec:opacity-70 group-focus-within/sec:opacity-70",
          )} />
        </button>
        {acao}
      </div>
      <AnimatePresence initial={false}>
        {!fechada && (
          <motion.div key="corpo" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={suave} className="overflow-hidden">
            <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Anel pequeno com o quanto dos passos da tarefa já saiu. */
function Anel({ feitos, total }: { feitos: number; total: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const parte = total ? feitos / total : 0;
  return (
    <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-foreground/12" />
      <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - parte)}
        className={cn("transition-[stroke-dashoffset] duration-500 ease-out", parte >= 1 ? "stroke-sucesso" : "stroke-primary")} />
    </svg>
  );
}

const classeTarefa = (ativa: boolean) =>
  cn(
    "group/t relative flex items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors sem-selecao",
    foco,
    ativa ? "bg-sidebar-accent text-foreground" : "hover:bg-sidebar-accent/60 hover:text-foreground",
  );

export function Lateral({
  recolhida, novaTarefa, abrirPaleta, planejarDia, alternar,
}: {
  recolhida: boolean; novaTarefa: () => void; abrirPaleta: () => void; planejarDia: () => void; alternar: () => void;
}) {
  const pathname = usePathname();
  const { dados, atualizarTarefa } = useNexo();
  const { lembretes, criticos } = useLembretes();
  const { rotina, carregado } = useRotina();
  const { moldura, mudarMoldura } = useMoldura();
  const recentesIds = useRecentes();
  const hoje = useHoje();

  // ---------- largura ajustável ----------
  const inicio = useRef<{ x: number; l: number } | null>(null);
  const [arrasto, setArrasto] = useState<{ l: number; bruta: number } | null>(null);
  const limitar = (l: number) => Math.min(LARGURA_LATERAL.maxima, Math.max(LARGURA_LATERAL.minima, Math.round(l)));
  const largura = recolhida ? LARGURA_LATERAL.recolhida : (arrasto?.l ?? moldura.largura);

  // ---------- números ----------
  const numeros = useMemo(() => {
    const tarefas = dados?.tarefas ?? [];
    // folhas do bloco de notas que ainda não foram organizadas nem guardadas
    const notas = (dados?.notas?.items ?? []).filter((n) => !n.arquivadaEm && (n.texto.trim() || n.titulo.trim())).length;
    return { abertas: tarefas.filter(aberta).length, pendencias: passosAbertosDe(tarefas).length, notas };
  }, [dados?.tarefas, dados?.notas]);
  const urgentes = lembretes.filter((l) => l.gravidade !== "info").length;
  const revisaoAtrasada = carregado && numeros.abertas > 0 && (!rotina.ultimaRevisao || (diasAte(rotina.ultimaRevisao) ?? 0) <= -7);

  const extra = (href: string): { contador?: number; tom?: "perigo" | "alerta"; ponto?: boolean } => {
    const n = (contador: number, tom?: "perigo" | "alerta") => (moldura.contadores ? { contador, tom } : { ponto: !!tom && contador > 0 });
    if (href === "/") return n(urgentes, criticos ? "perigo" : "alerta");
    if (href === "/tarefas") return n(numeros.abertas);
    if (href === "/pendencias") return n(numeros.pendencias);
    if (href === "/notas") return n(numeros.notas);
    if (href === "/revisao") return { ponto: revisaoAtrasada };
    return {};
  };

  const grupos = useMemo(
    () =>
      NAV.map((g) => ({ grupo: g.grupo, itens: naOrdem(g.itens, moldura.ordem, (i) => i.href).filter((i) => !moldura.ocultos.includes(i.href)) }))
        .filter((g) => g.itens.length > 0),
    [moldura.ordem, moldura.ocultos],
  );

  // ---------- seções ----------
  const focos = useMemo(
    () =>
      (dados?.tarefas ?? [])
        .filter((t) => aberta(t) && t.focoEm === hoje)
        .sort((a, b) => b.prioridade - a.prioridade)
        .map((t) => {
          const passos = t.registros.flatMap((r) => r.proximosPassos);
          return { t, total: passos.length, feitos: passos.filter((p) => p.feito).length, proximo: passos.find((p) => !p.feito && passoEhMeu(p))?.texto ?? "" };
        }),
    [dados?.tarefas, hoje],
  );
  const fixadas = useMemo(
    () => (dados?.tarefas ?? []).filter((t) => t.fixada).sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || a.titulo.localeCompare(b.titulo)),
    [dados?.tarefas],
  );
  const recentes = useMemo(() => {
    const porId = new Map((dados?.tarefas ?? []).map((t) => [t.id, t]));
    return recentesIds.map((id) => porId.get(id)).filter((t): t is Tarefa => !!t).slice(0, 5);
  }, [dados?.tarefas, recentesIds]);
  const cats = useMemo(() => {
    const tarefas = dados?.tarefas ?? [];
    return (dados?.categorias.items ?? [])
      .filter((c) => !c.arquivada)
      .map((c) => ({ c, abertas: tarefas.filter((t) => t.categoriaId === c.id && aberta(t)).length }))
      .sort((a, b) => b.abertas - a.abertas || a.c.nome.localeCompare(b.c.nome))
      .slice(0, 7);
  }, [dados]);

  const linhaTarefa = (t: Tarefa, opcoes?: { soltar?: boolean }) => {
    const ativa = pathname === `/tarefas/${t.id}`;
    return (
      <motion.div key={t.id} layout="position" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={suave}
        className="group/linha relative">
        <MenuContextoTarefa tarefa={t}>
          <Link href={`/tarefas/${t.id}`} data-slot="tarefa-nav" className={cn(classeTarefa(ativa), "h-7", opcoes?.soltar && "pr-7")}>
            <span className="inline-flex w-4 shrink-0 justify-center"><IconeStatus status={t.status} /></span>
            <span className={cn("flex-1 truncate", !aberta(t) && "text-muted-foreground line-through decoration-muted-foreground/40")}>{t.titulo}</span>
          </Link>
        </MenuContextoTarefa>
        {opcoes?.soltar && (
          <Dica texto="Tirar das fixadas" side="right">
            <button type="button" aria-label={`Tirar “${t.titulo}” das fixadas`} onClick={() => atualizarTarefa(t.id, (x) => comFixada(x, false))}
              className={cn(
                "absolute top-0.5 right-0.5 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] group-hover/linha:opacity-100 hover:bg-foreground/8 hover:text-foreground focus-visible:opacity-100",
                foco,
              )}>
              <PinOff className="size-3.5" />
            </button>
          </Dica>
        )}
      </motion.div>
    );
  };

  const corpoDaSecao: Record<IdSecao, { contagem?: number; acao?: ReactNode; corpo: ReactNode } | null> = {
    foco: {
      contagem: focos.length,
      acao: (
        <Dica texto="Planejar o dia" atalho="D" side="right">
          <button type="button" aria-label="Planejar o dia" onClick={planejarDia}
            className={cn("inline-flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-[opacity,color,background-color] group-hover/sec:opacity-100 hover:bg-foreground/8 hover:text-foreground focus-visible:opacity-100", foco)}>
            <Plus className="size-3.5" />
          </button>
        </Dica>
      ),
      corpo: focos.length === 0 ? (
        <button type="button" data-slot="escolher-foco" onClick={planejarDia}
          className={cn("mx-0.5 flex h-8 items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2 text-xs text-muted-foreground transition-colors sem-selecao hover:border-primary/50 hover:bg-sidebar-accent/50 hover:text-foreground", foco)}>
          <Target className="size-3.5 shrink-0" />
          <span className="truncate">Escolher o foco de hoje</span>
        </button>
      ) : (
        <AnimatePresence initial={false}>
          {focos.map(({ t, total, feitos, proximo }) => (
            <motion.div key={t.id} layout="position" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={suave}>
              <MenuContextoTarefa tarefa={t}>
                <Link href={`/tarefas/${t.id}`} data-slot="tarefa-nav" className={cn(classeTarefa(pathname === `/tarefas/${t.id}`), "py-1.5")}>
                  <span className="inline-flex w-4 shrink-0 justify-center">
                    {total > 0 ? <Anel feitos={feitos} total={total} /> : <IconeStatus status={t.status} />}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-medium">{t.titulo}</span>
                    {proximo && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{proximo}</span>}
                  </span>
                </Link>
              </MenuContextoTarefa>
            </motion.div>
          ))}
        </AnimatePresence>
      ),
    },
    fixadas: fixadas.length
      ? { contagem: fixadas.length, corpo: <AnimatePresence initial={false}>{fixadas.map((t) => linhaTarefa(t, { soltar: true }))}</AnimatePresence> }
      : null,
    recentes: recentes.length ? { corpo: <AnimatePresence initial={false}>{recentes.map((t) => linhaTarefa(t))}</AnimatePresence> } : null,
    assuntos: cats.length
      ? {
          corpo: cats.map(({ c, abertas }) => {
            const ativo = pathname === `/categorias/${c.id}`;
            return (
              <Link key={c.id} href={`/categorias/${c.id}`} className={cn(classeTarefa(ativo), "h-7")}>
                <span className="inline-flex w-4 justify-center transition-transform duration-200 group-hover/t:scale-125"><PontoCor cor={c.cor} /></span>
                <span className="flex-1 truncate">{c.nome}</span>
                {abertas > 0 && moldura.contadores && <span className="text-[11px] text-muted-foreground tabular-nums">{abertas}</span>}
              </Link>
            );
          }),
        }
      : null,
  };

  return (
    <motion.aside
      data-slot="lateral"
      data-recolhida={recolhida || undefined}
      data-arrastando={arrasto ? "" : undefined}
      initial={false}
      animate={{ width: largura }}
      transition={arrasto ? { duration: 0 } : mola}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className={cn("flex h-11 shrink-0 items-center gap-2.5 px-3", recolhida && "justify-center px-0")}>
        <Link href="/" aria-label="Nexo, ir para Hoje" className={cn("group/logo flex items-center gap-2.5 rounded-md", foco)}>
          <span className="inline-flex transition-transform duration-300 ease-out group-hover/logo:scale-105 group-hover/logo:-rotate-6 group-active/logo:scale-95">
            <Logo tamanho={26} />
          </span>
          {!recolhida && (
            <span className="flex flex-col leading-none sem-selecao">
              <strong className="text-sm font-semibold tracking-tight text-foreground">Nexo</strong>
              <span className="mt-0.5 text-[10px] text-muted-foreground">cérebro de tarefas</span>
            </span>
          )}
        </Link>
      </div>

      <div className={cn("flex shrink-0 flex-col gap-1.5 px-2.5 pt-1 pb-2", recolhida && "items-center px-0")}>
        {recolhida ? (
          <>
            <Dica texto="Nova tarefa" atalho="N" side="right">
              <button type="button" aria-label="Nova tarefa" onClick={novaTarefa}
                className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs transition-transform outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95">
                <Plus className="size-4" />
              </button>
            </Dica>
            <Dica texto="Buscar" atalho="Ctrl K" side="right">
              <button type="button" aria-label="Buscar" onClick={abrirPaleta}
                className={cn("inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground", foco)}>
                <Search className="size-4" />
              </button>
            </Dica>
          </>
        ) : (
          <>
            <button type="button" onClick={novaTarefa} data-slot="nova-tarefa"
              className="group/nova flex h-8 items-center gap-2 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-foreground shadow-xs transition-[background-color,transform,box-shadow] outline-none sem-selecao hover:bg-primary/90 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.14)]">
              <Plus className="size-4 transition-transform duration-300 ease-out group-hover/nova:rotate-90" />
              <span className="flex-1 truncate text-left">Nova tarefa</span>
              <kbd className="rounded border border-white/25 bg-white/15 px-1 font-mono text-[10px]">N</kbd>
            </button>
            <button type="button" onClick={abrirPaleta} data-slot="abrir-busca"
              className={cn("flex h-8 items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors sem-selecao hover:border-ring/40 hover:text-foreground", foco)}>
              <Search className="size-3.5" />
              <span className="flex-1 truncate text-left">Buscar...</span>
              <span className="flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
            </button>
          </>
        )}
      </div>

      <nav aria-label="Principal"
        className={cn("flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-2.5 pt-1 pb-3", moldura.titulosDeGrupo ? "gap-4" : "gap-2", recolhida && "items-stretch px-2")}>
        {grupos.map((g, i) => (
          <div key={g.grupo} className="flex flex-col gap-0.5">
            {!recolhida && moldura.titulosDeGrupo && <span className={cn("px-2 pb-1", rotulo)}>{g.grupo}</span>}
            {(recolhida || !moldura.titulosDeGrupo) && i > 0 && <span aria-hidden className="mx-2 mb-1.5 h-px bg-sidebar-border" />}
            {g.itens.map((item) => (
              <Linha key={item.href} item={item} ativo={rotaAtiva(pathname, item.href)} recolhida={recolhida} {...extra(item.href)} />
            ))}
          </div>
        ))}

        {!recolhida &&
          moldura.secoes
            .filter((id) => !moldura.secoesOcultas.includes(id) && corpoDaSecao[id])
            .map((id) => {
              const s = corpoDaSecao[id]!;
              const fechada = moldura.secoesFechadas.includes(id);
              return (
                <Secao key={id} id={id} contagem={s.contagem} acao={s.acao} fechada={fechada}
                  alternar={() => mudarMoldura((m) => ({ secoesFechadas: alternarNa(m.secoesFechadas, id, !fechada) }))}>
                  {s.corpo}
                </Secao>
              );
            })}
      </nav>

      <div className={cn("flex shrink-0 items-center gap-1 border-t border-sidebar-border p-2.5", recolhida && "flex-col px-2")}>
        <div className="min-w-0 flex-1 self-stretch">
          <Linha item={NAV_CONFIG} ativo={rotaAtiva(pathname, NAV_CONFIG.href)} recolhida={recolhida} />
        </div>
        <Dica texto="Personalizar a barra lateral, as cores e a barra superior" side={recolhida ? "right" : "top"}>
          <button type="button" data-slot="abrir-personalizar" aria-label="Personalizar" onClick={() => abrirPersonalizar("lateral")}
            className={cn("group/p inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground", foco)}>
            <SlidersHorizontal className="size-4 opacity-80 transition-transform duration-300 ease-out group-hover/p:scale-110 group-hover/p:rotate-12" />
          </button>
        </Dica>
      </div>

      {!recolhida && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Largura da barra lateral. Arraste, ou use as setas. Dois cliques voltam ao padrão."
          aria-valuenow={largura}
          aria-valuemin={LARGURA_LATERAL.minima}
          aria-valuemax={LARGURA_LATERAL.maxima}
          tabIndex={0}
          data-slot="ajustar-lateral"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            inicio.current = { x: e.clientX, l: moldura.largura };
            setArrasto({ l: moldura.largura, bruta: moldura.largura });
          }}
          onPointerMove={(e) => {
            if (!inicio.current) return;
            const bruta = inicio.current.l + e.clientX - inicio.current.x;
            setArrasto({ l: limitar(bruta), bruta });
          }}
          onPointerUp={() => {
            if (!inicio.current) return;
            inicio.current = null;
            // Arrastou bem para dentro: entende como "recolher" e mantém a largura que já tinha.
            if (arrasto && arrasto.bruta < LARGURA_LATERAL.minima - 70) alternar();
            else if (arrasto) mudarMoldura({ largura: arrasto.l });
            setArrasto(null);
          }}
          onPointerCancel={() => {
            inicio.current = null;
            setArrasto(null);
          }}
          onDoubleClick={() => mudarMoldura({ largura: LARGURA_LATERAL.padrao })}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            mudarMoldura((m) => ({ largura: limitar(m.largura + (e.key === "ArrowRight" ? 16 : -16)) }));
          }}
          className="group/ajuste absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize touch-none outline-none"
        >
          <span className={cn(
            "absolute inset-y-0 right-0 w-0.5 bg-primary opacity-0 transition-opacity duration-150 group-hover/ajuste:opacity-60 group-focus-visible/ajuste:opacity-80",
            arrasto && "opacity-100 group-hover/ajuste:opacity-100",
          )} />
        </div>
      )}
    </motion.aside>
  );
}
