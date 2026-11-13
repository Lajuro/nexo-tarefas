"use client";

// Peças pequenas compartilhadas pela tela Hoje e pelo ritual "Planejar o dia".

import { useEffect, useState } from "react";
import {
  AlarmClock, Ban, CalendarClock, CalendarX2, CirclePause, Footprints, History, Hourglass, ListTodo, type LucideIcon,
} from "lucide-react";
import { deISO } from "@/components/ui/data";
import { Badge } from "@/components/ui/diversos";
import type { Gravidade, TipoLembrete } from "@/lib/lembretes";

const FORMATO_LONGO = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/** "sexta-feira, 13 de novembro". */
export function dataLonga(iso: string) {
  return FORMATO_LONGO.format(deISO(iso));
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Relógio que anda sozinho: a tela fica aberta o dia todo e a saudação e o "hoje" precisam acompanhar. */
export function useAgora(intervaloMs = 60_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export const ICONE_LEMBRETE: Record<TipoLembrete, LucideIcon> = {
  prazo_vencido: CalendarX2,
  prazo_hoje: CalendarClock,
  prazo_proximo: CalendarClock,
  passo_vencido: ListTodo,
  passo_hoje: ListTodo,
  followup: AlarmClock,
  bloqueada: Ban,
  aguardando: Hourglass,
  parada: CirclePause,
  passos_antigos: History,
  sem_proximo_passo: Footprints,
};

export const TOM_GRAVIDADE: Record<Gravidade, string> = {
  critico: "bg-destructive/12 text-destructive",
  atencao: "bg-alerta/16 text-alerta",
  info: "bg-info/14 text-info",
};

type TomMotivo = "perigo" | "alerta" | "info" | "default" | "secondary";

/** Cor da etiqueta de cada motivo devolvido por sugestoesDeFoco(). */
export function tomDoMotivo(motivo: string): TomMotivo {
  if (/^atrasada|prazo hoje/.test(motivo)) return "perigo";
  if (/^prazo|cobrar/.test(motivo)) return "alerta";
  if (/follow-up/.test(motivo)) return "info";
  if (/^prioridade/.test(motivo)) return "default";
  return "secondary";
}

export function EtiquetasMotivo({ motivos }: { motivos: string[] }) {
  return (
    <>
      {motivos.map((m) => (
        <Badge key={m} variant={tomDoMotivo(m)}>{m}</Badge>
      ))}
    </>
  );
}
