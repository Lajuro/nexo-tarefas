"use client";

// A linha do tempo de um dia: as horas à esquerda, os blocos do plano no meio (os que se sobrepõem ficam
// lado a lado), a linha de "agora", o fim do expediente e a faixa de hora extra depois dele.
// Clicar num espaço vazio cria um bloco naquele horário; arrastar um bloco muda o horário; a alça de baixo
// muda a duração. Enquanto se arrasta, nada é gravado: só ao soltar.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { duracao, emColunas, emHora, emMinutos } from "@/lib/jornada";
import type { BlocoDaJornada, PontoDoDia, Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { VISUAL_DO_BLOCO } from "./pecas";

const PX = 1.25; // pixels por minuto (75 por hora)
const PASSO = 5; // o arrasto anda de 5 em 5 minutos
const MINIMO = 10;

interface Arrasto {
  id: string;
  modo: "mover" | "esticar";
  /** Y do ponteiro quando o arrasto começou. */
  y0: number;
  delta: number;
  andou: boolean;
}

export function LinhaDoDia({
  blocos, doPadrao, ehHoje, agora, fimDoExpediente, semJornada, alem, ponto, tarefas, aoCriar, aoAbrir, aoMover, aoMarcar,
}: {
  blocos: BlocoDaJornada[];
  /** Os blocos vêm do dia padrão (o dia ainda não tem plano próprio). */
  doPadrao: boolean;
  ehHoje: boolean;
  agora: number;
  fimDoExpediente: number | null;
  /** Dia sem expediente (folga, fim de semana): tudo o que for planejado é extra. */
  semJornada: boolean;
  alem: Set<string>;
  ponto: PontoDoDia;
  tarefas: Map<string, Tarefa>;
  aoCriar: (inicio: number, fim: number) => void;
  aoAbrir: (b: BlocoDaJornada) => void;
  aoMover: (b: BlocoDaJornada, inicio: number, fim: number) => void;
  aoMarcar: (b: BlocoDaJornada, feito: boolean) => void;
}) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  // de que hora a que hora a linha vai: o expediente comum, esticado para caber tudo o que existe
  const [de, ate] = useMemo(() => {
    const pontos = [
      ...blocos.flatMap((b) => [emMinutos(b.inicio), emMinutos(b.fim)]),
      ...(ponto.entrada ? [emMinutos(ponto.entrada)] : []),
      ...(ponto.saida ? [emMinutos(ponto.saida)] : []),
      ...(fimDoExpediente != null ? [Math.min(fimDoExpediente, 1439)] : []),
      ...(ehHoje ? [agora] : []),
    ];
    const primeiro = Math.min(7 * 60, ...pontos);
    const ultimo = Math.max(19 * 60, ...pontos);
    // meia hora de folga antes e depois, arredondada para a hora cheia
    return [Math.max(0, Math.floor((primeiro - 30) / 60)) * 60, Math.min(24, Math.ceil((ultimo + 30) / 60)) * 60];
    // "agora" de fora de propósito: a régua não deve mudar a cada minuto, só quando o dia muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocos, ponto.entrada, ponto.saida, fimDoExpediente, ehHoje]);

  const y = (min: number) => (Math.min(ate, Math.max(de, min)) - de) * PX;
  const colunas = useMemo(() => emColunas(blocos), [blocos]);
  const horas = Array.from({ length: (ate - de) / 60 + 1 }, (_, i) => de + i * 60);

  // ao abrir, leva a tela para onde o dia está: agora (se é hoje) ou o primeiro bloco
  const alvoInicial = ehHoje ? agora : blocos.length ? emMinutos(blocos[0].inicio) : 8 * 60;
  const jaRolou = useRef(false);
  useEffect(() => {
    if (jaRolou.current || !rolagem.current) return;
    jaRolou.current = true;
    rolagem.current.scrollTop = Math.max(0, (alvoInicial - de) * PX - 140);
  }, [alvoInicial, de]);

  const horario = (b: BlocoDaJornada) => {
    let ini = emMinutos(b.inicio);
    let fim = emMinutos(b.fim);
    if (arrasto && arrasto.id === b.id && arrasto.andou) {
      if (arrasto.modo === "mover") {
        const d = Math.min(1439 - fim, Math.max(-ini, arrasto.delta));
        ini += d;
        fim += d;
      } else fim = Math.min(1439, Math.max(ini + MINIMO, fim + arrasto.delta));
    }
    return [ini, fim] as const;
  };

  const comecar = (e: React.PointerEvent, b: BlocoDaJornada, modo: Arrasto["modo"]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setArrasto({ id: b.id, modo, y0: e.clientY, delta: 0, andou: false });
  };
  const andar = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!arrasto) return;
    const dy = e.clientY - arrasto.y0;
    if (!arrasto.andou && Math.abs(dy) < 4) return;
    setArrasto({ ...arrasto, andou: true, delta: Math.round(dy / PX / PASSO) * PASSO });
  };
  const soltar = (e: React.PointerEvent, b: BlocoDaJornada) => {
    // a alça fica dentro do bloco: sem isto, soltar a alça chegaria também ao bloco e gravaria duas vezes
    e.stopPropagation();
    if (!arrasto) return;
    const [ini, fim] = horario(b);
    const mudou = arrasto.andou && (ini !== emMinutos(b.inicio) || fim !== emMinutos(b.fim));
    const abrir = !arrasto.andou && arrasto.modo === "mover";
    setArrasto(null);
    if (mudou) aoMover(b, ini, fim);
    else if (abrir) aoAbrir(b);
  };

  const noVazio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const min = de + Math.floor((e.clientY - caixa.top) / PX / 30) * 30;
    const ini = Math.min(1439 - 30, Math.max(0, min));
    aoCriar(ini, Math.min(1439, ini + 60));
  };

  const extraDesde = semJornada ? de : fimDoExpediente != null && fimDoExpediente < ate ? Math.max(de, fimDoExpediente) : null;

  return (
    <div ref={rolagem} data-slot="linha-do-dia" data-padrao={doPadrao || undefined} className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card shadow-xs">
      <div className="relative flex py-3 pr-3" style={{ height: (ate - de) * PX + 24 }}>
        {/* as horas */}
        <div className="relative w-14 shrink-0 sem-selecao" aria-hidden>
          {horas.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: y(h) }}>{emHora(h === 1440 ? 0 : h)}</span>
          ))}
        </div>

        {/* o ponto de verdade: de quando a quando houve expediente, com as pausas vazadas */}
        <div className="relative w-1.5 shrink-0" aria-hidden>
          {ponto.entrada && (
            <span data-slot="trilho-do-ponto" className="absolute inset-x-0 rounded-full bg-sucesso/55"
              style={{ top: y(emMinutos(ponto.entrada)), height: Math.max(2, y(ponto.saida ? emMinutos(ponto.saida) : ehHoje ? agora : emMinutos(ponto.entrada)) - y(emMinutos(ponto.entrada))) }} />
          )}
          {ponto.pausas.map((q) => (
            <span key={q.inicio} className="absolute inset-x-0 bg-card"
              style={{ top: y(emMinutos(q.inicio)), height: Math.max(0, y(q.fim ? emMinutos(q.fim) : ehHoje ? agora : emMinutos(q.inicio)) - y(emMinutos(q.inicio))) }} />
          ))}
        </div>

        {/* a área dos blocos */}
        <div data-slot="area-dos-blocos" className="relative ml-2 min-w-0 flex-1 cursor-copy" onClick={noVazio}>
          {horas.map((h) => (
            <span key={h} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: y(h) }} />
          ))}
          {horas.slice(0, -1).map((h) => (
            <span key={h} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/35" style={{ top: y(h + 30) }} />
          ))}

          {extraDesde != null && (
            <div data-slot="faixa-de-extra" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 bg-[repeating-linear-gradient(135deg,transparent_0_7px,color-mix(in_oklab,var(--alerta)_12%,transparent)_7px_8px)]" style={{ top: y(extraDesde) }} />
          )}
          {!semJornada && fimDoExpediente != null && fimDoExpediente <= ate && (
            <div data-slot="fim-do-expediente" className="pointer-events-none absolute inset-x-0 z-[25] border-t-2 border-dashed border-alerta/70" style={{ top: y(fimDoExpediente) }}>
              <span className="absolute right-1 -top-[19px] rounded-md bg-card px-1.5 text-xs font-medium text-alerta tabular-nums sem-selecao">
                Fim do expediente · {emHora(fimDoExpediente)}
              </span>
            </div>
          )}

          {blocos.map((b) => {
            const [ini, fim] = horario(b);
            const col = colunas.get(b.id) ?? { coluna: 0, colunas: 1 };
            const v = VISUAL_DO_BLOCO[b.tipo];
            const altura = Math.max(18, (fim - ini) * PX - 2);
            const tarefa = b.tarefaId ? tarefas.get(b.tarefaId) : undefined;
            const passou = ehHoje && fim <= agora;
            const emCurso = ehHoje && ini <= agora && agora < fim;
            const movendo = arrasto?.id === b.id && arrasto.andou;
            const extra = alem.has(b.id);
            return (
              <div
                key={b.id}
                data-slot="bloco"
                data-id={b.id}
                data-tipo={b.tipo}
                data-agora={emCurso || undefined}
                data-extra={extra || undefined}
                data-feito={b.feito || undefined}
                role="button"
                tabIndex={0}
                aria-label={`${b.titulo || v.nome}, das ${emHora(ini)} às ${emHora(fim)}`}
                onPointerDown={(e) => comecar(e, b, "mover")}
                onPointerMove={andar}
                onPointerUp={(e) => soltar(e, b)}
                onPointerCancel={() => setArrasto(null)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    aoAbrir(b);
                  }
                }}
                className={cn(
                  "group/bloco absolute z-20 flex cursor-grab touch-none flex-col overflow-hidden rounded-lg border px-2 py-1 text-left outline-none transition-[box-shadow,opacity,border-color] duration-150 sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  v.caixa,
                  doPadrao && "border-dashed",
                  (passou || b.feito) && !movendo && "opacity-60",
                  emCurso && "shadow-md ring-1 ring-ring/45",
                  movendo && "z-30 cursor-grabbing shadow-lg ring-2 ring-ring/50",
                )}
                style={{ top: y(ini) + 1, height: altura, left: `calc(${(col.coluna / col.colunas) * 100}% + 2px)`, width: `calc(${100 / col.colunas}% - 4px)` }}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <v.icone className={cn("size-3 shrink-0", v.texto)} />
                  <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-tight font-medium", b.feito && "line-through decoration-foreground/40")}>{b.titulo || v.nome}</span>
                  {extra && <span data-slot="selo-extra" className="shrink-0 rounded bg-alerta/15 px-1 text-[11px] font-semibold text-alerta">extra</span>}
                  <span
                    role="checkbox"
                    aria-checked={!!b.feito}
                    aria-label={b.feito ? "Desmarcar como cumprido" : "Marcar como cumprido"}
                    tabIndex={-1}
                    data-slot="bloco-feito"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      aoMarcar(b, !b.feito);
                    }}
                    className={cn(
                      "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                      b.feito ? "border-sucesso bg-sucesso text-white" : "border-foreground/25 bg-card/70 text-transparent opacity-0 group-focus-within/bloco:opacity-100 group-hover/bloco:opacity-100 focus-visible:opacity-100 hover:border-sucesso hover:text-sucesso",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                </div>
                {altura >= 36 && (
                  <span className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                    {emHora(ini)} a {emHora(fim)} · {duracao(fim - ini)}
                    {tarefa && b.titulo !== tarefa.titulo ? ` · ${tarefa.titulo}` : ""}
                  </span>
                )}
                {altura >= 58 && b.nota && <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{b.nota}</span>}
                <span
                  aria-hidden
                  data-slot="alca-do-bloco"
                  onPointerDown={(e) => comecar(e, b, "esticar")}
                  onPointerMove={andar}
                  onPointerUp={(e) => soltar(e, b)}
                  onPointerCancel={() => setArrasto(null)}
                  className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none"
                />
              </div>
            );
          })}

          {ehHoje && agora >= de && agora <= ate && (
            <div data-slot="linha-de-agora" className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-destructive" style={{ top: y(agora) }}>
              <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-destructive" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
