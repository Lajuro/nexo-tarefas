"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNexo } from "./Provider";
import { Campo, ChipsInput, Modal, copiarTexto } from "./ui";
import { aplicarStatus } from "./TarefaForm";
import { interpretarResposta, mesmoTexto, promptRegistro } from "@/lib/prompts";
import { apagarRascunho, gravarRascunho, lerRascunho } from "@/lib/rascunhos";
import {
  Passo, Registro, STATUS, Status, TIPOS_REGISTRO, Tarefa, TipoRegistro, agoraISO, formatarDataHora, hojeISO,
  mapearPassos, normalizarPasso, normalizarRegistro, novoId, passosAbertos,
} from "@/lib/tipos";

interface Props {
  aberto: boolean; fechar: () => void; tarefa: Tarefa; registro?: Registro | null; tipoInicial?: TipoRegistro;
}

// Tudo o que o editor guarda enquanto está aberto. É o que vai para o rascunho.
interface Edicao {
  r: Registro; colado: string; status: Status; prioridade: number; prazo: string; concluir: string[];
}

const foto = (e: Edicao) =>
  JSON.stringify({ r: e.r, colado: e.colado, status: e.status, prioridade: e.prioridade, prazo: e.prazo, concluir: e.concluir });

// O editor só é montado quando abre: o estado inicial vem do rascunho (se houver) ou do registro.
export function RegistroEditor(props: Props) {
  if (!props.aberto) return null;
  return <Editor key={props.registro?.id ?? "novo"} {...props} />;
}

function Editor({ fechar, tarefa, registro, tipoInicial = "reuniao" }: Props) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const regId = registro?.id ?? null;
  const [ini] = useState(() => {
    const base: Edicao = {
      r: registro ? structuredClone(registro) : normalizarRegistro({ tipo: tipoInicial, data: hojeISO() }),
      colado: registro?.respostaIABruta ?? "",
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      prazo: tarefa.prazo ?? "",
      concluir: [],
    };
    const lido = lerRascunho(tarefa.id, regId);
    const rasc = lido && (!registro || lido.r.id === registro.id) ? lido : null;
    const atual: Edicao = rasc
      ? {
          r: rasc.r,
          colado: rasc.colado,
          status: rasc.status ?? base.status,
          prioridade: rasc.prioridade ?? base.prioridade,
          prazo: rasc.prazo ?? base.prazo,
          concluir: rasc.concluir,
        }
      : structuredClone(base);
    return { base, atual, rasc, fotoBase: foto(base), fotoRasc: rasc ? foto(atual) : null };
  });
  const [r, setR] = useState<Registro>(ini.atual.r);
  const [colado, setColado] = useState(ini.atual.colado);
  const [status, setStatus] = useState<Status>(ini.atual.status);
  const [prioridade, setPrioridade] = useState(ini.atual.prioridade);
  const [prazo, setPrazo] = useState(ini.atual.prazo);
  const [concluir, setConcluir] = useState<string[]>(ini.atual.concluir);
  const [salvando, setSalvando] = useState(false);
  const [recuperado, setRecuperado] = useState(Boolean(ini.rasc));
  const [rascunhoOk, setRascunhoOk] = useState(true);
  const gravada = useRef<string | null>(ini.fotoRasc);
  const encerrado = useRef(false); // salvo ou descartado: não recria o rascunho

  const fotoAtual = foto({ r, colado, status, prioridade, prazo, concluir });
  const sujo = fotoAtual !== ini.fotoBase;

  // Rascunho automático: a cada mudança, guarda no navegador o que ainda não foi salvo.
  useEffect(() => {
    if (encerrado.current) return;
    if (!sujo) {
      apagarRascunho(tarefa.id, regId);
      gravada.current = null;
      return;
    }
    if (gravada.current === fotoAtual) return;
    const e = JSON.parse(fotoAtual) as Edicao;
    const ok = gravarRascunho({
      tarefaId: tarefa.id,
      registroId: regId,
      r: e.r,
      colado: e.colado,
      status: e.status !== ini.base.status ? e.status : undefined,
      prioridade: e.prioridade !== ini.base.prioridade ? e.prioridade : undefined,
      prazo: e.prazo !== ini.base.prazo ? e.prazo : undefined,
      concluir: e.concluir,
      baseAtualizadoEm: registro?.atualizadoEm ?? null,
    });
    gravada.current = ok ? fotoAtual : null;
    setRascunhoOk(ok);
  }, [fotoAtual, sujo, tarefa.id, regId, ini, registro?.atualizadoEm]);

  const set = <K extends keyof Registro>(k: K, v: Registro[K]) => setR((x) => ({ ...x, [k]: v }));
  const cat = dados?.categorias.items.find((c) => c.id === tarefa.categoriaId);

  const pessoas = useMemo(() => {
    const s = new Set<string>();
    for (const t of dados?.tarefas ?? []) for (const reg of t.registros) reg.participantes.forEach((p) => s.add(p));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [dados?.tarefas]);

  const abertosOutros = passosAbertos(tarefa).filter((x) => x.registro?.id !== r.id);
  const registroMudou = Boolean(registro && ini.rasc?.baseAtualizadoEm && ini.rasc.baseAtualizadoEm !== registro.atualizadoEm);

  // Esc, clique fora, ✕ e o botão Fechar: nada se perde, o rascunho fica guardado.
  function fecharEditor() {
    if (sujo && !rascunhoOk) {
      if (!confirm("Não consegui guardar o rascunho neste navegador. Fechar mesmo assim e perder o que você digitou?")) return;
    } else if (sujo) {
      toast("Rascunho guardado. Ele volta quando você abrir o editor de novo.");
    }
    fechar();
  }

  function descartar(fecharDepois: boolean) {
    if (!confirm("Descartar o que você digitou neste registro? Não dá pra desfazer.")) return;
    apagarRascunho(tarefa.id, regId);
    gravada.current = null;
    if (fecharDepois) {
      encerrado.current = true;
      fechar();
      return;
    }
    const b = structuredClone(ini.base);
    setR(b.r);
    setColado(b.colado);
    setStatus(b.status);
    setPrioridade(b.prioridade);
    setPrazo(b.prazo);
    setConcluir(b.concluir);
    setRecuperado(false);
  }

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
        j === i ? { ...p, [campo]: campo === "prazo" ? v || null : v, ...(campo === "feito" ? { feitoEm: v ? agoraISO() : null } : {}) } : p,
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
      // Decide pelo que está no disco agora: se o registro já existe, troca; se não, acrescenta.
      const regs = t.registros.some((x) => x.id === novo.id)
        ? t.registros.map((x) => (x.id === novo.id ? novo : x))
        : [...t.registros, novo];
      // passos antigos resolvidos aqui (de outros registros ou avulsos)
      const comConcluidos = mapearPassos({ ...t, registros: regs }, (p) =>
        concluir.includes(p.id) ? { ...p, feito: true, feitoEm: agoraISO() } : p,
      );
      // mudança de status vira um marco próprio na timeline (ex.: o card "Concluída")
      return aplicarStatus({ ...comConcluidos, prioridade, prazo: prazo || null }, status, t);
    });
    setSalvando(false);
    if (ok) {
      encerrado.current = true;
      apagarRascunho(tarefa.id, regId);
      toast("Registro salvo.");
      fechar();
    }
  }

  return (
    <Modal
      titulo={registro ? "Editar registro" : "Novo registro na timeline"}
      aberto
      fechar={fecharEditor}
      largo
      rodape={
        <>
          {sujo && (
            <span className="rascunho-estado">
              {rascunhoOk ? "Rascunho guardado neste navegador" : "Atenção: o rascunho não está sendo guardado"}
            </span>
          )}
          {sujo && <button className="btn fantasma perigo" onClick={() => descartar(true)}>Descartar</button>}
          <button className="btn" onClick={fecharEditor}>{sujo ? "Fechar e continuar depois" : "Cancelar"}</button>
          <button className="btn primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar registro"}
          </button>
        </>
      }
    >
      {recuperado && ini.rasc && (
        <div className="aviso info rascunho-aviso">
          <span>
            Continuando o rascunho de {formatarDataHora(ini.rasc.salvoEm)}, que não tinha sido salvo.
            {registroMudou && " O registro foi alterado depois disso: salvar grava a versão do rascunho."}
          </span>
          <button className="btn pequeno" onClick={() => descartar(false)}>Descartar rascunho</button>
        </div>
      )}
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
                  <div className="editor-passo-campos">
                    <input type="text" value={p.texto} onChange={(e) => mudarPasso(i, "texto", e.target.value)} placeholder="Ação" />
                    <div className="editor-passo-extra">
                      <input type="text" className="resp" value={p.responsavel || ""} list="pessoas-lista"
                        onChange={(e) => mudarPasso(i, "responsavel", e.target.value)} placeholder="Quem" />
                      <input type="date" value={p.prazo || ""} aria-label="Prazo do passo" title="Prazo do passo"
                        onChange={(e) => mudarPasso(i, "prazo", e.target.value)} />
                    </div>
                  </div>
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

