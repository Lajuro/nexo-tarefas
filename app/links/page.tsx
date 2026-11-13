"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useNexo } from "@/components/Provider";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { CatTag, Vazio, formatarTamanho } from "@/components/comum";
import { LinkDoc, formatarData, semAcento } from "@/lib/tipos";

export default function Links() {
  const { dados, salvarLinks } = useNexo();
  const [form, setForm] = useState<{ aberto: boolean; link?: LinkDoc }>({ aberto: false });
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"" | "link" | "arquivo">("");
  const [tag, setTag] = useState("");
  const todas = dados!.links.items;
  const tags = [...new Set(todas.flatMap((l) => l.tags))].sort();

  const lista = useMemo(() => {
    const n = semAcento(q);
    return todas
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !tag || l.tags.includes(tag))
      .filter((l) => !n || semAcento(`${l.titulo} ${l.descricao} ${l.url} ${l.nomeArquivo} ${l.tags.join(" ")}`).includes(n))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [todas, q, tipo, tag]);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Links e documentos</h1>
          <p>Seu banco de referências: links importantes e arquivos, ligados a tarefas e categorias.</p>
        </div>
        <button className="btn primario" onClick={() => setForm({ aberto: true })}>+ Adicionar</button>
      </div>
      <div className="filtros">
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="segmentado">
          <button className={tipo === "" ? "ativo" : ""} onClick={() => setTipo("")}>Todos</button>
          <button className={tipo === "link" ? "ativo" : ""} onClick={() => setTipo("link")}>Links</button>
          <button className={tipo === "arquivo" ? "ativo" : ""} onClick={() => setTipo("arquivo")}>Arquivos</button>
        </div>
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
      {lista.length === 0 ? <Vazio titulo={todas.length ? "Nada encontrado" : "Nenhum link ou documento ainda"} /> : (
        <table className="tabela">
          <thead><tr><th></th><th>Título</th><th>Vínculos</th><th>Tags</th><th>Adicionado</th><th></th></tr></thead>
          <tbody>
            {lista.map((l) => {
              const t = dados!.tarefas.find((x) => x.id === l.tarefaId);
              const c = dados!.categorias.items.find((x) => x.id === l.categoriaId);
              return (
                <tr key={l.id}>
                  <td>{l.tipo === "arquivo" ? "📄" : "🔗"}</td>
                  <td>
                    <a href={hrefLink(l)} target="_blank" rel="noreferrer" style={{ color: "var(--acento-texto)", fontWeight: 600 }}>{l.titulo}</a>
                    <div className="sutil" style={{ fontSize: 12 }}>{l.descricao || (l.tipo === "arquivo" ? `${l.nomeArquivo} · ${formatarTamanho(l.tamanho)}` : l.url)}</div>
                  </td>
                  <td>
                    {t && <div><Link href={`/tarefas/${t.id}`} style={{ fontSize: 12 }}>↳ {t.titulo}</Link></div>}
                    {c && <CatTag cat={c} />}
                  </td>
                  <td>{l.tags.map((x) => <span key={x} className="chip so-leitura" style={{ marginRight: 4 }}>{x}</span>)}</td>
                  <td className="sutil">{formatarData(l.criadoEm)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-icone" title="Editar" onClick={() => setForm({ aberto: true, link: l })}>✎</button>
                    <button className="btn-icone" title="Remover" onClick={() => {
                      if (confirm(`Remover "${l.titulo}" da lista? (o registro vai para a lixeira${l.tipo === "arquivo" ? "; o arquivo continua na pasta" : ""})`))
                        salvarLinks((items) => items.filter((i) => i.id !== l.id));
                    }}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <LinkForm aberto={form.aberto} link={form.link} fechar={() => setForm({ aberto: false })} />
    </>
  );
}
