"use client";

// "O que há de novo": uma janela com as novidades da versão. Não abre sozinha por cima do trabalho:
// na primeira vez depois de atualizar, aparece só um aviso discreto com o botão "Ver". Depois disso fica
// em Configurações e na paleta de comandos. O que já foi visto é preferência do navegador.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import {
  BookText, CalendarClock, Clapperboard, Component, MessageCircleQuestion, type LucideIcon, Presentation, Radar, ShieldCheck, Sparkles, Waypoints,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { usePref } from "@/lib/preferencias";

/** Sobe quando há novidades que valem o aviso. Não é a versão do pacote: correção pequena não avisa de novo. */
export const VERSAO_NOVIDADES = "3.5";

const EVENTO = "nexo:novidades";
export const abrirNovidades = () => window.dispatchEvent(new Event(EVENTO));

const NOVIDADES: { icone: LucideIcon; titulo: string; texto: string; href: string; rotulo: string }[] = [
  { icone: CalendarClock, titulo: "Rotina: o dia em blocos e a hora de sair", texto: "Reserve horários para tarefas, chamados e pausas, e o app avisa o que é para fazer agora. Registre a entrada e ele diz a que horas você sai, com banco de horas da semana e do mês.", href: "/rotina", rotulo: "Abrir a Rotina" },
  { icone: BookText, titulo: "Documentação de verdade", texto: "Páginas dentro de páginas, numa árvore que você arrasta. Abas, modo leitura com sumário, modelos (processo, guia, runbook) e [[ para ligar uma página à outra.", href: "/paginas", rotulo: "Abrir Páginas" },
  { icone: Component, titulo: "Componentes no texto", texto: "Destaques coloridos, blocos que abrem e fecham, código com cores e botão copiar, índice automático, arquivos anexados e cartões vivos de tarefa.", href: "/paginas", rotulo: "Digite / numa página" },
  { icone: Clapperboard, titulo: "Páginas de vídeo", texto: "A gravação com player próprio, a transcrição acompanhando o que é dito, capítulos e anotações com o instante. Clique numa fala e o vídeo vai até ela.", href: "/paginas", rotulo: "Criar uma página de vídeo" },
  { icone: Waypoints, titulo: "Mapa e histórico", texto: "O mapa mostra quais páginas se citam e quais ficaram soltas. E cada página guarda como estava antes de cada edição, para você poder voltar.", href: "/paginas", rotulo: "Ver o mapa" },
  { icone: Presentation, titulo: "Modo reunião", texto: "Pauta montada sozinha, anotações, decisões e próximos passos numa tela, e a ata pronta para copiar. Fica no cabeçalho de cada tarefa.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: MessageCircleQuestion, titulo: "Perguntar ao Nexo", texto: "Escreva uma pergunta: o app acha os trechos do seu histórico que têm a ver e monta o prompt para o Copilot responder citando as fontes.", href: "/perguntar", rotulo: "Perguntar" },
  { icone: Radar, titulo: "Radar das frentes", texto: "A saúde de cada assunto (em risco, parado, pede atenção, em dia), os prazos das próximas semanas e um status em texto para o gestor.", href: "/radar", rotulo: "Abrir o radar" },
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
          description: "Rotina do dia em blocos, hora de sair e banco de horas.",
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
