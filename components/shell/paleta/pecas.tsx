"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { curva } from "@/lib/animacoes";
import type { Tema } from "@/components/Raiz";

// Peças visuais da paleta de comandos. A lógica (o que existe, o que está selecionado,
// teclado) fica em Paleta.tsx; aqui só a aparência de cada tipo de item.

/** Realce do item selecionado: um único fundo que desliza de um item para o outro. */
function Realce() {
  return (
    <motion.span
      layoutId="paleta-realce"
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-accent"
      transition={{ duration: 0.18, ease: curva }}
    />
  );
}

export interface PropsOpcao {
  id: string;
  domId: string;
  selecionada: boolean;
  aoApontar: (id: string) => void;
  aoEscolher: (id: string) => void;
  className?: string;
  children: ReactNode;
  rotulo?: string;
}

/** Casca comum de todo item escolhível: papel de option, hover seleciona, clique executa, foco fica no campo. */
export function Opcao({ id, domId, selecionada, aoApontar, aoEscolher, className, children, rotulo }: PropsOpcao) {
  return (
    <div
      id={domId}
      role="option"
      aria-selected={selecionada}
      aria-label={rotulo}
      data-paleta-item={id}
      data-slot="paleta-item"
      onMouseMove={() => !selecionada && aoApontar(id)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => aoEscolher(id)}
      className={cn("relative cursor-pointer scroll-mt-8 scroll-mb-2 outline-none sem-selecao", className)}
    >
      {selecionada && <Realce />}
      <div className="relative z-10 flex h-full min-w-0 items-center">{children}</div>
    </div>
  );
}

export function TituloSecao({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-medium text-muted-foreground sem-selecao" role="presentation">
      <span>{children}</span>
      {extra}
    </div>
  );
}

/** Classe dos cartões e azulejos: borda, leve elevação no hover e borda acesa quando selecionado. */
export const cartao =
  "rounded-xl border bg-card shadow-xs transition-[translate,box-shadow,border-color] duration-200 hover:-translate-y-px hover:shadow-sm aria-selected:border-primary/40 aria-selected:shadow-sm";

/** Miniatura de uma janela do app no tema pedido, para o seletor de tema. */
export function Miniatura({ modo }: { modo: Tema }) {
  if (modo === "sistema") {
    return (
      <div className="relative size-full">
        <div className="absolute inset-0 [clip-path:polygon(0_0,100%_0,0_100%)]"><Miniatura modo="claro" /></div>
        <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]"><Miniatura modo="escuro" /></div>
      </div>
    );
  }
  const escuro = modo === "escuro";
  // O escuro usa os tokens reais do tema (a classe .dark redefine as variáveis só aqui dentro).
  // O claro é desenhado em branco com traços translúcidos, porque não há como forçar o tema claro
  // num trecho da tela quando o app inteiro está escuro.
  return (
    <div className={cn("flex size-full", escuro ? "dark bg-background" : "bg-white")}>
      <div className={cn("flex w-[30%] flex-col gap-1 p-1.5", escuro ? "bg-sidebar" : "bg-black/[0.045]")}>
        <span className="h-1 w-3/4 rounded-full bg-primary" />
        <span className={cn("h-1 w-full rounded-full", escuro ? "bg-foreground/20" : "bg-black/12")} />
        <span className={cn("h-1 w-2/3 rounded-full", escuro ? "bg-foreground/20" : "bg-black/12")} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <span className={cn("h-1.5 w-1/2 rounded-full", escuro ? "bg-foreground/45" : "bg-black/30")} />
        <div className={cn("flex-1 rounded-[3px] border", escuro ? "border-border bg-card" : "border-black/8 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06)]")} />
      </div>
    </div>
  );
}

export function MarcaAtual({ ativa }: { ativa: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        ativa ? "border-primary bg-primary text-primary-foreground" : "border-input",
      )}
    >
      {ativa && <Check className="size-2.5" strokeWidth={3} />}
    </span>
  );
}
