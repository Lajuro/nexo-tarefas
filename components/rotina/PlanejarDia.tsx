"use client";

import { Modal } from "@/components/comum";

// Ritual "Planejar o dia". O Shell monta este componente e decide quando abrir.
// (Esqueleto: o conteúdo de verdade entra na tarefa da tela Hoje.)
export function PlanejarDia({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  return (
    <Modal titulo="Planejar o dia" aberto={aberto} fechar={fechar}>
      <p className="text-[13px] text-muted-foreground">Em construção.</p>
    </Modal>
  );
}
