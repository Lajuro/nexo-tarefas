"use client";

// "Esperando quem?": janela curta que aparece quando uma tarefa vai para "Aguardando terceiros"
// (e pelo botão na página da tarefa). Guarda de quem e o quê, para o app contar os dias e ajudar a cobrar.
// Fica montada uma vez no Shell e é aberta por evento, como a de mover e juntar.

import { useEffect, useMemo, useState } from "react";
import { Copy, Hourglass, MessageSquareReply } from "lucide-react";
import { useNexo } from "./Provider";
import { Campo, Modal, copiarTexto } from "./comum";
import { Button } from "@/components/ui/button";
import { CampoSugestoes } from "@/components/ui/chips";
import { SeletorData, somarDias } from "@/components/ui/data";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { comCobranca, comEspera, comLembrete } from "@/lib/acoes";
import { diasEsperando, historicoEspera, mensagemCobranca, resumoEspera } from "@/lib/espera";
import { nomesConhecidos } from "@/lib/pessoas";
import { Tarefa, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const EVENTO = "nexo:esperando";
/** Abre a janela "Esperando quem?" para a tarefa. */
export const pedirEspera = (tarefaId: string) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: { tarefaId } }));

/** Cobrar: copiar a mensagem pronta e marcar "cobrei hoje". Para usar em qualquer tela. */
export function useCobranca() {
  const { atualizarTarefa, toast } = useNexo();
  return {
    copiar: async (t: Tarefa) => (await copiarTexto(mensagemCobranca(t))) && toast("Mensagem de cobrança copiada. É só colar no chat ou no e-mail.", "info"),
    cobrei: async (t: Tarefa) => (await atualizarTarefa(t.id, comCobranca)) && toast("Cobrança anotada na linha do tempo. A contagem recomeça de hoje.", "info"),
  };
}

export function Esperando() {
  const { dados, atualizarTarefa } = useNexo();
  const [id, setId] = useState<string | null>(null);
  const [quem, setQuem] = useState("");
  const [oQue, setOQue] = useState("");
  const [lembrar, setLembrar] = useState("");
  const tarefa = id ? dados?.tarefas.find((t) => t.id === id) : undefined;
  const nomes = useMemo(() => (dados ? nomesConhecidos(dados) : []), [dados]);

  useEffect(() => {
    const abrir = (e: Event) => setId((e as CustomEvent<{ tarefaId: string }>).detail.tarefaId);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);
  // Ao abrir, parte do que já estava anotado. Só depende do id para não apagar o que está sendo digitado.
  useEffect(() => {
    if (!tarefa) return;
    setQuem(tarefa.esperando?.quem ?? "");
    setOQue(tarefa.esperando?.oQue ?? "");
    setLembrar(tarefa.lembrarEm ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fechar = () => setId(null);
  const salvar = async () => {
    if (!tarefa) return;
    if (await atualizarTarefa(tarefa.id, (t) => comLembrete(comEspera(t, { quem, oQue }), lembrar || null))) fechar();
  };
  const hoje = hojeISO();

  return (
    <Modal
      aberto={!!tarefa}
      fechar={fechar}
      titulo="Esperando quem?"
      descricao={tarefa ? <>“{tarefa.titulo}” está aguardando terceiros. Anote de quem e o quê: o Nexo conta os dias e te ajuda a cobrar.</> : undefined}
      rodape={
        <>
          <Button variant="ghost" onClick={fechar}>Agora não</Button>
          <Button data-slot="salvar-espera" onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <form
        data-slot="form-espera"
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            salvar();
          }
        }}
      >
        <Campo rotulo="Quem ficou de responder">
          <CampoSugestoes valor={quem} aoMudar={setQuem} sugestoes={nomes} placeholder="Nome da pessoa ou do time" aria-label="Quem ficou de responder" maxLength={120} autoFocus />
        </Campo>
        <Campo rotulo="O que você está esperando" dica="Em poucas palavras. Vira o assunto da mensagem de cobrança.">
          <Input value={oQue} onChange={(e) => setOQue(e.target.value)} placeholder="Ex.: liberar o acesso ao repositório" aria-label="O que você está esperando" maxLength={300} />
        </Campo>
        <Campo rotulo="Me lembre de cobrar em" dica="Opcional. No dia, a tarefa volta a aparecer em Hoje e no sino.">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeletorData valor={lembrar} aoMudar={setLembrar} placeholder="Sem lembrete" aria-label="Data para lembrar de cobrar" />
            {[{ n: 2, r: "em 2 dias" }, { n: 5, r: "em 5 dias" }, { n: 7, r: "em 1 semana" }].map((o) => {
              const data = somarDias(hoje, o.n);
              return (
                <Button key={o.n} type="button" size="sm" variant={lembrar === data ? "secondary" : "outline"} onClick={() => setLembrar(lembrar === data ? "" : data)}>
                  {o.r}
                </Button>
              );
            })}
          </div>
        </Campo>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

/**
 * Faixa "Esperando ..." com os dias e as ações de cobrar. Mostrada onde a tarefa em "aguardando" aparece
 * com espaço (página da tarefa). `compacta` deixa só os botões (linhas de lista).
 */
export function FaixaEspera({ tarefa: t, className }: { tarefa: Tarefa; className?: string }) {
  const { copiar, cobrei } = useCobranca();
  if (t.status !== "aguardando") return null;
  const dias = diasEsperando(t);
  const resumo = resumoEspera(t);
  return (
    <div data-slot="faixa-espera" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-alerta/35 bg-alerta/8 px-3 py-2", className)}>
      <Hourglass className="size-4 shrink-0 text-alerta" />
      {resumo ? (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px]">
            <span className="text-muted-foreground">Esperando </span>
            <span className="font-medium">{t.esperando?.quem || "retorno"}</span>
            {t.esperando?.oQue && <span className="text-muted-foreground">: {t.esperando.oQue}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {dias === 0 ? "Hoje" : dias === 1 ? "Há 1 dia" : `Há ${dias} dias`}
            {t.esperando?.cobradoEm ? " desde a última cobrança" : " sem retorno"} · {historicoEspera(t)}
          </p>
        </div>
      ) : (
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">Esta tarefa está aguardando terceiros. De quem você espera retorno?</p>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" variant="outline" data-slot="editar-espera" onClick={() => pedirEspera(t.id)}>{resumo ? "Alterar" : "Dizer de quem"}</Button>
        {resumo && (
          <>
            <Dica texto="Copia uma mensagem educada, pronta para colar no chat ou no e-mail">
              <Button size="sm" variant="outline" data-slot="copiar-cobranca" onClick={() => copiar(t)}><Copy /> Copiar cobrança</Button>
            </Dica>
            <Dica texto="Anota a cobrança na linha do tempo e recomeça a contagem de dias">
              <Button size="sm" data-slot="cobrei" onClick={() => cobrei(t)}><MessageSquareReply /> Cobrei hoje</Button>
            </Dica>
          </>
        )}
      </div>
    </div>
  );
}
