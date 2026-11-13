"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { Vazio } from "@/components/comum";
import { Registro, Tarefa, formatarData, ordenarRegistros, semAcento, tipoInfo } from "@/lib/tipos";

export default function Pessoas() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const params = useSearchParams();
  const router = useRouter();
  const sel = params.get("p");
  const [filtro, setFiltro] = useState("");

  const pessoas = useMemo(() => {
    const m = new Map<string, { nome: string; regs: { t: Tarefa; r: Registro }[]; tarefas: Set<string> }>();
    for (const t of dados!.tarefas)
      for (const r of t.registros)
        for (const p of r.participantes) {
          const k = semAcento(p.trim());
          if (!m.has(k)) m.set(k, { nome: p.trim(), regs: [], tarefas: new Set() });
          const e = m.get(k)!;
          e.regs.push({ t, r });
          e.tarefas.add(t.id);
        }
    return [...m.values()]
      .map((e) => ({ ...e, ultima: e.regs.map((x) => x.r.data).sort().pop()! }))
      .sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [dados]);

  const atual = sel ? pessoas.find((p) => semAcento(p.nome) === semAcento(sel)) : null;

  if (atual) {
    const regs = [...atual.regs].sort((a, b) => b.r.data.localeCompare(a.r.data));
    return (
      <>
        <div className="migalha"><Link href="/pessoas">Pessoas</Link> /</div>
        <div className="cabecalho">
          <div>
            <h1>{atual.nome}</h1>
            <p>{atual.regs.length} registro(s) em {atual.tarefas.size} tarefa(s). Último contato em {formatarData(atual.ultima)}.</p>
          </div>
        </div>
        {regs.map(({ t, r }) => (
          <Link key={t.id + r.id} href={`/tarefas/${t.id}`} className="resultado">
            <div className="reg-data">{formatarData(r.data)} <span className="reg-tipo">{tipoInfo(r.tipo).nome}</span> <span>{t.titulo}</span></div>
            {r.titulo && <h3>{r.titulo}</h3>}
            <div className="trecho">{(r.resumoIA || r.anotacoes).slice(0, 280)}</div>
          </Link>
        ))}
      </>
    );
  }

  const lista = pessoas.filter((p) => !filtro || semAcento(p.nome).includes(semAcento(filtro)));
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Pessoas</h1>
          <p>Todo mundo que apareceu nas suas reuniões e registros. Bom para lembrar “o que eu falei com fulano?”.</p>
        </div>
      </div>
      <div className="filtros"><input placeholder="Filtrar por nome..." value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
      {lista.length === 0 ? <Vazio titulo="Ninguém por aqui ainda">Os participantes dos registros aparecem aqui automaticamente.</Vazio> : (
        <table className="tabela">
          <thead><tr><th>Nome</th><th>Registros</th><th>Tarefas</th><th>Último contato</th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.nome} className="clicavel" onClick={() => router.push(`/pessoas?p=${encodeURIComponent(p.nome)}`)}>
                <td><strong>{p.nome}</strong></td>
                <td>{p.regs.length}</td>
                <td>{[...p.tarefas].map((id) => dados!.tarefas.find((t) => t.id === id)?.titulo).slice(0, 3).join(", ")}{p.tarefas.size > 3 ? "..." : ""}</td>
                <td>{formatarData(p.ultima)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
