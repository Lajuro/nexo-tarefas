"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { campoBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// Filtro que ignora acentos e maiúsculas (o padrão do cmdk não ignora acento).
const limpar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function filtroSemAcento(valor: string, busca: string, palavras?: string[]) {
  const alvo = limpar(`${valor} ${(palavras || []).join(" ")}`);
  return limpar(busca).split(/\s+/).filter(Boolean).every((t) => alvo.includes(t)) ? 1 : 0;
}

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      filter={filtroSemAcento}
      className={cn("flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground", className)}
      {...props}
    />
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b px-3" data-slot="command-input-wrapper">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn("h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70", className)}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1", className)} {...props} />;
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className="py-6 text-center text-[13px] text-muted-foreground" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none sem-selecao data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

// ---------- Combobox: seletor com busca (para listas longas: tarefas, pessoas, categorias) ----------

export interface OpcaoCombo {
  valor: string;
  rotulo: string;
  /** Conteúdo mostrado no lugar do rótulo (ex.: com bolinha de cor). */
  render?: React.ReactNode;
  detalhe?: string;
}

function Combobox({
  valor,
  aoMudar,
  opcoes,
  placeholder = "Selecione",
  buscaPlaceholder = "Buscar...",
  vazio = "Nada encontrado.",
  className,
  permitirLimpar = true,
  rotuloLimpar = "Nenhum",
  criar,
  id,
  "aria-label": ariaLabel,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: OpcaoCombo[];
  placeholder?: string;
  buscaPlaceholder?: string;
  vazio?: string;
  className?: string;
  permitirLimpar?: boolean;
  rotuloLimpar?: string;
  /** Se informado, mostra "Criar <texto>" quando a busca não bate com nenhuma opção. */
  criar?: (texto: string) => void;
  id?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const atual = opcoes.find((o) => o.valor === valor);
  const existe = opcoes.some((o) => limpar(o.rotulo) === limpar(busca.trim()));

  return (
    <Popover open={aberto} onOpenChange={(a) => { setAberto(a); if (!a) setBusca(""); }}>
      <PopoverTrigger asChild>
        <button type="button" id={id} role="combobox" aria-expanded={aberto} aria-label={ariaLabel} data-slot="combobox"
          className={cn(campoBase, "flex h-8 items-center justify-between gap-2 px-2.5 text-left sem-selecao", !atual && "text-muted-foreground/70", className)}>
          <span className="flex min-w-0 flex-1 items-center gap-2">{atual ? (atual.render ?? <span className="truncate">{atual.rotulo}</span>) : <span className="truncate">{placeholder}</span>}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-max max-w-[min(30rem,calc(100vw-2rem))] min-w-[max(14rem,var(--radix-popover-trigger-width))] p-0">
        <Command>
          <CommandInput placeholder={buscaPlaceholder} value={busca} onValueChange={setBusca} />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {permitirLimpar && (
                <CommandItem value={`__limpar ${rotuloLimpar}`} onSelect={() => { aoMudar(""); setAberto(false); }}>
                  <span className="text-muted-foreground">{rotuloLimpar}</span>
                  {!valor && <Check className="ml-auto size-3.5 !text-primary" />}
                </CommandItem>
              )}
              {opcoes.map((o) => (
                <CommandItem key={o.valor} value={o.rotulo} keywords={[o.detalhe || "", o.valor]}
                  onSelect={() => { aoMudar(o.valor); setAberto(false); }}>
                  <span className="flex min-w-0 flex-1 items-center gap-2">{o.render ?? <span className="truncate">{o.rotulo}</span>}</span>
                  {o.detalhe && <span className="shrink-0 text-[11px] text-muted-foreground">{o.detalhe}</span>}
                  {o.valor === valor && <Check className="size-3.5 !text-primary" />}
                </CommandItem>
              ))}
              {criar && busca.trim() && !existe && (
                <CommandItem value={`__criar ${busca}`} forceMount onSelect={() => { criar(busca.trim()); setAberto(false); }}>
                  <span>Criar <strong>“{busca.trim()}”</strong></span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandSeparator, CommandItem, Combobox };
