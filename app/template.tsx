"use client";

// Entrada de cada tela: aparece subindo um pouco. O template é remontado pelo Next a cada troca
// de rota, então a animação roda sozinha (só na entrada, sem segurar a tela anterior).

import { ReactNode } from "react";
import { motion } from "motion/react";
import { curva } from "@/lib/animacoes";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div data-slot="tela" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: curva }} className="h-full">
      {children}
    </motion.div>
  );
}
