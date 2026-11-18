"use client";

// Avisos do Windows (3.8): a notificação do sistema que o navegador mostra, para quando o Nexo está aberto
// mas em segundo plano (atrás do Teams, minimizado). Opcional e desligado por padrão (preferência
// "nexo:notificacoes"). Não usa servidor nem nada de fora: é a API Notification do próprio navegador,
// que funciona em 127.0.0.1. Com a janela do Nexo à vista, nada é enviado: o aviso dentro do app basta.

import { gravarPref, lerPref } from "./preferencias";

export interface PrefNotificacoes {
  /** Mandar avisos do Windows quando o Nexo estiver em segundo plano. */
  ligado: boolean;
  /** Avisos da rotina (bloco começando, hora de sair, fim da pausa). */
  rotina: boolean;
  /** Lembretes críticos novos (prazo hoje, prazo vencido, passo atrasado). */
  lembretes: boolean;
}

export const NOTIFICACOES_PADRAO: PrefNotificacoes = { ligado: false, rotina: true, lembretes: true };

/** O que vem do localStorage é conferido: só booleanos; o resto vira o padrão. */
export function normalizarNotificacoes(x: unknown): PrefNotificacoes {
  const o = x && typeof x === "object" ? (x as Partial<Record<keyof PrefNotificacoes, unknown>>) : {};
  return {
    ligado: o.ligado === true,
    rotina: o.rotina !== false,
    lembretes: o.lembretes !== false,
  };
}

export const notificacaoSuportada = () => typeof window !== "undefined" && "Notification" in window;
export const permissaoDeNotificacao = (): NotificationPermission | "indisponivel" =>
  notificacaoSuportada() ? Notification.permission : "indisponivel";

/** Pede a permissão ao navegador (só depois de um clique do usuário). Devolve se ficou liberado. */
export async function pedirPermissao(): Promise<boolean> {
  if (!notificacaoSuportada()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/**
 * Manda um aviso do Windows, se o usuário ligou, o navegador deixou e o Nexo está em segundo plano.
 * `tipo` diz qual chave da preferência vale. `tag` evita repetir o mesmo aviso. Clicar traz o Nexo e,
 * se houver `rota`, abre aquela tela.
 */
export function notificar(tipo: "rotina" | "lembretes", titulo: string, corpo: string, opcoes: { tag?: string; rota?: string; sempre?: boolean } = {}): boolean {
  const p = normalizarNotificacoes(lerPref("notificacoes", NOTIFICACOES_PADRAO));
  if (!p.ligado || !p[tipo] || permissaoDeNotificacao() !== "granted") return false;
  if (!opcoes.sempre && document.visibilityState === "visible" && document.hasFocus()) return false;
  try {
    const n = new Notification(titulo, { body: corpo, tag: opcoes.tag, icon: "/icon.svg", silent: false });
    n.onclick = () => {
      window.focus();
      if (opcoes.rota) window.dispatchEvent(new CustomEvent("nexo:ir", { detail: { rota: opcoes.rota } }));
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export const gravarNotificacoes = (p: PrefNotificacoes) => gravarPref("notificacoes", p);
