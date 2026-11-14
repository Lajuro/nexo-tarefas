"use client";

// Mostra texto longo (anotações, resumo do Copilot, folha do bloco de notas) com a forma do Markdown:
// títulos, listas, tarefas, citação, código, tabela, links e imagens anexadas.
// Quem interpreta e saneia é lib/texto-rico.ts: aqui só se desenha a árvore pronta. Nada de innerHTML.
// A aparência vem da classe "prosa" (app/globals.css), a mesma do editor, para ler e editar terem a mesma cara.

import Link from "next/link";
import { Fragment, ReactNode, useMemo } from "react";
import { type ItemDoSumario, sumarioDosBlocos } from "@/lib/paginas";
import { Bloco, Inline, analisarMarkdown } from "@/lib/texto-rico";
import { cn } from "@/lib/utils";

function desenharInlines(f: Inline[]): ReactNode {
  return f.map((i, k) => {
    switch (i.t) {
      case "texto":
        return <Fragment key={k}>{i.v}</Fragment>;
      case "negrito":
        return <strong key={k}>{desenharInlines(i.f)}</strong>;
      case "italico":
        return <em key={k}>{desenharInlines(i.f)}</em>;
      case "riscado":
        return <s key={k}>{desenharInlines(i.f)}</s>;
      case "codigo":
        return <code key={k}>{i.v}</code>;
      case "quebra":
        return <br key={k} />;
      case "link":
        return <a key={k} href={i.href} target="_blank" rel="noopener noreferrer nofollow">{desenharInlines(i.f)}</a>;
      case "interno":
        // citação de tarefa, página, pessoa ou categoria: navega dentro do app
        return <Link key={k} href={i.rota} data-slot="link-interno" data-tipo={i.tipo}>{desenharInlines(i.f)}</Link>;
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

/** `ancoras`: o sumário do documento. Com ele, cada título de primeiro nível ganha a âncora e a posição. */
function desenharBlocos(bs: Bloco[], ancoras?: ItemDoSumario[]): ReactNode {
  let titulo = 0;
  return bs.map((b, k) => {
    switch (b.t) {
      case "paragrafo":
        return <p key={k}>{desenharInlines(b.f)}</p>;
      case "titulo": {
        const T = (["h1", "h2", "h3"] as const)[b.nivel - 1];
        const a = ancoras?.[titulo++];
        return a ? <T key={k} id={a.id} data-titulo={a.indice}>{desenharInlines(b.f)}</T> : <T key={k}>{desenharInlines(b.f)}</T>;
      }
      case "lista": {
        const tarefas = b.itens.length > 0 && b.itens.every((i) => i.tarefa);
        const itens = b.itens.map((it, j) =>
          it.tarefa ? (
            <li key={j} data-type="taskItem" data-checked={it.feito}>
              <label><span role="img" aria-label={it.feito ? "Feito" : "A fazer"} data-caixa data-marcada={it.feito || undefined} /></label>
              <div>{desenharBlocos(it.f)}</div>
            </li>
          ) : (
            <li key={j}>{desenharBlocos(it.f)}</li>
          ),
        );
        if (tarefas) return <ul key={k} data-type="taskList">{itens}</ul>;
        return b.ordenada ? <ol key={k} start={b.inicio}>{itens}</ol> : <ul key={k}>{itens}</ul>;
      }
      case "citacao":
        return <blockquote key={k}>{desenharBlocos(b.f)}</blockquote>;
      case "codigo":
        return <pre key={k}><code>{b.v}</code></pre>;
      case "divisor":
        return <hr key={k} />;
      case "tabela":
        return (
          <div key={k} className="overflow-x-auto">
            <table>
              <thead>
                <tr>{b.cabecalho.map((c, j) => <th key={j} style={c.alinhar ? { textAlign: c.alinhar } : undefined}>{desenharInlines(c.f)}</th>)}</tr>
              </thead>
              <tbody>
                {b.linhas.map((l, j) => (
                  <tr key={j}>{l.map((c, m) => <td key={m} style={b.cabecalho[m]?.alinhar ? { textAlign: b.cabecalho[m].alinhar! } : undefined}>{desenharInlines(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

export function TextoRico({ texto, className, ancoras }: {
  texto: string; className?: string;
  /** Documento com sumário: os títulos ganham âncora (`id`) e `data-titulo` com a posição. */
  ancoras?: boolean;
}) {
  const blocos = useMemo(() => analisarMarkdown(texto), [texto]);
  const sumario = useMemo(() => (ancoras ? sumarioDosBlocos(blocos) : undefined), [ancoras, blocos]);
  return (
    <div data-slot="texto" className={cn("prosa", className)}>
      {desenharBlocos(blocos, sumario)}
    </div>
  );
}
