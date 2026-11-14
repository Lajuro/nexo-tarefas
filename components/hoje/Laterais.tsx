"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Check, CircleCheck, Copy, ListChecks, MessageSquareReply, NotebookPen, TrendingUp } from "lucide-react";
import { Anel } from "@/components/jogo/pecas";
import { useJogo } from "@/components/jogo/useJogo";
import { useCobranca } from "@/components/Esperando";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { IconeStatus, NumeroAnimado, Painel } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { diasEsperando, resumoEspera } from "@/lib/espera";
import { LIMITES, ResumoDia, dataLocal, diasSemAtividade } from "@/lib/lembretes";
import { Tarefa, formatarData, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// ---------- Progresso do dia ----------

function frase(total: number) {
  if (total === 0) return "O dia está começando. O primeiro passo é o que mais conta.";
  if (total <= 2) return "Bom começo. O dia já está andando.";
  if (total <= 5) return "Bom ritmo. Continue assim.";
  return "Dia produtivo. Dá para ver o avanço.";
}

/** O que já andou hoje, para dar a sensação (verdadeira) de progresso. */
export function ProgressoDoDia({ resumo }: { resumo: ResumoDia }) {
  const { passos, registros, concluidas } = resumo.feitoHoje;
  const total = passos + registros + concluidas;

  // Passos das tarefas em foco: os meus em aberto contra os que já risquei hoje.
  const hoje = hojeISO();
  let feitosNosFocos = 0;
  for (const t of resumo.focos)
    for (const r of t.registros) for (const p of r.proximosPassos) if (p.feito && dataLocal(p.feitoEm) === hoje) feitosNosFocos++;
  const totalNosFocos = feitosNosFocos + resumo.passosDosFocos.length;
  const { estado: jogo } = useJogo();

  return (
    <Painel titulo="Progresso de hoje" icone={<TrendingUp />} className="[&_h3]:truncate"
      acoes={jogo && (
        <Link href="/conquistas" data-slot="nivel-hoje"
          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35">
          Nível {jogo.nivel.n} · {jogo.xp} XP
        </Link>
      )}>
      <div data-slot="progresso-do-dia">
        {jogo ? (
          <div data-slot="meta-hoje" className="flex items-center gap-3">
            <Anel parte={jogo.hoje.avancos / jogo.hoje.meta} tamanho={46} espessura={5}>
              {jogo.hoje.bateu ? <Check className="size-4 text-sucesso" strokeWidth={3} /> : <span className="text-xs font-semibold tabular-nums">{jogo.hoje.avancos}/{jogo.hoje.meta}</span>}
            </Anel>
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
              {jogo.hoje.bateu
                ? <><span className="font-medium text-foreground">Meta do dia batida.</span> O que vier agora é bônus.</>
                : jogo.hoje.avancos === 0
                  ? frase(total)
                  : <><span className="font-medium text-foreground">{jogo.hoje.meta - jogo.hoje.avancos === 1 ? "Falta 1 avanço" : `Faltam ${jogo.hoje.meta - jogo.hoje.avancos} avanços`}</span> para a meta do dia.</>}
            </p>
          </div>
        ) : (
          <p className="text-[13px] leading-snug text-muted-foreground">{frase(total)}</p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Marcador icone={<ListChecks />} valor={passos} rotulo={passos === 1 ? "passo feito" : "passos feitos"} />
          <Marcador icone={<NotebookPen />} valor={registros} rotulo={registros === 1 ? "registro" : "registros"} />
          <Marcador icone={<CircleCheck />} valor={concluidas} rotulo={concluidas === 1 ? "concluída" : "concluídas"} />
        </div>
        {totalNosFocos > 0 && (
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Seus passos nos focos</span>
              <span className="font-medium tabular-nums">
                {feitosNosFocos} de {totalNosFocos}
              </span>
            </div>
            <Progress valor={(feitosNosFocos / totalNosFocos) * 100} className={feitosNosFocos === totalNosFocos ? "[&>div]:bg-sucesso" : undefined} />
          </div>
        )}
      </div>
    </Painel>
  );
}

function Marcador({ icone, valor, rotulo }: { icone: ReactNode; valor: number; rotulo: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2.5 py-2">
      <div className="flex items-center justify-between">
        <NumeroAnimado valor={valor} className={cn("text-lg leading-none font-semibold tracking-tight", valor ? "text-sucesso" : "text-muted-foreground/60")} />
        <span className={cn("[&_svg]:size-3.5", valor ? "text-sucesso/80" : "text-muted-foreground/50")}>{icone}</span>
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{rotulo}</div>
    </div>
  );
}

// ---------- Listas compactas (aguardando retorno, bloqueadas e paradas) ----------

function LinhaTarefa({ tarefa: t, limite }: { tarefa: Tarefa; limite: number }) {
  const { copiar, cobrei } = useCobranca();
  // Com "esperando quem" preenchido, a conta é desde a última cobrança; sem, desde a última novidade.
  const espera = t.status === "aguardando" ? resumoEspera(t) : "";
  const dias = (espera ? diasEsperando(t) : null) ?? diasSemAtividade(t);
  const passou = dias >= limite;
  if (espera)
    return (
      <div data-slot="linha-espera" className="group/esp relative">
        <MenuContextoTarefa tarefa={t}>
          <Link
            href={`/tarefas/${t.id}`}
            data-slot="linha-tarefa"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35"
          >
            <IconeStatus status={t.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{t.titulo}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/80">{t.esperando?.quem || "Esperando"}</span>
                {t.esperando?.oQue ? `${t.esperando.quem ? ": " : " "}${t.esperando.oQue}` : ""}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums transition-opacity group-focus-within/esp:opacity-0 group-hover/esp:opacity-0",
                passou ? "bg-alerta/16 text-alerta" : "bg-muted text-muted-foreground",
              )}
            >
              {dias === 0 ? "hoje" : `${dias}d`}
            </span>
          </Link>
        </MenuContextoTarefa>
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5 rounded-md bg-card opacity-0 shadow-xs ring-1 ring-border transition-opacity group-focus-within/esp:opacity-100 group-hover/esp:opacity-100">
          <Dica texto="Copiar mensagem de cobrança">
            <Button variant="ghost" size="icon-sm" aria-label={`Copiar mensagem de cobrança de “${t.titulo}”`} onClick={() => copiar(t)}><Copy /></Button>
          </Dica>
          <Dica texto="Cobrei hoje: anota na linha do tempo e recomeça a contagem">
            <Button variant="ghost" size="icon-sm" aria-label={`Marcar que cobrei “${t.titulo}” hoje`} onClick={() => cobrei(t)}><MessageSquareReply /></Button>
          </Dica>
        </div>
      </div>
    );
  return (
    <MenuContextoTarefa tarefa={t}>
      <Link
        href={`/tarefas/${t.id}`}
        data-slot="linha-tarefa"
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35"
      >
        <IconeStatus status={t.status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{t.titulo}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {dias === 0 ? "Teve novidade hoje" : dias === 1 ? "Sem novidade desde ontem" : `Sem novidade há ${dias} dias`}
            {t.prazo ? ` · prazo ${formatarData(t.prazo, false)}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums",
            passou ? (t.status === "bloqueada" ? "bg-destructive/12 text-destructive" : "bg-alerta/16 text-alerta") : "bg-muted text-muted-foreground",
          )}
        >
          {dias === 0 ? "hoje" : `${dias}d`}
        </span>
      </Link>
    </MenuContextoTarefa>
  );
}

function ListaCompacta({
  titulo, icone, tarefas, vazio, limiteDe,
}: {
  titulo: string; icone: ReactNode; tarefas: Tarefa[]; vazio: string; limiteDe: (t: Tarefa) => number;
}) {
  return (
    <Painel titulo={titulo} icone={icone} contagem={tarefas.length || undefined} corpoClassName="p-1.5">
      {tarefas.length === 0 ? (
        <p className="px-2 py-2.5 text-xs text-muted-foreground">{vazio}</p>
      ) : (
        <div className="flex flex-col">
          {tarefas.slice(0, 6).map((t) => (
            <LinhaTarefa key={t.id} tarefa={t} limite={limiteDe(t)} />
          ))}
          {tarefas.length > 6 && (
            <Link href="/tarefas" className="mx-2 mt-1 mb-1 w-fit rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
              Ver todas as {tarefas.length}
            </Link>
          )}
        </div>
      )}
    </Painel>
  );
}

export function AguardandoRetorno({ tarefas, icone }: { tarefas: Tarefa[]; icone: ReactNode }) {
  return (
    <ListaCompacta
      titulo="Aguardando retorno"
      icone={icone}
      tarefas={tarefas}
      vazio="Ninguém ficou de responder nada para você."
      limiteDe={() => LIMITES.aguardando}
    />
  );
}

export function BloqueadasEParadas({ bloqueadas, paradas, icone }: { bloqueadas: Tarefa[]; paradas: Tarefa[]; icone: ReactNode }) {
  return (
    <ListaCompacta
      titulo="Bloqueadas e paradas"
      icone={icone}
      tarefas={[...bloqueadas, ...paradas]}
      vazio="Nada travado. Tudo em movimento."
      limiteDe={(t) => (t.status === "bloqueada" ? LIMITES.bloqueada : LIMITES.parada)}
    />
  );
}
