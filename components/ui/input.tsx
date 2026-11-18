"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Aparência comum de todo campo de texto do app (input, textarea, gatilhos de seletor).
export const campoBase =
  "w-full min-w-0 rounded-md border border-input bg-card text-[13px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-ring/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/20";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      autoComplete="off"
      spellCheck={false}
      className={cn(campoBase, "h-8 px-2.5", className)}
      {...props}
    />
  );
}

/** O navegador sabe crescer o campo sozinho (`field-sizing: content`)? Edge e Chrome sabem; o resto usa a conta abaixo. */
let cresceSozinho: boolean | null = null;
function navegadorCresceSozinho() {
  if (cresceSozinho === null) {
    try {
      cresceSozinho = typeof CSS !== "undefined" && CSS.supports("field-sizing", "content");
    } catch {
      cresceSozinho = false;
    }
  }
  return cresceSozinho;
}

/**
 * Campo de texto de várias linhas (3.11). Sem a alça de redimensionar do navegador: cresce sozinho com o
 * conteúdo, a partir da altura de `rows` linhas, até um teto (`max-h`, padrão o menor entre 20rem e 45% da
 * janela), e daí em diante rola por dentro. Quem passa `min-h-*` ou `max-h-*` na classe troca o piso ou o teto.
 */
function Textarea({ className, rows = 3, style, ref, ...props }: React.ComponentProps<"textarea">) {
  const interno = React.useRef<HTMLTextAreaElement | null>(null);
  const juntarRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      interno.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  // Navegador sem `field-sizing`: mede a altura do texto a cada mudança (o teto do CSS continua valendo).
  React.useLayoutEffect(() => {
    const el = interno.current;
    if (!el || navegadorCresceSozinho()) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);

  return (
    <textarea
      ref={juntarRef}
      data-slot="textarea"
      rows={rows}
      style={{ "--linhas": rows, ...style } as React.CSSProperties}
      className={cn(
        campoBase,
        "min-h-[calc(var(--linhas)*1lh+1rem+2px)] max-h-[min(20rem,45vh)] resize-none overflow-y-auto px-2.5 py-2 leading-relaxed [field-sizing:content]",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
