"use client";

// A transcrição ao lado do vídeo: acompanha o que está sendo dito, clicar numa fala leva o vídeo até ela,
// e a busca acha qualquer palavra e pula entre as ocorrências. Cada trecho pode ser copiado com o tempo
// ou citado nas anotações.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, LocateFixed, Search, TextQuote, X } from "lucide-react";
import { AvatarPessoa, Destaque, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { type Fala, buscarNaTranscricao, emTrechos, formatarTempo, temTempos } from "@/lib/transcricao";
import { cn } from "@/lib/utils";

function TranscricaoCrua({
  falas, ativa, aoIrPara, aoCitar, aoAvisar,
}: {
  falas: Fala[];
  /** Posição da fala que está sendo dita agora (-1 = nenhuma). */
  ativa: number;
  aoIrPara: (segundos: number) => void;
  /** Põe um trecho nas anotações (Markdown). */
  aoCitar?: (markdown: string) => void;
  aoAvisar: (texto: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [atual, setAtual] = useState(0);
  const [seguindo, setSeguindo] = useState(true);
  const lista = useRef<HTMLDivElement>(null);
  const comTempo = useMemo(() => temTempos(falas), [falas]);
  const trechos = useMemo(() => emTrechos(falas), [falas]);
  const achadas = useMemo(() => buscarNaTranscricao(falas, busca), [falas, busca]);
  const conjunto = useMemo(() => new Set(achadas), [achadas]);
  useEffect(() => setAtual(0), [busca]);

  const rolarAte = (indice: number, suave = true) =>
    lista.current?.querySelector<HTMLElement>(`[data-fala="${indice}"]`)?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });

  // acompanha o vídeo: a fala de agora fica no meio do painel
  useEffect(() => {
    if (seguindo && ativa >= 0 && !busca) rolarAte(ativa);
  }, [ativa, seguindo, busca]);

  // percorrer os resultados da busca
  const irParaResultado = (i: number) => {
    if (!achadas.length) return;
    const n = (i + achadas.length) % achadas.length;
    setAtual(n);
    setSeguindo(false);
    rolarAte(achadas[n]);
  };
  useEffect(() => {
    if (busca && achadas.length) rolarAte(achadas[0], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const textoDoTrecho = (t: (typeof trechos)[number]) => t.falas.map((i) => falas[i].texto).join(" ");
  const rotulo = (t: (typeof trechos)[number]) => `${t.inicio >= 0 ? `[${formatarTempo(t.inicio)}] ` : ""}${t.quem ? `${t.quem}: ` : ""}${textoDoTrecho(t)}`;

  return (
    <div data-slot="transcricao" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 px-3 pt-2.5 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input data-slot="busca-na-transcricao" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na transcrição" aria-label="Buscar na transcrição" className="h-8 pr-7 pl-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); irParaResultado(atual + (e.shiftKey ? -1 : 1)); }
              else if (e.key === "Escape" && busca) { e.stopPropagation(); setBusca(""); }
            }} />
          {busca && (
            <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")} className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {busca ? (
          <>
            <span data-slot="contagem-da-transcricao" className="shrink-0 px-1 text-[11px] text-muted-foreground tabular-nums sem-selecao">{achadas.length ? `${atual + 1} de ${achadas.length}` : "nada"}</span>
            <Dica texto="Anterior" atalho="Shift Enter"><Button variant="ghost" size="icon-sm" aria-label="Resultado anterior" disabled={!achadas.length} onClick={() => irParaResultado(atual - 1)}><ChevronUp /></Button></Dica>
            <Dica texto="Próximo" atalho="Enter"><Button variant="ghost" size="icon-sm" aria-label="Próximo resultado" disabled={!achadas.length} onClick={() => irParaResultado(atual + 1)}><ChevronDown /></Button></Dica>
          </>
        ) : comTempo ? (
          <Dica texto={seguindo ? "Acompanhando o vídeo. Clique para parar de rolar sozinho." : "Voltar a acompanhar o vídeo"}>
            <Button variant="ghost" size="icon-sm" aria-label="Acompanhar o vídeo" aria-pressed={seguindo} data-slot="acompanhar" onClick={() => { setSeguindo((v) => !v); if (!seguindo && ativa >= 0) rolarAte(ativa); }}>
              <LocateFixed className={cn(seguindo && "text-primary")} />
            </Button>
          </Dica>
        ) : null}
      </div>

      {!comTempo && (
        <p className="mx-3 mb-2 rounded-lg border border-alerta/30 bg-alerta/10 px-2.5 py-1.5 text-[11px] leading-snug">
          Esta transcrição não tem tempos, então não acompanha o vídeo. Dá para ler e buscar. Para sincronizar, envie um arquivo VTT ou SRT, ou um texto com o tempo no começo de cada fala.
        </p>
      )}

      <div ref={lista} className="min-h-0 flex-1 overflow-y-auto px-2 pb-6"
        // rolar à mão para de acompanhar; o botão de mira volta
        onWheel={() => seguindo && setSeguindo(false)} onTouchMove={() => seguindo && setSeguindo(false)}>
        {trechos.map((t) => {
          const temAtiva = ativa >= 0 && t.falas.includes(ativa);
          return (
            <div key={t.de} data-slot="trecho" data-ativo={temAtiva || undefined}
              className={cn("group/trecho relative rounded-lg px-2 py-1.5 transition-colors", temAtiva ? "bg-primary/[0.06]" : "hover:bg-accent/40")}>
              <div className="flex items-center gap-1.5 text-[11px] sem-selecao">
                {t.inicio >= 0 && (
                  <button type="button" data-slot="tempo-do-trecho" onClick={() => aoIrPara(t.inicio)}
                    className={cn("rounded px-1 font-medium tabular-nums outline-none hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-ring/40", temAtiva ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                    {formatarTempo(t.inicio)}
                  </button>
                )}
                {t.quem && <span className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground"><AvatarPessoa nome={t.quem} tamanho="sm" className="size-4 text-[8px]" /><span className="truncate">{t.quem}</span></span>}
                <span className="ml-auto flex shrink-0 opacity-0 transition-opacity group-focus-within/trecho:opacity-100 group-hover/trecho:opacity-100">
                  <Dica texto="Copiar este trecho com o tempo">
                    <Button variant="ghost" size="icon-sm" className="size-5" aria-label="Copiar o trecho" onClick={async () => { if (await copiarTexto(rotulo(t))) aoAvisar("Trecho copiado."); }}><Copy /></Button>
                  </Dica>
                  {aoCitar && (
                    <Dica texto="Citar nas anotações">
                      <Button variant="ghost" size="icon-sm" className="size-5" aria-label="Citar nas anotações" data-slot="citar-trecho"
                        onClick={() => aoCitar(`> ${t.inicio >= 0 ? `[${formatarTempo(t.inicio)}](nexo:tempo/${Math.round(t.inicio)}) ` : ""}${t.quem ? `**${t.quem}:** ` : ""}${textoDoTrecho(t)}`)}>
                        <TextQuote />
                      </Button>
                    </Dica>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed">
                {t.falas.map((i) => {
                  const f = falas[i];
                  const naBusca = conjunto.has(i);
                  return (
                    <span key={i} data-fala={i} data-agora={i === ativa || undefined} data-achada={naBusca || undefined} role={f.inicio >= 0 ? "button" : undefined} tabIndex={-1}
                      onClick={f.inicio >= 0 ? () => aoIrPara(f.inicio) : undefined}
                      className={cn(
                        "rounded-[3px] transition-colors",
                        f.inicio >= 0 && "cursor-pointer hover:bg-primary/10",
                        i === ativa && "bg-primary/18 text-foreground",
                        i !== ativa && ativa >= 0 && i < ativa && "text-muted-foreground",
                        naBusca && achadas[atual] === i && "outline outline-2 outline-alerta/70",
                      )}>
                      {naBusca ? <Destaque texto={f.texto} termo={busca} /> : f.texto}{" "}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Só redesenha quando muda a fala ativa (o tempo do vídeo anda várias vezes por segundo). */
export const Transcricao = memo(TranscricaoCrua);
