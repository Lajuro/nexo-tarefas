"use client";

// Página de um time: responsáveis, membros (adicionar, promover, tirar), categorias,
// o que está em aberto com gente do time e as tarefas relacionadas.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CircleCheckBig, Crown, ExternalLink, FolderTree, HandHelping, Hourglass, ListTodo, Pencil, UserRoundMinus, UsersRound, X,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { AvatarPessoa, CatTag, Estatistica, IconeStatus, Pagina, Painel, PontoCor, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Badge } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { aberta } from "@/lib/lembretes";
import { type EntradaPessoa, plural } from "@/lib/pessoas";
import type { Categoria, Time } from "@/lib/tipos";
import { ListaPassos } from "./ListaPassos";
import { TimeForm } from "./TimeForm";
import {
  BotaoMenu, EmblemaTime, MenuContexto, type AcaoMenu, acoesDoTime, cargoArea, hrefPessoa, porNome, primeiraLinha, resumirTime,
  useAcoesPessoa, useAcoesTime,
} from "./pecas";

export function DetalheTime({ time, diretorio }: { time: Time; diretorio: EntradaPessoa[] }) {
  const { dados } = useNexo();
  const router = useRouter();
  const acoes = useAcoesTime();
  const acoesPessoa = useAcoesPessoa();
  const [form, setForm] = useState(false);
  const r = useMemo(() => resumirTime(time, diretorio, dados!), [time, diretorio, dados]);
  const membros = r.membros.filter((m) => !time.responsavelIds.includes(m.pessoa!.id));
  const tarefasAbertas = r.tarefas.filter(aberta);
  const categoria = (id: string | null) => dados!.categorias.items.find((c) => c.id === id);

  const acoesMenu = acoesDoTime(time, {
    editar: () => setForm(true),
    arquivar: (v) => acoes.arquivar(time, v),
    remover: async () => { if (await acoes.remover(time)) router.push("/pessoas?aba=times"); },
  });

  const acoesMembro = (e: EntradaPessoa): AcaoMenu[] => {
    const id = e.pessoa!.id;
    const resp = time.responsavelIds.includes(id);
    return [
      { rotulo: "Abrir", icone: <ExternalLink />, aoClicar: () => router.push(hrefPessoa(e.nome)) },
      resp
        ? { rotulo: "Deixar de ser responsável", icone: <Crown />, aoClicar: () => acoes.definirResponsavel(time.id, id, false) }
        : { rotulo: "Tornar responsável", icone: <Crown />, aoClicar: () => acoes.definirResponsavel(time.id, id, true) },
      { rotulo: "Tirar do time", icone: <UserRoundMinus />, aoClicar: () => acoes.tirarDoTime(time.id, id), perigo: true, separar: true },
    ];
  };

  const candidatos = (dados!.pessoas.items ?? []).filter((p) => !p.arquivada && !time.membroIds.includes(p.id)).sort(porNome);

  // passos agrupados por pessoa, quem tem mais primeiro
  const grupos = r.membros
    .filter((m) => m.passosAbertos.length > 0)
    .sort((a, b) => b.passosAbertos.length - a.passosAbertos.length || porNome(a, b));

  return (
    <Pagina
      titulo={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{time.nome}</span>
          {time.arquivado && <Badge variant="outline">Arquivado</Badge>}
        </span>
      }
      descricao={time.descricao.trim() ? primeiraLinha(time.descricao) : "Sem descrição"}
      voltar={{ href: "/pessoas?aba=times", rotulo: "Times" }}
      antes={<EmblemaTime time={time} className="size-10 text-base" />}
      acoes={
        <>
          <Button variant="outline" onClick={() => setForm(true)}><Pencil /> Editar</Button>
          <BotaoMenu acoes={acoesMenu} rotulo={`Ações do time ${time.nome}`} tamanho="icon" />
        </>
      }
    >
      <div data-slot="resumo-time" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Estatistica rotulo="Pessoas no time" valor={r.membros.length} icone={<UsersRound />} />
        <Estatistica rotulo="Responsáveis" valor={r.responsaveis.length} icone={<Crown />} />
        <Estatistica rotulo="Em aberto com o time" valor={r.passos.length} tom="alerta" icone={<Hourglass />} />
        <Estatistica rotulo="Tarefas relacionadas" valor={tarefasAbertas.length} icone={<ListTodo />} />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Painel titulo="Responsáveis" icone={<Crown />} contagem={r.responsaveis.length} corpoClassName="p-2.5">
            {r.responsaveis.length === 0 ? (
              <p className="px-1.5 py-2 text-[13px] text-muted-foreground">
                Ninguém responde por este time ainda. Escolha alguém pelo menu de um membro, em “Tornar responsável”.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                <AnimatePresence initial={false}>
                  {r.responsaveis.map((e) => (
                    <motion.div key={e.chave} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
                      <MenuContexto acoes={acoesMembro(e)}>
                        <div data-slot="responsavel" data-nome={e.nome}
                          className="group/linha relative flex items-start gap-3 rounded-lg border border-alerta/30 bg-alerta/[0.05] p-3 transition-colors hover:border-alerta/50 data-[state=open]:border-alerta/50">
                          <AvatarPessoa nome={e.nome} tamanho="lg" className="size-10 text-[13px]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Link href={hrefPessoa(e.nome)} className="truncate rounded-sm text-sm font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/35">
                                {e.nome}
                              </Link>
                              <Crown className="size-3.5 shrink-0 text-alerta" aria-label="Responsável" />
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{cargoArea(e.pessoa) || "Sem cargo nem área"}</div>
                            {e.pessoa!.ajudaCom.trim() && (
                              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-foreground/80">
                                <HandHelping className="mt-px size-3.5 shrink-0 text-primary" />
                                <span className="line-clamp-2">{e.pessoa!.ajudaCom.trim()}</span>
                              </div>
                            )}
                          </div>
                          <BotaoMenu acoes={acoesMembro(e)} rotulo={`Ações de ${e.nome} no time`} className="-mt-1 -mr-1 opacity-60 group-hover/linha:opacity-100 data-[state=open]:opacity-100" />
                        </div>
                      </MenuContexto>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Painel>

          <Painel titulo="Membros" icone={<UsersRound />} contagem={membros.length} corpoClassName="flex flex-col gap-2 p-2">
            {membros.length === 0 ? (
              <p className="px-1.5 py-2 text-[13px] text-muted-foreground">
                {r.responsaveis.length ? "Além dos responsáveis, ninguém mais no time." : "O time ainda não tem ninguém."} Adicione abaixo.
              </p>
            ) : (
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {membros.map((e) => (
                    <motion.div key={e.chave} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                      <MenuContexto acoes={acoesMembro(e)}>
                        <div data-slot="membro" data-nome={e.nome}
                          className="group/linha relative grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50">
                          <AvatarPessoa nome={e.nome} tamanho="lg" />
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <Link href={hrefPessoa(e.nome)} className="shrink-0 truncate rounded-sm text-[13px] font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-[3px] focus-visible:ring-ring/35">
                                {e.nome}
                              </Link>
                              <span className="truncate text-xs text-muted-foreground">{cargoArea(e.pessoa)}</span>
                            </div>
                            {e.pessoa!.ajudaCom.trim() && (
                              <div className="flex min-w-0 items-center gap-1.5 text-xs text-foreground/75">
                                <HandHelping className="size-3 shrink-0 text-primary" />
                                <span className="truncate">{primeiraLinha(e.pessoa!.ajudaCom)}</span>
                              </div>
                            )}
                          </div>
                          {e.passosAbertos.length > 0
                            ? <Badge variant="alerta"><Hourglass /> {e.passosAbertos.length}</Badge>
                            : <span />}
                          <BotaoMenu acoes={acoesMembro(e)} rotulo={`Ações de ${e.nome} no time`} className="opacity-60 group-hover/linha:opacity-100 data-[state=open]:opacity-100" />
                        </div>
                      </MenuContexto>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <Combobox
              aria-label="Adicionar membro"
              valor=""
              aoMudar={(id) => id && acoes.adicionarMembro(time.id, id)}
              permitirLimpar={false}
              placeholder="Adicionar membro..."
              buscaPlaceholder="Buscar ou cadastrar pessoa..."
              vazio="Ninguém com esse nome."
              className="h-7 border-dashed bg-transparent text-xs shadow-none"
              opcoes={candidatos.map((p) => ({
                valor: p.id, rotulo: p.nome, detalhe: cargoArea(p) || undefined,
                render: <><AvatarPessoa nome={p.nome} tamanho="sm" /><span className="truncate">{p.nome}</span></>,
              }))}
              criar={async (nome) => {
                const nova = await acoesPessoa.criarRapido(nome);
                if (nova) await acoes.adicionarMembro(time.id, nova.id);
              }}
            />
          </Painel>

          <Painel titulo="Com o time" icone={<Hourglass />} contagem={r.passos.length} corpoClassName="p-0">
            {grupos.length === 0 ? (
              <Vazio compacto titulo="Nada pendente com o time" icone={<CircleCheckBig />} className="m-2 border-0">
                <p>Os próximos passos cujo responsável é alguém do time aparecem aqui.</p>
              </Vazio>
            ) : (
              <div className="divide-y">
                {grupos.map((e) => (
                  <div key={e.chave} data-slot="grupo-passos" data-nome={e.nome} className="px-3.5 py-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <AvatarPessoa nome={e.nome} />
                      <Link href={hrefPessoa(e.nome)} className="truncate rounded-sm text-[13px] font-semibold outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">{e.nome}</Link>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{plural(e.passosAbertos.length, "passo", "passos")}</span>
                    </div>
                    <div className="pl-8">
                      <ListaPassos passos={e.passosAbertos} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Painel>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <CategoriasDoTime time={time} />

          <Painel titulo="Tarefas relacionadas" icone={<ListTodo />} contagem={r.tarefas.length} corpoClassName="p-1.5">
            {r.tarefas.length === 0 ? (
              <p className="px-2 py-2 text-[13px] text-muted-foreground">
                Aparecem aqui as tarefas das categorias do time e as que têm registros com gente do time.
              </p>
            ) : (
              r.tarefas.slice(0, 30).map((t) => {
                const comMembros = r.membros.some((m) => m.tarefaIds.includes(t.id));
                return (
                  <MenuContextoTarefa key={t.id} tarefa={t}>
                    <Link href={`/tarefas/${t.id}`} data-slot="tarefa-relacionada"
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent ${aberta(t) ? "" : "opacity-60"}`}>
                      <IconeStatus status={t.status} className="mt-[3px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{t.titulo}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                          <CatTag cat={categoria(t.categoriaId)} className="text-[11px] font-normal" />
                          {comMembros && <span className="shrink-0">com gente do time</span>}
                        </span>
                      </span>
                    </Link>
                  </MenuContextoTarefa>
                );
              })
            )}
          </Painel>
        </aside>
      </div>

      <TimeForm aberto={form} fechar={() => setForm(false)} time={time} />
    </Pagina>
  );
}

function CategoriasDoTime({ time }: { time: Time }) {
  const { dados } = useNexo();
  const acoes = useAcoesTime();
  const cats = dados!.categorias.items;
  const porId = new Map(cats.map((c) => [c.id, c]));
  const doTime = time.categoriaIds.map((id) => porId.get(id)).filter((c): c is Categoria => !!c);
  return (
    <Painel titulo="Categorias do time" icone={<FolderTree />} contagem={doTime.length} corpoClassName="flex flex-col gap-2 p-2">
      {doTime.length > 0 && (
        <div className="flex flex-col">
          {doTime.map((c) => (
            <div key={c.id} data-slot="categoria-do-time" data-nome={c.nome} className="group/linha flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50">
              <Link href={`/categorias/${c.id}`} className="min-w-0 flex-1 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <CatTag cat={c} className="text-[13px] text-foreground" />
              </Link>
              <Dica texto="Desligar do time">
                <Button variant="ghost" size="icon-sm" aria-label={`Desligar ${c.nome} do time`} className="opacity-60 group-hover/linha:opacity-100"
                  onClick={() => acoes.definirCategorias(time.id, (ids) => ids.filter((x) => x !== c.id))}>
                  <X />
                </Button>
              </Dica>
            </div>
          ))}
        </div>
      )}
      <Combobox
        aria-label="Ligar o time a uma categoria"
        valor=""
        aoMudar={(id) => id && acoes.definirCategorias(time.id, (ids) => [...ids, id])}
        permitirLimpar={false}
        placeholder="Ligar a uma categoria..."
        buscaPlaceholder="Buscar categoria..."
        vazio="Nenhuma categoria com esse nome."
        className="h-7 border-dashed bg-transparent text-xs shadow-none"
        opcoes={cats
          .filter((c) => !c.arquivada && !time.categoriaIds.includes(c.id))
          .map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> }))}
      />
    </Painel>
  );
}
