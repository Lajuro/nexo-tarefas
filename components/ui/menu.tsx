"use client";

import * as React from "react";
import { DropdownMenu as Dd, ContextMenu as Cm } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Menus suspensos (clique) e de contexto (botão direito) com o mesmo visual.

const conteudo =
  "z-50 min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
const item =
  "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none sem-selecao data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground";
const itemPerigo = "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg]:!text-destructive";
const rotulo = "px-2 py-1.5 text-[11px] font-medium text-muted-foreground";
const separador = "-mx-1 my-1 h-px bg-border";

// ---------- DropdownMenu ----------

const DropdownMenu = Dd.Root;
const DropdownMenuTrigger = Dd.Trigger;
const DropdownMenuGroup = Dd.Group;
const DropdownMenuSub = Dd.Sub;
const DropdownMenuRadioGroup = Dd.RadioGroup;

function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentProps<typeof Dd.Content>) {
  return (
    <Dd.Portal>
      <Dd.Content data-slot="menu" sideOffset={sideOffset} align={align}
        className={cn(conteudo, "origin-(--radix-dropdown-menu-content-transform-origin)", className)} {...props} />
    </Dd.Portal>
  );
}

function DropdownMenuItem({ className, perigo, ...props }: React.ComponentProps<typeof Dd.Item> & { perigo?: boolean }) {
  return <Dd.Item data-slot="menu-item" className={cn(item, perigo && itemPerigo, className)} {...props} />;
}

function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Dd.RadioItem>) {
  return (
    <Dd.RadioItem data-slot="menu-item" className={cn(item, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <Dd.ItemIndicator><Check className="!text-primary" /></Dd.ItemIndicator>
      </span>
    </Dd.RadioItem>
  );
}

function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof Dd.CheckboxItem>) {
  return (
    <Dd.CheckboxItem data-slot="menu-item" className={cn(item, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <Dd.ItemIndicator><Check className="!text-primary" /></Dd.ItemIndicator>
      </span>
    </Dd.CheckboxItem>
  );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Dd.Label>) {
  return <Dd.Label className={cn(rotulo, className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Dd.Separator>) {
  return <Dd.Separator className={cn(separador, className)} {...props} />;
}

function DropdownMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof Dd.SubTrigger>) {
  return (
    <Dd.SubTrigger className={cn(item, "data-[state=open]:bg-accent", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </Dd.SubTrigger>
  );
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<typeof Dd.SubContent>) {
  return (
    <Dd.Portal>
      <Dd.SubContent className={cn(conteudo, className)} {...props} />
    </Dd.Portal>
  );
}

// ---------- ContextMenu (botão direito) ----------

const ContextMenu = Cm.Root;
const ContextMenuTrigger = Cm.Trigger;
const ContextMenuSub = Cm.Sub;
const ContextMenuRadioGroup = Cm.RadioGroup;

function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof Cm.Content>) {
  return (
    <Cm.Portal>
      <Cm.Content data-slot="menu" className={cn(conteudo, "origin-(--radix-context-menu-content-transform-origin)", className)} {...props} />
    </Cm.Portal>
  );
}

function ContextMenuItem({ className, perigo, ...props }: React.ComponentProps<typeof Cm.Item> & { perigo?: boolean }) {
  return <Cm.Item data-slot="menu-item" className={cn(item, perigo && itemPerigo, className)} {...props} />;
}

function ContextMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Cm.RadioItem>) {
  return (
    <Cm.RadioItem data-slot="menu-item" className={cn(item, "pr-8", className)} {...props}>
      {children}
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <Cm.ItemIndicator><Check className="!text-primary" /></Cm.ItemIndicator>
      </span>
    </Cm.RadioItem>
  );
}

function ContextMenuLabel({ className, ...props }: React.ComponentProps<typeof Cm.Label>) {
  return <Cm.Label className={cn(rotulo, className)} {...props} />;
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof Cm.Separator>) {
  return <Cm.Separator className={cn(separador, className)} {...props} />;
}

function ContextMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof Cm.SubTrigger>) {
  return (
    <Cm.SubTrigger className={cn(item, "data-[state=open]:bg-accent", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </Cm.SubTrigger>
  );
}

function ContextMenuSubContent({ className, ...props }: React.ComponentProps<typeof Cm.SubContent>) {
  return (
    <Cm.Portal>
      <Cm.SubContent className={cn(conteudo, className)} {...props} />
    </Cm.Portal>
  );
}

// Atalho de teclado mostrado à direita de um item de menu.
function MenuAtalho({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto pl-4 font-mono text-[10px] tracking-wide text-muted-foreground", className)} {...props} />;
}

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent,
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuRadioGroup, ContextMenuRadioItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, MenuAtalho,
};
