"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { CobrarTag, PrazoTag, Vazio } from "@/components/ui";
import { lerMeusNomes } from "@/lib/preferencias";
import {
  Registro, STATUS_ABERTOS, STATUS_ESPERA, Tarefa, ehMeu, formatarData, passosAbertos, semAcento, tipoInfo,
} from "@/lib/tipos";

export default function Pessoas() {
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados } = useNexo();
  const params = useSearchParams();
  const router = useRouter();
  const sel = params.get("p");
  const [filtro, setFiltro] = useState("");
  const [meusNomes, setMeusNomes] = useState<string[]>([]);
  useEffect(() => setMeusNomes(lerMeusNomes()), []);

  const pessoas = useMemo(() => {
    const m = new Map<string, { nome: string; regs: { t: Tarefa; r: Registro }[]; tarefas: Set<string>; abertos: number }>();
    const pessoa = (nome: string) => {
      const k = semAcento(nome.trim());
      if (!m.has(k)) m.set(k, { nome: nome.trim(), regs: [], tarefas: new Set(), abertos: 0 });
      return m.get(k)!;
    };
    for (const t of dados!.tarefas) {
      for (const r of t.registros)
        for (const p of r.participantes) {
          if (!p.trim()) continue;
          const e = pessoa(p);
          e.regs.push({ t, r });
          e.tarefas.add(t.id);
        }
      // quem está com algo em aberto também é "pessoa", mesmo sem ter ido a nenhuma reunião
      if (!STATUS_ABERTOS.includes(t.status)) continue;
      for (const { passo } of passosAbertos(t)) {
        if (ehMeu(passo.responsavel, meusNomes)) continue;
        const e = pessoa(passo.responsavel!);
        e.abertos++;
        e.tarefas.add(t.id);
      }
      if (STATUS_ESPERA.includes(t.status) && t.aguardandoQuem?.trim()) {
        const e = pessoa(t.aguardandoQuem);
        e.abertos++;
        e.tarefas.add(t.id);
      }
    }
    return [...m.values()]
      .map((e) => ({ ...e, ultima: e.regs.map((x) => x.r.data).sort().pop() ?? "" }))
      .sort((a, b) => b.ultima.localeCompare(a.ultima) || b.abertos - a.abertos);
  }, [dados, meusNomes]);

  const atual = sel ? pessoas.find((p) => semAcento(p.nome) === semAcento(sel)) : null;

  if (atual) {
    const regs = [...atual.regs].sort((a, b) => b.r.data.localeCompare(a.r.data));
    // o que está na mão desta pessoa: passos em que ela é a responsável e tarefas paradas com ela
    const k = semAcento(atual.nome);
    const abertas = dados!.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
    const devendo = abertas.flatMap((t) =>
      passosAbertos(t).filter((x) => semAcento((x.passo.responsavel || "").trim()) === k).map((x) => ({ t, ...x })));
    const paradas = abertas.filter((t) => STATUS_ESPERA.includes(t.status) && semAcento((t.aguardandoQuem || "").trim()) === k);
    return (
      <>
        <div className="migalha"><Link href="/pessoas">Pessoas</Link> /</div>
        <div className="cabecalho">
          <div>
            <h1>{atual.nome}</h1>
            <p>
              {atual.regs.length
                ? `${atual.regs.length} registro(s) em ${atual.tarefas.size} tarefa(s). Último contato em ${formatarData(atual.ultima)}.`
                : "Ainda não apareceu como participante em nenhum registro."}
            </p>
          </div>
        </div>
        {(devendo.length > 0 || paradas.length > 0) && (
          <div className="caixa" style={{ marginBottom: 16 }}>
            <header><h3>Em aberto com {atual.nome} ({devendo.length + paradas.length})</h3></header>
            <ul className="lista-limpa" style={{ gap: 8 }}>
              {paradas.map((t) => (
                <li key={t.id} className="passo">
                  <span>
                    <Link href={`/tarefas/${t.id}`}>Tarefa parada: {t.titulo}</Link>
                    <small>{t.cobrarEm ? <CobrarTag data={t.cobrarEm} /> : "sem data de cobrança"}</small>
                  </span>
                </li>
              ))}
              {devendo.map(({ t, passo, desde }) => (
                <li key={passo.id} className="passo">
                  <span>
                    {passo.texto}
                    <small>
                      {passo.prazo && <><PrazoTag prazo={passo.prazo} /> · </>}
                      <Link href={`/tarefas/${t.id}`}>{t.titulo}</Link> · desde {formatarData(desde)}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          <thead><tr><th>Nome</th><th>Registros</th><th>Em aberto com a pessoa</th><th>Tarefas</th><th>Último contato</th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.nome} className="clicavel" onClick={() => router.push(`/pessoas?p=${encodeURIComponent(p.nome)}`)}>
                <td><strong>{p.nome}</strong></td>
                <td>{p.regs.length}</td>
                <td>{p.abertos || ""}</td>
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
