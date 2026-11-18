"use client";

// Escolher uma categoria criando a que falta, sem sair de onde se está (3.16).
//
// Antes, só o formulário de nova tarefa criava categoria na hora; nos outros seletores (link, página, modelo,
// pessoa, time, a categoria da tarefa trocada no lugar, as ações em lote) era preciso largar o que se fazia,
// ir à tela de Categorias, criar e voltar. Aqui estão as peças que todos eles usam:
//   - useCriarCategoria(): grava a categoria nova (pela gravação normal, com rev) e devolve o id;
//   - useOpcoesDeCategoria(): as categorias como opções de seletor, com a bolinha de cor;
//   - SeletorCategoria: o campo de formulário (uma categoria) que busca, escolhe e cria.
// A categoria nasce com o nome e a próxima cor da paleta; o aviso tem "Cor e descrição" para quem quiser ajustar.

import { useCallback, useMemo } from "react";
import { toast as sonner } from "sonner";
import { useNexo } from "@/components/Provider";
import { PontoCor } from "@/components/comum";
import { pedirCriar } from "@/components/criar-evento";
import { ComboCategoria } from "@/components/tarefas/ComboCategoria";
import type { OpcaoCombo } from "@/components/ui/command";
import { CORES, type Categoria, agoraISO, normalizarCategoria, novoId, semAcento } from "@/lib/tipos";

/** O nome como é guardado: uma linha, sem espaço sobrando, até 60 caracteres (o teto do formulário). */
export const nomeDeCategoria = (bruto: string) => bruto.replace(/\s+/g, " ").trim().slice(0, 60);

/**
 * Cria uma categoria só com o nome e devolve o id (null se não deu para gravar).
 * Se já existe uma com esse nome (sem contar acento e maiúsculas), devolve a que existe em vez de duplicar.
 */
export function useCriarCategoria() {
  const { dadosAtuais, salvarCategorias } = useNexo();
  return useCallback(
    async (bruto: string): Promise<string | null> => {
      const nome = nomeDeCategoria(bruto);
      if (!nome) return null;
      const atuais = dadosAtuais()?.categorias.items ?? [];
      const igual = atuais.find((c) => semAcento(c.nome.trim()) === semAcento(nome));
      if (igual) return igual.id;
      const agora = agoraISO();
      const nova = normalizarCategoria({ id: novoId("c"), nome, descricao: "", cor: CORES[atuais.length % CORES.length], criadaEm: agora, atualizadaEm: agora });
      if (!(await salvarCategorias((items) => [...items, nova]))) return null;
      sonner.success(`Categoria “${nome}” criada.`, {
        duration: 6000,
        action: { label: "Cor e descrição", onClick: () => pedirCriar("categoria", { id: nova.id }) },
      });
      return nova.id;
    },
    [dadosAtuais, salvarCategorias],
  );
}

/** A categoria como opção de seletor (bolinha de cor e nome). */
export const opcaoDeCategoria = (c: Categoria): OpcaoCombo => ({
  valor: c.id,
  rotulo: c.nome,
  detalhe: c.arquivada ? "arquivada" : undefined,
  render: (
    <>
      <PontoCor cor={c.cor} />
      <span className="truncate">{c.nome}</span>
    </>
  ),
});

/** As categorias ativas (mais as escolhidas, mesmo arquivadas) em ordem alfabética, como opções. */
export function useOpcoesDeCategoria(escolhidas: readonly (string | null | undefined)[] = []): OpcaoCombo[] {
  const { dados } = useNexo();
  const chave = escolhidas.filter(Boolean).join("|");
  return useMemo(
    () => {
      const manter = new Set(chave ? chave.split("|") : []);
      return (dados?.categorias.items ?? [])
        .filter((c) => !c.arquivada || manter.has(c.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map(opcaoDeCategoria);
    },
    [dados?.categorias.items, chave],
  );
}

/** Campo de categoria para formulários e faixas de propriedades: busca, escolhe e cria na hora. "" = sem categoria. */
export function SeletorCategoria({
  valor, aoMudar, placeholder = "Sem categoria", rotuloVazio = "Sem categoria", className, id, "aria-label": ariaLabel = "Categoria",
}: {
  valor: string;
  aoMudar: (id: string) => void;
  placeholder?: string;
  rotuloVazio?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const opcoes = useOpcoesDeCategoria([valor]);
  const criar = useCriarCategoria();
  return (
    <ComboCategoria valor={valor} aoMudar={aoMudar} opcoes={opcoes} placeholder={placeholder} rotuloVazio={rotuloVazio}
      className={className} id={id} aria-label={ariaLabel}
      aoCriar={(nome) => void criar(nome).then((novo) => { if (novo) aoMudar(novo); })} />
  );
}
