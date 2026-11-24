"use client";

// Boas-vindas (3.22): a primeira conversa do Nexo com quem está chegando. Aparece uma vez, depois de a pasta de
// dados ser escolhida e enquanto ela está vazia, e faz três perguntas: como você trabalha (o perfil de uso), como
// você aparece (o nome da saudação e os nomes pelos quais é citado nos passos) e por onde começar (com os seus
// dados ou conhecendo um exemplo). Quem já usa o app nunca vê: a pasta dele não está vazia.
//
// Nada aqui grava dado: o perfil, os nomes e o "já vi" são preferências do navegador. O exemplo vive numa pasta
// separada (lib/armazenamento.ts). Fechar no meio vale como "pular": não aparece de novo.

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FlaskConical, FolderHeart } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Campo, ChipsInput, Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERFIS_PRONTOS, normalizarPerfis } from "@/lib/perfis";
import { usePref } from "@/lib/preferencias";
import { TAMANHO_DO_NOME, useTelaHoje } from "@/lib/tela-hoje";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { MiniaturaDoArranjo, iconeDoPerfil, trocarDePerfil } from "./Perfis";

const ETAPAS = ["Como você trabalha", "Como você aparece", "Por onde começar"] as const;

/** A tela de boas-vindas precisa aparecer? Só em pasta vazia, fora do exemplo, e uma vez por navegador. */
export function useBoasVindas() {
  const { estado, dados } = useNexo();
  const [visto, setVisto, carregado] = usePref<unknown>("boasVindas", "");
  const pastaVazia = !!dados && dados.tarefas.length === 0 && dados.categorias.items.length === 0;
  const mostrar = carregado && visto !== "feito" && pastaVazia && !!estado?.configurado && !estado.exemplo && !estado.somenteLeitura;
  return { mostrar, concluir: () => setVisto("feito") };
}

export function BoasVindas() {
  const { mostrar, concluir } = useBoasVindas();
  const { estado, entrarNoExemplo } = useNexo();
  const [etapa, setEtapa] = useState(0);
  const [, setPrimeirosPassos] = usePref<unknown>("primeirosPassos", "");
  const [perfisBrutos] = usePref<unknown>("perfis", null);
  const perfilEmUso = normalizarPerfis(perfisBrutos).ativo;
  const { telaHoje, mudarTelaHoje } = useTelaHoje();
  const [nome, setNome] = useState(telaHoje.nome);
  const [nomes, setNomes] = usePref<string[]>("meusNomes", []);
  const [abrindo, setAbrindo] = useState(false);
  useEffect(() => setNome(telaHoje.nome), [telaHoje.nome]);
  useEffect(() => {
    if (mostrar) setEtapa(0);
  }, [mostrar]);

  const meusNomes = Array.isArray(nomes) ? nomes : [];
  const semExemplo = estado?.origem === "env";

  // sair de qualquer jeito (terminar, pular, fechar) liga os primeiros passos e não mostra de novo
  const terminar = () => {
    mudarTelaHoje({ nome });
    setPrimeirosPassos("ativo");
    concluir();
  };
  const comExemplo = async () => {
    if (abrindo) return;
    setAbrindo(true);
    mudarTelaHoje({ nome });
    setPrimeirosPassos("ativo");
    const ok = await entrarNoExemplo();
    setAbrindo(false);
    if (ok) concluir();
  };
  const avancar = () => {
    if (etapa === 1) {
      mudarTelaHoje({ nome });
      // o nome da saudação também é um dos nomes pelos quais a pessoa aparece nos passos
      const limpo = nome.trim();
      if (limpo && !meusNomes.some((n) => n.toLowerCase() === limpo.toLowerCase())) setNomes([...meusNomes, limpo]);
    }
    setEtapa((e) => Math.min(ETAPAS.length - 1, e + 1));
  };

  return (
    <Modal
      titulo="Bem-vindo ao Nexo"
      descricao={`Três perguntas rápidas para o app começar do seu jeito. Passo ${etapa + 1} de ${ETAPAS.length}: ${ETAPAS[etapa].toLowerCase()}.`}
      aberto={mostrar}
      fechar={terminar}
      largo
      rodape={
        <>
          <Button variant="ghost" data-slot="boas-vindas-pular" className="mr-auto" onClick={terminar}>Pular</Button>
          {etapa > 0 && <Button variant="outline" onClick={() => setEtapa((e) => e - 1)}><ArrowLeft /> Voltar</Button>}
          {etapa < ETAPAS.length - 1 && <Button data-slot="boas-vindas-continuar" onClick={avancar}>Continuar <ArrowRight /></Button>}
        </>
      }
    >
      <div data-slot="boas-vindas" data-etapa={etapa} className="flex flex-col gap-4">
        <ol aria-hidden className="flex items-center gap-2 sem-selecao">
          <Logo tamanho={28} />
          {ETAPAS.map((nomeDaEtapa, i) => (
            <li key={nomeDaEtapa} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", i === etapa ? "border-primary/50 bg-primary/10 text-foreground" : "text-muted-foreground")}>
              <span className={cn("inline-flex size-4 items-center justify-center rounded-full text-[11px] tabular-nums", i < etapa ? "bg-sucesso/20 text-sucesso" : "bg-muted")}>{i < etapa ? <Check className="size-3" /> : i + 1}</span>
              <span className="hidden sm:inline">{nomeDaEtapa}</span>
            </li>
          ))}
        </ol>

        {etapa === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] leading-snug text-muted-foreground">
              Um perfil arruma o menu, as barras e a tela Hoje para um jeito de trabalhar. Suas tarefas são as mesmas em todos, e você troca quando quiser, pela tecla P.
            </p>
            <div role="radiogroup" aria-label="Perfil de uso" className="grid gap-2 sm:grid-cols-2">
              {PERFIS_PRONTOS.map((p) => {
                const Icone = iconeDoPerfil(p);
                const marcado = perfilEmUso === p.id;
                return (
                  <button key={p.id} type="button" role="radio" aria-checked={marcado} data-slot="boas-vindas-perfil" data-perfil={p.id} onClick={() => trocarDePerfil(p.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-card p-2.5 text-left shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/35",
                      marcado ? "border-primary/55 ring-[3px] ring-primary/15" : "hover:border-ring/40",
                    )}>
                    <MiniaturaDoArranjo arranjo={p.arranjo} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium"><Icone className="size-3.5 shrink-0 text-muted-foreground" /> {p.nome}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{p.descricao}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {etapa === 1 && (
          <div className="flex flex-col gap-4">
            <Campo rotulo="Como o Nexo te chama" dica="Aparece na saudação da tela Hoje. Pode ficar em branco.">
              <Input value={nome} maxLength={TAMANHO_DO_NOME} autoFocus aria-label="Seu nome na saudação" placeholder="Seu nome ou apelido"
                onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && avancar()} />
            </Campo>
            <Campo rotulo="Como você aparece nos passos"
              dica="Os nomes pelos quais você é citado como responsável: seu nome, apelido, como escrevem na ata. É assim que o app sabe quais passos são seus. Passo sem responsável e passo com “Eu” já contam como seus.">
              <ChipsInput valor={meusNomes} mudar={(v) => setNomes(v.slice(0, 12))} placeholder="Digite um nome e aperte Enter" />
            </Campo>
          </div>
        )}

        {etapa === 2 && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" data-slot="boas-vindas-meus-dados" onClick={terminar}
              className="flex flex-col gap-1.5 rounded-lg border border-primary/50 bg-primary/[0.06] p-3.5 text-left outline-none transition-[border-color,box-shadow] hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/35">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><FolderHeart className="size-4 text-primary" /> Começar com os meus dados</span>
              <span className="text-xs leading-snug text-muted-foreground">A tela Hoje abre com os primeiros passos: criar uma tarefa, registrar uma conversa, escolher o foco. Cada um mostra onde fica.</span>
            </button>
            <button type="button" data-slot="boas-vindas-exemplo" disabled={semExemplo || abrindo} onClick={() => void comExemplo()}
              className="flex flex-col gap-1.5 rounded-lg border bg-card p-3.5 text-left outline-none transition-[border-color,box-shadow] hover:border-ring/50 focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-60">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><FlaskConical className="size-4 text-info" /> {abrindo ? "Abrindo o exemplo..." : "Conhecer com um exemplo"}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {semExemplo
                  ? "Não disponível aqui: a pasta de dados está fixada pela variável NEXO_DATA_DIR."
                  : "Oito tarefas de mentira, com reuniões, prazos e rotina, para ver o app cheio. Ficam numa pasta separada: nada se mistura com os seus dados, e você volta com um clique."}
              </span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
