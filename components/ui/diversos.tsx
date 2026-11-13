"use client";

import * as React from "react";
import { Collapsible as CollapsiblePrimitive, ScrollArea as ScrollAreaPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Badge ----------

const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap sem-selecao [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary dark:bg-primary/22 dark:text-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border text-muted-foreground",
        sucesso: "bg-sucesso/14 text-sucesso",
        alerta: "bg-alerta/16 text-alerta",
        perigo: "bg-destructive/12 text-destructive",
        info: "bg-info/14 text-info",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ---------- Card ----------

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)} {...props} />;
}

// ---------- Separator / Skeleton / Kbd ----------

function Separator({ className, vertical, ...props }: React.ComponentProps<"div"> & { vertical?: boolean }) {
  return <div role="separator" className={cn("shrink-0 bg-border", vertical ? "h-full w-px" : "h-px w-full", className)} {...props} />;
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-b-2 bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground sem-selecao",
        className,
      )}
      {...props}
    />
  );
}

// ---------- Collapsible (abre e fecha com animação de altura) ----------

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

function CollapsibleContent({ className, ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      className={cn("overflow-hidden data-[state=closed]:animate-recolher-fechar data-[state=open]:animate-recolher-abrir", className)}
      {...props}
    />
  );
}

// ---------- ScrollArea ----------

function ScrollArea({ className, children, ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full rounded-[inherit] [&>div]:!block">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex w-2 touch-none p-px select-none">
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-foreground/15 hover:bg-foreground/30" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

// ---------- Tabs ----------

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex items-center gap-4 border-b sem-selecao", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-9 items-center gap-1.5 border-b-2 border-transparent text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

// ---------- Progress ----------

function Progress({ valor, className, cor }: { valor: number; className?: string; cor?: string }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%`, background: cor }} />
    </div>
  );
}

// ---------- Tabela ----------

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table data-slot="table" className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
      </div>
    </div>
  );
}
function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-muted/50 [&_tr]:border-b", className)} {...props} />;
}
function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/40", className)} {...props} />;
}
function Th({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={cn("h-8 px-3 text-left text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase", className)} {...props} />;
}
function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-2 align-middle", className)} {...props} />;
}

// ---------- Toasts (Sonner com o tema do app) ----------

function Toaster({ tema }: { tema: "light" | "dark" }) {
  return (
    <Sonner
      theme={tema}
      position="bottom-right"
      offset={{ bottom: 40, right: 16 }}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-lg !font-sans !text-[13px] !py-3 !px-3.5 !gap-2.5",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md !h-6 !text-xs !font-medium",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-md",
          success: "[&_[data-icon]]:!text-sucesso",
          error: "[&_[data-icon]]:!text-destructive",
          warning: "[&_[data-icon]]:!text-alerta",
        },
      }}
    />
  );
}

export {
  Badge, badgeVariants, Card, Separator, Skeleton, Kbd, Collapsible, CollapsibleTrigger, CollapsibleContent, ScrollArea,
  Tabs, TabsList, TabsTrigger, TabsContent, Progress, Table, THead, TBody, Tr, Th, Td, Toaster,
};
