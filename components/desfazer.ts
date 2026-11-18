"use client";

// Desfazer: depois de uma ação que muda dados, um aviso com o botão "Desfazer" e a mesma volta pelo Ctrl Z
// (fora de campos de texto). A pilha vive só nesta aba e some ao recarregar: os dados continuam protegidos
// pela lixeira e por registrosRemovidos, o desfazer é só o caminho curto.
//
// Quem desfaz é sempre uma gravação comum (passa pelo Provider, com rev), então nada escapa do controle de
// concorrência. Se a coisa mudou de novo depois, a função de desfazer recusa e avisa em vez de passar por cima.

import { toast as sonner } from "sonner";

interface Desfazivel {
  id: number;
  texto: string;
  desfazer: () => Promise<boolean | void> | boolean | void;
  em: number;
  aviso?: string | number;
}

const pilha: Desfazivel[] = [];
let proximo = 1;
/** Depois disso a ação some da pilha do Ctrl Z (o aviso já foi embora há muito tempo). */
const VALIDADE_MS = 15 * 60_000;
const MAXIMO = 30;

function tirar(id: number) {
  const i = pilha.findIndex((x) => x.id === id);
  if (i >= 0) pilha.splice(i, 1);
}

async function executar(item: Desfazivel) {
  tirar(item.id);
  if (item.aviso != null) sonner.dismiss(item.aviso);
  try {
    const r = await item.desfazer();
    if (r !== false) sonner(`Desfeito: ${item.texto.replace(/\.$/, "")}.`, { duration: 2600 });
  } catch (e) {
    sonner.error(`Não consegui desfazer: ${(e as Error).message}`, { duration: 7000 });
  }
}

/**
 * Mostra o aviso da ação com "Desfazer" e guarda a volta para o Ctrl Z.
 * `desfazer` devolve false quando não deu (e já avisou o porquê).
 */
export function oferecerDesfazer(texto: string, desfazer: Desfazivel["desfazer"], opcoes: { tipo?: "ok" | "info" } = {}) {
  const item: Desfazivel = { id: proximo++, texto, desfazer, em: Date.now() };
  pilha.push(item);
  if (pilha.length > MAXIMO) pilha.splice(0, pilha.length - MAXIMO);
  const mostrar = opcoes.tipo === "info" ? sonner : sonner.success;
  item.aviso = mostrar(texto, {
    duration: 6000,
    action: { label: "Desfazer", onClick: () => void executar(item) },
  });
}

/** Desfaz a ação mais recente que ainda vale. Devolve false se não havia nada. */
export function desfazerUltimo(): boolean {
  const agora = Date.now();
  while (pilha.length && agora - pilha[pilha.length - 1].em > VALIDADE_MS) pilha.pop();
  const item = pilha[pilha.length - 1];
  if (!item) return false;
  void executar(item);
  return true;
}

/** Quantas ações dá para desfazer agora (para testes e para a interface). */
export const podeDesfazer = () => pilha.some((x) => Date.now() - x.em <= VALIDADE_MS);
