"use client";

// O vocabulário único de tags (3.16): todo campo de tag sugere as tags do app inteiro, da mais usada para a
// menos. Antes cada tela sugeria só as tags da própria coleção (a página não via as tags das tarefas), e a
// mesma ideia acabava escrita de dois jeitos.

import { useMemo } from "react";
import { useNexo } from "@/components/Provider";
import { inventarioDeTags, nomesDasTags } from "@/lib/tags";

export function useNomesDasTags(): string[] {
  const { dados } = useNexo();
  return useMemo(() => nomesDasTags(dados), [dados]);
}

export function useInventarioDeTags() {
  const { dados } = useNexo();
  return useMemo(() => inventarioDeTags(dados), [dados]);
}
