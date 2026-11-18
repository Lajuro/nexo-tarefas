"use client";

// "Falar com Fulano": anotar de qualquer tela um assunto para a próxima conversa com alguém
// (pedirAssunto(), janela montada uma vez no Shell) e o painel da pessoa com a lista do que levar.
// Os assuntos também entram na pauta do modo reunião quando a pessoa participa (lib/reuniao.ts).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, MessagesSquare, Plus } from "lucide-react";
import { useNexo } from "./Provider";
import { useFecharComCuidado } from "./Raiz";
import { oferecerDesfazer } from "./desfazer";
import { Campo, ItemPasso, Modal, Painel, copiarTexto } from "./comum";
import { Button } from "@/components/ui/button";
import { CampoSugestoes } from "@/components/ui/chips";
import { Combobox } from "@/components/ui/command";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { assuntoNovo, assuntosCom, comAssuntoResolvido } from "@/lib/assuntos";
import { aberta, dataLocal } from "@/lib/lembretes";
import { nomesConhecidos } from "@/lib/pessoas";
import { dataCurta } from "@/lib/tipos";

type Pedido = { pessoa?: string; tarefaId?: string | null };
const EVENTO = "nexo:assunto";

/** Abre a janela "Falar com..." de qualquer lugar. */
export const pedirAssunto = (p: Pedido = {}) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));

export function JanelaAssunto() {
  const { dados, salvarAssuntos, toast } = useNexo();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pessoa, setPessoa] = useState("");
  const [texto, setTexto] = useState("");
  const [tarefaId, setTarefaId] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const abrir = (e: Event) => {
      const p = (e as CustomEvent<Pedido>).detail ?? {};
      setPedido(p);
      setPessoa(p.pessoa ?? "");
      setTexto("");
      setTarefaId(p.tarefaId ?? "");
      setSalvando(false);
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const nomes = useMemo(() => (dados ? nomesConhecidos(dados) : []), [dados]);
  const opcoes = useMemo(
    () => (dados?.tarefas ?? []).filter(aberta).sort((a, b) => b.prioridade - a.prioridade).map((t) => ({ valor: t.id, rotulo: t.titulo })),
    [dados?.tarefas],
  );
  const fechar = () => setPedido(null);
  const tentarFechar = useFecharComCuidado(!!pedido && !!texto.trim(), fechar);
  const pode = !!pessoa.trim() && !!texto.trim() && !salvando;

  const salvar = async () => {
    if (!pode) return;
    setSalvando(true);
    const novo = assuntoNovo(pessoa, texto, tarefaId || null);
    const ok = await salvarAssuntos((items) => [...items, novo]);
    setSalvando(false);
    if (!ok) return;
    toast(`Anotado para falar com ${novo.pessoa}. Aparece na página dela e na pauta da próxima reunião com ela.`);
    fechar();
  };

  return (
    <Modal
      aberto={!!pedido}
      fechar={tentarFechar}
      titulo="Falar com alguém"
      descricao="Um assunto para levar na próxima conversa. Fica na página da pessoa e entra na pauta do modo reunião quando ela participa."
      rodape={<><Button variant="outline" onClick={tentarFechar}>Cancelar</Button><Button data-slot="salvar-assunto" disabled={!pode} onClick={salvar}>{salvando ? "Salvando..." : "Anotar"}</Button></>}
    >
      <div data-slot="form-assunto" className="flex flex-col gap-3"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void salvar(); } }}>
        <Campo rotulo="Com quem">
          <CampoSugestoes autoFocus={!pedido?.pessoa} valor={pessoa} aoMudar={setPessoa} sugestoes={nomes} placeholder="Nome" aria-label="Com quem falar" maxLength={120} />
        </Campo>
        <Campo rotulo="Sobre o quê">
          <Textarea autoFocus={!!pedido?.pessoa} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000}
            placeholder="Ex.: pedir a lista de squads que vão entrar no próximo ciclo" aria-label="Assunto" />
        </Campo>
        <Campo rotulo="Tarefa (opcional)">
          <Combobox valor={tarefaId} aoMudar={setTarefaId} opcoes={opcoes} placeholder="Nenhuma" rotuloLimpar="Nenhuma" aria-label="Tarefa do assunto" buscaPlaceholder="Buscar tarefa..." />
        </Campo>
      </div>
    </Modal>
  );
}

/** Painel da página da pessoa: o que levar na próxima conversa, com marcar como tratado e anotar mais. */
export function PainelFalarCom({ nome }: { nome: string }) {
  const { dados, salvarAssuntos, toast } = useNexo();
  const [novo, setNovo] = useState("");
  const [verTratados, setVerTratados] = useState(false);
  const todos = useMemo(() => (dados ? assuntosCom(dados, nome, true) : []), [dados, nome]);
  const abertos = todos.filter((a) => !a.resolvidoEm);
  const tratados = todos.filter((a) => a.resolvidoEm).reverse().slice(0, 10);
  const tarefa = (id?: string | null) => (id ? dados?.tarefas.find((t) => t.id === id) : undefined);
  const primeiro = nome.split(" ")[0];

  const anotar = async () => {
    const t = novo.trim();
    if (!t) return;
    if (await salvarAssuntos((items) => [...items, assuntoNovo(nome, t)])) setNovo("");
  };
  const marcar = async (id: string, feito: boolean) => {
    if (!(await salvarAssuntos((items) => comAssuntoResolvido(items, [id], feito)))) return;
    if (feito) oferecerDesfazer("Marcado como tratado.", () => salvarAssuntos((items) => comAssuntoResolvido(items, [id], false)), { tipo: "info" });
  };
  const copiar = async () => {
    const txt = [`Para falar com ${nome}:`, ...abertos.map((a) => `- ${a.texto}${tarefa(a.tarefaId) ? ` [${tarefa(a.tarefaId)!.titulo}]` : ""}`)].join("\n");
    if (await copiarTexto(txt)) toast("Lista copiada.", "info");
  };

  return (
    <Painel
      titulo={`Para falar com ${primeiro}`}
      icone={<MessagesSquare />}
      contagem={abertos.length || undefined}
      corpoClassName="flex flex-col gap-1 py-2.5"
      acoes={abertos.length > 0 && (
        <Dica texto="Copiar a lista"><Button variant="ghost" size="icon-sm" aria-label="Copiar a lista de assuntos" onClick={copiar}><Copy /></Button></Dica>
      )}
    >
      <div data-slot="falar-com">
        {abertos.map((a) => (
          <ItemPasso key={a.id} texto={a.texto} feito={false} aoAlternar={(f) => void marcar(a.id, f)}
            meta={tarefa(a.tarefaId) ? <Link href={`/tarefas/${a.tarefaId}`} className="hover:underline">{tarefa(a.tarefaId)!.titulo}</Link> : <>desde {dataCurta(a.criadoEm)}</>} />
        ))}
        {abertos.length === 0 && <p className="mb-1 text-xs text-muted-foreground">Nada anotado para a próxima conversa com {primeiro}.</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={1000} aria-label={`Novo assunto para falar com ${nome}`}
          placeholder="Anotar um assunto... Enter guarda" className="h-8"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void anotar(); } }} />
        <Button variant="outline" size="icon-sm" aria-label="Anotar assunto" disabled={!novo.trim()} onClick={() => void anotar()}><Plus /></Button>
      </div>
      {tratados.length > 0 && (
        <button type="button" className="mt-1 self-start text-xs text-muted-foreground hover:underline" onClick={() => setVerTratados((v) => !v)}>
          {verTratados ? "Esconder os tratados" : `Ver os ${tratados.length} tratados por último`}
        </button>
      )}
      {verTratados && tratados.map((a) => (
        <ItemPasso key={a.id} texto={a.texto} feito aoAlternar={(f) => void marcar(a.id, f)}
          meta={<>tratado em {dataCurta(a.resolvidoEm)}</>} />
      ))}
    </Painel>
  );
}
