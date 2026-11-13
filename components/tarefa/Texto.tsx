"use client";

import { Fragment, ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

// Mostra texto livre (escrito pelo usuário ou colado do Copilot) com um pouco de forma:
// linhas "## TÍTULO" viram subtítulos, linhas com "-", "*", "•" ou "1." viram lista e o resto vira parágrafo.
// É só apresentação: o texto gravado não muda.

type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "lista"; itens: { marca: string; texto: string }[] }
  | { tipo: "paragrafo"; texto: string };

const TITULO = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;
const ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(?:\[[ xX]?\]\s*)?(.+)$/;

function montar(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", texto: paragrafo.join("\n") });
    paragrafo = [];
  };
  for (const linha of texto.replace(/\r/g, "").split("\n")) {
    if (!linha.trim()) {
      fecharParagrafo();
      continue;
    }
    const t = linha.match(TITULO);
    if (t) {
      fecharParagrafo();
      blocos.push({ tipo: "titulo", texto: t[1].replace(/\*\*/g, "") });
      continue;
    }
    const i = linha.match(ITEM);
    if (i) {
      fecharParagrafo();
      const item = { marca: i[2] ? `${i[2]}.` : "", texto: i[3] };
      const ultimo = blocos[blocos.length - 1];
      if (ultimo?.tipo === "lista") ultimo.itens.push(item);
      else blocos.push({ tipo: "lista", itens: [item] });
      continue;
    }
    paragrafo.push(linha);
  }
  fecharParagrafo();
  return blocos;
}

/** Só o **negrito** do Markdown, que é o que costuma sobrar quando se copia do Copilot. */
function comNegrito(texto: string): ReactNode {
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  if (partes.length === 1) return texto;
  return partes.map((p, i) => (i % 2 ? <strong key={i} className="font-semibold">{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

export function TextoRico({ texto, className }: { texto: string; className?: string }) {
  const blocos = useMemo(() => montar(texto), [texto]);
  return (
    <div data-slot="texto" className={cn("flex flex-col gap-1.5 leading-relaxed", className)}>
      {blocos.map((b, i) => {
        if (b.tipo === "titulo")
          return (
            <h4 key={i} className="mt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
              {b.texto}
            </h4>
          );
        if (b.tipo === "lista")
          return (
            <ul key={i} className="flex flex-col gap-1">
              {b.itens.map((it, j) => (
                <li key={j} className="flex gap-2">
                  {it.marca ? (
                    <span aria-hidden className="min-w-4 shrink-0 text-right text-muted-foreground tabular-nums">{it.marca}</span>
                  ) : (
                    <span aria-hidden className="mt-[0.62em] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  )}
                  <span className="min-w-0 flex-1 texto-pre">{comNegrito(it.texto)}</span>
                </li>
              ))}
            </ul>
          );
        return <p key={i} className="texto-pre">{comNegrito(b.texto)}</p>;
      })}
    </div>
  );
}
