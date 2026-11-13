"use client";

// Cartão de tarefa usado na grade, no quadro (versão compacta) e nas páginas de categoria.
// O cartão inteiro é um link para a tarefa; o botão direito e o "..." abrem o menu de ações.

import Link from "next/link";
import { AlarmClock, CalendarClock, ListChecks, Target, Users } from "lucide-react";
import { BotaoMenuTarefa, MenuContextoTarefa } from "./MenuTarefa";
import { CatTag, IconeStatus, IconeTipo, PrazoTag, PrioBadge, StatusBadge } from "./comum";
import { Dica } from "@/components/ui/popover";
import { ehFocoHoje } from "@/lib/acoes";
import { dataRelativa } from "@/lib/lembretes";
import { cn } from "@/lib/utils";
import {
  Categoria, STATUS_ABERTOS, Tarefa, diasAte, formatarData, hojeISO, nomeStatus, passosAbertos, tipoInfo, ultimoRegistro,
} from "@/lib/tipos";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Selo do foco de hoje (alvo em destaque). */
function SeloFoco({ pequeno }: { pequeno?: boolean }) {
  return (
    <Dica texto="Foco de hoje">
      <span
        data-slot="foco-hoje"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs",
          pequeno ? "size-5" : "size-6",
        )}
      >
        <Target className={pequeno ? "size-3" : "size-3.5"} strokeWidth={2.4} />
      </span>
    </Dica>
  );
}

/** Contadores com ícone: reuniões, próximos passos em aberto e o lembrete de voltar. */
function Contadores({ t, aberta, curto }: { t: Tarefa; aberta: boolean; curto?: boolean }) {
  const pend = aberta ? passosAbertos(t).length : 0;
  const reunioes = t.registros.filter((r) => r.tipo === "reuniao").length;
  const lembrar = aberta ? t.lembrarEm : null;
  const chegou = lembrar ? (diasAte(lembrar) ?? 1) <= 0 : false;
  if (!curto && aberta && !reunioes && !pend && !lembrar)
    return <span className="text-muted-foreground/70">Sem pendências em aberto</span>;
  return (
    <>
      {reunioes > 0 && (
        <Dica texto={plural(reunioes, "reunião registrada", "reuniões registradas")}>
          <span data-slot="contador-reunioes" className="inline-flex shrink-0 items-center gap-1 tabular-nums">
            <Users className="size-3.5" />
            {reunioes}
          </span>
        </Dica>
      )}
      {pend > 0 && (
        <Dica texto={plural(pend, "próximo passo em aberto", "próximos passos em aberto")}>
          <span data-slot="contador-pendencias" className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground/80 tabular-nums">
            <ListChecks className="size-3.5" />
            {curto ? pend : plural(pend, "pendente", "pendentes")}
          </span>
        </Dica>
      )}
      {lembrar && (
        <Dica texto={chegou ? `Você pediu para voltar nisto ${dataRelativa(lembrar)}` : `Lembrar de voltar ${dataRelativa(lembrar)}`}>
          <span data-slot="lembrete" className={cn("inline-flex shrink-0 items-center gap-1 tabular-nums", chegou && "font-medium text-alerta")}>
            <AlarmClock className="size-3.5" />
            {formatarData(lembrar, false)}
          </span>
        </Dica>
      )}
    </>
  );
}

/** Prazo em formato curto (sem o ano quando é deste ano), para caber no cartão compacto. */
function PrazoCurto({ prazo, aberta }: { prazo: string | null; aberta: boolean }) {
  if (!prazo) return null;
  const d = diasAte(prazo) ?? 0;
  const esteAno = prazo.slice(0, 4) === hojeISO().slice(0, 4);
  const tom = !aberta ? "" : d < 0 ? "text-destructive" : d <= 3 ? "text-alerta" : "";
  const extra = !aberta ? "" : d < 0 ? ` · ${-d}d de atraso` : d === 0 ? " · hoje" : d === 1 ? " · amanhã" : d <= 7 ? ` · em ${d}d` : "";
  return (
    <span data-slot="prazo" className={cn("inline-flex shrink-0 items-center gap-1 font-medium whitespace-nowrap tabular-nums", tom)}>
      <CalendarClock className="size-3" />
      {formatarData(prazo, esteAno ? false : true)}
      {extra}
    </span>
  );
}

const classeMenu =
  "opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100";

export function CardTarefa({
  t, cat, compacto, semStatus, className,
}: {
  t: Tarefa;
  cat?: Categoria | null;
  /** Versão pequena (quadro e listas estreitas): sem a linha do último registro. */
  compacto?: boolean;
  /** Esconde o status (quando a coluna do quadro já diz qual é). Só vale no compacto. */
  semStatus?: boolean;
  className?: string;
}) {
  const aberta = STATUS_ABERTOS.includes(t.status);
  const foco = aberta && ehFocoHoje(t);
  const ult = compacto ? null : ultimoRegistro(t);

  const base = cn(
    "group/card relative flex min-w-0 flex-col overflow-hidden border text-left outline-none sem-selecao",
    "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
    "hover:-translate-y-0.5 hover:border-ring/45 hover:shadow-md focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
    aberta ? "bg-card shadow-xs" : "bg-muted/45 hover:bg-card",
    foco && "border-primary/50",
  );
  const barra = cat?.cor && (
    <span
      aria-hidden
      className={cn("absolute left-0 w-[3px] rounded-r-full transition-opacity duration-200 group-hover/card:opacity-100", compacto ? "inset-y-2.5" : "inset-y-3.5", aberta ? "opacity-75" : "opacity-35")}
      style={{ background: cat.cor }}
    />
  );
  const titulo = cn(
    "line-clamp-2 leading-snug tracking-tight text-balance [overflow-wrap:anywhere]",
    aberta ? "text-foreground" : "text-muted-foreground",
    t.status === "cancelada" && "line-through decoration-muted-foreground/40",
  );

  if (compacto) {
    return (
      <MenuContextoTarefa tarefa={t}>
        <Link
          href={`/tarefas/${t.id}`}
          draggable={false}
          data-slot="card-tarefa"
          data-compacto
          data-status={t.status}
          data-foco={foco || undefined}
          className={cn(base, "gap-1.5 rounded-lg py-2.5 pr-2.5 pl-3", className)}
        >
          {barra}
          <div className="flex items-center gap-1.5">
            <CatTag cat={cat} className="flex-1 text-[11px]" />
            {foco && <SeloFoco pequeno />}
            <PrioBadge p={t.prioridade} className="size-5 text-[11px]" />
          </div>
          <h3 className={cn(titulo, "text-[13px] font-medium")}>{t.titulo}</h3>
          <div className="flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            {!semStatus && (
              <Dica texto={nomeStatus(t.status)}>
                <span className="inline-flex shrink-0"><IconeStatus status={t.status} /></span>
              </Dica>
            )}
            <PrazoCurto prazo={t.prazo} aberta={aberta} />
            <Contadores t={t} aberta={aberta} curto />
          </div>
          <BotaoMenuTarefa tarefa={t} className={cn(classeMenu, "absolute right-1 bottom-1 size-6 bg-card shadow-xs hover:bg-accent")} />
        </Link>
      </MenuContextoTarefa>
    );
  }

  return (
    <MenuContextoTarefa tarefa={t}>
      <Link
        href={`/tarefas/${t.id}`}
        draggable={false}
        data-slot="card-tarefa"
        data-status={t.status}
        data-foco={foco || undefined}
        className={cn(base, "h-full rounded-xl pt-3 pr-3 pb-0.5 pl-4", className)}
      >
        {barra}
        <div className="flex items-center gap-2">
          <CatTag cat={cat} className="flex-1" />
          {foco && <SeloFoco />}
          <PrioBadge p={t.prioridade} />
        </div>

        <h3 className={cn(titulo, "mt-1.5 text-sm font-semibold")}>{t.titulo}</h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusBadge status={t.status} />
          <PrazoTag prazo={t.prazo} concluida={!aberta} />
        </div>

        {ult && (
          <div data-slot="ultimo-registro" className="mt-3 flex items-start gap-2 text-xs leading-snug text-muted-foreground">
            <IconeTipo tipo={ult.tipo} className="mt-px" />
            <p className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
              <span className="font-medium text-foreground/75">
                {tipoInfo(ult.tipo).nome}
                {ult.titulo ? `: ${ult.titulo}` : ""}
              </span>
              <span> · {dataRelativa(ult.data)}</span>
              {ult.resumoIA ? <span> · {ult.resumoIA}</span> : null}
            </p>
          </div>
        )}

        <div className="mt-auto pt-3">
          <div className="flex h-9 items-center gap-x-3 border-t text-xs text-muted-foreground">
            <Contadores t={t} aberta={aberta} />
            <BotaoMenuTarefa tarefa={t} className={cn(classeMenu, "-mr-1 ml-auto")} />
          </div>
        </div>
      </Link>
    </MenuContextoTarefa>
  );
}
