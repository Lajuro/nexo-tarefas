"use client";

// Painel "Personalizar": desliza pela direita e NÃO escurece o app, para o usuário ver cada
// mudança acontecendo (cor, cantos, itens da barra lateral, ferramentas da barra superior).
// Tudo aqui é preferência do navegador (lib/aparencia.ts e lib/moldura.ts). Nada toca os dados.

import { ReactNode, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Reorder, useDragControls } from "motion/react";
import { ClipboardCopy, ClipboardPaste, GripVertical, RotateCcw, X } from "lucide-react";
import { useNexo } from "@/components/Provider";
import { useAparencia, useConfirmar, useTema } from "@/components/Raiz";
import { Modal, copiarTexto } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { CampoSwitch, Segmentado, Switch } from "@/components/ui/controles";
import { Input, Textarea } from "@/components/ui/input";
import { Dica } from "@/components/ui/popover";
import { normalizarPerfis, perfisParaLevar } from "@/lib/perfis";
import { TAMANHO_MAXIMO, lerPersonalizacao, textoDaPersonalizacao } from "@/lib/personalizacao";
import { gravarPref, lerPref } from "@/lib/preferencias";
import { BLOCOS_HOJE, LateralHoje, NOME_BLOCO_HOJE, PrimeiroHoje, TAMANHO_DO_NOME, useTelaHoje } from "@/lib/tela-hoje";
import {
  AbaPersonalizar, FERRAMENTAS, IdSecao, LARGURA_LATERAL, NOME_FERRAMENTA, NOME_SECAO, alternarNa, naOrdem, useMoldura,
} from "@/lib/moldura";
import { cn } from "@/lib/utils";
import { OpcoesAparencia } from "./Aparencia";
import { AbaPerfis, FaixaDoPerfil, usePerfis } from "./Perfis";
import { GRUPO_ACOMPANHAR, TELAS_ACOMPANHAR, gruposDoMenu } from "./navegacao";

function Bloco({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
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
          className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/80 transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 active:cursor-grabbing">
          <GripVertical className="size-3.5" />
        </button>
      </Dica>
      {icone && <span className={cn("inline-flex shrink-0 text-muted-foreground transition-opacity [&_svg]:size-4", !ligado && "opacity-40")}>{icone}</span>}
      <span className={cn("min-w-0 flex-1 transition-opacity", !ligado && "opacity-50")}>
        <span className="block truncate text-[13px] font-medium sem-selecao">{nome}</span>
        {descricao && <span className="block text-xs leading-snug text-muted-foreground">{descricao}</span>}
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
  const grupos = gruposDoMenu(moldura.acompanharSeparado).map((g) => ({ grupo: g.grupo, itens: naOrdem(g.itens, moldura.ordem, (i) => i.href) }));
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
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sem-selecao">{g.grupo}</span>
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

      <Bloco titulo={GRUPO_ACOMPANHAR}
        ajuda={`${TELAS_ACOMPANHAR.map((n) => n.nome).join(", ").replace(/, ([^,]*)$/, " e $1")}. Juntas, viram um item só no menu e trocam por abas no topo da tela. As abas e os atalhos valem dos dois jeitos.`}>
        <CampoSwitch marcado={moldura.acompanharSeparado} aoMudar={(v) => mudarMoldura({ acompanharSeparado: v })}>
          Mostrar as telas de acompanhar separadas no menu
        </CampoSwitch>
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
          <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
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
      <Bloco titulo="Ferramentas da barra superior" ajuda="O sino e o menu Mais (tema e Personalizar) ficam sempre. Tela cheia e Atalhos aparecem dentro do menu Mais. O resto é com você.">
        <div className="flex flex-col gap-1">
          {FERRAMENTAS.map((id) => {
            const ligado = !moldura.ferramentasOcultas.includes(id);
            return (
              <div key={id} data-slot="opcao-ferramenta" data-valor={id} className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 shadow-xs">
                <span className={cn("min-w-0 flex-1 transition-opacity", !ligado && "opacity-50")}>
                  <span className="block text-[13px] font-medium sem-selecao">{NOME_FERRAMENTA[id].nome}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{NOME_FERRAMENTA[id].descricao}</span>
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
          <p className="text-xs leading-snug text-muted-foreground">Sem ela, o aviso de “Salvando...” aparece na barra superior só enquanto grava.</p>
        )}
      </Bloco>
    </div>
  );
}

/** Liga e desliga um bloco fixo (sem ordem). */
function ItemFixo({ nome, descricao, ligado, aoLigar }: { nome: string; descricao: string; ligado: boolean; aoLigar: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 shadow-xs">
      <span className={cn("min-w-0 flex-1 transition-opacity", !ligado && "opacity-50")}>
        <span className="block text-[13px] font-medium sem-selecao">{nome}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{descricao}</span>
      </span>
      <Switch checked={ligado} onCheckedChange={aoLigar} aria-label={`Mostrar ${nome}`} />
    </div>
  );
}

/** A tela Hoje do jeito do usuário: o nome na saudação, o que aparece e em que ordem. */
function AbaHoje() {
  const { telaHoje, mudarTelaHoje } = useTelaHoje();
  const ligado = (id: (typeof BLOCOS_HOJE)[number]) => !telaHoje.ocultos.includes(id);
  const ligar = (id: (typeof BLOCOS_HOJE)[number]) => (v: boolean) => mudarTelaHoje((t) => ({ ocultos: alternarNa(t.ocultos, id, !v) }));
  // O nome é escrito num rascunho e só vale ao sair do campo: o normalizador apara espaços, o que atrapalharia a digitação.
  const [nome, setNome] = useState(telaHoje.nome);
  useEffect(() => setNome(telaHoje.nome), [telaHoje.nome]);
  const fixo = (id: (typeof BLOCOS_HOJE)[number]) => (
    <ItemFixo key={id} nome={NOME_BLOCO_HOJE[id].nome} descricao={NOME_BLOCO_HOJE[id].descricao} ligado={ligado(id)} aoLigar={ligar(id)} />
  );

  return (
    <div data-slot="aba-hoje" className="flex flex-col gap-6">
      <Bloco titulo="Saudação" ajuda="Como o Nexo te chama no topo da tela Hoje. Fica só neste navegador.">
        <Input value={nome} maxLength={TAMANHO_DO_NOME} placeholder="Seu nome ou apelido" aria-label="Seu nome na saudação"
          onChange={(e) => setNome(e.target.value)} onBlur={() => mudarTelaHoje({ nome })}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
      </Bloco>

      <Bloco titulo="Topo da tela" ajuda="O que orienta o dia, acima de tudo.">
        <div className="flex flex-col gap-1">{(["proxima", "reunioes"] as const).map(fixo)}</div>
      </Bloco>

      <Bloco titulo="Coluna principal" ajuda="No automático, o que pede atenção vem primeiro; com tudo em dia, o foco sobe.">
        <Segmentado<PrimeiroHoje>
          aria-label="O que vem primeiro na tela Hoje"
          valor={telaHoje.primeiro}
          aoMudar={(primeiro) => mudarTelaHoje({ primeiro })}
          className="self-start"
          opcoes={[
            { valor: "auto", rotulo: "Automático" },
            { valor: "precisa", rotulo: "Precisa de você" },
            { valor: "foco", rotulo: "Foco" },
          ]}
        />
        <div className="flex flex-col gap-1">{(["captura", "precisa", "foco"] as const).map(fixo)}</div>
      </Bloco>

      <Bloco titulo="Coluna da direita" ajuda="Arraste para mudar a ordem e desligue o que você não usa.">
        <Reorder.Group axis="y" values={telaHoje.laterais} onReorder={(novo) => mudarTelaHoje({ laterais: novo as LateralHoje[] })} className="flex flex-col gap-1">
          {telaHoje.laterais.map((id, i) => (
            <ItemOrdenavel key={id} valor={id} nome={NOME_BLOCO_HOJE[id].nome} descricao={NOME_BLOCO_HOJE[id].descricao}
              ligado={ligado(id)} aoLigar={ligar(id)} mover={(d) => mudarTelaHoje({ laterais: trocar(telaHoje.laterais, i, d) })} />
          ))}
        </Reorder.Group>
      </Bloco>

      <Bloco titulo="Rodapé da tela">{fixo("semana")}</Bloco>
    </div>
  );
}

/** Copiar a personalização inteira como texto e colar em outro navegador ou computador. */
function LevarPersonalizacao() {
  const { toast } = useNexo();
  const { tema, definirTema } = useTema();
  const { aparencia, mudarAparencia } = useAparencia();
  const { moldura, mudarMoldura } = useMoldura();
  const { telaHoje, mudarTelaHoje } = useTelaHoje();
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");

  const copiar = async () => {
    const codigo = textoDaPersonalizacao({
      tema, aparencia, moldura, hoje: telaHoje,
      // desde a 3.20 os perfis próprios e a tela inicial vão junto (a memória de cada perfil é só deste navegador)
      perfis: perfisParaLevar(normalizarPerfis(lerPref<unknown>("perfis", null))), inicio: lerPref<unknown>("telaInicial", "/"), lateralRecolhida: lerPref<unknown>("lateralRecolhida", false),
    });
    if (await copiarTexto(codigo)) toast("Código copiado. No outro computador, abra Personalizar e cole.");
    else toast("Não consegui copiar automaticamente.", "erro");
  };
  const aplicar = () => {
    const lido = lerPersonalizacao(texto);
    if (!lido.ok) return setErro(lido.erro);
    definirTema(lido.valor.tema);
    mudarAparencia(lido.valor.aparencia);
    mudarMoldura(lido.valor.moldura);
    mudarTelaHoje(lido.valor.hoje);
    // código da 3.20 em diante: os perfis próprios, o perfil em uso e a tela inicial vêm junto
    if (lido.valor.perfis) gravarPref("perfis", { ...lido.valor.perfis, memoria: {} });
    if (lido.valor.inicio) gravarPref("telaInicial", lido.valor.inicio);
    if (typeof lido.valor.lateralRecolhida === "boolean") gravarPref("lateralRecolhida", lido.valor.lateralRecolhida);
    setColando(false);
    setTexto("");
    toast("Personalização aplicada.");
  };

  return (
    <section data-slot="levar-personalizacao" className="mt-6 flex flex-col gap-2 border-t pt-4">
      <div>
        <h3 className="text-xs font-semibold tracking-tight sem-selecao">Levar para outro computador</h3>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          A personalização mora no navegador. Copie o código aqui e cole no outro: tema, cores, barras, a tela Hoje e os seus perfis vão juntos. Suas tarefas não entram nisso.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" data-acao="copiar-personalizacao" onClick={copiar}><ClipboardCopy /> Copiar código</Button>
        <Button variant="outline" size="sm" data-acao="colar-personalizacao" onClick={() => { setErro(""); setColando(true); }}><ClipboardPaste /> Colar código...</Button>
      </div>
      <Modal titulo="Colar o código de personalização" descricao="O que está neste navegador é trocado pelo que vem no código. Só a aparência e as barras mudam."
        aberto={colando} fechar={() => setColando(false)}
        rodape={<>
          <Button variant="ghost" onClick={() => setColando(false)}>Cancelar</Button>
          <Button onClick={aplicar} disabled={!texto.trim()} data-acao="aplicar-personalizacao">Aplicar</Button>
        </>}>
        <Textarea value={texto} rows={5} maxLength={TAMANHO_MAXIMO} autoFocus aria-label="Código de personalização" placeholder="Cole aqui o código copiado no outro computador"
          className="font-mono text-xs" onChange={(e) => { setTexto(e.target.value); setErro(""); }}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && aplicar()} />
        {erro && <p role="alert" className="mt-2 text-xs text-destructive">{erro}</p>}
      </Modal>
    </section>
  );
}

export function Personalizar() {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<AbaPersonalizar>("aparencia");
  const { restaurarAparencia } = useAparencia();
  const perfis = usePerfis();
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

  // Duas voltas, cada uma na sua aba: a aparência (cores, cantos, letra) e o perfil em uso (menu, barras, tela Hoje).
  // Nenhuma das duas apaga o nome da saudação, que é da pessoa.
  const restaurarAparenciaComPergunta = async () => {
    const ok = await confirmar({
      titulo: "Voltar a aparência ao padrão?",
      descricao: "Cores, cantos, letra, fundo e movimento voltam a ser como vieram. O menu, as barras e a tela Hoje são do perfil em uso e não mudam aqui.",
      confirmar: "Voltar ao padrão",
    });
    if (ok) restaurarAparencia();
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
              className="flex w-full [&>button]:flex-1 [&>button]:gap-1.5 [&>button]:px-1.5"
              opcoes={[
                { valor: "perfis", rotulo: "Perfis" },
                { valor: "aparencia", rotulo: "Aparência" },
                { valor: "lateral", rotulo: "Lateral" },
                { valor: "superior", rotulo: "Superior" },
                { valor: "hoje", rotulo: "Hoje" },
              ]}
            />
            <DialogPrimitive.Close aria-label="Fechar"
              className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </header>
          <div key={aba} data-aba={aba} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 animate-in duration-200 fade-in-0 slide-in-from-bottom-1">
            {aba === "perfis" ? <AbaPerfis /> : aba === "aparencia" ? <><OpcoesAparencia /><LevarPersonalizacao /></> : (
              // o que se mexe nestas três abas é o arranjo do perfil em uso
              <><FaixaDoPerfil />{aba === "lateral" ? <AbaLateral /> : aba === "superior" ? <AbaSuperior /> : <AbaHoje />}</>
            )}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2.5">
            {aba === "aparencia" ? (
              <Button variant="ghost" size="sm" data-slot="restaurar-aparencia" onClick={restaurarAparenciaComPergunta}><RotateCcw /> Voltar a aparência ao padrão</Button>
            ) : (
              <Button variant="ghost" size="sm" data-slot="redefinir-perfil" disabled={!perfis.modificado} onClick={() => perfis.redefinir()}><RotateCcw /> Redefinir este perfil</Button>
            )}
            <Button size="sm" onClick={() => setAberto(false)}>Pronto</Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
