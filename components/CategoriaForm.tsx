"use client";

import { useEffect, useState } from "react";
import { useNexo } from "./Provider";
import { Campo, Modal } from "./ui";
import { CORES, Categoria, agoraISO, normalizarCategoria, novoId } from "@/lib/tipos";

export function CategoriaForm({ aberto, fechar, cat }: { aberto: boolean; fechar: () => void; cat?: Categoria }) {
  const { dados, salvarCategorias } = useNexo();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[5]);
  useEffect(() => {
    if (!aberto) return;
    setNome(cat?.nome ?? "");
    setDescricao(cat?.descricao ?? "");
    setCor(cat?.cor ?? CORES[(dados?.categorias.items.length ?? 0) % CORES.length]);
  }, [aberto, cat, dados?.categorias.items.length]);

  async function salvar() {
    if (!nome.trim()) return;
    const nova = normalizarCategoria({ ...(cat || {}), id: cat?.id ?? novoId("c"), nome: nome.trim(), descricao, cor, atualizadaEm: agoraISO() });
    const ok = await salvarCategorias((items) => (cat ? items.map((i) => (i.id === cat.id ? nova : i)) : [...items, nova]));
    if (ok) fechar();
  }

  return (
    <Modal titulo={cat ? "Editar categoria" : "Nova categoria"} aberto={aberto} fechar={fechar}
      rodape={<><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primario" disabled={!nome.trim()} onClick={salvar}>Salvar</button></>}>
      <div className="form">
        <Campo rotulo="Nome">
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Security Champion"
            onKeyDown={(e) => e.key === "Enter" && salvar()} />
        </Campo>
        <Campo rotulo="Descrição">
          <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Do que se trata esse assunto, quem são os envolvidos..." />
        </Campo>
        <div className="campo">
          <span className="rotulo">Cor</span>
          <div className="cores">
            {CORES.map((c) => (
              <button key={c} className={`cor ${c === cor ? "ativa" : ""}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={c} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
