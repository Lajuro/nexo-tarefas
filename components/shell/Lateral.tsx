"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { motion } from "motion/react";
import { Plus, Search } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useLembretes } from "@/components/useLembretes";
import { PontoCor } from "@/components/comum";
import { Kbd } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { mola } from "@/lib/animacoes";
import { aberta, passosAbertosDe } from "@/lib/lembretes";
import { useRotina } from "@/lib/preferencias";
import { diasAte } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ItemNav, NAV, NAV_CONFIG, rotaAtiva } from "./navegacao";
import { Logo } from "./Logo";

export const LARGURA = { aberta: 244, recolhida: 56 };

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
        "group/nav relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors outline-none sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35",
        ativo ? "text-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        recolhida && "justify-center px-0",
      )}
    >
      {ativo && <motion.span layoutId="nav-ativo" transition={mola} className="absolute inset-0 rounded-md bg-sidebar-accent shadow-xs" />}
      <span className="relative z-10 inline-flex">
        <item.icone className={cn("size-4 shrink-0", ativo ? "text-primary" : "opacity-80")} />
        {recolhida && ((!!contador && tom) || ponto) && (
          <span className={cn("absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-sidebar", tom === "perigo" ? "bg-destructive" : "bg-alerta")} />
        )}
      </span>
      {!recolhida && <span className="relative z-10 flex-1 truncate">{item.nome}</span>}
      {!recolhida && !!contador && (
        <span className={cn(
          "relative z-10 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
          tom === "perigo" ? "bg-destructive/14 text-destructive" : tom === "alerta" ? "bg-alerta/18 text-alerta" : "bg-foreground/8 text-muted-foreground",
        )}>
          {contador}
        </span>
      )}
      {!recolhida && !contador && ponto && <span className="relative z-10 size-1.5 rounded-full bg-alerta" />}
    </Link>
  );
  return recolhida ? <Dica texto={item.nome} side="right">{link}</Dica> : link;
}

export function Lateral({
  recolhida, novaTarefa, abrirPaleta,
}: {
  recolhida: boolean; novaTarefa: () => void; abrirPaleta: () => void;
}) {
  const pathname = usePathname();
  const { dados } = useNexo();
  const { lembretes, criticos } = useLembretes();
  const { rotina, carregado } = useRotina();

  const numeros = useMemo(() => {
    const tarefas = dados?.tarefas ?? [];
    // folhas do bloco de notas que ainda não foram organizadas nem guardadas
    const notas = (dados?.notas?.items ?? []).filter((n) => !n.arquivadaEm && (n.texto.trim() || n.titulo.trim())).length;
    return { abertas: tarefas.filter(aberta).length, pendencias: passosAbertosDe(tarefas).length, notas };
  }, [dados?.tarefas, dados?.notas]);
  const urgentes = lembretes.filter((l) => l.gravidade !== "info").length;
  const revisaoAtrasada = carregado && numeros.abertas > 0 && (!rotina.ultimaRevisao || (diasAte(rotina.ultimaRevisao) ?? 0) <= -7);

  const cats = useMemo(() => {
    const tarefas = dados?.tarefas ?? [];
    return (dados?.categorias.items ?? [])
      .filter((c) => !c.arquivada)
      .map((c) => ({ c, abertas: tarefas.filter((t) => t.categoriaId === c.id && aberta(t)).length }))
      .sort((a, b) => b.abertas - a.abertas || a.c.nome.localeCompare(b.c.nome))
      .slice(0, 7);
  }, [dados]);

  const extra = (href: string): { contador?: number; tom?: "perigo" | "alerta"; ponto?: boolean } => {
    if (href === "/") return { contador: urgentes, tom: criticos ? "perigo" : "alerta" };
    if (href === "/tarefas") return { contador: numeros.abertas };
    if (href === "/pendencias") return { contador: numeros.pendencias };
    if (href === "/notas") return { contador: numeros.notas };
    if (href === "/revisao") return { ponto: revisaoAtrasada };
    return {};
  };

  return (
    <motion.aside
      data-slot="lateral"
      data-recolhida={recolhida || undefined}
      initial={false}
      animate={{ width: recolhida ? LARGURA.recolhida : LARGURA.aberta }}
      transition={mola}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className={cn("flex h-11 shrink-0 items-center gap-2.5 px-3", recolhida && "justify-center px-0")}>
        <Link href="/" aria-label="Nexo, ir para Hoje" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
          <Logo tamanho={26} />
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
                className="inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <Search className="size-4" />
              </button>
            </Dica>
          </>
        ) : (
          <>
            <button type="button" onClick={novaTarefa} data-slot="nova-tarefa"
              className="flex h-8 items-center gap-2 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-foreground shadow-xs transition-[background-color,transform] outline-none sem-selecao hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-[0.98] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.14)]">
              <Plus className="size-4" />
              <span className="flex-1 text-left">Nova tarefa</span>
              <kbd className="rounded border border-white/25 bg-white/15 px-1 font-mono text-[10px]">N</kbd>
            </button>
            <button type="button" onClick={abrirPaleta} data-slot="abrir-busca"
              className="flex h-8 items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-[13px] text-muted-foreground transition-colors outline-none sem-selecao hover:border-ring/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Buscar...</span>
              <span className="flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
            </button>
          </>
        )}
      </div>

      <nav aria-label="Principal" className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto px-2.5 pt-1 pb-3", recolhida && "items-stretch px-2")}>
        {NAV.map((g) => (
          <div key={g.grupo} className="flex flex-col gap-0.5">
            {!recolhida && <span className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase sem-selecao">{g.grupo}</span>}
            {g.itens.map((item) => (
              <Linha key={item.href} item={item} ativo={rotaAtiva(pathname, item.href)} recolhida={recolhida} {...extra(item.href)} />
            ))}
          </div>
        ))}

        {!recolhida && cats.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase sem-selecao">Assuntos</span>
            {cats.map(({ c, abertas }) => {
              const ativo = pathname === `/categorias/${c.id}`;
              return (
                <Link key={c.id} href={`/categorias/${c.id}`}
                  className={cn(
                    "flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors outline-none sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35",
                    ativo ? "bg-sidebar-accent text-foreground" : "hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}>
                  <span className="inline-flex w-4 justify-center"><PontoCor cor={c.cor} /></span>
                  <span className="flex-1 truncate">{c.nome}</span>
                  {abertas > 0 && <span className="text-[11px] text-muted-foreground tabular-nums">{abertas}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className={cn("shrink-0 border-t border-sidebar-border p-2.5", recolhida && "px-2")}>
        <Linha item={NAV_CONFIG} ativo={rotaAtiva(pathname, NAV_CONFIG.href)} recolhida={recolhida} />
      </div>
    </motion.aside>
  );
}
