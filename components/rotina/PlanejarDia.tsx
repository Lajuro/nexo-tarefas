"use client";

// Ritual "Planejar o dia": três passos curtos para começar o dia sabendo o que fazer.
//   1. O que ficou para trás (prazos vencidos, follow-ups e passos atrasados): decidir ali mesmo.
//   2. Escolher os focos de hoje (no máximo 3, sem bloquear quem quiser mais).
//   3. Resumo com o próximo passo de cada foco.
// O Shell monta este componente e decide quando abrir. Concluir ou fechar conta como "planejei hoje".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ArrowLeft, Sunrise } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Button } from "@/components/ui/button";
import { CampoSwitch } from "@/components/ui/controles";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/diversos";
import { dataLonga, plural } from "@/components/hoje/apoio";
import { comFoco } from "@/lib/acoes";
import { curva } from "@/lib/animacoes";
import { aberta } from "@/lib/lembretes";
import { ROTINA_PADRAO, useRotina } from "@/lib/preferencias";
import { Tarefa, hojeISO } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { EtapaAtras, coletarPendencias, contarPendencias } from "./EtapaAtras";
import { EtapaFocos, candidatosAFoco } from "./EtapaFocos";
import { EtapaPronto } from "./EtapaPronto";

const ETAPAS = ["O que ficou para trás", "Seus focos", "Pronto"];

const deslizar: Variants = {
  entra: (d: number) => ({ opacity: 0, x: 28 * d }),
  centro: { opacity: 1, x: 0, transition: { duration: 0.22, ease: curva } },
  sai: (d: number) => ({ opacity: 0, x: -28 * d, transition: { duration: 0.13, ease: "easeIn" } }),
};

export function PlanejarDia({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const { setRotina } = useRotina();
  const avancar = useRef<() => void>(() => {});

  const encerrar = useCallback(() => {
    setRotina((r) => ({ ...ROTINA_PADRAO, ...r, ultimoPlanejamento: hojeISO() }));
    fechar();
  }, [setRotina, fechar]);

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && encerrar()}>
      <DialogContent
        data-ritual="planejar-dia"
        className="h-[40rem] max-w-2xl"
        onOpenAutoFocus={(e) => {
          // O foco começa no botão principal: Enter já avança.
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-foco-inicial]")?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          const alvo = e.target as HTMLElement;
          // Seletores de data e menus abrem por cima (fora desta caixa): o Enter é deles.
          if (!e.currentTarget.contains(alvo)) return;
          // Segurar Enter não pode atravessar o ritual inteiro.
          if (e.repeat) return e.preventDefault();
          if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
          if (alvo.closest("input, textarea, [contenteditable='true']")) return;
          // Num botão focado, Enter aciona o próprio botão. Caixas de marcar usam Espaço, então Enter segue adiante.
          const controle = alvo.closest("button, a[href], [role='button']");
          if (controle && controle.getAttribute("role") !== "checkbox") return;
          e.preventDefault();
          avancar.current();
        }}
      >
        <Ritual encerrar={encerrar} registrarAvancar={(fn) => (avancar.current = fn)} />
      </DialogContent>
    </Dialog>
  );
}

/** Conteúdo do ritual. Só existe enquanto a janela está aberta, então cada abertura começa do zero. */
function Ritual({ encerrar, registrarAvancar }: { encerrar: () => void; registrarAvancar: (fn: () => void) => void }) {
  const { dados, atualizarTarefa, toast } = useNexo();
  const { rotina, setRotina } = useRotina();
  const router = useRouter();
  const hoje = hojeISO();
  const tarefas = useMemo(() => dados?.tarefas ?? [], [dados?.tarefas]);
  const categorias = dados?.categorias.items ?? [];

  const [etapa, setEtapa] = useState(0);
  const [direcao, setDirecao] = useState(1);
  // Fotografia do que estava atrasado ao abrir: os itens resolvidos continuam na lista, riscados, em vez de sumir.
  const [pendencias] = useState(() => coletarPendencias(tarefas, hoje));
  // A lista de candidatos a foco é fixada na primeira vez que a etapa aparece, para nada trocar de lugar ao clicar.
  const [candidatos, setCandidatos] = useState<string[] | null>(null);

  // Marcação otimista dos focos: o clique responde na hora, mesmo se o disco (OneDrive) demorar.
  const [otimista, setOtimista] = useState<Record<string, boolean>>({});
  const emCurso = useRef<Record<string, number>>({});
  const ehFoco = useCallback((t: Tarefa) => otimista[t.id] ?? t.focoEm === hoje, [otimista, hoje]);
  const alternarFoco = useCallback(
    (t: Tarefa) => {
      const ligar = !ehFoco(t);
      setOtimista((o) => ({ ...o, [t.id]: ligar }));
      emCurso.current[t.id] = (emCurso.current[t.id] ?? 0) + 1;
      atualizarTarefa(t.id, (x) => comFoco(x, ligar)).finally(() => {
        if (--emCurso.current[t.id] > 0) return;
        setOtimista((o) => {
          const resto = { ...o };
          delete resto[t.id];
          return resto;
        });
      });
    },
    [atualizarTarefa, ehFoco],
  );

  const focos = useMemo(
    () => tarefas.filter((t) => aberta(t) && ehFoco(t)).sort((a, b) => b.prioridade - a.prioridade),
    [tarefas, ehFoco],
  );
  const contagem = contarPendencias(pendencias, tarefas, hoje);

  const corpo = useRef<HTMLDivElement>(null);
  const ultima = etapa === ETAPAS.length - 1;

  const ir = (destino: number) => {
    if (destino === etapa || destino < 0 || destino >= ETAPAS.length) return;
    if (destino >= 1 && !candidatos) setCandidatos(candidatosAFoco(tarefas, hoje));
    setDirecao(destino > etapa ? 1 : -1);
    setEtapa(destino);
  };

  const concluir = () => {
    toast(focos.length ? `Dia planejado com ${plural(focos.length, "foco", "focos")}. Bom trabalho!` : "Dia planejado. Bom trabalho!");
    encerrar();
  };

  const avancar = () => (ultima ? concluir() : ir(etapa + 1));
  useEffect(() => {
    registrarAvancar(avancar);
  });

  const abrirTarefa = (t: Tarefa) => {
    router.push(`/tarefas/${t.id}`);
    encerrar();
  };

  return (
    <>
      <header className="shrink-0 border-b px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 pr-10">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary dark:bg-primary/20 dark:text-foreground">
            <Sunrise className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <DialogTitle>Planejar o dia</DialogTitle>
            <DialogDescription className="mt-0.5 truncate">{dataLonga(hoje)}</DialogDescription>
          </div>
        </div>
        <nav aria-label="Etapas do planejamento" className="mt-3.5 grid grid-cols-3 gap-2">
          {ETAPAS.map((nome, i) => (
            <button
              key={nome}
              type="button"
              data-slot="ritual-etapa"
              aria-current={i === etapa ? "step" : undefined}
              onClick={() => ir(i)}
              className="group/etapa rounded-md text-left outline-none sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="block h-full rounded-full bg-primary"
                  initial={false}
                  animate={{ width: i <= etapa ? "100%" : "0%" }}
                  transition={{ duration: 0.3, ease: curva }}
                />
              </span>
              <span
                className={cn(
                  "mt-1.5 flex items-center gap-1.5 truncate text-xs font-medium transition-colors",
                  i === etapa ? "text-foreground" : "text-muted-foreground group-hover/etapa:text-foreground",
                )}
              >
                <span className="tabular-nums opacity-60">{i + 1}</span>
                <span className="truncate">{nome}</span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <DialogBody ref={corpo} className="overflow-x-hidden">
        <AnimatePresence mode="wait" custom={direcao} initial={false} onExitComplete={() => corpo.current?.scrollTo({ top: 0 })}>
          <motion.div key={etapa} data-slot="ritual-conteudo" data-etapa={etapa} custom={direcao} variants={deslizar} initial="entra" animate="centro" exit="sai">
            {etapa === 0 && (
              <EtapaAtras pendencias={pendencias} contagem={contagem} tarefas={tarefas} categorias={categorias} hoje={hoje} abrirTarefa={abrirTarefa} />
            )}
            {etapa === 1 && (
              <EtapaFocos candidatos={candidatos ?? []} tarefas={tarefas} categorias={categorias} ehFoco={ehFoco} alternar={alternarFoco} total={focos.length} />
            )}
            {etapa === 2 && (
              <EtapaPronto focos={focos} tarefas={tarefas} categorias={categorias} contagem={contagem} escolherFocos={() => ir(1)} />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogBody>

      <DialogFooter className="justify-between gap-4">
        <CampoSwitch
          marcado={rotina.abrirSozinho}
          aoMudar={(v) => setRotina((r) => ({ ...ROTINA_PADRAO, ...r, abrirSozinho: v }))}
          className="min-w-0 [&_label]:truncate [&_label]:text-xs"
        >
          Abrir sozinho na primeira visita do dia
        </CampoSwitch>
        <div className="flex shrink-0 items-center gap-2">
          {etapa > 0 && (
            <Button variant="ghost" onClick={() => ir(etapa - 1)}>
              <ArrowLeft /> Voltar
            </Button>
          )}
          <Button data-foco-inicial data-acao="ritual-avancar" onClick={avancar}>
            {ultima ? "Começar o dia" : "Continuar"}
            <Kbd className="border-white/20 bg-white/15 text-white">Enter</Kbd>
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
