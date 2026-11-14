"use client";

// Modelos de tarefa: para demandas que se repetem (ex.: levar a mesma ferramenta para mais um squad).
//   pedirModelo({ tarefaId })  → "Salvar como modelo" a partir de uma tarefa
//   pedirModelo({ modeloId })  → editar um modelo
//   pedirModelo({})            → modelo em branco
// A janela fica montada uma vez no Shell. O painel de Configurações lista, usa, edita e exclui.

import { useEffect, useMemo, useState } from "react";
import { CopyPlus, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import { useNexo } from "./Provider";
import { useConfirmar, useFecharComCuidado } from "./Raiz";
import { Campo, ChipsInput, LinhaCampos, Modal, Painel, PontoCor, SeletorPrioridade, Vazio } from "./comum";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/command";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { modeloDaTarefa, passosDoTexto, porUso } from "@/lib/modelos";
import { Modelo, agoraISO, normalizarModelo, novoId } from "@/lib/tipos";

type Pedido = { tarefaId?: string; modeloId?: string };
const EVENTO = "nexo:modelo";
export const pedirModelo = (p: Pedido = {}) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function ModeloForm() {
  const { dados, salvarModelos, toast } = useNexo();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [base, setBase] = useState<Modelo | null>(null);
  const [nome, setNome] = useState("");
  const [quando, setQuando] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [prioridade, setPrioridade] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [passos, setPassos] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const abrir = (e: Event) => setPedido((e as CustomEvent<Pedido>).detail ?? {});
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  // Ao abrir, monta o ponto de partida uma vez (não a cada mudança nos dados, para não apagar o que está sendo digitado).
  useEffect(() => {
    if (!pedido) return;
    const existente = pedido.modeloId ? dados?.modelos?.items.find((m) => m.id === pedido.modeloId) : undefined;
    const tarefa = pedido.tarefaId ? dados?.tarefas.find((t) => t.id === pedido.tarefaId) : undefined;
    const m = existente ?? (tarefa ? modeloDaTarefa(tarefa) : normalizarModelo({ id: novoId("mo"), nome: "" }));
    setBase(m);
    setNome(m.nome);
    setQuando(m.quando);
    setTitulo(m.titulo);
    setDescricao(m.descricao);
    setCategoriaId(m.categoriaId ?? "");
    setPrioridade(m.prioridade);
    setTags(m.tags);
    setPassos(m.passos.join("\n"));
    setPrazo(m.prazoEmDias ? String(m.prazoEmDias) : "");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const editando = !!pedido?.modeloId;
  const aberto = !!pedido && !!base;
  const fechar = () => setPedido(null);
  const sujo = aberto && (
    nome !== base!.nome || quando !== base!.quando || titulo !== base!.titulo || descricao !== base!.descricao ||
    passos !== base!.passos.join("\n") || tags.join("\n") !== base!.tags.join("\n")
  );
  const tentarFechar = useFecharComCuidado(sujo, fechar);

  const categorias = useMemo(
    () =>
      (dados?.categorias.items ?? [])
        .filter((c) => !c.arquivada || c.id === categoriaId)
        .map((c) => ({ valor: c.id, rotulo: c.nome, render: <><PontoCor cor={c.cor} /><span className="truncate">{c.nome}</span></> })),
    [dados?.categorias.items, categoriaId],
  );
  const todasTags = useMemo(() => [...new Set((dados?.tarefas ?? []).flatMap((t) => t.tags))].sort(), [dados?.tarefas]);
  const listaPassos = passosDoTexto(passos);

  async function salvar() {
    if (!base || !nome.trim() || salvando) return;
    setSalvando(true);
    const dias = Number(prazo);
    const agora = agoraISO();
    const novo = normalizarModelo({
      ...base,
      nome: nome.trim(),
      quando: quando.trim(),
      titulo: titulo.trim(),
      descricao,
      categoriaId: categoriaId || null,
      prioridade,
      tags,
      passos: listaPassos,
      prazoEmDias: Number.isFinite(dias) && dias > 0 ? dias : null,
      atualizadoEm: agora,
    });
    const ok = await salvarModelos((items) => (items.some((m) => m.id === novo.id) ? items.map((m) => (m.id === novo.id ? { ...m, ...novo } : m)) : [...items, novo]));
    setSalvando(false);
    if (!ok) return;
    toast(editando ? "Modelo atualizado." : "Modelo salvo. Ele aparece em “Nova tarefa”.");
    fechar();
  }

  return (
    <Modal
      aberto={aberto}
      fechar={tentarFechar}
      titulo={editando ? "Editar modelo" : pedido?.tarefaId ? "Salvar como modelo" : "Novo modelo de tarefa"}
      descricao="Para demandas que se repetem. Ao criar uma tarefa pelo modelo, tudo isto já vem preenchido."
      className="max-w-[620px]"
      rodape={
        <>
          <Button variant="outline" onClick={tentarFechar}>Cancelar</Button>
          <Button data-slot="salvar-modelo" onClick={salvar} disabled={salvando || !nome.trim()}>{salvando ? "Salvando..." : "Salvar modelo"}</Button>
        </>
      }
    >
      <div
        data-slot="form-modelo"
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            salvar();
          }
        }}
      >
        <LinhaCampos>
          <Campo rotulo="Nome do modelo">
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Levar a Ferramenta X para um squad" aria-label="Nome do modelo" maxLength={200} />
          </Campo>
          <Campo rotulo="Quando usar" dica="Uma frase para você reconhecer o modelo depois.">
            <Input value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Ex.: sempre que um squad novo entrar" aria-label="Quando usar" maxLength={200} />
          </Campo>
        </LinhaCampos>

        <Campo rotulo="Título sugerido para a tarefa" dica="Vem preenchido na tarefa nova. Você só completa o que muda (o nome do squad, por exemplo).">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Onboarding do squad ... na Ferramenta X" aria-label="Título sugerido" maxLength={300} />
        </Campo>

        <Campo rotulo="Passos de sempre" dica="Um por linha. Entram na tarefa nova como próximos passos em aberto." lado={<span className="text-[11px] text-muted-foreground tabular-nums">{plural(listaPassos.length, "passo", "passos")}</span>}>
          <Textarea rows={6} value={passos} onChange={(e) => setPassos(e.target.value)} aria-label="Passos de sempre"
            placeholder={"Agendar a conversa de abertura\nPedir os acessos\nRodar a primeira análise"} />
        </Campo>

        <LinhaCampos>
          <Campo rotulo="Categoria">
            <Combobox valor={categoriaId} aoMudar={setCategoriaId} opcoes={categorias} placeholder="Sem categoria" rotuloLimpar="Sem categoria" aria-label="Categoria do modelo" />
          </Campo>
          <Campo rotulo="Prazo sugerido" dica="Em dias a partir do dia em que a tarefa nasce. Vazio = sem prazo.">
            <Input value={prazo} onChange={(e) => setPrazo(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Ex.: 30" aria-label="Prazo sugerido em dias" />
          </Campo>
        </LinhaCampos>

        <Campo rotulo={<>Prioridade: <span className="font-semibold text-foreground tabular-nums">{prioridade}</span></>} dica="1 = pode esperar · 10 = urgente">
          <SeletorPrioridade valor={prioridade} aoMudar={setPrioridade} />
        </Campo>

        <Campo rotulo="Tags">
          <ChipsInput valor={tags} mudar={setTags} sugestoes={todasTags} placeholder="Ex.: onboarding" />
        </Campo>

        <Campo rotulo="Descrição / objetivo">
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que esse tipo de demanda precisa entregar." aria-label="Descrição do modelo" />
        </Campo>
      </div>
    </Modal>
  );
}

/** Painel de Configurações: os modelos que existem, com usar, editar e excluir. */
export function PainelModelos({ usar }: { usar: (modeloId: string) => void }) {
  const { dados, salvarModelos, toast } = useNexo();
  const confirmar = useConfirmar();
  const modelos = useMemo(() => [...(dados?.modelos?.items ?? [])].sort(porUso), [dados?.modelos]);
  const cat = (id: string | null) => dados?.categorias.items.find((c) => c.id === id);

  const excluir = async (m: Modelo) => {
    const ok = await confirmar({
      titulo: "Excluir este modelo?",
      descricao: `“${m.nome}” deixa de aparecer em Nova tarefa. As tarefas que já nasceram dele continuam como estão. O modelo vai para a lixeira da pasta de dados.`,
      confirmar: "Excluir",
      perigo: true,
    });
    if (ok && (await salvarModelos((items) => items.filter((x) => x.id !== m.id)))) toast("Modelo excluído (foi para a lixeira da pasta de dados).", "info");
  };

  return (
    <Painel
      titulo="Modelos de tarefa"
      icone={<LayoutTemplate />}
      contagem={modelos.length || undefined}
      acoes={<Button variant="outline" size="sm" data-slot="novo-modelo" onClick={() => pedirModelo({})}><Plus /> Novo modelo</Button>}
      corpoClassName={modelos.length ? "p-1.5" : undefined}
    >
      {modelos.length === 0 ? (
        <Vazio compacto titulo="Nenhum modelo ainda" icone={<LayoutTemplate />} className="border-0">
          <p className="max-w-[52ch]">
            Tem demanda que se repete, sempre com os mesmos passos? Abra o menu de uma tarefa assim e escolha “Salvar como modelo”. Na próxima, ela já nasce pronta.
          </p>
        </Vazio>
      ) : (
        <ul className="flex flex-col">
          {modelos.map((m) => {
            const c = cat(m.categoriaId);
            return (
              <li key={m.id} data-slot="modelo" className="group/mo flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><LayoutTemplate className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.nome}</p>
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                    {c && <span className="inline-flex shrink-0 items-center gap-1"><PontoCor cor={c.cor} />{c.nome}</span>}
                    <span className="truncate">
                      {[m.quando, plural(m.passos.length, "passo", "passos"), m.usos ? `usado ${plural(m.usos, "vez", "vezes")}` : "ainda não usado"].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                </div>
                <Button size="sm" variant="outline" data-slot="usar-modelo" onClick={() => usar(m.id)}><CopyPlus /> Nova tarefa</Button>
                <Dica texto="Editar modelo">
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar o modelo ${m.nome}`} onClick={() => pedirModelo({ modeloId: m.id })}><Pencil /></Button>
                </Dica>
                <Dica texto="Excluir modelo">
                  <Button variant="ghost" size="icon-sm" aria-label={`Excluir o modelo ${m.nome}`} onClick={() => excluir(m)}><Trash2 /></Button>
                </Dica>
              </li>
            );
          })}
        </ul>
      )}
    </Painel>
  );
}
