"use client";

import { useCallback, useEffect, useState } from "react";

// Preferências de interface (ordem, visão, tema, lembretes adiados, rotina do dia).
// Ficam em localStorage porque são do aparelho, não dos dados: nada aqui é crítico.
// Chaves sempre com o prefixo "nexo:". Componentes que usam a mesma chave ficam em sincronia.

const PREFIXO = "nexo:";
const EVENTO = "nexo:pref";

export function lerPref<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(PREFIXO + chave);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
}

export function gravarPref<T>(chave: string, valor: T) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: { chave } }));
  } catch {}
}

/**
 * Como um useState, mas lembrado entre visitas.
 * `carregado` vira true depois da primeira leitura (use para não piscar o valor padrão,
 * por exemplo antes de abrir sozinho o ritual do dia).
 */
export function usePref<T>(chave: string, padrao: T): [T, (v: T | ((atual: T) => T)) => void, boolean] {
  // No navegador o valor já nasce lido, para a tela não montar no padrão e "pular" para a escolha do usuário
  // (largura da barra lateral, itens escondidos, visão da lista). Isso não causa diferença na hidratação
  // porque nada que depende de preferência é desenhado no servidor: o Shell só mostra "Carregando" até ler os dados.
  const [valor, setValor] = useState<T>(() => (typeof window === "undefined" ? padrao : lerPref(chave, padrao)));
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const ler = () => setValor(lerPref(chave, padrao));
    ler();
    setCarregado(true);
    const aoMudar = (e: Event) => {
      if ((e as CustomEvent).detail?.chave === chave) ler();
    };
    const aoMudarOutraAba = (e: StorageEvent) => {
      if (e.key === PREFIXO + chave) ler();
    };
    window.addEventListener(EVENTO, aoMudar);
    window.addEventListener("storage", aoMudarOutraAba);
    return () => {
      window.removeEventListener(EVENTO, aoMudar);
      window.removeEventListener("storage", aoMudarOutraAba);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const definir = useCallback(
    (v: T | ((atual: T) => T)) => {
      const novo = typeof v === "function" ? (v as (a: T) => T)(lerPref(chave, padrao)) : v;
      setValor(novo);
      gravarPref(chave, novo);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave],
  );

  return [valor, definir, carregado];
}

/** Estado da rotina diária/semanal (quando foi a última vez que o usuário planejou o dia ou revisou a semana). */
export interface Rotina {
  /** AAAA-MM-DD do último "planejar o dia" concluído ou dispensado. */
  ultimoPlanejamento: string;
  /** AAAA-MM-DD da última revisão semanal concluída. */
  ultimaRevisao: string;
  /** Abrir o ritual sozinho na primeira visita do dia. */
  abrirSozinho: boolean;
}

export const ROTINA_PADRAO: Rotina = { ultimoPlanejamento: "", ultimaRevisao: "", abrirSozinho: true };

export function useRotina() {
  const [rotina, setRotina, carregado] = usePref<Rotina>("rotina", ROTINA_PADRAO);
  return { rotina: { ...ROTINA_PADRAO, ...rotina }, setRotina, carregado };
}
