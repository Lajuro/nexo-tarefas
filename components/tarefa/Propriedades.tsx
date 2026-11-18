"use client";

// Faixa de propriedades da tarefa: tudo se edita no lugar, sem abrir formulário.
// Cada valor editável tem a mesma cara (EDITAVEL): uma setinha discreta em repouso, que é a pista
// estável de que ele abre um seletor, e fundo no hover, no foco por teclado e enquanto está aberto.
// A data de criação mora no resumo da lateral, para a faixa caber numa linha em 1366px.

import Link from "next/link";
import { ReactNode, useMemo, useState } from "react";
import { AlarmClock, ArrowUpRight, CalendarClock, Check, ChevronDown, Gauge, Tag } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useAcoesTarefa } from "@/components/MenuTarefa";
import { CatTag, Etiqueta, PontoCor, PrioBadge, SeletorPrioridade, SeletorStatus, nivelPrioridade } from "@/components/comum";
import { CampoChips } from "@/components/ui/chips";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SeletorData } from "@/components/ui/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { aberta } from "@/lib/lembretes";
import { Categoria, Tarefa, diasAte } from "@/lib/tipos";
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

/** "3 dias de atraso", "vence hoje", "em 5 dias": só quando o prazo está perto ou estourou. */
function avisoPrazo(prazo: string | null, fechada: boolean): { texto: string; tom: string; gatilho: string } | null {
  const d = diasAte(prazo);
  if (d === null || fechada) return null;
  const perigo = { tom: "text-destructive", gatilho: "text-destructive hover:text-destructive" };
  const alerta = { tom: "text-alerta", gatilho: "text-alerta hover:text-alerta" };
  const calmo = { tom: "text-muted-foreground", gatilho: "text-foreground" };
  if (d < 0) return { texto: -d === 1 ? "1 dia de atraso" : `${-d} dias de atraso`, ...perigo };
  if (d === 0) return { texto: "vence hoje", ...alerta };
  if (d === 1) return { texto: "vence amanhã", ...alerta };
  if (d <= 7) return { texto: `em ${d} dias`, ...(d <= 3 ? alerta : calmo) };
  return null;
}

const NOME_NIVEL = { alta: "alta", media: "média", baixa: "baixa" } as const;

/** Categoria: troca no lugar, com busca; a página da categoria continua a um clique. */
function CategoriaNoLugar({ tarefa, cat }: { tarefa: Tarefa; cat?: Categoria }) {
  const { dados, atualizarTarefa } = useNexo();
  const [aberto, setAberto] = useState(false);
  const opcoes = useMemo(
    () => (dados?.categorias.items ?? [])
      .filter((c) => !c.arquivada || c.id === tarefa.categoriaId)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados?.categorias.items, tarefa.categoriaId],
  );
  const escolher = (id: string | null) => {
    setAberto(false);
    if (id !== tarefa.categoriaId) atualizarTarefa(tarefa.id, (t) => ({ ...t, categoriaId: id }));
  };
  const marca = (sim: boolean) => sim && <Check className="ml-auto size-3.5 !text-primary" />;
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
        <Command>
          <CommandInput placeholder="Buscar categoria..." />
          <CommandList>
            <CommandEmpty>Nenhuma categoria com esse nome.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="sem categoria" onSelect={() => escolher(null)}>
                <PontoCor /> <span className="text-muted-foreground">Sem categoria</span>
                {marca(!tarefa.categoriaId)}
              </CommandItem>
              {opcoes.map((c) => (
                <CommandItem key={c.id} value={`${c.nome} ${c.id}`} onSelect={() => escolher(c.id)}>
                  <PontoCor cor={c.cor} /> <span className="truncate">{c.nome}</span>
                  {marca(c.id === tarefa.categoriaId)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
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
  const { dados, atualizarTarefa } = useNexo();
  const sugestoes = useMemo(() => [...new Set((dados?.tarefas ?? []).flatMap((t) => t.tags))].sort(), [dados?.tarefas]);
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
        <PopoverContent align="start" className="w-[19rem]">
          <div className="mb-2 flex items-baseline justify-between gap-2 sem-selecao">
            <span className="text-xs font-semibold">Tags</span>
            <span className="text-xs text-muted-foreground">Enter ou vírgula para pôr</span>
          </div>
          <CampoChips valor={tarefa.tags} sugestoes={sugestoes} placeholder="Ex.: pipeline"
            aoMudar={(tags) => atualizarTarefa(tarefa.id, (t) => ({ ...t, tags }))} />
        </PopoverContent>
      </Popover>
    </Prop>
  );
}

export function Propriedades({ tarefa, cat }: { tarefa: Tarefa; cat?: Categoria }) {
  const { atualizarTarefa } = useNexo();
  const acoes = useAcoesTarefa();
  const ehAberta = aberta(tarefa);
  const aviso = avisoPrazo(tarefa.prazo, !ehAberta);
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
          aoMudar={(v) => atualizarTarefa(tarefa.id, (t) => ({ ...t, prazo: v || null }))}
          placeholder="sem prazo"
          aria-label="Prazo da tarefa"
          className={cn(data, tarefa.prazo && (aviso ? aviso.gatilho : "text-foreground"))}
        />
        {aviso && <span data-slot="aviso-prazo" className={cn("text-xs font-medium whitespace-nowrap", aviso.tom)}>{aviso.texto}</span>}
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
