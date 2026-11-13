"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, CalendarClock, CalendarDays, CalendarOff, type LucideIcon, Sun, UserRound } from "lucide-react";
import { BotaoMenuTarefa, MenuContextoTarefa } from "@/components/MenuTarefa";
import { AvatarPessoa, CatTag, Contador, PrazoTag, PrioBadge, StatusBadge } from "@/components/comum";
import { suave } from "@/lib/animacoes";
import { Categoria } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { LinhaPendencia } from "./LinhaPendencia";
import type { Agrupamento, Faixa, Grupo, Pendencia } from "./agrupar";

export const FAIXAS: Record<Faixa, { nome: string; detalhe: string; icone: LucideIcon; tom: string }> = {
  atrasados: { nome: "Atrasados", detalhe: "o prazo do passo já passou", icone: AlarmClock, tom: "bg-destructive/12 text-destructive" },
  hoje: { nome: "Hoje", detalhe: "para fechar ainda hoje", icone: Sun, tom: "bg-alerta/16 text-alerta" },
  semana: { nome: "Esta semana", detalhe: "nos próximos 7 dias", icone: CalendarDays, tom: "bg-info/14 text-info" },
  depois: { nome: "Depois", detalhe: "daqui a mais de uma semana", icone: CalendarClock, tom: "bg-muted text-muted-foreground" },
  sem: { nome: "Sem prazo", detalhe: "defina uma data para não cair no esquecimento", icone: CalendarOff, tom: "bg-muted text-muted-foreground" },
};

function CabecalhoSimples({ icone, titulo, detalhe, n }: { icone: ReactNode; titulo: ReactNode; detalhe?: string; n: number }) {
  return (
    <header className="flex min-h-11 items-center gap-2.5 border-b px-3.5 py-2">
      {icone}
      <h2 className="min-w-0 truncate text-[13px] font-semibold tracking-tight">{titulo}</h2>
      <Contador n={n} />
      {detalhe && <span className="ml-auto hidden truncate text-xs text-muted-foreground @lg:inline">{detalhe}</span>}
    </header>
  );
}

function Cabecalho({ grupo, cat }: { grupo: Grupo; cat?: Categoria }) {
  const n = grupo.itens.filter((i) => !i.passo.feito).length;

  if (grupo.tipo === "tarefa" && grupo.tarefa) {
    const t = grupo.tarefa;
    return (
      <MenuContextoTarefa tarefa={t}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b py-2 pr-2 pl-3.5">
          <div className="min-w-[min(100%,16rem)] flex-1">
            <CatTag cat={cat} className="text-[11px]" />
            <h2 className="flex items-center gap-2">
              <Link
                href={`/tarefas/${t.id}`}
                data-slot="tarefa-do-grupo"
                className="min-w-0 rounded-sm text-sm leading-snug font-semibold tracking-tight outline-none transition-colors [overflow-wrap:anywhere] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {t.titulo}
              </Link>
              <Contador n={n} />
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PrazoTag prazo={t.prazo} />
            <StatusBadge status={t.status} />
            <PrioBadge p={t.prioridade} />
            <BotaoMenuTarefa tarefa={t} />
          </div>
        </header>
      </MenuContextoTarefa>
    );
  }

  if (grupo.tipo === "prazo" && grupo.faixa) {
    const f = FAIXAS[grupo.faixa];
    return (
      <CabecalhoSimples
        n={n}
        titulo={f.nome}
        detalhe={f.detalhe}
        icone={<span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md", f.tom)}><f.icone className="size-3.5" /></span>}
      />
    );
  }

  if (!grupo.pessoa)
    return (
      <CabecalhoSimples
        n={n}
        titulo="Meus"
        detalhe="sem responsável ou atribuídos a mim"
        icone={<span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><UserRound className="size-3.5" /></span>}
      />
    );

  return (
    <CabecalhoSimples
      n={n}
      detalhe="dependem desta pessoa"
      icone={<AvatarPessoa nome={grupo.pessoa} />}
      titulo={
        <Link
          href={`/pessoas?p=${encodeURIComponent(grupo.pessoa)}`}
          className="rounded-sm outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {grupo.pessoa}
        </Link>
      }
    />
  );
}

/** Cartão de um grupo de pendências. Some sozinho (com animação) quando o último passo é concluído. */
export function GrupoPendencias({
  grupo, modo, termo, categorias, recentes, aoConcluir, aoMudarPrazo,
}: {
  grupo: Grupo;
  modo: Agrupamento;
  termo: string;
  categorias: Map<string, Categoria>;
  /** Passos recém-marcados que ainda estão na tela. */
  recentes: ReadonlySet<string>;
  aoConcluir: (p: Pendencia) => void;
  aoMudarPrazo: (p: Pendencia, prazo: string | null) => void;
}) {
  const catDe = (p: Pendencia) => (p.tarefa.categoriaId ? categorias.get(p.tarefa.categoriaId) : undefined);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={suave}
      className="overflow-hidden"
    >
      <section
        data-slot="grupo-pendencias"
        data-grupo={grupo.chave}
        className="@container mb-4 rounded-xl border bg-card shadow-xs"
      >
        <Cabecalho grupo={grupo} cat={grupo.tarefa?.categoriaId ? categorias.get(grupo.tarefa.categoriaId) : undefined} />
        <ul className="flex flex-col p-1.5">
          <AnimatePresence initial={false}>
            {grupo.itens.map((p) => (
              <LinhaPendencia
                key={p.passo.id}
                p={p}
                cat={catDe(p)}
                modo={modo}
                termo={termo}
                concluido={p.passo.feito || recentes.has(p.passo.id)}
                aoConcluir={aoConcluir}
                aoMudarPrazo={aoMudarPrazo}
              />
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </motion.div>
  );
}
