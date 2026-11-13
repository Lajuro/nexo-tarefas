"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClockOff, ArrowUpRight, BellRing, Check, ChevronRight, CircleCheck, Clock, Eye } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import type { useLembretes } from "@/components/useLembretes";
import { Contador, Secao } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { comPassoAlternado } from "@/lib/acoes";
import { itemRemovivel } from "@/lib/animacoes";
import type { Lembrete } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { cn } from "@/lib/utils";
import { ICONE_LEMBRETE, TOM_GRAVIDADE } from "./apoio";

const VISIVEIS = 6;

const ADIAMENTOS: { dias: number; rotulo: string; aviso: string }[] = [
  { dias: 1, rotulo: "Até amanhã", aviso: "até amanhã" },
  { dias: 3, rotulo: "Por 3 dias", aviso: "por 3 dias" },
  { dias: 7, rotulo: "Por 1 semana", aviso: "por 1 semana" },
];

/** Lembretes ativos: o que é crítico ou pede atenção fica à vista; o que é só "bom saber" fica recolhido. */
export function PrecisaDeVoce({ lembretes, adiados, adiar, reativarTodos }: ReturnType<typeof useLembretes>) {
  const { toast } = useNexo();
  const [olhoAberto, setOlhoAberto] = usePref("hoje:olhoAberto", false);
  const [tudo, setTudo] = useState(false);

  const principais = lembretes.filter((l) => l.gravidade !== "info");
  const deOlho = lembretes.filter((l) => l.gravidade === "info");
  const mostrados = tudo ? principais : principais.slice(0, VISIVEIS);
  const escondidos = principais.length - mostrados.length;

  const aoAdiar = (l: Lembrete, dias: number, aviso: string) => {
    adiar(l, dias);
    toast(`Lembrete adiado ${aviso}.`, "info");
  };

  return (
    <Secao
      titulo="Precisa de você"
      icone={<BellRing />}
      contagem={principais.length || undefined}
      acoes={
        adiados > 0 ? (
          <Dica texto="Mostrar de novo os lembretes adiados">
            <Button variant="ghost" size="sm" onClick={reativarTodos}>
              <AlarmClockOff /> {adiados === 1 ? "1 adiado" : `${adiados} adiados`}
            </Button>
          </Dica>
        ) : undefined
      }
    >
      <div data-slot="precisa-de-voce" className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <AnimatePresence initial={false}>
          {mostrados.map((l) => (
            <LinhaLembrete key={l.id} lembrete={l} aoAdiar={aoAdiar} />
          ))}
          {principais.length === 0 && (
            <motion.div key="tudo-em-dia" {...itemRemovivel} className="overflow-hidden">
              <div className="flex items-center gap-3 px-3.5 py-3.5">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sucesso/14 text-sucesso">
                  <CircleCheck className="size-4" />
                </span>
                <div className="min-w-0">
                  <strong className="block text-[13px] font-semibold">Tudo em dia</strong>
                  <p className="text-xs text-muted-foreground">Nenhum prazo estourado, retorno pendente ou passo atrasado pedindo você agora.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {(escondidos > 0 || (tudo && principais.length > VISIVEIS)) && (
          <button
            type="button"
            onClick={() => setTudo((v) => !v)}
            className="flex h-8 w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors outline-none sem-selecao hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent/50 focus-visible:text-foreground"
          >
            {tudo ? "Mostrar menos" : `Mostrar mais ${escondidos}`}
          </button>
        )}
      </div>

      {deOlho.length > 0 && (
        <Collapsible open={olhoAberto} onOpenChange={setOlhoAberto} className="mt-3" data-slot="de-olho">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group/olho flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors outline-none sem-selecao hover:bg-accent/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/olho:rotate-90" />
              <Eye className="size-3.5" />
              Para ficar de olho
              <Contador n={deOlho.length} />
              <span className="ml-auto text-[11px] font-normal">{olhoAberto ? "Recolher" : "Sem pressa, mas não esqueça"}</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 overflow-hidden rounded-xl border bg-card shadow-xs">
              <AnimatePresence initial={false}>
                {deOlho.map((l) => (
                  <LinhaLembrete key={l.id} lembrete={l} aoAdiar={aoAdiar} />
                ))}
              </AnimatePresence>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Secao>
  );
}

function LinhaLembrete({
  lembrete: l, aoAdiar,
}: {
  lembrete: Lembrete; aoAdiar: (l: Lembrete, dias: number, aviso: string) => void;
}) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const tarefa = dados?.tarefas.find((t) => t.id === l.tarefaId);
  const Icone = ICONE_LEMBRETE[l.tipo];
  const href = `/tarefas/${l.tarefaId}`;

  const concluirPasso = async () => {
    if (!l.registroId || !l.passoId) return;
    const { registroId, passoId } = l;
    if (await atualizarTarefa(l.tarefaId, (x) => comPassoAlternado(x, registroId, passoId, true))) toast("Passo concluído.");
  };

  const linha = (
    <div className="group/lembrete flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40">
      <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", TOM_GRAVIDADE[l.gravidade])}>
        <Icone className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[13px] font-medium">{l.titulo}</span>
          <Link
            href={href}
            className="truncate rounded-sm text-[13px] text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
          >
            {l.tarefaTitulo}
          </Link>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.detalhe}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {l.passoId && (
          <Button variant="outline" size="sm" className="mr-1" onClick={concluirPasso} data-acao="concluir-passo">
            <Check /> Concluir
          </Button>
        )}
        <DropdownMenu>
          <Dica texto="Adiar este lembrete">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Adiar este lembrete" data-acao="adiar">
                <Clock />
              </Button>
            </DropdownMenuTrigger>
          </Dica>
          <DropdownMenuContent className="min-w-40">
            <DropdownMenuLabel>Lembrar de novo</DropdownMenuLabel>
            {ADIAMENTOS.map((a) => (
              <DropdownMenuItem key={a.dias} onSelect={() => aoAdiar(l, a.dias, a.aviso)}>
                {a.rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dica texto="Abrir a tarefa">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={href} aria-label={`Abrir a tarefa ${l.tarefaTitulo}`}><ArrowUpRight /></Link>
          </Button>
        </Dica>
      </div>
    </div>
  );

  return (
    <motion.div
      {...itemRemovivel}
      data-slot="lembrete"
      data-gravidade={l.gravidade}
      data-tipo={l.tipo}
      className="overflow-hidden border-b last:border-b-0"
    >
      {tarefa ? <MenuContextoTarefa tarefa={tarefa}>{linha}</MenuContextoTarefa> : linha}
    </motion.div>
  );
}
