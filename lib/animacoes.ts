// Presets de animação (motion). Use estes em vez de inventar durações novas,
// para o app inteiro se mexer do mesmo jeito: rápido, com desaceleração suave.

import type { Transition, Variants } from "motion/react";

export const curva = [0.22, 1, 0.36, 1] as const;

/** Transição padrão para entrar/sair. */
export const suave: Transition = { duration: 0.24, ease: curva };

/** Mola para coisas que mudam de lugar ou tamanho (layout, arrastar, pílulas). */
export const mola: Transition = { type: "spring", stiffness: 460, damping: 36, mass: 0.9 };

/** Lista cujos filhos entram em cascata. Use com `itemLista` nos filhos. */
export const lista: Variants = {
  escondido: {},
  visivel: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const itemLista: Variants = {
  escondido: { opacity: 0, y: 8 },
  visivel: { opacity: 1, y: 0, transition: suave },
};

/** Aparecer subindo um pouco (blocos, painéis). */
export const subir: Variants = {
  escondido: { opacity: 0, y: 10 },
  visivel: { opacity: 1, y: 0, transition: suave },
  saindo: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/** Aparecer com um leve zoom (cards que surgem, popups próprios). */
export const brotar: Variants = {
  escondido: { opacity: 0, scale: 0.96 },
  visivel: { opacity: 1, scale: 1, transition: suave },
  saindo: { opacity: 0, scale: 0.96, transition: { duration: 0.14 } },
};

/** Props prontas para um item de lista que pode ser removido (com AnimatePresence + layout). */
export const itemRemovivel = {
  layout: true,
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: suave,
} as const;
