"use client";

// Editor de texto rico do Nexo, no estilo "blocos": digite "/" para escolher o bloco, use os atalhos de
// Markdown ("# ", "- ", "[] ", "> ", "```"), cole ou arraste imagens, monte tabelas e listas de tarefas.
// O valor é sempre uma string em Markdown (lib/texto-rico.ts explica o formato e a segurança).
//
// Imagens: colar (Ctrl V), arrastar ou escolher. O arquivo vai para a pasta de dados (arquivos/AAAA/...) pela
// mesma rota dos anexos e o texto guarda só o caminho. Nada é buscado de fora.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { exitSuggestion } from "@tiptap/suggestion";
import { AnimatePresence, motion } from "motion/react";
import {
  Bold, Code, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, Link2Off, List, ListChecks, ListOrdered, Minus, Pilcrow, Quote,
  SquareCode, Strikethrough, Table2, Trash2, type LucideIcon,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { linkPermitido, srcDoAnexo } from "@/lib/texto-rico";
import { cn } from "@/lib/utils";
import { type ItemDoMenu, type PonteDoMenu, extensoesDoEditor, pareceMarkdown } from "./extensoes";

const MAX_IMAGEM = 15 * 1024 * 1024;
const TIPOS_DE_IMAGEM = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const EXTENSAO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

const ICONE: Record<string, LucideIcon> = {
  texto: Pilcrow, h1: Heading1, h2: Heading2, h3: Heading3, lista: List, numerada: ListOrdered, tarefas: ListChecks, citacao: Quote,
  codigo: SquareCode, divisor: Minus, tabela: Table2, imagem: ImagePlus,
};

const p2 = (n: number) => String(n).padStart(2, "0");
/** Print colado chega como "image.png": ganha um nome que dá para reconhecer na pasta de anexos. */
function nomeDoPrint(tipo: string) {
  const d = new Date();
  return `print-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${EXTENSAO[tipo] ?? "png"}`;
}

interface EstadoMenu {
  itens: ItemDoMenu[];
  indice: number;
  topo: number;
  esquerda: number;
  paraCima: boolean;
  escolher: (i: ItemDoMenu) => void;
}

function BotaoBarra({
  dica, atalho, ativo, aoClicar, children, desabilitado,
}: {
  dica: string; atalho?: string; ativo?: boolean; aoClicar: () => void; children: React.ReactNode; desabilitado?: boolean;
}) {
  return (
    <Dica texto={dica} atalho={atalho}>
      <button type="button" aria-label={dica} aria-pressed={ativo} disabled={desabilitado}
        // mousedown não pode tirar o foco (e a seleção) do texto
        onMouseDown={(e) => e.preventDefault()}
        onClick={aoClicar}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
          ativo && "bg-accent text-primary",
        )}>
        {children}
      </button>
    </Dica>
  );
}

export function EditorRico({
  valor, aoMudar, placeholder = "Escreva, ou digite / para escolher um bloco", className, classeConteudo, variante = "campo", focoInicial, desabilitado,
  "aria-label": rotulo, "data-slot": slot = "editor-rico",
}: {
  /** Markdown. */
  valor: string;
  aoMudar: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** Classes da área de escrita (altura mínima e máxima, tamanho da letra). */
  classeConteudo?: string;
  /** "campo": caixa com borda, para formulários. "pagina": sem moldura, ocupa o espaço que tiver. */
  variante?: "campo" | "pagina";
  focoInicial?: boolean;
  desabilitado?: boolean;
  "aria-label"?: string;
  "data-slot"?: string;
}) {
  const { enviarArquivo, toast } = useNexo();
  const caixa = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const menuRef = useRef<EstadoMenu | null>(null);
  menuRef.current = menu;
  const emitido = useRef(valor);
  const editorRef = useRef<Editor | null>(null);
  // callbacks sempre atuais para o que é registrado uma vez só no editor
  const acoes = useRef({ aoMudar, enviarArquivo, toast });
  acoes.current = { aoMudar, enviarArquivo, toast };

  /** Manda as imagens para a pasta de dados e põe cada uma no texto (na posição dada ou onde está o cursor). */
  async function anexar(arquivos: File[], pos?: number) {
    const ed = editorRef.current;
    if (!ed) return;
    let onde = pos;
    for (const f of arquivos) {
      if (!TIPOS_DE_IMAGEM.includes(f.type)) {
        acoes.current.toast("Só dá para pôr no texto imagens PNG, JPG, GIF ou WebP. Outros arquivos vão em Links e docs.", "erro");
        continue;
      }
      if (f.size > MAX_IMAGEM) {
        acoes.current.toast("Essa imagem passa de 15 MB. Recorte ou reduza antes de colar.", "erro");
        continue;
      }
      const generico = !f.name || /^image\.[a-z]+$/i.test(f.name);
      const r = await acoes.current.enviarArquivo(generico ? new File([f], nomeDoPrint(f.type), { type: f.type }) : f);
      if (!r) continue;
      const no = { type: "image", attrs: { src: srcDoAnexo(r.arquivo), alt: r.nomeArquivo.replace(/\.[a-z0-9]+$/i, "") } };
      if (onde === undefined) ed.chain().focus().insertContent(no).run();
      else {
        ed.chain().focus().insertContentAt(onde, no).run();
        onde = undefined;
      }
    }
  }
  const anexarRef = useRef(anexar);
  anexarRef.current = anexar;

  const itens = useMemo<ItemDoMenu[]>(() => {
    const bloco = (fn: (ed: Editor, r: Range) => void) => fn;
    const limpo = (ed: Editor, r: Range) => ed.chain().focus().deleteRange(r);
    return [
      { id: "texto", nome: "Texto", dica: "Parágrafo comum", palavras: "paragrafo normal", fazer: bloco((ed, r) => limpo(ed, r).setParagraph().run()) },
      { id: "h1", nome: "Título 1", dica: "Título grande", palavras: "titulo cabecalho h1 #", fazer: bloco((ed, r) => limpo(ed, r).setHeading({ level: 1 }).run()) },
      { id: "h2", nome: "Título 2", dica: "Título de seção", palavras: "titulo subtitulo h2 ##", fazer: bloco((ed, r) => limpo(ed, r).setHeading({ level: 2 }).run()) },
      { id: "h3", nome: "Título 3", dica: "Título pequeno", palavras: "titulo h3 ###", fazer: bloco((ed, r) => limpo(ed, r).setHeading({ level: 3 }).run()) },
      { id: "lista", nome: "Lista", dica: "Lista com marcadores", palavras: "lista marcadores topicos bullet -", fazer: bloco((ed, r) => limpo(ed, r).toggleBulletList().run()) },
      { id: "numerada", nome: "Lista numerada", dica: "1, 2, 3...", palavras: "lista numerada ordenada 1.", fazer: bloco((ed, r) => limpo(ed, r).toggleOrderedList().run()) },
      { id: "tarefas", nome: "Lista de tarefas", dica: "Itens com caixinha para marcar", palavras: "tarefas checklist afazeres todo caixa []", fazer: bloco((ed, r) => limpo(ed, r).toggleTaskList().run()) },
      { id: "citacao", nome: "Citação", dica: "Destaque do que alguém disse", palavras: "citacao quote >", fazer: bloco((ed, r) => limpo(ed, r).toggleBlockquote().run()) },
      { id: "codigo", nome: "Bloco de código", dica: "Comando, trecho de log ou de código", palavras: "codigo comando log terminal ```", fazer: bloco((ed, r) => limpo(ed, r).toggleCodeBlock().run()) },
      { id: "tabela", nome: "Tabela", dica: "3 colunas por 3 linhas, para começar", palavras: "tabela grade planilha colunas", fazer: bloco((ed, r) => limpo(ed, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()) },
      { id: "imagem", nome: "Imagem", dica: "Escolher um arquivo (ou cole com Ctrl V)", palavras: "imagem foto print captura anexo", fazer: bloco((ed, r) => { limpo(ed, r).run(); arquivo.current?.click(); }) },
      { id: "divisor", nome: "Divisor", dica: "Linha separando dois assuntos", palavras: "divisor linha separador ---", fazer: bloco((ed, r) => limpo(ed, r).setHorizontalRule().run()) },
    ];
  }, []);

  // A "ponte" liga o plugin do menu "/" (que vive dentro do editor) ao estado do React que desenha a lista.
  const ponte = useRef<PonteDoMenu | null>(null);
  ponte.current = {
    abrir: (p) => ponte.current?.atualizar(p),
    atualizar: (p) => {
      const rect = p.clientRect?.();
      const base = caixa.current?.getBoundingClientRect();
      if (!rect || !base || p.items.length === 0) return setMenu(null);
      const alturaEstimada = Math.min(p.items.length, 8) * 38 + 12;
      const paraCima = rect.bottom + alturaEstimada > window.innerHeight - 8 && rect.top > alturaEstimada;
      setMenu((atual) => ({
        itens: p.items,
        indice: Math.min(atual?.indice ?? 0, p.items.length - 1),
        topo: (paraCima ? rect.top : rect.bottom) - base.top,
        esquerda: Math.max(0, Math.min(rect.left - base.left, base.width - 260)),
        paraCima,
        escolher: (i) => p.command(i),
      }));
    },
    tecla: ({ event }) => {
      const m = menuRef.current;
      if (!m) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const passo = event.key === "ArrowDown" ? 1 : -1;
        setMenu({ ...m, indice: (m.indice + passo + m.itens.length) % m.itens.length });
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        m.escolher(m.itens[m.indice]);
        return true;
      }
      if (event.key === "Escape") {
        setMenu(null);
        return true;
      }
      return false;
    },
    fechar: () => setMenu(null),
  };

  const editor = useEditor({
    extensions: extensoesDoEditor({ placeholder, itens, ponte: () => ponte.current }),
    content: valor,
    contentType: "markdown",
    editable: !desabilitado,
    autofocus: focoInicial ? "end" : false,
    // a página é montada no navegador (o Shell só desenha depois de ler os dados), mas o Next ainda passa pelo servidor
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(rotulo ? { "aria-label": rotulo } : {}),
        "data-slot": "editor-rico-conteudo",
        class: cn("prosa min-h-24 px-3 py-2.5 text-sm outline-none", classeConteudo),
        spellcheck: "true",
      },
      handlePaste: (_view, evento) => {
        const cd = evento.clipboardData;
        if (!cd) return false;
        const imagens = Array.from(cd.files).filter((f) => f.type.startsWith("image/"));
        const texto = cd.getData("text/plain");
        // print ou imagem copiada (sem texto junto): vira anexo. Planilha e Word mandam texto E imagem: fica o texto.
        if (imagens.length > 0 && !texto.trim()) {
          evento.preventDefault();
          anexarRef.current(imagens);
          return true;
        }
        // texto puro com cara de Markdown (resposta do Copilot copiada como texto): entra formatado
        if (texto && !cd.getData("text/html") && pareceMarkdown(texto)) {
          evento.preventDefault();
          editorRef.current?.commands.insertContent(texto, { contentType: "markdown" });
          return true;
        }
        return false;
      },
      handleDrop: (view, evento) => {
        const imagens = Array.from(evento.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (imagens.length === 0) return false;
        evento.preventDefault();
        anexarRef.current(imagens, view.posAtCoords({ left: evento.clientX, top: evento.clientY })?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      // parágrafos vazios no fim (o editor os grava como "&nbsp;") não precisam ir para o texto guardado
      const md = ed.isEmpty ? "" : ed.getMarkdown().replace(/(?:\s|&nbsp;)+$/, "");
      emitido.current = md;
      acoes.current.aoMudar(md);
    },
  });
  editorRef.current = editor;

  // Valor trocado por fora (rascunho recuperado, "descartar", outra folha): o editor acompanha, sem avisar de volta.
  useEffect(() => {
    if (!editor || valor === emitido.current) return;
    emitido.current = valor;
    editor.commands.setContent(valor, { contentType: "markdown", emitUpdate: false });
  }, [editor, valor]);

  useEffect(() => {
    editor?.setEditable(!desabilitado);
  }, [editor, desabilitado]);

  // Esc dentro de uma janela (components/ui/dialog.tsx): fecha o menu de blocos sem fechar a janela.
  useEffect(() => {
    if (!editor) return;
    const fechar = () => {
      if (!menuRef.current) return;
      exitSuggestion(editor.view);
      setMenu(null);
    };
    document.addEventListener("nexo:fechar-menu-editor", fechar);
    return () => document.removeEventListener("nexo:fechar-menu-editor", fechar);
  }, [editor]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            negrito: ed.isActive("bold"), italico: ed.isActive("italic"), riscado: ed.isActive("strike"), codigo: ed.isActive("code"),
            h1: ed.isActive("heading", { level: 1 }), h2: ed.isActive("heading", { level: 2 }), h3: ed.isActive("heading", { level: 3 }),
            lista: ed.isActive("bulletList"), numerada: ed.isActive("orderedList"), tarefas: ed.isActive("taskList"),
            citacao: ed.isActive("blockquote"), bloco: ed.isActive("codeBlock"), link: ed.isActive("link"), tabela: ed.isActive("table"),
            href: (ed.getAttributes("link").href as string | undefined) ?? "",
          }
        : null,
  });

  const [linkAberto, setLinkAberto] = useState(false);
  const [url, setUrl] = useState("");
  const aplicarLink = () => {
    if (!editor) return;
    const bruto = url.trim();
    if (!bruto) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return setLinkAberto(false);
    }
    const href = linkPermitido(/^[a-z][a-z0-9+.-]*:/i.test(bruto) ? bruto : `https://${bruto}`);
    if (!href) return toast("Esse endereço não é aceito. Use um link que comece com http, https ou mailto.", "erro");
    const { empty } = editor.state.selection;
    // sem texto selecionado e fora de um link: o próprio endereço vira o texto
    if (empty && !estado?.link) editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkAberto(false);
  };

  const c = () => editor!.chain().focus();
  const pagina = variante === "pagina";

  return (
    <div ref={caixa} data-slot={slot} data-variante={variante}
      className={cn(
        "editor-rico relative flex min-w-0 flex-col",
        pagina ? "h-full min-h-0" : "rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 hover:border-ring/40 focus-within:hover:border-ring dark:bg-input/20",
        desabilitado && "pointer-events-none opacity-60",
        className,
      )}>
      <div data-slot="editor-barra" role="toolbar" aria-label="Formatação"
        className={cn("flex shrink-0 flex-wrap items-center gap-0.5 border-b px-1.5 py-1 sem-selecao", pagina && "px-4")}>
        <BotaoBarra dica="Título 1" ativo={estado?.h1} aoClicar={() => c().toggleHeading({ level: 1 }).run()}><Heading1 /></BotaoBarra>
        <BotaoBarra dica="Título 2" ativo={estado?.h2} aoClicar={() => c().toggleHeading({ level: 2 }).run()}><Heading2 /></BotaoBarra>
        <BotaoBarra dica="Título 3" ativo={estado?.h3} aoClicar={() => c().toggleHeading({ level: 3 }).run()}><Heading3 /></BotaoBarra>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <BotaoBarra dica="Negrito" atalho="Ctrl B" ativo={estado?.negrito} aoClicar={() => c().toggleBold().run()}><Bold /></BotaoBarra>
        <BotaoBarra dica="Itálico" atalho="Ctrl I" ativo={estado?.italico} aoClicar={() => c().toggleItalic().run()}><Italic /></BotaoBarra>
        <BotaoBarra dica="Riscado" ativo={estado?.riscado} aoClicar={() => c().toggleStrike().run()}><Strikethrough /></BotaoBarra>
        <BotaoBarra dica="Código no meio do texto" ativo={estado?.codigo} aoClicar={() => c().toggleCode().run()}><Code /></BotaoBarra>
        <Popover open={linkAberto} onOpenChange={(a) => { setLinkAberto(a); if (a) setUrl(estado?.href ?? ""); }}>
          <Dica texto="Link">
            <PopoverTrigger asChild>
              <button type="button" aria-label="Link" aria-pressed={estado?.link} onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_svg]:size-3.5",
                  estado?.link && "bg-accent text-primary",
                )}>
                <Link2 />
              </button>
            </PopoverTrigger>
          </Dica>
          <PopoverContent className="w-80 p-2.5" onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector("input")?.focus(); }}>
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); aplicarLink(); }}>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." aria-label="Endereço do link" className="h-7 text-xs" />
              <Button type="submit" size="sm">Aplicar</Button>
              {estado?.link && (
                <Dica texto="Tirar o link">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Tirar o link"
                    onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkAberto(false); }}>
                    <Link2Off />
                  </Button>
                </Dica>
              )}
            </form>
          </PopoverContent>
        </Popover>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <BotaoBarra dica="Lista" ativo={estado?.lista} aoClicar={() => c().toggleBulletList().run()}><List /></BotaoBarra>
        <BotaoBarra dica="Lista numerada" ativo={estado?.numerada} aoClicar={() => c().toggleOrderedList().run()}><ListOrdered /></BotaoBarra>
        <BotaoBarra dica="Lista de tarefas" ativo={estado?.tarefas} aoClicar={() => c().toggleTaskList().run()}><ListChecks /></BotaoBarra>
        <BotaoBarra dica="Citação" ativo={estado?.citacao} aoClicar={() => c().toggleBlockquote().run()}><Quote /></BotaoBarra>
        <BotaoBarra dica="Bloco de código" ativo={estado?.bloco} aoClicar={() => c().toggleCodeBlock().run()}><SquareCode /></BotaoBarra>
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <BotaoBarra dica="Imagem (ou cole com Ctrl V)" aoClicar={() => arquivo.current?.click()}><ImagePlus /></BotaoBarra>
        {estado?.tabela ? (
          <DropdownMenu>
            <Dica texto="Mexer na tabela">
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Mexer na tabela" onMouseDown={(e) => e.preventDefault()}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_svg]:size-3.5">
                  <Table2 />
                </button>
              </DropdownMenuTrigger>
            </Dica>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => c().addRowAfter().run()}>Nova linha abaixo</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => c().addRowBefore().run()}>Nova linha acima</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => c().addColumnAfter().run()}>Nova coluna à direita</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => c().addColumnBefore().run()}>Nova coluna à esquerda</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => c().deleteRow().run()}>Apagar esta linha</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => c().deleteColumn().run()}>Apagar esta coluna</DropdownMenuItem>
              <DropdownMenuItem perigo onSelect={() => c().deleteTable().run()}><Trash2 /> Apagar a tabela</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <BotaoBarra dica="Tabela" aoClicar={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></BotaoBarra>
        )}
        {pagina && (
          <span className="ml-auto hidden pr-1.5 text-[11px] text-muted-foreground/80 lg:inline">
            digite <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">/</kbd> para blocos
          </span>
        )}
      </div>

      <div className={cn("min-h-0", pagina ? "flex-1 overflow-y-auto" : "max-h-[55vh] overflow-y-auto")}
        // clicar no espaço vazio abaixo do texto põe o cursor no fim
        onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); editor?.chain().focus("end").run(); } }}>
        {editor ? <EditorContent editor={editor} /> : <div className={cn("min-h-24 px-3 py-2.5", classeConteudo)} />}
      </div>

      {/* escolha de arquivo de imagem: o seletor do sistema abre pelo botão da barra ou pelo bloco "Imagem" */}
      <input ref={arquivo} type="file" accept={TIPOS_DE_IMAGEM.join(",")} multiple hidden tabIndex={-1} aria-hidden
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (lista.length) anexar(lista);
        }} />

      <AnimatePresence>
        {menu && (
          <motion.div key="menu" data-slot="menu-editor" role="listbox" aria-label="Blocos"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.12 }}
            style={{ left: menu.esquerda, ...(menu.paraCima ? { bottom: `calc(100% - ${menu.topo - 6}px)` } : { top: menu.topo + 6 }) }}
            className="absolute z-30 max-h-80 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            {menu.itens.map((i, k) => {
              const Icone = ICONE[i.id] ?? Pilcrow;
              return (
                <button key={i.id} type="button" role="option" aria-selected={k === menu.indice} data-item={i.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setMenu((m) => (m ? { ...m, indice: k } : m))}
                  onClick={() => menu.escolher(i)}
                  ref={(el) => { if (el && k === menu.indice) el.scrollIntoView({ block: "nearest" }); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none", k === menu.indice && "bg-accent")}>
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground"><Icone className="size-3.5" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{i.nome}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{i.dica}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
