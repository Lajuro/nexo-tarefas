"use client";

// Criar uma tarefa só com o título, de dentro de um seletor de tarefa (3.16): mover um registro para uma
// tarefa que ainda não existe, ligar uma dependência, um link, uma página ou um assunto a ela.
// É a mesma tarefa da captura rápida (com o marco "Tarefa criada"); o resto se preenche depois, na página dela.

import { useCallback } from "react";
import { useNexo } from "@/components/Provider";
import { tarefaRapida } from "@/lib/acoes";

export function useCriarTarefa() {
  const { criarTarefa, toast } = useNexo();
  return useCallback(
    async (bruto: string, extras: { categoriaId?: string | null } = {}): Promise<string | null> => {
      const titulo = bruto.replace(/\s+/g, " ").trim().slice(0, 200);
      if (!titulo) return null;
      const criada = await criarTarefa({ ...tarefaRapida(titulo), categoriaId: extras.categoriaId || null });
      if (!criada) return null;
      toast(`Tarefa “${criada.titulo}” criada.`);
      return criada.id;
    },
    [criarTarefa, toast],
  );
}
