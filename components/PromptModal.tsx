"use client";

import { useEffect, useState } from "react";
import { Modal, copiarTexto } from "./ui";
import { useNexo } from "./Provider";

export function PromptModal({
  aberto, fechar, titulo, prompt, explicacao, aoSalvarResposta, rotuloSalvar = "Salvar resposta",
}: {
  aberto: boolean; fechar: () => void; titulo: string; prompt: string; explicacao?: string;
  aoSalvarResposta?: (texto: string) => Promise<unknown> | void; rotuloSalvar?: string;
}) {
  const { toast } = useNexo();
  const [resposta, setResposta] = useState("");
  const [verPrompt, setVerPrompt] = useState(false);
  useEffect(() => {
    if (aberto) {
      setResposta("");
      setVerPrompt(false);
    }
  }, [aberto]);

  const copiar = async () => {
    if (await copiarTexto(prompt)) toast("Prompt copiado. Agora cole no Copilot.");
    else toast("Não consegui copiar automaticamente. Selecione o texto e copie.", "erro");
  };

  return (
    <Modal titulo={titulo} aberto={aberto} fechar={fechar} largo
      rodape={
        <>
          <button className="btn" onClick={fechar}>Fechar</button>
          {aoSalvarResposta && (
            <button className="btn primario" disabled={!resposta.trim()}
              onClick={async () => { await aoSalvarResposta(resposta.trim()); fechar(); }}>
              {rotuloSalvar}
            </button>
          )}
        </>
      }>
      <div className="form">
        {explicacao && <p className="sutil" style={{ margin: 0 }}>{explicacao}</p>}
        <div className="passo-ia">
          <div className="titulo"><span className="num-passo">1</span> Copie o prompt e cole no Copilot</div>
          <div className="acoes">
            <button className="btn primario" onClick={copiar}>📋 Copiar prompt</button>
            <button className="btn fantasma" onClick={() => setVerPrompt((v) => !v)}>
              {verPrompt ? "Esconder" : "Ver"} prompt ({prompt.length.toLocaleString("pt-BR")} caracteres)
            </button>
          </div>
          {verPrompt && <div className="prompt-preview">{prompt}</div>}
        </div>
        {aoSalvarResposta && (
          <div className="passo-ia">
            <div className="titulo"><span className="num-passo">2</span> Cole aqui a resposta do Copilot</div>
            <textarea rows={10} value={resposta} onChange={(e) => setResposta(e.target.value)}
              placeholder="Cole a resposta inteira aqui..." />
          </div>
        )}
      </div>
    </Modal>
  );
}
