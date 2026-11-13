"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { TooltipProvider } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/diversos";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@/components/ui/dialog";
import { gravarPref, lerPref } from "@/lib/preferencias";

// Provedores de interface que valem para o app inteiro: tema (claro/escuro/sistema),
// dicas, animações (respeitando "reduzir movimento" do sistema), toasts e a confirmação própria.

// ---------- Tema ----------

export type Tema = "sistema" | "claro" | "escuro";
interface CtxTema {
  tema: Tema;
  /** O que está valendo de fato agora. */
  resolvido: "claro" | "escuro";
  definirTema: (t: Tema) => void;
}
const ContextoTema = createContext<CtxTema>({ tema: "sistema", resolvido: "claro", definirTema: () => {} });
export const useTema = () => useContext(ContextoTema);

// ---------- Confirmação (substitui o confirm() do navegador) ----------

export interface OpcoesConfirmar {
  titulo: string;
  descricao?: ReactNode;
  /** Texto do botão que confirma. Padrão: "Confirmar". */
  confirmar?: string;
  cancelar?: string;
  /** Ação destrutiva: botão vermelho. */
  perigo?: boolean;
}
type Confirmar = (o: OpcoesConfirmar) => Promise<boolean>;
const ContextoConfirmar = createContext<Confirmar>(async () => false);

/** `const confirmar = useConfirmar(); if (await confirmar({ titulo: "Excluir?" })) ...` */
export const useConfirmar = () => useContext(ContextoConfirmar);

export function Raiz({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("sistema");
  const [resolvido, setResolvido] = useState<"claro" | "escuro">("claro");

  useEffect(() => {
    setTema(lerPref<Tema>("tema", "sistema"));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aplicar = () => {
      const escuro = tema === "escuro" || (tema === "sistema" && mq.matches);
      document.documentElement.classList.toggle("dark", escuro);
      setResolvido(escuro ? "escuro" : "claro");
    };
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [tema]);

  const definirTema = useCallback((t: Tema) => {
    // Troca sem animar cada cor individualmente (evita o "arrastar" de transições).
    const css = document.createElement("style");
    css.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(css);
    setTema(t);
    gravarPref("tema", t);
    setTimeout(() => css.remove(), 80);
  }, []);

  const [pedido, setPedido] = useState<OpcoesConfirmar | null>(null);
  const [aberto, setAberto] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirmar = useCallback<Confirmar>((o) => {
    resolver.current?.(false);
    setPedido(o);
    setAberto(true);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);
  const responder = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setAberto(false);
  };

  return (
    <ContextoTema.Provider value={{ tema, resolvido, definirTema }}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={350} skipDelayDuration={200}>
          <ContextoConfirmar.Provider value={confirmar}>{children}</ContextoConfirmar.Provider>
          <AlertDialog open={aberto} onOpenChange={(a) => !a && responder(false)}>
            <AlertDialogContent>
              <div className="flex gap-3">
                {pedido?.perigo && (
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive">
                    <TriangleAlert className="size-4" />
                  </span>
                )}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <AlertDialogTitle>{pedido?.titulo}</AlertDialogTitle>
                  <AlertDialogDescription asChild={typeof pedido?.descricao !== "string"}>
                    {typeof pedido?.descricao === "string" ? pedido.descricao : <div>{pedido?.descricao}</div>}
                  </AlertDialogDescription>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <AlertDialogCancel onClick={() => responder(false)}>{pedido?.cancelar ?? "Cancelar"}</AlertDialogCancel>
                <AlertDialogAction perigo={pedido?.perigo} onClick={() => responder(true)}>
                  {pedido?.confirmar ?? "Confirmar"}
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
          <Toaster tema={resolvido === "escuro" ? "dark" : "light"} />
        </TooltipProvider>
      </MotionConfig>
    </ContextoTema.Provider>
  );
}
