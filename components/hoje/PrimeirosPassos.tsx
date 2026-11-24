"use client";

// Primeiros passos (3.22): o bloco da tela Hoje que ensina o Nexo fazendo. Seis itens CALCULADOS dos dados
// (lib/primeiros-passos.ts), cada um com "Mostrar onde". Só aparece para quem passou pelas boas-vindas, some
// sozinho quando tudo foi feito e pode ser dispensado. Nada aqui grava dado: o estado do bloco é preferência.

import { useMemo } from "react";
import { Check, Crosshair, Rocket, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { mostrarOnde } from "@/components/shell/Holofote";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { usePref, useRotina } from "@/lib/preferencias";
import { normalizarEstadoDosPrimeirosPassos, primeirosPassos, resumoDosPrimeirosPassos } from "@/lib/primeiros-passos";
import { cn } from "@/lib/utils";

/** O estado do bloco (preferência "primeirosPassos"): quem liga é a tela de boas-vindas. */
export function usePrimeirosPassos() {
  const { dados, estado } = useNexo();
  const { rotina } = useRotina();
  const [bruto, definir] = usePref<unknown>("primeirosPassos", "");
  const situacao = normalizarEstadoDosPrimeirosPassos(bruto);
  const lista = useMemo(
    () => primeirosPassos({ tarefas: dados?.tarefas ?? [], categorias: dados?.categorias.items ?? [] }, { planejou: !!rotina.ultimoPlanejamento }),
    [dados?.tarefas, dados?.categorias.items, rotina.ultimoPlanejamento],
  );
  const resumo = resumoDosPrimeirosPassos(lista);
  // no exemplo o bloco não aparece: lá tudo já está feito, e os primeiros passos são para os dados de verdade
  const visivel = situacao === "ativo" && !resumo.completo && !estado?.exemplo;
  return { lista, resumo, visivel, dispensar: () => definir("dispensado") };
}

export function PrimeirosPassos() {
  const { lista, resumo, dispensar } = usePrimeirosPassos();
  return (
    <section data-slot="primeiros-passos" aria-label="Primeiros passos" className="rounded-xl border bg-card shadow-xs">
      <header className="flex items-center gap-2.5 border-b px-3.5 py-2">
        <Rocket className="size-4 shrink-0 text-primary" />
        <h2 className="text-[13px] font-semibold tracking-tight">Primeiros passos</h2>
        <span data-slot="primeiros-passos-contagem" className="text-xs text-muted-foreground tabular-nums">{resumo.feitos} de {resumo.total}</span>
        <Progress valor={(resumo.feitos / resumo.total) * 100} className="ml-1 hidden h-1 w-24 @lg:block" />
        <Dica texto="Esconder os primeiros passos. Nada é apagado.">
          <Button variant="ghost" size="icon-sm" aria-label="Esconder os primeiros passos" data-slot="dispensar-primeiros-passos" className="ml-auto" onClick={dispensar}><X /></Button>
        </Dica>
      </header>
      <ul className="grid gap-x-4 p-1.5 @2xl:grid-cols-2">
        {lista.map((p) => (
          <li key={p.id} data-slot="passo-inicial" data-id={p.id} data-feito={p.feito || undefined} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span aria-hidden className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border", p.feito ? "border-transparent bg-sucesso/15 text-sucesso" : "text-transparent")}>
              <Check className="size-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-[13px] font-medium", p.feito && "text-muted-foreground line-through decoration-muted-foreground/40")}>{p.titulo}</span>
              {!p.feito && <span className="block truncate text-xs text-muted-foreground">{p.porque}</span>}
              <span className="sr-only">{p.feito ? "Feito." : "Ainda não feito."}</span>
            </span>
            {!p.feito && <Button variant="outline" size="sm" className="shrink-0" onClick={() => mostrarOnde(p.onde)}><Crosshair /> Mostrar onde</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
