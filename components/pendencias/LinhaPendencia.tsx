"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Hourglass } from "lucide-react";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { AvatarPessoa, Destaque, IconeTipo, ItemPasso, PontoCor } from "@/components/comum";
import { SeletorData } from "@/components/ui/data";
import { Dica } from "@/components/ui/popover";
import { itemRemovivel } from "@/lib/animacoes";
import { LIMITES, dataRelativa } from "@/lib/lembretes";
import { Categoria, diasAte, formatarData, tipoInfo } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import type { Agrupamento, Pendencia } from "./agrupar";

/**
 * Uma pendência na lista: caixa para concluir, texto, de onde veio e o prazo próprio do passo.
 * `concluido` fica true por um instante depois do clique, para o visto aparecer antes de a linha sair.
 */
export function LinhaPendencia({
  p, cat, modo, termo, concluido, aoConcluir, aoMudarPrazo,
}: {
  p: Pendencia;
  cat?: Categoria;
  modo: Agrupamento;
  termo: string;
  concluido: boolean;
  aoConcluir: (p: Pendencia) => void;
  aoMudarPrazo: (p: Pendencia, prazo: string | null) => void;
}) {
  const { tarefa, registro, passo } = p;
  const responsavel = (passo.responsavel ?? "").trim();
  const d = passo.prazo ? diasAte(passo.prazo) : null;
  const tomPrazo =
    d === null ? "text-muted-foreground/70"
    : d < 0 ? "text-destructive hover:text-destructive"
    : d === 0 ? "text-alerta hover:text-alerta"
    : "text-foreground/80";
  const origem = `${tipoInfo(registro.tipo).nome} de ${formatarData(registro.data, false)}`;

  return (
    <motion.li {...itemRemovivel} data-slot="pendencia" data-passo={passo.id} data-antigo={p.antigo || undefined} className="overflow-hidden">
      <div className="group/linha flex items-start gap-2 rounded-lg px-2.5 py-1.5 transition-colors duration-150 hover:bg-accent/50 has-[[data-state=open]]:bg-accent/50">
        <ItemPasso
          className="min-w-0 flex-1 py-0.5"
          texto={<Destaque texto={passo.texto} termo={termo} />}
          feito={concluido}
          aoAlternar={(feito) => feito && aoConcluir(p)}
          meta={
            <>
              {modo !== "tarefa" && (
                <MenuContextoTarefa tarefa={tarefa}>
                  <Link
                    href={`/tarefas/${tarefa.id}`}
                    data-slot="tarefa-da-pendencia"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-sm font-medium text-foreground/75 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <PontoCor cor={cat?.cor} className="size-1.5" />
                    <span className="truncate">{tarefa.titulo}</span>
                  </Link>
                </MenuContextoTarefa>
              )}
              {modo !== "pessoa" && responsavel && (
                <span className="inline-flex items-center gap-1">
                  <AvatarPessoa nome={responsavel} tamanho="sm" className="size-3.5 text-[7px]" />
                  {responsavel}
                </span>
              )}
              <span className="inline-flex min-w-0 items-center gap-1">
                <IconeTipo tipo={registro.tipo} className="size-3 opacity-80" />
                <span className="truncate">
                  {origem}
                  {modo === "tarefa" && registro.titulo ? `: ${registro.titulo}` : ""}
                </span>
              </span>
              {p.antigo ? (
                <Dica texto={`Em aberto há mais de ${LIMITES.passoAntigo} dias. Conclua, delegue ou descarte.`}>
                  <span data-slot="passo-antigo" className="inline-flex items-center gap-1 rounded-sm bg-alerta/12 px-1 font-medium text-alerta">
                    <Hourglass className="size-2.5" />
                    aberto {dataRelativa(registro.data)}
                  </span>
                </Dica>
              ) : (
                <span>aberto {dataRelativa(registro.data)}</span>
              )}
            </>
          }
        />
        <SeletorData
          compacto
          valor={passo.prazo ?? ""}
          aoMudar={(v) => aoMudarPrazo(p, v || null)}
          placeholder="Prazo"
          disabled={concluido}
          aria-label={passo.prazo ? `Prazo do passo: ${formatarData(passo.prazo)}. Clique para mudar.` : "Definir prazo do passo"}
          className={cn(
            "shrink-0 tabular-nums transition-[opacity,background-color,color] duration-150",
            tomPrazo,
            !passo.prazo && "opacity-45 group-hover/linha:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
          )}
        />
      </div>
    </motion.li>
  );
}
