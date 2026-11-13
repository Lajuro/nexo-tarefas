"use client";

// Linha do tempo da tarefa: uma linha vertical contínua com um nó por registro.
// Registros comuns viram cards; marcos (tarefa criada, mudança de status) ficam numa linha só,
// e o marco de "concluída" é o card verde que fecha a linha, como no esboço do dono.

import Link from "next/link";
import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, Gavel, ListChecks, NotebookPen, OctagonAlert, Pencil, Plus, Trash2 } from "lucide-react";
import { ChipPessoa, IconeTipo, STATUS_VISUAL, StatusBadge, TipoBadge } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista, suave } from "@/lib/animacoes";
import { dataLocal, dataRelativa } from "@/lib/lembretes";
import { Registro, STATUS, Status, TIPOS_REGISTRO, Tarefa, TipoRegistro, diasAte, formatarData, hojeISO, nomeStatus, tipoInfo } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { PassoDaTarefa } from "./Passos";
import { TextoRico } from "./Texto";

const ehStatus = (s: unknown): s is Status => STATUS.some((x) => x.id === s);
const nomeDe = (s: unknown) => (ehStatus(s) ? nomeStatus(s) : "");

/** O marco de conclusão: é ele que vira o card verde do fim da linha. */
export const ehConclusao = (r: Registro) => r.tipo === "marco" && r.alteracoes?.status?.para === "concluida";

// ---------- peças ----------

function Rotulo({ icone, children, className }: { icone?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao [&_svg]:size-3.5", className)}>
      {icone}
      {children}
    </div>
  );
}

function AcoesRegistro({ aoEditar, aoRemover, className }: { aoEditar: () => void; aoRemover: () => void; className?: string }) {
  return (
    <div
      data-slot="registro-acoes"
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within/reg:opacity-100 group-hover/reg:opacity-100",
        className,
      )}
    >
      <Dica texto="Editar registro">
        <Button variant="ghost" size="icon-sm" aria-label="Editar registro" onClick={aoEditar}><Pencil /></Button>
      </Dica>
      <Dica texto="Remover da linha do tempo">
        <Button variant="ghost" size="icon-sm" aria-label="Remover registro" onClick={aoRemover}
          className="hover:bg-destructive/10 hover:text-destructive">
          <Trash2 />
        </Button>
      </Dica>
    </div>
  );
}

/** Linha "de → para" das alterações que o registro fez na tarefa. */
function Alteracoes({ r }: { r: Registro }) {
  const a = r.alteracoes;
  if (!a || (!a.status && !a.prioridade && !a.prazo)) return null;
  const seta = <span aria-hidden className="text-muted-foreground/70">→</span>;
  return (
    <div data-slot="registro-alteracoes" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 pt-2.5 text-xs text-muted-foreground">
      <span className="text-[11px] font-semibold tracking-wide uppercase sem-selecao">Mudou na tarefa</span>
      {a.status && (
        <span className="inline-flex items-center gap-1.5">
          Status: {ehStatus(a.status.de) ? <StatusBadge status={a.status.de} /> : "sem"} {seta}{" "}
          {ehStatus(a.status.para) ? <StatusBadge status={a.status.para} /> : String(a.status.para)}
        </span>
      )}
      {a.prioridade && (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          Prioridade: {a.prioridade.de} {seta} <strong className="font-semibold text-foreground">{a.prioridade.para}</strong>
        </span>
      )}
      {a.prazo && (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          Prazo: {formatarData(a.prazo.de) || "sem"} {seta} <strong className="font-semibold text-foreground">{formatarData(a.prazo.para) || "sem"}</strong>
        </span>
      )}
    </div>
  );
}

function CardRegistro({
  tarefa, r, destacado, aoEditar, aoRemover,
}: {
  tarefa: Tarefa; r: Registro; destacado: boolean; aoEditar: () => void; aoRemover: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = !!((r.resumoIA && r.anotacoes) || r.respostaIABruta);
  const feitos = r.proximosPassos.filter((p) => p.feito).length;

  return (
    <article
      id={`reg-${r.id}`}
      data-slot="registro"
      data-tipo={r.tipo}
      data-destacado={destacado || undefined}
      className={cn(
        "group/reg scroll-mt-16 rounded-xl border bg-card pb-3.5 shadow-xs transition-[border-color,box-shadow] duration-200 hover:border-ring/30 hover:shadow-sm",
        r.tipo === "impedimento" && "border-destructive/30 hover:border-destructive/45",
        destacado && "border-primary/60 ring-[3px] ring-primary/20",
      )}
    >
      <header className="flex items-start gap-2 px-4 pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <TipoBadge tipo={r.tipo} />
          {r.titulo && <h3 className="min-w-0 text-sm leading-snug font-semibold tracking-tight [overflow-wrap:anywhere]">{r.titulo}</h3>}
        </div>
        <AcoesRegistro aoEditar={aoEditar} aoRemover={aoRemover} className="-mt-1 -mr-2" />
      </header>

      {r.participantes.length > 0 && (
        <div data-slot="registro-pessoas" className="mt-2 flex flex-wrap gap-1.5 px-4">
          {r.participantes.map((p) => (
            <ChipPessoa key={p} nome={p} href={`/pessoas?p=${encodeURIComponent(p)}`} />
          ))}
        </div>
      )}

      {r.resumoIA ? (
        <TextoRico texto={r.resumoIA} className="mt-2.5 px-4 text-sm" />
      ) : r.anotacoes ? (
        <p className="mt-2.5 px-4 text-sm leading-relaxed texto-pre">{r.anotacoes}</p>
      ) : null}

      {r.decisoes && (
        <div data-slot="registro-decisoes" className="mt-3.5 px-4">
          <Rotulo icone={<Gavel className="text-sucesso" />}>Decisões</Rotulo>
          <TextoRico texto={r.decisoes} className="text-[13px]" />
        </div>
      )}

      {r.proximosPassos.length > 0 && (
        <div data-slot="registro-passos" className="mt-3.5 px-4">
          <Rotulo icone={<ListChecks className="text-primary" />}>
            Próximos passos
            <span className="ml-auto font-medium tracking-normal normal-case tabular-nums">
              {feitos === r.proximosPassos.length ? "todos feitos" : `${feitos} de ${r.proximosPassos.length} feitos`}
            </span>
          </Rotulo>
          <div className="flex flex-col">
            {r.proximosPassos.map((p) => (
              <PassoDaTarefa key={p.id} tarefaId={tarefa.id} registro={r} passo={p} />
            ))}
          </div>
        </div>
      )}

      {r.impedimentos && (
        <div data-slot="registro-impedimentos" className="mx-4 mt-3.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2.5 dark:bg-destructive/10">
          <Rotulo icone={<OctagonAlert />} className="text-destructive">Impedimentos</Rotulo>
          <TextoRico texto={r.impedimentos} className="text-[13px]" />
        </div>
      )}

      <Alteracoes r={r} />

      {r.notaId && (
        <div className="mt-2.5 px-4">
          <Link href={`/notas?n=${encodeURIComponent(r.notaId)}`} data-slot="registro-folha"
            className="-ml-1.5 inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-muted-foreground outline-none sem-selecao hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
            <NotebookPen className="size-3.5" /> Veio do bloco de notas: abrir a folha original
          </Link>
        </div>
      )}

      {temDetalhe && (
        <Collapsible open={aberto} onOpenChange={setAberto} className="mt-2.5 px-4">
          <CollapsibleTrigger asChild>
            <button type="button"
              className="group/mais -ml-1.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground outline-none sem-selecao hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
              <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/mais:rotate-90" />
              {aberto ? "Esconder anotações originais" : "Ver anotações originais"}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-3 pt-2">
              {r.resumoIA && r.anotacoes && (
                <div>
                  <Rotulo>Anotações brutas</Rotulo>
                  <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground texto-pre">{r.anotacoes}</div>
                </div>
              )}
              {r.respostaIABruta && (
                <div>
                  <Rotulo>Resposta completa da IA</Rotulo>
                  <div className="max-h-80 overflow-y-auto rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground texto-pre">{r.respostaIABruta}</div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </article>
  );
}

/** Marco compacto: uma linha, com a troca de status quando houver. */
function LinhaMarco({ r, destacado, aoEditar, aoRemover }: { r: Registro; destacado: boolean; aoEditar: () => void; aoRemover: () => void }) {
  const de = nomeDe(r.alteracoes?.status?.de);
  const para = nomeDe(r.alteracoes?.status?.para);
  return (
    <div
      id={`reg-${r.id}`}
      data-slot="registro"
      data-tipo="marco"
      data-destacado={destacado || undefined}
      className={cn(
        "group/reg -mx-2 scroll-mt-16 rounded-lg px-2 transition-[background-color,box-shadow] duration-200 hover:bg-accent/50",
        destacado && "bg-primary/[0.07] ring-1 ring-primary/30",
      )}
    >
      <div className="flex min-h-7 items-center gap-x-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5">
          <span className="text-[13px] font-medium">{r.titulo || "Marco"}</span>
          {de && para && (
            <span data-slot="marco-troca" className="text-xs text-muted-foreground">{de} → {para}</span>
          )}
        </div>
        <AcoesRegistro aoEditar={aoEditar} aoRemover={aoRemover} className="-mr-1" />
      </div>
      {r.anotacoes && <p className="line-clamp-2 pb-1.5 text-xs leading-relaxed text-muted-foreground texto-pre">{r.anotacoes}</p>}
    </div>
  );
}

/** O card verde "Concluída" que fecha a linha do tempo. */
function CardConclusao({
  tarefa, r, destacado, aoEditar, aoRemover,
}: {
  tarefa: Tarefa; r: Registro; destacado: boolean; aoEditar: () => void; aoRemover: () => void;
}) {
  const de = nomeDe(r.alteracoes?.status?.de);
  const dias = Math.max(0, -(diasAte(dataLocal(tarefa.criadaEm)) ?? 0) + (diasAte(r.data) ?? 0));
  return (
    <div
      id={`reg-${r.id}`}
      data-slot="registro"
      data-tipo="marco"
      data-fim="true"
      data-destacado={destacado || undefined}
      className={cn(
        "group/reg scroll-mt-16 rounded-xl border border-sucesso/35 bg-sucesso/[0.08] px-4 py-3 shadow-xs transition-shadow duration-200 dark:bg-sucesso/[0.1]",
        destacado && "ring-[3px] ring-sucesso/25",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-snug font-semibold tracking-tight text-sucesso">Concluída</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {de && <span data-slot="marco-troca">{de} → Concluída</span>}
            {de && " · "}
            {dias === 0 ? "resolvida no mesmo dia em que foi criada" : dias === 1 ? "1 dia do início ao fim" : `${dias} dias do início ao fim`}
          </p>
        </div>
        <AcoesRegistro aoEditar={aoEditar} aoRemover={aoRemover} className="-mt-1 -mr-2" />
      </div>
      {r.anotacoes && <p className="mt-2 text-[13px] leading-relaxed texto-pre">{r.anotacoes}</p>}
    </div>
  );
}

// ---------- nós da linha ----------

function No({ r }: { r: Registro }) {
  if (ehConclusao(r)) {
    return (
      <motion.span
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 20 }}
        className="inline-flex size-7 items-center justify-center rounded-full bg-sucesso text-background shadow-sm ring-4 ring-sucesso/20"
      >
        <Check className="size-4" strokeWidth={3} />
      </motion.span>
    );
  }
  const para = r.tipo === "marco" ? r.alteracoes?.status?.para : null;
  if (ehStatus(para) && r.alteracoes?.status?.de) {
    const v = STATUS_VISUAL[para];
    return (
      <span className={cn("inline-flex size-7 items-center justify-center rounded-full", v.fundo, v.texto)}>
        <v.icone className="size-3.5" />
      </span>
    );
  }
  return <IconeTipo tipo={r.tipo} comFundo />;
}

/** Uma entrada da linha: data à esquerda, nó em cima da linha, conteúdo à direita. */
function Entrada({
  data, hora, repeteData, discreta, primeiro, ultimo, no, children, espaco = "pb-4",
}: {
  data?: string; hora?: string; repeteData?: boolean; discreta?: boolean; primeiro: boolean; ultimo: boolean;
  no: ReactNode; children: ReactNode; espaco?: string;
}) {
  const hoje = data === hojeISO();
  return (
    <div className="grid grid-cols-[4.25rem_1.75rem_minmax(0,1fr)] gap-x-3">
      <div data-slot="registro-data" className="pt-1 text-right">
        {data && (
          <>
            <time dateTime={data}
              className={cn(
                "block text-[13px] leading-5 tabular-nums",
                discreta ? "font-medium text-muted-foreground" : "font-semibold",
                hoje && "text-primary",
                repeteData && "sr-only",
              )}>
              {formatarData(data)}
            </time>
            {hora && <span className={cn("block text-xs leading-4 text-muted-foreground tabular-nums", repeteData && "pt-0.5")}>{hora}</span>}
            {!repeteData && !discreta && <span className="block text-[11px] leading-4 text-muted-foreground/80">{dataRelativa(data)}</span>}
          </>
        )}
      </div>
      <div className="relative flex justify-center">
        {!(primeiro && ultimo) && (
          <span aria-hidden className={cn("absolute left-1/2 w-px -translate-x-1/2 bg-border", primeiro ? "top-3.5 bottom-0" : ultimo ? "top-0 h-3.5" : "inset-y-0")} />
        )}
        <span className="relative z-[1] flex size-7 items-center justify-center rounded-full bg-background">{no}</span>
      </div>
      <div className={cn("min-w-0", !ultimo && espaco)}>{children}</div>
    </div>
  );
}

/** Menu com os tipos de registro (usado no nó "registrar agora" e no botão de outros tipos). */
export function ItensNovoRegistro({ tipos, aoEscolher }: { tipos: TipoRegistro[]; aoEscolher: (t: TipoRegistro) => void }) {
  return (
    <>
      {tipos.map((t) => (
        <DropdownMenuItem key={t} onSelect={() => aoEscolher(t)}>
          <IconeTipo tipo={t} /> {tipoInfo(t).nome}
        </DropdownMenuItem>
      ))}
    </>
  );
}

const TIPOS_NOVOS = TIPOS_REGISTRO.map((t) => t.id).filter((t) => t !== "marco");

// ---------- a linha ----------

export function Timeline({
  tarefa, registros, recentes, destaque, comNovo, aoRegistrar, aoEditar, aoRemover,
}: {
  tarefa: Tarefa;
  /** Já ordenados e filtrados. */
  registros: Registro[];
  recentes: boolean;
  /** Id do registro a destacar por um instante (recém-criado ou vindo da lista de pendências). */
  destaque: string | null;
  /** Mostra o nó "Registrar agora" na ponta mais recente da linha. */
  comNovo: boolean;
  aoRegistrar: (tipo: TipoRegistro) => void;
  aoEditar: (r: Registro) => void;
  aoRemover: (r: Registro) => void;
}) {
  const total = registros.length + (comNovo ? 1 : 0);
  const novo = comNovo && (
    <motion.div key="novo" variants={itemLista} data-slot="registrar-agora">
      <Entrada
        primeiro={recentes}
        ultimo={!recentes}
        no={
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/45 text-muted-foreground">
            <Plus className="size-3.5" />
          </span>
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 h-7">Registrar o que aconteceu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Novo registro</DropdownMenuLabel>
            <ItensNovoRegistro tipos={TIPOS_NOVOS} aoEscolher={aoRegistrar} />
          </DropdownMenuContent>
        </DropdownMenu>
      </Entrada>
    </motion.div>
  );

  return (
    <motion.div data-slot="timeline" variants={lista} initial="escondido" animate="visivel">
      {recentes && novo}
      <AnimatePresence>
        {registros.map((r, i) => {
          const pos = i + (recentes && comNovo ? 1 : 0);
          const fim = ehConclusao(r);
          const marco = r.tipo === "marco";
          const props = { destacado: destaque === r.id, aoEditar: () => aoEditar(r), aoRemover: () => aoRemover(r) };
          return (
            <motion.div
              key={r.id}
              variants={itemLista}
              exit={{ opacity: 0, height: 0, overflow: "hidden", transition: suave }}
            >
              <Entrada
                data={r.data}
                hora={r.hora}
                repeteData={i > 0 && registros[i - 1].data === r.data}
                discreta={marco && !fim}
                primeiro={pos === 0}
                ultimo={pos === total - 1}
                no={<No r={r} />}
                espaco={marco && !fim ? "pb-2.5" : "pb-4"}
              >
                {fim ? <CardConclusao tarefa={tarefa} r={r} {...props} /> : marco ? <LinhaMarco r={r} {...props} /> : <CardRegistro tarefa={tarefa} r={r} {...props} />}
              </Entrada>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {!recentes && novo}
    </motion.div>
  );
}
