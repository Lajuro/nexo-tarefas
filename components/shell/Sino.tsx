"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, Bell, BellRing, CircleAlert, Clock3, Info, PartyPopper } from "lucide-react";
import { useLembretes } from "@/components/useLembretes";
import { useRepeticoes } from "@/components/Modelos";
import { Button } from "@/components/ui/button";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu";
import type { Gravidade, GrupoDeLembretes } from "@/lib/lembretes";
import { cn } from "@/lib/utils";

const VISUAL: Record<Gravidade, { icone: typeof Info; cor: string; fundo: string }> = {
  critico: { icone: CircleAlert, cor: "text-destructive", fundo: "bg-destructive/12" },
  atencao: { icone: Clock3, cor: "text-alerta", fundo: "bg-alerta/16" },
  info: { icone: Info, cor: "text-muted-foreground", fundo: "bg-muted" },
};

function Linha({ g, adiar, fechar }: { g: GrupoDeLembretes; adiar: (g: GrupoDeLembretes, dias: number) => void; fechar: () => void }) {
  const v = VISUAL[g.gravidade];
  const repeticoes = useRepeticoes();
  const conteudo = (
    <>
      <span className={cn("mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full", v.fundo, v.cor)}>
        <v.icone className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] leading-snug font-medium">{g.tarefaTitulo}</span>
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{g.lembretes.map((l) => l.titulo).join(" · ")}</span>
      </span>
    </>
  );
  const classe = "flex w-full gap-2.5 rounded-lg px-2 py-2 pr-9 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent";
  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      data-slot="lembrete"
      data-gravidade={g.gravidade}
      className="group/l relative overflow-hidden"
    >
      {g.modeloId ? (
        <button type="button" className={classe} onClick={() => { fechar(); repeticoes.criar(g.modeloId!); }}>{conteudo}</button>
      ) : (
        <Link href={`/tarefas/${g.tarefaId}`} onClick={fechar} className={classe}>{conteudo}</Link>
      )}
      <DropdownMenu>
        <Dica texto="Adiar os lembretes desta tarefa" side="left">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Adiar os lembretes de ${g.tarefaTitulo}`}
              className="absolute top-2 right-1 opacity-0 group-focus-within/l:opacity-100 group-hover/l:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
              <AlarmClock />
            </Button>
          </DropdownMenuTrigger>
        </Dica>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => adiar(g, 1)}>Lembrar amanhã</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => adiar(g, 3)}>Lembrar em 3 dias</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => adiar(g, 7)}>Lembrar em 1 semana</DropdownMenuItem>
          {g.modeloId && g.data && <DropdownMenuItem onSelect={() => repeticoes.pular(g.modeloId!, g.data!)}>Pular esta vez</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}

// Sino da barra superior: tudo o que o motor de lembretes achou, sempre a um clique.
export function Sino() {
  // Conta e mostra por tarefa: o número do selo é o mesmo da tela Hoje e do menu.
  const { grupos, criticos, adiados, adiar, reativarTodos } = useLembretes();
  const [aberto, setAberto] = useState(false);
  const urgentes = grupos.filter((g) => g.gravidade !== "info");
  const resto = grupos.filter((g) => g.gravidade === "info");
  const n = urgentes.length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto={n ? `${n} tarefa${n > 1 ? "s pedem" : " pede"} atenção` : "Lembretes"}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Lembretes" data-slot="sino" className="relative">
            {n ? <BellRing /> : <Bell />}
            {n > 0 && (
              <span className={cn(
                "absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold text-background tabular-nums",
                criticos ? "bg-destructive" : "bg-alerta",
              )}>
                {n > 9 ? "9+" : n}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" className="w-[380px] p-0" tabIndex={-1}
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
        <header className="flex items-center justify-between border-b px-3.5 py-2.5">
          <span className="text-[13px] font-semibold">Lembretes</span>
          <span className="text-xs text-muted-foreground">
            {n ? `${n} tarefa${n > 1 ? "s pedem" : " pede"} atenção` : resto.length ? "nada urgente" : "nenhum ativo"}
          </span>
        </header>
        <div className="max-h-[min(60vh,460px)] overflow-y-auto p-1.5">
          {grupos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-sucesso/14 text-sucesso"><PartyPopper className="size-5" /></span>
              <strong className="text-[13px]">Tudo em dia</strong>
              <span className="text-xs text-muted-foreground">Nenhum prazo estourando, lembrete de voltar ou tarefa esquecida.</span>
            </div>
          ) : (
            <>
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {urgentes.map((g) => <Linha key={g.id} g={g} adiar={adiar} fechar={() => setAberto(false)} />)}
                </AnimatePresence>
              </ul>
              {resto.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Para ficar de olho</div>
                  <ul className="flex flex-col">
                    <AnimatePresence initial={false}>
                      {resto.map((g) => <Linha key={g.id} g={g} adiar={adiar} fechar={() => setAberto(false)} />)}
                    </AnimatePresence>
                  </ul>
                </>
              )}
            </>
          )}
        </div>
        <footer className="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5">
          <Button asChild variant="ghost" size="sm" onClick={() => setAberto(false)}>
            <Link href="/">Ver o dia inteiro</Link>
          </Button>
          {adiados > 0 && (
            <Button variant="ghost" size="sm" onClick={reativarTodos}>
              Trazer de volta {adiados} adiado{adiados > 1 ? "s" : ""}
            </Button>
          )}
        </footer>
      </PopoverContent>
    </Popover>
  );
}
