"use client";

// Peças compartilhadas da área de Páginas: ícone da página, seletor de ícone, selo de estado,
// as ações (criar, mover, arquivar, excluir...) e o menu que as mostra (botão direito e "...").

import { type ReactNode, useCallback } from "react";
import {
  Archive, ArchiveRestore, ArrowDown, ArrowDownAZ, ArrowUp, Bookmark, BookmarkMinus, BookOpen, Box, Brain, Bug, Calendar, ChartColumn, CircleHelp, Clapperboard, Cloud, CodeXml, Copy, CopyPlus,
  Database, Ellipsis, Eye, FilePlus2, FileText, Flag, Folder, FolderInput, House, IndentDecrease, IndentIncrease, KeyRound, Lightbulb, Link2, ListChecks, Lock, type LucideIcon,
  Map as IconeMapa, MessageSquare, Move, Rocket, Shield, SquareTerminal, Star, Target, Trash2, Users, Workflow, Wrench, Zap,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { oferecerDesfazer } from "@/components/desfazer";
import { useConfirmar } from "@/components/Raiz";
import { copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import * as M from "@/components/ui/menu";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ICONES_DE_PAGINA, type IconeDePagina, type Reposicao, descendentes, duplicarPagina, lugaresQueMudaram, moverPagina, nomeDaPagina, ordenarPorNome, paginaDoModelo,
  posicaoNaArvore, reposicionar, reposicoesPossiveis, semPagina,
} from "@/lib/paginas";
import { apagarNotaPendente } from "@/lib/rascunhos";
import { hrefInterno } from "@/lib/texto-rico";
import { ESTADOS_PAGINA, type EstadoPagina, type Pagina, agoraISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ICONES: Record<IconeDePagina, LucideIcon> = {
  arquivo: FileText, livro: BookOpen, pasta: Folder, processo: Workflow, lista: ListChecks, video: Clapperboard, chave: KeyRound, escudo: Shield, bug: Bug,
  terminal: SquareTerminal, nuvem: Cloud, banco: Database, grafico: ChartColumn, lampada: Lightbulb, estrela: Star, bandeira: Flag, alvo: Target,
  calendario: Calendar, pessoas: Users, conversa: MessageSquare, ferramenta: Wrench, foguete: Rocket, mapa: IconeMapa, cadeado: Lock, olho: Eye,
  codigo: CodeXml, link: Link2, raio: Zap, casa: House, duvida: CircleHelp, caixa: Box, cerebro: Brain,
};
const NOME_DO_ICONE: Record<IconeDePagina, string> = {
  arquivo: "Documento", livro: "Livro", pasta: "Pasta", processo: "Processo", lista: "Lista", video: "Vídeo", chave: "Chave", escudo: "Escudo", bug: "Bug",
  terminal: "Terminal", nuvem: "Nuvem", banco: "Banco de dados", grafico: "Gráfico", lampada: "Ideia", estrela: "Estrela", bandeira: "Bandeira", alvo: "Alvo",
  calendario: "Calendário", pessoas: "Pessoas", conversa: "Conversa", ferramenta: "Ferramenta", foguete: "Foguete", mapa: "Mapa", cadeado: "Cadeado", olho: "Olho",
  codigo: "Código", link: "Link", raio: "Raio", casa: "Casa", duvida: "Dúvida", caixa: "Caixa", cerebro: "Cérebro",
};

const ehIcone = (x: unknown): x is IconeDePagina => typeof x === "string" && (ICONES_DE_PAGINA as readonly string[]).includes(x);

/** O ícone de uma página: o escolhido, ou o padrão (documento; pasta se tem filhas). */
export function IconePagina({ pagina, temFilhas, className }: { pagina: Pick<Pagina, "icone"> & { tipo?: Pagina["tipo"] }; temFilhas?: boolean; className?: string }) {
  const I = ehIcone(pagina.icone) ? ICONES[pagina.icone] : pagina.tipo === "video" ? Clapperboard : temFilhas ? Folder : FileText;
  return <I aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}

export function SeletorDeIcone({ pagina, aoEscolher, children }: { pagina: Pagina; aoEscolher: (icone: string) => void; children: ReactNode }) {
  return (
    <Popover>
      <Dica texto="Trocar o ícone">
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      </Dica>
      <PopoverContent align="start" className="w-[268px] p-2">
        <div data-slot="icones-de-pagina" className="grid grid-cols-8 gap-0.5">
          {ICONES_DE_PAGINA.map((k) => {
            const I = ICONES[k];
            return (
              <Dica key={k} texto={NOME_DO_ICONE[k]}>
                <button type="button" aria-label={NOME_DO_ICONE[k]} aria-pressed={pagina.icone === k} data-icone={k} onClick={() => aoEscolher(k)}
                  className={cn(
                    "inline-flex size-[30px] items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35",
                    pagina.icone === k && "bg-primary/12 text-primary",
                  )}>
                  <I className="size-4" />
                </button>
              </Dica>
            );
          })}
        </div>
        {pagina.icone && <Button variant="ghost" size="sm" className="mt-1.5 w-full text-muted-foreground" onClick={() => aoEscolher("")}>Voltar ao ícone padrão</Button>}
      </PopoverContent>
    </Popover>
  );
}

const TOM_DO_ESTADO: Record<EstadoPagina, string> = {
  rascunho: "border-border bg-muted text-muted-foreground",
  revisao: "border-alerta/30 bg-alerta/10 text-alerta",
  publicada: "border-sucesso/30 bg-sucesso/10 text-sucesso",
};
export const nomeDoEstado = (e: EstadoPagina) => ESTADOS_PAGINA.find((x) => x.id === e)?.nome ?? e;

export function SeloEstado({ estado, className }: { estado: EstadoPagina; className?: string }) {
  return (
    <span data-slot="estado-pagina" data-estado={estado} className={cn("inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium sem-selecao", TOM_DO_ESTADO[estado], className)}>
      {nomeDoEstado(estado)}
    </span>
  );
}

// ---------- ações ----------

/** Pede a janela "Mover para dentro de outra página" (montada na tela de Páginas). */
export const pedirMoverPagina = (id: string) => window.dispatchEvent(new CustomEvent("nexo:mover-pagina", { detail: id }));

/** Tudo o que se faz com uma página, passando pelo Provider (fila de gravação e revisão). */
export function useAcoesDePagina() {
  const { salvarPaginas, toast, dadosAtuais } = useNexo();
  const confirmar = useConfirmar();

  const mudar = useCallback(
    (id: string, parte: Partial<Pagina>) => salvarPaginas((items) => items.map((p) => (p.id === id ? { ...p, ...parte, atualizadaEm: agoraISO() } : p))),
    [salvarPaginas],
  );

  const atuais = () => dadosAtuais()?.paginas?.items ?? [];
  const nome = (id: string | null) => {
    const p = id ? atuais().find((x) => x.id === id) : null;
    return p ? `“${nomeDaPagina(p)}”` : "";
  };

  /**
   * Muda o lugar de páginas na árvore (mãe e posição) e oferece desfazer. Se nada muda, nada é gravado.
   * O desfazer volta só as páginas que continuam onde esta ação as deixou: quem mexeu depois não é passado por cima.
   */
  const reorganizar = async (fn: (items: Pagina[]) => Pagina[], texto: string, opcoes: { semAviso?: boolean } = {}) => {
    const agora = atuais();
    if (!lugaresQueMudaram(agora, fn(agora)).size) return false;
    let mudou: ReturnType<typeof lugaresQueMudaram> = new Map();
    const ok = await salvarPaginas((items) => {
      const novos = fn(items);
      mudou = lugaresQueMudaram(items, novos);
      return novos;
    });
    if (!ok || !mudou.size) return ok;
    const volta = mudou;
    oferecerDesfazer(
      texto,
      () =>
        salvarPaginas((items) =>
          items.map((p) => {
            const m = volta.get(p.id);
            if (!m || (p.paiId ?? null) !== m.para.paiId || (p.ordem ?? 0) !== m.para.ordem) return p;
            return { ...p, paiId: m.de.paiId, ordem: m.de.ordem };
          }),
        ),
      { tipo: "info", semAviso: opcoes.semAviso },
    );
    return true;
  };

  /** O texto do aviso depois de mover: para dentro de qual página, para a raiz, ou só de lugar. */
  const textoDoMovimento = (id: string, maeDepois: string | null) => {
    const maeAntes = posicaoNaArvore(atuais(), id)?.mae ?? null;
    if (maeAntes === maeDepois) return `${nome(id)} mudou de lugar.`;
    return maeDepois ? `${nome(id)} foi para dentro de ${nome(maeDepois)}.` : `${nome(id)} foi para a raiz.`;
  };

  return {
    mudar,
    /** Para onde a página pode ir dali (para o menu ligar e desligar os itens). */
    possiveis: (id: string) => {
      const lista = atuais();
      const pos = posicaoNaArvore(lista, id);
      const filhas = lista.filter((p) => !p.arquivadaEm && p.paiId === id).length;
      return { ...reposicoesPossiveis(lista, id), irmas: pos?.irmas.length ?? 0, filhas, nomeAcima: nome(reposicoesPossiveis(lista, id).acimaId), nomeMae: nome(pos?.mae ?? null) };
    },
    /** Cria uma página (de um modelo, se pedido) e devolve o id, ou null se não gravou. */
    criar: async (parte: Partial<Pagina> = {}, modeloId = "branco"): Promise<string | null> => {
      const nova = paginaDoModelo(modeloId, parte);
      const ok = await salvarPaginas((items) => {
        // entra no fim das irmãs
        const irmas = items.filter((p) => (p.paiId ?? null) === (nova.paiId ?? null));
        return [...items, { ...nova, ordem: irmas.reduce((m, p) => Math.max(m, p.ordem ?? 0), -1) + 1 }];
      });
      return ok ? nova.id : null;
    },
    /** Muda a página de lugar: para dentro de `mae` (null = raiz), antes de `antes` ou no fim. Com desfazer. */
    mover: (id: string, mae: string | null, antes: string | null = null) =>
      reorganizar((items) => moverPagina(items, id, mae, antes), textoDoMovimento(id, mae)),
    /** Um passo na árvore (acima, abaixo, para dentro da de cima, para fora). Pelo teclado, sem aviso na tela. */
    passo: (id: string, para: Reposicao, opcoes: { semAviso?: boolean } = {}) => {
      const depois = posicaoNaArvore(reposicionar(atuais(), id, para), id)?.mae ?? null;
      return reorganizar((items) => reposicionar(items, id, para), textoDoMovimento(id, depois), opcoes);
    },
    /** Ordem alfabética para as páginas de dentro de `maeId` (null = a raiz). */
    ordenar: (maeId: string | null) =>
      reorganizar((items) => ordenarPorNome(items, maeId), maeId ? `As páginas de dentro de ${nome(maeId)} ficaram em ordem alfabética.` : "As páginas da raiz ficaram em ordem alfabética."),
    fixar: (p: Pagina) => mudar(p.id, { fixada: !p.fixada }),
    duplicar: async (p: Pagina): Promise<string | null> => {
      const copia = duplicarPagina(p);
      return (await salvarPaginas((items) => [...items, copia])) ? copia.id : null;
    },
    /** Arquivar leva junto o que está dentro da página; desarquivar traz só ela. */
    arquivar: async (p: Pagina, sim: boolean) => {
      const agora = agoraISO();
      let mexidas: string[] = [];
      const ok = await salvarPaginas((items) => {
        const junto = sim ? descendentes(items.filter((x) => !x.arquivadaEm), p.id) : new Set<string>();
        mexidas = items.filter((x) => x.id === p.id || junto.has(x.id)).map((x) => x.id);
        return items.map((x) => (x.id === p.id || junto.has(x.id) ? { ...x, arquivadaEm: sim ? agora : null, atualizadaEm: agora } : x));
      });
      if (ok)
        oferecerDesfazer(sim ? "Página arquivada (com o que estava dentro dela). Os links continuam funcionando." : "Página de volta às ativas.",
          () => salvarPaginas((items) => items.map((x) => (mexidas.includes(x.id) ? { ...x, arquivadaEm: sim ? null : agora, atualizadaEm: agoraISO() } : x))),
          { tipo: "info" });
      return ok;
    },
    excluir: async (p: Pagina, depois?: () => void) => {
      const ok = await confirmar({
        titulo: "Excluir esta página?",
        descricao: `“${nomeDaPagina(p)}” vai para a lixeira da pasta de dados. As páginas de dentro dela sobem um nível, e quem cita esta página fica com um link que não abre mais nada.`,
        confirmar: "Excluir",
        perigo: true,
      });
      let antes: Pagina | null = null;
      let filhas: string[] = [];
      if (!ok || !(await salvarPaginas((items) => {
        antes = items.find((x) => x.id === p.id) ?? null;
        filhas = items.filter((x) => x.paiId === p.id).map((x) => x.id);
        return semPagina(items, p.id);
      }))) return false;
      apagarNotaPendente(p.id);
      const copia = antes as Pagina | null;
      oferecerDesfazer("Página excluída (foi para a lixeira da pasta de dados).", () =>
        copia
          ? salvarPaginas((items) => [
              ...items.filter((x) => x.id !== copia.id).map((x) => (filhas.includes(x.id) ? { ...x, paiId: copia.id } : x)),
              copia,
            ])
          : false,
        { tipo: "info" });
      depois?.();
      return true;
    },
    copiarLink: async (p: Pagina) => {
      if (await copiarTexto(`[${nomeDaPagina(p).replace(/([\\[\]])/g, "\\$1")}](${hrefInterno("pagina", p.id)})`)) toast("Link interno copiado. Cole em qualquer texto do Nexo.", "info");
    },
    copiarMarkdown: async (p: Pagina) => {
      if (await copiarTexto(`# ${nomeDaPagina(p)}\n\n${p.texto}\n`)) toast("Página copiada em Markdown.", "info");
    },
  };
}
export type AcoesDePagina = ReturnType<typeof useAcoesDePagina>;

// ---------- menu ----------

type Kit = { Item: typeof M.DropdownMenuItem; Sub: typeof M.DropdownMenuSub; SubTrigger: typeof M.DropdownMenuSubTrigger; SubContent: typeof M.DropdownMenuSubContent; Separator: typeof M.DropdownMenuSeparator; RadioGroup: typeof M.DropdownMenuRadioGroup; RadioItem: typeof M.DropdownMenuRadioItem };
const KIT_SUSPENSO: Kit = { Item: M.DropdownMenuItem, Sub: M.DropdownMenuSub, SubTrigger: M.DropdownMenuSubTrigger, SubContent: M.DropdownMenuSubContent, Separator: M.DropdownMenuSeparator, RadioGroup: M.DropdownMenuRadioGroup, RadioItem: M.DropdownMenuRadioItem };
const KIT_CONTEXTO = { Item: M.ContextMenuItem, Sub: M.ContextMenuSub, SubTrigger: M.ContextMenuSubTrigger, SubContent: M.ContextMenuSubContent, Separator: M.ContextMenuSeparator, RadioGroup: M.ContextMenuRadioGroup, RadioItem: M.ContextMenuRadioItem } as unknown as Kit;

export interface OpcoesDoMenuDaPagina {
  pagina: Pagina;
  acoes: AcoesDePagina;
  /** Abre uma página na área de trabalho (a recém-criada, a cópia). */
  aoAbrir: (id: string) => void;
  /** Depois de excluir (fechar a aba, por exemplo). */
  aoExcluir?: () => void;
}

function Itens({ pagina: p, acoes, aoAbrir, aoExcluir, k }: OpcoesDoMenuDaPagina & { k: Kit }) {
  return (
    <>
      {!p.arquivadaEm && (
        <k.Item onSelect={async () => { const id = await acoes.criar({ paiId: p.id, categoriaId: p.categoriaId }); if (id) aoAbrir(id); }}>
          <FilePlus2 /> Nova página dentro desta
        </k.Item>
      )}
      <k.Item onSelect={() => acoes.fixar(p)}>{p.fixada ? <BookmarkMinus /> : <Bookmark />} {p.fixada ? "Tirar das favoritas" : "Pôr nas favoritas"}</k.Item>
      <k.Sub>
        <k.SubTrigger><Flag /> Estado</k.SubTrigger>
        <k.SubContent>
          <k.RadioGroup value={p.estado ?? "rascunho"} onValueChange={(e) => acoes.mudar(p.id, { estado: e as EstadoPagina })}>
            {ESTADOS_PAGINA.map((e) => <k.RadioItem key={e.id} value={e.id}>{e.nome}</k.RadioItem>)}
          </k.RadioGroup>
        </k.SubContent>
      </k.Sub>
      <k.Separator />
      <k.Item onSelect={async () => { const id = await acoes.duplicar(p); if (id) aoAbrir(id); }}><CopyPlus /> Duplicar</k.Item>
      <k.Item onSelect={() => acoes.copiarLink(p)}><Link2 /> Copiar link interno</k.Item>
      <k.Item onSelect={() => acoes.copiarMarkdown(p)}><Copy /> Copiar em Markdown</k.Item>
      {!p.arquivadaEm && <ItensDeMover pagina={p} acoes={acoes} k={k} />}
      <k.Separator />
      <k.Item onSelect={() => acoes.arquivar(p, !p.arquivadaEm)}>{p.arquivadaEm ? <ArchiveRestore /> : <Archive />} {p.arquivadaEm ? "Desarquivar" : "Arquivar"}</k.Item>
      <k.Item perigo onSelect={() => acoes.excluir(p, aoExcluir)}><Trash2 /> Excluir</k.Item>
    </>
  );
}

/** O submenu "Mover": um passo para cada lado, para dentro de outra página, para a raiz e em ordem alfabética. */
function ItensDeMover({ pagina: p, acoes, k }: { pagina: Pagina; acoes: AcoesDePagina; k: Kit }) {
  const pode = acoes.possiveis(p.id);
  return (
    <k.Sub>
      <k.SubTrigger data-slot="menu-mover-pagina"><Move /> Mover</k.SubTrigger>
      <k.SubContent className="w-72">
        <k.Item data-acao="pagina-acima" disabled={!pode.acima} onSelect={() => acoes.passo(p.id, "acima")}><ArrowUp /> Para cima <M.MenuAtalho>Alt ↑</M.MenuAtalho></k.Item>
        <k.Item data-acao="pagina-abaixo" disabled={!pode.abaixo} onSelect={() => acoes.passo(p.id, "abaixo")}><ArrowDown /> Para baixo <M.MenuAtalho>Alt ↓</M.MenuAtalho></k.Item>
        <k.Item data-acao="pagina-dentro" disabled={!pode.dentro} onSelect={() => acoes.passo(p.id, "dentro")}>
          <IndentIncrease /> <span className="min-w-0 truncate">{pode.dentro ? `Para dentro de ${pode.nomeAcima}` : "Para dentro da de cima"}</span> <M.MenuAtalho>Alt Shift →</M.MenuAtalho>
        </k.Item>
        <k.Item data-acao="pagina-fora" disabled={!pode.fora} onSelect={() => acoes.passo(p.id, "fora")}>
          <IndentDecrease /> <span className="min-w-0 truncate">{pode.fora ? `Para fora de ${pode.nomeMae}` : "Para fora da mãe"}</span> <M.MenuAtalho>Alt Shift ←</M.MenuAtalho>
        </k.Item>
        <k.Separator />
        <k.Item data-acao="pagina-mover-para" onSelect={() => pedirMoverPagina(p.id)}><FolderInput /> Para dentro de outra página...</k.Item>
        {pode.fora && <k.Item onSelect={() => acoes.mover(p.id, null)}><House /> Levar para a raiz</k.Item>}
        {(pode.irmas > 1 || pode.filhas > 1) && <k.Separator />}
        {pode.irmas > 1 && (
          <k.Item data-acao="ordenar-nivel" onSelect={() => acoes.ordenar(pode.maeId)}><ArrowDownAZ /> {pode.maeId ? "Ordenar as irmãs de A a Z" : "Ordenar a raiz de A a Z"}</k.Item>
        )}
        {pode.filhas > 1 && <k.Item data-acao="ordenar-dentro" onSelect={() => acoes.ordenar(p.id)}><ArrowDownAZ /> Ordenar as de dentro de A a Z</k.Item>}
      </k.SubContent>
    </k.Sub>
  );
}

/** Botão direito sobre uma página. */
export function MenuContextoPagina({ children, ...o }: OpcoesDoMenuDaPagina & { children: ReactNode }) {
  return (
    <M.ContextMenu>
      <M.ContextMenuTrigger asChild>{children}</M.ContextMenuTrigger>
      <M.ContextMenuContent className="w-56">
        <Itens {...o} k={KIT_CONTEXTO} />
      </M.ContextMenuContent>
    </M.ContextMenu>
  );
}

/** Botão "..." com o mesmo menu. */
export function BotaoMenuPagina({ className, ...o }: OpcoesDoMenuDaPagina & { className?: string }) {
  return (
    <M.DropdownMenu>
      <M.DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Mais ações da página" className={className} onClick={(e) => e.stopPropagation()}><Ellipsis /></Button>
      </M.DropdownMenuTrigger>
      <M.DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <Itens {...o} k={KIT_SUSPENSO} />
      </M.DropdownMenuContent>
    </M.DropdownMenu>
  );
}
