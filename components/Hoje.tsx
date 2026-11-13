"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNexo } from "./Provider";
import { CobrarTag, PrazoTag } from "./ui";
import { gravarPref, lerPref } from "@/lib/preferencias";
import {
  DIAS_PARADA, Passo, STATUS_ABERTOS, STATUS_ESPERA, Tarefa, diasAte, diasSemAtividade, estaParada, hojeMais, marcarPasso,
  nomeStatus, passosAbertos,
} from "@/lib/tipos";

// Bloco "Hoje" no topo do painel: em vez de mostrar todas as tarefas, mostra só o que pede
// uma ação agora. Cada seção responde a uma pergunta:
//   vencidos  -> o que já passou do prazo ou vence hoje (tarefas e passos)
//   cobrar    -> de quem está na hora de cobrar (cobrarEm chegou)
//   semana    -> o que vence nos próximos 7 dias
//   paradas   -> o que ficou esquecido (sem atividade há DIAS_PARADA dias)
//   semPasso  -> o que não tem próxima ação definida
type Item =
  | { tipo: "tarefa"; chave: string; t: Tarefa; extra: ReactNode }
  | { tipo: "passo"; chave: string; t: Tarefa; passo: Passo };

const LIMITE = 5;

export function Hoje() {
  const { dados, atualizarTarefa } = useNexo();
  const [aberto, setAberto] = useState(true);
  useEffect(() => setAberto(lerPref("hojeAberto", true)), []);

  const s = useMemo(() => {
    const abertas = dados!.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status)).sort((a, b) => b.prioridade - a.prioridade);
    const vencidos: Item[] = [], semana: Item[] = [], cobrar: Item[] = [], paradas: Item[] = [], semPasso: Item[] = [];
    for (const t of abertas) {
      const espera = STATUS_ESPERA.includes(t.status);
      const passos = passosAbertos(t);
      const noPrazo = (prazo: string | null | undefined, item: Item) => {
        if (!prazo) return;
        const d = diasAte(prazo)!;
        if (d <= 0) vencidos.push(item);
        else if (d <= 7) semana.push(item);
      };
      noPrazo(t.prazo, { tipo: "tarefa", chave: t.id, t, extra: <PrazoTag prazo={t.prazo} /> });
      for (const { passo } of passos) noPrazo(passo.prazo, { tipo: "passo", chave: passo.id, t, passo });

      if (espera && t.cobrarEm && diasAte(t.cobrarEm)! <= 0) cobrar.push({ tipo: "tarefa", chave: t.id, t, extra: null });

      if (estaParada(t))
        paradas.push({
          tipo: "tarefa", chave: t.id, t,
          extra: <span>{espera ? `${nomeStatus(t.status)}, sem data de cobrança · ` : ""}sem atividade há {diasSemAtividade(t)} dias</span>,
        });

      if (!espera && passos.length === 0)
        semPasso.push({ tipo: "tarefa", chave: t.id, t, extra: <span>{nomeStatus(t.status)} · prioridade {t.prioridade}</span> });
    }
    const porPrazo = (a: Item, b: Item) =>
      ((a.tipo === "passo" ? a.passo.prazo : a.t.prazo) ?? "").localeCompare((b.tipo === "passo" ? b.passo.prazo : b.t.prazo) ?? "");
    vencidos.sort(porPrazo);
    semana.sort(porPrazo);
    cobrar.sort((a, b) => (a.t.cobrarEm ?? "").localeCompare(b.t.cobrarEm ?? ""));
    paradas.sort((a, b) => diasSemAtividade(b.t) - diasSemAtividade(a.t));
    return { abertas: abertas.length, vencidos, semana, cobrar, paradas, semPasso };
  }, [dados]);

  if (!s.abertas) return null;
  const total = s.vencidos.length + s.cobrar.length + s.semana.length + s.paradas.length + s.semPasso.length;

  const concluir = (t: Tarefa, passoId: string) => atualizarTarefa(t.id, (x) => marcarPasso(x, passoId, true));
  const adiarCobranca = (t: Tarefa, dias: number) => {
    const quando = hojeMais(dias);
    atualizarTarefa(t.id, (x) => ({ ...x, cobrarEm: quando }));
  };

  return (
    <section className="hoje">
      <div className="hoje-topo">
        <h2>Hoje <span className="contador">{total}</span></h2>
        <button className="btn fantasma pequeno" onClick={() => { gravarPref("hojeAberto", !aberto); setAberto(!aberto); }}>
          {aberto ? "Esconder" : "Mostrar"}
        </button>
      </div>
      {aberto && (total === 0 ? (
        <p className="sutil hoje-vazio">Nada pedindo atenção agora: nenhum prazo próximo, nenhuma cobrança e nenhuma tarefa parada.</p>
      ) : (
        <div className="hoje-grade">
          <Secao titulo="Vencidos e para hoje" itens={s.vencidos} alerta concluir={concluir} />
          <Secao titulo="Cobrar" itens={s.cobrar} alerta concluir={concluir}
            acao={(t) => (
              <div className="hoje-acoes">
                <span className="sutil">Já cobrei, ver de novo em</span>
                <button className="btn pequeno" onClick={() => adiarCobranca(t, 3)}>3 dias</button>
                <button className="btn pequeno" onClick={() => adiarCobranca(t, 7)}>7 dias</button>
              </div>
            )}
            extra={(t) => <><span>⏳ {t.aguardandoQuem || "sem “aguardando quem”"}</span><CobrarTag data={t.cobrarEm} /></>} />
          <Secao titulo="Vence nos próximos 7 dias" itens={s.semana} concluir={concluir} />
          <Secao titulo={`Paradas há ${DIAS_PARADA} dias ou mais`} itens={s.paradas} concluir={concluir} />
          <Secao titulo="Sem próximo passo" dica="Tarefa aberta sem nenhuma pendência: qual é a próxima ação?" itens={s.semPasso} concluir={concluir} />
        </div>
      ))}
    </section>
  );
}

function Secao({
  titulo, dica, itens, alerta, concluir, acao, extra,
}: {
  titulo: string; dica?: string; itens: Item[]; alerta?: boolean;
  concluir: (t: Tarefa, passoId: string) => void;
  acao?: (t: Tarefa) => ReactNode; extra?: (t: Tarefa) => ReactNode;
}) {
  const [todos, setTodos] = useState(false);
  if (!itens.length) return null;
  const visiveis = todos ? itens : itens.slice(0, LIMITE);
  return (
    <div className={`caixa hoje-secao ${alerta ? "alerta" : ""}`}>
      <header><h3 title={dica}>{titulo} ({itens.length})</h3></header>
      <ul className="lista-limpa">
        {visiveis.map((i) =>
          i.tipo === "passo" ? (
            <li key={i.chave} className="passo">
              <input type="checkbox" checked={false} onChange={() => concluir(i.t, i.passo.id)} aria-label={`Concluir: ${i.passo.texto}`} />
              <span>
                {i.passo.texto}
                <small>
                  <PrazoTag prazo={i.passo.prazo ?? null} />
                  {i.passo.responsavel ? ` · ${i.passo.responsavel}` : ""} · <Link href={`/tarefas/${i.t.id}`}>{i.t.titulo}</Link>
                </small>
              </span>
            </li>
          ) : (
            <li key={i.chave} className="hoje-tarefa">
              <Link href={`/tarefas/${i.t.id}`}>{i.t.titulo}</Link>
              <div className="card-meta">{extra ? extra(i.t) : i.extra}</div>
              {acao?.(i.t)}
            </li>
          ),
        )}
      </ul>
      {itens.length > LIMITE && (
        <button className="mais" onClick={() => setTodos(!todos)}>{todos ? "Ver menos" : `Ver mais ${itens.length - LIMITE}`}</button>
      )}
    </div>
  );
}
