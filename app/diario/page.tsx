"use client";

// Diário: tudo o que aconteceu em todas as tarefas, dia a dia, com um mapa de atividade.
// Responde "o que eu fiz na terça?" e "o que andou esta semana?" sem abrir tarefa por tarefa.
// É só leitura: os eventos vêm dos registros e dos passos concluídos (lib/diario.ts).

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpenText, CalendarDays, CircleCheckBig, ClipboardCopy, Flame, ListChecks, NotebookText, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { useHoje } from "@/components/useHoje";
import { AvatarPessoa, Estatistica, IconeTipo, Pagina, Painel, PontoCor, Vazio, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Segmentado } from "@/components/ui/controles";
import { somarDias } from "@/components/ui/data";
import { Dica } from "@/components/ui/popover";
import { suave } from "@/lib/animacoes";
import {
  DiaDoDiario, EventoDiario, TipoNoDiario, atividadePorDia, montarDiario, nivelDeAtividade, semanasDoMapa, sequencia, textoDoDia, textoDosDias,
  tituloDoDia,
} from "@/lib/diario";
import { dataRelativa } from "@/lib/lembretes";
import { nomesConhecidos } from "@/lib/pessoas";
import { paraTextoPlano } from "@/lib/texto-rico";
import { Categoria, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const TIPOS: { valor: TipoNoDiario; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "reuniao", rotulo: "Reuniões" },
  { valor: "atividade", rotulo: "Atividades" },
  { valor: "decisao", rotulo: "Decisões" },
  { valor: "impedimento", rotulo: "Impedimentos" },
  { valor: "nota", rotulo: "Notas" },
  { valor: "passos", rotulo: "Passos feitos" },
];

const SEMANAS = 36;
const DIAS_POR_VEZ = 10;
const COR_NIVEL = ["bg-muted", "bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"];
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const resumoCurto = (texto: string) => texto.replace(/\s+/g, " ").trim();

// ---------- Mapa de atividade ----------

function Mapa({ atividade, hoje, dia, escolher }: { atividade: Map<string, number>; hoje: string; dia: string | null; escolher: (d: string | null) => void }) {
  const semanas = useMemo(() => semanasDoMapa(hoje, SEMANAS), [hoje]);
  return (
    <div data-slot="mapa-atividade" className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
        {/* meses: o rótulo aparece na primeira semana de cada mês */}
        <div className="ml-7 flex gap-[3px] text-[10px] leading-none text-muted-foreground sem-selecao" aria-hidden>
          {semanas.map((s, i) => {
            const primeiro = s[0] ?? "";
            const mudou = i === 0 || (semanas[i - 1][0] ?? "").slice(5, 7) !== primeiro.slice(5, 7);
            return <span key={i} className="w-3.5 overflow-visible whitespace-nowrap">{mudou && primeiro ? MES[Number(primeiro.slice(5, 7)) - 1] : ""}</span>;
          })}
        </div>
        <div className="flex gap-1">
          <div className="grid w-6 grid-rows-7 gap-[3px] text-[9px] leading-[14px] text-muted-foreground sem-selecao" aria-hidden>
            {["seg", "", "qua", "", "sex", "", ""].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div role="group" aria-label="Atividade por dia. Clique num dia para ver só ele." className="flex gap-[3px]">
            {semanas.map((s, i) => (
              <div key={i} className="grid grid-rows-7 gap-[3px]">
                {s.map((d, j) => {
                  if (!d) return <span key={j} className="size-3.5" />;
                  const n = atividade.get(d) ?? 0;
                  const sel = dia === d;
                  return (
                    <Dica key={d} texto={`${maiuscula(tituloDoDia(d))}: ${n === 0 ? "nada registrado" : plural(n, "coisa andou", "coisas andaram")}`}>
                      <button type="button" data-slot="dia-mapa" data-data={d} data-nivel={nivelDeAtividade(n)} aria-pressed={sel}
                        aria-label={`${tituloDoDia(d)}, ${plural(n, "item", "itens")}`}
                        onClick={() => escolher(sel ? null : d)}
                        className={cn(
                          "size-3.5 rounded-[3px] transition-[transform,box-shadow] duration-150 outline-none hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring",
                          COR_NIVEL[nivelDeAtividade(n)],
                          d === hoje && "ring-1 ring-foreground/40",
                          sel && "scale-125 ring-2 ring-foreground",
                        )} />
                    </Dica>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 ml-7 flex items-center gap-1.5 text-[10px] text-muted-foreground sem-selecao">
          menos
          {COR_NIVEL.map((c) => <span key={c} className={cn("size-3.5 rounded-[3px]", c)} />)}
          mais
        </div>
      </div>
    </div>
  );
}

// ---------- Um evento ----------

function Evento({ e, cat }: { e: EventoDiario; cat?: Categoria }) {
  const tarefa = (
    <MenuContextoTarefa tarefa={e.tarefa}>
      <Link href={`/tarefas/${e.tarefa.id}`}
        className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm text-[11px] text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
        {cat && <PontoCor cor={cat.cor} />}
        <span className="truncate">{e.tarefa.titulo}</span>
      </Link>
    </MenuContextoTarefa>
  );
  if (e.tipo === "passo")
    return (
      <li data-slot="evento-diario" data-tipo="passo" className="relative flex gap-3 py-1.5">
        <span className="z-[1] inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sucesso/12 text-sucesso"><CircleCheckBig className="size-3.5" /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[13px] leading-snug"><span className="text-muted-foreground">Passo concluído: </span>{e.passo.texto}</p>
          {tarefa}
        </div>
      </li>
    );
  const r = e.registro;
  const marco = r.tipo === "marco";
  const texto = resumoCurto(paraTextoPlano(r.resumoIA || r.anotacoes));
  return (
    <li data-slot="evento-diario" data-tipo={r.tipo} className="relative flex gap-3 py-1.5">
      <IconeTipo tipo={r.tipo} comFundo className="z-[1]" />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex min-w-0 items-baseline gap-2">
          <Link href={`/tarefas/${e.tarefa.id}?r=${r.id}`}
            className={cn("min-w-0 truncate rounded-sm text-[13px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50", marco ? "text-muted-foreground" : "font-medium")}>
            {r.titulo || "Sem título"}
          </Link>
          {r.hora && <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{r.hora}</span>}
          {!!r.duracaoMin && <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{r.duracaoMin} min</span>}
        </p>
        {tarefa}
        {!marco && texto && <p className="mt-1 line-clamp-2 max-w-[90ch] text-[13px] leading-snug text-muted-foreground">{texto}</p>}
        {r.participantes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {r.participantes.slice(0, 6).map((p) => (
              <span key={p} className="inline-flex items-center gap-1"><AvatarPessoa nome={p} tamanho="sm" />{p}</span>
            ))}
            {r.participantes.length > 6 && <span>e mais {r.participantes.length - 6}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

function Dia({ dia, cats, aoCopiar }: { dia: DiaDoDiario; cats: Map<string, Categoria>; aoCopiar: (d: DiaDoDiario) => void }) {
  const registros = dia.eventos.filter((e) => e.tipo === "registro" && e.registro.tipo !== "marco").length;
  const passos = dia.eventos.filter((e) => e.tipo === "passo").length;
  return (
    <motion.section layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={suave}
      data-slot="dia-diario" data-data={dia.data} className="group/dia">
      <header className="flex items-center gap-2 pb-1.5">
        <h2 className="text-[13px] font-semibold tracking-tight first-letter:uppercase">{tituloDoDia(dia.data)}</h2>
        <span className="text-[11px] text-muted-foreground">
          {dataRelativa(dia.data)}
          {registros > 0 && ` · ${plural(registros, "registro", "registros")}`}
          {passos > 0 && ` · ${plural(passos, "passo feito", "passos feitos")}`}
        </span>
        <Dica texto="Copiar este dia como texto">
          <Button variant="ghost" size="icon-sm" aria-label={`Copiar o dia ${formatarData(dia.data)} como texto`} onClick={() => aoCopiar(dia)}
            className="ml-auto opacity-0 transition-opacity group-hover/dia:opacity-100 focus-visible:opacity-100">
            <ClipboardCopy />
          </Button>
        </Dica>
      </header>
      {/* a linha vertical passa por trás dos ícones, ligando o dia */}
      <ol className="relative before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-border">
        {dia.eventos.map((e) => <Evento key={e.chave} e={e} cat={e.tarefa.categoriaId ? cats.get(e.tarefa.categoriaId) : undefined} />)}
      </ol>
    </motion.section>
  );
}

// ---------- A tela ----------

export default function Diario() {
  const { dados, toast } = useNexo();
  const hoje = useHoje();
  const [tipo, setTipo] = useState<TipoNoDiario>("tudo");
  const [categoria, setCategoria] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [dia, setDia] = useState<string | null>(null);
  const [mostrar, setMostrar] = useState(DIAS_POR_VEZ);

  const categorias = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const cats = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const cat = cats.has(categoria) ? categoria : "";
  const nomes = useMemo(() => (dados ? nomesConhecidos(dados) : []), [dados]);

  const atividade = useMemo(() => atividadePorDia(dados?.tarefas ?? [], cat || undefined), [dados?.tarefas, cat]);
  const dias = useMemo(
    () => montarDiario(dados?.tarefas ?? [], { tipo, categoriaId: cat || undefined, pessoa: pessoa || undefined }),
    [dados?.tarefas, tipo, cat, pessoa],
  );
  const filtrados = dia ? dias.filter((d) => d.data === dia) : dias;
  const visiveis = filtrados.slice(0, mostrar);

  // números dos últimos 30 dias (seguem a categoria escolhida, não o tipo)
  const numeros = useMemo(() => {
    const desde = somarDias(hoje, -29);
    let comAtividade = 0;
    let total = 0;
    for (const [d, n] of atividade) if (d >= desde && d <= hoje) { comAtividade++; total += n; }
    return { comAtividade, total, ...sequencia(atividade, hoje) };
  }, [atividade, hoje]);

  const copiar = async (texto: string, aviso: string) => (await copiarTexto(texto)) && toast(aviso, "info");
  const filtrando = tipo !== "tudo" || !!cat || !!pessoa || !!dia;

  if (!dados) return null;

  return (
    <Pagina
      titulo="Diário"
      descricao="Tudo o que aconteceu, dia a dia, em todas as tarefas."
      acoes={
        <Dica texto="Copia os dias que estão na tela como texto simples, para colar num e-mail ou no chat">
          <Button variant="outline" data-slot="copiar-diario" disabled={visiveis.length === 0}
            onClick={() => copiar(textoDosDias(visiveis), `${plural(visiveis.length, "dia copiado", "dias copiados")} como texto.`)}>
            <ClipboardCopy /> Copiar o que está na tela
          </Button>
        </Dica>
      }
      barra={
        <>
          <Segmentado aria-label="O que mostrar" tamanho="sm" valor={tipo} aoMudar={(t) => { setTipo(t); setMostrar(DIAS_POR_VEZ); }} opcoes={TIPOS} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Combobox valor={cat} aoMudar={setCategoria} aria-label="Filtrar por categoria" placeholder="Todas as categorias" rotuloLimpar="Todas as categorias" className="h-7 w-48 text-xs"
              opcoes={categorias.filter((c) => !c.arquivada || c.id === cat).map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> }))} />
            <Combobox valor={pessoa} aoMudar={setPessoa} aria-label="Filtrar por pessoa" placeholder="Qualquer pessoa" rotuloLimpar="Qualquer pessoa" className="h-7 w-44 text-xs"
              opcoes={nomes.map((n) => ({ valor: n, rotulo: n }))} />
          </div>
        </>
      }
    >
      <div className="mx-auto w-full max-w-[1360px] px-6 py-5">
        <div className="flex flex-wrap items-stretch gap-4">
          <Painel titulo="Atividade" icone={<CalendarDays />} className="min-w-0 flex-1 basis-[520px]"
            acoes={<span className="text-[11px] text-muted-foreground sem-selecao">últimas {SEMANAS} semanas{cat ? ` · ${cats.get(cat)?.nome}` : ""}</span>}
            corpoClassName="px-3.5 py-3">
            <Mapa atividade={atividade} hoje={hoje} dia={dia} escolher={(d) => { setDia(d); setMostrar(DIAS_POR_VEZ); }} />
          </Painel>
          <div className="grid min-w-[280px] flex-1 basis-[280px] grid-cols-2 content-start gap-3 lg:max-w-[360px]">
            <Estatistica rotulo="Dias ativos em 30" valor={numeros.comAtividade} icone={<CalendarDays />} tom="primario" />
            <Estatistica rotulo="Avanços em 30 dias" valor={numeros.total} icone={<ListChecks />} tom="sucesso" />
            <Estatistica rotulo="Dias úteis seguidos" valor={numeros.atual} icone={<Flame />} tom="alerta" />
            <Estatistica rotulo="Melhor sequência" valor={numeros.melhor} icone={<Flame />} />
          </div>
        </div>

        <div className="mt-6 flex max-w-[980px] flex-col gap-6">
          {dia && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Mostrando só</span>
              <Button variant="secondary" size="sm" data-slot="dia-escolhido" onClick={() => setDia(null)}>
                {maiuscula(tituloDoDia(dia))} <X />
              </Button>
            </div>
          )}
          {visiveis.length === 0 ? (
            <Vazio titulo={filtrando ? "Nada por aqui com esse filtro" : "O diário ainda está em branco"} icone={filtrando ? <NotebookText /> : <BookOpenText />}>
              <p className="max-w-[52ch]">
                {filtrando
                  ? dia ? "Nenhum registro nem passo concluído nesse dia." : "Tente outro tipo, outra categoria ou outra pessoa."
                  : "Cada reunião, atividade ou passo concluído que você registrar numa tarefa aparece aqui, no dia em que aconteceu."}
              </p>
            </Vazio>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {visiveis.map((d) => (
                <Dia key={d.data} dia={d} cats={cats} aoCopiar={(x) => copiar(textoDoDia(x), `Dia ${formatarData(x.data)} copiado como texto.`)} />
              ))}
            </AnimatePresence>
          )}
          {filtrados.length > mostrar && (
            <Button variant="outline" data-slot="mais-dias" className="self-start" onClick={() => setMostrar((n) => n + DIAS_POR_VEZ)}>
              Mostrar mais dias ({filtrados.length - mostrar} restantes)
            </Button>
          )}
        </div>
      </div>
    </Pagina>
  );
}
