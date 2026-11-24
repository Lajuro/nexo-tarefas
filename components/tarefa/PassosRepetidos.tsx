"use client";

// Passos sem repetição (3.19), a parte de limpeza: o aviso "N passos repetidos", a janela que mostra os pares
// antes de juntar e a linha "juntado com..." da linha do tempo, com Separar. A conta é de lib/passos.ts.
//
// Juntar nunca apaga: a cópia sai da lista de pendências e fica guardada no registro de origem. Toda junção
// tem Desfazer (atualizarComVolta) e pode ser separada depois, pela linha do tempo.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Merge, Split } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal, TipoBadge } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import {
  type GrupoDeRepetidos, type ParParecido, type PassoNaTarefa, comPassoJuntado, comPassoSeparado, comRepetidosJuntados, passosJuntadosDe,
  passosParecidos, passosRepetidos, textoDoPassoQueFicou,
} from "@/lib/passos";
import { dataLocal } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { type Pessoa, type Registro, type Tarefa, dataCurta } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os pares que o usuário já disse que são passos diferentes (preferência: é gosto, não dado). */
function normalizarDispensados(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string" && v.length <= 200).slice(-300) : [];
}

function useDispensados() {
  const [bruto, definir] = usePref<unknown>("passosDiferentes", []);
  const dispensados = useMemo(() => normalizarDispensados(bruto), [bruto]);
  return [dispensados, (chave: string) => definir([...dispensados, chave].slice(-300))] as const;
}

export interface RepetidosDaTarefa { tarefa: Tarefa; repetidos: GrupoDeRepetidos[]; parecidos: ParParecido[]; saem: number }

/** O que há para juntar em cada tarefa (só as que têm algo). */
export function repetidosDasTarefas(tarefas: Tarefa[], pessoas: Pessoa[], dispensados: readonly string[]): RepetidosDaTarefa[] {
  const out: RepetidosDaTarefa[] = [];
  for (const tarefa of tarefas) {
    const repetidos = passosRepetidos(tarefa, pessoas);
    const parecidos = passosParecidos(tarefa, pessoas, dispensados);
    if (repetidos.length || parecidos.length) out.push({ tarefa, repetidos, parecidos, saem: repetidos.reduce((n, g) => n + g.saem.length, 0) });
  }
  return out;
}

/** O que há para juntar num conjunto de tarefas, já sem os pares dispensados. */
export function useRepetidos(tarefas: Tarefa[]): RepetidosDaTarefa[] {
  const { dados } = useNexo();
  const [dispensados] = useDispensados();
  const pessoas = dados?.pessoas?.items;
  return useMemo(() => repetidosDasTarefas(tarefas, pessoas ?? [], dispensados), [tarefas, pessoas, dispensados]);
}

/** "3 repetidos", "2 parecidos" ou os dois: o resumo que vai no aviso. */
export function resumoDosRepetidos(itens: RepetidosDaTarefa[]): string {
  const saem = itens.reduce((n, x) => n + x.saem, 0);
  const pares = itens.reduce((n, x) => n + x.parecidos.length, 0);
  return [saem ? plural(saem, "passo repetido", "passos repetidos") : "", pares ? plural(pares, "par parecido", "pares parecidos") : ""].filter(Boolean).join(" e ");
}

const origem = (x: PassoNaTarefa) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <TipoBadge tipo={x.registro.tipo} /> <span className="tabular-nums">{dataCurta(x.registro.data)}</span>
  </span>
);

/** A janela que mostra o que vai ser juntado, tarefa por tarefa. Fecha sozinha quando não sobra nada. */
export function JanelaJuntarPassos({ itens, aberto, fechar }: { itens: RepetidosDaTarefa[]; aberto: boolean; fechar: () => void }) {
  const { dados, atualizarComVolta, estado } = useNexo();
  const [, dispensar] = useDispensados();
  const [ocupado, setOcupado] = useState(false);
  const somenteLeitura = !!estado?.somenteLeitura;
  const pessoas = dados?.pessoas?.items ?? [];
  const varias = itens.length > 1;

  const com = async (fn: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(true);
    await fn();
    setOcupado(false);
  };
  const juntarRepetidos = (x: RepetidosDaTarefa) =>
    com(() => atualizarComVolta(x.tarefa.id, (t) => comRepetidosJuntados(t, pessoas), x.saem === 1 ? "1 passo repetido juntado." : `${x.saem} passos repetidos juntados.`));
  const juntarPar = (x: RepetidosDaTarefa, par: ParParecido) =>
    com(() =>
      atualizarComVolta(
        x.tarefa.id,
        (t) => comPassoJuntado(t, { registroId: par.fica.registro.id, passoId: par.fica.passo.id }, { registroId: par.sai.registro.id, passoId: par.sai.passo.id }),
        "Passos juntados.",
      ),
    );

  return (
    <Modal
      titulo="Juntar passos repetidos"
      descricao="O mesmo passo anotado mais de uma vez na mesma tarefa. Juntar não apaga nada: a cópia fica guardada no registro de onde veio, e dá para separar pela linha do tempo."
      aberto={aberto}
      fechar={fechar}
      largo
      rodape={<Button variant="outline" onClick={fechar}>Fechar</Button>}
    >
      <div data-slot="juntar-passos" className="flex flex-col gap-5">
        {itens.map((x) => (
          <section key={x.tarefa.id} data-slot="repetidos-da-tarefa" className="flex min-w-0 flex-col gap-3">
            {varias && <h3 className="text-[13px] leading-snug font-semibold tracking-tight [overflow-wrap:anywhere]">{x.tarefa.titulo}</h3>}

            {x.repetidos.length > 0 && (
              <div className="rounded-xl border bg-card shadow-xs">
                <header className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-1.5">
                  <h4 className="min-w-0 flex-1 text-[13px] font-medium">{plural(x.saem, "passo repetido", "passos repetidos")}</h4>
                  <Button size="sm" data-slot="juntar-repetidos" disabled={somenteLeitura || ocupado} onClick={() => void juntarRepetidos(x)}>
                    <Merge /> {x.saem === 1 ? "Juntar" : `Juntar os ${x.saem}`}
                  </Button>
                </header>
                <ul className="divide-y">
                  {x.repetidos.map((g) => (
                    <li key={g.fica.passo.id} data-slot="grupo-repetido" className="px-3.5 py-2.5 text-[13px] leading-snug">
                      <p className="[overflow-wrap:anywhere] texto-pre">
                        {g.fica.passo.texto}
                        {g.fica.passo.responsavel ? <span className="text-muted-foreground"> · {g.fica.passo.responsavel}</span> : null}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>Fica o de</span> {origem(g.fica)}
                        <span>{g.saem.length === 1 ? "e sai o de" : "e saem os de"}</span>
                        {g.saem.map((s) => <span key={s.passo.id}>{origem(s)}</span>)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {x.parecidos.length > 0 && (
              <div className="rounded-xl border border-dashed">
                <header className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-0.5 px-3.5 py-1.5">
                  <h4 className="min-w-0 flex-1 text-[13px] font-medium">Parecem o mesmo passo</h4>
                  <span className="text-xs text-muted-foreground">Ao juntar, fica o texto mais completo, que aparece primeiro.</span>
                </header>
                <ul className="divide-y border-t">
                  {x.parecidos.map((par) => (
                    <li key={par.chave} data-slot="par-parecido" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-[13px] leading-snug">
                      <div className="min-w-0 flex-1 basis-72">
                        {[par.fica, par.sai].map((p, i) => (
                          <p key={p.passo.id} className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", i > 0 && "mt-1.5")}>
                            <span className="min-w-0 [overflow-wrap:anywhere] texto-pre">
                              {p.passo.texto}
                              {p.passo.responsavel ? <span className="text-muted-foreground"> · {p.passo.responsavel}</span> : null}
                            </span>
                            <span className="text-xs text-muted-foreground">{origem(p)}</span>
                          </p>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button variant="outline" size="sm" data-slot="juntar-par" disabled={somenteLeitura || ocupado} onClick={() => void juntarPar(x, par)}><Merge /> Juntar</Button>
                        <Button variant="ghost" size="sm" data-slot="sao-diferentes" onClick={() => dispensar(par.chave)}>São diferentes</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}

/**
 * O aviso que leva à janela: "3 passos repetidos · Juntar". Não aparece quando não há nada para juntar.
 * `curto`: só o número e o ícone (cabeçalho apertado de um grupo de pendências).
 */
export function AvisoDeRepetidos({ tarefas, curto, className }: { tarefas: Tarefa[]; curto?: boolean; className?: string }) {
  const itens = useRepetidos(tarefas);
  const [aberto, setAberto] = useState(false);
  // Juntou tudo: a janela fecha (com a animação dela) e não reabre sozinha se um repetido novo aparecer depois.
  const vazio = itens.length === 0;
  useEffect(() => {
    if (vazio) setAberto(false);
  }, [vazio]);
  if (vazio) return <JanelaJuntarPassos itens={itens} aberto={false} fechar={() => setAberto(false)} />;
  const saem = itens.reduce((n, x) => n + x.saem, 0);
  const resumo = resumoDosRepetidos(itens);
  return (
    <>
      {curto ? (
        <Button variant="outline" size="sm" data-slot="aviso-repetidos" aria-label={`${resumo}: ver e juntar`} onClick={() => setAberto(true)}
          className={cn("shrink-0 text-foreground", saem > 0 && "border-alerta/45", className)}>
          <Merge className={saem > 0 ? "text-alerta" : "text-muted-foreground"} /> {saem ? plural(saem, "repetido", "repetidos") : plural(itens.reduce((n, x) => n + x.parecidos.length, 0), "parecido", "parecidos")}
        </Button>
      ) : (
        <div data-slot="aviso-repetidos" role="status"
          data-tom={saem > 0 ? "alerta" : "neutro"}
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-[13px] leading-snug",
            saem > 0 ? "border-alerta/40 bg-alerta/[0.07] dark:bg-alerta/10" : "border-dashed text-muted-foreground",
            className,
          )}>
          <Merge className={cn("size-4 shrink-0", saem > 0 ? "text-alerta" : "text-muted-foreground")} />
          <span className="min-w-0 flex-1 basis-40">
            {resumo}
            {itens.length > 1 ? ` em ${itens.length} tarefas` : ""}
          </span>
          <Button variant="outline" size="sm" data-slot="abrir-juntar" onClick={() => setAberto(true)}>{saem ? "Ver e juntar" : "Ver"}</Button>
        </div>
      )}
      <JanelaJuntarPassos itens={itens} aberto={aberto} fechar={() => setAberto(false)} />
    </>
  );
}

/** Na linha do tempo: os passos deste registro que foram juntados com outro, com Separar. */
export function PassosJuntadosDoRegistro({ tarefa, registro }: { tarefa: Tarefa; registro: Registro }) {
  const { atualizarComVolta, estado } = useNexo();
  const [aberto, setAberto] = useState(false);
  const juntados = passosJuntadosDe(registro);
  if (!juntados.length) return null;
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} data-slot="registro-juntados" className="mt-2.5 px-4">
      <CollapsibleTrigger asChild>
        <button type="button"
          className="group/juntados -ml-1.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground outline-none sem-selecao hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
          <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/juntados:rotate-90" />
          {juntados.length === 1 ? "1 passo juntado com outro igual" : `${juntados.length} passos juntados com outros iguais`}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {juntados.map((p) => {
            const ficou = textoDoPassoQueFicou(tarefa, p);
            const mesmoTexto = ficou.trim() === p.texto.trim();
            // o carimbo é UTC: o dia mostrado é o do relógio do usuário (à noite, o dia em UTC já é o seguinte)
            const quando = dataCurta(dataLocal(p.juntadoEm));
            return (
              <li key={p.id} data-slot="passo-juntado" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-2.5 py-1.5 text-xs leading-snug">
                <span className="min-w-0 flex-1 basis-56 text-muted-foreground">
                  <span className="text-foreground [overflow-wrap:anywhere]">{p.texto}</span>
                  {p.responsavel ? ` · ${p.responsavel}` : ""}
                  {ficou
                    ? mesmoTexto ? ` · juntado com o mesmo passo de outro registro em ${quando}` : ` · juntado com “${ficou}” em ${quando}`
                    : ` · juntado em ${quando} (o passo que ficou não está mais na tarefa)`}
                </span>
                <Button variant="ghost" size="sm" data-slot="separar-passo" disabled={!!estado?.somenteLeitura}
                  onClick={() => void atualizarComVolta(tarefa.id, (t) => comPassoSeparado(t, registro.id, p.id), "Passo separado: voltou para as pendências.")}>
                  <Split /> Separar
                </Button>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
