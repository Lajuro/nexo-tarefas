"use client";

// Painéis de Configurações que são do aparelho e do jeito de usar: aparência, rotina, atalhos e sobre.

import Link from "next/link";
import { ReactNode } from "react";
import {
  ArrowRight, BellRing, CalendarCheck2, Keyboard, Palette, Repeat2, RotateCcw, ShieldCheck, SlidersHorizontal, Sunrise, Trophy,
  UserRound,
} from "lucide-react";
import pacote from "@/package.json";
import { ChipsInput, Painel } from "@/components/comum";
import { useAparencia } from "@/components/Raiz";
import { abrirPlanejarDia } from "@/components/Shell";
import { OpcoesAparencia } from "@/components/shell/Aparencia";
import { ATALHOS } from "@/components/shell/navegacao";
import { useLembretes } from "@/components/useLembretes";
import { Button } from "@/components/ui/button";
import { useJogo } from "@/components/jogo/useJogo";
import { CampoSwitch, Slider } from "@/components/ui/controles";
import { META_MAXIMA } from "@/lib/jogo";
import { Badge, Kbd } from "@/components/ui/diversos";
import { LIMITES, dataRelativa } from "@/lib/lembretes";
import { abrirPersonalizar } from "@/lib/moldura";
import { usePref, useRotina } from "@/lib/preferencias";
import { diasAte, formatarData, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// ---------- Aparência ----------

export function PainelAparencia() {
  const { restaurarAparencia } = useAparencia();
  return (
    <Painel
      titulo="Aparência"
      icone={<Palette />}
      acoes={
        <>
          <Button variant="ghost" size="sm" onClick={restaurarAparencia}><RotateCcw /> Padrão</Button>
          <Button variant="outline" size="sm" onClick={() => abrirPersonalizar("lateral")}><SlidersHorizontal /> Barras lateral e superior</Button>
        </>
      }
    >
      <OpcoesAparencia />
      <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        Para aumentar ou diminuir tudo de uma vez, use <Kbd>Ctrl</Kbd> <Kbd>+</Kbd> e <Kbd>Ctrl</Kbd> <Kbd>-</Kbd>. O Edge lembra do tamanho escolhido.
      </p>
    </Painel>
  );
}

// ---------- Conquistas e meta do dia ----------

export function PainelJogo() {
  const { pref, mudar, estado } = useJogo();
  return (
    <Painel titulo="Conquistas e meta do dia" icone={<Trophy />}
      acoes={estado && <Button variant="ghost" size="sm" asChild><Link href="/conquistas">Nível {estado.nivel.n} <ArrowRight /></Link></Button>}>
      <div data-slot="painel-jogo" className="flex flex-col gap-3.5">
        <CampoSwitch marcado={pref.ligado} aoMudar={(v) => mudar({ ligado: v })}>Mostrar nível, meta do dia e conquistas</CampoSwitch>
        <div className={cn("flex flex-col gap-3.5 transition-opacity", !pref.ligado && "pointer-events-none opacity-50")}>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium sem-selecao">Meta do dia: <span className="font-semibold text-foreground tabular-nums">{pref.meta}</span> {pref.meta === 1 ? "avanço" : "avanços"}</span>
            <Slider aria-label="Meta do dia" min={1} max={META_MAXIMA} step={1} value={[pref.meta]} onValueChange={([v]) => mudar({ meta: v })} className="max-w-64" />
            <p className="text-[11px] leading-snug text-muted-foreground">Conta como avanço: concluir um passo, registrar algo na linha do tempo ou concluir uma tarefa.</p>
          </div>
          <CampoSwitch marcado={pref.celebrar} aoMudar={(v) => mudar({ celebrar: v })}>Comemorar com aviso e confete quando eu alcançar algo</CampoSwitch>
        </div>
        <p className="border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          O placar é calculado dos seus registros, na hora. Desligar só esconde: nada é apagado e nada extra é gravado.
        </p>
      </div>
    </Painel>
  );
}

// ---------- Rotina e lembretes ----------

const REGRAS: { gravidade: "critico" | "atencao" | "info"; texto: ReactNode }[] = [
  { gravidade: "critico", texto: "Prazo de tarefa ou de passo que vence hoje ou já venceu" },
  { gravidade: "atencao", texto: <>Prazo da tarefa chegando: faltam <N>{LIMITES.prazoProximo} dias</N> ou menos</> },
  { gravidade: "atencao", texto: "Follow-up no dia que você marcou para voltar na tarefa" },
  { gravidade: "atencao", texto: <>Tarefa bloqueada sem novidade há <N>{LIMITES.bloqueada} dias</N></> },
  { gravidade: "atencao", texto: <>Aguardando terceiros sem retorno há <N>{LIMITES.aguardando} dias</N>: hora de cobrar</> },
  { gravidade: "info", texto: <>Tarefa sem movimento há <N>{LIMITES.parada} dias</N></> },
  { gravidade: "info", texto: <>Próximo passo sem prazo em aberto há <N>{LIMITES.passoAntigo} dias</N></> },
  { gravidade: "info", texto: "Tarefa em andamento sem nenhum próximo passo definido" },
];

const COR_GRAVIDADE = { critico: "bg-destructive", atencao: "bg-alerta", info: "bg-info" };

function N({ children }: { children: ReactNode }) {
  return <strong className="font-semibold whitespace-nowrap text-foreground tabular-nums">{children}</strong>;
}

/** Datas no futuro ou vazias contam como "nunca" (não faz sentido um planejamento de amanhã). */
function quando(iso: string) {
  return iso && iso <= hojeISO() ? iso : "";
}

/** Como o usuário aparece nos passos: sem isso, só "Eu" conta como dele. */
export function PainelQuemSouEu() {
  const [nomes, setNomes] = usePref<string[]>("meusNomes", []);
  return (
    <Painel titulo="Como você aparece nos passos" icone={<UserRound />}>
      <p className="text-[13px] leading-snug text-muted-foreground">
        Passos sem responsável ou com “Eu” já contam como seus. Se o Copilot ou você costumam escrever o seu nome, coloque aqui:
        esses passos entram em “Só os meus” e nos seus passos do foco, e os prompts passam a dizer ao Copilot quem é você.
      </p>
      <div data-slot="meus-nomes" className="mt-3 max-w-md">
        <ChipsInput valor={Array.isArray(nomes) ? nomes : []} mudar={setNomes} placeholder="Seu nome e apelidos. Enter para adicionar." />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Fica guardado só neste navegador.</p>
    </Painel>
  );
}

export function PainelRotina() {
  const { rotina, setRotina, carregado } = useRotina();
  const { lembretes, adiados, reativarTodos } = useLembretes();
  const planejou = quando(rotina.ultimoPlanejamento);
  const revisou = quando(rotina.ultimaRevisao);
  const diasDaRevisao = revisou ? -(diasAte(revisou) ?? 0) : null;
  const revisaoAtrasada = diasDaRevisao === null || diasDaRevisao >= 7;

  return (
    <Painel titulo="Rotina e lembretes" icone={<Repeat2 />}>
      <CampoSwitch marcado={rotina.abrirSozinho} aoMudar={(v) => setRotina((r) => ({ ...r, abrirSozinho: v }))}>
        <span className="text-foreground">Abrir o planejamento do dia na primeira visita</span>
      </CampoSwitch>

      <div className="mt-3.5 flex flex-col divide-y rounded-lg border">
        <LinhaRotina
          icone={<Sunrise />}
          titulo="Planejamento do dia"
          slot="ultimo-planejamento"
          detalhe={!carregado ? "" : planejou ? `Último: ${dataRelativa(planejou)}` : "Você ainda não planejou nenhum dia"}
        >
          <Button variant="outline" size="sm" onClick={() => abrirPlanejarDia()}>Planejar o dia agora</Button>
        </LinhaRotina>
        <LinhaRotina
          icone={<CalendarCheck2 />}
          titulo="Revisão semanal"
          slot="ultima-revisao"
          alerta={carregado && revisaoAtrasada}
          detalhe={
            !carregado ? "" : revisou
              ? `Última: ${dataRelativa(revisou)} (${formatarData(revisou)})${revisaoAtrasada ? ". Já passou de uma semana." : ""}`
              : "Você ainda não fez uma revisão"
          }
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/revisao">Fazer a revisão <ArrowRight /></Link>
          </Button>
        </LinhaRotina>
        <LinhaRotina
          icone={<BellRing />}
          titulo="Lembretes"
          slot="lembretes-adiados"
          detalhe={
            <>
              <span className="tabular-nums">{lembretes.length}</span> {lembretes.length === 1 ? "ativo" : "ativos"} agora ·{" "}
              <span className="tabular-nums">{adiados}</span> {adiados === 1 ? "adiado" : "adiados"}
            </>
          }
        >
          <Button variant="outline" size="sm" disabled={adiados === 0} onClick={reativarTodos}>
            <RotateCcw /> Reativar todos
          </Button>
        </LinhaRotina>
      </div>

      <h4 className="mt-4 mb-2 text-xs font-medium text-muted-foreground sem-selecao">Quando o Nexo te lembra</h4>
      <ul className="flex flex-col gap-1.5">
        {REGRAS.map((r, i) => (
          <li key={i} data-slot="regra-lembrete" className="flex items-baseline gap-2.5 text-[13px] leading-snug text-muted-foreground">
            <span aria-hidden className={cn("size-1.5 shrink-0 -translate-y-0.5 rounded-full", COR_GRAVIDADE[r.gravidade])} />
            <span>{r.texto}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground sem-selecao">
        <Legenda cor="bg-destructive">crítico</Legenda>
        <Legenda cor="bg-alerta">atenção</Legenda>
        <Legenda cor="bg-info">aviso</Legenda>
        <span className="ml-auto">Adiar só esconde o lembrete neste aparelho.</span>
      </div>
    </Painel>
  );
}

function Legenda({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-1.5 rounded-full", cor)} />
      {children}
    </span>
  );
}

function LinhaRotina({
  icone, titulo, detalhe, children, alerta, slot,
}: {
  icone: ReactNode; titulo: string; detalhe: ReactNode; children: ReactNode; alerta?: boolean; slot: string;
}) {
  return (
    <div data-slot={slot} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-3.5", alerta ? "bg-alerta/16 text-alerta" : "bg-muted text-muted-foreground")}>
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{titulo}</p>
        <p className={cn("min-h-4 text-xs", alerta ? "text-alerta" : "text-muted-foreground")}>{detalhe}</p>
      </div>
      {children}
    </div>
  );
}

// ---------- Atalhos de teclado ----------

// A lista oficial mora na moldura (components/shell/navegacao.ts), junto de quem implementa as teclas.
// Atalhos que começam com G são em sequência: G e depois a letra.
export function PainelAtalhos() {
  return (
    <Painel titulo="Atalhos de teclado" icone={<Keyboard />} corpoClassName="@container">
      <ul className="grid gap-x-6 @md:grid-cols-2">
        {ATALHOS.map((a) => {
          const emSequencia = a.teclas.length === 2 && a.teclas[0] === "G";
          return (
            <li key={a.descricao} data-slot="atalho" className="flex min-h-8 items-center justify-between gap-3 border-b border-dashed py-1 text-[13px] last:border-0 @md:[&:nth-last-child(2):nth-child(odd)]:border-0">
              <span className="min-w-0 leading-snug">{a.descricao}</span>
              <span className="flex shrink-0 items-center gap-1">
                {a.teclas.map((t, i) => (
                  <span key={t} className="flex items-center gap-1">
                    {i > 0 && emSequencia && <span className="text-[11px] text-muted-foreground">depois</span>}
                    <Kbd>{t}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}

// ---------- Sobre ----------

export function PainelSobre() {
  return (
    <Painel>
      <div data-slot="sobre" className="flex items-center gap-3.5">
        <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm sem-selecao">
          N
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            Nexo <Badge variant="outline" className="font-mono">v{pacote.version}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">Cérebro de tarefas. Sem telemetria, sem conta, sem API de IA.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-sucesso">
          <ShieldCheck className="size-3.5" />
          100% local, nada sai da sua máquina
        </span>
      </div>
    </Painel>
  );
}
