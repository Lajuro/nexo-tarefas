"use client";

// Menu de ações de uma tarefa, igual em todo lugar onde uma tarefa aparece:
//   <MenuContextoTarefa tarefa={t}>...card...</MenuContextoTarefa>   → botão direito
//   <BotaoMenuTarefa tarefa={t} />                                    → botão "..."

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, AlarmClockOff, ArrowUpRight, Copy, Ellipsis, Gauge, Hourglass, LayoutTemplate, Merge, MessageSquareReply, Pin, PinOff, Target, Timer, Trash2 } from "lucide-react";
import { useNexo } from "./Provider";
import { useConfirmar } from "./Raiz";
import { pedirJuntarTarefa } from "./MoverEJuntar";
import { IconeStatus, copiarTexto } from "./comum";
import { pedirEspera, useCobranca } from "@/components/Esperando";
import { pedirModelo } from "@/components/Modelos";
import { DURACOES, iniciarSessao } from "@/components/shell/SessaoFoco";
import { Button } from "@/components/ui/button";
import * as M from "@/components/ui/menu";
import { somarDias } from "@/components/ui/data";
import { aplicarStatus, comFixada, comFoco, comLembrete, ehFocoHoje } from "@/lib/acoes";
import { aberta } from "@/lib/lembretes";
import { STATUS, Status, Tarefa, formatarData, hojeISO } from "@/lib/tipos";

/** Ações de tarefa prontas para usar em botões fora do menu também. */
export function useAcoesTarefa() {
  const { atualizarTarefa, excluirTarefa, toast } = useNexo();
  const confirmar = useConfirmar();
  const router = useRouter();
  return {
    abrir: (t: Tarefa) => router.push(`/tarefas/${t.id}`),
    mudarStatus: async (t: Tarefa, s: Status) => {
      const ok = await atualizarTarefa(t.id, (x) => aplicarStatus(x, s, x));
      // Foi para "aguardando" sem dizer de quem: é a hora em que isso está fresco na cabeça.
      if (ok && s === "aguardando" && t.status !== "aguardando" && !t.esperando) pedirEspera(t.id);
      return ok;
    },
    mudarPrioridade: (t: Tarefa, p: number) => atualizarTarefa(t.id, (x) => ({ ...x, prioridade: p })),
    alternarFoco: async (t: Tarefa) => {
      const ligar = !ehFocoHoje(t);
      if (await atualizarTarefa(t.id, (x) => comFoco(x, ligar))) toast(ligar ? "Entrou no foco de hoje." : "Saiu do foco de hoje.", "info");
    },
    comecarSessao: (t: Tarefa, minutos: number) => {
      if (iniciarSessao(t.id, minutos)) toast(`Sessão de foco de ${minutos} min começou. O cronômetro fica na barra superior.`, "info");
      else toast("Já existe uma sessão de foco em andamento. Encerre ou registre a atual primeiro.", "erro");
    },
    alternarFixada: async (t: Tarefa) => {
      const ligar = !t.fixada;
      if (await atualizarTarefa(t.id, (x) => comFixada(x, ligar))) toast(ligar ? "Fixada na barra lateral." : "Saiu das fixadas.", "info");
    },
    lembrarEm: async (t: Tarefa, data: string | null) => {
      if (await atualizarTarefa(t.id, (x) => comLembrete(x, data)))
        toast(data ? `Vou te lembrar em ${formatarData(data)}.` : "Lembrete removido.", "info");
    },
    excluir: async (t: Tarefa, depois?: () => void) => {
      const ok = await confirmar({
        titulo: "Mover esta tarefa para a lixeira?",
        descricao: `“${t.titulo}” sai da lista, mas dá para restaurar depois em Configurações.`,
        confirmar: "Mover para a lixeira",
        perigo: true,
      });
      if (ok && (await excluirTarefa(t.id))) depois?.();
    },
  };
}

type Kit = {
  Item: typeof M.DropdownMenuItem;
  Sub: typeof M.DropdownMenuSub;
  SubTrigger: typeof M.DropdownMenuSubTrigger;
  SubContent: typeof M.DropdownMenuSubContent;
  Separator: typeof M.DropdownMenuSeparator;
  RadioGroup: typeof M.DropdownMenuRadioGroup;
  RadioItem: typeof M.DropdownMenuRadioItem;
};

const KIT_SUSPENSO: Kit = {
  Item: M.DropdownMenuItem, Sub: M.DropdownMenuSub, SubTrigger: M.DropdownMenuSubTrigger, SubContent: M.DropdownMenuSubContent,
  Separator: M.DropdownMenuSeparator, RadioGroup: M.DropdownMenuRadioGroup, RadioItem: M.DropdownMenuRadioItem,
};
const KIT_CONTEXTO = {
  Item: M.ContextMenuItem, Sub: M.ContextMenuSub, SubTrigger: M.ContextMenuSubTrigger, SubContent: M.ContextMenuSubContent,
  Separator: M.ContextMenuSeparator, RadioGroup: M.ContextMenuRadioGroup, RadioItem: M.ContextMenuRadioItem,
} as unknown as Kit;

function Itens({ t, k, semAbrir, aoExcluir }: { t: Tarefa; k: Kit; semAbrir?: boolean; aoExcluir?: () => void }) {
  const a = useAcoesTarefa();
  const cobranca = useCobranca();
  const { toast } = useNexo();
  const hoje = hojeISO();
  const foco = ehFocoHoje(t);
  return (
    <>
      {!semAbrir && (
        <k.Item onSelect={() => a.abrir(t)}>
          <ArrowUpRight /> Abrir tarefa
        </k.Item>
      )}
      {aberta(t) && (
        <k.Item onSelect={() => a.alternarFoco(t)}>
          <Target className={foco ? "!text-primary" : undefined} /> {foco ? "Tirar do foco de hoje" : "Focar hoje"}
        </k.Item>
      )}
      {aberta(t) && (
        <k.Sub>
          <k.SubTrigger><Timer /> Sessão de foco</k.SubTrigger>
          <k.SubContent>
            {DURACOES.map((min) => (
              <k.Item key={min} onSelect={() => a.comecarSessao(t, min)}>{min} minutos</k.Item>
            ))}
          </k.SubContent>
        </k.Sub>
      )}
      <k.Item onSelect={() => a.alternarFixada(t)}>
        {t.fixada ? <PinOff /> : <Pin />} {t.fixada ? "Tirar das fixadas" : "Fixar na barra lateral"}
      </k.Item>
      <k.Separator />
      <k.Sub>
        <k.SubTrigger><IconeStatus status={t.status} /> Status</k.SubTrigger>
        <k.SubContent>
          <k.RadioGroup value={t.status} onValueChange={(s) => a.mudarStatus(t, s as Status)}>
            {STATUS.map((s) => (
              <k.RadioItem key={s.id} value={s.id}><IconeStatus status={s.id} /> {s.nome}</k.RadioItem>
            ))}
          </k.RadioGroup>
        </k.SubContent>
      </k.Sub>
      <k.Sub>
        <k.SubTrigger><Gauge /> Prioridade</k.SubTrigger>
        <k.SubContent className="min-w-36">
          <k.RadioGroup value={String(t.prioridade)} onValueChange={(p) => a.mudarPrioridade(t, Number(p))}>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((p) => (
              <k.RadioItem key={p} value={String(p)}>
                <span className="w-4 text-center font-medium tabular-nums">{p}</span>
                <span className="text-muted-foreground">{p === 10 ? "urgente" : p === 1 ? "pode esperar" : ""}</span>
              </k.RadioItem>
            ))}
          </k.RadioGroup>
        </k.SubContent>
      </k.Sub>
      {t.status === "aguardando" && (
        <>
          <k.Item onSelect={() => pedirEspera(t.id)}>
            <Hourglass /> {t.esperando ? "Esperando: alterar..." : "Esperando quem?..."}
          </k.Item>
          {t.esperando && <k.Item onSelect={() => cobranca.copiar(t)}><Copy /> Copiar mensagem de cobrança</k.Item>}
          {t.esperando && <k.Item onSelect={() => cobranca.cobrei(t)}><MessageSquareReply /> Cobrei hoje</k.Item>}
        </>
      )}
      {aberta(t) && (
        <k.Sub>
          <k.SubTrigger><AlarmClock /> Lembrar de voltar{t.lembrarEm ? ` (${formatarData(t.lembrarEm, false)})` : ""}</k.SubTrigger>
          <k.SubContent>
            <k.Item onSelect={() => a.lembrarEm(t, somarDias(hoje, 1))}>Amanhã</k.Item>
            <k.Item onSelect={() => a.lembrarEm(t, somarDias(hoje, 3))}>Em 3 dias</k.Item>
            <k.Item onSelect={() => a.lembrarEm(t, somarDias(hoje, 7))}>Em 1 semana</k.Item>
            <k.Item onSelect={() => a.lembrarEm(t, somarDias(hoje, 15))}>Em 15 dias</k.Item>
            {t.lembrarEm && (
              <>
                <k.Separator />
                <k.Item onSelect={() => a.lembrarEm(t, null)}><AlarmClockOff /> Remover lembrete</k.Item>
              </>
            )}
          </k.SubContent>
        </k.Sub>
      )}
      <k.Separator />
      <k.Item onSelect={async () => (await copiarTexto(t.titulo)) && toast("Título copiado.", "info")}>
        <Copy /> Copiar título
      </k.Item>
      <k.Item onSelect={() => pedirModelo({ tarefaId: t.id })}>
        <LayoutTemplate /> Salvar como modelo...
      </k.Item>
      <k.Item onSelect={() => pedirJuntarTarefa(t.id)}>
        <Merge /> Juntar em outra tarefa...
      </k.Item>
      <k.Item perigo onSelect={() => a.excluir(t, aoExcluir)}>
        <Trash2 /> Mover para a lixeira
      </k.Item>
    </>
  );
}

/** Envolve qualquer elemento e abre o menu da tarefa com o botão direito. */
export function MenuContextoTarefa({ tarefa, children, aoExcluir }: { tarefa: Tarefa; children: ReactNode; aoExcluir?: () => void }) {
  return (
    <M.ContextMenu>
      <M.ContextMenuTrigger asChild>{children}</M.ContextMenuTrigger>
      <M.ContextMenuContent className="w-56">
        <Itens t={tarefa} k={KIT_CONTEXTO} aoExcluir={aoExcluir} />
      </M.ContextMenuContent>
    </M.ContextMenu>
  );
}

/** Botão "..." que abre o mesmo menu. */
export function BotaoMenuTarefa({
  tarefa, semAbrir, aoExcluir, className,
}: {
  tarefa: Tarefa; semAbrir?: boolean; aoExcluir?: () => void; className?: string;
}) {
  return (
    <M.DropdownMenu>
      <M.DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Mais ações da tarefa" className={className}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <Ellipsis />
        </Button>
      </M.DropdownMenuTrigger>
      <M.DropdownMenuContent className="w-56" onClick={(e) => e.stopPropagation()}>
        <Itens t={tarefa} k={KIT_SUSPENSO} semAbrir={semAbrir} aoExcluir={aoExcluir} />
      </M.DropdownMenuContent>
    </M.DropdownMenu>
  );
}
