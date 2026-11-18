"use client";

// Faixa de propriedades da tarefa: tudo se edita no lugar, sem abrir formulário.
// Cada valor editável tem a mesma cara (EDITAVEL): uma setinha discreta em repouso, que é a pista
// estável de que ele abre um seletor, e fundo no hover, no foco por teclado e enquanto está aberto.
// A data de criação mora no resumo da lateral, para a faixa caber numa linha em 1366px.

import Link from "next/link";
import { ReactNode, useState } from "react";
import { AlarmClock, ArrowUpRight, CalendarClock, ChevronDown, Gauge, Tag } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useAcoesTarefa } from "@/components/MenuTarefa";
import { useCriarCategoria, useOpcoesDeCategoria } from "@/components/categorias/Escolher";
import { useNomesDasTags } from "@/components/tags/useTags";
import { ListaDeCategorias } from "@/components/tarefas/ComboCategoria";
import { CatTag, Etiqueta, PrioBadge, SeletorPrioridade, SeletorStatus, nivelPrioridade } from "@/components/comum";
import { CampoChips } from "@/components/ui/chips";
import { SeletorData } from "@/components/ui/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aberta } from "@/lib/lembretes";
import { Categoria, Tarefa, diasAte, dataCurta } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** A cara de todo valor editável da faixa. */
const EDITAVEL =
  "group/ed inline-flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium outline-none sem-selecao transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent";

/** A setinha que fica sempre ali, discreta: diz "isto abre um seletor" sem precisar passar o mouse. */
function Seta() {
  return <ChevronDown aria-hidden data-slot="seta-editavel" className="size-3 shrink-0 opacity-50 transition-opacity group-hover/ed:opacity-90" />;
}

function Prop({ rotulo, icone, children, slot }: { rotulo: string; icone?: ReactNode; children: ReactNode; slot: string }) {
  return (
    <div data-slot={`prop-${slot}`} className="flex h-7 min-w-0 items-center gap-0.5">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sem-selecao [&_svg]:size-3.5 [&_svg]:opacity-70">
        {icone}
        {rotulo}
      </span>
      {children}
    </div>
  );
}

/**
 * Cor do prazo: vermelho quando venceu, âmbar até 3 dias. O texto ("20/11 · 2 dias de atraso") vem do próprio
 * SeletorData, na regra única de data (3.10); antes havia um segundo aviso ao lado, que repetia o relativo.
 */
function corDoPrazo(prazo: string | null, fechada: boolean): string | null {
  const d = diasAte(prazo);
  if (d === null || fechada) return null;
  if (d < 0) return "text-destructive hover:text-destructive";
  if (d <= 3) return "text-alerta hover:text-alerta";
  return null;
}

const NOME_NIVEL = { alta: "alta", media: "média", baixa: "baixa" } as const;

/** Categoria: troca no lugar, com busca, e cria a que falta na hora; a página da categoria continua a um clique. */
function CategoriaNoLugar({ tarefa, cat }: { tarefa: Tarefa; cat?: Categoria }) {
  const { dadosAtuais, atualizarComVolta } = useNexo();
  const [aberto, setAberto] = useState(false);
  const opcoes = useOpcoesDeCategoria([tarefa.categoriaId]);
  const criar = useCriarCategoria();
  const escolher = (id: string | null) => {
    setAberto(false);
    if (id === tarefa.categoriaId) return;
    const nome = dadosAtuais()?.categorias.items.find((c) => c.id === id)?.nome ?? "sem categoria";
    void atualizarComVolta(tarefa.id, (t) => ({ ...t, categoriaId: id }), `Categoria: ${nome}.`);
  };
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" data-slot="prop-categoria" aria-label={`Categoria: ${cat ? cat.nome : "sem categoria"}. Clique para mudar.`}
          className={cn(EDITAVEL, "-ml-1.5 max-w-[16rem] [&_[data-slot=categoria]]:hover:text-foreground")}>
          <CatTag cat={cat} />
          <Seta />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <ListaDeCategorias valor={tarefa.categoriaId ?? ""} opcoes={opcoes} dicaDeCriar={!cat}
          aoEscolher={(v) => escolher(v || null)}
          aoCriar={(nome) => { setAberto(false); void criar(nome).then((id) => { if (id) escolher(id); }); }} />
        {cat && (
          <div className="border-t p-1">
            <Link href={`/categorias/${cat.id}`} onClick={() => setAberto(false)} data-slot="abrir-categoria"
              className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none hover:bg-accent focus-visible:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
              <ArrowUpRight /> Abrir a página da categoria
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Tags: o mesmo campo de etiquetas do formulário, num balão. Cada mudança grava na hora. */
function TagsNoLugar({ tarefa }: { tarefa: Tarefa }) {
  const { atualizarTarefa } = useNexo();
  const sugestoes = useNomesDasTags();
  return (
    <Prop slot="tags" rotulo="" icone={<Tag aria-hidden />}>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={tarefa.tags.length ? `Tags: ${tarefa.tags.join(", ")}. Clique para mudar.` : "Sem tags. Clique para pôr."}
            className={cn(EDITAVEL, "gap-1 px-1")}>
            {tarefa.tags.length
              ? tarefa.tags.map((t) => <Etiqueta key={t}>{t}</Etiqueta>)
              : <span className="text-muted-foreground">sem tags</span>}
            <Seta />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[19rem]"
          // o cursor vai para o campo de digitar, não para o "x" da primeira tag
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector("input")?.focus(); }}>
          {/* o atalho fica em cima: embaixo, a lista de sugestões do campo o cobriria */}
          <div className="mb-2 flex items-center justify-between gap-2 sem-selecao">
            <span className="text-xs font-semibold">Tags</span>
            <Link href="/categorias?aba=tags" data-slot="gerenciar-tags"
              className="-mr-1 inline-flex h-6 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_svg]:size-3.5">
              Renomear ou juntar <ArrowUpRight />
            </Link>
          </div>
          <CampoChips valor={tarefa.tags} sugestoes={sugestoes} placeholder="Digite e aperte Enter"
            aoMudar={(tags) => atualizarTarefa(tarefa.id, (t) => ({ ...t, tags }))} />
        </PopoverContent>
      </Popover>
    </Prop>
  );
}

export function Propriedades({ tarefa, cat }: { tarefa: Tarefa; cat?: Categoria }) {
  const { atualizarComVolta } = useNexo();
  const acoes = useAcoesTarefa();
  const ehAberta = aberta(tarefa);
  const corPrazo = corDoPrazo(tarefa.prazo, !ehAberta);
  const lembrete = tarefa.lembrarEm ?? "";
  const lembreteVencido = !!lembrete && (diasAte(lembrete) ?? 1) <= 0;
  // As datas usam o SeletorData compacto do kit: tira o ícone de calendário dele e iguala ao EDITAVEL.
  const data = "group/ed h-7 cursor-pointer gap-1 px-1.5 data-[state=open]:bg-accent [&>svg:first-child]:hidden";

  return (
    <div data-slot="propriedades" className="flex w-full flex-wrap items-center gap-x-3.5 gap-y-1">
      <CategoriaNoLugar tarefa={tarefa} cat={cat} />

      <SeletorStatus status={tarefa.status} aoMudar={(s) => acoes.mudarStatus(tarefa, s)} seta />

      <Prop slot="prioridade" rotulo="Prioridade" icone={<Gauge />}>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Prioridade ${tarefa.prioridade} de 10. Clique para mudar.`} className={cn(EDITAVEL, "gap-1.5 px-1")}>
              <PrioBadge p={tarefa.prioridade} semDica className="size-[22px]" />
              <span className="text-muted-foreground group-hover/ed:text-foreground">{NOME_NIVEL[nivelPrioridade(tarefa.prioridade)]}</span>
              <Seta />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[19rem]">
            <div className="mb-2 flex items-baseline justify-between gap-2 sem-selecao">
              <span className="text-xs font-semibold">Prioridade</span>
              <span className="text-xs text-muted-foreground">1 pode esperar · 10 é urgente</span>
            </div>
            <SeletorPrioridade valor={tarefa.prioridade} aoMudar={(p) => p !== tarefa.prioridade && acoes.mudarPrioridade(tarefa, p)} />
          </PopoverContent>
        </Popover>
      </Prop>

      <Prop slot="prazo" rotulo="Prazo" icone={<CalendarClock />}>
        <SeletorData
          compacto
          seta
          valor={tarefa.prazo ?? ""}
          aoMudar={(v) => (v || null) !== tarefa.prazo && atualizarComVolta(tarefa.id, (t) => ({ ...t, prazo: v || null }), v ? `Prazo: ${dataCurta(v)}.` : "Prazo removido.")}
          placeholder="sem prazo"
          aria-label="Prazo da tarefa"
          prazo
          className={cn(data, tarefa.prazo && (corPrazo ?? "text-foreground"))}
        />
      </Prop>

      {ehAberta && (
        <Prop slot="lembrete" rotulo="Lembrar de voltar" icone={<AlarmClock />}>
          <SeletorData
            compacto
            seta
            valor={lembrete}
            aoMudar={(v) => acoes.lembrarEm(tarefa, v || null)}
            placeholder="sem data"
            aria-label="Data para lembrar de voltar nesta tarefa"
            className={cn(data, lembrete && (lembreteVencido ? "text-alerta hover:text-alerta" : "text-foreground"))}
          />
        </Prop>
      )}

      <TagsNoLugar tarefa={tarefa} />
    </div>
  );
}
