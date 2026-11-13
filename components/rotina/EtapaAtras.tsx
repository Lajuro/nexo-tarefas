"use client";

// Etapa 1 do ritual: o que ficou para trás. Agrupa por tarefa o prazo vencido, o follow-up que chegou
// e os passos atrasados, com a decisão de cada um ao alcance de um clique.

import { ReactNode } from "react";
import { motion } from "motion/react";
import { AlarmClock, ArrowUpRight, CalendarX2, Check, PartyPopper } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa, useAcoesTarefa } from "@/components/MenuTarefa";
import { CatTag, PrioBadge, SeletorStatus } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controles";
import { SeletorData, dataPorExtenso } from "@/components/ui/data";
import { Progress } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { comLembrete, comPassoAlternado, comPrazoDoPasso } from "@/lib/acoes";
import { itemLista, lista } from "@/lib/animacoes";
import { aberta, dataRelativa, passoEhMeu } from "@/lib/lembretes";
import { Categoria, Passo, Tarefa, formatarData, nomeStatus } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CabecalhoEtapa } from "./pecas";

/** O que estava atrasado em uma tarefa no momento em que o ritual abriu. */
export interface PendenciasDaTarefa {
  tarefaId: string;
  /** Prazo da tarefa, se já tinha vencido. */
  prazoEra: string | null;
  /** Follow-up (lembrarEm), se já tinha chegado. */
  lembrarEra: string | null;
  /** Passos com prazo próprio vencido. */
  passos: { registroId: string; passoId: string; prazoEra: string }[];
}

export function coletarPendencias(tarefas: Tarefa[], hoje: string): PendenciasDaTarefa[] {
  return tarefas
    .filter(aberta)
    .sort((a, b) => b.prioridade - a.prioridade || (a.prazo ?? "9").localeCompare(b.prazo ?? "9"))
    .map((t) => ({
      tarefaId: t.id,
      prazoEra: t.prazo && t.prazo < hoje ? t.prazo : null,
      lembrarEra: t.lembrarEm && t.lembrarEm <= hoje ? t.lembrarEm : null,
      passos: t.registros.flatMap((r) =>
        r.proximosPassos
          .filter((p) => !p.feito && p.prazo && p.prazo < hoje)
          .map((p) => ({ registroId: r.id, passoId: p.id, prazoEra: p.prazo as string })),
      ),
    }))
    .filter((g) => g.prazoEra || g.lembrarEra || g.passos.length > 0);
}

// O seletor de data compacto ganha contorno aqui para se ler como botão de decisão dentro da linha.
const SELETOR = "bg-card text-foreground ring-1 ring-border ring-inset dark:bg-input/20";

const acharPasso = (t: Tarefa, registroId: string, passoId: string): Passo | undefined =>
  t.registros.find((r) => r.id === registroId)?.proximosPassos.find((p) => p.id === passoId);

const prazoResolvido = (t: Tarefa, hoje: string) => !aberta(t) || !t.prazo || t.prazo >= hoje;
const lembreteResolvido = (t: Tarefa, hoje: string) => !aberta(t) || !t.lembrarEm || t.lembrarEm > hoje;
const passoResolvido = (t: Tarefa, p: Passo | undefined, hoje: string) => !aberta(t) || !p || p.feito || !p.prazo || p.prazo >= hoje;

export interface ContagemPendencias {
  total: number;
  resolvidas: number;
}

/** Quantos itens havia e quantos já foram resolvidos (olhando o estado atual das tarefas). */
export function contarPendencias(pendencias: PendenciasDaTarefa[], tarefas: Tarefa[], hoje: string): ContagemPendencias {
  let total = 0;
  let resolvidas = 0;
  for (const g of pendencias) {
    const t = tarefas.find((x) => x.id === g.tarefaId);
    const n = (g.prazoEra ? 1 : 0) + (g.lembrarEra ? 1 : 0) + g.passos.length;
    total += n;
    if (!t) {
      resolvidas += n; // a tarefa foi para a lixeira no meio do caminho
      continue;
    }
    if (g.prazoEra && prazoResolvido(t, hoje)) resolvidas++;
    if (g.lembrarEra && lembreteResolvido(t, hoje)) resolvidas++;
    for (const x of g.passos) if (passoResolvido(t, acharPasso(t, x.registroId, x.passoId), hoje)) resolvidas++;
  }
  return { total, resolvidas };
}

export function EtapaAtras({
  pendencias, contagem, tarefas, categorias, hoje, abrirTarefa,
}: {
  pendencias: PendenciasDaTarefa[];
  contagem: ContagemPendencias;
  tarefas: Tarefa[];
  categorias: Categoria[];
  hoje: string;
  abrirTarefa: (t: Tarefa) => void;
}) {
  const grupos = pendencias
    .map((g) => ({ g, t: tarefas.find((x) => x.id === g.tarefaId) }))
    .filter((x): x is { g: PendenciasDaTarefa; t: Tarefa } => !!x.t);

  if (contagem.total === 0) {
    return (
      <div data-slot="nada-atrasado" className="flex min-h-[21rem] flex-col items-center justify-center gap-2 text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          className="mb-1 inline-flex size-12 items-center justify-center rounded-full bg-sucesso/14 text-sucesso"
        >
          <Check className="size-6" strokeWidth={2.5} />
        </motion.span>
        <strong className="text-[15px] font-semibold tracking-tight">Nada atrasado</strong>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Nenhum prazo vencido, follow-up pendente ou passo atrasado. Pode seguir direto para escolher os focos de hoje.
        </p>
      </div>
    );
  }

  const tudoResolvido = contagem.resolvidas === contagem.total;

  return (
    <div>
      <CabecalhoEtapa
        titulo="O que ficou para trás"
        descricao="Decida rápido o destino de cada item: remarcar, concluir ou deixar de lado."
        lado={
          <div data-slot="pendencias-resolvidas" className="w-32">
            <div className={cn("mb-1.5 flex items-center justify-end gap-1.5 text-xs font-medium tabular-nums", tudoResolvido ? "text-sucesso" : "text-muted-foreground")}>
              {tudoResolvido && <PartyPopper className="size-3.5" />}
              {contagem.resolvidas} de {contagem.total} {contagem.total === 1 ? "resolvido" : "resolvidos"}
            </div>
            <Progress valor={(contagem.resolvidas / contagem.total) * 100} className={tudoResolvido ? "[&>div]:bg-sucesso" : undefined} />
          </div>
        }
      />
      <motion.div variants={lista} initial="escondido" animate="visivel" className="flex flex-col gap-3">
        {grupos.map(({ g, t }) => (
          <motion.div key={g.tarefaId} variants={itemLista}>
            <CartaoPendencias grupo={g} tarefa={t} categoria={categorias.find((c) => c.id === t.categoriaId) ?? null} hoje={hoje} abrirTarefa={abrirTarefa} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function CartaoPendencias({
  grupo: g, tarefa: t, categoria, hoje, abrirTarefa,
}: {
  grupo: PendenciasDaTarefa; tarefa: Tarefa; categoria: Categoria | null; hoje: string; abrirTarefa: (t: Tarefa) => void;
}) {
  const { atualizarTarefa } = useNexo();
  const acoes = useAcoesTarefa();
  const fechada = !aberta(t);
  const okPrazo = prazoResolvido(t, hoje);
  const okLembrete = lembreteResolvido(t, hoje);

  return (
    <MenuContextoTarefa tarefa={t}>
      <article data-slot="pendencia" data-tarefa={t.id} className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex items-start gap-2 py-3 pr-2.5 pl-3.5">
          <div className="min-w-0 flex-1">
            <CatTag cat={categoria} className="text-[11px]" />
            <div className="mt-0.5 text-sm leading-snug font-semibold tracking-tight">{t.titulo}</div>
          </div>
          <SeletorStatus status={t.status} aoMudar={(s) => acoes.mudarStatus(t, s)} className="mt-0.5" />
          <PrioBadge p={t.prioridade} className="mt-0.5" />
          <Dica texto="Abrir a tarefa e fechar o planejamento">
            <Button variant="ghost" size="icon-sm" aria-label={`Abrir a tarefa ${t.titulo}`} onClick={() => abrirTarefa(t)}>
              <ArrowUpRight />
            </Button>
          </Dica>
        </div>

        <div className="divide-y border-t bg-muted/30 dark:bg-muted/20">
          {g.prazoEra && (
            <LinhaDecisao
              tipo="prazo"
              resolvido={okPrazo}
              icone={<CalendarX2 />}
              tom="bg-destructive/12 text-destructive"
              titulo={
                !okPrazo ? `Prazo venceu ${dataRelativa(t.prazo)}`
                : fechada ? `Tarefa ${nomeStatus(t.status).toLowerCase()}`
                : t.prazo ? `Novo prazo: ${dataPorExtenso(t.prazo)}`
                : "Ficou sem prazo"
              }
              detalhe={`Era para ${formatarData(g.prazoEra)}`}
            >
              {!fechada && (
                <SeletorData
                  compacto
                  valor={okPrazo ? (t.prazo ?? "") : ""}
                  aoMudar={(v) => atualizarTarefa(t.id, (x) => ({ ...x, prazo: v || null }))}
                  placeholder={okPrazo ? "Definir prazo" : "Remarcar"}
                  aria-label="Novo prazo da tarefa"
                  className={SELETOR}
                />
              )}
            </LinhaDecisao>
          )}

          {g.lembrarEra && (
            <LinhaDecisao
              tipo="followup"
              resolvido={okLembrete}
              icone={<AlarmClock />}
              tom="bg-alerta/16 text-alerta"
              titulo={
                !okLembrete ? (t.lembrarEm === hoje ? "Follow-up marcado para hoje" : `Follow-up pendente ${dataRelativa(t.lembrarEm)}`)
                : fechada ? `Tarefa ${nomeStatus(t.status).toLowerCase()}`
                : t.lembrarEm ? `Volto a lembrar ${dataRelativa(t.lembrarEm)}`
                : "Follow-up encerrado"
              }
              detalhe="Você pediu para ser lembrado de voltar nesta tarefa"
            >
              {!fechada && (
                <>
                  {!okLembrete && (
                    <Button variant="ghost" size="sm" data-acao="followup-feito" onClick={() => atualizarTarefa(t.id, (x) => comLembrete(x, null))}>
                      <Check /> Já cuidei
                    </Button>
                  )}
                  <SeletorData
                    compacto
                    valor={okLembrete ? (t.lembrarEm ?? "") : ""}
                    aoMudar={(v) => atualizarTarefa(t.id, (x) => comLembrete(x, v || null))}
                    placeholder={okLembrete ? "Lembrar de novo" : "Lembrar depois"}
                    aria-label="Nova data do follow-up"
                    className={SELETOR}
                  />
                </>
              )}
            </LinhaDecisao>
          )}

          {g.passos.map((x) => {
            const p = acharPasso(t, x.registroId, x.passoId);
            if (!p) return null;
            const ok = passoResolvido(t, p, hoje);
            const dono = passoEhMeu(p) ? "" : `com ${p.responsavel} · `;
            return (
              <div key={x.passoId} data-slot="decisao" data-tipo="passo" data-resolvido={ok || undefined} className="flex items-center gap-2.5 py-2 pr-2.5 pl-3.5">
                <span className="inline-flex size-6 shrink-0 items-center justify-center">
                  <Checkbox
                    redondo
                    checked={p.feito}
                    disabled={fechada}
                    aria-label={p.feito ? "Reabrir passo" : "Concluir passo"}
                    onCheckedChange={(v) => atualizarTarefa(t.id, (y) => comPassoAlternado(y, x.registroId, x.passoId, v === true))}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[13px] leading-snug transition-colors duration-300", p.feito && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                    {p.texto}
                  </div>
                  <div className={cn("mt-0.5 text-[11px]", ok ? "text-sucesso" : "text-muted-foreground")}>
                    {p.feito ? "Passo concluído"
                      : fechada ? `Tarefa ${nomeStatus(t.status).toLowerCase()}`
                      : !p.prazo ? `${dono}ficou sem prazo`
                      : ok ? `${dono}novo prazo: ${dataPorExtenso(p.prazo)}`
                      : `${dono}venceu ${dataRelativa(p.prazo)}`}
                  </div>
                </div>
                {!p.feito && !fechada && (
                  <SeletorData
                    compacto
                    valor={ok ? (p.prazo ?? "") : ""}
                    aoMudar={(v) => atualizarTarefa(t.id, (y) => comPrazoDoPasso(y, x.registroId, x.passoId, v || null))}
                    placeholder={ok ? "Definir prazo" : "Remarcar"}
                    aria-label="Novo prazo do passo"
                    className={cn("shrink-0", SELETOR)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </article>
    </MenuContextoTarefa>
  );
}

function LinhaDecisao({
  tipo, resolvido, icone, tom, titulo, detalhe, children,
}: {
  tipo: string; resolvido: boolean; icone: ReactNode; tom: string; titulo: string; detalhe: string; children?: ReactNode;
}) {
  return (
    <div data-slot="decisao" data-tipo={tipo} data-resolvido={resolvido || undefined} className="flex items-center gap-2.5 py-2 pr-2.5 pl-3.5">
      <span
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 [&_svg]:size-3.5",
          resolvido ? "bg-sucesso/14 text-sucesso" : tom,
        )}
      >
        {resolvido ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 24 }} className="inline-flex">
            <Check strokeWidth={2.5} />
          </motion.span>
        ) : (
          icone
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[13px] leading-snug font-medium", resolvido && "text-sucesso")}>{titulo}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}
