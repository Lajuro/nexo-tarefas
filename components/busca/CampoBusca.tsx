"use client";

// Campo de busca/filtro com lupa e botão de limpar. Usado nas barras de Pessoas, Links e na Busca.
// Esc limpa o texto (e só então deixa o Esc seguir para quem estiver ouvindo).

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CampoBusca({
  valor, aoMudar, className, grande, onKeyDown, ref, ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "size"> & {
  valor: string;
  aoMudar: (v: string) => void;
  /** Versão de destaque (tela de Busca): mais alta e com texto maior. */
  grande?: boolean;
}) {
  const interno = React.useRef<HTMLInputElement | null>(null);
  const definirRef = (el: HTMLInputElement | null) => {
    interno.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div data-slot="campo-busca" className={cn("group/busca relative", className)}>
      <Search
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/busca:text-primary",
          grande ? "left-3.5 size-[18px]" : "left-2.5 size-3.5",
        )}
      />
      <Input
        {...props}
        ref={definirRef}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && valor) {
            e.preventDefault();
            e.stopPropagation();
            aoMudar("");
            return;
          }
          onKeyDown?.(e);
        }}
        className={cn(grande ? "h-11 rounded-lg pr-11 pl-11 text-[15px]" : "pr-8 pl-8")}
      />
      {valor && (
        <button
          type="button"
          aria-label="Limpar"
          onClick={() => { aoMudar(""); interno.current?.focus(); }}
          className={cn(
            "absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35",
            grande ? "right-2 size-7" : "right-1 size-6",
          )}
        >
          <X className={grande ? "size-4" : "size-3.5"} />
        </button>
      )}
    </div>
  );
}
