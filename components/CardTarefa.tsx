"use client";

import Link from "next/link";
import { CatTag, CobrarTag, PrazoTag, PrioBadge, StatusBadge } from "./ui";
import { Categoria, STATUS_ABERTOS, STATUS_ESPERA, Tarefa, diasSemAtividade, estaParada, formatarData, passosAbertos, tipoInfo, ultimoRegistro } from "@/lib/tipos";

export function CardTarefa({ t, cat }: { t: Tarefa; cat?: Categoria | null }) {
  const ult = ultimoRegistro(t);
  const pend = passosAbertos(t).length;
  const aberta = STATUS_ABERTOS.includes(t.status);
  const reunioes = t.registros.filter((r) => r.tipo === "reuniao").length;
  return (
    <Link href={`/tarefas/${t.id}`} className={`card-tarefa ${aberta ? "" : "fechada"}`}
      style={{ "--cor": cat?.cor } as React.CSSProperties}>
      <div className="card-topo">
        <div>
          <CatTag cat={cat} />
          <h3>{t.titulo}</h3>
        </div>
        <PrioBadge p={t.prioridade} />
      </div>
      <div className="card-meta">
        <StatusBadge status={t.status} />
        <PrazoTag prazo={t.prazo} concluida={!aberta} />
        {reunioes > 0 && <span>👥 {reunioes}</span>}
        {pend > 0 && <span>☐ {pend} pendente{pend > 1 ? "s" : ""}</span>}
        {STATUS_ESPERA.includes(t.status) && t.aguardandoQuem && <span>⏳ {t.aguardandoQuem}</span>}
        {STATUS_ESPERA.includes(t.status) && <CobrarTag data={t.cobrarEm} />}
        {estaParada(t) && <span title="Dias desde o último registro ou passo concluído">💤 parada há {diasSemAtividade(t)}d</span>}
      </div>
      {ult && (
        <div className="card-ultimo">
          {formatarData(ult.data)} · {tipoInfo(ult.tipo).nome}
          {ult.titulo ? `: ${ult.titulo}` : ""}
          {ult.resumoIA ? ` · ${ult.resumoIA}` : ""}
        </div>
      )}
    </Link>
  );
}
