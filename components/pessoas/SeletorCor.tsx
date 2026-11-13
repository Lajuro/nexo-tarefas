"use client";

// Bolinhas de cor do time. Mesmo padrão do seletor de components/CategoriaForm.tsx
// (grupo de opções: Tab entra na cor escolhida, setas trocam, o anel desliza até a selecionada).

import { useId, useRef } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Dica } from "@/components/ui/popover";
import { mola } from "@/lib/animacoes";
import { cn } from "@/lib/utils";

const NOMES_DAS_CORES: Record<string, string> = {
  "#e5484d": "Vermelho",
  "#f76b15": "Laranja",
  "#ffb224": "Amarelo",
  "#46a758": "Verde",
  "#12a594": "Turquesa",
  "#0090ff": "Azul",
  "#3e63dd": "Índigo",
  "#8e4ec6": "Roxo",
  "#d6409f": "Rosa",
  "#8d8d86": "Cinza",
};
export const nomeDaCor = (c: string) => NOMES_DAS_CORES[c.toLowerCase()] ?? `Cor atual (${c})`;

export function SeletorCor({
  valor, aoMudar, cores, "aria-label": ariaLabel = "Cor",
}: {
  valor: string; aoMudar: (c: string) => void; cores: string[]; "aria-label"?: string;
}) {
  const id = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = cores.indexOf(valor);
  const irPara = (i: number) => {
    const n = (i + cores.length) % cores.length;
    aoMudar(cores[n]);
    botoes.current[n]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="seletor-cor"
      data-valor={valor}
      className="flex flex-wrap gap-1 sem-selecao"
      onKeyDown={(e) => {
        const base = atual < 0 ? 0 : atual;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); irPara(base + 1); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); irPara(base - 1); }
        else if (e.key === "Home") { e.preventDefault(); irPara(0); }
        else if (e.key === "End") { e.preventDefault(); irPara(cores.length - 1); }
      }}
    >
      {cores.map((c, i) => {
        const ativa = c === valor;
        return (
          <Dica key={c} texto={nomeDaCor(c)}>
            <button
              ref={(el) => { botoes.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={nomeDaCor(c)}
              data-slot="cor"
              data-cor={c}
              tabIndex={ativa || (atual < 0 && i === 0) ? 0 : -1}
              onClick={() => aoMudar(c)}
              className="group/cor relative inline-flex size-8 items-center justify-center rounded-full outline-none focus-visible:bg-accent"
            >
              {ativa && (
                <motion.span
                  layoutId={`anel-cor-${id}`}
                  transition={mola}
                  style={{ borderColor: c }}
                  className="absolute inset-0 rounded-full border-2 transition-colors duration-200"
                />
              )}
              <span
                style={{ background: c }}
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-white shadow-xs ring-1 ring-black/10 transition-transform duration-150 ring-inset group-hover/cor:scale-110 group-active/cor:scale-95 dark:ring-white/15",
                  !ativa && "group-focus-visible/cor:scale-110",
                )}
              >
                {ativa && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={mola} className="inline-flex">
                    <Check className="size-3" strokeWidth={3.5} />
                  </motion.span>
                )}
              </span>
            </button>
          </Dica>
        );
      })}
    </div>
  );
}
