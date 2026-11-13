"use client";

// "Organizar com o Copilot": copia o prompt com a folha e as tarefas abertas, recebe o JSON de
// volta e mostra uma PRÉVIA do que seria criado. Nada é gravado antes de o usuário confirmar.
// A resposta da IA é lida e validada em lib/notas.ts; aqui é só interface e aplicação.
//
// Nada do que foi escrito se perde ao organizar: cada registro criado fica ligado à folha
// (notaId), a folha é arquivada com o texto original, e o que a IA não encaixou ("sobras")
// vira uma proposta que o usuário pode guardar numa tarefa ou deixar anotada na folha.

import { useEffect, useMemo, useState } from "react";
import { CircleCheckBig, ListPlus, ScanText, TriangleAlert } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useFecharComCuidado } from "@/components/Raiz";
import { CatTag, Modal, PrazoTag, PrioBadge, TipoBadge, copiarTexto } from "@/components/comum";
import { BlocoCopilot, IconeCopiar, PassoCopilot, useCopiado } from "@/components/tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { CampoSwitch, Checkbox } from "@/components/ui/controles";
import { SeletorData } from "@/components/ui/data";
import { Badge } from "@/components/ui/diversos";
import { Textarea } from "@/components/ui/input";
import { comPassoAlternado } from "@/lib/acoes";
import {
  LeituraNotas, Proposta, PropostaTarefa, apelidosDasTarefas, comRegistroDaNota, frutoDe, interpretarNotas, levaTextoInteiro, promptNotas,
  registroDaProposta, tarefaDaProposta,
} from "@/lib/notas";
import { FrutoDaNota, Nota, Passo, Tarefa, agoraISO, formatarData, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Destino de um registro: id de tarefa existente, ou "nova:<chave da proposta de tarefa nova>". */
const NOVA = "nova:";

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
  const [datas, setDatas] = useState<Record<string, string>>({});
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
    setDatas({});
    setArquivar(true);
    setAplicando(false);
    setJaCopiou(false);
  }, [nota?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const abertas = useMemo(() => apelidosDasTarefas(tarefas).map((a) => a.tarefa), [tarefas]);
  const prompt = useMemo(() => (nota ? promptNotas(nota, tarefas, categorias) : ""), [nota, tarefas, categorias]);

  const propostas = useMemo(() => leitura?.propostas ?? [], [leitura]);
  const novas = useMemo(() => propostas.filter((p): p is PropostaTarefa => p.tipo === "tarefa"), [propostas]);
  // Um registro pode entrar numa tarefa que já existe ou numa das tarefas novas desta mesma folha.
  const opcoesTarefa = useMemo(
    () => [
      ...novas.map((p) => ({ valor: NOVA + p.chave, rotulo: `Nova: ${p.titulo}`, detalhe: "tarefa nova desta folha" })),
      ...abertas.map((t) => ({ valor: t.id, rotulo: t.titulo, detalhe: categorias.find((c) => c.id === t.categoriaId)?.nome })),
    ],
    [novas, abertas, categorias],
  );

  const tentarFechar = useFecharComCuidado(!!nota && !aplicando && !!resposta.trim(), fechar);

  async function copiar() {
    if (await copiarTexto(prompt)) {
      marcarCopiado();
      setJaCopiou(true);
    } else toast("Não consegui copiar o prompt. Tente de novo.", "erro");
  }

  function ler() {
    const l = interpretarNotas(resposta, tarefas, categorias, nota?.texto ?? "");
    setLeitura(l);
    const dest: Record<string, string> = {};
    const dts: Record<string, string> = {};
    const marc = new Set<string>();
    for (const p of l.propostas) {
      if (p.tipo === "registro") {
        dts[p.chave] = p.registro.data;
        if (p.tarefaId) dest[p.chave] = p.tarefaId;
        else if (p.novaChave) dest[p.chave] = NOVA + p.novaChave;
        // Já vem marcado o que está claro. O que a IA deixou em dúvida e as sobras ficam para o usuário decidir.
        if (p.origem === "ia" && dest[p.chave] && !p.duvida) marc.add(p.chave);
      } else marc.add(p.chave);
    }
    setDestinos(dest);
    setDatas(dts);
    setMarcadas(marc);
  }

  const alternar = (chave: string, ligado: boolean) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (ligado) n.add(chave);
      else n.delete(chave);
      return n;
    });

  /** Escolher o destino de um registro já marca o registro (e a tarefa nova, se for o caso). */
  function escolherDestino(chave: string, valor: string) {
    setDestinos((d) => ({ ...d, [chave]: valor }));
    if (!valor) return;
    setMarcadas((m) => {
      const n = new Set(m);
      n.add(chave);
      if (valor.startsWith(NOVA)) n.add(valor.slice(NOVA.length));
      return n;
    });
  }

  /** "Criar <texto>" no seletor: acrescenta uma tarefa nova à prévia e manda o registro para ela. */
  function criarTarefaPara(chaveRegistro: string, titulo: string) {
    const nova: PropostaTarefa = {
      chave: novoId("x"), tipo: "tarefa", ref: "", titulo, descricao: "", categoriaId: null, categoriaCitada: "", prioridade: 5, prazo: null, passos: [], trecho: "",
    };
    setLeitura((l) => (l ? { ...l, propostas: [nova, ...l.propostas] } : l));
    escolherDestino(chaveRegistro, NOVA + nova.chave);
  }

  // Um registro só pode ser aplicado se tiver destino; se o destino é uma tarefa nova, ela tem que estar marcada.
  const destinoValido = (chave: string) => {
    const d = destinos[chave];
    return !!d && (!d.startsWith(NOVA) || marcadas.has(d.slice(NOVA.length)));
  };
  const aplicaveis = propostas.filter((p) => marcadas.has(p.chave) && (p.tipo !== "registro" || destinoValido(p.chave)));

  async function aplicar() {
    if (!nota || aplicando || !aplicaveis.length) return;
    setAplicando(true);
    const frutos: FrutoDaNota[] = [];
    const feitas = new Set<string>();
    const textoInteiro = levaTextoInteiro(aplicaveis);
    // 1. tarefas novas, para os registros já terem onde entrar
    const criadas = new Map<string, Tarefa>();
    for (const p of aplicaveis) {
      if (p.tipo !== "tarefa") continue;
      const temRegistros = aplicaveis.some((r) => r.tipo === "registro" && destinos[r.chave] === NOVA + p.chave);
      const t = await criarTarefa(tarefaDaProposta(p, nota, { textoInteiro, temRegistros }));
      if (t) { criadas.set(p.chave, t); frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
    }
    // 2. registros e passos concluídos
    for (const p of aplicaveis) {
      if (p.tipo === "registro") {
        const d = destinos[p.chave];
        const idTarefa = d.startsWith(NOVA) ? criadas.get(d.slice(NOVA.length))?.id : d;
        if (!idTarefa) continue; // a tarefa nova não foi criada: o registro fica na prévia
        const registro = registroDaProposta(p, nota, { textoInteiro, data: datas[p.chave] });
        const t = await atualizarTarefa(idTarefa, (x) => comRegistroDaNota(x, registro));
        if (t) { frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
      } else if (p.tipo === "passo_concluido") {
        const t = await atualizarTarefa(p.tarefaId, (x) => comPassoAlternado(x, p.registroId, p.passoId, true));
        if (t) { frutos.push(frutoDe(p, t)); feitas.add(p.chave); }
      }
    }
    const falhas = aplicaveis.length - feitas.size;
    const guardar = arquivar && falhas === 0;
    const agora = agoraISO();
    // As sobras que não foram guardadas numa tarefa ficam anotadas na folha, à vista.
    const sobraGuardada = propostas.some((p) => p.tipo === "registro" && p.origem === "sobras" && feitas.has(p.chave));
    const sobras = sobraGuardada ? "" : leitura?.sobras ?? "";
    if (frutos.length)
      await salvarNotas((items) =>
        items.map((n) =>
          n.id === nota.id ? { ...n, gerou: [...(n.gerou ?? []), ...frutos], sobras, arquivadaEm: guardar ? agora : n.arquivadaEm, atualizadaEm: agora } : n,
        ),
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
                const semDestino = p.tipo === "registro" && !destinoValido(p.chave);
                const sobra = p.tipo === "registro" && p.origem === "sobras";
                return (
                  <article key={p.chave} data-slot="proposta" data-tipo={sobra ? "sobras" : p.tipo}
                    className={cn("flex gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-xs transition-opacity", sobra && "border-dashed", !marcada && "opacity-70")}>
                    <Checkbox checked={marcada && !semDestino} disabled={semDestino} onCheckedChange={(v) => alternar(p.chave, v === true)} className="mt-0.5"
                      aria-label={marcada ? "Não aplicar este item" : "Aplicar este item"} />
                    <div className="min-w-0 flex-1">
                      {p.tipo === "registro" && (
                        <>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {sobra ? <Badge variant="alerta">Não coube em nenhum item</Badge> : <TipoBadge tipo={p.registro.tipo} />}
                            {!sobra && <span className="min-w-0 text-[13px] font-medium">{p.registro.titulo || "Sem título"}</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="text-[11px] text-muted-foreground sem-selecao">{sobra ? "Guardar como nota em" : "Entra em"}</span>
                            <Combobox
                              aria-label={sobra ? "Tarefa que guarda estas anotações" : "Tarefa que recebe este registro"}
                              valor={destinos[p.chave] ?? ""}
                              aoMudar={(v) => escolherDestino(p.chave, v)}
                              opcoes={opcoesTarefa}
                              permitirLimpar={false}
                              placeholder="Escolha a tarefa..."
                              buscaPlaceholder="Buscar tarefa ou digitar o nome de uma nova..."
                              vazio="Nenhuma tarefa aberta com esse nome."
                              criar={(texto) => criarTarefaPara(p.chave, texto)}
                              className="h-7 max-w-full min-w-0 flex-1 basis-56 text-xs"
                            />
                            {!sobra && (
                              <>
                                <span className="text-[11px] text-muted-foreground sem-selecao">em</span>
                                <SeletorData compacto limpavel={false} valor={datas[p.chave] ?? p.registro.data}
                                  aoMudar={(v) => v && setDatas((d) => ({ ...d, [p.chave]: v }))}
                                  aria-label="Data em que aconteceu" className={cn("h-7 text-xs", p.semData && "text-alerta")} />
                              </>
                            )}
                          </div>
                          {p.semData && !sobra && <p className="mt-1.5 text-[11px] leading-snug text-alerta">As notas não dizem quando foi. Coloquei hoje: ajuste a data se aconteceu antes.</p>}
                          {p.duvida && <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-alerta"><TriangleAlert className="mt-px size-3 shrink-0" /> {p.duvida}</p>}
                          {sobra && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Se deixar desmarcado, isto fica anotado na folha arquivada, em destaque.</p>}
                          {p.registro.participantes.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Com {p.registro.participantes.join(", ")}</p>}
                          {p.registro.resumoIA && <p className="mt-1.5 text-[13px] leading-snug texto-pre">{p.registro.resumoIA}</p>}
                          {sobra && <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground texto-pre">{p.trecho}</p>}
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
