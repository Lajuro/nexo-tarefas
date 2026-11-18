"use client";

// Seleção de várias tarefas e ações em lote (status, prioridade, categoria, prazo, follow-up, foco, lixeira).
// Seleciona pela caixa de marcar (aparece ao passar o mouse), por Ctrl/Shift + clique ou pela tecla X na
// tarefa em foco. Cada ação em lote grava tarefa por tarefa (pelo Provider, com rev) e oferece UM "Desfazer"
// que devolve todas como estavam, menos as que alguém mexeu depois.

import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarClock, Check, Folder, Gauge, Minus, Plus, Tag, Target, Trash2, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { oferecerDesfazer } from "@/components/desfazer";
import { IconeStatus } from "@/components/comum";
import { useCriarCategoria, useOpcoesDeCategoria } from "@/components/categorias/Escolher";
import { useNomesDasTags } from "@/components/tags/useTags";
import { ListaDeCategorias } from "@/components/tarefas/ComboCategoria";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controles";
import { SeletorData, somarDias } from "@/components/ui/data";
import * as M from "@/components/ui/menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aplicarStatus, comFoco, comLembrete } from "@/lib/acoes";
import { chaveDaTag, comTagTrocada, limparTag, temATag } from "@/lib/tags";
import { STATUS, type Categoria, type Status, type Tarefa, dataCurta, hojeISO, nomeStatus, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** A seleção da tela: ids marcados. */
export function useSelecao() {
  const [ids, setIds] = useState<string[]>([]);
  const alternar = useCallback((id: string, ligar?: boolean) => {
    setIds((atual) => {
      const tem = atual.includes(id);
      const quer = ligar ?? !tem;
      if (quer === tem) return atual;
      return quer ? [...atual, id] : atual.filter((x) => x !== id);
    });
  }, []);
  const limpar = useCallback(() => setIds([]), []);
  return { ids, alternar, limpar, definir: setIds, tem: (id: string) => ids.includes(id), ativa: ids.length > 0 };
}

export type Selecao = ReturnType<typeof useSelecao>;

/**
 * Envolve um cartão ou uma linha: com a seleção ligada (ou Ctrl/Shift), o clique marca em vez de abrir.
 * A caixa de marcar fica no canto e aparece ao passar o mouse.
 */
export function Selecionavel({
  id, selecao, children, className, canto = "cartao",
}: {
  id: string; selecao: Selecao; children: ReactNode; className?: string; canto?: "cartao" | "linha";
}) {
  const marcada = selecao.tem(id);
  const aoClicar = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-slot=caixa-selecao], [role=menu], [data-slot=popover]")) return;
    if (!(selecao.ativa || e.ctrlKey || e.metaKey || e.shiftKey)) return;
    // um clique no botão "..." continua abrindo o menu
    if ((e.target as HTMLElement).closest("button[aria-label='Mais ações da tarefa']")) return;
    e.preventDefault();
    e.stopPropagation();
    selecao.alternar(id);
  };
  return (
    <div data-slot="selecionavel" data-id={id} data-selecionada={marcada || undefined} onClickCapture={aoClicar}
      className={cn("group/sel relative min-w-0", marcada && (canto === "cartao" ? "rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" : "bg-primary/8"), className)}>
      {children}
      <span className={cn(
        "absolute z-10 transition-opacity duration-150",
        canto === "cartao" ? "-top-1.5 -left-1.5" : "top-1/2 left-1 -translate-y-1/2",
        marcada || selecao.ativa ? "opacity-100" : "opacity-0 group-hover/sel:opacity-100 focus-within:opacity-100",
      )}>
        <Checkbox data-slot="caixa-selecao" checked={marcada} aria-label={marcada ? "Tirar da seleção" : "Selecionar tarefa"}
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(v) => selecao.alternar(id, v === true)}
          className="bg-card shadow-sm" />
      </span>
    </div>
  );
}

/** Aplica a mesma mudança em várias tarefas, com um só "Desfazer". */
function useAplicarEmLote() {
  const { atualizarTarefa, dadosAtuais, toast } = useNexo();
  return useCallback(
    async (tarefas: Tarefa[], fn: (t: Tarefa) => Tarefa, texto: string) => {
      const antes = new Map(tarefas.map((t) => [t.id, structuredClone(t)]));
      const depois = await Promise.all(tarefas.map((t) => atualizarTarefa(t.id, fn)));
      const gravadas = depois.filter((x): x is Tarefa => !!x);
      if (!gravadas.length) return;
      oferecerDesfazer(texto, async () => {
        let puladas = 0;
        await Promise.all(gravadas.map(async (g) => {
          const atual = dadosAtuais()?.tarefas.find((x) => x.id === g.id);
          const original = antes.get(g.id);
          if (!atual || !original || atual.rev !== g.rev) { puladas++; return; }
          await atualizarTarefa(g.id, (x) => ({ ...original, rev: x.rev }));
        }));
        if (puladas) toast(`${puladas === 1 ? "Uma tarefa mudou" : `${puladas} tarefas mudaram`} depois disso e ficou como está.`, "info");
      }, { tipo: "info" });
    },
    [atualizarTarefa, dadosAtuais, toast],
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "tarefa" : "tarefas"}`;

/** Barra flutuante com as ações para as tarefas selecionadas. */
/** As tags das tarefas escolhidas: marcada = todas têm, traço = só algumas. Escolher põe em todas (ou tira, se todas já têm). */
function TagsDoLote({ escolhidas, aoAlternar }: { escolhidas: Tarefa[]; aoAlternar: (tag: string) => void }) {
  const todas = useNomesDasTags();
  const [busca, setBusca] = useState("");
  const nome = limparTag(busca);
  const termos = semAcento(nome).split(" ").filter(Boolean);
  const visiveis = todas.filter((t) => termos.every((q) => semAcento(t).includes(q))).slice(0, 60);
  const podeCriar = !!nome && !todas.some((t) => chaveDaTag(t) === chaveDaTag(nome));
  const quantas = (t: string) => escolhidas.filter((x) => temATag(x.tags, t)).length;
  // quem está em alguma das escolhidas vem primeiro
  const ordenadas = [...visiveis].sort((a, b) => Number(quantas(b) > 0) - Number(quantas(a) > 0));
  return (
    <Command shouldFilter={false} data-slot="tags-do-lote">
      <CommandInput placeholder="Buscar ou criar tag..." value={busca} onValueChange={setBusca} maxLength={60} />
      <CommandList>
        <CommandEmpty>{todas.length ? "Nenhuma tag com esse nome." : "Nenhuma tag ainda. Digite o nome para criar."}</CommandEmpty>
        <CommandGroup>
          {ordenadas.map((t) => {
            const q = quantas(t);
            const tudo = q === escolhidas.length;
            return (
              <CommandItem key={t} value={`tag:${t}`} onSelect={() => aoAlternar(t)}>
                <span className={cn(
                  "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                  q > 0 ? "border-primary-solido bg-primary-solido text-primary-foreground" : "border-input bg-card",
                )}>
                  {tudo ? <Check className="size-3 !text-primary-foreground" strokeWidth={3} /> : q > 0 ? <Minus className="size-3 !text-primary-foreground" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{t}</span>
                {q > 0 && !tudo && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{q} de {escolhidas.length}</span>}
              </CommandItem>
            );
          })}
          {podeCriar && (
            <CommandItem value="__criar" data-slot="criar-tag" onSelect={() => { aoAlternar(nome); setBusca(""); }}>
              <Plus className="!text-primary" />
              <span className="min-w-0 truncate">Pôr a tag <strong className="font-semibold">“{nome}”</strong></span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function BarraDeLote({ selecao, tarefas, categorias }: { selecao: Selecao; tarefas: Tarefa[]; categorias: Categoria[] }) {
  const { excluirTarefa, restaurarTarefa, estado, dadosAtuais } = useNexo();
  const confirmar = useConfirmar();
  const opcoesCategoria = useOpcoesDeCategoria();
  const criarCategoria = useCriarCategoria();
  const [balao, setBalao] = useState<"categoria" | "tags" | null>(null);
  const aplicar = useAplicarEmLote();
  const escolhidas = tarefas.filter((t) => selecao.ids.includes(t.id));
  const n = escolhidas.length;
  const hoje = hojeISO();
  const somenteLeitura = !!estado?.somenteLeitura;

  const status = (s: Status) => {
    const alvo = escolhidas.filter((t) => t.status !== s);
    if (alvo.length) void aplicar(alvo, (x) => aplicarStatus(x, s, x), `${plural(alvo.length)} em ${nomeStatus(s)}.`);
  };
  const prioridade = (p: number) => void aplicar(escolhidas, (x) => ({ ...x, prioridade: p }), `Prioridade ${p} em ${plural(n)}.`);
  const categoria = (id: string | null) => {
    const nome = id ? (dadosAtuais()?.categorias.items ?? categorias).find((c) => c.id === id)?.nome ?? "outra categoria" : "";
    void aplicar(escolhidas, (x) => ({ ...x, categoriaId: id }), id ? `${plural(n)} em ${nome}.` : `${plural(n)} sem categoria.`);
  };
  /** Põe a tag em todas as escolhidas; se todas já têm, tira de todas. */
  const tag = (nome: string) => {
    const limpa = limparTag(nome);
    if (!limpa) return;
    const todasTem = escolhidas.every((t) => temATag(t.tags, limpa));
    if (todasTem) void aplicar(escolhidas, (x) => ({ ...x, tags: comTagTrocada(x.tags, limpa, null) }), `Tag “${limpa}” tirada de ${plural(n)}.`);
    else {
      const alvo = escolhidas.filter((t) => !temATag(t.tags, limpa));
      void aplicar(alvo, (x) => (temATag(x.tags, limpa) ? x : { ...x, tags: [...x.tags, limpa] }), `Tag “${limpa}” em ${plural(alvo.length)}.`);
    }
  };
  const prazo = (v: string | null) => void aplicar(escolhidas, (x) => ({ ...x, prazo: v || null }), v ? `Prazo ${dataCurta(v)} em ${plural(n)}.` : `Prazo removido de ${plural(n)}.`);
  const lembrar = (v: string | null) => void aplicar(escolhidas, (x) => comLembrete(x, v), v ? `Lembrete em ${dataCurta(v)} para ${plural(n)}.` : `Lembrete removido de ${plural(n)}.`);
  const foco = (ligar: boolean) => void aplicar(escolhidas, (x) => comFoco(x, ligar), ligar ? `${plural(n)} no foco de hoje.` : `${plural(n)} fora do foco.`);

  const lixeira = async () => {
    const ok = await confirmar({
      titulo: `Mover ${plural(n)} para a lixeira?`,
      descricao: "Elas saem da lista, mas dá para desfazer agora ou restaurar depois em Configurações.",
      confirmar: "Mover para a lixeira",
      perigo: true,
    });
    if (!ok) return;
    const arquivos: string[] = [];
    for (const t of escolhidas) {
      const r = await excluirTarefa(t.id, { semAviso: true });
      if (typeof r === "string") arquivos.push(r);
    }
    selecao.limpar();
    oferecerDesfazer(`${plural(arquivos.length)} na lixeira.`, async () => {
      for (const a of arquivos) await restaurarTarefa(a);
    });
  };

  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          key="lote"
          data-slot="barra-lote"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none sticky bottom-4 z-30 mt-4 flex justify-center"
        >
          <div role="toolbar" aria-label="Ações para as tarefas selecionadas"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-xl border bg-popover px-2 py-1.5 text-[13px] shadow-lg">
            <span data-slot="contagem-lote" className="px-2 font-medium tabular-nums sem-selecao">{plural(n)}</span>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />

            <M.DropdownMenu>
              <M.DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura} data-slot="lote-status"><IconeStatus status="em_andamento" /> Status</Button>
              </M.DropdownMenuTrigger>
              <M.DropdownMenuContent align="center" side="top">
                {STATUS.map((s) => <M.DropdownMenuItem key={s.id} onSelect={() => status(s.id)}><IconeStatus status={s.id} /> {s.nome}</M.DropdownMenuItem>)}
              </M.DropdownMenuContent>
            </M.DropdownMenu>

            <M.DropdownMenu>
              <M.DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura}><Gauge /> Prioridade</Button>
              </M.DropdownMenuTrigger>
              <M.DropdownMenuContent align="center" side="top" className="min-w-32">
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((p) => <M.DropdownMenuItem key={p} onSelect={() => prioridade(p)}><span className="w-4 text-center font-medium tabular-nums">{p}</span></M.DropdownMenuItem>)}
              </M.DropdownMenuContent>
            </M.DropdownMenu>

            <Popover open={balao === "categoria"} onOpenChange={(a) => setBalao(a ? "categoria" : null)}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura} data-slot="lote-categoria"><Folder /> Categoria</Button>
              </PopoverTrigger>
              <PopoverContent align="center" side="top" className="w-64 p-0">
                <ListaDeCategorias valor="__nenhuma" opcoes={opcoesCategoria} dicaDeCriar={false}
                  aoEscolher={(v) => { setBalao(null); categoria(v || null); }}
                  aoCriar={(nome) => { setBalao(null); void criarCategoria(nome).then((id) => { if (id) categoria(id); }); }} />
              </PopoverContent>
            </Popover>

            <Popover open={balao === "tags"} onOpenChange={(a) => setBalao(a ? "tags" : null)}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura} data-slot="lote-tags"><Tag /> Tags</Button>
              </PopoverTrigger>
              <PopoverContent align="center" side="top" className="w-64 p-0">
                <TagsDoLote escolhidas={escolhidas} aoAlternar={tag} />
              </PopoverContent>
            </Popover>

            <M.DropdownMenu>
              <M.DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura}><CalendarClock /> Prazo</Button>
              </M.DropdownMenuTrigger>
              <M.DropdownMenuContent align="center" side="top">
                <M.DropdownMenuItem onSelect={() => prazo(hoje)}>Hoje</M.DropdownMenuItem>
                <M.DropdownMenuItem onSelect={() => prazo(somarDias(hoje, 1))}>Amanhã</M.DropdownMenuItem>
                <M.DropdownMenuItem onSelect={() => prazo(somarDias(hoje, 7))}>Em 1 semana</M.DropdownMenuItem>
                <M.DropdownMenuItem onSelect={() => prazo(somarDias(hoje, 15))}>Em 15 dias</M.DropdownMenuItem>
                <M.DropdownMenuSeparator />
                <M.DropdownMenuItem onSelect={() => prazo(null)}>Tirar o prazo</M.DropdownMenuItem>
              </M.DropdownMenuContent>
            </M.DropdownMenu>
            <SeletorData valor="" aoMudar={(v) => v && prazo(v)} compacto placeholder="Outra data" aria-label="Escolher o prazo das selecionadas" className="h-8 px-2 text-[13px]" disabled={somenteLeitura} />

            <M.DropdownMenu>
              <M.DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura}><AlarmClock /> Lembrar</Button>
              </M.DropdownMenuTrigger>
              <M.DropdownMenuContent align="center" side="top">
                <M.DropdownMenuItem onSelect={() => lembrar(somarDias(hoje, 1))}>Amanhã</M.DropdownMenuItem>
                <M.DropdownMenuItem onSelect={() => lembrar(somarDias(hoje, 3))}>Em 3 dias</M.DropdownMenuItem>
                <M.DropdownMenuItem onSelect={() => lembrar(somarDias(hoje, 7))}>Em 1 semana</M.DropdownMenuItem>
                <M.DropdownMenuSeparator />
                <M.DropdownMenuItem onSelect={() => lembrar(null)}>Tirar o lembrete</M.DropdownMenuItem>
              </M.DropdownMenuContent>
            </M.DropdownMenu>

            <Dica texto={escolhidas.every((t) => t.focoEm === hoje) ? "Tirar do foco de hoje" : "Pôr no foco de hoje"}>
              <Button variant="ghost" size="sm" disabled={somenteLeitura} aria-label="Foco de hoje" onClick={() => foco(!escolhidas.every((t) => t.focoEm === hoje))}><Target /> Foco</Button>
            </Dica>
            <Dica texto="Mover para a lixeira">
              <Button variant="destructive-ghost" size="icon-sm" disabled={somenteLeitura} aria-label="Mover as selecionadas para a lixeira" onClick={lixeira}><Trash2 /></Button>
            </Dica>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <Dica texto="Limpar a seleção" atalho="Esc">
              <Button variant="ghost" size="icon-sm" aria-label="Limpar a seleção" data-slot="limpar-selecao" onClick={selecao.limpar}><X /></Button>
            </Dica>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
