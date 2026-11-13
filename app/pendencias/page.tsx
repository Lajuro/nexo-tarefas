"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { CatTag, PrazoTag, PrioBadge, StatusBadge, Vazio } from "@/components/comum";
import { STATUS_ABERTOS, agoraISO, diasAte, formatarData, passosAbertos } from "@/lib/tipos";

export default function Pendencias() {
  const { dados, atualizarTarefa } = useNexo();
  const [soMeus, setSoMeus] = useState(false);
  const cats = dados!.categorias.items;

  const grupos = useMemo(
    () =>
      dados!.tarefas
        .filter((t) => STATUS_ABERTOS.includes(t.status))
        .map((t) => ({
          t,
          itens: passosAbertos(t).filter(({ passo }) =>
            !soMeus || !passo.responsavel || /^(eu|eu mesmo|eu mesma|me|mim)$/i.test(passo.responsavel.trim())),
        }))
        .filter((g) => g.itens.length)
        .sort((a, b) => b.t.prioridade - a.t.prioridade),
    [dados, soMeus],
  );

  const prazos = useMemo(
    () => dados!.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status) && t.prazo).sort((a, b) => a.prazo!.localeCompare(b.prazo!)),
    [dados],
  );

  const concluir = (tid: string, rid: string, pid: string) =>
    atualizarTarefa(tid, (t) => ({
      ...t,
      registros: t.registros.map((r) => r.id !== rid ? r : {
        ...r, proximosPassos: r.proximosPassos.map((p) => (p.id === pid ? { ...p, feito: true, feitoEm: agoraISO() } : p)),
      }),
    }));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Pendências</h1>
          <p>Todos os próximos passos em aberto, de todas as tarefas.</p>
        </div>
        <label className="acoes" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} />
          Só os meus (sem responsável ou “Eu”)
        </label>
      </div>
      <div className="dois-col" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
        <div>
          {grupos.length === 0 ? <Vazio titulo="Nenhuma pendência em aberto 🎉" /> : grupos.map(({ t, itens }) => (
            <div key={t.id} className="grupo">
              <header>
                <Link href={`/tarefas/${t.id}`}>
                  <CatTag cat={cats.find((c) => c.id === t.categoriaId)} />
                  <h3>{t.titulo}</h3>
                </Link>
                <div className="acoes"><StatusBadge status={t.status} /><PrioBadge p={t.prioridade} /></div>
              </header>
              <ul className="lista-limpa">
                {itens.map(({ registro, passo }) => (
                  <li key={passo.id} className="passo">
                    <input type="checkbox" checked={false} onChange={() => concluir(t.id, registro.id, passo.id)} />
                    <span>
                      {passo.texto}
                      <small>
                        {passo.responsavel ? `${passo.responsavel} · ` : ""}
                        de {formatarData(registro.data)}{registro.titulo ? ` (${registro.titulo})` : ""}
                        {` · há ${Math.max(0, -diasAte(registro.data)!)} dias`}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="caixa">
          <header><h3>Prazos</h3></header>
          {prazos.length === 0 ? <p className="sutil" style={{ margin: 0 }}>Nenhuma tarefa aberta com prazo.</p> : (
            <ul className="lista-limpa" style={{ gap: 10 }}>
              {prazos.map((t) => (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} style={{ fontWeight: 600, fontSize: 13 }}>{t.titulo}</Link>
                  <div><PrazoTag prazo={t.prazo} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
