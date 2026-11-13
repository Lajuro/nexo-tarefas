import {
  type Categoria, type Registro, type Tarefa, formatarData, nomeStatus, ordenarRegistros, passosAbertos, semAcento, tipoInfo,
} from "./tipos";

// Todos os prompts que o Nexo monta para colar no Copilot.
// O formato de resposta é fixo para o app conseguir separar as partes sozinho.

const SECOES = {
  resumo: "RESUMO",
  decisoes: "DECISÕES",
  passos: "PRÓXIMOS PASSOS",
  impedimentos: "IMPEDIMENTOS",
  participantes: "PARTICIPANTES",
  concluidos: "PASSOS CONCLUÍDOS",
} as const;

const REGRAS = `Regras:
- Responda em português do Brasil, de forma objetiva.
- Use SOMENTE as informações fornecidas. Não invente nomes, datas ou fatos.
- Se uma seção não tiver conteúdo, escreva apenas "Nenhum".
- Mantenha exatamente os títulos das seções, cada um sozinho numa linha começando com "## ".`;

function cabecalhoTarefa(t: Tarefa, cat?: Categoria) {
  const L = [
    `Tarefa: ${t.titulo}`,
    `Categoria: ${cat?.nome || "Sem categoria"}`,
    `Status atual: ${nomeStatus(t.status)} | Prioridade: ${t.prioridade}/10${t.prazo ? ` | Prazo: ${formatarData(t.prazo)}` : ""}`,
  ];
  if (t.descricao) L.push(`Descrição: ${t.descricao}`);
  return L.join("\n");
}

function linhaRegistro(r: Registro, detalhado: boolean) {
  const tipo = tipoInfo(r.tipo).nome;
  const L = [`[${formatarData(r.data)}] ${tipo}${r.titulo ? `: ${r.titulo}` : ""}`];
  if (r.participantes.length) L.push(`  Participantes: ${r.participantes.join(", ")}`);
  const corpo = r.resumoIA || (detalhado ? r.anotacoes : r.anotacoes.slice(0, 600));
  if (corpo) L.push(`  ${corpo.replace(/\n/g, "\n  ")}`);
  if (r.decisoes && r.decisoes !== "Nenhum") L.push(`  Decisões: ${r.decisoes.replace(/\n/g, " ")}`);
  if (r.impedimentos && r.impedimentos !== "Nenhum") L.push(`  Impedimentos: ${r.impedimentos.replace(/\n/g, " ")}`);
  if (r.proximosPassos.length)
    L.push(`  Passos: ${r.proximosPassos.map((p) => `${p.feito ? "[feito]" : "[aberto]"} ${p.texto}`).join("; ")}`);
  if (r.alteracoes?.status) L.push(`  Status mudou: ${r.alteracoes.status.de} -> ${r.alteracoes.status.para}`);
  return L.join("\n");
}

function historico(t: Tarefa, limite = 8, excluirId?: string) {
  const regs = ordenarRegistros(t.registros).filter((r) => r.id !== excluirId);
  const ult = regs.slice(-limite);
  if (!ult.length) return "Sem registros anteriores.";
  const pre = regs.length > ult.length ? `(${regs.length - ult.length} registros mais antigos omitidos)\n` : "";
  return pre + ult.map((r) => linhaRegistro(r, false)).join("\n");
}

function listaAbertos(t: Tarefa, excluirId?: string) {
  const ab = passosAbertos(t).filter((x) => x.registro.id !== excluirId);
  return ab.length ? ab.map((x) => `- ${x.passo.texto}`).join("\n") : "Nenhum";
}

// 1) Prompt para organizar as anotações de um registro (reunião, atividade...)
export function promptRegistro(t: Tarefa, cat: Categoria | undefined, r: Registro) {
  const tipo = tipoInfo(r.tipo).nome.toLowerCase();
  return `Você é meu assistente de organização de trabalho. Vou te passar o contexto de uma tarefa e minhas anotações brutas de um(a) ${tipo}. Organize as anotações no formato pedido.

=== CONTEXTO DA TAREFA ===
${cabecalhoTarefa(t, cat)}

=== HISTÓRICO RECENTE ===
${historico(t, 6, r.id)}

=== PASSOS QUE ESTAVAM EM ABERTO ===
${listaAbertos(t, r.id)}

=== ${tipo.toUpperCase()} DE ${formatarData(r.data)}${r.titulo ? ` (${r.titulo})` : ""} ===
Participantes informados: ${r.participantes.join(", ") || "não informados"}
Anotações brutas:
${r.anotacoes || "(sem anotações)"}

=== FORMATO DA RESPOSTA ===
## ${SECOES.resumo}
(3 a 6 linhas explicando o que aconteceu e qual foi o avanço)

## ${SECOES.decisoes}
- (uma decisão por linha)

## ${SECOES.passos}
- (uma ação por linha; se houver responsável, termine com "(responsável: Nome)")

## ${SECOES.impedimentos}
- (bloqueios, riscos ou dependências)

## ${SECOES.participantes}
- (nomes citados nas anotações, um por linha)

## ${SECOES.concluidos}
- (copie EXATAMENTE o texto dos "passos que estavam em aberto" que as anotações indicam como resolvidos)

${REGRAS}`;
}

// 2) Panorama da tarefa inteira (status report)
export function promptPanorama(t: Tarefa, cat?: Categoria) {
  return `Você é meu assistente de acompanhamento de demandas. Com base no histórico completo abaixo, monte um panorama da tarefa.

=== TAREFA ===
${cabecalhoTarefa(t, cat)}
Criada em: ${formatarData(t.criadaEm)}

=== LINHA DO TEMPO COMPLETA ===
${ordenarRegistros(t.registros).map((r) => linhaRegistro(r, true)).join("\n\n") || "Sem registros."}

=== PASSOS EM ABERTO ===
${listaAbertos(t)}

=== FORMATO DA RESPOSTA ===
## SITUAÇÃO ATUAL
(onde a tarefa está hoje, em 3 a 5 linhas)

## LINHA DO TEMPO RESUMIDA
- (marcos principais com data)

## PENDÊNCIAS E RESPONSÁVEIS
- (o que falta e com quem está)

## RISCOS E IMPEDIMENTOS
- (o que pode atrasar)

## SUGESTÃO DE PRÓXIMOS PASSOS
- (ações concretas)

## MENSAGEM DE STATUS
(um parágrafo curto pronto para eu mandar ao meu gestor)

${REGRAS}`;
}

// 3) Preparar a próxima reunião
export function promptPrepararReuniao(t: Tarefa, cat?: Categoria) {
  return `Vou ter uma reunião sobre a tarefa abaixo. Com base no histórico, prepare uma pauta.

=== TAREFA ===
${cabecalhoTarefa(t, cat)}

=== HISTÓRICO ===
${historico(t, 10)}

=== PASSOS EM ABERTO ===
${listaAbertos(t)}

=== FORMATO DA RESPOSTA ===
## OBJETIVO DA REUNIÃO
## PAUTA
- (tópicos em ordem)
## PERGUNTAS QUE EU PRECISO FAZER
- (perguntas para destravar pendências)
## O QUE COBRAR
- (itens em aberto e de quem)

${REGRAS}`;
}

// 4) Relatório de um período, cruzando várias tarefas
export function promptRelatorio(
  tarefas: Tarefa[], categorias: Categoria[], inicio: string, fim: string, foco: string,
) {
  const blocos: string[] = [];
  for (const t of tarefas) {
    const regs = ordenarRegistros(t.registros).filter((r) => r.data >= inicio && r.data <= fim);
    if (!regs.length) continue;
    const cat = categorias.find((c) => c.id === t.categoriaId);
    blocos.push(
      `### ${t.titulo} (${cat?.nome || "Sem categoria"} | ${nomeStatus(t.status)})\n` +
        regs.map((r) => linhaRegistro(r, false)).join("\n"),
    );
  }
  return `Monte um relatório das minhas atividades de ${formatarData(inicio)} a ${formatarData(fim)}${foco ? ` com foco em: ${foco}` : ""}.

=== REGISTROS DO PERÍODO, POR TAREFA ===
${blocos.join("\n\n") || "Nenhum registro no período."}

=== FORMATO DA RESPOSTA ===
## VISÃO GERAL
(um parágrafo)

## ENTREGAS E AVANÇOS
- (por tarefa)

## REUNIÕES E ALINHAMENTOS
- (data, com quem, resultado)

## PENDÊNCIAS E IMPEDIMENTOS
- (o que segue aberto)

## PRÓXIMO PERÍODO
- (prioridades sugeridas)

${REGRAS}`;
}

// 5) Panorama de uma categoria inteira
export function promptCategoria(cat: Categoria, tarefas: Tarefa[]) {
  const blocos = tarefas.map((t) => {
    const ult = ordenarRegistros(t.registros).slice(-3);
    return `### ${t.titulo} (${nomeStatus(t.status)}, prioridade ${t.prioridade}${t.prazo ? `, prazo ${formatarData(t.prazo)}` : ""})\n${ult.map((r) => linhaRegistro(r, false)).join("\n") || "Sem registros."}`;
  });
  return `Abaixo estão todas as tarefas que surgiram do assunto "${cat.nome}"${cat.descricao ? ` (${cat.descricao})` : ""}. Faça um panorama do assunto como um todo.

${blocos.join("\n\n")}

=== FORMATO DA RESPOSTA ===
## PANORAMA DO ASSUNTO
## O QUE JÁ FOI ENTREGUE
-
## O QUE ESTÁ EM ANDAMENTO
-
## PONTOS DE ATENÇÃO
-
## PADRÕES QUE SE REPETEM
- (problemas ou pedidos recorrentes entre as tarefas)

${REGRAS}`;
}

// ---------- leitura da resposta colada ----------

export interface RespostaInterpretada {
  resumo: string;
  decisoes: string;
  passos: { texto: string; responsavel: string }[];
  impedimentos: string;
  participantes: string[];
  concluidos: string[];
  reconheceu: boolean;
}

const MAPA: Record<string, keyof typeof SECOES> = {
  resumo: "resumo",
  decisoes: "decisoes",
  "proximos passos": "passos",
  impedimentos: "impedimentos",
  "impedimentos e riscos": "impedimentos",
  participantes: "participantes",
  "passos concluidos": "concluidos",
};

function chaveTitulo(linha: string) {
  const limpo = semAcento(linha)
    .replace(/^[#>*_\s\d.)-]+/, "")
    .replace(/[*_:#\s]+$/, "")
    .trim();
  return MAPA[limpo] ?? null;
}

const vazio = (s: string) => !s || /^(nenhum|nenhuma|n\/a|-|nada)\.?$/i.test(s.trim());

function itens(bloco: string) {
  return bloco
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*(?:\[[ xX]?\]\s*)?/, "").trim())
    .filter((l) => l && !vazio(l));
}

export function interpretarResposta(texto: string): RespostaInterpretada {
  const partes: Partial<Record<keyof typeof SECOES, string[]>> = {};
  let atual: keyof typeof SECOES | null = null;
  for (const linha of texto.replace(/\r/g, "").split("\n")) {
    const k = linha.trim().length < 40 ? chaveTitulo(linha) : null;
    if (k) {
      atual = k;
      partes[k] = partes[k] || [];
      continue;
    }
    if (atual) partes[atual]!.push(linha);
  }
  const bloco = (k: keyof typeof SECOES) => (partes[k] || []).join("\n").trim();
  const txt = (k: keyof typeof SECOES) => (vazio(bloco(k)) ? "" : bloco(k));
  const passos = itens(bloco("passos")).map((l) => {
    const m = l.match(/\(\s*respons[aá]vel\s*:\s*([^)]+)\)\s*$/i);
    return { texto: m ? l.slice(0, m.index).trim() : l, responsavel: m ? m[1].trim() : "" };
  });
  const reconheceu = Object.keys(partes).length > 0;
  return {
    resumo: reconheceu ? txt("resumo") : texto.trim(),
    decisoes: txt("decisoes"),
    passos,
    impedimentos: txt("impedimentos"),
    participantes: itens(bloco("participantes")),
    concluidos: itens(bloco("concluidos")),
    reconheceu,
  };
}

export function mesmoTexto(a: string, b: string) {
  const n = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, " ").trim();
  const x = n(a), y = n(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}
