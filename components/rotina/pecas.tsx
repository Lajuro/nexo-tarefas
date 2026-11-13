"use client";

import { ReactNode } from "react";

/** Título de cada etapa do ritual, com algo opcional à direita (contador, progresso). */
export function CabecalhoEtapa({ titulo, descricao, lado }: { titulo: string; descricao: string; lado?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-tight font-semibold tracking-tight">{titulo}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{descricao}</p>
      </div>
      {lado && <div className="shrink-0">{lado}</div>}
    </div>
  );
}
