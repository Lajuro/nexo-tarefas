"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownNarrowWide, ArrowLeft, ArrowUpNarrowWide, Check, ChevronDown, History, Pencil, Plus, SearchX, Sparkles, Target, WandSparkles } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { BotaoMenuTarefa, useAcoesTarefa } from "@/components/MenuTarefa";
import { TarefaForm } from "@/components/TarefaForm";
import { RegistroEditor } from "@/components/RegistroEditor";
import { PromptModal } from "@/components/PromptModal";
import { LinkForm } from "@/components/LinkForm";
import { Contador, IconeTipo, Pagina, Vazio } from "@/components/comum";
import { SeloCopilot } from "@/components/tarefa/Copilot";
import { Lateral } from "@/components/tarefa/Lateral";
import { Propriedades } from "@/components/tarefa/Propriedades";
import { FaixaEspera } from "@/components/Esperando";
import { ItensNovoRegistro, Timeline } from "@/components/tarefa/Timeline";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { ehFocoHoje, semRegistro } from "@/lib/acoes";
import { aberta } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { promptPanorama, promptPrepararReuniao } from "@/lib/prompts";
import { Rascunho, apagarRascunho, listarRascunhos } from "@/lib/rascunhos";
import { Registro, TipoRegistro, agoraISO, formatarData, formatarDataHora, ordenarRegistros, tipoInfo } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// Filtro rápido da linha do tempo. "Atividades" junta tudo que não é reunião nem marco
// (atividade, impedimento, decisão e nota), para nenhum registro ficar sem lugar.
type Filtro = "tudo" | "reuniao" | "atividade" | "marco";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "tudo", rotulo: "Tudo" },
  { valor: "reuniao", rotulo: "Reuniões" },
  { valor: "atividade", rotulo: "Atividades" },
  { valor: "marco", rotulo: "Marcos" },
];
const noFiltro = (r: Registro, f: Filtro) =>
  f === "tudo" || (f === "reuniao" ? r.tipo === "reuniao" : f === "marco" ? r.tipo === "marco" : r.tipo !== "reuniao" && r.tipo !== "marco");

/** Título que mostra a dica com o texto inteiro só quando não coube no cabeçalho. */
function TituloTarefa({ texto }: { texto: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cortado, setCortado] = useState(false);
  useEffect(() => {
    const h1 = ref.current?.parentElement;
    if (!h1) return;
    const medir = () => setCortado(h1.scrollWidth > h1.clientWidth + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(h1);
    return () => ro.disconnect();
  }, [texto]);
  return (
    <Dica texto={cortado ? texto : ""} side="bottom" align="start">
      <span ref={ref}>{texto}</span>
    </Dica>
  );
}

export default function PaginaTarefa() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const registroPedido = useSearchParams().get("r");
  const { dados, atualizarTarefa, toast } = useNexo();
  const acoes = useAcoesTarefa();
  const confirmar = useConfirmar();

  const [editando, setEditando] = useState(false);
  const [editor, setEditor] = useState<{ aberto: boolean; registro?: Registro | null; tipo?: TipoRegistro }>({ aberto: false });
  const [prompt, setPrompt] = useState<null | "panorama" | "reuniao">(null);
  const [linkForm, setLinkForm] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [destaque, setDestaque] = useState<string | null>(null);
  // Versões antigas gravaram "1"/"0" nesta chave; Boolean(Number()) entende os dois formatos.
  const [prefRecentes, setPrefRecentes] = usePref<boolean>("recentesPrimeiro", false);
  const recentes = Boolean(Number(prefRecentes));

  // Rascunhos de registro que ficaram sem salvar (editor fechado, F5, janela fechada, travamento).
  // Relê sempre que o editor fecha.
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  useEffect(() => {
    if (!editor.aberto) setRascunhos(listarRascunhos(id));
  }, [editor.aberto, id]);

  const tarefa = dados?.tarefas.find((t) => t.id === id);
  const cat = dados?.categorias.items.find((c) => c.id === tarefa?.categoriaId);
  const links = useMemo(() => (dados?.links.items ?? []).filter((l) => l.tarefaId === id), [dados?.links.items, id]);

  // Leva a linha do tempo até um registro e acende o card por um instante.
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const irPara = useCallback((registroId: string, bloco: ScrollLogicalPosition = "center") => {
    setFiltro("tudo");
    setDestaque(registroId);
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => setDestaque(null), 2200);
    // Espera o card existir na tela (filtro trocado, registro recém-criado).
    setTimeout(() => document.getElementById(`reg-${registroId}`)?.scrollIntoView({ behavior: "smooth", block: bloco }), 60);
  }, []);
  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);

  // Quando nasce um registro (salvo no editor, ou o marco de uma troca de status), mostra onde ele entrou.
  const conhecidos = useRef<{ tarefa: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!tarefa) return;
    const ids = new Set(tarefa.registros.map((r) => r.id));
    const antes = conhecidos.current;
    conhecidos.current = { tarefa: tarefa.id, ids };
    if (!antes || antes.tarefa !== tarefa.id) return;
    const novos = tarefa.registros.filter((r) => !antes.ids.has(r.id));
    if (!novos.length) return;
    irPara((novos.find((r) => r.tipo !== "marco") ?? novos[novos.length - 1]).id, "nearest");
  }, [tarefa, irPara]);

  // /tarefas/<id>?r=<registro> (resultado da busca): rola até o registro, acende o card e limpa o endereço.
  useEffect(() => {
    if (!registroPedido || !tarefa) return;
    if (tarefa.registros.some((r) => r.id === registroPedido)) irPara(registroPedido);
    router.replace(`/tarefas/${id}`);
  }, [registroPedido, tarefa, irPara, router, id]);

  if (!tarefa) {
    return (
      <Pagina titulo="Tarefa não encontrada" voltar={{ href: "/tarefas", rotulo: "Tarefas" }} estreita>
        <Vazio titulo="Não achei esta tarefa" icone={<SearchX />}>
          <p>Ela pode ter sido movida para a lixeira (dá para restaurar em Configurações) ou o endereço está errado.</p>
          <Button asChild>
            <Link href="/tarefas"><ArrowLeft /> Voltar para as tarefas</Link>
          </Button>
        </Vazio>
      </Pagina>
    );
  }

  const ehAberta = aberta(tarefa);
  const foco = ehFocoHoje(tarefa);
  const ordenados = ordenarRegistros(tarefa.registros, recentes);
  const visiveis = ordenados.filter((r) => noFiltro(r, filtro));

  const registrar = (tipo: TipoRegistro) => setEditor({ aberto: true, tipo });

  const remover = async (r: Registro) => {
    const oQue = `${tipoInfo(r.tipo).nome} de ${formatarData(r.data)}${r.titulo ? `: “${r.titulo}”` : ""}`;
    const ok = await confirmar({
      titulo: "Remover este registro da linha do tempo?",
      descricao: `${oQue}. Ele sai da linha do tempo, mas continua guardado dentro do arquivo da tarefa.`,
      confirmar: "Remover",
      perigo: true,
    });
    if (ok && (await atualizarTarefa(tarefa.id, (t) => semRegistro(t, r.id)))) toast("Registro removido da linha do tempo.", "info");
  };

  return (
    <>
      <Pagina
        semRolagem
        className="@container"
        voltar={{ href: "/tarefas", rotulo: "Tarefas" }}
        titulo={<TituloTarefa texto={tarefa.titulo} />}
        acoes={
          <>
            {ehAberta && (
              <Dica texto={foco ? "Está no foco de hoje. Clique para tirar." : "Colocar no foco de hoje"}>
                <Button
                  variant="outline"
                  data-slot="foco"
                  data-ativo={foco || undefined}
                  aria-pressed={foco}
                  onClick={() => acoes.alternarFoco(tarefa)}
                  className={cn(foco && "border-primary/45 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/20 dark:text-foreground dark:hover:bg-primary/25")}
                >
                  <Target /> Focar hoje {foco && <Check className="size-3.5" strokeWidth={2.6} />}
                </Button>
              </Dica>
            )}
            <Button variant="outline" onClick={() => setEditando(true)}><Pencil /> Editar</Button>
            <BotaoMenuTarefa tarefa={tarefa} semAbrir aoExcluir={() => router.push("/tarefas")} />
          </>
        }
        barra={
          <>
            <Propriedades tarefa={tarefa} cat={cat} />
            {/* fica no cabeçalho fixo: enquanto a tarefa espera alguém, isso é o que mais importa nela */}
            <FaixaEspera tarefa={tarefa} className="w-full" />
          </>
        }
      >
        <div className="mx-auto h-full w-full max-w-[1360px] overflow-y-auto @5xl:flex @5xl:overflow-hidden">
          {/* Coluna principal: descrição, Copilot e a linha do tempo */}
          {/* Sem padding em cima no contêiner que rola: senão a barra fixa da timeline para abaixo da borda e o conteúdo aparece por trás. */}
          <div data-slot="tarefa-principal" className="min-w-0 px-6 pb-6 @5xl:flex-1 @5xl:overflow-y-auto @5xl:pb-12">
            <div aria-hidden className="h-5" />
            {tarefa.descricao && (
              <p data-slot="tarefa-descricao" className="mb-4 max-w-[78ch] text-sm leading-relaxed text-muted-foreground texto-pre">{tarefa.descricao}</p>
            )}

            <section data-slot="copilot" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/20 bg-primary/[0.035] px-3.5 py-2.5 dark:bg-primary/[0.07]">
              <SeloCopilot />
              <div className="min-w-0 flex-1 basis-56 sem-selecao">
                <h2 className="text-[13px] leading-tight font-semibold tracking-tight">Copilot</h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Prompts prontos com o histórico desta tarefa, para copiar e colar.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPrompt("panorama")}><Sparkles className="text-primary" /> Panorama da tarefa</Button>
                <Button variant="outline" size="sm" onClick={() => setPrompt("reuniao")}><WandSparkles className="text-primary" /> Preparar próxima reunião</Button>
              </div>
            </section>

            <div className="mt-6 flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight">Linha do tempo</h2>
              <Contador n={tarefa.registros.length} />
              <Dica texto="Inverter a ordem da linha do tempo">
                <Button variant="ghost" size="sm" data-slot="ordem" data-recentes={recentes || undefined} className="ml-auto"
                  onClick={() => setPrefRecentes(!recentes)}>
                  {recentes ? <ArrowUpNarrowWide /> : <ArrowDownNarrowWide />}
                  {recentes ? "Mais recentes primeiro" : "Mais antigos primeiro"}
                </Button>
              </Dica>
            </div>

            <div data-slot="timeline-barra" className="sticky top-0 z-10 -mx-2 mt-1.5 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 bg-background/95 px-2 py-2 backdrop-blur-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-background after:to-transparent">
              <Segmentado aria-label="Filtrar a linha do tempo" tamanho="sm" valor={filtro} aoMudar={setFiltro} opcoes={FILTROS} />
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <Button size="sm" data-slot="registrar" data-tipo="reuniao" onClick={() => registrar("reuniao")}><Plus /> Reunião</Button>
                <Button size="sm" variant="outline" data-slot="registrar" data-tipo="atividade" onClick={() => registrar("atividade")}>
                  <IconeTipo tipo="atividade" /> Atividade
                </Button>
                <Button size="sm" variant="outline" data-slot="registrar" data-tipo="impedimento" onClick={() => registrar("impedimento")}>
                  <IconeTipo tipo="impedimento" /> Impedimento
                </Button>
                <DropdownMenu>
                  <Dica texto="Decisão ou nota">
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="outline" data-slot="registrar-outros" aria-label="Registrar decisão ou nota"><ChevronDown /></Button>
                    </DropdownMenuTrigger>
                  </Dica>
                  <DropdownMenuContent>
                    <ItensNovoRegistro tipos={["decisao", "nota"]} aoEscolher={registrar} />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {rascunhos.map((x) => {
              const reg = x.registroId ? tarefa.registros.find((r) => r.id === x.registroId) : null;
              if (x.registroId && !reg) return null; // o registro saiu da timeline; o rascunho não tem onde entrar
              const oQue = reg
                ? `edição de “${reg.titulo || tipoInfo(reg.tipo).nome}”`
                : `registro novo: ${tipoInfo(x.r.tipo).nome.toLowerCase()}${x.r.titulo ? `, “${x.r.titulo}”` : ""}`;
              return (
                <div key={x.registroId ?? "novo"} data-slot="rascunho-aviso" role="status"
                  className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-info/30 bg-info/10 px-3.5 py-2.5 text-[13px] leading-snug">
                  <History className="size-4 shrink-0 text-info" />
                  <span className="min-w-0 flex-1 basis-56">Rascunho não salvo ({oQue}), de {formatarDataHora(x.salvoEm)}.</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={() => setEditor(reg ? { aberto: true, registro: reg } : { aberto: true, tipo: x.r.tipo })}>Continuar</Button>
                    <Button size="sm" variant="outline" onClick={async () => {
                      const ok = await confirmar({
                        titulo: "Descartar este rascunho?",
                        descricao: "O que você tinha digitado neste registro se perde.",
                        confirmar: "Descartar",
                        perigo: true,
                      });
                      if (!ok) return;
                      apagarRascunho(tarefa.id, x.registroId);
                      setRascunhos(listarRascunhos(tarefa.id));
                    }}>Descartar</Button>
                  </div>
                </div>
              );
            })}
            {tarefa.registros.length === 0 ? (
              <Vazio titulo="Nada registrado ainda" icone={<Plus />}>
                <p>Registre a primeira reunião ou atividade desta tarefa para começar a linha do tempo.</p>
                <Button onClick={() => registrar("reuniao")}><Plus /> Registrar reunião</Button>
              </Vazio>
            ) : visiveis.length === 0 ? (
              <Vazio compacto titulo="Nenhum registro deste tipo">
                <Button variant="outline" size="sm" onClick={() => setFiltro("tudo")}>Mostrar tudo</Button>
              </Vazio>
            ) : (
              <Timeline
                key={`${recentes}-${filtro}`}
                tarefa={tarefa}
                registros={visiveis}
                recentes={recentes}
                destaque={destaque}
                comNovo={ehAberta && filtro === "tudo"}
                aoRegistrar={registrar}
                aoEditar={(r) => setEditor({ aberto: true, registro: r })}
                aoRemover={remover}
              />
            )}
          </div>

          {/* Lateral: pendências, links, pessoas, panorama e resumo */}
          <aside data-slot="tarefa-lateral" className="px-6 pb-12 @5xl:w-[364px] @5xl:shrink-0 @5xl:overflow-y-auto @5xl:pt-5 @5xl:pl-0">
            <Lateral
              className="grid items-start gap-4 @2xl:grid-cols-2 @5xl:grid-cols-1"
              tarefa={tarefa}
              links={links}
              aoIrPara={irPara}
              aoAdicionarLink={() => setLinkForm(true)}
              aoGerarPanorama={() => setPrompt("panorama")}
            />
          </aside>
        </div>
      </Pagina>

      <TarefaForm aberto={editando} fechar={() => setEditando(false)} tarefa={tarefa} />
      <RegistroEditor aberto={editor.aberto} fechar={() => setEditor((e) => ({ ...e, aberto: false }))} tarefa={tarefa}
        registro={editor.registro} tipoInicial={editor.tipo} />
      <LinkForm aberto={linkForm} fechar={() => setLinkForm(false)} tarefaId={tarefa.id} categoriaId={tarefa.categoriaId} />
      <PromptModal
        aberto={prompt === "panorama"}
        fechar={() => setPrompt(null)}
        titulo="Panorama da tarefa"
        explicacao="Gera um status report com toda a linha do tempo. Cole a resposta para guardar o panorama na tarefa."
        prompt={promptPanorama(tarefa, cat)}
        aoSalvarResposta={(texto) =>
          atualizarTarefa(tarefa.id, (t) => ({ ...t, panoramaIA: { texto, geradoEm: agoraISO() } }))}
        rotuloSalvar="Guardar panorama"
      />
      <PromptModal
        aberto={prompt === "reuniao"}
        fechar={() => setPrompt(null)}
        titulo="Preparar próxima reunião"
        explicacao="Gera uma pauta com base no histórico e nas pendências. Use a resposta no Copilot mesmo, ou copie para as anotações do próximo registro."
        prompt={promptPrepararReuniao(tarefa, cat)}
      />
    </>
  );
}
