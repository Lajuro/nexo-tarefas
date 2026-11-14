"use client";

// Painel "Personalizar": desliza pela direita e NÃO escurece o app, para o usuário ver cada
// mudança acontecendo (cor, cantos, itens da barra lateral, ferramentas da barra superior).
// Tudo aqui é preferência do navegador (lib/aparencia.ts e lib/moldura.ts). Nada toca os dados.

import { ReactNode, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical, PanelLeft, PanelTop, Palette, RotateCcw, X } from "lucide-react";
import { useAparencia, useConfirmar } from "@/components/Raiz";
import { Button } from "@/components/ui/button";
import { CampoSwitch, Segmentado, Switch } from "@/components/ui/controles";
import { Dica } from "@/components/ui/popover";
import {
  AbaPersonalizar, FERRAMENTAS, IdSecao, LARGURA_LATERAL, NOME_FERRAMENTA, NOME_SECAO, alternarNa, naOrdem, useMoldura,
} from "@/lib/moldura";
import { cn } from "@/lib/utils";
import { OpcoesAparencia } from "./Aparencia";
import { NAV } from "./navegacao";

function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold tracking-tight sem-selecao">{titulo}</h3>
        {ajuda && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{ajuda}</p>}
      </div>
      {children}
    </section>
  );
}

/** Linha que pode ser arrastada pela alça (ou movida com as setas, com a alça em foco) e ligada ou desligada. */
function ItemOrdenavel({
  valor, nome, descricao, icone, ligado, aoLigar, mover,
}: {
  valor: string; nome: string; descricao?: string; icone?: ReactNode; ligado: boolean; aoLigar: (v: boolean) => void; mover: (delta: number) => void;
}) {
  const controles = useDragControls();
  return (
    <Reorder.Item
      value={valor}
      dragListener={false}
      dragControls={controles}
      data-slot="item-ordenavel"
      data-valor={valor}
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.28)" }}
      className="relative flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-2.5 pl-1 shadow-xs"
    >
      <Dica texto="Arraste para mudar a ordem (ou use as setas)" side="left">
        <button type="button" aria-label={`Mover ${nome}. Use as setas para cima e para baixo.`}
          onPointerDown={(e) => controles.start(e)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            mover(e.key === "ArrowUp" ? -1 : 1);
          }}
          className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 active:cursor-grabbing">
          <GripVertical className="size-3.5" />
        </button>
      </Dica>
      {icone && <span className={cn("inline-flex shrink-0 text-muted-foreground transition-opacity [&_svg]:size-4", !ligado && "opacity-40")}>{icone}</span>}
      <span className={cn("min-w-0 flex-1 transition-opacity", !ligado && "opacity-50")}>
        <span className="block truncate text-[13px] font-medium sem-selecao">{nome}</span>
        {descricao && <span className="block text-[11px] leading-snug text-muted-foreground">{descricao}</span>}
      </span>
      <Switch checked={ligado} onCheckedChange={aoLigar} aria-label={`Mostrar ${nome}`} />
    </Reorder.Item>
  );
}

const trocar = <T,>(lista: T[], i: number, delta: number) => {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
};

function AbaLateral() {
  const { moldura, mudarMoldura } = useMoldura();
  const grupos = NAV.map((g) => ({ grupo: g.grupo, itens: naOrdem(g.itens, moldura.ordem, (i) => i.href) }));
  // A ordem guardada é uma lista só, com todos os grupos em sequência.
  const reordenar = (grupo: string, hrefs: string[]) =>
    mudarMoldura({ ordem: grupos.flatMap((g) => (g.grupo === grupo ? hrefs : g.itens.map((i) => i.href))) });

  return (
    <div className="flex flex-col gap-6">
      <Bloco titulo="Navegação" ajuda="Arraste para mudar a ordem e desligue o que você não usa. O que for escondido continua na paleta (Ctrl K) e nos atalhos.">
        {grupos.map((g) => {
          const hrefs = g.itens.map((i) => i.href);
          return (
            <div key={g.grupo} className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase sem-selecao">{g.grupo}</span>
              <Reorder.Group axis="y" values={hrefs} onReorder={(novo) => reordenar(g.grupo, novo as string[])} className="flex flex-col gap-1">
                {g.itens.map((item, i) => (
                  <ItemOrdenavel key={item.href} valor={item.href} nome={item.nome} icone={<item.icone />}
                    ligado={!moldura.ocultos.includes(item.href)}
                    aoLigar={(v) => mudarMoldura((m) => ({ ocultos: alternarNa(m.ocultos, item.href, !v) }))}
                    mover={(d) => reordenar(g.grupo, trocar(hrefs, i, d))} />
                ))}
              </Reorder.Group>
            </div>
          );
        })}
      </Bloco>

      <Bloco titulo="Seções" ajuda="Blocos que ficam abaixo da navegação. Fixadas e Recentes só aparecem quando têm algo.">
        <Reorder.Group axis="y" values={moldura.secoes} onReorder={(novo) => mudarMoldura({ secoes: novo as IdSecao[] })} className="flex flex-col gap-1">
          {moldura.secoes.map((id, i) => (
            <ItemOrdenavel key={id} valor={id} nome={NOME_SECAO[id].nome} descricao={NOME_SECAO[id].descricao}
              ligado={!moldura.secoesOcultas.includes(id)}
              aoLigar={(v) => mudarMoldura((m) => ({ secoesOcultas: alternarNa(m.secoesOcultas, id, !v) }))}
              mover={(d) => mudarMoldura({ secoes: trocar(moldura.secoes, i, d) })} />
          ))}
        </Reorder.Group>
      </Bloco>

      <Bloco titulo="Detalhes">
        <CampoSwitch marcado={moldura.titulosDeGrupo} aoMudar={(v) => mudarMoldura({ titulosDeGrupo: v })}>Mostrar os títulos dos grupos (Dia a dia, Conhecimento, Acompanhar)</CampoSwitch>
        <CampoSwitch marcado={moldura.contadores} aoMudar={(v) => mudarMoldura({ contadores: v })}>Mostrar os contadores ao lado dos itens</CampoSwitch>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
            Largura: <span className="font-medium text-foreground tabular-nums">{moldura.largura}px</span>. Arraste a borda direita da barra lateral para ajustar.
          </p>
          <Button variant="outline" size="sm" disabled={moldura.largura === LARGURA_LATERAL.padrao} onClick={() => mudarMoldura({ largura: LARGURA_LATERAL.padrao })}>
            Largura padrão
          </Button>
        </div>
      </Bloco>
    </div>
  );
}

function AbaSuperior() {
  const { moldura, mudarMoldura } = useMoldura();
  return (
    <div className="flex flex-col gap-6">
      <Bloco titulo="Ferramentas da barra superior" ajuda="O sino e o botão de aparência ficam sempre. O resto é com você.">
        <div className="flex flex-col gap-1">
          {FERRAMENTAS.map((id) => {
            const ligado = !moldura.ferramentasOcultas.includes(id);
            return (
              <div key={id} data-slot="opcao-ferramenta" data-valor={id} className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 shadow-xs">
                <span className={cn("min-w-0 flex-1 transition-opacity", !ligado && "opacity-50")}>
                  <span className="block text-[13px] font-medium sem-selecao">{NOME_FERRAMENTA[id].nome}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{NOME_FERRAMENTA[id].descricao}</span>
                </span>
                <Switch checked={ligado} aria-label={`Mostrar ${NOME_FERRAMENTA[id].nome}`}
                  onCheckedChange={(v) => mudarMoldura((m) => ({ ferramentasOcultas: alternarNa(m.ferramentasOcultas, id, !v) }))} />
              </div>
            );
          })}
        </div>
      </Bloco>
      <Bloco titulo="Barra de status" ajuda="A faixa fina do rodapé, com a pasta de dados, o “Salvo às...” e as contagens.">
        <CampoSwitch marcado={moldura.barraStatus} aoMudar={(v) => mudarMoldura({ barraStatus: v })}>Mostrar a barra de status</CampoSwitch>
        {!moldura.barraStatus && (
          <p className="text-[11px] leading-snug text-muted-foreground">Sem ela, o aviso de “Salvando...” aparece na barra superior só enquanto grava.</p>
        )}
      </Bloco>
    </div>
  );
}

export function Personalizar() {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<AbaPersonalizar>("aparencia");
  const { restaurarAparencia } = useAparencia();
  const { restaurarMoldura } = useMoldura();
  const confirmar = useConfirmar();

  useEffect(() => {
    const abrir = (e: Event) => {
      setAba((e as CustomEvent).detail?.aba ?? "aparencia");
      setAberto(true);
    };
    window.addEventListener("nexo:personalizar", abrir);
    return () => window.removeEventListener("nexo:personalizar", abrir);
  }, []);

  // Em tela larga o app encolhe para o painel caber ao lado (app/globals.css), e nada fica escondido atrás dele.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-personalizando", aberto);
    return () => document.documentElement.removeAttribute("data-personalizando");
  }, [aberto]);

  const restaurar = async () => {
    const ok = await confirmar({
      titulo: "Voltar tudo ao padrão?",
      descricao: "Cores, cantos, letra, barra lateral e barra superior voltam a ser como vieram. Suas tarefas e anotações não mudam.",
      confirmar: "Voltar ao padrão",
    });
    if (!ok) return;
    restaurarAparencia();
    restaurarMoldura();
  };

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={setAberto} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          data-slot="personalizar"
          // Sem fundo escuro e sem fechar ao clicar fora: a graça é mexer no app e ver o resultado.
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className="fixed inset-y-0 right-0 z-40 flex w-[384px] max-w-[calc(100vw-3rem)] flex-col border-l bg-popover text-popover-foreground shadow-2xl outline-none duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-8 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-8"
        >
          <header className="flex shrink-0 flex-col gap-3 border-b px-4 pt-3.5 pb-3">
            <div className="flex items-start gap-2 pr-8">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[15px] leading-tight font-semibold tracking-tight">Personalizar</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">Mexa à vontade: tudo muda na hora e fica só neste navegador.</DialogPrimitive.Description>
              </div>
            </div>
            <Segmentado<AbaPersonalizar>
              aria-label="O que personalizar"
              valor={aba}
              aoMudar={setAba}
              className="flex w-full [&>button]:flex-1"
              opcoes={[
                { valor: "aparencia", rotulo: "Aparência", icone: <Palette /> },
                { valor: "lateral", rotulo: "Lateral", icone: <PanelLeft /> },
                { valor: "superior", rotulo: "Superior", icone: <PanelTop /> },
              ]}
            />
            <DialogPrimitive.Close aria-label="Fechar"
              className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>
          <div key={aba} data-aba={aba} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 animate-in duration-200 fade-in-0 slide-in-from-bottom-1">
            {aba === "aparencia" ? <OpcoesAparencia /> : aba === "lateral" ? <AbaLateral /> : <AbaSuperior />}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5">
            <Button variant="ghost" size="sm" onClick={restaurar}><RotateCcw /> Voltar tudo ao padrão</Button>
            <Button size="sm" onClick={() => setAberto(false)}>Pronto</Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
