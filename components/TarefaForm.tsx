"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNexo } from "./Provider";
import { ComboCategoria } from "./tarefas/ComboCategoria";
import { Campo, ChipsInput, LinhaCampos, Modal, PontoCor, SeletorPrioridade, opcoesStatus } from "./comum";
import { Button } from "@/components/ui/button";
import { type OpcaoCombo } from "@/components/ui/command";
import { SeletorData } from "@/components/ui/data";
import { Badge, Kbd } from "@/components/ui/diversos";
import { Input, Textarea } from "@/components/ui/input";
import { Seletor } from "@/components/ui/select";
import { aplicarStatus } from "@/lib/acoes";
import {
  CORES, Status, Tarefa, hojeISO, normalizarCategoria, normalizarRegistro,
  normalizarTarefa, novoId,
} from "@/lib/tipos";

/** Valor interno do seletor quando a categoria escolhida ainda vai ser criada ao salvar. */
const NOVA = "__nova";

export function TarefaForm({
  aberto, fechar, tarefa, categoriaInicial,
}: {
  aberto: boolean; fechar: () => void; tarefa?: Tarefa; categoriaInicial?: string | null;
}) {
  const { dados, criarTarefa, atualizarTarefa, salvarCategorias } = useNexo();
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
    setSalvando(false);
    gravando.current = false;
  }, [aberto, tarefa, categoriaInicial]);

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
      const r = await criarTarefa(base);
      liberar();
      if (r) {
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
      fechar={fechar}
      className="max-w-[580px]"
      rodape={
        <>
          <span className="mr-auto hidden items-center gap-1 text-[11px] text-muted-foreground sem-selecao sm:inline-flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>Enter</Kbd>
            <span className="ml-0.5">salva de qualquer campo</span>
          </span>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
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
        <Campo rotulo="Título">
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
      </div>
    </Modal>
  );
}

// aplicarStatus mora em lib/acoes.ts; reexportado aqui para quem já importava deste arquivo.
export { aplicarStatus } from "@/lib/acoes";
