"use client";

// "Links e documentos" da página da tarefa (3.14): tudo o que serve de material para ela. Links e arquivos do
// banco (que podem servir a várias tarefas ao mesmo tempo), páginas e folhas do bloco de notas.
// Cada link pode ter um status (para ler, lido, chamado aberto, concluído...) e pode estar travando a
// tarefa: aí aparece a faixa no cabeçalho (FaixaTravas) e, quando o chamado fecha, o lembrete "destravou".

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Ellipsis, ExternalLink, FilePlus2, Link2, Lock, LockOpen, Paperclip, Pencil, Plus, StickyNote, Unlink } from "lucide-react";
import { toast as sonner } from "sonner";
import { useNexo } from "@/components/Provider";
import { aoClicarEmArquivo } from "@/components/VisorDeImagem";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { Painel, copiarTexto, formatarTamanho } from "@/components/comum";
import { IconeEstadoLink, OpcoesDeEstado, SeletorEstadoLink, SeloTrava, useMudarEstado } from "@/components/links/EstadoLink";
import { IconeLink, enderecoCurto, generoDoLink } from "@/components/links/IconeLink";
import { IconePagina } from "@/components/paginas/pecas";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aplicarStatus, comImpedimentoDoLink } from "@/lib/acoes";
import { itemRemovivel } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import {
  comTarefaNoItem, comTarefaNoLink, comTrava, destravouPeloLink, estadoAberto, linkEhDaTarefa, nomeDaFolha, referenciasDaTarefa, resumoDoEstado, tarefasDoLink,
  travando, travasDaTarefa,
} from "@/lib/links";
import { nomeDaPagina, paginaNova } from "@/lib/paginas";
import { ESTADOS_PAGINA, type LinkDoc, type Nota, type Pagina, type Tarefa, agoraISO, normalizarNota, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Marcar e desmarcar um link como trava de uma tarefa (com o registro de impedimento na linha do tempo). */
export function useTrava() {
  const { salvarLinks, atualizarTarefa, atualizarComVolta, toast } = useNexo();
  return async (link: LinkDoc, tarefa: Tarefa, ligar: boolean) => {
    const agora = agoraISO();
    if (!(await salvarLinks((items) => items.map((i) => (i.id === link.id ? comTrava(i, tarefa.id, ligar, agora) : i))))) return;
    if (!ligar) return toast(`“${link.titulo}” não trava mais esta tarefa.`, "info");
    await atualizarTarefa(tarefa.id, (t) => comImpedimentoDoLink(t, link.titulo, link.url));
    const podeBloquear = tarefa.status === "a_fazer" || tarefa.status === "em_andamento";
    sonner.success("Marcado como trava. O impedimento ficou registrado na linha do tempo.", {
      duration: 7000,
      ...(podeBloquear
        ? { action: { label: "Marcar a tarefa como bloqueada", onClick: () => void atualizarComVolta(tarefa.id, (x) => aplicarStatus(x, "bloqueada", x), "A tarefa foi para Bloqueada.") } }
        : {}),
    });
  };
}

function Nada() {
  return <p className="text-[13px] text-muted-foreground">Nada ligado ainda. Links, arquivos, páginas e folhas que servem para esta tarefa aparecem aqui.</p>;
}

/** Faixa do cabeçalho da tarefa: o que a está travando agora (links marcados como trava, ainda em aberto). */
export function FaixaTravas({ tarefa, className }: { tarefa: Tarefa; className?: string }) {
  const { dados } = useNexo();
  const travar = useTrava();
  const travas = useMemo(() => travasDaTarefa(dados?.links.items ?? [], tarefa.id), [dados?.links.items, tarefa.id]);
  if (!travas.length || !aberta(tarefa)) return null;
  return (
    <div data-slot="faixa-travas" className={cn("flex flex-col gap-1 rounded-lg border border-alerta/35 bg-alerta/8 px-3 py-2", className)}>
      {travas.map((l) => (
        <div key={l.id} data-slot="trava" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Lock className="size-4 shrink-0 text-alerta" />
          <p className="min-w-0 flex-1 truncate text-[13px]">
            <span className="text-muted-foreground">Travada por </span>
            <a href={hrefLink(l)} target="_blank" rel="noreferrer" className="rounded-sm font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">{l.titulo}</a>
            <span className="text-muted-foreground"> · {resumoDoEstado(l)}</span>
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <SeletorEstadoLink link={l} variante="selo" className="border bg-card" />
            <Dica texto="O link continua ligado à tarefa, só deixa de ser um impedimento">
              <Button size="sm" variant="outline" data-slot="soltar-trava" onClick={() => void travar(l, tarefa, false)}><LockOpen /> Não trava mais</Button>
            </Dica>
          </div>
        </div>
      ))}
    </div>
  );
}

function LinhaLink({ l, tarefa, aoEditar }: { l: LinkDoc; tarefa: Tarefa; aoEditar: () => void }) {
  const { salvarLinks, toast } = useNexo();
  const mudarEstado = useMudarEstado();
  const travar = useTrava();
  const genero = generoDoLink(l);
  const outras = tarefasDoLink(l).length - 1;
  const trava = travando(l, tarefa.id);
  const destravou = !!destravouPeloLink(l, tarefa.id);
  const desvincular = async () => {
    if (await salvarLinks((items) => items.map((i) => (i.id === l.id ? comTarefaNoLink(i, tarefa.id, false) : i))))
      toast("Desvinculado desta tarefa. Continua no banco de links.", "info");
  };
  const copiar = async () => {
    const endereco = l.tipo === "arquivo" ? window.location.origin + hrefLink(l) : l.url || "";
    if (await copiarTexto(endereco)) toast(genero === "rede" ? "Caminho copiado." : "Endereço copiado.", "info");
  };
  const detalhe = l.descricao || (l.tipo === "arquivo" ? formatarTamanho(l.tamanho) || l.nomeArquivo : enderecoCurto(l));
  return (
    <motion.li {...itemRemovivel} layout={false} data-slot="link" data-estado={l.estado || undefined} data-trava={trava || undefined} className="overflow-hidden">
      <div className="group/link -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
        <IconeLink link={l} className="size-7 rounded-md [&_svg]:size-3.5" />
        <div className="min-w-0 flex-1">
          <a href={hrefLink(l)} target="_blank" rel="noreferrer"
            onClick={genero === "rede" ? copiar : l.tipo === "arquivo" ? (e) => aoClicarEmArquivo(e, hrefLink(l), l.nomeArquivo || l.arquivo || "", l.titulo) : undefined}
            className="line-clamp-2 rounded-sm text-[13px] leading-snug font-medium underline-offset-2 outline-none [overflow-wrap:anywhere] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            {l.titulo}
          </a>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {trava && <SeloTrava curto />}
            {destravou && <span data-slot="destravou-link" className="inline-flex items-center gap-1 font-medium text-sucesso"><LockOpen className="size-3" /> não trava mais</span>}
            {l.estado ? <span data-slot="resumo-estado" className="shrink-0">{resumoDoEstado(l)}</span> : <span className="min-w-0 truncate">{detalhe}</span>}
            {outras > 0 && (
              <Dica texto="Este link também está ligado a outras tarefas">
                <span data-slot="tambem-em" className="shrink-0">· em mais {outras} {outras === 1 ? "tarefa" : "tarefas"}</span>
              </Dica>
            )}
          </span>
        </div>
        {l.estado && <SeletorEstadoLink link={l} />}
        <DropdownMenu>
          <Dica texto="Status, trava e outras ações">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" data-slot="link-menu" aria-label={`Ações de ${l.titulo}`} className="shrink-0 text-muted-foreground"><Ellipsis /></Button>
            </DropdownMenuTrigger>
          </Dica>
          <DropdownMenuContent className="w-60">
            <DropdownMenuItem onSelect={() => window.open(hrefLink(l), "_blank", "noreferrer")}><ExternalLink /> Abrir em nova aba</DropdownMenuItem>
            <DropdownMenuItem onSelect={copiar}><Copy /> {genero === "rede" ? "Copiar caminho" : "Copiar endereço"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-slot="menu-status"><IconeEstadoLink estado={l.estado} /> Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <OpcoesDeEstado valor={l.estado} aoMudar={(e) => void mudarEstado(l, e)} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuCheckboxItem data-slot="menu-trava" checked={trava} onCheckedChange={(v) => void travar(l, tarefa, !!v)}>
              <Lock /> Está travando esta tarefa
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={aoEditar}><Pencil /> Editar e escolher as tarefas...</DropdownMenuItem>
            <DropdownMenuItem onSelect={desvincular}><Unlink /> Desvincular desta tarefa</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.li>
  );
}

function LinhaInterna({ slot, icone, titulo, detalhe, href, aoDesvincular }: { slot: string; icone: React.ReactNode; titulo: string; detalhe: string; href: string; aoDesvincular: () => void }) {
  return (
    <motion.li {...itemRemovivel} layout={false} data-slot={slot} className="overflow-hidden">
      <div className="group/link -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">{icone}</span>
        <div className="min-w-0 flex-1">
          <Link href={href} className="line-clamp-2 rounded-sm text-[13px] leading-snug font-medium underline-offset-2 outline-none [overflow-wrap:anywhere] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
            {titulo}
          </Link>
          <span className="block truncate text-xs text-muted-foreground">{detalhe}</span>
        </div>
        <Dica texto="Desvincular desta tarefa">
          <Button variant="ghost" size="icon-sm" aria-label={`Desvincular ${titulo}`} onClick={aoDesvincular}
            className="shrink-0 opacity-0 group-focus-within/link:opacity-100 group-hover/link:opacity-100 focus-visible:opacity-100">
            <Unlink />
          </Button>
        </Dica>
      </div>
    </motion.li>
  );
}

/** O balão do "Adicionar": criar algo novo para a tarefa ou ligar o que já existe (link, página, folha). */
function Adicionar({ tarefa, aoNovoLink }: { tarefa: Tarefa; aoNovoLink: () => void }) {
  const { dados, salvarLinks, salvarPaginas, salvarNotas, toast } = useNexo();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const livres = useMemo(() => {
    if (!dados || !aberto) return { links: [] as LinkDoc[], paginas: [] as Pagina[], notas: [] as Nota[] };
    return {
      links: dados.links.items.filter((l) => !linkEhDaTarefa(l, tarefa.id)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
      paginas: (dados.paginas?.items ?? []).filter((p) => !p.arquivadaEm && !(p.tarefaIds ?? []).includes(tarefa.id)).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)),
      notas: (dados.notas?.items ?? []).filter((n) => !(n.tarefaIds ?? []).includes(tarefa.id)).sort((a, b) => Number(!!a.arquivadaEm) - Number(!!b.arquivadaEm) || b.atualizadaEm.localeCompare(a.atualizadaEm)),
    };
  }, [dados, aberto, tarefa.id]);

  const fechar = () => setAberto(false);
  const ligarLink = async (l: LinkDoc) => {
    fechar();
    if (await salvarLinks((items) => items.map((i) => (i.id === l.id ? comTarefaNoLink(i, tarefa.id, true) : i)))) toast(`“${l.titulo}” agora também serve a esta tarefa.`);
  };
  const ligarPagina = async (p: Pagina) => {
    fechar();
    if (await salvarPaginas((items) => items.map((i) => (i.id === p.id ? comTarefaNoItem(i, tarefa.id, true) : i)))) toast(`Página “${nomeDaPagina(p)}” ligada a esta tarefa.`);
  };
  const ligarNota = async (n: Nota) => {
    fechar();
    if (await salvarNotas((items) => items.map((i) => (i.id === n.id ? comTarefaNoItem(i, tarefa.id, true) : i)))) toast(`Folha “${nomeDaFolha(n)}” ligada a esta tarefa.`);
  };
  const novaPagina = async () => {
    fechar();
    const nova = paginaNova({ titulo: tarefa.titulo, categoriaId: tarefa.categoriaId, tarefaIds: [tarefa.id], ordem: Date.now() / 1e9 });
    if (await salvarPaginas((items) => [...items, nova])) router.push(`/paginas?p=${nova.id}`);
  };
  const novaFolha = async () => {
    fechar();
    const agora = agoraISO();
    const nova = normalizarNota({ id: novoId("n"), titulo: tarefa.titulo, texto: "", tarefaIds: [tarefa.id], criadaEm: agora, atualizadaEm: agora });
    if (await salvarNotas((items) => [nova, ...items])) router.push(`/notas?n=${nova.id}`);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" data-slot="adicionar-referencia" aria-label="Adicionar link, documento, página ou folha"><Plus /> Adicionar</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector("input")?.focus(); }}>
        <Command>
          <CommandInput placeholder="Buscar link, página ou folha..." />
          <CommandList className="max-h-[22rem]">
            <CommandEmpty>Nada com esse nome. Crie um link novo acima.</CommandEmpty>
            <CommandGroup heading="Criar para esta tarefa">
              <CommandItem value="__novo link ou arquivo" data-slot="novo-link" onSelect={() => { fechar(); aoNovoLink(); }}><Link2 /> Novo link ou arquivo...</CommandItem>
              <CommandItem value="__nova pagina" data-slot="nova-pagina-da-tarefa" onSelect={() => void novaPagina()}><FilePlus2 /> Nova página</CommandItem>
              <CommandItem value="__nova folha do bloco de notas" data-slot="nova-folha-da-tarefa" onSelect={() => void novaFolha()}><StickyNote /> Nova folha no bloco de notas</CommandItem>
            </CommandGroup>
            {livres.links.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Do banco de links">
                  {livres.links.map((l) => (
                    <CommandItem key={l.id} value={`${l.titulo} ${l.id}`} keywords={[l.descricao, l.url || "", l.nomeArquivo || "", ...l.tags]} data-slot="ligar-link" onSelect={() => void ligarLink(l)}>
                      {l.tipo === "arquivo" ? <Paperclip /> : <Link2 />}
                      <span className="min-w-0 flex-1 truncate">{l.titulo}</span>
                      {l.estado ? <IconeEstadoLink estado={l.estado} /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {livres.paginas.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Páginas">
                  {livres.paginas.map((p) => (
                    <CommandItem key={p.id} value={`${nomeDaPagina(p)} ${p.id}`} keywords={p.tags} data-slot="ligar-pagina" onSelect={() => void ligarPagina(p)}>
                      <IconePagina pagina={p} />
                      <span className="min-w-0 flex-1 truncate">{nomeDaPagina(p)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {livres.notas.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Folhas do bloco de notas">
                  {livres.notas.map((n) => (
                    <CommandItem key={n.id} value={`${nomeDaFolha(n)} ${n.id}`} data-slot="ligar-folha" onSelect={() => void ligarNota(n)}>
                      <StickyNote />
                      <span className="min-w-0 flex-1 truncate">{nomeDaFolha(n)}</span>
                      {n.arquivadaEm && <span className="shrink-0 text-xs text-muted-foreground">arquivada</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PainelReferencias({ tarefa }: { tarefa: Tarefa }) {
  const { dados, salvarPaginas, salvarNotas, toast } = useNexo();
  const [form, setForm] = useState<{ aberto: boolean; link?: LinkDoc }>({ aberto: false });
  const refs = useMemo(
    () => (dados ? referenciasDaTarefa(dados, tarefa.id) : { links: [], paginas: [], notas: [] }),
    [dados, tarefa.id],
  );
  const total = refs.links.length + refs.paginas.length + refs.notas.length;
  const soltarPagina = async (p: Pagina) => {
    if (await salvarPaginas((items) => items.map((i) => (i.id === p.id ? comTarefaNoItem(i, tarefa.id, false) : i)))) toast("Página desvinculada desta tarefa. Ela continua em Páginas.", "info");
  };
  const soltarNota = async (n: Nota) => {
    if (await salvarNotas((items) => items.map((i) => (i.id === n.id ? comTarefaNoItem(i, tarefa.id, false) : i)))) toast("Folha desvinculada desta tarefa. Ela continua no bloco de notas.", "info");
  };
  // os que travam primeiro, depois os que ainda pedem algo, depois o resto
  const links = useMemo(
    () => [...refs.links].sort((a, b) => Number(travando(b, tarefa.id)) - Number(travando(a, tarefa.id)) || Number(estadoAberto(b)) - Number(estadoAberto(a))),
    [refs.links, tarefa.id],
  );
  return (
    <>
      <Painel
        titulo="Links e documentos"
        icone={<Paperclip />}
        contagem={total || undefined}
        corpoClassName="py-2.5"
        acoes={<Adicionar tarefa={tarefa} aoNovoLink={() => setForm({ aberto: true })} />}
      >
        {total === 0 && <Nada />}
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {links.map((l) => <LinhaLink key={l.id} l={l} tarefa={tarefa} aoEditar={() => setForm({ aberto: true, link: l })} />)}
            {refs.paginas.map((p) => (
              <LinhaInterna key={p.id} slot="pagina-da-tarefa" icone={<IconePagina pagina={p} />} titulo={nomeDaPagina(p)} href={`/paginas?p=${p.id}`}
                detalhe={`Página · ${p.arquivadaEm ? "arquivada" : ESTADOS_PAGINA.find((e) => e.id === (p.estado ?? "rascunho"))?.nome ?? "Rascunho"}`}
                aoDesvincular={() => void soltarPagina(p)} />
            ))}
            {refs.notas.map((n) => (
              <LinhaInterna key={n.id} slot="folha-da-tarefa" icone={<StickyNote />} titulo={nomeDaFolha(n)} href={`/notas?n=${n.id}`}
                detalhe={n.arquivadaEm ? "Folha do bloco de notas · arquivada" : "Folha do bloco de notas"}
                aoDesvincular={() => void soltarNota(n)} />
            ))}
          </AnimatePresence>
        </ul>
      </Painel>
      <LinkForm aberto={form.aberto} link={form.link} fechar={() => setForm((f) => ({ ...f, aberto: false }))}
        tarefaId={form.link ? undefined : tarefa.id} categoriaId={form.link ? undefined : tarefa.categoriaId} />
    </>
  );
}
