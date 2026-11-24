"use client";

// Decisões (3.23): todas as decisões de todas as tarefas, num lugar só, por mês. Responde "quando decidimos
// isso, e com quem?" sem abrir tarefa por tarefa. É só leitura: as decisões vêm do campo Decisões dos registros
// e dos registros do tipo decisão (lib/decisoes.ts). Clicar leva ao registro, na linha do tempo da tarefa.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ClipboardCopy, FilterX, Gavel, Search, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useHoje } from "@/components/useHoje";
import { CatTag, Pagina, PontoCor, TipoBadge, Vazio, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Segmentado } from "@/components/ui/controles";
import { somarDias } from "@/components/ui/data";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { type Decisao, decisoesDe, decisoesPorMes, filtrarDecisoes, pessoasDasDecisoes, textoDasDecisoes } from "@/lib/decisoes";
import { type Categoria, dataCurta } from "@/lib/tipos";

type Periodo = "tudo" | "30" | "90" | "ano";
const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
  { valor: "ano", rotulo: "Este ano" },
];
const SEM_CATEGORIA = "sem";
const POR_VEZ = 60;
const NOME_DO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const tituloDoMes = (mes: string) => NOME_DO_MES.format(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Linha({ d, cat }: { d: Decisao; cat?: Categoria }) {
  return (
    <li data-slot="decisao" data-chave={d.chave} className="flex gap-3 px-3.5 py-2.5">
      <span className="w-12 shrink-0 pt-px text-xs text-muted-foreground tabular-nums">{dataCurta(d.data)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug font-medium [overflow-wrap:anywhere]">{d.texto}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          <TipoBadge tipo={d.tipo} />
          <Link href={`/tarefas/${d.tarefaId}?r=${encodeURIComponent(d.registroId)}`} data-slot="decisao-origem"
            className="min-w-0 truncate rounded-sm font-medium text-foreground/90 underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            {d.tarefaTitulo}
          </Link>
          <CatTag cat={cat} />
          {d.participantes.length > 0 && <span className="min-w-0 truncate">com {d.participantes.join(", ")}</span>}
          {d.tambemEm.length > 0 && (
            <span>
              repetida em{" "}
              {d.tambemEm.map((x, i) => (
                <span key={x.registroId}>
                  {i > 0 && ", "}
                  <Link href={`/tarefas/${d.tarefaId}?r=${encodeURIComponent(x.registroId)}`} className="rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">{dataCurta(x.data)}</Link>
                </span>
              ))}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

export default function Decisoes() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados, toast } = useNexo();
  const hoje = useHoje();
  const params = useSearchParams();
  const [texto, setTexto] = useState("");
  // /decisoes?cat=<id> chega já filtrado (o "Ver todas" do painel da categoria); id que não existe vale "todas"
  const [categoria, setCategoria] = useState(() => params.get("cat") ?? "");
  const [pessoa, setPessoa] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("tudo");
  const [mostrar, setMostrar] = useState(POR_VEZ);

  const categorias = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const cats = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const todas = useMemo(() => decisoesDe(dados?.tarefas ?? []), [dados?.tarefas]);
  const pessoas = useMemo(() => pessoasDasDecisoes(todas), [todas]);
  const cat = categoria === SEM_CATEGORIA || cats.has(categoria) ? categoria : "";

  const filtradas = useMemo(
    () =>
      filtrarDecisoes(todas, {
        texto,
        categoriaId: cat === "" ? undefined : cat === SEM_CATEGORIA ? "" : cat,
        pessoa,
        desde: periodo === "30" ? somarDias(hoje, -29) : periodo === "90" ? somarDias(hoje, -89) : periodo === "ano" ? `${hoje.slice(0, 4)}-01-01` : undefined,
      }),
    [todas, texto, cat, pessoa, periodo, hoje],
  );
  const visiveis = filtradas.slice(0, mostrar);
  const meses = useMemo(() => decisoesPorMes(visiveis), [visiveis]);
  const filtrando = !!texto.trim() || !!cat || !!pessoa || periodo !== "tudo";
  const limpar = () => { setTexto(""); setCategoria(""); setPessoa(""); setPeriodo("tudo"); setMostrar(POR_VEZ); };

  const copiar = async () => {
    if (await copiarTexto(textoDasDecisoes(filtradas, filtrando ? "Decisões (com o filtro da tela)" : "Decisões"))) toast(`${plural(filtradas.length, "decisão copiada", "decisões copiadas")} como texto.`);
    else toast("Não consegui copiar automaticamente.", "erro");
  };

  return (
    <Pagina
      titulo="Decisões"
      descricao="O que foi decidido, quando e com quem, em todas as tarefas."
      acoes={
        todas.length > 0 && (
          <Dica texto="Copia as decisões que estão no filtro, em texto simples">
            <Button variant="outline" data-slot="copiar-decisoes" disabled={!filtradas.length} onClick={copiar}><ClipboardCopy /> Copiar</Button>
          </Dica>
        )
      }
      barra={
        todas.length > 0 && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={texto} onChange={(e) => { setTexto(e.target.value); setMostrar(POR_VEZ); }} placeholder="Buscar nas decisões..." aria-label="Buscar nas decisões" className="w-56 pr-8 pl-8"
                onKeyDown={(e) => { if (e.key === "Escape" && texto) { e.stopPropagation(); setTexto(""); } }} />
              {texto && (
                <button type="button" aria-label="Limpar a busca" onClick={() => setTexto("")}
                  className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                  <X className="size-3" />
                </button>
              )}
            </div>
            <Combobox valor={cat} aoMudar={(v) => { setCategoria(v); setMostrar(POR_VEZ); }} aria-label="Filtrar por categoria" placeholder="Todas as categorias" rotuloLimpar="Todas as categorias" className="h-7 w-48 text-xs"
              opcoes={[
                ...categorias.filter((c) => !c.arquivada || c.id === cat).map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> })),
                { valor: SEM_CATEGORIA, rotulo: "Sem categoria" },
              ]} />
            <Combobox valor={pessoa} aoMudar={(v) => { setPessoa(v); setMostrar(POR_VEZ); }} aria-label="Filtrar por quem estava" placeholder="Qualquer pessoa" rotuloLimpar="Qualquer pessoa" className="h-7 w-44 text-xs"
              opcoes={pessoas.map((n) => ({ valor: n, rotulo: n }))} />
            <Segmentado aria-label="Período" tamanho="sm" valor={periodo} aoMudar={(p) => { setPeriodo(p); setMostrar(POR_VEZ); }} opcoes={PERIODOS} />
            <span data-slot="total-decisoes" data-total={filtradas.length} className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
              {filtrando && filtradas.length !== todas.length ? `${filtradas.length} de ${plural(todas.length, "decisão", "decisões")}` : plural(todas.length, "decisão", "decisões")}
            </span>
          </>
        )
      }
    >
      {dados && todas.length === 0 && (
        <Vazio titulo="Nenhuma decisão registrada ainda" icone={<Gavel />}>
          <p>
            As decisões aparecem aqui sozinhas: basta preencher o campo Decisões de um registro (uma por linha) ou criar um registro do tipo Decisão numa tarefa.
          </p>
        </Vazio>
      )}

      {todas.length > 0 && filtradas.length === 0 && (
        <Vazio titulo="Nada com esse filtro" icone={<FilterX />}>
          <p>{todas.length === 1 ? "Existe 1 decisão registrada" : `Existem ${todas.length} decisões registradas`}, mas nenhuma combina com o que você pediu.</p>
          <Button variant="outline" size="sm" onClick={limpar}>Limpar filtros</Button>
        </Vazio>
      )}

      {meses.length > 0 && (
        <div data-slot="lista-decisoes" className="flex max-w-[980px] flex-col gap-5">
          {meses.map((m) => (
            <section key={m.mes} data-slot="mes-de-decisoes" data-mes={m.mes}>
              <header className="flex items-baseline gap-2 pb-1.5">
                <h2 className="text-[13px] font-semibold tracking-tight first-letter:uppercase">{tituloDoMes(m.mes)}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">{plural(m.decisoes.length, "decisão", "decisões")}</span>
              </header>
              <ul className="divide-y rounded-xl border bg-card shadow-xs">
                {m.decisoes.map((d) => <Linha key={d.chave} d={d} cat={d.categoriaId ? cats.get(d.categoriaId) : undefined} />)}
              </ul>
            </section>
          ))}
          {filtradas.length > visiveis.length && (
            <Button variant="outline" className="self-start" onClick={() => setMostrar((n) => n + POR_VEZ)}>
              Mostrar mais {Math.min(POR_VEZ, filtradas.length - visiveis.length)} de {filtradas.length - visiveis.length}
            </Button>
          )}
        </div>
      )}
    </Pagina>
  );
}
