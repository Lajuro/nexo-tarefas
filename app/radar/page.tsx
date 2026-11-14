"use client";

// Radar das frentes: a saúde de cada assunto (categoria), os prazos das próximas semanas e um status
// em texto para mandar ao gestor, sem IA. Tudo é conta feita na hora em lib/radar.ts; nada é gravado.

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlarmClock, CircleAlert, CircleCheckBig, CirclePause, Copy, Flag, Hourglass, type LucideIcon, OctagonAlert, Radar as IconeRadar, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useHoje } from "@/components/useHoje";
import { Estatistica, Pagina, PontoCor, Secao, Vazio, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { type Frente, type ItemPrazo, type Saude, colunaDoPrazo, montarRadar, nomeSaude, textoDoRadar } from "@/lib/radar";
import { formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const VISUAL: Record<Saude, { icone: LucideIcon; selo: string; texto: string }> = {
  risco: { icone: OctagonAlert, selo: "border-destructive/30 bg-destructive/10 text-destructive", texto: "text-destructive" },
  parada: { icone: CirclePause, selo: "border-border bg-muted text-muted-foreground", texto: "text-muted-foreground" },
  atencao: { icone: TriangleAlert, selo: "border-alerta/30 bg-alerta/10 text-alerta", texto: "text-alerta" },
  em_dia: { icone: ShieldCheck, selo: "border-sucesso/30 bg-sucesso/10 text-sucesso", texto: "text-sucesso" },
  sem_abertas: { icone: CircleCheckBig, selo: "border-border bg-muted/60 text-muted-foreground", texto: "text-muted-foreground" },
};

const ICONE_PRAZO: Record<ItemPrazo["tipo"], LucideIcon> = { tarefa: Flag, passo: CircleCheckBig, lembrar: AlarmClock };
const ROTULO_PRAZO: Record<ItemPrazo["tipo"], string> = { tarefa: "Prazo da tarefa", passo: "Passo", lembrar: "Follow-up" };

function SeloSaude({ saude }: { saude: Saude }) {
  const v = VISUAL[saude];
  return (
    <span data-slot="saude" data-saude={saude} className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium sem-selecao", v.selo)}>
      <v.icone className="size-3" /> {nomeSaude(saude)}
    </span>
  );
}

/** Movimento das últimas semanas: uma barra por semana, a atual em destaque. */
function Movimento({ semanas }: { semanas: number[] }) {
  const maior = Math.max(1, ...semanas);
  return (
    <div data-slot="movimento" className="flex h-8 items-end gap-1" role="img" aria-label={`Movimento nas últimas ${semanas.length} semanas: ${semanas.join(", ")}`}>
      {semanas.map((n, i) => {
        const atras = semanas.length - 1 - i;
        return (
          <Dica key={i} texto={`${atras === 0 ? "Esta semana" : atras === 1 ? "Semana passada" : `Há ${atras} semanas`}: ${n} ${n === 1 ? "movimento" : "movimentos"}`}>
            <div className="flex h-full flex-1 items-end">
              <div className={cn("w-full rounded-t-[3px] transition-[height] duration-500 ease-out", n ? (atras === 0 ? "bg-primary" : "bg-primary/40") : "bg-muted")}
                style={{ height: `${n ? Math.max(14, (n / maior) * 100) : 8}%` }} />
            </div>
          </Dica>
        );
      })}
    </div>
  );
}

function CartaoFrente({ f, aoCopiar }: { f: Frente; aoCopiar: () => void }) {
  const href = f.id ? `/categorias/${f.id}` : "/tarefas";
  const numeros: { n: number; rotulo: string; classe?: string }[] = [
    { n: f.abertas.length, rotulo: f.abertas.length === 1 ? "aberta" : "abertas" },
    { n: f.atrasadas.length, rotulo: f.atrasadas.length === 1 ? "atrasada" : "atrasadas", classe: "text-destructive" },
    { n: f.bloqueadas.length, rotulo: f.bloqueadas.length === 1 ? "bloqueada" : "bloqueadas", classe: "text-destructive" },
    { n: f.aguardando.length, rotulo: "aguardando", classe: "text-alerta" },
  ].filter((x, i) => i === 0 || x.n > 0);
  return (
    <motion.article variants={itemLista} data-slot="frente" data-saude={f.saude} className="flex flex-col rounded-xl border bg-card shadow-xs">
      <header className="flex items-start gap-2 px-3.5 pt-3">
        <PontoCor cor={f.cor} className="mt-1.5 size-2.5" />
        <Link href={href} className="min-w-0 flex-1 rounded text-[13px] leading-snug font-semibold tracking-tight outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
          {f.nome}
        </Link>
        <SeloSaude saude={f.saude} />
      </header>

      <div className="flex flex-1 flex-col gap-2.5 px-3.5 pt-2 pb-3">
        {f.motivos.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {f.motivos.slice(0, 3).map((m) => (
              <li key={m} className="flex items-start gap-1.5 text-xs leading-snug">
                <CircleAlert className={cn("mt-px size-3 shrink-0", VISUAL[f.saude].texto)} />
                <span className="min-w-0">{m}</span>
              </li>
            ))}
            {f.motivos.length > 3 && <li className="pl-[18px] text-[11px] text-muted-foreground">e mais {f.motivos.length - 3}</li>}
          </ul>
        ) : (
          <p className="text-xs leading-snug text-muted-foreground">
            {f.saude === "sem_abertas" ? "Nada em aberto neste assunto." : "Sem atraso, bloqueio nem pendência vencida."}
          </p>
        )}

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {numeros.map((x) => (
            <span key={x.rotulo}><span className={cn("text-sm font-semibold tabular-nums text-foreground", x.n > 0 && x.classe)}>{x.n}</span> {x.rotulo}</span>
          ))}
          {f.concluidas30 > 0 && <span><span className="text-sm font-semibold tabular-nums text-sucesso">{f.concluidas30}</span> {f.concluidas30 === 1 ? "concluída" : "concluídas"} no mês</span>}
        </div>

        <div className="mt-auto flex items-end gap-3 pt-1">
          <div className="w-28 shrink-0"><Movimento semanas={f.semanas} /></div>
          <div className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
            {f.proximoPrazo && (
              <div className="truncate"><Flag className="mr-1 inline size-3 align-[-2px]" />{formatarData(f.proximoPrazo.data, false)} · {f.proximoPrazo.tarefa.titulo}</div>
            )}
            {f.aguardando[0]?.esperando?.quem && (
              <div className="truncate"><Hourglass className="mr-1 inline size-3 align-[-2px]" />esperando {f.aguardando[0].esperando.quem}</div>
            )}
            <div className="truncate">{f.ultima ? `Último movimento ${dataRelativa(f.ultima)}` : "Sem movimento registrado"}</div>
          </div>
          <Dica texto="Copiar o status desta frente">
            <Button variant="ghost" size="icon-sm" className="-mr-1.5 -mb-1 shrink-0" aria-label={`Copiar o status de ${f.nome}`} onClick={aoCopiar}><Copy /></Button>
          </Dica>
        </div>
      </div>
    </motion.article>
  );
}

function Chip({ item }: { item: ItemPrazo }) {
  const Icone = ICONE_PRAZO[item.tipo];
  return (
    <Dica texto={`${ROTULO_PRAZO[item.tipo]} em ${formatarData(item.data)}: ${item.titulo}${item.tipo !== "tarefa" ? ` (${item.tarefaTitulo})` : ""}`}>
      <Link
        href={`/tarefas/${item.tarefaId}`}
        data-slot="prazo"
        data-tipo={item.tipo}
        className={cn(
          "flex h-6 min-w-0 items-center gap-1 rounded-md border px-1.5 text-[11px] leading-none transition-colors outline-none hover:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/40",
          item.atrasado ? "border-destructive/30 bg-destructive/10 text-destructive" : item.tipo === "tarefa" ? "border-primary/25 bg-primary/10 text-foreground" : "bg-background text-muted-foreground",
        )}
      >
        <Icone className="size-3 shrink-0" />
        <span className="shrink-0 tabular-nums">{formatarData(item.data, false)}</span>
        <span className="truncate">{item.titulo}</span>
      </Link>
    </Dica>
  );
}

export default function PaginaRadar() {
  const { dados, toast } = useNexo();
  const hoje = useHoje();
  const [filtro, setFiltro] = useState<Saude | null>(null);
  const radar = useMemo(() => (dados ? montarRadar(dados, hoje) : null), [dados, hoje]);

  if (!radar) return <Pagina titulo="Radar das frentes"><span /></Pagina>;

  const visiveis = filtro ? radar.frentes.filter((f) => f.saude === filtro) : radar.frentes;
  const copiar = async (ids: (string | null)[] | null, oQue: string) => {
    if (await copiarTexto(textoDoRadar(radar, ids))) toast(`${oQue} copiado.`);
  };

  const linhas = radar.frentes
    .map((f) => ({ f, itens: radar.prazos.filter((p) => p.frenteId === f.id) }))
    .filter((x) => x.itens.length > 0);
  const colunas = [-1, ...radar.semanas.map((_, i) => i)];
  const temAtraso = radar.prazos.some((p) => p.atrasado);
  const colunasVisiveis = temAtraso ? colunas : colunas.slice(1);

  return (
    <Pagina
      titulo="Radar das frentes"
      descricao="Como está cada assunto, sem abrir tarefa por tarefa."
      acoes={
        <Dica texto="Texto simples com o status de cada frente, pronto para mandar. Sem IA: só o que está registrado.">
          <Button data-slot="copiar-status" disabled={!radar.frentes.length}
            onClick={() => copiar(filtro ? visiveis.map((f) => f.id) : null, filtro ? `Status das frentes "${nomeSaude(filtro).toLowerCase()}"` : "Status das frentes")}>
            <Copy /> Copiar status
          </Button>
        </Dica>
      }
    >
      {radar.frentes.length === 0 ? (
        <Vazio titulo="Nenhuma frente ainda" icone={<IconeRadar />}>
          <p>O radar mostra uma frente por categoria. Crie categorias e ponha as tarefas nelas para ver a saúde de cada assunto.</p>
          <Button asChild><Link href="/categorias">Ir para Categorias</Link></Button>
        </Vazio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["risco", "atencao", "parada", "em_dia"] as const).map((s) => (
              <Estatistica key={s} rotulo={nomeSaude(s)} valor={radar.contagem[s]} icone={(() => { const I = VISUAL[s].icone; return <I />; })()}
                tom={s === "risco" ? "perigo" : s === "atencao" ? "alerta" : s === "em_dia" ? "sucesso" : "neutro"}
                ativo={filtro === s} aoClicar={() => setFiltro(filtro === s ? null : s)} />
            ))}
          </div>

          <Secao titulo={filtro ? `Frentes: ${nomeSaude(filtro).toLowerCase()}` : "Frentes"} contagem={visiveis.length}
            acoes={filtro && <Button variant="ghost" size="sm" onClick={() => setFiltro(null)}>Mostrar todas</Button>}>
            {visiveis.length === 0 ? (
              <Vazio compacto titulo="Nenhuma frente assim agora" />
            ) : (
              <motion.div key={filtro ?? "todas"} variants={lista} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visiveis.map((f) => (
                  <CartaoFrente key={f.id ?? "sem"} f={f} aoCopiar={() => copiar([f.id], `Status de ${f.nome}`)} />
                ))}
              </motion.div>
            )}
          </Secao>

          <Secao titulo="Prazos das próximas semanas" contagem={radar.prazos.length}>
            {linhas.length === 0 ? (
              <Vazio compacto titulo="Nenhum prazo nas próximas semanas">
                <p>Prazos de tarefa, de passo e follow-ups aparecem aqui, por frente e por semana.</p>
              </Vazio>
            ) : (
              <div data-slot="linha-de-prazos" className="overflow-x-auto rounded-xl border bg-card shadow-xs">
                <div className="grid min-w-[860px] text-xs" style={{ gridTemplateColumns: `minmax(140px, 1.1fr) repeat(${colunasVisiveis.length}, minmax(0, 1fr))` }}>
                  <div className="border-b bg-muted/40 px-3 py-2 font-medium text-muted-foreground sem-selecao">Frente</div>
                  {colunasVisiveis.map((c) => (
                    <div key={c} className={cn("border-b border-l bg-muted/40 px-2 py-2 font-medium sem-selecao", c === -1 ? "text-destructive" : c === 0 ? "text-foreground" : "text-muted-foreground")}>
                      {c === -1 ? "Atrasado" : c === 0 ? "Esta semana" : <span className="tabular-nums">{formatarData(radar.semanas[c].inicio, false)} a {formatarData(radar.semanas[c].fim, false)}</span>}
                    </div>
                  ))}
                  {linhas.map(({ f, itens }, i) => (
                    <div key={f.id ?? "sem"} className="contents" data-slot="linha-prazo">
                      <div className={cn("flex items-start gap-1.5 px-3 py-2", i > 0 && "border-t")}>
                        <PontoCor cor={f.cor} className="mt-1" />
                        <Link href={f.id ? `/categorias/${f.id}` : "/tarefas"} className="min-w-0 truncate rounded font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">{f.nome}</Link>
                      </div>
                      {colunasVisiveis.map((c) => {
                        const daqui = itens.filter((p) => colunaDoPrazo(radar, p) === c);
                        return (
                          <div key={c} className={cn("flex min-w-0 flex-col gap-1 border-l px-1.5 py-1.5", i > 0 && "border-t", c === 0 && "bg-primary/[0.03]")}>
                            {daqui.slice(0, 4).map((p, j) => <Chip key={`${p.tarefaId}:${p.tipo}:${p.data}:${j}`} item={p} />)}
                            {daqui.length > 4 && (
                              <Dica texto={daqui.slice(4).map((p) => `${formatarData(p.data, false)} ${p.titulo}`).join(" · ")}>
                                <span className="px-1 text-[11px] text-muted-foreground sem-selecao">e mais {daqui.length - 4}</span>
                              </Dica>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Secao>
        </>
      )}
    </Pagina>
  );
}
