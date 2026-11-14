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
  AtSign, Bold, ChevronsUpDown, CircleAlert, CircleCheckBig, CircleHelp, Code, FilePlus2, FileText, Heading1, Heading2, Heading3, ImagePlus, Info, Italic, Lightbulb, Link2, Link2Off, List,
  ListChecks, ListOrdered, ListTodo, ListTree, Minus, OctagonAlert, Paperclip, Pilcrow, Quote, SquareCode, Strikethrough, Table2, Trash2, TriangleAlert, UserRound, type LucideIcon,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aberta } from "@/lib/lembretes";
import { nomesConhecidos } from "@/lib/pessoas";
import { paginaNova } from "@/lib/paginas";
import { LINGUAGENS, NOMES_DE_LINGUAGEM } from "@/lib/realce";
import { hrefInterno, linkPermitido, srcDoAnexo } from "@/lib/texto-rico";
import { cn } from "@/lib/utils";
import { type ItemDoMenu, type PonteDoMenu, extensoesDoEditor, pareceMarkdown } from "./extensoes";

const MAX_IMAGEM = 15 * 1024 * 1024;
const TIPOS_DE_IMAGEM = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const EXTENSAO: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

const ICONE: Record<string, LucideIcon> = {
  texto: Pilcrow, h1: Heading1, h2: Heading2, h3: Heading3, lista: List, numerada: ListOrdered, tarefas: ListChecks, citacao: Quote,
  codigo: SquareCode, divisor: Minus, tabela: Table2, imagem: ImagePlus, pessoa: UserRound, tarefa: ListTodo, pagina: FileText, nova: FilePlus2, subpagina: FilePlus2,
  nota: Info, dica: Lightbulb, importante: CircleAlert, atencao: TriangleAlert, perigo: OctagonAlert, sucesso: CircleCheckBig, pergunta: CircleHelp, detalhes: ChevronsUpDown,
  indice: ListTree, arquivo: Paperclip,
};
const MAX_ANEXO = 200 * 1024 * 1024;

const p2 = (n: number) => String(n).padStart(2, "0");
/** Print colado chega como "image.png": ganha um nome que dá para reconhecer na pasta de anexos. */
function nomeDoPrint(tipo: string) {
  const d = new Date();
  return `print-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.${EXTENSAO[tipo] ?? "png"}`;
}

/** O Markdown do editor como vai para o campo: sem os parágrafos vazios do fim (que ele grava como "&nbsp;"). */
const paraGuardar = (ed: Editor) => (ed.isEmpty ? "" : ed.getMarkdown().replace(/(?:\s|&nbsp;)+$/, ""));

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
  valor, aoMudar, placeholder = "Escreva, ou digite / para escolher um bloco", className, classeConteudo, variante = "campo", focoInicial, desabilitado, paginaAtualId,
  "aria-label": rotulo, "data-slot": slot = "editor-rico",
}: {
  /** Markdown. */
  valor: string;
  aoMudar: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** Classes da área de escrita (altura mínima e máxima, tamanho da letra). */
  classeConteudo?: string;
  /**
   * "campo": caixa com borda, para formulários. "pagina": sem moldura, ocupa o espaço que tiver e rola por dentro.
   * "documento": sem moldura e sem rolagem própria (cresce com o texto); a barra gruda no topo de quem rola em volta.
   */
  variante?: "campo" | "pagina" | "documento";
  /** Página em que o editor está: página criada por "[[" ou pelo bloco "Subpágina" nasce dentro dela. */
  paginaAtualId?: string;
  focoInicial?: boolean;
  desabilitado?: boolean;
  "aria-label"?: string;
  "data-slot"?: string;
}) {
  const { enviarArquivo, toast, dados, salvarPaginas } = useNexo();
  // O que dá para citar com "@": pessoas, tarefas (as abertas primeiro) e páginas. Lido na hora em que o menu abre.
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const citaveis = useRef((): ItemDoMenu[] => {
    const d = dadosRef.current;
    if (!d) return [];
    const citar = (tipo: "pessoa" | "tarefa" | "pagina", alvo: string, rotulo: string) => (ed: Editor, r: Range) =>
      ed.chain().focus().deleteRange(r)
        .insertContent([{ type: "text", text: rotulo, marks: [{ type: "link", attrs: { href: hrefInterno(tipo, alvo) } }] }, { type: "text", text: " " }])
        .run();
    const pessoas = nomesConhecidos(d).map((n): ItemDoMenu => ({ id: `pessoa:${n}`, nome: n, dica: "Pessoa", palavras: "pessoa", icone: "pessoa", fazer: citar("pessoa", n, `@${n}`) }));
    const tarefas = [...d.tarefas]
      .sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.atualizadaEm.localeCompare(a.atualizadaEm))
      .map((t): ItemDoMenu => ({ id: `tarefa:${t.id}`, nome: t.titulo, dica: aberta(t) ? "Tarefa" : "Tarefa fechada", palavras: `tarefa ${t.tags.join(" ")}`, icone: "tarefa", fazer: citar("tarefa", t.id, t.titulo) }));
    const paginas = (d.paginas?.items ?? [])
      .filter((p) => !p.arquivadaEm)
      .map((p): ItemDoMenu => ({ id: `pagina:${p.id}`, nome: p.titulo || "Página sem título", dica: "Página", palavras: "pagina", icone: "pagina", fazer: citar("pagina", p.id, p.titulo || "Página sem título") }));
    // intercala para os três tipos aparecerem mesmo com a lista curta
    const out: ItemDoMenu[] = [];
    for (let i = 0; i < Math.max(pessoas.length, tarefas.length, paginas.length); i++) {
      if (paginas[i]) out.push(paginas[i]);
      if (tarefas[i]) out.push(tarefas[i]);
      if (pessoas[i]) out.push(pessoas[i]);
    }
    return out;
  });
  // "[[" liga a uma página; se o que foi digitado não existe, oferece criar (nasce dentro da página atual).
  const paginaAtual = useRef(paginaAtualId);
  paginaAtual.current = paginaAtualId;
  const criarPaginaRef = useRef((titulo: string): string => {
    const mae = dadosRef.current?.paginas?.items.find((p) => p.id === paginaAtual.current);
    const nova = paginaNova({ titulo, paiId: mae?.id ?? null, categoriaId: mae?.categoriaId ?? null, ordem: Date.now() / 1e9 });
    void salvarPaginas((items) => [...items, nova]);
    return nova.id;
  });
  const ligar = (alvo: string, rotulo: string) => (ed: Editor, r: Range) =>
    ed.chain().focus().deleteRange(r)
      .insertContent([{ type: "text", text: rotulo, marks: [{ type: "link", attrs: { href: hrefInterno("pagina", alvo) } }] }, { type: "text", text: " " }])
      .run();
  const paginasParaLigar = useRef((): ItemDoMenu[] =>
    (dadosRef.current?.paginas?.items ?? [])
      .filter((p) => !p.arquivadaEm && p.id !== paginaAtual.current)
      .sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))
      .map((p): ItemDoMenu => ({ id: `pagina:${p.id}`, nome: p.titulo || "Página sem título", dica: "Página", palavras: "pagina", icone: "pagina", fazer: ligar(p.id, p.titulo || "Página sem título") })));
  const criarAoLigar = useRef((digitado: string): ItemDoMenu[] => {
    const titulo = digitado.replace(/\]+$/, "").trim().slice(0, 200);
    const existe = (dadosRef.current?.paginas?.items ?? []).some((p) => !p.arquivadaEm && p.titulo.trim().toLowerCase() === titulo.toLowerCase());
    if (!titulo || existe) return [];
    return [{ id: "nova", nome: `Criar página “${titulo}”`, dica: "Ainda não existe: cria e liga", palavras: "", icone: "nova", fazer: (ed, r) => ligar(criarPaginaRef.current(titulo), titulo)(ed, r) }];
  });
  const caixa = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const menuRef = useRef<EstadoMenu | null>(null);
  menuRef.current = menu;
  const emitido = useRef(valor);
  // O editor regrava o Markdown do jeito dele (escapa "[", alinha tabela). Só de abrir um texto isso já daria
  // uma "mudança". `base` guarda o texto como veio e como o editor o escreve: enquanto o conteúdo for esse,
  // o que vale é o texto original, e nada é avisado para fora.
  const base = useRef<{ original: string; doEditor: string | null }>({ original: valor, doEditor: null });
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

  /** Arquivo qualquer (PDF, planilha...): vai para a pasta de dados e entra no texto como um link para ele. */
  async function anexarArquivos(arquivos: File[]) {
    const ed = editorRef.current;
    if (!ed) return;
    for (const f of arquivos) {
      if (TIPOS_DE_IMAGEM.includes(f.type)) { await anexar([f]); continue; }
      if (f.size > MAX_ANEXO) { acoes.current.toast("Esse arquivo passa de 200 MB. Guarde numa pasta e ponha aqui o link para ele.", "erro"); continue; }
      const r = await acoes.current.enviarArquivo(f);
      if (!r) continue;
      ed.chain().focus().insertContent([{ type: "text", text: r.nomeArquivo, marks: [{ type: "link", attrs: { href: srcDoAnexo(r.arquivo) } }] }, { type: "text", text: " " }]).run();
    }
  }
  const qualquerArquivo = useRef<HTMLInputElement>(null);

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
      // destaques: uma citação que começa com a marca. A marca fica no texto (Markdown comum) e vira etiqueta na tela
      ...([
        ["nota", "Nota", "Informação que vale destacar", "info aviso callout destaque"],
        ["dica", "Dica", "Um jeito mais fácil ou um atalho", "tip sugestao callout destaque"],
        ["importante", "Importante", "O que não pode passar batido", "callout destaque"],
        ["atencao", "Atenção", "Cuidado com isto", "aviso warning cuidado callout destaque"],
        ["perigo", "Perigo", "Risco de perder algo ou de quebrar", "danger erro risco callout destaque"],
        ["sucesso", "Deu certo", "Como é o resultado esperado", "success ok resultado callout destaque"],
      ] as const).map(([id, nome, dica, palavras]): ItemDoMenu => ({
        id, nome: `Destaque: ${nome}`, dica, palavras,
        fazer: bloco((ed, r) => limpo(ed, r).insertContent(`[!${id.toUpperCase()}] `).setBlockquote().run()),
      })),
      { id: "detalhes", nome: "Bloco que abre e fecha", dica: "Um título que esconde o resto até clicar", palavras: "toggle recolher expandir detalhes sanfona", fazer: bloco((ed, r) => limpo(ed, r).insertContent("[!DETALHES]- ").setBlockquote().run()) },
      { id: "pergunta", nome: "Pergunta e resposta", dica: "A pergunta aparece; a resposta abre ao clicar", palavras: "faq duvida pergunta resposta", fazer: bloco((ed, r) => limpo(ed, r).insertContent("[!PERGUNTA]- ").setBlockquote().run()) },
      { id: "indice", nome: "Índice", dica: "Lista dos títulos da página, montada sozinha", palavras: "indice sumario toc titulos", fazer: bloco((ed, r) => limpo(ed, r).insertContent({ type: "paragraph", content: [{ type: "text", text: "[TOC]" }] }).run()) },
      { id: "arquivo", nome: "Arquivo", dica: "Anexa um PDF, planilha ou outro arquivo", palavras: "arquivo anexo pdf planilha documento upload", fazer: bloco((ed, r) => { limpo(ed, r).run(); qualquerArquivo.current?.click(); }) },
      // só dentro de uma página: cria uma página filha e já deixa o link para ela
      ...(paginaAtualId
        ? [{
            id: "subpagina", nome: "Subpágina", dica: "Cria uma página dentro desta e põe o link aqui", palavras: "pagina subpagina filha nova documento",
            fazer: bloco((ed, r) => ligar(criarPaginaRef.current("Nova página"), "Nova página")(ed, r)),
          }]
        : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!paginaAtualId]);

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
    extensions: extensoesDoEditor({
      placeholder, itens, ponte: () => ponte.current, citaveis: () => citaveis.current(),
      paginas: () => paginasParaLigar.current(), criarPagina: (q) => criarAoLigar.current(q),
    }),
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
    onCreate: ({ editor: ed }) => {
      if (!ed.isFocused || base.current.doEditor === null) base.current.doEditor = paraGuardar(ed);
    },
    onUpdate: ({ editor: ed }) => {
      let md = paraGuardar(ed);
      // Tabela e lista de tarefas "arrumam" o documento assim que ele é montado, antes do aviso de "criado":
      // essa primeira mexida, sem o cursor no texto, ainda é o documento como foi aberto.
      if (base.current.doEditor === null && !ed.isFocused) base.current.doEditor = md;
      // voltou a ser exatamente o que foi aberto: vale o texto original, sem a reescrita do editor
      if (md === base.current.doEditor) md = base.current.original;
      if (md === emitido.current) return;
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
    base.current = { original: valor, doEditor: paraGuardar(editor) };
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
            linguagem: (ed.getAttributes("codeBlock").language as string | undefined) ?? "",
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
  const documento = variante === "documento";
  const pagina = variante === "pagina" || documento;

  return (
    <div ref={caixa} data-slot={slot} data-variante={variante}
      className={cn(
        "editor-rico relative flex min-w-0 flex-col",
        documento ? "" : pagina ? "h-full min-h-0" : "rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 hover:border-ring/40 focus-within:hover:border-ring dark:bg-input/20",
        desabilitado && "pointer-events-none opacity-60",
        className,
      )}>
      <div data-slot="editor-barra" role="toolbar" aria-label="Formatação"
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-0.5 border-b px-1.5 py-1 sem-selecao", pagina && "px-4",
          documento && "sticky top-0 z-20 -mx-2 rounded-lg border bg-background/95 px-1.5 shadow-xs backdrop-blur-sm",
        )}>
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
        {estado?.bloco && (
          <DropdownMenu>
            <Dica texto="Linguagem do bloco de código (dá as cores na leitura)">
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Linguagem do bloco de código" data-slot="linguagem-do-codigo" onMouseDown={(e) => e.preventDefault()}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-accent px-2 text-[11px] font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35">
                  {estado.linguagem ? NOMES_DE_LINGUAGEM[estado.linguagem.toLowerCase()] ?? estado.linguagem : "sem linguagem"}
                </button>
              </DropdownMenuTrigger>
            </Dica>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              {LINGUAGENS.map((l) => (
                <DropdownMenuItem key={l} data-linguagem={l} onSelect={() => c().updateAttributes("codeBlock", { language: l }).run()}>{NOMES_DE_LINGUAGEM[l] ?? l}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => c().updateAttributes("codeBlock", { language: null }).run()}>Sem linguagem</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        <BotaoBarra dica="Imagem (ou cole com Ctrl V)" aoClicar={() => arquivo.current?.click()}><ImagePlus /></BotaoBarra>
        <BotaoBarra dica="Citar uma pessoa, tarefa ou página (ou digite @)" aoClicar={() => c().insertContent("@").run()}><AtSign /></BotaoBarra>
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

      <div className={cn("min-h-0", documento ? "" : pagina ? "flex-1 overflow-y-auto" : "max-h-[55vh] overflow-y-auto")}
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

      {/* arquivo qualquer (bloco "Arquivo"): vai para a pasta de dados e entra no texto como link */}
      <input ref={qualquerArquivo} type="file" multiple hidden tabIndex={-1} aria-hidden data-slot="anexar-arquivo"
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (lista.length) anexarArquivos(lista);
        }} />

      <AnimatePresence>
        {menu && (
          <motion.div key="menu" data-slot="menu-editor" role="listbox" aria-label="Blocos"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.12 }}
            style={{ left: menu.esquerda, ...(menu.paraCima ? { bottom: `calc(100% - ${menu.topo - 6}px)` } : { top: menu.topo + 6 }) }}
            className="absolute z-30 max-h-80 w-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            {menu.itens.map((i, k) => {
              const Icone = ICONE[i.icone ?? i.id] ?? Pilcrow;
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
