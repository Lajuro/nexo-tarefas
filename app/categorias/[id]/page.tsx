"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useNexo } from "@/components/Provider";
import { CardTarefa } from "@/components/CardTarefa";
import { CategoriaForm } from "@/components/CategoriaForm";
import { PromptModal } from "@/components/PromptModal";
import { abrirNovaTarefa } from "@/components/Shell";
import { LinkForm, hrefLink } from "@/components/LinkForm";
import { Vazio } from "@/components/comum";
import { promptCategoria } from "@/lib/prompts";
import { STATUS, STATUS_ABERTOS } from "@/lib/tipos";

export default function PaginaCategoria() {
  const { id } = useParams<{ id: string }>();
  const { dados, salvarCategorias } = useNexo();
  const cat = dados!.categorias.items.find((c) => c.id === id);
  const [editar, setEditar] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [linkForm, setLinkForm] = useState(false);
  if (!cat) return <Vazio titulo="Categoria não encontrada"><Link className="btn" href="/categorias">Voltar</Link></Vazio>;

  const ts = dados!.tarefas.filter((t) => t.categoriaId === id).sort((a, b) => b.prioridade - a.prioridade);
  const links = dados!.links.items.filter((l) => l.categoriaId === id);
  const abertas = ts.filter((t) => STATUS_ABERTOS.includes(t.status));
  const fechadas = ts.filter((t) => !STATUS_ABERTOS.includes(t.status));

  return (
    <>
      <div className="migalha"><Link href="/categorias">Categorias</Link> /</div>
      <div className="cabecalho">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: cat.cor, display: "inline-block" }} />
            {cat.nome}
          </h1>
          {cat.descricao && <p>{cat.descricao}</p>}
        </div>
        <div className="acoes">
          <button className="btn" onClick={() => setPrompt(true)} disabled={!ts.length}>📊 Panorama do assunto</button>
          <button className="btn" onClick={() => setEditar(true)}>Editar</button>
          <button className="btn" onClick={() => salvarCategorias((items) => items.map((i) => (i.id === cat.id ? { ...i, arquivada: !i.arquivada } : i)))}>
            {cat.arquivada ? "Desarquivar" : "Arquivar"}
          </button>
          <button className="btn primario" onClick={() => abrirNovaTarefa(cat.id)}>+ Tarefa aqui</button>
        </div>
      </div>

      <div className="resumo-num">
        {STATUS.map((s) => {
          const n = ts.filter((t) => t.status === s.id).length;
          return n ? <div key={s.id} className="num"><strong>{n}</strong><span>{s.nome.toLowerCase()}</span></div> : null;
        })}
        <div className="num"><strong>{ts.reduce((n, t) => n + t.registros.filter((r) => r.tipo === "reuniao").length, 0)}</strong><span>reuniões registradas</span></div>
      </div>

      <section>
        <h2 style={{ marginBottom: 12 }}>Abertas</h2>
        {abertas.length ? <div className="grade">{abertas.map((t) => <CardTarefa key={t.id} t={t} cat={cat} />)}</div> : <Vazio titulo="Nenhuma tarefa aberta neste assunto" />}
      </section>
      {fechadas.length > 0 && (
        <section className="secao">
          <h2>Histórico (concluídas e canceladas) <span className="contador">{fechadas.length}</span></h2>
          <div className="grade">{fechadas.map((t) => <CardTarefa key={t.id} t={t} cat={cat} />)}</div>
        </section>
      )}
      <section className="secao">
        <h2>Links e documentos do assunto <button className="btn pequeno" onClick={() => setLinkForm(true)}>+ Adicionar</button></h2>
        {links.length === 0 ? <p className="sutil">Nada vinculado a esta categoria.</p> : (
          <div className="caixa">
            {links.map((l) => (
              <div key={l.id} className="link-item">
                <span>{l.tipo === "arquivo" ? "📄" : "🔗"}</span>
                <div><a href={hrefLink(l)} target="_blank" rel="noreferrer">{l.titulo}</a><small>{l.descricao}</small></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CategoriaForm aberto={editar} fechar={() => setEditar(false)} cat={cat} />
      <LinkForm aberto={linkForm} fechar={() => setLinkForm(false)} categoriaId={cat.id} />
      <PromptModal aberto={prompt} fechar={() => setPrompt(false)} titulo={`Panorama: ${cat.nome}`}
        explicacao="Junta todas as tarefas que nasceram deste assunto para a IA enxergar o todo."
        prompt={promptCategoria(cat, ts)} />
    </>
  );
}
