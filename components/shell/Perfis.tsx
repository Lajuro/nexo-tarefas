"use client";

// Perfis de uso (3.20): o seletor da barra superior, a aba Perfis do painel Personalizar e as ações de trocar,
// redefinir, salvar, renomear, duplicar, excluir e levar um perfil para outro computador.
// A lógica (o que é um arranjo, os perfis prontos, a memória de cada perfil) está em lib/perfis.ts, pura e testada.
// Aqui é só a ponte com as preferências do navegador e a interface.
//
// As preferências "moldura", "telaHoje", "lateralRecolhida" e "telaInicial" continuam sendo o que está na tela.
// Trocar de perfil escreve nelas; nenhum outro componente precisou aprender o que é um perfil.

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  ChartNoAxesCombined, Check, ClipboardCopy, ClipboardPaste, CopyPlus, Ellipsis, GraduationCap, LayoutDashboard, type LucideIcon, MessagesSquare,
  PencilLine, RotateCcw, Save, SlidersHorizontal, SquareUserRound, Target, Trash2,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal, copiarTexto } from "@/components/comum";
import { oferecerDesfazer } from "@/components/desfazer";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
  MenuAtalho,
} from "@/components/ui/menu";
import { Dica } from "@/components/ui/popover";
import { FERRAMENTAS, abrirPersonalizar, normalizarMoldura, useMoldura } from "@/lib/moldura";
import {
  type Arranjo, type EstadoDosPerfis, MAX_PERFIS_PROPRIOS, type Mudanca, PERFIL_COMPLETO, type PerfilNaLista, TAMANHO_DO_NOME_DO_PERFIL, TAMANHO_MAXIMO_DO_CODIGO,
  acrescentarPerfil, arranjoDoPerfil, arranjoVivo, atualizarPerfilProprio, baseDoPerfil, duplicarPerfil, excluirPerfil, lerPerfil, listaDePerfis, nomeDePerfil, normalizarInicio,
  normalizarPerfis, perfilModificado, perfisIniciais, redefinirPerfil, renomearPerfil, salvarComoPerfil, textoDoPerfil, trocarPerfil,
} from "@/lib/perfis";
import { gravarPref, lerPref, usePref } from "@/lib/preferencias";
import { normalizarTelaHoje, useTelaHoje } from "@/lib/tela-hoje";
import { cn } from "@/lib/utils";
import { GRUPO_ACOMPANHAR, ITEM_ACOMPANHAR, NAV, TODOS_NAV, gruposDoMenu } from "./navegacao";

/** Todos os itens do menu, na ordem original: é com eles que dois arranjos são comparados pelo que se vê. */
export const HREFS_DO_MENU: string[] = NAV.flatMap((g) => (g.grupo === GRUPO_ACOMPANHAR ? [ITEM_ACOMPANHAR.href, ...g.itens.map((i) => i.href)] : g.itens.map((i) => i.href)));

const ICONES: Record<string, LucideIcon> = { completo: LayoutDashboard, foco: Target, reunioes: MessagesSquare, gestao: ChartNoAxesCombined, estudo: GraduationCap };
/** O ícone do perfil: o do pronto, ou o de "perfil seu". */
export const iconeDoPerfil = (p: { id: string; proprio?: boolean }): LucideIcon => (p.proprio ? SquareUserRound : ICONES[p.id] ?? LayoutDashboard);

const nomeDaTela = (href: string) => TODOS_NAV.find((n) => n.href === href)?.nome ?? "Hoje";

// ---------- a ponte com as preferências (funções soltas: a paleta e o teclado também chamam) ----------

const EVENTO_ABRIR = "nexo:perfis";
/** Abre o menu de perfis da barra superior (tecla P). Se o seletor está escondido, abre a aba Perfis do Personalizar. */
export function abrirPerfis() {
  const temSeletor = !!document.querySelector("[data-slot=seletor-perfil]");
  if (temSeletor) window.dispatchEvent(new Event(EVENTO_ABRIR));
  else abrirPersonalizar("perfis");
}

const lerEstado = (): EstadoDosPerfis => normalizarPerfis(lerPref<unknown>("perfis", null));

/** O arranjo que está na tela agora, lido das preferências (com as visões por tela, que só entram na memória). */
function lerVivo(): Arranjo {
  return arranjoVivo({
    moldura: normalizarMoldura(lerPref<unknown>("moldura", {})),
    hoje: normalizarTelaHoje(lerPref<unknown>("telaHoje", {})),
    inicio: lerPref<unknown>("telaInicial", "/"),
    lateralRecolhida: lerPref<unknown>("lateralRecolhida", false),
    telas: { visaoTarefas: lerPref<unknown>("visaoTarefas", null), agrupamentoPendencias: lerPref<unknown>("agrupamentoPendencias", null), soMeus: lerPref<unknown>("soMeus", null) },
  });
}

/** Põe um arranjo na tela. A largura da barra lateral e o nome da saudação são da pessoa: ficam como estão. */
function aplicarArranjo(a: Arranjo) {
  gravarPref("moldura", { ...a.moldura, largura: normalizarMoldura(lerPref<unknown>("moldura", {})).largura });
  gravarPref("telaHoje", { ...a.hoje, nome: normalizarTelaHoje(lerPref<unknown>("telaHoje", {})).nome });
  gravarPref("lateralRecolhida", a.lateralRecolhida);
  gravarPref("telaInicial", a.inicio);
  if (a.telas.visaoTarefas) gravarPref("visaoTarefas", a.telas.visaoTarefas);
  if (a.telas.agrupamentoPendencias) gravarPref("agrupamentoPendencias", a.telas.agrupamentoPendencias);
  if (typeof a.telas.soMeus === "boolean") gravarPref("soMeus", a.telas.soMeus);
}

/**
 * Faz a mudança de uma vez só. Com movimento completo, a tela inteira troca com um esmaecer curto (View
 * Transitions), em vez de cada barra e cada bloco se mexer por conta própria.
 */
function efetivar(m: Mudanca) {
  const mudar = () => {
    gravarPref("perfis", m.estado);
    if (m.aplicar) aplicarArranjo(m.aplicar);
  };
  const raiz = document.documentElement;
  const doc = document as Document & { startViewTransition?: (fn: () => void) => { finished: Promise<unknown> } };
  const completo = raiz.dataset.movimento !== "nenhum" && raiz.dataset.movimento !== "sutil" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!m.aplicar || !completo || typeof doc.startViewTransition !== "function") return mudar();
  raiz.dataset.vt = "perfil";
  const fim = () => { if (raiz.dataset.vt === "perfil") delete raiz.dataset.vt; };
  try {
    doc.startViewTransition(() => flushSync(mudar)).finished.then(fim, fim);
    // com a aba em segundo plano a transição pode nunca avisar que acabou: a marca sai de qualquer jeito
    setTimeout(fim, 900);
  } catch {
    fim();
    mudar();
  }
}

/** Troca de perfil. Devolve false se já era o perfil em uso (ou se ele não existe). */
export function trocarDePerfil(id: string): boolean {
  const e = lerEstado();
  const m = trocarPerfil(e, id, lerVivo());
  if (m.estado === e) return false;
  efetivar(m);
  return true;
}

/** Na primeira vez com perfis, decide onde a pessoa está: no Completo, ou em "Meu arranjo" se já tinha personalizado. */
export function useIniciarPerfis() {
  useEffect(() => {
    if (lerPref<unknown>("perfis", null) == null) gravarPref("perfis", perfisIniciais(lerVivo(), HREFS_DO_MENU));
  }, []);
}

/** A tela em que o perfil em uso abre (só as do menu). */
export const telaInicial = () => normalizarInicio(lerPref<unknown>("telaInicial", "/"));

/** O estado dos perfis e as ações, para a interface. */
export function usePerfis() {
  const { toast } = useNexo();
  const [bruto] = usePref<unknown>("perfis", null);
  const { moldura } = useMoldura();
  const { telaHoje } = useTelaHoje();
  const [recolhida] = usePref<unknown>("lateralRecolhida", false);
  const [inicio, setInicio] = usePref<unknown>("telaInicial", "/");

  const estado = useMemo(() => normalizarPerfis(bruto), [bruto]);
  const lista = useMemo(() => listaDePerfis(estado), [estado]);
  const agora = useMemo(() => arranjoVivo({ moldura, hoje: telaHoje, inicio, lateralRecolhida: recolhida }), [moldura, telaHoje, inicio, recolhida]);
  const ativo = lista.find((p) => p.id === estado.ativo) ?? lista[0];
  const modificado = useMemo(() => perfilModificado(estado, agora, HREFS_DO_MENU), [estado, agora]);

  /** Mudança com volta: o aviso tem Desfazer e o Ctrl Z também vale. */
  const comVolta = (m: Mudanca, texto: string) => {
    const antes = lerEstado();
    if (m.estado === antes) return false;
    const telaDeAntes = lerVivo();
    efetivar(m);
    oferecerDesfazer(texto, () => efetivar({ estado: antes, aplicar: m.aplicar ? telaDeAntes : undefined }), { tipo: "info" });
    return true;
  };

  return {
    estado, lista, ativo, agora, modificado,
    podeCriar: estado.proprios.length < MAX_PERFIS_PROPRIOS,
    trocar: (id: string) => trocarDePerfil(id),
    redefinir: () => comVolta(redefinirPerfil(lerEstado()), `Perfil ${ativo.nome} redefinido.`),
    salvarComo: (nome: string) => {
      const m = salvarComoPerfil(lerEstado(), nome, lerVivo());
      if (m.estado === lerEstado()) return false;
      efetivar(m);
      toast(`Perfil “${nomeDePerfil(nome)}” criado. Ele já está em uso.`);
      return true;
    },
    renomear: (id: string, nome: string) => {
      const m = renomearPerfil(lerEstado(), id, nome);
      if (m.estado === lerEstado()) return false;
      efetivar(m);
      return true;
    },
    duplicar: (id: string, nome: string) => {
      const m = duplicarPerfil(lerEstado(), id, nome);
      if (m.estado === lerEstado()) return false;
      efetivar(m);
      toast(`Perfil “${nomeDePerfil(nome)}” criado.`);
      return true;
    },
    atualizar: (id: string) => comVolta(atualizarPerfilProprio(lerEstado(), id, lerVivo()), "Perfil atualizado com o arranjo de agora."),
    excluir: (p: PerfilNaLista) => comVolta(excluirPerfil(lerEstado(), p.id), `Perfil “${p.nome}” excluído.`),
    mudarInicio: (href: string) => setInicio(normalizarInicio(href)),
    copiarCodigo: async (p: PerfilNaLista) => {
      const e = lerEstado();
      const arr = p.id === e.ativo ? lerVivo() : arranjoDoPerfil(e, p.id);
      if (await copiarTexto(textoDoPerfil(p.nome, arr, p.base))) toast("Código do perfil copiado. Quem receber cola em Personalizar, na aba Perfis.");
      else toast("Não consegui copiar automaticamente.", "erro");
    },
    /** Cola o código de um perfil: acrescenta um perfil próprio, nunca troca nada. Devolve o erro, ou "" se deu certo. */
    colarCodigo: (texto: string): string => {
      const lido = lerPerfil(texto);
      if (!lido.ok) return lido.erro;
      const e = lerEstado();
      if (e.proprios.length >= MAX_PERFIS_PROPRIOS) return `Você já tem ${MAX_PERFIS_PROPRIOS} perfis próprios. Exclua um para colar outro.`;
      // entra como perfil próprio, sem virar o perfil em uso
      const m = acrescentarPerfil(e, lido.valor);
      if (m.estado === e) return "Não consegui acrescentar este perfil.";
      efetivar(m);
      toast(`Perfil “${m.estado.proprios.at(-1)?.nome}” acrescentado. Escolha quando quiser usar.`);
      return "";
    },
    /** O arranjo com que um perfil abre hoje (para a miniatura). */
    arranjoDe: (id: string) => (id === estado.ativo ? agora : arranjoDoPerfil(estado, id)),
    originalDe: (id: string) => baseDoPerfil(estado, id),
  };
}

// ---------- miniatura ----------

/** Um desenho esquemático do arranjo: a barra lateral, as ferramentas e os blocos da tela Hoje. */
export function MiniaturaDoArranjo({ arranjo, className }: { arranjo: Arranjo; className?: string }) {
  const itens = gruposDoMenu(arranjo.moldura.acompanharSeparado).flatMap((g) => g.itens).filter((i) => !arranjo.moldura.ocultos.includes(i.href)).length;
  const ferramentas = FERRAMENTAS.filter((f) => !["telaCheia", "ajuda", "busca"].includes(f) && !arranjo.moldura.ferramentasOcultas.includes(f)).length;
  const fora = arranjo.hoje.ocultos;
  const principais = (arranjo.hoje.primeiro === "foco" ? (["foco", "precisa"] as const) : (["precisa", "foco"] as const)).filter((b) => !fora.includes(b));
  const laterais = arranjo.hoje.laterais.filter((l) => !fora.includes(l)).length;
  return (
    <div aria-hidden data-slot="miniatura-perfil" className={cn("flex h-[58px] w-[92px] shrink-0 overflow-hidden rounded-md border bg-background", className)}>
      <div className={cn("flex shrink-0 flex-col gap-[3px] border-r bg-sidebar py-1.5", arranjo.lateralRecolhida ? "w-[9px] px-[2px]" : "w-[26px] px-1")}>
        {Array.from({ length: Math.min(10, itens) }, (_, i) => <span key={i} className="h-[2px] shrink-0 rounded-full bg-muted-foreground/45" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[9px] shrink-0 items-center justify-end gap-[2px] border-b px-1">
          {Array.from({ length: ferramentas }, (_, i) => <span key={i} className="size-[3px] rounded-full bg-muted-foreground/55" />)}
        </div>
        <div className="flex min-h-0 flex-1 gap-[3px] p-[3px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            {!fora.includes("captura") && <span className="h-[4px] shrink-0 rounded-[2px] bg-muted" />}
            {principais.map((b) => <span key={b} className={cn("min-h-0 flex-1 rounded-[2px]", b === "foco" ? "bg-primary/40" : "bg-alerta/40")} />)}
            {!fora.includes("semana") && <span className="h-[5px] shrink-0 rounded-[2px] bg-muted" />}
          </div>
          {laterais > 0 && (
            <div className="flex w-[17px] shrink-0 flex-col gap-[3px]">
              {Array.from({ length: laterais }, (_, i) => <span key={i} className="min-h-0 flex-1 rounded-[2px] bg-muted" />)}
            </div>
          )}
        </div>
        {arranjo.moldura.barraStatus && <div className="h-[4px] shrink-0 border-t bg-sidebar" />}
      </div>
    </div>
  );
}

// ---------- janelas pequenas: dar nome e colar código ----------

type PedidoDeNome = { tipo: "salvar" } | { tipo: "renomear"; perfil: PerfilNaLista } | { tipo: "duplicar"; perfil: PerfilNaLista };

function JanelaDoNome({ pedido, fechar }: { pedido: PedidoDeNome | null; fechar: () => void }) {
  const perfis = usePerfis();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!pedido) return;
    setErro("");
    setNome(pedido.tipo === "renomear" ? pedido.perfil.nome : pedido.tipo === "duplicar" ? `${pedido.perfil.nome} (cópia)`.slice(0, TAMANHO_DO_NOME_DO_PERFIL) : "");
  }, [pedido]);

  const confirmar = () => {
    if (!pedido) return;
    const limpo = nomeDePerfil(nome);
    if (!limpo) return setErro("Dê um nome ao perfil.");
    if (perfis.lista.some((p) => p.nome.toLowerCase() === limpo.toLowerCase() && (pedido.tipo !== "renomear" || p.id !== pedido.perfil.id))) return setErro("Já existe um perfil com esse nome.");
    const ok = pedido.tipo === "salvar" ? perfis.salvarComo(limpo) : pedido.tipo === "renomear" ? perfis.renomear(pedido.perfil.id, limpo) : perfis.duplicar(pedido.perfil.id, limpo);
    if (ok) fechar();
    else setErro(`Não deu para criar: o limite é de ${MAX_PERFIS_PROPRIOS} perfis próprios.`);
  };

  const titulo = pedido?.tipo === "renomear" ? "Renomear o perfil" : pedido?.tipo === "duplicar" ? "Duplicar o perfil" : "Salvar o arranjo de agora como perfil";
  const descricao =
    pedido?.tipo === "salvar"
      ? "O menu, as barras, a tela Hoje e a tela inicial ficam guardados com este nome. O perfil de onde você saiu volta a ser como era."
      : pedido?.tipo === "duplicar" ? "A cópia nasce igual ao perfil de hoje e fica na sua lista para você mexer." : undefined;
  return (
    <Modal titulo={titulo} descricao={descricao} aberto={!!pedido} fechar={fechar}
      rodape={<>
        <Button variant="ghost" onClick={fechar}>Cancelar</Button>
        <Button data-slot="confirmar-nome-do-perfil" onClick={confirmar} disabled={!nome.trim()}>{pedido?.tipo === "renomear" ? "Renomear" : pedido?.tipo === "duplicar" ? "Duplicar" : "Salvar perfil"}</Button>
      </>}>
      <Input value={nome} maxLength={TAMANHO_DO_NOME_DO_PERFIL} autoFocus aria-label="Nome do perfil" placeholder="Ex.: Plantão, Fechamento do mês"
        onChange={(e) => { setNome(e.target.value); setErro(""); }} onKeyDown={(e) => e.key === "Enter" && confirmar()} />
      {erro && <p role="alert" className="mt-2 text-xs text-destructive">{erro}</p>}
    </Modal>
  );
}

function JanelaDeColar({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const { colarCodigo } = usePerfis();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (aberto) { setTexto(""); setErro(""); }
  }, [aberto]);
  const aplicar = () => {
    const falha = colarCodigo(texto);
    if (falha) setErro(falha);
    else fechar();
  };
  return (
    <Modal titulo="Colar o código de um perfil" descricao="O perfil entra na sua lista com o nome que veio. Nada do que está em uso muda: você escolhe quando usar."
      aberto={aberto} fechar={fechar}
      rodape={<>
        <Button variant="ghost" onClick={fechar}>Cancelar</Button>
        <Button data-slot="aplicar-codigo-do-perfil" onClick={aplicar} disabled={!texto.trim()}>Acrescentar perfil</Button>
      </>}>
      <Textarea value={texto} rows={5} maxLength={TAMANHO_MAXIMO_DO_CODIGO} autoFocus aria-label="Código do perfil" placeholder="Cole aqui o código que você recebeu"
        className="font-mono text-xs" onChange={(e) => { setTexto(e.target.value); setErro(""); }}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && aplicar()} />
      {erro && <p role="alert" className="mt-2 text-xs text-destructive">{erro}</p>}
    </Modal>
  );
}

// ---------- o seletor da barra superior ----------

/** O chip com o perfil em uso. Abre o menu de perfis (clique ou tecla P); dentro dele, 1 a 9 escolhe. */
export function SeletorDePerfil() {
  const perfis = usePerfis();
  const { lista, ativo, modificado } = perfis;
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState<PedidoDeNome | null>(null);
  const Icone = iconeDoPerfil(ativo);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  // depois de o menu fechar, para o foco não voltar ao botão por cima da janela ou do painel
  const depois = (fn: () => void) => setTimeout(fn, 80);

  return (
    <>
      <DropdownMenu open={aberto} onOpenChange={setAberto}>
        <Dica texto={`Perfil de uso: ${ativo.nome}${modificado ? " (com mudanças suas)" : ""}`} atalho="P">
          <DropdownMenuTrigger asChild>
            <button type="button" data-slot="seletor-perfil" data-perfil={ativo.id} data-modificado={modificado || undefined} aria-label={`Perfil de uso: ${ativo.nome}. Trocar de perfil.`}
              className="relative inline-flex h-7 max-w-44 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors outline-none sem-selecao hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:bg-accent data-[state=open]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0">
              <Icone />
              <span className="hidden truncate xl:inline">{ativo.nome}</span>
              {modificado && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-primary xl:static xl:-ml-0.5" />}
            </button>
          </DropdownMenuTrigger>
        </Dica>
        <DropdownMenuContent data-slot="menu-perfis" className="w-[19rem]"
          onKeyDown={(e) => {
            // 1 a 9 escolhe direto, sem andar com as setas
            const n = Number(e.key);
            if (!Number.isInteger(n) || n < 1 || n > Math.min(9, lista.length) || e.ctrlKey || e.metaKey || e.altKey) return;
            e.preventDefault();
            setAberto(false);
            perfis.trocar(lista[n - 1].id);
          }}>
          <DropdownMenuLabel>Perfil de uso</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={ativo.id} onValueChange={(id) => perfis.trocar(id)}>
            {lista.map((p, i) => {
              const I = iconeDoPerfil(p);
              return (
                <DropdownMenuRadioItem key={p.id} value={p.id} data-slot="opcao-perfil" data-perfil={p.id} className="items-start gap-2.5 py-1.5">
                  <I className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{p.nome}</span>
                      {i < 9 && <MenuAtalho className="ml-0">{i + 1}</MenuAtalho>}
                    </span>
                    <span className="block text-xs leading-snug text-muted-foreground">{p.descricao}</span>
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-slot="perfil-salvar-como" disabled={!perfis.podeCriar} onSelect={() => depois(() => setPedido({ tipo: "salvar" }))}>
            <Save /> Salvar o arranjo de agora como perfil...
          </DropdownMenuItem>
          <DropdownMenuItem data-slot="perfil-redefinir" disabled={!modificado} onSelect={() => perfis.redefinir()}>
            <RotateCcw /> Redefinir este perfil
          </DropdownMenuItem>
          <DropdownMenuItem data-slot="perfil-gerenciar" onSelect={() => depois(() => abrirPersonalizar("perfis"))}>
            <SlidersHorizontal /> Ajustar e gerenciar perfis...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <JanelaDoNome pedido={pedido} fechar={() => setPedido(null)} />
    </>
  );
}

// ---------- a aba Perfis do painel Personalizar ----------

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold tracking-tight sem-selecao">{titulo}</h3>
        {ajuda && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{ajuda}</p>}
      </div>
      {children}
    </section>
  );
}

function CartaoDoPerfil({ p, aoPedirNome }: { p: PerfilNaLista; aoPedirNome: (pedido: PedidoDeNome) => void }) {
  const perfis = usePerfis();
  const emUso = perfis.ativo.id === p.id;
  const arranjo = perfis.arranjoDe(p.id);
  const Icone = iconeDoPerfil(p);
  return (
    <div data-slot="cartao-perfil" data-perfil={p.id} data-em-uso={emUso || undefined}
      className={cn("flex items-start gap-3 rounded-lg border bg-card p-2.5 shadow-xs transition-[border-color,box-shadow]", emUso && "border-primary/55 ring-[3px] ring-primary/15")}>
      <MiniaturaDoArranjo arranjo={arranjo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icone className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-[13px] font-medium">{p.nome}</span>
          {emUso && perfis.modificado && <span className="shrink-0 rounded bg-muted px-1 py-px text-[11px] text-muted-foreground">com mudanças</span>}
        </div>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{p.descricao}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Abre em {nomeDaTela(arranjo.inicio)}</p>
        <div className="mt-1.5 flex items-center gap-1">
          {emUso ? (
            <span className="inline-flex h-7 items-center gap-1 px-1 text-xs font-medium text-primary dark:text-foreground"><Check className="size-3.5" /> Em uso</span>
          ) : (
            <Button variant="outline" size="sm" data-slot="usar-perfil" onClick={() => perfis.trocar(p.id)}>Usar</Button>
          )}
          <DropdownMenu>
            <Dica texto="Mais ações deste perfil">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" data-slot="menu-do-perfil" aria-label={`Mais ações do perfil ${p.nome}`} className="ml-auto"><Ellipsis /></Button>
              </DropdownMenuTrigger>
            </Dica>
            <DropdownMenuContent className="w-64">
              <DropdownMenuItem disabled={!perfis.podeCriar} onSelect={() => setTimeout(() => aoPedirNome({ tipo: "duplicar", perfil: p }), 80)}><CopyPlus /> Duplicar...</DropdownMenuItem>
              <DropdownMenuItem data-slot="copiar-codigo-do-perfil" onSelect={() => void perfis.copiarCodigo(p)}><ClipboardCopy /> Copiar código deste perfil</DropdownMenuItem>
              {p.proprio && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setTimeout(() => aoPedirNome({ tipo: "renomear", perfil: p }), 80)}><PencilLine /> Renomear...</DropdownMenuItem>
                  {emUso && <DropdownMenuItem disabled={!perfis.modificado} onSelect={() => perfis.atualizar(p.id)}><Save /> Gravar as mudanças neste perfil</DropdownMenuItem>}
                  <DropdownMenuItem perigo data-slot="excluir-perfil" onSelect={() => perfis.excluir(p)}><Trash2 /> Excluir</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/** A aba Perfis: escolher, ver a miniatura de cada um, salvar o arranjo de agora, e levar um perfil para outro computador. */
export function AbaPerfis() {
  const perfis = usePerfis();
  const [pedido, setPedido] = useState<PedidoDeNome | null>(null);
  const [colando, setColando] = useState(false);
  const prontos = perfis.lista.filter((p) => !p.proprio);
  const proprios = perfis.lista.filter((p) => p.proprio);
  const telas = TODOS_NAV.filter((n) => (HREFS_DO_MENU as string[]).includes(n.href) && n.href !== ITEM_ACOMPANHAR.href);
  return (
    <div data-slot="aba-perfis" className="flex flex-col gap-6">
      <Secao titulo="Perfis prontos" ajuda="Cada perfil arruma o menu, as barras e a tela Hoje para um jeito de trabalhar. Suas tarefas são as mesmas em todos. Cada um lembra como você o deixou.">
        <div className="flex flex-col gap-1.5">{prontos.map((p) => <CartaoDoPerfil key={p.id} p={p} aoPedirNome={setPedido} />)}</div>
      </Secao>

      <Secao titulo="Seus perfis" ajuda={proprios.length ? `${proprios.length} de ${MAX_PERFIS_PROPRIOS}.` : "Arrume o app do seu jeito nas outras abas e salve com um nome."}>
        {proprios.length > 0 && <div className="flex flex-col gap-1.5">{proprios.map((p) => <CartaoDoPerfil key={p.id} p={p} aoPedirNome={setPedido} />)}</div>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" data-slot="salvar-como-perfil" disabled={!perfis.podeCriar} onClick={() => setPedido({ tipo: "salvar" })}><Save /> Salvar o arranjo de agora...</Button>
          <Button variant="outline" size="sm" data-slot="colar-codigo-do-perfil" disabled={!perfis.podeCriar} onClick={() => setColando(true)}><ClipboardPaste /> Colar código de perfil...</Button>
        </div>
      </Secao>

      <Secao titulo={`O perfil ${perfis.ativo.nome} abre em`} ajuda="Vale ao abrir o app. Clicar em Hoje continua levando para Hoje.">
        <div role="radiogroup" aria-label="Tela inicial do perfil" data-slot="tela-inicial" className="flex flex-wrap gap-1">
          {telas.map((n) => {
            const marcado = perfis.agora.inicio === n.href;
            return (
              <button key={n.href} type="button" role="radio" aria-checked={marcado} data-valor={n.href} onClick={() => perfis.mudarInicio(n.href)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors outline-none sem-selecao focus-visible:ring-[3px] focus-visible:ring-ring/35 [&_svg]:size-3.5",
                  marcado ? "border-primary/55 bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}>
                <n.icone /> {n.nome}
              </button>
            );
          })}
        </div>
      </Secao>

      <JanelaDoNome pedido={pedido} fechar={() => setPedido(null)} />
      <JanelaDeColar aberto={colando} fechar={() => setColando(false)} />
    </div>
  );
}

/** A faixa das abas Lateral, Superior e Hoje: lembra que o que se mexe ali vale para o perfil em uso. */
export function FaixaDoPerfil() {
  const { ativo, modificado, redefinir } = usePerfis();
  const Icone = iconeDoPerfil(ativo);
  return (
    <div data-slot="faixa-do-perfil" className="mb-4 flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">
      <Icone className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">Você está ajustando o perfil <strong className="font-medium text-foreground">{ativo.nome}</strong>. Os outros perfis não mudam.</span>
      {modificado && <Button variant="ghost" size="sm" className="-my-0.5 shrink-0" onClick={() => redefinir()}><RotateCcw /> Redefinir</Button>}
    </div>
  );
}

/** Id do perfil que vem com o app, para quem precisa dizer "o padrão". */
export const PERFIL_PADRAO = PERFIL_COMPLETO;
