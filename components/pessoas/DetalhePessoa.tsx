"use client";

// Página de uma pessoa: o que está com ela (passos em aberto), o histórico de conversas
// e as tarefas em comum. Recebe a pessoa já montada por montarPessoas().

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheckBig, Copy, History, Hourglass, ListTodo, MessagesSquare } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import {
  AvatarPessoa, CatTag, ChipPessoa, Estatistica, IconeStatus, IconeTipo, ItemPasso, Pagina, Painel, PrazoTag, TipoBadge, Vazio,
  copiarTexto,
} from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Dica } from "@/components/ui/popover";
import { comPassoAlternado } from "@/lib/acoes";
import { itemLista, itemRemovivel, lista as cascata } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { formatarData } from "@/lib/tipos";
import { Pessoa, chavePessoa, plural } from "./dados";

const hrefPessoa = (nome: string) => `/pessoas?p=${encodeURIComponent(nome)}`;

function nomeDoMes(aaaaMm: string) {
  const [a, m] = aaaaMm.split("-").map(Number);
  const txt = new Date(a, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function DetalhePessoa({ pessoa }: { pessoa: Pessoa }) {
  const { dados, atualizarTarefa, toast } = useNexo();
  // Passos concluídos nesta visita continuam na lista (riscados) para dar tempo de desfazer.
  const [feitosAqui, setFeitosAqui] = useState<Set<string>>(() => new Set());

  const passos = useMemo(() => pessoa.passos.filter((x) => !x.p.feito || feitosAqui.has(x.p.id)), [pessoa, feitosAqui]);
  const categoria = (id: string | null) => dados!.categorias.items.find((c) => c.id === id);
  const tarefasComRegistro = new Set(pessoa.regs.map((x) => x.t.id)).size;

  function alternar(tarefaId: string, registroId: string, passoId: string, feito: boolean) {
    if (feito) setFeitosAqui((s) => new Set(s).add(passoId));
    atualizarTarefa(tarefaId, (t) => comPassoAlternado(t, registroId, passoId, feito));
  }

  async function copiarLista() {
    const abertos = pessoa.passos.filter((x) => !x.p.feito);
    const texto = [
      `Pendências com ${pessoa.nome}:`,
      ...abertos.map(({ t, r, p }) => `- ${p.texto} (${t.titulo}, desde ${formatarData(r.data, false)}${p.prazo ? `, prazo ${formatarData(p.prazo, false)}` : ""})`),
    ].join("\n");
    if (await copiarTexto(texto)) toast("Lista copiada. É só colar na conversa.", "info");
  }

  return (
    <Pagina
      titulo={pessoa.nome}
      descricao="O que vocês conversaram e o que ficou combinado."
      voltar={{ href: "/pessoas", rotulo: "Pessoas" }}
      antes={<AvatarPessoa nome={pessoa.nome} tamanho="lg" className="size-10 text-[13px]" />}
    >
      <div data-slot="resumo-pessoa" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Estatistica rotulo="Registros" valor={pessoa.regs.length} icone={<MessagesSquare />} />
        <Estatistica rotulo="Tarefas" valor={pessoa.tarefas.length} icone={<ListTodo />} />
        <Estatistica rotulo="Em aberto com ela" valor={pessoa.abertos} tom="alerta" icone={<Hourglass />} />
        <div data-slot="estatistica" className="rounded-xl border bg-card px-3.5 py-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">Último contato</span>
            {pessoa.ultima && <span className="text-[11px] text-muted-foreground tabular-nums">{formatarData(pessoa.ultima)}</span>}
          </div>
          <span className={`mt-1 block truncate text-2xl leading-none font-semibold tracking-tight ${pessoa.ultima ? "" : "text-muted-foreground/60"}`}>
            {pessoa.ultima ? dataRelativa(pessoa.ultima) : "sem registro"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <aside className="flex min-w-0 flex-col gap-4 xl:order-2">
          <Painel
            titulo="Com ela"
            icone={<Hourglass />}
            contagem={pessoa.abertos}
            corpoClassName="py-2.5"
            acoes={
              pessoa.abertos > 0 && (
                <Dica texto="Copiar a lista para cobrar">
                  <Button variant="ghost" size="icon-sm" aria-label="Copiar a lista para cobrar" onClick={copiarLista}><Copy /></Button>
                </Dica>
              )
            }
          >
            {passos.length === 0 ? (
              <Vazio compacto titulo="Nada pendente" icone={<CircleCheckBig />} className="my-1 border-0">
                <p>Quando um próximo passo tiver {pessoa.nome} como responsável, ele aparece aqui.</p>
              </Vazio>
            ) : (
              <AnimatePresence initial={false}>
                {passos.map(({ t, r, p }) => (
                  <motion.div key={p.id} {...itemRemovivel} className="overflow-hidden">
                    <ItemPasso
                      texto={p.texto}
                      feito={p.feito}
                      aoAlternar={(feito) => alternar(t.id, r.id, p.id, feito)}
                      meta={
                        <>
                          <Link href={`/tarefas/${t.id}`}
                            className="inline-flex max-w-full items-center gap-1 rounded-sm font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                            <IconeStatus status={t.status} className="size-3" />
                            <span className="truncate">{t.titulo}</span>
                          </Link>
                          <span className="whitespace-nowrap tabular-nums">desde {formatarData(r.data, false)} ({dataRelativa(r.data)})</span>
                          {p.prazo && <PrazoTag prazo={p.prazo} concluida={p.feito} className="text-[11px] [&_svg]:size-3" />}
                        </>
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </Painel>

          <Painel titulo="Tarefas em comum" icone={<ListTodo />} contagem={pessoa.tarefas.length} corpoClassName="p-1.5">
            {pessoa.tarefas.map((t) => {
              const juntos = pessoa.regs.filter((x) => x.t.id === t.id).length;
              return (
                <MenuContextoTarefa key={t.id} tarefa={t}>
                  <Link href={`/tarefas/${t.id}`} data-slot="tarefa-em-comum"
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent">
                    <IconeStatus status={t.status} className="mt-[3px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{t.titulo}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                        <CatTag cat={categoria(t.categoriaId)} className="text-[11px] font-normal" />
                        <span className="shrink-0 tabular-nums">{juntos ? plural(juntos, "registro", "registros") : "só passos"}</span>
                      </span>
                    </span>
                  </Link>
                </MenuContextoTarefa>
              );
            })}
          </Painel>
        </aside>

        <Painel titulo="Histórico" icone={<History />} contagem={pessoa.regs.length} className="min-w-0 xl:order-1" corpoClassName="p-0">
          {pessoa.regs.length === 0 ? (
            <Vazio titulo="Nenhum registro com ela ainda" icone={<MessagesSquare />} className="border-0">
              <p>{pessoa.nome} aparece só como responsável por próximos passos. Ao incluir o nome como participante de um registro, a conversa entra aqui.</p>
            </Vazio>
          ) : (
            <motion.ol variants={cascata} initial="escondido" animate="visivel" className="px-4 pt-4 pb-1">
              {pessoa.regs.map(({ t, r }, i) => {
                const mes = r.data.slice(0, 7);
                const novoMes = i === 0 || pessoa.regs[i - 1].r.data.slice(0, 7) !== mes;
                const ultimo = i === pessoa.regs.length - 1;
                const texto = r.resumoIA || r.anotacoes;
                const outros = r.participantes.filter((n) => n.trim() && chavePessoa(n) !== pessoa.chave);
                return (
                  <Fragment key={t.id + r.id}>
                    {novoMes && (
                      <motion.li variants={itemLista}
                        className="mb-3 flex items-center gap-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sem-selecao not-first:mt-1">
                        {nomeDoMes(mes)}
                        <span className="h-px flex-1 bg-border" />
                      </motion.li>
                    )}
                    <motion.li variants={itemLista} data-slot="registro-pessoa" className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <IconeTipo tipo={r.tipo} comFundo />
                        {!ultimo && <span className="mt-1.5 mb-1.5 w-px flex-1 bg-border" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-4">
                        <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <Dica texto={dataRelativa(r.data)}>
                            <span className="font-medium text-foreground tabular-nums">{formatarData(r.data)}{r.hora ? ` ${r.hora}` : ""}</span>
                          </Dica>
                          <TipoBadge tipo={r.tipo} />
                          <Link href={`/tarefas/${t.id}`}
                            className="inline-flex min-w-0 items-center gap-1 rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                            <IconeStatus status={t.status} className="size-3" />
                            <span className="truncate">{t.titulo}</span>
                          </Link>
                        </div>
                        {r.titulo && (
                          <Link href={`/tarefas/${t.id}`}
                            className="mt-1 block rounded-sm text-sm leading-snug font-medium outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35">
                            {r.titulo}
                          </Link>
                        )}
                        {texto && (
                          <p className="mt-0.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground texto-pre">
                            {texto.slice(0, 280)}{texto.length > 280 ? "…" : ""}
                          </p>
                        )}
                        {outros.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">Também com</span>
                            {outros.map((n) => <ChipPessoa key={n} nome={n.trim()} href={hrefPessoa(n.trim())} />)}
                          </div>
                        )}
                      </div>
                    </motion.li>
                  </Fragment>
                );
              })}
            </motion.ol>
          )}
        </Painel>
      </div>
    </Pagina>
  );
}
