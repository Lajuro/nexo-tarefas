"use client";

// Peças do fluxo "copiar prompt, colar resposta" do Copilot.
// Usadas pelo editor de registro e pelo PromptModal para os dois terem a mesma cara.

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fica ligado por um instante depois de copiar, para o botão trocar o ícone por um visto. */
export function useCopiado(ms = 1800) {
  const [copiado, setCopiado] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const marcar = useCallback(() => {
    setCopiado(true);
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setCopiado(false), ms);
  }, [ms]);
  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);
  return [copiado, marcar] as const;
}

/** Ícone de copiar que vira um visto enquanto `copiado` estiver ligado. */
export function IconeCopiar({ copiado, className }: { copiado: boolean; className?: string }) {
  return (
    <span data-copiado={copiado || undefined} className={cn("inline-flex size-4 items-center justify-center", className)}>
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={copiado ? "ok" : "copiar"}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="inline-flex"
        >
          {copiado ? <Check strokeWidth={2.6} /> : <Copy />}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Quadradinho com a faísca que identifica tudo que é do Copilot. */
export function SeloCopilot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary dark:bg-primary/25 dark:text-foreground",
        className,
      )}
    >
      <Sparkles className="size-3.5" />
    </span>
  );
}

/** Caixa do fluxo do Copilot. Os filhos são <PassoCopilot>. */
export function BlocoCopilot({
  titulo = "Organizar com o Copilot", descricao, children, className,
}: {
  titulo?: ReactNode; descricao?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section data-slot="copilot" className={cn("rounded-xl border border-primary/20 bg-primary/[0.035] dark:bg-primary/[0.07]", className)}>
      <header className="flex items-center gap-2.5 px-3.5 pt-3">
        <SeloCopilot />
        <div className="min-w-0">
          <h3 className="text-[13px] leading-tight font-semibold tracking-tight sem-selecao">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{descricao}</p>}
        </div>
      </header>
      <ol className="px-3.5 pt-3.5 pb-3.5">{children}</ol>
    </section>
  );
}

/** Um passo numerado, ligado ao próximo por uma linha. `feito` troca o número por um visto. */
export function PassoCopilot({
  n, titulo, feito, ultimo, children,
}: {
  n: number; titulo: ReactNode; feito?: boolean; ultimo?: boolean; children?: ReactNode;
}) {
  return (
    <li data-slot="passo-copilot" data-feito={feito || undefined} className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-200 sem-selecao",
            feito ? "bg-sucesso text-background" : "bg-card text-foreground ring-1 ring-primary/35 ring-inset dark:bg-input/30",
          )}
        >
          {feito ? (
            <motion.span initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 24 }} className="inline-flex">
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          ) : n}
        </span>
        {!ultimo && <span aria-hidden className={cn("mt-1 w-px flex-1 transition-colors duration-200", feito ? "bg-sucesso/50" : "bg-primary/20")} />}
      </div>
      <div className={cn("min-w-0 flex-1", !ultimo && "pb-4")}>
        <div className="flex min-h-6 items-center text-[13px] font-medium sem-selecao">{titulo}</div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}
