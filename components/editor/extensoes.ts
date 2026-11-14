// Extensões do editor de texto rico (Tiptap). O que o editor grava é Markdown (lib/texto-rico.ts explica por quê).
//
// Regras de segurança que moram aqui, porque texto colado pode vir de qualquer lugar:
//   - imagem só existe no documento se for um anexo da pasta de dados ("arquivos/AAAA/nome"). <img> de página
//     colada e ![](http...) de Markdown não viram imagem (não há chamada externa nem pixel de rastreio);
//   - link só com http, https ou mailto;
//   - sublinhado fica desligado: não existe em Markdown e voltaria como HTML solto.

import { Extension, type Editor, type MarkdownParseHelpers, type MarkdownParseResult, type MarkdownToken, type Range } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { anexoDoSrc, linkInterno, linkPermitido, srcDoAnexo, urlDaImagem } from "@/lib/texto-rico";

/** Imagem anexada: no documento o endereço é "arquivos/AAAA/nome"; na tela, o <img> aponta para a API local. */
export const ImagemAnexada = Image.extend({
  parseHTML() {
    return [
      {
        tag: "img[data-anexo]",
        getAttrs: (el) => {
          const anexo = (el as HTMLElement).getAttribute("data-anexo") || "";
          const rel = anexoDoSrc(anexo);
          return rel ? { src: srcDoAnexo(rel), alt: (el as HTMLElement).getAttribute("alt") } : false;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src ?? "");
    return ["img", { src: urlDaImagem(src) ?? "", "data-anexo": src, alt: HTMLAttributes.alt ?? "", loading: "lazy", draggable: "false" }];
  },
  parseMarkdown: (token, helpers) => {
    const rel = anexoDoSrc(String(token.href ?? ""));
    // imagem de fora: fica o que foi escrito, como texto, e nada é carregado
    if (!rel) return helpers.createTextNode(String(token.raw ?? ""));
    return helpers.createNode("image", { src: srcDoAnexo(rel), alt: token.text || null, title: null });
  },
});

/**
 * O parágrafo padrão, ao ler Markdown, tira de dentro dele uma imagem que esteja sozinha (ele supõe imagem em
 * bloco). Aqui a imagem é "inline", então ela continua dentro do parágrafo. O resto fica com o comportamento original.
 */
const lerParagrafoOriginal = Paragraph.config.parseMarkdown as unknown as
  | ((token: MarkdownToken, helpers: MarkdownParseHelpers) => MarkdownParseResult)
  | undefined;
export const Paragrafo = Paragraph.extend({
  parseMarkdown: (token, helpers) => {
    const tokens = token.tokens || [];
    if (tokens.length === 1 && tokens[0].type === "image") return helpers.createNode("paragraph", undefined, helpers.parseInline(tokens));
    return lerParagrafoOriginal ? lerParagrafoOriginal(token, helpers) : helpers.createNode("paragraph", undefined, helpers.parseInline(tokens));
  },
});

/** Link que, ao ler Markdown, já descarta endereço proibido (javascript:, arquivo local...): fica só o texto. */
export const LinkSeguro = Link.extend({
  parseMarkdown: (token, helpers) => {
    const filhos = helpers.parseInline(token.tokens || []);
    const bruto = String(token.href ?? "");
    const href = linkInterno(bruto) ? bruto.trim() : linkPermitido(bruto);
    return href ? helpers.applyMark("link", filhos, { href, title: null }) : filhos;
  },
});

// ---------- menu "/" ----------

export interface ItemDoMenu {
  id: string;
  nome: string;
  dica: string;
  /** Palavras extras para a busca (sem acento). */
  palavras: string;
  /** Ícone a mostrar (chave do mapa do EditorRico). Sem isso, usa o id. */
  icone?: string;
  fazer: (editor: Editor, range: Range) => void;
}

export interface PonteDoMenu {
  abrir: (p: SuggestionProps<ItemDoMenu, ItemDoMenu>) => void;
  atualizar: (p: SuggestionProps<ItemDoMenu, ItemDoMenu>) => void;
  tecla: (p: SuggestionKeyDownProps) => boolean;
  fechar: () => void;
}

const limpar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Menu que abre ao digitar um caractere: "/" lista os blocos, "@" lista o que dá para citar (pessoas, tarefas,
 * páginas). A tela é desenhada pelo EditorRico, que entrega a "ponte". `itens` é uma função para a lista de
 * citações acompanhar os dados sem recriar o editor.
 */
interface OpcoesDoMenu {
  char: string; chave: string; itens: () => ItemDoMenu[]; ponte: () => PonteDoMenu | null; limite: number;
  /** Itens que dependem do que foi digitado ("Criar página «texto»"), postos no fim da lista. */
  extra?: (digitado: string) => ItemDoMenu[];
}
export const MenuBarra = Extension.create<OpcoesDoMenu>({
  name: "menuBarra",
  addOptions() {
    return { char: "/", chave: "menuBarra", itens: () => [], ponte: () => null, limite: 50 };
  },
  addProseMirrorPlugins() {
    const { char, chave, itens, ponte, limite, extra } = this.options;
    return [
      Suggestion<ItemDoMenu, ItemDoMenu>({
        editor: this.editor,
        pluginKey: new PluginKey(chave),
        char,
        // nome de pessoa e título de página têm espaço
        allowSpaces: char !== "/",
        items: ({ query }) => {
          const q = limpar(query);
          return [...itens().filter((i) => !q || limpar(`${i.nome} ${i.palavras}`).includes(q)).slice(0, limite), ...(extra?.(query.trim()) ?? [])];
        },
        command: ({ editor, range, props }) => props.fazer(editor, range),
        // dentro de bloco de código, "/" é só uma barra
        allow: ({ editor }) => !editor.isActive("codeBlock"),
        render: () => ({
          onStart: (p) => ponte()?.abrir(p),
          onUpdate: (p) => ponte()?.atualizar(p),
          onKeyDown: (p) => ponte()?.tecla(p) ?? false,
          onExit: () => ponte()?.fechar(),
        }),
      }),
    ];
  },
});

/** Ctrl Enter salva o formulário em volta (regra do app). Aqui só impedimos o editor de inserir uma quebra antes. */
const SemQuebraNoCtrlEnter = Extension.create({
  name: "semQuebraNoCtrlEnter",
  priority: 1000,
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => true };
  },
});

export function extensoesDoEditor(opcoes: {
  placeholder: string; itens: ItemDoMenu[]; ponte: () => PonteDoMenu | null;
  /** O que dá para citar com "@" (pessoas, tarefas, páginas). */
  citaveis: () => ItemDoMenu[];
  /** As páginas que "[[" lista, e o item "criar página" para o que foi digitado. */
  paginas: () => ItemDoMenu[];
  criarPagina: (digitado: string) => ItemDoMenu[];
}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      underline: false,
      paragraph: false, // entra o Paragrafo daqui, logo abaixo
      link: false, // entra o LinkSeguro daqui, logo abaixo
    }),
    LinkSeguro.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      isAllowedUri: (url) => !!linkPermitido(url) || !!linkInterno(url),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    Paragrafo,
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: { checkboxLabel: (no, feito) => `${feito ? "Feito" : "A fazer"}: ${no.textContent || "item vazio"}` },
    }),
    TableKit.configure({ table: { resizable: false } }),
    // "inline": a imagem mora dentro do parágrafo, como no Markdown. Assim "texto ![x](...) texto" é um documento
    // válido, e a imagem de fora que vira texto (ver parseMarkdown acima) cabe no mesmo lugar.
    ImagemAnexada.configure({ inline: true, allowBase64: false }),
    Placeholder.configure({ placeholder: opcoes.placeholder }),
    // uma quebra de linha simples conta como quebra: o texto antigo do app era texto puro
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    MenuBarra.configure({ itens: () => opcoes.itens, ponte: opcoes.ponte }),
    MenuBarra.extend({ name: "menuCitar" }).configure({ char: "@", chave: "menuCitar", itens: opcoes.citaveis, ponte: opcoes.ponte, limite: 8 }),
    // "[[" liga a outra página (e cria a página se ela ainda não existe), como numa wiki
    MenuBarra.extend({ name: "menuLigar" }).configure({ char: "[[", chave: "menuLigar", itens: opcoes.paginas, ponte: opcoes.ponte, limite: 8, extra: opcoes.criarPagina }),
    SemQuebraNoCtrlEnter,
  ];
}

/** Texto colado que tem cara de Markdown (vindo do Copilot em texto puro, por exemplo) entra já formatado. */
export function pareceMarkdown(texto: string): boolean {
  return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s+\S|\d+[.)]\s+\S|>\s|```|- \[[ xX]\]\s|\|.+\|\s*\n\s*\|[\s:|-]+\|)/.test(texto) || /\*\*[^*\n]+\*\*/.test(texto);
}
