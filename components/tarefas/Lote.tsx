"use client";

// Seleção de várias tarefas e ações em lote (status, prioridade, categoria, prazo, follow-up, foco, lixeira).
// Seleciona pela caixa de marcar (aparece ao passar o mouse), por Ctrl/Shift + clique ou pela tecla X na
// tarefa em foco. Cada ação em lote grava tarefa por tarefa (pelo Provider, com rev) e oferece UM "Desfazer"
// que devolve todas como estavam, menos as que alguém mexeu depois.

import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarClock, Folder, Gauge, Target, Trash2, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { oferecerDesfazer } from "@/components/desfazer";
import { IconeStatus, PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controles";
import { SeletorData, somarDias } from "@/components/ui/data";
import * as M from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { aplicarStatus, comFoco, comLembrete } from "@/lib/acoes";
import { STATUS, type Categoria, type Status, type Tarefa, formatarData, hojeISO, nomeStatus } from "@/lib/tipos";
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
export function BarraDeLote({ selecao, tarefas, categorias }: { selecao: Selecao; tarefas: Tarefa[]; categorias: Categoria[] }) {
  const { excluirTarefa, restaurarTarefa, estado } = useNexo();
  const confirmar = useConfirmar();
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
  const categoria = (id: string | null) =>
    void aplicar(escolhidas, (x) => ({ ...x, categoriaId: id }), id ? `${plural(n)} em ${categorias.find((c) => c.id === id)?.nome ?? "outra categoria"}.` : `${plural(n)} sem categoria.`);
  const prazo = (v: string | null) => void aplicar(escolhidas, (x) => ({ ...x, prazo: v || null }), v ? `Prazo ${formatarData(v)} em ${plural(n)}.` : `Prazo removido de ${plural(n)}.`);
  const lembrar = (v: string | null) => void aplicar(escolhidas, (x) => comLembrete(x, v), v ? `Lembrete em ${formatarData(v)} para ${plural(n)}.` : `Lembrete removido de ${plural(n)}.`);
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

            <M.DropdownMenu>
              <M.DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={somenteLeitura}><Folder /> Categoria</Button>
              </M.DropdownMenuTrigger>
              <M.DropdownMenuContent align="center" side="top" className="max-h-72 min-w-48 overflow-y-auto">
                {categorias.filter((c) => !c.arquivada).map((c) => (
                  <M.DropdownMenuItem key={c.id} onSelect={() => categoria(c.id)}><PontoCor cor={c.cor} /> {c.nome}</M.DropdownMenuItem>
                ))}
                <M.DropdownMenuSeparator />
                <M.DropdownMenuItem onSelect={() => categoria(null)}><PontoCor /> Sem categoria</M.DropdownMenuItem>
              </M.DropdownMenuContent>
            </M.DropdownMenu>

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
