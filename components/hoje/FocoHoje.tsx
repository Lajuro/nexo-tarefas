"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleMinus, Info, Plus, Sunrise, Target } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { abrirPlanejarDia } from "@/components/Shell";
import { BotaoMenuTarefa, MenuContextoTarefa, useAcoesTarefa } from "@/components/MenuTarefa";
import { CatTag, ItemPasso, PrazoTag, PrioBadge, Secao, SeletorStatus } from "@/components/comum";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { comFoco, comPassoAlternado } from "@/lib/acoes";
import { itemRemovivel } from "@/lib/animacoes";
import { SugestaoFoco, dataLocal, dataRelativa, passoEhMeu, sugestoesDeFoco, ultimaAtividade } from "@/lib/lembretes";
import { Categoria, Passo, Registro, Tarefa, hojeISO } from "@/lib/tipos";
import { EtiquetasMotivo } from "./apoio";

const MAX_FOCOS = 3;
const MAX_PASSOS = 5;

/** Foco de hoje: as poucas tarefas escolhidas para andar, com os próximos passos marcáveis ali mesmo. */
export function FocoHoje({ focos, tarefas, categorias }: { focos: Tarefa[]; tarefas: Tarefa[]; categorias: Categoria[] }) {
  const { atualizarTarefa, toast } = useNexo();
  const cat = (id: string | null) => categorias.find((c) => c.id === id) ?? null;
  const sugestoes = useMemo(
    () => sugestoesDeFoco(tarefas, 8).filter((s) => !focos.some((f) => f.id === s.tarefa.id)),
    [tarefas, focos],
  );

  const focar = async (t: Tarefa) => {
    if (await atualizarTarefa(t.id, (x) => comFoco(x, true))) toast("Entrou no foco de hoje.", "info");
  };

  return (
    <Secao
      titulo="Foco de hoje"
      icone={<Target />}
      contagem={focos.length || undefined}
      acoes={focos.length > 0 && sugestoes.length > 0 ? <AdicionarFoco sugestoes={sugestoes.slice(0, 5)} focar={focar} /> : undefined}
    >
      <div data-slot="foco-hoje" id="foco-hoje">
        {focos.length === 0 ? (
          <SemFoco sugestoes={sugestoes.slice(0, 3)} focar={focar} cat={cat} semAbertas={sugestoes.length === 0} />
        ) : (
          <>
            <div className="-mb-3">
              <AnimatePresence initial={false}>
                {focos.map((t) => (
                  <motion.div key={t.id} {...itemRemovivel} className="overflow-hidden">
                    <div className="pb-3">
                      <CartaoFoco tarefa={t} categoria={cat(t.categoriaId)} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {focos.length > MAX_FOCOS && (
              <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0 text-alerta" />
                São {focos.length} focos hoje. Com mais de {MAX_FOCOS} a atenção se divide: veja se algum pode ficar para amanhã.
              </p>
            )}
          </>
        )}
      </div>
    </Secao>
  );
}

// ---------- Cartão de uma tarefa em foco ----------

interface PassoDoFoco {
  registro: Registro;
  passo: Passo;
}

/** Passos em aberto e os concluídos hoje (para o risco ficar visível e dar para desfazer). Os meus primeiro. */
function passosDoFoco(t: Tarefa): { visiveis: PassoDoFoco[]; abertos: number; feitosHoje: number } {
  const hoje = hojeISO();
  const meus: PassoDoFoco[] = [];
  const deOutros: PassoDoFoco[] = [];
  let abertos = 0;
  let feitosHoje = 0;
  for (const registro of t.registros)
    for (const passo of registro.proximosPassos) {
      const feitoHoje = passo.feito && dataLocal(passo.feitoEm) === hoje;
      if (passo.feito && !feitoHoje) continue;
      if (passo.feito) feitosHoje++;
      else abertos++;
      (passoEhMeu(passo) ? meus : deOutros).push({ registro, passo });
    }
  return { visiveis: [...meus, ...deOutros], abertos, feitosHoje };
}

function CartaoFoco({ tarefa: t, categoria }: { tarefa: Tarefa; categoria: Categoria | null }) {
  const { atualizarTarefa, toast } = useNexo();
  const acoes = useAcoesTarefa();
  const { visiveis, abertos, feitosHoje } = passosDoFoco(t);
  const mostrados = visiveis.slice(0, MAX_PASSOS);
  const escondidos = visiveis.length - mostrados.length;

  const tirar = async () => {
    if (await atualizarTarefa(t.id, (x) => comFoco(x, false))) toast("Saiu do foco de hoje.", "info");
  };

  return (
    <MenuContextoTarefa tarefa={t}>
      <article
        data-slot="foco"
        data-tarefa={t.id}
        className="@container/foco relative overflow-hidden rounded-xl border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-ring/30 hover:shadow-sm"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-muted-foreground/25" style={categoria?.cor ? { background: categoria.cor } : undefined} />
        <div className="grid @2xl/foco:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="flex min-w-0 flex-col gap-2 py-3.5 pr-3 pl-5">
            <div className="flex items-center gap-1">
              <CatTag cat={categoria} className="mr-auto" />
              <PrioBadge p={t.prioridade} className="mr-1" />
              <Dica texto="Tirar do foco de hoje">
                <Button variant="ghost" size="icon-sm" aria-label="Tirar do foco de hoje" onClick={tirar}>
                  <CircleMinus />
                </Button>
              </Dica>
              <BotaoMenuTarefa tarefa={t} />
            </div>
            <Link
              href={`/tarefas/${t.id}`}
              className="line-clamp-2 w-fit rounded-sm text-[15px] leading-snug font-semibold tracking-tight outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              {t.titulo}
            </Link>
            {t.descricao.trim() && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.descricao.trim()}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
              <SeletorStatus status={t.status} aoMudar={(s) => acoes.mudarStatus(t, s)} />
              <PrazoTag prazo={t.prazo} />
              <span className="text-[11px] text-muted-foreground">Última novidade {dataRelativa(ultimaAtividade(t))}</span>
            </div>
          </div>

          <div className="min-w-0 border-t bg-muted/35 px-4 py-3 @2xl/foco:border-t-0 @2xl/foco:border-l dark:bg-muted/25">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground sem-selecao">
              <span>Próximos passos</span>
              {feitosHoje > 0 && <span className="text-sucesso">{feitosHoje === 1 ? "1 feito hoje" : `${feitosHoje} feitos hoje`}</span>}
              {abertos > 0 && <span className="ml-auto tabular-nums">{abertos === 1 ? "1 em aberto" : `${abertos} em aberto`}</span>}
            </div>
            {mostrados.length === 0 ? (
              <p className="py-1.5 text-[13px] leading-snug text-muted-foreground">
                Nenhum próximo passo definido.{" "}
                <Link href={`/tarefas/${t.id}`} className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:underline">
                  Registrar o que vem agora
                </Link>
              </p>
            ) : (
              <div className="flex flex-col">
                {mostrados.map(({ registro, passo }) => (
                  <ItemPasso
                    key={passo.id}
                    texto={passo.texto}
                    feito={passo.feito}
                    aoAlternar={(feito) => atualizarTarefa(t.id, (x) => comPassoAlternado(x, registro.id, passo.id, feito))}
                    meta={
                      !passo.feito && (!passoEhMeu(passo) || passo.prazo) ? (
                        <>
                          {!passoEhMeu(passo) && <span>com {passo.responsavel}</span>}
                          <PrazoTag prazo={passo.prazo} className="text-[11px] [&_svg]:size-3" />
                        </>
                      ) : undefined
                    }
                  />
                ))}
                {escondidos > 0 && (
                  <Link href={`/tarefas/${t.id}`} className="mt-1 w-fit rounded-sm pl-7 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
                    Mais {escondidos === 1 ? "1 passo" : `${escondidos} passos`} na tarefa
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </article>
    </MenuContextoTarefa>
  );
}

// ---------- Adicionar foco sem passar pelo ritual ----------

function AdicionarFoco({ sugestoes, focar }: { sugestoes: SugestaoFoco[]; focar: (t: Tarefa) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="-my-1" data-acao="adicionar-foco">
          <Plus /> Adicionar foco
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel>Sugestões para hoje</DropdownMenuLabel>
        {sugestoes.map(({ tarefa, motivos }) => (
          <DropdownMenuItem key={tarefa.id} onSelect={() => focar(tarefa)} className="items-start gap-2.5">
            <PrioBadge p={tarefa.prioridade} semDica className="mt-px size-5 text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{tarefa.titulo}</span>
              {motivos.length > 0 && <span className="block truncate text-[11px] text-muted-foreground">{motivos.join(" · ")}</span>}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => abrirPlanejarDia()}>
          <Sunrise /> Planejar o dia com calma
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Sem foco: convite para planejar, com as melhores sugestões ----------

function SemFoco({
  sugestoes, focar, cat, semAbertas,
}: {
  sugestoes: SugestaoFoco[]; focar: (t: Tarefa) => void; cat: (id: string | null) => Categoria | null; semAbertas: boolean;
}) {
  return (
    <motion.div
      data-slot="sem-foco"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-dashed p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target className="size-5" />
        </span>
        <div className="min-w-48 flex-1">
          <strong className="block text-sm font-semibold">Nenhum foco escolhido para hoje</strong>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {semAbertas
              ? "Não há tarefas abertas agora. Anote a próxima no campo acima."
              : `Escolha até ${MAX_FOCOS} tarefas para fazer andar de verdade. O resto continua guardado e eu lembro você.`}
          </p>
        </div>
        {!semAbertas && (
          <Button onClick={() => abrirPlanejarDia()}>
            <Sunrise /> Planejar o dia
          </Button>
        )}
      </div>

      {sugestoes.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground sem-selecao">Ou comece por uma destas</p>
          <div className="flex flex-col gap-1.5">
            {sugestoes.map(({ tarefa: t, motivos }) => (
              <MenuContextoTarefa key={t.id} tarefa={t}>
                <div data-slot="sugestao-foco" className="flex items-center gap-3 rounded-lg border bg-card py-2 pr-2 pl-3 shadow-xs transition-colors hover:border-ring/30">
                  <PrioBadge p={t.prioridade} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/tarefas/${t.id}`} className="block truncate rounded-sm text-[13px] font-medium outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35">
                      {t.titulo}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <CatTag cat={cat(t.categoriaId)} className="text-[11px]" />
                      <EtiquetasMotivo motivos={motivos} />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => focar(t)}>
                    <Target /> Focar
                  </Button>
                </div>
              </MenuContextoTarefa>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
