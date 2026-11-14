"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Archive, ArchiveRestore, BookMarked, ChevronRight, Ellipsis, ExternalLink, FileText, FolderX, Link2, ListTodo, Pencil, Plus, Sparkles, Users,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { CardTarefa } from "@/components/CardTarefa";
import { CategoriaForm } from "@/components/CategoriaForm";
import { PromptModal } from "@/components/PromptModal";
import { abrirNovaTarefa } from "@/components/Shell";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { useAcoesCategoria } from "@/components/categorias/acoes";
import { TextoRico } from "@/components/tarefa/Texto";
import {
  AvatarPessoa, Contador, Estatistica, IconeStatus, Pagina, Painel, PontoCor, Secao, TipoBadge, Vazio, formatarTamanho,
} from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista } from "@/lib/animacoes";
import { usePref } from "@/lib/preferencias";
import { pessoasDaCategoria } from "@/lib/pessoas";
import { promptCategoria } from "@/lib/prompts";
import { LinkDoc, STATUS, STATUS_ABERTOS, Status, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const TOM_DO_STATUS: Record<Status, "neutro" | "primario" | "sucesso" | "alerta" | "perigo"> = {
  a_fazer: "neutro",
  em_andamento: "primario",
  aguardando: "alerta",
  bloqueada: "perigo",
  concluida: "sucesso",
  cancelada: "neutro",
};

const GRADE_TAREFAS = "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3";

/** Linha secundária de um link: a descrição, ou então de onde ele vem. */
function detalheDoLink(l: LinkDoc) {
  if (l.descricao) return l.descricao;
  if (l.tipo === "arquivo") return [l.nomeArquivo, formatarTamanho(l.tamanho)].filter(Boolean).join(" · ");
  try {
    return new URL(l.url || "").host || l.url || "";
  } catch {
    return l.url || "";
  }
}

export default function PaginaCategoria() {
  const { id } = useParams<{ id: string }>();
  const { dados } = useNexo();
  const { alternarArquivada } = useAcoesCategoria();
  const [editar, setEditar] = useState(false);
  const [prompt, setPrompt] = useState({ aberto: false, texto: "" });
  const [linkForm, setLinkForm] = useState(false);
  const [historicoAberto, setHistoricoAberto, prefCarregada] = usePref("historicoCategoria", true);

  const cat = dados?.categorias.items.find((c) => c.id === id);

  const ts = useMemo(
    () => (dados?.tarefas ?? []).filter((t) => t.categoriaId === id).sort((a, b) => b.prioridade - a.prioridade || a.titulo.localeCompare(b.titulo)),
    [dados, id],
  );
  const links = useMemo(() => (dados?.links.items ?? []).filter((l) => l.categoriaId === id), [dados, id]);
  const abertas = ts.filter((t) => STATUS_ABERTOS.includes(t.status));
  const fechadas = ts.filter((t) => !STATUS_ABERTOS.includes(t.status));
  const reunioes = ts.reduce((n, t) => n + t.registros.filter((r) => r.tipo === "reuniao").length, 0);
  // Registros marcados como referência: o que se aprendeu sobre o assunto e vale para qualquer tarefa dele.
  const referencias = useMemo(
    () => ts.flatMap((t) => t.registros.filter((r) => r.referencia).map((r) => ({ t, r }))).sort((a, b) => b.r.data.localeCompare(a.r.data)),
    [ts],
  );

  // Quem pode ajudar neste assunto: ligadas direto, por time ou por participação nos registros.
  const quemAjuda = useMemo(() => (dados ? pessoasDaCategoria(dados, id) : []), [dados, id]);
  const times = useMemo(
    () => (dados?.times?.items ?? []).filter((t) => !t.arquivado && t.categoriaIds.includes(id)),
    [dados, id],
  );

  if (!dados) return null;

  if (!cat)
    return (
      <Pagina titulo="Categoria não encontrada" voltar={{ href: "/categorias", rotulo: "Categorias" }}>
        <Vazio titulo="Categoria não encontrada" icone={<FolderX />}>
          <p>Ela pode ter sido removida, ou o endereço está errado. As tarefas continuam todas na lista de tarefas.</p>
          <Button asChild variant="outline"><Link href="/categorias">Voltar para Categorias</Link></Button>
        </Vazio>
      </Pagina>
    );

  const novaTarefa = () => abrirNovaTarefa(cat.id);
  // Descrição curta cabe no cabeçalho (em janela larga); a comprida, a com quebras de linha
  // ou qualquer uma em janela estreita vai inteira para o corpo da página, sem cortar.
  const descricao = cat.descricao.trim();
  const descricaoLonga = descricao.length > 70 || descricao.includes("\n");

  return (
    <Pagina
      voltar={{ href: "/categorias", rotulo: "Categorias" }}
      antes={<PontoCor cor={cat.cor} className="size-3.5 rounded-[5px] shadow-xs" />}
      titulo={
        <span className="flex items-center gap-2">
          <span className="truncate">{cat.nome}</span>
          {cat.arquivada && <Badge variant="outline" className="font-medium tracking-normal"><Archive /> arquivada</Badge>}
        </span>
      }
      descricao={descricao && !descricaoLonga ? <span className="max-xl:hidden">{descricao}</span> : undefined}
      acoes={
        <>
          <Dica texto={ts.length ? "Monta um prompt com todas as tarefas do assunto para colar no Copilot" : "Crie uma tarefa neste assunto primeiro"}>
            <span className="inline-flex">
              <Button variant="outline" disabled={!ts.length} onClick={() => setPrompt({ aberto: true, texto: promptCategoria(cat, ts) })}><Sparkles /> Panorama do assunto</Button>
            </span>
          </Dica>
          <Dica texto="Editar nome, descrição e cor">
            <Button variant="outline" aria-label="Editar" className="max-xl:w-8 max-xl:px-0" onClick={() => setEditar(true)}>
              <Pencil /> <span className="max-xl:hidden">Editar</span>
            </Button>
          </Dica>
          <DropdownMenu>
            <Dica texto="Mais ações">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações da categoria"><Ellipsis /></Button>
              </DropdownMenuTrigger>
            </Dica>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem onSelect={() => setLinkForm(true)}><Link2 /> Adicionar link ou documento</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void alternarArquivada(cat)}>
                {cat.arquivada ? <><ArchiveRestore /> Desarquivar</> : <><Archive /> Arquivar</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={novaTarefa}><Plus /> Nova tarefa aqui</Button>
        </>
      }
    >
      <div className="@container">
        {descricao && (
          <p data-slot="descricao-categoria" className={cn("mb-5 max-w-3xl text-sm leading-relaxed text-muted-foreground texto-pre", !descricaoLonga && "xl:hidden")}>
            {descricao}
          </p>
        )}
        <motion.div variants={lista} initial="escondido" animate="visivel" data-slot="numeros-categoria"
          className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
          {STATUS.map((s) => {
            const n = ts.filter((t) => t.status === s.id).length;
            return n ? (
              <motion.div key={s.id} variants={itemLista}>
                <Estatistica rotulo={s.nome} valor={n} tom={TOM_DO_STATUS[s.id]} icone={<IconeStatus status={s.id} />} />
              </motion.div>
            ) : null;
          })}
          <motion.div variants={itemLista}>
            <Estatistica rotulo="Reuniões registradas" valor={reunioes} icone={<Users />} />
          </motion.div>
        </motion.div>

        <div className="mt-8 grid items-start gap-x-6 gap-y-8 @4xl:grid-cols-[minmax(0,1fr)_352px]">
          <div className="min-w-0">
            {referencias.length > 0 && (
              <Secao titulo="Referência do assunto" contagem={referencias.length} icone={<BookMarked />}>
                <div data-slot="referencias" className="flex flex-col gap-3">
                  {referencias.map(({ t, r }) => (
                    <article key={r.id} data-slot="referencia" className="rounded-xl border bg-card px-4 py-3 shadow-xs">
                      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <TipoBadge tipo={r.tipo} />
                        <span className="text-xs text-muted-foreground tabular-nums">{formatarData(r.data)}</span>
                        <h3 className="min-w-0 text-sm leading-snug font-semibold tracking-tight">{r.titulo || "Sem título"}</h3>
                      </header>
                      <div className="mt-2 max-h-72 overflow-y-auto pr-1">
                        {r.resumoIA
                          ? <TextoRico texto={r.resumoIA} className="text-sm" />
                          : <TextoRico texto={r.anotacoes} className="text-sm" />}
                      </div>
                      <Link href={`/tarefas/${t.id}?r=${encodeURIComponent(r.id)}`}
                        className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                        Ver na tarefa “{t.titulo}” <ChevronRight className="size-3" />
                      </Link>
                    </article>
                  ))}
                </div>
              </Secao>
            )}
            <Secao titulo="Abertas" contagem={abertas.length} icone={<ListTodo />}>
              {abertas.length ? (
                <div className={GRADE_TAREFAS}>{abertas.map((t) => <CardTarefa key={t.id} t={t} cat={cat} />)}</div>
              ) : (
                <Vazio compacto titulo="Nenhuma tarefa aberta neste assunto" icone={<ListTodo />}>
                  <p>{fechadas.length ? "Tudo o que saiu daqui já foi encerrado." : "Quando surgir uma demanda deste assunto, crie a tarefa por aqui."}</p>
                  <Button variant="outline" size="sm" onClick={novaTarefa}><Plus /> Criar tarefa neste assunto</Button>
                </Vazio>
              )}
            </Secao>

            {fechadas.length > 0 && prefCarregada && (
              <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto} asChild>
                <section data-slot="historico" className="mt-8">
                  <h2>
                    <CollapsibleTrigger className="group/hist -ml-1 flex items-center gap-1.5 rounded-md py-1 pr-2 pl-1 text-left outline-none transition-colors sem-selecao hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35">
                      <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/hist:rotate-90" />
                      <span className="text-[13px] font-semibold tracking-tight">Histórico</span>
                      <Contador n={fechadas.length} />
                      <span className="ml-1 text-xs font-normal text-muted-foreground">concluídas e canceladas</span>
                    </CollapsibleTrigger>
                  </h2>
                  <CollapsibleContent className="-mx-2 px-2">
                    <div className={`${GRADE_TAREFAS} pt-3 pb-3`}>{fechadas.map((t) => <CardTarefa key={t.id} t={t} cat={cat} />)}</div>
                  </CollapsibleContent>
                </section>
              </Collapsible>
            )}
          </div>

          <aside className="grid min-w-0 items-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-1">
            <Painel
              titulo="Links e documentos do assunto"
              icone={<Link2 />}
              contagem={links.length || undefined}
              corpoClassName="p-1.5"
              acoes={
                <Dica texto="Adicionar link ou documento">
                  <Button variant="ghost" size="icon-sm" aria-label="Adicionar link ou documento" onClick={() => setLinkForm(true)}><Plus /></Button>
                </Dica>
              }
            >
              {links.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-muted-foreground">
                  Nada vinculado ainda. Guarde aqui a documentação, as pastas e os arquivos que valem para o assunto todo.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {links.map((l) => {
                    const detalhe = detalheDoLink(l);
                    return (
                      <li key={l.id}>
                        <a
                          href={hrefLink(l)}
                          target="_blank"
                          rel="noreferrer"
                          data-slot="link-do-assunto"
                          className="group/link flex items-start gap-2.5 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35"
                        >
                          <span className={`mt-px inline-flex size-7 shrink-0 items-center justify-center rounded-md ${l.tipo === "arquivo" ? "bg-primary/12 text-primary" : "bg-info/14 text-info"}`}>
                            {l.tipo === "arquivo" ? <FileText className="size-3.5" /> : <Link2 className="size-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] leading-snug font-medium [overflow-wrap:anywhere]">{l.titulo}</span>
                            {detalhe && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detalhe}</span>}
                          </span>
                          <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100 group-focus-visible/link:opacity-100" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>

            <Painel titulo="Quem pode ajudar" icone={<Users />} contagem={quemAjuda.length || undefined} corpoClassName="p-1.5">
              {times.length > 0 && (
                <div data-slot="times-do-assunto" className="flex flex-wrap gap-1.5 px-2 pt-1.5 pb-2">
                  {times.map((t) => (
                    <Link
                      key={t.id}
                      href={`/pessoas?time=${encodeURIComponent(t.id)}`}
                      data-slot="time-do-assunto"
                      className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border bg-card px-2 text-xs font-medium outline-none transition-colors hover:border-ring/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35"
                    >
                      <PontoCor cor={t.cor} />
                      <span className="truncate">{t.nome}</span>
                    </Link>
                  ))}
                </div>
              )}
              {quemAjuda.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-muted-foreground">
                  Ligue pessoas e times a este assunto no cadastro de pessoas. Quem participar das reuniões e atividades dele também aparece aqui.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {quemAjuda.map(({ entrada, motivos }) => {
                    const p = entrada.pessoa;
                    const funcao = [p?.cargo, p?.area].filter(Boolean).join(" · ");
                    return (
                      <li key={entrada.chave} data-slot="quem-ajuda" className="flex items-start gap-2.5 rounded-lg px-2 py-2">
                        <AvatarPessoa nome={entrada.nome} tamanho="lg" className="mt-px" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/pessoas?p=${encodeURIComponent(entrada.nome)}`}
                            className="rounded-sm text-[13px] leading-snug font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                            {entrada.nome}
                          </Link>
                          {funcao && <span className="block text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{funcao}</span>}
                          {p?.ajudaCom && <span className="mt-1 block text-xs leading-snug text-foreground/85 [overflow-wrap:anywhere] line-clamp-3 texto-pre">{p.ajudaCom}</span>}
                          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{motivos.map((m) => m.descricao).join(" · ")}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
          </aside>
        </div>
      </div>

      <CategoriaForm aberto={editar} fechar={() => setEditar(false)} cat={cat} />
      <LinkForm aberto={linkForm} fechar={() => setLinkForm(false)} categoriaId={cat.id} />
      <PromptModal aberto={prompt.aberto} fechar={() => setPrompt((p) => ({ ...p, aberto: false }))} titulo={`Panorama: ${cat.nome}`}
        explicacao="Junta todas as tarefas que nasceram deste assunto para a IA enxergar o todo."
        prompt={prompt.texto} />
    </Pagina>
  );
}
