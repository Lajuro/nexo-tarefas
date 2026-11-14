"use client";

// Sessão de foco: um cronômetro para trabalhar numa tarefa sem interrupção. Quando acaba, o Nexo pergunta
// "o que saiu?" e registra uma atividade com a duração na linha do tempo. É o jeito mais barato de a tarefa
// ganhar histórico: o registro nasce no fim do trabalho, com uma frase.
//
// O estado mora no navegador ("nexo:sessao"): F5 ou fechar a janela não perdem o cronômetro nem o que foi
// escrito. O tempo é sempre calculado a partir da hora de início, então aba em segundo plano não atrasa nada.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Plus, Square, Timer } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useConfirmar } from "@/components/Raiz";
import { Campo, Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dica, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { comSessaoDeFoco, formatarMinutos } from "@/lib/acoes";
import { suave } from "@/lib/animacoes";
import { gravarPref, lerPref, usePref } from "@/lib/preferencias";
import { cn } from "@/lib/utils";
import { nomeDaRota } from "./navegacao";

export interface Sessao {
  tarefaId: string;
  /** Quando começou (ms). */
  inicio: number;
  /** Quantos minutos o usuário se propôs a ficar. */
  alvoMin: number;
  /** Quando foi encerrada (ms). Sem isso, está correndo. */
  fim?: number;
  /** O que o usuário escreveu que saiu da sessão, enquanto não registra. */
  nota?: string;
}

export const DURACOES = [15, 25, 50] as const;

function sessaoValida(x: unknown): Sessao | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Partial<Sessao>;
  if (typeof s.tarefaId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.tarefaId)) return null;
  const inicio = Number(s.inicio);
  const alvoMin = Number(s.alvoMin);
  if (!Number.isFinite(inicio) || inicio <= 0 || !Number.isFinite(alvoMin) || alvoMin < 1 || alvoMin > 600) return null;
  const fim = Number(s.fim);
  return { tarefaId: s.tarefaId, inicio, alvoMin: Math.round(alvoMin), fim: Number.isFinite(fim) && fim > inicio ? fim : undefined, nota: typeof s.nota === "string" ? s.nota.slice(0, 5000) : "" };
}

/**
 * Começa uma sessão de foco na tarefa. Devolve false se já existe uma em andamento
 * (uma de cada vez: a ideia é justamente não dividir a atenção).
 */
export function iniciarSessao(tarefaId: string, minutos: number): boolean {
  if (sessaoValida(lerPref<unknown>("sessao", null))) return false;
  gravarPref<Sessao>("sessao", { tarefaId, inicio: Date.now(), alvoMin: minutos, nota: "" });
  return true;
}

const p2 = (n: number) => String(n).padStart(2, "0");
const relogio = (seg: number) => `${p2(Math.floor(Math.abs(seg) / 60))}:${p2(Math.abs(seg) % 60)}`;

export function SessaoFoco() {
  const { dados, atualizarTarefa, toast } = useNexo();
  const confirmar = useConfirmar();
  const pathname = usePathname();
  const [bruta, setBruta] = usePref<unknown>("sessao", null);
  const sessao = sessaoValida(bruta);
  const [agora, setAgora] = useState(() => Date.now());
  const [balao, setBalao] = useState(false);
  const [janela, setJanela] = useState(false);
  const avisou = useRef(0);
  const tarefa = sessao ? dados?.tarefas.find((t) => t.id === sessao.tarefaId) : undefined;

  const correndo = !!sessao && !sessao.fim;
  const restante = sessao ? Math.ceil((sessao.inicio + sessao.alvoMin * 60_000 - (sessao.fim ?? agora)) / 1000) : 0;
  const decorridoMin = sessao ? Math.max(1, Math.round(((sessao.fim ?? agora) - sessao.inicio) / 60_000)) : 0;
  const mudar = (parte: Partial<Sessao>) => sessao && setBruta({ ...sessao, ...parte });

  useEffect(() => {
    if (!correndo) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [correndo]);

  // Tempo esgotado: avisa uma vez e abre a pergunta "o que saiu?". O cronômetro segue contando o tempo a mais.
  useEffect(() => {
    if (!sessao || !correndo || restante > 0 || avisou.current === sessao.inicio) return;
    avisou.current = sessao.inicio;
    toast(`Sessão de foco: os ${sessao.alvoMin} minutos acabaram.`, "info");
    setJanela(true);
  }, [sessao, correndo, restante, toast]);

  // O título da janela mostra o tempo, para dar para acompanhar com o Nexo em segundo plano.
  useEffect(() => {
    const base = `${nomeDaRota(pathname)} · Nexo`;
    document.title = correndo ? `${restante < 0 ? "+" : ""}${relogio(restante)} · foco · Nexo` : base;
    return () => {
      document.title = base;
    };
  }, [correndo, restante, pathname]);

  // A tarefa sumiu (foi para a lixeira ou juntada em outra): a sessão não tem mais onde ser registrada.
  useEffect(() => {
    if (sessao && dados && !tarefa) setBruta(null);
  }, [sessao, dados, tarefa, setBruta]);

  if (!sessao || !tarefa) return null;

  const encerrar = () => {
    if (!sessao.fim) mudar({ fim: Date.now() });
    setBalao(false);
    setJanela(true);
  };
  const continuar = (min: number) => {
    // volta a correr: o alvo passa a ser o que já foi feito mais o tempo extra
    setBruta({ ...sessao, fim: undefined, alvoMin: Math.round((Date.now() - sessao.inicio) / 60_000) + min });
    setJanela(false);
  };
  const registrar = async () => {
    const fim = sessao.fim ?? Date.now();
    const minutos = Math.max(1, Math.round((fim - sessao.inicio) / 60_000));
    if (!(await atualizarTarefa(tarefa.id, (t) => comSessaoDeFoco(t, minutos, sessao.nota ?? "")))) return;
    setBruta(null);
    setJanela(false);
    toast(`${formatarMinutos(minutos)} de foco registrados na linha do tempo.`);
  };
  const descartar = async () => {
    if ((sessao.nota ?? "").trim()) {
      const ok = await confirmar({
        titulo: "Jogar esta sessão fora?",
        descricao: "O tempo e o que você escreveu sobre ela não vão para a linha do tempo da tarefa.",
        confirmar: "Descartar",
        cancelar: "Voltar",
        perigo: true,
      });
      if (!ok) return;
    }
    setBruta(null);
    setJanela(false);
  };

  const parte = Math.min(1, Math.max(0, 1 - restante / (sessao.alvoMin * 60)));
  const c = 2 * Math.PI * 6;
  const estourou = restante <= 0;

  return (
    <>
      <AnimatePresence>
        <motion.div key="sessao" initial={{ opacity: 0, scale: 0.85, width: 0 }} animate={{ opacity: 1, scale: 1, width: "auto" }} exit={{ opacity: 0, scale: 0.85, width: 0 }}
          transition={suave} className="flex shrink-0 items-center">
          <Popover open={balao} onOpenChange={setBalao}>
            <Dica texto={correndo ? "Sessão de foco em andamento" : "Sessão de foco encerrada: falta registrar"}>
              <PopoverTrigger asChild>
                <button type="button" data-slot="sessao-foco" data-correndo={correndo || undefined} aria-label="Sessão de foco"
                  className={cn(
                    "inline-flex h-7 max-w-64 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-[border-color,background-color,transform] duration-150 outline-none sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35 active:scale-[0.97]",
                    estourou || !correndo ? "border-alerta/50 bg-alerta/12 text-foreground" : "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15",
                  )}>
                  <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 -rotate-90" aria-hidden>
                    <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.2" className="stroke-foreground/14" />
                    <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - parte)}
                      className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", estourou ? "stroke-alerta" : "stroke-primary")} />
                  </svg>
                  <span className="tabular-nums">{correndo ? `${estourou ? "+" : ""}${relogio(restante)}` : "Registrar"}</span>
                  <span className="hidden min-w-0 truncate font-normal text-muted-foreground xl:inline">{tarefa.titulo}</span>
                </button>
              </PopoverTrigger>
            </Dica>
            <PopoverContent align="end" data-slot="popover" className="w-[300px] p-0">
              <div className="px-3.5 pt-3 pb-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sem-selecao"><Timer className="size-3.5" /> Sessão de foco</p>
                <Link href={`/tarefas/${tarefa.id}`} onClick={() => setBalao(false)}
                  className="mt-1 block truncate rounded-sm text-[13px] font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">{tarefa.titulo}</Link>
                <p className="mt-2 text-3xl leading-none font-semibold tracking-tight tabular-nums">{estourou && correndo ? "+" : ""}{relogio(restante)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {correndo
                    ? estourou ? `Passou dos ${sessao.alvoMin} min combinados. Já são ${decorridoMin} min.` : `${decorridoMin} min de ${sessao.alvoMin}. Sem pressa: avise quando terminar.`
                    : `Encerrada com ${decorridoMin} min. Falta dizer o que saiu.`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 border-t bg-muted/40 px-3 py-2">
                {correndo && <Button size="sm" variant="ghost" onClick={() => mudar({ alvoMin: sessao.alvoMin + 5 })}><Plus /> 5 min</Button>}
                <span className="flex-1" />
                <Button size="sm" data-slot="encerrar-sessao" onClick={encerrar}>{correndo ? <><Square /> Encerrar</> : <><Check /> Registrar</>}</Button>
              </div>
            </PopoverContent>
          </Popover>
        </motion.div>
      </AnimatePresence>

      <Modal
        aberto={janela}
        fechar={() => setJanela(false)}
        titulo={`Sessão de foco: ${formatarMinutos(decorridoMin)}`}
        descricao={<>Em “{tarefa.titulo}”. Uma frase sobre o que saiu já vale: ela vira uma atividade na linha do tempo.</>}
        rodape={
          <>
            <Button variant="ghost" className="mr-auto" onClick={descartar}>Não registrar</Button>
            <Button variant="outline" onClick={() => continuar(10)}><Plus /> Mais 10 min</Button>
            <Button data-slot="registrar-sessao" onClick={registrar}>Registrar na tarefa</Button>
          </>
        }
      >
        <div
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              registrar();
            }
          }}
        >
          <Campo rotulo="O que saiu dessa sessão?" dica="Fica guardado aqui se você fechar esta janela. Para completar depois (decisões, próximos passos), edite a atividade na linha do tempo.">
            <Textarea autoFocus rows={4} data-slot="nota-sessao" aria-label="O que saiu dessa sessão" placeholder="Ex.: terminei o roteiro do encontro 1 e mandei para revisão."
              value={sessao.nota ?? ""} onChange={(e) => mudar({ nota: e.target.value })} />
          </Campo>
        </div>
      </Modal>
    </>
  );
}
