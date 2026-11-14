"use client";

// Mostra texto longo (anotações, resumo do Copilot, folha do bloco de notas) com a forma do Markdown:
// títulos, listas, tarefas, citação, código, tabela, links e imagens anexadas.
// Quem interpreta e saneia é lib/texto-rico.ts: aqui só se desenha a árvore pronta. Nada de innerHTML.
// A aparência vem da classe "prosa" (app/globals.css), a mesma do editor, para ler e editar terem a mesma cara.

import Link from "next/link";
import { Fragment, ReactNode, useMemo, useState } from "react";
import {
  Check, ChevronRight, CircleAlert, CircleCheckBig, CircleHelp, Clock, Copy, FlaskConical, Info, Lightbulb, ListTree, type LucideIcon, OctagonAlert, Paperclip, TriangleAlert,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { type ItemDoSumario, nomeDaPagina, sumarioDosBlocos } from "@/lib/paginas";
import { NOMES_DE_LINGUAGEM, realcar } from "@/lib/realce";
import { Bloco, Inline, NOME_DO_DESTAQUE, type TipoDeDestaque, analisarMarkdown, paraTextoPlano } from "@/lib/texto-rico";
import { formatarData, nomeStatus } from "@/lib/tipos";
import { lerTempo } from "@/lib/transcricao";
import { cn } from "@/lib/utils";

/** O que muda no desenho conforme o lugar: documento com sumário, cartões vivos, player de vídeo por perto. */
interface Opcoes {
  ancoras?: ItemDoSumario[];
  cartoes?: boolean;
  aoIrParaTempo?: (segundos: number) => void;
}

const ICONE_DO_DESTAQUE: Record<TipoDeDestaque, LucideIcon> = {
  nota: Info, dica: Lightbulb, importante: CircleAlert, atencao: TriangleAlert, perigo: OctagonAlert, sucesso: CircleCheckBig, pergunta: CircleHelp, exemplo: FlaskConical, detalhes: ChevronRight,
};

const TEMPO_ENTRE_COLCHETES = /\[((?:\d{1,2}:)?\d{1,2}:\d{2})\]/g;
/** Troca cada "[12:34]" de um texto por um botão que leva o vídeo até aquele instante. */
function comTempos(texto: string, aoIrParaTempo: (segundos: number) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let fim = 0;
  for (const m of texto.matchAll(TEMPO_ENTRE_COLCHETES)) {
    const segundos = lerTempo(m[1]);
    if (segundos === null) continue;
    if (m.index > fim) out.push(texto.slice(fim, m.index));
    out.push(
      <button key={m.index} type="button" data-slot="tempo" data-segundos={Math.round(segundos)} onClick={() => aoIrParaTempo(segundos)}>
        <Clock aria-hidden />{m[1]}
      </button>,
    );
    fim = m.index + m[0].length;
  }
  if (fim < texto.length) out.push(texto.slice(fim));
  return out;
}

function desenharInlines(f: Inline[], o: Opcoes = {}): ReactNode {
  return f.map((i, k) => {
    switch (i.t) {
      case "texto":
        // onde há um player, "[12:34]" escrito à mão (ou vindo do resumo do Copilot) já leva o vídeo até lá
        if (o.aoIrParaTempo && i.v.includes("[")) return <Fragment key={k}>{comTempos(i.v, o.aoIrParaTempo)}</Fragment>;
        return <Fragment key={k}>{i.v}</Fragment>;
      case "negrito":
        return <strong key={k}>{desenharInlines(i.f, o)}</strong>;
      case "italico":
        return <em key={k}>{desenharInlines(i.f, o)}</em>;
      case "riscado":
        return <s key={k}>{desenharInlines(i.f, o)}</s>;
      case "codigo":
        return <code key={k}>{i.v}</code>;
      case "quebra":
        return <br key={k} />;
      case "link":
        return <a key={k} href={i.href} target="_blank" rel="noopener noreferrer nofollow">{desenharInlines(i.f, o)}</a>;
      case "interno":
        // citação de tarefa, página, pessoa ou categoria: navega dentro do app
        return <Link key={k} href={i.rota} data-slot="link-interno" data-tipo={i.tipo}>{desenharInlines(i.f, o)}</Link>;
      case "anexo":
        // arquivo da pasta de dados: abre pela API local, em outra aba
        return (
          <a key={k} href={i.url} target="_blank" rel="noopener noreferrer" data-slot="anexo" className="!no-underline">
            <Paperclip aria-hidden />{desenharInlines(i.f, o)}
          </a>
        );
      case "tempo":
        // instante de um vídeo: onde há player, leva até lá; fora dele é só o texto
        return o.aoIrParaTempo ? (
          <button key={k} type="button" data-slot="tempo" data-segundos={i.segundos} onClick={() => o.aoIrParaTempo?.(i.segundos)}>
            <Clock aria-hidden />{desenharInlines(i.f, o)}
          </button>
        ) : (
          <span key={k} data-slot="tempo" data-segundos={i.segundos}><Clock aria-hidden />{desenharInlines(i.f, o)}</span>
        );
      case "imagem":
        // só chega aqui imagem que é anexo da pasta de dados (lib/texto-rico.ts barra as de fora)
        return (
          <a key={k} href={i.url} target="_blank" rel="noopener noreferrer" data-slot="imagem-anexada" className="!no-underline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt={i.alt} loading="lazy" decoding="async" />
          </a>
        );
    }
  });
}

/** Destaque (callout). Com "-" ou "+" na marca, abre e fecha. */
function Destaque({ b, o }: { b: Extract<Bloco, { t: "destaque" }>; o: Opcoes }) {
  const [aberto, setAberto] = useState(b.aberto);
  const Icone = ICONE_DO_DESTAQUE[b.tipo];
  const titulo = b.titulo.length ? desenharInlines(b.titulo, o) : NOME_DO_DESTAQUE[b.tipo];
  const temCorpo = b.f.length > 0;
  return (
    <aside data-slot="destaque" data-tipo={b.tipo} data-aberto={!b.recolhivel || aberto || undefined}>
      {b.recolhivel ? (
        <button type="button" data-slot="destaque-titulo" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <Icone aria-hidden className={cn(b.tipo === "detalhes" && "transition-transform", b.tipo === "detalhes" && aberto && "rotate-90")} />
          <span>{titulo}</span>
          {b.tipo !== "detalhes" && <ChevronRight aria-hidden className={cn("ml-auto transition-transform", aberto && "rotate-90")} />}
        </button>
      ) : (
        <div data-slot="destaque-titulo"><Icone aria-hidden /><span>{titulo}</span></div>
      )}
      {temCorpo && (!b.recolhivel || aberto) && <div data-slot="destaque-corpo">{desenharBlocos(b.f, o)}</div>}
    </aside>
  );
}

/** Bloco de código: linguagem no canto, botão de copiar e cores simples (lib/realce.ts). */
function BlocoDeCodigo({ codigo, lang }: { codigo: string; lang: string }) {
  const [copiado, setCopiado] = useState(false);
  const linhas = useMemo(() => realcar(codigo, lang), [codigo, lang]);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {}
  };
  return (
    <div data-slot="bloco-de-codigo" data-linguagem={lang || undefined}>
      <div data-slot="codigo-barra">
        <span>{lang ? NOMES_DE_LINGUAGEM[lang.toLowerCase()] ?? lang : "código"}</span>
        <button type="button" data-slot="copiar-codigo" aria-label="Copiar o código" onClick={copiar}>
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />} {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre><code>
        {linhas.map((l, i) => (
          <Fragment key={i}>
            {l.map((p, j) => (p.t ? <span key={j} data-rc={p.t}>{p.v}</span> : <Fragment key={j}>{p.v}</Fragment>))}
            {i < linhas.length - 1 ? "\n" : null}
          </Fragment>
        ))}
      </code></pre>
    </div>
  );
}

/** Índice da página no lugar de "[TOC]". */
function Indice({ itens }: { itens: ItemDoSumario[] }) {
  if (!itens.length) return null;
  return (
    <nav data-slot="indice" aria-label="Índice da página">
      <div data-slot="indice-titulo"><ListTree aria-hidden /> Nesta página</div>
      <ul>
        {itens.map((s) => (
          <li key={s.id} style={{ paddingLeft: (s.nivel - 1) * 14 }}>
            <button type="button" onClick={(e) => (e.currentTarget.closest("[data-slot=texto]")?.querySelector(`[data-titulo="${s.indice}"]`) as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {s.texto}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Link interno sozinho numa linha, num documento: vira um cartão com o estado de agora do que foi citado. */
function CartaoInterno({ i }: { i: Extract<Inline, { t: "interno" }> }) {
  const { dados } = useNexo();
  const rotulo = desenharInlines(i.f);
  let titulo: ReactNode = rotulo;
  let linha = "";
  let existe = true;
  if (i.tipo === "tarefa") {
    const t = dados?.tarefas.find((x) => x.id === i.alvo);
    existe = !!t;
    if (t) {
      titulo = t.titulo;
      const abertos = t.registros.reduce((n, r) => n + r.proximosPassos.filter((p) => !p.feito).length, 0);
      linha = [nomeStatus(t.status), t.prazo ? `prazo ${formatarData(t.prazo)}` : "", abertos ? `${abertos} ${abertos === 1 ? "passo em aberto" : "passos em aberto"}` : ""].filter(Boolean).join(" · ");
    }
  } else if (i.tipo === "pagina") {
    const p = dados?.paginas?.items.find((x) => x.id === i.alvo);
    existe = !!p;
    if (p) {
      titulo = nomeDaPagina(p);
      linha = paraTextoPlano(p.texto).replace(/\n+/g, " ").slice(0, 140) || (p.arquivadaEm ? "Página arquivada" : "Página em branco");
    }
  } else if (i.tipo === "pessoa") {
    const p = dados?.pessoas?.items.find((x) => x.nome.toLowerCase() === i.alvo.toLowerCase() || x.apelidos.some((a) => a.toLowerCase() === i.alvo.toLowerCase()));
    if (p) {
      titulo = p.nome;
      linha = [p.cargo, p.area].filter(Boolean).join(", ") || (p.ajudaCom ? `Pode ajudar com: ${p.ajudaCom}` : "");
    }
  } else {
    const c = dados?.categorias.items.find((x) => x.id === i.alvo);
    existe = !!c;
    if (c) {
      titulo = c.nome;
      const n = dados?.tarefas.filter((t) => t.categoriaId === c.id && !["concluida", "cancelada"].includes(t.status)).length ?? 0;
      linha = `${n} ${n === 1 ? "tarefa aberta" : "tarefas abertas"}`;
    }
  }
  return (
    <Link href={i.rota} data-slot="cartao-interno" data-tipo={i.tipo} data-existe={existe || undefined}>
      <span data-slot="cartao-tipo">{i.tipo === "tarefa" ? "Tarefa" : i.tipo === "pagina" ? "Página" : i.tipo === "pessoa" ? "Pessoa" : "Categoria"}</span>
      <span data-slot="cartao-titulo">{titulo}</span>
      <span data-slot="cartao-linha">{existe ? linha : "Não existe mais (pode estar na lixeira)"}</span>
    </Link>
  );
}

/** O parágrafo é só um link interno (e espaços em volta)? */
function linkSozinho(f: Inline[]): Extract<Inline, { t: "interno" }> | null {
  const uteis = f.filter((i) => !(i.t === "texto" && !i.v.trim()) && i.t !== "quebra");
  return uteis.length === 1 && uteis[0].t === "interno" ? uteis[0] : null;
}

/**
 * `o.ancoras`: o sumário do documento. Com ele, cada título de primeiro nível ganha a âncora e a posição.
 * `raiz`: só o primeiro nível do documento numera títulos e vira cartão.
 */
function desenharBlocos(bs: Bloco[], o: Opcoes = {}, raiz = false): ReactNode {
  let titulo = 0;
  return bs.map((b, k) => {
    switch (b.t) {
      case "paragrafo": {
        const sozinho = raiz && o.cartoes ? linkSozinho(b.f) : null;
        return sozinho ? <CartaoInterno key={k} i={sozinho} /> : <p key={k}>{desenharInlines(b.f, o)}</p>;
      }
      case "titulo": {
        const T = (["h1", "h2", "h3"] as const)[b.nivel - 1];
        const a = raiz ? o.ancoras?.[titulo++] : undefined;
        return a ? <T key={k} id={a.id} data-titulo={a.indice}>{desenharInlines(b.f, o)}</T> : <T key={k}>{desenharInlines(b.f, o)}</T>;
      }
      case "destaque":
        return <Destaque key={k} b={b} o={o} />;
      case "indice":
        return <Indice key={k} itens={o.ancoras ?? []} />;
      case "lista": {
        const tarefas = b.itens.length > 0 && b.itens.every((i) => i.tarefa);
        const itens = b.itens.map((it, j) =>
          it.tarefa ? (
            <li key={j} data-type="taskItem" data-checked={it.feito}>
              <label><span role="img" aria-label={it.feito ? "Feito" : "A fazer"} data-caixa data-marcada={it.feito || undefined} /></label>
              <div>{desenharBlocos(it.f, o)}</div>
            </li>
          ) : (
            <li key={j}>{desenharBlocos(it.f, o)}</li>
          ),
        );
        if (tarefas) return <ul key={k} data-type="taskList">{itens}</ul>;
        return b.ordenada ? <ol key={k} start={b.inicio}>{itens}</ol> : <ul key={k}>{itens}</ul>;
      }
      case "citacao":
        return <blockquote key={k}>{desenharBlocos(b.f, o)}</blockquote>;
      case "codigo":
        return <BlocoDeCodigo key={k} codigo={b.v} lang={b.lang} />;
      case "divisor":
        return <hr key={k} />;
      case "tabela":
        return (
          <div key={k} className="overflow-x-auto">
            <table>
              <thead>
                <tr>{b.cabecalho.map((c, j) => <th key={j} style={c.alinhar ? { textAlign: c.alinhar } : undefined}>{desenharInlines(c.f, o)}</th>)}</tr>
              </thead>
              <tbody>
                {b.linhas.map((l, j) => (
                  <tr key={j}>{l.map((c, m) => <td key={m} style={b.cabecalho[m]?.alinhar ? { textAlign: b.cabecalho[m].alinhar! } : undefined}>{desenharInlines(c, o)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

export function TextoRico({ texto, className, ancoras, cartoes, aoIrParaTempo }: {
  texto: string; className?: string;
  /** Documento com sumário: os títulos ganham âncora (`id`) e `data-titulo` com a posição, e "[TOC]" vira o índice. */
  ancoras?: boolean;
  /** Um link interno sozinho numa linha vira um cartão com o estado de agora da tarefa, página ou pessoa. */
  cartoes?: boolean;
  /** Há um player de vídeo por perto: os instantes citados ("[12:34]") levam até lá. */
  aoIrParaTempo?: (segundos: number) => void;
}) {
  const blocos = useMemo(() => analisarMarkdown(texto), [texto]);
  const sumario = useMemo(() => (ancoras ? sumarioDosBlocos(blocos) : undefined), [ancoras, blocos]);
  return (
    <div data-slot="texto" className={cn("prosa", className)}>
      {desenharBlocos(blocos, { ancoras: sumario, cartoes, aoIrParaTempo }, true)}
    </div>
  );
}
