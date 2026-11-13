import * as React from "react";
import { cn } from "@/lib/utils";

// Aparência comum de todo campo de texto do app (input, textarea, gatilhos de seletor).
export const campoBase =
  "w-full min-w-0 rounded-md border border-input bg-card text-[13px] text-foreground shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 hover:border-ring/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/20";

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

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(campoBase, "min-h-16 resize-y px-2.5 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export { Input, Textarea };
