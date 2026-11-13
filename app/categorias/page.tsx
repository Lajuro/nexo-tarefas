"use client";

import Link from "next/link";
import { useState } from "react";
import { useNexo } from "@/components/Provider";
import { CategoriaForm } from "@/components/CategoriaForm";
import { Vazio } from "@/components/ui";
import { STATUS_ABERTOS, formatarData, ultimoRegistro } from "@/lib/tipos";

export default function Categorias() {
  const { dados } = useNexo();
  const [form, setForm] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const cats = dados!.categorias.items.filter((c) => verArquivadas || !c.arquivada);
  const semCat = dados!.tarefas.filter((t) => !t.categoriaId);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Categorias</h1>
          <p>Os assuntos de onde as tarefas nascem. Abra uma para ver tudo o que já saiu dela.</p>
        </div>
        <div className="acoes">
          <label className="acoes sutil" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={verArquivadas} onChange={(e) => setVerArquivadas(e.target.checked)} /> Arquivadas
          </label>
          <button className="btn primario" onClick={() => setForm(true)}>+ Nova categoria</button>
        </div>
      </div>
      {cats.length === 0 ? (
        <Vazio titulo="Nenhuma categoria ainda">Ex.: HT, Security Champion, Raptor...</Vazio>
      ) : (
        <div className="grade">
          {cats.map((c) => {
            const ts = dados!.tarefas.filter((t) => t.categoriaId === c.id);
            const abertas = ts.filter((t) => STATUS_ABERTOS.includes(t.status)).length;
            const ultima = ts.map((t) => ultimoRegistro(t)?.data).filter(Boolean).sort().pop();
            return (
              <Link key={c.id} href={`/categorias/${c.id}`} className="card-cat" style={{ "--cor": c.cor } as React.CSSProperties}>
                <h3 style={{ fontSize: 16 }}>{c.nome}{c.arquivada && <span className="badge" style={{ marginLeft: 8 }}>arquivada</span>}</h3>
                {c.descricao && <p className="sutil" style={{ margin: 0, fontSize: 13 }}>{c.descricao}</p>}
                <div className="card-meta">
                  <span><strong>{abertas}</strong> abertas</span>
                  <span><strong>{ts.length - abertas}</strong> fechadas</span>
                  {ultima && <span>última atividade {formatarData(ultima)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {semCat.length > 0 && (
        <p className="sutil" style={{ marginTop: 20 }}>{semCat.length} tarefa(s) sem categoria.</p>
      )}
      <CategoriaForm aberto={form} fechar={() => setForm(false)} />
    </>
  );
}
