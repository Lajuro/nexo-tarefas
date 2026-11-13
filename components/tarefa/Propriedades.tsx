"use client";

// Faixa de propriedades da tarefa: tudo se edita no lugar, sem abrir formulário.

import Link from "next/link";
import { ReactNode } from "react";
import { AlarmClock, CalendarClock, Gauge, Tag } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useAcoesTarefa } from "@/components/MenuTarefa";
import { CatTag, Etiqueta, PrioBadge, SeletorPrioridade, SeletorStatus, nivelPrioridade } from "@/components/comum";
import { SeletorData } from "@/components/ui/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aberta, dataLocal } from "@/lib/lembretes";
import { Categoria, Tarefa, diasAte, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

function Prop({ rotulo, icone, children, slot }: { rotulo: string; icone?: ReactNode; children: ReactNode; slot: string }) {
  return (
    <div data-slot={`prop-${slot}`} className="flex h-7 min-w-0 items-center gap-1">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sem-selecao [&_svg]:size-3.5 [&_svg]:opacity-70">
        {icone}
        {rotulo}
      </span>
      {children}
    </div>
  );
}

/** "3 dias de atraso", "vence hoje", "em 5 dias": só quando o prazo está perto ou estourou. */
function avisoPrazo(prazo: string | null, fechada: boolean): { texto: string; tom: string; gatilho: string } | null {
  const d = diasAte(prazo);
  if (d === null || fechada) return null;
  const perigo = { tom: "text-destructive", gatilho: "text-destructive hover:text-destructive" };
  const alerta = { tom: "text-alerta", gatilho: "text-alerta hover:text-alerta" };
  const calmo = { tom: "text-muted-foreground", gatilho: "text-foreground" };
  if (d < 0) return { texto: -d === 1 ? "1 dia de atraso" : `${-d} dias de atraso`, ...perigo };
  if (d === 0) return { texto: "vence hoje", ...alerta };
  if (d === 1) return { texto: "vence amanhã", ...alerta };
  if (d <= 7) return { texto: `em ${d} dias`, ...(d <= 3 ? alerta : calmo) };
  return null;
}

const NOME_NIVEL = { alta: "alta", media: "média", baixa: "baixa" } as const;

export function Propriedades({ tarefa, cat }: { tarefa: Tarefa; cat?: Categoria }) {
  const { atualizarTarefa } = useNexo();
  const acoes = useAcoesTarefa();
  const ehAberta = aberta(tarefa);
  const aviso = avisoPrazo(tarefa.prazo, !ehAberta);
  const lembrete = tarefa.lembrarEm ?? "";
  const lembreteVencido = !!lembrete && (diasAte(lembrete) ?? 1) <= 0;

  return (
    <div data-slot="propriedades" className="flex w-full flex-wrap items-center gap-x-4 gap-y-1">
      {cat ? (
        <Link href={`/categorias/${cat.id}`}
          className="-mx-1.5 inline-flex h-7 min-w-0 items-center rounded-md px-1.5 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_[data-slot=categoria]]:hover:text-foreground">
          <CatTag cat={cat} />
        </Link>
      ) : (
        <CatTag />
      )}

      <SeletorStatus status={tarefa.status} aoMudar={(s) => acoes.mudarStatus(tarefa, s)} />

      <Prop slot="prioridade" rotulo="Prioridade" icone={<Gauge />}>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Prioridade ${tarefa.prioridade} de 10. Clique para mudar.`}
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-1 outline-none sem-selecao hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent">
              <PrioBadge p={tarefa.prioridade} semDica className="size-[22px]" />
              <span className="text-xs text-muted-foreground">{NOME_NIVEL[nivelPrioridade(tarefa.prioridade)]}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[19rem]">
            <div className="mb-2 flex items-baseline justify-between gap-2 sem-selecao">
              <span className="text-xs font-semibold">Prioridade</span>
              <span className="text-[11px] text-muted-foreground">1 pode esperar · 10 é urgente</span>
            </div>
            <SeletorPrioridade valor={tarefa.prioridade} aoMudar={(p) => p !== tarefa.prioridade && acoes.mudarPrioridade(tarefa, p)} />
          </PopoverContent>
        </Popover>
      </Prop>

      <Prop slot="prazo" rotulo="Prazo" icone={<CalendarClock />}>
        <SeletorData
          compacto
          valor={tarefa.prazo ?? ""}
          aoMudar={(v) => atualizarTarefa(tarefa.id, (t) => ({ ...t, prazo: v || null }))}
          placeholder="Sem prazo"
          aria-label="Prazo da tarefa"
          className={cn("px-1.5 [&>svg]:hidden", tarefa.prazo && (aviso ? aviso.gatilho : "text-foreground"))}
        />
        {aviso && <span data-slot="aviso-prazo" className={cn("text-xs font-medium whitespace-nowrap", aviso.tom)}>{aviso.texto}</span>}
      </Prop>

      {ehAberta && (
        <Prop slot="lembrete" rotulo="Lembrar em" icone={<AlarmClock />}>
          <SeletorData
            compacto
            valor={lembrete}
            aoMudar={(v) => acoes.lembrarEm(tarefa, v || null)}
            placeholder="Sem lembrete"
            aria-label="Data para lembrar de voltar nesta tarefa"
            className={cn("px-1.5 [&>svg]:hidden", lembrete && (lembreteVencido ? "text-alerta hover:text-alerta" : "text-foreground"))}
          />
        </Prop>
      )}

      {tarefa.tags.length > 0 && (
        <div data-slot="prop-tags" className="flex min-w-0 flex-wrap items-center gap-1">
          <Tag aria-hidden className="size-3.5 text-muted-foreground opacity-70" />
          {tarefa.tags.map((t) => <Etiqueta key={t}>{t}</Etiqueta>)}
        </div>
      )}

      <span data-slot="prop-criada" className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        Criada em {formatarData(dataLocal(tarefa.criadaEm))}
        {!ehAberta && tarefa.concluidaEm && ` · ${tarefa.status === "cancelada" ? "cancelada" : "concluída"} em ${formatarData(dataLocal(tarefa.concluidaEm))}`}
      </span>
    </div>
  );
}
