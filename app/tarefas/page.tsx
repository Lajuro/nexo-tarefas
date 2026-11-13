"use client";

// Lista de tarefas com três visões (grade, lista e quadro), filtros e números do topo.
// O que é preferência (ordem, status, visão) fica em localStorage; o que é filtro de momento
// (categoria, filtros prontos, status vindo de um link) fica na URL e aparece como etiqueta removível.

import { ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownUp, Ban, CalendarX, ChevronDown, CircleCheckBig, CircleDashed, ClipboardList, FilterX, Kanban, Layers,
  LayoutGrid, ListChecks, ListTodo, Plus, Rows3, Search, SearchX, Target, X,
} from "lucide-react";
import { CardTarefa } from "@/components/CardTarefa";
import { useNexo } from "@/components/Provider";
import { abrirNovaTarefa } from "@/components/Shell";
import { Estatistica, IconeStatus, Pagina, PontoCor, Vazio, opcoesStatus } from "@/components/comum";
import { ListaTarefas } from "@/components/tarefas/ListaTarefas";
import { QuadroTarefas } from "@/components/tarefas/QuadroTarefas";
import {
  type Especial, type FiltroStatus, type Filtros, NOME_ESPECIAL, ORDENS, type Ordem, SEM_CATEGORIA, type Visao,
  ehEspecial, ehFiltroStatus, ehOrdem, ehVisao, filtrar, filtrarParaQuadro, numerosDoTopo, ordenar,
} from "@/components/tarefas/filtros";
import { Button } from "@/components/ui/button";
import { Combobox, type OpcaoCombo } from "@/components/ui/command";
import { Segmentado } from "@/components/ui/controles";
import { Kbd } from "@/components/ui/diversos";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { type Opcao, Seletor } from "@/components/ui/select";
import { mola, suave } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { Categoria, Tarefa, nomeStatus } from "@/lib/tipos";

const ICONE_ESPECIAL: Record<Exclude<Especial, "">, ReactNode> = {
  atrasadas: <CalendarX className="size-3.5 text-destructive" />,
  foco: <Target className="size-3.5 text-primary" />,
  mes: <CircleCheckBig className="size-3.5 text-sucesso" />,
};

/** Troca parâmetros da URL sem navegar (o Next mantém o useSearchParams em dia). null remove. */
function mudarUrl(mudancas: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor) p.set(chave, valor);
    else p.delete(chave);
  }
  const q = p.toString();
  window.history.replaceState(null, "", q ? `${window.location.pathname}?${q}` : window.location.pathname);
}

function rotuloStatus(s: FiltroStatus) {
  return s === "abertas" ? "Só abertas" : s === "todas" ? "Todas" : nomeStatus(s);
}

/** Etiqueta de um filtro ativo, com o "x" para tirar. */
function ChipFiltro({ children, nome, aoRemover }: { children: ReactNode; nome: string; aoRemover: () => void }) {
  return (
    <motion.span
      layout
      data-slot="chip-filtro"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="inline-flex h-6 max-w-64 items-center gap-1.5 rounded-full border bg-card pr-0.5 pl-2 text-xs font-medium shadow-xs sem-selecao"
    >
      <span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      <Dica texto="Tirar este filtro">
        <button
          type="button"
          aria-label={`Tirar o filtro ${nome}`}
          onClick={aoRemover}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3" />
        </button>
      </Dica>
    </motion.span>
  );
}

/** Ícone do cartão de número: some quando falta largura, para o rótulo nunca cortar. */
function IconeNumero({ children }: { children: ReactNode }) {
  return <span className="hidden @4xl:inline-flex">{children}</span>;
}

function GradeTarefas({ tarefas, categorias }: { tarefas: Tarefa[]; categorias: Map<string, Categoria> }) {
  // Cascata só na primeira vez; depois, o que entra por causa de um filtro aparece na hora.
  const primeira = useRef(true);
  useEffect(() => {
    primeira.current = false;
  }, []);
  return (
    <div data-slot="grade-tarefas" className="relative grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      <AnimatePresence mode="popLayout">
        {tarefas.map((t, i) => (
          <motion.div
            key={t.id}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
            transition={{ ...suave, delay: primeira.current ? Math.min(i, 14) * 0.03 : 0, layout: mola }}
            className="flex min-w-0"
          >
            <CardTarefa t={t} cat={t.categoriaId ? categorias.get(t.categoriaId) : null} className="w-full" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Tarefas() {
  const { dados } = useNexo();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState("");
  const [ordemPref, setOrdem, c1] = usePref<Ordem>("ordem", "prioridade");
  const [statusPref, setStatusPref, c2] = usePref<FiltroStatus>("filtroStatus", "abertas");
  const [visaoPref, setVisao, c3] = usePref<Visao>("visaoTarefas", "grade");
  const pronto = c1 && c2 && c3;

  // Preferência gravada por versão antiga ou editada à mão pode vir com valor estranho.
  const ordem: Ordem = ehOrdem(ordemPref) ? ordemPref : "prioridade";
  const statusGravado: FiltroStatus = ehFiltroStatus(statusPref) ? statusPref : "abertas";
  const visao: Visao = ehVisao(visaoPref) ? visaoPref : "grade";

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const cats = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const categorias = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  // Parâmetros da URL valem sobre a preferência.
  const pStatus = parametros.get("status");
  const statusDaUrl: FiltroStatus | null = ehFiltroStatus(pStatus) ? pStatus : null;
  const pCat = parametros.get("cat") ?? "";
  const categoria = pCat === SEM_CATEGORIA || categorias.has(pCat) ? pCat : "";
  const pF = parametros.get("f");
  const especial: Especial = ehEspecial(pF) ? pF : "";
  const status = statusDaUrl ?? statusGravado;

  const filtros: Filtros = useMemo(() => ({ texto, categoria, status, especial }), [texto, categoria, status, especial]);
  const numeros = useMemo(() => numerosDoTopo(tarefas), [tarefas]);
  const lista = useMemo(() => ordenar(filtrar(tarefas, filtros), ordem), [tarefas, filtros, ordem]);
  const quadro = useMemo(() => filtrarParaQuadro(tarefas, filtros), [tarefas, filtros]);

  const noQuadro = visao === "quadro";
  const mostradas = noQuadro ? quadro.visiveis.length : lista.length;
  const temFiltro = !!texto.trim() || !!categoria || !!especial || status !== "abertas";

  function escolherStatus(v: string) {
    if (!ehFiltroStatus(v)) return;
    setStatusPref(v);
    mudarUrl({ status: null, f: null });
  }
  function limparFiltros() {
    setTexto("");
    if (statusGravado !== "abertas") setStatusPref("abertas");
    mudarUrl({ status: null, cat: null, f: null });
  }
  const alternarEspecial = (e: Exclude<Especial, "">) => mudarUrl({ f: especial === e ? null : e, status: null });

  const opcoesCategoria = useMemo(() => {
    const abertasPor = new Map<string, number>();
    for (const t of tarefas) if (aberta(t)) abertasPor.set(t.categoriaId ?? SEM_CATEGORIA, (abertasPor.get(t.categoriaId ?? SEM_CATEGORIA) ?? 0) + 1);
    const ops: OpcaoCombo[] = cats
      .filter((c) => !c.arquivada || c.id === categoria)
      .map((c) => ({
        valor: c.id,
        rotulo: c.nome,
        detalhe: String(abertasPor.get(c.id) ?? 0),
        render: (
          <>
            <PontoCor cor={c.cor} />
            <span className="truncate">{c.nome}</span>
          </>
        ),
      }));
    ops.push({
      valor: SEM_CATEGORIA,
      rotulo: "Sem categoria",
      detalhe: String(abertasPor.get(SEM_CATEGORIA) ?? 0),
      render: (
        <>
          <PontoCor />
          <span className="truncate">Sem categoria</span>
        </>
      ),
    });
    return ops;
  }, [cats, tarefas, categoria]);

  const opcoesDeStatus = useMemo(() => {
    const ops: Opcao[] = [
      { valor: "abertas", rotulo: <><CircleDashed className="size-3.5 shrink-0 text-muted-foreground" /> Só abertas</> },
      { valor: "todas", rotulo: <><Layers className="size-3.5 shrink-0 text-muted-foreground" /> Todas</> },
      ...opcoesStatus,
    ];
    // Com um filtro pronto ligado, é ele quem decide os status: o seletor mostra isso em vez de um status que não vale.
    if (especial) ops.unshift({ valor: "__especial", rotulo: <>{ICONE_ESPECIAL[especial]} {NOME_ESPECIAL[especial]}</>, desabilitada: true });
    return ops;
  }, [especial]);

  const catAtual = categoria && categoria !== SEM_CATEGORIA ? categorias.get(categoria) : null;
  const chips = (
    <AnimatePresence initial={false} mode="popLayout">
      {especial && (
        <ChipFiltro key="f" nome={NOME_ESPECIAL[especial]} aoRemover={() => mudarUrl({ f: null })}>
          {ICONE_ESPECIAL[especial]} {NOME_ESPECIAL[especial]}
        </ChipFiltro>
      )}
      {categoria && (
        <ChipFiltro key="cat" nome={catAtual?.nome ?? "Sem categoria"} aoRemover={() => mudarUrl({ cat: null })}>
          <PontoCor cor={catAtual?.cor} />
          <span className="truncate">{catAtual?.nome ?? "Sem categoria"}</span>
        </ChipFiltro>
      )}
      {statusDaUrl && !especial && (
        <ChipFiltro key="status" nome={rotuloStatus(statusDaUrl)} aoRemover={() => mudarUrl({ status: null })}>
          {statusDaUrl === "abertas" || statusDaUrl === "todas" ? <CircleDashed className="size-3.5 text-muted-foreground" /> : <IconeStatus status={statusDaUrl} />}
          {rotuloStatus(statusDaUrl)}
        </ChipFiltro>
      )}
    </AnimatePresence>
  );
  const temChips = !!especial || !!categoria || (!!statusDaUrl && !especial);

  const barra = (
    <div className="@container basis-full">
      <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[170px] flex-1 basis-[170px] sm:max-w-[300px]">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && texto) {
              e.stopPropagation();
              setTexto("");
            }
          }}
          placeholder="Filtrar por título, descrição ou tag..."
          aria-label="Filtrar tarefas por texto"
          className="pr-8 pl-8"
        />
        {texto && (
          <Dica texto="Limpar o texto" atalho="Esc">
            <button
              type="button"
              aria-label="Limpar o texto do filtro"
              onClick={() => setTexto("")}
              className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" />
            </button>
          </Dica>
        )}
      </div>

      <Combobox
        valor={categoria}
        aoMudar={(v) => mudarUrl({ cat: v || null })}
        opcoes={opcoesCategoria}
        placeholder="Todas as categorias"
        rotuloLimpar="Todas as categorias"
        buscaPlaceholder="Buscar categoria..."
        aria-label="Filtrar por categoria"
        className="w-[172px] text-foreground"
      />

      <Seletor
        valor={especial ? "__especial" : status}
        aoMudar={escolherStatus}
        opcoes={opcoesDeStatus}
        aria-label="Filtrar por status"
        className="w-[196px]"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-slot="ordenacao" data-valor={ordem} aria-label={`Ordenar por: ${ORDENS.find((o) => o.id === ordem)?.nome}`} className="gap-2 px-2.5 font-normal">
            <ArrowDownUp className="size-3.5 text-muted-foreground" />
            {ORDENS.find((o) => o.id === ordem)?.nome}
            <ChevronDown className="size-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={ordem} onValueChange={(v) => ehOrdem(v) && setOrdem(v)}>
            {ORDENS.map((o) => (
              <DropdownMenuRadioItem key={o.id} value={o.id}>{o.nome}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <span data-slot="contador-tarefas" aria-live="polite" className="px-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums sem-selecao">
          <strong className="font-semibold text-foreground">{mostradas}</strong> de {tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}
        </span>
        <AnimatePresence initial={false}>
          {temFiltro && (
            <motion.div key="limpar" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.15 }}>
              <Dica texto="Limpar filtros">
                <Button variant="ghost" onClick={limparFiltros} aria-label="Limpar filtros" data-slot="limpar-filtros" className="px-2">
                  <FilterX /> <span className="hidden @6xl:inline">Limpar filtros</span>
                </Button>
              </Dica>
            </motion.div>
          )}
        </AnimatePresence>
        <Segmentado<Visao>
          valor={visao}
          aoMudar={setVisao}
          aria-label="Como ver as tarefas"
          opcoes={[
            { valor: "grade", rotulo: "Grade", icone: <LayoutGrid /> },
            { valor: "lista", rotulo: "Lista", icone: <Rows3 /> },
            { valor: "quadro", rotulo: "Quadro", icone: <Kanban /> },
          ]}
        />
      </div>

      </div>
      {temChips && (
        <div data-slot="filtros-ativos" className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[11px] text-muted-foreground sem-selecao">Mostrando só:</span>
          {chips}
        </div>
      )}
    </div>
  );

  const estatisticas = (
    <div className="@container shrink-0">
    <div data-slot="numeros" className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @2xl:grid-cols-5">
      <Estatistica
        rotulo="Abertas" valor={numeros.abertas} icone={<IconeNumero><ListTodo /></IconeNumero>}
        ativo={!especial && status === "abertas"}
        aoClicar={() => mudarUrl({ f: null, status: statusGravado === "abertas" ? null : "abertas" })}
      />
      <Estatistica
        rotulo="Com prazo vencido" valor={numeros.atrasadas} icone={<IconeNumero><CalendarX /></IconeNumero>} tom="perigo"
        ativo={especial === "atrasadas"} aoClicar={() => alternarEspecial("atrasadas")}
      />
      <Estatistica
        rotulo="Bloqueadas" valor={numeros.bloqueadas} icone={<IconeNumero><Ban /></IconeNumero>} tom="alerta"
        ativo={!especial && status === "bloqueada"}
        aoClicar={() => mudarUrl(!especial && status === "bloqueada" ? { status: null } : { f: null, status: "bloqueada" })}
      />
      <Estatistica rotulo="Passos em aberto" valor={numeros.pendencias} icone={<IconeNumero><ListChecks /></IconeNumero>} tom="primario" href="/pendencias" />
      <Estatistica
        rotulo="Concluídas no mês" valor={numeros.concluidasMes} icone={<IconeNumero><CircleCheckBig /></IconeNumero>} tom="sucesso"
        ativo={especial === "mes"} aoClicar={() => alternarEspecial("mes")}
      />
    </div>
    </div>
  );

  const semNenhuma = (
    <Vazio titulo="Nenhuma tarefa ainda" icone={<ClipboardList />}>
      <p>Cadastre a primeira tarefa que te passaram. Depois é só ir registrando as reuniões e o que você fez: a linha do tempo se monta sozinha.</p>
      <Button onClick={() => abrirNovaTarefa()}>
        <Plus /> Nova tarefa
      </Button>
    </Vazio>
  );
  const nadaComFiltro = (
    <Vazio titulo="Nada com esses filtros" icone={<SearchX />}>
      <p>
        {texto.trim()
          ? <>Nenhuma tarefa bate com “{texto.trim()}” e os filtros escolhidos.</>
          : "Nenhuma tarefa bate com os filtros escolhidos."}
      </p>
      {temFiltro && (
        <Button variant="outline" onClick={limparFiltros}>
          <FilterX /> Limpar filtros
        </Button>
      )}
    </Vazio>
  );

  let conteudo: ReactNode = null;
  if (!pronto) conteudo = null;
  else if (tarefas.length === 0) conteudo = semNenhuma;
  else if (mostradas === 0) conteudo = nadaComFiltro;
  else if (visao === "grade") conteudo = <GradeTarefas tarefas={lista} categorias={categorias} />;
  else if (visao === "lista") conteudo = <ListaTarefas tarefas={lista} categorias={categorias} ordem={ordem} aoOrdenar={setOrdem} />;
  else
    conteudo = (
      <QuadroTarefas
        tarefas={quadro.visiveis}
        categorias={categorias}
        ordem={ordem}
        concluidasAntigas={quadro.concluidasAntigas}
        aoVerConcluidas={() => {
          setVisao("lista");
          mudarUrl({ f: null, status: "concluida" });
        }}
      />
    );

  return (
    <Pagina
      titulo="Tarefas"
      descricao="Tudo o que foi designado pra você, num lugar só."
      acoes={
        <Button onClick={() => abrirNovaTarefa()}>
          <Plus /> Nova tarefa <Kbd className="border-white/20 bg-white/15 text-white">N</Kbd>
        </Button>
      }
      barra={barra}
      semRolagem={noQuadro}
    >
      {noQuadro ? (
        <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col gap-4 px-6 pt-5 pb-4">
          {estatisticas}
          <motion.div key="quadro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={suave} className="min-h-0 flex-1">
            {conteudo}
          </motion.div>
        </div>
      ) : (
        <>
          {estatisticas}
          <motion.div key={visao} data-visao={visao} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={suave} className="mt-5">
            {conteudo}
          </motion.div>
        </>
      )}
    </Pagina>
  );
}

export default function PaginaTarefas() {
  // useSearchParams exige um limite de Suspense em volta.
  return (
    <Suspense fallback={<Pagina titulo="Tarefas" descricao="Tudo o que foi designado pra você, num lugar só."><span /></Pagina>}>
      <Tarefas />
    </Suspense>
  );
}
