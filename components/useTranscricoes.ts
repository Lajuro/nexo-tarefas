"use client";

// As transcrições dos vídeos para a busca global e o Perguntar (3.7). Pedidas uma vez a /api/transcricoes
// e lidas no navegador por lerTranscricao() (lib/transcricao.ts); voltam a ser pedidas quando as páginas mudam.

import { useEffect, useState } from "react";
import { useNexo } from "./Provider";
import { type Fala, lerTranscricao } from "@/lib/transcricao";

export interface TranscricaoDaPagina { paginaId: string; falas: Fala[] }

let cache: { chave: string; promessa: Promise<TranscricaoDaPagina[]> } | null = null;

function carregar(chave: string) {
  if (cache?.chave === chave) return cache.promessa;
  const promessa = fetch("/api/transcricoes", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { transcricoes: [] }))
    .then((j: { transcricoes?: { paginaId: string; texto: string }[] }) =>
      (j.transcricoes ?? []).map((t) => ({ paginaId: t.paginaId, falas: lerTranscricao(t.texto) })).filter((t) => t.falas.length > 0),
    )
    .catch(() => [] as TranscricaoDaPagina[]);
  cache = { chave, promessa };
  return promessa;
}

/** null enquanto carrega. Só pede se houver alguma página de vídeo com transcrição. */
export function useTranscricoes(): TranscricaoDaPagina[] | null {
  const { dados } = useNexo();
  const comTranscricao = (dados?.paginas?.items ?? []).filter((p) => p.video?.transcricao && !p.arquivadaEm);
  const chave = comTranscricao.map((p) => `${p.id}:${p.video?.transcricao}`).join("|");
  const [lista, setLista] = useState<TranscricaoDaPagina[] | null>(chave ? null : []);
  useEffect(() => {
    if (!chave) { setLista([]); return; }
    let vivo = true;
    carregar(chave).then((l) => vivo && setLista(l));
    return () => { vivo = false; };
  }, [chave]);
  return lista;
}
