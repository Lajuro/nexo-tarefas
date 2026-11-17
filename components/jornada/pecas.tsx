"use client";

// Peças comuns da jornada (rotina do dia e ponto): o relógio que anda sozinho, o acesso aos dados,
// as ações do ponto e o campo de hora digitável.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coffee, ListTodo, type LucideIcon, Wrench } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Input } from "@/components/ui/input";
import {
  type Jornada, comConfig, comDia, comDiaReaberto, comEntrada, comPausaEncerrada, comPausaIniciada, comSaida, contarPonto, diaDe, duracao, emHora, lerHora, lerJornada,
} from "@/lib/jornada";
import type { ConfigDaJornada, DiaDaJornada, TipoDeBloco } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const minutoDeAgora = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** A hora de agora, "HH:MM". */
export const horaDeAgora = () => emHora(minutoDeAgora());

/**
 * O minuto do dia (0 a 1439), que anda sozinho. Confere a cada 15 segundos e quando a janela volta a
 * ter foco: o relógio de uma janela em segundo plano pode atrasar.
 */
export function useMinuto(): number {
  const [min, setMin] = useState(minutoDeAgora);
  useEffect(() => {
    const conferir = () => setMin(minutoDeAgora());
    const id = setInterval(conferir, 15_000);
    document.addEventListener("visibilitychange", conferir);
    window.addEventListener("focus", conferir);
    conferir();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", conferir);
      window.removeEventListener("focus", conferir);
    };
  }, []);
  return min;
}

/** A jornada lida dos dados e as duas gravações: de um dia e da configuração. */
export function useJornada() {
  const { dados, salvarJornada } = useNexo();
  const jornada: Jornada = useMemo(() => lerJornada(dados?.jornada), [dados?.jornada]);
  /** Muda um dia. A função recebe o dia e a configuração mais recentes. */
  const salvarDia = useCallback(
    (data: string, fn: (dia: DiaDaJornada, config: ConfigDaJornada) => DiaDaJornada) =>
      salvarJornada((items) => {
        const config = lerJornada({ rev: 0, items }).config;
        return comDia(items, data, (dia) => fn(dia, config));
      }),
    [salvarJornada],
  );
  const salvarConfig = useCallback((fn: (c: ConfigDaJornada) => ConfigDaJornada) => salvarJornada((items) => comConfig(items, fn)), [salvarJornada]);
  return { jornada, salvarDia, salvarConfig, pronta: !!dados, ilegivel: (dados?.jornada?.rev ?? 0) < 0 };
}

/** As ações do ponto de um dia, com o aviso do que mudou. Sem hora informada, vale a hora de agora. */
export function usePonto(data: string) {
  const { toast } = useNexo();
  const { jornada, salvarDia } = useJornada();
  const entrar = useCallback(
    async (hora = horaDeAgora()) => {
      let previsao = "";
      const ok = await salvarDia(data, (dia, config) => {
        const novo = comEntrada(dia, hora, config);
        const conta = contarPonto(config, novo, data, null);
        previsao = conta.saidaPrevista != null ? `Com ${duracao(conta.esperado)} de trabalho e ${duracao(conta.pausaNaPrevisao)} de pausa, você sai às ${emHora(conta.saidaPrevista)}.` : "Hoje não é dia de expediente: o que você trabalhar conta como hora extra.";
        return novo;
      });
      if (ok) toast(`Entrada às ${hora}. ${previsao}`);
    },
    [data, salvarDia, toast],
  );
  const pausar = useCallback(
    async (hora = horaDeAgora()) => {
      if (await salvarDia(data, (dia) => comPausaIniciada(dia, hora))) toast(`Pausa às ${hora}.`);
    },
    [data, salvarDia, toast],
  );
  const voltar = useCallback(
    async (hora = horaDeAgora()) => {
      if (await salvarDia(data, (dia) => comPausaEncerrada(dia, hora))) toast(`De volta às ${hora}.`);
    },
    [data, salvarDia, toast],
  );
  const sair = useCallback(
    async (hora = horaDeAgora()) => {
      const entrada = diaDe(jornada, data).ponto.entrada;
      if (entrada && hora <= entrada) {
        toast("A saída tem que ser depois da entrada. Ajuste os horários do dia.", "erro");
        return;
      }
      if (await salvarDia(data, (dia) => comSaida(dia, hora))) toast(`Dia encerrado às ${hora}.`);
    },
    [data, jornada, salvarDia, toast],
  );
  const reabrir = useCallback(() => salvarDia(data, (dia) => comDiaReaberto(dia)), [data, salvarDia]);
  return { entrar, pausar, voltar, sair, reabrir };
}

export const VISUAL_DO_BLOCO: Record<TipoDeBloco, { nome: string; icone: LucideIcon; caixa: string; texto: string; ponto: string }> = {
  tarefa: { nome: "Tarefa", icone: ListTodo, caixa: "border-primary/35 bg-primary/10 hover:border-primary/60", texto: "text-primary", ponto: "bg-primary" },
  atividade: { nome: "Atividade", icone: Wrench, caixa: "border-info/35 bg-info/10 hover:border-info/60", texto: "text-info", ponto: "bg-info" },
  pausa: { nome: "Pausa", icone: Coffee, caixa: "border-border bg-muted/70 hover:border-foreground/25", texto: "text-muted-foreground", ponto: "bg-muted-foreground/60" },
};

/**
 * Campo de hora digitável: aceita "8", "815", "8:15" e "08h15", e devolve "HH:MM" (ou "" vazio).
 * Avisa a mudança ao sair do campo ou no Enter; enquanto se digita, só quando o texto já é uma hora completa.
 */
export function CampoHora({
  valor, aoMudar, className, placeholder = "00:00", id, disabled, "aria-label": ariaLabel, autoFocus,
}: {
  valor: string; aoMudar: (v: string) => void; className?: string; placeholder?: string; id?: string; disabled?: boolean; "aria-label"?: string; autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  const confirmar = () => {
    if (!texto.trim()) {
      if (valor) aoMudar("");
      return;
    }
    const h = lerHora(texto);
    if (!h) return setTexto(valor);
    setTexto(h);
    if (h !== valor) aoMudar(h);
  };
  return (
    <Input
      id={id}
      data-slot="campo-hora"
      aria-label={ariaLabel}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      maxLength={5}
      placeholder={placeholder}
      value={texto}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t) && t !== valor) aoMudar(t);
      }}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          confirmar();
        }
      }}
      className={cn("w-[4.6rem] text-center tabular-nums", className)}
    />
  );
}
