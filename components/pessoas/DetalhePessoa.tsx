"use client";

// Página de uma pessoa (cadastrada ou nome solto dos registros): com o que pode ajudar,
// times e categorias (editáveis ali mesmo), o que está com ela, tarefas em comum e o histórico.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  CircleCheckBig, Copy, Crown, FolderTree, HandHelping, History, Hourglass, ListTodo, Mail, MessagesSquare, Pencil,
  UserRoundMinus, UserRoundPlus, UserRoundX, UsersRound, X,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import {
  AvatarPessoa, CatTag, ChipPessoa, Estatistica, Etiqueta, IconeStatus, IconeTipo, Pagina, Painel, PontoCor, TipoBadge, Vazio,
  copiarTexto,
} from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Badge } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista as cascata } from "@/lib/animacoes";
import { dataRelativa } from "@/lib/lembretes";
import { type EntradaPessoa, chaveNome, chavesDaPessoa, plural } from "@/lib/pessoas";
import { type Categoria, type Pessoa, type Time, agoraISO, formatarData } from "@/lib/tipos";
import { JuntarComo } from "./ListaPessoas";
import { ListaPassos } from "./ListaPassos";
import { PessoaForm } from "./PessoaForm";
import {
  BotaoMenu, EmblemaTime, type AcaoMenu, acoesDaPessoa, cargoArea, hrefPessoa, hrefTime, pessoasParecidas, porNome, useAcoesPessoa, useAcoesTime,
} from "./pecas";

function nomeDoMes(aaaaMm: string) {
  const [a, m] = aaaaMm.split("-").map(Number);
  const txt = new Date(a, (m || 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function DetalhePessoa({ entrada }: { entrada: EntradaPessoa }) {
  const { dados, toast } = useNexo();
  const router = useRouter();
  const acoes = useAcoesPessoa();
  const [form, setForm] = useState(false);
  const p = entrada.pessoa;
  const nome = entrada.nome;

  const tarefas = useMemo(
    () => entrada.tarefaIds.map((id) => dados!.tarefas.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t),
    [entrada, dados],
  );
  const categoria = (id: string | null) => dados!.categorias.items.find((c) => c.id === id);
  const ativas = useMemo(() => (dados!.pessoas.items ?? []).filter((x) => !x.arquivada), [dados]);
  const parecidas = useMemo(() => (p ? [] : pessoasParecidas(nome, ativas)), [p, nome, ativas]);

  async function copiarLista() {
    const texto = [
      `Pendências com ${nome}:`,
      ...entrada.passosAbertos.map(({ tarefa: t, registro: r, passo }) =>
        `- ${passo.texto} (${t.titulo}, desde ${formatarData(r.data, false)}${passo.prazo ? `, prazo ${formatarData(passo.prazo, false)}` : ""})`),
    ].join("\n");
    if (await copiarTexto(texto)) toast("Lista copiada. É só colar na conversa.", "info");
  }

  const acoesMenu: AcaoMenu[] = p
    ? acoesDaPessoa(p, {
      editar: () => setForm(true),
      arquivar: (v) => acoes.arquivar(p, v),
      remover: async () => { if (await acoes.remover(p)) router.push("/pessoas"); },
    })
    : [];

  const sub = p ? cargoArea(p) : "";

  return (
    <Pagina
      titulo={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{nome}</span>
          {p?.arquivada && <Badge variant="outline">Arquivada</Badge>}
          {!p && <Badge variant="outline">Sem cadastro</Badge>}
        </span>
      }
      descricao={
        p ? (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
            <span className="truncate">{sub || "Sem cargo nem área"}</span>
            {p.email && (
              <>
                <span aria-hidden className="text-muted-foreground/50">·</span>
                <a href={`mailto:${p.email}`} data-slot="email" className="inline-flex min-w-0 items-center gap-1 rounded-sm hover:text-foreground hover:underline">
                  <Mail className="size-3 shrink-0" />
                  <span className="truncate">{p.email}</span>
                </a>
                <Dica texto="Copiar e-mail">
                  <button
                    type="button"
                    aria-label="Copiar e-mail"
                    onClick={async () => { if (await copiarTexto(p.email)) toast("E-mail copiado.", "info"); }}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
                  >
                    <Copy className="size-3" />
                  </button>
                </Dica>
              </>
            )}
          </span>
        ) : (
          "Apareceu nos seus registros, mas ainda não tem cadastro."
        )
      }
      voltar={{ href: "/pessoas", rotulo: "Pessoas" }}
      antes={<AvatarPessoa nome={nome} tamanho="lg" className="size-11 text-sm" />}
      acoes={
        p ? (
          <>
            <Button variant="outline" onClick={() => setForm(true)}><Pencil /> Editar</Button>
            <BotaoMenu acoes={acoesMenu} rotulo={`Ações de ${nome}`} tamanho="icon" />
          </>
        ) : (
          <>
            <JuntarComo nome={nome} pessoas={ativas} parecidas={parecidas} rotulo="Juntar a alguém" juntar={(x) => acoes.juntarComoApelido(nome, x)} />
            <Button onClick={() => setForm(true)}><UserRoundPlus /> Cadastrar</Button>
          </>
        )
      }
    >
      <div data-slot="resumo-pessoa" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Estatistica rotulo="Registros" valor={entrada.registros.length} icone={<MessagesSquare />} />
        <Estatistica rotulo="Tarefas" valor={tarefas.length} icone={<ListTodo />} />
        <Estatistica rotulo="Em aberto com ela" valor={entrada.passosAbertos.length} tom="alerta" icone={<Hourglass />} />
        <div data-slot="estatistica" className="rounded-xl border bg-card px-3.5 py-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">Último contato</span>
            {entrada.ultimoContato && <span className="text-[11px] text-muted-foreground tabular-nums">{formatarData(entrada.ultimoContato)}</span>}
          </div>
          <span className={`mt-1 block truncate text-2xl leading-none font-semibold tracking-tight ${entrada.ultimoContato ? "" : "text-muted-foreground/60"}`}>
            {entrada.ultimoContato ? dataRelativa(entrada.ultimoContato) : "sem registro"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {p ? (
            <Sobre p={p} editar={() => setForm(true)} />
          ) : (
            <Painel titulo="Sem cadastro" icone={<UserRoundX />} corpoClassName="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 basis-72 text-[13px] text-muted-foreground">
                Cadastre {nome} para anotar com o que pode ajudar, ligar a times e categorias e achar mais rápido depois.
                {parecidas.length > 0 && <> Se for a mesma pessoa que <strong className="font-medium text-foreground">{parecidas[0].nome}</strong>, junte como apelido.</>}
              </p>
              <div className="flex gap-2">
                {parecidas[0] && (
                  <Button variant="outline" onClick={() => acoes.juntarComoApelido(nome, parecidas[0])}>É {parecidas[0].nome}</Button>
                )}
                <Button onClick={() => setForm(true)}><UserRoundPlus /> Cadastrar</Button>
              </div>
            </Painel>
          )}
          <Historico entrada={entrada} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          {p && <TimesDaPessoa p={p} entrada={entrada} />}
          {p && <CategoriasDaPessoa p={p} times={entrada.times} />}

          <Painel
            titulo="Com ela"
            icone={<Hourglass />}
            contagem={entrada.passosAbertos.length}
            corpoClassName="py-2.5"
            acoes={
              entrada.passosAbertos.length > 0 && (
                <Dica texto="Copiar a lista para cobrar">
                  <Button variant="ghost" size="icon-sm" aria-label="Copiar a lista para cobrar" onClick={copiarLista}><Copy /></Button>
                </Dica>
              )
            }
          >
            {entrada.passosAbertos.length === 0 ? (
              <Vazio compacto titulo="Nada pendente" icone={<CircleCheckBig />} className="my-1 border-0">
                <p>Quando um próximo passo tiver {nome} como responsável, ele aparece aqui.</p>
              </Vazio>
            ) : (
              <ListaPassos passos={entrada.passosAbertos} />
            )}
          </Painel>

          {tarefas.length > 0 && (
            <Painel titulo="Tarefas em comum" icone={<ListTodo />} contagem={tarefas.length} corpoClassName="p-1.5">
              {tarefas.map((t) => {
                const juntos = entrada.registros.filter((x) => x.tarefa.id === t.id).length;
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
          )}
        </aside>
      </div>

      <PessoaForm
        aberto={form}
        fechar={() => setForm(false)}
        pessoa={p}
        nomeInicial={p ? undefined : nome}
        aoSalvar={(nova) => { if (chaveNome(nova.nome) !== chaveNome(nome)) router.replace(hrefPessoa(nova.nome)); }}
      />
    </Pagina>
  );
}

/** "Pode ajudar com" em destaque, mais anotações, apelidos e tags. */
function Sobre({ p, editar }: { p: Pessoa; editar: () => void }) {
  const ajuda = p.ajudaCom.trim();
  return (
    <section data-slot="ajuda-com" className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-xs">
      <div className="bg-primary/[0.04] px-4 pt-3.5 pb-4 dark:bg-primary/[0.08]">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/12 text-primary"><HandHelping className="size-3.5" /></span>
          <h3 className="text-[13px] font-semibold tracking-tight">Pode ajudar com</h3>
          <Dica texto="Editar">
            <Button variant="ghost" size="icon-sm" aria-label="Editar com o que pode ajudar" className="ml-auto" onClick={editar}><Pencil /></Button>
          </Dica>
        </div>
        {ajuda ? (
          <p className="text-[15px] leading-relaxed texto-pre">{ajuda}</p>
        ) : (
          <button type="button" onClick={editar}
            className="w-full rounded-lg border border-dashed px-3 py-2.5 text-left text-[13px] text-muted-foreground transition-colors outline-none hover:border-ring/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
            Ainda não anotado. Com o que {p.nome.split(" ")[0]} pode te ajudar? Acessos, conhecimento de um sistema, aprovações...
          </button>
        )}
      </div>
      {(p.anotacoes.trim() || p.apelidos.length > 0 || p.tags.length > 0) && (
        <dl className="grid gap-x-4 gap-y-3 border-t px-4 py-3.5 text-[13px] sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          {p.anotacoes.trim() && (
            <>
              <dt className="text-xs font-medium text-muted-foreground sem-selecao">Anotações</dt>
              <dd className="leading-relaxed text-foreground/90 texto-pre">{p.anotacoes.trim()}</dd>
            </>
          )}
          {p.apelidos.length > 0 && (
            <>
              <dt className="text-xs font-medium text-muted-foreground sem-selecao">Também aparece como</dt>
              <dd data-slot="apelidos" className="flex flex-wrap gap-1">{p.apelidos.map((a) => <Etiqueta key={a}>{a}</Etiqueta>)}</dd>
            </>
          )}
          {p.tags.length > 0 && (
            <>
              <dt className="text-xs font-medium text-muted-foreground sem-selecao">Tags</dt>
              <dd className="flex flex-wrap gap-1">{p.tags.map((t) => <Etiqueta key={t}>#{t}</Etiqueta>)}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

/** Times da pessoa, com papel, editáveis sem abrir o formulário. */
function TimesDaPessoa({ p, entrada }: { p: Pessoa; entrada: EntradaPessoa }) {
  const { dados } = useNexo();
  const acoesTime = useAcoesTime();
  const disponiveis = [...dados!.times.items].filter((t) => !t.arquivado && !t.membroIds.includes(p.id)).sort(porNome);
  const times = [...entrada.times].sort(
    (a, b) => Number(b.responsavelIds.includes(p.id)) - Number(a.responsavelIds.includes(p.id)) || porNome(a, b),
  );
  return (
    <Painel titulo="Times" icone={<UsersRound />} contagem={times.length} corpoClassName="flex flex-col gap-2 p-2">
      {times.length > 0 && (
        <motion.div layout className="flex flex-col">
          {times.map((t) => {
            const resp = t.responsavelIds.includes(p.id);
            return (
              <div key={t.id} data-slot="time-da-pessoa" data-nome={t.nome} data-responsavel={resp || undefined}
                className="group/linha flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50">
                <EmblemaTime time={t} className="size-7 rounded-md text-xs" />
                <Link href={hrefTime(t.id)} className="min-w-0 flex-1 truncate rounded-sm text-[13px] font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  {t.nome}
                </Link>
                {resp
                  ? <Badge variant="alerta"><Crown /> Responsável</Badge>
                  : <span className="text-[11px] text-muted-foreground">Membro</span>}
                <BotaoMenu
                  rotulo={`Papel em ${t.nome}`}
                  className="opacity-60 group-hover/linha:opacity-100 data-[state=open]:opacity-100"
                  acoes={[
                    resp
                      ? { rotulo: "Deixar de ser responsável", icone: <Crown />, aoClicar: () => acoesTime.definirResponsavel(t.id, p.id, false) }
                      : { rotulo: "Tornar responsável", icone: <Crown />, aoClicar: () => acoesTime.definirResponsavel(t.id, p.id, true) },
                    { rotulo: "Tirar do time", icone: <UserRoundMinus />, aoClicar: () => acoesTime.tirarDoTime(t.id, p.id), perigo: true, separar: true },
                  ]}
                />
              </div>
            );
          })}
        </motion.div>
      )}
      <Combobox
        aria-label="Adicionar a um time"
        valor=""
        aoMudar={(id) => id && acoesTime.adicionarMembro(id, p.id)}
        permitirLimpar={false}
        placeholder={times.length ? "Adicionar a outro time..." : "Adicionar a um time..."}
        buscaPlaceholder="Buscar ou criar time..."
        vazio="Nenhum time com esse nome."
        className="h-7 border-dashed bg-transparent text-xs shadow-none"
        opcoes={disponiveis.map((t) => ({ valor: t.id, rotulo: t.nome, render: <><PontoCor cor={t.cor} /><span className="truncate">{t.nome}</span></> }))}
        criar={(nome) => acoesTime.criarRapido(nome, p.id)}
      />
    </Painel>
  );
}

/** Categorias ligadas direto à pessoa (editáveis) e as que vêm pelos times. */
function CategoriasDaPessoa({ p, times }: { p: Pessoa; times: Time[] }) {
  const { dados, salvarPessoas } = useNexo();
  const cats = dados!.categorias.items;
  const porId = new Map(cats.map((c) => [c.id, c]));
  const diretas = p.categoriaIds.map((id) => porId.get(id)).filter((c): c is Categoria => !!c);
  const pelosTimes = new Map<string, { cat: Categoria; times: string[] }>();
  for (const t of times) {
    if (t.arquivado) continue;
    for (const id of t.categoriaIds) {
      const c = porId.get(id);
      if (!c || p.categoriaIds.includes(id)) continue;
      const atual = pelosTimes.get(id) ?? { cat: c, times: [] };
      atual.times.push(t.nome);
      pelosTimes.set(id, atual);
    }
  }
  const mudar = (fn: (ids: string[]) => string[]) =>
    salvarPessoas((items) => items.map((i) => (i.id === p.id ? { ...i, categoriaIds: [...new Set(fn(i.categoriaIds))], atualizadaEm: agoraISO() } : i)));

  return (
    <Painel titulo="Categorias" icone={<FolderTree />} contagem={diretas.length + pelosTimes.size} corpoClassName="flex flex-col gap-2 p-2">
      {(diretas.length > 0 || pelosTimes.size > 0) && (
        <div className="flex flex-col">
          {diretas.map((c) => (
            <div key={c.id} data-slot="categoria-da-pessoa" data-nome={c.nome} className="group/linha flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50">
              <Link href={`/categorias/${c.id}`} className="min-w-0 flex-1 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <CatTag cat={c} className="text-[13px] text-foreground" />
              </Link>
              <Dica texto="Desligar desta categoria">
                <Button variant="ghost" size="icon-sm" aria-label={`Desligar de ${c.nome}`} className="opacity-60 group-hover/linha:opacity-100"
                  onClick={() => mudar((ids) => ids.filter((x) => x !== c.id))}>
                  <X />
                </Button>
              </Dica>
            </div>
          ))}
          {[...pelosTimes.values()].map(({ cat, times: ts }) => (
            <div key={cat.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
              <Link href={`/categorias/${cat.id}`} className="min-w-0 flex-1 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <CatTag cat={cat} className="text-[13px] font-normal" />
              </Link>
              <span className="max-w-[50%] shrink-0 truncate text-[11px] text-muted-foreground">pelo time {ts.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
      <Combobox
        aria-label="Ligar a uma categoria"
        valor=""
        aoMudar={(id) => id && mudar((ids) => [...ids, id])}
        permitirLimpar={false}
        placeholder="Ligar a uma categoria..."
        buscaPlaceholder="Buscar categoria..."
        vazio="Nenhuma categoria com esse nome."
        className="h-7 border-dashed bg-transparent text-xs shadow-none"
        opcoes={cats
          .filter((c) => !c.arquivada && !p.categoriaIds.includes(c.id))
          .map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> }))}
      />
    </Painel>
  );
}

function Historico({ entrada }: { entrada: EntradaPessoa }) {
  const regs = entrada.registros;
  const minhas = new Set(entrada.pessoa ? chavesDaPessoa(entrada.pessoa) : [entrada.chave]);
  return (
    <Painel titulo="Histórico" icone={<History />} contagem={regs.length} className="min-w-0" corpoClassName="p-0">
      {regs.length === 0 ? (
        <Vazio titulo="Nenhum registro com ela ainda" icone={<MessagesSquare />} className="border-0">
          <p>Quando {entrada.nome} aparecer como participante de um registro, a conversa entra aqui.</p>
        </Vazio>
      ) : (
        <motion.ol variants={cascata} initial="escondido" animate="visivel" className="px-4 pt-4 pb-1">
          {regs.map(({ tarefa: t, registro: r }, i) => {
            const mes = r.data.slice(0, 7);
            const novoMes = i === 0 || regs[i - 1].registro.data.slice(0, 7) !== mes;
            const ultimo = i === regs.length - 1;
            const texto = r.resumoIA || r.anotacoes;
            const outros = r.participantes.filter((n) => n.trim() && !minhas.has(chaveNome(n)));
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
  );
}
