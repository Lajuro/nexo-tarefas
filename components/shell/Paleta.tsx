"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Maximize, Monitor, Moon, PanelLeft, Plus, Search, Sun, Sunrise } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useTema } from "@/components/Raiz";
import { AvatarPessoa, IconeStatus, PontoCor } from "@/components/comum";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/diversos";
import { aberta } from "@/lib/lembretes";
import { TODOS_NAV } from "./navegacao";

// Paleta de comandos (Ctrl+K): ir para qualquer tela, tarefa, categoria ou pessoa e disparar ações sem tirar a mão do teclado.
export function Paleta({
  aberta: abertaPaleta, fechar, acoes,
}: {
  aberta: boolean;
  fechar: () => void;
  acoes: { novaTarefa: () => void; planejarDia: () => void; alternarLateral: () => void; telaCheia: () => void };
}) {
  const { dados } = useNexo();
  const { definirTema } = useTema();
  const router = useRouter();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (abertaPaleta) setQ("");
  }, [abertaPaleta]);

  const tarefas = useMemo(
    () => [...(dados?.tarefas ?? [])].sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.prioridade - a.prioridade),
    [dados?.tarefas],
  );
  const cats = dados?.categorias.items ?? [];
  const pessoas = useMemo(() => {
    const s = new Set<string>();
    for (const t of dados?.tarefas ?? []) for (const r of t.registros) r.participantes.forEach((p) => s.add(p.trim()));
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [dados?.tarefas]);

  const ir = (href: string) => {
    fechar();
    router.push(href);
  };
  const fazer = (fn: () => void) => {
    fechar();
    // espera a janela fechar para o foco não brigar com a próxima janela
    setTimeout(fn, 120);
  };
  const termo = q.trim();

  return (
    <Dialog open={abertaPaleta} onOpenChange={(a) => !a && fechar()}>
      <DialogContent semFechar data-slot="paleta" className="top-[18%] max-w-[620px] translate-y-0 p-0 data-[state=closed]:slide-out-to-top-[16%] data-[state=open]:slide-in-from-top-[16%]">
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <DialogDescription className="sr-only">Busque telas, tarefas, categorias, pessoas e ações.</DialogDescription>
        <Command loop>
          <CommandInput value={q} onValueChange={setQ} placeholder="Buscar tarefa, pessoa, tela ou ação..." className="h-12 text-sm" />
          <CommandList className="max-h-[min(60vh,440px)]">
            <CommandEmpty>Nenhuma tela, tarefa ou pessoa com esse nome.</CommandEmpty>

            <CommandGroup heading="Ações">
              <CommandItem value="Nova tarefa criar adicionar" onSelect={() => fazer(acoes.novaTarefa)}>
                <Plus /> Nova tarefa <Kbd className="ml-auto">N</Kbd>
              </CommandItem>
              <CommandItem value="Planejar o dia ritual foco" onSelect={() => fazer(acoes.planejarDia)}>
                <Sunrise /> Planejar o dia <Kbd className="ml-auto">D</Kbd>
              </CommandItem>
              <CommandItem value="Tela cheia fullscreen" onSelect={() => fazer(acoes.telaCheia)}>
                <Maximize /> Entrar ou sair da tela cheia
              </CommandItem>
              <CommandItem value="Recolher barra lateral menu" onSelect={() => fazer(acoes.alternarLateral)}>
                <PanelLeft /> Recolher ou abrir a barra lateral
              </CommandItem>
              <CommandItem value="Tema claro aparência" onSelect={() => fazer(() => definirTema("claro"))}><Sun /> Tema claro</CommandItem>
              <CommandItem value="Tema escuro aparência dark" onSelect={() => fazer(() => definirTema("escuro"))}><Moon /> Tema escuro</CommandItem>
              <CommandItem value="Tema do sistema aparência automático" onSelect={() => fazer(() => definirTema("sistema"))}><Monitor /> Tema do sistema</CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading="Ir para">
              {TODOS_NAV.map((n) => (
                <CommandItem key={n.href} value={`Ir para ${n.nome}`} onSelect={() => ir(n.href)}>
                  <n.icone /> {n.nome}
                  {n.tecla && <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>{n.tecla.toUpperCase()}</Kbd></span>}
                </CommandItem>
              ))}
            </CommandGroup>

            {tarefas.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tarefas">
                  {tarefas.map((t) => {
                    const cat = cats.find((c) => c.id === t.categoriaId);
                    return (
                      <CommandItem key={t.id} value={`${t.titulo} ${t.id}`} keywords={[cat?.nome ?? "", ...t.tags]} onSelect={() => ir(`/tarefas/${t.id}`)}>
                        <IconeStatus status={t.status} />
                        <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                        {cat && <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"><PontoCor cor={cat.cor} />{cat.nome}</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {cats.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Categorias">
                  {cats.map((c) => (
                    <CommandItem key={c.id} value={`Categoria ${c.nome} ${c.id}`} onSelect={() => ir(`/categorias/${c.id}`)}>
                      <PontoCor cor={c.cor} className="mx-1" /> {c.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {pessoas.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Pessoas">
                  {pessoas.map((p) => (
                    <CommandItem key={p} value={`Pessoa ${p}`} onSelect={() => ir(`/pessoas?p=${encodeURIComponent(p)}`)}>
                      <AvatarPessoa nome={p} tamanho="sm" /> {p}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {termo && (
              <CommandGroup heading="Busca completa" forceMount>
                <CommandItem value={`__busca ${termo}`} forceMount onSelect={() => ir(`/busca?q=${encodeURIComponent(termo)}`)}>
                  <Search />
                  <span>Buscar <strong>“{termo}”</strong> em registros, anotações e links</span>
                  <CornerDownLeft className="ml-auto size-3.5" />
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground sem-selecao">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navegar</span>
            <span className="flex items-center gap-1"><Kbd>Enter</Kbd> abrir</span>
            <span className="flex items-center gap-1"><Kbd>Esc</Kbd> fechar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
