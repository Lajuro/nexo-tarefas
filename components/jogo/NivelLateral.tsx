"use client";

// O placar sempre à vista, no pé da barra lateral: nível, XP e a meta do dia. Um clique leva às conquistas.

import Link from "next/link";
import { Check } from "lucide-react";
import { NumeroAnimado } from "@/components/comum";
import { Dica } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Anel } from "./pecas";
import { useJogo } from "./useJogo";

export function NivelLateral({ recolhida }: { recolhida: boolean }) {
  const { estado } = useJogo();
  if (!estado) return null;
  const { nivel, hoje } = estado;
  const anel = (
    <Anel parte={hoje.avancos / hoje.meta} tamanho={recolhida ? 30 : 34} espessura={3.5}>
      {hoje.bateu ? <Check className="size-3.5 text-sucesso" strokeWidth={3} /> : <span className="text-[10px] font-semibold tabular-nums">{hoje.avancos}/{hoje.meta}</span>}
    </Anel>
  );
  const dica = `Meta do dia: ${hoje.avancos} de ${hoje.meta} avanços. Nível ${nivel.n} (${nivel.nome}), faltam ${nivel.falta} XP para o próximo.`;
  if (recolhida)
    return (
      <Dica texto={dica} side="right">
        <Link href="/conquistas" data-slot="nivel-lateral" aria-label="Conquistas"
          className="mx-auto mb-1 inline-flex rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
          {anel}
        </Link>
      </Dica>
    );
  return (
    <Dica texto={dica} side="right">
      <Link href="/conquistas" data-slot="nivel-lateral"
        className="group/nivel mx-2.5 mb-2 flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background/50 px-2.5 py-2 transition-colors outline-none sem-selecao hover:border-primary/40 hover:bg-sidebar-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/35">
        {anel}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-foreground">Nível {nivel.n} <span className="font-normal text-muted-foreground">· {nivel.nome}</span></span>
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums"><NumeroAnimado valor={estado.xp} /> XP</span>
          </span>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-foreground/10">
            <span className={cn("block h-full rounded-full bg-primary transition-[width] duration-700 ease-out")} style={{ width: `${Math.max(3, nivel.parte * 100)}%` }} />
          </span>
        </span>
      </Link>
    </Dica>
  );
}
