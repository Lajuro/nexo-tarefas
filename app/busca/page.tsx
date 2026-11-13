"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useNexo } from "@/components/Provider";
import { hrefLink } from "@/components/LinkForm";
import { CatTag, Destaque, StatusBadge, Vazio } from "@/components/ui";
import { Registro, Tarefa, formatarData, semAcento, tipoInfo } from "@/lib/tipos";

export default function Busca() {
  return <Suspense><Conteudo /></Suspense>;
}

function trecho(texto: string, termo: string) {
  const i = semAcento(texto).indexOf(semAcento(termo));
  if (i < 0) return texto.slice(0, 180);
  const ini = Math.max(0, i - 80);
  return (ini > 0 ? "…" : "") + texto.slice(ini, i + termo.length + 120) + (i + termo.length + 120 < texto.length ? "…" : "");
}

function Conteudo() {
  const { dados } = useNexo();
  const q = (useSearchParams().get("q") || "").trim();
  const n = semAcento(q);

  const r = useMemo(() => {
    if (!n) return { tarefas: [], registros: [], links: [] };
    const tem = (s: string) => semAcento(s).includes(n);
    const tarefas = dados!.tarefas.filter((t) => tem(`${t.titulo} ${t.descricao} ${t.tags.join(" ")} ${t.panoramaIA?.texto ?? ""} ${t.aguardandoQuem ?? ""} ${(t.passos ?? []).map((p) => `${p.texto} ${p.responsavel}`).join(" ")}`));
    const registros = dados!.tarefas.flatMap((t) =>
      t.registros
        .map((reg) => {
          const campos = [reg.titulo, reg.resumoIA, reg.anotacoes, reg.decisoes, reg.impedimentos,
            reg.participantes.join(", "), reg.proximosPassos.map((p) => `${p.texto} ${p.responsavel}`).join("\n")];
          const achado = campos.find((c) => c && tem(c));
          return achado ? { t, reg, achado } : null;
        })
        .filter(Boolean) as { t: Tarefa; reg: Registro; achado: string }[],
    ).sort((a, b) => b.reg.data.localeCompare(a.reg.data));
    const links = dados!.links.items.filter((l) => tem(`${l.titulo} ${l.descricao} ${l.url} ${l.nomeArquivo} ${l.tags.join(" ")}`));
    return { tarefas, registros, links };
  }, [dados, n]);

  const total = r.tarefas.length + r.registros.length + r.links.length;
  const cat = (id: string | null) => dados!.categorias.items.find((c) => c.id === id);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Busca: “{q}”</h1>
          <p>{total} resultado(s), ignorando acentos e maiúsculas.</p>
        </div>
      </div>
      {!total && <Vazio titulo="Nada encontrado" />}
      {r.tarefas.length > 0 && (
        <section className="secao">
          <h2>Tarefas <span className="contador">{r.tarefas.length}</span></h2>
          {r.tarefas.map((t) => (
            <Link key={t.id} href={`/tarefas/${t.id}`} className="resultado">
              <div className="card-meta"><CatTag cat={cat(t.categoriaId)} /><StatusBadge status={t.status} /></div>
              <h3><Destaque texto={t.titulo} termo={q} /></h3>
              {t.descricao && <div className="trecho"><Destaque texto={trecho(t.descricao, q)} termo={q} /></div>}
            </Link>
          ))}
        </section>
      )}
      {r.registros.length > 0 && (
        <section className="secao">
          <h2>Registros na linha do tempo <span className="contador">{r.registros.length}</span></h2>
          {r.registros.map(({ t, reg, achado }) => (
            <Link key={reg.id} href={`/tarefas/${t.id}`} className="resultado">
              <div className="reg-data">{formatarData(reg.data)} <span className="reg-tipo">{tipoInfo(reg.tipo).nome}</span> <span>{t.titulo}</span></div>
              {reg.titulo && <h3><Destaque texto={reg.titulo} termo={q} /></h3>}
              <div className="trecho"><Destaque texto={trecho(achado, q)} termo={q} /></div>
            </Link>
          ))}
        </section>
      )}
      {r.links.length > 0 && (
        <section className="secao">
          <h2>Links e documentos <span className="contador">{r.links.length}</span></h2>
          {r.links.map((l) => (
            <a key={l.id} href={hrefLink(l)} target="_blank" rel="noreferrer" className="resultado">
              <h3>{l.tipo === "arquivo" ? "📄" : "🔗"} <Destaque texto={l.titulo} termo={q} /></h3>
              <div className="trecho"><Destaque texto={l.descricao || l.url || ""} termo={q} /></div>
            </a>
          ))}
        </section>
      )}
    </>
  );
}
