"use client";

// Conquistas: o placar do uso do Nexo. Nível e XP, meta do dia, sequência, e as conquistas com o progresso de cada uma.
// Tudo é calculado na hora a partir dos dados (lib/jogo.ts): nada aqui é gravado.

import { Check, Flame, Medal, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { useJogo } from "@/components/jogo/useJogo";
import { Anel, CartaoConquista } from "@/components/jogo/pecas";
import { Contador, Estatistica, NumeroAnimado, Pagina, Painel, Vazio } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Dica } from "@/components/ui/popover";
import { formatarMinutos } from "@/lib/acoes";
import { type GrupoDeConquista, NOME_DO_GRUPO, XP } from "@/lib/jogo";
import { formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const GRUPOS: GrupoDeConquista[] = ["passos", "registros", "tarefas", "ritmo", "foco", "organizacao"];
const DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaDaSemana = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return DIA[new Date(a, m - 1, d).getDay()];
};

export default function Conquistas() {
  const { estado, pref, mudar } = useJogo();

  if (!pref.ligado || !estado)
    return (
      <Pagina titulo="Conquistas" descricao="Nível, meta do dia e conquistas pelo uso do Nexo." estreita>
        <div className="px-6 py-8">
          <Vazio titulo="As conquistas estão desligadas" icone={<Trophy />}>
            <p className="max-w-[48ch]">Com elas ligadas, o Nexo mostra seu nível, a meta do dia e as conquistas, e comemora quando você alcança algo. Seus dados não mudam.</p>
            <Button className="mt-2" data-slot="ligar-jogo" onClick={() => mudar({ ligado: true })}><Sparkles /> Ligar</Button>
          </Vazio>
        </div>
      </Pagina>
    );

  const { nivel, hoje, sequencia, recorde, totais, conquistas, ultimosDias } = estado;
  const feitas = conquistas.filter((c) => c.feita);
  const maiorXp = Math.max(1, ...ultimosDias.map((d) => d.xp));
  // a próxima a cair: a que está mais perto, entre as que ainda faltam
  const proxima = conquistas.filter((c) => !c.feita).sort((a, b) => b.atual / b.alvo - a.atual / a.alvo)[0];

  return (
    <Pagina titulo="Conquistas" descricao="O que você já construiu usando o Nexo. Tudo vem dos seus registros: nada é inventado.">
      <div className="mx-auto w-full max-w-[1360px] px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <section data-slot="cartao-nivel" className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex items-center gap-5">
              <Anel parte={nivel.parte} tamanho={104} espessura={8} completo={false}>
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Nível</span>
                  <span data-slot="nivel" className="mt-0.5 text-4xl font-semibold tracking-tight tabular-nums">{nivel.n}</span>
                </span>
              </Anel>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold tracking-tight">{nivel.nome}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  <span data-slot="xp" className="font-medium text-foreground tabular-nums"><NumeroAnimado valor={estado.xp} /></span> XP no total.
                  Faltam <span className="font-medium text-foreground tabular-nums">{nivel.falta}</span> para o nível {nivel.n + 1}.
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${Math.max(2, nivel.parte * 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>{nivel.xpInicio} XP</span>
                  <span>{nivel.xpProximo} XP</span>
                </div>
              </div>
            </div>
            <div className="relative mt-5 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground sem-selecao">XP dos últimos 14 dias</p>
              <div data-slot="grafico-xp" className="flex h-20 items-end gap-1.5">
                {ultimosDias.map((d, i) => (
                  <Dica key={d.data} texto={`${formatarData(d.data, false)}: ${d.xp} XP em ${d.avancos} ${d.avancos === 1 ? "avanço" : "avanços"}`}>
                    <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div className={cn("w-full rounded-t-[3px] transition-[height] duration-500 ease-out", d.xp ? (i === ultimosDias.length - 1 ? "bg-primary" : "bg-primary/45") : "bg-muted")}
                        style={{ height: `${d.xp ? Math.max(8, (d.xp / maiorXp) * 100) : 4}%` }} />
                      <span className={cn("text-[9px] leading-none text-muted-foreground", i === ultimosDias.length - 1 && "font-semibold text-foreground")}>{diaDaSemana(d.data)}</span>
                    </div>
                  </Dica>
                ))}
              </div>
            </div>
          </section>

          <div className="flex min-w-0 flex-col gap-4">
            <section data-slot="meta-do-dia" className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
              <Anel parte={hoje.avancos / hoje.meta} tamanho={68} espessura={6}>
                {hoje.bateu ? <Check className="size-6 text-sucesso" strokeWidth={3} /> : <span className="text-base font-semibold tabular-nums">{hoje.avancos}<span className="text-muted-foreground">/{hoje.meta}</span></span>}
              </Anel>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight"><Target className="size-3.5 text-primary" /> Meta de hoje</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {hoje.bateu
                    ? `Batida, com ${hoje.avancos} ${hoje.avancos === 1 ? "avanço" : "avanços"} e ${hoje.xp} XP. O que vier agora é bônus.`
                    : hoje.avancos === 0
                      ? `Faça ${hoje.meta} avanços hoje: concluir um passo, registrar o que aconteceu ou fechar uma tarefa.`
                      : `Já são ${hoje.avancos}. ${hoje.meta - hoje.avancos === 1 ? "Falta 1 avanço" : `Faltam ${hoje.meta - hoje.avancos} avanços`} para bater a meta.`}
                </p>
              </div>
            </section>
            <div className="grid grid-cols-2 gap-3">
              <Estatistica rotulo="Dias úteis seguidos" valor={sequencia.atual} icone={<Flame />} tom="alerta" />
              <Estatistica rotulo="Melhor sequência" valor={sequencia.melhor} icone={<Flame />} />
              <Estatistica rotulo="Conquistas" valor={feitas.length} icone={<Medal />} tom="primario" />
              <Estatistica rotulo="Recorde de avanços num dia" valor={recorde?.avancos ?? 0} icone={<Zap />} tom="sucesso" />
            </div>
          </div>
        </div>

        {proxima && (
          <div data-slot="proxima-conquista" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-[13px] dark:bg-primary/[0.08]">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <span><span className="text-muted-foreground">Mais perto de cair:</span> <strong className="font-semibold">{proxima.nome}</strong></span>
            <span className="text-muted-foreground">{proxima.descricao} Você está em {proxima.atual} de {proxima.alvo}.</span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-6">
          {GRUPOS.map((g) => {
            const doGrupo = conquistas.filter((c) => c.grupo === g);
            return (
              <section key={g} data-slot="grupo-conquistas" data-grupo={g}>
                <div className="mb-2.5 flex items-center gap-2">
                  <h2 className="text-[13px] font-semibold tracking-tight">{NOME_DO_GRUPO[g]}</h2>
                  <Contador n={doGrupo.filter((c) => c.feita).length} />
                  <span className="text-[11px] text-muted-foreground">de {doGrupo.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {doGrupo.map((c) => <CartaoConquista key={c.id} c={c} />)}
                </div>
              </section>
            );
          })}
        </div>

        <Painel titulo="Como o XP é contado" icone={<Sparkles />} className="mt-6" corpoClassName="px-3.5 py-3">
          <ul className="grid gap-x-6 gap-y-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
            <li><strong className="font-semibold text-foreground tabular-nums">{XP.passo} XP</strong> por passo concluído <span className="tabular-nums">({totais.passos} até agora)</span></li>
            <li><strong className="font-semibold text-foreground tabular-nums">{XP.registro} XP</strong> por registro na linha do tempo <span className="tabular-nums">({totais.registros})</span></li>
            <li><strong className="font-semibold text-foreground tabular-nums">{XP.reuniao} XP</strong> quando o registro é de uma reunião <span className="tabular-nums">({totais.reunioes})</span></li>
            <li><strong className="font-semibold text-foreground tabular-nums">{XP.concluida} XP</strong> por tarefa concluída <span className="tabular-nums">({totais.concluidas})</span></li>
            <li><strong className="font-semibold text-foreground tabular-nums">{XP.minutoDeFoco} XP</strong> por minuto de sessão de foco, até {XP.maxFocoPorSessao} por sessão <span className="tabular-nums">({formatarMinutos(totais.minutosDeFoco)} em {totais.sessoes})</span></li>
            <li>Nada é guardado à parte: o placar é recalculado dos seus dados, então vale em qualquer computador.</li>
          </ul>
        </Painel>
      </div>
    </Pagina>
  );
}
