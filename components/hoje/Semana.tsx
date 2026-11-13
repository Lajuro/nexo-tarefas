"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, CircleDashed } from "lucide-react";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { PontoCor, Secao } from "@/components/comum";
import { deISO, somarDias } from "@/components/ui/data";
import { Dica } from "@/components/ui/popover";
import { aberta, passosAbertosDe } from "@/lib/lembretes";
import { Categoria, Passo, Tarefa, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAX_POR_DIA = 4;

interface ItemDoDia {
  chave: string;
  tarefa: Tarefa;
  /** Presente quando o item é um passo com prazo próprio (e não o prazo da tarefa). */
  passo?: Passo;
}

/** Mini agenda: hoje e os próximos 6 dias, com os prazos de tarefas e de passos que caem em cada um. */
export function Semana({ hoje, tarefas, categorias }: { hoje: string; tarefas: Tarefa[]; categorias: Categoria[] }) {
  const dias = useMemo(() => {
    const passos = passosAbertosDe(tarefas);
    return Array.from({ length: 7 }, (_, i) => {
      const data = somarDias(hoje, i);
      const itens: ItemDoDia[] = [
        ...tarefas
          .filter((t) => aberta(t) && t.prazo === data)
          .sort((a, b) => b.prioridade - a.prioridade)
          .map((t) => ({ chave: t.id, tarefa: t })),
        ...passos.filter((x) => x.passo.prazo === data).map((x) => ({ chave: x.passo.id, tarefa: x.tarefa, passo: x.passo })),
      ];
      return { data, itens };
    });
  }, [hoje, tarefas]);

  const total = dias.reduce((n, d) => n + d.itens.length, 0);
  const cor = (t: Tarefa) => categorias.find((c) => c.id === t.categoriaId)?.cor;

  return (
    <Secao
      titulo="Próximos 7 dias"
      icone={<CalendarDays />}
      contagem={total || undefined}
      acoes={
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatarData(hoje, false)} a {formatarData(dias[6].data, false)}
        </span>
      }
    >
      <div data-slot="semana" className="overflow-x-auto rounded-xl border bg-card shadow-xs">
        <div className="grid min-w-[620px] grid-cols-7 divide-x">
          {dias.map(({ data, itens }, i) => {
            const d = deISO(data);
            const ehHoje = i === 0;
            const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
            const mostrados = itens.slice(0, MAX_POR_DIA);
            return (
              <div
                key={data}
                data-slot="semana-dia"
                data-data={data}
                data-hoje={ehHoje || undefined}
                className={cn("flex min-h-[7.5rem] min-w-0 flex-col gap-1 p-1.5", ehHoje && "bg-primary/[0.05] dark:bg-primary/10", !ehHoje && fimDeSemana && "bg-muted/40")}
              >
                <div className="mb-0.5 flex items-center justify-between gap-1 px-1 pt-0.5 sem-selecao">
                  <span className={cn("text-[11px] font-medium tracking-wide uppercase", ehHoje ? "text-primary dark:text-foreground" : "text-muted-foreground")}>
                    {ehHoje ? "Hoje" : DIAS[d.getDay()]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                      ehHoje ? "bg-primary text-primary-foreground" : itens.length ? "text-foreground" : "text-muted-foreground/70",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
                {mostrados.map((it) => (
                  <ItemSemana key={it.chave} item={it} cor={cor(it.tarefa)} />
                ))}
                {itens.length > mostrados.length && (
                  <span className="px-1.5 text-[11px] text-muted-foreground">mais {itens.length - mostrados.length}</span>
                )}
                {itens.length === 0 && <span aria-hidden className="mx-1.5 mt-1.5 h-px w-3 rounded-full bg-border" />}
              </div>
            );
          })}
        </div>
      </div>
    </Secao>
  );
}

function ItemSemana({ item: { tarefa, passo }, cor }: { item: ItemDoDia; cor?: string }) {
  return (
    <MenuContextoTarefa tarefa={tarefa}>
      <span className="block min-w-0">
        <Dica
          side="top"
          texto={
            passo ? (
              <span className="flex flex-col gap-0.5 py-0.5">
                <span>Passo: {passo.texto}</span>
                <span className="font-normal opacity-70">{tarefa.titulo}</span>
              </span>
            ) : (
              <span className="flex flex-col gap-0.5 py-0.5">
                <span>Prazo da tarefa</span>
                <span className="font-normal opacity-70">{tarefa.titulo}</span>
              </span>
            )
          }
        >
          <Link
            href={`/tarefas/${tarefa.id}`}
            data-slot="semana-item"
            data-tipo={passo ? "passo" : "tarefa"}
            className={cn(
              "flex items-start gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-snug transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35",
              passo ? "text-muted-foreground hover:text-foreground" : "bg-background font-medium ring-1 ring-border ring-inset dark:bg-muted/60",
            )}
          >
            {passo ? <CircleDashed className="mt-[2px] size-3 shrink-0" /> : <PontoCor cor={cor} className="mt-[5px] size-1.5" />}
            <span className="line-clamp-3 min-w-0 break-words">{passo ? passo.texto : tarefa.titulo}</span>
          </Link>
        </Dica>
      </span>
    </MenuContextoTarefa>
  );
}
