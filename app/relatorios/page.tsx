"use client";

import { useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { Campo, copiarTexto } from "@/components/comum";
import { promptRelatorio } from "@/lib/prompts";
import { formatarData, hojeISO, tipoInfo } from "@/lib/tipos";

function diasAtras(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Relatorios() {
  const { dados, toast } = useNexo();
  const [inicio, setInicio] = useState(diasAtras(6));
  const [fim, setFim] = useState(hojeISO());
  const [cat, setCat] = useState("");
  const [foco, setFoco] = useState("");
  const [ver, setVer] = useState(false);

  const tarefas = dados!.tarefas.filter((t) => !cat || t.categoriaId === cat);
  const regs = useMemo(
    () => tarefas.flatMap((t) => t.registros.filter((r) => r.data >= inicio && r.data <= fim).map((r) => ({ t, r })))
      .sort((a, b) => a.r.data.localeCompare(b.r.data)),
    [tarefas, inicio, fim],
  );
  const prompt = promptRelatorio(tarefas, dados!.categorias.items, inicio, fim, foco);

  const atalho = (dias: number) => { setInicio(diasAtras(dias - 1)); setFim(hojeISO()); };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Relatórios</h1>
          <p>Junte tudo o que aconteceu num período e peça um relatório ao Copilot. Ótimo para 1:1 e status semanal.</p>
        </div>
      </div>
      <div className="caixa form" style={{ marginBottom: 16 }}>
        <div className="segmentado" style={{ alignSelf: "flex-start" }}>
          <button onClick={() => atalho(7)}>Últimos 7 dias</button>
          <button onClick={() => atalho(15)}>15 dias</button>
          <button onClick={() => atalho(30)}>30 dias</button>
          <button onClick={() => { const d = new Date(); setInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); setFim(hojeISO()); }}>Este mês</button>
        </div>
        <div className="linha-campos">
          <Campo rotulo="De"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
          <Campo rotulo="Até"><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></Campo>
          <Campo rotulo="Categoria">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas</option>
              {dados!.categorias.items.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Foco do relatório (opcional)">
          <input value={foco} onChange={(e) => setFoco(e.target.value)} placeholder="Ex.: para minha 1:1 com o gestor; destacar riscos" />
        </Campo>
        <div className="acoes">
          <button className="btn primario" disabled={!regs.length}
            onClick={async () => (await copiarTexto(prompt)) && toast("Prompt do relatório copiado.")}>
            📋 Copiar prompt ({regs.length} registros)
          </button>
          <button className="btn fantasma" onClick={() => setVer(!ver)}>{ver ? "Esconder" : "Ver"} prompt</button>
        </div>
        {ver && <div className="prompt-preview">{prompt}</div>}
      </div>

      <h2 style={{ marginBottom: 10 }}>O que entra no período</h2>
      {regs.length === 0 ? <p className="sutil">Nenhum registro entre {formatarData(inicio)} e {formatarData(fim)}.</p> : (
        <table className="tabela">
          <thead><tr><th>Data</th><th>Tipo</th><th>Tarefa</th><th>Registro</th></tr></thead>
          <tbody>
            {regs.map(({ t, r }) => (
              <tr key={r.id}>
                <td>{formatarData(r.data)}</td>
                <td>{tipoInfo(r.tipo).icone} {tipoInfo(r.tipo).nome}</td>
                <td>{t.titulo}</td>
                <td>{r.titulo || (r.resumoIA || r.anotacoes).slice(0, 90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
