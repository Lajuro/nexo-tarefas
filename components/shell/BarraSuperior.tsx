"use client";

// Barra superior: onde você está, voltar e avançar, e as ferramentas que o usuário escolheu deixar à mão.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, CircleHelp, Loader2, Maximize, Minimize, PanelLeft, PanelLeftClose, Search, SlidersHorizontal } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/diversos";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { suave } from "@/lib/animacoes";
import { IdFerramenta, abrirPersonalizar, useMoldura } from "@/lib/moldura";
import { cn } from "@/lib/utils";
import { Agenda, AnotarRapido, BotaoAparencia, FocoRapido } from "./Ferramentas";
import { Sino } from "./Sino";
import { nomeDaRota } from "./navegacao";

function Migalhas() {
  const pathname = usePathname();
  const { dados } = useNexo();
  const partes: { nome: ReactNode; href?: string }[] = [];
  const [, raiz, id] = pathname.split("/");

  if (raiz === "tarefas" && id) {
    const t = dados?.tarefas.find((x) => x.id === id);
    const cat = dados?.categorias.items.find((c) => c.id === t?.categoriaId);
    partes.push({ nome: "Tarefas", href: "/tarefas" });
    if (cat) partes.push({ nome: <span className="flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span>, href: `/categorias/${cat.id}` });
    partes.push({ nome: t?.titulo ?? "Tarefa" });
  } else if (raiz === "categorias" && id) {
    const cat = dados?.categorias.items.find((c) => c.id === id);
    partes.push({ nome: "Categorias", href: "/categorias" });
    partes.push({ nome: cat ? <span className="flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span> : "Categoria" });
  } else partes.push({ nome: nomeDaRota(pathname) });

  return (
    <nav aria-label="Você está em" data-slot="migalhas" className="flex min-w-0 items-center gap-1 text-[13px] sem-selecao">
      {partes.map((p, i) => {
        const ultima = i === partes.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />}
            {p.href && !ultima ? (
              <Link href={p.href} className="shrink-0 rounded px-1 py-0.5 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
                {p.nome}
              </Link>
            ) : (
              // A última migalha troca com um leve deslize quando a tela muda.
              <motion.span key={pathname} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={suave}
                className={cn("truncate px-1 py-0.5", ultima ? "font-medium text-foreground" : "text-muted-foreground")}>
                {p.nome}
              </motion.span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

/** Uma ferramenta opcional: entra e sai da barra com um deslize curto quando o usuário liga ou desliga. */
function Vaga({ id, ocultas, children }: { id: IdFerramenta; ocultas: IdFerramenta[]; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {!ocultas.includes(id) && (
        <motion.div key={id} layout initial={{ opacity: 0, scale: 0.85, width: 0 }} animate={{ opacity: 1, scale: 1, width: "auto" }}
          exit={{ opacity: 0, scale: 0.85, width: 0 }} transition={suave} className="flex shrink-0 items-center">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BarraSuperior({
  recolhida, alternarLateral, abrirPaleta, abrirAtalhos, cheia, telaCheia, planejarDia,
}: {
  recolhida: boolean; alternarLateral: () => void; abrirPaleta: () => void; abrirAtalhos: () => void; cheia: boolean; telaCheia: () => void;
  planejarDia: () => void;
}) {
  const router = useRouter();
  const { gravando } = useNexo();
  const { moldura } = useMoldura();
  const ocultas = moldura.ferramentasOcultas;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <header data-slot="barra-superior" className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2">
          <Dica texto={recolhida ? "Abrir a barra lateral" : "Recolher a barra lateral"} atalho="Ctrl B">
            <Button variant="ghost" size="icon" aria-label="Recolher ou abrir a barra lateral" onClick={alternarLateral}>
              {recolhida ? <PanelLeft /> : <PanelLeftClose />}
            </Button>
          </Dica>
          <Dica texto="Voltar">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => router.back()}><ChevronLeft /></Button>
          </Dica>
          <Dica texto="Avançar">
            <Button variant="ghost" size="icon" aria-label="Avançar" onClick={() => router.forward()}><ChevronRight /></Button>
          </Dica>
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          <Migalhas />
          <div className="min-w-2 flex-1" />

          {/* Sem a barra de status, o "Salvando..." aparece aqui só enquanto grava. */}
          <AnimatePresence>
            {!moldura.barraStatus && gravando > 0 && (
              <motion.span key="gravando" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={suave}
                className="mr-1 flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sem-selecao">
                <Loader2 className="size-3 animate-spin" /> Salvando...
              </motion.span>
            )}
          </AnimatePresence>

          <div className="flex shrink-0 items-center gap-1.5">
            <Vaga id="agenda" ocultas={ocultas}><Agenda /></Vaga>
            <Vaga id="foco" ocultas={ocultas}><FocoRapido planejarDia={planejarDia} /></Vaga>
            <Vaga id="anotar" ocultas={ocultas}><AnotarRapido /></Vaga>
            <Vaga id="busca" ocultas={ocultas}>
              <button type="button" onClick={abrirPaleta} data-slot="busca-topo"
                className="hidden h-7 items-center gap-2 rounded-md border bg-muted/40 px-2 text-xs text-muted-foreground transition-colors outline-none sem-selecao hover:border-ring/40 hover:bg-muted/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 lg:flex 2xl:w-52">
                <Search className="size-3.5" />
                <span className="hidden flex-1 text-left 2xl:inline">Buscar em tudo</span>
                <Kbd>/</Kbd>
              </button>
            </Vaga>
          </div>
          <div className="mx-1 h-4 w-px shrink-0 bg-border" />

          <Sino />
          <BotaoAparencia />
          <Vaga id="telaCheia" ocultas={ocultas}>
            <Dica texto={cheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F11">
              <Button variant="ghost" size="icon" aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"} onClick={telaCheia}>
                {cheia ? <Minimize /> : <Maximize />}
              </Button>
            </Dica>
          </Vaga>
          <Vaga id="ajuda" ocultas={ocultas}>
            <Dica texto="Atalhos de teclado" atalho="?">
              <Button variant="ghost" size="icon" aria-label="Atalhos de teclado" onClick={abrirAtalhos}><CircleHelp /></Button>
            </Dica>
          </Vaga>
        </header>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => abrirPersonalizar("superior")}><SlidersHorizontal /> Escolher o que aparece nesta barra</ContextMenuItem>
        <ContextMenuItem onSelect={() => abrirPersonalizar("aparencia")}>Mudar cores e aparência</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
