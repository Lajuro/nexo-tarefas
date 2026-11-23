"use client";

// Cadastrar a pessoa direto do campo de participantes (3.17).
//
// O participante continua sendo um nome escrito no registro: é texto livre de propósito, para a reunião não
// travar em cadastro. O que mudou é que, ao lado do campo, os nomes que ainda não estão no cadastro de pessoas
// aparecem com um "+": um clique grava a pessoa só com o nome (a regra da 3.16: o que nasce num campo nasce com
// o mínimo), e o aviso leva ao cadastro completo. Antes era preciso salvar o registro, ir à tela de Pessoas e
// achar o nome na lista de "sem cadastro".
//
// A ligação entre o nome do registro e a pessoa continua sendo feita na leitura (lib/pessoas.ts): nada é
// reescrito nas tarefas.

import { useCallback, useState } from "react";
import { toast as sonner } from "sonner";
import { LoaderCircle, UserRoundPlus } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { pedirCriar } from "@/components/criar-evento";
import { Dica } from "@/components/ui/popover";
import { acharPessoa, nomeParaCadastro, nomesSemCadastro } from "@/lib/pessoas";
import { agoraISO, normalizarPessoa, novoId } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/**
 * Cadastra uma pessoa só com o nome e devolve o id (null se não deu para gravar ou se o nome não serve).
 * Nome que já identifica alguém do cadastro (nome, apelido ou e-mail) devolve a pessoa que existe, sem duplicar.
 */
export function useCadastrarPessoa() {
  const { dadosAtuais, salvarPessoas } = useNexo();
  return useCallback(
    async (bruto: string): Promise<string | null> => {
      const nome = nomeParaCadastro(bruto);
      if (!nome) return null;
      const igual = acharPessoa(dadosAtuais()?.pessoas?.items ?? [], nome);
      if (igual) return igual.id;
      const agora = agoraISO();
      const nova = normalizarPessoa({ id: novoId("pe"), nome, origem: "registros", criadaEm: agora, atualizadaEm: agora });
      if (!(await salvarPessoas((items) => [...items, nova]))) return null;
      sonner.success(`${nome} agora está no cadastro de pessoas.`, {
        duration: 6000,
        action: { label: "Completar cadastro", onClick: () => pedirCriar("pessoa", { id: nova.id }) },
      });
      return nova.id;
    },
    [dadosAtuais, salvarPessoas],
  );
}

/** A linha "Sem cadastro: + Fulano + Beltrano" que vai embaixo de um campo de participantes. Some quando todos estão no cadastro. */
export function SemCadastro({ nomes, className }: { nomes: readonly string[]; className?: string }) {
  const { dados, estado } = useNexo();
  const cadastrar = useCadastrarPessoa();
  const [fazendo, setFazendo] = useState<string | null>(null);
  const colecao = dados?.pessoas;
  // arquivo de pessoas ilegível (rev -1) ou dados somente leitura: não oferece o que não daria para gravar
  if (!dados || estado?.somenteLeitura || (colecao?.rev ?? 0) < 0) return null;
  const soltos = nomesSemCadastro(colecao?.items ?? [], nomes);
  if (!soltos.length) return null;

  return (
    <div data-slot="sem-cadastro" className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="sem-selecao">Sem cadastro:</span>
      {soltos.map((nome) => (
        <Dica key={nome} texto={`Pôr ${nome} no cadastro de pessoas`}>
          <button
            type="button"
            data-slot="cadastrar-participante"
            data-nome={nome}
            disabled={fazendo !== null}
            aria-label={`Cadastrar ${nome}`}
            onClick={async () => {
              setFazendo(nome);
              await cadastrar(nome);
              setFazendo(null);
            }}
            className="inline-flex h-6 max-w-48 items-center gap-1 rounded-md border border-dashed border-input px-1.5 font-medium text-foreground outline-none transition-colors hover:border-ring/50 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:opacity-60"
          >
            {fazendo === nome ? <LoaderCircle className="size-3 shrink-0 animate-spin" /> : <UserRoundPlus className="size-3 shrink-0 text-muted-foreground" />}
            <span className="truncate">{nome}</span>
          </button>
        </Dica>
      ))}
    </div>
  );
}
