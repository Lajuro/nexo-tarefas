"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { campoBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// Calendário, seletor de data e seletor de hora próprios (nada de <input type="date">).
// Datas trafegam sempre como string "AAAA-MM-DD" no fuso local, igual ao resto do app.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const p2 = (n: number) => String(n).padStart(2, "0");
export const paraISO = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const deISO = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
};
export function somarDias(iso: string, dias: number) {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}
const hoje = () => paraISO(new Date());

/** "sex, 28 nov 2026" (ou sem o ano quando é o ano corrente). */
export function dataPorExtenso(iso: string) {
  const d = deISO(iso);
  const ano = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}${ano}`;
}

/** Aceita "28/11", "28/11/26", "28/11/2026", "28-11", "hoje", "amanha", "+3". Devolve ISO ou null. */
export function interpretarData(texto: string): string | null {
  const t = texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return null;
  if (t === "hoje") return hoje();
  if (t === "amanha") return somarDias(hoje(), 1);
  const mais = t.match(/^\+(\d{1,3})$/);
  if (mais) return somarDias(hoje(), Number(mais[1]));
  const m = t.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (ano < 100) ano += 2000;
  const d = new Date(ano, mes - 1, dia);
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return paraISO(d);
}

function Calendario({
  valor,
  aoMudar,
  className,
}: {
  valor: string | null;
  aoMudar: (iso: string) => void;
  className?: string;
}) {
  const base = valor ? deISO(valor) : new Date();
  const [mes, setMes] = React.useState({ a: base.getFullYear(), m: base.getMonth() });
  const [dir, setDir] = React.useState(0);
  const grade = React.useRef<HTMLDivElement>(null);
  const hj = hoje();

  React.useEffect(() => {
    if (!valor) return;
    const d = deISO(valor);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  }, [valor]);

  const mover = (delta: number) => {
    setDir(delta);
    setMes(({ a, m }) => {
      const d = new Date(a, m + delta, 1);
      return { a: d.getFullYear(), m: d.getMonth() };
    });
  };

  const primeiro = new Date(mes.a, mes.m, 1);
  const inicio = new Date(mes.a, mes.m, 1 - primeiro.getDay());
  const dias = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));

  const teclas = (e: React.KeyboardEvent, iso: string) => {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!passo) return;
    e.preventDefault();
    const alvo = somarDias(iso, passo);
    const d = deISO(alvo);
    if (d.getMonth() !== mes.m || d.getFullYear() !== mes.a) {
      setDir(passo > 0 ? 1 : -1);
      setMes({ a: d.getFullYear(), m: d.getMonth() });
    }
    requestAnimationFrame(() => grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${alvo}"]`)?.focus());
  };

  return (
    <div data-slot="calendario" className={cn("w-[252px] sem-selecao", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="pl-1 text-[13px] font-semibold capitalize">
          {MESES[mes.m]} <span className="font-normal text-muted-foreground">{mes.a}</span>
        </span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => { const d = new Date(); setDir(0); setMes({ a: d.getFullYear(), m: d.getMonth() }); }}
            className="h-6 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
            Hoje
          </button>
          <button type="button" aria-label="Mês anterior" onClick={() => mover(-1)}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => mover(1)}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground uppercase">
        {DIAS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${mes.a}-${mes.m}`}
            ref={grade}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {dias.map((d) => {
              const iso = paraISO(d);
              const fora = d.getMonth() !== mes.m;
              const sel = iso === valor;
              const eHoje = iso === hj;
              return (
                <button
                  key={iso}
                  type="button"
                  data-dia={iso}
                  tabIndex={sel || (!valor && eHoje) ? 0 : -1}
                  aria-label={dataPorExtenso(iso)}
                  aria-pressed={sel}
                  onClick={() => aoMudar(iso)}
                  onKeyDown={(e) => teclas(e, iso)}
                  className={cn(
                    "relative mx-auto inline-flex size-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    fora && "text-muted-foreground/45",
                    !sel && "hover:bg-accent",
                    sel && "bg-primary font-semibold text-primary-foreground shadow-xs",
                    eHoje && !sel && "font-semibold text-primary",
                  )}
                >
                  {d.getDate()}
                  {eHoje && !sel && <span className="absolute bottom-1 size-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SeletorData({
  valor,
  aoMudar,
  placeholder = "Sem data",
  limpavel = true,
  className,
  compacto,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  limpavel?: boolean;
  className?: string;
  /** Sem borda, para usar dentro de linhas e barras. */
  compacto?: boolean;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const escolher = (iso: string) => {
    aoMudar(iso);
    setAberto(false);
    setTexto("");
  };
  const atalhos: [string, string][] = [
    ["Hoje", hoje()],
    ["Amanhã", somarDias(hoje(), 1)],
    ["Em 1 semana", somarDias(hoje(), 7)],
    ["Em 15 dias", somarDias(hoje(), 15)],
  ];
  const digitado = interpretarData(texto);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          data-slot="seletor-data"
          data-valor={valor}
          className={cn(
            compacto
              ? "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
              : cn(campoBase, "flex h-8 items-center gap-2 px-2.5 text-left sem-selecao"),
            !valor && !compacto && "text-muted-foreground/70",
            className,
          )}
        >
          <CalendarDays className="size-3.5 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{valor ? dataPorExtenso(valor) : placeholder}</span>
          {valor && limpavel && !compacto && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar data"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); aoMudar(""); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && digitado) { e.preventDefault(); escolher(digitado); }
          }}
          placeholder="Digite 28/11, amanhã, +7..."
          aria-label="Digitar data"
          className={cn(campoBase, "mb-2 h-7 px-2 text-xs")}
        />
        {texto && (
          <p className="mb-2 px-1 text-[11px] text-muted-foreground">
            {digitado ? <>Enter para escolher <strong className="text-foreground">{dataPorExtenso(digitado)}</strong></> : "Não entendi essa data."}
          </p>
        )}
        <Calendario valor={valor || null} aoMudar={escolher} />
        <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
          {atalhos.map(([nome, iso]) => (
            <button key={nome} type="button" onClick={() => escolher(iso)}
              className="h-6 rounded-md bg-muted px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              {nome}
            </button>
          ))}
          {limpavel && valor && (
            <button type="button" onClick={() => escolher("")}
              className="ml-auto h-6 rounded-md px-2 text-[11px] font-medium text-destructive hover:bg-destructive/10">
              Limpar
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SeletorHora({
  valor,
  aoMudar,
  placeholder = "Sem hora",
  className,
  id,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [h, m] = valor ? valor.split(":") : ["", ""];
  const horas = Array.from({ length: 24 }, (_, i) => p2(i));
  const minutos = Array.from({ length: 12 }, (_, i) => p2(i * 5));
  const colH = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!aberto) return;
    const alvo = h || p2(new Date().getHours());
    requestAnimationFrame(() => colH.current?.querySelector(`[data-h="${alvo}"]`)?.scrollIntoView({ block: "center" }));
  }, [aberto, h]);

  const coluna = "flex h-48 w-14 flex-col gap-0.5 overflow-y-auto pr-0.5";
  const celula = (ativo: boolean) =>
    cn("h-7 shrink-0 rounded-md text-[13px] tabular-nums transition-colors",
      ativo ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent");

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" id={id} data-slot="seletor-hora" data-valor={valor}
          className={cn(campoBase, "flex h-8 items-center gap-2 px-2.5 text-left sem-selecao", !valor && "text-muted-foreground/70", className)}>
          <Clock className="size-3.5 shrink-0 opacity-60" />
          <span className="flex-1 tabular-nums">{valor || placeholder}</span>
          {valor && (
            <span role="button" tabIndex={-1} aria-label="Limpar hora"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); aoMudar(""); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mr-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="flex gap-1 sem-selecao">
          <div ref={colH} className={coluna}>
            {horas.map((x) => (
              <button key={x} type="button" data-h={x} className={celula(x === h)} onClick={() => aoMudar(`${x}:${m || "00"}`)}>{x}</button>
            ))}
          </div>
          <div className={cn(coluna, "border-l pl-1")}>
            {minutos.map((x) => (
              <button key={x} type="button" className={celula(x === m)}
                onClick={() => { aoMudar(`${h || p2(new Date().getHours())}:${x}`); setAberto(false); }}>
                {x}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { Calendario, SeletorData, SeletorHora };
