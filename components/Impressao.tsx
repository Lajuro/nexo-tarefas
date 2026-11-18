"use client";

// Imprimir ou salvar em PDF (3.8): uma folha limpa da tarefa ou da categoria, para mandar ao gestor sem
// depender de nada além do navegador ("Salvar como PDF" é o destino de impressão do próprio Edge/Chrome).
// pedirImpressao() de qualquer lugar; o componente <Impressao/> fica montado no Shell, põe a folha direto no
// <body> só durante a impressão e o CSS de app/globals.css (@media print) esconde todo o resto.
// Também copia a tarefa em Markdown (o mesmo texto do espelho em markdown/).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNexo } from "./Provider";
import { TextoRico } from "./tarefa/Texto";
import { copiarTexto } from "./comum";
import { aberta } from "@/lib/lembretes";
import { tarefaParaMarkdown } from "@/lib/markdown";
import { type Categoria, type Tarefa, formatarData, hojeISO, nomeStatus, ordenarRegistros, passosAbertos, tipoInfo } from "@/lib/tipos";

type Pedido = { tipo: "tarefa" | "categoria"; id: string };
const EVENTO = "nexo:imprimir";

export const pedirImpressao = (p: Pedido) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: p }));

/** Copia a tarefa em Markdown (cabeçalho, linha do tempo e passos), pronto para colar num e-mail ou num .md. */
export async function copiarTarefaEmMarkdown(t: Tarefa, categoria?: Categoria | null) {
  return copiarTexto(tarefaParaMarkdown(t, categoria?.nome).replace(/\]\(\.\.\/arquivos\//g, "](arquivos/"));
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="w-36 py-0.5 pr-3 text-left align-top font-medium">{rotulo}</th>
      <td className="py-0.5 align-top">{children}</td>
    </tr>
  );
}

function FolhaDaTarefa({ t, cat }: { t: Tarefa; cat?: Categoria | null }) {
  const abertos = passosAbertos(t);
  const registros = ordenarRegistros(t.registros);
  return (
    <article>
      <h1 className="text-2xl font-semibold">{t.titulo}</h1>
      <table className="mt-3 text-[13px]">
        <tbody>
          <Linha rotulo="Categoria">{cat?.nome ?? "Sem categoria"}</Linha>
          <Linha rotulo="Status">{nomeStatus(t.status)}</Linha>
          <Linha rotulo="Prioridade">{t.prioridade} de 10</Linha>
          {t.prazo && <Linha rotulo="Prazo">{formatarData(t.prazo)}</Linha>}
          {t.esperando && <Linha rotulo="Esperando">{[t.esperando.quem, t.esperando.oQue].filter(Boolean).join(": ")}</Linha>}
          {t.tags.length > 0 && <Linha rotulo="Tags">{t.tags.join(", ")}</Linha>}
          <Linha rotulo="Criada em">{formatarData(t.criadaEm)}</Linha>
        </tbody>
      </table>
      {t.descricao && <section className="mt-4"><TextoRico texto={t.descricao} className="text-[13px]" /></section>}
      {abertos.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 text-base font-semibold">Próximos passos em aberto</h2>
          <ul className="list-disc pl-5 text-[13px]">
            {abertos.map(({ passo }) => <li key={passo.id}>{passo.texto}{passo.responsavel ? ` (${passo.responsavel})` : ""}{passo.prazo ? `, até ${formatarData(passo.prazo)}` : ""}</li>)}
          </ul>
        </section>
      )}
      <section className="mt-5">
        <h2 className="mb-2 text-base font-semibold">Linha do tempo</h2>
        {registros.map((r) => (
          <div key={r.id} className="mb-3 break-inside-avoid border-l-2 pl-3">
            <h3 className="text-[13px] font-semibold">
              {formatarData(r.data)}{r.hora ? ` ${r.hora}` : ""} · {tipoInfo(r.tipo).nome}{r.titulo ? `: ${r.titulo}` : ""}
            </h3>
            {r.participantes.length > 0 && <p className="text-[12px]">Com: {r.participantes.join(", ")}</p>}
            {r.resumoIA && <TextoRico texto={r.resumoIA} className="text-[12.5px]" />}
            {!r.resumoIA && r.anotacoes && <TextoRico texto={r.anotacoes} className="text-[12.5px]" />}
            {r.decisoes && <div className="mt-1 text-[12.5px]"><strong>Decisões:</strong> <TextoRico texto={r.decisoes} /></div>}
            {r.proximosPassos.length > 0 && (
              <ul className="mt-1 text-[12.5px]">
                {r.proximosPassos.map((p) => <li key={p.id}>{p.feito ? "☑" : "☐"} {p.texto}{p.responsavel ? ` (${p.responsavel})` : ""}</li>)}
              </ul>
            )}
            {r.impedimentos && <div className="mt-1 text-[12.5px]"><strong>Impedimentos:</strong> <TextoRico texto={r.impedimentos} /></div>}
          </div>
        ))}
      </section>
    </article>
  );
}

function FolhaDaCategoria({ cat, tarefas }: { cat: Categoria; tarefas: Tarefa[] }) {
  const abertas = tarefas.filter(aberta).sort((a, b) => b.prioridade - a.prioridade);
  const fechadas = tarefas.filter((t) => !aberta(t)).sort((a, b) => (b.concluidaEm ?? "").localeCompare(a.concluidaEm ?? "")).slice(0, 30);
  const referencias = tarefas.flatMap((t) => t.registros.filter((r) => r.referencia).map((r) => ({ t, r })));
  return (
    <article>
      <h1 className="text-2xl font-semibold">{cat.nome}</h1>
      {cat.descricao && <TextoRico texto={cat.descricao} className="mt-2 text-[13px]" />}
      <p className="mt-2 text-[12px]">{abertas.length} {abertas.length === 1 ? "tarefa aberta" : "tarefas abertas"} · {tarefas.length - abertas.length} encerradas</p>
      <section className="mt-5">
        <h2 className="mb-2 text-base font-semibold">Tarefas abertas</h2>
        {abertas.length === 0 && <p className="text-[13px]">Nenhuma.</p>}
        {abertas.map((t) => {
          const prox = passosAbertos(t)[0]?.passo.texto;
          return (
            <div key={t.id} className="mb-2 break-inside-avoid">
              <h3 className="text-[13px] font-semibold">{t.titulo}</h3>
              <p className="text-[12px]">
                {nomeStatus(t.status)} · prioridade {t.prioridade}{t.prazo ? ` · prazo ${formatarData(t.prazo)}` : ""}
                {t.esperando ? ` · esperando ${[t.esperando.quem, t.esperando.oQue].filter(Boolean).join(": ")}` : ""}
              </p>
              {prox && <p className="text-[12px]">Próximo passo: {prox}</p>}
            </div>
          );
        })}
      </section>
      {referencias.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-base font-semibold">Referência do assunto</h2>
          {referencias.map(({ t, r }) => (
            <div key={r.id} className="mb-3 break-inside-avoid">
              <h3 className="text-[13px] font-semibold">{r.titulo || tipoInfo(r.tipo).nome} <span className="font-normal">({t.titulo}, {formatarData(r.data)})</span></h3>
              <TextoRico texto={r.resumoIA || r.anotacoes} className="text-[12.5px]" />
            </div>
          ))}
        </section>
      )}
      {fechadas.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-base font-semibold">Encerradas</h2>
          <ul className="list-disc pl-5 text-[12.5px]">
            {fechadas.map((t) => <li key={t.id}>{t.titulo} ({nomeStatus(t.status).toLowerCase()}{t.concluidaEm ? ` em ${formatarData(t.concluidaEm)}` : ""})</li>)}
          </ul>
        </section>
      )}
    </article>
  );
}

export function Impressao() {
  const { dados } = useNexo();
  const [pedido, setPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => setPedido((e as CustomEvent<Pedido>).detail ?? null);
    const depois = () => setPedido(null);
    window.addEventListener(EVENTO, abrir);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener(EVENTO, abrir);
      window.removeEventListener("afterprint", depois);
    };
  }, []);

  // a folha precisa estar desenhada antes de o navegador abrir a janela de impressão
  useEffect(() => {
    if (!pedido) return;
    // papel é claro: no tema escuro, a folha sai com as cores do tema claro e o tema volta depois
    const html = document.documentElement;
    const escuro = html.classList.contains("dark");
    const t = setTimeout(() => {
      if (escuro) html.classList.remove("dark");
      window.print();
    }, 150);
    const voltar = () => { if (escuro) html.classList.add("dark"); };
    window.addEventListener("afterprint", voltar, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", voltar);
      voltar();
    };
  }, [pedido]);

  if (!pedido || !dados) return null;
  const cats = dados.categorias.items;
  let folha: React.ReactNode = null;
  if (pedido.tipo === "tarefa") {
    const t = dados.tarefas.find((x) => x.id === pedido.id);
    if (t) folha = <FolhaDaTarefa t={t} cat={cats.find((c) => c.id === t.categoriaId)} />;
  } else {
    const cat = cats.find((c) => c.id === pedido.id);
    if (cat) folha = <FolhaDaCategoria cat={cat} tarefas={dados.tarefas.filter((t) => t.categoriaId === cat.id)} />;
  }
  if (!folha) return null;
  return createPortal(
    <div data-impressao className="folha-de-impressao">
      {folha}
      <p className="mt-6 text-xs">Gerado pelo Nexo em {formatarData(hojeISO())}.</p>
    </div>,
    document.body,
  );
}
