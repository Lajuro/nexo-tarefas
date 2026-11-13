"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNexo } from "./Provider";
import { Campo, ChipsInput, Modal } from "./comum";
import { aplicarStatus } from "@/lib/acoes";
import {
  CORES, STATUS, Status, Tarefa, hojeISO, normalizarCategoria, normalizarRegistro,
  normalizarTarefa, novoId,
} from "@/lib/tipos";

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
  const [tags, setTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(tarefa?.titulo ?? "");
    setDescricao(tarefa?.descricao ?? "");
    setCategoriaId(tarefa?.categoriaId ?? categoriaInicial ?? "");
    setNovaCat("");
    setStatus(tarefa?.status ?? "a_fazer");
    setPrioridade(tarefa?.prioridade ?? 5);
    setPrazo(tarefa?.prazo ?? "");
    setTags(tarefa?.tags ?? []);
  }, [aberto, tarefa, categoriaInicial]);

  const categorias = (dados?.categorias.items ?? []).filter((c) => !c.arquivada || c.id === categoriaId);
  const todasTags = useMemo(
    () => [...new Set((dados?.tarefas ?? []).flatMap((t) => t.tags))].sort(),
    [dados?.tarefas],
  );

  async function salvar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    let catId: string | null = categoriaId || null;
    if (categoriaId === "__nova") {
      if (!novaCat.trim()) {
        setSalvando(false);
        return;
      }
      const nova = normalizarCategoria({
        id: novoId("c"),
        nome: novaCat.trim(),
        cor: CORES[(dados?.categorias.items.length ?? 0) % CORES.length],
      });
      const ok = await salvarCategorias((items) => [...items, nova]);
      if (!ok) return setSalvando(false);
      catId = nova.id;
    }
    const campos = {
      titulo: titulo.trim(), descricao, categoriaId: catId, prioridade, prazo: prazo || null, tags,
    };
    if (tarefa) {
      const r = await atualizarTarefa(tarefa.id, (t) => aplicarStatus({ ...t, ...campos }, status, t));
      setSalvando(false);
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
      setSalvando(false);
      if (r) {
        fechar();
        router.push(`/tarefas/${r.id}`);
      }
    }
  }

  return (
    <Modal
      titulo={tarefa ? "Editar tarefa" : "Nova tarefa"}
      aberto={aberto}
      fechar={fechar}
      rodape={
        <>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar} disabled={salvando || !titulo.trim()}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="form">
        <Campo rotulo="Título">
          <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Onboarding do squad X no Security Champion"
            onKeyDown={(e) => e.key === "Enter" && salvar()} />
        </Campo>
        <div className="linha-campos">
          <Campo rotulo="Categoria" dica="O assunto de onde a tarefa nasceu">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
              <option value="__nova">+ Nova categoria...</option>
            </select>
          </Campo>
          {categoriaId === "__nova" && (
            <Campo rotulo="Nome da nova categoria">
              <input autoFocus value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Ex.: Security Champion" />
            </Campo>
          )}
        </div>
        <div className="linha-campos">
          <Campo rotulo="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUS.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo={`Prioridade: ${prioridade}`} dica="1 = pode esperar · 10 = urgente">
            <input type="range" min={1} max={10} value={prioridade} onChange={(e) => setPrioridade(+e.target.value)} />
          </Campo>
          <Campo rotulo="Prazo">
            <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Descrição / objetivo">
          <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que precisa ser entregue, quem pediu, contexto..." />
        </Campo>
        <Campo rotulo="Tags" dica="Enter ou vírgula para adicionar">
          <ChipsInput valor={tags} mudar={setTags} sugestoes={todasTags} placeholder="Ex.: HT, Security Champion" />
        </Campo>
      </div>
    </Modal>
  );
}

// aplicarStatus mora em lib/acoes.ts; reexportado aqui para quem já importava deste arquivo.
export { aplicarStatus } from "@/lib/acoes";
