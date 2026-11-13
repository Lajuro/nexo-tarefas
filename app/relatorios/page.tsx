"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarRange, Check, CheckCheck, ChevronRight, CircleCheck, ClipboardCopy, Layers, NotebookText, Users,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import {
  AvatarPessoa, Campo, Contador, Estatistica, Pagina, PontoCor, Secao, StatusBadge, TipoBadge, Vazio, copiarTexto,
} from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmentado } from "@/components/ui/controles";
import { SeletorData, dataPorExtenso, somarDias } from "@/components/ui/data";
import { Combobox } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista } from "@/lib/animacoes";
import { dataLocal, dataRelativa } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { promptRelatorio } from "@/lib/prompts";
import { Categoria, Registro, Tarefa, formatarData, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Periodo = "7" | "15" | "30" | "mes" | "livre";
type Agrupar = "dia" | "tarefa";

/** O que fica lembrado entre visitas. As datas só valem quando o período é "livre". */
interface PrefRelatorio {
  periodo: Periodo;
  inicio: string;
  fim: string;
  categoria: string;
  agrupar: Agrupar;
}
const PREF_PADRAO: PrefRelatorio = { periodo: "7", inicio: "", fim: "", categoria: "", agrupar: "dia" };

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "15", rotulo: "15 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "livre", rotulo: "Personalizado" },
];

/** Datas de início e fim que valem para o período escolhido (sempre terminando hoje, exceto no personalizado). */
function intervalo(p: PrefRelatorio): [string, string] {
  const hoje = hojeISO();
  if (p.periodo === "livre") return [p.inicio || somarDias(hoje, -6), p.fim || hoje];
  if (p.periodo === "mes") return [`${hoje.slice(0, 8)}01`, hoje];
  return [somarDias(hoje, -(Number(p.periodo) - 1)), hoje];
}

interface Item {
  t: Tarefa;
  r: Registro;
}

const ordem = (r: Registro) => `${r.data} ${r.hora || "99:99"} ${r.criadoEm}`;
const resumoCurto = (r: Registro) => (r.resumoIA || r.anotacoes).replace(/\s+/g, " ").trim().slice(0, 160);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default function Relatorios() {
  const { dados, toast } = useNexo();
  const [pref, setPref] = usePref<PrefRelatorio>("relatorio", PREF_PADRAO);
  const [foco, setFoco] = useState("");
  const [ver, setVer] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const p = { ...PREF_PADRAO, ...pref };
  const [inicio, fim] = intervalo(p);
  const categorias = useMemo(() => dados?.categorias.items ?? [], [dados]);
  // Categoria lembrada que não existe mais volta para "Todas".
  const cat = categorias.some((c) => c.id === p.categoria) ? p.categoria : "";
  const catPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const tarefas = useMemo(() => (dados?.tarefas ?? []).filter((t) => !cat || t.categoriaId === cat), [dados, cat]);
  const itens = useMemo<Item[]>(
    () =>
      tarefas
        .flatMap((t) => t.registros.filter((r) => r.data >= inicio && r.data <= fim).map((r) => ({ t, r })))
        .sort((a, b) => ordem(a.r).localeCompare(ordem(b.r))),
    [tarefas, inicio, fim],
  );
  const prompt = useMemo(() => promptRelatorio(tarefas, categorias, inicio, fim, foco.trim()), [tarefas, categorias, inicio, fim, foco]);

  const numeros = useMemo(() => {
    const dentro = (carimbo?: string | null) => {
      const d = dataLocal(carimbo);
      return Boolean(d) && d >= inicio && d <= fim;
    };
    let passos = 0;
    let concluidas = 0;
    for (const t of tarefas) {
      if (t.status === "concluida" && dentro(t.concluidaEm)) concluidas++;
      for (const r of t.registros) for (const x of r.proximosPassos) if (x.feito && dentro(x.feitoEm)) passos++;
    }
    return {
      registros: itens.length,
      reunioes: itens.filter((i) => i.r.tipo === "reuniao").length,
      tocadas: new Set(itens.map((i) => i.t.id)).size,
      passos,
      concluidas,
    };
  }, [tarefas, itens, inicio, fim]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const i of itens) {
      const chave = p.agrupar === "dia" ? i.r.data : i.t.id;
      mapa.set(chave, [...(mapa.get(chave) ?? []), i]);
    }
    return [...mapa.entries()].map(([chave, lista]) => ({ chave, itens: lista }));
  }, [itens, p.agrupar]);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);

  if (!dados) return null;

  const mudarPeriodo = (v: Periodo) => {
    // Ao ir para "Personalizado", parte das datas que estavam na tela.
    setPref((a) => ({ ...PREF_PADRAO, ...a, periodo: v, ...(v === "livre" ? { inicio, fim } : {}) }));
  };
  const mudarInicio = (v: string) => v && setPref((a) => ({ ...PREF_PADRAO, ...a, periodo: "livre", inicio: v, fim: v > fim ? v : fim }));
  const mudarFim = (v: string) => v && setPref((a) => ({ ...PREF_PADRAO, ...a, periodo: "livre", fim: v, inicio: v < inicio ? v : inicio }));

  const copiar = async () => {
    if (await copiarTexto(prompt)) {
      setCopiado(true);
      toast("Prompt do relatório copiado. Agora é só colar no Copilot.");
    } else toast("Não consegui copiar. Abra a prévia do prompt e copie o texto por lá.", "erro");
  };

  const opcoesCategoria = categorias.map((c) => ({
    valor: c.id,
    rotulo: c.nome,
    detalhe: c.arquivada ? "arquivada" : undefined,
    render: (
      <>
        <PontoCor cor={c.cor} />
        <span className="truncate">{c.nome}</span>
      </>
    ),
  }));

  const dias = Math.round((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86400000) + 1;

  return (
    <Pagina
      titulo="Relatórios"
      descricao="Junte tudo o que aconteceu num período e peça um relatório ao Copilot. Ótimo para 1:1 e status semanal."
    >
      <section data-slot="painel-relatorio" className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3.5 p-4">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <Campo rotulo="Período" className="flex-none">
              <Segmentado aria-label="Período" valor={p.periodo} aoMudar={mudarPeriodo} opcoes={PERIODOS} className="h-8" />
            </Campo>
            <Campo rotulo="De" className="max-w-44 min-w-36">
              <SeletorData aria-label="Data inicial" valor={inicio} aoMudar={mudarInicio} limpavel={false} />
            </Campo>
            <Campo rotulo="Até" className="max-w-44 min-w-36">
              <SeletorData aria-label="Data final" valor={fim} aoMudar={mudarFim} limpavel={false} />
            </Campo>
            <span className="ml-auto hidden pb-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums xl:inline">
              {plural(dias, "dia", "dias")} no período
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            <Campo rotulo="Categoria" className="max-w-72 min-w-52">
              <Combobox
                aria-label="Categoria"
                valor={cat}
                aoMudar={(v) => setPref((a) => ({ ...PREF_PADRAO, ...a, categoria: v }))}
                opcoes={opcoesCategoria}
                placeholder="Todas"
                rotuloLimpar="Todas"
                buscaPlaceholder="Buscar categoria..."
              />
            </Campo>
            <Campo rotulo="Foco do relatório (opcional)" className="min-w-64">
              <Input value={foco} onChange={(e) => setFoco(e.target.value)} placeholder="Ex.: para minha 1:1 com o gestor; destacar riscos" />
            </Campo>
          </div>
        </div>

        <Collapsible open={ver} onOpenChange={setVer}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-xl border-t bg-muted/40 px-4 py-2.5">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="-ml-2" data-slot="ver-prompt">
                <ChevronRight className={cn("transition-transform duration-200", ver && "rotate-90")} />
                {ver ? "Esconder prompt" : "Ver prompt"}
              </Button>
            </CollapsibleTrigger>
            <span data-slot="tamanho-prompt" className="text-xs text-muted-foreground tabular-nums">
              {prompt.length.toLocaleString("pt-BR")} caracteres
            </span>
            <span className="ml-auto hidden text-xs text-muted-foreground xl:inline">
              Cole no Copilot do navegador. A resposta não fica salva no Nexo.
            </span>
            <Button
              data-slot="copiar-prompt"
              data-copiado={copiado || undefined}
              disabled={!itens.length}
              onClick={copiar}
              className={cn("ml-auto min-w-44 xl:ml-0", copiado && "bg-sucesso hover:bg-sucesso/90")}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copiado ? "ok" : "copiar"}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex"
                >
                  {copiado ? <Check /> : <ClipboardCopy />}
                </motion.span>
              </AnimatePresence>
              {copiado ? "Copiado" : "Copiar prompt"}
              <span className="rounded-full bg-white/20 px-1.5 text-[11px] leading-[18px] font-semibold tabular-nums">
                {plural(itens.length, "registro", "registros")}
              </span>
            </Button>
          </div>
          <CollapsibleContent>
            <pre data-slot="previa-prompt" className="max-h-96 overflow-auto rounded-b-xl border-t bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground/80 texto-pre">
              {prompt}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Estatistica rotulo="Registros" valor={numeros.registros} tom="primario" icone={<NotebookText className="max-xl:hidden" />} />
        <Estatistica rotulo="Reuniões" valor={numeros.reunioes} icone={<Users className="max-xl:hidden" />} />
        <Estatistica rotulo="Tarefas tocadas" valor={numeros.tocadas} icone={<Layers className="max-xl:hidden" />} />
        <Estatistica rotulo="Passos concluídos" valor={numeros.passos} tom="sucesso" icone={<CheckCheck className="max-xl:hidden" />} />
        <Estatistica rotulo="Tarefas concluídas" valor={numeros.concluidas} tom="sucesso" icone={<CircleCheck className="max-xl:hidden" />} />
      </div>

      <Secao
        titulo="O que entra no período"
        contagem={itens.length}
        acoes={
          itens.length > 0 && (
            <Segmentado
              aria-label="Agrupar por"
              tamanho="sm"
              valor={p.agrupar}
              aoMudar={(v) => setPref((a) => ({ ...PREF_PADRAO, ...a, agrupar: v }))}
              opcoes={[{ valor: "dia", rotulo: "Por dia" }, { valor: "tarefa", rotulo: "Por tarefa" }]}
            />
          )
        }
      >
        {itens.length === 0 ? (
          <Vazio titulo="Nada registrado nesse período" icone={<CalendarRange />}>
            <p>
              Nenhum registro entre {formatarData(inicio)} e {formatarData(fim)}
              {cat ? ` na categoria ${catPorId.get(cat)?.nome}` : ""}. Aumente o período ou troque a categoria.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {p.periodo !== "30" && <Button variant="outline" size="sm" onClick={() => mudarPeriodo("30")}>Ver os últimos 30 dias</Button>}
              {cat && (
                <Button variant="outline" size="sm" onClick={() => setPref((a) => ({ ...PREF_PADRAO, ...a, categoria: "" }))}>
                  Ver todas as categorias
                </Button>
              )}
            </div>
          </Vazio>
        ) : (
          <motion.div
            key={`${p.agrupar}|${inicio}|${fim}|${cat}`}
            variants={lista}
            initial="escondido"
            animate="visivel"
            className="flex flex-col gap-3"
          >
            {grupos.map((g) => (
              <motion.section key={g.chave} variants={itemLista} data-slot="grupo-relatorio" className="overflow-hidden rounded-xl border bg-card shadow-xs">
                {p.agrupar === "dia" ? <CabecalhoDia data={g.chave} n={g.itens.length} /> : <CabecalhoTarefa t={g.itens[0].t} cat={catPorId.get(g.itens[0].t.categoriaId ?? "")} n={g.itens.length} />}
                <ul className="divide-y">
                  {g.itens.map((i) => (
                    <LinhaRegistro key={i.r.id} item={i} modo={p.agrupar} cat={catPorId.get(i.t.categoriaId ?? "")} />
                  ))}
                </ul>
              </motion.section>
            ))}
          </motion.div>
        )}
      </Secao>
    </Pagina>
  );
}

function CabecalhoDia({ data, n }: { data: string; n: number }) {
  return (
    <header className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3.5 sem-selecao">
      <h3 className="text-[13px] font-semibold tracking-tight first-letter:uppercase">{dataPorExtenso(data)}</h3>
      <span className="text-xs text-muted-foreground">{dataRelativa(data)}</span>
      <Contador n={n} className="ml-auto" />
    </header>
  );
}

function CabecalhoTarefa({ t, cat, n }: { t: Tarefa; cat?: Categoria; n: number }) {
  return (
    <MenuContextoTarefa tarefa={t}>
      <header className="flex min-h-9 items-center gap-2 border-b bg-muted/40 px-3.5 py-1.5">
        <Dica texto={cat?.nome ?? "Sem categoria"}><PontoCor cor={cat?.cor} /></Dica>
        <Link href={`/tarefas/${t.id}`} className="min-w-0 truncate rounded-sm text-[13px] font-semibold tracking-tight outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
          {t.titulo}
        </Link>
        <StatusBadge status={t.status} />
        <Contador n={n} className="ml-auto" />
      </header>
    </MenuContextoTarefa>
  );
}

function LinhaRegistro({ item: { t, r }, modo, cat }: { item: Item; modo: Agrupar; cat?: Categoria }) {
  const resumo = resumoCurto(r);
  const principal = r.titulo || resumo || "Sem título";
  const secundario = r.titulo ? resumo : "";
  return (
    <li
      data-slot="linha-relatorio"
      className={cn(
        "grid items-center gap-x-3 px-3.5 py-2 transition-colors hover:bg-muted/40",
        modo === "dia" ? "grid-cols-[104px_minmax(0,1fr)_minmax(0,36%)]" : "grid-cols-[92px_104px_minmax(0,1fr)]",
      )}
    >
      {modo === "tarefa" && (
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums first-letter:uppercase">
          {dataPorExtenso(r.data)}
        </span>
      )}
      <span className="flex items-center"><TipoBadge tipo={r.tipo} /></span>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{principal}</p>
          {secundario && <p className="truncate text-xs text-muted-foreground">{secundario}</p>}
        </div>
        {r.participantes.length > 0 && (
          <Dica texto={`Com ${r.participantes.join(", ")}`}>
            <span className="flex shrink-0 items-center -space-x-1.5">
              {r.participantes.slice(0, 3).map((nome) => (
                <AvatarPessoa key={nome} nome={nome} tamanho="sm" className="ring-2 ring-card" />
              ))}
              {r.participantes.length > 3 && (
                <span className="pl-2.5 text-[11px] text-muted-foreground tabular-nums">+{r.participantes.length - 3}</span>
              )}
            </span>
          </Dica>
        )}
      </div>
      {modo === "dia" && (
        <MenuContextoTarefa tarefa={t}>
          <Link
            href={`/tarefas/${t.id}`}
            className="group/t flex min-w-0 items-center gap-1.5 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <PontoCor cor={cat?.cor} />
            <span className="truncate group-hover/t:underline">{t.titulo}</span>
          </Link>
        </MenuContextoTarefa>
      )}
    </li>
  );
}
