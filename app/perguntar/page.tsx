"use client";

// Perguntar ao Nexo: escreva uma pergunta, o app acha os trechos do histórico que têm a ver e monta o prompt
// para o Copilot responder só com eles, citando as fontes. A resposta colada volta com as citações clicáveis
// e pode virar uma página de conhecimento. As contas estão em lib/perguntar.ts.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, BookText, Check, ChevronDown, Copy, Eraser, Link2, ListTodo, type LucideIcon, MessageSquareText, NotebookPen, Save, Search, SearchX, Sparkles, User,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Pagina, Painel, PontoCor, Vazio, copiarTexto } from "@/components/comum";
import { TextoRico } from "@/components/tarefa/Texto";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Checkbox, Segmentado } from "@/components/ui/controles";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import {
  type Consulta, CONSULTA_VAZIA, TAMANHOS, type Tamanho, type TipoFonte, buscarFontes, citadasDaConsulta, fontesCitadas, ligarFontes, normalizarConsulta, paginaDaResposta, promptPergunta,
} from "@/lib/perguntar";
import { usePref } from "@/lib/preferencias";
import { agoraISO, formatarData, normalizarPagina, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ICONE: Record<TipoFonte, LucideIcon> = { registro: MessageSquareText, tarefa: ListTodo, pagina: BookText, nota: NotebookPen, link: Link2, pessoa: User };

const EXEMPLOS = ["O que ficou decidido sobre ", "O que está pendente com ", "Como funciona o processo de ", "Quem pode ajudar com ", "O que está travando "];

const OPCOES_TAMANHO: { valor: Tamanho; rotulo: string }[] = [
  { valor: "curto", rotulo: "Curto" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "longo", rotulo: "Longo" },
];

export default function Perguntar() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados, salvarPaginas, toast, estado } = useNexo();
  const router = useRouter();
  const pedida = useSearchParams().get("q");
  // O que foi digitado e colado fica no navegador: F5 ou trocar de tela não perdem a pergunta nem a resposta.
  const [bruta, setBruta] = usePref<unknown>("pergunta", CONSULTA_VAZIA);
  const c = useMemo(() => normalizarConsulta(bruta), [bruta]);
  const mudar = (parte: Partial<Consulta>) => setBruta((atual: unknown) => ({ ...normalizarConsulta(atual), ...parte }));
  const campo = useRef<HTMLTextAreaElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // /perguntar?q=... (vindo da busca): começa com a pergunta já escrita.
  useEffect(() => {
    if (!pedida) return;
    setBruta((atual: unknown) => ({ ...normalizarConsulta(atual), pergunta: pedida.slice(0, 2000) }));
    router.replace("/perguntar");
  }, [pedida, router, setBruta]);

  const pergunta = useDeferredValue(c.pergunta);
  const resultado = useMemo(
    () => (dados ? buscarFontes(pergunta, dados, { categoriaId: c.categoriaId || null, limite: TAMANHOS[c.tamanho] }) : { termos: [], fontes: [], deFora: 0 }),
    [dados, pergunta, c.categoriaId, c.tamanho],
  );
  const fora = useMemo(() => new Set(c.fora), [c.fora]);
  const escolhidas = useMemo(() => resultado.fontes.filter((f) => !fora.has(f.chave)), [resultado.fontes, fora]);
  const prompt = useMemo(() => (escolhidas.length ? promptPergunta(pergunta, escolhidas) : ""), [pergunta, escolhidas]);

  const citaveis = useMemo(() => (dados ? citadasDaConsulta(c, dados) : []), [c, dados]);
  const respostaLigada = useMemo(() => ligarFontes(c.resposta, citaveis), [c.resposta, citaveis]);
  const citadas = useMemo(() => {
    const rotulos = fontesCitadas(c.resposta);
    return citaveis.filter((f) => rotulos.includes(f.rotulo));
  }, [c.resposta, citaveis]);

  const categorias = (dados?.categorias.items ?? []).filter((x) => !x.arquivada || x.id === c.categoriaId);
  const temPergunta = !!c.pergunta.trim();
  const mudouDepoisDeCopiar = !!c.perguntaCopiada && c.perguntaCopiada.trim() !== c.pergunta.trim();

  const copiar = async () => {
    if (!prompt || !(await copiarTexto(prompt))) return;
    mudar({
      perguntaCopiada: c.pergunta,
      copiadas: escolhidas.map((f) => ({ rotulo: f.rotulo, chave: f.chave, titulo: f.titulo, contexto: f.contexto, data: f.data })),
    });
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
    toast("Prompt copiado. Cole no Copilot e traga a resposta de volta.");
  };

  const guardar = async () => {
    if (!c.resposta.trim() || salvando) return;
    setSalvando(true);
    const { titulo, texto } = paginaDaResposta(c.perguntaCopiada || c.pergunta, c.resposta, citaveis);
    const id = novoId("pg");
    const agora = agoraISO();
    const ok = await salvarPaginas((items) => [normalizarPagina({ id, titulo, texto, categoriaId: c.categoriaId || null, criadaEm: agora, atualizadaEm: agora }), ...items]);
    setSalvando(false);
    if (!ok) return;
    setBruta({ ...CONSULTA_VAZIA, tamanho: c.tamanho });
    toast("Resposta guardada como página de conhecimento.");
    router.push(`/paginas?p=${id}`);
  };

  return (
    <Pagina titulo="Perguntar ao Nexo" descricao="A resposta sai do seu histórico, pelo Copilot, com as fontes citadas." estreita>
      <div data-slot="perguntar" className="flex flex-col gap-4">
        {/* 1. a pergunta */}
        <Painel titulo="1. O que você quer saber?" icone={<Search />}
          acoes={(temPergunta || c.resposta) && (
            <Dica texto="Limpar a pergunta e a resposta">
              <Button variant="ghost" size="icon-sm" aria-label="Limpar e perguntar outra coisa" onClick={() => { setBruta({ ...CONSULTA_VAZIA, tamanho: c.tamanho, categoriaId: c.categoriaId }); campo.current?.focus(); }}><Eraser /></Button>
            </Dica>
          )}>
          <Textarea
            ref={campo}
            data-slot="pergunta"
            autoFocus
            value={c.pergunta}
            onChange={(e) => mudar({ pergunta: e.target.value })}
            maxLength={2000}
            rows={2}
            placeholder="Ex.: O que ficou decidido sobre o gate de bloqueio no squad de Pagamentos?"
            aria-label="Sua pergunta"
            className="min-h-14 text-sm"
          />
          {!temPergunta && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXEMPLOS.map((e) => (
                <Button key={e} variant="outline" size="sm" className="font-normal text-muted-foreground"
                  onClick={() => { mudar({ pergunta: e }); requestAnimationFrame(() => { campo.current?.focus(); campo.current?.setSelectionRange(e.length, e.length); }); }}>
                  {e.trim()}...
                </Button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground sem-selecao">
              Procurar em
              <Combobox
                valor={c.categoriaId}
                aoMudar={(v) => mudar({ categoriaId: v })}
                opcoes={categorias.map((x) => ({ valor: x.id, rotulo: x.nome, render: <><PontoCor cor={x.cor} /><span className="truncate">{x.nome}</span></> }))}
                placeholder="Tudo" rotuloLimpar="Tudo" aria-label="Procurar em qual categoria" className="h-8 w-52"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground sem-selecao">
              Tamanho do prompt
              <Dica texto="Quanto texto das fontes vai para o Copilot. Se ele reclamar do tamanho, use Curto.">
                <span><Segmentado aria-label="Tamanho do prompt" tamanho="sm" valor={c.tamanho} aoMudar={(v) => mudar({ tamanho: v })} opcoes={OPCOES_TAMANHO} /></span>
              </Dica>
            </div>
          </div>
        </Painel>

        {/* 2. as fontes */}
        {temPergunta && (
          <Painel
            titulo="2. Trechos que têm a ver"
            icone={<Sparkles />}
            contagem={resultado.fontes.length}
            corpoClassName="p-0"
            acoes={
              <Button data-slot="copiar-prompt-pergunta" size="sm" disabled={!prompt} onClick={copiar}>
                {copiado ? <Check /> : <Copy />} {copiado ? "Copiado" : "Copiar prompt"}
              </Button>
            }
          >
            {resultado.fontes.length === 0 ? (
              <Vazio compacto titulo={resultado.termos.length ? "Não achei nada sobre isso" : "Escreva um pouco mais"} icone={<SearchX />} className="m-3.5 border-0">
                <p>
                  {resultado.termos.length
                    ? `Nenhum registro, página ou pessoa tem as palavras ${resultado.termos.map((t) => `"${t}"`).join(", ")}${c.categoriaId ? " nesta categoria" : ""}. Tente outras palavras, como o nome da ferramenta, do squad ou da pessoa.`
                    : "A pergunta precisa de pelo menos uma palavra que identifique o assunto."}
                </p>
              </Vazio>
            ) : (
              <>
                <ul className="divide-y">
                  {resultado.fontes.map((f) => {
                    const Icone = ICONE[f.tipo];
                    const dentro = !fora.has(f.chave);
                    return (
                      <li key={f.chave} data-slot="fonte" data-chave={f.chave} data-rotulo={f.rotulo} data-fora={!dentro || undefined}
                        className={cn("flex items-start gap-2.5 px-3.5 py-2.5 transition-opacity", !dentro && "opacity-50")}>
                        <Checkbox checked={dentro} className="mt-0.5" aria-label={dentro ? `Tirar ${f.rotulo} do prompt` : `Pôr ${f.rotulo} no prompt`}
                          onCheckedChange={(v) => mudar({ fora: v === true ? c.fora.filter((k) => k !== f.chave) : [...c.fora, f.chave] })} />
                        <span className="mt-px inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1 text-[11px] font-semibold tabular-nums text-primary sem-selecao">{f.rotulo}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[13px] leading-snug font-medium">
                            <Icone className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.titulo}</span>
                            {f.data && <span className="shrink-0 text-[11px] font-normal text-muted-foreground tabular-nums">{formatarData(f.data)}</span>}
                          </div>
                          {f.contexto && <div className="truncate text-[11px] text-muted-foreground">{f.contexto}</div>}
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground texto-pre">{f.trecho.replace(/\n+/g, " · ")}</p>
                        </div>
                        <Dica texto="Abrir a fonte">
                          <Button asChild variant="ghost" size="icon-sm" className="shrink-0">
                            <Link href={f.rota} aria-label={`Abrir ${f.titulo}`}><ArrowUpRight /></Link>
                          </Button>
                        </Dica>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3.5 py-2 text-[11px] text-muted-foreground sem-selecao">
                  <span data-slot="resumo-fontes">
                    {escolhidas.length} de {resultado.fontes.length} no prompt · cerca de {Math.max(1, Math.round(prompt.length / 1000))} mil caracteres
                  </span>
                  {resultado.deFora > 0 && <span className="text-alerta">{resultado.deFora} ficaram de fora por tamanho. Use um tamanho maior ou escolha uma categoria.</span>}
                  <Collapsible className="w-full">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" disabled={!prompt}><ChevronDown /> Ver o prompt</Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre data-slot="prompt-pergunta" className="mt-1 max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">{prompt}</pre>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </>
            )}
          </Painel>
        )}

        {/* 3. a resposta */}
        {(c.copiadas.length > 0 || c.resposta) && (
          <Painel titulo="3. Cole a resposta do Copilot" icone={<MessageSquareText />}
            acoes={c.resposta.trim() && (
              <Dica texto={estado?.somenteLeitura ? "O app está em somente leitura" : "Vira uma página de conhecimento, com as fontes ligadas"}>
                <Button data-slot="guardar-resposta" size="sm" variant="outline" disabled={salvando || !!estado?.somenteLeitura} onClick={guardar}><Save /> Guardar como página</Button>
              </Dica>
            )}>
            {mudouDepoisDeCopiar && (
              <p role="status" className="mb-2 rounded-lg border border-alerta/30 bg-alerta/10 px-3 py-2 text-xs leading-snug">
                A pergunta mudou depois que o prompt foi copiado. A resposta abaixo vale para: “{c.perguntaCopiada.trim()}”. Para a pergunta nova, copie o prompt de novo.
              </p>
            )}
            <Textarea
              data-slot="resposta-colada"
              value={c.resposta}
              onChange={(e) => mudar({ resposta: e.target.value })}
              maxLength={100000}
              rows={c.resposta ? 3 : 4}
              placeholder="Cole aqui o que o Copilot respondeu. As citações [F1], [F2] viram links para as fontes."
              aria-label="Resposta do Copilot"
              className="text-[13px]"
            />
            {c.resposta.trim() && (
              <div className="mt-3">
                <div data-slot="resposta" className="rounded-lg border bg-background/60 px-4 py-3">
                  <TextoRico texto={respostaLigada} className="text-sm leading-relaxed" />
                </div>
                {citadas.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao">Fontes citadas</h4>
                    <ul className="flex flex-col gap-1">
                      {citadas.map((f) => {
                        const Icone = ICONE[f.tipo];
                        const dentro = (
                          <>
                            <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1 text-[11px] font-semibold tabular-nums text-primary">{f.rotulo}</span>
                            <Icone className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.titulo}</span>
                            {f.data && <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatarData(f.data)}</span>}
                            {f.contexto && <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:inline">{f.contexto}</span>}
                          </>
                        );
                        return (
                          <li key={f.rotulo} data-slot="citada">
                            {f.rota ? (
                              <Link href={f.rota} className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40">{dentro}</Link>
                            ) : (
                              <div className="flex items-center gap-2 py-1 text-[13px] text-muted-foreground">{dentro}<span className="shrink-0 text-[11px]">(não existe mais)</span></div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-snug text-muted-foreground">
                    A resposta não cita nenhuma fonte ([F1], [F2]...). Confira com cuidado: sem citação, não dá para saber de onde veio cada afirmação.
                  </p>
                )}
              </div>
            )}
          </Painel>
        )}

        {!temPergunta && !c.resposta && (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Como funciona: o Nexo procura a pergunta em tudo o que está guardado (registros, tarefas, páginas, folhas, links e pessoas), separa os trechos que mais têm a ver e monta um prompt que manda o Copilot responder só com eles.
            Nada sai do seu computador a não ser o que você mesmo colar no Copilot.
          </p>
        )}
      </div>
    </Pagina>
  );
}
