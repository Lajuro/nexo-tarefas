"use client";

// Histórico de versões de uma página: o que ela era antes de cada sessão de edição. Dá para ler qualquer
// versão e restaurar (o texto de agora vira mais uma versão, então restaurar também tem volta).

import { useEffect, useState } from "react";
import { History, LoaderCircle, RotateCcw } from "lucide-react";
import { Modal } from "@/components/comum";
import { TextoRico } from "@/components/tarefa/Texto";
import { Button } from "@/components/ui/button";
import { formatarDataHora } from "@/lib/tipos";
import { cn } from "@/lib/utils";

interface Versao { versao: string; titulo: string; palavras: number; guardadaEm: string }
interface Conteudo { versao: string; titulo: string; texto: string }

async function pedir<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.erro) throw new Error(j.erro || `Erro ${r.status}`);
  return j as T;
}

export function Historico({ paginaId, aberto, fechar, aoRestaurar }: { paginaId: string; aberto: boolean; fechar: () => void; aoRestaurar: (titulo: string, texto: string) => void }) {
  const [versoes, setVersoes] = useState<Versao[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState<Conteudo | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setVersoes(null); setEscolhida(null); setConteudo(null); setErro("");
    let vivo = true;
    pedir<{ versoes: Versao[] }>(`/api/paginas/historico?id=${encodeURIComponent(paginaId)}`)
      .then((r) => { if (vivo) { setVersoes(r.versoes); setEscolhida(r.versoes[0]?.versao ?? null); } })
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [aberto, paginaId]);

  useEffect(() => {
    if (!aberto || !escolhida) return;
    setConteudo(null);
    let vivo = true;
    pedir<{ versao: Conteudo }>(`/api/paginas/historico?id=${encodeURIComponent(paginaId)}&v=${encodeURIComponent(escolhida)}`)
      .then((r) => vivo && setConteudo(r.versao))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, [aberto, escolhida, paginaId]);

  return (
    <Modal
      titulo="Histórico de versões"
      descricao="Como a página estava antes de cada sessão de edição. As 40 versões mais recentes ficam guardadas na pasta de dados."
      aberto={aberto}
      fechar={fechar}
      largo
      rodape={
        <>
          <Button variant="outline" onClick={fechar}>Fechar</Button>
          <Button data-slot="restaurar-versao" disabled={!conteudo} onClick={() => { if (conteudo) { aoRestaurar(conteudo.titulo, conteudo.texto); fechar(); } }}>
            <RotateCcw /> Restaurar esta versão
          </Button>
        </>
      }
    >
      {erro ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">{erro}</p>
      ) : !versoes ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Lendo o histórico...</p>
      ) : versoes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-[13px] text-muted-foreground">
          <History className="size-6" />
          <p className="max-w-[46ch]">Ainda não há versões guardadas. A primeira aparece quando você mudar um texto que já existia: o Nexo guarda como ele estava antes.</p>
        </div>
      ) : (
        <div data-slot="historico-de-versoes" className="grid min-h-[50vh] gap-4 md:grid-cols-[220px_1fr]">
          <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
            {versoes.map((v) => (
              <li key={v.versao}>
                <button type="button" data-slot="versao" data-ativa={v.versao === escolhida || undefined} onClick={() => setEscolhida(v.versao)}
                  className={cn("w-full rounded-lg px-2.5 py-2 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40", v.versao === escolhida && "bg-accent")}>
                  <span className="block text-[13px] font-medium tabular-nums">{formatarDataHora(v.guardadaEm)}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{v.palavras} {v.palavras === 1 ? "palavra" : "palavras"}{v.titulo ? ` · ${v.titulo}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="max-h-[60vh] min-w-0 overflow-y-auto rounded-xl border bg-card px-4 py-3">
            {!conteudo ? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Abrindo a versão...</p>
            ) : (
              <>
                <h3 data-slot="titulo-da-versao" className="mb-2 text-base font-semibold tracking-tight">{conteudo.titulo || "Página sem título"}</h3>
                <TextoRico texto={conteudo.texto} className="text-sm" />
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
