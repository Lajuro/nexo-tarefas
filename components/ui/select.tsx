"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { campoBase } from "./input";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "default" | "sm" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        campoBase,
        "flex items-center justify-between gap-2 px-2.5 text-left sem-selecao data-[placeholder]:text-muted-foreground/70 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-2",
        size === "sm" ? "h-7 text-xs" : "h-8",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={4}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-[max(8rem,var(--radix-select-trigger-width))] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="max-h-80 p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("px-2 py-1.5 text-[11px] font-medium text-muted-foreground", className)} {...props} />;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-[13px] outline-none sem-selecao data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText asChild>
        <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
      </SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

// Atalho para o caso mais comum: lista simples de opções.
// O Radix não aceita valor vazio num item, então "" é representado por "__vazio" por dentro.
const VAZIO = "__vazio";
export interface Opcao {
  valor: string;
  rotulo: React.ReactNode;
  desabilitada?: boolean;
}

function Seletor({
  valor,
  aoMudar,
  opcoes,
  placeholder = "Selecione",
  className,
  size,
  disabled,
  "aria-label": ariaLabel,
  id,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: Opcao[];
  placeholder?: string;
  className?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
}) {
  const temVazio = opcoes.some((o) => o.valor === "");
  return (
    <Select
      value={valor === "" ? (temVazio ? VAZIO : undefined) : valor}
      onValueChange={(v) => aoMudar(v === VAZIO ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} size={size} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((o) => (
          <SelectItem key={o.valor || VAZIO} value={o.valor || VAZIO} disabled={o.desabilitada}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, Seletor };
