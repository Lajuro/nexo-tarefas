"use client";

// Ritual "Fechar o dia": o par do "Planejar o dia". Uma tela só, curta:
//   1. O que saiu hoje (do Diário, só leitura).
//   2. O que ficou do foco: levar para o próximo dia de trabalho ou soltar. Meus passos vencidos, marcáveis ali.
//   3. A daily pronta para copiar (texto fixo, sem IA) e, se o ponto ainda está aberto, bater a saída.
// Abre pelo botão "Encerrar o dia" da rotina, pela paleta, pela tela Hoje e pelo atalho Shift D.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CircleCheckBig, CircleMinus, ClipboardCopy, LogOut, Moon, OctagonAlert, Target, CalendarClock } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CatTag, ItemPasso, PrioBadge, copiarTexto } from "@/components/comum";
import { minutoDeAgora, usePonto, useJornada } from "@/components/jornada/pecas";
import { useHoje } from "@/components/useHoje";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { comFocoEm, comPassoAlternado } from "@/lib/acoes";
import { dailyDoFechamento, linhasDoQueFoiFeito, montarFechamento } from "@/lib/fechamento";
import { tituloDoDia } from "@/lib/diario";
import { contarPonto, diaDe } from "@/lib/jornada";
import { lerPref, usePref } from "@/lib/preferencias";
import type { Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Abre o ritual "Fechar o dia" de qualquer lugar (o Shell monta a janela). */
export function abrirFecharDia() {
  window.dispatchEvent(new CustomEvent("nexo:fechar-dia"));
}

/** "Encerrar o dia" da rotina: bate a saída e, se for hoje e a preferência deixar, abre o fechamento. */
export function useEncerrarDia(data: string) {
  const ponto = usePonto(data);
  const hoje = useHoje();
  return async () => {
    const ok = await ponto.sair();
    if (ok && data === hoje && normalizarPrefFechamento(lerPref("fechamento", FECHAMENTO_PADRAO)).abrirAoSair) abrirFecharDia();
  };
}

export interface PrefFechamento { abrirAoSair: boolean }
export const FECHAMENTO_PADRAO: PrefFechamento = { abrirAoSair: true };
export const normalizarPrefFechamento = (x: unknown): PrefFechamento =>
  ({ abrirAoSair: !(x && typeof x === "object" && (x as PrefFechamento).abrirAoSair === false) });

function Bloco({ titulo, icone, contagem, children, className }: { titulo: string; icone: React.ReactNode; contagem?: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-tight sem-selecao [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icone} {titulo}
        {contagem ? <span className="text-xs font-normal text-muted-foreground tabular-nums">{contagem}</span> : null}
      </h3>
      {children}
    </section>
  );
}

export function FecharDia({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent data-ritual="fechar-dia" className="max-h-[44rem] max-w-2xl"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-foco-inicial]")?.focus(); }}>
        {aberto && <Conteudo fechar={fechar} />}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ fechar }: { fechar: () => void }) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const hoje = useHoje();
  const { jornada } = useJornada();
  const ponto = usePonto(hoje);
  const [pref, setPref] = usePref<PrefFechamento>("fechamento", FECHAMENTO_PADRAO);
  const prefOk = normalizarPrefFechamento(pref);
  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = dados?.categorias.items ?? [];
  const f = useMemo(() => montarFechamento({ tarefas }, hoje, jornada.config.diasDeTrabalho), [tarefas, hoje, jornada.config.diasDeTrabalho]);
  // Os focos que estavam abertos ao abrir a janela continuam na lista depois de levados ou soltos (com a escolha marcada).
  const [focosDaAbertura] = useState(() => f.focosAbertos.map((t) => t.id));
  const conta = contarPonto(jornada.config, diaDe(jornada, hoje), hoje, minutoDeAgora());
  const pontoAberto = conta.estado === "aberto";

  const focos = focosDaAbertura.map((id) => tarefas.find((t) => t.id === id)).filter((t): t is Tarefa => !!t);
  const levados = focos.filter((t) => t.focoEm === f.proximo);
  const daily = dailyDoFechamento(f, levados);
  const feitos = linhasDoQueFoiFeito(f.feitos);
  const proximoNome = tituloDoDia(f.proximo).split(",")[0];

  const levar = (t: Tarefa, data: string | null) => atualizarTarefa(t.id, (x) => comFocoEm(x, data));
  const levarTodos = async () => {
    for (const t of focos) if (t.focoEm !== f.proximo) await levar(t, f.proximo);
    toast(`Focos levados para ${proximoNome}.`, "info");
  };

  const copiarDaily = async () => {
    if (await copiarTexto(daily)) toast("Daily copiada.");
    else toast("Não consegui copiar automaticamente.", "erro");
  };

  const encerrar = async () => {
    if (pontoAberto) await ponto.sair();
    fechar();
  };

  return (
    <>
      <header className="shrink-0 border-b px-5 pt-4 pb-3.5">
        <div className="flex items-center gap-3 pr-10">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary dark:bg-primary/20 dark:text-foreground">
            <Moon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <DialogTitle>Fechar o dia</DialogTitle>
            <DialogDescription className="mt-0.5 truncate">
              {tituloDoDia(hoje).replace(/^./, (c) => c.toUpperCase())} · o próximo dia de trabalho é {proximoNome}
            </DialogDescription>
          </div>
        </div>
      </header>

      <DialogBody className="flex flex-col gap-5">
        <Bloco titulo="O que saiu hoje" icone={<CircleCheckBig />} contagem={f.feitos.length}>
          {feitos.length ? (
            <ul data-slot="fechamento-feitos" className="flex flex-col gap-1 text-[13px] leading-snug">
              {feitos.map((l, i) => <li key={i} className="texto-pre">{l.replace(/^- /, "")}</li>)}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nada registrado hoje. Se algo andou, vale anotar agora: amanhã a memória já falha.</p>
          )}
        </Bloco>

        {focos.length > 0 && (
          <Bloco titulo="Ficou do foco" icone={<Target />} contagem={focos.length}>
            <div className="flex flex-col gap-1.5">
              {focos.map((t) => {
                const levado = t.focoEm === f.proximo;
                const solto = !t.focoEm || (t.focoEm !== hoje && !levado);
                return (
                  <div key={t.id} data-slot="foco-do-fechamento" className="flex items-center gap-2.5 rounded-lg border bg-card py-1.5 pr-1.5 pl-2.5 shadow-xs">
                    <PrioBadge p={t.prioridade} />
                    <Link href={`/tarefas/${t.id}`} onClick={fechar} className="min-w-0 flex-1 truncate text-[13px] font-medium hover:underline">{t.titulo}</Link>
                    <CatTag cat={categorias.find((c) => c.id === t.categoriaId)} className="hidden sm:inline-flex" />
                    <Button size="sm" variant={levado ? "secondary" : "outline"} data-slot="levar-foco" onClick={() => levar(t, levado ? hoje : f.proximo)}>
                      <ArrowRight /> {levado ? `Vai para ${proximoNome}` : `Levar para ${proximoNome}`}
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Soltar do foco" disabled={solto} onClick={() => levar(t, null)}><CircleMinus /></Button>
                  </div>
                );
              })}
              {focos.length > 1 && levados.length < focos.length && (
                <Button variant="ghost" size="sm" className="self-start" onClick={levarTodos}><ArrowRight /> Levar todos para {proximoNome}</Button>
              )}
            </div>
          </Bloco>
        )}

        {f.passosAtrasados.length > 0 && (
          <Bloco titulo="Seus passos vencidos" icone={<CalendarClock />} contagem={f.passosAtrasados.length}>
            <div className="flex flex-col">
              {f.passosAtrasados.slice(0, 8).map((x) => (
                <ItemPasso key={x.passo.id} texto={x.passo.texto} feito={x.passo.feito}
                  meta={<>{x.tarefa.titulo}</>}
                  aoAlternar={(feito) => atualizarTarefa(x.tarefa.id, (t) => comPassoAlternado(t, x.registro.id, x.passo.id, feito))} />
              ))}
              {f.passosAtrasados.length > 8 && (
                <Link href="/pendencias" onClick={fechar} className="mt-1 text-xs text-muted-foreground hover:underline">e mais {f.passosAtrasados.length - 8} em Pendências</Link>
              )}
            </div>
          </Bloco>
        )}

        {f.impedimentos.length > 0 && (
          <Bloco titulo="Impedimentos" icone={<OctagonAlert />} contagem={f.impedimentos.length}>
            <ul className="flex flex-col gap-1 text-[13px] leading-snug">
              {f.impedimentos.slice(0, 8).map((i) => (
                <li key={i.tarefa.id}><span className="font-medium">{i.tarefa.titulo}</span><span className="text-muted-foreground">: {i.texto}</span></li>
              ))}
            </ul>
          </Bloco>
        )}

        <Bloco titulo="Daily" icone={<ClipboardCopy />}>
          <pre data-slot="texto-daily" tabIndex={0}
            className="max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 font-sans text-[12.5px] leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25">
            {daily}
          </pre>
          <p className="text-xs text-muted-foreground">Montada só com o que está registrado. Amanhã cedo dá para copiar de novo pela tela Hoje.</p>
        </Bloco>
      </DialogBody>

      <DialogFooter className="justify-between gap-4">
        <CampoSwitch marcado={prefOk.abrirAoSair} aoMudar={(v) => setPref({ abrirAoSair: v })}
          className="min-w-0 [&_label]:truncate [&_label]:text-xs">
          Abrir ao encerrar o dia
        </CampoSwitch>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" data-slot="copiar-daily" onClick={copiarDaily}><ClipboardCopy /> Copiar daily</Button>
          <Button data-foco-inicial data-slot="fechar-o-dia" onClick={encerrar}>
            {pontoAberto ? <><LogOut /> Bater a saída e fechar</> : "Pronto"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
