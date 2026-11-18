// O pedido de "criar de qualquer tela" (3.16), separado da janela (components/Criar.tsx) para quem só precisa
// pedir não puxar os formulários junto (e para os formulários poderem pedir sem importar a si mesmos em círculo).

export type OQueCriar = "categoria" | "pagina" | "folha" | "link" | "pessoa" | "time" | "modelo";

export const EVENTO_CRIAR = "nexo:criar";

export interface PedidoDeCriar { tipo: OQueCriar; id?: string }

/** Abre o formulário de criar (ou, com `id`, de editar uma categoria) por cima de onde o usuário está. */
export function pedirCriar(tipo: OQueCriar, opcoes: { id?: string } = {}) {
  window.dispatchEvent(new CustomEvent<PedidoDeCriar>(EVENTO_CRIAR, { detail: { tipo, id: opcoes.id } }));
}
