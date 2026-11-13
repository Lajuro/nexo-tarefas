"use client";

// Alternância Pessoas | Times da barra da tela (a aba fica na URL: /pessoas e /pessoas?aba=times).

import { useRouter } from "next/navigation";
import { UsersRound, UserRound } from "lucide-react";
import { Contador } from "@/components/comum";
import { Segmentado } from "@/components/ui/controles";

export function AbasPessoas({ aba, pessoas, times }: { aba: "pessoas" | "times"; pessoas: number; times: number }) {
  const router = useRouter();
  return (
    <Segmentado
      aria-label="Pessoas ou times"
      valor={aba}
      aoMudar={(v) => router.replace(v === "times" ? "/pessoas?aba=times" : "/pessoas", { scroll: false })}
      opcoes={[
        { valor: "pessoas", icone: <UserRound />, rotulo: <>Pessoas <Contador n={pessoas} className="bg-background/70" /></> },
        { valor: "times", icone: <UsersRound />, rotulo: <>Times <Contador n={times} className="bg-background/70" /></> },
      ]}
    />
  );
}
