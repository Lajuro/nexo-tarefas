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
import type { Gravidade, GrupoDeLembretes, Lembrete } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { cn } from "@/lib/utils";
import { ICONE_LEMBRETE, TOM_GRAVIDADE } from "./apoio";

const VISIVEIS = 4;

const ADIAMENTOS: { dias: number; rotulo: string; aviso: string }[] = [
  { dias: 1, rotulo: "Até amanhã", aviso: "até amanhã" },
  { dias: 3, rotulo: "Por 3 dias", aviso: "por 3 dias" },
  { dias: 7, rotulo: "Por 1 semana", aviso: "por 1 semana" },
];

/**
 * O que pede atenção hoje, uma linha por tarefa com os motivos dentro (prazo vencido, passo atrasado,
 * sem retorno...). O que é crítico ou pede atenção fica à vista; o que é só "bom saber" fica recolhido.
 */
export function PrecisaDeVoce({ grupos, adiados, adiar, reativarTodos }: ReturnType<typeof useLembretes>) {
  const { toast } = useNexo();
  const [olhoAberto, setOlhoAberto] = usePref("hoje:olhoAberto", false);
  const [tudo, setTudo] = useState(false);

  const principais = grupos.filter((g) => g.gravidade !== "info");
  const deOlho = grupos.filter((g) => g.gravidade === "info");
  const mostrados = tudo ? principais : principais.slice(0, VISIVEIS);
  const escondidos = principais.length - mostrados.length;

  const aoAdiar = (g: GrupoDeLembretes, dias: number, aviso: string) => {
    adiar(g, dias);
    toast(g.lembretes.length === 1 ? `Lembrete adiado ${aviso}.` : `Lembretes desta tarefa adiados ${aviso}.`, "info");
  };

  return (
    <Secao
      titulo="Precisa de você"
      icone={<BellRing />}
      contagem={principais.length || undefined}
      acoes={
        adiados > 0 ? (
          <Dica texto="Mostrar de novo os lembretes adiados">
            <Button variant="ghost" size="sm" className="-my-1" onClick={reativarTodos}>
              <AlarmClockOff /> {adiados === 1 ? "1 adiado" : `${adiados} adiados`}
            </Button>
          </Dica>
        ) : undefined
      }
    >
      <div data-slot="precisa-de-voce" className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <AnimatePresence initial={false}>
          {mostrados.map((g) => (
            <LinhaDaTarefa key={g.id} grupo={g} aoAdiar={aoAdiar} />
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
            {tudo ? "Mostrar menos" : escondidos === 1 ? "Mostrar mais 1 tarefa" : `Mostrar mais ${escondidos} tarefas`}
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
              <span className="ml-auto text-xs font-normal">{olhoAberto ? "Recolher" : "Sem pressa, mas não esqueça"}</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 overflow-hidden rounded-xl border bg-card shadow-xs">
              <AnimatePresence initial={false}>
                {deOlho.map((g) => (
                  <LinhaDaTarefa key={g.id} grupo={g} aoAdiar={aoAdiar} />
                ))}
              </AnimatePresence>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Secao>
  );
}

const COR_DO_MOTIVO: Record<Gravidade, string> = { critico: "text-destructive", atencao: "text-alerta", info: "text-muted-foreground" };

/** Uma tarefa que pede atenção: o título uma vez só e, embaixo, cada motivo com o que dá para fazer ali mesmo. */
function LinhaDaTarefa({
  grupo: g, aoAdiar,
}: {
  grupo: GrupoDeLembretes; aoAdiar: (g: GrupoDeLembretes, dias: number, aviso: string) => void;
}) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const tarefa = dados?.tarefas.find((t) => t.id === g.tarefaId);
  const Icone = ICONE_LEMBRETE[g.lembretes[0].tipo];
  const href = `/tarefas/${g.tarefaId}`;

  const concluirPasso = async (l: Lembrete) => {
    if (!l.registroId || !l.passoId) return;
    const { registroId, passoId } = l;
    if (await atualizarTarefa(l.tarefaId, (x) => comPassoAlternado(x, registroId, passoId, true))) toast("Passo concluído.");
  };

  const linha = (
    <div className="group/lembrete flex items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/40">
      <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", TOM_GRAVIDADE[g.gravidade])}>
        <Icone className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate rounded-sm text-[13px] leading-7 font-medium outline-none hover:underline focus-visible:underline"
        >
          {g.tarefaTitulo}
        </Link>
        <ul className="flex flex-col gap-1 pb-0.5">
          {g.lembretes.map((l) => (
            <li key={l.id} data-slot="motivo" data-tipo={l.tipo} className="flex min-h-6 min-w-0 items-center gap-2 text-xs">
              <span className={cn("shrink-0 font-medium", COR_DO_MOTIVO[l.gravidade])}>{l.titulo}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.detalhe}</span>
              {l.passoId && (
                <Button variant="outline" size="sm" className="h-6 shrink-0" onClick={() => concluirPasso(l)} data-acao="concluir-passo">
                  <Check /> Concluir
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <DropdownMenu>
          <Dica texto={g.lembretes.length === 1 ? "Adiar este lembrete" : "Adiar os lembretes desta tarefa"}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Adiar os lembretes de ${g.tarefaTitulo}`} data-acao="adiar">
                <Clock />
              </Button>
            </DropdownMenuTrigger>
          </Dica>
          <DropdownMenuContent className="min-w-40">
            <DropdownMenuLabel>Lembrar de novo</DropdownMenuLabel>
            {ADIAMENTOS.map((a) => (
              <DropdownMenuItem key={a.dias} onSelect={() => aoAdiar(g, a.dias, a.aviso)}>
                {a.rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dica texto="Abrir a tarefa">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href={href} aria-label={`Abrir a tarefa ${g.tarefaTitulo}`}><ArrowUpRight /></Link>
          </Button>
        </Dica>
      </div>
    </div>
  );

  return (
    <motion.div
      {...itemRemovivel}
      data-slot="lembrete"
      data-gravidade={g.gravidade}
      className="overflow-hidden border-b last:border-b-0"
    >
      {tarefa ? <MenuContextoTarefa tarefa={tarefa}>{linha}</MenuContextoTarefa> : linha}
    </motion.div>
  );
}
