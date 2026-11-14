// Verificação de integridade: olha os dados e o que existe na pasta e diz o que está estranho.
// É só leitura e é função pura (o servidor junta o inventário da pasta em lib/armazenamento.ts e chama aqui).
// Nada é consertado sozinho: o resultado explica o que foi achado e o que fazer.

import { alvosDoTexto } from "./ligacoes";
import { anexoDoSrc } from "./texto-rico";
import { type Dados, hojeISO } from "./tipos";

export type Gravidade = "erro" | "aviso" | "info";

export interface Achado {
  /** Estável, para a tela e os testes. */
  id: string;
  gravidade: Gravidade;
  titulo: string;
  /** O que isso quer dizer e o que fazer. */
  detalhe: string;
  /** Exemplos (nomes de arquivo, títulos), no máximo alguns. */
  itens?: string[];
}

export interface Inventario {
  anexos: { rel: string; tamanho: number }[];
  /** Arquivos soltos na raiz da pasta de dados. */
  raiz: string[];
  /** Arquivos dentro de tarefas/. */
  tarefas: string[];
  /** Tamanho somado dos JSON (tarefas e coleções). */
  bytes: number;
  maior: { nome: string; bytes: number };
  lixeira: string[];
  backups: string[];
  espelhos: string[];
}

export interface Verificacao {
  achados: Achado[];
  numeros: {
    tarefas: number; registros: number; passos: number; paginas: number; notas: number;
    anexos: number; bytesDados: number; bytesAnexos: number; backups: number; ultimoBackup: string | null;
  };
  quando: string;
}

const ALGUNS = 8;
const alguns = (itens: string[]) => (itens.length > ALGUNS ? [...itens.slice(0, ALGUNS), `e mais ${itens.length - ALGUNS}`] : itens);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const COLECOES_RAIZ = /^(categorias|links|pessoas|times|notas|modelos|paginas|nexo)[ ._(-].*\.json$/i;
const IMAGEM = /!\[[^\]]*\]\((arquivos\/[^)\s]+)\)/g;

/** Todos os textos em Markdown dos dados, com um nome de onde vieram. */
function textos(dados: Dados): { onde: string; texto: string }[] {
  const out: { onde: string; texto: string }[] = [];
  for (const t of dados.tarefas) {
    out.push({ onde: `tarefa "${t.titulo}"`, texto: t.descricao });
    if (t.panoramaIA?.texto) out.push({ onde: `panorama de "${t.titulo}"`, texto: t.panoramaIA.texto });
    for (const r of t.registros) out.push({ onde: `registro de ${r.data} em "${t.titulo}"`, texto: [r.anotacoes, r.resumoIA, r.decisoes, r.impedimentos].join("\n") });
  }
  for (const p of dados.paginas?.items ?? []) out.push({ onde: `página "${p.titulo || "sem título"}"`, texto: p.texto });
  for (const n of dados.notas?.items ?? []) out.push({ onde: `folha "${n.titulo || "sem título"}"`, texto: n.texto });
  return out;
}

export function verificarIntegridade(dados: Dados, inv: Inventario, hoje = hojeISO()): Verificacao {
  const achados: Achado[] = [];
  const por = (a: Achado) => achados.push(a.itens ? { ...a, itens: alguns(a.itens) } : a);

  const cats = new Set(dados.categorias.items.map((c) => c.id));
  const tarefas = new Set(dados.tarefas.map((t) => t.id));
  const pessoas = new Set((dados.pessoas?.items ?? []).map((p) => p.id));
  const paginas = new Set((dados.paginas?.items ?? []).map((p) => p.id));
  const notas = new Set((dados.notas?.items ?? []).map((n) => n.id));
  const naLixeira = (id: string) => inv.lixeira.some((n) => n.startsWith(`tarefa-${id}-`));

  // ---------- arquivos que não puderam ser lidos, conflitos do OneDrive ----------
  const ilegiveis = dados.avisos.filter((a) => a.includes("não é um JSON válido"));
  const outros = dados.avisos.filter((a) => !a.includes("não é um JSON válido"));
  if (ilegiveis.length)
    por({
      id: "ilegivel", gravidade: "erro", titulo: plural(ilegiveis.length, "arquivo não pôde ser lido", "arquivos não puderam ser lidos"),
      detalhe: "O app não grava por cima de arquivo ilegível, então nada foi perdido. Restaure um backup (logo acima) ou copie o arquivo certo de _backups para a pasta de dados.",
      itens: ilegiveis,
    });
  if (outros.length)
    por({
      id: "conflito", gravidade: "aviso", titulo: plural(outros.length, "aviso na leitura das tarefas", "avisos na leitura das tarefas"),
      detalhe: "Costuma ser cópia de conflito do OneDrive (o mesmo arquivo editado em dois PCs). Abra a pasta tarefas, confira qual das duas versões está certa e apague a outra.",
      itens: outros,
    });
  const copiasNaRaiz = inv.raiz.filter((n) => COLECOES_RAIZ.test(n));
  if (copiasNaRaiz.length)
    por({
      id: "copia-na-raiz", gravidade: "aviso", titulo: plural(copiasNaRaiz.length, "cópia de conflito na pasta de dados", "cópias de conflito na pasta de dados"),
      detalhe: "O app só lê os arquivos com o nome exato (categorias.json, links.json...). Estas cópias parecem ter sido criadas pelo OneDrive: confira se têm algo que falta e apague.",
      itens: copiasNaRaiz,
    });
  const sobras = [...inv.raiz, ...inv.tarefas].filter((n) => n.endsWith(".tmp"));
  if (sobras.length)
    por({ id: "tmp", gravidade: "info", titulo: plural(sobras.length, "sobra de gravação interrompida", "sobras de gravação interrompida"), detalhe: "Arquivos .tmp que ficaram de uma gravação que não terminou (queda de energia, app fechado no meio). Podem ser apagados.", itens: sobras });

  // ---------- ids repetidos ----------
  const repetidos: string[] = [];
  const conferir = (nome: string, ids: string[]) => {
    const vistos = new Set<string>();
    for (const id of ids) {
      if (vistos.has(id)) repetidos.push(`${nome}: ${id}`);
      vistos.add(id);
    }
  };
  conferir("categorias", dados.categorias.items.map((x) => x.id));
  conferir("links", dados.links.items.map((x) => x.id));
  conferir("pessoas", (dados.pessoas?.items ?? []).map((x) => x.id));
  conferir("times", (dados.times?.items ?? []).map((x) => x.id));
  conferir("notas", (dados.notas?.items ?? []).map((x) => x.id));
  conferir("modelos", (dados.modelos?.items ?? []).map((x) => x.id));
  conferir("páginas", (dados.paginas?.items ?? []).map((x) => x.id));
  for (const t of dados.tarefas) conferir(`registros de "${t.titulo}"`, t.registros.map((r) => r.id));
  if (repetidos.length)
    por({ id: "id-repetido", gravidade: "aviso", titulo: plural(repetidos.length, "identificador repetido", "identificadores repetidos"), detalhe: "Dois itens com o mesmo id: editar um pode mudar o outro. Costuma vir de junção manual de arquivos. Vale conferir os itens e recriar um deles.", itens: repetidos });

  // ---------- referências que apontam para o que não existe ----------
  const semCategoria = dados.tarefas.filter((t) => t.categoriaId && !cats.has(t.categoriaId));
  if (semCategoria.length)
    por({ id: "categoria-sumiu", gravidade: "aviso", titulo: plural(semCategoria.length, "tarefa aponta para uma categoria que não existe", "tarefas apontam para uma categoria que não existe"), detalhe: "Elas aparecem como \"Sem categoria\". Abra cada uma e escolha a categoria de novo (a categoria removida está na lixeira da pasta de dados).", itens: semCategoria.map((t) => t.titulo) });

  const orfaos: string[] = [];
  for (const l of dados.links.items) {
    if (l.tarefaId && !tarefas.has(l.tarefaId)) orfaos.push(`link "${l.titulo}": a tarefa ${naLixeira(l.tarefaId) ? "está na lixeira" : "não existe"}`);
    if (l.categoriaId && !cats.has(l.categoriaId)) orfaos.push(`link "${l.titulo}": a categoria não existe`);
  }
  for (const t of dados.times?.items ?? []) {
    const n = [...new Set([...t.membroIds, ...t.responsavelIds])].filter((id) => !pessoas.has(id)).length;
    if (n) orfaos.push(`time "${t.nome}": ${plural(n, "pessoa que não existe mais", "pessoas que não existem mais")}`);
    if (t.categoriaIds.some((id) => !cats.has(id))) orfaos.push(`time "${t.nome}": categoria que não existe`);
  }
  for (const p of dados.pessoas?.items ?? []) if (p.categoriaIds.some((id) => !cats.has(id))) orfaos.push(`pessoa "${p.nome}": categoria que não existe`);
  for (const p of dados.paginas?.items ?? []) if (p.categoriaId && !cats.has(p.categoriaId)) orfaos.push(`página "${p.titulo || "sem título"}": a categoria não existe`);
  for (const p of dados.paginas?.items ?? []) if (p.paiId && !paginas.has(p.paiId)) orfaos.push(`página "${p.titulo || "sem título"}": a página em que ela estava não existe mais (aparece na raiz)`);
  for (const m of dados.modelos?.items ?? []) if (m.categoriaId && !cats.has(m.categoriaId)) orfaos.push(`modelo "${m.nome}": a categoria não existe`);
  for (const n of dados.notas?.items ?? [])
    for (const g of n.gerou ?? []) if (!tarefas.has(g.tarefaId)) orfaos.push(`folha "${n.titulo || "sem título"}": gerou algo numa tarefa que ${naLixeira(g.tarefaId) ? "está na lixeira" : "não existe"}`);
  for (const t of dados.tarefas) for (const r of t.registros) if (r.notaId && !notas.has(r.notaId)) orfaos.push(`registro de ${r.data} em "${t.titulo}": a folha original não existe mais`);
  if (orfaos.length)
    por({ id: "referencia-orfa", gravidade: "info", titulo: plural(orfaos.length, "vínculo aponta para algo que não existe mais", "vínculos apontam para algo que não existe mais"), detalhe: "Não atrapalha o uso: o vínculo só não leva a lugar nenhum. Se a tarefa está na lixeira, restaurá-la conserta.", itens: orfaos });

  // ---------- links internos (@) quebrados ----------
  const todosOsTextos = textos(dados);
  const quebrados: string[] = [];
  for (const { onde, texto } of todosOsTextos)
    for (const alvo of alvosDoTexto(texto)) {
      const [tipo, id] = [alvo.slice(0, alvo.indexOf(":")), alvo.slice(alvo.indexOf(":") + 1)];
      const existe = tipo === "tarefa" ? tarefas.has(id) : tipo === "pagina" ? paginas.has(id) : tipo === "categoria" ? cats.has(id) : true; // pessoa é texto livre
      if (!existe) quebrados.push(`${onde}: cita ${tipo === "tarefa" ? "uma tarefa" : tipo === "pagina" ? "uma página" : "uma categoria"} que ${tipo === "tarefa" && naLixeira(id) ? "está na lixeira" : "não existe mais"}`);
    }
  if (quebrados.length)
    por({ id: "link-interno-quebrado", gravidade: "info", titulo: plural(quebrados.length, "citação (@) leva a algo que não existe mais", "citações (@) levam a algo que não existe mais"), detalhe: "O texto continua lá, mas o link não abre nada. Restaure o item da lixeira ou edite o texto.", itens: quebrados });

  // ---------- anexos ----------
  const noDisco = new Map(inv.anexos.map((a) => [a.rel, a.tamanho]));
  const citados = new Map<string, string>(); // rel -> onde
  for (const l of dados.links.items) if (l.tipo === "arquivo" && l.arquivo) citados.set(l.arquivo, `documento "${l.titulo}"`);
  for (const { onde, texto } of todosOsTextos)
    for (const m of (texto || "").matchAll(IMAGEM)) {
      const rel = anexoDoSrc(m[1]);
      if (rel && !citados.has(rel)) citados.set(rel, `imagem em ${onde}`);
    }
  const faltando = [...citados].filter(([rel]) => !noDisco.has(rel));
  if (faltando.length)
    por({
      id: "anexo-faltando", gravidade: "erro", titulo: plural(faltando.length, "anexo citado não está na pasta", "anexos citados não estão na pasta"),
      detalhe: "O arquivo deveria estar em arquivos/ dentro da pasta de dados. Se você usa OneDrive, espere a sincronização terminar e verifique de novo; se foi apagado à mão, procure na lixeira do Windows ou do OneDrive.",
      itens: faltando.map(([rel, onde]) => `${rel} (${onde})`),
    });
  const semUso = inv.anexos.filter((a) => !citados.has(a.rel));
  if (semUso.length) {
    const kb = Math.round(semUso.reduce((n, a) => n + a.tamanho, 0) / 1024);
    por({
      id: "anexo-sem-uso", gravidade: "info", titulo: plural(semUso.length, "anexo que nenhum item cita", "anexos que nenhum item cita"),
      detalhe: `Ocupam ${kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`}. O app nunca apaga anexo: eles podem ser de tarefas na lixeira, de links removidos ou de imagens tiradas de um texto. Só apague se tiver certeza.`,
      itens: semUso.map((a) => a.rel),
    });
  }

  // ---------- backups e espelho ----------
  const diarios = inv.backups.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
  const ultimoBackup = diarios.at(-1) ?? null;
  if (!inv.backups.length && dados.tarefas.length)
    por({ id: "sem-backup", gravidade: "aviso", titulo: "Nenhum backup na pasta de dados", detalhe: "O backup diário é tirado antes da primeira alteração de cada dia. Se a pasta _backups foi apagada, use \"Fazer backup agora\" para ter uma cópia de hoje." });
  const semEspelho = dados.tarefas.filter((t) => !inv.espelhos.some((n) => n.endsWith(`--${t.id}.md`)));
  if (semEspelho.length)
    por({ id: "sem-espelho", gravidade: "info", titulo: plural(semEspelho.length, "tarefa sem espelho em Markdown", "tarefas sem espelho em Markdown"), detalhe: "O espelho (pasta markdown) é refeito na próxima vez que a tarefa for gravada. Os dados de verdade estão nos arquivos .json.", itens: semEspelho.map((t) => t.titulo) });
  if (inv.maior.bytes > 1_500_000)
    por({ id: "tarefa-grande", gravidade: "info", titulo: "Uma tarefa está muito grande", detalhe: `O arquivo ${inv.maior.nome} tem ${(inv.maior.bytes / 1_048_576).toFixed(1)} MB. Cada gravação reescreve o arquivo inteiro: se a tarefa virou um assunto permanente, vale concluir e abrir outra, ou mover registros antigos para uma tarefa de histórico.` });

  const ordem: Gravidade[] = ["erro", "aviso", "info"];
  achados.sort((a, b) => ordem.indexOf(a.gravidade) - ordem.indexOf(b.gravidade));

  return {
    achados,
    numeros: {
      tarefas: dados.tarefas.length,
      registros: dados.tarefas.reduce((n, t) => n + t.registros.length, 0),
      passos: dados.tarefas.reduce((n, t) => n + t.registros.reduce((m, r) => m + r.proximosPassos.length, 0), 0),
      paginas: (dados.paginas?.items ?? []).length,
      notas: (dados.notas?.items ?? []).length,
      anexos: inv.anexos.length,
      bytesDados: inv.bytes,
      bytesAnexos: inv.anexos.reduce((n, a) => n + a.tamanho, 0),
      backups: inv.backups.length,
      ultimoBackup,
    },
    quando: hoje,
  };
}
