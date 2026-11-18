"use client";

// Rotina: o dia planejado em blocos de horário, o ponto (entrada, pausas, saída) com a hora de sair e o
// banco de horas. O que é gravado é só o plano e o ponto (jornada.json); a hora de saída, a hora extra e
// os saldos são contas feitas na hora em lib/jornada.ts.

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarRange, ChevronLeft, ChevronRight, Ellipsis, Eraser, LayoutList, Plus, Repeat, RotateCcw, Scale, Settings2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { useHoje } from "@/components/useHoje";
import { Pagina } from "@/components/comum";
import { AjustarPonto, BlocoForm, ConfigurarJornada, DiaPadrao, type PedidoDeBloco } from "@/components/jornada/Formularios";
import { LinhaDoDia } from "@/components/jornada/LinhaDoDia";
import { BancoDeHoras, PainelDaSemana, PainelDoPlano, PainelDoPonto } from "@/components/jornada/Paineis";
import { useJornada, useMinuto } from "@/components/jornada/pecas";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/controles";
import { SeletorData } from "@/components/ui/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import {
  NOME_DO_DIA, blocosDoDia, comBloco, comDiaPadrao, comPlanoProprio, contarPonto, diaDaSemana, diaDe, emHora, novoBloco, pausaPlanejada, proximoVago, resumoDoPlano, semBloco, somarDiasA,
} from "@/lib/jornada";
import { agoraISO, dataReal } from "@/lib/tipos";
import type { BlocoDaJornada, Tarefa } from "@/lib/tipos";

type Visao = "dia" | "banco";
const DATA_LONGA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const porExtenso = (data: string) => {
  const [a, m, d] = data.split("-").map(Number);
  const t = DATA_LONGA.format(new Date(a, m - 1, d));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function PaginaRotina() {
  // useSearchParams exige Suspense no Next 16.
  return <Suspense><Conteudo /></Suspense>;
}

function Conteudo() {
  const { dados, toast } = useNexo();
  const confirmar = useConfirmar();
  const params = useSearchParams();
  const hoje = useHoje();
  const agora = useMinuto();
  const { jornada, salvarDia, salvarConfig, ilegivel } = useJornada();
  const pedida = params.get("d");
  const [data, setData] = useState(dataReal(pedida) ? pedida : hoje);
  const [visao, setVisao] = useState<Visao>(params.get("v") === "banco" ? "banco" : "dia");
  const [pedido, setPedido] = useState<(PedidoDeBloco & { chave: number }) | null>(null);
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [diaPadrao, setDiaPadrao] = useState(false);
  const [configurando, setConfigurando] = useState(false);

  // quem deixou a tela aberta em "hoje" acompanha a virada do dia
  const [ultimoHoje, setUltimoHoje] = useState(hoje);
  useEffect(() => {
    if (hoje === ultimoHoje) return;
    setData((d) => (d === ultimoHoje ? hoje : d));
    setUltimoHoje(hoje);
  }, [hoje, ultimoHoje]);

  const ehHoje = data === hoje;
  const dia = diaDe(jornada, data);
  const { blocos, doPadrao } = useMemo(() => blocosDoDia(jornada, data), [jornada, data]);
  const conta = useMemo(() => contarPonto(jornada.config, jornada.dias.get(data), data, ehHoje ? agora : null), [jornada, data, ehHoje, agora]);
  const resumo = useMemo(
    () => resumoDoPlano(blocos, conta.esperado, pausaPlanejada(jornada.config, jornada.dias.get(data)), conta.estado === "aberto" || conta.estado === "fechado" ? conta.saidaPrevista : null),
    [blocos, conta.esperado, conta.estado, conta.saidaPrevista, jornada, data],
  );
  const tarefas = useMemo(() => new Map((dados?.tarefas ?? []).map((t) => [t.id, t])), [dados?.tarefas]);
  const focos = useMemo(() => (ehHoje ? (dados?.tarefas ?? []).filter((t) => t.focoEm === hoje).sort((a, b) => b.prioridade - a.prioridade) : []), [dados?.tarefas, ehHoje, hoje]);
  const nomeDoDia = NOME_DO_DIA[diaDaSemana(data)].toLowerCase();

  const novo = (inicial: Partial<BlocoDaJornada>) => setPedido({ inicial, chave: Date.now() });
  const novoNoVago = (extra: Partial<BlocoDaJornada> = {}) => {
    const vago = proximoVago(blocos, ehHoje ? agora : blocos.length ? 0 : 8 * 60, 60) ?? { inicio: 9 * 60, fim: 10 * 60 };
    novo({ tipo: "atividade", inicio: emHora(vago.inicio), fim: emHora(vago.fim), ...extra });
  };
  const gravarBloco = (b: BlocoDaJornada) => salvarDia(data, (d, c) => comBloco(d, c, b));
  const encaixar = (t: Tarefa) => novoNoVago({ tipo: "tarefa", tarefaId: t.id, titulo: t.titulo });

  const voltarAoPadrao = async () => {
    if (!(await confirmar({ titulo: "Voltar ao dia padrão?", descricao: `O plano que você montou para este dia sai e ${nomeDoDia} volta a seguir o dia padrão. O ponto (entrada, pausas e saída) não muda.`, confirmar: "Voltar ao padrão" }))) return;
    if (await salvarDia(data, (d) => comDiaPadrao(d))) toast("O dia voltou a seguir o dia padrão.");
  };
  const limpar = async () => {
    if (!(await confirmar({ titulo: "Limpar o plano deste dia?", descricao: "Todos os blocos deste dia saem. O ponto não muda, e o dia padrão continua valendo para os outros dias.", confirmar: "Limpar", perigo: true }))) return;
    if (await salvarDia(data, (d, c) => ({ ...comPlanoProprio(d, c), blocos: [], atualizadoEm: agoraISO() }))) toast("Plano do dia limpo.");
  };
  const virarPadrao = async () => {
    if (!(await confirmar({ titulo: `Usar este dia como padrão de ${nomeDoDia}?`, descricao: `Os blocos de atividade e de pausa deste dia passam a ser o dia padrão de ${nomeDoDia}. Blocos de tarefa ficam de fora, porque tarefa não se repete toda semana.`, confirmar: "Usar como padrão" }))) return;
    const modelo = blocos.filter((b) => b.tipo !== "tarefa").map((b) => novoBloco({ tipo: b.tipo, titulo: b.titulo, inicio: b.inicio, fim: b.fim, nota: b.nota }));
    if (await salvarConfig((c) => ({ ...c, padrao: { ...c.padrao, [String(diaDaSemana(data))]: modelo } }))) toast(`Dia padrão de ${nomeDoDia} atualizado.`);
  };

  const acoes = (
    <>
      <Segmentado
        aria-label="Visão"
        valor={visao}
        aoMudar={setVisao}
        opcoes={[
          { valor: "dia", rotulo: "Dia", icone: <LayoutList /> },
          { valor: "banco", rotulo: "Banco de horas", icone: <Scale /> },
        ]}
      />
      <Dica texto="Os blocos que se repetem em cada dia da semana">
        <Button variant="outline" data-slot="abrir-dia-padrao" onClick={() => setDiaPadrao(true)}><Repeat /> Dia padrão</Button>
      </Dica>
      <Dica texto="Horas por dia, pausa, dias de trabalho e avisos">
        <Button variant="outline" data-slot="abrir-config-jornada" onClick={() => setConfigurando(true)}><Settings2 /> Jornada</Button>
      </Dica>
      {visao === "dia" && <Button data-slot="novo-bloco" onClick={() => novoNoVago()}><Plus /> Novo bloco</Button>}
    </>
  );

  const barra =
    visao === "dia" ? (
      <>
        <Dica texto="Dia anterior"><Button variant="outline" size="icon" aria-label="Dia anterior" onClick={() => setData(somarDiasA(data, -1))}><ChevronLeft /></Button></Dica>
        <SeletorData aria-label="Dia da rotina" valor={data} aoMudar={(d) => d && setData(d)} limpavel={false} className="w-44" />
        <Dica texto="Dia seguinte"><Button variant="outline" size="icon" aria-label="Dia seguinte" onClick={() => setData(somarDiasA(data, 1))}><ChevronRight /></Button></Dica>
        {!ehHoje && <Button variant="ghost" data-slot="ir-para-hoje" onClick={() => setData(hoje)}><CalendarClock /> Hoje</Button>}
        <span data-slot="dia-da-rotina" className="ml-1 truncate text-[13px] text-muted-foreground">{porExtenso(data)}</span>
        {doPadrao && (
          <Dica texto={`Este dia ainda segue o dia padrão de ${nomeDoDia}. Qualquer mudança que você fizer vale só para ele.`}>
            <span data-slot="selo-dia-padrao" className="inline-flex h-5 items-center gap-1 rounded-full border border-dashed px-2 text-xs font-medium text-muted-foreground sem-selecao"><Repeat className="size-3" /> dia padrão</span>
          </Dica>
        )}
        <DropdownMenu>
          <Dica texto="Mais ações para o plano deste dia">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-auto" aria-label="Mais ações para o plano deste dia" data-slot="menu-do-dia"><Ellipsis /></Button>
            </DropdownMenuTrigger>
          </Dica>
          <DropdownMenuContent>
            <DropdownMenuItem disabled={!blocos.some((b) => b.tipo !== "tarefa")} onSelect={virarPadrao}><CalendarRange /> Usar como padrão de {nomeDoDia}</DropdownMenuItem>
            <DropdownMenuItem disabled={!dia.planejado} onSelect={voltarAoPadrao}><RotateCcw /> Voltar ao dia padrão</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem perigo disabled={!blocos.length} onSelect={limpar}><Eraser /> Limpar o plano deste dia</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ) : undefined;

  return (
    <Pagina
      titulo="Rotina"
      descricao="O dia em blocos de horário, a hora de sair e o banco de horas"
      acoes={acoes}
      barra={barra}
      semRolagem
      className="mx-auto flex w-full max-w-[1360px] flex-col px-6 pt-4"
    >
      {ilegivel && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          O arquivo jornada.json não pôde ser lido, então nada é gravado aqui até ele ser corrigido. Veja Configurações, em &quot;Saúde dos dados&quot;.
        </p>
      )}
      {visao === "dia" ? (
        <div data-slot="rotina" data-data={data} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4 lg:flex-row lg:overflow-visible">
          <div className="flex min-h-[460px] min-w-0 flex-1 flex-col lg:min-h-0">
            <LinhaDoDia
              key={data}
              blocos={blocos}
              doPadrao={doPadrao}
              ehHoje={ehHoje}
              agora={agora}
              fimDoExpediente={resumo.fimDoExpediente}
              semJornada={conta.esperado === 0}
              alem={resumo.alemDoExpediente}
              ponto={dia.ponto}
              tarefas={tarefas}
              aoCriar={(ini, fim) => novo({ tipo: "atividade", inicio: emHora(ini), fim: emHora(fim) })}
              aoAbrir={(b) => setPedido({ bloco: b, chave: Date.now() })}
              aoMover={(b, ini, fim) => gravarBloco({ ...b, inicio: emHora(ini), fim: emHora(fim) })}
              aoMarcar={(b, feito) => gravarBloco({ ...b, feito })}
            />
          </div>
          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px] lg:overflow-y-auto lg:pb-2">
            <PainelDoPonto data={data} dia={dia} conta={conta} ehHoje={ehHoje} agora={agora} aoAjustar={() => setAjustando(data)} />
            <PainelDoPlano resumo={resumo} esperado={conta.esperado} blocos={blocos} focos={focos} aoEncaixar={encaixar} />
            <PainelDaSemana jornada={jornada} data={data} hoje={hoje} agora={agora} aoIrPara={setData} />
          </aside>
        </div>
      ) : (
        <BancoDeHoras
          jornada={jornada}
          data={data}
          hoje={hoje}
          agora={agora}
          aoMudarData={setData}
          aoAbrirDia={(d) => { setData(d); setVisao("dia"); }}
          aoAjustar={setAjustando}
        />
      )}

      {pedido && (
        <BlocoForm
          key={pedido.chave}
          pedido={pedido}
          data={data}
          fechar={() => setPedido(null)}
          aoSalvar={gravarBloco}
          aoExcluir={(id) => salvarDia(data, (d, c) => semBloco(d, c, id))}
        />
      )}
      {ajustando && <AjustarPonto key={ajustando} data={ajustando} fechar={() => setAjustando(null)} />}
      {diaPadrao && <DiaPadrao diaInicial={diaDaSemana(data)} fechar={() => setDiaPadrao(false)} />}
      {configurando && <ConfigurarJornada fechar={() => setConfigurando(false)} />}
    </Pagina>
  );
}
