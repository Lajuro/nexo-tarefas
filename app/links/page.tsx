"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Download, ExternalLink, FilterX, Library, Lock, Pencil, Plus, SearchX, Tag, Trash2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { IconeEstadoLink, OpcoesDeEstadoNoContexto, SeletorEstadoLink, useMudarEstado } from "@/components/links/EstadoLink";
import { IconeLink, NOME_GENERO, enderecoCurto, generoDoLink } from "@/components/links/IconeLink";
import { CatTag, Etiqueta, IconeStatus, Pagina, Vazio, copiarTexto, formatarTamanho } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Seletor } from "@/components/ui/select";
import { Dica } from "@/components/ui/popover";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from "@/components/ui/menu";
import { itemLista, lista as cascata } from "@/lib/animacoes";
import { dataLocal, dataRelativa } from "@/lib/lembretes";
import { type FiltroDeEstado, estadoAberto, passaNoFiltro, tarefasDoLink, tempoNoEstado, travando } from "@/lib/links";
import { Categoria, ESTADOS_LINK, LinkDoc, Tarefa, dataCurta, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Tipo = "" | "link" | "arquivo";

export default function Links() {
  const { dados, salvarLinks, toast } = useNexo();
  const confirmar = useConfirmar();
  const [form, setForm] = useState<{ aberto: boolean; link?: LinkDoc }>({ aberto: false });
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<Tipo>("");
  const [tagEscolhida, setTag] = useState("");
  const [estado, setEstado] = useState<FiltroDeEstado>("");
  const todas = dados!.links.items;
  const temEstado = useMemo(() => todas.some((l) => l.estado), [todas]);
  const emAberto = useMemo(() => todas.filter((l) => estadoAberto(l)).length, [todas]);
  const tarefaPorId = useMemo(() => new Map(dados!.tarefas.map((t) => [t.id, t])), [dados]);
  const tags = useMemo(() => [...new Set(todas.flatMap((l) => l.tags))].sort((a, b) => a.localeCompare(b, "pt-BR")), [todas]);
  // Se a última referência com a tag filtrada foi removida, o filtro deixa de valer.
  const tag = tags.includes(tagEscolhida) ? tagEscolhida : "";

  const lista = useMemo(() => {
    const n = semAcento(q);
    return todas
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !tag || l.tags.includes(tag))
      .filter((l) => passaNoFiltro(l, estado))
      .filter((l) => !n || semAcento(`${l.titulo} ${l.descricao} ${l.url} ${l.nomeArquivo} ${l.tags.join(" ")}`).includes(n))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [todas, q, tipo, tag, estado]);

  const filtrando = Boolean(q.trim() || tipo || tag || estado);
  const limpar = () => { setQ(""); setTipo(""); setTag(""); setEstado(""); };
  const adicionar = () => setForm({ aberto: true });

  async function copiar(l: LinkDoc) {
    const endereco = l.tipo === "arquivo" ? window.location.origin + hrefLink(l) : l.url || "";
    if (await copiarTexto(endereco)) toast(generoDoLink(l) === "rede" ? "Caminho copiado." : "Endereço copiado.", "info");
    else toast("Não consegui copiar. Selecione o endereço e copie manualmente.", "erro");
  }

  async function remover(l: LinkDoc) {
    const ok = await confirmar({
      titulo: "Remover da lista?",
      descricao: `“${l.titulo}” sai do banco de links e o registro vai para a lixeira.${l.tipo === "arquivo" ? " O arquivo continua na pasta de dados." : ""}`,
      confirmar: "Remover",
      perigo: true,
    });
    if (ok && (await salvarLinks((items) => items.filter((i) => i.id !== l.id)))) toast("Removido. O registro foi para a lixeira.", "info");
  }

  return (
    <Pagina
      titulo="Links e documentos"
      descricao="Seu banco de referências: links, arquivos e chamados, cada um servindo a quantas tarefas precisar."
      acoes={<Button onClick={adicionar}><Plus /> Adicionar</Button>}
      barra={
        todas.length > 0 && (
          <>
            <CampoBusca valor={q} aoMudar={setQ} placeholder="Buscar em links e documentos..." aria-label="Buscar em links e documentos" className="w-72 max-w-full" />
            <Segmentado
              aria-label="Tipo"
              valor={tipo}
              aoMudar={setTipo}
              opcoes={[{ valor: "", rotulo: "Todos" }, { valor: "link", rotulo: "Links" }, { valor: "arquivo", rotulo: "Arquivos" }]}
            />
            {tags.length > 0 && (
              <Seletor
                aria-label="Filtrar por tag"
                className="w-44"
                valor={tag}
                aoMudar={setTag}
                opcoes={[
                  { valor: "", rotulo: "Todas as tags" },
                  ...tags.map((t) => ({ valor: t, rotulo: <><Tag className="size-3.5 text-muted-foreground" />{t}</> })),
                ]}
              />
            )}
            {/* o filtro de status só aparece depois que algum link ganha status: antes disso não teria o que filtrar */}
            {temEstado && (
              <Seletor
                aria-label="Filtrar por status"
                className="w-48"
                valor={estado}
                aoMudar={(v) => setEstado(v as FiltroDeEstado)}
                opcoes={[
                  { valor: "", rotulo: "Todos os status" },
                  { valor: "abertos", rotulo: `Em aberto${emAberto ? ` (${emAberto})` : ""}` },
                  ...ESTADOS_LINK.map((e) => ({ valor: e.id, rotulo: <><IconeEstadoLink estado={e.id} />{e.nome}</> })),
                  { valor: "sem", rotulo: "Sem status" },
                ]}
              />
            )}
            <AnimatePresence>
              {filtrando && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.14 }}>
                  <Button variant="ghost" size="sm" onClick={limpar}><FilterX /> Limpar filtros</Button>
                </motion.div>
              )}
            </AnimatePresence>
            <span data-slot="contagem" className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
              {filtrando ? `${lista.length} de ${todas.length}` : `${todas.length} ${todas.length === 1 ? "item" : "itens"}`}
            </span>
          </>
        )
      }
    >
      {todas.length === 0 ? (
        <Vazio titulo="Nenhum link ou documento ainda" icone={<Library />}>
          <p>Guarde aqui o que você sempre precisa achar de novo: runbooks, políticas, painéis, pastas de rede e arquivos de apoio.</p>
          <Button onClick={adicionar}><Plus /> Adicionar</Button>
        </Vazio>
      ) : lista.length === 0 ? (
        <Vazio titulo="Nada encontrado" icone={<SearchX />}>
          <p>Nenhum link ou documento bate com os filtros de agora.</p>
          <Button variant="outline" onClick={limpar}><FilterX /> Limpar filtros</Button>
        </Vazio>
      ) : (
        <Table className="table-fixed">
          <THead>
            <Tr className="hover:bg-transparent">
              <Th>Título</Th>
              {/* o título é a coluna principal: as de apoio têm largura justa, e a data só entra em tela larga */}
              <Th className="w-[176px]">Status</Th>
              <Th className="w-[23%]">Vínculos</Th>
              <Th className="hidden w-[12%] lg:table-cell">Tags</Th>
              <Th className="hidden w-24 2xl:table-cell">Adicionado</Th>
              <Th className="w-[132px]"><span className="sr-only">Ações</span></Th>
            </Tr>
          </THead>
          <motion.tbody variants={cascata} initial="escondido" animate="visivel" className="[&_tr:last-child]:border-0">
            <AnimatePresence>
              {lista.map((l) => (
                <LinhaLink
                  key={l.id}
                  l={l}
                  tarefas={tarefasDoLink(l).map((id) => tarefaPorId.get(id)).filter((x): x is Tarefa => !!x)}
                  categoria={dados!.categorias.items.find((x) => x.id === l.categoriaId)}
                  tagAtiva={tag}
                  aoFiltrarTag={(x) => setTag(x === tag ? "" : x)}
                  aoCopiar={() => copiar(l)}
                  aoEditar={() => setForm({ aberto: true, link: l })}
                  aoRemover={() => remover(l)}
                />
              ))}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      )}
      <LinkForm aberto={form.aberto} link={form.link} fechar={() => setForm((f) => ({ ...f, aberto: false }))} />
    </Pagina>
  );
}

/** Quantas tarefas a coluna de vínculos mostra antes de resumir o resto em "e mais N". */
const TAREFAS_NA_LINHA = 2;

function LinhaLink({
  l, tarefas, categoria, tagAtiva, aoFiltrarTag, aoCopiar, aoEditar, aoRemover,
}: {
  l: LinkDoc; tarefas: Tarefa[]; categoria?: Categoria; tagAtiva: string;
  aoFiltrarTag: (t: string) => void; aoCopiar: () => void; aoEditar: () => void; aoRemover: () => void;
}) {
  const mudarEstado = useMudarEstado();
  const genero = generoDoLink(l);
  const href = hrefLink(l);
  const hrefBaixar = href + "&baixar=1";
  const endereco = l.tipo === "arquivo" ? [l.nomeArquivo, formatarTamanho(l.tamanho)].filter(Boolean).join(" · ") : enderecoCurto(l);
  const adicionado = dataLocal(l.criadoEm);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.tr
          data-slot="link"
          data-tipo={l.tipo}
          data-estado={l.estado || undefined}
          variants={itemLista}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          className="group/linha border-b transition-colors hover:bg-muted/40 data-[state=open]:bg-muted/40"
        >
          <Td>
            <div className="flex min-w-0 items-center gap-2.5">
              <Dica texto={NOME_GENERO[genero]}>
                <span className="inline-flex shrink-0"><IconeLink link={l} /></span>
              </Dica>
              <div className="min-w-0 flex-1">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  data-slot="link-titulo"
                  // O navegador costuma bloquear file:// a partir de uma página http: deixa o caminho pronto para colar.
                  onClick={genero === "rede" ? aoCopiar : undefined}
                  className="group/titulo inline-flex max-w-full items-center gap-1 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35"
                >
                  <span className="truncate underline-offset-2 group-hover/titulo:underline">{l.titulo}</span>
                  <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover/titulo:opacity-70 group-focus-visible/titulo:opacity-70" />
                </a>
                <div className="truncate text-xs text-muted-foreground">
                  {l.descricao ? (
                    <>
                      {l.descricao}
                      {endereco && <span className="text-muted-foreground/80"> · {endereco}</span>}
                    </>
                  ) : (
                    endereco
                  )}
                </div>
              </div>
            </div>
          </Td>
          <Td>
            <div className="flex min-w-0 flex-col items-start">
              {/* sem status, o convite para definir só aparece com o mouse ou o foco na linha (também está no botão direito e no Editar) */}
              <SeletorEstadoLink link={l} variante="selo"
                className={cn("-ml-1.5 max-w-full", !l.estado && "opacity-0 transition-opacity group-focus-within/linha:opacity-100 group-hover/linha:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100")} />
              {tempoNoEstado(l) && <span data-slot="tempo-no-estado" className="truncate text-xs text-muted-foreground tabular-nums">{tempoNoEstado(l)}</span>}
            </div>
          </Td>
          <Td>
            <div className="flex min-w-0 flex-col items-start gap-1">
              {tarefas.slice(0, TAREFAS_NA_LINHA).map((tarefa) => (
                <Link key={tarefa.id} href={`/tarefas/${tarefa.id}`} data-slot="tarefa-do-link"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  <IconeStatus status={tarefa.status} className="size-3" />
                  <span className="truncate">{tarefa.titulo}</span>
                  {travando(l, tarefa.id) && <Dica texto="Este link está travando a tarefa"><Lock aria-label="Travando a tarefa" className="size-3 shrink-0 text-alerta" /></Dica>}
                </Link>
              ))}
              {tarefas.length > TAREFAS_NA_LINHA && (
                <Dica texto={tarefas.slice(TAREFAS_NA_LINHA).map((t) => t.titulo).join(" · ")}>
                  <button type="button" onClick={aoEditar} className="rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    e mais {tarefas.length - TAREFAS_NA_LINHA} {tarefas.length - TAREFAS_NA_LINHA === 1 ? "tarefa" : "tarefas"}
                  </button>
                </Dica>
              )}
              {categoria && (
                <Link href={`/categorias/${categoria.id}`} className="max-w-full rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  <CatTag cat={categoria} className="max-w-full font-normal" />
                </Link>
              )}
              {!tarefas.length && !categoria && <span className="text-xs text-muted-foreground">Sem vínculo</span>}
            </div>
          </Td>
          <Td className="hidden lg:table-cell">
            <div className="flex flex-wrap gap-1">
              {l.tags.map((x) => (
                <Dica key={x} texto={x === tagAtiva ? "Tirar o filtro desta tag" : `Filtrar por “${x}”`}>
                  <button type="button" data-slot="tag" data-ativa={x === tagAtiva || undefined} onClick={() => aoFiltrarTag(x)}
                    className="max-w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
                    <Etiqueta className={cn(
                      "max-w-full transition-colors hover:bg-accent hover:text-accent-foreground",
                      x === tagAtiva && "bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary dark:bg-primary/22 dark:text-foreground",
                    )}>
                      <span className="truncate">{x}</span>
                    </Etiqueta>
                  </button>
                </Dica>
              ))}
            </div>
          </Td>
          <Td className="hidden 2xl:table-cell">
            <Dica texto={`Adicionado ${dataRelativa(adicionado)}`}>
              <span className="text-xs text-muted-foreground tabular-nums">{dataCurta(adicionado)}</span>
            </Dica>
          </Td>
          <Td className="py-1.5">
            <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within/linha:opacity-100 group-hover/linha:opacity-100 group-data-[state=open]/linha:opacity-100">
              {l.tipo === "arquivo" && (
                <Dica texto="Baixar">
                  <Button asChild variant="ghost" size="icon-sm">
                    <a href={hrefBaixar} aria-label={`Baixar ${l.titulo}`}><Download /></a>
                  </Button>
                </Dica>
              )}
              <Dica texto={genero === "rede" ? "Copiar caminho" : "Copiar endereço"}>
                <Button variant="ghost" size="icon-sm" aria-label={`Copiar endereço de ${l.titulo}`} onClick={aoCopiar}><Copy /></Button>
              </Dica>
              <Dica texto="Editar">
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${l.titulo}`} onClick={aoEditar}><Pencil /></Button>
              </Dica>
              <Dica texto="Remover">
                <Button variant="destructive-ghost" size="icon-sm" aria-label={`Remover ${l.titulo}`} onClick={aoRemover}><Trash2 /></Button>
              </Dica>
            </div>
          </Td>
        </motion.tr>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => window.open(href, "_blank", "noreferrer")}><ExternalLink /> Abrir em nova aba</ContextMenuItem>
        <ContextMenuItem onSelect={aoCopiar}><Copy /> {genero === "rede" ? "Copiar caminho" : "Copiar endereço"}</ContextMenuItem>
        {l.tipo === "arquivo" && (
          <ContextMenuItem onSelect={() => window.location.assign(hrefBaixar)}><Download /> Baixar</ContextMenuItem>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger><IconeEstadoLink estado={l.estado} /> Status</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <OpcoesDeEstadoNoContexto valor={l.estado} aoMudar={(e) => void mudarEstado(l, e)} />
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={aoEditar}><Pencil /> Editar</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem perigo onSelect={aoRemover}><Trash2 /> Remover</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
