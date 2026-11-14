"use client";

// Uma página de conhecimento aberta: título, categoria e o texto no editor rico. Grava sozinha.

import { Archive, ArchiveRestore, Check, CloudOff, LoaderCircle, Trash2 } from "lucide-react";
import { PainelCitacoes } from "@/components/Citacoes";
import { useNexo } from "@/components/Provider";
import { PontoCor } from "@/components/comum";
import { EditorRico } from "@/components/editor/EditorRico";
import { useGravacao } from "@/components/useGravacao";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { dataRelativa } from "@/lib/lembretes";
import { Pagina, agoraISO, normalizarPagina } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function EditorPagina({
  id, pagina, categoriaInicial, aoArquivar, aoExcluir,
}: {
  /** Id da página. Se `pagina` não existir ainda, ela é criada com este id na primeira gravação. */
  id: string;
  pagina: Pagina | null;
  categoriaInicial?: string | null;
  aoArquivar: (p: Pagina, arquivar: boolean) => void;
  aoExcluir: (p: Pagina) => void;
}) {
  const { dados, salvarPaginas, estado } = useNexo();
  const somenteLeitura = !!estado?.somenteLeitura;
  const { valor, mudar, situacao } = useGravacao(id, pagina, (v, existe) => {
    const agora = agoraISO();
    return salvarPaginas((items) =>
      existe || items.some((p) => p.id === id)
        ? items.map((p) => (p.id === id ? { ...p, titulo: v.titulo, texto: v.texto, atualizadaEm: agora } : p))
        : [normalizarPagina({ id, titulo: v.titulo, texto: v.texto, categoriaId: categoriaInicial ?? null, criadaEm: agora, atualizadaEm: agora }), ...items],
    );
  });
  const categorias = (dados?.categorias.items ?? []).filter((c) => !c.arquivada || c.id === pagina?.categoriaId);
  const vazia = !valor.titulo.trim() && !valor.texto.trim();

  return (
    <div data-slot="editor-pagina" className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-6 pt-5">
          <Input
            value={valor.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
            disabled={somenteLeitura}
            placeholder="Título da página. Ex.: Como pedir uma exceção de vulnerabilidade"
            aria-label="Título da página"
            maxLength={200}
            className="h-10 text-base font-semibold tracking-tight placeholder:font-normal"
          />
          <EditorRico
            data-slot="texto-da-pagina"
            variante="pagina"
            valor={valor.texto}
            aoMudar={(v) => mudar({ texto: v })}
            desabilitado={somenteLeitura}
            placeholder="Escreva o que vale guardar: um processo, um passo a passo, quem procurar. Digite / para blocos e @ para citar uma tarefa, pessoa ou outra página."
            aria-label="Texto da página"
            className="min-h-0 flex-1 rounded-md border border-input bg-card shadow-xs dark:bg-input/20"
            classeConteudo="px-4 py-3.5 leading-relaxed"
          />
        </div>
        <footer className="flex flex-wrap items-center gap-2 px-6 py-3">
          <span data-slot="pagina-situacao" data-situacao={situacao} role="status"
            className={cn("mr-auto inline-flex items-center gap-1.5 text-[11px] sem-selecao", situacao === "erro" ? "text-alerta" : "text-muted-foreground")}>
            {situacao === "salvo" && (vazia ? "Página em branco" : <><Check className="size-3.5 text-sucesso" /> Salvo na pasta de dados{pagina ? ` · editada ${dataRelativa(pagina.atualizadaEm)}` : ""}</>)}
            {situacao === "pendente" && "Guardando..."}
            {situacao === "salvando" && <><LoaderCircle className="size-3.5 animate-spin" /> Salvando...</>}
            {situacao === "erro" && <><CloudOff className="size-3.5" /> Não consegui salvar. O texto está guardado neste navegador e tento de novo quando você digitar.</>}
          </span>
          {pagina && (
            <>
              <Combobox
                valor={pagina.categoriaId ?? ""}
                aoMudar={(v) => salvarPaginas((items) => items.map((p) => (p.id === id ? { ...p, categoriaId: v || null, atualizadaEm: agoraISO() } : p)))}
                opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> }))}
                placeholder="Sem categoria" rotuloLimpar="Sem categoria" aria-label="Categoria da página" className="h-8 w-52"
              />
              <Dica texto="Excluir a página (vai para a lixeira da pasta de dados)">
                <Button variant="ghost" size="icon" aria-label="Excluir página" onClick={() => aoExcluir(pagina)}><Trash2 /></Button>
              </Dica>
              <Button variant="outline" onClick={() => aoArquivar(pagina, !pagina.arquivadaEm)}>
                {pagina.arquivadaEm ? <><ArchiveRestore /> Desarquivar</> : <><Archive /> Arquivar</>}
              </Button>
            </>
          )}
        </footer>
      </div>
      {pagina && <PainelCitacoes tipo="pagina" alvo={pagina.id} titulo="Quem aponta para cá" className="mt-5 mr-6 mb-3 hidden w-72 shrink-0 self-start xl:block" />}
    </div>
  );
}
