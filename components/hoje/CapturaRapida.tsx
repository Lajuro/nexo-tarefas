"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Target } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { MenuContextoTarefa } from "@/components/MenuTarefa";
import { IconeStatus } from "@/components/comum";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { comFoco, ehFocoHoje, tarefaRapida } from "@/lib/acoes";
import { suave } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { cn } from "@/lib/utils";

/**
 * Campo sempre à mão: escreveu, apertou Enter, virou tarefa "A fazer".
 * Não sai da tela. O que foi anotado agora fica logo abaixo para dar a certeza de que entrou.
 */
export function CapturaRapida({ className }: { className?: string }) {
  const { dados, estado, criarTarefa, atualizarTarefa, toast } = useNexo();
  const [texto, setTexto] = useState("");
  const [recentes, setRecentes] = useState<string[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  const bloqueado = !!estado?.somenteLeitura;

  async function anotar() {
    const titulo = texto.trim().replace(/\s+/g, " ");
    if (!titulo) return;
    // Limpa na hora para dar para emendar a próxima; se a gravação falhar, o texto volta.
    setTexto("");
    const criada = await criarTarefa(tarefaRapida(titulo));
    if (criada) {
      setRecentes((r) => [criada.id, ...r].slice(0, 4));
      toast(`“${criada.titulo}” anotada em A fazer.`);
    } else {
      setTexto((atual) => atual || titulo);
    }
  }

  const anotadas = recentes
    .map((id) => dados?.tarefas.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <div data-slot="captura-rapida" className={className}>
      <div
        className={cn(
          "group/captura flex h-11 items-center gap-2.5 rounded-xl border bg-card pr-3 pl-2.5 shadow-xs transition-[border-color,box-shadow] duration-150",
          "hover:border-ring/40 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20 focus-within:hover:border-ring",
        )}
        onClick={() => campo.current?.focus()}
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-150 group-focus-within/captura:bg-primary group-focus-within/captura:text-primary-foreground">
          <Plus className="size-3.5" strokeWidth={2.5} />
        </span>
        <Input
          ref={campo}
          value={texto}
          disabled={bloqueado}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              anotar();
            } else if (e.key === "Escape" && texto) {
              e.stopPropagation();
              setTexto("");
            }
          }}
          maxLength={200}
          aria-label="Captura rápida de tarefa"
          placeholder={bloqueado ? "Dados em somente leitura" : "Anote uma tarefa e aperte Enter"}
          className="h-full flex-1 border-0 bg-transparent px-0 text-sm shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        />
        <AnimatePresence initial={false}>
          {texto.trim() && (
            <motion.span
              key="dica"
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15 }}
              className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sem-selecao"
            >
              <Kbd>Enter</Kbd> para anotar
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {anotadas.length > 0 && (
          <motion.div
            key="recentes"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={suave}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2">
              <span className="mr-0.5 text-[11px] text-muted-foreground sem-selecao">Anotadas agora</span>
              <AnimatePresence initial={false} mode="popLayout">
                {anotadas.map((t) => {
                  const foco = ehFocoHoje(t);
                  return (
                    <motion.span
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={suave}
                      data-slot="anotada"
                      className="inline-flex h-6 max-w-64 items-center rounded-full border bg-card pr-0.5 pl-2 text-xs shadow-xs"
                    >
                      <MenuContextoTarefa tarefa={t}>
                        <Link
                          href={`/tarefas/${t.id}`}
                          className="flex min-w-0 items-center gap-1.5 rounded-sm font-medium outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/35"
                        >
                          <IconeStatus status={t.status} className="size-3" />
                          <span className="truncate">{t.titulo}</span>
                        </Link>
                      </MenuContextoTarefa>
                      {aberta(t) && (
                        <Dica texto={foco ? "Tirar do foco de hoje" : "Focar hoje"}>
                          <button
                            type="button"
                            aria-label={foco ? "Tirar do foco de hoje" : "Focar hoje"}
                            aria-pressed={foco}
                            onClick={() => atualizarTarefa(t.id, (x) => comFoco(x, !foco))}
                            className={cn(
                              "ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/35",
                              foco ? "text-primary" : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Target className="size-3" />
                          </button>
                        </Dica>
                      )}
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
