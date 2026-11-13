"use client";

// ESQUELETO: importar contatos do Outlook (colar texto ou abrir CSV/vCard).
// Lógica pronta em lib/importar-pessoas.ts: decodificarArquivo, interpretarImportacao, compararComCadastro.

import { Modal } from "@/components/comum";

export function ImportarPessoas({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  return (
    <Modal titulo="Importar pessoas" aberto={aberto} fechar={fechar}>
      <p data-slot="importar-pessoas" className="text-[13px] text-muted-foreground">Em construção.</p>
    </Modal>
  );
}
