"use client";

// Os painéis da tela de rotina: o ponto do dia (com a hora de sair), o resumo do plano (com a hora extra
// planejada), a semana e a visão do banco de horas do mês.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarOff, ChevronLeft, ChevronRight, CircleAlert, ClipboardCopy, Clock, Coffee, Hourglass, LogIn, LogOut, PencilLine, Play, Plus, RotateCcw, Scale, Target, TrendingUp,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Painel, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Progress, Table, TBody, Td, Th, THead, Tr } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { itemLista, lista } from "@/lib/animacoes";
import {
  type ContaDoPonto, type Jornada, type LinhaDoBanco, type ResumoDoPlano, DIA_CURTO, bancoDeHoras, duracao, emHora, emMinutos, linhaDoDia, mesDe, saldoEmTexto, semanaDe, somarDiasA, textoDoBanco,
} from "@/lib/jornada";
import { aberta } from "@/lib/lembretes";
import type { BlocoDaJornada, DiaDaJornada, Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CampoHora, horaDeAgora, usePonto } from "./pecas";
import { useEncerrarDia } from "@/components/rotina/FecharDia";

export const corDoSaldo = (min: number | null) => (min == null || min === 0 ? "text-muted-foreground" : min > 0 ? "text-sucesso" : "text-destructive");

function Numero({ rotulo, valor, tom, slot }: { rotulo: string; valor: string; tom?: string; slot?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      <p data-slot={slot} className={cn("truncate text-[15px] font-semibold tracking-tight tabular-nums", tom)}>{valor}</p>
    </div>
  );
}

// =====================================================================
// O ponto do dia
// =====================================================================

export function PainelDoPonto({
  data, dia, conta, ehHoje, agora, aoAjustar,
}: {
  data: string; dia: DiaDaJornada; conta: ContaDoPonto; ehHoje: boolean; agora: number; aoAjustar: () => void;
}) {
  const ponto = usePonto(data);
  const encerrar = useEncerrarDia(data);
  const [hora, setHora] = useState("");
  const p = dia.ponto;
  const pausaAberta = p.pausas.find((q) => !q.fim);
  const parte = conta.esperado > 0 ? (conta.trabalhado / conta.esperado) * 100 : conta.trabalhado > 0 ? 100 : 0;

  return (
    <Painel
      titulo={ehHoje ? "Jornada de hoje" : "Jornada do dia"}
      icone={<Clock />}
      acoes={
        <Dica texto="Corrigir horários, informar pausas ou marcar folga">
          <Button variant="ghost" size="sm" data-slot="ajustar-horarios" onClick={aoAjustar}><PencilLine /> Ajustar</Button>
        </Dica>
      }
    >
      <div data-slot="painel-do-ponto" data-estado={conta.estado} className="flex flex-col gap-3 p-3.5">
        {dia.folga && (
          <p data-slot="aviso-de-folga" className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <CalendarOff className="size-3.5 shrink-0" /> Dia marcado como folga: o que você trabalhar conta como hora extra.
          </p>
        )}

        {conta.estado === "sem-registro" && (
          <>
            <p className="text-[13px] text-muted-foreground">
              {ehHoje
                ? conta.esperado > 0
                  ? `Registre a entrada e o app diz a que horas você sai (${duracao(conta.esperado)} de trabalho, mais a pausa).`
                  : "Hoje não é dia de expediente. Se for trabalhar, registre a entrada: tudo conta como hora extra."
                : "Nenhum horário registrado neste dia. Ele não entra no banco de horas."}
            </p>
            {ehHoje ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button data-slot="registrar-entrada" onClick={() => ponto.entrar()}><LogIn /> Entrei agora ({horaDeAgora()})</Button>
                <span className="text-xs text-muted-foreground">ou entrei às</span>
                <CampoHora aria-label="Hora em que entrei" valor={hora} aoMudar={(h) => { setHora(h); if (h) ponto.entrar(h); }} placeholder="08:00" />
              </div>
            ) : (
              <Button variant="outline" className="self-start" onClick={aoAjustar}><PencilLine /> Informar os horários</Button>
            )}
          </>
        )}

        {conta.estado === "sem-saida" && (
          <>
            <p data-slot="aviso-sem-saida" className="flex items-start gap-2 rounded-lg border border-alerta/30 bg-alerta/10 px-2.5 py-2 text-xs text-alerta">
              <CircleAlert className="mt-px size-3.5 shrink-0" />
              <span>Entrada às {p.entrada}, mas a saída não foi registrada. Este dia não entra no banco de horas até você informar a saída.</span>
            </p>
            <Button variant="outline" className="self-start" onClick={aoAjustar}><PencilLine /> Informar a saída</Button>
          </>
        )}

        {(conta.estado === "aberto" || conta.estado === "fechado") && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Numero rotulo="Entrada" valor={p.entrada ?? ""} slot="ponto-entrada" />
              {conta.estado === "aberto" ? (
                <Numero rotulo={conta.saidaPrevista != null ? "Você sai às" : "Saída"} valor={conta.saidaPrevista != null ? emHora(conta.saidaPrevista) : "livre"} tom={conta.extra > 0 && conta.saidaPrevista != null ? "text-alerta" : undefined} slot="saida-prevista" />
              ) : (
                <Numero rotulo="Saída" valor={p.saida ?? ""} slot="ponto-saida" />
              )}
              {conta.estado === "aberto" ? (
                <Numero rotulo={conta.extra > 0 ? "Hora extra até agora" : "Falta"} valor={conta.extra > 0 ? duracao(conta.extra) : duracao(conta.falta)} tom={conta.extra > 0 ? "text-alerta" : undefined} slot="ponto-falta" />
              ) : (
                <Numero rotulo="Saldo do dia" valor={saldoEmTexto(conta.saldo ?? 0)} tom={corDoSaldo(conta.saldo)} slot="saldo-do-dia" />
              )}
            </div>

            <div>
              <Progress valor={parte} cor={conta.esperado > 0 && conta.trabalhado > conta.esperado ? "var(--alerta)" : undefined} />
              <p data-slot="ponto-trabalhado" className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                Trabalhado {duracao(conta.trabalhado)}{conta.esperado > 0 ? ` de ${duracao(conta.esperado)}` : ""}
                {conta.pausas > 0 && ` · pausa ${duracao(conta.pausas)}${conta.pausaDescontada ? " (não registrada, descontada)" : ""}`}
              </p>
              {conta.estado === "aberto" && conta.saidaPrevista != null && (
                <p data-slot="conta-da-saida" className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {p.entrada} + {duracao(conta.esperado)} de trabalho + {duracao(conta.pausaNaPrevisao)} de pausa{p.pausas.length ? " (registrada)" : " (planejada)"}
                </p>
              )}
            </div>

            {pausaAberta && (
              <p data-slot="em-pausa" className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                <Coffee className="size-3.5 shrink-0 text-muted-foreground" /> Em pausa desde as {pausaAberta.inicio}
                {ehHoje && <span className="text-muted-foreground tabular-nums">({duracao(Math.max(0, agora - emMinutos(pausaAberta.inicio)))})</span>}
              </p>
            )}

            {conta.estado === "aberto" && ehHoje && (
              <div className="flex flex-wrap gap-2">
                {pausaAberta ? (
                  <Button data-slot="voltar-da-pausa" onClick={() => ponto.voltar()}><Play /> Voltei da pausa</Button>
                ) : (
                  <Button variant="outline" data-slot="sair-para-pausa" onClick={() => ponto.pausar()}><Coffee /> Sair para a pausa</Button>
                )}
                <Button variant={conta.falta === 0 && !pausaAberta ? "default" : "outline"} data-slot="encerrar-o-dia" onClick={() => void encerrar()}><LogOut /> Encerrar o dia</Button>
              </div>
            )}
            {conta.estado === "fechado" && ehHoje && (
              <Button variant="ghost" size="sm" className="self-start" data-slot="reabrir-o-dia" onClick={() => ponto.reabrir()}><RotateCcw /> Voltei a trabalhar (reabrir o dia)</Button>
            )}
          </>
        )}
      </div>
    </Painel>
  );
}

// =====================================================================
// O plano do dia
// =====================================================================

export function PainelDoPlano({
  resumo, esperado, blocos, focos, aoEncaixar,
}: {
  resumo: ResumoDoPlano; esperado: number; blocos: BlocoDaJornada[]; focos: Tarefa[]; aoEncaixar: (t: Tarefa) => void;
}) {
  const semHorario = focos.filter((t) => aberta(t) && !blocos.some((b) => b.tarefaId === t.id));
  return (
    <Painel titulo="Plano do dia" icone={<Target />}>
      <div data-slot="painel-do-plano" className="flex flex-col gap-3 p-3.5">
        {blocos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum bloco ainda. Clique num horário da linha do tempo para reservar um tempo para algo.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Numero rotulo="Planejado" valor={duracao(resumo.trabalho)} slot="plano-trabalho" />
            <Numero rotulo="Pausas" valor={duracao(resumo.pausa)} />
            {resumo.extra > 0 ? (
              <Numero rotulo="Hora extra" valor={duracao(resumo.extra)} tom="text-alerta" slot="plano-extra" />
            ) : (
              <Numero rotulo="Sem plano" valor={duracao(resumo.livre)} slot="plano-livre" />
            )}
          </div>
        )}

        {resumo.extra > 0 && (
          <p data-slot="aviso-de-extra" className="flex items-start gap-2 rounded-lg border border-alerta/30 bg-alerta/10 px-2.5 py-2 text-xs text-alerta">
            <TrendingUp className="mt-px size-3.5 shrink-0" />
            <span>
              {esperado > 0
                ? `O plano tem ${duracao(resumo.trabalho)} de trabalho para uma jornada de ${duracao(esperado)}: ${duracao(resumo.extra)} de hora extra planejada.`
                : `Hoje não há expediente: as ${duracao(resumo.trabalho)} planejadas são hora extra.`}
              {resumo.fimDoExpediente != null && esperado > 0 && ` O expediente termina às ${emHora(resumo.fimDoExpediente)}; o que vem depois está marcado como extra.`}
            </span>
          </p>
        )}
        {resumo.extra === 0 && resumo.alemDoExpediente.size > 0 && resumo.fimDoExpediente != null && (
          <p data-slot="aviso-de-extra" className="flex items-start gap-2 rounded-lg border border-alerta/30 bg-alerta/10 px-2.5 py-2 text-xs text-alerta">
            <TrendingUp className="mt-px size-3.5 shrink-0" />
            <span>Há bloco planejado depois do fim do expediente ({emHora(resumo.fimDoExpediente)}). Se o dia for cheio, isso vira hora extra.</span>
          </p>
        )}

        {semHorario.length > 0 && (
          <div data-slot="focos-sem-horario">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Foco de hoje ainda sem horário</p>
            <ul className="flex flex-col gap-1">
              {semHorario.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{t.titulo}</span>
                  <Dica texto="Reservar o próximo horário vago para esta tarefa">
                    <Button variant="ghost" size="sm" data-slot="encaixar-foco" onClick={() => aoEncaixar(t)}><Plus /> Encaixar</Button>
                  </Dica>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Painel>
  );
}

// =====================================================================
// A semana
// =====================================================================

export function PainelDaSemana({ jornada, data, hoje, agora, aoIrPara }: { jornada: Jornada; data: string; hoje: string; agora: number; aoIrPara: (data: string) => void }) {
  const linhas = useMemo(() => semanaDe(data).map((d) => linhaDoDia(jornada, d, hoje, agora)), [jornada, data, hoje, agora]);
  const banco = useMemo(() => bancoDeHoras(jornada, data > hoje ? data : semanaDe(data)[6] < hoje ? semanaDe(data)[6] : hoje, hoje), [jornada, data, hoje]);
  const maior = Math.max(1, ...linhas.map((l) => Math.max(l.trabalhado, l.esperado)));
  return (
    <Painel titulo="Semana" icone={<Scale />}>
      <div data-slot="painel-da-semana" className="flex flex-col gap-3 p-3.5">
        <div className="flex items-end gap-1.5">
          {linhas.map((l) => (
            <Dica key={l.data} texto={`${DIA_CURTO[l.diaSemana]} ${l.data.slice(8)}/${l.data.slice(5, 7)}: ${l.entrada ? `${duracao(l.trabalhado)} trabalhadas${l.saldo != null ? `, saldo ${saldoEmTexto(l.saldo)}` : l.estado === "sem-saida" ? ", sem saída" : ", em andamento"}` : l.estado === "folga" ? "sem expediente" : "sem registro"}`}>
              <button type="button" data-slot="dia-da-semana" data-data={l.data} aria-label={`Ir para ${DIA_CURTO[l.diaSemana]} ${l.data.slice(8)}`} onClick={() => aoIrPara(l.data)}
                className={cn("group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 py-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40", l.data === data && "bg-accent")}>
                <span className="relative flex h-12 w-full max-w-5 items-end overflow-hidden rounded-sm bg-muted">
                  {l.esperado > 0 && <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-foreground/30" style={{ bottom: `${(l.esperado / maior) * 100}%` }} />}
                  <span className={cn("w-full rounded-sm", l.estado === "sem-saida" ? "bg-alerta/60" : l.saldo != null && l.saldo < 0 ? "bg-destructive/55" : "bg-sucesso/70")} style={{ height: `${(l.trabalhado / maior) * 100}%` }} />
                </span>
                <span className={cn("text-[11px] capitalize tabular-nums", l.data === hoje ? "font-semibold text-primary-texto" : "text-muted-foreground")}>{DIA_CURTO[l.diaSemana]}</span>
              </button>
            </Dica>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 border-t pt-3">
          <Numero rotulo="Saldo da semana" valor={saldoEmTexto(banco.semana.saldo)} tom={corDoSaldo(banco.semana.saldo)} slot="saldo-da-semana" />
          <Numero rotulo="Saldo do mês" valor={saldoEmTexto(banco.mes.saldo)} tom={corDoSaldo(banco.mes.saldo)} slot="saldo-do-mes" />
          <Numero rotulo="Acumulado" valor={saldoEmTexto(banco.total.saldo)} tom={corDoSaldo(banco.total.saldo)} slot="saldo-acumulado" />
        </div>
        {banco.semSaida.length > 0 && (
          <button type="button" data-slot="dias-sem-saida" onClick={() => aoIrPara(banco.semSaida[banco.semSaida.length - 1])}
            className="flex items-center gap-2 rounded-lg border border-alerta/30 bg-alerta/10 px-2.5 py-1.5 text-left text-xs text-alerta outline-none hover:bg-alerta/15 focus-visible:ring-2 focus-visible:ring-ring/40">
            <CircleAlert className="size-3.5 shrink-0" />
            {banco.semSaida.length === 1 ? "1 dia sem saída registrada não entra no saldo. Clique para corrigir." : `${banco.semSaida.length} dias sem saída registrada não entram no saldo. Clique para corrigir.`}
          </button>
        )}
      </div>
    </Painel>
  );
}

// =====================================================================
// Banco de horas (o mês)
// =====================================================================

const NOME_DO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const ROTULO_ESTADO: Record<LinhaDoBanco["estado"], string> = { "sem-registro": "Sem registro", aberto: "Em andamento", fechado: "", "sem-saida": "Sem saída", folga: "Sem expediente" };

function Cartao({ rotulo, valor, detalhe, tom, icone, slot }: { rotulo: string; valor: string; detalhe: string; tom: string; icone: React.ReactNode; slot: string }) {
  return (
    <motion.div variants={itemLista} className="rounded-xl border bg-card p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{rotulo}</span>
        <span className="opacity-70 [&_svg]:size-3.5">{icone}</span>
      </div>
      <p data-slot={slot} className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", tom)}>{valor}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detalhe}</p>
    </motion.div>
  );
}

export function BancoDeHoras({ jornada, data, hoje, agora, aoMudarData, aoAbrirDia, aoAjustar }: {
  jornada: Jornada; data: string; hoje: string; agora: number; aoMudarData: (d: string) => void; aoAbrirDia: (d: string) => void; aoAjustar: (d: string) => void;
}) {
  const { toast } = useNexo();
  const dias = useMemo(() => mesDe(data), [data]);
  const linhas = useMemo(() => dias.map((d) => linhaDoDia(jornada, d, hoje, agora)), [dias, jornada, hoje, agora]);
  const fimDoMes = dias[dias.length - 1];
  const banco = useMemo(() => bancoDeHoras(jornada, fimDoMes < hoje ? fimDoMes : dias[0] > hoje ? fimDoMes : hoje, hoje), [jornada, fimDoMes, dias, hoje]);
  const [a, m] = data.split("-").map(Number);
  const nomeDoMes = NOME_DO_MES.format(new Date(a, m - 1, 1)).replace(/^./, (c) => c.toUpperCase());
  const mesAtual = hoje.slice(0, 7) === data.slice(0, 7);

  return (
    <div data-slot="banco-de-horas" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Dica texto="Mês anterior"><Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => aoMudarData(somarDiasA(dias[0], -1))}><ChevronLeft /></Button></Dica>
        <p data-slot="mes-do-banco" className="min-w-40 text-center text-sm font-semibold tracking-tight">{nomeDoMes}</p>
        <Dica texto="Mês seguinte"><Button variant="outline" size="icon" aria-label="Mês seguinte" onClick={() => aoMudarData(somarDiasA(fimDoMes, 1))}><ChevronRight /></Button></Dica>
        {!mesAtual && <Button variant="ghost" onClick={() => aoMudarData(hoje)}>Mês atual</Button>}
        <Button variant="outline" className="ml-auto" data-slot="copiar-banco" onClick={async () => toast((await copiarTexto(textoDoBanco(jornada, data, hoje))) ? "Mês copiado em texto." : "Não consegui copiar.", "info")}>
          <ClipboardCopy /> Copiar o mês
        </Button>
      </div>

      <motion.div variants={lista} initial="escondido" animate="visivel" className="grid gap-3 sm:grid-cols-3">
        <Cartao slot="banco-semana" rotulo={mesAtual ? "Saldo desta semana" : "Saldo da última semana do mês"} valor={saldoEmTexto(banco.semana.saldo)} tom={corDoSaldo(banco.semana.saldo)} icone={<Hourglass />}
          detalhe={banco.semana.dias ? `${duracao(banco.semana.trabalhado)} trabalhadas em ${banco.semana.dias} ${banco.semana.dias === 1 ? "dia" : "dias"}` : "nenhum dia fechado nesta semana"} />
        <Cartao slot="banco-mes" rotulo="Saldo do mês" valor={saldoEmTexto(banco.mes.saldo)} tom={corDoSaldo(banco.mes.saldo)} icone={<Scale />}
          detalhe={banco.mes.dias ? `${duracao(banco.mes.trabalhado)} trabalhadas de ${duracao(banco.mes.esperado)} esperadas` : "nenhum dia fechado neste mês"} />
        <Cartao slot="banco-total" rotulo="Saldo acumulado" valor={saldoEmTexto(banco.total.saldo)} tom={corDoSaldo(banco.total.saldo)} icone={<TrendingUp />}
          detalhe={jornada.config.saldoInicialMin ? `inclui o saldo inicial de ${saldoEmTexto(jornada.config.saldoInicialMin)}` : `${banco.total.dias} ${banco.total.dias === 1 ? "dia registrado" : "dias registrados"} até aqui`} />
      </motion.div>

      <div>
        <Table>
          <THead>
            <Tr>
              <Th>Dia</Th><Th>Entrada</Th><Th>Saída</Th><Th>Pausa</Th><Th>Trabalhado</Th><Th>Esperado</Th><Th className="text-right">Saldo</Th><Th className="w-10" />
            </Tr>
          </THead>
          <TBody>
            {linhas.map((l) => (
              <Tr key={l.data} data-slot="linha-do-banco" data-data={l.data} data-estado={l.estado} className={cn(l.data === hoje && "bg-accent/40", l.estado === "folga" && "text-muted-foreground")}>
                <Td>
                  <button type="button" onClick={() => aoAbrirDia(l.data)} className="rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40">
                    <span className="tabular-nums">{l.data.slice(8)}/{l.data.slice(5, 7)}</span> <span className="capitalize text-muted-foreground">{DIA_CURTO[l.diaSemana]}</span>
                  </button>
                  {l.obs && <span className="ml-2 text-xs text-muted-foreground">{l.obs}</span>}
                </Td>
                <Td className="tabular-nums">{l.entrada ?? ""}</Td>
                <Td className="tabular-nums">{l.saida ?? (l.estado === "sem-saida" ? <span className="text-alerta">falta</span> : "")}</Td>
                <Td className="tabular-nums">{l.entrada && l.pausas > 0 ? <>{duracao(l.pausas)}{l.pausaDescontada && <Dica texto="A pausa não foi registrada: o app descontou a pausa planejada."><span className="ml-1 cursor-help text-muted-foreground">*</span></Dica>}</> : ""}</Td>
                <Td className="tabular-nums">{l.entrada && l.estado !== "sem-saida" ? duracao(l.trabalhado) : ""}</Td>
                <Td className="tabular-nums text-muted-foreground">{l.esperado > 0 ? duracao(l.esperado) : ""}</Td>
                <Td className={cn("text-right font-medium tabular-nums", corDoSaldo(l.saldo))}>
                  {l.saldo != null ? saldoEmTexto(l.saldo) : <span className={cn("text-xs font-normal", l.estado === "sem-saida" ? "text-alerta" : "text-muted-foreground")}>{l.data > hoje && l.estado === "sem-registro" ? "" : ROTULO_ESTADO[l.estado]}</span>}
                </Td>
                <Td>
                  <Dica texto="Ajustar os horários deste dia">
                    <Button variant="ghost" size="icon-sm" aria-label={`Ajustar os horários de ${l.data.slice(8)}/${l.data.slice(5, 7)}`} data-slot="ajustar-linha" onClick={() => aoAjustar(l.data)}><PencilLine /></Button>
                  </Dica>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Só entra no saldo o dia com entrada e saída. Dia sem registro não conta contra você, e fim de semana, folga e feriado contam como hora extra se você trabalhar.
      </p>
    </div>
  );
}
