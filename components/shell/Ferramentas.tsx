"use client";

// Ferramentas da barra superior: coisas úteis a um clique, de qualquer tela.
//   Agenda        o dia e a hora; ao abrir, os prazos das próximas duas semanas
//   FocoRapido    o foco de hoje, com os passos marcáveis ali mesmo
//   AnotarRapido  cria uma tarefa ou uma folha do bloco de notas sem sair de onde está
//   MenuMais      tema, tela cheia, atalhos e o painel "Personalizar", num botão só
// Quais aparecem é escolha do usuário (lib/moldura.ts).

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlarmClock, ArrowRight, CalendarDays, CircleCheckBig, Ellipsis, Flag, Keyboard, ListTodo, Maximize, Minimize, Monitor, Moon, NotebookPen, Palette,
  PenLine, SlidersHorizontal, Sun, Sunrise, Target, Timer,
} from "lucide-react";
import { useExecutarComando, useProximaAcao } from "@/components/hoje/ProximaAcao";
import { useNexo } from "@/components/Provider";
import { Tema, useTema } from "@/components/Raiz";
import { useHoje } from "@/components/useHoje";
import { ItemPasso } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { deISO, somarDias } from "@/components/ui/data";
import { Kbd } from "@/components/ui/diversos";
import { Input, Textarea } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger, MenuAtalho,
} from "@/components/ui/menu";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { comFoco, comPassoAlternado, tarefaRapida } from "@/lib/acoes";
import { suave } from "@/lib/animacoes";
import { aberta, dataLocal, dataRelativa, passoEhMeu, sugestoesDeFoco } from "@/lib/lembretes";
import { AbaPersonalizar, IdFerramenta, abrirPersonalizar } from "@/lib/moldura";
import { usePref } from "@/lib/preferencias";
import { paraTextoPlano } from "@/lib/texto-rico";
import { agoraISO, normalizarNota, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { iniciarSessao } from "./SessaoFoco";

const ficha =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs text-muted-foreground transition-[border-color,color,background-color,transform] duration-150 outline-none sem-selecao hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-[0.97] data-[state=open]:bg-muted data-[state=open]:text-foreground";

// =====================================================================
// Agenda
// =====================================================================

type TipoAgenda = "prazo" | "passo" | "lembrar";
interface ItemAgenda {
  chave: string;
  data: string;
  tipo: TipoAgenda;
  titulo: string;
  detalhe: string;
  href: string;
}

const VISUAL_AGENDA: Record<TipoAgenda, { icone: typeof Flag; cor: string; ponto: string; nome: string }> = {
  prazo: { icone: Flag, cor: "text-primary", ponto: "bg-primary", nome: "Prazo da tarefa" },
  passo: { icone: CircleCheckBig, cor: "text-alerta", ponto: "bg-alerta", nome: "Prazo de um passo" },
  lembrar: { icone: AlarmClock, cor: "text-info", ponto: "bg-info", nome: "Lembrete de voltar" },
};

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const DIA_NAVBAR = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" });
const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const semPonto = (s: string) => s.replace(/\./g, "");
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DIAS_NA_AGENDA = 14;

export function Agenda() {
  const { dados } = useNexo();
  const hoje = useHoje();
  const [aberta_, setAberta] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [agora, setAgora] = useState<Date | null>(null);

  // A hora só existe no cliente (o servidor não sabe o fuso): começa vazia para não divergir na hidratação.
  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!aberta_) setDia(null);
  }, [aberta_]);

  const itens = useMemo(() => {
    const out: ItemAgenda[] = [];
    for (const t of dados?.tarefas ?? []) {
      if (!aberta(t)) continue;
      if (t.prazo) out.push({ chave: `p-${t.id}`, data: t.prazo, tipo: "prazo", titulo: t.titulo, detalhe: "Prazo da tarefa", href: `/tarefas/${t.id}` });
      if (t.lembrarEm) out.push({ chave: `l-${t.id}`, data: t.lembrarEm, tipo: "lembrar", titulo: t.titulo, detalhe: "Você pediu para voltar nisso", href: `/tarefas/${t.id}` });
      for (const r of t.registros)
        for (const p of r.proximosPassos)
          if (!p.feito && p.prazo) out.push({ chave: `s-${p.id}`, data: p.prazo, tipo: "passo", titulo: p.texto, detalhe: t.titulo, href: `/tarefas/${t.id}?r=${r.id}` });
    }
    return out.sort((a, b) => a.data.localeCompare(b.data));
  }, [dados?.tarefas]);

  const fim = somarDias(hoje, DIAS_NA_AGENDA - 1);
  const dias = useMemo(() => Array.from({ length: DIAS_NA_AGENDA }, (_, i) => somarDias(hoje, i)), [hoje]);
  const atrasados = itens.filter((i) => i.data < hoje);
  const noPeriodo = itens.filter((i) => i.data >= hoje && i.data <= fim);
  const visiveis = dia ? noPeriodo.filter((i) => i.data === dia) : noPeriodo;
  const porDia = useMemo(() => {
    const m = new Map<string, ItemAgenda[]>();
    for (const i of visiveis) m.set(i.data, [...(m.get(i.data) ?? []), i]);
    return [...m.entries()];
  }, [visiveis]);

  const linha = (i: ItemAgenda) => {
    const v = VISUAL_AGENDA[i.tipo];
    return (
      <li key={i.chave}>
        <Link href={i.href} onClick={() => setAberta(false)}
          className="flex gap-2.5 rounded-md px-2 py-1.5 transition-colors outline-none hover:bg-accent focus-visible:bg-accent">
          <Dica texto={v.nome} side="left"><v.icone className={cn("mt-0.5 size-3.5 shrink-0", v.cor)} /></Dica>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block truncate text-[13px] font-medium">{i.titulo}</span>
            <span className="block truncate text-xs text-muted-foreground">{i.detalhe}</span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <Popover open={aberta_} onOpenChange={setAberta}>
      <Dica texto="Agenda: prazos das próximas duas semanas">
        <PopoverTrigger asChild>
          <button type="button" data-slot="ferramenta-agenda" aria-label="Agenda" className={cn(ficha, "hidden @[48rem]/barra:inline-flex")}>
            <CalendarDays className="size-3.5" />
            {/* Só o dia: a hora fica dentro do balão (3.9), para a barra ter espaço para as migalhas. */}
            <span className="first-letter:uppercase">{semPonto(DIA_NAVBAR.format(deISO(hoje)))}</span>
            {atrasados.length > 0 && <span aria-label={`${atrasados.length} em atraso`} className="size-1.5 rounded-full bg-destructive" />}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" className="w-[352px] p-0">
        <div className="border-b px-3.5 pt-3 pb-2.5">
          <p className="flex items-baseline gap-2 text-[13px] font-semibold tracking-tight">
            <span className="min-w-0 flex-1">{maiuscula(DIA_LONGO.format(deISO(hoje)))}</span>
            {agora && <span data-slot="agenda-hora" className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {noPeriodo.length === 0 ? "Nenhum prazo nas próximas duas semanas." : `${noPeriodo.length} ${noPeriodo.length === 1 ? "data marcada" : "datas marcadas"} nas próximas duas semanas.`}
          </p>
          <div role="group" aria-label="Escolher um dia" className="mt-2.5 grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const doDia = noPeriodo.filter((i) => i.data === d);
              const tipos = [...new Set(doDia.map((i) => i.tipo))];
              const sel = dia === d;
              return (
                <button key={d} type="button" aria-pressed={sel} aria-label={`${maiuscula(DIA_LONGO.format(deISO(d)))}, ${doDia.length} ${doDia.length === 1 ? "item" : "itens"}`}
                  onClick={() => setDia(sel ? null : d)}
                  className={cn(
                    "relative flex h-11 flex-col items-center justify-center rounded-md text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35",
                    sel ? "text-primary-foreground" : d === hoje ? "text-primary hover:bg-accent" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}>
                  {sel && <motion.span layoutId="agenda-dia" transition={{ type: "spring", stiffness: 520, damping: 38 }} className="absolute inset-0 rounded-md bg-primary-solido shadow-xs" />}
                  <span className="relative text-[11px] leading-none uppercase opacity-75">{semPonto(DIA_CURTO.format(deISO(d))).slice(0, 3)}</span>
                  <span className={cn("relative mt-0.5 text-[13px] leading-none font-medium tabular-nums", d === hoje && !sel && "font-semibold")}>{Number(d.slice(8))}</span>
                  <span className="relative mt-1 flex h-1 gap-0.5">
                    {tipos.map((t) => <span key={t} className={cn("size-1 rounded-full", sel ? "bg-primary-foreground" : VISUAL_AGENDA[t].ponto)} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {!dia && atrasados.length > 0 && (
            <div className="mb-1">
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-destructive uppercase sem-selecao">Em atraso</p>
              <ul>{atrasados.slice(0, 8).map(linha)}</ul>
              {atrasados.length > 8 && <p className="px-2 py-1 text-xs text-muted-foreground">e mais {atrasados.length - 8}. Veja todas em Hoje.</p>}
            </div>
          )}
          {porDia.map(([d, lista]) => (
            <div key={d} className="mb-1">
              <p className="px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sem-selecao">
                {semPonto(DIA_NAVBAR.format(deISO(d)))} · {dataRelativa(d)}
              </p>
              <ul>{lista.map(linha)}</ul>
            </div>
          ))}
          {porDia.length === 0 && (dia || atrasados.length === 0) && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{dia ? "Nada marcado para este dia." : "Sem prazos, passos com data ou lembretes por aqui."}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================
// Foco de hoje
// =====================================================================

export function FocoRapido({ planejarDia }: { planejarDia: () => void }) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const hoje = useHoje();
  const [aberto, setAberto] = useState(false);
  const proxima = useProximaAcao();
  const executar = useExecutarComando();

  const focos = useMemo(
    () =>
      (dados?.tarefas ?? [])
        .filter((t) => aberta(t) && t.focoEm === hoje)
        .sort((a, b) => b.prioridade - a.prioridade)
        .map((t) => ({
          t,
          // passos do usuário: os abertos e os que ele fechou hoje (para ver o que já saiu)
          passos: t.registros.flatMap((r) =>
            r.proximosPassos.filter((p) => passoEhMeu(p) && (!p.feito || dataLocal(p.feitoEm) === hoje)).map((p) => ({ r, p })),
          ),
        })),
    [dados?.tarefas, hoje],
  );
  const total = focos.reduce((n, f) => n + f.passos.length, 0);
  const feitos = focos.reduce((n, f) => n + f.passos.filter((x) => x.p.feito).length, 0);
  const sugestoes = useMemo(() => (focos.length ? [] : sugestoesDeFoco(dados?.tarefas ?? [], 3)), [dados?.tarefas, focos.length]);
  const parte = total ? feitos / total : 0;
  const c = 2 * Math.PI * 6;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto={focos.length ? "Foco de hoje: marque passos sem sair desta tela" : "Nenhum foco escolhido para hoje"}>
        <PopoverTrigger asChild>
          <button type="button" data-slot="ferramenta-foco" aria-label="Foco de hoje" className={ficha}>
            {total > 0 ? (
              <svg viewBox="0 0 16 16" className="size-3.5 -rotate-90" aria-hidden>
                <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.2" className="stroke-foreground/14" />
                <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - parte)}
                  className={cn("transition-[stroke-dashoffset] duration-500 ease-out", parte >= 1 ? "stroke-sucesso" : "stroke-primary")} />
              </svg>
            ) : (
              <Target className={cn("size-3.5", focos.length > 0 && "text-primary")} />
            )}
            <span className="hidden @[24rem]/barra:inline">Foco</span>
            {total > 0 ? <span className="tabular-nums">{feitos}/{total}<span className="hidden @[64rem]/barra:inline"> passos</span></span> : focos.length > 0 ? <span className="tabular-nums">{focos.length}</span> : null}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" data-slot="popover" className="w-[360px] p-0">
        <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
          <Target className="size-3.5 text-primary" />
          <p className="flex-1 text-[13px] font-semibold tracking-tight">Foco de hoje</p>
          {total > 0 && <span className="text-xs text-muted-foreground tabular-nums">{feitos} de {total} {total === 1 ? "passo" : "passos"}</span>}
        </div>
        {/* a mesma conta do bloco "Próxima ação" da tela Hoje: um lugar só decide o que vem agora (3.21) */}
        {proxima.agora && (
          <div data-slot="foco-proxima-acao" className="flex items-center gap-2.5 border-b bg-muted/40 px-3.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao">Próxima ação</span>
              <span className="block truncate text-[13px] font-medium">{proxima.agora.titulo}</span>
              <span className="block truncate text-xs text-muted-foreground">{proxima.agora.motivo}</span>
            </span>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => { executar(proxima.agora!.comando); setAberto(false); }}>{proxima.agora.rotulo}</Button>
          </div>
        )}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {focos.length === 0 ? (
            <div className="px-1.5 py-2">
              <p className="text-[13px] font-medium">Você ainda não escolheu o foco de hoje.</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Escolher poucas tarefas ajuda a saber o que fazer primeiro.</p>
              {sugestoes.length > 0 && (
                <ul className="mt-2.5 flex flex-col gap-1">
                  {sugestoes.map((s) => (
                    <li key={s.tarefa.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{s.tarefa.titulo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{s.motivos.join(" · ")}</span>
                      </span>
                      <Button size="sm" variant="outline"
                        onClick={async () => (await atualizarTarefa(s.tarefa.id, (x) => comFoco(x, true))) && toast("Entrou no foco de hoje.", "info")}>
                        Focar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {focos.map(({ t, passos }) => (
                  <motion.li key={t.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={suave}
                    className="rounded-lg border bg-card px-2.5 py-2">
                    <div className="flex items-center gap-1">
                      <Link href={`/tarefas/${t.id}`} onClick={() => setAberto(false)}
                        className="group/f flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-[13px] font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50">
                        <span className="min-w-0 truncate">{t.titulo}</span>
                        <ArrowRight className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] group-hover/f:translate-x-0 group-hover/f:opacity-100 group-focus-visible/f:translate-x-0 group-focus-visible/f:opacity-100" />
                      </Link>
                      <Dica texto="Começar uma sessão de foco de 25 minutos nesta tarefa">
                        <Button variant="ghost" size="icon-sm" data-slot="comecar-sessao" aria-label={`Começar sessão de foco em “${t.titulo}”`}
                          onClick={() => {
                            if (iniciarSessao(t.id, 25)) {
                              setAberto(false);
                              toast("Sessão de foco de 25 min começou. Bom trabalho!", "info");
                            } else toast("Já existe uma sessão de foco em andamento. Encerre ou registre a atual primeiro.", "erro");
                          }}>
                          <Timer />
                        </Button>
                      </Dica>
                    </div>
                    {passos.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">Sem próximo passo seu. Abra a tarefa e registre o que falta.</p>
                    ) : (
                      <div className="mt-1 flex flex-col">
                        {passos.slice(0, 6).map(({ r, p }) => (
                          <ItemPasso key={p.id} texto={p.texto} feito={p.feito}
                            aoAlternar={(feito) => atualizarTarefa(t.id, (x) => comPassoAlternado(x, r.id, p.id, feito))} />
                        ))}
                        {passos.length > 6 && <p className="pl-7 text-xs text-muted-foreground">e mais {passos.length - 6} na tarefa</p>}
                      </div>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
          <Button size="sm" variant="ghost" asChild><Link href="/" onClick={() => setAberto(false)}>Abrir Hoje</Link></Button>
          <Button size="sm" variant={focos.length ? "outline" : "default"}
            onClick={() => {
              setAberto(false);
              setTimeout(planejarDia, 120);
            }}>
            <Sunrise /> Planejar o dia
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================
// Anotar rápido
// =====================================================================

type ModoAnotar = "tarefa" | "nota";
interface Pendente { modo: ModoAnotar; tarefa: string; nota: string }
const PENDENTE_VAZIO: Pendente = { modo: "tarefa", tarefa: "", nota: "" };

/** Abre o "Anotar rápido" de qualquer lugar (atalho A). */
export function abrirAnotar() {
  window.dispatchEvent(new CustomEvent("nexo:anotar"));
}

export function AnotarRapido() {
  const { dados, estado, criarTarefa, salvarNotas, toast } = useNexo();
  const [aberto, setAberto] = useState(false);
  // O que foi digitado e ainda não virou tarefa ou folha fica no navegador: fechar o balão, apertar F5
  // ou trocar de tela não perde o texto (mesma ideia do rascunho do editor de registro).
  const [bruto, setPendente] = usePref<Partial<Pendente>>("anotarPendente", PENDENTE_VAZIO);
  const pend = { ...PENDENTE_VAZIO, ...bruto };
  const [criadas, setCriadas] = useState<{ id: string; href: string; rotulo: string; tipo: ModoAnotar }[]>([]);
  const campoTarefa = useRef<HTMLInputElement>(null);
  const campoNota = useRef<HTMLTextAreaElement>(null);
  const bloqueado = !!estado?.somenteLeitura;

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener("nexo:anotar", abrir);
    return () => window.removeEventListener("nexo:anotar", abrir);
  }, []);
  const focar = (modo: ModoAnotar) => setTimeout(() => (modo === "tarefa" ? campoTarefa.current : campoNota.current)?.focus(), 30);

  async function guardar() {
    if (pend.modo === "tarefa") {
      const titulo = pend.tarefa.trim().replace(/\s+/g, " ");
      if (!titulo) return;
      // Limpa na hora para dar para emendar a próxima; se a gravação falhar, o texto volta.
      setPendente({ ...pend, tarefa: "" });
      const criada = await criarTarefa(tarefaRapida(titulo));
      if (criada) setCriadas((l) => [{ id: criada.id, href: `/tarefas/${criada.id}`, rotulo: criada.titulo, tipo: "tarefa" as const }, ...l].slice(0, 3));
      else setPendente((p) => ({ ...PENDENTE_VAZIO, ...p, tarefa: p.tarefa || titulo }));
      focar("tarefa");
      return;
    }
    const texto = pend.nota.trim();
    if (!texto) return;
    const id = novoId("n");
    const agora = agoraISO();
    setPendente({ ...pend, nota: "" });
    if (await salvarNotas((items) => [normalizarNota({ id, titulo: "", texto, criadaEm: agora, atualizadaEm: agora }), ...items])) {
      setCriadas((l) => [{ id, href: `/notas?n=${id}`, rotulo: (paraTextoPlano(texto).split("\n")[0] || "Folha").slice(0, 80), tipo: "nota" as const }, ...l].slice(0, 3));
      toast("Folha guardada no bloco de notas.");
    } else setPendente((p) => ({ ...PENDENTE_VAZIO, ...p, nota: p.nota || texto }));
    focar("nota");
  }

  const temTexto = !!(pend.tarefa.trim() || pend.nota.trim());
  const existe = (c: { id: string; tipo: ModoAnotar }) =>
    c.tipo === "tarefa" ? dados?.tarefas.some((t) => t.id === c.id) : dados?.notas?.items.some((n) => n.id === c.id);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Dica texto="Anotar rápido: tarefa ou nota" atalho="A">
        <PopoverTrigger asChild>
          <button type="button" data-slot="ferramenta-anotar" aria-label="Anotar rápido" className={cn(ficha, "relative")}>
            <PenLine className="size-3.5" />
            <span className="hidden @[64rem]/barra:inline">Anotar</span>
            {temTexto && !aberto && <span aria-label="Tem texto esperando aqui" className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-alerta ring-2 ring-background" />}
          </button>
        </PopoverTrigger>
      </Dica>
      <PopoverContent align="end" data-slot="popover" className="w-[380px] p-3" onOpenAutoFocus={(e) => {
        e.preventDefault();
        focar(pend.modo);
      }}>
        <div className="flex items-center gap-2">
          <Segmentado<ModoAnotar>
            aria-label="O que anotar"
            tamanho="sm"
            valor={pend.modo}
            aoMudar={(modo) => {
              setPendente({ ...pend, modo });
              focar(modo);
            }}
            opcoes={[
              { valor: "tarefa", rotulo: "Tarefa", icone: <ListTodo /> },
              { valor: "nota", rotulo: "Nota", icone: <NotebookPen /> },
            ]}
          />
          <span className="flex-1" />
          <span className="flex items-center gap-1 text-xs text-muted-foreground sem-selecao">
            {pend.modo === "tarefa" ? <><Kbd>Enter</Kbd> guarda</> : <><Kbd>Ctrl</Kbd><Kbd>Enter</Kbd> guarda</>}
          </span>
        </div>
        <div className="mt-2.5">
          {pend.modo === "tarefa" ? (
            <Input ref={campoTarefa} data-slot="anotar-tarefa" aria-label="Título da tarefa" placeholder="O que precisa ser feito?" disabled={bloqueado}
              value={pend.tarefa} maxLength={300}
              onChange={(e) => setPendente({ ...pend, tarefa: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardar();
                }
              }} />
          ) : (
            <Textarea ref={campoNota} data-slot="anotar-nota" aria-label="Texto da nota" placeholder="Escreva solto. Vira uma folha do bloco de notas, para organizar depois." disabled={bloqueado}
              rows={5} value={pend.nota} className="max-h-64"
              onChange={(e) => setPendente({ ...pend, nota: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  guardar();
                }
              }} />
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            {bloqueado
              ? "Os dados estão em somente leitura."
              : pend.modo === "tarefa" ? "Entra em A fazer. Os detalhes ficam para depois." : "O que você digitar fica guardado aqui até virar folha."}
          </p>
          <Button size="sm" disabled={bloqueado || !(pend.modo === "tarefa" ? pend.tarefa.trim() : pend.nota.trim())} onClick={guardar}>Guardar</Button>
        </div>
        <AnimatePresence initial={false}>
          {criadas.filter(existe).length > 0 && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={suave}
              className="overflow-hidden">
              <li aria-hidden className="mt-2.5 mb-1 h-px bg-border" />
              {criadas.filter(existe).map((c) => (
                <motion.li key={c.id} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={suave}>
                  <Link href={c.href} onClick={() => setAberto(false)}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent">
                    {c.tipo === "tarefa" ? <ListTodo className="size-3.5 shrink-0 text-sucesso" /> : <NotebookPen className="size-3.5 shrink-0 text-sucesso" />}
                    <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
                    <span className="shrink-0 text-xs">abrir</span>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================
// Mais: o que é de uso raro fica num menu só (3.9)
// =====================================================================

/**
 * Tema, tela cheia, atalhos e Personalizar num botão só. Antes eram três botões soltos na barra
 * (aparência, tela cheia e atalhos), e cada um já tinha outro caminho (F11, tecla ?, paleta, Personalizar).
 * Tela cheia e atalhos respeitam o que o usuário escondeu em Personalizar > Superior.
 */
export function MenuMais({ cheia, telaCheia, abrirAtalhos, ocultas }: {
  cheia: boolean; telaCheia: () => void; abrirAtalhos: () => void; ocultas: IdFerramenta[];
}) {
  const { tema, resolvido, definirTema } = useTema();
  const comTelaCheia = !ocultas.includes("telaCheia");
  const comAtalhos = !ocultas.includes("ajuda");
  // Personalizar abre depois de o menu fechar, para o foco não voltar ao botão por cima do painel.
  const personalizar = (aba: AbaPersonalizar) => setTimeout(() => abrirPersonalizar(aba), 80);
  return (
    <DropdownMenu>
      <Dica texto="Mais: tema, tela cheia, atalhos e personalizar">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais opções" data-slot="menu-mais" className="data-[state=open]:bg-accent">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
      </Dica>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          {resolvido === "escuro" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />} Tema
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={tema} onValueChange={(v) => definirTema(v as Tema)}>
          <DropdownMenuRadioItem value="claro" data-slot="tema-claro"><Sun /> Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="escuro" data-slot="tema-escuro"><Moon /> Escuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="sistema" data-slot="tema-sistema"><Monitor /> Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem onSelect={() => personalizar("aparencia")}><Palette /> Cor de destaque, cantos e letra...</DropdownMenuItem>
        {(comTelaCheia || comAtalhos) && <DropdownMenuSeparator />}
        {comTelaCheia && (
          <DropdownMenuItem data-slot="mais-tela-cheia" onSelect={telaCheia}>
            {cheia ? <Minimize /> : <Maximize />} {cheia ? "Sair da tela cheia" : "Tela cheia"} <MenuAtalho>F11</MenuAtalho>
          </DropdownMenuItem>
        )}
        {comAtalhos && (
          <DropdownMenuItem data-slot="mais-atalhos" onSelect={() => setTimeout(abrirAtalhos, 80)}><Keyboard /> Ajuda desta tela e atalhos <MenuAtalho>?</MenuAtalho></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-slot="mais-personalizar" onSelect={() => personalizar("superior")}><SlidersHorizontal /> Personalizar as barras...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
