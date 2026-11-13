"use client";

import { useState } from "react";
import { useNexo } from "./Provider";
import { PrazoTag } from "./ui";
import { Passo, Tarefa, agoraISO, formatarData, mapearPassos, marcarPasso, normalizarPasso, novoId, passosAbertos } from "@/lib/tipos";

// Caixa "Pendências" da página da tarefa. Lista os passos em aberto (dos registros e avulsos),
// deixa criar uma pendência direto na tarefa, sem precisar de um registro, e editar
// texto, responsável e prazo de qualquer passo ali mesmo.
export function PassosTarefa({ tarefa, pessoas }: { tarefa: Tarefa; pessoas: string[] }) {
  const { atualizarTarefa } = useNexo();
  const [editando, setEditando] = useState<string | null>(null); // id do passo, ou "novo"
  const [verFeitas, setVerFeitas] = useState(false);
  const abertos = passosAbertos(tarefa);
  const avulsasFeitas = (tarefa.passos ?? []).filter((p) => p.feito);

  const marcar = (passoId: string, feito: boolean) => atualizarTarefa(tarefa.id, (t) => marcarPasso(t, passoId, feito));

  async function salvar(id: string | null, campos: { texto: string; responsavel: string; prazo: string | null }) {
    const ok = await atualizarTarefa(tarefa.id, (t) =>
      id
        ? mapearPassos(t, (p) => (p.id === id ? { ...p, ...campos } : p))
        : { ...t, passos: [...(t.passos ?? []), normalizarPasso({ id: novoId("p"), ...campos, criadoEm: agoraISO() })] },
    );
    if (ok) setEditando(null);
  }

  // Pendência avulsa removida não some: vai para passosRemovidos[] dentro da própria tarefa.
  async function remover(p: Passo) {
    if (!confirm("Remover esta pendência?")) return;
    const ok = await atualizarTarefa(tarefa.id, (t) => ({
      ...t,
      passos: (t.passos ?? []).filter((x) => x.id !== p.id),
      passosRemovidos: [...((t.passosRemovidos as Passo[]) || []), { ...p, removidoEm: agoraISO() }],
    }));
    if (ok) setEditando(null);
  }

  return (
    <div className="caixa">
      <header>
        <h3>Pendências ({abertos.length})</h3>
        {editando !== "novo" && <button className="btn pequeno" onClick={() => setEditando("novo")}>+ Adicionar</button>}
      </header>
      {editando === "novo" && (
        <FormPasso pessoas={pessoas} salvar={(c) => salvar(null, c)} cancelar={() => setEditando(null)} />
      )}
      {abertos.length === 0 && editando !== "novo" ? (
        <p className="sutil" style={{ margin: 0, fontSize: 13 }}>Nenhum passo em aberto.</p>
      ) : (
        <ul className="lista-limpa">
          {abertos.map(({ registro, passo, desde }) =>
            editando === passo.id ? (
              <li key={passo.id}>
                <FormPasso passo={passo} pessoas={pessoas} salvar={(c) => salvar(passo.id, c)} cancelar={() => setEditando(null)}
                  remover={registro ? undefined : () => remover(passo)} />
              </li>
            ) : (
              <li key={passo.id} className="passo">
                <input type="checkbox" checked={false} onChange={() => marcar(passo.id, true)} />
                <span>
                  {passo.texto}
                  <small>
                    {passo.responsavel ? `${passo.responsavel} · ` : ""}
                    {passo.prazo && <><PrazoTag prazo={passo.prazo} /> · </>}
                    {registro ? "desde" : "avulsa, desde"} {formatarData(desde)}
                  </small>
                </span>
                <button className="btn-icone" title="Editar texto, responsável e prazo" onClick={() => setEditando(passo.id)}>✎</button>
              </li>
            ),
          )}
        </ul>
      )}
      {avulsasFeitas.length > 0 && (
        <>
          <button className="mais" onClick={() => setVerFeitas(!verFeitas)}>
            {verFeitas ? "Esconder" : "Ver"} {avulsasFeitas.length} avulsa{avulsasFeitas.length > 1 ? "s" : ""} concluída{avulsasFeitas.length > 1 ? "s" : ""}
          </button>
          {verFeitas && (
            <ul className="lista-limpa" style={{ marginTop: 8 }}>
              {avulsasFeitas.map((p) => (
                <li key={p.id} className="passo feito">
                  <input type="checkbox" checked onChange={() => marcar(p.id, false)} />
                  <span>{p.texto}{p.responsavel && <small>{p.responsavel}</small>}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FormPasso({
  passo, pessoas, salvar, cancelar, remover,
}: {
  passo?: Passo; pessoas: string[];
  salvar: (c: { texto: string; responsavel: string; prazo: string | null }) => void;
  cancelar: () => void; remover?: () => void;
}) {
  const [texto, setTexto] = useState(passo?.texto ?? "");
  const [responsavel, setResponsavel] = useState(passo?.responsavel ?? "");
  const [prazo, setPrazo] = useState(passo?.prazo ?? "");
  const enviar = () => texto.trim() && salvar({ texto: texto.trim(), responsavel: responsavel.trim(), prazo: prazo || null });
  return (
    <div className="form-passo">
      <input autoFocus type="text" value={texto} placeholder="O que precisa ser feito" aria-label="Pendência"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") enviar(); else if (e.key === "Escape" && !texto.trim()) cancelar(); }} />
      <div className="form-passo-extra">
        <input type="text" value={responsavel} placeholder="Quem" aria-label="Responsável" list="pessoas-passos"
          onChange={(e) => setResponsavel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} />
        <input type="date" value={prazo} aria-label="Prazo" title="Prazo" onChange={(e) => setPrazo(e.target.value)} />
      </div>
      <datalist id="pessoas-passos">{["Eu", ...pessoas].map((p) => <option key={p} value={p} />)}</datalist>
      <div className="acoes">
        <button className="btn pequeno primario" disabled={!texto.trim()} onClick={enviar}>{passo ? "Salvar" : "Adicionar"}</button>
        <button className="btn pequeno" onClick={cancelar}>Cancelar</button>
        {remover && <button className="btn pequeno fantasma perigo" onClick={remover}>Remover</button>}
      </div>
    </div>
  );
}
