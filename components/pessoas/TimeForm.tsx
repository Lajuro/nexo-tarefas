"use client";

// ESQUELETO: cadastrar/editar time. A tela de verdade será feita em cima deste contrato.
// Gravar com useNexo().salvarTimes((items) => ...) e normalizarTime (lib/tipos.ts).

import { Modal } from "@/components/comum";
import type { Time } from "@/lib/tipos";

export function TimeForm({ aberto, fechar, time }: { aberto: boolean; fechar: () => void; time?: Time }) {
  return (
    <Modal titulo={time ? "Editar time" : "Novo time"} aberto={aberto} fechar={fechar}>
      <p data-slot="time-form" className="text-[13px] text-muted-foreground">{time?.nome ?? ""}</p>
    </Modal>
  );
}
