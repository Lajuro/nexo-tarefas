"use client";

import { cn } from "@/lib/utils";

const IGNORADAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "para"]);

/** Uma ou duas letras que identificam a categoria (primeira letra das duas primeiras palavras que importam). */
export function iniciaisCategoria(nome: string) {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const fortes = palavras.filter((p) => !IGNORADAS.has(p.toLowerCase()));
  const base = fortes.length ? fortes : palavras;
  return base.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/**
 * Quadradinho com as iniciais na cor da categoria: é a "cara" do assunto nos cartões e na prévia do formulário.
 * A cor é dado do usuário, por isso entra por style. O texto mistura a cor com a cor do texto do tema
 * para continuar legível no claro e no escuro (um amarelo puro sumiria no fundo branco).
 */
export function EmblemaCategoria({
  nome, cor, tamanho = "md", className,
}: {
  nome: string; cor: string; tamanho?: "sm" | "md" | "lg"; className?: string;
}) {
  const dim = { sm: "size-7 rounded-md text-[10px]", md: "size-9 rounded-lg text-xs", lg: "size-11 rounded-xl text-sm" }[tamanho];
  return (
    <span
      aria-hidden
      data-slot="emblema-categoria"
      style={{
        background: `color-mix(in oklch, ${cor} 16%, transparent)`,
        color: `color-mix(in oklch, ${cor} 72%, var(--foreground))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${cor} 28%, transparent)`,
      }}
      className={cn("inline-flex shrink-0 items-center justify-center font-semibold tracking-tight transition-colors duration-200 sem-selecao", dim, className)}
    >
      {iniciaisCategoria(nome) || "?"}
    </span>
  );
}
