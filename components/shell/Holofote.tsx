"use client";

// Holofote (3.22): o "mostrar onde". Leva o usuário até um lugar da interface, destaca e explica num balão.
// Uma peça só, montada no Shell. Quem quer mostrar algo chama mostrarOnde(alvo), com um Alvo de lib/ajuda.ts.
//
// Não trava a tela: o destaque não captura cliques, então a pessoa usa o controle de verdade enquanto lê.
// Esc ou "Entendi" fecha e o foco do teclado vai para o elemento mostrado. Se o lugar não está na tela (o perfil
// em uso pode ter escondido), o balão diz isso e oferece o Personalizar, em vez de falhar em silêncio.

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Alvo, alvoEstaAqui } from "@/lib/ajuda";
import { abrirPersonalizar } from "@/lib/moldura";

const EVENTO = "nexo:holofote";

/** Mostra um lugar da interface: vai até a tela dele, destaca o elemento e explica. */
export function mostrarOnde(alvo: Alvo) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: alvo }));
}

interface Caixa { top: number; left: number; width: number; height: number }

const TEMPO_DE_ESPERA_MS = 3500;
const FOLGA = 6;
const LARGURA_DO_BALAO = 320;

/** O primeiro elemento visível que casa com o seletor (um seletor pode listar alternativas). */
function acharVisivel(seletor: string): HTMLElement | null {
  let candidatos: HTMLElement[] = [];
  try {
    candidatos = [...document.querySelectorAll<HTMLElement>(seletor)];
  } catch {
    return null;
  }
  return candidatos.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

export function Holofote() {
  const router = useRouter();
  const pathname = usePathname();
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const elemento = useRef<HTMLElement | null>(null);
  const balao = useRef<HTMLDivElement>(null);

  const fechar = useCallback((focar = true) => {
    const el = elemento.current;
    setAlvo(null);
    setCaixa(null);
    setNaoAchou(false);
    elemento.current = null;
    // o foco vai para o que foi mostrado: a pessoa segue pelo teclado dali
    if (focar && el?.isConnected) el.focus({ preventScroll: true });
  }, []);

  // pedido novo: se o lugar fica em outra tela, vai até ela primeiro
  useEffect(() => {
    const abrir = (e: Event) => {
      const pedido = (e as CustomEvent<Alvo>).detail;
      if (!pedido?.seletor) return;
      setCaixa(null);
      setNaoAchou(false);
      elemento.current = null;
      setAlvo(pedido);
      const aqui = window.location.pathname.replace(/\/+$/, "") || "/";
      if (pedido.rota && !pedido.rota.includes("[") && aqui !== pedido.rota && !alvoEstaAqui(pedido, aqui)) router.push(pedido.rota);
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, [router]);

  // espera o elemento aparecer (a tela pode estar chegando), rola até ele e passa a acompanhá-lo
  useEffect(() => {
    if (!alvo) return;
    let vivo = true;
    let quadro = 0;
    const inicio = performance.now();
    const medir = () => {
      const el = elemento.current;
      if (!vivo || !el) return;
      if (!el.isConnected) return fechar(false);
      const r = el.getBoundingClientRect();
      setCaixa((c) => (c && c.top === r.top && c.left === r.left && c.width === r.width && c.height === r.height ? c : { top: r.top, left: r.left, width: r.width, height: r.height }));
      quadro = requestAnimationFrame(medir);
    };
    const procurar = () => {
      if (!vivo) return;
      const el = acharVisivel(alvo.seletor);
      if (el) {
        elemento.current = el;
        const semMovimento = document.documentElement.dataset.movimento === "nenhum";
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: semMovimento ? "auto" : "smooth" });
        medir();
        return;
      }
      if (performance.now() - inicio > TEMPO_DE_ESPERA_MS) return setNaoAchou(true);
      quadro = requestAnimationFrame(procurar);
    };
    procurar();
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
    };
    // pathname: ao chegar na tela do alvo, procura de novo
  }, [alvo, pathname, fechar]);

  // Esc fecha; o balão recebe o foco para o leitor de tela anunciar e para o Esc valer de primeira
  useEffect(() => {
    if (!alvo) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      fechar();
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [alvo, fechar]);
  useEffect(() => {
    if (alvo && (caixa || naoAchou)) balao.current?.focus({ preventScroll: true });
    // só quando o balão aparece, não a cada medida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, !!caixa, naoAchou]);

  if (!alvo || (!caixa && !naoAchou) || typeof document === "undefined") return null;

  // o balão fica embaixo do elemento quando cabe; senão, em cima. Nunca sai da janela.
  const [vw, vh] = [window.innerWidth, window.innerHeight];
  const embaixo = !caixa || caixa.top + caixa.height + 150 < vh;
  const estilo = caixa
    ? {
        left: Math.max(12, Math.min(vw - LARGURA_DO_BALAO - 12, caixa.left + caixa.width / 2 - LARGURA_DO_BALAO / 2)),
        ...(embaixo ? { top: Math.min(vh - 12, caixa.top + caixa.height + FOLGA + 8) } : { bottom: Math.max(12, vh - caixa.top + FOLGA + 8) }),
      }
    : { left: Math.max(12, vw / 2 - LARGURA_DO_BALAO / 2), top: Math.max(12, vh / 2 - 80) };

  return createPortal(
    <div data-slot="holofote" data-achou={caixa ? "" : undefined} className="pointer-events-none fixed inset-0 z-[70]">
      {caixa && (
        // o anel não captura cliques: o controle de verdade continua usável por baixo
        <div aria-hidden data-slot="holofote-anel"
          className="absolute rounded-lg ring-[3px] ring-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.28)] transition-[top,left,width,height] duration-150 dark:shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
          style={{ top: caixa.top - FOLGA, left: caixa.left - FOLGA, width: caixa.width + FOLGA * 2, height: caixa.height + FOLGA * 2 }} />
      )}
      <div ref={balao} role="dialog" aria-label={alvo.titulo} tabIndex={-1} data-slot="holofote-balao"
        className="pointer-events-auto absolute rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-xl outline-none animate-in duration-200 fade-in-0 zoom-in-95"
        style={{ ...estilo, width: LARGURA_DO_BALAO, maxWidth: "calc(100vw - 24px)" }}>
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13px] leading-snug font-semibold tracking-tight">{naoAchou ? "Não achei isto na tela" : alvo.titulo}</p>
          <button type="button" aria-label="Fechar" onClick={() => fechar()}
            className="-mt-1 -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40">
            <X className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          {naoAchou ? `“${alvo.titulo}” não está visível agora. O perfil de uso pode ter escondido, ou a tela ainda não tem o que mostrar.` : alvo.texto}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {naoAchou && (
            <Button variant="outline" size="sm" onClick={() => { fechar(false); abrirPersonalizar("perfis"); }}><SlidersHorizontal /> Abrir Personalizar</Button>
          )}
          <Button size="sm" data-slot="holofote-entendi" onClick={() => fechar()}>Entendi</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
