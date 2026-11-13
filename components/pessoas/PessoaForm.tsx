"use client";

// ESQUELETO: cadastrar/editar pessoa. A tela de verdade será feita em cima deste contrato.
// Gravar com useNexo().salvarPessoas((items) => ...) e normalizarPessoa (lib/tipos.ts).

import { Modal } from "@/components/comum";
import type { Pessoa } from "@/lib/tipos";

export function PessoaForm({ aberto, fechar, pessoa, nomeInicial }: { aberto: boolean; fechar: () => void; pessoa?: Pessoa; nomeInicial?: string }) {
  return (
    <Modal titulo={pessoa ? "Editar pessoa" : "Nova pessoa"} aberto={aberto} fechar={fechar}>
      <p data-slot="pessoa-form" className="text-[13px] text-muted-foreground">{pessoa?.nome ?? nomeInicial ?? ""}</p>
    </Modal>
  );
}
