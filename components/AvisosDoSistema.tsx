"use client";

// Lembretes críticos novos pelo Windows (3.7). Montado uma vez no Shell. Só manda aviso de um lembrete que
// apareceu enquanto o Nexo estava em segundo plano: o que estava na tela quando a janela tinha foco já foi
// visto (sino e tela Hoje), então não vira notificação. Cada lembrete avisa uma vez por dia
// ("nexo:notificados", lido como lista de textos). Também atende o clique numa notificação ("nexo:ir").

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLembretes } from "./useLembretes";
import { useHoje } from "./useHoje";
import { gravarPref, lerPref } from "@/lib/preferencias";
import { NOTIFICACOES_PADRAO, normalizarNotificacoes, notificar } from "@/lib/notificar";

interface Notificados { data: string; ids: string[] }

function lerNotificados(hoje: string): Set<string> {
  const x = lerPref<unknown>("notificados", null) as Partial<Notificados> | null;
  if (!x || x.data !== hoje || !Array.isArray(x.ids)) return new Set();
  return new Set(x.ids.filter((i): i is string => typeof i === "string").slice(-500));
}

/** Rota interna e fixa: começa com "/" (e não "//"), sem esquema. É o que o app aceita abrir pelo clique na notificação. */
const rotaInterna = (r: unknown): r is string => typeof r === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(r);

export function AvisosDoSistema() {
  const { lembretes } = useLembretes();
  const hoje = useHoje();
  const router = useRouter();

  useEffect(() => {
    const ir = (e: Event) => {
      const rota = (e as CustomEvent<{ rota?: unknown }>).detail?.rota;
      if (rotaInterna(rota)) router.push(rota);
    };
    window.addEventListener("nexo:ir", ir);
    return () => window.removeEventListener("nexo:ir", ir);
  }, [router]);

  useEffect(() => {
    const pref = normalizarNotificacoes(lerPref("notificacoes", NOTIFICACOES_PADRAO));
    const criticos = lembretes.filter((l) => l.gravidade === "critico");
    const ja = lerNotificados(hoje);
    const novos = criticos.filter((l) => !ja.has(l.id));
    if (!novos.length) return;
    const emSegundoPlano = document.visibilityState !== "visible" || !document.hasFocus();
    if (pref.ligado && pref.lembretes && emSegundoPlano) {
      if (novos.length <= 3) for (const l of novos) notificar("lembretes", l.titulo, l.tarefaTitulo, { tag: `lembrete:${l.id}`, rota: l.tarefaId ? `/tarefas/${l.tarefaId}` : "/" });
      else notificar("lembretes", `${novos.length} coisas pedem sua atenção`, novos.slice(0, 3).map((l) => `${l.titulo}: ${l.tarefaTitulo}`).join("\n"), { tag: `lembretes:${hoje}`, rota: "/" });
    }
    // com a janela à vista, o que está no sino conta como visto; em segundo plano, como avisado
    gravarPref<Notificados>("notificados", { data: hoje, ids: [...ja, ...novos.map((l) => l.id)].slice(-500) });
  }, [lembretes, hoje]);

  return null;
}
