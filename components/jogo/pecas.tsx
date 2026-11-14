"use client";

// Peças visuais da gamificação: anel de progresso, ícone de cada conquista, cartão de conquista e o confete.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookMarked, CircleCheckBig, Clock, Flame, LayoutTemplate, MessageSquareReply, NotebookPen, NotebookText, PackageCheck, Timer, Trophy, Users,
  UsersRound, Zap, type LucideIcon,
} from "lucide-react";
import { useAparencia } from "@/components/Raiz";
import type { Conquista } from "@/lib/jogo";
import { formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const ICONE_CONQUISTA: Record<string, LucideIcon> = {
  passo: CircleCheckBig, registro: NotebookText, reuniao: Users, referencia: BookMarked, tarefa: PackageCheck, cobranca: MessageSquareReply,
  chama: Flame, raio: Zap, foco: Timer, relogio: Clock, modelo: LayoutTemplate, folha: NotebookPen, pessoas: UsersRound,
};

/** Anel que enche conforme `parte` (0 a 1). O que vai dentro é com quem usa. */
export function Anel({
  parte, tamanho = 40, espessura = 4, children, className, completo,
}: {
  parte: number; tamanho?: number; espessura?: number; children?: React.ReactNode; className?: string; completo?: boolean;
}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, parte));
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: tamanho, height: tamanho }}>
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={espessura} className="stroke-foreground/10" />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" strokeWidth={espessura} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", completo ?? p >= 1 ? "stroke-sucesso" : "stroke-primary")} />
      </svg>
      <span className="relative inline-flex items-center justify-center">{children}</span>
    </span>
  );
}

export function CartaoConquista({ c }: { c: Conquista }) {
  const Icone = ICONE_CONQUISTA[c.icone] ?? Trophy;
  return (
    <div data-slot="conquista" data-id={c.id} data-feita={c.feita || undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-[border-color,box-shadow,transform] duration-150",
        c.feita ? "bg-card shadow-xs hover:-translate-y-0.5 hover:shadow-sm" : "border-dashed bg-transparent",
      )}>
      <span className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
        c.feita ? "bg-primary/12 text-primary ring-1 ring-primary/25" : "bg-muted text-muted-foreground/60",
      )}>
        <Icone className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] font-semibold tracking-tight", !c.feita && "text-muted-foreground")}>{c.nome}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{c.descricao}</p>
        {c.feita ? (
          <p className="mt-1.5 text-[11px] font-medium text-sucesso">{c.em ? `Alcançada em ${formatarData(c.em)}` : "Alcançada"}</p>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70 transition-[width] duration-500 ease-out" style={{ width: `${(c.atual / c.alvo) * 100}%` }} />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">{c.atual} de {c.alvo}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- confete ----------

const EVENTO = "nexo:confete";
/** Solta confete (se o usuário deixou as animações no "completo"). */
export const soltarConfete = () => window.dispatchEvent(new CustomEvent(EVENTO));

const CORES = ["var(--primary)", "var(--sucesso)", "var(--alerta)", "var(--info)", "var(--destructive)", "var(--st-andamento)"];

interface Particula { id: number; dx: number; sobe: number; cai: number; giro: number; cor: string; largura: number; altura: number; atraso: number; redonda: boolean }

function gerar(serie: number): Particula[] {
  return Array.from({ length: 44 }, (_, i) => {
    const lado = Math.random() < 0.5 ? -1 : 1;
    return {
      id: serie * 1000 + i,
      dx: lado * (40 + Math.random() * 380),
      sobe: -(120 + Math.random() * 260),
      cai: 260 + Math.random() * 320,
      giro: (Math.random() - 0.5) * 900,
      cor: CORES[i % CORES.length],
      largura: 6 + Math.random() * 5,
      altura: 8 + Math.random() * 8,
      atraso: Math.random() * 0.12,
      redonda: i % 5 === 0,
    };
  });
}

/** Camada do confete: montada uma vez no Shell. Não captura cliques e some sozinha. */
export function Confete() {
  const { aparencia } = useAparencia();
  const [rajadas, setRajadas] = useState<{ serie: number; particulas: Particula[] }[]>([]);

  useEffect(() => {
    let serie = 0;
    const soltar = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const atual = ++serie;
      setRajadas((r) => [...r, { serie: atual, particulas: gerar(atual) }]);
      setTimeout(() => setRajadas((r) => r.filter((x) => x.serie !== atual)), 2400);
    };
    window.addEventListener(EVENTO, soltar);
    return () => window.removeEventListener(EVENTO, soltar);
  }, []);

  // só com o movimento "completo": no "sutil" e no "nenhum" a comemoração fica por conta do aviso
  if (aparencia.movimento !== "completo") return null;
  return (
    <div data-slot="confete" aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <AnimatePresence>
        {rajadas.flatMap((r) =>
          r.particulas.map((p) => (
            <motion.span key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
              animate={{ x: p.dx, y: [0, p.sobe, p.cai], opacity: [1, 1, 0], rotate: p.giro, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.7, delay: p.atraso, ease: [0.2, 0.7, 0.3, 1], times: [0, 0.35, 1] }}
              style={{ left: "50%", top: "32%", width: p.largura, height: p.redonda ? p.largura : p.altura, background: p.cor, borderRadius: p.redonda ? "999px" : "2px" }}
              className="absolute" />
          )),
        )}
      </AnimatePresence>
    </div>
  );
}
