"use client";

// Abas das páginas abertas, como num editor de código: clique troca, X (ou o botão do meio) fecha.

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dica } from "@/components/ui/popover";
import { nomeDaPagina } from "@/lib/paginas";
import type { Pagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { IconePagina } from "./pecas";

export function Abas({ abertas, ativaId, aoAtivar, aoFechar, aoFecharOutras, aoNova }: {
  abertas: Pagina[]; ativaId: string | null;
  aoAtivar: (id: string) => void; aoFechar: (id: string) => void; aoFecharOutras: (id: string) => void; aoNova: () => void;
}) {
  if (abertas.length === 0) return null;
  return (
    <div data-slot="abas-de-paginas" role="tablist" aria-label="Páginas abertas" className="flex h-9 shrink-0 items-end gap-px overflow-x-auto border-b bg-muted/40 px-1.5 pt-1 [scrollbar-width:none]">
      {abertas.map((p) => {
        const ativa = p.id === ativaId;
        return (
          <div key={p.id} role="tab" aria-selected={ativa} data-slot="aba-de-pagina" data-id={p.id} data-ativa={ativa || undefined} tabIndex={ativa ? 0 : -1}
            onClick={() => aoAtivar(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoAtivar(p.id); } }}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); aoFechar(p.id); } }}
            onDoubleClick={() => aoFecharOutras(p.id)}
            className={cn(
              "group/aba relative flex h-8 max-w-[200px] min-w-[96px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-xs transition-colors outline-none sem-selecao focus-visible:ring-2 focus-visible:ring-ring/40",
              ativa ? "border-border bg-background font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-background" : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}>
            <IconePagina pagina={p} className={cn(ativa && "text-primary")} />
            <span className="min-w-0 flex-1 truncate">{nomeDaPagina(p)}</span>
            <button type="button" aria-label={`Fechar ${nomeDaPagina(p)}`} data-slot="fechar-aba" onClick={(e) => { e.stopPropagation(); aoFechar(p.id); }}
              className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/40", !ativa && "opacity-0 group-hover/aba:opacity-100")}>
              <X className="size-3" />
            </button>
          </div>
        );
      })}
      <Dica texto="Nova página">
        <Button variant="ghost" size="icon-sm" className="mb-0.5 ml-0.5 size-6 shrink-0" aria-label="Nova página em outra aba" onClick={aoNova}><Plus /></Button>
      </Dica>
    </div>
  );
}
