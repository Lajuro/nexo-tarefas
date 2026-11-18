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
import { oferecerDesfazer } from "./desfazer";
import { Campo, Modal } from "./comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { comRegistroRecebido, comTarefaJuntada, semRegistroMovido } from "@/lib/acoes";
import { aberta } from "@/lib/lembretes";
import { comTarefaTrocada, linkEhDaTarefa } from "@/lib/links";
import { dataCurta, nomeStatus, tipoInfo } from "@/lib/tipos";

type Pedido = { tipo: "mover"; tarefaId: string; registroId: string } | { tipo: "juntar"; tarefaId: string };

const EVENTO = "nexo:mover-ou-juntar";
const pedir = (p: Pedido) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));
export const pedirMoverRegistro = (tarefaId: string, registroId: string) => pedir({ tipo: "mover", tarefaId, registroId });
export const pedirJuntarTarefa = (tarefaId: string) => pedir({ tipo: "juntar", tarefaId });

export function MoverEJuntar() {
  const { dados, dadosAtuais, atualizarTarefa, excluirTarefa, salvarLinks, salvarNotas, salvarPaginas, toast } = useNexo();
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
      const de = origem, para = destino, reg = registro;
      const notasApontavam = !!dados?.notas?.items.some((n) => n.gerou?.some((f) => f.registroId === reg.id));
      oferecerDesfazer(`Registro movido para “${para.titulo}”.`, async () => {
        // a volta segue a mesma ordem segura: a origem recebe de novo, depois o destino perde
        if (!(await atualizarTarefa(de.id, (t) => comRegistroRecebido(t, reg)))) return false;
        await atualizarTarefa(para.id, (t) => semRegistroMovido(t, reg.id));
        if (notasApontavam)
          await salvarNotas((items) => items.map((n) => ({ ...n, gerou: n.gerou?.map((f) => (f.registroId === reg.id ? { ...f, tarefaId: de.id } : f)) })));
        return true;
      });
      fechar();
      router.push(`/tarefas/${destino.id}`);
    }
    setFazendo(false);
  }

  async function juntar() {
    if (!origem || !destino || fazendo) return;
    setFazendo(true);
    const destinoAntes = structuredClone(destino);
    // o que servia à origem (links, páginas, folhas) passa a servir ao destino; guarda como estava para o desfazer
    const linksAntes = (dados?.links.items ?? []).filter((l) => linkEhDaTarefa(l, origem.id));
    const paginasAntes = (dados?.paginas?.items ?? []).filter((p) => (p.tarefaIds ?? []).includes(origem.id));
    const notasAntes = (dados?.notas?.items ?? []).filter((n) => (n.tarefaIds ?? []).includes(origem.id));
    const recebeu = await atualizarTarefa(destino.id, (t) => comTarefaJuntada(t, origem));
    if (recebeu) {
      if (linksAntes.length) await salvarLinks((items) => items.map((l) => comTarefaTrocada(l, origem.id, destino.id)));
      if (paginasAntes.length) await salvarPaginas((items) => items.map((p) => comTarefaTrocada(p, origem.id, destino.id)));
      if (notasAntes.length || dados?.notas?.items.some((n) => n.gerou?.some((f) => f.tarefaId === origem.id)))
        await salvarNotas((items) =>
          items.map((n) => ({ ...comTarefaTrocada(n, origem.id, destino.id), gerou: n.gerou?.map((f) => (f.tarefaId === origem.id ? { ...f, tarefaId: destino.id } : f)) })),
        );
      const desfazerJunto = async () => {
        // o destino volta a ser como era, se ninguém mexeu nele depois; os links voltam para a origem
        const atual = dadosAtuais()?.tarefas.find((t) => t.id === destinoAntes.id);
        if (atual && atual.rev === recebeu.rev) await atualizarTarefa(destinoAntes.id, (x) => ({ ...destinoAntes, rev: x.rev }));
        else toast("A tarefa de destino mudou depois da junção: os registros copiados para ela ficaram lá.", "info");
        // os vínculos voltam a ser os de antes da junção (só os campos de vínculo: o resto do item pode ter mudado depois)
        const l0 = new Map(linksAntes.map((x) => [x.id, x])), p0 = new Map(paginasAntes.map((x) => [x.id, x])), n0 = new Map(notasAntes.map((x) => [x.id, x]));
        if (l0.size) await salvarLinks((items) => items.map((l) => { const a = l0.get(l.id); return a ? { ...l, tarefaId: a.tarefaId, tarefaIds: a.tarefaIds, trava: a.trava } : l; }));
        if (p0.size) await salvarPaginas((items) => items.map((p) => { const a = p0.get(p.id); return a ? { ...p, tarefaIds: a.tarefaIds } : p; }));
        if (n0.size) await salvarNotas((items) => items.map((n) => { const a = n0.get(n.id); return a ? { ...n, tarefaIds: a.tarefaIds } : n; }));
      };
      if (await excluirTarefa(origem.id, { texto: `“${origem.titulo}” foi juntada em “${destino.titulo}”.`, aoDesfazer: desfazerJunto })) {
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
        descricao={registro ? `${tipoInfo(registro.tipo).nome} de ${dataCurta(registro.data)}${registro.titulo ? `: ${registro.titulo}` : ""}` : undefined}
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
