"use client";

// Moldura do app: barra lateral, barra superior, área da tela e barra de status.
// A janela nunca rola: cada tela (components/comum.tsx → Pagina) rola por dentro, como app de desktop.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, HardDrive, Loader2, Lock, TriangleAlert, X } from "lucide-react";
import { useNexo } from "./Provider";
import { TarefaForm } from "./TarefaForm";
import { PlanejarDia } from "./rotina/PlanejarDia";
import { NumeroAnimado, copiarTexto } from "./comum";
import { BarraSuperior } from "./shell/BarraSuperior";
import { abrirAnotar } from "./shell/Ferramentas";
import { Lateral } from "./shell/Lateral";
import { Paleta } from "./shell/Paleta";
import { Personalizar } from "./shell/Personalizar";
import { Carregando, JanelaAtalhos, Onboarding, TelaErro } from "./shell/Telas";
import { NAV, nomeDaRota } from "./shell/navegacao";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { Dica } from "@/components/ui/popover";
import { suave } from "@/lib/animacoes";
import { aberta, passosAbertosDe } from "@/lib/lembretes";
import { abrirPersonalizar, registrarRecente, useMoldura } from "@/lib/moldura";
import { usePref, useRotina } from "@/lib/preferencias";
import { useHoje } from "./useHoje";
import { MoverEJuntar } from "./MoverEJuntar";
import { Novidades } from "./shell/Novidades";
import { Esperando } from "./Esperando";
import { ModeloForm } from "./Modelos";
import { Celebracao } from "./jogo/Celebracao";
import { Confete } from "./jogo/pecas";
import { cn } from "@/lib/utils";
import versao from "@/package.json";

/** Abre o formulário de nova tarefa de qualquer lugar. */
export function abrirNovaTarefa(categoriaId?: string | null, modeloId?: string | null) {
  window.dispatchEvent(new CustomEvent("nexo:nova-tarefa", { detail: { categoriaId, modeloId } }));
}

/** Abre o ritual "Planejar o dia" de qualquer lugar. */
export function abrirPlanejarDia() {
  window.dispatchEvent(new CustomEvent("nexo:planejar-dia"));
}

/** Abre a paleta de comandos (Ctrl+K) de qualquer lugar. */
export function abrirPaleta() {
  window.dispatchEvent(new CustomEvent("nexo:paleta"));
}

const temAlgoAberto = () => !!document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-slot="popover"]');

export function Shell({ children }: { children: ReactNode }) {
  const { estado, dados, erro, recarregar } = useNexo();
  const pathname = usePathname();
  const router = useRouter();
  const [nova, setNova] = useState<{ aberto: boolean; cat?: string | null; modelo?: string | null }>({ aberto: false });
  const [ritual, setRitual] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [atalhos, setAtalhos] = useState(false);
  const [recolhida, setRecolhida] = usePref("lateralRecolhida", false);
  const [cheia, setCheia] = useState(false);
  const { rotina, carregado: rotinaCarregada } = useRotina();
  const { moldura } = useMoldura();
  const ultimoG = useRef(0);
  const ritualOferecido = useRef(""); // dia (AAAA-MM-DD) em que o ritual já foi oferecido
  const hoje = useHoje();

  const telaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const aoMudar = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  useEffect(() => {
    document.title = `${nomeDaRota(pathname)} · Nexo`;
    // Tarefa aberta entra em "Recentes" na barra lateral.
    const [, raiz, id] = pathname.split("/");
    if (raiz === "tarefas" && id) registrarRecente(id);
  }, [pathname]);

  useEffect(() => {
    const abrirNova = (e: Event) => setNova({ aberto: true, cat: (e as CustomEvent).detail?.categoriaId, modelo: (e as CustomEvent).detail?.modeloId });
    const abrirRitual = () => setRitual(true);
    const abrirPal = () => setPaleta(true);
    const teclas = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        setPaleta((p) => !p);
        return;
      }
      const alvo = e.target as HTMLElement;
      // dentro do editor de texto rico, Ctrl B é negrito
      if ((e.ctrlKey || e.metaKey) && k === "b" && !alvo.isContentEditable) {
        e.preventDefault();
        setRecolhida((r) => !r);
        return;
      }
      const digitando = ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable;
      if (digitando || e.ctrlKey || e.metaKey || e.altKey || temAlgoAberto()) return;

      if (Date.now() - ultimoG.current < 1200) {
        ultimoG.current = 0;
        const destino = NAV.flatMap((g) => g.itens).find((n) => n.tecla === k);
        if (destino) {
          e.preventDefault();
          router.push(destino.href);
          return;
        }
      }
      if (k === "g") ultimoG.current = Date.now();
      else if (e.key === "/") {
        e.preventDefault();
        setPaleta(true);
      } else if (k === "n") {
        e.preventDefault();
        setNova({ aberto: true });
      } else if (k === "d") {
        e.preventDefault();
        setRitual(true);
      } else if (k === "a") {
        e.preventDefault();
        abrirAnotar();
      } else if (e.key === "?") {
        e.preventDefault();
        setAtalhos(true);
      }
    };
    window.addEventListener("nexo:nova-tarefa", abrirNova);
    window.addEventListener("nexo:planejar-dia", abrirRitual);
    window.addEventListener("nexo:paleta", abrirPal);
    window.addEventListener("keydown", teclas);
    return () => {
      window.removeEventListener("nexo:nova-tarefa", abrirNova);
      window.removeEventListener("nexo:planejar-dia", abrirRitual);
      window.removeEventListener("nexo:paleta", abrirPal);
      window.removeEventListener("keydown", teclas);
    };
  }, [router, setRecolhida]);

  // Primeira visita do dia: oferece o ritual de planejar o dia (uma vez por dia, mesmo com o app aberto direto).
  const temAbertas = !!dados?.tarefas.some(aberta);
  useEffect(() => {
    if (ritualOferecido.current === hoje || !rotinaCarregada || !dados) return;
    if (!rotina.abrirSozinho || rotina.ultimoPlanejamento === hoje || !temAbertas || estado?.somenteLeitura) {
      ritualOferecido.current = hoje;
      return;
    }
    // Só marca como oferecido quando o tempo passa de fato: se o efeito for desfeito antes
    // (StrictMode ou dados recarregados), a próxima execução agenda de novo.
    const t = setTimeout(() => {
      ritualOferecido.current = hoje;
      if (!temAlgoAberto()) setRitual(true);
    }, 900);
    return () => clearTimeout(t);
  }, [hoje, rotinaCarregada, dados, rotina.abrirSozinho, rotina.ultimoPlanejamento, temAbertas, estado?.somenteLeitura]);

  if (!estado) return erro ? <TelaErro mensagem={erro} pasta={null} tentar={recarregar} /> : <Carregando />;
  if (!estado.configurado) return <Onboarding />;
  if (estado.erro || erro) return <TelaErro mensagem={estado.erro || erro || ""} pasta={estado.dataDir} tentar={recarregar} />;
  if (!dados) return <Carregando texto="Lendo seus dados..." />;

  return (
    <div data-slot="app" className="flex h-screen w-screen overflow-hidden bg-background">
      <Lateral
        recolhida={recolhida}
        alternar={() => setRecolhida((r) => !r)}
        novaTarefa={() => setNova({ aberto: true })}
        abrirPaleta={() => setPaleta(true)}
        planejarDia={() => setRitual(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior
          recolhida={recolhida}
          alternarLateral={() => setRecolhida((r) => !r)}
          abrirPaleta={() => setPaleta(true)}
          abrirAtalhos={() => setAtalhos(true)}
          cheia={cheia}
          telaCheia={telaCheia}
          planejarDia={() => setRitual(true)}
        />
        <Avisos />
        <main data-slot="conteudo" className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
        <AnimatePresence initial={false}>
          {moldura.barraStatus && (
            <motion.div key="status" initial={{ height: 0, opacity: 0 }} animate={{ height: 24, opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={suave}
              className="shrink-0 overflow-hidden">
              <BarraStatus />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <TarefaForm aberto={nova.aberto} categoriaInicial={nova.cat} modeloInicial={nova.modelo} fechar={() => setNova({ aberto: false })} />
      <PlanejarDia aberto={ritual} fechar={() => setRitual(false)} />
      <MoverEJuntar />
      <Esperando />
      <ModeloForm />
      <Celebracao />
      <Confete />
      <Personalizar />
      <JanelaAtalhos aberto={atalhos} fechar={() => setAtalhos(false)} />
      <Novidades />
      <Paleta
        aberta={paleta}
        fechar={() => setPaleta(false)}
        acoes={{
          novaTarefa: () => setNova({ aberto: true }),
          planejarDia: () => setRitual(true),
          alternarLateral: () => setRecolhida((r) => !r),
          telaCheia,
          anotar: abrirAnotar,
          personalizar: () => abrirPersonalizar("aparencia"),
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Faixas de aviso: somente leitura (dados de versão mais nova) e arquivos com problema. */
function Avisos() {
  const { estado, dados } = useNexo();
  const [dispensado, setDispensado] = useState("");
  const avisos = dados?.avisos ?? [];
  const chave = avisos.join("|");
  return (
    <>
      {estado?.somenteLeitura && (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-[13px] text-destructive">
          <Lock className="size-4 shrink-0" />
          <span>
            Estes dados foram gravados por uma versão mais nova do Nexo (formato v{estado.schemaDados}). Estou em <strong>somente leitura</strong> para não
            estragar nada. Atualize o app.
          </span>
        </div>
      )}
      {avisos.length > 0 && dispensado !== chave && (
        <Collapsible className="shrink-0 border-b border-alerta/30 bg-alerta/12 text-[13px]">
          <div className="flex items-center gap-2 px-4 py-1.5">
            <TriangleAlert className="size-4 shrink-0 text-alerta" />
            <span className="flex-1 font-medium">
              {avisos.length === 1 ? "Um arquivo precisa da sua atenção" : `${avisos.length} arquivos precisam da sua atenção`}
            </span>
            <CollapsibleTrigger asChild><Button variant="ghost" size="sm">Ver detalhes</Button></CollapsibleTrigger>
            <Dica texto="Esconder este aviso">
              <Button variant="ghost" size="icon-sm" aria-label="Esconder este aviso" onClick={() => setDispensado(chave)}><X /></Button>
            </Dica>
          </div>
          <CollapsibleContent>
            <ul className="flex list-disc flex-col gap-1 px-10 pb-2.5 text-muted-foreground">
              {avisos.map((a) => <li key={a} className="texto-pre">{a}</li>)}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

/** Rodapé fino, como em app de desktop: onde os dados moram, se já salvou, e os números do momento. */
function BarraStatus() {
  const { estado, dados, gravando, ultimaGravacao, toast } = useNexo();
  const tarefas = dados?.tarefas ?? [];
  const abertas = tarefas.filter(aberta).length;
  const pend = passosAbertosDe(tarefas).length;
  const hora = ultimaGravacao ? new Date(ultimaGravacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  const item = "flex h-full items-center gap-1.5 px-2 transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent";
  return (
    <footer data-slot="barra-status" className="flex h-6 shrink-0 items-center border-t bg-sidebar text-[11px] text-muted-foreground sem-selecao">
      <Dica texto="Seus dados ficam só nesta pasta. Clique para copiar o caminho." side="top" align="start">
        <button type="button" className={cn(item, "min-w-0")}
          onClick={async () => (await copiarTexto(estado?.dataDir ?? "")) && toast("Caminho copiado. Cole no Explorer para abrir.", "info")}>
          <HardDrive className="size-3 shrink-0" />
          <span className="truncate font-mono text-[10px]">{estado?.dataDir}</span>
        </button>
      </Dica>
      <div className="flex-1" />
      <span data-slot="estado-gravacao" data-gravando={gravando > 0 || undefined} className="flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={estado?.somenteLeitura ? "leitura" : gravando > 0 ? "gravando" : "salvo"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }} className="flex items-center gap-1.5">
            {estado?.somenteLeitura ? (
              <><Lock className="size-3" /> Somente leitura</>
            ) : gravando > 0 ? (
              <><Loader2 className="size-3 animate-spin" /> Salvando...</>
            ) : (
              <><Check className="size-3 text-sucesso" /> {hora ? `Salvo às ${hora}` : "Tudo salvo"}</>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <Link href="/tarefas" className={cn(item, "shrink-0 whitespace-nowrap")}><NumeroAnimado valor={abertas} /> {abertas === 1 ? "aberta" : "abertas"}</Link>
      <Link href="/pendencias" className={cn(item, "shrink-0 whitespace-nowrap")}><NumeroAnimado valor={pend} /> {pend === 1 ? "pendência" : "pendências"}</Link>
      <span className="flex h-full items-center px-2 font-mono text-[10px]">v{versao.version}</span>
    </footer>
  );
}
