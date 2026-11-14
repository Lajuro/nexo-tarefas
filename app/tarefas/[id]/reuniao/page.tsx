"use client";

// Modo reunião: a pauta antes, a captura durante e a ata depois, numa tela só.
// O que é digitado fica guardado no navegador a cada mudança (lib/rascunhos.ts) e só vira
// registro na pasta de dados em "Encerrar e salvar". As contas estão em lib/reuniao.ts.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, Check, ClipboardList, Copy, Gavel, Hourglass, ListChecks, OctagonAlert, Play, SearchX, Timer, Trash2, Users, WandSparkles, X,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { PromptModal } from "@/components/PromptModal";
import { AvatarPessoa, Campo, ChipsInput, ItemPasso, Pagina, Painel, Vazio, copiarTexto } from "@/components/comum";
import { EditorRico } from "@/components/editor/EditorRico";
import { TextoRico } from "@/components/tarefa/Texto";
import { Button } from "@/components/ui/button";
import { CampoSugestoes } from "@/components/ui/chips";
import { SeletorData } from "@/components/ui/data";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { itemRemovivel } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { nomesConhecidos } from "@/lib/pessoas";
import { promptPrepararReuniao } from "@/lib/prompts";
import { apagarReuniao, gravarReuniao, lerReuniao } from "@/lib/rascunhos";
import { type Reuniao, comReuniao, montarPauta, registroDaReuniao, reuniaoNova, reuniaoTemConteudo, textoDaAta, textoDaPauta } from "@/lib/reuniao";
import { paraTextoPlano } from "@/lib/texto-rico";
import { formatarData, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const p2 = (n: number) => String(n).padStart(2, "0");

/** Relógio da reunião: sempre calculado da hora de início, então aba em segundo plano não atrasa. */
function Relogio({ inicio }: { inicio: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((agora - inicio) / 1000));
  const h = Math.floor(s / 3600);
  return (
    <span data-slot="relogio-reuniao" role="timer" aria-label="Tempo de reunião"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-[13px] font-semibold tabular-nums text-primary sem-selecao dark:text-foreground">
      <Timer className="size-3.5" />
      {h > 0 ? `${h}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}` : `${p2(Math.floor(s / 60))}:${p2(s % 60)}`}
    </span>
  );
}

export default function PaginaReuniao() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { dados, atualizarTarefa, toast, estado } = useNexo();
  const confirmar = useConfirmar();
  const somenteLeitura = !!estado?.somenteLeitura;

  // O estado nasce do que ficou guardado no navegador (reunião interrompida), se houver.
  const [r, setR] = useState<Reuniao>(() => lerReuniao(id) ?? reuniaoNova());
  const [semRascunho, setSemRascunho] = useState(false);
  const [salvando, setSalvando] = useState(false);
  /** Depois de salvar: a ata pronta e o registro que nasceu. */
  const [depois, setDepois] = useState<{ ata: string; registroId: string } | null>(null);
  const [prompt, setPrompt] = useState(false);
  const [decisao, setDecisao] = useState("");
  const [passo, setPasso] = useState("");
  const campoDecisao = useRef<HTMLInputElement>(null);
  const campoPasso = useRef<HTMLInputElement>(null);

  const mudar = (parte: Partial<Reuniao>) => setR((x) => ({ ...x, ...parte }));

  // Guarda no navegador a cada mudança. Uma reunião em branco não deixa rastro.
  const salvo = useRef(false);
  useEffect(() => {
    if (salvo.current) return;
    if (reuniaoTemConteudo(r) || r.inicio > 0) setSemRascunho(!gravarReuniao(id, r));
    else apagarReuniao(id);
  }, [r, id]);

  const tarefa = dados?.tarefas.find((t) => t.id === id);
  const cat = dados?.categorias.items.find((c) => c.id === tarefa?.categoriaId);
  const pauta = useMemo(() => (dados && tarefa ? montarPauta(dados, tarefa, r.participantes) : null), [dados, tarefa, r.participantes]);
  const nomes = useMemo(() => (dados ? nomesConhecidos(dados) : []), [dados]);
  const responsaveis = useMemo(() => [...new Set([...r.participantes, "Eu", ...nomes])], [r.participantes, nomes]);

  // Alt+1, Alt+2: capturar sem tirar a mão do teclado.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const alvo = e.key === "1" ? campoDecisao.current : e.key === "2" ? campoPasso.current : null;
      if (!alvo) return;
      e.preventDefault();
      alvo.focus();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  if (!tarefa || !pauta) {
    return (
      <Pagina titulo="Modo reunião" voltar={{ href: "/tarefas", rotulo: "Tarefas" }} estreita>
        <Vazio titulo="Não achei esta tarefa" icone={<SearchX />}>
          <p>Ela pode ter ido para a lixeira (dá para restaurar em Configurações) ou o endereço está errado.</p>
          <Button asChild><Link href="/tarefas"><ArrowLeft /> Voltar para as tarefas</Link></Button>
        </Vazio>
      </Pagina>
    );
  }

  const voltar = { href: `/tarefas/${tarefa.id}`, rotulo: "a tarefa" };

  // ---------- depois: a ata ----------
  if (depois) {
    return (
      <Pagina titulo="Reunião registrada" descricao={tarefa.titulo} voltar={voltar} estreita
        acoes={
          <>
            <Button variant="outline" asChild><Link href={`/tarefas/${tarefa.id}?r=${depois.registroId}`}>Ver na linha do tempo</Link></Button>
            <Button data-slot="copiar-ata" onClick={async () => { if (await copiarTexto(depois.ata)) toast("Ata copiada."); }}><Copy /> Copiar ata</Button>
          </>
        }>
        <Painel titulo="Ata" icone={<ClipboardList />}>
          <pre data-slot="ata" className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{depois.ata}</pre>
        </Painel>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          A ata é montada só com o que você escreveu. Para um resumo feito pelo Copilot, abra o registro na linha do tempo e use o bloco Copilot do editor.
        </p>
      </Pagina>
    );
  }

  const addDecisao = () => {
    const t = decisao.trim();
    if (!t) return;
    mudar({ decisoes: [...r.decisoes, t] });
    setDecisao("");
  };
  const addPasso = () => {
    const t = passo.trim();
    if (!t) return;
    mudar({ passos: [...r.passos, { id: novoId("p"), texto: t, responsavel: "", prazo: "" }] });
    setPasso("");
  };
  const alternarResolvido = (chave: string, feito: boolean) =>
    mudar({ resolvidos: feito ? [...new Set([...r.resolvidos, chave])] : r.resolvidos.filter((x) => x !== chave) });

  const temConteudo = reuniaoTemConteudo(r);

  const encerrar = async () => {
    if (!temConteudo || salvando) return;
    setSalvando(true);
    // o que ficou digitado nos campos de captura e não foi confirmado com Enter também entra
    const final: Reuniao = {
      ...r,
      decisoes: decisao.trim() ? [...r.decisoes, decisao.trim()] : r.decisoes,
      passos: passo.trim() ? [...r.passos, { id: novoId("p"), texto: passo.trim(), responsavel: "", prazo: "" }] : r.passos,
    };
    const registro = registroDaReuniao(final);
    const ata = textoDaAta(tarefa, final);
    const ok = await atualizarTarefa(tarefa.id, (t) => comReuniao(t, final, registro));
    setSalvando(false);
    if (!ok) return; // o Provider já avisou; o rascunho continua guardado
    salvo.current = true;
    apagarReuniao(tarefa.id);
    setDepois({ ata, registroId: registro.id });
    toast("Reunião registrada na linha do tempo.");
  };

  const descartar = async () => {
    const ok = await confirmar({
      titulo: "Descartar esta reunião?",
      descricao: "As anotações, decisões e passos capturados aqui se perdem. Nada disso foi gravado na tarefa ainda.",
      confirmar: "Descartar",
      perigo: true,
    });
    if (!ok) return;
    salvo.current = true;
    apagarReuniao(tarefa.id);
    router.push(`/tarefas/${tarefa.id}`);
  };

  const ultimo = pauta.ultimo;
  const trechoUltimo = ultimo ? paraTextoPlano(ultimo.resumoIA || ultimo.anotacoes || "").slice(0, 320) : "";
  const pautaVazia = !pauta.passosDaTarefa.length && !tarefa.esperando && !pauta.decisoes.length && !ultimo && !pauta.porPessoa.some((p) => p.passos.length || p.esperas.length);

  return (
    <>
      <Pagina
        semRolagem
        className="@container"
        voltar={voltar}
        titulo={<>Reunião <span className="font-normal text-muted-foreground">· {tarefa.titulo}</span></>}
        acoes={
          <>
            {r.inicio > 0 ? (
              <Relogio inicio={r.inicio} />
            ) : (
              <Dica texto="Liga o relógio. A hora de início entra no registro.">
                <Button variant="outline" data-slot="comecar-reuniao" onClick={() => mudar({ inicio: Date.now() })}><Play /> Começar</Button>
              </Dica>
            )}
            {temConteudo && (
              <Dica texto="Descartar o que foi capturado">
                <Button variant="ghost" size="icon" aria-label="Descartar reunião" onClick={descartar}><Trash2 /></Button>
              </Dica>
            )}
            <Dica texto={somenteLeitura ? "O app está em somente leitura" : !temConteudo ? "Escreva algo para registrar" : "Grava a reunião na linha do tempo e monta a ata (Ctrl Enter)"}>
              <Button data-slot="encerrar-reuniao" disabled={!temConteudo || salvando || somenteLeitura} onClick={encerrar}>
                <Check /> {salvando ? "Salvando..." : "Encerrar e salvar"}
              </Button>
            </Dica>
          </>
        }
      >
        <div
          data-slot="reuniao"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void encerrar();
            }
          }}
          className="mx-auto flex h-full w-full max-w-[1560px] flex-col overflow-y-auto @5xl:flex-row @5xl:overflow-hidden"
        >
          {/* Antes: a pauta */}
          <aside data-slot="pauta" className="order-3 flex shrink-0 flex-col gap-3 px-6 pt-5 pb-10 @5xl:order-none @5xl:w-[320px] @5xl:shrink-0 @5xl:overflow-y-auto @5xl:pr-0 @5xl:pb-10">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold tracking-tight">Pauta</h2>
              <div className="ml-auto flex items-center gap-1">
                <Dica texto="Monta um prompt para o Copilot sugerir a pauta">
                  <Button variant="ghost" size="icon-sm" aria-label="Preparar a pauta com o Copilot" onClick={() => setPrompt(true)}><WandSparkles /></Button>
                </Dica>
                <Button variant="outline" size="sm" data-slot="copiar-pauta" disabled={pautaVazia}
                  onClick={async () => { if (await copiarTexto(textoDaPauta(tarefa, pauta))) toast("Pauta copiada."); }}>
                  <Copy /> Copiar
                </Button>
              </div>
            </div>

            {pautaVazia && (
              <p className="rounded-xl border border-dashed px-3.5 py-4 text-xs leading-relaxed text-muted-foreground">
                Esta tarefa ainda não tem pendências nem decisões registradas. Informe os participantes para ver o que está com cada um em outras frentes.
              </p>
            )}

            {pauta.passosDaTarefa.length > 0 && (
              <Painel titulo="Pendências para revisar" icone={<ListChecks />} contagem={pauta.passosDaTarefa.length} corpoClassName="px-3.5 py-2">
                {pauta.passosDaTarefa.map((x) => {
                  const chave = `${x.registro.id}:${x.passo.id}`;
                  return (
                    <ItemPasso
                      key={chave}
                      texto={x.passo.texto}
                      feito={r.resolvidos.includes(chave)}
                      aoAlternar={(f) => alternarResolvido(chave, f)}
                      meta={[x.passo.responsavel, x.passo.prazo ? `até ${formatarData(x.passo.prazo)}` : ""].filter(Boolean).join(" · ") || undefined}
                    />
                  );
                })}
                <p className="mt-1 mb-0.5 text-[11px] leading-snug text-muted-foreground">Marque o que for resolvido na conversa. Só vale ao salvar.</p>
              </Painel>
            )}

            {tarefa.esperando && (
              <Painel titulo="Aguardando retorno" icone={<Hourglass />} corpoClassName="px-3.5 py-2.5 text-[13px] leading-snug">
                <span className="font-medium">{tarefa.esperando.quem || "Alguém"}</span>
                {tarefa.esperando.oQue && <span className="text-muted-foreground">: {tarefa.esperando.oQue}</span>}
              </Painel>
            )}

            {pauta.porPessoa.filter((p) => p.passos.length || p.esperas.length).map((p) => (
              <Painel key={p.nome} titulo={<span className="inline-flex items-center gap-1.5"><AvatarPessoa nome={p.nome} tamanho="sm" /> {p.nome}, em outras frentes</span>}
                corpoClassName="flex flex-col gap-1.5 px-3.5 py-2.5">
                {p.passos.map((x) => (
                  <Link key={`${x.registro.id}:${x.passo.id}`} href={`/tarefas/${x.tarefa.id}`} className="group text-[13px] leading-snug">
                    <span className="group-hover:underline">{x.passo.texto}</span>
                    <span className="block text-[11px] text-muted-foreground">{x.tarefa.titulo}{x.passo.prazo ? ` · até ${formatarData(x.passo.prazo)}` : ""}</span>
                  </Link>
                ))}
                {p.esperas.map((t) => (
                  <Link key={t.id} href={`/tarefas/${t.id}`} className="group text-[13px] leading-snug">
                    <span className="group-hover:underline">Retorno pendente: {t.esperando?.oQue || t.titulo}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.titulo}</span>
                  </Link>
                ))}
              </Painel>
            ))}

            {pauta.decisoes.length > 0 && (
              <Painel titulo="Últimas decisões" icone={<Gavel />} corpoClassName="flex flex-col gap-2.5 px-3.5 py-2.5">
                {pauta.decisoes.map((d, i) => (
                  <div key={i}>
                    <div className="text-[11px] text-muted-foreground">{formatarData(d.data)}{d.titulo ? ` · ${d.titulo}` : ""}</div>
                    <TextoRico texto={d.texto} className="text-[13px]" />
                  </div>
                ))}
              </Painel>
            )}

            {ultimo && trechoUltimo && (
              <Painel titulo="Onde a conversa parou" corpoClassName="px-3.5 py-2.5">
                <div className="text-[11px] text-muted-foreground">{formatarData(ultimo.data)}{ultimo.titulo ? ` · ${ultimo.titulo}` : ""}</div>
                <p className="mt-0.5 text-[13px] leading-snug texto-pre">{trechoUltimo}{trechoUltimo.length >= 320 ? "..." : ""}</p>
              </Painel>
            )}
          </aside>

          {/* Durante: as anotações. Em tela estreita vêm primeiro: é onde se escreve. */}
          <div className="order-1 flex min-w-0 shrink-0 flex-col gap-2.5 px-6 pt-5 pb-4 @5xl:order-none @5xl:min-h-0 @5xl:flex-1 @5xl:shrink @5xl:pb-6">
            <div className="flex flex-wrap gap-3">
              <Campo rotulo="Título" className="basis-64">
                <Input value={r.titulo} onChange={(e) => mudar({ titulo: e.target.value })} maxLength={300}
                  placeholder="Ex.: Alinhamento com o squad de Pagamentos" aria-label="Título da reunião" />
              </Campo>
              <Campo rotulo={<span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> Participantes</span>} className="basis-72">
                <ChipsInput valor={r.participantes} mudar={(v) => mudar({ participantes: v })} sugestoes={nomes} placeholder="Nome e Enter" />
              </Campo>
            </div>
            <EditorRico
              data-slot="notas-da-reuniao"
              variante="pagina"
              valor={r.notas}
              aoMudar={(v) => mudar({ notas: v })}
              placeholder="Anote solto o que for sendo falado. Decisões e próximos passos vão para a coluna ao lado (Alt 1 e Alt 2). Digite / para blocos e @ para citar."
              aria-label="Anotações da reunião"
              className="min-h-72 rounded-md border border-input bg-card shadow-xs @5xl:min-h-0 @5xl:flex-1 dark:bg-input/20"
              classeConteudo="px-4 py-3.5 leading-relaxed"
            />
            <p data-slot="reuniao-situacao" role="status" className={cn("text-[11px] sem-selecao", semRascunho ? "text-alerta" : "text-muted-foreground")}>
              {semRascunho
                ? "O navegador não deixou guardar o rascunho. Não feche esta tela antes de salvar."
                : temConteudo
                  ? "Guardado neste navegador a cada mudança. Vira registro quando você encerrar."
                  : "Nada vai para a tarefa até você encerrar e salvar."}
            </p>
          </div>

          {/* Durante: o que sai da reunião */}
          <aside data-slot="capturas" className="order-2 flex shrink-0 flex-col gap-3 px-6 pt-2 pb-4 @5xl:order-none @5xl:w-[360px] @5xl:pt-5 @5xl:pb-10 @5xl:shrink-0 @5xl:overflow-y-auto @5xl:pl-0">
            <Painel titulo="Decisões" icone={<Gavel />} contagem={r.decisoes.length} corpoClassName="flex flex-col gap-1.5 px-3.5 py-2.5">
              <AnimatePresence initial={false}>
                {r.decisoes.map((d, i) => (
                  <motion.div key={`${i}:${d}`} {...itemRemovivel} data-slot="decisao-capturada" className="flex items-start gap-1.5 text-[13px] leading-snug">
                    <Gavel className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 texto-pre">{d}</span>
                    <Button variant="ghost" size="icon-sm" className="-my-1 size-6 shrink-0" aria-label="Tirar decisão"
                      onClick={() => mudar({ decisoes: r.decisoes.filter((_, j) => j !== i) })}><X /></Button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Input ref={campoDecisao} data-slot="nova-decisao" value={decisao} onChange={(e) => setDecisao(e.target.value)} maxLength={500}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addDecisao(); } }}
                placeholder="O que ficou decidido? Enter guarda (Alt 1)" aria-label="Nova decisão" />
            </Painel>

            <Painel titulo="Próximos passos" icone={<ListChecks />} contagem={r.passos.length} corpoClassName="flex flex-col gap-2 px-3.5 py-2.5">
              <AnimatePresence initial={false}>
                {r.passos.map((p) => (
                  <motion.div key={p.id} {...itemRemovivel} data-slot="passo-capturado" className="overflow-hidden">
                    <div className="rounded-lg border bg-background/60 px-2.5 py-2">
                    <div className="flex items-start gap-1.5 text-[13px] leading-snug">
                      <span className="min-w-0 flex-1 texto-pre">{p.texto}</span>
                      <Button variant="ghost" size="icon-sm" className="-my-1 size-6 shrink-0" aria-label="Tirar passo"
                        onClick={() => mudar({ passos: r.passos.filter((x) => x.id !== p.id) })}><X /></Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <CampoSugestoes valor={p.responsavel} sugestoes={responsaveis} placeholder="Responsável" aria-label="Responsável pelo passo" className="h-7 min-w-0 flex-1 text-xs"
                        aoMudar={(v) => mudar({ passos: r.passos.map((x) => (x.id === p.id ? { ...x, responsavel: v } : x)) })} />
                      <SeletorData valor={p.prazo} placeholder="Prazo" aria-label="Prazo do passo" className="h-7 w-32 text-xs"
                        aoMudar={(v) => mudar({ passos: r.passos.map((x) => (x.id === p.id ? { ...x, prazo: v } : x)) })} />
                    </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Input ref={campoPasso} data-slot="novo-passo" value={passo} onChange={(e) => setPasso(e.target.value)} maxLength={500}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addPasso(); } }}
                placeholder="O que precisa ser feito? Enter guarda (Alt 2)" aria-label="Novo próximo passo" />
            </Painel>

            <Painel titulo="Impedimentos" icone={<OctagonAlert />} corpoClassName="px-3.5 py-2.5">
              <Textarea value={r.impedimentos} onChange={(e) => mudar({ impedimentos: e.target.value })} maxLength={20000}
                placeholder="Algo travando? Quem ou o que destrava?" aria-label="Impedimentos" className="min-h-16" />
            </Painel>
          </aside>
        </div>
      </Pagina>

      <PromptModal
        aberto={prompt}
        fechar={() => setPrompt(false)}
        titulo="Preparar a pauta com o Copilot"
        explicacao="Gera uma sugestão de pauta com base no histórico e nas pendências. Use a resposta para guiar a conversa."
        prompt={promptPrepararReuniao(tarefa, cat)}
      />
    </>
  );
}
