"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { CalendarClock, TrendingUp } from "lucide-react";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { NumeroAnimado, Painel, PontoCor, PrazoTag } from "@/components/comum";
import { dataPorExtenso, deISO, somarDias } from "@/components/ui/data";
import { Dica } from "@/components/ui/popover";
import { suave } from "@/lib/animacoes";
import { aberta, dataLocal } from "@/lib/lembretes";
import { Categoria, Tarefa, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const INICIAIS_DOS_DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const passos = (n: number) => `${n} ${n === 1 ? "passo concluído" : "passos concluídos"}`;

/**
 * Quantos passos foram concluídos hoje e nos últimos 7 dias (pela data de `feitoEm`),
 * com uma barrinha por dia. Conta todas as tarefas, inclusive as já encerradas.
 */
export function PainelProgresso({ tarefas, emAberto }: { tarefas: Tarefa[]; emAberto: number }) {
  const hoje = hojeISO();
  const serie = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i - 6));
    const porDia = new Map(dias.map((d) => [d, 0]));
    for (const t of tarefas)
      for (const r of t.registros)
        for (const p of r.proximosPassos) {
          if (!p.feito || !p.feitoEm) continue;
          const d = dataLocal(p.feitoEm);
          if (porDia.has(d)) porDia.set(d, porDia.get(d)! + 1);
        }
    return dias.map((d) => ({ dia: d, n: porDia.get(d)! }));
  }, [tarefas, hoje]);

  const feitosHoje = serie[serie.length - 1].n;
  const feitosSemana = serie.reduce((s, d) => s + d.n, 0);
  const maior = Math.max(1, ...serie.map((d) => d.n));
  const frase =
    emAberto === 0 ? "Nada em aberto. Tudo em dia."
    : feitosHoje > 0 ? `Bom ritmo. ${emAberto === 1 ? "Falta 1 passo" : `Faltam ${emAberto} passos`} em aberto.`
    : "Nenhum passo concluído hoje ainda. Comece pelo mais rápido.";

  return (
    <Painel titulo="Progresso" icone={<TrendingUp />}>
      <div data-slot="progresso-passos" data-hoje={feitosHoje} data-semana={feitosSemana}>
        <div className="grid grid-cols-2 divide-x">
          <div className="pr-3">
            <NumeroAnimado valor={feitosHoje} className={cn("block text-2xl leading-none font-semibold tracking-tight", feitosHoje ? "text-sucesso" : "text-muted-foreground/60")} />
            <span className="mt-1.5 block text-xs text-muted-foreground">{feitosHoje === 1 ? "concluído hoje" : "concluídos hoje"}</span>
          </div>
          <div className="pl-3.5">
            <NumeroAnimado valor={feitosSemana} className={cn("block text-2xl leading-none font-semibold tracking-tight", !feitosSemana && "text-muted-foreground/60")} />
            <span className="mt-1.5 block text-xs text-muted-foreground">na semana</span>
          </div>
        </div>

        <div
          role="img"
          aria-label={`Passos concluídos por dia nos últimos 7 dias: ${serie.map((d) => `${dataPorExtenso(d.dia)}, ${d.n}`).join("; ")}.`}
          className="mt-3 flex h-14 items-stretch gap-[2px]"
        >
          {serie.map((d) => {
            const eHoje = d.dia === hoje;
            return (
              <Dica key={d.dia} texto={`${eHoje ? "Hoje" : dataPorExtenso(d.dia)}: ${d.n ? passos(d.n) : "nenhum passo concluído"}`}>
                <div className="group/dia flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-md pt-1 transition-colors hover:bg-accent/60">
                  <div className="flex w-full flex-1 items-end justify-center">
                    {d.n > 0 ? (
                      <motion.span
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(12, (d.n / maior) * 100)}%` }}
                        transition={suave}
                        className={cn("w-3.5 rounded-t-[4px] rounded-b-[1px] transition-colors", eHoje ? "bg-primary" : "bg-primary/35 group-hover/dia:bg-primary/55")}
                      />
                    ) : (
                      <span className="h-0.5 w-3.5 rounded-full bg-muted-foreground/25" />
                    )}
                  </div>
                  <span className={cn("pb-0.5 text-[10px] leading-none sem-selecao", eHoje ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {INICIAIS_DOS_DIAS[deISO(d.dia).getDay()]}
                  </span>
                </div>
              </Dica>
            );
          })}
        </div>
      </div>
      <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">{frase}</p>
    </Painel>
  );
}

/** Tarefas abertas que têm prazo, da mais urgente para a mais distante. */
export function PainelPrazos({ tarefas, categorias }: { tarefas: Tarefa[]; categorias: Map<string, Categoria> }) {
  const comPrazo = useMemo(
    () => tarefas.filter((t) => aberta(t) && t.prazo).sort((a, b) => a.prazo!.localeCompare(b.prazo!) || b.prioridade - a.prioridade),
    [tarefas],
  );
  return (
    <Painel titulo="Prazos das tarefas" icone={<CalendarClock />} contagem={comPrazo.length || undefined} corpoClassName="p-1.5">
      {comPrazo.length === 0 ? (
        <p className="px-2 py-2.5 text-[13px] text-muted-foreground">Nenhuma tarefa aberta com prazo.</p>
      ) : (
        <ul data-slot="prazos-das-tarefas" className="flex max-h-[22rem] flex-col overflow-y-auto">
          {comPrazo.map((t) => (
            <li key={t.id}>
              <MenuContextoTarefa tarefa={t}>
                <Link
                  href={`/tarefas/${t.id}`}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-inset"
                >
                  <PontoCor cor={t.categoriaId ? categorias.get(t.categoriaId)?.cor : null} className="mt-[6px]" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] leading-snug font-medium">{t.titulo}</span>
                    <PrazoTag prazo={t.prazo} className="mt-0.5 text-[11px] [&_svg]:size-3" />
                  </span>
                </Link>
              </MenuContextoTarefa>
            </li>
          ))}
        </ul>
      )}
    </Painel>
  );
}
