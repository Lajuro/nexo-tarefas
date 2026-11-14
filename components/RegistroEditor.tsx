"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ClipboardPaste, History, ListChecks, RefreshCw, WandSparkles, X } from "lucide-react";
import { useNexo } from "./Provider";
import { useConfirmar } from "./Raiz";
import { Campo, ChipsInput, IconeTipo, LinhaCampos, Modal, SeletorPrioridade, copiarTexto, opcoesStatus } from "./comum";
import { BlocoCopilot, IconeCopiar, PassoCopilot, useCopiado } from "./tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { EditorRico } from "@/components/editor/EditorRico";
import { Input, Textarea } from "@/components/ui/input";
import { Seletor } from "@/components/ui/select";
import { Checkbox, Label, Segmentado } from "@/components/ui/controles";
import { SeletorData, SeletorHora } from "@/components/ui/data";
import { CampoSugestoes } from "@/components/ui/chips";
import { Kbd } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { aplicarStatus } from "@/lib/acoes";
import { itemRemovivel } from "@/lib/animacoes";
import { nomesConhecidos } from "@/lib/pessoas";
import { interpretarResposta, mesmoTexto, promptRegistro } from "@/lib/prompts";
import { Rascunho, apagarRascunho, gravarRascunho, lerRascunho } from "@/lib/rascunhos";
import {
  Passo, Registro, Status, TIPOS_REGISTRO, Tarefa, TipoRegistro, agoraISO, formatarData, formatarDataHora, hojeISO, nomeStatus,
  normalizarPasso, normalizarRegistro, novoId, passosAbertos,
} from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Campos que a resposta da IA pode preencher (para o destaque rápido depois de "Preencher campos"). */
type CampoIA = "resumo" | "decisoes" | "passos" | "impedimentos" | "participantes" | "anteriores";

/** Moldura que acende por um instante em volta de um campo preenchido pela IA. */
function Realce({ ativo, children, className }: { ativo: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {children}
      <AnimatePresence>
        {ativo && (
          <motion.span
            aria-hidden
            data-slot="realce-ia"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="pointer-events-none absolute -inset-[3px] rounded-[10px] bg-primary/[0.07] ring-2 ring-primary/45"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** "antes: X" ao lado do rótulo quando o valor vai mudar na tarefa. */
function Antes({ children }: { children: ReactNode }) {
  return <span className="truncate text-[11px] text-primary dark:text-foreground/80">antes: {children}</span>;
}

const retrato = (r: Registro, colado: string, status: Status, prioridade: number, prazo: string, concluir: string[]) =>
  JSON.stringify([r, colado, status, prioridade, prazo, concluir]);

export function RegistroEditor({
  aberto, fechar, tarefa, registro, tipoInicial = "reuniao",
}: {
  aberto: boolean; fechar: () => void; tarefa: Tarefa; registro?: Registro | null; tipoInicial?: TipoRegistro;
}) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const confirmar = useConfirmar();
  const [r, setR] = useState<Registro>(() => normalizarRegistro({}));
  const [colado, setColado] = useState("");
  const [status, setStatus] = useState<Status>(tarefa.status);
  const [prioridade, setPrioridade] = useState(tarefa.prioridade);
  const [prazo, setPrazo] = useState(tarefa.prazo ?? "");
  const [concluir, setConcluir] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Só interface: andamento dos 3 passos do Copilot, destaque dos campos preenchidos e foco do passo novo.
  const [jaCopiou, setJaCopiou] = useState(false);
  const [preenchido, setPreenchido] = useState<null | { ok: boolean; texto: string }>(null);
  const [realce, setRealce] = useState<{ campos: CampoIA[]; passos: string[] }>({ campos: [], passos: [] });
  const [focarPasso, setFocarPasso] = useState<string | null>(null);
  const [copiado, marcarCopiado] = useCopiado();
  const inicial = useRef("");
  const relogioRealce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Rascunho automático (lib/rascunhos.ts): o que foi digitado e ainda não foi salvo.
  const [recuperado, setRecuperado] = useState<Rascunho | null>(null);
  const [rascunhoOk, setRascunhoOk] = useState(true);
  const base = useRef<{ r: Registro; colado: string } | null>(null); // o registro como estava, para "descartar rascunho"
  const alvo = useRef<string | null>(null); // retrato que o estado terá quando a abertura terminar de carregar
  const gravada = useRef<string | null>(null); // último retrato guardado como rascunho
  const encerrado = useRef(false); // salvo ou descartado: não recria o rascunho
  const regId = registro?.id ?? null;

  useEffect(() => {
    if (!aberto) return;
    const original = registro ? structuredClone(registro) : normalizarRegistro({ tipo: tipoInicial, data: hojeISO() });
    const coladoOriginal = registro?.respostaIABruta ?? "";
    const lido = lerRascunho(tarefa.id, regId);
    const rasc = lido && (!registro || lido.r.id === registro.id) ? lido : null;
    // Abre do rascunho, se houver. Status, prioridade e prazo só vêm dele se tinham sido mexidos.
    const ini = {
      r: rasc ? rasc.r : original,
      colado: rasc ? rasc.colado : coladoOriginal,
      status: rasc?.status ?? tarefa.status,
      prioridade: rasc?.prioridade ?? tarefa.prioridade,
      prazo: rasc?.prazo ?? (tarefa.prazo ?? ""),
      concluir: rasc ? rasc.concluir : [],
    };
    setR(ini.r);
    setColado(ini.colado);
    setStatus(ini.status);
    setPrioridade(ini.prioridade);
    setPrazo(ini.prazo);
    setConcluir(ini.concluir);
    setRecuperado(rasc);
    setRascunhoOk(true);
    base.current = { r: structuredClone(original), colado: coladoOriginal };
    alvo.current = retrato(ini.r, ini.colado, ini.status, ini.prioridade, ini.prazo, ini.concluir);
    gravada.current = rasc ? alvo.current : null;
    encerrado.current = false;
    setSalvando(false);
    setJaCopiou(false);
    setPreenchido(null);
    setRealce({ campos: [], passos: [] });
    setFocarPasso(null);
    inicial.current = retrato(original, coladoOriginal, tarefa.status, tarefa.prioridade, tarefa.prazo ?? "", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, registro?.id]);

  // A cada mudança, guarda no navegador o que ainda não foi salvo (e apaga se voltou ao original).
  const atual = retrato(r, colado, status, prioridade, prazo, concluir);
  useEffect(() => {
    if (!aberto || encerrado.current) return;
    if (alvo.current !== null) {
      // Logo depois de abrir, o estado ainda é o da abertura anterior: espera carregar.
      if (atual !== alvo.current) return;
      alvo.current = null;
    }
    if (atual === inicial.current) {
      if (gravada.current !== null) apagarRascunho(tarefa.id, regId);
      gravada.current = null;
      return;
    }
    if (atual === gravada.current) return;
    const ok = gravarRascunho({
      tarefaId: tarefa.id,
      registroId: regId,
      r,
      colado,
      status: status !== tarefa.status ? status : undefined,
      prioridade: prioridade !== tarefa.prioridade ? prioridade : undefined,
      prazo: prazo !== (tarefa.prazo ?? "") ? prazo : undefined,
      concluir,
      baseAtualizadoEm: registro?.atualizadoEm ?? null,
    });
    gravada.current = ok ? atual : null;
    setRascunhoOk(ok);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, atual]);

  useEffect(() => () => {
    if (relogioRealce.current) clearTimeout(relogioRealce.current);
  }, []);

  const set = <K extends keyof Registro>(k: K, v: Registro[K]) => setR((x) => ({ ...x, [k]: v }));
  const cat = dados?.categorias.items.find((c) => c.id === tarefa.categoriaId);

  const pessoas = useMemo(() => (dados ? nomesConhecidos(dados) : []), [dados]);
  const quem = useMemo(() => ["Eu", ...pessoas.filter((p) => p !== "Eu")], [pessoas]);

  const abertosOutros = passosAbertos(tarefa).filter((x) => x.registro.id !== r.id);
  const mudou = aberto && atual !== inicial.current;
  const registroMudouDepois = !!registro && !!recuperado?.baseAtualizadoEm && recuperado.baseAtualizadoEm !== registro.atualizadoEm;

  async function copiarPrompt() {
    if (!r.anotacoes.trim()) toast("Dica: escreva suas anotações brutas antes, o prompt usa elas.", "info");
    const ok = await copiarTexto(promptRegistro(tarefa, cat, r));
    if (ok) {
      // O retorno aparece no próprio passo (o aviso flutuante cobriria o botão de salvar).
      marcarCopiado();
      setJaCopiou(true);
    } else {
      toast("Não consegui copiar o prompt. Tente de novo.", "erro");
    }
  }

  function preencher() {
    const res = interpretarResposta(colado);
    const novosPassos = res.passos
      .filter((p) => !r.proximosPassos.some((q) => mesmoTexto(q.texto, p.texto)))
      .map((p) => normalizarPasso({ texto: p.texto, responsavel: p.responsavel }));
    const novasPessoas = res.participantes.filter((p) => !r.participantes.includes(p));
    setR((x) => ({
      ...x,
      respostaIABruta: colado,
      resumoIA: res.resumo || x.resumoIA,
      decisoes: res.decisoes || x.decisoes,
      impedimentos: res.impedimentos || x.impedimentos,
      participantes: [...new Set([...x.participantes, ...res.participantes])],
      proximosPassos: [...x.proximosPassos, ...novosPassos],
    }));
    const ids = abertosOutros.filter((a) => res.concluidos.some((c) => mesmoTexto(c, a.passo.texto))).map((a) => a.passo.id);
    setConcluir(ids);

    const campos: CampoIA[] = [];
    if (res.resumo) campos.push("resumo");
    if (res.decisoes) campos.push("decisoes");
    if (res.impedimentos) campos.push("impedimentos");
    if (novasPessoas.length) campos.push("participantes");
    if (ids.length) campos.push("anteriores");
    setRealce({ campos, passos: novosPassos.map((p) => p.id) });
    if (relogioRealce.current) clearTimeout(relogioRealce.current);
    relogioRealce.current = setTimeout(() => setRealce({ campos: [], passos: [] }), 2400);

    // Mesmo texto de sempre, agora dentro do passo 3 em vez de aviso flutuante.
    setPreenchido({
      ok: res.reconheceu,
      texto: res.reconheceu
        ? `Campos preenchidos${ids.length ? ` e ${ids.length} passo(s) antigo(s) marcados para concluir` : ""}. Revise antes de salvar.`
        : "Não achei as seções do formato. Coloquei tudo no resumo.",
    });
  }

  function mudarPasso(i: number, campo: keyof Passo, v: string | boolean | null) {
    setR((x) => ({
      ...x,
      proximosPassos: x.proximosPassos.map((p, j) =>
        j === i ? { ...p, [campo]: v, ...(campo === "feito" ? { feitoEm: v ? agoraISO() : null } : {}) } : p,
      ),
    }));
  }

  function novoPasso(depoisDe?: number) {
    const p = normalizarPasso({ id: novoId("p") });
    setFocarPasso(p.id);
    setR((x) => {
      const lista = [...x.proximosPassos];
      lista.splice(depoisDe === undefined ? lista.length : depoisDe + 1, 0, p);
      return { ...x, proximosPassos: lista };
    });
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    const novo: Registro = {
      ...r,
      proximosPassos: r.proximosPassos.filter((p) => p.texto.trim()),
      atualizadoEm: agoraISO(),
    };
    const alteracoes: Registro["alteracoes"] = { ...(registro?.alteracoes || {}) };
    if (prioridade !== tarefa.prioridade) alteracoes.prioridade = { de: tarefa.prioridade, para: prioridade };
    if ((prazo || null) !== tarefa.prazo) alteracoes.prazo = { de: tarefa.prazo, para: prazo || null };
    novo.alteracoes = alteracoes;

    const ok = await atualizarTarefa(tarefa.id, (t) => {
      // Decide pelo que está gravado agora: se o registro já existe, troca; se não, acrescenta.
      const regs = t.registros.some((x) => x.id === novo.id)
        ? t.registros.map((x) => (x.id === novo.id ? novo : x))
        : [...t.registros, novo];
      const regsComConcluidos = regs.map((x) => ({
        ...x,
        proximosPassos: x.proximosPassos.map((p) =>
          concluir.includes(p.id) ? { ...p, feito: true, feitoEm: agoraISO() } : p,
        ),
      }));
      // mudança de status vira um marco próprio na timeline (ex.: o card "Concluída")
      return aplicarStatus({ ...t, registros: regsComConcluidos, prioridade, prazo: prazo || null }, status, t);
    });
    setSalvando(false);
    if (ok) {
      encerrado.current = true;
      apagarRascunho(tarefa.id, regId);
      toast("Registro salvo.");
      fechar();
    }
  }

  const perguntarDescarte = () =>
    confirmar({
      titulo: "Descartar o que você escreveu?",
      descricao: "Este registro ainda não foi salvo. Se descartar, o que você digitou aqui se perde.",
      confirmar: "Descartar",
      cancelar: "Continuar editando",
      perigo: true,
    });

  // Esc, clique fora, X e "Fechar e continuar depois" passam por aqui: o que foi digitado fica
  // guardado como rascunho e volta ao reabrir. Só pergunta se o navegador não deixou guardar.
  async function tentarFechar() {
    if (salvando) return;
    if (mudou && !rascunhoOk) {
      if (!(await perguntarDescarte())) return;
    } else if (mudou) {
      toast("Rascunho guardado. Ele volta quando você abrir este registro de novo.", "info");
    }
    fechar();
  }

  // Botão "Descartar": joga o rascunho fora e fecha.
  async function descartar() {
    if (salvando || !(await perguntarDescarte())) return;
    encerrado.current = true;
    apagarRascunho(tarefa.id, regId);
    fechar();
  }

  // No aviso de rascunho recuperado: volta ao que estava salvo, sem fechar o editor.
  async function descartarRecuperado() {
    if (!base.current || !(await perguntarDescarte())) return;
    apagarRascunho(tarefa.id, regId);
    gravada.current = null;
    setR(structuredClone(base.current.r));
    setColado(base.current.colado);
    setStatus(tarefa.status);
    setPrioridade(tarefa.prioridade);
    setPrazo(tarefa.prazo ?? "");
    setConcluir([]);
    setPreenchido(null);
    setRecuperado(null);
  }

  const tipos = TIPOS_REGISTRO.filter((t) => t.id !== "marco" || r.tipo === "marco");
  const temResposta = !!colado.trim();
  const noRealce = (c: CampoIA) => realce.campos.includes(c);

  return (
    <Modal
      titulo={registro ? "Editar registro" : "Novo registro na timeline"}
      descricao={tarefa.titulo}
      aberto={aberto}
      fechar={tentarFechar}
      largo="xl"
      className="[&>[data-slot=dialog-body]]:flex [&>[data-slot=dialog-body]]:flex-col [&>[data-slot=dialog-body]]:p-0 lg:[&>[data-slot=dialog-body]]:overflow-hidden"
      rodape={
        <>
          <span className="mr-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sem-selecao sm:flex">
            <Kbd>Ctrl</Kbd><Kbd>Enter</Kbd> salva
            {mudou && (
              <span data-slot="rascunho-estado" className={cn("ml-2", !rascunhoOk && "text-alerta")}>
                {rascunhoOk ? "Rascunho guardado neste navegador" : "Atenção: não consegui guardar o rascunho"}
              </span>
            )}
          </span>
          {mudou && <Button variant="destructive-ghost" onClick={descartar}>Descartar</Button>}
          <Button variant="outline" onClick={tentarFechar}>{mudou ? "Fechar e continuar depois" : "Cancelar"}</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar registro"}
          </Button>
        </>
      }
    >
      <div
        data-slot="editor-registro"
        className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            salvar();
          }
        }}
      >
        {/* Esquerda: o que aconteceu, do jeito que o usuário anotou */}
        <div data-slot="editor-anotacoes" className="flex min-w-0 flex-col gap-3.5 p-5 lg:min-h-0 lg:flex-1 lg:basis-0 lg:overflow-y-auto">
          {recuperado && (
            <div data-slot="rascunho-recuperado" role="status"
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs leading-snug">
              <History className="size-3.5 shrink-0 text-info" />
              <span className="min-w-0 flex-1 basis-48">
                Continuando o rascunho de {formatarDataHora(recuperado.salvoEm)}, que não tinha sido salvo.
                {registroMudouDepois && " O registro foi alterado depois disso: salvar grava a versão do rascunho."}
              </span>
              <Button variant="outline" size="sm" onClick={descartarRecuperado}>Descartar rascunho</Button>
            </div>
          )}
          <Segmentado
            aria-label="Tipo de registro"
            valor={r.tipo}
            aoMudar={(t) => set("tipo", t)}
            tamanho={tipos.length > 5 ? "sm" : "default"}
            className="flex w-full [&>button]:flex-auto [&>button]:px-1.5"
            opcoes={tipos.map((t) => ({
              valor: t.id,
              rotulo: t.nome,
              icone: <IconeTipo tipo={t.id} className={r.tipo === t.id ? undefined : "text-muted-foreground"} />,
            }))}
          />
          <LinhaCampos>
            <Campo rotulo="Data">
              <SeletorData valor={r.data} aoMudar={(v) => v && set("data", v)} limpavel={false} aria-label="Data do registro" />
            </Campo>
            <Campo rotulo="Hora (opcional)">
              <SeletorHora valor={r.hora || ""} aoMudar={(v) => set("hora", v)} />
            </Campo>
          </LinhaCampos>
          <Campo rotulo="Título">
            <Input
              data-foco-inicial
              value={r.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder={r.tipo === "reuniao" ? "Ex.: Alinhamento com o time de arquitetura" : "Resumo em uma linha"}
            />
          </Campo>
          <Campo rotulo="Participantes" dica="Enter para adicionar. Sugere nomes que já apareceram antes.">
            <Realce ativo={noRealce("participantes")}>
              <ChipsInput valor={r.participantes} mudar={(v) => set("participantes", v)} sugestoes={pessoas} placeholder="Nomes" />
            </Realce>
          </Campo>
          <Campo rotulo="Anotações brutas" dica="Escreva do seu jeito, rápido. A IA organiza depois. Dá para colar prints (Ctrl V) e usar / para listas, tarefas e tabelas.">
            <EditorRico
              data-slot="anotacoes"
              valor={r.anotacoes}
              aoMudar={(v) => set("anotacoes", v)}
              placeholder="O que foi falado, combinado, o que ficou pendente..."
              aria-label="Anotações brutas"
              classeConteudo="min-h-44"
            />
          </Campo>

          <BlocoCopilot descricao="Sem API: o Nexo monta o prompt, você cola no Copilot do navegador e traz a resposta.">
            <PassoCopilot n={1} titulo="Copiar o prompt com o contexto da tarefa" feito={jaCopiou}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Button onClick={copiarPrompt}>
                  <IconeCopiar copiado={copiado} /> Copiar prompt para o Copilot
                </Button>
                {jaCopiou && (
                  <motion.span data-slot="retorno-copia" role="status" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className="text-[11px] text-sucesso">
                    Prompt copiado. Cole no Copilot e traga a resposta pra cá.
                  </motion.span>
                )}
              </div>
            </PassoCopilot>
            <PassoCopilot n={2} titulo="Colar a resposta do Copilot" feito={temResposta}>
              <Textarea
                rows={5}
                value={colado}
                onChange={(e) => {
                  setColado(e.target.value);
                  setPreenchido(null);
                }}
                placeholder="Cole a resposta aqui..."
                className="max-h-64 min-h-24"
              />
            </PassoCopilot>
            <PassoCopilot n={3} titulo="Preencher os campos automaticamente" feito={!!preenchido?.ok && temResposta} ultimo>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Button variant="outline" disabled={!temResposta} onClick={preencher}>
                  <WandSparkles /> Preencher campos com a resposta
                </Button>
                {preenchido ? (
                  <motion.span data-slot="retorno-preenchimento" role="status" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    className={cn("min-w-0 flex-1 basis-48 text-[11px] leading-snug", preenchido.ok ? "text-sucesso" : "text-alerta")}>
                    {preenchido.texto}
                  </motion.span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {temResposta ? "Você revisa tudo antes de salvar." : <><ClipboardPaste className="mr-1 inline size-3 align-[-2px]" />Cole a resposta no passo 2 para liberar.</>}
                  </span>
                )}
              </div>
            </PassoCopilot>
          </BlocoCopilot>
        </div>

        {/* Direita: como o registro vai para a linha do tempo */}
        <div data-slot="editor-organizado" className="flex min-w-0 flex-col gap-3.5 border-t bg-muted/30 p-5 lg:min-h-0 lg:flex-1 lg:basis-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <div className="flex min-h-8 items-center gap-2 sem-selecao">
            <ListChecks className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <h3 className="text-[13px] leading-tight font-semibold tracking-tight">Como vai para a linha do tempo</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">Preencha à mão ou deixe o Copilot organizar por você.</p>
            </div>
          </div>

          <Campo rotulo="Resumo">
            <Realce ativo={noRealce("resumo")}>
              <Textarea rows={5} value={r.resumoIA} onChange={(e) => set("resumoIA", e.target.value)} placeholder="Preenchido pela IA ou por você" />
            </Realce>
          </Campo>
          <Campo rotulo="Decisões">
            <Realce ativo={noRealce("decisoes")}>
              <Textarea rows={3} value={r.decisoes} onChange={(e) => set("decisoes", e.target.value)} placeholder="Uma decisão por linha" />
            </Realce>
          </Campo>

          <div data-slot="editor-passos" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Próximos passos</Label>
              {r.proximosPassos.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {r.proximosPassos.filter((p) => p.feito).length} de {r.proximosPassos.length} feitos
                </span>
              )}
            </div>
            <div>
              <AnimatePresence initial={false}>
                {r.proximosPassos.map((p, i) => (
                  <motion.div key={p.id} {...itemRemovivel} layout={false} data-slot="editor-passo">
                    <Realce ativo={realce.passos.includes(p.id)} className="mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={p.feito} onCheckedChange={(v) => mudarPasso(i, "feito", v === true)}
                          aria-label={p.feito ? "Passo já feito. Clique para reabrir." : "Marcar passo como já feito"} />
                        <Input
                          value={p.texto}
                          autoFocus={focarPasso === p.id}
                          onChange={(e) => mudarPasso(i, "texto", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && p.texto.trim()) {
                              e.preventDefault();
                              novoPasso(i);
                            }
                          }}
                          placeholder="Ação"
                          aria-label="Ação"
                          className={cn("min-w-0 flex-1", p.feito && "text-muted-foreground line-through")}
                        />
                        <CampoSugestoes valor={p.responsavel || ""} aoMudar={(v) => mudarPasso(i, "responsavel", v)} sugestoes={quem}
                          placeholder="Quem" aria-label="Responsável" className="w-[104px] shrink-0" />
                        <SeletorData compacto valor={p.prazo ?? ""} aoMudar={(v) => mudarPasso(i, "prazo", v || null)}
                          placeholder="Prazo" aria-label="Prazo do passo" className={cn("shrink-0", p.prazo && "text-foreground")} />
                        <Dica texto="Remover passo">
                          <Button variant="ghost" size="icon-sm" aria-label="Remover passo" className="shrink-0"
                            onClick={() => set("proximosPassos", r.proximosPassos.filter((_, j) => j !== i))}>
                            <X />
                          </Button>
                        </Dica>
                      </div>
                    </Realce>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="outline" size="sm" onClick={() => novoPasso()}>+ Passo</Button>
                {r.proximosPassos.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">O que ficou combinado de fazer, com quem e até quando.</span>
                )}
              </div>
            </div>
          </div>

          <Campo rotulo="Impedimentos">
            <Realce ativo={noRealce("impedimentos")}>
              <Textarea rows={2} value={r.impedimentos} onChange={(e) => set("impedimentos", e.target.value)} placeholder="Bloqueios, riscos ou dependências" />
            </Realce>
          </Campo>

          {abertosOutros.length > 0 && (
            <div data-slot="passos-anteriores" className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Passos anteriores resolvidos aqui?</Label>
                {concluir.length > 0 && (
                  <span className="text-[11px] text-sucesso tabular-nums">
                    {concluir.length === 1 ? "1 será concluído ao salvar" : `${concluir.length} serão concluídos ao salvar`}
                  </span>
                )}
              </div>
              <Realce ativo={noRealce("anteriores")}>
                <ul className="divide-y overflow-hidden rounded-lg border bg-card dark:bg-input/20">
                  {abertosOutros.map(({ passo, registro: origem }) => {
                    const marcado = concluir.includes(passo.id);
                    return (
                      <li key={passo.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-[13px] leading-snug transition-colors hover:bg-accent/60">
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={(v) => setConcluir((c) => (v === true ? [...c, passo.id] : c.filter((x) => x !== passo.id)))}
                            className="mt-px"
                          />
                          <span className={cn("min-w-0 flex-1 transition-colors texto-pre", marcado && "text-muted-foreground line-through decoration-muted-foreground/50")}>
                            {passo.texto}
                          </span>
                          <span className="shrink-0 pt-px text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                            {passo.responsavel ? `${passo.responsavel} · ` : ""}{formatarData(origem.data, false)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Realce>
            </div>
          )}

          <section data-slot="atualizar-tarefa" className="mt-1 rounded-xl border bg-card p-3.5 shadow-xs dark:bg-input/10">
            <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 sem-selecao">
              <RefreshCw className="size-3.5 text-muted-foreground" />
              <h3 className="text-[13px] font-semibold tracking-tight">Atualizar a tarefa junto</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">Mudar o status cria um marco</span>
            </header>
            <div className="flex flex-col gap-3">
              <LinhaCampos>
                <Campo rotulo="Status" lado={status !== tarefa.status && <Antes>{nomeStatus(tarefa.status)}</Antes>}>
                  <Seletor valor={status} aoMudar={(v) => setStatus(v as Status)} opcoes={opcoesStatus} aria-label="Status da tarefa" />
                </Campo>
                <Campo rotulo="Prazo" lado={(prazo || null) !== tarefa.prazo && <Antes>{formatarData(tarefa.prazo) || "sem prazo"}</Antes>}>
                  <SeletorData valor={prazo} aoMudar={setPrazo} placeholder="Sem prazo" aria-label="Prazo da tarefa" />
                </Campo>
              </LinhaCampos>
              <Campo rotulo={`Prioridade: ${prioridade}`} lado={prioridade !== tarefa.prioridade && <Antes>{tarefa.prioridade}</Antes>}>
                <SeletorPrioridade valor={prioridade} aoMudar={setPrioridade} />
              </Campo>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
