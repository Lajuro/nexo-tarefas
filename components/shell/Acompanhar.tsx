"use client";

// "Acompanhar" (3.9; Decisões entrou na 3.23): Radar, Diário, Decisões, Revisão semanal, Relatórios e Conquistas são telas de olhar para trás e
// para longe, visitadas bem menos que as do dia a dia. No menu elas viram um item só, e no topo de cada uma
// aparece esta faixa de abas para trocar entre elas. As rotas e os atalhos (G F, G D, G S, G R, G Q) não mudaram.
// Quem preferir as telas separadas no menu liga isso em Personalizar > Lateral (moldura.acompanharSeparado).
// A última aba usada é preferência do navegador ("nexo:acompanharAba"): o item do menu abre nela.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useNexo } from "@/components/Provider";
import { mola } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { usePref, useRotina } from "@/lib/preferencias";
import { diasAte } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { ITEM_ACOMPANHAR, TELAS_ACOMPANHAR, rotaAtiva } from "./navegacao";

/** Nome curto de cada tela na faixa de abas. */
const NOME_ABA: Record<string, string> = { "/revisao": "Revisão" };
const ABA_PADRAO = "/radar";

/** A revisão semanal está atrasada (7 dias ou mais desde a última, com tarefa aberta)? */
export function useRevisaoAtrasada() {
  const { dados } = useNexo();
  const { rotina, carregado } = useRotina();
  const temAbertas = useMemo(() => (dados?.tarefas ?? []).some(aberta), [dados?.tarefas]);
  return carregado && temAbertas && (!rotina.ultimaRevisao || (diasAte(rotina.ultimaRevisao) ?? 0) <= -7);
}

/** A gamificação está ligada? Lê só a preferência: o placar inteiro (useJogo) é conta cara para isto. */
function useJogoLigado() {
  const [jogo] = usePref<{ ligado?: unknown } | null>("jogo", {});
  return jogo?.ligado !== false;
}

/** As abas que aparecem: Conquistas some quando a gamificação está desligada (a não ser que a tela aberta seja ela). */
function useAbas(pathname: string) {
  const ligado = useJogoLigado();
  return TELAS_ACOMPANHAR.filter((n) => n.href !== "/conquistas" || ligado || rotaAtiva(pathname, n.href));
}

/** Para onde o item "Acompanhar" do menu leva: a última aba usada, se ela ainda aparece; senão o Radar. */
export function useDestinoAcompanhar() {
  const [ultima] = usePref<unknown>("acompanharAba", ABA_PADRAO);
  const ligado = useJogoLigado();
  const valida = TELAS_ACOMPANHAR.some((n) => n.href === ultima) && (ultima !== "/conquistas" || ligado);
  return valida ? (ultima as string) : ABA_PADRAO;
}

/** Faixa de abas no topo das telas de acompanhar. Montada pelo Shell, acima da tela. */
export function AbasAcompanhar() {
  const pathname = usePathname();
  const abas = useAbas(pathname);
  const atrasada = useRevisaoAtrasada();
  const [, setUltima] = usePref<unknown>("acompanharAba", ABA_PADRAO);
  const atual = TELAS_ACOMPANHAR.find((n) => rotaAtiva(pathname, n.href))?.href;

  useEffect(() => {
    if (atual) setUltima(atual);
  }, [atual, setUltima]);

  return (
    <nav aria-label="Acompanhar" data-slot="abas-acompanhar" className="@container/abas shrink-0 border-b bg-background">
      <div className="mx-auto flex h-10 w-full max-w-[1360px] items-stretch gap-1 overflow-x-auto px-6 sem-selecao">
        <span className="mr-2 hidden items-center gap-1.5 text-xs font-medium text-muted-foreground @[34rem]/abas:flex">
          <ITEM_ACOMPANHAR.icone aria-hidden className="size-3.5" />
          Acompanhar
          <span aria-hidden className="ml-2 h-4 w-px bg-border" />
        </span>
        {abas.map((n) => {
          const ativa = n.href === atual;
          const ponto = n.href === "/revisao" && atrasada;
          return (
            <Link key={n.href} href={n.href} data-slot="aba-acompanhar" data-href={n.href} aria-current={ativa ? "page" : undefined}
              className={cn(
                "group/aba relative flex shrink-0 items-center gap-1.5 px-2 text-[13px] font-medium transition-colors outline-none",
                "focus-visible:after:absolute focus-visible:after:inset-x-0 focus-visible:after:inset-y-1.5 focus-visible:after:rounded-md focus-visible:after:ring-[3px] focus-visible:after:ring-ring/35",
                ativa ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}>
              <n.icone aria-hidden className={cn("size-3.5 shrink-0", ativa ? "text-primary" : "opacity-80")} />
              {NOME_ABA[n.href] ?? n.nome}
              {ponto && (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-alerta" />
                  <span className="sr-only">(atrasada)</span>
                </>
              )}
              {ativa && <motion.span layoutId="aba-acompanhar" transition={mola} className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
