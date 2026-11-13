"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Modal, copiarTexto } from "./comum";
import { useNexo } from "./Provider";
import { useFecharComCuidado } from "./Raiz";
import { BlocoCopilot, IconeCopiar, PassoCopilot, useCopiado } from "./tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";

/**
 * Fluxo genérico do Copilot: 1) copiar o prompt pronto, 2) colar a resposta de volta
 * (o passo 2 só aparece quando a tela guarda a resposta, via `aoSalvarResposta`).
 */
export function PromptModal({
  aberto, fechar, titulo, prompt, explicacao, aoSalvarResposta, rotuloSalvar = "Salvar resposta",
}: {
  aberto: boolean; fechar: () => void; titulo: string; prompt: string; explicacao?: string;
  aoSalvarResposta?: (texto: string) => Promise<unknown> | void; rotuloSalvar?: string;
}) {
  const { toast } = useNexo();
  const [resposta, setResposta] = useState("");
  const [verPrompt, setVerPrompt] = useState(false);
  const [jaCopiou, setJaCopiou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [copiado, marcarCopiado] = useCopiado();

  useEffect(() => {
    if (aberto) {
      setResposta("");
      setVerPrompt(false);
      setJaCopiou(false);
      setSalvando(false);
    }
  }, [aberto]);

  const copiar = async () => {
    if (await copiarTexto(prompt)) {
      marcarCopiado();
      setJaCopiou(true);
      toast("Prompt copiado. Agora cole no Copilot.");
    } else {
      setVerPrompt(true);
      toast("Não consegui copiar automaticamente. Selecione o texto do prompt e copie.", "erro");
    }
  };

  const salvar = async () => {
    if (!aoSalvarResposta || !resposta.trim() || salvando) return;
    setSalvando(true);
    const r = await aoSalvarResposta(resposta.trim());
    setSalvando(false);
    // Se a gravação falhou (o Provider devolve null e já avisa), a janela fica aberta para não perder o texto colado.
    if (r === null || r === false) return;
    fechar();
  };

  // Resposta colada e ainda não guardada: pergunta antes de fechar.
  const tentarFechar = useFecharComCuidado(aberto && !!aoSalvarResposta && !!resposta.trim(), fechar);

  return (
    <Modal
      titulo={titulo}
      descricao={explicacao}
      aberto={aberto}
      fechar={tentarFechar}
      className="max-w-[720px]"
      rodape={
        <>
          <Button variant="outline" onClick={tentarFechar}>Fechar</Button>
          {aoSalvarResposta && (
            <Button disabled={!resposta.trim() || salvando} onClick={salvar}>
              {salvando ? "Salvando..." : rotuloSalvar}
            </Button>
          )}
        </>
      }
    >
      <BlocoCopilot titulo="Copilot" descricao="O Nexo monta o prompt com o contexto. Você só copia e cola.">
        <PassoCopilot n={1} titulo="Copie o prompt e cole no Copilot" feito={jaCopiou}>
          <Collapsible open={verPrompt} onOpenChange={setVerPrompt}>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copiar}>
                <IconeCopiar copiado={copiado} /> Copiar prompt
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="group/ver">
                  <ChevronRight className="transition-transform duration-200 group-data-[state=open]/ver:rotate-90" />
                  {verPrompt ? "Esconder prompt" : "Ver prompt"}
                </Button>
              </CollapsibleTrigger>
              <span data-slot="tamanho-prompt" className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                {prompt.length.toLocaleString("pt-BR")} caracteres
              </span>
            </div>
            <CollapsibleContent>
              <pre data-slot="previa-prompt" tabIndex={0}
                className="mt-2.5 max-h-64 overflow-auto rounded-lg border bg-card p-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground outline-none texto-pre focus-visible:ring-[3px] focus-visible:ring-ring/25 dark:bg-input/20">
                {prompt}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </PassoCopilot>

        {aoSalvarResposta ? (
          <PassoCopilot n={2} titulo="Cole aqui a resposta do Copilot" feito={!!resposta.trim()} ultimo>
            <Textarea
              rows={9}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  salvar();
                }
              }}
              placeholder="Cole a resposta inteira aqui..."
              className="max-h-[44vh] min-h-40"
            />
          </PassoCopilot>
        ) : (
          <PassoCopilot n={2} titulo="Use a resposta direto no Copilot" ultimo>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Essa resposta não precisa voltar para o Nexo. Se quiser guardar algum trecho, cole nas anotações de um registro da tarefa.
            </p>
          </PassoCopilot>
        )}
      </BlocoCopilot>
    </Modal>
  );
}
