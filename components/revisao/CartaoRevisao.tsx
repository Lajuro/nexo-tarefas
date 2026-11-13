"use client";

// Cartão grande de uma tarefa no passo a passo da revisão semanal:
// à esquerda o que aconteceu e o que falta, à direita as decisões rápidas.

import { ReactNode } from "react";
import { ArrowUpRight, CircleCheck, Info, OctagonAlert, Target, TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { BotaoMenuTarefa, MenuContextoTarefa } from "@/components/MenuTarefa";
import { useLembretes } from "@/components/useLembretes";
import { AvatarPessoa, Campo, CatTag, Contador, IconeTipo, ItemPasso, SeletorPrioridade, SeletorStatus, TipoBadge } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { SeletorData, dataPorExtenso } from "@/components/ui/data";
import { Dica } from "@/components/ui/popover";
import { aplicarStatus, comFoco, comLembrete, comPassoAlternado, ehFocoHoje } from "@/lib/acoes";
import { Gravidade, LIMITES, aberta, dataRelativa } from "@/lib/lembretes";
import { Categoria, Tarefa, diasAte, formatarData, ordenarRegistros } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { Retrato } from "./retrato";

const VISUAL_GRAVIDADE: Record<Gravidade, { icone: ReactNode; caixa: string; texto: string }> = {
  critico: { icone: <OctagonAlert />, caixa: "border-destructive/25 bg-destructive/8", texto: "text-destructive" },
  atencao: { icone: <TriangleAlert />, caixa: "border-alerta/30 bg-alerta/10", texto: "text-alerta" },
  info: { icone: <Info />, caixa: "bg-muted/50", texto: "text-info" },
};

function Titulo({ children, n }: { children: ReactNode; n?: number }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground sem-selecao">
      {children}
      {n !== undefined && <Contador n={n} />}
    </h3>
  );
}

/** Texto curto ao lado do rótulo de uma data ("em 3 dias", "2d de atraso"). */
function DistanciaData({ data, atrasoEhRuim }: { data: string | null | undefined; atrasoEhRuim?: boolean }) {
  if (!data) return null;
  const d = diasAte(data) ?? 0;
  const tom = d < 0 ? (atrasoEhRuim ? "text-destructive" : "text-alerta") : d <= (atrasoEhRuim ? LIMITES.prazoProximo : 0) ? "text-alerta" : "text-muted-foreground";
  const txt = d < 0 && atrasoEhRuim ? `${-d}d de atraso` : dataRelativa(data);
  return <span className={cn("text-[11px] font-medium tabular-nums", tom)}>{txt}</span>;
}

export function CartaoRevisao({ tarefa: t, antes, categoria }: { tarefa: Tarefa; antes: Retrato; categoria?: Categoria }) {
  const { atualizarTarefa } = useNexo();
  const { lembretes } = useLembretes();
  const ativos = lembretes.filter((l) => l.tarefaId === t.id);

  const recentes = ordenarRegistros(t.registros, true);
  const ultimo = recentes.find((r) => r.tipo !== "marco") ?? recentes[0] ?? null;
  const resumo = ultimo ? (ultimo.resumoIA || ultimo.anotacoes).trim() : "";

  // Mostra os passos que estavam abertos quando a revisão começou: os que forem marcados ficam riscados (e dá para desfazer).
  const eramAbertos = new Set(antes.passosAbertos);
  const passos = t.registros.flatMap((r) => r.proximosPassos.filter((p) => !p.feito || eramAbertos.has(p.id)).map((p) => ({ r, p })));
  const emAberto = passos.filter((x) => !x.p.feito).length;

  const foco = ehFocoHoje(t);
  const estaAberta = aberta(t);
  const parado = antes.parado;
  const tomParado = parado >= LIMITES.parada * 2 ? "bg-destructive/10 text-destructive ring-destructive/20"
    : parado >= LIMITES.parada ? "bg-alerta/14 text-alerta ring-alerta/25"
    : "bg-muted text-muted-foreground ring-border";

  return (
    <MenuContextoTarefa tarefa={t}>
      <article data-slot="cartao-revisao" data-tarefa={t.id} className="@container overflow-hidden rounded-2xl border bg-card shadow-md">
        <header className="flex items-start gap-4 border-b px-5 py-4">
          <Dica texto={parado === 0 ? "Teve atividade hoje" : `Último sinal de vida há ${parado} ${parado === 1 ? "dia" : "dias"} (registro, passo concluído ou criação)`}>
            <div data-slot="dias-parada" className={cn("flex w-[72px] shrink-0 flex-col items-center rounded-xl px-1 py-2 text-center ring-1 ring-inset sem-selecao", tomParado)}>
              <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{parado}</span>
              <span className="mt-1 text-[10px] leading-tight font-medium">{parado === 1 ? "dia" : "dias"} sem atividade</span>
            </div>
          </Dica>
          <div className="min-w-0 flex-1">
            <CatTag cat={categoria} />
            <h2 className="mt-1 text-xl leading-snug font-semibold tracking-tight">
              <Dica texto="Abrir a tarefa em outra aba">
                <a
                  href={`/tarefas/${t.id}`}
                  target="_blank"
                  rel="noreferrer"
                  data-slot="titulo-revisao"
                  className="group/titulo rounded-sm outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35"
                >
                  {t.titulo}
                  <ArrowUpRight className="ml-1 inline size-4 -translate-y-px text-muted-foreground opacity-60 transition-opacity group-hover/titulo:text-primary group-hover/titulo:opacity-100" />
                </a>
              </Dica>
            </h2>
            {t.descricao && <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{t.descricao}</p>}
          </div>
          <BotaoMenuTarefa tarefa={t} className="-mr-1.5" />
        </header>

        <div className="flex flex-col @2xl:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5 p-5">
            <section data-slot="lembretes-revisao">
              <Titulo n={ativos.length || undefined}>Por que olhar para ela</Titulo>
              {ativos.length === 0 ? (
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <CircleCheck className="size-3.5 text-sucesso" /> Nenhum lembrete ativo. Confira só se continua tudo certo.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {ativos.map((l) => {
                    const v = VISUAL_GRAVIDADE[l.gravidade];
                    return (
                      <li key={l.id} data-slot="lembrete" data-gravidade={l.gravidade} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2", v.caixa)}>
                        <span className={cn("mt-0.5 shrink-0 [&_svg]:size-3.5", v.texto)}>{v.icone}</span>
                        <div className="min-w-0 text-[13px] leading-snug">
                          <span className="font-medium">{l.titulo}</span>
                          {l.detalhe && <span className="text-muted-foreground"> · {l.detalhe}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {ultimo && (
              <section data-slot="ultimo-registro">
                <Titulo>Último registro</Titulo>
                <div className="flex gap-3">
                  <IconeTipo tipo={ultimo.tipo} comFundo />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-medium">{ultimo.titulo || "Sem título"}</span>
                      <TipoBadge tipo={ultimo.tipo} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">{dataPorExtenso(ultimo.data)} · {dataRelativa(ultimo.data)}</span>
                      {ultimo.participantes.length > 0 && (
                        <Dica texto={`Com ${ultimo.participantes.join(", ")}`}>
                          <span className="flex items-center -space-x-1.5">
                            {ultimo.participantes.slice(0, 4).map((nome) => (
                              <AvatarPessoa key={nome} nome={nome} tamanho="sm" className="ring-2 ring-card" />
                            ))}
                          </span>
                        </Dica>
                      )}
                    </div>
                    {resumo && <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-foreground/85 texto-pre">{resumo}</p>}
                    {ultimo.tipo === "marco" && !resumo && (
                      <p className="mt-1.5 text-[13px] text-muted-foreground">Ainda não há reunião nem atividade registrada nesta tarefa.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section data-slot="passos-revisao">
              <Titulo n={emAberto}>Passos em aberto</Titulo>
              {passos.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum próximo passo em aberto. Se a tarefa continua viva, vale registrar qual é a próxima ação.</p>
              ) : (
                <div className="flex flex-col">
                  {passos.map(({ r, p }) => (
                    <ItemPasso
                      key={p.id}
                      texto={p.texto}
                      feito={p.feito}
                      aoAlternar={(feito) => atualizarTarefa(t.id, (x) => comPassoAlternado(x, r.id, p.id, feito))}
                      meta={
                        <>
                          {p.responsavel && <span>{p.responsavel}</span>}
                          {p.prazo && (
                            <span className={cn("tabular-nums", !p.feito && (diasAte(p.prazo) ?? 0) < 0 && "font-medium text-destructive")}>
                              prazo {formatarData(p.prazo, false)}
                            </span>
                          )}
                          <span className="tabular-nums">desde {formatarData(r.data, false)}</span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside data-slot="decisoes-revisao" className="flex shrink-0 flex-col gap-3.5 border-t bg-muted/30 p-5 @2xl:w-[304px] @2xl:border-t-0 @2xl:border-l">
            <Campo rotulo="Status" className="flex-none">
              <div><SeletorStatus status={t.status} aoMudar={(s) => atualizarTarefa(t.id, (x) => aplicarStatus(x, s, x))} /></div>
            </Campo>
            <Campo rotulo="Prioridade" className="flex-none" lado={<span className="text-[11px] text-muted-foreground tabular-nums">{t.prioridade} de 10</span>}>
              <SeletorPrioridade valor={t.prioridade} aoMudar={(p) => p !== t.prioridade && atualizarTarefa(t.id, (x) => ({ ...x, prioridade: p }))} />
            </Campo>
            <Campo rotulo="Prazo" className="flex-none" lado={estaAberta && <DistanciaData data={t.prazo} atrasoEhRuim />}>
              <SeletorData aria-label="Prazo" valor={t.prazo ?? ""} placeholder="Sem prazo" aoMudar={(v) => atualizarTarefa(t.id, (x) => ({ ...x, prazo: v || null }))} />
            </Campo>
            <Campo rotulo="Follow-up" className="flex-none" lado={estaAberta && <DistanciaData data={t.lembrarEm} />}>
              <SeletorData
                aria-label="Follow-up"
                valor={t.lembrarEm ?? ""}
                placeholder="Me lembre de voltar em..."
                disabled={!estaAberta}
                aoMudar={(v) => atualizarTarefa(t.id, (x) => comLembrete(x, v || null))}
              />
            </Campo>
            <Button
              data-slot="focar-hoje"
              variant="outline"
              aria-pressed={foco}
              disabled={!estaAberta}
              onClick={() => atualizarTarefa(t.id, (x) => comFoco(x, !ehFocoHoje(x)))}
              className={cn("mt-1 justify-start", foco && "border-primary/50 bg-primary/8 text-primary hover:bg-primary/12 hover:text-primary dark:bg-primary/15")}
            >
              <Target /> {foco ? "No foco de hoje" : "Focar hoje"}
            </Button>
          </aside>
        </div>
      </article>
    </MenuContextoTarefa>
  );
}
