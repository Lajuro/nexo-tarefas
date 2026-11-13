"use client";

// Peças de domínio compartilhadas por todas as telas do Nexo.
// Regra: se duas telas precisam do mesmo pedaço visual, ele mora aqui (e não copiado).

import Link from "next/link";
import { ReactNode, useEffect, useId, useRef } from "react";
import { animate, motion } from "motion/react";
import {
  Ban, CalendarClock, Check, ChevronLeft, Circle, CircleCheck, CircleDot, CircleSlash, Flag, Gavel, Hourglass,
  type LucideIcon, NotebookPen, OctagonAlert, Users, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { suave } from "@/lib/animacoes";
import { Categoria, STATUS, Status, TipoRegistro, diasAte, formatarData, nomeStatus, tipoInfo } from "@/lib/tipos";
import { Button } from "@/components/ui/button";
import { Checkbox, Label } from "@/components/ui/controles";
import { CampoChips } from "@/components/ui/chips";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";

// =====================================================================
// Estrutura de página
// =====================================================================

/**
 * Moldura de toda tela: cabeçalho fixo (título, descrição, ações), barra opcional de filtros
 * e o corpo com rolagem própria. O Shell dá a altura; quem rola é o corpo, não a janela.
 */
export function Pagina({
  titulo, descricao, acoes, barra, children, voltar, antes, semRolagem, estreita, className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
  /** Linha fixa abaixo do cabeçalho (filtros, abas, busca). */
  barra?: ReactNode;
  children: ReactNode;
  /** Mostra um botão de voltar antes do título. */
  voltar?: { href: string; rotulo: string };
  /** Algo antes do título (ícone, bolinha de cor). */
  antes?: ReactNode;
  /** O filho cuida da própria rolagem e ocupa toda a altura (quadro, colunas). */
  semRolagem?: boolean;
  /** Conteúdo de leitura: limita a largura a ~900px. */
  estreita?: boolean;
  className?: string;
}) {
  const largura = estreita ? "max-w-[920px]" : "max-w-[1360px]";
  return (
    <div data-slot="pagina" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className={cn("mx-auto flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5", largura)}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {voltar && (
              <Dica texto={`Voltar para ${voltar.rotulo}`}>
                <Button asChild variant="ghost" size="icon-sm" className="-ml-1.5">
                  <Link href={voltar.href} aria-label={`Voltar para ${voltar.rotulo}`}><ChevronLeft /></Link>
                </Button>
              </Dica>
            )}
            {antes}
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight font-semibold tracking-tight">{titulo}</h1>
              {descricao && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{descricao}</p>}
            </div>
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </div>
        {barra && <div className={cn("mx-auto flex w-full flex-wrap items-center gap-2 px-6 pb-3", largura)}>{barra}</div>}
      </header>
      {semRolagem ? (
        <div className={cn("min-h-0 flex-1", className)}>{children}</div>
      ) : (
        <div data-slot="pagina-corpo" className="min-h-0 flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={suave}
            className={cn("mx-auto w-full px-6 pt-5 pb-12", largura, className)}
          >
            {children}
          </motion.div>
        </div>
      )}
    </div>
  );
}

/** Bloco com título dentro de uma página. */
export function Secao({
  titulo, contagem, acoes, children, className, icone,
}: {
  titulo: ReactNode; contagem?: number; acoes?: ReactNode; children: ReactNode; className?: string; icone?: ReactNode;
}) {
  return (
    <section data-slot="secao" className={cn("mt-8 first:mt-0", className)}>
      <div className="mb-3 flex items-center gap-2">
        {icone && <span className="text-muted-foreground [&_svg]:size-4">{icone}</span>}
        <h2 className="text-[13px] font-semibold tracking-tight">{titulo}</h2>
        {contagem !== undefined && <Contador n={contagem} />}
        {acoes && <div className="ml-auto flex items-center gap-1.5">{acoes}</div>}
      </div>
      {children}
    </section>
  );
}

/** Cartão com cabeçalho opcional (caixas laterais, blocos de formulário). */
export function Painel({
  titulo, icone, acoes, children, className, corpoClassName, contagem,
}: {
  titulo?: ReactNode; icone?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; corpoClassName?: string; contagem?: number;
}) {
  return (
    <section data-slot="painel" className={cn("rounded-xl border bg-card shadow-xs", className)}>
      {(titulo || acoes) && (
        <header className="flex min-h-10 items-center gap-2 border-b px-3.5 py-1.5">
          {icone && <span className="text-muted-foreground [&_svg]:size-3.5">{icone}</span>}
          <h3 className="text-[13px] font-semibold tracking-tight">{titulo}</h3>
          {contagem !== undefined && <Contador n={contagem} />}
          {acoes && <div className="ml-auto flex items-center gap-1">{acoes}</div>}
        </header>
      )}
      <div className={cn("p-3.5", corpoClassName)}>{children}</div>
    </section>
  );
}

export function Contador({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums", className)}>
      {n}
    </span>
  );
}

/** Número que conta até o valor quando muda. */
export function NumeroAnimado({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const anterior = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctrl = animate(anterior.current, valor, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });
    anterior.current = valor;
    return () => ctrl.stop();
  }, [valor]);
  return <span ref={ref} className={cn("tabular-nums", className)}>{valor}</span>;
}

const TONS = {
  neutro: "text-foreground",
  primario: "text-primary",
  sucesso: "text-sucesso",
  alerta: "text-alerta",
  perigo: "text-destructive",
} as const;

/** Cartão de número do topo das telas. Com `href` vira link. */
export function Estatistica({
  rotulo, valor, icone, tom = "neutro", href, aoClicar, ativo,
}: {
  rotulo: string; valor: number; icone?: ReactNode; tom?: keyof typeof TONS; href?: string; aoClicar?: () => void; ativo?: boolean;
}) {
  const conteudo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{rotulo}</span>
        {icone && <span className={cn("opacity-70 [&_svg]:size-3.5", TONS[valor ? tom : "neutro"])}>{icone}</span>}
      </div>
      <NumeroAnimado valor={valor} className={cn("mt-1 block text-2xl leading-none font-semibold tracking-tight", valor ? TONS[tom] : "text-muted-foreground/60")} />
    </>
  );
  const classe = cn(
    "block rounded-xl border bg-card px-3.5 py-3 text-left shadow-xs transition-[border-color,box-shadow,transform] duration-150",
    (href || aoClicar) && "hover:border-ring/40 hover:shadow-sm active:scale-[0.99]",
    ativo && "border-primary/60 ring-2 ring-primary/15",
  );
  if (href) return <Link href={href} data-slot="estatistica" className={classe}>{conteudo}</Link>;
  if (aoClicar) return <button type="button" data-slot="estatistica" onClick={aoClicar} className={classe}>{conteudo}</button>;
  return <div data-slot="estatistica" className={classe}>{conteudo}</div>;
}

/** Estado vazio: ícone, frase e, se fizer sentido, uma ação. */
export function Vazio({
  titulo, children, icone, className, compacto,
}: {
  titulo: string; children?: ReactNode; icone?: ReactNode; className?: string; compacto?: boolean;
}) {
  return (
    <motion.div
      data-slot="vazio"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={suave}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center",
        compacto ? "px-4 py-6" : "px-6 py-14",
        className,
      )}
    >
      {icone && (
        <span className="mb-1 inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
          {icone}
        </span>
      )}
      <strong className="text-sm font-semibold">{titulo}</strong>
      {children && <div className="flex max-w-md flex-col items-center gap-3 text-[13px] text-muted-foreground">{children}</div>}
    </motion.div>
  );
}

// =====================================================================
// Status
// =====================================================================

export const STATUS_VISUAL: Record<Status, { icone: LucideIcon; texto: string; fundo: string; ponto: string; borda: string }> = {
  a_fazer: { icone: Circle, texto: "text-st-a-fazer", fundo: "bg-st-a-fazer/12", ponto: "bg-st-a-fazer", borda: "border-st-a-fazer/40" },
  em_andamento: { icone: CircleDot, texto: "text-st-andamento", fundo: "bg-st-andamento/12", ponto: "bg-st-andamento", borda: "border-st-andamento/40" },
  aguardando: { icone: Hourglass, texto: "text-st-aguardando", fundo: "bg-st-aguardando/14", ponto: "bg-st-aguardando", borda: "border-st-aguardando/40" },
  bloqueada: { icone: Ban, texto: "text-st-bloqueada", fundo: "bg-st-bloqueada/12", ponto: "bg-st-bloqueada", borda: "border-st-bloqueada/40" },
  concluida: { icone: CircleCheck, texto: "text-st-concluida", fundo: "bg-st-concluida/14", ponto: "bg-st-concluida", borda: "border-st-concluida/40" },
  cancelada: { icone: CircleSlash, texto: "text-st-cancelada", fundo: "bg-st-cancelada/14", ponto: "bg-st-cancelada", borda: "border-st-cancelada/40" },
};

export function IconeStatus({ status, className }: { status: Status; className?: string }) {
  const v = STATUS_VISUAL[status];
  return <v.icone className={cn("size-3.5 shrink-0", v.texto, className)} />;
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const v = STATUS_VISUAL[status];
  return (
    <span data-slot="status" data-status={status}
      className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap sem-selecao", v.fundo, v.texto, className)}>
      <v.icone className="size-3" />
      {nomeStatus(status)}
    </span>
  );
}

/** Badge de status clicável que abre o menu para trocar. */
export function SeletorStatus({
  status, aoMudar, className, disabled,
}: {
  status: Status; aoMudar: (s: Status) => void; className?: string; disabled?: boolean;
}) {
  const v = STATUS_VISUAL[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button type="button" data-slot="seletor-status" data-status={status} aria-label={`Status: ${nomeStatus(status)}. Clique para mudar.`}
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-[filter,box-shadow] outline-none sem-selecao hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/35 dark:hover:brightness-125",
            v.fundo, v.texto, className,
          )}>
          <v.icone className="size-3.5" />
          {nomeStatus(status)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={status} onValueChange={(s) => s !== status && aoMudar(s as Status)}>
          {STATUS.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              <IconeStatus status={s.id} />
              {s.nome}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Opções prontas para o <Seletor> de status (com ícone colorido). */
export const opcoesStatus = STATUS.map((s) => ({
  valor: s.id as string,
  rotulo: (
    <>
      <IconeStatus status={s.id} />
      {s.nome}
    </>
  ),
}));

// =====================================================================
// Prioridade (1 a 10, quanto maior mais urgente)
// =====================================================================

export const nivelPrioridade = (p: number) => (p >= 8 ? "alta" : p >= 5 ? "media" : "baixa");
const PRIO_COR = {
  alta: "bg-destructive/12 text-destructive ring-destructive/25",
  media: "bg-alerta/16 text-alerta ring-alerta/30",
  baixa: "bg-muted text-muted-foreground ring-border",
};
const PRIO_NOME = { alta: "alta", media: "média", baixa: "baixa" };

export function PrioBadge({ p, className, semDica }: { p: number; className?: string; semDica?: boolean }) {
  const n = nivelPrioridade(p);
  const el = (
    <span data-slot="prioridade" data-nivel={n}
      className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums ring-1 ring-inset sem-selecao", PRIO_COR[n], className)}>
      {p}
    </span>
  );
  return semDica ? el : <Dica texto={`Prioridade ${p} de 10 (${PRIO_NOME[n]})`}>{el}</Dica>;
}

/** Dez botões de 1 a 10 no lugar do controle deslizante nativo. Setas do teclado também mudam. */
export function SeletorPrioridade({ valor, aoMudar, className }: { valor: number; aoMudar: (p: number) => void; className?: string }) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label="Prioridade"
      data-slot="seletor-prioridade"
      data-valor={valor}
      className={cn("flex h-8 items-center gap-0.5 rounded-md border border-input bg-card p-0.5 shadow-xs sem-selecao dark:bg-input/20", className)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); aoMudar(Math.min(10, valor + 1)); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); aoMudar(Math.max(1, valor - 1)); }
      }}
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const ativo = n === valor;
        const nivel = nivelPrioridade(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={`Prioridade ${n}`}
            tabIndex={ativo ? 0 : -1}
            onClick={() => aoMudar(n)}
            className={cn(
              "relative h-full min-w-0 flex-1 rounded-[5px] text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              ativo ? "font-semibold" : n < valor ? "text-foreground/70 hover:bg-accent" : "text-muted-foreground/60 hover:bg-accent hover:text-foreground",
              ativo && (nivel === "alta" ? "text-white" : nivel === "media" ? "text-black/85" : "text-background"),
            )}
          >
            {ativo && (
              <motion.span
                layoutId={`prio-${id}`}
                className={cn("absolute inset-0 rounded-[5px] shadow-xs", nivel === "alta" ? "bg-destructive" : nivel === "media" ? "bg-alerta" : "bg-foreground/70")}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// Categoria, prazo, tipos de registro, pessoas
// =====================================================================

export function PontoCor({ cor, className }: { cor?: string | null; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full bg-muted-foreground/40", className)} style={cor ? { background: cor } : undefined} />;
}

export function CatTag({ cat, className }: { cat?: Categoria | null; className?: string }) {
  return (
    <span data-slot="categoria" className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}>
      <PontoCor cor={cat?.cor} />
      <span className="truncate">{cat ? cat.nome : "Sem categoria"}</span>
    </span>
  );
}

export function PrazoTag({ prazo, concluida, className }: { prazo: string | null | undefined; concluida?: boolean; className?: string }) {
  if (!prazo) return null;
  const d = diasAte(prazo)!;
  const tom = concluida ? "text-muted-foreground" : d < 0 ? "text-destructive" : d <= 3 ? "text-alerta" : "text-muted-foreground";
  const txt = concluida ? "" : d < 0 ? ` · ${-d}d de atraso` : d === 0 ? " · hoje" : d === 1 ? " · amanhã" : d <= 7 ? ` · em ${d}d` : "";
  return (
    <span data-slot="prazo" className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap", tom, className)}>
      <CalendarClock className="size-3.5" />
      {formatarData(prazo)}
      {txt}
    </span>
  );
}

export const TIPO_VISUAL: Record<TipoRegistro, { icone: LucideIcon; texto: string; fundo: string }> = {
  reuniao: { icone: Users, texto: "text-info", fundo: "bg-info/14" },
  atividade: { icone: Wrench, texto: "text-primary", fundo: "bg-primary/12" },
  impedimento: { icone: OctagonAlert, texto: "text-destructive", fundo: "bg-destructive/12" },
  decisao: { icone: Gavel, texto: "text-sucesso", fundo: "bg-sucesso/14" },
  nota: { icone: NotebookPen, texto: "text-muted-foreground", fundo: "bg-muted" },
  marco: { icone: Flag, texto: "text-alerta", fundo: "bg-alerta/16" },
};

/** Ícone do tipo de registro. `comFundo` desenha a bolinha colorida usada na timeline. */
export function IconeTipo({ tipo, comFundo, className }: { tipo: TipoRegistro; comFundo?: boolean; className?: string }) {
  const v = TIPO_VISUAL[tipo] ?? TIPO_VISUAL.nota;
  if (!comFundo) return <v.icone className={cn("size-3.5 shrink-0", v.texto, className)} />;
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", v.fundo, v.texto, className)}>
      <v.icone className="size-3.5" />
    </span>
  );
}

export function TipoBadge({ tipo, className }: { tipo: TipoRegistro; className?: string }) {
  const v = TIPO_VISUAL[tipo] ?? TIPO_VISUAL.nota;
  return (
    <span data-slot="tipo" className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap", v.fundo, v.texto, className)}>
      <v.icone className="size-3" />
      {tipoInfo(tipo).nome}
    </span>
  );
}

function matiz(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return h;
}

/** Círculo com as iniciais, com cor estável por nome. */
export function AvatarPessoa({ nome, className, tamanho = "md" }: { nome: string; className?: string; tamanho?: "sm" | "md" | "lg" }) {
  const partes = nome.trim().split(/\s+/);
  const iniciais = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
  const dim = { sm: "size-5 text-[9px]", md: "size-6 text-[10px]", lg: "size-9 text-xs" }[tamanho];
  return (
    <span
      aria-hidden
      style={{ "--h": matiz(nome) } as React.CSSProperties}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[oklch(0.92_0.05_var(--h))] font-semibold text-[oklch(0.42_0.11_var(--h))] sem-selecao dark:bg-[oklch(0.33_0.06_var(--h))] dark:text-[oklch(0.9_0.07_var(--h))]",
        dim, className,
      )}
    >
      {iniciais}
    </span>
  );
}

/** Etiqueta de pessoa (avatar + nome). Com `href` vira link para a página da pessoa. */
export function ChipPessoa({ nome, href, extra, className }: { nome: string; href?: string; extra?: ReactNode; className?: string }) {
  const classe = cn(
    "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border bg-card pr-2 pl-0.5 text-xs font-medium",
    href && "transition-colors hover:border-ring/40 hover:bg-accent",
    className,
  );
  const dentro = (
    <>
      <AvatarPessoa nome={nome} tamanho="sm" />
      <span className="truncate">{nome}</span>
      {extra !== undefined && <span className="text-muted-foreground tabular-nums">{extra}</span>}
    </>
  );
  return href ? <Link href={href} data-slot="chip-pessoa" className={classe}>{dentro}</Link> : <span data-slot="chip-pessoa" className={classe}>{dentro}</span>;
}

/** Etiqueta simples só de leitura (tags). */
export function Etiqueta({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span data-slot="etiqueta" className={cn("inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground", className)}>
      {children}
    </span>
  );
}

// =====================================================================
// Passos (próximos passos / pendências)
// =====================================================================

/** Linha de um próximo passo: caixa redonda, texto e uma linha de detalhes. Risca ao concluir. */
export function ItemPasso({
  texto, feito, aoAlternar, meta, className, desabilitado,
}: {
  texto: ReactNode; feito: boolean; aoAlternar: (feito: boolean) => void; meta?: ReactNode; className?: string; desabilitado?: boolean;
}) {
  return (
    <div data-slot="passo" data-feito={feito || undefined} className={cn("group/passo flex items-start gap-2.5 rounded-md py-1", className)}>
      <Checkbox redondo checked={feito} disabled={desabilitado} onCheckedChange={(v) => aoAlternar(v === true)} className="mt-px" aria-label={feito ? "Reabrir passo" : "Concluir passo"} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13px] leading-snug transition-colors duration-300 texto-pre", feito && "text-muted-foreground line-through decoration-muted-foreground/50")}>
          {texto}
        </div>
        {meta && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">{meta}</div>}
      </div>
    </div>
  );
}

// =====================================================================
// Formulários
// =====================================================================

/** Rótulo + controle + dica. Não usa <label> por fora para não disparar cliques nos seletores próprios. */
export function Campo({
  rotulo, children, dica, className, lado,
}: {
  rotulo: ReactNode; children: ReactNode; dica?: ReactNode; className?: string;
  /** Algo à direita do rótulo (contador, link). */
  lado?: ReactNode;
}) {
  return (
    <div data-slot="campo" className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{rotulo}</Label>
        {lado}
      </div>
      {children}
      {dica && <span className="text-[11px] leading-snug text-muted-foreground">{dica}</span>}
    </div>
  );
}

/** Campos lado a lado que quebram linha quando falta espaço. */
export function LinhaCampos({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-3 [&>[data-slot=campo]]:min-w-40", className)}>{children}</div>;
}

/** Etiquetas editáveis (tags, participantes). Mesmo contrato do antigo ChipsInput. */
export function ChipsInput({
  valor, mudar, sugestoes, placeholder,
}: {
  valor: string[]; mudar: (v: string[]) => void; sugestoes?: string[]; placeholder?: string;
}) {
  return <CampoChips valor={valor} aoMudar={mudar} sugestoes={sugestoes} placeholder={placeholder} />;
}

/**
 * Janela modal padrão do app. Esc e clique fora fecham.
 * `largo`: true = formulários de duas colunas (~960px), "xl" = editores grandes (~1180px).
 */
export function Modal({
  titulo, descricao, aberto, fechar, children, largo, rodape, className,
}: {
  titulo: string; descricao?: ReactNode; aberto: boolean; fechar: () => void; children: ReactNode;
  largo?: boolean | "xl"; rodape?: ReactNode; className?: string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && fechar()}>
      <DialogContent
        className={cn(largo === "xl" ? "max-w-[1180px]" : largo ? "max-w-[960px]" : "max-w-lg", className)}
        onOpenAutoFocus={(e) => {
          // Foca o primeiro campo marcado com autoFocus; senão deixa o Radix decidir.
          const alvo = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-foco-inicial]");
          if (alvo) { e.preventDefault(); alvo.focus(); }
        }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        {rodape && <DialogFooter>{rodape}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// Utilidades
// =====================================================================

export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function Destaque({ texto, termo }: { texto: string; termo: string }) {
  if (!termo) return <>{texto}</>;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const i = norm(texto).indexOf(norm(termo));
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + termo.length)}</mark>
      {texto.slice(i + termo.length)}
    </>
  );
}

export function formatarTamanho(b?: number) {
  if (!b && b !== 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Selo de "feito" com animação, para comemorar sem exagero. */
export function SeloFeito({ className }: { className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn("inline-flex size-5 items-center justify-center rounded-full bg-sucesso text-white", className)}
    >
      <Check className="size-3" strokeWidth={3} />
    </motion.span>
  );
}
