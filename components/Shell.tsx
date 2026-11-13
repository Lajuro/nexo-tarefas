"use client";

// Moldura do app: barra lateral, barra superior, área da tela e barra de status.
// A janela nunca rola: cada tela (components/comum.tsx → Pagina) rola por dentro, como app de desktop.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft, ChevronRight, CircleHelp, Check, HardDrive, Loader2, Lock, Maximize, Minimize, Monitor, Moon, PanelLeft, Search, Sun,
  TriangleAlert, X,
} from "lucide-react";
import { useNexo } from "./Provider";
import { useTema } from "./Raiz";
import { TarefaForm } from "./TarefaForm";
import { PlanejarDia } from "./rotina/PlanejarDia";
import { PontoCor, copiarTexto } from "./comum";
import { Lateral } from "./shell/Lateral";
import { Paleta } from "./shell/Paleta";
import { Sino } from "./shell/Sino";
import { Carregando, JanelaAtalhos, Onboarding, TelaErro } from "./shell/Telas";
import { NAV, nomeDaRota } from "./shell/navegacao";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Kbd } from "@/components/ui/diversos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { aberta, passosAbertosDe } from "@/lib/lembretes";
import { usePref, useRotina } from "@/lib/preferencias";
import { useHoje } from "./useHoje";
import { MoverEJuntar } from "./MoverEJuntar";
import { cn } from "@/lib/utils";
import versao from "@/package.json";

/** Abre o formulário de nova tarefa de qualquer lugar. */
export function abrirNovaTarefa(categoriaId?: string | null) {
  window.dispatchEvent(new CustomEvent("nexo:nova-tarefa", { detail: { categoriaId } }));
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
  const [nova, setNova] = useState<{ aberto: boolean; cat?: string | null }>({ aberto: false });
  const [ritual, setRitual] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [atalhos, setAtalhos] = useState(false);
  const [recolhida, setRecolhida] = usePref("lateralRecolhida", false);
  const [cheia, setCheia] = useState(false);
  const { rotina, carregado: rotinaCarregada } = useRotina();
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
  }, [pathname]);

  useEffect(() => {
    const abrirNova = (e: Event) => setNova({ aberto: true, cat: (e as CustomEvent).detail?.categoriaId });
    const abrirRitual = () => setRitual(true);
    const abrirPal = () => setPaleta(true);
    const teclas = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "k") {
        e.preventDefault();
        setPaleta((p) => !p);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "b") {
        e.preventDefault();
        setRecolhida((r) => !r);
        return;
      }
      const alvo = e.target as HTMLElement;
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
      <Lateral recolhida={recolhida} novaTarefa={() => setNova({ aberto: true })} abrirPaleta={() => setPaleta(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior
          recolhida={recolhida}
          alternarLateral={() => setRecolhida((r) => !r)}
          abrirPaleta={() => setPaleta(true)}
          abrirAtalhos={() => setAtalhos(true)}
          cheia={cheia}
          telaCheia={telaCheia}
        />
        <Avisos />
        <main data-slot="conteudo" className="min-h-0 flex-1 overflow-hidden">{children}</main>
        <BarraStatus />
      </div>

      <TarefaForm aberto={nova.aberto} categoriaInicial={nova.cat} fechar={() => setNova({ aberto: false })} />
      <PlanejarDia aberto={ritual} fechar={() => setRitual(false)} />
      <MoverEJuntar />
      <JanelaAtalhos aberto={atalhos} fechar={() => setAtalhos(false)} />
      <Paleta
        aberta={paleta}
        fechar={() => setPaleta(false)}
        acoes={{
          novaTarefa: () => setNova({ aberto: true }),
          planejarDia: () => setRitual(true),
          alternarLateral: () => setRecolhida((r) => !r),
          telaCheia,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Migalhas() {
  const pathname = usePathname();
  const { dados } = useNexo();
  const partes: { nome: ReactNode; href?: string }[] = [];
  const [, raiz, id] = pathname.split("/");

  if (raiz === "tarefas" && id) {
    const t = dados?.tarefas.find((x) => x.id === id);
    const cat = dados?.categorias.items.find((c) => c.id === t?.categoriaId);
    partes.push({ nome: "Tarefas", href: "/tarefas" });
    if (cat) partes.push({ nome: <span className="flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span>, href: `/categorias/${cat.id}` });
    partes.push({ nome: t?.titulo ?? "Tarefa" });
  } else if (raiz === "categorias" && id) {
    const cat = dados?.categorias.items.find((c) => c.id === id);
    partes.push({ nome: "Categorias", href: "/categorias" });
    partes.push({ nome: cat ? <span className="flex items-center gap-1.5"><PontoCor cor={cat.cor} />{cat.nome}</span> : "Categoria" });
  } else partes.push({ nome: nomeDaRota(pathname) });

  return (
    <nav aria-label="Você está em" data-slot="migalhas" className="flex min-w-0 items-center gap-1 text-[13px] sem-selecao">
      {partes.map((p, i) => {
        const ultima = i === partes.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />}
            {p.href && !ultima ? (
              <Link href={p.href} className="shrink-0 rounded px-1 py-0.5 text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
                {p.nome}
              </Link>
            ) : (
              <span className={cn("truncate px-1 py-0.5", ultima ? "font-medium text-foreground" : "text-muted-foreground")}>{p.nome}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

function BarraSuperior({
  recolhida, alternarLateral, abrirPaleta, abrirAtalhos, cheia, telaCheia,
}: {
  recolhida: boolean; alternarLateral: () => void; abrirPaleta: () => void; abrirAtalhos: () => void; cheia: boolean; telaCheia: () => void;
}) {
  const router = useRouter();
  const { tema, resolvido, definirTema } = useTema();
  return (
    <header data-slot="barra-superior" className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2">
      <Dica texto={recolhida ? "Abrir a barra lateral" : "Recolher a barra lateral"} atalho="Ctrl B">
        <Button variant="ghost" size="icon" aria-label="Recolher ou abrir a barra lateral" onClick={alternarLateral}><PanelLeft /></Button>
      </Dica>
      <Dica texto="Voltar">
        <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => router.back()}><ChevronLeft /></Button>
      </Dica>
      <Dica texto="Avançar">
        <Button variant="ghost" size="icon" aria-label="Avançar" onClick={() => router.forward()}><ChevronRight /></Button>
      </Dica>
      <div className="mx-1 h-4 w-px bg-border" />
      <Migalhas />
      <div className="flex-1" />

      <button type="button" onClick={abrirPaleta} data-slot="busca-topo"
        className="mr-1 hidden h-7 w-56 items-center gap-2 rounded-md border bg-muted/50 px-2 text-xs text-muted-foreground transition-colors outline-none sem-selecao hover:border-ring/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 lg:flex">
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Buscar em tudo</span>
        <Kbd>/</Kbd>
      </button>

      <Sino />

      <DropdownMenu>
        <Dica texto="Tema">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mudar tema" data-slot="botao-tema">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={resolvido} initial={{ rotate: -60, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 60, opacity: 0, scale: 0.6 }} transition={{ duration: 0.16 }} className="inline-flex">
                  {resolvido === "escuro" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                </motion.span>
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
        </Dica>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={tema} onValueChange={(t) => definirTema(t as typeof tema)}>
            <DropdownMenuRadioItem value="sistema"><Monitor /> Igual ao sistema</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="claro"><Sun /> Claro</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="escuro"><Moon /> Escuro</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dica texto={cheia ? "Sair da tela cheia" : "Tela cheia"} atalho="F11">
        <Button variant="ghost" size="icon" aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"} onClick={telaCheia}>
          {cheia ? <Minimize /> : <Maximize />}
        </Button>
      </Dica>
      <Dica texto="Atalhos de teclado" atalho="?">
        <Button variant="ghost" size="icon" aria-label="Atalhos de teclado" onClick={abrirAtalhos}><CircleHelp /></Button>
      </Dica>
    </header>
  );
}

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
        {estado?.somenteLeitura ? (
          <><Lock className="size-3" /> Somente leitura</>
        ) : gravando > 0 ? (
          <><Loader2 className="size-3 animate-spin" /> Salvando...</>
        ) : (
          <><Check className="size-3 text-sucesso" /> {hora ? `Salvo às ${hora}` : "Tudo salvo"}</>
        )}
      </span>
      <Link href="/tarefas" className={cn(item, "shrink-0 whitespace-nowrap")}><span className="tabular-nums">{abertas}</span> {abertas === 1 ? "aberta" : "abertas"}</Link>
      <Link href="/pendencias" className={cn(item, "shrink-0 whitespace-nowrap")}><span className="tabular-nums">{pend}</span> {pend === 1 ? "pendência" : "pendências"}</Link>
      <span className="flex h-full items-center px-2 font-mono text-[10px]">v{versao.version}</span>
    </footer>
  );
}
