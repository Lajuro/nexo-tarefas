"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Download, ExternalLink, FilterX, Library, Pencil, Plus, SearchX, Tag, Trash2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { IconeLink, NOME_GENERO, enderecoCurto, generoDoLink } from "@/components/links/IconeLink";
import { CatTag, Etiqueta, IconeStatus, Pagina, Vazio, copiarTexto, formatarTamanho } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Seletor } from "@/components/ui/select";
import { Dica } from "@/components/ui/popover";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/menu";
import { itemLista, lista as cascata } from "@/lib/animacoes";
import { dataLocal, dataRelativa } from "@/lib/lembretes";
import { Categoria, LinkDoc, Tarefa, formatarData, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Tipo = "" | "link" | "arquivo";

export default function Links() {
  const { dados, salvarLinks, toast } = useNexo();
  const confirmar = useConfirmar();
  const [form, setForm] = useState<{ aberto: boolean; link?: LinkDoc }>({ aberto: false });
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<Tipo>("");
  const [tagEscolhida, setTag] = useState("");
  const todas = dados!.links.items;
  const tags = useMemo(() => [...new Set(todas.flatMap((l) => l.tags))].sort((a, b) => a.localeCompare(b, "pt-BR")), [todas]);
  // Se a última referência com a tag filtrada foi removida, o filtro deixa de valer.
  const tag = tags.includes(tagEscolhida) ? tagEscolhida : "";

  const lista = useMemo(() => {
    const n = semAcento(q);
    return todas
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !tag || l.tags.includes(tag))
      .filter((l) => !n || semAcento(`${l.titulo} ${l.descricao} ${l.url} ${l.nomeArquivo} ${l.tags.join(" ")}`).includes(n))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [todas, q, tipo, tag]);

  const filtrando = Boolean(q.trim() || tipo || tag);
  const limpar = () => { setQ(""); setTipo(""); setTag(""); };
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
      descricao="Seu banco de referências: links importantes e arquivos, ligados a tarefas e categorias."
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
              <Th className="w-[26%]">Vínculos</Th>
              <Th className="w-[17%]">Tags</Th>
              <Th className="hidden w-28 xl:table-cell">Adicionado</Th>
              <Th className="w-[132px]"><span className="sr-only">Ações</span></Th>
            </Tr>
          </THead>
          <motion.tbody variants={cascata} initial="escondido" animate="visivel" className="[&_tr:last-child]:border-0">
            <AnimatePresence>
              {lista.map((l) => (
                <LinhaLink
                  key={l.id}
                  l={l}
                  tarefa={dados!.tarefas.find((x) => x.id === l.tarefaId)}
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

function LinhaLink({
  l, tarefa, categoria, tagAtiva, aoFiltrarTag, aoCopiar, aoEditar, aoRemover,
}: {
  l: LinkDoc; tarefa?: Tarefa; categoria?: Categoria; tagAtiva: string;
  aoFiltrarTag: (t: string) => void; aoCopiar: () => void; aoEditar: () => void; aoRemover: () => void;
}) {
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
                      {endereco && <span className="text-muted-foreground/60"> · {endereco}</span>}
                    </>
                  ) : (
                    endereco
                  )}
                </div>
              </div>
            </div>
          </Td>
          <Td>
            <div className="flex min-w-0 flex-col items-start gap-1">
              {tarefa && (
                <Link href={`/tarefas/${tarefa.id}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs font-medium outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  <IconeStatus status={tarefa.status} className="size-3" />
                  <span className="truncate">{tarefa.titulo}</span>
                </Link>
              )}
              {categoria && (
                <Link href={`/categorias/${categoria.id}`} className="max-w-full rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  <CatTag cat={categoria} className="max-w-full font-normal" />
                </Link>
              )}
              {!tarefa && !categoria && <span className="text-[11px] text-muted-foreground/60">Sem vínculo</span>}
            </div>
          </Td>
          <Td>
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
          <Td className="hidden xl:table-cell">
            <Dica texto={`Adicionado ${dataRelativa(adicionado)}`}>
              <span className="text-xs text-muted-foreground tabular-nums">{formatarData(adicionado)}</span>
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
        <ContextMenuItem onSelect={aoEditar}><Pencil /> Editar</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem perigo onSelect={aoRemover}><Trash2 /> Remover</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
