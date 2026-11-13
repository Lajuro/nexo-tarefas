"use client";

// "Organizar com o Copilot": copia o prompt com a folha e as tarefas abertas, recebe o JSON de
// volta e mostra uma PRÉVIA do que seria criado. Nada é gravado antes de o usuário confirmar.
// A resposta da IA é lida e validada em lib/notas.ts; aqui é só interface e aplicação.

import { useEffect, useMemo, useState } from "react";
import { CircleCheckBig, ListPlus, ScanText, TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useFecharComCuidado } from "@/components/Raiz";
import { CatTag, Modal, PrazoTag, PrioBadge, TipoBadge, copiarTexto } from "@/components/comum";
import { BlocoCopilot, IconeCopiar, PassoCopilot, useCopiado } from "@/components/tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { CampoSwitch, Checkbox } from "@/components/ui/controles";
import { Badge } from "@/components/ui/diversos";
import { Textarea } from "@/components/ui/input";
import { comPassoAlternado } from "@/lib/acoes";
import { LeituraNotas, Proposta, apelidosDasTarefas, comRegistroDaNota, frutoDe, interpretarNotas, promptNotas, tarefaDaProposta } from "@/lib/notas";
import { FrutoDaNota, Nota, Passo, agoraISO, formatarData } from "@/lib/tipos";
import { cn } from "@/lib/utils";

function ListaPassos({ passos }: { passos: Passo[] }) {
  if (!passos.length) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {passos.map((p) => (
        <li key={p.id} className="flex gap-1.5">
          <span aria-hidden>•</span>
          <span className="min-w-0">
            <span className="text-foreground">{p.texto}</span>
            {p.responsavel ? ` · ${p.responsavel}` : ""}
            {p.prazo ? ` · até ${formatarData(p.prazo, false)}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OrganizarNota({ nota, fechar }: { nota: Nota | null; fechar: () => void }) {
  const { dados, atualizarTarefa, criarTarefa, salvarNotas, toast } = useNexo();
  const [resposta, setResposta] = useState("");
  const [leitura, setLeitura] = useState<LeituraNotas | null>(null);
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [destinos, setDestinos] = useState<Record<string, string>>({});
  const [arquivar, setArquivar] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [jaCopiou, setJaCopiou] = useState(false);
  const [copiado, marcarCopiado] = useCopiado();

  useEffect(() => {
    if (!nota) return;
    setResposta("");
    setLeitura(null);
    setMarcadas(new Set());
    setDestinos({});
    setArquivar(true);
    setAplicando(false);
    setJaCopiou(false);
  }, [nota?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const abertas = useMemo(() => apelidosDasTarefas(tarefas).map((a) => a.tarefa), [tarefas]);
  const prompt = useMemo(() => (nota ? promptNotas(nota, tarefas, categorias) : ""), [nota, tarefas, categorias]);
  const opcoesTarefa = useMemo(
    () => abertas.map((t) => ({ valor: t.id, rotulo: t.titulo, detalhe: categorias.find((c) => c.id === t.categoriaId)?.nome })),
    [abertas, categorias],
  );

  const tentarFechar = useFecharComCuidado(!!nota && !aplicando && !!resposta.trim(), fechar);

  async function copiar() {
    if (await copiarTexto(prompt)) {
      marcarCopiado();
      setJaCopiou(true);
    } else toast("Não consegui copiar o prompt. Tente de novo.", "erro");
  }

  function ler() {
    const l = interpretarNotas(resposta, tarefas, categorias);
    setLeitura(l);
    const dest: Record<string, string> = {};
    const marc = new Set<string>();
    for (const p of l.propostas) {
      if (p.tipo === "registro" && p.tarefaId) dest[p.chave] = p.tarefaId;
      // Já vem marcado o que está claro. O que a IA deixou em dúvida fica para o usuário decidir.
      if (p.tipo !== "registro" || (p.tarefaId && !p.duvida)) marc.add(p.chave);
    }
    setDestinos(dest);
    setMarcadas(marc);
  }

  const propostas = leitura?.propostas ?? [];
  const aplicaveis = propostas.filter((p) => marcadas.has(p.chave) && (p.tipo !== "registro" || destinos[p.chave]));
  const alternar = (chave: string, ligado: boolean) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (ligado) n.add(chave);
      else n.delete(chave);
      return n;
    });

  async function aplicar() {
    if (!nota || aplicando || !aplicaveis.length) return;
    setAplicando(true);
    const frutos: FrutoDaNota[] = [];
    const feitas = new Set<string>();
    for (const p of aplicaveis) {
      if (p.tipo === "registro") {
        const t = await atualizarTarefa(destinos[p.chave], (x) => comRegistroDaNota(x, p.registro));
        if (t) { frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
      } else if (p.tipo === "tarefa") {
        const t = await criarTarefa(tarefaDaProposta(p, nota));
        if (t) { frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
      } else {
        const t = await atualizarTarefa(p.tarefaId, (x) => comPassoAlternado(x, p.registroId, p.passoId, true));
        if (t) { frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
      }
    }
    const falhas = aplicaveis.length - feitas.size;
    const guardar = arquivar && falhas === 0;
    const agora = agoraISO();
    if (frutos.length)
      await salvarNotas((items) =>
        items.map((n) => (n.id === nota.id ? { ...n, gerou: [...(n.gerou ?? []), ...frutos], arquivadaEm: guardar ? agora : n.arquivadaEm, atualizadaEm: agora } : n)),
      );
    setAplicando(false);
    if (falhas) {
      // O que deu certo sai da prévia; o que falhou fica para tentar de novo.
      setLeitura((l) => (l ? { ...l, propostas: l.propostas.filter((p) => !feitas.has(p.chave)) } : l));
      toast(`${feitas.size} de ${aplicaveis.length} itens aplicados. Os que falharam continuam na prévia.`, "erro");
      return;
    }
    toast(`${feitas.size === 1 ? "1 item aplicado" : `${feitas.size} itens aplicados`}${guardar ? ". Folha arquivada." : "."}`);
    fechar();
  }

  const temResposta = !!resposta.trim();
  const tituloDe = (id: string | null | undefined) => tarefas.find((t) => t.id === id)?.titulo ?? "";

  return (
    <Modal
      titulo="Organizar a folha com o Copilot"
      descricao={nota?.titulo || "O Copilot separa suas notas em registros, tarefas novas e passos concluídos. Você confere antes de gravar."}
      aberto={!!nota}
      fechar={tentarFechar}
      largo="xl"
      rodape={
        <>
          {leitura?.ok && (
            <CampoSwitch marcado={arquivar} aoMudar={setArquivar} className="mr-auto">Arquivar a folha depois de aplicar</CampoSwitch>
          )}
          <Button variant="outline" onClick={tentarFechar}>Fechar</Button>
          <Button data-slot="aplicar-notas" disabled={!aplicaveis.length || aplicando} onClick={aplicar}>
            <ListPlus /> {aplicando ? "Aplicando..." : aplicaveis.length ? `Aplicar ${aplicaveis.length} ${aplicaveis.length === 1 ? "item" : "itens"}` : "Aplicar"}
          </Button>
        </>
      }
    >
      <div data-slot="organizar-nota" className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <BlocoCopilot descricao="Sem API: o Nexo monta o prompt, você cola no Copilot do navegador e traz o JSON de volta." className="self-start">
          <PassoCopilot n={1} titulo="Copiar o prompt com a folha e as tarefas abertas" feito={jaCopiou}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button onClick={copiar}><IconeCopiar copiado={copiado} /> Copiar prompt</Button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {abertas.length} {abertas.length === 1 ? "tarefa aberta" : "tarefas abertas"} · {prompt.length.toLocaleString("pt-BR")} caracteres
              </span>
            </div>
          </PassoCopilot>
          <PassoCopilot n={2} titulo="Colar a resposta (o JSON) do Copilot" feito={temResposta}>
            <Textarea rows={7} value={resposta} placeholder="Cole aqui o JSON que o Copilot devolveu..."
              aria-label="Resposta do Copilot" className="max-h-72 min-h-28 font-mono text-xs"
              onChange={(e) => { setResposta(e.target.value); setLeitura(null); }} />
          </PassoCopilot>
          <PassoCopilot n={3} titulo="Ler a resposta e conferir a prévia" feito={!!leitura?.ok} ultimo>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Button variant="outline" disabled={!temResposta} onClick={ler}><ScanText /> Ler resposta</Button>
              <span className="text-[11px] text-muted-foreground">Nada é gravado antes de você aplicar.</span>
            </div>
          </PassoCopilot>
        </BlocoCopilot>

        <section data-slot="previa-notas" className="min-w-0">
          <h3 className="mb-2 text-[13px] font-semibold tracking-tight sem-selecao">Prévia do que será criado</h3>
          {!leitura && (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-[13px] text-muted-foreground">
              Siga os três passos ao lado. O que o Copilot propuser aparece aqui para você conferir, item por item.
            </p>
          )}
          {leitura && !leitura.ok && (
            <p data-slot="erro-leitura" role="alert" className="flex items-start gap-2 rounded-xl border border-alerta/40 bg-alerta/8 px-3.5 py-3 text-[13px] leading-snug">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alerta" /> {leitura.erro}
            </p>
          )}
          {leitura?.ok && (
            <div className="flex flex-col gap-2.5">
              {propostas.map((p) => {
                const marcada = marcadas.has(p.chave);
                const semDestino = p.tipo === "registro" && !destinos[p.chave];
                return (
                  <article key={p.chave} data-slot="proposta" data-tipo={p.tipo}
                    className={cn("flex gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-xs transition-opacity", !marcada && "opacity-60")}>
                    <Checkbox checked={marcada} disabled={semDestino} onCheckedChange={(v) => alternar(p.chave, v === true)} className="mt-0.5"
                      aria-label={marcada ? "Não aplicar este item" : "Aplicar este item"} />
                    <div className="min-w-0 flex-1">
                      {p.tipo === "registro" && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <TipoBadge tipo={p.registro.tipo} />
                            <span className="text-xs text-muted-foreground tabular-nums">{formatarData(p.registro.data)}</span>
                            <span className="min-w-0 text-[13px] font-medium">{p.registro.titulo || "Sem título"}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-muted-foreground sem-selecao">Entra em</span>
                            <Combobox
                              aria-label="Tarefa que recebe este registro"
                              valor={destinos[p.chave] ?? ""}
                              aoMudar={(v) => { setDestinos((d) => ({ ...d, [p.chave]: v })); if (v) alternar(p.chave, true); }}
                              opcoes={opcoesTarefa}
                              permitirLimpar={false}
                              placeholder="Escolha a tarefa..."
                              buscaPlaceholder="Buscar tarefa..."
                              vazio="Nenhuma tarefa aberta com esse nome."
                              className="h-7 max-w-full min-w-0 flex-1 basis-56 text-xs"
                            />
                          </div>
                          {p.duvida && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-alerta"><TriangleAlert className="mt-px size-3 shrink-0" /> {p.duvida}</p>}
                          {p.registro.participantes.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Com {p.registro.participantes.join(", ")}</p>}
                          {p.registro.resumoIA && <p className="mt-1.5 text-[13px] leading-snug texto-pre">{p.registro.resumoIA}</p>}
                          {p.registro.decisoes && <p className="mt-1.5 text-xs leading-snug text-muted-foreground texto-pre"><span className="font-medium text-foreground">Decisões:</span> {p.registro.decisoes}</p>}
                          {p.registro.impedimentos && <p className="mt-1.5 text-xs leading-snug text-muted-foreground texto-pre"><span className="font-medium text-destructive">Impedimentos:</span> {p.registro.impedimentos}</p>}
                          <ListaPassos passos={p.registro.proximosPassos} />
                        </>
                      )}
                      {p.tipo === "tarefa" && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge variant="default">Tarefa nova</Badge>
                            <span className="min-w-0 text-[13px] font-medium">{p.titulo}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <CatTag cat={categorias.find((c) => c.id === p.categoriaId)} />
                            <PrioBadge p={p.prioridade} />
                            <PrazoTag prazo={p.prazo} />
                          </div>
                          {p.categoriaCitada && <p className="mt-1.5 text-[11px] text-alerta">A IA sugeriu a categoria “{p.categoriaCitada}”, que não existe. A tarefa entra sem categoria.</p>}
                          {p.descricao && <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground texto-pre">{p.descricao}</p>}
                          <ListaPassos passos={p.passos} />
                        </>
                      )}
                      {p.tipo === "passo_concluido" && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge variant="sucesso"><CircleCheckBig className="size-3" /> Concluir passo</Badge>
                            <span className="min-w-0 text-[13px] font-medium">{p.texto}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">em {tituloDe(p.tarefaId)}</p>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
              {leitura.sobras && (
                <div data-slot="sobras" className="rounded-xl border border-dashed px-3.5 py-3">
                  <p className="text-xs font-medium sem-selecao">Não coube em lugar nenhum</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground texto-pre">{leitura.sobras}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Continua no texto da folha, que fica guardada.</p>
                </div>
              )}
              {leitura.avisos.length > 0 && (
                <ul data-slot="avisos-leitura" className="flex flex-col gap-0.5 text-[11px] leading-snug text-muted-foreground">
                  {leitura.avisos.map((a, i) => <li key={i} className="flex gap-1.5"><TriangleAlert className="mt-px size-3 shrink-0 text-alerta" /> {a}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
