"use client";

import { useEffect, useMemo, useState } from "react";
import { useNexo } from "./Provider";
import { Campo, ChipsInput, Modal, copiarTexto } from "./ui";
import { aplicarStatus } from "./TarefaForm";
import { interpretarResposta, mesmoTexto, promptRegistro } from "@/lib/prompts";
import {
  Passo, Registro, STATUS, Status, TIPOS_REGISTRO, Tarefa, TipoRegistro, agoraISO, hojeISO,
  normalizarPasso, normalizarRegistro, novoId, passosAbertos,
} from "@/lib/tipos";

export function RegistroEditor({
  aberto, fechar, tarefa, registro, tipoInicial = "reuniao",
}: {
  aberto: boolean; fechar: () => void; tarefa: Tarefa; registro?: Registro | null; tipoInicial?: TipoRegistro;
}) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const [r, setR] = useState<Registro>(() => normalizarRegistro({}));
  const [colado, setColado] = useState("");
  const [status, setStatus] = useState<Status>(tarefa.status);
  const [prioridade, setPrioridade] = useState(tarefa.prioridade);
  const [prazo, setPrazo] = useState(tarefa.prazo ?? "");
  const [concluir, setConcluir] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setR(registro ? structuredClone(registro) : normalizarRegistro({ tipo: tipoInicial, data: hojeISO() }));
    setColado(registro?.respostaIABruta ?? "");
    setStatus(tarefa.status);
    setPrioridade(tarefa.prioridade);
    setPrazo(tarefa.prazo ?? "");
    setConcluir([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, registro?.id]);

  const set = <K extends keyof Registro>(k: K, v: Registro[K]) => setR((x) => ({ ...x, [k]: v }));
  const cat = dados?.categorias.items.find((c) => c.id === tarefa.categoriaId);

  const pessoas = useMemo(() => {
    const s = new Set<string>();
    for (const t of dados?.tarefas ?? []) for (const reg of t.registros) reg.participantes.forEach((p) => s.add(p));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [dados?.tarefas]);

  const abertosOutros = passosAbertos(tarefa).filter((x) => x.registro.id !== r.id);

  async function copiarPrompt() {
    if (!r.anotacoes.trim()) toast("Dica: escreva suas anotações brutas antes, o prompt usa elas.", "erro");
    const ok = await copiarTexto(promptRegistro(tarefa, cat, r));
    if (ok) toast("Prompt copiado. Cole no Copilot e traga a resposta pra cá.");
  }

  function preencher() {
    const res = interpretarResposta(colado);
    setR((x) => ({
      ...x,
      respostaIABruta: colado,
      resumoIA: res.resumo || x.resumoIA,
      decisoes: res.decisoes || x.decisoes,
      impedimentos: res.impedimentos || x.impedimentos,
      participantes: [...new Set([...x.participantes, ...res.participantes])],
      proximosPassos: [
        ...x.proximosPassos,
        ...res.passos
          .filter((p) => !x.proximosPassos.some((q) => mesmoTexto(q.texto, p.texto)))
          .map((p) => normalizarPasso({ texto: p.texto, responsavel: p.responsavel })),
      ],
    }));
    const ids = abertosOutros.filter((a) => res.concluidos.some((c) => mesmoTexto(c, a.passo.texto))).map((a) => a.passo.id);
    setConcluir(ids);
    toast(
      res.reconheceu
        ? `Campos preenchidos${ids.length ? ` e ${ids.length} passo(s) antigo(s) marcados para concluir` : ""}. Revise antes de salvar.`
        : "Não achei as seções do formato. Coloquei tudo no resumo.",
      res.reconheceu ? "ok" : "erro",
    );
  }

  function mudarPasso(i: number, campo: keyof Passo, v: string | boolean) {
    setR((x) => ({
      ...x,
      proximosPassos: x.proximosPassos.map((p, j) =>
        j === i ? { ...p, [campo]: v, ...(campo === "feito" ? { feitoEm: v ? agoraISO() : null } : {}) } : p,
      ),
    }));
  }

  async function salvar() {
    setSalvando(true);
    const novo: Registro = {
      ...r,
      proximosPassos: r.proximosPassos.filter((p) => p.texto.trim()),
      atualizadoEm: agoraISO(),
    };
    const alteracoes: Registro["alteracoes"] = { ...(registro?.alteracoes || {}) };
    if (prioridade !== tarefa.prioridade) alteracoes.prioridade = { de: tarefa.prioridade, para: prioridade };
    if ((prazo || null) !== tarefa.prazo) alteracoes.prazo = { de: tarefa.prazo, para: prazo || null };
    novo.alteracoes = alteracoes;

    const ok = await atualizarTarefa(tarefa.id, (t) => {
      const regs = registro ? t.registros.map((x) => (x.id === registro.id ? novo : x)) : [...t.registros, novo];
      const regsComConcluidos = regs.map((x) => ({
        ...x,
        proximosPassos: x.proximosPassos.map((p) =>
          concluir.includes(p.id) ? { ...p, feito: true, feitoEm: agoraISO() } : p,
        ),
      }));
      // mudança de status vira um marco próprio na timeline (ex.: o card "Concluída")
      return aplicarStatus({ ...t, registros: regsComConcluidos, prioridade, prazo: prazo || null }, status, t);
    });
    setSalvando(false);
    if (ok) {
      toast("Registro salvo.");
      fechar();
    }
  }

  return (
    <Modal
      titulo={registro ? "Editar registro" : "Novo registro na timeline"}
      aberto={aberto}
      fechar={fechar}
      largo
      rodape={
        <>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar registro"}
          </button>
        </>
      }
    >
      <div className="editor-grid">
        <div>
          <div className="segmentado">
            {TIPOS_REGISTRO.filter((t) => t.id !== "marco" || r.tipo === "marco").map((t) => (
              <button key={t.id} className={r.tipo === t.id ? "ativo" : ""} onClick={() => set("tipo", t.id)}>
                {t.icone} {t.nome}
              </button>
            ))}
          </div>
          <div className="linha-campos">
            <Campo rotulo="Data">
              <input type="date" value={r.data} onChange={(e) => set("data", e.target.value)} />
            </Campo>
            <Campo rotulo="Hora (opcional)">
              <input type="time" value={r.hora || ""} onChange={(e) => set("hora", e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Título">
            <input value={r.titulo} onChange={(e) => set("titulo", e.target.value)}
              placeholder={r.tipo === "reuniao" ? "Ex.: Alinhamento com o time de arquitetura" : "Resumo em uma linha"} />
          </Campo>
          <Campo rotulo="Participantes" dica="Enter para adicionar. Sugere nomes que já apareceram antes.">
            <ChipsInput valor={r.participantes} mudar={(v) => set("participantes", v)} sugestoes={pessoas} placeholder="Nomes" />
          </Campo>
          <Campo rotulo="Anotações brutas" dica="Escreva do seu jeito, rápido. A IA organiza depois.">
            <textarea rows={9} value={r.anotacoes} onChange={(e) => set("anotacoes", e.target.value)}
              placeholder="O que foi falado, combinado, o que ficou pendente..." />
          </Campo>

          <div className="passo-ia">
            <div className="titulo"><span className="num-passo">1</span> Copiar prompt com o contexto da tarefa</div>
            <button className="btn primario" onClick={copiarPrompt}>📋 Copiar prompt para o Copilot</button>
            <div className="titulo"><span className="num-passo">2</span> Colar a resposta do Copilot</div>
            <textarea rows={5} value={colado} onChange={(e) => setColado(e.target.value)} placeholder="Cole a resposta aqui..." />
            <div className="titulo"><span className="num-passo">3</span> Preencher os campos automaticamente</div>
            <button className="btn" disabled={!colado.trim()} onClick={preencher}>✨ Preencher campos com a resposta</button>
          </div>
        </div>

        <div>
          <Campo rotulo="Resumo">
            <textarea rows={5} value={r.resumoIA} onChange={(e) => set("resumoIA", e.target.value)}
              placeholder="Preenchido pela IA ou por você" />
          </Campo>
          <Campo rotulo="Decisões">
            <textarea rows={3} value={r.decisoes} onChange={(e) => set("decisoes", e.target.value)} />
          </Campo>
          <div className="campo">
            <span className="rotulo">Próximos passos</span>
            <div className="editor-passos">
              {r.proximosPassos.map((p, i) => (
                <div key={p.id} className="editor-passo">
                  <input type="checkbox" checked={p.feito} onChange={(e) => mudarPasso(i, "feito", e.target.checked)} />
                  <input type="text" value={p.texto} onChange={(e) => mudarPasso(i, "texto", e.target.value)} placeholder="Ação" />
                  <input type="text" className="resp" value={p.responsavel || ""} list="pessoas-lista"
                    onChange={(e) => mudarPasso(i, "responsavel", e.target.value)} placeholder="Quem" />
                  <button className="btn-icone" aria-label="Remover passo"
                    onClick={() => set("proximosPassos", r.proximosPassos.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <datalist id="pessoas-lista">{["Eu", ...pessoas].map((p) => <option key={p} value={p} />)}</datalist>
              <button className="btn pequeno" style={{ alignSelf: "flex-start" }}
                onClick={() => set("proximosPassos", [...r.proximosPassos, normalizarPasso({ id: novoId("p") })])}>
                + Passo
              </button>
            </div>
          </div>
          <Campo rotulo="Impedimentos">
            <textarea rows={2} value={r.impedimentos} onChange={(e) => set("impedimentos", e.target.value)} />
          </Campo>

          {abertosOutros.length > 0 && (
            <div className="campo">
              <span className="rotulo">Passos anteriores resolvidos aqui?</span>
              <ul className="lista-limpa">
                {abertosOutros.map(({ passo }) => (
                  <li key={passo.id} className="passo">
                    <input type="checkbox" checked={concluir.includes(passo.id)}
                      onChange={(e) => setConcluir((c) => (e.target.checked ? [...c, passo.id] : c.filter((x) => x !== passo.id)))} />
                    <span>{passo.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <hr className="separador" />
          <span className="rotulo">Atualizar a tarefa junto</span>
          <div className="linha-campos">
            <Campo rotulo="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {STATUS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo={`Prioridade: ${prioridade}`}>
              <input type="range" min={1} max={10} value={prioridade} onChange={(e) => setPrioridade(+e.target.value)} />
            </Campo>
            <Campo rotulo="Prazo">
              <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </Campo>
          </div>
        </div>
      </div>
    </Modal>
  );
}

