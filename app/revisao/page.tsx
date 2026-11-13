"use client";

// Revisão semanal: uma passada guiada por todas as tarefas abertas, uma por vez,
// das mais esquecidas para as mais recentes. Abertura → passo a passo → fechamento.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  ArrowLeft, ArrowRight, CalendarCheck2, Check, CheckCheck, CircleCheck, CirclePlus, Inbox, ListChecks, NotebookText,
  PartyPopper, RotateCcw, Sunrise, Trash2, X,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { abrirNovaTarefa, abrirPlanejarDia } from "@/components/Shell";
import { Estatistica, Pagina, PontoCor, PrazoTag, PrioBadge, Secao, StatusBadge, Vazio } from "@/components/comum";
import { CartaoRevisao } from "@/components/revisao/CartaoRevisao";
import { Retrato, filaDeRevisao, mudancasDesde, retratoDaSemana, tirarRetrato } from "@/components/revisao/retrato";
import { Button } from "@/components/ui/button";
import { dataPorExtenso, somarDias } from "@/components/ui/data";
import { Badge, Kbd, Progress } from "@/components/ui/diversos";
import { curva, itemLista, lista, subir } from "@/lib/animacoes";
import { LIMITES, dataRelativa, diasSemAtividade } from "@/lib/lembretes";
import { useRotina } from "@/lib/preferencias";
import { Categoria, Tarefa, diasAte, formatarData, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Fase = "abertura" | "passos" | "fim";

/** O que é guardado de cada tarefa no começo, para comparar no fim. */
interface Inicial {
  titulo: string;
  retrato: Retrato;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O elemento focado deve tratar a tecla ele mesmo (em vez de a revisão navegar)? */
function controleQuerATecla(alvo: EventTarget | null, tecla: string) {
  if (!(alvo instanceof HTMLElement) || alvo === document.body) return false;
  if (alvo.closest("input, textarea, select, [contenteditable='true']")) return true;
  if (!alvo.matches(":focus-visible")) return false;
  return tecla === "Enter"
    ? Boolean(alvo.closest("button, a, summary, [role='button'], [role='checkbox'], [role='switch'], [role='combobox'], [role='radio']"))
    : Boolean(alvo.closest("[role='radiogroup'], [role='slider'], [role='tablist']"));
}

const deslizar: Variants = {
  entra: (d: number) => ({ opacity: 0, x: d * 56 }),
  centro: { opacity: 1, x: 0, transition: { duration: 0.22, ease: curva } },
  sai: (d: number) => ({ opacity: 0, x: d * -56, transition: { duration: 0.12, ease: "easeIn" } }),
};

export default function Revisao() {
  const { dados } = useNexo();
  const { rotina, setRotina, carregado } = useRotina();
  const [fase, setFase] = useState<Fase>("abertura");
  const [fila, setFila] = useState<string[]>([]);
  const [inicial, setInicial] = useState<Record<string, Inicial>>({});
  const [[indice, dir], setPos] = useState<[number, number]>([0, 1]);
  const rolagem = useRef<HTMLDivElement>(null);

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados]);
  const porId = useMemo(() => new Map(tarefas.map((t) => [t.id, t])), [tarefas]);
  const catPorId = useMemo(() => new Map((dados?.categorias.items ?? []).map((c) => [c.id, c])), [dados]);
  const abertas = useMemo(() => filaDeRevisao(tarefas), [tarefas]);
  const semana = useMemo(() => retratoDaSemana(tarefas), [tarefas]);

  const comecar = useCallback(
    (noIndice = 0) => {
      // A fila é congelada aqui: mexer nas tarefas durante a revisão não muda a ordem nem tira ninguém da lista.
      setFila(abertas.map((t) => t.id));
      setInicial(Object.fromEntries(abertas.map((t) => [t.id, { titulo: t.titulo, retrato: tirarRetrato(t) }])));
      setPos([noIndice, 1]);
      setFase("passos");
    },
    [abertas],
  );

  const concluir = useCallback(() => {
    setRotina((r) => ({ ...r, ultimaRevisao: hojeISO() }));
    setFase("fim");
  }, [setRotina]);

  const ir = useCallback(
    (delta: number) => {
      const alvo = indice + delta;
      if (alvo < 0) return;
      if (alvo >= fila.length) return concluir();
      setPos([alvo, delta]);
    },
    [indice, fila.length, concluir],
  );

  // Teclado: seta direita ou Enter avança, seta esquerda volta. A tecla fica com o controle quando o usuário
  // está digitando ou chegou nele pelo teclado (anel de foco visível); depois de um clique de mouse o foco
  // não aparece, então as teclas voltam a navegar. Com menu, calendário ou janela aberta, não faz nada.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Enter") return;
      if (fase === "fim" || (fase === "abertura" && (e.key !== "Enter" || !abertas.length))) return;
      if (document.querySelector("[role='dialog'], [role='alertdialog'], [role='menu'], [role='listbox']")) return;
      if (controleQuerATecla(e.target, e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (fase === "abertura") comecar();
      else ir(e.key === "ArrowLeft" ? -1 : 1);
    };
    // Na captura, para decidir antes dos controles (ex.: as setas do seletor de prioridade).
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [fase, abertas.length, comecar, ir]);

  useEffect(() => {
    rolagem.current?.scrollTo({ top: 0 });
  }, [indice, fase]);

  const resultado = useMemo(
    () => fila.map((id) => ({ id, titulo: inicial[id]?.titulo ?? "", tarefa: porId.get(id), ...mudancasDesde(inicial[id].retrato, porId.get(id)) })),
    [fila, inicial, porId],
  );

  if (!dados) return null;

  const idAtual = fila[indice];
  const atual = idAtual ? porId.get(idAtual) : undefined;
  const mexidasNaAtual = fase === "passos" && idAtual ? (resultado[indice]?.itens.length ?? 0) : 0;
  const ultima = indice === fila.length - 1;
  const revisou = rotina.ultimaRevisao && rotina.ultimaRevisao <= hojeISO() ? rotina.ultimaRevisao : "";

  return (
    <Pagina
      semRolagem
      titulo="Revisão semanal"
      descricao={
        fase === "passos" ? "Olhe cada tarefa, decida o que precisa e siga. Tudo é salvo na hora."
          : fase === "fim" ? "Tudo revisado. Nada ficou esquecido."
          : "Uma passada por tudo o que está aberto, para nada ficar esquecido."
      }
      acoes={
        fase === "passos" ? (
          <Button variant="ghost" onClick={() => setFase("abertura")}>
            <X /> Sair da revisão
          </Button>
        ) : undefined
      }
    >
      {fase === "abertura" && (
        <div data-slot="revisao-abertura" className="h-full overflow-y-auto">
          <motion.div variants={lista} initial="escondido" animate="visivel" className="mx-auto w-full max-w-[920px] px-6 pt-6 pb-12">
            <motion.section variants={itemLista} className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
              <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4 p-6">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <CalendarCheck2 className="size-6" />
                </span>
                <div className="min-w-64 flex-1">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {abertas.length ? "Hora de passar por tudo" : "Nada em aberto para revisar"}
                  </h2>
                  <p data-slot="ultima-revisao" className="mt-1 min-h-5 text-[13px] text-muted-foreground">
                    {!carregado ? "" : revisou ? (
                      <>
                        Sua última revisão foi <strong className="font-semibold text-foreground">{dataRelativa(revisou)}</strong> ({formatarData(revisou)}).
                        {-(diasAte(revisou) ?? 0) >= 7 && <span className="text-alerta"> Já passou de uma semana.</span>}
                      </>
                    ) : "Você ainda não fez uma revisão. A primeira é a que mais ajuda."}
                  </p>
                  {abertas.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      <strong data-slot="total-revisao" className="font-semibold text-foreground tabular-nums">{plural(abertas.length, "tarefa aberta", "tarefas abertas")}</strong>{" "}
                      {abertas.length === 1 ? "será revisada" : "serão revisadas"}, das mais esquecidas para as mais recentes.
                    </p>
                  )}
                </div>
                {abertas.length > 0 ? (
                  <Button size="lg" data-slot="comecar-revisao" onClick={() => comecar()}>
                    Começar revisão <Kbd className="border-white/20 bg-white/15 text-white">Enter</Kbd>
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => abrirNovaTarefa()}><CirclePlus /> Nova tarefa</Button>
                    <Button asChild><Link href="/">Ir para Hoje</Link></Button>
                  </div>
                )}
              </div>
            </motion.section>

            <motion.div variants={itemLista} className="mt-8">
              <Secao titulo="Retrato da semana" acoes={<span className="text-xs text-muted-foreground tabular-nums">de {formatarData(semana.desde, false)} até hoje</span>}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Estatistica rotulo="Tarefas concluídas" valor={semana.concluidas} tom="sucesso" icone={<CircleCheck />} />
                  <Estatistica rotulo="Registros feitos" valor={semana.registros} tom="primario" icone={<NotebookText />} />
                  <Estatistica rotulo="Passos concluídos" valor={semana.passos} tom="sucesso" icone={<CheckCheck />} />
                  <Estatistica rotulo="Tarefas criadas" valor={semana.criadas} icone={<CirclePlus />} />
                </div>
              </Secao>
            </motion.div>

            <motion.div variants={itemLista} className="mt-8">
              {abertas.length === 0 ? (
                <Vazio titulo="Nenhuma tarefa aberta" icone={<Inbox />}>
                  <p>Quando houver tarefas a fazer, em andamento, aguardando ou bloqueadas, a revisão passa por todas elas.</p>
                </Vazio>
              ) : (
                <Secao titulo="Fila da revisão" contagem={abertas.length} acoes={<span className="text-xs text-muted-foreground">clique para começar por uma tarefa</span>}>
                  <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
                    {abertas.map((t, i) => (
                      <LinhaFila key={t.id} t={t} cat={catPorId.get(t.categoriaId ?? "")} aoClicar={() => comecar(i)} />
                    ))}
                  </ul>
                </Secao>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}

      {fase === "passos" && (
        <div data-slot="revisao-passos" className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 px-6 pt-4">
            <div className="mx-auto flex w-full max-w-[1000px] items-center gap-3 sem-selecao">
              <span data-slot="revisao-posicao" className="text-[13px] font-semibold whitespace-nowrap tabular-nums">
                {indice + 1} de {fila.length}
              </span>
              <Progress valor={((indice + 1) / fila.length) * 100} />
              <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {ultima ? "última tarefa" : `${plural(fila.length - indice - 1, "restante", "restantes")}`}
              </span>
            </div>
          </div>

          <div ref={rolagem} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pt-4 pb-6">
            <div className="mx-auto w-full max-w-[1000px]">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div key={idAtual} custom={dir} variants={deslizar} initial="entra" animate="centro" exit="sai">
                  {atual ? (
                    <CartaoRevisao tarefa={atual} antes={inicial[idAtual].retrato} categoria={catPorId.get(atual.categoriaId ?? "")} />
                  ) : (
                    <Vazio titulo="Esta tarefa saiu da lista" icone={<Trash2 />}>
                      <p>“{inicial[idAtual]?.titulo}” foi movida para a lixeira durante a revisão. Dá para restaurar em Configurações.</p>
                    </Vazio>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer className="shrink-0 border-t bg-background/80 px-6 py-3 backdrop-blur-sm">
            <div className="mx-auto flex w-full max-w-[1000px] items-center gap-3">
              <Button variant="outline" data-slot="revisao-anterior" disabled={indice === 0} onClick={() => ir(-1)}>
                <ArrowLeft /> Anterior
              </Button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-3 text-xs text-muted-foreground sem-selecao">
                <AnimatePresence mode="wait" initial={false}>
                  {mexidasNaAtual > 0 ? (
                    <motion.span key="mexeu" data-slot="revisao-mexidas" variants={subir} initial="escondido" animate="visivel" exit="saindo"
                      className="inline-flex items-center gap-1.5 font-medium text-sucesso">
                      <Check className="size-3.5" /> {plural(mexidasNaAtual, "alteração salva", "alterações salvas")} nesta tarefa
                    </motion.span>
                  ) : (
                    <motion.span key="dica" variants={subir} initial="escondido" animate="visivel" exit="saindo" className="hidden items-center gap-1.5 md:inline-flex">
                      <Kbd>←</Kbd> volta <Kbd>→</Kbd> ou <Kbd>Enter</Kbd> avança
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Button data-slot="revisao-proxima" onClick={() => ir(1)}>
                {ultima ? <>Está em dia, concluir revisão <Check /></> : <>Está em dia, próxima <ArrowRight /></>}
              </Button>
            </div>
          </footer>
        </div>
      )}

      {fase === "fim" && (
        <Fechamento
          resultado={resultado}
          catPorId={catPorId}
          aoRefazer={() => setFase("abertura")}
        />
      )}
    </Pagina>
  );
}

function LinhaFila({ t, cat, aoClicar }: { t: Tarefa; cat?: Categoria; aoClicar: () => void }) {
  const parado = diasSemAtividade(t);
  const tom = parado >= LIMITES.parada * 2 ? "text-destructive" : parado >= LIMITES.parada ? "text-alerta" : "text-muted-foreground";
  return (
    <li>
      <MenuContextoTarefa tarefa={t}>
        <button
          type="button"
          data-slot="linha-fila"
          onClick={aoClicar}
          className="flex h-10 w-full items-center gap-3 px-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent"
        >
          <span className={cn("w-16 shrink-0 text-xs font-medium whitespace-nowrap tabular-nums", tom)}>
            {parado === 0 ? "hoje" : plural(parado, "dia", "dias")}
          </span>
          <PontoCor cor={cat?.cor} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.titulo}</span>
          <PrazoTag prazo={t.prazo} className="max-lg:hidden" />
          <StatusBadge status={t.status} />
          <PrioBadge p={t.prioridade} semDica />
        </button>
      </MenuContextoTarefa>
    </li>
  );
}

function Fechamento({
  resultado, catPorId, aoRefazer,
}: {
  resultado: { id: string; titulo: string; tarefa?: Tarefa; itens: string[]; passosConcluidos: number }[];
  catPorId: Map<string, Categoria>;
  aoRefazer: () => void;
}) {
  const alteradas = resultado.filter((r) => r.itens.length > 0);
  const passos = resultado.reduce((n, r) => n + r.passosConcluidos, 0);
  return (
    <div data-slot="revisao-fim" className="h-full overflow-y-auto">
      <motion.div variants={lista} initial="escondido" animate="visivel" className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-12">
        <motion.div variants={itemLista} className="flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 20, delay: 0.08 }}
            className="inline-flex size-14 items-center justify-center rounded-full bg-sucesso/14 text-sucesso"
          >
            <PartyPopper className="size-7" />
          </motion.span>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">Revisão concluída</h2>
          <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
            Você passou por {plural(resultado.length, "tarefa aberta", "tarefas abertas")}. A próxima revisão fica para{" "}
            <strong className="font-semibold text-foreground">{dataPorExtenso(somarDias(hojeISO(), 7))}</strong>.
          </p>
        </motion.div>

        <motion.div variants={itemLista} className="mt-6 grid grid-cols-3 gap-3">
          <Estatistica rotulo="Tarefas revisadas" valor={resultado.length} tom="primario" icone={<ListChecks />} />
          <Estatistica rotulo="Tarefas com alteração" valor={alteradas.length} icone={<RotateCcw />} />
          <Estatistica rotulo="Passos concluídos" valor={passos} tom="sucesso" icone={<CheckCheck />} />
        </motion.div>

        <motion.div variants={itemLista} className="mt-8">
          <Secao titulo="O que você mexeu" contagem={alteradas.length}>
            {alteradas.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">
                Nenhuma alteração: estava tudo em dia. Só de olhar você já garantiu que nada ficou para trás.
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
                {alteradas.map((r) => (
                  <li key={r.id} data-slot="mudanca-revisao" className="flex flex-col gap-1.5 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <PontoCor cor={catPorId.get(r.tarefa?.categoriaId ?? "")?.cor} />
                      {r.tarefa ? (
                        <Link href={`/tarefas/${r.id}`} className="min-w-0 truncate rounded-sm text-[13px] font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                          {r.tarefa.titulo}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate text-[13px] font-medium text-muted-foreground line-through">{r.titulo}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {r.itens.map((txt) => <Badge key={txt} variant="secondary">{txt}</Badge>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </motion.div>

        <motion.div variants={itemLista} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="lg"><Link href="/">Ir para Hoje <ArrowRight /></Link></Button>
          <Button variant="outline" size="lg" onClick={() => abrirPlanejarDia()}><Sunrise /> Planejar o dia</Button>
          <Button variant="ghost" size="lg" onClick={aoRefazer}><RotateCcw /> Revisar de novo</Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
