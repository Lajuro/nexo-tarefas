"use client";

// "Quem aponta para cá": lista o que cita uma tarefa, página, pessoa ou categoria com um link interno.
// O índice é montado na hora a partir dos textos (lib/ligacoes.ts) e guardado por versão dos dados.

import Link from "next/link";
import { useMemo } from "react";
import { FileText, ListTodo, MessagesSquare, NotebookPen, Waypoints } from "lucide-react";
import { useNexo } from "./Provider";
import { Painel } from "./comum";
import { type Citacao, citacoesDe, indiceDeCitacoes } from "@/lib/ligacoes";
import type { TipoDeAlvo } from "@/lib/texto-rico";
import type { Dados } from "@/lib/tipos";

const cache = new WeakMap<Dados, Map<string, Citacao[]>>();
function indice(dados: Dados) {
  let i = cache.get(dados);
  if (!i) cache.set(dados, (i = indiceDeCitacoes(dados)));
  return i;
}

export function useCitacoes(tipo: TipoDeAlvo, alvo: string, outrosNomes?: string[]): Citacao[] {
  const { dados } = useNexo();
  const chaveNomes = (outrosNomes ?? []).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (dados && alvo ? citacoesDe(indice(dados), tipo, alvo, outrosNomes) : []), [dados, tipo, alvo, chaveNomes]);
}

const ICONE = { registro: MessagesSquare, pagina: FileText, nota: NotebookPen, tarefa: ListTodo };

/** Painel "Citada em". Não aparece quando ninguém cita. */
export function PainelCitacoes({ tipo, alvo, outrosNomes, titulo = "Citada em", className }: { tipo: TipoDeAlvo; alvo: string; outrosNomes?: string[]; titulo?: string; className?: string }) {
  const citacoes = useCitacoes(tipo, alvo, outrosNomes);
  if (citacoes.length === 0) return null;
  return (
    <Painel titulo={titulo} icone={<Waypoints />} contagem={citacoes.length} className={className} corpoClassName="p-1.5">
      <ul data-slot="citacoes" className="flex flex-col">
        {citacoes.slice(0, 12).map((c, i) => {
          const Icone = ICONE[c.origem];
          return (
            <li key={i}>
              <Link href={c.rota} data-slot="citacao"
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35">
                <Icone className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{c.rotulo}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.detalhe}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {citacoes.length > 12 && <li className="px-2 py-1 text-[11px] text-muted-foreground">e mais {citacoes.length - 12}</li>}
      </ul>
    </Painel>
  );
}
