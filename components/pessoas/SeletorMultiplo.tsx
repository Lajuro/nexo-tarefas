"use client";

// Seleção múltipla com busca: os escolhidos aparecem como chips removíveis e o popover
// lista as opções marcáveis (fica aberto para marcar várias). Usado nos formulários de
// pessoa e time (times, membros, responsáveis, categorias).

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { campoBase } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { semAcento } from "@/lib/tipos";

export interface OpcaoMultipla {
  valor: string;
  rotulo: string;
  /** Ícone à esquerda (avatar, bolinha de cor), no chip e na lista. */
  icone?: React.ReactNode;
  /** Texto menor à direita na lista (cargo, contagem). */
  detalhe?: string;
}

export function SeletorMultiplo({
  valor, aoMudar, opcoes, placeholder = "Escolher...", buscaPlaceholder = "Buscar...", vazio = "Nada encontrado.",
  criar, rotuloCriar = "Criar", className, id, "aria-label": ariaLabel,
}: {
  valor: string[];
  aoMudar: (v: string[]) => void;
  opcoes: OpcaoMultipla[];
  placeholder?: string;
  buscaPlaceholder?: string;
  vazio?: string;
  /** Mostra "Criar <texto>" quando a busca não bate com nenhuma opção. Deve devolver o valor criado. */
  criar?: (texto: string) => string | null | Promise<string | null>;
  rotuloCriar?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const ancora = React.useRef<HTMLDivElement>(null);
  const porValor = React.useMemo(() => new Map(opcoes.map((o) => [o.valor, o])), [opcoes]);
  const escolhidos = valor.map((v) => porValor.get(v)).filter((o): o is OpcaoMultipla => !!o);
  const existe = opcoes.some((o) => semAcento(o.rotulo) === semAcento(busca.trim()));

  const alternar = (v: string) => aoMudar(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v]);

  return (
    <Popover open={aberto} onOpenChange={(a) => { setAberto(a); if (!a) setBusca(""); }}>
      <PopoverAnchor asChild>
        <div
          ref={ancora}
          data-slot="seletor-multiplo"
          data-quantos={valor.length}
          className={cn(
            campoBase,
            "flex min-h-8 flex-wrap items-center gap-1 px-1.5 py-1",
            aberto && "border-ring ring-[3px] ring-ring/25",
            className,
          )}
        >
          <AnimatePresence initial={false}>
            {escolhidos.map((o) => (
              <motion.span
                key={o.valor}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                data-slot="escolhido"
                data-valor={o.valor}
                className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-muted pr-0.5 pl-1.5 text-xs font-medium"
              >
                {o.icone}
                <span className="truncate">{o.rotulo}</span>
                <button
                  type="button"
                  aria-label={`Tirar ${o.rotulo}`}
                  onClick={() => alternar(o.valor)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={aberto}
            aria-label={ariaLabel}
            onClick={() => setAberto((a) => !a)}
            className="inline-flex h-6 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 text-left text-[13px] text-muted-foreground/80 outline-none sem-selecao hover:text-foreground focus-visible:bg-accent"
          >
            <Plus className="size-3.5 shrink-0" />
            <span className="truncate">{escolhidos.length ? "Adicionar" : placeholder}</span>
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[min(30rem,calc(100vw-2rem))] min-w-64 p-0"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector("input")?.focus(); }}
        // clicar no próprio campo (chips, "Adicionar") não conta como clique fora
        onInteractOutside={(e) => { if (ancora.current?.contains(e.target as Node)) e.preventDefault(); }}
      >
        <Command>
          <CommandInput placeholder={buscaPlaceholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => {
                const marcado = valor.includes(o.valor);
                return (
                  <CommandItem key={o.valor} value={`${o.rotulo} ${o.valor}`} keywords={[o.detalhe || ""]} onSelect={() => alternar(o.valor)}
                    data-marcado={marcado || undefined}>
                    <span className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                      marcado ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                    )}>
                      {marcado && <Check className="size-3 !text-primary-foreground" strokeWidth={3} />}
                    </span>
                    {o.icone}
                    <span className="min-w-0 flex-1 truncate">{o.rotulo}</span>
                    {o.detalhe && <span className="max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground">{o.detalhe}</span>}
                  </CommandItem>
                );
              })}
              {criar && busca.trim() && !existe && (
                <CommandItem
                  value={`__criar ${busca}`}
                  forceMount
                  onSelect={async () => {
                    const novo = await criar(busca.trim());
                    if (novo) aoMudar([...valor, novo]);
                    setBusca("");
                  }}
                >
                  <Plus />
                  <span>{rotuloCriar} <strong>“{busca.trim()}”</strong></span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
