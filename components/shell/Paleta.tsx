"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Crosshair, type LucideIcon, Maximize, Monitor, Moon, PanelLeft, Plus, Search, SearchX, Sun, Sunrise } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { type Tema, useTema } from "@/components/Raiz";
import { AvatarPessoa, IconeStatus, PontoCor, PrioBadge } from "@/components/comum";
import { filtroSemAcento } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/diversos";
import { aberta } from "@/lib/lembretes";
import { type Categoria, hojeISO, type Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { TODOS_NAV } from "./navegacao";
import { type Direcao, vizinho } from "./paleta/navegacao";
import { cartao, MarcaAtual, Miniatura, Opcao, TituloSecao } from "./paleta/pecas";

// Paleta de comandos (Ctrl+K): ir para qualquer tela, tarefa, categoria ou pessoa e disparar ações sem tirar a mão do teclado.
// Sem texto, é um painel (ações em cartões, tema, telas e as tarefas do momento); com texto, vira resultado de busca.
// A seleção é controlada aqui (não pelo cmdk) porque grade pede setas nos quatro sentidos.

interface Comando {
  id: string;
  nome: string;
  palavras: string;
  icone: LucideIcon;
  tecla?: string[];
  /** Cor do quadradinho do ícone (só tokens). */
  tom?: string;
}

const ACOES: Comando[] = [
  { id: "acao:nova", nome: "Nova tarefa", palavras: "criar adicionar nova tarefa", icone: Plus, tecla: ["N"], tom: "bg-primary/12 text-primary" },
  { id: "acao:dia", nome: "Planejar o dia", palavras: "ritual foco planejar dia manhã", icone: Sunrise, tecla: ["D"], tom: "bg-alerta/15 text-alerta" },
  { id: "acao:cheia", nome: "Tela cheia", palavras: "entrar sair tela cheia fullscreen maximizar", icone: Maximize, tecla: ["F11"], tom: "bg-info/12 text-info" },
  { id: "acao:lateral", nome: "Barra lateral", palavras: "recolher abrir barra lateral menu", icone: PanelLeft, tecla: ["Ctrl", "B"], tom: "bg-sucesso/12 text-sucesso" },
];

const TEMAS: { tema: Tema; nome: string; icone: LucideIcon; palavras: string }[] = [
  { tema: "sistema", nome: "Sistema", icone: Monitor, palavras: "tema do sistema aparência automático" },
  { tema: "claro", nome: "Claro", icone: Sun, palavras: "tema claro aparência light" },
  { tema: "escuro", nome: "Escuro", icone: Moon, palavras: "tema escuro aparência dark noturno" },
];

const LIMITE_INICIAL = 6;
const LIMITE_BUSCA = 8;
const limpar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Paleta({
  aberta: abertaPaleta, fechar, acoes,
}: {
  aberta: boolean;
  fechar: () => void;
  acoes: { novaTarefa: () => void; planejarDia: () => void; alternarLateral: () => void; telaCheia: () => void };
}) {
  const { dados } = useNexo();
  const { tema, definirTema } = useTema();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const colunaAlvo = useRef<number | null>(null);
  const base = useId().replace(/:/g, "");

  useEffect(() => {
    if (abertaPaleta) {
      setQ("");
      setSel(null);
      colunaAlvo.current = null;
    }
  }, [abertaPaleta]);

  const cats = useMemo(() => dados?.categorias.items ?? [], [dados?.categorias.items]);
  const catDe = (t: Tarefa) => cats.find((c) => c.id === t.categoriaId);
  const pessoas = useMemo(() => {
    const s = new Set<string>();
    for (const t of dados?.tarefas ?? []) for (const r of t.registros) r.participantes.forEach((p) => s.add(p.trim()));
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [dados?.tarefas]);

  const termo = q.trim();
  const buscando = termo.length > 0;
  const hoje = hojeISO();

  // ---------- o que aparece ----------
  const tarefas = useMemo(() => {
    const todas = dados?.tarefas ?? [];
    const prio = (a: Tarefa, b: Tarefa) => Number(aberta(b)) - Number(aberta(a)) || b.prioridade - a.prioridade;
    if (!buscando) {
      const focos = todas.filter((t) => aberta(t) && t.focoEm === hoje).sort(prio);
      const resto = todas.filter((t) => aberta(t) && t.focoEm !== hoje).sort(prio);
      return [...focos, ...resto].slice(0, LIMITE_INICIAL);
    }
    const alvo = limpar(termo);
    return todas
      .filter((t) => filtroSemAcento(`${t.titulo} ${t.id}`, termo, [cats.find((c) => c.id === t.categoriaId)?.nome ?? "", ...t.tags]))
      // título que contém o termo inteiro vem antes de quem só casa por categoria ou etiqueta
      .map((t) => ({ t, peso: limpar(t.titulo).includes(alvo) ? 2 : 1 }))
      .sort((a, b) => b.peso - a.peso || prio(a.t, b.t))
      .map((x) => x.t);
  }, [dados?.tarefas, buscando, termo, hoje, cats]);
  const tarefasVisiveis = buscando ? tarefas.slice(0, LIMITE_BUSCA) : tarefas;

  const telas = TODOS_NAV.map((n) => ({ id: `tela:${n.href}`, nav: n }));
  const casa = (texto: string) => filtroSemAcento(texto, termo) > 0;
  const acoesVis = buscando ? ACOES.filter((a) => casa(`${a.nome} ${a.palavras}`)) : ACOES;
  const temasVis = buscando ? TEMAS.filter((t) => casa(t.palavras)) : TEMAS;
  const telasVis = buscando ? telas.filter((t) => casa(`ir para ${t.nav.nome}`)) : telas;
  const catsVis = buscando ? cats.filter((c) => casa(`categoria ${c.nome}`)) : [];
  const pessoasVis = buscando ? pessoas.filter((p) => casa(`pessoa ${p}`)).slice(0, 12) : [];

  // ---------- ordem de leitura (a mesma do DOM) e o que cada item faz ----------
  const ir = (href: string) => {
    fechar();
    router.push(href);
  };
  const fazer = (fn: () => void) => {
    fechar();
    // espera a janela fechar para o foco não brigar com a próxima janela
    setTimeout(fn, 120);
  };
  const execAcao: Record<string, () => void> = {
    "acao:nova": () => fazer(acoes.novaTarefa),
    "acao:dia": () => fazer(acoes.planejarDia),
    "acao:cheia": () => fazer(acoes.telaCheia),
    "acao:lateral": () => fazer(acoes.alternarLateral),
  };

  const ordem: string[] = [];
  const executores = new Map<string, () => void>();
  const pos = (id: string, fn: () => void) => {
    ordem.push(id);
    executores.set(id, fn);
  };
  const regTarefas = () => tarefasVisiveis.forEach((t) => pos(`tarefa:${t.id}`, () => ir(`/tarefas/${t.id}`)));
  const regAcoes = () => acoesVis.forEach((a) => pos(a.id, execAcao[a.id]));
  const regTemas = () => temasVis.forEach((t) => pos(`tema:${t.tema}`, () => definirTema(t.tema)));
  const regTelas = () => telasVis.forEach((t) => pos(t.id, () => ir(t.nav.href)));
  if (!buscando) {
    regAcoes();
    regTemas();
    regTelas();
    regTarefas();
  } else {
    regTarefas();
    regAcoes();
    regTemas();
    regTelas();
    catsVis.forEach((c) => pos(`cat:${c.id}`, () => ir(`/categorias/${c.id}`)));
    pessoasVis.forEach((p, i) => pos(`pessoa:${i}`, () => ir(`/pessoas?p=${encodeURIComponent(p)}`)));
    pos("busca", () => ir(`/busca?q=${encodeURIComponent(termo)}`));
  }

  const atual = sel && executores.has(sel) ? sel : ordem[0] ?? null;
  const domId = (id: string) => `${base}-op-${ordem.indexOf(id)}`;
  const escolher = (id: string) => executores.get(id)?.();
  const apontar = (id: string) => {
    colunaAlvo.current = null;
    setSel(id);
  };
  const props = (id: string) => ({ id, domId: domId(id), selecionada: atual === id, aoApontar: apontar, aoEscolher: escolher });

  // o item selecionado sempre visível
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || !atual) return;
    if (atual === ordem[0]) {
      lista.scrollTop = 0;
      return;
    }
    lista.querySelector<HTMLElement>(`[data-paleta-item="${CSS.escape(atual)}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual]);

  const mover = (dir: Direcao) => {
    const lista = listaRef.current;
    if (!lista || !atual) return;
    const els = [...lista.querySelectorAll<HTMLElement>("[data-paleta-item]")];
    const i = els.findIndex((e) => e.dataset.paletaItem === atual);
    if (i < 0) return;
    const vertical = dir === "cima" || dir === "baixo";
    if (vertical && colunaAlvo.current === null) {
      const r = els[i].getBoundingClientRect();
      // lista de largura cheia não define coluna; grade sim
      colunaAlvo.current = r.width < lista.clientWidth * 0.7 ? r.left + r.width / 2 : null;
    }
    if (!vertical) colunaAlvo.current = null;
    let j = vizinho(els, i, dir, colunaAlvo.current);
    if (j === null && vertical) {
      // passou do fim (ou do começo): dá a volta e esquece a coluna
      j = dir === "baixo" ? 0 : els.length - 1;
      colunaAlvo.current = null;
    }
    if (j === null || j === i) return;
    setSel(els[j].dataset.paletaItem ?? null);
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const emGrade = !!atual && !atual.startsWith("tarefa:") && atual !== "busca";
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        mover("baixo");
        break;
      case "ArrowUp":
        e.preventDefault();
        mover("cima");
        break;
      case "ArrowLeft":
      case "ArrowRight":
        // em lista, esquerda e direita continuam movendo o cursor do texto
        if (!emGrade || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        e.preventDefault();
        mover(e.key === "ArrowLeft" ? "esquerda" : "direita");
        break;
      case "Enter":
        if (!atual) return;
        e.preventDefault();
        escolher(atual);
        break;
    }
  };

  const vazio = buscando && ordem.length === 1;
  const nomeTema = TEMAS.find((t) => t.tema === tema)?.nome ?? "Sistema";

  return (
    <Dialog open={abertaPaleta} onOpenChange={(a) => !a && fechar()}>
      <DialogContent
        semFechar
        data-slot="paleta"
        className="top-[10%] max-w-[760px] translate-y-0 p-0 data-[state=closed]:slide-out-to-top-[8%] data-[state=open]:slide-in-from-top-[8%] sm:top-[12%]"
      >
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <DialogDescription className="sr-only">Busque telas, tarefas, categorias, pessoas e ações. Use as setas para navegar e Enter para abrir.</DialogDescription>

        <div className="flex items-center gap-2.5 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            data-slot="command-input"
            role="combobox"
            aria-expanded
            aria-controls={`${base}-lista`}
            aria-activedescendant={atual ? domId(atual) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              // ao digitar, a seleção volta para o melhor resultado
              setSel(null);
              colunaAlvo.current = null;
            }}
            onKeyDown={teclas}
            placeholder="Buscar tarefa, pessoa, tela ou ação..."
            className="h-13 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {buscando && (
            <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums sem-selecao">
              {ordem.length - 1} {ordem.length - 1 === 1 ? "resultado" : "resultados"}
            </span>
          )}
        </div>

        <div
          ref={listaRef}
          id={`${base}-lista`}
          role="listbox"
          aria-label="Resultados"
          data-slot="paleta-lista"
          className="h-[min(68vh,640px)] overflow-y-auto overscroll-contain px-3 pt-3 pb-2"
        >
          {!buscando ? (
            <div className="flex flex-col gap-4">
              <Bloco titulo="Ações">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ACOES.map((a) => <CartaoAcao key={a.id} cmd={a} {...props(a.id)} />)}
                </div>
              </Bloco>

              <Bloco titulo="Tema" extra={<span>Atual: {nomeTema}</span>}>
                <div className="grid grid-cols-3 gap-2">
                  {TEMAS.map((t) => (
                    <Opcao key={t.tema} {...props(`tema:${t.tema}`)} rotulo={`Tema ${t.nome}`} className={cn(cartao, "p-1.5")}>
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="h-12 overflow-hidden rounded-md border sm:h-14"><Miniatura modo={t.tema} /></div>
                        <div className="flex items-center gap-1.5 px-1 pb-0.5 text-[13px]">
                          <t.icone className="size-3.5 text-muted-foreground" />
                          <span className={cn(tema === t.tema && "font-medium")}>{t.nome}</span>
                          <MarcaAtual ativa={tema === t.tema} />
                        </div>
                      </div>
                    </Opcao>
                  ))}
                </div>
              </Bloco>

              <Bloco titulo="Ir para">
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {telas.map((t) => <AzulejoTela key={t.id} nome={t.nav.nome} icone={t.nav.icone} tecla={t.nav.tecla} {...props(t.id)} />)}
                </div>
              </Bloco>

              {tarefas.length > 0 && (
                <Bloco titulo="Tarefas" extra={<span>Foco de hoje e abertas por prioridade</span>}>
                  <div className="flex flex-col gap-0.5">
                    {tarefas.map((t) => <LinhaTarefa key={t.id} t={t} cat={catDe(t)} foco={t.focoEm === hoje} {...props(`tarefa:${t.id}`)} />)}
                  </div>
                </Bloco>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {vazio && (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center sem-selecao">
                  <SearchX className="size-6 text-muted-foreground/60" />
                  <p className="text-[13px] font-medium">Nada com esse nome</p>
                  <p className="text-xs text-muted-foreground">Nenhuma tela, tarefa, categoria ou pessoa. Dá para procurar dentro dos registros.</p>
                </div>
              )}

              {tarefasVisiveis.length > 0 && (
                <Bloco titulo="Tarefas" extra={tarefas.length > LIMITE_BUSCA ? <span>{LIMITE_BUSCA} de {tarefas.length}</span> : undefined}>
                  <div className="flex flex-col gap-0.5">
                    {tarefasVisiveis.map((t) => <LinhaTarefa key={t.id} t={t} cat={catDe(t)} foco={aberta(t) && t.focoEm === hoje} {...props(`tarefa:${t.id}`)} />)}
                  </div>
                </Bloco>
              )}

              {acoesVis.length + temasVis.length + telasVis.length > 0 && (
                <Bloco titulo="Ações e telas">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {acoesVis.map((a) => <AzulejoTela key={a.id} nome={a.nome} icone={a.icone} teclas={a.tecla} tom={a.tom} {...props(a.id)} />)}
                    {temasVis.map((t) => (
                      <AzulejoTela key={t.tema} nome={`Tema ${t.nome.toLowerCase()}`} icone={t.icone} ativo={tema === t.tema} {...props(`tema:${t.tema}`)} />
                    ))}
                    {telasVis.map((t) => <AzulejoTela key={t.id} nome={t.nav.nome} icone={t.nav.icone} tecla={t.nav.tecla} {...props(t.id)} />)}
                  </div>
                </Bloco>
              )}

              {catsVis.length > 0 && (
                <Bloco titulo="Categorias">
                  <div className="flex flex-wrap gap-1.5">
                    {catsVis.map((c) => (
                      <Opcao key={c.id} {...props(`cat:${c.id}`)} className="h-8 rounded-full border bg-card px-3 text-[13px] transition-colors aria-selected:border-primary/40">
                        <PontoCor cor={c.cor} className="mr-2" />
                        <span className="max-w-56 truncate">{c.nome}</span>
                      </Opcao>
                    ))}
                  </div>
                </Bloco>
              )}

              {pessoasVis.length > 0 && (
                <Bloco titulo="Pessoas">
                  <div className="flex flex-wrap gap-1.5">
                    {pessoasVis.map((p, i) => (
                      <Opcao key={p} {...props(`pessoa:${i}`)} className="h-8 rounded-full border bg-card pr-3 pl-1.5 text-[13px] transition-colors aria-selected:border-primary/40">
                        <AvatarPessoa nome={p} tamanho="sm" className="mr-2" />
                        <span className="max-w-48 truncate">{p}</span>
                      </Opcao>
                    ))}
                  </div>
                </Bloco>
              )}

              <Bloco titulo="Busca completa">
                <Opcao {...props("busca")} className="h-10 rounded-lg px-2.5 text-[13px]">
                  <span className="mr-2.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Search className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    Buscar <strong className="font-semibold">“{termo}”</strong> em registros, anotações e links
                  </span>
                  <CornerDownLeft className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
                </Opcao>
              </Bloco>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground sem-selecao">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd> navegar</span>
          <span className="flex items-center gap-1"><Kbd>Enter</Kbd> abrir</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> fechar</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> abre de qualquer tela</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- blocos e itens ----------

function Bloco({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section role="group" aria-label={titulo}>
      <TituloSecao extra={extra}>{titulo}</TituloSecao>
      {children}
    </section>
  );
}

type PropsItem = Omit<Parameters<typeof Opcao>[0], "children" | "className" | "rotulo">;

function Teclas({ teclas }: { teclas: string[] }) {
  return <span className="flex shrink-0 gap-0.5">{teclas.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>;
}

function CartaoAcao({ cmd, ...p }: PropsItem & { cmd: Comando }) {
  return (
    <Opcao {...p} className={cn(cartao, "h-[76px] p-2.5")}>
      <div className="flex h-full w-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("inline-flex size-8 items-center justify-center rounded-lg", cmd.tom)}>
            <cmd.icone className="size-4" />
          </span>
          {cmd.tecla && <Teclas teclas={cmd.tecla} />}
        </div>
        <span className="truncate text-[13px] font-medium">{cmd.nome}</span>
      </div>
    </Opcao>
  );
}

function AzulejoTela({
  nome, icone: Icone, tecla, teclas, tom, ativo, ...p
}: PropsItem & { nome: string; icone: LucideIcon; tecla?: string; teclas?: string[]; tom?: string; ativo?: boolean }) {
  return (
    <Opcao {...p} className="h-9 rounded-lg border border-transparent px-2 text-[13px] transition-colors hover:border-border">
      <span className={cn("mr-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md", tom ?? "bg-muted text-muted-foreground")}>
        <Icone className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{nome}</span>
      {ativo !== undefined ? <MarcaAtual ativa={ativo} /> : tecla ? <Teclas teclas={["G", tecla.toUpperCase()]} /> : teclas ? <Teclas teclas={teclas} /> : null}
    </Opcao>
  );
}

function LinhaTarefa({ t, cat, foco, ...p }: PropsItem & { t: Tarefa; cat?: Categoria; foco: boolean }) {
  return (
    <Opcao {...p} className={cn("h-9 rounded-lg px-2.5 text-[13px]", !aberta(t) && "text-muted-foreground")}>
      <IconeStatus status={t.status} className="mr-2.5" />
      <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
      {foco && (
        <span className="mr-2 ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          <Crosshair className="size-3" /> Foco
        </span>
      )}
      {cat && (
        <span className="mr-3 ml-2 hidden max-w-44 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <PontoCor cor={cat.cor} />
          <span className="truncate">{cat.nome}</span>
        </span>
      )}
      <PrioBadge p={t.prioridade} semDica className="size-5 text-[11px]" />
    </Opcao>
  );
}
