"use client";

// Consertar o que foi registrado no lugar errado, sem redigitar:
//   pedirMoverRegistro(tarefaId, registroId)  → leva um registro para outra tarefa
//   pedirJuntarTarefa(tarefaId)               → junta uma tarefa inteira dentro de outra
// As duas janelas ficam montadas uma vez só (no Shell) e são abertas por evento, como a de nova tarefa.
//
// Ordem das gravações: primeiro o destino recebe, depois a origem perde. Se algo falhar no meio,
// sobra uma cópia repetida (fácil de ver e remover), nunca um buraco.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Merge } from "lucide-react";
import { useNexo } from "./Provider";
import { Campo, Modal } from "./comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { comRegistroRecebido, comTarefaJuntada, semRegistroMovido } from "@/lib/acoes";
import { aberta } from "@/lib/lembretes";
import { formatarData, nomeStatus, tipoInfo } from "@/lib/tipos";

type Pedido = { tipo: "mover"; tarefaId: string; registroId: string } | { tipo: "juntar"; tarefaId: string };

const EVENTO = "nexo:mover-ou-juntar";
const pedir = (p: Pedido) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));
export const pedirMoverRegistro = (tarefaId: string, registroId: string) => pedir({ tipo: "mover", tarefaId, registroId });
export const pedirJuntarTarefa = (tarefaId: string) => pedir({ tipo: "juntar", tarefaId });

export function MoverEJuntar() {
  const { dados, atualizarTarefa, excluirTarefa, salvarLinks, salvarNotas, toast } = useNexo();
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [destinoId, setDestinoId] = useState("");
  const [fazendo, setFazendo] = useState(false);

  useEffect(() => {
    const abrir = (e: Event) => {
      setPedido((e as CustomEvent<Pedido>).detail);
      setDestinoId("");
      setFazendo(false);
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const tarefas = dados?.tarefas;
  const origem = pedido ? tarefas?.find((t) => t.id === pedido.tarefaId) : undefined;
  const registro = pedido?.tipo === "mover" ? origem?.registros.find((r) => r.id === pedido.registroId) : undefined;
  const opcoes = useMemo(() => {
    const cats = dados?.categorias.items ?? [];
    return (tarefas ?? [])
      .filter((t) => t.id !== pedido?.tarefaId)
      .sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.prioridade - a.prioridade)
      .map((t) => ({
        valor: t.id,
        rotulo: t.titulo,
        detalhe: [cats.find((c) => c.id === t.categoriaId)?.nome, aberta(t) ? "" : nomeStatus(t.status)].filter(Boolean).join(" · ") || undefined,
      }));
  }, [tarefas, dados?.categorias.items, pedido?.tarefaId]);

  const fechar = () => setPedido(null);
  const destino = tarefas?.find((t) => t.id === destinoId);

  async function mover() {
    if (!origem || !registro || !destino || fazendo) return;
    setFazendo(true);
    const recebeu = await atualizarTarefa(destino.id, (t) => comRegistroRecebido(t, registro));
    if (recebeu && (await atualizarTarefa(origem.id, (t) => semRegistroMovido(t, registro.id)))) {
      // as folhas do bloco de notas que criaram este registro passam a apontar para a tarefa nova
      if (dados?.notas?.items.some((n) => n.gerou?.some((f) => f.registroId === registro.id)))
        await salvarNotas((items) =>
          items.map((n) => ({ ...n, gerou: n.gerou?.map((f) => (f.registroId === registro.id ? { ...f, tarefaId: destino.id } : f)) })),
        );
      toast(`Registro movido para “${destino.titulo}”.`);
      fechar();
      router.push(`/tarefas/${destino.id}`);
    }
    setFazendo(false);
  }

  async function juntar() {
    if (!origem || !destino || fazendo) return;
    setFazendo(true);
    const recebeu = await atualizarTarefa(destino.id, (t) => comTarefaJuntada(t, origem));
    if (recebeu) {
      if (dados?.links.items.some((l) => l.tarefaId === origem.id))
        await salvarLinks((items) => items.map((l) => (l.tarefaId === origem.id ? { ...l, tarefaId: destino.id } : l)));
      if (dados?.notas?.items.some((n) => n.gerou?.some((f) => f.tarefaId === origem.id)))
        await salvarNotas((items) =>
          items.map((n) => ({ ...n, gerou: n.gerou?.map((f) => (f.tarefaId === origem.id ? { ...f, tarefaId: destino.id } : f)) })),
        );
      if (await excluirTarefa(origem.id)) {
        fechar();
        router.push(`/tarefas/${destino.id}`);
      }
    }
    setFazendo(false);
  }

  const seletor = (
    <Campo rotulo={pedido?.tipo === "juntar" ? "Juntar dentro de" : "Mover para"}>
      <Combobox
        aria-label="Tarefa de destino"
        valor={destinoId}
        aoMudar={setDestinoId}
        opcoes={opcoes}
        permitirLimpar={false}
        placeholder="Escolha a tarefa..."
        buscaPlaceholder="Buscar tarefa..."
        vazio="Nenhuma tarefa com esse nome."
      />
    </Campo>
  );

  const passos = origem ? origem.registros.reduce((n, r) => n + (r.tipo === "marco" ? 0 : r.proximosPassos.length), 0) : 0;
  const registrosDaOrigem = origem ? origem.registros.filter((r) => r.tipo !== "marco").length : 0;

  return (
    <>
      <Modal
        titulo="Mover registro para outra tarefa"
        descricao={registro ? `${tipoInfo(registro.tipo).nome} de ${formatarData(registro.data)}${registro.titulo ? `: ${registro.titulo}` : ""}` : undefined}
        aberto={pedido?.tipo === "mover" && !!registro}
        fechar={fechar}
        rodape={
          <>
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button data-slot="confirmar-mover" disabled={!destino || fazendo} onClick={mover}><ArrowRightLeft /> {fazendo ? "Movendo..." : "Mover registro"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-snug text-muted-foreground">
            O registro sai de “{origem?.titulo}” e entra na linha do tempo da tarefa escolhida, na data dele, com os passos que tiver.
          </p>
          {seletor}
        </div>
      </Modal>

      <Modal
        titulo="Juntar esta tarefa em outra"
        descricao={origem?.titulo}
        aberto={pedido?.tipo === "juntar" && !!origem}
        fechar={fechar}
        rodape={
          <>
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            <Button data-slot="confirmar-juntar" disabled={!destino || fazendo} onClick={juntar}><Merge /> {fazendo ? "Juntando..." : "Juntar tarefas"}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-snug text-muted-foreground">
            Use quando esta tarefa na verdade faz parte de outra. {registrosDaOrigem === 1 ? "O registro dela vai" : `Os ${registrosDaOrigem} registros dela vão`} para a linha do tempo da tarefa
            escolhida{passos ? `, com ${passos === 1 ? "o passo" : `os ${passos} passos`}` : ""}, junto com tags e links. A descrição fica anotada num marco.
          </p>
          {seletor}
          <p className="text-xs leading-snug text-muted-foreground">
            Depois, “{origem?.titulo}” vai para a lixeira. Dá para restaurar em Configurações se você mudar de ideia.
          </p>
        </div>
      </Modal>
    </>
  );
}
