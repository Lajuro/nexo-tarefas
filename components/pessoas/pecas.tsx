"use client";

// Peças usadas pelas telas de Pessoas e Times: links, etiquetas de time, pilha de avatares,
// ações (arquivar, remover, juntar como apelido, mexer em times) e os menus "..." / botão direito.

import Link from "next/link";
import { Fragment, type ReactNode, useCallback } from "react";
import {
  Archive, ArchiveRestore, Crown, Ellipsis, ExternalLink, Pencil, Trash2,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { AvatarPessoa, PontoCor } from "@/components/comum";
import { Button } from "@/components/ui/button";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { type EntradaPessoa, chaveNome, chavesDaPessoa } from "@/lib/pessoas";
import { aberta } from "@/lib/lembretes";
import { type Dados, type Pessoa, type Tarefa, type Time, agoraISO, normalizarPessoa, normalizarTime } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const hrefPessoa = (nome: string) => `/pessoas?p=${encodeURIComponent(nome)}`;
export const hrefTime = (id: string) => `/pessoas?time=${encodeURIComponent(id)}`;

export const porNome = <T extends { nome: string }>(a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });

/** "Cargo · Área", sem separador sobrando. */
export const cargoArea = (p?: Pessoa) => [p?.cargo.trim(), p?.area.trim()].filter(Boolean).join(" · ");

/** Primeira linha de um texto livre, para resumos. */
export const primeiraLinha = (s: string) => s.trim().split(/\n+/)[0] ?? "";

// ---------- visuais ----------

/** Etiqueta de time com a cor dele. Responsável ganha a coroa. */
export function EtiquetaTime({ time, responsavel, comLink, className }: { time: Time; responsavel?: boolean; comLink?: boolean; className?: string }) {
  const classe = cn(
    "relative inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-md border bg-card px-1.5 text-[11px] font-medium text-foreground/85",
    responsavel && "border-alerta/40 bg-alerta/8",
    comLink && "z-10 transition-colors hover:border-ring/40 hover:bg-accent",
    time.arquivado && "opacity-60",
    className,
  );
  const dentro = (
    <>
      <PontoCor cor={time.cor} className="size-1.5" />
      <span className="truncate">{time.nome}</span>
      {responsavel && <Crown aria-label="Responsável" className="size-3 shrink-0 text-alerta" />}
    </>
  );
  const el = comLink
    ? <Link href={hrefTime(time.id)} data-slot="etiqueta-time" data-responsavel={responsavel || undefined} className={classe}>{dentro}</Link>
    : <span data-slot="etiqueta-time" data-responsavel={responsavel || undefined} className={classe}>{dentro}</span>;
  return responsavel ? <Dica texto={`Responsável pelo time ${time.nome}`}>{el}</Dica> : el;
}

/** Quadradinho com a inicial e a cor do time. */
export function EmblemaTime({ time, className }: { time: Pick<Time, "nome" | "cor">; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ background: `color-mix(in oklab, ${time.cor} 16%, transparent)`, color: time.cor, borderColor: `color-mix(in oklab, ${time.cor} 35%, transparent)` }}
      className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold sem-selecao", className)}
    >
      {(time.nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Avatares sobrepostos, com "+N" no fim. */
export function PilhaAvatares({ nomes, max = 5, className }: { nomes: string[]; max?: number; className?: string }) {
  const mostrados = nomes.slice(0, max);
  const resto = nomes.length - mostrados.length;
  return (
    <span data-slot="pilha-avatares" className={cn("inline-flex items-center", className)}>
      {mostrados.map((n) => (
        <Dica key={n} texto={n}>
          <span className="-ml-1.5 inline-flex rounded-full ring-2 ring-card first:ml-0">
            <AvatarPessoa nome={n} />
          </span>
        </Dica>
      ))}
      {resto > 0 && (
        <span className="-ml-1.5 inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card tabular-nums">
          +{resto}
        </span>
      )}
    </span>
  );
}

// ---------- contas ----------

/** Cadastradas que parecem ser o mesmo nome solto (primeiro nome ou uma palavra igual, ou um contém o outro). */
export function pessoasParecidas(nome: string, pessoas: Pessoa[]): Pessoa[] {
  const k = chaveNome(nome);
  if (!k) return [];
  const palavras = k.split(" ").filter((p) => p.length >= 3);
  return pessoas
    .filter((p) => !p.arquivada)
    .filter((p) =>
      chavesDaPessoa(p).some((c) => {
        if (c.includes(k) || k.includes(c)) return true;
        const cp = c.split(" ");
        return palavras.some((w) => cp.includes(w));
      }),
    )
    .sort(porNome);
}

export interface ResumoTime {
  time: Time;
  membros: EntradaPessoa[];
  responsaveis: EntradaPessoa[];
  /** Passos em aberto cujo responsável é membro do time. */
  passos: EntradaPessoa["passosAbertos"];
  /** Tarefas das categorias do time ou com registros de que membros participaram (abertas primeiro). */
  tarefas: Tarefa[];
}

export function resumirTime(time: Time, diretorio: EntradaPessoa[], dados: Dados): ResumoTime {
  const porId = new Map(diretorio.filter((e) => e.pessoa).map((e) => [e.pessoa!.id, e]));
  const membros = time.membroIds.map((id) => porId.get(id)).filter((e): e is EntradaPessoa => !!e);
  const responsaveis = time.responsavelIds.map((id) => porId.get(id)).filter((e): e is EntradaPessoa => !!e);
  const passos = membros.flatMap((m) => m.passosAbertos);
  const ids = new Set<string>();
  for (const m of membros) for (const { tarefa } of m.registros) ids.add(tarefa.id);
  const tarefas = dados.tarefas
    .filter((t) => ids.has(t.id) || (t.categoriaId && time.categoriaIds.includes(t.categoriaId)))
    .sort((a, b) => Number(aberta(b)) - Number(aberta(a)) || b.atualizadaEm.localeCompare(a.atualizadaEm));
  return { time, membros, responsaveis, passos, tarefas };
}

// ---------- ações ----------

export function useAcoesPessoa() {
  const { dados, salvarPessoas, salvarTimes, toast } = useNexo();
  const confirmar = useConfirmar();

  const arquivar = useCallback(
    async (p: Pessoa, arquivada: boolean) => {
      const ok = await salvarPessoas((items) => items.map((i) => (i.id === p.id ? { ...i, arquivada, atualizadaEm: agoraISO() } : i)));
      if (ok) toast(arquivada ? `${p.nome} foi arquivada. Ela sai da lista, mas continua nos registros.` : `${p.nome} voltou para a lista.`);
      return ok;
    },
    [salvarPessoas, toast],
  );

  const remover = useCallback(
    async (p: Pessoa) => {
      const ok = await confirmar({
        titulo: `Remover o cadastro de ${p.nome}?`,
        descricao:
          "Os registros antigos continuam com o nome dela, que volta a aparecer como nome sem cadastro. O cadastro (cargo, anotações, com o que ajuda) vai para a lixeira e ela sai dos times.",
        confirmar: "Remover cadastro",
        perigo: true,
      });
      if (!ok) return false;
      if (!(await salvarPessoas((items) => items.filter((i) => i.id !== p.id)))) return false;
      if ((dados?.times.items ?? []).some((t) => t.membroIds.includes(p.id) || t.responsavelIds.includes(p.id))) {
        await salvarTimes((items) =>
          items.map((t) =>
            t.membroIds.includes(p.id) || t.responsavelIds.includes(p.id)
              ? { ...t, membroIds: t.membroIds.filter((x) => x !== p.id), responsavelIds: t.responsavelIds.filter((x) => x !== p.id), atualizadoEm: agoraISO() }
              : t,
          ),
        );
      }
      toast(`Cadastro de ${p.nome} removido (está na lixeira).`);
      return true;
    },
    [confirmar, dados, salvarPessoas, salvarTimes, toast],
  );

  /** Acrescenta um nome solto aos apelidos de uma pessoa cadastrada. */
  const juntarComoApelido = useCallback(
    async (nome: string, p: Pessoa) => {
      const limpo = nome.replace(/\s+/g, " ").trim();
      const ok = await salvarPessoas((items) =>
        items.map((i) => (i.id === p.id ? normalizarPessoa({ ...i, apelidos: [...i.apelidos, limpo], atualizadaEm: agoraISO() }) : i)),
      );
      if (ok) toast(`“${limpo}” agora é apelido de ${p.nome}. Os registros com esse nome passam a contar para ela.`);
      return ok;
    },
    [salvarPessoas, toast],
  );

  /** Cria uma pessoa só com o nome (usado em "criar na hora"). Devolve a pessoa criada. */
  const criarRapido = useCallback(
    async (nome: string): Promise<Pessoa | null> => {
      const nova = normalizarPessoa({ nome: nome.trim(), origem: "manual" });
      return (await salvarPessoas((items) => [...items, nova])) ? nova : null;
    },
    [salvarPessoas],
  );

  return { arquivar, remover, juntarComoApelido, criarRapido };
}

export function useAcoesTime() {
  const { salvarTimes, toast } = useNexo();
  const confirmar = useConfirmar();

  /** Aplica uma mudança a um time (sempre sobre a versão mais recente da lista). */
  const mudar = useCallback(
    (id: string, fn: (t: Time) => Time) =>
      salvarTimes((items) => items.map((t) => (t.id === id ? normalizarTime({ ...fn(t), atualizadoEm: agoraISO() }) : t))),
    [salvarTimes],
  );

  const adicionarMembro = useCallback(
    (timeId: string, pessoaId: string) => mudar(timeId, (t) => ({ ...t, membroIds: [...t.membroIds, pessoaId] })),
    [mudar],
  );
  const tirarDoTime = useCallback(
    (timeId: string, pessoaId: string) =>
      mudar(timeId, (t) => ({ ...t, membroIds: t.membroIds.filter((x) => x !== pessoaId), responsavelIds: t.responsavelIds.filter((x) => x !== pessoaId) })),
    [mudar],
  );
  const definirResponsavel = useCallback(
    (timeId: string, pessoaId: string, sim: boolean) =>
      mudar(timeId, (t) => ({
        ...t,
        responsavelIds: sim ? [...t.responsavelIds, pessoaId] : t.responsavelIds.filter((x) => x !== pessoaId),
        membroIds: [...t.membroIds, pessoaId],
      })),
    [mudar],
  );
  const definirCategorias = useCallback(
    (timeId: string, fn: (ids: string[]) => string[]) => mudar(timeId, (t) => ({ ...t, categoriaIds: fn(t.categoriaIds) })),
    [mudar],
  );

  const arquivar = useCallback(
    async (t: Time, arquivado: boolean) => {
      const ok = await mudar(t.id, (x) => ({ ...x, arquivado }));
      if (ok) toast(arquivado ? `Time ${t.nome} arquivado.` : `Time ${t.nome} voltou para a lista.`);
      return ok;
    },
    [mudar, toast],
  );

  const remover = useCallback(
    async (t: Time) => {
      const ok = await confirmar({
        titulo: `Remover o time ${t.nome}?`,
        descricao: "As pessoas continuam cadastradas; só o time e os vínculos dele somem. O time vai para a lixeira.",
        confirmar: "Remover time",
        perigo: true,
      });
      if (!ok) return false;
      const feito = await salvarTimes((items) => items.filter((i) => i.id !== t.id));
      if (feito) toast(`Time ${t.nome} removido (está na lixeira).`);
      return feito;
    },
    [confirmar, salvarTimes, toast],
  );

  /** Cria um time só com o nome (e opcionalmente um primeiro membro). */
  const criarRapido = useCallback(
    async (nome: string, membroId?: string, cor?: string): Promise<Time | null> => {
      const novo = normalizarTime({ nome: nome.trim(), membroIds: membroId ? [membroId] : [], cor });
      return (await salvarTimes((items) => [...items, novo])) ? novo : null;
    },
    [salvarTimes],
  );

  return { mudar, adicionarMembro, tirarDoTime, definirResponsavel, definirCategorias, arquivar, remover, criarRapido };
}

// ---------- menus ----------

export interface AcaoMenu {
  rotulo: string;
  icone: ReactNode;
  aoClicar: () => void;
  perigo?: boolean;
  /** Linha separadora antes deste item. */
  separar?: boolean;
  oculto?: boolean;
}

/** Envolve um elemento com o menu do botão direito. */
export function MenuContexto({ acoes, children }: { acoes: AcaoMenu[]; children: ReactNode }) {
  const visiveis = acoes.filter((a) => !a.oculto);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {visiveis.map((a) => (
          <Fragment key={a.rotulo}>
            {a.separar && <ContextMenuSeparator />}
            <ContextMenuItem perigo={a.perigo} onSelect={a.aoClicar}>{a.icone}{a.rotulo}</ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Botão "..." com as mesmas ações. */
export function BotaoMenu({ acoes, rotulo, className, tamanho = "icon-sm" }: { acoes: AcaoMenu[]; rotulo: string; className?: string; tamanho?: "icon-sm" | "icon" }) {
  const visiveis = acoes.filter((a) => !a.oculto);
  return (
    <DropdownMenu>
      <Dica texto="Mais ações">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={tamanho} aria-label={rotulo} data-slot="botao-menu" className={cn("relative z-10", className)}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
      </Dica>
      <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {visiveis.map((a) => (
          <Fragment key={a.rotulo}>
            {a.separar && <DropdownMenuSeparator />}
            <DropdownMenuItem perigo={a.perigo} onSelect={a.aoClicar}>{a.icone}{a.rotulo}</DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Ações padrão de uma pessoa cadastrada. */
export function acoesDaPessoa(
  p: Pessoa,
  { abrir, editar, arquivar, remover }: { abrir?: () => void; editar: () => void; arquivar: (v: boolean) => void; remover: () => void },
): AcaoMenu[] {
  return [
    { rotulo: "Abrir", icone: <ExternalLink />, aoClicar: () => abrir?.(), oculto: !abrir },
    { rotulo: "Editar", icone: <Pencil />, aoClicar: editar },
    p.arquivada
      ? { rotulo: "Desarquivar", icone: <ArchiveRestore />, aoClicar: () => arquivar(false), separar: true }
      : { rotulo: "Arquivar", icone: <Archive />, aoClicar: () => arquivar(true), separar: true },
    { rotulo: "Remover", icone: <Trash2 />, aoClicar: remover, perigo: true },
  ];
}

/** Ações padrão de um time. */
export function acoesDoTime(
  t: Time,
  { abrir, editar, arquivar, remover }: { abrir?: () => void; editar: () => void; arquivar: (v: boolean) => void; remover: () => void },
): AcaoMenu[] {
  return [
    { rotulo: "Abrir", icone: <ExternalLink />, aoClicar: () => abrir?.(), oculto: !abrir },
    { rotulo: "Editar", icone: <Pencil />, aoClicar: editar },
    t.arquivado
      ? { rotulo: "Desarquivar", icone: <ArchiveRestore />, aoClicar: () => arquivar(false), separar: true }
      : { rotulo: "Arquivar", icone: <Archive />, aoClicar: () => arquivar(true), separar: true },
    { rotulo: "Remover", icone: <Trash2 />, aoClicar: remover, perigo: true },
  ];
}
