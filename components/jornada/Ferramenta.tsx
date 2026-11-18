"use client";

// A rotina fora da tela dela: a ficha da barra superior (o bloco de agora, quanto falta e a hora de sair),
// os avisos de bloco que começa ou está acabando e o cartão da tela Hoje.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast as sonner } from "sonner";
import { ArrowRight, CalendarClock, Coffee, LogIn, LogOut, Play } from "lucide-react";
import { useHoje } from "@/components/useHoje";
import { Painel } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/diversos";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { avisosDoMinuto, blocoNoInstante, blocosDoDia, contarPonto, duracao, emHora, emMinutos, pausaPlanejada } from "@/lib/jornada";
import { gravarPref, lerPref, usePref } from "@/lib/preferencias";
import type { BlocoDaJornada } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { VISUAL_DO_BLOCO, horaDeAgora, useJornada, useMinuto, usePonto } from "./pecas";
import { useEncerrarDia } from "@/components/rotina/FecharDia";

const ficha =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border bg-muted/40 px-2 text-xs text-muted-foreground transition-[border-color,color,background-color,transform] duration-150 outline-none sem-selecao hover:border-ring/40 hover:bg-muted/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-[0.97] data-[state=open]:border-ring/50 data-[state=open]:text-foreground";

/** A rotina de hoje, pronta para mostrar: o bloco de agora, o próximo e a conta do ponto. */
export function useRotinaDeHoje() {
  const hoje = useHoje();
  const agora = useMinuto();
  const { jornada, pronta } = useJornada();
  return useMemo(() => {
    const dia = jornada.dias.get(hoje);
    const { blocos } = blocosDoDia(jornada, hoje);
    return { hoje, agora, pronta, dia, blocos, conta: contarPonto(jornada.config, dia, hoje, agora), pausaDoDia: pausaPlanejada(jornada.config, dia), ...blocoNoInstante(blocos, agora) };
  }, [jornada, hoje, agora, pronta]);
}

function LinhaDoBloco({ rotulo, bloco, detalhe, parte }: { rotulo: string; bloco: BlocoDaJornada; detalhe: string; parte?: number }) {
  const v = VISUAL_DO_BLOCO[bloco.tipo];
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-medium">
        <v.icone className={cn("size-3.5 shrink-0", v.texto)} />
        <span className="min-w-0 flex-1 truncate">{bloco.titulo || v.nome}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{detalhe}</span>
      </p>
      {parte != null && <Progress valor={parte} className="mt-1.5 h-1" />}
    </div>
  );
}

/** Os botões do ponto de hoje, do jeito que o momento pede. */
function AcoesDoPonto({ compacto }: { compacto?: boolean }) {
  const { hoje, conta, dia } = useRotinaDeHoje();
  const ponto = usePonto(hoje);
  const encerrar = useEncerrarDia(hoje);
  const tamanho = compacto ? "sm" : "default";
  if (conta.estado === "sem-registro") return <Button size={tamanho} data-slot="rapido-entrada" onClick={() => ponto.entrar()}><LogIn /> Entrei agora ({horaDeAgora()})</Button>;
  if (conta.estado !== "aberto") return null;
  const emPausa = dia?.ponto.pausas.some((q) => !q.fim);
  return (
    <>
      {emPausa ? (
        <Button size={tamanho} data-slot="rapido-voltar" onClick={() => ponto.voltar()}><Play /> Voltei da pausa</Button>
      ) : (
        <Button size={tamanho} variant="outline" data-slot="rapido-pausa" onClick={() => ponto.pausar()}><Coffee /> Pausa</Button>
      )}
      <Button size={tamanho} variant={conta.falta === 0 && !emPausa ? "default" : "outline"} data-slot="rapido-saida" onClick={() => void encerrar()}><LogOut /> Encerrar o dia</Button>
    </>
  );
}

/** A conta do ponto de hoje em uma linha. */
function textoDoPonto(r: ReturnType<typeof useRotinaDeHoje>) {
  const { conta, dia } = r;
  if (conta.estado === "sem-registro") return conta.esperado > 0 ? "Entrada ainda não registrada" : "Hoje não é dia de expediente";
  if (conta.estado === "fechado") return `${dia?.ponto.entrada} a ${dia?.ponto.saida} · ${duracao(conta.trabalhado)} trabalhadas`;
  if (conta.saidaPrevista == null) return `Entrada ${dia?.ponto.entrada} · ${duracao(conta.trabalhado)} de hora extra`;
  return conta.extra > 0
    ? `Entrada ${dia?.ponto.entrada} · ${duracao(conta.extra)} de hora extra`
    : `Entrada ${dia?.ponto.entrada} · sai às ${emHora(conta.saidaPrevista)} · faltam ${duracao(conta.falta)}`;
}

// =====================================================================
// Ficha da barra superior
// =====================================================================

export function FerramentaRotina() {
  const r = useRotinaDeHoje();
  const [aberto, setAberto] = useState(false);
  const { atual, restante, proximo, emQuanto, conta } = r;
  const rotulo = atual
    ? { nome: atual.titulo || VISUAL_DO_BLOCO[atual.tipo].nome, extra: duracao(restante) }
    : conta.estado === "aberto" && conta.saidaPrevista != null
      ? { nome: conta.extra > 0 ? "Hora extra" : "Sai às", extra: conta.extra > 0 ? duracao(conta.extra) : emHora(conta.saidaPrevista) }
      : proximo
        ? { nome: proximo.titulo || VISUAL_DO_BLOCO[proximo.tipo].nome, extra: proximo.inicio }
        : { nome: "Rotina", extra: "" };
  const dica = atual ? `Agora: ${atual.titulo || "bloco sem nome"}, até as ${atual.fim}` : proximo ? `Próximo bloco: ${proximo.titulo || "sem nome"}, às ${proximo.inicio}` : "Rotina de hoje: blocos de horário e ponto";
  const duracaoDoAtual = atual ? emMinutos(atual.fim) - emMinutos(atual.inicio) : 0;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto={dica}>
        <PopoverTrigger asChild>
          <button type="button" data-slot="ferramenta-rotina" data-agora={atual ? atual.id : undefined} aria-label="Rotina de hoje" className={cn(ficha, "hidden md:inline-flex")}>
            <CalendarClock className={cn("size-3.5", atual && VISUAL_DO_BLOCO[atual.tipo].texto, !atual && conta.extra > 0 && conta.estado === "aberto" && "text-alerta")} />
            <span className="max-w-32 truncate">{rotulo.nome}</span>
            {rotulo.extra && <span className="tabular-nums text-foreground/80">{rotulo.extra}</span>}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" data-slot="popover" className="w-[340px] p-0">
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
          <CalendarClock className="size-3.5 text-primary" />
          <p className="flex-1 text-[13px] font-semibold tracking-tight">Rotina de hoje</p>
          <Button asChild variant="ghost" size="sm" onClick={() => setAberto(false)}><Link href="/rotina">Abrir <ArrowRight /></Link></Button>
        </div>
        <div data-slot="rotina-rapida" className="flex flex-col gap-2 p-3">
          {atual && <LinhaDoBloco rotulo="Agora" bloco={atual} detalhe={`até ${atual.fim} · faltam ${duracao(restante)}`} parte={duracaoDoAtual ? ((duracaoDoAtual - restante) / duracaoDoAtual) * 100 : 0} />}
          {proximo && <LinhaDoBloco rotulo={atual ? "Depois" : "Próximo bloco"} bloco={proximo} detalhe={`às ${proximo.inicio} · em ${duracao(emQuanto)}`} />}
          {!atual && !proximo && (
            <p className="px-0.5 text-xs leading-snug text-muted-foreground">
              {r.blocos.length ? "O plano de hoje acabou." : "Nenhum bloco planejado para hoje. Na tela Rotina você reserva horários para tarefas, chamados e pausas."}
            </p>
          )}
          <div className="mt-1 border-t pt-2.5">
            <p data-slot="rotina-rapida-ponto" className="px-0.5 text-xs text-muted-foreground tabular-nums">{textoDoPonto(r)}</p>
            <div className="mt-2 flex flex-wrap gap-2 empty:hidden"><AcoesDoPonto compacto /></div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================
// Avisos
// =====================================================================

interface Avisados { data: string; chaves: string[] }
const lerAvisados = (hoje: string): Set<string> => {
  const v = lerPref<Partial<Avisados> | null>("jornadaAvisados", null);
  return new Set(v && v.data === hoje && Array.isArray(v.chaves) ? v.chaves.filter((c) => typeof c === "string") : []);
};

/**
 * Avisa quando um bloco começa, quando está acabando, quando a jornada se completa e quando a pausa
 * termina. Cada aviso aparece uma vez por dia (o que já foi avisado fica no navegador). Montado no Shell.
 */
export function AvisosDaJornada() {
  const r = useRotinaDeHoje();
  const router = useRouter();
  const [ligado] = usePref<boolean>("jornadaAvisos", true);
  const { hoje, agora, pronta, blocos, conta, dia, pausaDoDia } = r;
  useEffect(() => {
    if (!pronta || ligado === false || dia?.folga) return;
    const avisos = avisosDoMinuto(blocos, conta, dia, pausaDoDia, agora);
    if (!avisos.length) return;
    const ja = lerAvisados(hoje);
    const novos = avisos.filter((a) => !ja.has(a.chave));
    if (!novos.length) return;
    gravarPref<Avisados>("jornadaAvisados", { data: hoje, chaves: [...ja, ...novos.map((a) => a.chave)].slice(-300) });
    for (const a of novos) sonner(a.titulo, { description: a.detalhe, duration: 12000, action: { label: "Ver a rotina", onClick: () => router.push("/rotina") } });
  }, [pronta, ligado, hoje, agora, blocos, conta, dia, pausaDoDia, router]);
  return null;
}

// =====================================================================
// Cartão da tela Hoje
// =====================================================================

export function CartaoDaRotina() {
  const r = useRotinaDeHoje();
  const { atual, restante, proximo, emQuanto } = r;
  return (
    <Painel titulo="Rotina de hoje" icone={<CalendarClock />} acoes={<Button asChild variant="ghost" size="sm"><Link href="/rotina">Abrir <ArrowRight /></Link></Button>}>
      <div data-slot="cartao-da-rotina" className="flex flex-col gap-2 p-3">
        {atual && <LinhaDoBloco rotulo="Agora" bloco={atual} detalhe={`faltam ${duracao(restante)}`} />}
        {proximo && <LinhaDoBloco rotulo={atual ? "Depois" : "Próximo bloco"} bloco={proximo} detalhe={`às ${proximo.inicio}${atual ? "" : ` · em ${duracao(emQuanto)}`}`} />}
        {!atual && !proximo && <p className="px-0.5 text-xs leading-snug text-muted-foreground">{r.blocos.length ? "O plano de hoje acabou." : "Nenhum bloco planejado para hoje."}</p>}
        <p data-slot="cartao-da-rotina-ponto" className="px-0.5 text-xs text-muted-foreground tabular-nums">{textoDoPonto(r)}</p>
        <div className="flex flex-wrap gap-2 empty:hidden"><AcoesDoPonto compacto /></div>
      </div>
    </Painel>
  );
}
