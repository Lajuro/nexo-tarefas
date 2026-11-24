// Primeiros passos (3.22): seis coisas que ensinam o Nexo fazendo. Nada é "marcado" pelo usuário: cada item é
// CALCULADO dos próprios dados (existe uma tarefa? existe um registro? algum passo foi concluído?), então a
// lista nunca mente e não há nada para guardar. Cada item sabe "mostrar onde": um alvo para o holofote.
//
// O bloco aparece na tela Hoje só para quem passou pelas boas-vindas (preferência "primeirosPassos" = "ativo"),
// some sozinho quando tudo foi feito e pode ser dispensado. Quem já usava o app não vê.
//
// Função pura. Testada em testes/ajuda.test.mjs.

import type { Alvo } from "./ajuda";
import { aberta } from "./lembretes";
import type { Categoria, Tarefa } from "./tipos";

export type IdDoPassoInicial = "tarefa" | "registro" | "passo" | "foco" | "planejar" | "categoria";

export interface PassoInicial {
  id: IdDoPassoInicial;
  titulo: string;
  /** Por que vale a pena, em uma linha. */
  porque: string;
  feito: boolean;
  /** Onde se faz isso: o holofote leva até lá. */
  onde: Alvo;
}

const NOVA_TAREFA: Alvo = {
  rota: null, seletor: "[data-slot=nova-tarefa], [data-slot=lateral] [aria-label='Nova tarefa']", titulo: "Nova tarefa",
  texto: "Clique aqui (ou aperte N). Só o título é obrigatório: o resto você completa depois.",
};

export function primeirosPassos(
  dados: { tarefas: Tarefa[]; categorias: Categoria[] },
  extra: { /** O ritual de planejar o dia já foi feito alguma vez neste navegador. */ planejou: boolean },
): PassoInicial[] {
  const { tarefas } = dados;
  const temTarefa = tarefas.length > 0;
  // a tarefa em que faz sentido registrar algo: a aberta mexida por último (ou qualquer uma)
  const alvoDeRegistro = [...tarefas].filter(aberta).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))[0] ?? tarefas[0];
  const registros = tarefas.flatMap((t) => t.registros.filter((r) => r.tipo !== "marco"));
  const passos = registros.flatMap((r) => r.proximosPassos);
  const temAberto = tarefas.some((t) => aberta(t) && t.registros.some((r) => r.proximosPassos.some((p) => !p.feito)));

  const naTarefa: Alvo = alvoDeRegistro
    ? { rota: `/tarefas/${alvoDeRegistro.id}`, seletor: "[data-slot=registrar][data-tipo=reuniao]", titulo: "Registrar o que aconteceu", texto: "Cada conversa ou atividade vira um registro na linha do tempo. Escreva solto: dá para organizar depois, com ou sem o Copilot." }
    : { ...NOVA_TAREFA, texto: "Primeiro crie uma tarefa. O registro é feito dentro dela." };

  return [
    { id: "tarefa", titulo: "Criar uma tarefa", porque: "É onde tudo começa: um assunto que você precisa acompanhar.", feito: temTarefa, onde: NOVA_TAREFA },
    { id: "registro", titulo: "Registrar uma conversa", porque: "A linha do tempo é a memória da tarefa: o que foi dito, decidido e combinado.", feito: registros.length > 0, onde: naTarefa },
    {
      id: "passo", titulo: "Concluir um passo", porque: "Os passos de cada registro viram a sua lista de pendências.", feito: passos.some((p) => p.feito),
      onde: temAberto
        ? { rota: "/pendencias", seletor: "[data-slot=lista-pendencias] [data-slot=passo]", titulo: "Marcar um passo", texto: "Aqui estão os passos em aberto de todas as tarefas. Marque quando fizer: dá para desfazer logo em seguida." }
        : { ...naTarefa, texto: "Os passos nascem num registro, no campo Próximos passos. Registre uma conversa e anote o que ficou combinado." },
    },
    {
      id: "foco", titulo: "Escolher o foco de hoje", porque: "Poucas tarefas por dia: é assim que o app sabe o que vem primeiro.", feito: tarefas.some((t) => !!t.focoEm),
      onde: { rota: "/", seletor: "[data-slot=foco-hoje]", titulo: "Foco de hoje", texto: "Escolha as tarefas em que vai trabalhar hoje. Amanhã elas deixam de ser foco sozinhas." },
    },
    {
      id: "planejar", titulo: "Planejar o dia", porque: "Um ritual de um minuto: o que ficou para trás, o foco e pronto.", feito: extra.planejou,
      onde: { rota: "/", seletor: "[data-acao=planejar-o-dia]", titulo: "Planejar o dia", texto: "Abre o ritual da manhã. A tecla D faz o mesmo de qualquer tela." },
    },
    {
      id: "categoria", titulo: "Criar uma categoria", porque: "Categorias juntam as tarefas do mesmo assunto e ganham uma página só delas.", feito: dados.categorias.length > 0,
      onde: { rota: "/categorias", seletor: "[data-slot=nova-categoria]", titulo: "Nova categoria", texto: "Um nome e uma cor. Depois é só escolher a categoria ao criar a tarefa." },
    },
  ];
}

export function resumoDosPrimeirosPassos(lista: PassoInicial[]) {
  const feitos = lista.filter((p) => p.feito).length;
  return { feitos, total: lista.length, completo: feitos === lista.length, proximo: lista.find((p) => !p.feito) ?? null };
}

/** O estado do bloco, guardado no navegador: "" (nunca passou pelas boas-vindas), "ativo" ou "dispensado". */
export const ESTADOS_DOS_PRIMEIROS_PASSOS = ["", "ativo", "dispensado"] as const;
export type EstadoDosPrimeirosPassos = (typeof ESTADOS_DOS_PRIMEIROS_PASSOS)[number];
export const normalizarEstadoDosPrimeirosPassos = (x: unknown): EstadoDosPrimeirosPassos =>
  ESTADOS_DOS_PRIMEIROS_PASSOS.includes(x as EstadoDosPrimeirosPassos) ? (x as EstadoDosPrimeirosPassos) : "";
