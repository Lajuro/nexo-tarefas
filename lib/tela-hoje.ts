"use client";

// A tela Hoje do jeito do usuário (3.13): quais blocos aparecem, a ordem dos painéis da coluna da direita,
// qual dos dois blocos principais vem primeiro e o nome na saudação.
// É preferência (localStorage "nexo:telaHoje"), não dado: pode ser perdida sem prejuízo.

import { useCallback, useMemo } from "react";
import { usePref } from "./preferencias";

/** Todos os blocos da tela Hoje, na ordem em que aparecem por padrão. */
export const BLOCOS_HOJE = ["captura", "precisa", "foco", "rotina", "progresso", "aguardando", "bloqueadas", "semana"] as const;
export type BlocoHoje = (typeof BLOCOS_HOJE)[number];
/** Os painéis da coluna da direita: são os que o usuário pode reordenar. */
export const LATERAIS_HOJE = ["rotina", "progresso", "aguardando", "bloqueadas"] as const;
export type LateralHoje = (typeof LATERAIS_HOJE)[number];
export const PRIMEIROS_HOJE = ["auto", "precisa", "foco"] as const;
export type PrimeiroHoje = (typeof PRIMEIROS_HOJE)[number];

export const NOME_BLOCO_HOJE: Record<BlocoHoje, { nome: string; descricao: string }> = {
  captura: { nome: "Captura rápida", descricao: "O campo para anotar uma tarefa e apertar Enter." },
  precisa: { nome: "Precisa de você", descricao: "As tarefas com prazo estourado, passo atrasado, retorno pendente e outros lembretes." },
  foco: { nome: "Foco de hoje", descricao: "As tarefas que você escolheu para hoje, com os passos para marcar." },
  rotina: { nome: "Rotina de hoje", descricao: "O bloco de agora, o próximo e os botões do ponto." },
  progresso: { nome: "Progresso de hoje", descricao: "A meta do dia e o que já saiu: passos, registros e tarefas concluídas." },
  aguardando: { nome: "Aguardando retorno", descricao: "De quem você espera resposta e há quantos dias." },
  bloqueadas: { nome: "Bloqueadas e paradas", descricao: "O que travou ou ficou sem novidade." },
  semana: { nome: "Próximos 7 dias", descricao: "Os prazos da semana, dia a dia." },
};

export const TAMANHO_DO_NOME = 24;

export interface TelaHoje {
  ocultos: BlocoHoje[];
  /** Ordem dos painéis da coluna da direita. */
  laterais: LateralHoje[];
  /** auto: o que pede atenção vem primeiro quando há algo; com tudo em dia, o foco sobe. */
  primeiro: PrimeiroHoje;
  /** Como chamar o usuário na saudação ("Boa tarde, Fulano"). Vazio: só a saudação. */
  nome: string;
}

export const TELA_HOJE_PADRAO: TelaHoje = { ocultos: [], laterais: [...LATERAIS_HOJE], primeiro: "auto", nome: "" };

const dentro = <T extends string>(lista: readonly T[], x: unknown) =>
  [...new Set(Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").slice(0, 40) : [])].filter((v): v is T => lista.includes(v as T));

/** Nome de saudação: uma linha curta de texto, sem caracteres de controle. É desenhado como texto pelo React. */
export function nomeDeSaudacao(x: unknown) {
  if (typeof x !== "string") return "";
  // caracteres de controle e separadores de linha viram espaço
  return x.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim().slice(0, TAMANHO_DO_NOME).trim();
}

/** Aceita qualquer coisa que venha do localStorage e devolve uma configuração válida. */
export function normalizarTelaHoje(x: unknown): TelaHoje {
  const t = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof TelaHoje, unknown>>;
  const laterais = dentro(LATERAIS_HOJE, t.laterais);
  return {
    ocultos: dentro(BLOCOS_HOJE, t.ocultos),
    laterais: [...laterais, ...LATERAIS_HOJE.filter((l) => !laterais.includes(l))],
    primeiro: PRIMEIROS_HOJE.includes(t.primeiro as PrimeiroHoje) ? (t.primeiro as PrimeiroHoje) : "auto",
    nome: nomeDeSaudacao(t.nome),
  };
}

export function useTelaHoje() {
  const [bruta, setBruta] = usePref<unknown>("telaHoje", {});
  const telaHoje = useMemo(() => normalizarTelaHoje(bruta), [bruta]);
  const mudarTelaHoje = useCallback(
    (parte: Partial<TelaHoje> | ((atual: TelaHoje) => Partial<TelaHoje>)) =>
      setBruta((atual: unknown) => {
        const t = normalizarTelaHoje(atual);
        return normalizarTelaHoje({ ...t, ...(typeof parte === "function" ? parte(t) : parte) });
      }),
    [setBruta],
  );
  const restaurarTelaHoje = useCallback(() => setBruta(TELA_HOJE_PADRAO), [setBruta]);
  return { telaHoje, mudarTelaHoje, restaurarTelaHoje };
}
