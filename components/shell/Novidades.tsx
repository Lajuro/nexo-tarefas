"use client";

// "O que há de novo": uma janela com as novidades da versão. Não abre sozinha por cima do trabalho:
// na primeira vez depois de atualizar, aparece só um aviso discreto com o botão "Ver". Depois disso fica
// em Configurações e na paleta de comandos. O que já foi visto é preferência do navegador.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import {
  BookText, MessageCircleQuestion, type LucideIcon, NotebookPen, Presentation, Radar, ShieldCheck, Sparkles, Trophy,
} from "lucide-react";
import { useNexo } from "@/components/Provider";
import { Modal } from "@/components/comum";
import { Button } from "@/components/ui/button";
import { usePref } from "@/lib/preferencias";

/** Sobe quando há novidades que valem o aviso. Não é a versão do pacote: correção pequena não avisa de novo. */
export const VERSAO_NOVIDADES = "3.0";

const EVENTO = "nexo:novidades";
export const abrirNovidades = () => window.dispatchEvent(new Event(EVENTO));

const NOVIDADES: { icone: LucideIcon; titulo: string; texto: string; href: string; rotulo: string }[] = [
  { icone: Presentation, titulo: "Modo reunião", texto: "Pauta montada sozinha, anotações, decisões e próximos passos numa tela, e a ata pronta para copiar. Fica no cabeçalho de cada tarefa.", href: "/tarefas", rotulo: "Ir para Tarefas" },
  { icone: MessageCircleQuestion, titulo: "Perguntar ao Nexo", texto: "Escreva uma pergunta: o app acha os trechos do seu histórico que têm a ver e monta o prompt para o Copilot responder citando as fontes.", href: "/perguntar", rotulo: "Perguntar" },
  { icone: Radar, titulo: "Radar das frentes", texto: "A saúde de cada assunto (em risco, parado, pede atenção, em dia), os prazos das próximas semanas e um status em texto para o gestor.", href: "/radar", rotulo: "Abrir o radar" },
  { icone: BookText, titulo: "Páginas de conhecimento e @", texto: "Guarde processos e passo a passo em páginas. Em qualquer texto, @ cita uma tarefa, pessoa ou página, e cada item mostra quem aponta para ele.", href: "/paginas", rotulo: "Abrir Páginas" },
  { icone: NotebookPen, titulo: "Editor de texto completo", texto: "Títulos, listas de tarefas, tabelas e imagens coladas com Ctrl V nas folhas, nas anotações e nas páginas. Digite / para ver os blocos.", href: "/notas", rotulo: "Abrir Notas" },
  { icone: Trophy, titulo: "Conquistas", texto: "Nível, meta do dia e conquistas calculados do que você registra. Dá para desligar em Configurações.", href: "/conquistas", rotulo: "Ver conquistas" },
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
          description: "Modo reunião, perguntar ao histórico, radar das frentes e mais.",
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
        Também novos desde a 2.8: o Diário, &quot;esperando quem&quot; com mensagem de cobrança, modelos de tarefa e a sessão de foco. A lista de atalhos abre com a tecla ?.
      </p>
    </Modal>
  );
}
