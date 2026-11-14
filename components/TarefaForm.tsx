"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { useNexo } from "./Provider";
import { useFecharComCuidado } from "./Raiz";
import { ComboCategoria } from "./tarefas/ComboCategoria";
import { Campo, ChipsInput, LinhaCampos, Modal, PontoCor, SeletorPrioridade, opcoesStatus } from "./comum";
import { Button } from "@/components/ui/button";
import { type OpcaoCombo } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/controles";
import { SeletorData, somarDias } from "@/components/ui/data";
import { Badge, Kbd } from "@/components/ui/diversos";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { Seletor } from "@/components/ui/select";
import { aplicarStatus } from "@/lib/acoes";
import { porUso, registroDosPassos } from "@/lib/modelos";
import {
  CORES, Modelo, Status, Tarefa, hojeISO, normalizarCategoria, normalizarRegistro,
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
  }

  // Texto digitado e ainda não salvo: Esc, clique fora e Cancelar perguntam antes de jogar fora.
  // Com modelo, "o que já veio preenchido" é o modelo: só pergunta se o usuário mexeu por cima dele.
  const partida = { titulo: tarefa?.titulo ?? modelo?.titulo ?? "", descricao: tarefa?.descricao ?? modelo?.descricao ?? "", tags: tarefa?.tags ?? modelo?.tags ?? [] };
  const sujo = aberto && (
    titulo !== partida.titulo || descricao !== partida.descricao ||
    tags.join("\n") !== partida.tags.join("\n") || novaCat.trim() !== ""
  );
  const tentarFechar = useFecharComCuidado(sujo, fechar);

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

  const todasTags = useMemo(
    () => [...new Set((dados?.tarefas ?? []).flatMap((t) => t.tags))].sort(),
    [dados?.tarefas],
  );

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
        if (modelo) salvarModelos((items) => items.map((m) => (m.id === modelo.id ? { ...m, usos: (m.usos ?? 0) + 1 } : m)));
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
          <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground sem-selecao sm:inline-flex">
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
          <Campo rotulo="Status">
            <Seletor valor={status} aoMudar={(v) => setStatus(v as Status)} opcoes={opcoesStatus} aria-label="Status" />
          </Campo>
        </LinhaCampos>

        <Campo
          rotulo={<>Prioridade: <span className="font-semibold text-foreground tabular-nums">{prioridade}</span></>}
          dica="1 = pode esperar · 10 = urgente"
        >
          <SeletorPrioridade valor={prioridade} aoMudar={setPrioridade} />
        </Campo>

        <LinhaCampos>
          <Campo rotulo="Prazo">
            <SeletorData valor={prazo} aoMudar={setPrazo} placeholder="Sem prazo" aria-label="Prazo" />
          </Campo>
          <Campo rotulo="Lembrar de voltar em" dica="O app te avisa nesse dia para você retomar a tarefa.">
            <SeletorData valor={lembrarEm} aoMudar={setLembrarEm} placeholder="Sem lembrete" aria-label="Lembrar de voltar em" />
          </Campo>
        </LinhaCampos>

        <Campo rotulo="Tags" dica="Enter ou vírgula para adicionar">
          <ChipsInput valor={tags} mudar={setTags} sugestoes={todasTags} placeholder="Ex.: pipeline, auditoria" />
        </Campo>

        <Campo rotulo="Descrição / objetivo">
          <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que precisa ser entregue, quem pediu, contexto..." />
        </Campo>

        {modelo && passosModelo.length > 0 && (
          <Campo
            rotulo="Passos que vêm do modelo"
            dica="Desmarque o que não vale para esta tarefa. Os marcados entram como próximos passos em aberto."
            lado={<span className="text-[11px] text-muted-foreground tabular-nums">{passosModelo.filter((p) => p.ligado).length} de {passosModelo.length}</span>}
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
