"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive, Slider as SliderPrimitive, Label as LabelPrimitive } from "radix-ui";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// ---------- Label ----------

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn("text-xs font-medium text-muted-foreground sem-selecao", className)} {...props} />;
}

// ---------- Checkbox (com o "visto" desenhando ao marcar) ----------

function Checkbox({
  className,
  redondo,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { redondo?: boolean }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer inline-flex size-[18px] shrink-0 items-center justify-center border border-input bg-card shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-150 outline-none hover:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-90 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=unchecked]:bg-input/20",
        redondo ? "rounded-full" : "rounded-[5px]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild>
        <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden>
          <motion.path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// ---------- Switch ----------

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input shadow-xs transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:opacity-50 data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-input/60",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[1px]" />
    </SwitchPrimitive.Root>
  );
}

// Linha "interruptor + texto" clicável inteira.
function CampoSwitch({
  marcado,
  aoMudar,
  children,
  className,
}: {
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Switch id={id} checked={marcado} onCheckedChange={aoMudar} />
      <label htmlFor={id} className="cursor-pointer text-[13px] text-muted-foreground sem-selecao">
        {children}
      </label>
    </div>
  );
}

// ---------- Slider ----------

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full border-2 border-primary bg-card shadow-sm transition-[box-shadow,transform] outline-none hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/30" />
    </SliderPrimitive.Root>
  );
}

// ---------- Segmentado (abas compactas com a "pílula" deslizando) ----------

export interface OpcaoSegmento<T extends string> {
  valor: T;
  rotulo: React.ReactNode;
  icone?: React.ReactNode;
  dica?: string;
}

function Segmentado<T extends string>({
  valor,
  aoMudar,
  opcoes,
  className,
  tamanho = "default",
  "aria-label": ariaLabel,
}: {
  valor: T;
  aoMudar: (v: T) => void;
  opcoes: OpcaoSegmento<T>[];
  className?: string;
  tamanho?: "default" | "sm";
  "aria-label"?: string;
}) {
  const id = React.useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segmentado"
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 sem-selecao", className)}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={typeof o.rotulo === "string" ? undefined : o.dica}
            data-ativo={ativo || undefined}
            onClick={() => aoMudar(o.valor)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_svg]:size-3.5",
              tamanho === "sm" ? "h-6 text-xs" : "h-7 text-[13px]",
              ativo ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {ativo && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border dark:bg-accent"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icone}
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { Label, Checkbox, Switch, CampoSwitch, Slider, Segmentado };
