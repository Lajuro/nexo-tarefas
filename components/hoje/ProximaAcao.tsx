"use client";

// Próxima ação (3.21): o bloco do topo da tela Hoje, com UMA coisa a fazer, o motivo e um botão.
// A conta é de lib/proxima-acao.ts (pura). Aqui ficam o gancho que junta os dados vivos (tarefas, lembretes,
// rotina de hoje), a execução do comando com o clique do usuário e o "Agora não".
// O app nunca age sozinho: nada aqui muda dado sem um clique, e toda mudança tem Desfazer.

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { motion } from "motion/react";
import {
  AlarmClock, BellRing, CalendarClock, CircleCheck, Coffee, Footprints, Lightbulb, type LucideIcon, MoonStar, Presentation, Sunrise, Target,
} from "lucide-react";
import { useRotinaDeHoje } from "@/components/jornada/Ferramenta";
import { useNexo } from "@/components/Provider";
import { abrirFecharDia } from "@/components/rotina/FecharDia";
import { useLembretes } from "@/components/useLembretes";
import { Button } from "@/components/ui/button";
import { comFoco, comPassoAlternado } from "@/lib/acoes";
import { suave } from "@/lib/animacoes";
import { usePref, useRotina } from "@/lib/preferencias";
import { type Acao, type Comando, type TipoDaAcao, proximaAcao } from "@/lib/proxima-acao";
import { cn } from "@/lib/utils";

// ---------- "Agora não": as sugestões dispensadas hoje (preferência; amanhã começa do zero) ----------

interface Dispensadas { data: string; chaves: string[] }
const MAX_DISPENSADAS = 80;

function dispensadasDe(x: unknown, hoje: string): string[] {
  const d = (x && typeof x === "object" ? x : {}) as Partial<Dispensadas>;
  return d.data === hoje && Array.isArray(d.chaves) ? d.chaves.filter((c): c is string => typeof c === "string" && c.length <= 200).slice(-MAX_DISPENSADAS) : [];
}

/** A próxima ação e o que vem depois, com os dados de agora. É a mesma conta na tela Hoje e no balão do Foco. */
export function useProximaAcao() {
  const { dados } = useNexo();
  const { grupos } = useLembretes();
  const r = useRotinaDeHoje();
  const { rotina } = useRotina();
  const [bruto, setBruto] = usePref<unknown>("proximaAcaoDispensadas", null);
  const dispensadas = useMemo(() => dispensadasDe(bruto, r.hoje), [bruto, r.hoje]);
  const tarefas = dados?.tarefas;
  const jornadaCumprida = r.conta.estado === "aberto" && r.conta.esperado > 0 && r.conta.falta === 0 && !r.conta.emPausa;
  const resultado = useMemo(
    () => proximaAcao({ hoje: r.hoje, agoraMin: r.agora, tarefas: tarefas ?? [], blocos: r.blocos, grupos, jornadaCumprida, planejouHoje: rotina.ultimoPlanejamento === r.hoje, dispensadas }),
    [r.hoje, r.agora, tarefas, r.blocos, grupos, jornadaCumprida, rotina.ultimoPlanejamento, dispensadas],
  );
  const dispensar = useCallback((chave: string) => setBruto({ data: r.hoje, chaves: [...dispensadas, chave].slice(-MAX_DISPENSADAS) } satisfies Dispensadas), [setBruto, r.hoje, dispensadas]);
  const mostrarDeNovo = useCallback(() => setBruto(null), [setBruto]);
  return { ...resultado, dispensar, mostrarDeNovo, quantasDispensadas: dispensadas.length };
}

/** Executa o comando de uma ação. Só é chamado por um clique do usuário. */
export function useExecutarComando() {
  const router = useRouter();
  const { atualizarComVolta } = useNexo();
  return useCallback(
    (c: Comando) => {
      switch (c.tipo) {
        case "abrir_tarefa": return router.push(`/tarefas/${c.tarefaId}${c.registroId ? `?r=${encodeURIComponent(c.registroId)}` : ""}`);
        case "concluir_passo": return void atualizarComVolta(c.tarefaId, (t) => comPassoAlternado(t, c.registroId, c.passoId, true), "Passo concluído.");
        case "focar": return void atualizarComVolta(c.tarefaId, (t) => comFoco(t, true), "Entrou no foco de hoje.");
        case "reuniao": return router.push(`/tarefas/${c.tarefaId}/reuniao?bloco=${encodeURIComponent(c.blocoId)}`);
        case "rotina": return router.push("/rotina");
        case "planejar_dia": return void window.dispatchEvent(new CustomEvent("nexo:planejar-dia"));
        case "fechar_dia": return abrirFecharDia();
      }
    },
    [router, atualizarComVolta],
  );
}

// ---------- o visual de cada tipo ----------

const VISUAL: Record<TipoDaAcao, { icone: LucideIcon; tom: string }> = {
  reuniao_agora: { icone: Presentation, tom: "bg-info/14 text-info" },
  reuniao_em_breve: { icone: Presentation, tom: "bg-info/14 text-info" },
  bloco: { icone: CalendarClock, tom: "bg-primary/12 text-primary" },
  pausa: { icone: Coffee, tom: "bg-muted text-muted-foreground" },
  critico: { icone: AlarmClock, tom: "bg-destructive/12 text-destructive" },
  passo: { icone: Target, tom: "bg-primary/12 text-primary" },
  foco_sem_passo: { icone: Footprints, tom: "bg-primary/12 text-primary" },
  planejar: { icone: Sunrise, tom: "bg-primary/12 text-primary" },
  sugestao: { icone: Lightbulb, tom: "bg-primary/12 text-primary" },
  atencao: { icone: BellRing, tom: "bg-alerta/16 text-alerta" },
  fechar: { icone: MoonStar, tom: "bg-muted text-muted-foreground" },
};

export const iconeDaAcao = (tipo: TipoDaAcao) => VISUAL[tipo].icone;

function LinhaDepois({ acao, executar }: { acao: Acao; executar: (c: Comando) => void }) {
  const v = VISUAL[acao.tipo];
  return (
    <li data-slot="depois-disso" data-chave={acao.chave} className="flex items-center gap-2 rounded-lg px-1.5">
      <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded [&_svg]:size-3", v.tom)}><v.icone /></span>
      <span className="min-w-0 flex-1 truncate text-[13px]">
        {acao.titulo}
        <span className="text-xs text-muted-foreground"> · {acao.motivo}</span>
      </span>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => executar(acao.comando)}>{acao.rotulo}</Button>
    </li>
  );
}

/** O bloco "Próxima ação" da tela Hoje. */
export function ProximaAcao() {
  const { agora, depois, dispensar, mostrarDeNovo, quantasDispensadas } = useProximaAcao();
  const executar = useExecutarComando();
  const { estado } = useNexo();
  const somenteLeitura = !!estado?.somenteLeitura;
  // em somente leitura, os comandos que gravam ficam desligados; abrir e navegar continuam valendo
  const grava = (c: Comando) => c.tipo === "concluir_passo" || c.tipo === "focar";

  if (!agora) {
    return (
      <section data-slot="proxima-acao" data-vazio className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
        <CircleCheck className="size-4 shrink-0 text-sucesso" />
        <span className="min-w-0 flex-1">
          {quantasDispensadas > 0 ? "Você dispensou as sugestões de agora. Nada foi alterado nas tarefas." : "Nada pedindo você agora. Escolha um foco ou anote o que surgir."}
        </span>
        {quantasDispensadas > 0 && <Button variant="outline" size="sm" data-slot="mostrar-sugestoes" onClick={mostrarDeNovo}>Mostrar de novo</Button>}
      </section>
    );
  }

  const v = VISUAL[agora.tipo];
  return (
    <section data-slot="proxima-acao" data-tipo={agora.tipo} data-chave={agora.chave} aria-label="Próxima ação" className="rounded-xl border border-primary/30 bg-card shadow-xs">
      {/* A ação nova entra com um deslize curto, mas a antiga sai NA HORA: com animação de saída, o botão velho
          continuava clicável por um instante e um segundo clique rápido em "Agora não" caía nele. */}
        <motion.div key={agora.chave} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={suave} className="flex items-start gap-3.5 px-4 py-3">
          <span className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]", v.tom)}><v.icone /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sem-selecao">Próxima ação</span>
              <Button variant="ghost" size="sm" data-slot="agora-nao" className="-my-1 ml-auto shrink-0 text-muted-foreground" onClick={() => dispensar(agora.chave)}>Agora não</Button>
            </div>
            <h2 data-slot="proxima-acao-titulo" className="mt-0.5 text-[15px] leading-snug font-semibold tracking-tight [overflow-wrap:anywhere]">{agora.titulo}</h2>
            <p data-slot="proxima-acao-motivo" className="mt-0.5 text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{agora.motivo}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button data-slot="proxima-acao-botao" disabled={somenteLeitura && grava(agora.comando)} onClick={() => executar(agora.comando)}>{agora.rotulo}</Button>
              {agora.outro && <Button variant="outline" data-slot="proxima-acao-outro" onClick={() => executar(agora.outro!.comando)}>{agora.outro.rotulo}</Button>}
            </div>
          </div>
        </motion.div>
      {depois.length > 0 && (
        <div className="border-t px-2.5 py-1.5">
          <p className="sr-only">Depois disso</p>
          <ul className="flex flex-col">
            {depois.map((a) => <LinhaDepois key={a.chave} acao={a} executar={(c) => (somenteLeitura && grava(c) ? undefined : executar(c))} />)}
          </ul>
        </div>
      )}
    </section>
  );
}
