"use client";

// "O que há de novo": uma janela com as novidades da versão. Não abre sozinha por cima do trabalho:
// na primeira vez depois de atualizar, aparece só um aviso discreto com o botão "Ver". Depois disso fica
// em Configurações e na paleta de comandos. O que já foi visto é preferência do navegador.
// A janela separa o que é desta versão (em destaque, em frases curtas) do histórico por versão, que abre ao clicar (3.12).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import {
  ArrowRight, BookText, CalendarClock, Check, ChevronDown, Telescope, Clapperboard, Component, Eye, FileAudio, History, Link2, ListChecks, MessageCircleQuestion, MoonStar, Paintbrush, Palette, PanelTop, PencilLine, Presentation, Printer, Radar, ShieldCheck, Sparkles, Undo2, Waypoints, type LucideIcon,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/diversos";
import { abrirPersonalizar } from "@/lib/moldura";
import { usePref } from "@/lib/preferencias";

/** Sobe quando há novidades que valem o aviso. Não é a versão do pacote: correção pequena não avisa de novo. */
export const VERSAO_NOVIDADES = "3.13";

const EVENTO = "nexo:novidades";
export const abrirNovidades = () => window.dispatchEvent(new Event(EVENTO));

type Novidade = {
  /** Versão em que chegou: a lista fica da mais nova para a mais antiga e a janela agrupa por ela. */
  versao: string; icone: LucideIcon; titulo: string; texto: string; href: string; rotulo: string;
  /** Só para a versão atual: o que mudou em frases curtas, no lugar do parágrafo. */
  pontos?: string[];
  /** Em vez de ir para uma tela, o botão faz isto (abrir o painel Personalizar, por exemplo). */
  acao?: () => void;
};

const NOVIDADES: Novidade[] = [
  { versao: "3.13", icone: Paintbrush, titulo: "O Nexo com a sua cara", texto: "Temas prontos que trocam tudo com um clique, cor de destaque livre (qualquer matiz), tons neutros frios, cinza, quentes ou puxados para a sua cor, escuro profundo e fundo em grade. A tela Hoje pode ter o seu nome na saudação, só os blocos que você usa e na ordem que preferir. E um código leva a personalização inteira para outro computador.", href: "/", rotulo: "Abrir o Personalizar", acao: () => abrirPersonalizar("aparencia"),
    pontos: [
      "Temas prontos: Oceano, Floresta, Pôr do sol, Papel, Ameixa, Meia-noite e outros. Um clique troca cor, tons, cantos, letra, barra lateral e fundo.",
      "Sua cor: a última bolinha da cor de destaque abre o matiz e a intensidade. Qualquer cor serve, o texto continua legível.",
      "Tons neutros (frios, cinza, quentes ou da sua cor), escuro profundo para ambiente escuro e um fundo novo, em grade.",
      "Tela Hoje sob medida: seu nome na saudação, o que aparece e em que ordem. Abra pelo botão ao lado de Planejar o dia.",
      "Levar para outro computador: copie o código em Personalizar e cole no outro navegador.",
    ] },
  { versao: "3.12", icone: Eye, titulo: "Hoje mais fácil de bater o olho", texto: "Em \"Precisa de você\", os motivos de cada tarefa viraram selos numa linha (passe o mouse para ver a explicação) e embaixo fica só o que dá para resolver ali: o passo com o botão Concluir. O nome de cada tela ficou maior, a barra superior perdeu as molduras, a busca fica num lugar só, a lista de tarefas mostra o título inteiro, o quadro cabe na tela e \"O que há de novo\" separa esta versão do histórico.", href: "/", rotulo: "Abrir a tela Hoje",
    pontos: [
      "Em \"Precisa de você\", os motivos de cada tarefa viraram selos numa linha. Passe o mouse num selo para ver a explicação.",
      "Embaixo dos selos fica só o que dá para resolver ali: o passo, com o botão Concluir.",
      "O nome de cada tela ficou maior. A barra superior perdeu as molduras, e a busca aparece num lugar só: na barra lateral ou, com ela recolhida, na barra superior.",
      "Em Tarefas, Grade, Lista e Quadro subiram para o cabeçalho, a lista mostra o título inteiro e o quadro cabe na tela.",
      "Na tarefa, \"Depende de\" vazio é uma linha só. No Radar, o gráfico de movimento ganhou linha de base.",
      "Esta janela também mudou: o que é desta versão vem primeiro e o resto virou um histórico que abre ao clicar.",
    ] },
  { versao: "3.11", icone: PencilLine, titulo: "Formulários com o essencial primeiro", texto: "No registro, o Copilot fica no topo da coluna da direita e resumo, decisões, passos e impedimentos aparecem quando têm conteúdo (ou em \"Preencher à mão\"). Em Nova tarefa, status, lembrete de voltar, tags e descrição estão em \"Mais opções\", que lembra se você prefere aberto. A prioridade mostra as faixas baixa, média e alta.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { versao: "3.10", icone: Palette, titulo: "Cores com significado e datas de um jeito só", texto: "Vermelho é só o que está errado, âmbar é o que pede atenção e verde é o que deu certo. A prioridade virou uma escala neutra, com o número escrito. As datas aparecem sempre do mesmo jeito: 20/11 e, quando ajuda, \"em 2 dias\" ou \"3 dias de atraso\".", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { versao: "3.9", icone: Telescope, titulo: "Menu mais curto: Acompanhar", texto: "Radar, Diário, Revisão semanal, Relatórios e Conquistas viraram um item só no menu, \"Acompanhar\", e trocam por abas no topo. Os atalhos G F, G D, G S, G R e G Q continuam. Prefere separadas? Personalizar > Lateral. Tema, tela cheia e atalhos estão no botão \"...\" da barra superior.", href: "/radar", rotulo: "Abrir Acompanhar" },
  { versao: "3.8", icone: MoonStar, titulo: "Fechar o dia e daily pronta", texto: "Ao encerrar o dia (ou Shift D): o que saiu, o que fica para amanhã, os impedimentos e a daily pronta para copiar. De manhã, \"Copiar daily\" na tela Hoje.", href: "/", rotulo: "Ir para Hoje" },
  { versao: "3.8", icone: Undo2, titulo: "Desfazer em todo lugar", texto: "Mudou o status, moveu, excluiu? O aviso traz \"Desfazer\", e Ctrl Z faz o mesmo fora dos campos de texto.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { versao: "3.8", icone: ListChecks, titulo: "Várias tarefas de uma vez", texto: "Selecione com Ctrl + clique ou X e mude status, prioridade, categoria, prazo ou foco de todas juntas. Visões salvas guardam seus filtros, e J/K andam pela lista.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { versao: "3.8", icone: FileAudio, titulo: "Transcrição do Teams na reunião", texto: "Cole a transcrição no modo reunião: o Copilot organiza e decisões, passos e impedimentos já entram na captura. O texto original fica anexado.", href: "/tarefas", rotulo: "Abrir uma tarefa" },
  { versao: "3.8", icone: Link2, titulo: "Dependências, repetição e falar com", texto: "Ligue uma tarefa a outra e saiba quando ela destravou. Modelos que se repetem lembram de criar a tarefa. E anote o que levar para a próxima conversa com cada pessoa.", href: "/pessoas", rotulo: "Abrir Pessoas" },
  { versao: "3.8", icone: Printer, titulo: "Imprimir, comparar e avisar", texto: "Tarefa e categoria em PDF para o gestor, comparação entre versões de uma página, busca dentro das transcrições e avisos do Windows (ligue em Configurações).", href: "/configuracoes", rotulo: "Abrir Configurações" },
  { versao: "3.7", icone: PanelTop, titulo: "Página da tarefa mais enxuta", texto: "A linha do tempo começa logo abaixo das propriedades. Panorama e Preparar próxima reunião estão no botão Copilot do cabeçalho. Categoria e tags agora mudam ali mesmo, e cada registro tem o botão \"...\" com todas as ações, também pelo teclado.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { versao: "3.6", icone: Sparkles, titulo: "Hoje mais direto e letras maiores", texto: "A tela Hoje abre com o que precisa de você, uma linha por tarefa com os motivos dentro, e o sino conta tarefas, não avisos. As letras miúdas cresceram, os prazos ficaram mais legíveis e cada coisa passou a ter um nome só: categoria, passo, lembrete de voltar.", href: "/", rotulo: "Abrir a tela Hoje" },
  { versao: "3.5", icone: CalendarClock, titulo: "Rotina: o dia em blocos e a hora de sair", texto: "Reserve horários para tarefas, chamados e pausas, e o app avisa o que é para fazer agora. Registre a entrada e ele diz a que horas você sai, com banco de horas da semana e do mês.", href: "/rotina", rotulo: "Abrir a Rotina" },
  { versao: "3.4", icone: Waypoints, titulo: "Mapa e histórico", texto: "O mapa mostra quais páginas se citam e quais ficaram soltas. E cada página guarda como estava antes de cada edição, para você poder voltar.", href: "/paginas", rotulo: "Ver o mapa" },
  { versao: "3.3", icone: Clapperboard, titulo: "Páginas de vídeo", texto: "A gravação com player próprio, a transcrição acompanhando o que é dito, capítulos e anotações com o instante. Clique numa fala e o vídeo vai até ela.", href: "/paginas", rotulo: "Criar uma página de vídeo" },
  { versao: "3.2", icone: Component, titulo: "Componentes no texto", texto: "Destaques coloridos, blocos que abrem e fecham, código com cores e botão copiar, índice automático, arquivos anexados e cartões vivos de tarefa.", href: "/paginas", rotulo: "Digite / numa página" },
  { versao: "3.1", icone: BookText, titulo: "Documentação de verdade", texto: "Páginas dentro de páginas, numa árvore que você arrasta. Abas, modo leitura com sumário, modelos (processo, guia, runbook) e [[ para ligar uma página à outra.", href: "/paginas", rotulo: "Abrir Páginas" },
  { versao: "3.0", icone: ShieldCheck, titulo: "Restaurar backup e saúde dos dados", texto: "Volte os dados a qualquer backup pelo app, com prévia do que muda e volta garantida. E um botão que confere se está tudo inteiro na pasta.", href: "/configuracoes", rotulo: "Abrir Configurações" },
  { versao: "2.14", icone: Radar, titulo: "Radar", texto: "A saúde de cada categoria (em risco, parado, pede atenção, em dia), os prazos das próximas semanas e um status em texto para o gestor.", href: "/radar", rotulo: "Abrir o radar" },
  { versao: "2.13", icone: MessageCircleQuestion, titulo: "Perguntar ao Nexo", texto: "Escreva uma pergunta: o app acha os trechos do seu histórico que têm a ver e monta o prompt para o Copilot responder citando as fontes.", href: "/perguntar", rotulo: "Perguntar" },
  { versao: "2.12", icone: Presentation, titulo: "Modo reunião", texto: "Pauta montada sozinha, anotações, decisões e próximos passos numa tela, e a ata pronta para copiar. Fica no cabeçalho de cada tarefa.", href: "/tarefas", rotulo: "Ir para Tarefas" },
];

export function Novidades() {
  const { dados } = useNexo();
  const [aberto, setAberto] = useState(false);
  const [vistas, setVistas] = usePref<string>("novidadesVistas", "");
  // do histórico, um item aberto por vez
  const [lendo, setLendo] = useState<string | null>(null);
  // o histórico cresce a cada versão: as mais antigas ficam atrás de "mostrar"
  const [tudo, setTudo] = useState(false);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  // Primeira abertura depois de atualizar: um aviso só, que não interrompe. Quem está começando agora
  // (pasta sem tarefas) não tem "novidade" para ver: marca como visto em silêncio.
  const temDados = dados ? dados.tarefas.length > 0 : null;
  const avisado = useRef(false);
  useEffect(() => {
    if (temDados === null || vistas === VERSAO_NOVIDADES || avisado.current) return;
    avisado.current = true;
    // o aviso é agendado antes de marcar como visto e não é cancelado quando a preferência muda
    if (temDados)
      setTimeout(() => {
        sonner(`O Nexo chegou à versão ${VERSAO_NOVIDADES}`, {
          description: "Personalização nova: temas prontos, cor de destaque livre, tons neutros, tela Hoje sob medida e um código para levar tudo a outro computador.",
          duration: 15000,
          action: { label: "Ver novidades", onClick: abrirNovidades },
        });
      }, 1500);
    setVistas(VERSAO_NOVIDADES);
  }, [temDados, vistas, setVistas]);

  const atuais = NOVIDADES.filter((n) => n.versao === VERSAO_NOVIDADES);
  const anteriores = porVersao(NOVIDADES.filter((n) => n.versao !== VERSAO_NOVIDADES));
  const mostradas = tudo ? anteriores : anteriores.slice(0, RECENTES);
  const guardadas = anteriores.length - mostradas.length;
  const ir = () => setAberto(false);

  return (
    <Modal
      titulo={`O que há de novo no Nexo ${VERSAO_NOVIDADES}`}
      descricao="Seus dados continuam como estavam: nada do que já estava guardado mudou."
      aberto={aberto}
      fechar={() => setAberto(false)}
      className="max-w-[680px]"
      rodape={<Button onClick={() => setAberto(false)}>Fechar</Button>}
    >
      <div data-slot="novidades" className="flex flex-col gap-6">
        <section aria-labelledby="novidades-atuais">
          <h3 id="novidades-atuais" className={ROTULO}>Nesta versão</h3>
          <div className="mt-2 flex flex-col gap-3">
            {atuais.map((n) => (
              <article key={n.titulo} data-slot="novidade-atual" className="rounded-xl border border-primary/25 bg-primary/6 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-solido text-primary-foreground"><n.icone className="size-[18px]" /></span>
                  <p className="min-w-0 text-[15px] leading-snug font-semibold tracking-tight">{n.titulo}</p>
                </div>
                {n.pontos?.length ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {n.pontos.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[13px] leading-snug">
                        <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" strokeWidth={2.5} />
                        <span className="min-w-0">{p}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] leading-relaxed">{n.texto}</p>
                )}
                {n.acao ? (
                  <Button variant="outline" size="sm" className="mt-3.5" data-acao="novidade-acao" onClick={() => { ir(); n.acao?.(); }}>{n.rotulo} <ArrowRight /></Button>
                ) : (
                  <Button asChild variant="outline" size="sm" className="mt-3.5">
                    <Link href={n.href} onClick={ir}>{n.rotulo} <ArrowRight /></Link>
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="novidades-anteriores">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="novidades-anteriores" className={ROTULO}>Das versões anteriores</h3>
            <span className="text-xs text-muted-foreground">Clique num item para ler</span>
          </div>
          <ol className="mt-2">
            {mostradas.map((g) => (
              <li key={g.versao} data-slot="versao-anterior" className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2">
                <span className="pt-2.5 text-right text-xs font-semibold text-muted-foreground tabular-nums">{g.versao}</span>
                <ul className="relative border-l py-0.5 pl-2 before:absolute before:top-[15px] before:-left-[3.5px] before:size-1.5 before:rounded-full before:bg-muted-foreground/60">
                  {g.itens.map((n) => (
                    <li key={n.titulo}>
                      <Collapsible open={lendo === n.titulo} onOpenChange={(a) => setLendo(a ? n.titulo : null)}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            data-slot="novidade-anterior"
                            className="group/nov flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium transition-colors outline-none sem-selecao hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/35 data-[state=open]:text-primary"
                          >
                            <n.icone className="size-4 shrink-0 text-muted-foreground transition-colors group-data-[state=open]/nov:text-primary" />
                            <span className="min-w-0 flex-1">{n.titulo}</span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/nov:rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pt-0.5 pr-2 pb-2.5 pl-[34px]">
                            <p className="text-[13px] leading-relaxed text-muted-foreground">{n.texto}</p>
                            {n.acao ? (
                              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => { ir(); n.acao?.(); }}>{n.rotulo}</Button>
                            ) : (
                              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                                <Link href={n.href} onClick={ir}>{n.rotulo}</Link>
                              </Button>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {guardadas > 0 && (
            <Button variant="ghost" size="sm" data-slot="novidades-antigas" className="mt-1 ml-[2.75rem] text-muted-foreground" onClick={() => setTudo(true)}>
              <History /> Mostrar as {guardadas} versões mais antigas
            </Button>
          )}
        </section>

        <p className="flex items-start gap-2 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          Antes disso, desde a 2.8: o editor de texto completo, as conquistas, o Diário, &quot;esperando quem&quot; com mensagem de cobrança, modelos de tarefa e a sessão de foco. A lista de atalhos abre com a tecla ?.
        </p>
      </div>
    </Modal>
  );
}

/** Quantas versões anteriores aparecem de cara no histórico. */
const RECENTES = 5;

const ROTULO = "text-[11px] font-semibold tracking-wide text-muted-foreground uppercase";

/** Agrupa mantendo a ordem da lista (da versão mais nova para a mais antiga). */
function porVersao(itens: Novidade[]) {
  const grupos: { versao: string; itens: Novidade[] }[] = [];
  for (const n of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.versao === n.versao) ultimo.itens.push(n);
    else grupos.push({ versao: n.versao, itens: [n] });
  }
  return grupos;
}
