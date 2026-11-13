"use client";

// Lista de passos em aberto, marcáveis. Os concluídos nesta visita continuam na lista
// (riscados) para dar tempo de desfazer.

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNexo } from "@/components/Provider";
import { IconeStatus, ItemPasso, PrazoTag } from "@/components/comum";
import { comPassoAlternado } from "@/lib/acoes";
import { itemRemovivel } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import type { PassoComTarefa } from "@/lib/pessoas";
import { formatarData } from "@/lib/tipos";

const momento = (x: PassoComTarefa) => `${x.registro.data} ${x.registro.hora || "99:99"} ${x.registro.criadoEm}`;

export function ListaPassos({ passos }: { passos: PassoComTarefa[] }) {
  const { atualizarTarefa } = useNexo();
  const [feitosAqui, setFeitosAqui] = useState<Map<string, PassoComTarefa>>(() => new Map());

  const visiveis = useMemo(() => {
    const abertos = new Set(passos.map((x) => x.passo.id));
    const extras = [...feitosAqui.values()].filter((x) => !abertos.has(x.passo.id));
    return [
      ...passos.map((x) => ({ x, feito: false })),
      ...extras.map((x) => ({ x, feito: true })),
    ].sort((a, b) => momento(a.x).localeCompare(momento(b.x)));
  }, [passos, feitosAqui]);

  function alternar(x: PassoComTarefa, feito: boolean) {
    setFeitosAqui((m) => {
      const n = new Map(m);
      if (feito) n.set(x.passo.id, x);
      else n.delete(x.passo.id);
      return n;
    });
    atualizarTarefa(x.tarefa.id, (t) => comPassoAlternado(t, x.registro.id, x.passo.id, feito));
  }

  return (
    <AnimatePresence initial={false}>
      {visiveis.map(({ x, feito }) => (
        <motion.div key={x.passo.id} {...itemRemovivel} className="overflow-hidden">
          <ItemPasso
            texto={x.passo.texto}
            feito={feito}
            aoAlternar={(v) => alternar(x, v)}
            meta={
              <>
                <Link href={`/tarefas/${x.tarefa.id}`}
                  className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  <IconeStatus status={x.tarefa.status} className="size-3" />
                  <span className="truncate">{x.tarefa.titulo}</span>
                </Link>
                <span className="whitespace-nowrap tabular-nums">desde {formatarData(x.registro.data, false)} ({dataRelativa(x.registro.data)})</span>
                {x.passo.prazo && <PrazoTag prazo={x.passo.prazo} concluida={feito} className="text-[11px] [&_svg]:size-3" />}
              </>
            }
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
