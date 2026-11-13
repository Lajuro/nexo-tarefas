"use client";

import { useEffect, useState } from "react";
import { useNexo } from "./Provider";
import { Campo, ChipsInput, Modal, formatarTamanho } from "./comum";
import { LinkDoc, normalizarLink, novoId } from "@/lib/tipos";

export function LinkForm({
  aberto, fechar, link, tarefaId, categoriaId,
}: {
  aberto: boolean; fechar: () => void; link?: LinkDoc; tarefaId?: string | null; categoriaId?: string | null;
}) {
  const { dados, salvarLinks, enviarArquivo } = useNexo();
  const [tipo, setTipo] = useState<"link" | "arquivo">("link");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [descricao, setDescricao] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tId, setTId] = useState("");
  const [cId, setCId] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo(link?.tipo ?? "link");
    setTitulo(link?.titulo ?? "");
    setUrl(link?.url ?? "");
    setArquivo(null);
    setDescricao(link?.descricao ?? "");
    setTags(link?.tags ?? []);
    setTId(link?.tarefaId ?? tarefaId ?? "");
    setCId(link?.categoriaId ?? categoriaId ?? "");
  }, [aberto, link, tarefaId, categoriaId]);

  const valido = titulo.trim() || url.trim() || arquivo;
  const podeSalvar = tipo === "link" ? url.trim() : link?.arquivo || arquivo;

  async function salvar() {
    setSalvando(true);
    let extra: Partial<LinkDoc> = {};
    if (tipo === "arquivo" && arquivo) {
      const up = await enviarArquivo(arquivo);
      if (!up) return setSalvando(false);
      extra = up;
    }
    let u = url.trim();
    if (tipo === "link" && u && !/^[a-z]+:\/\//i.test(u) && !u.startsWith("\\\\")) u = "https://" + u;
    const novo = normalizarLink({
      ...(link || {}),
      id: link?.id ?? novoId("l"),
      tipo,
      titulo: titulo.trim() || arquivo?.name || u,
      url: tipo === "link" ? u : "",
      descricao, tags,
      tarefaId: tId || null,
      categoriaId: cId || null,
      ...extra,
    });
    const ok = await salvarLinks((items) =>
      link ? items.map((i) => (i.id === link.id ? novo : i)) : [...items, novo],
    );
    setSalvando(false);
    if (ok) fechar();
  }

  const tagsExist = [...new Set((dados?.links.items ?? []).flatMap((l) => l.tags))];

  return (
    <Modal titulo={link ? "Editar link/documento" : "Adicionar link ou documento"} aberto={aberto} fechar={fechar}
      rodape={
        <>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn primario" disabled={!valido || !podeSalvar || salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }>
      <div className="form">
        {!link && (
          <div className="segmentado">
            <button className={tipo === "link" ? "ativo" : ""} onClick={() => setTipo("link")}>🔗 Link</button>
            <button className={tipo === "arquivo" ? "ativo" : ""} onClick={() => setTipo("arquivo")}>📄 Arquivo</button>
          </div>
        )}
        {tipo === "link" ? (
          <Campo rotulo="Endereço" dica="Link da web, SharePoint, Confluence, Jira... ou caminho de rede (\\servidor\pasta)">
            <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </Campo>
        ) : link?.arquivo ? (
          <p className="sutil" style={{ margin: 0 }}>Arquivo: {link.nomeArquivo} ({formatarTamanho(link.tamanho)})</p>
        ) : (
          <Campo rotulo="Arquivo" dica="Uma cópia é guardada na pasta de dados (arquivos/). Evite subir dados sensíveis se a pasta sincroniza.">
            <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </Campo>
        )}
        <Campo rotulo="Título">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Como você vai reconhecer isso depois" />
        </Campo>
        <Campo rotulo="Descrição">
          <textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Campo>
        <div className="linha-campos">
          <Campo rotulo="Vincular à tarefa">
            <select value={tId} onChange={(e) => setTId(e.target.value)}>
              <option value="">Nenhuma</option>
              {(dados?.tarefas ?? []).map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Vincular à categoria">
            <select value={cId} onChange={(e) => setCId(e.target.value)}>
              <option value="">Nenhuma</option>
              {(dados?.categorias.items ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Tags">
          <ChipsInput valor={tags} mudar={setTags} sugestoes={tagsExist} placeholder="Ex.: runbook, padrão, acesso" />
        </Campo>
      </div>
    </Modal>
  );
}

export function hrefLink(l: LinkDoc) {
  if (l.tipo === "arquivo") return `/api/arquivos?p=${encodeURIComponent(l.arquivo || "")}`;
  if (l.url?.startsWith("\\\\")) return `file:${l.url.replace(/\\/g, "/")}`;
  return l.url || "#";
}
