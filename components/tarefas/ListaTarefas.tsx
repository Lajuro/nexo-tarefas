"use client";

// Visão em lista: linhas densas, uma tarefa por linha, cabeçalho de colunas fixo e clicável para ordenar.
// As colunas menos importantes somem quando falta largura (consulta de contêiner, não de janela).

import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, ArrowDown, ArrowUp, ListChecks, Target, Users } from "lucide-react";
import { BotaoMenuTarefa, MenuContextoTarefa } from "@/components/MenuTarefa";
import { AvatarPessoa, CatTag, IconeStatus, PrazoTag, PrioBadge } from "@/components/comum";
import { Dica } from "@/components/ui/popover";
import { ehFocoHoje } from "@/lib/acoes";
import { mola, suave } from "@/lib/animacoes";
import { aberta, dataRelativa, ultimaAtividade } from "@/lib/lembretes";
import { cn } from "@/lib/utils";
import { Categoria, Tarefa, diasAte, formatarData, nomeStatus, ordenarRegistros, passosAbertos } from "@/lib/tipos";
import type { Ordem } from "./filtros";

// Colunas: tarefa | categoria | prioridade | prazo | pendências | pessoas | atividade | menu
const GRADE = cn(
  "grid items-center gap-x-3 px-3",
  "grid-cols-[minmax(0,1fr)_52px_136px_88px_28px]",
  "@3xl:grid-cols-[minmax(0,1fr)_148px_52px_140px_56px_88px_28px]",
  "@5xl:grid-cols-[minmax(0,1fr)_176px_52px_148px_56px_116px_96px_28px]",
);
const SO_MEDIA = "hidden @3xl:flex";
const SO_LARGA = "hidden @5xl:flex";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Cabecalho({
  children, ordem, atual, aoOrdenar, sentido = "desc", className, dica,
}: {
  children: ReactNode; ordem?: Ordem; atual: Ordem; aoOrdenar: (o: Ordem) => void; sentido?: "asc" | "desc"; className?: string; dica?: string;
}) {
  if (!ordem) return <span className={cn("truncate", className)}>{children}</span>;
  const ativo = ordem === atual;
  const Seta = sentido === "asc" ? ArrowUp : ArrowDown;
  return (
    <Dica texto={ativo ? `Ordenado por ${dica}` : `Ordenar por ${dica}`}>
      <button
        type="button"
        aria-pressed={ativo}
        onClick={() => aoOrdenar(ordem)}
        className={cn(
          "-mx-1.5 inline-flex h-6 min-w-0 items-center gap-1 rounded px-1.5 tracking-wide uppercase outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          ativo && "text-foreground",
          className,
        )}
      >
        <span className="truncate">{children}</span>
        <Seta className={cn("size-3 shrink-0 transition-opacity", ativo ? "text-primary opacity-100" : "opacity-0")} />
      </button>
    </Dica>
  );
}

/** Quem já apareceu nos registros da tarefa, do contato mais recente para o mais antigo. */
function pessoasDe(t: Tarefa) {
  const nomes: string[] = [];
  for (const r of ordenarRegistros(t.registros, true))
    for (const p of r.participantes) if (!nomes.some((n) => n.toLowerCase() === p.toLowerCase())) nomes.push(p);
  return nomes;
}

function Linha({ t, cat }: { t: Tarefa; cat?: Categoria | null }) {
  const ab = aberta(t);
  const foco = ab && ehFocoHoje(t);
  const pend = ab ? passosAbertos(t).length : 0;
  const reunioes = t.registros.filter((r) => r.tipo === "reuniao").length;
  const pessoas = pessoasDe(t);
  const lembrar = ab ? t.lembrarEm : null;
  const chegou = lembrar ? (diasAte(lembrar) ?? 1) <= 0 : false;
  const ult = ultimaAtividade(t);
  return (
    <MenuContextoTarefa tarefa={t}>
      <Link
        href={`/tarefas/${t.id}`}
        draggable={false}
        data-slot="linha-tarefa"
        data-status={t.status}
        className={cn(
          GRADE,
          "group/linha h-10 text-[13px] outline-none sem-selecao transition-colors duration-150 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Dica texto={nomeStatus(t.status)}>
            <span className="inline-flex shrink-0"><IconeStatus status={t.status} className="size-4" /></span>
          </Dica>
          <span
            className={cn(
              "truncate font-medium",
              !ab && "font-normal text-muted-foreground",
              t.status === "cancelada" && "line-through decoration-muted-foreground/40",
            )}
          >
            {t.titulo}
          </span>
          {foco && (
            <Dica texto="Foco de hoje">
              <span data-slot="foco-hoje" className="inline-flex size-[18px] shrink-0 items-center justify-center rounded bg-primary text-primary-foreground">
                <Target className="size-3" strokeWidth={2.4} />
              </span>
            </Dica>
          )}
          {lembrar && (
            <Dica texto={chegou ? `Você pediu para voltar nisto ${dataRelativa(lembrar)}` : `Lembrar de voltar ${dataRelativa(lembrar)} (${formatarData(lembrar, false)})`}>
              <span data-slot="lembrete" className={cn("inline-flex shrink-0", chegou ? "text-alerta" : "text-muted-foreground")}>
                <AlarmClock className="size-3.5" />
              </span>
            </Dica>
          )}
        </span>

        <span className={cn(SO_MEDIA, "min-w-0")}><CatTag cat={cat} /></span>

        <span className="flex justify-center"><PrioBadge p={t.prioridade} /></span>

        <span className="flex min-w-0">
          {t.prazo ? <PrazoTag prazo={t.prazo} concluida={!ab} /> : <span className="text-xs text-muted-foreground/55">Sem prazo</span>}
        </span>

        <span className={cn(SO_MEDIA, "items-center")}>
          {pend > 0 ? (
            <Dica texto={plural(pend, "próximo passo em aberto", "próximos passos em aberto")}>
              <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                <ListChecks className="size-3.5 text-muted-foreground" />
                {pend}
              </span>
            </Dica>
          ) : (
            <span className="pl-1 text-xs text-muted-foreground/45">0</span>
          )}
        </span>

        <span className={cn(SO_LARGA, "min-w-0 items-center gap-2")}>
          {pessoas.length > 0 && (
            <Dica texto={pessoas.slice(0, 8).join(", ") + (pessoas.length > 8 ? ` e mais ${pessoas.length - 8}` : "")}>
              <span className="inline-flex items-center">
                {pessoas.slice(0, 3).map((n, i) => (
                  <AvatarPessoa key={n} nome={n} tamanho="sm" className={cn("ring-2 ring-card", i > 0 && "-ml-1.5")} />
                ))}
                {pessoas.length > 3 && <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">+{pessoas.length - 3}</span>}
              </span>
            </Dica>
          )}
          {reunioes > 0 && (
            <Dica texto={plural(reunioes, "reunião registrada", "reuniões registradas")}>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Users className="size-3.5" />
                {reunioes}
              </span>
            </Dica>
          )}
          {pessoas.length === 0 && reunioes === 0 && <span className="text-xs text-muted-foreground/45">Ninguém ainda</span>}
        </span>

        <span className="truncate text-xs text-muted-foreground">{dataRelativa(ult)}</span>

        <BotaoMenuTarefa
          tarefa={t}
          className="opacity-0 transition-opacity duration-150 group-hover/linha:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        />
      </Link>
    </MenuContextoTarefa>
  );
}

export function ListaTarefas({
  tarefas, categorias, ordem, aoOrdenar,
}: {
  tarefas: Tarefa[]; categorias: Map<string, Categoria>; ordem: Ordem; aoOrdenar: (o: Ordem) => void;
}) {
  // Cascata só na primeira vez; depois, linhas que entram por causa de um filtro aparecem na hora.
  const primeira = useRef(true);
  useEffect(() => {
    primeira.current = false;
  }, []);

  return (
    <div className="@container">
      <div data-slot="lista-tarefas" className="relative overflow-clip rounded-xl border bg-card shadow-xs">
        <div className={cn(GRADE, "sticky top-0 z-10 h-8 border-b bg-muted text-[11px] font-medium tracking-wide text-muted-foreground uppercase sem-selecao")}>
          <span className="flex min-w-0 pl-[26px]">
            <Cabecalho ordem="titulo" atual={ordem} aoOrdenar={aoOrdenar} sentido="asc" dica="título (A-Z)">Tarefa</Cabecalho>
          </span>
          <Cabecalho atual={ordem} aoOrdenar={aoOrdenar} className={SO_MEDIA}>Categoria</Cabecalho>
          <span className="flex justify-center">
            <Cabecalho ordem="prioridade" atual={ordem} aoOrdenar={aoOrdenar} dica="prioridade (maior primeiro)">Prio</Cabecalho>
          </span>
          <span className="flex min-w-0">
            <Cabecalho ordem="prazo" atual={ordem} aoOrdenar={aoOrdenar} sentido="asc" dica="prazo (mais próximo primeiro)">Prazo</Cabecalho>
          </span>
          <Cabecalho atual={ordem} aoOrdenar={aoOrdenar} className={SO_MEDIA}>Passos</Cabecalho>
          <Cabecalho atual={ordem} aoOrdenar={aoOrdenar} className={SO_LARGA}>Pessoas</Cabecalho>
          <span className="flex min-w-0">
            <Cabecalho ordem="atividade" atual={ordem} aoOrdenar={aoOrdenar} dica="última atividade (mais recente primeiro)">Atividade</Cabecalho>
          </span>
          <span />
        </div>

        <AnimatePresence mode="popLayout" initial>
          {tarefas.map((t, i) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ ...suave, delay: primeira.current ? Math.min(i, 16) * 0.02 : 0, layout: mola }}
              className="border-b bg-card last:border-b-0"
            >
              <Linha t={t} cat={t.categoriaId ? categorias.get(t.categoriaId) : null} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
