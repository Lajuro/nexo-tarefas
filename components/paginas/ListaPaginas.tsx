"use client";

// Lista de páginas: todas numa tabela, com filtro e ordenação por coluna.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bookmark, Search } from "lucide-react";
import { PontoCor, Vazio } from "@/components/comum";
import { Segmentado } from "@/components/ui/controles";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import { Input } from "@/components/ui/input";
import { dataRelativa } from "@/lib/lembretes";
import { caminhoDaPagina, nomeDaPagina, tamanhoDaLeitura } from "@/lib/paginas";
import { type Categoria, type Pagina, semAcento } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { type AcoesDePagina, BotaoMenuPagina, IconePagina, MenuContextoPagina, SeloEstado, nomeDoEstado } from "./pecas";

type Coluna = "nome" | "categoria" | "estado" | "palavras" | "atualizada";
type Quais = "ativas" | "arquivadas";

export function ListaPaginas({ paginas, categorias, acoes, aoAbrir }: { paginas: Pagina[]; categorias: Categoria[]; acoes: AcoesDePagina; aoAbrir: (id: string) => void }) {
  const [filtro, setFiltro] = useState("");
  const [quais, setQuais] = useState<Quais>("ativas");
  const [ordem, setOrdem] = useState<{ por: Coluna; desc: boolean }>({ por: "atualizada", desc: true });
  const cats = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const linhas = useMemo(() => {
    const ativas = paginas.filter((p) => !p.arquivadaEm);
    const q = semAcento(filtro.trim());
    const base = paginas
      .filter((p) => (quais === "arquivadas" ? !!p.arquivadaEm : !p.arquivadaEm))
      .map((p) => ({ p, nome: nomeDaPagina(p), caminho: caminhoDaPagina(ativas, p.id).map(nomeDaPagina).join(" / "), cat: cats.get(p.categoriaId ?? ""), palavras: tamanhoDaLeitura(p.texto).palavras }))
      .filter((l) => !q || semAcento(`${l.nome} ${l.caminho} ${l.cat?.nome ?? ""} ${l.p.tags.join(" ")} ${nomeDoEstado(l.p.estado ?? "rascunho")}`).includes(q));
    const chave = (l: (typeof base)[number]) =>
      ordem.por === "nome" ? l.nome : ordem.por === "categoria" ? l.cat?.nome ?? "￿" : ordem.por === "estado" ? ["rascunho", "revisao", "publicada"].indexOf(l.p.estado ?? "rascunho") : ordem.por === "palavras" ? l.palavras : l.p.atualizadaEm;
    return base.sort((a, b) => {
      const [x, y] = [chave(a), chave(b)];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return (ordem.desc ? -c : c) || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [paginas, filtro, quais, ordem, cats]);

  const Cabeca = ({ col, children, className }: { col: Coluna; children: React.ReactNode; className?: string }) => (
    <Th className={className} aria-sort={ordem.por === col ? (ordem.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setOrdem((o) => ({ por: col, desc: o.por === col ? !o.desc : col === "atualizada" || col === "palavras" }))}
        className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
        {children}
        {ordem.por === col && (ordem.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </Th>
  );

  return (
    <div data-slot="lista-de-paginas" className="mx-auto flex h-full w-full max-w-[1280px] flex-col gap-3 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome, tag, categoria ou estado" aria-label="Filtrar a lista de páginas" className="pl-8" />
        </div>
        <Segmentado aria-label="Quais páginas" tamanho="sm" valor={quais} aoMudar={setQuais} opcoes={[{ valor: "ativas", rotulo: "Ativas" }, { valor: "arquivadas", rotulo: "Arquivadas" }]} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">{linhas.length} {linhas.length === 1 ? "página" : "páginas"}</span>
      </div>
      {linhas.length === 0 ? (
        <Vazio compacto titulo={filtro ? "Nenhuma página com esse filtro" : quais === "arquivadas" ? "Nenhuma página arquivada" : "Nenhuma página ainda"} />
      ) : (
        <Table>
          <THead>
            <Tr>
              <Cabeca col="nome">Página</Cabeca>
              <Cabeca col="categoria">Categoria</Cabeca>
              <Cabeca col="estado">Estado</Cabeca>
              <Th>Tags</Th>
              <Cabeca col="palavras" className="text-right">Palavras</Cabeca>
              <Cabeca col="atualizada">Editada</Cabeca>
              <Th className="w-8" />
            </Tr>
          </THead>
          <TBody>
            {linhas.map(({ p, nome, caminho, cat, palavras }) => (
              <MenuContextoPagina key={p.id} pagina={p} acoes={acoes} aoAbrir={aoAbrir}>
                <Tr data-slot="linha-de-pagina" data-id={p.id} className="cursor-pointer" onClick={() => aoAbrir(p.id)}>
                  <Td className="max-w-[420px]">
                    <button type="button" onClick={(e) => { e.stopPropagation(); aoAbrir(p.id); }} className="flex w-full min-w-0 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                      <IconePagina pagina={p} className="text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate font-medium">{nome}{p.fixada && <Bookmark className="size-3 shrink-0 fill-primary text-primary" />}</span>
                        {caminho && <span className="block truncate text-[11px] text-muted-foreground">{caminho}</span>}
                      </span>
                    </button>
                  </Td>
                  <Td>{cat ? <span className="inline-flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span> : <span className="text-muted-foreground">sem categoria</span>}</Td>
                  <Td><SeloEstado estado={p.estado ?? "rascunho"} /></Td>
                  <Td><span className="flex flex-wrap gap-1">{p.tags.slice(0, 4).map((t) => <span key={t} className="rounded bg-muted px-1 text-[11px] font-medium text-muted-foreground">#{t}</span>)}</span></Td>
                  <Td className={cn("text-right tabular-nums", !palavras && "text-muted-foreground")}>{palavras}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{dataRelativa(p.atualizadaEm)}</Td>
                  <Td><BotaoMenuPagina pagina={p} acoes={acoes} aoAbrir={aoAbrir} /></Td>
                </Tr>
              </MenuContextoPagina>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
