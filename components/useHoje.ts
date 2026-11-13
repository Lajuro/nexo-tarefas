"use client";

import { useEffect, useState } from "react";
import { hojeISO } from "@/lib/tipos";

/**
 * O dia de hoje (AAAA-MM-DD) que se atualiza sozinho quando o dia vira.
 * O Nexo fica aberto como janela de aplicativo por dias: sem isso, de manhã a tela ainda
 * mostraria os lembretes de ontem. Confere a cada 30 segundos e sempre que a janela volta
 * a ter foco (o relógio de uma aba em segundo plano ou de um PC que dormiu pode atrasar).
 */
export function useHoje(): string {
  const [hoje, setHoje] = useState(hojeISO);
  useEffect(() => {
    const conferir = () => setHoje(hojeISO());
    const id = setInterval(conferir, 30_000);
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    conferir();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
    };
  }, []);
  return hoje;
}
