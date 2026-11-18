"use client";

// As janelas da jornada: criar ou editar um bloco, ajustar os horários de um dia, montar o dia padrão
// de cada dia da semana e configurar a jornada (horas por dia, pausa, dias de trabalho).

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Copy, Plus, Timer, Trash2 } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useCriarTarefa } from "@/components/tarefas/criar";
import { useFecharComCuidado } from "@/components/Raiz";
import { Campo, LinhaCampos, Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSugestoes } from "@/components/ui/chips";
import { Combobox } from "@/components/ui/command";
import { CampoSwitch, Segmentado } from "@/components/ui/controles";
import { Input } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { Seletor } from "@/components/ui/select";
import { iniciarSessao } from "@/components/shell/SessaoFoco";
import {
  DIA_CURTO, NOME_DO_DIA, comEntrada, diaDe, duracao, emHora, emMinutos, esperadoNoDia, lerSaldo, novoBloco, proximoVago, saldoEmTexto,
} from "@/lib/jornada";
import { aberta } from "@/lib/lembretes";
import { usePref } from "@/lib/preferencias";
import { agoraISO, normalizarBloco, normalizarPonto } from "@/lib/tipos";
import type { BlocoDaJornada, PausaDoPonto, TipoDeBloco } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { CampoHora, VISUAL_DO_BLOCO, useJornada } from "./pecas";

const OPCOES_TIPO = (comTarefa: boolean) =>
  (["tarefa", "atividade", "pausa"] as TipoDeBloco[])
    .filter((t) => comTarefa || t !== "tarefa")
    .map((t) => {
      const Icone = VISUAL_DO_BLOCO[t].icone;
      return { valor: t, rotulo: VISUAL_DO_BLOCO[t].nome, icone: <Icone /> };
    });

const PAUSAS_COMUNS = ["Almoço", "Jantar", "Intervalo"];
const DURACOES = [30, 60, 90, 120];

// =====================================================================
// Bloco
// =====================================================================

export interface PedidoDeBloco {
  /** O bloco a editar. Sem ele, é um bloco novo. */
  bloco?: BlocoDaJornada;
  /** Para um bloco novo: o que já vem preenchido. */
  inicial?: Partial<BlocoDaJornada>;
}

/**
 * Criar ou editar um bloco. Monte com uma `key` nova a cada abertura: o estado nasce do pedido.
 * `data` é o dia do bloco (para as ações de tarefa); sem ela, é um bloco do dia padrão, que não aponta para tarefa.
 */
export function BlocoForm({
  pedido, fechar, aoSalvar, aoExcluir, data,
}: {
  pedido: PedidoDeBloco; fechar: () => void; aoSalvar: (b: BlocoDaJornada) => void; aoExcluir?: (id: string) => void; data?: string;
}) {
  const { dados, toast } = useNexo();
  const criarTarefa = useCriarTarefa();
  const { jornada } = useJornada();
  const original = pedido.bloco;
  const base = original ?? pedido.inicial ?? {};
  const [tipo, setTipo] = useState<TipoDeBloco>(base.tipo ?? "atividade");
  const [tarefaId, setTarefaId] = useState(base.tarefaId ?? "");
  const [titulo, setTitulo] = useState(base.titulo ?? "");
  const [inicio, setInicio] = useState(base.inicio ?? "09:00");
  const [fim, setFim] = useState(base.fim ?? "10:00");
  const [nota, setNota] = useState(base.nota ?? "");
  const salvarRef = useRef<() => void>(() => {});
  const hoje = data ?? "";

  const tarefas = useMemo(() => (dados?.tarefas ?? []).filter((t) => aberta(t) || t.id === base.tarefaId), [dados?.tarefas, base.tarefaId]);
  const opcoesTarefa = useMemo(
    () =>
      [...tarefas]
        .sort((a, b) => Number(b.focoEm === hoje) - Number(a.focoEm === hoje) || b.prioridade - a.prioridade)
        .map((t) => ({ valor: t.id, rotulo: t.titulo, detalhe: t.focoEm === hoje ? "Foco de hoje" : undefined })),
    [tarefas, hoje],
  );
  // os nomes de atividade que já foram usados, dos mais usados para os menos
  const atividades = useMemo(() => {
    const vezes = new Map<string, number>();
    const contar = (b: BlocoDaJornada) => b.tipo === "atividade" && b.titulo && vezes.set(b.titulo, (vezes.get(b.titulo) ?? 0) + 1);
    for (const d of jornada.dias.values()) d.blocos.forEach(contar);
    for (const lista of Object.values(jornada.config.padrao)) lista.forEach(contar);
    return [...vezes.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [jornada]);

  const minutos = emMinutos(fim) - emMinutos(inicio);
  const erro = !inicio || !fim ? "Informe o início e o fim." : minutos <= 0 ? "O fim tem que ser depois do início." : tipo === "tarefa" && !tarefaId ? "Escolha a tarefa deste bloco." : "";
  const sujo = tipo !== (base.tipo ?? "atividade") || tarefaId !== (base.tarefaId ?? "") || titulo !== (base.titulo ?? "") || inicio !== (base.inicio ?? "09:00") || fim !== (base.fim ?? "10:00") || nota !== (base.nota ?? "");
  const fecharComCuidado = useFecharComCuidado(!!original && sujo, fechar);

  const salvar = () => {
    if (erro) return toast(erro, "erro");
    const tarefa = tipo === "tarefa" ? tarefas.find((t) => t.id === tarefaId) : undefined;
    const nome = titulo.trim() || tarefa?.titulo || (tipo === "pausa" ? "Pausa" : "");
    if (!nome) return toast("Dê um nome ao bloco.", "erro");
    const dadosDoBloco = { tipo, tarefaId: tipo === "tarefa" ? tarefaId : null, titulo: nome, inicio, fim, nota: nota.trim() };
    aoSalvar(original ? normalizarBloco({ ...original, ...dadosDoBloco }) : novoBloco(dadosDoBloco));
    fechar();
  };
  salvarRef.current = salvar;

  const mudarTarefa = (id: string) => {
    const antes = tarefas.find((t) => t.id === tarefaId)?.titulo ?? "";
    setTarefaId(id);
    // o nome acompanha a tarefa enquanto o usuário não escreveu outro
    if (!titulo.trim() || titulo === antes) setTitulo(tarefas.find((t) => t.id === id)?.titulo ?? "");
  };
  const mudarInicio = (h: string) => {
    // mexer no início leva o fim junto, para manter a duração
    if (h && inicio && fim && minutos > 0) setFim(emHora(Math.min(1439, emMinutos(h) + minutos)));
    setInicio(h);
  };

  return (
    <Modal
      aberto
      fechar={fecharComCuidado}
      titulo={original ? "Editar bloco" : "Novo bloco"}
      descricao={data ? "Um horário do dia reservado para uma tarefa, uma atividade ou uma pausa." : "Um bloco do dia padrão: aparece em todos os dias deste dia da semana."}
      rodape={
        <>
          {original && aoExcluir && (
            <Button variant="destructive-ghost" data-slot="excluir-bloco" className="mr-auto" onClick={() => { aoExcluir(original.id); fechar(); }}>
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={fecharComCuidado}>Cancelar</Button>
          <Button data-slot="salvar-bloco" onClick={salvar}>{original ? "Salvar" : "Adicionar"}</Button>
        </>
      }
    >
      <div
        data-slot="bloco-form"
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            // o campo de hora só avisa a mudança ao perder o foco: dá esse tempo antes de salvar
            (document.activeElement as HTMLElement | null)?.blur();
            setTimeout(() => salvarRef.current(), 0);
          }
        }}
      >
        <Segmentado aria-label="Tipo do bloco" valor={tipo} aoMudar={setTipo} opcoes={OPCOES_TIPO(!!data)} />

        {tipo === "tarefa" && (
          <Campo rotulo="Tarefa">
            <Combobox aria-label="Tarefa do bloco" valor={tarefaId} aoMudar={mudarTarefa} opcoes={opcoesTarefa} placeholder="Escolha a tarefa"
              buscaPlaceholder="Buscar tarefa ou digitar o nome de uma nova..." vazio="Nenhuma tarefa aberta com esse nome." permitirLimpar={false}
              // reservar horário para uma tarefa que ainda não está no app: ela nasce aqui
              criar={(nome) => void criarTarefa(nome).then((id) => {
                if (!id) return;
                const antes = tarefas.find((t) => t.id === tarefaId)?.titulo ?? "";
                setTarefaId(id);
                if (!titulo.trim() || titulo === antes) setTitulo(nome);
              })} />
          </Campo>
        )}

        <Campo rotulo={tipo === "tarefa" ? "Nome do bloco" : tipo === "pausa" ? "Qual pausa" : "O que você vai fazer"} dica={tipo === "tarefa" ? "Em branco, vale o nome da tarefa." : undefined}>
          {tipo === "atividade" ? (
            <CampoSugestoes data-slot="titulo-do-bloco" aria-label="Nome do bloco" valor={titulo} aoMudar={setTitulo} sugestoes={atividades} placeholder="Ex.: Chamados, e-mails, reunião do time" autoFocus={!original} maxLength={160} />
          ) : (
            <Input data-slot="titulo-do-bloco" aria-label="Nome do bloco" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "pausa" ? "Almoço" : "Nome do bloco"} maxLength={160} />
          )}
          {tipo === "pausa" && (
            <div className="flex flex-wrap gap-1.5">
              {PAUSAS_COMUNS.map((p) => (
                <Button key={p} size="sm" variant={titulo === p ? "secondary" : "outline"} onClick={() => setTitulo(p)}>{p}</Button>
              ))}
            </div>
          )}
        </Campo>

        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Início" className="flex-none">
            <CampoHora aria-label="Início do bloco" valor={inicio} aoMudar={mudarInicio} />
          </Campo>
          <Campo rotulo="Fim" className="flex-none">
            <CampoHora aria-label="Fim do bloco" valor={fim} aoMudar={setFim} />
          </Campo>
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {DURACOES.map((d) => (
              <Button key={d} size="sm" variant={minutos === d ? "secondary" : "outline"} disabled={!inicio} onClick={() => setFim(emHora(Math.min(1439, emMinutos(inicio) + d)))}>{duracao(d)}</Button>
            ))}
          </div>
          <span data-slot="duracao-do-bloco" className={cn("pb-2 text-xs tabular-nums", minutos > 0 ? "text-muted-foreground" : "text-destructive")}>
            {minutos > 0 ? duracao(minutos) : "fim antes do início"}
          </span>
        </div>

        <Campo rotulo="Observação" dica="Opcional. Aparece no bloco quando há espaço.">
          <Input aria-label="Observação do bloco" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: fila do squad de Pagamentos primeiro" maxLength={300} />
        </Campo>

        {data && original?.tipo === "tarefa" && original.tarefaId && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
            <span className="mr-auto text-xs text-muted-foreground">Sobre a tarefa deste bloco</span>
            <Button asChild size="sm" variant="outline"><Link href={`/tarefas/${original.tarefaId}`}>Abrir a tarefa <ArrowRight /></Link></Button>
            <Dica texto="Um cronômetro na tarefa. No fim, o que saiu vira um registro nela.">
              <Button size="sm" variant="outline" onClick={() => {
                const alvo = [15, 25, 50].reduce((a, b) => (Math.abs(b - minutos) < Math.abs(a - minutos) ? b : a));
                toast(iniciarSessao(original.tarefaId as string, alvo) ? `Sessão de foco de ${alvo} min começou.` : "Já existe uma sessão de foco em andamento.", "info");
                fechar();
              }}>
                <Timer /> Sessão de foco
              </Button>
            </Dica>
          </div>
        )}
      </div>
    </Modal>
  );
}

// =====================================================================
// Ajustar os horários de um dia
// =====================================================================

const comoDuracao = (min: number | null) => (min == null ? "" : emHora(min));

export function AjustarPonto({ data, fechar }: { data: string; fechar: () => void }) {
  const { toast } = useNexo();
  const { jornada, salvarDia } = useJornada();
  const dia = diaDe(jornada, data);
  const [entrada, setEntrada] = useState(dia.ponto.entrada ?? "");
  const [saida, setSaida] = useState(dia.ponto.saida ?? "");
  const [pausas, setPausas] = useState<PausaDoPonto[]>(dia.ponto.pausas.map((p) => ({ ...p })));
  const [folga, setFolga] = useState(dia.folga);
  const [jornadaDoDia, setJornadaDoDia] = useState(comoDuracao(dia.jornadaMin));
  const [obs, setObs] = useState(dia.obs);
  const padraoDoDia = esperadoNoDia(jornada.config, { ...dia, folga: false, jornadaMin: null }, data);

  const erro =
    saida && !entrada ? "Para informar a saída, informe a entrada."
    : entrada && saida && saida <= entrada ? "A saída tem que ser depois da entrada."
    : pausas.some((p) => !p.inicio) ? "Informe o início de cada pausa (ou remova a linha)."
    : pausas.some((p) => p.fim && p.fim <= p.inicio) ? "Cada pausa tem que terminar depois de começar."
    : pausas.length && !entrada ? "Para informar pausas, informe a entrada."
    : pausas.some((p) => (entrada && p.inicio < entrada) || (saida && ((p.fim ?? p.inicio) > saida))) ? "As pausas têm que ficar entre a entrada e a saída."
    : "";

  const salvar = async () => {
    if (erro) return toast(erro, "erro");
    const ok = await salvarDia(data, (d, config) => {
      const base = {
        ...d,
        folga,
        obs: obs.trim(),
        jornadaMin: jornadaDoDia ? emMinutos(jornadaDoDia) : null,
        ponto: normalizarPonto({ ...d.ponto, entrada: entrada || null, saida: saida || null, pausas }),
        atualizadoEm: agoraISO(),
      };
      return entrada ? comEntrada(base, entrada, config) : base;
    });
    if (ok) fechar();
  };

  return (
    <Modal
      aberto
      fechar={fechar}
      titulo="Ajustar os horários do dia"
      descricao="Para corrigir um horário, registrar um dia que passou ou marcar uma folga."
      rodape={
        <>
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button data-slot="salvar-ponto" onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div data-slot="ajustar-ponto" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Entrada" className="flex-none"><CampoHora aria-label="Entrada" valor={entrada} aoMudar={setEntrada} autoFocus /></Campo>
          <Campo rotulo="Saída" className="flex-none"><CampoHora aria-label="Saída" valor={saida} aoMudar={setSaida} /></Campo>
          <Campo rotulo="Jornada deste dia" className="flex-none" dica={`Em branco, vale o padrão (${padraoDoDia ? duracao(padraoDoDia) : "sem expediente"}).`}>
            <CampoHora aria-label="Jornada deste dia" valor={jornadaDoDia} aoMudar={setJornadaDoDia} placeholder={comoDuracao(padraoDoDia) || "00:00"} />
          </Campo>
        </div>

        <Campo rotulo="Pausas" dica="Sem nenhuma pausa informada, o app desconta a pausa planejada nos dias de mais de 6 horas (dá para desligar na configuração).">
          <div className="flex flex-col gap-2">
            {pausas.map((p, i) => (
              <div key={i} data-slot="linha-de-pausa" className="flex items-center gap-2">
                <CampoHora aria-label={`Início da pausa ${i + 1}`} valor={p.inicio} aoMudar={(h) => setPausas((l) => l.map((x, k) => (k === i ? { ...x, inicio: h } : x)))} />
                <span className="text-xs text-muted-foreground">até</span>
                <CampoHora aria-label={`Fim da pausa ${i + 1}`} valor={p.fim ?? ""} aoMudar={(h) => setPausas((l) => l.map((x, k) => (k === i ? { ...x, fim: h || null } : x)))} />
                {p.inicio && p.fim && p.fim > p.inicio && <span className="text-xs text-muted-foreground tabular-nums">{duracao(emMinutos(p.fim) - emMinutos(p.inicio))}</span>}
                <Dica texto="Remover esta pausa">
                  <Button variant="ghost" size="icon-sm" aria-label="Remover esta pausa" onClick={() => setPausas((l) => l.filter((_, k) => k !== i))}><Trash2 /></Button>
                </Dica>
              </div>
            ))}
            <Button variant="outline" size="sm" className="self-start" data-slot="nova-pausa" onClick={() => setPausas((l) => [...l, { inicio: "", fim: null }])}><Plus /> Pausa</Button>
          </div>
        </Campo>

        <CampoSwitch marcado={folga} aoMudar={setFolga}>
          <span className="text-[13px]">Folga, feriado ou férias</span>
          <span className="block text-xs text-muted-foreground">Nada é esperado neste dia. Se você trabalhar, tudo conta como hora extra.</span>
        </CampoSwitch>

        <Campo rotulo="Observação">
          <Input aria-label="Observação do dia" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: saí mais cedo, consulta médica" maxLength={300} />
        </Campo>
        {erro && <p data-slot="erro-do-ponto" className="text-xs text-destructive">{erro}</p>}
      </div>
    </Modal>
  );
}

// =====================================================================
// Dia padrão
// =====================================================================

export function DiaPadrao({ fechar, diaInicial }: { fechar: () => void; diaInicial: number }) {
  const { toast } = useNexo();
  const { jornada, salvarConfig } = useJornada();
  const [padrao, setPadrao] = useState<Record<string, BlocoDaJornada[]>>(() => structuredClone(jornada.config.padrao));
  const [dia, setDia] = useState(String(diaInicial));
  const [sujo, setSujo] = useState(false);
  const fecharComCuidado = useFecharComCuidado(sujo, fechar);
  const lista = padrao[dia] ?? [];
  const mudar = (fn: (l: BlocoDaJornada[]) => BlocoDaJornada[]) => {
    setSujo(true);
    setPadrao((p) => ({ ...p, [dia]: fn(p[dia] ?? []) }));
  };
  const trocar = (id: string, parte: Partial<BlocoDaJornada>) => mudar((l) => l.map((b) => (b.id === id ? { ...b, ...parte } : b)));
  const erro = Object.entries(padrao).find(([, l]) => l.some((b) => !b.inicio || !b.fim || b.fim <= b.inicio || !b.titulo.trim()));

  const acrescentar = (tipo: TipoDeBloco) => {
    const vago = proximoVago(lista, lista.length ? emMinutos(lista[lista.length - 1].fim) : 8 * 60, 60) ?? { inicio: 8 * 60, fim: 9 * 60 };
    mudar((l) => [...l, novoBloco({ tipo, titulo: tipo === "pausa" ? "Almoço" : "", inicio: emHora(vago.inicio), fim: emHora(vago.fim) })]);
  };
  const copiarParaOsOutros = () => {
    const alvos = jornada.config.diasDeTrabalho.map(String).filter((d) => d !== dia);
    if (!alvos.length) return;
    setSujo(true);
    setPadrao((p) => ({ ...p, ...Object.fromEntries(alvos.map((d) => [d, lista.map((b) => novoBloco(b))])) }));
    toast(`Copiado para ${alvos.map((d) => DIA_CURTO[Number(d)]).join(", ")}.`);
  };
  const salvar = async () => {
    if (erro) {
      setDia(erro[0]);
      return toast(`Em ${NOME_DO_DIA[Number(erro[0])].toLowerCase()} há um bloco sem nome ou com o fim antes do início.`, "erro");
    }
    const ordenado = Object.fromEntries(Object.entries(padrao).map(([d, l]) => [d, [...l].sort((a, b) => a.inicio.localeCompare(b.inicio))]));
    if (await salvarConfig((c) => ({ ...c, padrao: ordenado }))) {
      toast("Dia padrão salvo. Ele vale para os dias em que você ainda não mexeu no plano.");
      fechar();
    }
  };

  return (
    <Modal
      aberto
      largo
      fechar={fecharComCuidado}
      titulo="Dia padrão"
      descricao="Os blocos que se repetem em cada dia da semana. O plano de um dia nasce daqui, e o que você mudar num dia vale só para ele."
      rodape={
        <>
          <Button variant="outline" className="mr-auto" disabled={!lista.length} onClick={copiarParaOsOutros}><Copy /> Copiar para os outros dias de trabalho</Button>
          <Button variant="ghost" onClick={fecharComCuidado}>Cancelar</Button>
          <Button data-slot="salvar-dia-padrao" onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div data-slot="dia-padrao" className="flex flex-col gap-4">
        <Segmentado
          aria-label="Dia da semana"
          valor={dia}
          aoMudar={setDia}
          opcoes={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ valor: String(d), rotulo: <span className="capitalize">{DIA_CURTO[d]}{(padrao[String(d)] ?? []).length ? <span className="ml-1 text-muted-foreground tabular-nums">{padrao[String(d)].length}</span> : null}</span> }))}
        />
        {lista.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">
            {NOME_DO_DIA[Number(dia)]} ainda não tem dia padrão. Adicione os blocos que se repetem, como os chamados da manhã e o almoço.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((b) => (
              <li key={b.id} data-slot="linha-do-padrao" className="flex flex-wrap items-center gap-2">
                <CampoHora aria-label="Início" valor={b.inicio} aoMudar={(h) => trocar(b.id, { inicio: h })} />
                <span className="text-xs text-muted-foreground">até</span>
                <CampoHora aria-label="Fim" valor={b.fim} aoMudar={(h) => trocar(b.id, { fim: h })} />
                <Seletor aria-label="Tipo" className="w-32" valor={b.tipo} aoMudar={(v) => trocar(b.id, { tipo: v as TipoDeBloco })} opcoes={[{ valor: "atividade", rotulo: "Atividade" }, { valor: "pausa", rotulo: "Pausa" }]} />
                <Input aria-label="Nome do bloco" className="min-w-40 flex-1" value={b.titulo} onChange={(e) => trocar(b.id, { titulo: e.target.value })} placeholder={b.tipo === "pausa" ? "Almoço" : "Ex.: Chamados"} maxLength={160} />
                <span className={cn("w-14 text-right text-xs tabular-nums", b.fim > b.inicio ? "text-muted-foreground" : "text-destructive")}>{b.fim > b.inicio ? duracao(emMinutos(b.fim) - emMinutos(b.inicio)) : "?"}</span>
                <Dica texto="Remover este bloco">
                  <Button variant="ghost" size="icon-sm" aria-label="Remover este bloco" onClick={() => mudar((l) => l.filter((x) => x.id !== b.id))}><Trash2 /></Button>
                </Dica>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" data-slot="padrao-nova-atividade" onClick={() => acrescentar("atividade")}><Plus /> Atividade</Button>
          <Button variant="outline" size="sm" data-slot="padrao-nova-pausa" onClick={() => acrescentar("pausa")}><Plus /> Pausa</Button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// Configuração da jornada
// =====================================================================

export function ConfigurarJornada({ fechar }: { fechar: () => void }) {
  const { toast } = useNexo();
  const { jornada, salvarConfig } = useJornada();
  const c = jornada.config;
  const [jornadaMin, setJornadaMin] = useState(emHora(c.jornadaMin));
  const [pausaMin, setPausaMin] = useState(emHora(c.pausaMin));
  const [dias, setDias] = useState<number[]>(c.diasDeTrabalho);
  const [descontar, setDescontar] = useState(c.descontarPausa);
  const [saldo, setSaldo] = useState(c.saldoInicialMin ? saldoEmTexto(c.saldoInicialMin).replace("h", ":") : "");
  const [avisos, setAvisos] = usePref<boolean>("jornadaAvisos", true);
  const saldoLido = lerSaldo(saldo);
  const total = emMinutos(jornadaMin) + emMinutos(pausaMin);

  const salvar = async () => {
    if (!jornadaMin || emMinutos(jornadaMin) < 30) return toast("A jornada por dia tem que ter pelo menos 30 minutos.", "erro");
    if (saldoLido == null) return toast("Não entendi o saldo inicial. Escreva como +2:30 ou -1:00.", "erro");
    if (await salvarConfig((cfg) => ({ ...cfg, jornadaMin: emMinutos(jornadaMin), pausaMin: emMinutos(pausaMin), diasDeTrabalho: dias, descontarPausa: descontar, saldoInicialMin: saldoLido }))) {
      toast("Jornada salva. Os dias que já têm entrada registrada continuam com a jornada que tinham.");
      fechar();
    }
  };

  return (
    <Modal
      aberto
      fechar={fechar}
      titulo="Configurar a jornada"
      descricao="Quanto você trabalha por dia. É com isso que o app calcula a hora de sair e o banco de horas."
      rodape={
        <>
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button data-slot="salvar-jornada" onClick={salvar}>Salvar</Button>
        </>
      }
    >
      <div data-slot="configurar-jornada" className="flex flex-col gap-4">
        <LinhaCampos>
          <Campo rotulo="Trabalho por dia" className="flex-none"><CampoHora aria-label="Trabalho por dia" valor={jornadaMin} aoMudar={setJornadaMin} /></Campo>
          <Campo rotulo="Pausa (almoço)" className="flex-none"><CampoHora aria-label="Pausa por dia" valor={pausaMin} aoMudar={setPausaMin} /></Campo>
          <div data-slot="total-da-jornada" className="flex flex-col justify-end pb-1.5 text-xs text-muted-foreground">
            <span>{duracao(emMinutos(jornadaMin))} de trabalho + {duracao(emMinutos(pausaMin))} de pausa</span>
            <span className="font-medium text-foreground">{duracao(total)} da entrada até a saída</span>
          </div>
        </LinhaCampos>

        <Campo rotulo="Dias de trabalho">
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const ligado = dias.includes(d);
              return (
                <Button key={d} size="sm" variant={ligado ? "secondary" : "outline"} aria-pressed={ligado} className={cn("capitalize", ligado && "ring-1 ring-ring/40")}
                  onClick={() => setDias((l) => (ligado ? l.filter((x) => x !== d) : [...l, d].sort()))}>
                  {DIA_CURTO[d]}
                </Button>
              );
            })}
          </div>
        </Campo>

        <CampoSwitch marcado={descontar} aoMudar={setDescontar}>
          <span className="text-[13px]">Descontar a pausa quando eu não registrar</span>
          <span className="block text-xs text-muted-foreground">Em dia de mais de 6 horas sem nenhuma pausa registrada, o app tira a pausa acima do tempo trabalhado.</span>
        </CampoSwitch>

        <CampoSwitch marcado={avisos} aoMudar={setAvisos}>
          <span className="text-[13px]">Avisar quando um bloco começa e quando está acabando</span>
          <span className="block text-xs text-muted-foreground">Um aviso discreto dentro do app, só neste navegador. Também avisa quando a jornada do dia se completa.</span>
        </CampoSwitch>

        <Campo rotulo="Saldo que você já tinha no banco de horas" dica="Opcional. Horas e minutos com sinal: +2:30 ou -1:00." className="max-w-64">
          <Input aria-label="Saldo inicial do banco de horas" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="+0:00" className={cn("tabular-nums", saldoLido == null && "border-destructive")} />
        </Campo>
      </div>
    </Modal>
  );
}
