"use client";

// Páginas de conhecimento como documentação: explorador em árvore à esquerda, páginas abertas em abas,
// sumário à direita, e as visões Quadro (por estado) e Lista. O que é organização (árvore, ícone, estado,
// favorita) é dado da página; o que é jeito de trabalhar (abas abertas, o que está recolhido) fica no navegador.

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BookText, Clapperboard, Columns3, FileText, PanelLeft, Plus, Rows3 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Pagina, Vazio } from "@/components/comum";
import { Abas } from "@/components/paginas/Abas";
import { EditorPagina, type ModoDaPagina } from "@/components/paginas/EditorPagina";
import { Explorador } from "@/components/paginas/Explorador";
import { ListaPaginas } from "@/components/paginas/ListaPaginas";
import { QuadroPaginas } from "@/components/paginas/QuadroPaginas";
import { IconePagina, useAcoesDePagina } from "@/components/paginas/pecas";
import { GaleriaDeVideos } from "@/components/paginas/video/GaleriaDeVideos";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import { MODELOS_DE_PAGINA, caminhoDaPagina } from "@/lib/paginas";
import { usePref } from "@/lib/preferencias";

type Visao = "docs" | "quadro" | "lista" | "videos";
const VISOES: Visao[] = ["docs", "quadro", "lista", "videos"];
const MAX_ABAS = 12;

/** Jeito de trabalhar nesta tela. Fica no navegador; tudo é conferido ao ler. */
interface AreaDePaginas {
  visao: Visao;
  abas: string[];
  ativa: string | null;
  recolhidas: string[];
  painel: boolean;
  explorador: boolean;
  modo: ModoDaPagina;
}
const AREA_PADRAO: AreaDePaginas = { visao: "docs", abas: [], ativa: null, recolhidas: [], painel: true, explorador: true, modo: "editar" };
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
function normalizarArea(x: unknown): AreaDePaginas {
  if (!x || typeof x !== "object" || Array.isArray(x)) return AREA_PADRAO;
  const a = x as Partial<Record<keyof AreaDePaginas, unknown>>;
  const ids = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((i): i is string => typeof i === "string" && ID.test(i)))].slice(0, max) : []);
  const abas = ids(a.abas, MAX_ABAS);
  return {
    visao: VISOES.includes(a.visao as Visao) ? (a.visao as Visao) : "docs",
    abas,
    ativa: typeof a.ativa === "string" && abas.includes(a.ativa) ? a.ativa : abas[0] ?? null,
    recolhidas: ids(a.recolhidas, 500),
    painel: a.painel !== false,
    explorador: a.explorador !== false,
    modo: a.modo === "ler" ? "ler" : "editar",
  };
}

export default function Paginas() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const router = useRouter();
  const params = useSearchParams();
  const pedida = params.get("p");
  const catPedida = params.get("cat");
  const acoes = useAcoesDePagina();
  const [bruta, setBruta] = usePref<unknown>("paginasArea", AREA_PADRAO);
  const area = useMemo(() => normalizarArea(bruta), [bruta]);
  const mudarArea = useCallback((fn: (a: AreaDePaginas) => Partial<AreaDePaginas>) => setBruta((atual: unknown) => { const a = normalizarArea(atual); return { ...a, ...fn(a) }; }), [setBruta]);
  const [irPara, setIrPara] = useState<{ id: string; titulo?: number; tempo?: number; vez: number } | null>(null);
  const tempoPedido = params.get("t");

  const paginas = useMemo(() => dados?.paginas?.items ?? [], [dados?.paginas]);
  const porId = useMemo(() => new Map(paginas.map((p) => [p.id, p])), [paginas]);
  // abas de páginas que não existem mais somem sozinhas
  const abertas = useMemo(() => area.abas.map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => !!p), [area.abas, porId]);
  const ativa = (area.ativa && porId.get(area.ativa)) || abertas[0] || null;

  const abrir = useCallback((id: string, titulo?: number, tempo?: number) => {
    mudarArea((a) => {
      const abas = a.abas.includes(id) ? a.abas : [...a.abas, id];
      // passou do limite: sai a aba mais antiga que não é a que está sendo aberta
      while (abas.length > MAX_ABAS) abas.splice(abas.findIndex((x) => x !== id), 1);
      return { visao: "docs", abas, ativa: id };
    });
    if (titulo !== undefined || tempo !== undefined) setIrPara((v) => ({ id, titulo, tempo, vez: (v?.vez ?? 0) + 1 }));
  }, [mudarArea]);

  const fechar = useCallback((id: string) => mudarArea((a) => {
    const i = a.abas.indexOf(id);
    if (i < 0) return {};
    const abas = a.abas.filter((x) => x !== id);
    return { abas, ativa: a.ativa === id ? abas[Math.min(i, abas.length - 1)] ?? null : a.ativa };
  }), [mudarArea]);

  const nova = useCallback(async (modeloId = "branco", parte: { paiId?: string | null; categoriaId?: string | null } = {}) => {
    const id = await acoes.criar(parte, modeloId);
    if (id) abrir(id);
  }, [acoes, abrir]);

  // abrir uma página mostra o caminho até ela na árvore
  useEffect(() => {
    if (!ativa) return;
    const acima = caminhoDaPagina(paginas.filter((p) => !p.arquivadaEm), ativa.id).map((p) => p.id);
    if (acima.some((id) => area.recolhidas.includes(id))) mudarArea((a) => ({ recolhidas: a.recolhidas.filter((id) => !acima.includes(id)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa?.id]);

  // /paginas?p=<id> (link interno, busca, paleta): abre a página. ?cat=<id> começa uma página nova naquele assunto.
  useEffect(() => {
    if (!dados) return;
    if (pedida) {
      // &t=<segundos>: abre a página de vídeo já naquele instante
      const t = Number(tempoPedido);
      if (porId.has(pedida)) abrir(pedida, undefined, tempoPedido !== null && Number.isFinite(t) && t >= 0 ? t : undefined);
      router.replace("/paginas");
    } else if (catPedida) {
      router.replace("/paginas");
      void nova("branco", { categoriaId: catPedida });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, catPedida, !!dados]);

  // Alt+seta: página anterior ou próxima entre as abas, como num editor de código
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || area.visao !== "docs" || abertas.length < 2 || !ativa) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      const i = abertas.findIndex((p) => p.id === ativa.id);
      abrir(abertas[(i + (e.key === "ArrowRight" ? 1 : -1) + abertas.length) % abertas.length].id);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abertas, ativa, area.visao, abrir]);

  if (!dados) return <Pagina titulo="Páginas"><span /></Pagina>;

  return (
    <Pagina
      semRolagem
      titulo="Páginas"
      descricao="A documentação do seu trabalho: processos, guias e o que vale não esquecer."
      acoes={
        <>
          <Segmentado aria-label="Como ver as páginas" valor={area.visao} aoMudar={(visao) => mudarArea(() => ({ visao }))}
            opcoes={[
              { valor: "docs", rotulo: "Documentos", icone: <FileText /> },
              { valor: "quadro", rotulo: "Quadro", icone: <Columns3 /> },
              { valor: "lista", rotulo: "Lista", icone: <Rows3 /> },
              { valor: "videos", rotulo: "Vídeos", icone: <Clapperboard /> },
            ]} />
          <Button data-slot="nova-pagina-topo" onClick={() => nova()}><Plus /> Nova página</Button>
        </>
      }
    >
      {area.visao === "quadro" ? (
        <QuadroPaginas paginas={paginas} categorias={dados.categorias.items} acoes={acoes} aoAbrir={abrir} />
      ) : area.visao === "lista" ? (
        <ListaPaginas paginas={paginas} categorias={dados.categorias.items} acoes={acoes} aoAbrir={abrir} />
      ) : area.visao === "videos" ? (
        <GaleriaDeVideos paginas={paginas} categorias={dados.categorias.items} acoes={acoes} aoAbrir={abrir} aoNova={() => nova("video")} />
      ) : (
        <div data-slot="area-de-paginas" className="flex h-full min-h-0">
          {area.explorador && (
            <Explorador
              paginas={paginas}
              ativaId={ativa?.id ?? null}
              recolhidas={area.recolhidas}
              acoes={acoes}
              aoAbrir={abrir}
              aoAlternar={(id) => mudarArea((a) => ({ recolhidas: a.recolhidas.includes(id) ? a.recolhidas.filter((x) => x !== id) : [...a.recolhidas, id] }))}
              aoRecolherTudo={(ids) => mudarArea(() => ({ recolhidas: ids }))}
              aoFechar={fechar}
              aoNova={(modeloId) => nova(modeloId)}
            />
          )}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-end border-b bg-muted/40">
              <Dica texto={area.explorador ? "Esconder a árvore de páginas" : "Mostrar a árvore de páginas"}>
                <Button variant="ghost" size="icon-sm" className="mx-1 mb-1 shrink-0" aria-label="Árvore de páginas" aria-pressed={area.explorador} data-slot="alternar-explorador"
                  onClick={() => mudarArea((a) => ({ explorador: !a.explorador }))}>
                  <PanelLeft className={area.explorador ? "text-primary" : undefined} />
                </Button>
              </Dica>
              <div className="min-w-0 flex-1 [&>[data-slot=abas-de-paginas]]:border-b-0 [&>[data-slot=abas-de-paginas]]:bg-transparent">
                <Abas abertas={abertas} ativaId={ativa?.id ?? null} aoAtivar={(id) => abrir(id)} aoFechar={fechar}
                  aoFecharOutras={(id) => mudarArea(() => ({ abas: [id], ativa: id }))} aoNova={() => nova()} />
                {abertas.length === 0 && <div className="h-9" />}
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {ativa ? (
                <EditorPagina
                  key={ativa.id}
                  pagina={ativa}
                  paginas={paginas}
                  modo={area.modo}
                  aoMudarModo={(modo) => mudarArea(() => ({ modo }))}
                  painel={area.painel}
                  aoAlternarPainel={() => mudarArea((a) => ({ painel: !a.painel }))}
                  acoes={acoes}
                  aoAbrir={abrir}
                  aoFechar={() => fechar(ativa.id)}
                  irPara={irPara && irPara.id === ativa.id ? irPara : null}
                />
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <Vazio titulo={paginas.length ? "Escolha uma página na árvore" : "Sua documentação começa aqui"} icone={<BookText />}>
                    <p className="max-w-[56ch]">
                      Uma página é para o que você explicaria de novo daqui a três meses: como funciona um processo, o passo a passo de um pedido, quem resolve o quê.
                      Páginas ficam dentro de páginas, e em qualquer texto <strong>[[</strong> liga a outra página e <strong>@</strong> cita uma tarefa ou pessoa.
                    </p>
                    <div className="mt-3 grid w-full max-w-[560px] gap-2 sm:grid-cols-2">
                      {MODELOS_DE_PAGINA.slice(0, 6).map((m) => (
                        <button key={m.id} type="button" data-slot="modelo-de-pagina" data-modelo={m.id} onClick={() => nova(m.id)}
                          className="flex items-start gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left shadow-xs transition-[border-color,box-shadow] outline-none hover:border-ring/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/35">
                          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><IconePagina pagina={{ icone: m.icone }} /></span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-foreground">{m.nome}</span>
                            <span className="block text-[11px] leading-snug text-muted-foreground">{m.descricao}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </Vazio>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Pagina>
  );
}
