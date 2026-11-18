"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { useNexo } from "./Provider";
import { useNomesDasTags } from "./tags/useTags";
import { useFecharComCuidado } from "./Raiz";
import { ComboCategoria } from "./tarefas/ComboCategoria";
import { Campo, ChipsInput, LinhaCampos, Modal, PontoCor, SeletorPrioridade, opcoesStatus } from "./comum";
import { Button } from "@/components/ui/button";
import { type OpcaoCombo } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/controles";
import { SeletorData, somarDias } from "@/components/ui/data";
import { Badge, Collapsible, CollapsibleContent, CollapsibleTrigger, Kbd } from "@/components/ui/diversos";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { Seletor } from "@/components/ui/select";
import { aplicarStatus } from "@/lib/acoes";
import { porUso, registroDosPassos } from "@/lib/modelos";
import { usePref } from "@/lib/preferencias";
import { comOcorrenciaAtendida, ocorrenciaDevida } from "@/lib/recorrencia";
import {
  CORES, Modelo, Status, Tarefa, dataCurta, hojeISO, nomeStatus, normalizarCategoria, normalizarRegistro,
  normalizarTarefa, novoId,
} from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Valor interno do seletor quando a categoria escolhida ainda vai ser criada ao salvar. */
const NOVA = "__nova";

export function TarefaForm({
  aberto, fechar, tarefa, categoriaInicial, modeloInicial,
}: {
  aberto: boolean; fechar: () => void; tarefa?: Tarefa; categoriaInicial?: string | null;
  /** Abre a tarefa nova já preenchida com este modelo. */
  modeloInicial?: string | null;
}) {
  const { dados, criarTarefa, atualizarTarefa, salvarCategorias, salvarModelos } = useNexo();
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [novaCat, setNovaCat] = useState("");
  const [status, setStatus] = useState<Status>("a_fazer");
  const [prioridade, setPrioridade] = useState(5);
  const [prazo, setPrazo] = useState("");
  const [lembrarEm, setLembrarEm] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // Modelo escolhido (só em tarefa nova) e os passos dele, que dá para desmarcar antes de salvar.
  const [modeloId, setModeloId] = useState("");
  const [passosModelo, setPassosModelo] = useState<{ texto: string; ligado: boolean }[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Trava síncrona: Enter no título e Ctrl+Enter podem chegar juntos antes de o estado "salvando" virar.
  const gravando = useRef(false);
  const campoTitulo = useRef<HTMLInputElement>(null);
  // "Mais opções" (3.11): status, lembrete de voltar, tags e descrição ficam recolhidos ao criar, a não ser
  // que o usuário prefira ver tudo (a última escolha ao criar fica lembrada no navegador).
  const [maisPref, setMaisPref] = usePref<boolean>("tarefaMaisOpcoes", false);
  const [mais, setMais] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setCategoriaId(tarefa?.categoriaId ?? categoriaInicial ?? "");
    setNovaCat("");
    setStatus(tarefa?.status ?? "a_fazer");
    setPrioridade(tarefa?.prioridade ?? 5);
    setPrazo(tarefa?.prazo ?? "");
    setLembrarEm(tarefa?.lembrarEm ?? "");
    setTags(tarefa?.tags ?? []);
    setModeloId("");
    setPassosModelo([]);
    setSalvando(false);
    gravando.current = false;
    // Ao editar, abre se algum campo de dentro tem valor; ao criar, segue a última escolha.
    setMais(tarefa
      ? tarefa.status !== "a_fazer" || !!tarefa.lembrarEm || tarefa.tags.length > 0 || !!tarefa.descricao.trim()
      : maisPref === true);
    const inicial = !tarefa && modeloInicial ? dados?.modelos?.items.find((m) => m.id === modeloInicial) : undefined;
    if (inicial) aplicarModelo(inicial, true);
    // Só ao abrir: os dados mudando por baixo não podem apagar o que está sendo digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tarefa, categoriaInicial, modeloInicial]);

  const modelos = useMemo(() => (tarefa ? [] : [...(dados?.modelos?.items ?? [])].sort(porUso)), [dados?.modelos, tarefa]);
  const modelo = modelos.find((m) => m.id === modeloId);

  /** Preenche o formulário com o modelo. Escolher o mesmo de novo desfaz e volta ao formulário em branco. */
  function aplicarModelo(m: Modelo, semDesfazer = false) {
    if (m.id === modeloId && !semDesfazer) {
      setModeloId("");
      setPassosModelo([]);
      setTitulo("");
      setDescricao("");
      setCategoriaId(categoriaInicial ?? "");
      setPrioridade(5);
      setPrazo("");
      setTags([]);
      return;
    }
    setModeloId(m.id);
    setPassosModelo(m.passos.map((texto) => ({ texto, ligado: true })));
    setTitulo(m.titulo);
    setDescricao(m.descricao);
    // categoria do modelo só vale se ainda existir e não estiver arquivada
    const cat = dados?.categorias.items.find((c) => c.id === m.categoriaId && !c.arquivada);
    setCategoriaId(cat?.id ?? categoriaInicial ?? "");
    setNovaCat("");
    setPrioridade(m.prioridade);
    setPrazo(m.prazoEmDias ? somarDias(hojeISO(), m.prazoEmDias) : "");
    setTags(m.tags);
    // o modelo preencheu algo que mora em "Mais opções": mostra, sem mudar a preferência
    if (m.tags.length > 0 || m.descricao.trim()) setMais(true);
    // O título do modelo costuma ter um "..." onde entra o que muda: deixa esse trecho já selecionado para digitar por cima.
    setTimeout(() => {
      const campo = campoTitulo.current;
      if (!campo) return;
      campo.focus();
      const i = m.titulo.indexOf("...");
      if (i >= 0) campo.setSelectionRange(i, i + 3);
    }, 40);
  }

  // Texto digitado e ainda não salvo: Esc, clique fora e Cancelar perguntam antes de jogar fora.
  // Com modelo, "o que já veio preenchido" é o modelo: só pergunta se o usuário mexeu por cima dele.
  const partida = { titulo: tarefa?.titulo ?? modelo?.titulo ?? "", descricao: tarefa?.descricao ?? modelo?.descricao ?? "", tags: tarefa?.tags ?? modelo?.tags ?? [] };
  const sujo = aberto && (
    titulo !== partida.titulo || descricao !== partida.descricao ||
    tags.join("\n") !== partida.tags.join("\n") || novaCat.trim() !== ""
  );
  const tentarFechar = useFecharComCuidado(sujo, fechar);

  // O que está guardado em "Mais opções", para o botão recolhido não esconder nada que já tem valor.
  const resumoMais = [
    status !== "a_fazer" && nomeStatus(status),
    lembrarEm && `lembrar em ${dataCurta(lembrarEm)}`,
    tags.length > 0 && (tags.length === 1 ? "1 tag" : `${tags.length} tags`),
    descricao.trim() && "descrição",
  ].filter(Boolean).join(" · ");

  const todasCategorias = dados?.categorias.items;
  const corNova = CORES[(todasCategorias?.length ?? 0) % CORES.length];
  const opcoesCategoria = useMemo(() => {
    const ops: OpcaoCombo[] = (todasCategorias ?? [])
      .filter((c) => !c.arquivada || c.id === categoriaId)
      .map((c) => ({
        valor: c.id,
        rotulo: c.nome,
        render: (
          <>
            <PontoCor cor={c.cor} />
            <span className="truncate">{c.nome}</span>
          </>
        ),
      }));
    if (novaCat)
      ops.push({
        valor: NOVA,
        rotulo: novaCat,
        render: (
          <>
            <PontoCor cor={corNova} />
            <span className="truncate">{novaCat}</span>
            <Badge variant="default">nova</Badge>
          </>
        ),
      });
    return ops;
  }, [todasCategorias, categoriaId, novaCat, corNova]);

  const todasTags = useNomesDasTags();

  async function salvar() {
    if (!titulo.trim() || gravando.current) return;
    gravando.current = true;
    setSalvando(true);
    const liberar = () => {
      gravando.current = false;
      setSalvando(false);
    };
    let catId: string | null = categoriaId || null;
    if (categoriaId === NOVA) {
      if (!novaCat.trim()) return liberar();
      const nova = normalizarCategoria({
        id: novoId("c"),
        nome: novaCat.trim(),
        cor: CORES[(dados?.categorias.items.length ?? 0) % CORES.length],
      });
      const ok = await salvarCategorias((items) => [...items, nova]);
      if (!ok) return liberar();
      // A categoria já existe no disco: se a tarefa falhar a seguir, um novo "Salvar" não cria outra igual.
      catId = nova.id;
      setCategoriaId(nova.id);
      setNovaCat("");
    }
    const campos = {
      titulo: titulo.trim(), descricao, categoriaId: catId, prioridade, prazo: prazo || null,
      lembrarEm: lembrarEm || null, tags,
    };
    if (tarefa) {
      const r = await atualizarTarefa(tarefa.id, (t) => aplicarStatus({ ...t, ...campos }, status, t));
      liberar();
      if (r) fechar();
    } else {
      const base = normalizarTarefa({ id: novoId("t"), ...campos, status });
      base.registros.push(
        normalizarRegistro({
          tipo: "marco", data: hojeISO(), titulo: "Tarefa criada",
          anotacoes: descricao, alteracoes: { status: { de: "", para: status } },
        }),
      );
      // Os passos do modelo entram num registro próprio: é ele que os faz aparecer em Pendências.
      const passos = modelo ? registroDosPassos(modelo, passosModelo.filter((p) => p.ligado).map((p) => p.texto)) : null;
      if (passos) base.registros.push(passos);
      const r = await criarTarefa(base);
      liberar();
      if (r) {
        // criar do modelo atende a ocorrência que estava esperando (se ele se repete), para o lembrete sair
        if (modelo)
          salvarModelos((items) => items.map((m) => {
            if (m.id !== modelo.id) return m;
            const usado = { ...m, usos: (m.usos ?? 0) + 1 };
            return comOcorrenciaAtendida(usado, ocorrenciaDevida(m.repetir, hojeISO()));
          }));
        fechar();
        router.push(`/tarefas/${r.id}`);
      }
    }
  }

  return (
    <Modal
      titulo={tarefa ? "Editar tarefa" : "Nova tarefa"}
      descricao={tarefa ? "Mudar o status aqui também registra um marco na linha do tempo." : "Só o título é obrigatório. O resto dá para completar depois."}
      aberto={aberto}
      fechar={tentarFechar}
      className="max-w-[580px]"
      rodape={
        <>
          <span className="mr-auto hidden items-center gap-1 text-xs text-muted-foreground sem-selecao sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
            <span className="ml-0.5">salva de qualquer campo</span>
          </span>
          <Button variant="outline" onClick={tentarFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || !titulo.trim()}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div
        data-slot="form-tarefa"
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            salvar();
          }
        }}
      >
        {modelos.length > 0 && (
          <div data-slot="modelos" className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sem-selecao"><LayoutTemplate className="size-3.5" /> Começar de um modelo</span>
            <div role="group" aria-label="Modelos de tarefa" className="flex flex-wrap gap-1.5">
              {modelos.slice(0, 8).map((m) => (
                <Dica key={m.id} texto={m.quando || `${m.passos.length} ${m.passos.length === 1 ? "passo" : "passos"} de sempre`}>
                  <Button type="button" size="sm" data-slot="escolher-modelo" aria-pressed={m.id === modeloId}
                    variant={m.id === modeloId ? "default" : "outline"} className="max-w-56" onClick={() => aplicarModelo(m)}>
                    <span className="truncate">{m.nome}</span>
                  </Button>
                </Dica>
              ))}
            </div>
          </div>
        )}

        <Campo rotulo="Título" dica={tarefa ? undefined : "A tarefa é a demanda inteira. Reuniões e atividades entram depois, como registros na linha do tempo dela."}>
          <Input
            ref={campoTitulo}
            autoFocus
            data-foco-inicial
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Onboarding do squad X no Security Champion"
            aria-label="Título da tarefa"
            className="h-9 text-sm font-medium placeholder:font-normal"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                salvar();
              }
            }}
          />
        </Campo>

        <LinhaCampos>
          <Campo rotulo="Categoria" dica="O assunto de onde a tarefa nasceu.">
            <ComboCategoria
              valor={categoriaId}
              aoMudar={setCategoriaId}
              opcoes={opcoesCategoria}
              aria-label="Categoria"
              aoCriar={(nome) => {
                setNovaCat(nome);
                setCategoriaId(NOVA);
              }}
            />
          </Campo>
          <Campo rotulo="Prazo">
            <SeletorData prazo valor={prazo} aoMudar={setPrazo} placeholder="Sem prazo" aria-label="Prazo" />
          </Campo>
        </LinhaCampos>

        <Campo rotulo="Prioridade" lado={<span className="text-xs text-muted-foreground">1 pode esperar · 10 é urgente</span>}>
          <SeletorPrioridade valor={prioridade} aoMudar={setPrioridade} />
        </Campo>

        <Collapsible
          open={mais}
          onOpenChange={(v) => {
            setMais(v);
            // só a escolha feita ao criar vira preferência (ao editar, quem decide é o que a tarefa já tem)
            if (!tarefa) setMaisPref(v);
          }}
          data-slot="mais-opcoes"
          data-aberto={mais || undefined}
          className="rounded-lg border bg-muted/20"
        >
          <CollapsibleTrigger
            data-slot="mais-opcoes-botao"
            className="group/mais flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-medium outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/30 sem-selecao"
          >
            <ChevronDown className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-150 group-data-[state=open]/mais:rotate-0" />
            <span className="shrink-0">Mais opções</span>
            {!mais && (
              <span data-slot="mais-opcoes-resumo" className="min-w-0 flex-1 truncate text-xs font-normal text-muted-foreground">
                {resumoMais || "Status, lembrete de voltar, tags e descrição"}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-4 px-3 pt-1.5 pb-3.5">
              <LinhaCampos>
                <Campo rotulo="Status">
                  <Seletor valor={status} aoMudar={(v) => setStatus(v as Status)} opcoes={opcoesStatus} aria-label="Status" />
                </Campo>
                <Campo rotulo="Lembrar de voltar em" dica="O app te avisa nesse dia para você retomar a tarefa.">
                  <SeletorData valor={lembrarEm} aoMudar={setLembrarEm} placeholder="Sem lembrete" aria-label="Lembrar de voltar em" />
                </Campo>
              </LinhaCampos>

              <Campo rotulo="Tags" dica="Enter ou vírgula para adicionar">
                <ChipsInput valor={tags} mudar={setTags} sugestoes={todasTags} placeholder="Ex.: pipeline, auditoria" />
              </Campo>

              <Campo rotulo="Descrição / objetivo">
                <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder="O que precisa ser entregue, quem pediu, contexto..." />
              </Campo>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {modelo && passosModelo.length > 0 && (
          <Campo
            rotulo="Passos que vêm do modelo"
            dica="Desmarque o que não vale para esta tarefa. Os marcados entram como próximos passos em aberto."
            lado={<span className="text-xs text-muted-foreground tabular-nums">{passosModelo.filter((p) => p.ligado).length} de {passosModelo.length}</span>}
          >
            <ul data-slot="passos-do-modelo" className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-2">
              {passosModelo.map((p, i) => {
                const idCampo = `passo-modelo-${i}`;
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Checkbox id={idCampo} checked={p.ligado} className="mt-px"
                      onCheckedChange={(v) => setPassosModelo((l) => l.map((x, j) => (j === i ? { ...x, ligado: v === true } : x)))} />
                    <label htmlFor={idCampo} className={cn("cursor-pointer text-[13px] leading-snug", !p.ligado && "text-muted-foreground line-through decoration-muted-foreground/50")}>{p.texto}</label>
                  </li>
                );
              })}
            </ul>
          </Campo>
        )}
      </div>
    </Modal>
  );
}

// aplicarStatus mora em lib/acoes.ts; reexportado aqui para quem já importava deste arquivo.
export { aplicarStatus } from "@/lib/acoes";
