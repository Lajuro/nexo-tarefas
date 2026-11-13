"use client";

// Etapa 2 do ritual: escolher os focos de hoje entre as tarefas que mais merecem atenção.

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, Target } from "lucide-react";
import { CatTag, PrazoTag, PrioBadge, StatusBadge, Vazio } from "@/components/comum";
import { EtiquetasMotivo } from "@/components/hoje/apoio";
import { itemLista, lista, suave } from "@/lib/animacoes";
import { aberta, sugestoesDeFoco } from "@/lib/lembretes";
import { Categoria, Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CabecalhoEtapa } from "./pecas";

export const MAX_FOCOS = 3;

/** As 8 melhores sugestões, mais o que já é foco hoje (mesmo que não esteja entre elas). */
export function candidatosAFoco(tarefas: Tarefa[], hoje: string): string[] {
  const ids = sugestoesDeFoco(tarefas, 8).map((s) => s.tarefa.id);
  for (const t of tarefas) if (aberta(t) && t.focoEm === hoje && !ids.includes(t.id)) ids.push(t.id);
  return ids;
}

export function EtapaFocos({
  candidatos, tarefas, categorias, ehFoco, alternar, total,
}: {
  candidatos: string[];
  tarefas: Tarefa[];
  categorias: Categoria[];
  ehFoco: (t: Tarefa) => boolean;
  alternar: (t: Tarefa) => void;
  /** Quantas tarefas estão em foco agora (inclusive fora desta lista). */
  total: number;
}) {
  const motivos = useMemo(() => new Map(sugestoesDeFoco(tarefas, tarefas.length).map((s) => [s.tarefa.id, s.motivos])), [tarefas]);
  const opcoes = candidatos.map((id) => tarefas.find((t) => t.id === id)).filter((t): t is Tarefa => !!t && aberta(t));
  const demais = total > MAX_FOCOS;

  return (
    <div>
      <CabecalhoEtapa
        titulo="Escolha seus focos"
        descricao={`Até ${MAX_FOCOS} tarefas para fazer andar de verdade hoje. O resto continua guardado.`}
        lado={
          <div data-slot="contador-focos" data-total={total} className="flex items-center gap-2 sem-selecao">
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: Math.max(MAX_FOCOS, total) }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-2 rounded-full transition-colors duration-200",
                    i < total ? (i >= MAX_FOCOS ? "bg-alerta" : "bg-primary") : "bg-muted-foreground/20",
                  )}
                />
              ))}
            </span>
            <span className={cn("text-xs font-medium tabular-nums", demais ? "text-alerta" : "text-muted-foreground")}>
              {total} de {MAX_FOCOS}
            </span>
          </div>
        }
      />

      <AnimatePresence initial={false}>
        {demais && (
          <motion.div
            key="aviso"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={suave}
            className="overflow-hidden"
          >
            <div data-slot="aviso-focos" role="status" className="mb-3 flex items-start gap-2 rounded-lg bg-alerta/12 px-3 py-2 text-xs leading-relaxed text-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-alerta" />
              <span>
                Com {total} focos a atenção se divide. Se der, deixe algum para amanhã. Se o dia pede mesmo tudo isso, siga em frente.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {opcoes.length === 0 ? (
        <Vazio titulo="Nenhuma tarefa aberta" icone={<Target />} compacto>
          <p>Quando houver tarefas em aberto, as mais urgentes aparecem aqui para você escolher.</p>
        </Vazio>
      ) : (
        <motion.div variants={lista} initial="escondido" animate="visivel" role="group" aria-label="Tarefas sugeridas para o foco de hoje" className="flex flex-col gap-2">
          {opcoes.map((t) => {
            const marcado = ehFoco(t);
            return (
              <motion.button
                key={t.id}
                variants={itemLista}
                type="button"
                role="checkbox"
                aria-checked={marcado}
                data-slot="opcao-foco"
                data-tarefa={t.id}
                onClick={() => alternar(t)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
                  marcado ? "border-primary/55 bg-primary/[0.06] shadow-xs dark:bg-primary/[0.12]" : "bg-card hover:border-ring/40 hover:bg-accent/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-150",
                    marcado ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card dark:bg-input/20",
                  )}
                >
                  {marcado && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 26 }} className="inline-flex">
                      <Check className="size-3" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug font-medium">{t.titulo}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <CatTag cat={categorias.find((c) => c.id === t.categoriaId)} className="text-[11px]" />
                    <StatusBadge status={t.status} />
                    <EtiquetasMotivo motivos={motivos.get(t.id) ?? []} />
                    {!(motivos.get(t.id) ?? []).some((m) => /prazo|atrasada/.test(m)) && <PrazoTag prazo={t.prazo} className="text-[11px] [&_svg]:size-3" />}
                  </span>
                </span>
                <PrioBadge p={t.prioridade} semDica />
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
