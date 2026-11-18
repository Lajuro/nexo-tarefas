"use client";

// "O que há de novo": uma janela com as novidades da versão. Não abre sozinha por cima do trabalho:
// na primeira vez depois de atualizar, aparece só um aviso discreto com o botão "Ver". Depois disso fica
// em Configurações e na paleta de comandos. O que já foi visto é preferência do navegador.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import {
  BookText, CalendarClock, Telescope, Clapperboard, Component, FileAudio, Link2, ListChecks, MessageCircleQuestion, MoonStar, PanelTop, PencilLine, Presentation, Printer, Radar, ShieldCheck, Sparkles, Undo2, Waypoints, type LucideIcon,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { usePref } from "@/lib/preferencias";

/** Sobe quando há novidades que valem o aviso. Não é a versão do pacote: correção pequena não avisa de novo. */
export const VERSAO_NOVIDADES = "3.11";

const EVENTO = "nexo:novidades";
export const abrirNovidades = () => window.dispatchEvent(new Event(EVENTO));

const NOVIDADES: { icone: LucideIcon; titulo: string; texto: string; href: string; rotulo: string }[] = [
  { icone: PencilLine, titulo: "Formulários com o essencial primeiro", texto: "No registro, o Copilot fica no topo da coluna da direita e resumo, decisões, passos e impedimentos aparecem quando têm conteúdo (ou em \"Preencher à mão\"). Em Nova tarefa, status, lembrete de voltar, tags e descrição estão em \"Mais opções\", que lembra se você prefere aberto. A prioridade mostra as faixas baixa, média e alta.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: Telescope, titulo: "Menu mais curto: Acompanhar", texto: "Radar, Diário, Revisão semanal, Relatórios e Conquistas viraram um item só no menu, \"Acompanhar\", e trocam por abas no topo. Os atalhos G F, G D, G S, G R e G Q continuam. Prefere separadas? Personalizar > Lateral. Tema, tela cheia e atalhos estão no botão \"...\" da barra superior.", href: "/radar", rotulo: "Abrir Acompanhar" },
  { icone: MoonStar, titulo: "Fechar o dia e daily pronta", texto: "Ao encerrar o dia (ou Shift D): o que saiu, o que fica para amanhã, os impedimentos e a daily pronta para copiar. De manhã, \"Copiar daily\" na tela Hoje.", href: "/", rotulo: "Ir para Hoje" },
  { icone: Undo2, titulo: "Desfazer em todo lugar", texto: "Mudou o status, moveu, excluiu? O aviso traz \"Desfazer\", e Ctrl Z faz o mesmo fora dos campos de texto.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: ListChecks, titulo: "Várias tarefas de uma vez", texto: "Selecione com Ctrl + clique ou X e mude status, prioridade, categoria, prazo ou foco de todas juntas. Visões salvas guardam seus filtros, e J/K andam pela lista.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: FileAudio, titulo: "Transcrição do Teams na reunião", texto: "Cole a transcrição no modo reunião: o Copilot organiza e decisões, passos e impedimentos já entram na captura. O texto original fica anexado.", href: "/tarefas", rotulo: "Abrir uma tarefa" },
  { icone: Link2, titulo: "Dependências, repetição e falar com", texto: "Ligue uma tarefa a outra e saiba quando ela destravou. Modelos que se repetem lembram de criar a tarefa. E anote o que levar para a próxima conversa com cada pessoa.", href: "/pessoas", rotulo: "Abrir Pessoas" },
  { icone: Printer, titulo: "Imprimir, comparar e avisar", texto: "Tarefa e categoria em PDF para o gestor, comparação entre versões de uma página, busca dentro das transcrições e avisos do Windows (ligue em Configurações).", href: "/configuracoes", rotulo: "Abrir Configurações" },
  { icone: PanelTop, titulo: "Página da tarefa mais enxuta", texto: "A linha do tempo começa logo abaixo das propriedades. Panorama e Preparar próxima reunião estão no botão Copilot do cabeçalho. Categoria e tags agora mudam ali mesmo, e cada registro tem o botão \"...\" com todas as ações, também pelo teclado.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: Sparkles, titulo: "Hoje mais direto e letras maiores", texto: "A tela Hoje abre com o que precisa de você, uma linha por tarefa com os motivos dentro, e o sino conta tarefas, não avisos. As letras miúdas cresceram, os prazos ficaram mais legíveis e cada coisa passou a ter um nome só: categoria, passo, lembrete de voltar.", href: "/", rotulo: "Abrir a tela Hoje" },
  { icone: CalendarClock, titulo: "Rotina: o dia em blocos e a hora de sair", texto: "Reserve horários para tarefas, chamados e pausas, e o app avisa o que é para fazer agora. Registre a entrada e ele diz a que horas você sai, com banco de horas da semana e do mês.", href: "/rotina", rotulo: "Abrir a Rotina" },
  { icone: BookText, titulo: "Documentação de verdade", texto: "Páginas dentro de páginas, numa árvore que você arrasta. Abas, modo leitura com sumário, modelos (processo, guia, runbook) e [[ para ligar uma página à outra.", href: "/paginas", rotulo: "Abrir Páginas" },
  { icone: Component, titulo: "Componentes no texto", texto: "Destaques coloridos, blocos que abrem e fecham, código com cores e botão copiar, índice automático, arquivos anexados e cartões vivos de tarefa.", href: "/paginas", rotulo: "Digite / numa página" },
  { icone: Clapperboard, titulo: "Páginas de vídeo", texto: "A gravação com player próprio, a transcrição acompanhando o que é dito, capítulos e anotações com o instante. Clique numa fala e o vídeo vai até ela.", href: "/paginas", rotulo: "Criar uma página de vídeo" },
  { icone: Waypoints, titulo: "Mapa e histórico", texto: "O mapa mostra quais páginas se citam e quais ficaram soltas. E cada página guarda como estava antes de cada edição, para você poder voltar.", href: "/paginas", rotulo: "Ver o mapa" },
  { icone: Presentation, titulo: "Modo reunião", texto: "Pauta montada sozinha, anotações, decisões e próximos passos numa tela, e a ata pronta para copiar. Fica no cabeçalho de cada tarefa.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: MessageCircleQuestion, titulo: "Perguntar ao Nexo", texto: "Escreva uma pergunta: o app acha os trechos do seu histórico que têm a ver e monta o prompt para o Copilot responder citando as fontes.", href: "/perguntar", rotulo: "Perguntar" },
  { icone: Radar, titulo: "Radar", texto: "A saúde de cada categoria (em risco, parado, pede atenção, em dia), os prazos das próximas semanas e um status em texto para o gestor.", href: "/radar", rotulo: "Abrir o radar" },
  { icone: ShieldCheck, titulo: "Restaurar backup e saúde dos dados", texto: "Volte os dados a qualquer backup pelo app, com prévia do que muda e volta garantida. E um botão que confere se está tudo inteiro na pasta.", href: "/configuracoes", rotulo: "Abrir Configurações" },
];

export function Novidades() {
  const { dados } = useNexo();
  const [aberto, setAberto] = useState(false);
  const [vistas, setVistas] = usePref<string>("novidadesVistas", "");

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
          description: "Registro e nova tarefa mostram o essencial primeiro. O resto fica a um clique, em \"Preencher à mão\" e \"Mais opções\".",
          duration: 15000,
          action: { label: "Ver novidades", onClick: abrirNovidades },
        });
      }, 1500);
    setVistas(VERSAO_NOVIDADES);
  }, [temDados, vistas, setVistas]);

  return (
    <Modal
      titulo={`O que há de novo no Nexo ${VERSAO_NOVIDADES}`}
      descricao="Tudo continua abrindo os dados de qualquer versão anterior. Nada disso mudou o que já estava guardado."
      aberto={aberto}
      fechar={() => setAberto(false)}
      largo
      rodape={<Button onClick={() => setAberto(false)}>Fechar</Button>}
    >
      <ul data-slot="novidades" className="grid gap-3 sm:grid-cols-2">
        {NOVIDADES.map((n) => (
          <li key={n.titulo} className="flex gap-3 rounded-xl border bg-card p-3.5">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><n.icone className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-tight">{n.titulo}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.texto}</p>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0 text-xs">
                <Link href={n.href} onClick={() => setAberto(false)}>{n.rotulo}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Também novos desde a 2.8: o editor de texto completo, as conquistas, o Diário, &quot;esperando quem&quot; com mensagem de cobrança, modelos de tarefa e a sessão de foco. A lista de atalhos abre com a tecla ?.
      </p>
    </Modal>
  );
}
