// Ícones com silhuetas diferentes entre si (3.9): com a barra recolhida, só o ícone diz qual tela é.
// Evite repetir a "folha com linhas" (FileText, BookText, NotebookPen, ListTodo...) em dois itens.
import {
  CalendarClock, ChartColumn, ClipboardCheck, Footprints, Gavel, History, Library, Link2, type LucideIcon, MessageCircleQuestion, Radar, Settings, Shapes,
  SquareKanban, StickyNote, Sun, Telescope, Trophy, Users,
} from "lucide-react";

export interface ItemNav {
  href: string;
  nome: string;
  icone: LucideIcon;
  /** Segunda tecla do atalho "G depois X". */
  tecla?: string;
}

export const NAV: { grupo: string; itens: ItemNav[] }[] = [
  {
    grupo: "Dia a dia",
    itens: [
      { href: "/", nome: "Hoje", icone: Sun, tecla: "h" },
      { href: "/tarefas", nome: "Tarefas", icone: SquareKanban, tecla: "t" },
      { href: "/rotina", nome: "Rotina", icone: CalendarClock, tecla: "o" },
      { href: "/pendencias", nome: "Pendências", icone: Footprints, tecla: "p" },
      { href: "/notas", nome: "Notas", icone: StickyNote, tecla: "n" },
    ],
  },
  {
    grupo: "Conhecimento",
    itens: [
      { href: "/paginas", nome: "Páginas", icone: Library, tecla: "a" },
      { href: "/perguntar", nome: "Perguntar", icone: MessageCircleQuestion, tecla: "u" },
      { href: "/categorias", nome: "Categorias", icone: Shapes, tecla: "c" },
      { href: "/pessoas", nome: "Pessoas", icone: Users, tecla: "e" },
      { href: "/links", nome: "Links e docs", icone: Link2, tecla: "l" },
    ],
  },
  {
    grupo: "Acompanhar",
    itens: [
      { href: "/radar", nome: "Radar", icone: Radar, tecla: "f" },
      { href: "/diario", nome: "Diário", icone: History, tecla: "d" },
      { href: "/decisoes", nome: "Decisões", icone: Gavel, tecla: "i" },
      { href: "/revisao", nome: "Revisão semanal", icone: ClipboardCheck, tecla: "s" },
      { href: "/relatorios", nome: "Relatórios", icone: ChartColumn, tecla: "r" },
      { href: "/conquistas", nome: "Conquistas", icone: Trophy, tecla: "q" },
    ],
  },
];

/** O grupo cujas telas viram abas de uma tela só (components/shell/Acompanhar.tsx). */
export const GRUPO_ACOMPANHAR = "Acompanhar";
export const TELAS_ACOMPANHAR: ItemNav[] = NAV.find((g) => g.grupo === GRUPO_ACOMPANHAR)!.itens;

/**
 * O item único do menu no lugar das telas de acompanhar. O `href` é só a chave dele nas preferências
 * (ordem, itens escondidos): o link de verdade leva à última aba usada.
 */
export const ITEM_ACOMPANHAR: ItemNav = { href: "/acompanhar", nome: "Acompanhar", icone: Telescope };

/** A tela é uma das de acompanhar? */
export const ehAcompanhar = (pathname: string) => TELAS_ACOMPANHAR.some((n) => rotaAtiva(pathname, n.href));

/** Os grupos do menu como o usuário escolheu: as telas de acompanhar juntas num item (padrão) ou separadas. */
export const gruposDoMenu = (separado: boolean) =>
  separado ? NAV : NAV.map((g) => (g.grupo === GRUPO_ACOMPANHAR ? { ...g, itens: [ITEM_ACOMPANHAR] } : g));

export const NAV_CONFIG: ItemNav = { href: "/configuracoes", nome: "Configurações", icone: Settings };

export const TODOS_NAV: ItemNav[] = [...NAV.flatMap((g) => g.itens), NAV_CONFIG];

export const rotaAtiva = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

/** Nome da tela para a aba do navegador e a migalha. */
export function nomeDaRota(pathname: string) {
  if (pathname.startsWith("/busca")) return "Busca";
  return TODOS_NAV.find((n) => rotaAtiva(pathname, n.href))?.nome ?? "Nexo";
}

export const ATALHOS: { teclas: string[]; descricao: string }[] = [
  { teclas: ["N"], descricao: "Nova tarefa" },
  { teclas: ["Ctrl", "K"], descricao: "Paleta de comandos: buscar e ir para qualquer lugar" },
  { teclas: ["/"], descricao: "Buscar" },
  { teclas: ["G", "H"], descricao: "Ir para Hoje" },
  { teclas: ["G", "T"], descricao: "Ir para Tarefas" },
  { teclas: ["G", "O"], descricao: "Ir para a Rotina (o dia em blocos, a hora de sair e o banco de horas)" },
  { teclas: ["G", "P"], descricao: "Ir para Pendências" },
  { teclas: ["G", "N"], descricao: "Ir para Notas (bloco de notas)" },
  { teclas: ["G", "A"], descricao: "Ir para Páginas (conhecimento)" },
  { teclas: ["G", "U"], descricao: "Ir para Perguntar (achar a resposta no histórico, com o Copilot)" },
  { teclas: ["G", "C"], descricao: "Ir para Categorias" },
  { teclas: ["G", "E"], descricao: "Ir para Pessoas" },
  { teclas: ["G", "L"], descricao: "Ir para Links e docs" },
  { teclas: ["G", "F"], descricao: "Ir para o Radar (saúde de cada categoria e prazos)" },
  { teclas: ["G", "D"], descricao: "Ir para o Diário (o que aconteceu, dia a dia)" },
  { teclas: ["G", "I"], descricao: "Ir para Decisões (o que foi decidido, quando e com quem)" },
  { teclas: ["G", "S"], descricao: "Ir para a Revisão semanal" },
  { teclas: ["G", "R"], descricao: "Ir para Relatórios" },
  { teclas: ["G", "Q"], descricao: "Ir para Conquistas (nível, meta do dia)" },
  { teclas: ["D"], descricao: "Planejar o dia" },
  { teclas: ["Shift", "D"], descricao: "Fechar o dia (o que saiu, o que fica para amanhã e a daily)" },
  { teclas: ["A"], descricao: "Anotar rápido: tarefa ou nota, de qualquer tela" },
  { teclas: ["P"], descricao: "Trocar de perfil de uso (no menu, 1 a 9 escolhe)" },
  { teclas: ["Ctrl", "B"], descricao: "Recolher ou abrir a barra lateral" },
  { teclas: ["Ctrl", "Enter"], descricao: "Salvar o formulário aberto" },
  { teclas: ["Ctrl", "Z"], descricao: "Desfazer a última ação (fora de um campo de texto)" },
  { teclas: ["F11"], descricao: "Tela cheia" },
  { teclas: ["Esc"], descricao: "Fechar janelas e menus" },
  { teclas: ["?"], descricao: "Ajuda desta tela e esta lista de atalhos" },
];
