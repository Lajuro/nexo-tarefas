"use client";

// Painel "Depende de" da página da tarefa: as tarefas que precisam terminar antes desta andar
// (tarefa.dependeDe) e, embaixo, as que esta segura. Quando todas as de cima fecham, o lembrete
// "destravou" aparece (lib/lembretes.ts). Ligar uma tarefa que já depende desta é recusado (ciclo).

import Link from "next/link";
import { useMemo } from "react";
import { Link2, LockOpen, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { IconeStatus, Painel } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Dica } from "@/components/ui/popover";
import { comDependencia, criaCiclo, dependenciasDe, quemDependeDe } from "@/lib/dependencias";
import { aberta } from "@/lib/lembretes";
import { type Tarefa, nomeStatus } from "@/lib/tipos";
import { cn } from "@/lib/utils";

function LinhaTarefa({ t, aoTirar }: { t: Tarefa; aoTirar?: () => void }) {
  return (
    <li data-slot="dependencia" data-aberta={aberta(t) || undefined} className="group/dep flex items-center gap-2 py-1 text-[13px]">
      <Dica texto={nomeStatus(t.status)}><span className="inline-flex shrink-0"><IconeStatus status={t.status} /></span></Dica>
      <Link href={`/tarefas/${t.id}`} className={cn("min-w-0 flex-1 truncate hover:underline", !aberta(t) && "text-muted-foreground line-through decoration-muted-foreground/40")}>
        {t.titulo}
      </Link>
      {aoTirar && (
        <Button variant="ghost" size="icon-sm" className="size-6 opacity-0 group-hover/dep:opacity-100 focus-visible:opacity-100" aria-label={`Tirar a dependência de ${t.titulo}`} onClick={aoTirar}>
          <X />
        </Button>
      )}
    </li>
  );
}

export function PainelDependencias({ tarefa }: { tarefa: Tarefa }) {
  const { dados, atualizarComVolta, toast } = useNexo();
  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const deps = dependenciasDe(tarefa, tarefas);
  const segura = quemDependeDe(tarefa.id, tarefas);
  const opcoes = useMemo(
    () =>
      tarefas
        .filter((t) => t.id !== tarefa.id && !(tarefa.dependeDe ?? []).includes(t.id))
        .sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.prioridade - a.prioridade)
        .map((t) => ({ valor: t.id, rotulo: t.titulo, detalhe: aberta(t) ? undefined : nomeStatus(t.status) })),
    [tarefas, tarefa.id, tarefa.dependeDe],
  );

  const ligar = (id: string) => {
    if (!id) return;
    if (criaCiclo(tarefas, tarefa.id, id)) {
      toast("Essa tarefa já depende desta (direta ou indiretamente). Ligar as duas criaria um ciclo.", "erro");
      return;
    }
    const outra = tarefas.find((t) => t.id === id);
    void atualizarComVolta(tarefa.id, (x) => comDependencia(x, id, true), `Agora depende de “${outra?.titulo ?? "outra tarefa"}”.`);
  };
  const tirar = (t: Tarefa) => void atualizarComVolta(tarefa.id, (x) => comDependencia(x, t.id, false), `Não depende mais de “${t.titulo}”.`);

  const todas = [...deps.abertas, ...deps.fechadas];
  const destravou = aberta(tarefa) && todas.length > 0 && deps.abertas.length === 0;

  const seletor = (classe: string, placeholder: string) => (
    <Combobox valor="" aoMudar={ligar} opcoes={opcoes} permitirLimpar={false} placeholder={placeholder}
      buscaPlaceholder="Buscar tarefa..." vazio="Nenhuma tarefa com esse nome." aria-label="Ligar uma tarefa de que esta depende" className={classe} />
  );

  // Nada ligado, nada segurado: o painel é só o cabeçalho com o seletor, em vez de um bloco com uma frase.
  if (todas.length === 0 && segura.length === 0 && deps.sumidas.length === 0)
    return (
      <Painel titulo="Depende de" icone={<Link2 />}
        acoes={seletor("h-7 w-auto max-w-44 border-transparent bg-transparent px-2 text-xs shadow-none hover:border-transparent hover:bg-accent dark:bg-transparent dark:hover:bg-accent", "Ligar a outra tarefa")} />
    );

  return (
    <Painel titulo="Depende de" icone={<Link2 />} contagem={deps.abertas.length || undefined} corpoClassName="flex flex-col gap-2 py-2.5">
      {destravou && (
        <p data-slot="destravou" className="flex items-center gap-1.5 rounded-md bg-sucesso/10 px-2 py-1.5 text-xs font-medium text-sucesso">
          <LockOpen className="size-3.5" /> Tudo de que ela dependia terminou: pode andar.
        </p>
      )}
      {todas.length > 0 ? (
        <ul className="flex flex-col">{todas.map((t) => <LinhaTarefa key={t.id} t={t} aoTirar={() => tirar(t)} />)}</ul>
      ) : (
        <p className="text-xs text-muted-foreground">Nada segura esta tarefa. Se ela só anda depois de outra, ligue aqui.</p>
      )}
      {deps.sumidas.length > 0 && <p className="text-xs text-muted-foreground">{deps.sumidas.length === 1 ? "Uma tarefa ligada foi para a lixeira." : `${deps.sumidas.length} tarefas ligadas foram para a lixeira.`}</p>}
      {seletor("w-full", "Depende de outra tarefa...")}
      {segura.length > 0 && (
        <div data-slot="segura" className="mt-1 border-t pt-2">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Esta tarefa segura</p>
          <ul className="flex flex-col">{segura.map((t) => <LinhaTarefa key={t.id} t={t} />)}</ul>
        </div>
      )}
    </Painel>
  );
}
