"use client";

import { useEffect, useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { CardTarefa } from "@/components/CardTarefa";
import { abrirNovaTarefa } from "@/components/Shell";
import { Vazio } from "@/components/comum";
import { STATUS, STATUS_ABERTOS, Status, diasAte, passosAbertos, semAcento, ultimoRegistro } from "@/lib/tipos";

type Ordem = "prioridade" | "prazo" | "atividade" | "titulo";

function lerPref<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(`nexo:${chave}`);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

export default function Painel() {
  const { dados } = useNexo();
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"abertas" | Status | "todas">("abertas");
  const [ordem, setOrdem] = useState<Ordem>("prioridade");
  const [texto, setTexto] = useState("");

  useEffect(() => {
    setOrdem(lerPref("ordem", "prioridade"));
    setFiltroStatus(lerPref("filtroStatus", "abertas"));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("nexo:ordem", JSON.stringify(ordem));
      localStorage.setItem("nexo:filtroStatus", JSON.stringify(filtroStatus));
    } catch {}
  }, [ordem, filtroStatus]);

  const cats = dados!.categorias.items;
  const tarefas = dados!.tarefas;

  const numeros = useMemo(() => {
    const abertas = tarefas.filter((t) => STATUS_ABERTOS.includes(t.status));
    const mes = new Date().toISOString().slice(0, 7);
    return {
      abertas: abertas.length,
      atrasadas: abertas.filter((t) => t.prazo && diasAte(t.prazo)! < 0).length,
      bloqueadas: abertas.filter((t) => t.status === "bloqueada").length,
      pendencias: abertas.reduce((n, t) => n + passosAbertos(t).length, 0),
      concluidasMes: tarefas.filter((t) => t.status === "concluida" && (t.concluidaEm || "").startsWith(mes)).length,
    };
  }, [tarefas]);

  const lista = useMemo(() => {
    const q = semAcento(texto.trim());
    const l = tarefas.filter((t) => {
      if (filtroCat && (filtroCat === "__sem" ? t.categoriaId : t.categoriaId !== filtroCat)) return false;
      if (filtroStatus === "abertas" && !STATUS_ABERTOS.includes(t.status)) return false;
      if (filtroStatus !== "abertas" && filtroStatus !== "todas" && t.status !== filtroStatus) return false;
      if (q && !semAcento(`${t.titulo} ${t.descricao} ${t.tags.join(" ")}`).includes(q)) return false;
      return true;
    });
    const ultData = (t: (typeof l)[0]) => ultimoRegistro(t)?.data ?? t.criadaEm;
    return l.sort((a, b) => {
      if (ordem === "prioridade") return b.prioridade - a.prioridade || (a.prazo ?? "9").localeCompare(b.prazo ?? "9");
      if (ordem === "prazo") return (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999") || b.prioridade - a.prioridade;
      if (ordem === "atividade") return ultData(b).localeCompare(ultData(a));
      return a.titulo.localeCompare(b.titulo);
    });
  }, [tarefas, filtroCat, filtroStatus, ordem, texto]);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Tarefas</h1>
          <p>Tudo o que foi designado pra você, num lugar só.</p>
        </div>
      </div>

      <div className="resumo-num">
        <div className="num"><strong>{numeros.abertas}</strong><span>tarefas abertas</span></div>
        <div className={`num ${numeros.atrasadas ? "alerta" : ""}`}><strong>{numeros.atrasadas}</strong><span>com prazo vencido</span></div>
        <div className={`num ${numeros.bloqueadas ? "alerta" : ""}`}><strong>{numeros.bloqueadas}</strong><span>bloqueadas</span></div>
        <div className="num"><strong>{numeros.pendencias}</strong><span>próximos passos em aberto</span></div>
        <div className="num"><strong>{numeros.concluidasMes}</strong><span>concluídas este mês</span></div>
      </div>

      <div className="filtros">
        <input placeholder="Filtrar por título, descrição ou tag..." value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {cats.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          <option value="__sem">Sem categoria</option>
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}>
          <option value="abertas">Só abertas</option>
          <option value="todas">Todas</option>
          {STATUS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <div className="segmentado" role="group" aria-label="Ordenar">
          {(["prioridade", "prazo", "atividade", "titulo"] as Ordem[]).map((o) => (
            <button key={o} className={ordem === o ? "ativo" : ""} onClick={() => setOrdem(o)}>
              {{ prioridade: "Prioridade", prazo: "Prazo", atividade: "Última atividade", titulo: "A-Z" }[o]}
            </button>
          ))}
        </div>
      </div>

      {tarefas.length === 0 ? (
        <Vazio titulo="Nenhuma tarefa ainda">
          <p>Comece cadastrando a primeira tarefa que te passaram.</p>
          <button className="btn primario" onClick={() => abrirNovaTarefa()}>+ Nova tarefa</button>
        </Vazio>
      ) : lista.length === 0 ? (
        <Vazio titulo="Nada com esses filtros" />
      ) : (
        <div className="grade">
          {lista.map((t) => (
            <CardTarefa key={t.id} t={t} cat={cats.find((c) => c.id === t.categoriaId)} />
          ))}
        </div>
      )}
    </>
  );
}
