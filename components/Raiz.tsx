"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MotionConfig, MotionGlobalConfig } from "motion/react";
import { TriangleAlert } from "lucide-react";
import { TooltipProvider } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/diversos";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@/components/ui/dialog";
import { APARENCIA_PADRAO, Aparencia, aplicarAparencia, normalizarAparencia } from "@/lib/aparencia";
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

// ---------- Aparência (cor de destaque, cantos, fonte, movimento, estilo da barra lateral) ----------

interface CtxAparencia {
  aparencia: Aparencia;
  /** Muda um ou mais campos. Aplica na hora e guarda no navegador. */
  mudarAparencia: (parte: Partial<Aparencia>) => void;
  restaurarAparencia: () => void;
}
const ContextoAparencia = createContext<CtxAparencia>({ aparencia: APARENCIA_PADRAO, mudarAparencia: () => {}, restaurarAparencia: () => {} });
export const useAparencia = () => useContext(ContextoAparencia);

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

/**
 * Para formulários sem rascunho: fecha direto se nada foi digitado; senão pergunta antes de
 * jogar fora. Use o retorno como `fechar` do Modal e do botão Cancelar.
 */
export function useFecharComCuidado(sujo: boolean, fechar: () => void) {
  const confirmar = useConfirmar();
  return async () => {
    if (sujo) {
      const descartar = await confirmar({
        titulo: "Fechar sem salvar?",
        descricao: "O que você digitou aqui ainda não foi salvo e se perde se fechar agora.",
        confirmar: "Descartar",
        cancelar: "Continuar editando",
        perigo: true,
      });
      if (!descartar) return;
    }
    fechar();
  };
}

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

  const [aparencia, setAparencia] = useState<Aparencia>(APARENCIA_PADRAO);
  useEffect(() => {
    setAparencia(normalizarAparencia(lerPref<unknown>("aparencia", {})));
  }, []);
  const mudarAparencia = useCallback((parte: Partial<Aparencia>) => {
    setAparencia((atual) => {
      const nova = normalizarAparencia({ ...atual, ...parte });
      aplicarAparencia(nova);
      gravarPref("aparencia", nova);
      return nova;
    });
  }, []);
  const restaurarAparencia = useCallback(() => mudarAparencia(APARENCIA_PADRAO), [mudarAparencia]);

  // "nenhum": o motion pula todas as animações (o CSS zera as transições, ver app/globals.css).
  useEffect(() => {
    MotionGlobalConfig.skipAnimations = aparencia.movimento === "nenhum";
  }, [aparencia.movimento]);

  // Onde foi o último clique: é de lá que o tema novo "abre" na troca.
  const clique = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const aoClicar = (e: PointerEvent) => {
      clique.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointerdown", aoClicar, true);
    return () => window.removeEventListener("pointerdown", aoClicar, true);
  }, []);
  const movimento = useRef(aparencia.movimento);
  movimento.current = aparencia.movimento;

  const definirTema = useCallback((t: Tema) => {
    const raiz = document.documentElement;
    const escuro = t === "escuro" || (t === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const trocar = () => {
      // Troca sem animar cada cor individualmente (evita o "arrastar" de transições).
      const css = document.createElement("style");
      css.textContent = "*,*::before,*::after{transition:none!important}";
      document.head.appendChild(css);
      raiz.classList.toggle("dark", escuro);
      setTema(t);
      gravarPref("tema", t);
      setTimeout(() => css.remove(), 80);
    };
    // Com movimento completo, o tema novo se abre em círculo a partir do clique (View Transitions do Edge/Chrome).
    const doc = document as Document & { startViewTransition?: (fn: () => void) => unknown };
    const muda = escuro !== raiz.classList.contains("dark");
    const podeAnimar = muda && movimento.current === "completo" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (podeAnimar && typeof doc.startViewTransition === "function") {
      raiz.style.setProperty("--vt-x", `${clique.current.x}px`);
      raiz.style.setProperty("--vt-y", `${clique.current.y}px`);
      doc.startViewTransition(trocar);
    } else trocar();
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
     <ContextoAparencia.Provider value={{ aparencia, mudarAparencia, restaurarAparencia }}>
      {/* "completo" respeita o "reduzir movimento" do Windows; "sutil" e "nenhum" sempre reduzem (só esmaecer). */}
      <MotionConfig reducedMotion={aparencia.movimento === "completo" ? "user" : "always"}>
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
     </ContextoAparencia.Provider>
    </ContextoTema.Provider>
  );
}
