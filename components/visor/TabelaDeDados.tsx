"use client";

// A grade de uma planilha dentro do visor de arquivos (3.15): letras das colunas e números das linhas presos
// enquanto se rola, primeira linha como cabeçalho, busca que filtra as linhas e a célula escolhida mostrada
// inteira numa barra em cima (as células da grade são cortadas para a grade caber na tela).
//
// É uma <table> própria, e não a Table do kit: a do kit é um cartão para listas, com as bordas arredondadas e
// rolagem só para os lados; aqui a grade rola nos dois sentidos e tem cabeçalhos presos em cima e à esquerda.
// Tudo o que vem do arquivo é desenhado como texto pelo React.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, SearchX } from "lucide-react";
import { CampoBusca } from "@/components/busca/CampoBusca";
import { copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import { type Aba, abaComoTexto, letraDaColuna, linhasComOTexto } from "@/lib/planilha";
import { cn } from "@/lib/utils";

/** Quantas linhas entram de cada vez na tela (o resto chega conforme se rola). */
const LOTE = 200;

const ehNumero = (s: string) => /^-?\d[\d.,]*%?$/.test(s);

export function TabelaDeDados({ aba, className }: { aba: Aba; className?: string }) {
  const [busca, setBusca] = useState("");
  const [cabecalho, setCabecalho] = useState(true);
  const [limite, setLimite] = useState(LOTE);
  const [escolhida, setEscolhida] = useState<{ l: number; c: number } | null>(null);
  const [copiado, setCopiado] = useState("");
  const area = useRef<HTMLDivElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  // trocou de aba ou de busca: volta ao começo
  useEffect(() => {
    setLimite(LOTE);
    setEscolhida(null);
    area.current?.scrollTo({ top: 0, left: 0 });
  }, [aba, busca]);

  const comCabecalho = cabecalho && aba.linhas.length > 1;
  const achadas = useMemo(() => linhasComOTexto(aba, busca), [aba, busca]);
  // com cabeçalho, a primeira linha fica sempre à vista e não entra no filtro
  const indices = useMemo(() => {
    const todas = achadas ?? aba.linhas.map((_, i) => i);
    return comCabecalho ? todas.filter((i) => i !== 0) : todas;
  }, [achadas, aba.linhas, comCabecalho]);
  const visiveis = indices.slice(0, limite);

  // chegar perto do fim da grade traz mais um lote
  useEffect(() => {
    const el = fim.current;
    if (!el || limite >= indices.length) return;
    const olho = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setLimite((n) => n + LOTE); }, { root: area.current, rootMargin: "400px" });
    olho.observe(el);
    return () => olho.disconnect();
  }, [limite, indices.length]);

  const copiar = async (texto: string, o: string) => {
    if (!(await copiarTexto(texto))) return;
    setCopiado(o);
    setTimeout(() => setCopiado(""), 1600);
  };

  const valor = escolhida ? aba.linhas[escolhida.l]?.[escolhida.c] ?? "" : "";
  const colunas = Array.from({ length: aba.colunas }, (_, i) => i);
  const linha = (i: number, doCabecalho: boolean) => (
    <tr key={i} data-slot="linha-da-planilha" data-linha={i + 1} className={cn(!doCabecalho && "hover:bg-accent/40")}>
      <th scope="row" className={cn("sticky left-0 z-10 border-r border-b bg-muted px-2 text-right text-[11px] font-normal text-muted-foreground tabular-nums sem-selecao", doCabecalho && "top-7 z-30")}>{i + 1}</th>
      {colunas.map((c) => {
        const texto = aba.linhas[i][c] ?? "";
        const marcada = escolhida?.l === i && escolhida.c === c;
        return (
          <td key={c} data-slot="celula" data-ref={`${letraDaColuna(c)}${i + 1}`} onClick={() => setEscolhida({ l: i, c })}
            className={cn(
              "max-w-[22rem] cursor-default truncate border-r border-b px-2 py-1 whitespace-nowrap",
              doCabecalho && "sticky top-7 z-20 bg-muted font-semibold",
              !doCabecalho && ehNumero(texto) && "text-right tabular-nums",
              marcada && "bg-primary/12 outline-2 -outline-offset-2 outline-primary",
            )}>
            {texto}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div data-slot="tabela-de-dados" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Filtrar as linhas..." aria-label="Filtrar as linhas da planilha" className="w-64 max-w-full" />
        <CampoSwitch marcado={cabecalho} aoMudar={setCabecalho}>Primeira linha é o cabeçalho</CampoSwitch>
        <span data-slot="contagem-de-linhas" className="ml-auto text-xs text-muted-foreground tabular-nums sem-selecao">
          {achadas ? `${indices.length} de ${aba.linhas.length - (comCabecalho ? 1 : 0)} linhas` : `${aba.linhas.length} ${aba.linhas.length === 1 ? "linha" : "linhas"} · ${aba.colunas} ${aba.colunas === 1 ? "coluna" : "colunas"}`}
        </span>
        <Dica texto="Copia o que está filtrado, separado por tabulação: dá para colar no Excel">
          <Button variant="outline" size="sm" data-slot="copiar-tabela" onClick={() => void copiar(abaComoTexto(aba, comCabecalho ? [0, ...indices] : indices), "tudo")}>
            {copiado === "tudo" ? <Check /> : <Copy />} Copiar
          </Button>
        </Dica>
      </div>

      {/* a célula escolhida, inteira (na grade ela é cortada) */}
      <div data-slot="celula-escolhida" className="flex min-h-9 shrink-0 items-start gap-2 border-b bg-muted/40 px-4 py-1.5 text-[13px]">
        {escolhida ? (
          <>
            <span className="mt-px shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">{letraDaColuna(escolhida.c)}{escolhida.l + 1}</span>
            <span className="max-h-24 min-w-0 flex-1 overflow-y-auto texto-pre [overflow-wrap:anywhere]">{valor || <span className="text-muted-foreground">(vazia)</span>}</span>
            {valor && (
              <Dica texto="Copiar o conteúdo da célula">
                <Button variant="ghost" size="icon-sm" aria-label="Copiar o conteúdo da célula" onClick={() => void copiar(valor, "celula")}>{copiado === "celula" ? <Check /> : <Copy />}</Button>
              </Dica>
            )}
          </>
        ) : (
          <span className="py-0.5 text-xs text-muted-foreground">Clique numa célula para ver o conteúdo inteiro.</span>
        )}
      </div>

      <div ref={area} data-slot="grade" className="min-h-0 flex-1 overflow-auto bg-card">
        {aba.linhas.length === 0 ? (
          <p className="p-6 text-[13px] text-muted-foreground">Esta aba está vazia.</p>
        ) : (
          <table className="border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-40 h-7 w-12 min-w-12 border-r border-b bg-muted" />
                {colunas.map((c) => (
                  <th key={c} scope="col" className="sticky top-0 z-30 h-7 min-w-20 border-r border-b bg-muted px-2 text-center text-[11px] font-medium text-muted-foreground sem-selecao">{letraDaColuna(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comCabecalho && linha(0, true)}
              {visiveis.map((i) => linha(i, false))}
            </tbody>
          </table>
        )}
        {aba.linhas.length > 0 && indices.length === 0 && (
          <p className="flex items-center gap-2 p-6 text-[13px] text-muted-foreground"><SearchX className="size-4" /> Nenhuma linha com esse texto.</p>
        )}
        <div ref={fim} className="h-px" />
        {limite < indices.length && (
          <div className="sticky left-0 p-3">
            <Button variant="outline" size="sm" onClick={() => setLimite((n) => n + LOTE * 5)}>Mostrar mais {Math.min(LOTE * 5, indices.length - limite)} linhas</Button>
          </div>
        )}
      </div>
      {aba.cortada && (
        <p role="status" className="shrink-0 border-t bg-alerta/10 px-4 py-1.5 text-xs text-alerta">
          A planilha é maior do que o Nexo mostra aqui: parte das linhas ou das colunas ficou de fora. Para ver tudo, baixe o arquivo.
        </p>
      )}
    </div>
  );
}
