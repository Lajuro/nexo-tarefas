"use client";

// Escolher as tarefas a que um link, uma página ou uma folha serve (3.14). Duas caras:
//   - opcoesDeTarefa(): as opções prontas para o SeletorMultiplo de um formulário;
//   - SeletorDeTarefas: um botão compacto ("2 tarefas") que abre a lista marcável, para a faixa de
//     propriedades de uma página e o rodapé de uma folha. Cada marcação grava na hora.

import * as React from "react";
import { Check, ListTodo } from "lucide-react";
import { IconeStatus } from "@/components/comum";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OpcaoMultipla } from "@/components/pessoas/SeletorMultiplo";
import { STATUS_ABERTOS, type Tarefa, nomeStatus } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** As tarefas na ordem em que se procura: abertas primeiro, depois por nome. */
export function tarefasParaEscolher(tarefas: Tarefa[]): Tarefa[] {
  return [...tarefas].sort((a, b) => {
    const aa = STATUS_ABERTOS.includes(a.status) ? 0 : 1;
    const bb = STATUS_ABERTOS.includes(b.status) ? 0 : 1;
    return aa - bb || a.titulo.localeCompare(b.titulo, "pt-BR");
  });
}

export function opcoesDeTarefa(tarefas: Tarefa[]): OpcaoMultipla[] {
  return tarefasParaEscolher(tarefas).map((t) => ({
    valor: t.id,
    rotulo: t.titulo,
    icone: <IconeStatus status={t.status} />,
    detalhe: STATUS_ABERTOS.includes(t.status) ? undefined : nomeStatus(t.status),
  }));
}

export function SeletorDeTarefas({
  valor, aoMudar, tarefas, className, desabilitado, rotuloVazio = "Ligar a tarefas", "aria-label": ariaLabel = "Tarefas a que isto serve",
}: {
  valor: string[];
  aoMudar: (ids: string[]) => void;
  tarefas: Tarefa[];
  className?: string;
  desabilitado?: boolean;
  rotuloVazio?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const lista = React.useMemo(() => tarefasParaEscolher(tarefas), [tarefas]);
  const existentes = valor.filter((id) => tarefas.some((t) => t.id === id));
  const alternar = (id: string) => aoMudar(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  const nomes = existentes.map((id) => tarefas.find((t) => t.id === id)?.titulo).filter(Boolean).join(", ");

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto={existentes.length ? `Serve para: ${nomes}` : "Escolha as tarefas em que isto é útil: aparece em Links e documentos de cada uma"}>
        <PopoverTrigger asChild>
          <button type="button" role="combobox" aria-expanded={aberto} aria-label={ariaLabel} disabled={desabilitado}
            data-slot="seletor-de-tarefas" data-quantas={existentes.length}
            className={cn(
              "inline-flex h-7 max-w-full shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-2 text-xs font-medium shadow-xs outline-none transition-colors sem-selecao hover:border-ring/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:border-ring dark:bg-input/20",
              !existentes.length && "text-muted-foreground",
              className,
            )}>
            <ListTodo className="size-3.5 shrink-0" />
            <span className="truncate">
              {existentes.length === 0 ? rotuloVazio : existentes.length === 1 ? nomes : `${existentes.length} tarefas`}
            </span>
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-0"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector("input")?.focus(); }}>
        <Command>
          <CommandInput placeholder="Buscar tarefa..." />
          <CommandList>
            <CommandEmpty>Nenhuma tarefa com esse nome.</CommandEmpty>
            <CommandGroup>
              {lista.map((t) => {
                const marcado = valor.includes(t.id);
                return (
                  <CommandItem key={t.id} value={`${t.titulo} ${t.id}`} keywords={[nomeStatus(t.status)]} onSelect={() => alternar(t.id)} data-marcado={marcado || undefined}>
                    <span className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                      marcado ? "border-primary-solido bg-primary-solido text-primary-foreground" : "border-input bg-card",
                    )}>
                      {marcado && <Check className="size-3 !text-primary-foreground" strokeWidth={3} />}
                    </span>
                    <IconeStatus status={t.status} />
                    <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                    {!STATUS_ABERTOS.includes(t.status) && <span className="shrink-0 text-xs text-muted-foreground">{nomeStatus(t.status)}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
