"use client";

// Barra superior: onde você está, voltar e avançar, e as ferramentas que o usuário escolheu deixar à mão.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Loader2, PanelLeft, PanelLeftClose, Search, SlidersHorizontal } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/diversos";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { suave } from "@/lib/animacoes";
import { IdFerramenta, abrirPersonalizar, useMoldura } from "@/lib/moldura";
import { cn } from "@/lib/utils";
import { Agenda, AnotarRapido, FocoRapido, MenuMais } from "./Ferramentas";
import { FerramentaRotina } from "@/components/jornada/Ferramenta";
import { SessaoFoco } from "./SessaoFoco";
import { Sino } from "./Sino";
import { nomeDaRota } from "./navegacao";

function Migalhas() {
  const pathname = usePathname();
  const { dados } = useNexo();
  // `vis`: classes de visibilidade da migalha (e da seta antes dela). As migalhas são um contêiner (@container/migalhas):
  // quando falta espaço, a da tarefa some primeiro (o título já está no cabeçalho da página) e a categoria some
  // por inteiro antes de virar uma letra só.
  const partes: { nome: ReactNode; href?: string; vis?: string; classe?: string }[] = [];
  const [, raiz, id, sub] = pathname.split("/");

  if (raiz === "tarefas" && id) {
    const t = dados?.tarefas.find((x) => x.id === id);
    const cat = dados?.categorias.items.find((c) => c.id === t?.categoriaId);
    partes.push({ nome: "Tarefas", href: "/tarefas" });
    // no modo reunião a categoria sai, para sobrar espaço para a tarefa
    if (cat && sub !== "reuniao") {
      partes.push({
        nome: <span className="flex min-w-0 items-center gap-1.5"><PontoCor cor={cat.cor} /><span className="truncate">{cat.nome}</span></span>,
        href: `/categorias/${cat.id}`,
        vis: "hidden @[11rem]/migalhas:block",
        classe: "min-w-[4.5rem] max-w-[12rem] shrink",
      });
    }
    if (sub === "reuniao") {
      partes.push({ nome: t?.titulo ?? "Tarefa", href: `/tarefas/${id}` });
      partes.push({ nome: "Reunião" });
    } else partes.push({ nome: t?.titulo ?? "Tarefa", vis: cat ? "hidden @[20rem]/migalhas:block" : "hidden @[9rem]/migalhas:block", classe: "shrink-[30]" });
  } else if (raiz === "categorias" && id) {
    const cat = dados?.categorias.items.find((c) => c.id === id);
    partes.push({ nome: "Categorias", href: "/categorias" });
    partes.push({ nome: cat ? <span className="flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span> : "Categoria" });
  } else partes.push({ nome: nomeDaRota(pathname) });

  return (
    <nav aria-label="Você está em" data-slot="migalhas" className="@container/migalhas min-w-0 flex-1 overflow-hidden text-[13px] sem-selecao">
      <div className="flex min-w-0 items-center gap-1">
      {partes.map((p, i) => {
        const ultima = i === partes.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground/80", p.vis)} />}
            {p.href && !ultima ? (
              // A primeira migalha (a tela) nunca encolhe; as do meio cedem espaço antes de invadir as ferramentas.
              <Link href={p.href} className={cn("rounded px-1 py-0.5 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40", i === 0 ? "shrink-0" : "min-w-0 shrink-[2] truncate", p.vis, p.classe)}>
                {p.nome}
              </Link>
            ) : (
              // A última migalha troca com um leve deslize quando a tela muda.
              <motion.span key={pathname} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={suave}
                className={cn("min-w-8 truncate px-1 py-0.5", ultima && sub === "reuniao" && "shrink-0", ultima ? "font-medium text-foreground" : "text-muted-foreground", p.vis, p.classe)}>
                {p.nome}
              </motion.span>
            )}
          </Fragment>
        );
      })}
      </div>
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
          <div className="w-2 shrink-0" />

          {/* Sem a barra de status, o "Salvando..." aparece aqui só enquanto grava. */}
          <AnimatePresence>
            {!moldura.barraStatus && gravando > 0 && (
              <motion.span key="gravando" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={suave}
                className="mr-1 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sem-selecao">
                <Loader2 className="size-3 animate-spin" /> Salvando...
              </motion.span>
            )}
          </AnimatePresence>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* só aparece com uma sessão de foco em andamento ou esperando registro */}
            <SessaoFoco />
            <Vaga id="rotina" ocultas={ocultas}><FerramentaRotina /></Vaga>
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
          {/* Tema, tela cheia, atalhos e Personalizar: uso raro, num menu só (3.9). */}
          <MenuMais cheia={cheia} telaCheia={telaCheia} abrirAtalhos={abrirAtalhos} ocultas={ocultas} />
        </header>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => abrirPersonalizar("superior")}><SlidersHorizontal /> Escolher o que aparece nesta barra</ContextMenuItem>
        <ContextMenuItem onSelect={() => abrirPersonalizar("aparencia")}>Mudar cores e aparência</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
