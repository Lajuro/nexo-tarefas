"use client";

// Filtro por tag (3.17): o botão "Tags" das listas (tarefas e páginas). Escolhe uma ou mais tags e a lista
// mostra só o que tem todas. As opções são as tags que existem naquela lista, com a contagem de cada uma;
// uma tag escolhida que não está em nenhum item (veio de um endereço antigo) continua aparecendo, para dar
// para tirar. Quem guarda a escolha é a tela: aqui é só o controle.

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Settings2, Tag } from "lucide-react";
import { Etiqueta } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chaveDaTag, temATag } from "@/lib/tags";
import { semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Onde uma tag é gerenciada: a aba Tags, com ela aberta. */
export const hrefDaTag = (tag: string) => `/categorias?aba=tags&tag=${encodeURIComponent(tag)}`;

/** Tag que leva à aba Tags, com tudo o que tem ela. Para lugares em que a tag não está dentro de outro link. */
export function LinkDaTag({ tag, cerquilha, className }: { tag: string; cerquilha?: boolean; className?: string }) {
  return (
    <Dica texto={`Ver tudo o que tem a tag “${tag}”`}>
      <Link href={hrefDaTag(tag)} data-slot="link-da-tag" data-tag={tag} className="max-w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
        <Etiqueta className={cn("max-w-full transition-colors hover:bg-accent hover:text-accent-foreground", className)}>
          <span className="truncate">{cerquilha && "#"}{tag}</span>
        </Etiqueta>
      </Link>
    </Dica>
  );
}

export function FiltroDeTags({
  valor, aoMudar, opcoes, className,
}: {
  /** As tags escolhidas. */
  valor: string[];
  aoMudar: (tags: string[]) => void;
  /** As tags que existem na lista, com quantos itens têm cada uma. */
  opcoes: { nome: string; n: number }[];
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  // sem nenhuma tag na lista e sem filtro ligado, o botão não teria o que oferecer
  if (!opcoes.length && !valor.length) return null;

  const orfas = valor.filter((t) => !opcoes.some((o) => chaveDaTag(o.nome) === chaveDaTag(t))).map((nome) => ({ nome, n: 0 }));
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const visiveis = [...orfas, ...opcoes].filter((o) => termos.every((q) => semAcento(o.nome).includes(q)));
  const alternar = (tag: string) => aoMudar(temATag(valor, tag) ? valor.filter((t) => chaveDaTag(t) !== chaveDaTag(tag)) : [...valor, tag]);
  const rotulo = valor.length ? `Filtrando por ${valor.length === 1 ? `a tag ${valor[0]}` : `${valor.length} tags`}` : "Filtrar por tag";

  return (
    <Popover open={aberto} onOpenChange={(a) => { setAberto(a); if (!a) setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" data-slot="filtro-de-tags" data-ativas={valor.length || undefined} aria-label={rotulo} className={cn("gap-2 px-2.5 font-normal", className)}>
          <Tag className={cn("size-3.5", valor.length ? "text-primary" : "text-muted-foreground")} />
          Tags
          {valor.length > 0 && <span className="font-medium text-primary tabular-nums">{valor.length}</span>}
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar tag..." value={busca} onValueChange={setBusca} maxLength={60} />
          <CommandList>
            <CommandEmpty>Nenhuma tag com esse nome.</CommandEmpty>
            <CommandGroup>
              {visiveis.map((o) => {
                const marcada = temATag(valor, o.nome);
                return (
                  <CommandItem key={chaveDaTag(o.nome)} value={`tag:${o.nome}`} data-slot="opcao-de-tag" data-tag={o.nome} data-marcada={marcada || undefined} onSelect={() => alternar(o.nome)}>
                    <span className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                      marcada ? "border-primary-solido bg-primary-solido text-primary-foreground" : "border-input bg-card",
                    )}>
                      {marcada && <Check className="size-3 !text-primary-foreground" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{o.n}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Link href="/categorias?aba=tags" data-slot="gerenciar-tags" className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
            <Settings2 className="size-3.5" /> Renomear ou juntar
          </Link>
          {valor.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" data-slot="limpar-tags" onClick={() => aoMudar([])}>Limpar</Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
