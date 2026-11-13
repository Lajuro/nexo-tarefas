"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { CatTag, CobrarTag, PrazoTag, PrioBadge, StatusBadge, Vazio } from "@/components/ui";
import { gravarPref, lerMeusNomes, lerPref } from "@/lib/preferencias";
import { STATUS_ABERTOS, STATUS_ESPERA, diasAte, ehMeu, formatarData, marcarPasso, passosAbertos } from "@/lib/tipos";

type Dono = "todos" | "meus" | "outros";

export default function Pendencias() {
  const { dados, atualizarTarefa } = useNexo();
  const [dono, setDono] = useState<Dono>("todos");
  const [meusNomes, setMeusNomes] = useState<string[]>([]);
  const cats = dados!.categorias.items;

  useEffect(() => {
    setDono(lerPref<Dono>("pendenciasDono", "todos"));
    setMeusNomes(lerMeusNomes());
  }, []);
  const mudarDono = (d: Dono) => { setDono(d); gravarPref("pendenciasDono", d); };

  const abertas = useMemo(() => dados!.tarefas.filter((t) => STATUS_ABERTOS.includes(t.status)), [dados]);

  const grupos = useMemo(
    () =>
      abertas
        .map((t) => ({
          t,
          itens: passosAbertos(t)
            .filter(({ passo }) => dono === "todos" || ehMeu(passo.responsavel, meusNomes) === (dono === "meus"))
            // com prazo primeiro (o mais próximo no topo), depois os mais antigos
            .sort((a, b) => (a.passo.prazo ?? "9999").localeCompare(b.passo.prazo ?? "9999") || a.desde.localeCompare(b.desde)),
        }))
        .filter((g) => g.itens.length)
        .sort((a, b) => b.t.prioridade - a.t.prioridade),
    [abertas, dono, meusNomes],
  );

  // tarefas paradas na mão de alguém: a cobrança mais próxima (ou vencida) primeiro
  const espera = useMemo(
    () => abertas.filter((t) => STATUS_ESPERA.includes(t.status)).sort((a, b) => (a.cobrarEm ?? "9999").localeCompare(b.cobrarEm ?? "9999")),
    [abertas],
  );

  // prazos de tarefas e de passos, juntos
  const prazos = useMemo(() => {
    const out: { chave: string; data: string; titulo: string; sub: string; href: string }[] = [];
    for (const t of abertas) {
      if (t.prazo) out.push({ chave: t.id, data: t.prazo, titulo: t.titulo, sub: "", href: `/tarefas/${t.id}` });
      for (const { passo } of passosAbertos(t))
        if (passo.prazo) out.push({ chave: passo.id, data: passo.prazo, titulo: passo.texto, sub: t.titulo, href: `/tarefas/${t.id}` });
    }
    return out.sort((a, b) => a.data.localeCompare(b.data));
  }, [abertas]);

  const concluir = (tid: string, pid: string) => atualizarTarefa(tid, (t) => marcarPasso(t, pid, true));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Pendências</h1>
          <p>Todos os próximos passos em aberto, de todas as tarefas.</p>
        </div>
        <div className="segmentado" role="group" aria-label="De quem">
          {(["todos", "meus", "outros"] as Dono[]).map((d) => (
            <button key={d} className={dono === d ? "ativo" : ""} onClick={() => mudarDono(d)}
              title={d === "meus" ? "Sem responsável, “Eu” ou um dos seus nomes (Configurações)" : undefined}>
              {{ todos: "Todos", meus: "Só os meus", outros: "De outras pessoas" }[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="dois-col" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
        <div>
          {grupos.length === 0 ? (
            <Vazio titulo={dono === "todos" ? "Nenhuma pendência em aberto 🎉" : "Nenhuma pendência com esse filtro"} />
          ) : grupos.map(({ t, itens }) => (
            <div key={t.id} className="grupo">
              <header>
                <Link href={`/tarefas/${t.id}`}>
                  <CatTag cat={cats.find((c) => c.id === t.categoriaId)} />
                  <h3>{t.titulo}</h3>
                </Link>
                <div className="acoes"><StatusBadge status={t.status} /><PrioBadge p={t.prioridade} /></div>
              </header>
              <ul className="lista-limpa">
                {itens.map(({ registro, passo, desde }) => (
                  <li key={passo.id} className="passo">
                    <input type="checkbox" checked={false} onChange={() => concluir(t.id, passo.id)} />
                    <span>
                      {passo.texto}
                      <small>
                        {passo.responsavel ? `${passo.responsavel} · ` : ""}
                        {passo.prazo && <><PrazoTag prazo={passo.prazo} /> · </>}
                        {registro
                          ? `de ${formatarData(registro.data)}${registro.titulo ? ` (${registro.titulo})` : ""}`
                          : `avulsa, de ${formatarData(desde)}`}
                        {` · há ${Math.max(0, -(diasAte(desde) ?? 0))} dias`}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="caixa">
            <header><h3>Aguardando terceiros ({espera.length})</h3></header>
            {espera.length === 0 ? <p className="sutil" style={{ margin: 0 }}>Nenhuma tarefa parada com outra pessoa.</p> : (
              <ul className="lista-limpa" style={{ gap: 10 }}>
                {espera.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tarefas/${t.id}`} style={{ fontWeight: 600, fontSize: 13 }}>{t.titulo}</Link>
                    <div className="card-meta">
                      <span>{t.aguardandoQuem ? `⏳ ${t.aguardandoQuem}` : "Sem “aguardando quem”"}</span>
                      {t.cobrarEm ? <CobrarTag data={t.cobrarEm} /> : <span>sem data de cobrança</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="caixa">
            <header><h3>Prazos</h3></header>
            {prazos.length === 0 ? <p className="sutil" style={{ margin: 0 }}>Nenhuma tarefa ou passo em aberto com prazo.</p> : (
              <ul className="lista-limpa" style={{ gap: 10 }}>
                {prazos.map((x) => (
                  <li key={x.chave}>
                    <Link href={x.href} style={{ fontWeight: 600, fontSize: 13 }}>{x.titulo}</Link>
                    <div className="card-meta"><PrazoTag prazo={x.data} />{x.sub && <span>passo de {x.sub}</span>}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
