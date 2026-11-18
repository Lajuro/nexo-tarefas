"use client";

// Seletor de categoria com busca e criação na hora ("Criar X").
// Tem a mesma cara do Combobox do kit, mas filtra a lista por conta própria: no Combobox do kit a opção
// "Criar" fica escondida justamente quando a busca não bate com nenhuma categoria (que é quando ela faz falta).

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, type OpcaoCombo } from "@/components/ui/command";
import { campoBase } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { semAcento } from "@/lib/tipos";

/**
 * A lista de categorias com busca e "Criar": o miolo do seletor, para usar dentro de qualquer balão
 * (o campo de formulário, a categoria da tarefa trocada no lugar, a barra de ações em lote).
 */
export function ListaDeCategorias({
  valor, opcoes, aoEscolher, aoCriar, rotuloVazio = "Sem categoria", comVazio = true, dicaDeCriar = true,
}: {
  /** "" = sem categoria. */
  valor: string;
  opcoes: OpcaoCombo[];
  aoEscolher: (v: string) => void;
  /** Sem isto, a lista só escolhe. */
  aoCriar?: (nome: string) => void;
  rotuloVazio?: string;
  comVazio?: boolean;
  dicaDeCriar?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const nome = busca.trim().replace(/\s+/g, " ");

  const { visiveis, mostraVazio, podeCriar } = useMemo(() => {
    const termos = semAcento(nome).split(" ").filter(Boolean);
    const bate = (texto: string) => termos.every((t) => semAcento(texto).includes(t));
    return {
      visiveis: opcoes.filter((o) => bate(o.rotulo)),
      mostraVazio: comVazio && bate(rotuloVazio),
      podeCriar: !!aoCriar && !!nome && !opcoes.some((o) => semAcento(o.rotulo) === semAcento(nome)),
    };
  }, [opcoes, nome, rotuloVazio, comVazio, aoCriar]);

  return (
    <Command shouldFilter={false} data-slot="lista-de-categorias">
      <CommandInput placeholder={aoCriar ? "Buscar ou criar categoria..." : "Buscar categoria..."} value={busca} onValueChange={setBusca} maxLength={60} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup>
          {mostraVazio && (
            <CommandItem value="__vazio" onSelect={() => aoEscolher("")}>
              <span className="text-muted-foreground">{rotuloVazio}</span>
              {!valor && <Check className="ml-auto size-3.5 !text-primary" />}
            </CommandItem>
          )}
          {visiveis.map((o) => (
            <CommandItem key={o.valor} value={o.valor} onSelect={() => aoEscolher(o.valor)}>
              <span className="flex min-w-0 flex-1 items-center gap-2">{o.render ?? <span className="truncate">{o.rotulo}</span>}</span>
              {o.detalhe && <span className="shrink-0 text-xs text-muted-foreground">{o.detalhe}</span>}
              {o.valor === valor && <Check className="size-3.5 !text-primary" />}
            </CommandItem>
          ))}
          {podeCriar && (
            <CommandItem value="__criar" data-slot="criar-categoria" onSelect={() => aoCriar!(nome)}>
              <Plus className="!text-primary" />
              <span className="min-w-0 truncate">Criar <strong className="font-semibold">“{nome}”</strong></span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      {aoCriar && dicaDeCriar && !nome && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground sem-selecao">
          Não achou? Digite o nome e crie a categoria na hora.
        </p>
      )}
    </Command>
  );
}

export function ComboCategoria({
  valor, aoMudar, opcoes, aoCriar, placeholder = "Sem categoria", rotuloVazio = "Sem categoria", className, id,
  "aria-label": ariaLabel,
}: {
  /** "" = sem categoria. */
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: OpcaoCombo[];
  /** Chamado com o nome digitado quando a pessoa escolhe "Criar". */
  aoCriar: (nome: string) => void;
  placeholder?: string;
  rotuloVazio?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = opcoes.find((o) => o.valor === valor);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={aberto}
          aria-label={ariaLabel}
          data-slot="combobox"
          data-valor={valor}
          className={cn(campoBase, "flex h-8 items-center justify-between gap-2 px-2.5 text-left sem-selecao", !atual && "text-muted-foreground", className)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">{atual ? (atual.render ?? <span className="truncate">{atual.rotulo}</span>) : <span className="truncate">{placeholder}</span>}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-max max-w-[min(30rem,calc(100vw-2rem))] min-w-[max(15rem,var(--radix-popover-trigger-width))] p-0">
        <ListaDeCategorias valor={valor} opcoes={opcoes} rotuloVazio={rotuloVazio}
          aoEscolher={(v) => { aoMudar(v); setAberto(false); }}
          aoCriar={(nome) => { aoCriar(nome); setAberto(false); }} />
      </PopoverContent>
    </Popover>
  );
}
