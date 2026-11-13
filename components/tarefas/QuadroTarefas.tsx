"use client";

// Visão em quadro (kanban): uma coluna por status aberto e uma de concluídas recentes.
// Arrastar um cartão para outra coluna muda o status (e isso gera o marco na linha do tempo).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CollisionDetection, DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, PointerSensor,
  pointerWithin, rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { CardTarefa } from "@/components/CardTarefa";
import { useAcoesTarefa } from "@/components/MenuTarefa";
import { Contador, IconeStatus } from "@/components/comum";
import { Dica } from "@/components/ui/popover";
import { mola, suave } from "@/lib/animacoes";
import { dataLocal } from "@/lib/lembretes";
import { cn } from "@/lib/utils";
import { Categoria, STATUS_ABERTOS, Status, Tarefa, nomeStatus } from "@/lib/tipos";
import { DIAS_CONCLUIDAS_NO_QUADRO, type Ordem, ordenar } from "./filtros";

const COLUNAS: Status[] = [...STATUS_ABERTOS, "concluida"];

const VAZIA: Record<Status, string> = {
  a_fazer: "Nada na fila.",
  em_andamento: "Nada em andamento.",
  aguardando: "Nada esperando por terceiros.",
  bloqueada: "Nada bloqueado.",
  concluida: "Nenhuma concluída há pouco.",
  cancelada: "",
};

// Vale a coluna onde o cursor está; se o cursor saiu de todas (bordas), a que mais encosta no cartão.
const colisao: CollisionDetection = (args) => {
  const dentro = pointerWithin(args);
  return dentro.length ? dentro : rectIntersection(args);
};

function CartaoArrastavel({ t, cat }: { t: Tarefa; cat?: Categoria | null }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-slot="cartao-quadro"
      data-id={t.id}
      data-arrastando={isDragging || undefined}
      aria-roledescription="cartão que pode ser arrastado para outra coluna"
      className={cn("rounded-lg transition-opacity duration-150", isDragging && "opacity-35")}
    >
      <CardTarefa t={t} cat={cat} compacto semStatus />
    </div>
  );
}

function Coluna({
  status, tarefas, categorias, arrastando, origem, antigas, aoVerAntigas, primeira, indice,
}: {
  status: Status; tarefas: Tarefa[]; categorias: Map<string, Categoria>;
  /** Tem um cartão no ar agora. */
  arrastando: boolean;
  /** Coluna de onde o cartão saiu. */
  origem: Status | null;
  antigas?: number; aoVerAntigas?: () => void; primeira: boolean; indice: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const alvo = arrastando && isOver && origem !== status;
  const possivel = arrastando && origem !== status;
  return (
    <motion.section
      ref={setNodeRef}
      data-slot="coluna-quadro"
      data-status={status}
      data-alvo={alvo || undefined}
      aria-label={`${nomeStatus(status)}: ${tarefas.length}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...suave, delay: indice * 0.04 }}
      className={cn(
        "flex min-h-0 min-w-[220px] flex-1 basis-0 flex-col rounded-xl border bg-muted/55 transition-[background-color,border-color,box-shadow] duration-150 dark:bg-muted/35",
        alvo ? "border-primary/60 bg-primary/[0.07] ring-[3px] ring-primary/15 dark:bg-primary/[0.1]" : possivel ? "border-dashed border-foreground/15" : "border-transparent",
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 pr-2.5 pl-3 sem-selecao">
        <IconeStatus status={status} className="size-4" />
        <h2 className="truncate text-[13px] font-semibold tracking-tight">{nomeStatus(status)}</h2>
        <Contador n={tarefas.length} className="bg-background/80" />
        {status === "concluida" && (
          <Dica texto={`Só as concluídas nos últimos ${DIAS_CONCLUIDAS_NO_QUADRO} dias`}>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{DIAS_CONCLUIDAS_NO_QUADRO} dias</span>
          </Dica>
        )}
      </header>

      <motion.div layoutScroll className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <AnimatePresence mode="popLayout" initial={primeira}>
          {tarefas.map((t, i) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={{ opacity: 0, y: primeira ? 6 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
              transition={{ ...suave, delay: primeira ? indice * 0.04 + Math.min(i, 8) * 0.025 : 0, layout: mola }}
            >
              <CartaoArrastavel t={t} cat={t.categoriaId ? categorias.get(t.categoriaId) : null} />
            </motion.div>
          ))}
        </AnimatePresence>

        {tarefas.length === 0 && (
          <div
            className={cn(
              "flex min-h-16 flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center text-xs transition-colors duration-150",
              alvo ? "border-primary/50 text-primary" : "border-foreground/10 text-muted-foreground/70",
            )}
          >
            {alvo ? "Solte aqui" : possivel ? "Arraste para cá" : VAZIA[status]}
          </div>
        )}

        {!!antigas && aoVerAntigas && (
          <button
            type="button"
            onClick={aoVerAntigas}
            className="mt-auto inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            {antigas === 1 ? "Ver mais 1 concluída antes disso" : `Ver mais ${antigas} concluídas antes disso`}
            <ArrowRight className="size-3" />
          </button>
        )}
      </motion.div>
    </motion.section>
  );
}

export function QuadroTarefas({
  tarefas, categorias, ordem, concluidasAntigas, aoVerConcluidas,
}: {
  /** Já filtradas: abertas e concluídas recentes. */
  tarefas: Tarefa[];
  categorias: Map<string, Categoria>;
  ordem: Ordem;
  concluidasAntigas: number;
  aoVerConcluidas: () => void;
}) {
  const { mudarStatus } = useAcoesTarefa();
  const [ativaId, setAtivaId] = useState<string | null>(null);
  // Status "otimista": o cartão já aparece na coluna nova enquanto a gravação está a caminho.
  const [otimista, setOtimista] = useState<Record<string, Status>>({});
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const primeira = useRef(true);
  useEffect(() => {
    primeira.current = false;
  }, []);

  // Soltar o cartão em cima do próprio lugar dispara um "click" no link. O dnd-kit segura a propagação,
  // mas não a navegação padrão do link; então ela é cancelada aqui, na janela, logo depois de um arrasto.
  const fimDoArrasto = useRef(0);
  useEffect(() => {
    const guarda = (e: MouseEvent) => {
      if (Date.now() - fimDoArrasto.current < 350) e.preventDefault();
    };
    window.addEventListener("click", guarda, true);
    return () => window.removeEventListener("click", guarda, true);
  }, []);

  const statusDe = (t: Tarefa) => otimista[t.id] ?? t.status;

  const colunas = useMemo(() => {
    const grupos = new Map<Status, Tarefa[]>(COLUNAS.map((s) => [s, []]));
    for (const t of ordenar(tarefas, ordem)) grupos.get(otimista[t.id] ?? t.status)?.push(t);
    // Concluídas: a mais recente em cima, seja qual for a ordenação escolhida.
    grupos.get("concluida")!.sort((a, b) => dataLocal(b.concluidaEm || "9999").localeCompare(dataLocal(a.concluidaEm || "9999")));
    return grupos;
  }, [tarefas, ordem, otimista]);

  const ativa = ativaId ? tarefas.find((t) => t.id === ativaId) ?? null : null;
  const origem = ativa ? statusDe(ativa) : null;

  function aoComecar(e: DragStartEvent) {
    setAtivaId(String(e.active.id));
  }

  async function aoSoltar(e: DragEndEvent) {
    fimDoArrasto.current = Date.now();
    setAtivaId(null);
    const t = tarefas.find((x) => x.id === e.active.id);
    const destino = e.over?.id as Status | undefined;
    if (!t || !destino || !COLUNAS.includes(destino) || statusDe(t) === destino) return;
    setOtimista((o) => ({ ...o, [t.id]: destino }));
    try {
      await mudarStatus(t, destino);
    } finally {
      setOtimista((o) => {
        const resto = { ...o };
        delete resto[t.id];
        return resto;
      });
    }
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisao}
      onDragStart={aoComecar}
      onDragEnd={aoSoltar}
      onDragCancel={() => {
        fimDoArrasto.current = Date.now();
        setAtivaId(null);
      }}
    >
      <div data-slot="quadro-tarefas" data-arrastando={ativa ? "" : undefined} className="flex h-full min-h-0 gap-3 overflow-x-auto pb-1">
        {COLUNAS.map((s, i) => (
          <Coluna
            key={s}
            status={s}
            indice={i}
            tarefas={colunas.get(s) ?? []}
            categorias={categorias}
            arrastando={!!ativa}
            origem={origem}
            primeira={primeira.current}
            antigas={s === "concluida" ? concluidasAntigas : undefined}
            aoVerAntigas={s === "concluida" ? aoVerConcluidas : undefined}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {ativa ? (
          <div data-slot="cartao-fantasma" className="rotate-[1.5deg] cursor-grabbing">
            <CardTarefa
              t={ativa}
              cat={ativa.categoriaId ? categorias.get(ativa.categoriaId) : null}
              compacto
              semStatus
              className="border-primary/50 shadow-lg ring-[3px] ring-primary/15 hover:translate-y-0"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
