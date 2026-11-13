"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { campoBase } from "./input";

const limpar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Campo de etiquetas (tags, participantes) com sugestões próprias.
// Enter, vírgula ou ponto e vírgula adicionam; Backspace no campo vazio remove a última;
// setas escolhem uma sugestão.
function CampoChips({
  valor,
  aoMudar,
  sugestoes = [],
  placeholder,
  className,
  id,
}: {
  valor: string[];
  aoMudar: (v: string[]) => void;
  sugestoes?: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [txt, setTxt] = React.useState("");
  const [foco, setFoco] = React.useState(false);
  const [indice, setIndice] = React.useState(-1);
  const entrada = React.useRef<HTMLInputElement>(null);

  const add = (s: string) => {
    const novos = s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    const out = [...valor];
    for (const n of novos) if (!out.some((v) => v.toLowerCase() === n.toLowerCase())) out.push(n);
    aoMudar(out);
    setTxt("");
    setIndice(-1);
  };

  const filtradas = React.useMemo(() => {
    const q = limpar(txt.trim());
    return sugestoes
      .filter((s) => !valor.some((v) => v.toLowerCase() === s.toLowerCase()))
      .filter((s) => !q || limpar(s).includes(q))
      .slice(0, 8);
  }, [sugestoes, valor, txt]);
  const mostrar = foco && filtradas.length > 0;

  return (
    <div className="relative" data-slot="campo-chips">
      <div
        onClick={() => entrada.current?.focus()}
        className={cn(
          campoBase,
          "flex min-h-8 cursor-text flex-wrap items-center gap-1 px-1.5 py-1 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25",
          className,
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {valor.map((v) => (
            <motion.span
              key={v}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.14 }}
              data-slot="chip"
              className="inline-flex h-[22px] items-center gap-0.5 rounded-md bg-primary/12 pr-0.5 pl-2 text-xs font-medium text-primary dark:bg-primary/20 dark:text-foreground"
            >
              {v}
              <button type="button" aria-label={`Remover ${v}`} onClick={(e) => { e.stopPropagation(); aoMudar(valor.filter((x) => x !== v)); }}
                className="inline-flex size-4 items-center justify-center rounded opacity-60 hover:bg-primary/15 hover:opacity-100">
                <X className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={entrada}
          id={id}
          value={txt}
          autoComplete="off"
          placeholder={valor.length ? "" : placeholder}
          className="h-[22px] min-w-24 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/70"
          onFocus={() => setFoco(true)}
          onBlur={() => { setFoco(false); if (txt.trim()) add(txt); }}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]$/.test(v)) add(v);
            else { setTxt(v); setIndice(-1); }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && mostrar) { e.preventDefault(); setIndice((i) => (i + 1) % filtradas.length); }
            else if (e.key === "ArrowUp" && mostrar) { e.preventDefault(); setIndice((i) => (i <= 0 ? filtradas.length - 1 : i - 1)); }
            else if (e.key === "Enter" && (txt.trim() || indice >= 0)) {
              e.preventDefault();
              e.stopPropagation();
              add(indice >= 0 ? filtradas[indice] : txt);
            } else if (e.key === "Backspace" && !txt && valor.length) aoMudar(valor.slice(0, -1));
            else if (e.key === "Escape" && mostrar) { e.stopPropagation(); setFoco(false); }
          }}
        />
      </div>
      <AnimatePresence>
        {mostrar && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full right-0 left-0 z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
          >
            {filtradas.map((s, i) => (
              <li key={s} role="option" aria-selected={i === indice}
                onMouseDown={(e) => { e.preventDefault(); add(s); }}
                onMouseEnter={() => setIndice(i)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5 text-[13px] sem-selecao", i === indice && "bg-accent text-accent-foreground")}>
                {s}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// Campo de texto com sugestões (substitui <datalist>). Valor livre: a sugestão só ajuda.
function CampoSugestoes({
  valor,
  aoMudar,
  sugestoes,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  valor: string;
  aoMudar: (v: string) => void;
  sugestoes: string[];
}) {
  const [foco, setFoco] = React.useState(false);
  const [indice, setIndice] = React.useState(-1);
  const filtradas = React.useMemo(() => {
    const q = limpar(valor.trim());
    return sugestoes.filter((s) => limpar(s) !== q && (!q || limpar(s).includes(q))).slice(0, 6);
  }, [sugestoes, valor]);
  const mostrar = foco && filtradas.length > 0;
  return (
    <div className={cn("relative", className)} data-slot="campo-sugestoes">
      <input
        {...props}
        value={valor}
        autoComplete="off"
        className={cn(campoBase, "h-8 px-2.5")}
        onChange={(e) => { aoMudar(e.target.value); setIndice(-1); }}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onKeyDown={(e) => {
          if (!mostrar) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setIndice((i) => (i + 1) % filtradas.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIndice((i) => (i <= 0 ? filtradas.length - 1 : i - 1)); }
          else if (e.key === "Enter" && indice >= 0) { e.preventDefault(); aoMudar(filtradas[indice]); setFoco(false); }
          else if (e.key === "Escape") { e.stopPropagation(); setFoco(false); }
        }}
      />
      {mostrar && (
        <ul role="listbox" className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 min-w-32 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 slide-in-from-top-1">
          {filtradas.map((s, i) => (
            <li key={s} role="option" aria-selected={i === indice}
              onMouseDown={(e) => { e.preventDefault(); aoMudar(s); setFoco(false); }}
              onMouseEnter={() => setIndice(i)}
              className={cn("cursor-pointer rounded-md px-2 py-1.5 text-[13px] sem-selecao", i === indice && "bg-accent text-accent-foreground")}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Área de soltar arquivo (o <input type="file"> fica escondido; clique ou arraste).
function AreaArquivo({
  arquivo,
  aoMudar,
  className,
}: {
  arquivo: File | null;
  aoMudar: (f: File | null) => void;
  className?: string;
}) {
  const entrada = React.useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = React.useState(false);
  const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
  return (
    <div
      data-slot="area-arquivo"
      role="button"
      tabIndex={0}
      onClick={() => entrada.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), entrada.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); aoMudar(e.dataTransfer.files?.[0] ?? null); }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors outline-none hover:border-primary/60 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/30",
        sobre && "border-primary bg-primary/8",
        className,
      )}
    >
      <input ref={entrada} type="file" hidden tabIndex={-1} onChange={(e) => aoMudar(e.target.files?.[0] ?? null)} />
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Upload className="size-4" />
      </span>
      {arquivo ? (
        <>
          <span className="max-w-full truncate text-[13px] font-medium">{arquivo.name}</span>
          <span className="text-xs text-muted-foreground">{tamanho(arquivo.size)} · clique para trocar</span>
        </>
      ) : (
        <>
          <span className="text-[13px] font-medium">Solte um arquivo aqui ou clique para escolher</span>
          <span className="text-xs text-muted-foreground">Uma cópia é guardada na pasta de dados</span>
        </>
      )}
    </div>
  );
}

export { CampoChips, CampoSugestoes, AreaArquivo };
