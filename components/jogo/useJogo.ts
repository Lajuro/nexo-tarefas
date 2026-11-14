"use client";

import { useCallback, useMemo } from "react";
import { useNexo } from "@/components/Provider";
import { useHoje } from "@/components/useHoje";
import { type EstadoDoJogo, META_MAXIMA, META_PADRAO, calcularJogo } from "@/lib/jogo";
import { usePref } from "@/lib/preferencias";
import type { Dados } from "@/lib/tipos";

/** O jeito de jogar é preferência do navegador ("nexo:jogo"). O placar em si vem sempre dos dados. */
export interface PrefJogo {
  /** Mostrar nível, meta e conquistas. */
  ligado: boolean;
  /** Quantos avanços (passo concluído, registro, tarefa concluída) fazem um bom dia. */
  meta: number;
  /** Comemorar com confete e aviso quando algo é alcançado. */
  celebrar: boolean;
}

// O mesmo placar é pedido por várias peças da tela (barra lateral, Hoje, comemoração): calcula uma vez por versão dos dados.
const cache = new WeakMap<Dados, Map<string, EstadoDoJogo>>();
function placar(dados: Dados, hoje: string, meta: number): EstadoDoJogo {
  let porChave = cache.get(dados);
  if (!porChave) cache.set(dados, (porChave = new Map()));
  const chave = `${hoje}|${meta}`;
  let e = porChave.get(chave);
  if (!e) porChave.set(chave, (e = calcularJogo(dados, hoje, meta)));
  return e;
}

export function useJogo() {
  const { dados } = useNexo();
  const hoje = useHoje();
  const [bruta, setBruta, carregada] = usePref<Partial<PrefJogo>>("jogo", {});
  const meta = Number.isFinite(Number(bruta?.meta)) ? Math.min(META_MAXIMA, Math.max(1, Math.round(Number(bruta.meta)))) : META_PADRAO;
  const pref: PrefJogo = useMemo(() => ({ ligado: bruta?.ligado !== false, meta, celebrar: bruta?.celebrar !== false }), [bruta?.ligado, bruta?.celebrar, meta]);
  const estado = useMemo(() => (dados && pref.ligado ? placar(dados, hoje, pref.meta) : null), [dados, hoje, pref.ligado, pref.meta]);
  const mudar = useCallback((parte: Partial<PrefJogo>) => setBruta((atual) => ({ ...(atual ?? {}), ...parte })), [setBruta]);
  return { pref, mudar, estado, hoje, carregada };
}
