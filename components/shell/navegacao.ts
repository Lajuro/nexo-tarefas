import {
  BookOpenText, BookText, CalendarCheck, CircleCheckBig, FileText, Trophy, Link2, ListTodo, type LucideIcon, MessageCircleQuestion, NotebookPen, Radar, Settings, Shapes, Sun, Users,
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
      { href: "/tarefas", nome: "Tarefas", icone: ListTodo, tecla: "t" },
      { href: "/pendencias", nome: "Pendências", icone: CircleCheckBig, tecla: "p" },
      { href: "/notas", nome: "Notas", icone: NotebookPen, tecla: "n" },
    ],
  },
  {
    grupo: "Organização",
    itens: [
      { href: "/paginas", nome: "Páginas", icone: BookText, tecla: "a" },
      { href: "/perguntar", nome: "Perguntar", icone: MessageCircleQuestion, tecla: "u" },
      { href: "/categorias", nome: "Categorias", icone: Shapes, tecla: "c" },
      { href: "/pessoas", nome: "Pessoas", icone: Users, tecla: "e" },
      { href: "/links", nome: "Links e docs", icone: Link2, tecla: "l" },
    ],
  },
  {
    grupo: "Rotina",
    itens: [
      { href: "/radar", nome: "Radar", icone: Radar, tecla: "f" },
      { href: "/diario", nome: "Diário", icone: BookOpenText, tecla: "d" },
      { href: "/revisao", nome: "Revisão semanal", icone: CalendarCheck, tecla: "s" },
      { href: "/relatorios", nome: "Relatórios", icone: FileText, tecla: "r" },
      { href: "/conquistas", nome: "Conquistas", icone: Trophy, tecla: "q" },
    ],
  },
];

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
  { teclas: ["G", "P"], descricao: "Ir para Pendências" },
  { teclas: ["G", "N"], descricao: "Ir para Notas (bloco de notas)" },
  { teclas: ["G", "A"], descricao: "Ir para Páginas (conhecimento)" },
  { teclas: ["G", "U"], descricao: "Ir para Perguntar (achar a resposta no histórico, com o Copilot)" },
  { teclas: ["G", "C"], descricao: "Ir para Categorias" },
  { teclas: ["G", "E"], descricao: "Ir para Pessoas" },
  { teclas: ["G", "L"], descricao: "Ir para Links e docs" },
  { teclas: ["G", "F"], descricao: "Ir para o Radar das frentes (saúde de cada assunto e prazos)" },
  { teclas: ["G", "D"], descricao: "Ir para o Diário (o que aconteceu, dia a dia)" },
  { teclas: ["G", "S"], descricao: "Ir para a Revisão semanal" },
  { teclas: ["G", "R"], descricao: "Ir para Relatórios" },
  { teclas: ["G", "Q"], descricao: "Ir para Conquistas (nível, meta do dia)" },
  { teclas: ["D"], descricao: "Planejar o dia" },
  { teclas: ["A"], descricao: "Anotar rápido: tarefa ou nota, de qualquer tela" },
  { teclas: ["Ctrl", "B"], descricao: "Recolher ou abrir a barra lateral" },
  { teclas: ["Ctrl", "Enter"], descricao: "Salvar o formulário aberto" },
  { teclas: ["Esc"], descricao: "Fechar janelas e menus" },
  { teclas: ["?"], descricao: "Ver esta lista de atalhos" },
];
