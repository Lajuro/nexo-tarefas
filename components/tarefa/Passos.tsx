"use client";

import { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { ItemPasso } from "@/components/comum";
import { SeletorData } from "@/components/ui/data";
import { comPassoAlternado, comPrazoDoPasso } from "@/lib/acoes";
import { dataLocal } from "@/lib/lembretes";
import { Passo, Registro, diasAte, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Um próximo passo da tarefa, marcável, com responsável e prazo próprio editável no lugar.
 * Usado no card do registro (timeline) e na lista de pendências da lateral.
 */
export function PassoDaTarefa({
  tarefaId, registro, passo, extra, className,
}: {
  tarefaId: string; registro: Registro; passo: Passo;
  /** Algo a mais na linha de detalhes (ex.: "desde 09/11" na lista de pendências). */
  extra?: ReactNode;
  className?: string;
}) {
  const { atualizarTarefa } = useNexo();
  const d = passo.feito ? null : diasAte(passo.prazo);
  const tomPrazo = d === null ? "" : d < 0 ? "text-destructive hover:text-destructive" : d <= 1 ? "text-alerta hover:text-alerta" : "text-foreground/80";

  return (
    <ItemPasso
      className={className}
      texto={passo.texto}
      feito={passo.feito}
      aoAlternar={(feito) => atualizarTarefa(tarefaId, (t) => comPassoAlternado(t, registro.id, passo.id, feito))}
      meta={
        <>
          {passo.responsavel && (
            <span data-slot="passo-responsavel" className="inline-flex items-center gap-1">
              <UserRound className="size-3 opacity-70" />
              {passo.responsavel}
            </span>
          )}
          {extra}
          {(!passo.feito || passo.prazo) && (
            <SeletorData
              compacto
              valor={passo.prazo ?? ""}
              aoMudar={(v) => atualizarTarefa(tarefaId, (t) => comPrazoDoPasso(t, registro.id, passo.id, v || null))}
              placeholder="Prazo"
              aria-label={passo.prazo ? `Prazo do passo: ${formatarData(passo.prazo)}. Clique para mudar.` : "Definir prazo do passo"}
              className={cn("-mx-1 h-5 gap-1 px-1 text-[11px] [&_svg]:size-3", passo.prazo ? tomPrazo : "text-muted-foreground/70")}
            />
          )}
          {d !== null && d < 0 && <span className="text-destructive">{-d === 1 ? "1 dia de atraso" : `${-d} dias de atraso`}</span>}
          {passo.feito && passo.feitoEm && <span>feito em {formatarData(dataLocal(passo.feitoEm), false)}</span>}
        </>
      }
    />
  );
}
