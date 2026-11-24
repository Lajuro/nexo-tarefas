"use client";

// Reuniões de hoje (3.21): as reuniões marcadas na rotina, na tela Hoje, com quem participa, a pauta (o que
// lib/reuniao.ts já sabe montar, com Copiar) e o botão que leva ao modo reunião já com os participantes.
// Só aparece em dia que tem reunião. Uma reunião é um bloco da rotina com o campo opcional `reuniao`.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Presentation } from "lucide-react";
import { useRotinaDeHoje } from "@/components/jornada/Ferramenta";
import { useNexo } from "@/components/Provider";
import { ChipPessoa, Painel, copiarTexto } from "@/components/comum";
import { IconeCopiar, useCopiado } from "@/components/tarefa/Copilot";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type ReuniaoDoDia, duracao, reunioesDoDia } from "@/lib/jornada";
import { montarPauta, textoDaPauta } from "@/lib/reuniao";
import type { Tarefa } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** A pauta da reunião, num balão: o que revisar, com quem, e o botão de copiar. Montada só quando abre. */
function Pauta({ tarefa, participantes }: { tarefa: Tarefa; participantes: string[] }) {
  const { dados, toast } = useNexo();
  const [aberto, setAberto] = useState(false);
  const [copiado, marcar] = useCopiado();
  const texto = useMemo(() => (aberto && dados ? textoDaPauta(tarefa, montarPauta(dados, tarefa, participantes)) : ""), [aberto, dados, tarefa, participantes]);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-slot="pauta-da-reuniao"><ClipboardList /> Pauta</Button>
      </PopoverTrigger>
      <PopoverContent align="end" data-slot="popover" className="w-[420px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center gap-2 border-b px-3.5 py-2">
          <ClipboardList className="size-3.5 text-primary" />
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">Pauta</p>
          <Button variant="ghost" size="sm" data-slot="copiar-pauta"
            onClick={async () => ((await copiarTexto(texto)) ? marcar() : toast("Não consegui copiar automaticamente.", "erro"))}>
            <IconeCopiar copiado={copiado} /> {copiado ? "Copiada" : "Copiar"}
          </Button>
        </div>
        <pre data-slot="texto-da-pauta" className="max-h-[40vh] overflow-y-auto px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{texto}</pre>
      </PopoverContent>
    </Popover>
  );
}

const SELO: Record<ReuniaoDoDia["momento"], string> = {
  agora: "bg-info/14 text-info",
  "em-breve": "bg-alerta/16 text-alerta",
  depois: "bg-muted text-muted-foreground",
  passou: "bg-muted text-muted-foreground",
};

function Linha({ r, tarefa }: { r: ReuniaoDoDia; tarefa?: Tarefa }) {
  const { bloco, momento } = r;
  const gente = bloco.reuniao?.participantes ?? [];
  const selo = momento === "agora" ? "agora" : momento === "passou" ? "terminou" : momento === "em-breve" ? `em ${r.emQuanto} min` : `em ${duracao(r.emQuanto)}`;
  return (
    <li data-slot="reuniao-de-hoje" data-momento={momento} data-id={bloco.id} className={cn("flex flex-col gap-1.5 px-3.5 py-2.5", momento === "passou" && "opacity-60")}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{bloco.inicio} às {bloco.fim}</span>
          <span className={cn("ml-auto inline-flex h-5 shrink-0 items-center rounded-md px-1.5 font-medium", SELO[momento])}>{selo}</span>
        </p>
        <p className="mt-0.5 text-[13px] leading-snug font-medium [overflow-wrap:anywhere]">{bloco.titulo || "Reunião"}</p>
        {tarefa && (
          <p className="truncate text-xs text-muted-foreground">
            <Link href={`/tarefas/${tarefa.id}`} className="rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">{tarefa.titulo}</Link>
          </p>
        )}
        {gente.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {gente.slice(0, 4).map((p) => <ChipPessoa key={p} nome={p} href={`/pessoas?p=${encodeURIComponent(p)}`} />)}
            {gente.length > 4 && <span className="inline-flex h-6 items-center px-1 text-xs text-muted-foreground">e mais {gente.length - 4}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tarefa ? (
          <>
            <Pauta tarefa={tarefa} participantes={gente} />
            {momento !== "passou" && (
              <Button asChild size="sm" variant={momento === "agora" || momento === "em-breve" ? "default" : "outline"} data-slot="comecar-reuniao">
                <Link href={`/tarefas/${tarefa.id}/reuniao?bloco=${encodeURIComponent(bloco.id)}`}>{momento === "agora" ? "Entrar" : "Começar"} <ArrowRight /></Link>
              </Button>
            )}
          </>
        ) : (
          <Button asChild variant="ghost" size="sm"><Link href="/rotina">Sem tarefa: ligar na rotina <ArrowRight /></Link></Button>
        )}
      </div>
    </li>
  );
}

/** Há reunião no plano de hoje? (A tela Hoje só reserva o espaço do bloco quando há.) */
export function useReunioesDeHoje(): ReuniaoDoDia[] {
  const { blocos, agora } = useRotinaDeHoje();
  return useMemo(() => reunioesDoDia(blocos, agora), [blocos, agora]);
}

export function ReunioesDeHoje({ reunioes }: { reunioes: ReuniaoDoDia[] }) {
  const { dados } = useNexo();
  if (!reunioes.length) return null;
  const tarefaDe = (id: string | null) => (id ? dados?.tarefas.find((t) => t.id === id) : undefined);
  return (
    <Painel titulo="Reuniões de hoje" icone={<Presentation />} contagem={reunioes.length} corpoClassName="p-0"
      acoes={<Button asChild variant="ghost" size="sm"><Link href="/rotina">Rotina <ArrowRight /></Link></Button>}>
      <ul data-slot="reunioes-de-hoje" className="divide-y">
        {reunioes.map((r) => <Linha key={r.bloco.id} r={r} tarefa={tarefaDe(r.tarefaId)} />)}
      </ul>
    </Painel>
  );
}
