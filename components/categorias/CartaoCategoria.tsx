"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentType, ReactNode, useMemo } from "react";
import { motion } from "motion/react";
import { Activity, Archive, ArchiveRestore, ArrowUpRight, Ellipsis, Pencil, Plus } from "lucide-react";
import { abrirNovaTarefa } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/diversos";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { itemLista, suave } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { Categoria, Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { EmblemaCategoria } from "./EmblemaCategoria";
import { numerosDaCategoria, useAcoesCategoria } from "./acoes";

type ItemDeMenu = ComponentType<{ onSelect?: () => void; children?: ReactNode }>;

/** Os mesmos itens servem ao menu de contexto (botão direito) e ao botão "...". */
function ItensDoMenu({
  cat, Item, Separador, aoEditar,
}: {
  cat: Categoria; Item: ItemDeMenu; Separador: ComponentType; aoEditar: () => void;
}) {
  const router = useRouter();
  const { alternarArquivada } = useAcoesCategoria();
  return (
    <>
      <Item onSelect={() => router.push(`/categorias/${cat.id}`)}><ArrowUpRight /> Abrir</Item>
      <Item onSelect={() => abrirNovaTarefa(cat.id)}><Plus /> Nova tarefa aqui</Item>
      <Separador />
      <Item onSelect={aoEditar}><Pencil /> Editar</Item>
      <Item onSelect={() => void alternarArquivada(cat)}>
        {cat.arquivada ? <><ArchiveRestore /> Desarquivar</> : <><Archive /> Arquivar</>}
      </Item>
    </>
  );
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * Cartão de um assunto na grade de categorias. O cartão inteiro é o link;
 * o botão "..." fica por cima (irmão do link, nunca dentro dele) e o botão direito abre o mesmo menu.
 */
export function CartaoCategoria({ cat, tarefas, aoEditar }: { cat: Categoria; tarefas: Tarefa[]; aoEditar: (c: Categoria) => void }) {
  const n = useMemo(() => numerosDaCategoria(tarefas), [tarefas]);
  const editar = () => aoEditar(cat);

  return (
    <motion.div
      layout
      variants={itemLista}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      whileHover={{ y: -2 }}
      transition={suave}
      style={{ "--cor": cat.cor } as React.CSSProperties}
      className="group/cat relative"
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            href={`/categorias/${cat.id}`}
            data-slot="card-categoria"
            data-arquivada={cat.arquivada || undefined}
            className={cn(
              "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-xs outline-none transition-[border-color,box-shadow,opacity] duration-200",
              "group-hover/cat:border-[color-mix(in_oklch,var(--cor)_45%,var(--border))] group-hover/cat:shadow-md",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35",
              "data-[state=open]:border-[color-mix(in_oklch,var(--cor)_45%,var(--border))] data-[state=open]:shadow-md",
              cat.arquivada && "opacity-70 group-hover/cat:opacity-100 focus-visible:opacity-100",
            )}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-(--cor) opacity-80 transition-opacity duration-200 group-hover/cat:opacity-100" />

            <div className="flex items-center gap-3 pr-7">
              <EmblemaCategoria nome={cat.nome} cor={cat.cor} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm leading-tight font-semibold tracking-tight">{cat.nome}</h3>
                  {cat.arquivada && <Badge variant="outline"><Archive /> arquivada</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {n.total ? `${n.total} ${plural(n.total, "tarefa", "tarefas")}` : "Nenhuma tarefa ainda"}
                </div>
              </div>
            </div>

            <p className={cn("mt-3 line-clamp-2 min-h-[2.375rem] text-[13px] leading-[1.1875rem] text-muted-foreground", !cat.descricao && "text-muted-foreground/60 italic")}>
              {cat.descricao || "Sem descrição"}
            </p>

            <div className="mt-3.5 flex items-baseline gap-3 text-xs text-muted-foreground tabular-nums">
              <span><strong className="text-sm font-semibold text-foreground">{n.abertas}</strong> {plural(n.abertas, "aberta", "abertas")}</span>
              <span><strong className="text-sm font-semibold text-foreground">{n.fechadas}</strong> {plural(n.fechadas, "fechada", "fechadas")}</span>
              {n.total > 0 && <span className="ml-auto">{n.conclusao}% concluído</span>}
            </div>
            <Progress valor={n.conclusao} cor={cat.cor} className="mt-1.5" />

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="size-3 shrink-0 opacity-70" />
              {n.ultima ? <span>Última atividade {dataRelativa(n.ultima)}</span> : <span>Sem atividade registrada</span>}
            </div>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ItensDoMenu cat={cat} Item={ContextMenuItem as ItemDeMenu} Separador={ContextMenuSeparator as ComponentType} aoEditar={editar} />
        </ContextMenuContent>
      </ContextMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Mais ações de ${cat.nome}`}
            className="absolute top-3.5 right-2.5 opacity-0 group-hover/cat:opacity-100 focus-visible:opacity-100 data-[state=open]:bg-accent data-[state=open]:opacity-100"
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <ItensDoMenu cat={cat} Item={DropdownMenuItem as ItemDeMenu} Separador={DropdownMenuSeparator as ComponentType} aoEditar={editar} />
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
