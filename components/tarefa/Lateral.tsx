"use client";

// Coluna lateral da página da tarefa: pendências, links, pessoas, último panorama e um resumo em números.

import { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, CircleCheck, FileText, Link2, ListChecks, Paperclip, Plus, RefreshCw, Unlink, Users } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { hrefLink } from "@/components/LinkForm";
import { ChipPessoa, Painel, copiarTexto, formatarTamanho } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { itemLista, itemRemovivel, lista } from "@/lib/animacoes";
import { aberta, dataLocal, dataRelativa, ultimaAtividade } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { LinkDoc, Tarefa, diasAte, formatarData, passosAbertos } from "@/lib/tipos";
import { IconeCopiar, SeloCopilot, useCopiado } from "./Copilot";
import { PassoDaTarefa } from "./Passos";
import { TextoRico } from "./Texto";

function Bloco({ slot, children }: { slot: string; children: ReactNode }) {
  return <motion.div variants={itemLista} data-slot={slot} className="min-w-0">{children}</motion.div>;
}

function Nada({ children, icone }: { children: ReactNode; icone?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
      {icone}
      {children}
    </p>
  );
}

function Pendencias({ tarefa, aoIrPara }: { tarefa: Tarefa; aoIrPara: (registroId: string) => void }) {
  const abertos = passosAbertos(tarefa);
  return (
    <Painel titulo="Pendências" icone={<ListChecks />} contagem={abertos.length} corpoClassName="py-2.5">
      {abertos.length === 0 && <Nada icone={<CircleCheck className="text-sucesso" />}>Nenhum passo em aberto.</Nada>}
      <AnimatePresence initial={false}>
        {abertos.map(({ registro, passo }) => (
          <motion.div key={passo.id} {...itemRemovivel} layout={false} className="-mx-1 overflow-hidden px-1">
            <PassoDaTarefa
              tarefaId={tarefa.id}
              registro={registro}
              passo={passo}
              extra={
                <Dica texto="Ver o registro na linha do tempo">
                  <button type="button" onClick={() => aoIrPara(registro.id)}
                    className="rounded-sm tabular-nums underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                    desde {formatarData(registro.data, false)}
                  </button>
                </Dica>
              }
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </Painel>
  );
}

function Links({ links, aoAdicionar }: { links: LinkDoc[]; aoAdicionar: () => void }) {
  const { salvarLinks, toast } = useNexo();
  const desvincular = async (l: LinkDoc) => {
    if (await salvarLinks((items) => items.map((i) => (i.id === l.id ? { ...i, tarefaId: null } : i))))
      toast("Desvinculado desta tarefa. Continua no banco de links.", "info");
  };
  return (
    <Painel
      titulo="Links e documentos"
      icone={<Paperclip />}
      contagem={links.length || undefined}
      corpoClassName="py-2.5"
      acoes={
        <Button variant="ghost" size="sm" onClick={aoAdicionar} aria-label="Adicionar link ou documento">
          <Plus /> Adicionar
        </Button>
      }
    >
      {links.length === 0 && <Nada>Nada vinculado ainda.</Nada>}
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {links.map((l) => (
            <motion.li key={l.id} {...itemRemovivel} layout={false} data-slot="link" className="overflow-hidden">
              <div className="group/link -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
                  {l.tipo === "arquivo" ? <FileText /> : <Link2 />}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={hrefLink(l)} target="_blank" rel="noreferrer"
                    className="line-clamp-2 rounded-sm text-[13px] leading-snug font-medium underline-offset-2 outline-none [overflow-wrap:anywhere] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                    {l.titulo}
                  </a>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {l.descricao || (l.tipo === "arquivo" ? formatarTamanho(l.tamanho) || l.nomeArquivo : l.url)}
                  </span>
                </div>
                <Dica texto="Desvincular desta tarefa">
                  <Button variant="ghost" size="icon-sm" aria-label={`Desvincular ${l.titulo}`} onClick={() => desvincular(l)}
                    className="shrink-0 opacity-0 group-hover/link:opacity-100 focus-visible:opacity-100">
                    <Unlink />
                  </Button>
                </Dica>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Painel>
  );
}

function Pessoas({ tarefa }: { tarefa: Tarefa }) {
  const m = new Map<string, number>();
  for (const r of tarefa.registros) for (const p of r.participantes) m.set(p, (m.get(p) || 0) + 1);
  const pessoas = [...m.entries()].sort((a, b) => b[1] - a[1]);
  if (!pessoas.length) return null;
  return (
    <Bloco slot="pessoas-tarefa">
      <Painel titulo="Pessoas envolvidas" icone={<Users />} contagem={pessoas.length}>
        <div className="flex flex-wrap gap-1.5">
          {pessoas.map(([p, n]) => (
            <Dica key={p} texto={n === 1 ? "Apareceu em 1 registro" : `Apareceu em ${n} registros`}>
              <span className="inline-flex max-w-full">
                <ChipPessoa nome={p} extra={n} href={`/pessoas?p=${encodeURIComponent(p)}`} />
              </span>
            </Dica>
          ))}
        </div>
      </Painel>
    </Bloco>
  );
}

function Panorama({ tarefa, aoGerar }: { tarefa: Tarefa; aoGerar: () => void }) {
  const { toast } = useNexo();
  const [aberto, setAberto] = usePref<boolean>("panoramaAberto", true);
  const [copiado, marcarCopiado] = useCopiado();
  const p = tarefa.panoramaIA;
  if (!p?.texto) return null;
  const dia = dataLocal(p.geradoEm);
  const novos = tarefa.registros.filter((r) => r.tipo !== "marco" && r.criadoEm > p.geradoEm).length;
  const copiar = async () => {
    if (await copiarTexto(p.texto)) {
      marcarCopiado();
      toast("Panorama copiado.", "info");
    }
  };
  return (
    <Bloco slot="panorama-tarefa">
      <Collapsible open={Boolean(aberto)} onOpenChange={setAberto} asChild>
        <section data-slot="painel" className="rounded-xl border bg-card shadow-xs">
          <header className="flex min-h-10 items-center gap-2 px-3.5 py-1.5">
            <SeloCopilot className="size-5 [&_svg]:size-3" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] leading-tight font-semibold tracking-tight">Último panorama da IA</h3>
              <p className="text-[11px] leading-snug text-muted-foreground tabular-nums">{formatarData(dia)} · {dataRelativa(dia)}</p>
            </div>
            <Dica texto="Copiar o panorama">
              <Button variant="ghost" size="icon-sm" aria-label="Copiar o panorama" onClick={copiar}>
                <IconeCopiar copiado={copiado} />
              </Button>
            </Dica>
            <Dica texto={aberto ? "Recolher" : "Mostrar"}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={aberto ? "Recolher o panorama" : "Mostrar o panorama"} className="group/pan">
                  <ChevronRight className="transition-transform duration-200 group-data-[state=open]/pan:rotate-90" />
                </Button>
              </CollapsibleTrigger>
            </Dica>
          </header>
          <CollapsibleContent>
            <div className="border-t px-3.5 py-3">
              <TextoRico texto={p.texto} className="max-h-80 overflow-y-auto pr-1 text-[13px]" />
              {novos > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-alerta/12 px-2.5 py-1.5 text-xs text-alerta">
                  <span className="min-w-0 flex-1 basis-40">
                    {novos === 1 ? "1 registro novo" : `${novos} registros novos`} depois deste panorama.
                  </span>
                  <Button variant="outline" size="sm" onClick={aoGerar}><RefreshCw /> Gerar de novo</Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>
    </Bloco>
  );
}

function Resumo({ tarefa }: { tarefa: Tarefa }) {
  const criada = dataLocal(tarefa.criadaEm);
  const ehAberta = aberta(tarefa);
  const fim = !ehAberta && tarefa.concluidaEm ? dataLocal(tarefa.concluidaEm) : null;
  const dias = Math.max(0, (fim ? diasAte(fim) ?? 0 : 0) - (diasAte(criada) ?? 0));
  const reunioes = tarefa.registros.filter((r) => r.tipo === "reuniao").length;
  const ultima = ultimaAtividade(tarefa);
  const celula = "flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 first:pl-3.5 last:pr-3.5";
  const valor = "truncate text-base leading-tight font-semibold tracking-tight tabular-nums";
  const rotulo = "text-[11px] leading-snug text-muted-foreground";
  return (
    <section data-slot="resumo-tarefa" className="flex divide-x rounded-xl border bg-card shadow-xs">
      <div className={celula}>
        <span className={valor}>{dias}</span>
        <span className={rotulo}>{dias === 1 ? "dia" : "dias"} {ehAberta ? "em aberto" : "do início ao fim"}</span>
      </div>
      <div className={celula}>
        <span className={valor}>{reunioes}</span>
        <span className={rotulo}>{reunioes === 1 ? "reunião" : "reuniões"}</span>
      </div>
      <div className={celula}>
        <Dica texto={`Último registro ou passo concluído: ${formatarData(ultima)}`}>
          <span className={valor}>{dataRelativa(ultima)}</span>
        </Dica>
        <span className={rotulo}>última atividade</span>
      </div>
    </section>
  );
}

export function Lateral({
  tarefa, links, aoIrPara, aoAdicionarLink, aoGerarPanorama, className,
}: {
  tarefa: Tarefa;
  links: LinkDoc[];
  /** Leva a linha do tempo até o registro e o destaca. */
  aoIrPara: (registroId: string) => void;
  aoAdicionarLink: () => void;
  aoGerarPanorama: () => void;
  className?: string;
}) {
  return (
    <motion.div data-slot="lateral" variants={lista} initial="escondido" animate="visivel" className={className}>
      <Bloco slot="pendencias-tarefa"><Pendencias tarefa={tarefa} aoIrPara={aoIrPara} /></Bloco>
      <Bloco slot="links-tarefa"><Links links={links} aoAdicionar={aoAdicionarLink} /></Bloco>
      <Pessoas tarefa={tarefa} />
      <Panorama tarefa={tarefa} aoGerar={aoGerarPanorama} />
      <Bloco slot="resumo"><Resumo tarefa={tarefa} /></Bloco>
    </motion.div>
  );
}
