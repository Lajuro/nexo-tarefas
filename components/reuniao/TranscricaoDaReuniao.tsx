"use client";

// Transcrição da reunião (Teams, VTT, SRT ou texto com tempos) → Copilot → reunião em andamento.
// 1) colar ou escolher o arquivo; 2) copiar o prompt de cada parte e colar a resposta de volta;
// 3) "Trazer para a reunião": o texto original vira anexo em arquivos/ e o que o Copilot organizou
// entra nos campos da captura (lib/reuniao.ts, comRespostaDaTranscricao). Nada vai para a tarefa
// antes de "Encerrar e salvar", como o resto do modo reunião.

import { useEffect, useMemo, useState } from "react";
import { Check, FileText, Paperclip } from "lucide-react";
import { Modal, copiarTexto } from "@/components/comum";
import { useNexo } from "@/components/Provider";
import { useFecharComCuidado } from "@/components/Raiz";
import { BlocoCopilot, IconeCopiar, PassoCopilot, useCopiado } from "@/components/tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { AreaArquivo } from "@/components/ui/chips";
import { Textarea } from "@/components/ui/input";
import { promptTranscricao, interpretarResposta } from "@/lib/prompts";
import { type Reuniao, comRespostaDaTranscricao } from "@/lib/reuniao";
import type { PassoAberto } from "@/lib/lembretes";
import { lerTranscricao, partesDaTranscricao, quemFala } from "@/lib/transcricao";
import { type Categoria, type Tarefa, hojeISO } from "@/lib/tipos";

/** Cabe no Copilot do navegador com folga para o contexto da tarefa. */
const TAMANHO_DA_PARTE = 11_000;

function BotaoCopiarParte({ texto, aoCopiar, rotulo }: { texto: string; aoCopiar: () => void; rotulo: string }) {
  const [copiado, marcar] = useCopiado();
  const { toast } = useNexo();
  return (
    <Button variant="outline" size="sm" data-slot="copiar-parte"
      onClick={async () => {
        if (await copiarTexto(texto)) { marcar(); aoCopiar(); toast("Prompt copiado. Agora cole no Copilot."); }
        else toast("Não consegui copiar automaticamente.", "erro");
      }}>
      <IconeCopiar copiado={copiado} /> {rotulo}
    </Button>
  );
}

export function TranscricaoDaReuniao({
  aberto, fechar, tarefa, categoria, reuniao, passosDaTarefa, aoAplicar,
}: {
  aberto: boolean; fechar: () => void; tarefa: Tarefa; categoria?: Categoria; reuniao: Reuniao;
  passosDaTarefa: PassoAberto[]; aoAplicar: (fn: (r: Reuniao) => Reuniao) => void;
}) {
  const { enviarArquivo, toast } = useNexo();
  const [bruto, setBruto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [respostas, setRespostas] = useState<string[]>([]);
  const [copiadas, setCopiadas] = useState<number[]>([]);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setBruto(""); setArquivo(null); setRespostas([]); setCopiadas([]); setAplicando(false);
  }, [aberto]);

  const falas = useMemo(() => lerTranscricao(bruto), [bruto]);
  const partes = useMemo(() => partesDaTranscricao(falas, TAMANHO_DA_PARTE), [falas]);
  const quem = useMemo(() => quemFala(falas).map((x) => x.quem), [falas]);
  const prompts = useMemo(
    () => partes.map((p, i) => promptTranscricao(tarefa, categoria, p, {
      titulo: reuniao.titulo, participantes: [...new Set([...reuniao.participantes, ...quem])], numero: i + 1, total: partes.length,
    })),
    [partes, tarefa, categoria, reuniao.titulo, reuniao.participantes, quem],
  );

  const lerArquivo = async (f: File | null) => {
    setArquivo(f);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast("Esse arquivo é grande demais para uma transcrição (mais de 5 MB).", "erro"); return; }
    setBruto(await f.text());
    setRespostas([]); setCopiadas([]);
  };

  const respondidas = respostas.filter((x) => x?.trim()).length;
  const sujo = !!bruto.trim() || respondidas > 0;
  const tentarFechar = useFecharComCuidado(aberto && sujo && !aplicando, fechar);

  /** Guarda o texto original em arquivos/ (o link vai para as anotações) e devolve onde ficou. */
  const guardarOriginal = async () => {
    const base = (arquivo?.name.replace(/\.[^.]+$/, "") || `transcricao-${hojeISO()}`).replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 80) || "transcricao";
    const salvo = await enviarArquivo(new File([bruto], `${base}.txt`, { type: "text/plain" }));
    return salvo ? { arquivo: `arquivos/${salvo.arquivo}`, nome: arquivo?.name || `${base}.txt` } : null;
  };

  const aplicar = async (comCopilot: boolean) => {
    if (aplicando || !bruto.trim()) return;
    setAplicando(true);
    const anexo = await guardarOriginal();
    const interpretadas = comCopilot ? respostas.filter((x) => x?.trim()).map(interpretarResposta) : [];
    aoAplicar((r) => comRespostaDaTranscricao(r, interpretadas, passosDaTarefa, anexo));
    setAplicando(false);
    const naoReconheceu = interpretadas.some((x) => !x.reconheceu);
    toast(
      !anexo
        ? "Trouxe o que o Copilot organizou, mas não consegui guardar a transcrição original. Guarde o arquivo à parte."
        : naoReconheceu
          ? "Parte da resposta não veio no formato: ela entrou como resumo nas anotações. Confira antes de salvar."
          : comCopilot ? "Transcrição trazida para a reunião. Confira decisões e passos antes de salvar." : "Transcrição anexada às anotações.",
      !anexo || naoReconheceu ? "erro" : "ok",
    );
    fechar();
  };

  return (
    <Modal
      titulo="Transcrição da reunião"
      descricao="Cole a transcrição do Teams (ou escolha o arquivo .vtt, .srt ou .txt). O Copilot organiza e o Nexo traz decisões, passos e impedimentos para a captura."
      aberto={aberto}
      fechar={tentarFechar}
      className="max-w-[760px]"
      rodape={
        <>
          <Button variant="outline" onClick={tentarFechar}>Cancelar</Button>
          <Button variant="outline" disabled={!bruto.trim() || aplicando} onClick={() => aplicar(false)} data-slot="so-anexar-transcricao">
            <Paperclip /> Só anexar
          </Button>
          <Button disabled={!respondidas || aplicando} onClick={() => aplicar(true)} data-slot="trazer-transcricao">
            <Check /> {aplicando ? "Trazendo..." : "Trazer para a reunião"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Textarea data-slot="transcricao-colada" value={bruto} rows={7} className="max-h-[30vh] min-h-32 font-mono text-[12px]"
            onChange={(e) => { setBruto(e.target.value); setArquivo(null); }}
            placeholder={"Cole aqui a transcrição. Exemplo do Teams:\n\nFulano  0:12\nBom dia, vamos começar pela pauta...\n\nCiclana  0:31\nSobre o prazo da ferramenta X..."}
            aria-label="Transcrição da reunião" />
          <AreaArquivo arquivo={arquivo} aoMudar={(f) => void lerArquivo(f)} />
        </div>

        {falas.length > 0 && (
          <p data-slot="resumo-transcricao" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><FileText className="size-3.5" /> {falas.length} {falas.length === 1 ? "trecho" : "trechos"}</span>
            {quem.length > 0 && <span>Falaram: {quem.slice(0, 6).join(", ")}{quem.length > 6 ? ` e mais ${quem.length - 6}` : ""}</span>}
            {partes.length > 1 && <span className="text-alerta">Longa demais para um prompt só: vai em {partes.length} partes.</span>}
          </p>
        )}

        {partes.length > 0 && (
          <BlocoCopilot titulo="Organizar com o Copilot" descricao="Para cada parte: copie o prompt, cole no Copilot e traga a resposta de volta.">
            {partes.map((_, i) => (
              <PassoCopilot key={i} n={i + 1} ultimo={i === partes.length - 1} feito={!!respostas[i]?.trim()}
                titulo={partes.length > 1 ? `Parte ${i + 1} de ${partes.length}` : "Copie o prompt e cole a resposta"}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <BotaoCopiarParte texto={prompts[i]} rotulo={copiadas.includes(i) ? "Copiar de novo" : "Copiar prompt"}
                      aoCopiar={() => setCopiadas((c) => [...new Set([...c, i])])} />
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">{prompts[i].length.toLocaleString("pt-BR")} caracteres</span>
                  </div>
                  <Textarea data-slot="resposta-transcricao" rows={4} className="max-h-[28vh] min-h-24"
                    value={respostas[i] ?? ""} aria-label={`Resposta do Copilot, parte ${i + 1}`}
                    placeholder="Cole aqui a resposta do Copilot..."
                    onChange={(e) => setRespostas((rs) => { const n = [...rs]; n[i] = e.target.value; return n; })} />
                </div>
              </PassoCopilot>
            ))}
          </BlocoCopilot>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O texto original da transcrição fica guardado como anexo, com o link nas anotações. Decisões, passos e participantes novos entram no fim do que já foi capturado, sem apagar nada.
        </p>
      </div>
    </Modal>
  );
}
