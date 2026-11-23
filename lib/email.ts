// Colar um e-mail num registro (3.17).
//
// O usuário copia o e-mail no Outlook (com o cabeçalho De / Enviada em / Para / Assunto, que é o que vem junto
// ao responder ou encaminhar) e cola no Nexo. Aqui o texto é lido: o assunto vira título, a data vira a data do
// registro, quem está em De, Para e Cc vira participante e o corpo vai para as anotações. Sem API e sem abrir
// arquivo .msg: é só texto colado.
//
// O texto colado é entrada não confiável. Tudo o que sai daqui é texto com tamanho limitado; o corpo é escrito
// como Markdown com a marcação escapada (um "<" vira "&lt;", um "#" no começo da linha não vira título), então
// nada dele vira formatação, link, imagem ou HTML. Data e hora só valem se forem de calendário de verdade.
//
// Funções puras, testadas em testes/email.test.mjs.

import { interpretarColagem, nomeDoEmail } from "./importar-pessoas";
import { acharPessoa, chaveNome, nomeParaCadastro } from "./pessoas";
import { type Pessoa, type Registro, dataReal, formatarData, horaValida, semAcento } from "./tipos";

/** Teto do texto colado que é lido (um e-mail com uma conversa longa embaixo passa disso raramente). */
export const MAX_EMAIL = 200_000;
const MAX_ASSUNTO = 300;
const MAX_PESSOAS = 60;

export interface PessoaDoEmail { nome: string; email: string }

export interface EmailLido {
  /** Achou o cabeçalho (pelo menos dois de: De, Para, Assunto, data)? Sem isso, tudo vai para `corpo`. */
  reconheceu: boolean;
  /** Sem "RES:", "ENC:", "RE:", "FW:" na frente. */
  assunto: string;
  de: PessoaDoEmail | null;
  para: PessoaDoEmail[];
  cc: PessoaDoEmail[];
  /** AAAA-MM-DD, ou "" se não deu para ler. */
  data: string;
  /** HH:MM, ou "". */
  hora: string;
  /** O texto do e-mail, sem o cabeçalho. */
  corpo: string;
  /** O texto colado passou do teto e foi cortado. */
  cortado: boolean;
}

// ---------- cabeçalho ----------

type Campo = "de" | "para" | "cc" | "data" | "assunto" | "outro";

/** Rótulos do cabeçalho como o Outlook escreve, em português e em inglês (sem acento, minúsculas). */
const ROTULOS: Record<string, Campo> = {
  de: "de", from: "de",
  para: "para", to: "para",
  cc: "cc", "com copia": "cc", copia: "cc",
  cco: "outro", bcc: "outro",
  "enviada em": "data", "enviado em": "data", enviada: "data", enviado: "data", data: "data", sent: "data", date: "data",
  assunto: "assunto", subject: "assunto",
  importancia: "outro", importance: "outro", prioridade: "outro", anexos: "outro", attachments: "outro",
  "responder a": "outro", "reply-to": "outro", categorias: "outro", categories: "outro",
};

const LINHA_DE_CAMPO = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-]{0,22}):[ \t]*(.*)$/;
/** Linha que só separa mensagens ("-----Mensagem original-----", "________________"). */
const SEPARADOR = /^[\s_\-=*]*(mensagem original|original message|mensagem encaminhada|forwarded message)?[\s_\-=*]*$/i;

const espacos = (s: string) => s.replace(/\s+/g, " ").trim();

/** Tira "RES:", "RE:", "ENC:", "FW:", "FWD:", "TR:" do começo do assunto, quantas vezes aparecerem. */
export function assuntoLimpo(bruto: string): string {
  let s = espacos(bruto);
  for (let i = 0; i < 10; i++) {
    const sem = s.replace(/^(res|re|enc|fw|fwd|tr|rv)\s*:\s*/i, "");
    if (sem === s) break;
    s = sem;
  }
  return s.slice(0, MAX_ASSUNTO);
}

const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, january: 1, fev: 2, fevereiro: 2, feb: 2, february: 2, mar: 3, marco: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4, mai: 5, maio: 5, may: 5, jun: 6, junho: 6, june: 6, jul: 7, julho: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8, set: 9, setembro: 9, sep: 9, sept: 9, september: 9, out: 10, outubro: 10, oct: 10, october: 10,
  nov: 11, novembro: 11, november: 11, dez: 12, dezembro: 12, dec: 12, december: 12,
};

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * Data e hora de uma linha "Enviada em". Aceita os jeitos mais comuns: "quinta-feira, 19 de novembro de 2026 14:32",
 * "19/11/2026 14:32", "Thursday, November 19, 2026 2:32 PM", "Thu, 19 Nov 2026 14:32:10 -0300", "2026-11-19 14:32".
 * O que não for uma data de calendário de verdade volta vazio.
 */
export function dataDoEmail(bruto: string): { data: string; hora: string } {
  const s = semAcento(espacos(bruto));
  let ano = 0, mes = 0, dia = 0;
  let m: RegExpExecArray | null;
  if ((m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(s))) [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /\b(\d{1,2}) de ([a-z]{3,9})\.? de (\d{4})\b/.exec(s))) [dia, mes, ano] = [Number(m[1]), MESES[m[2]] ?? 0, Number(m[3])];
  else if ((m = /\b([a-z]{3,9})\.? (\d{1,2}), (\d{4})\b/.exec(s))) [mes, dia, ano] = [MESES[m[1]] ?? 0, Number(m[2]), Number(m[3])];
  else if ((m = /\b(\d{1,2}) ([a-z]{3,9})\.? (\d{4})\b/.exec(s))) [dia, mes, ano] = [Number(m[1]), MESES[m[2]] ?? 0, Number(m[3])];
  else if ((m = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/.exec(s))) {
    const a = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    // dia primeiro, como no Brasil; com AM/PM o texto veio de um Outlook em inglês dos EUA, que põe o mês primeiro
    [dia, mes, ano] = /\b(am|pm)\b/.test(s) && Number(m[1]) <= 12 ? [Number(m[2]), Number(m[1]), a] : [Number(m[1]), Number(m[2]), a];
  }
  const data = ano && mes && dia ? `${ano}-${dois(mes)}-${dois(dia)}` : "";
  if (!dataReal(data)) return { data: "", hora: "" };

  let hora = "";
  // a hora vem depois da data: procura no que sobra, para "2026" não virar "20:26"
  const resto = m ? s.slice(m.index + m[0].length) : s;
  const h = /\b(\d{1,2})[:h](\d{2})(?::\d{2})?\s*(am|pm)?\b/.exec(resto);
  if (h) {
    let hh = Number(h[1]);
    if (h[3] === "pm" && hh < 12) hh += 12;
    if (h[3] === "am" && hh === 12) hh = 0;
    const candidata = `${dois(hh)}:${h[2]}`;
    if (horaValida(candidata)) hora = candidata;
  }
  return { data, hora };
}

/**
 * As pessoas de um campo De, Para ou Cc. No Outlook os nomes vêm separados por ponto e vírgula e podem estar
 * como "Sobrenome, Nome"; sem ponto e vírgula, vale a leitura do importador de contatos (vírgulas, "Nome <email>").
 */
export function pessoasDoCampo(valor: string): PessoaDoEmail[] {
  const texto = valor.slice(0, 20_000);
  const itens = texto.includes(";") ? texto.split(";") : null;
  const lidas = itens
    ? itens.flatMap((item) => {
        const email = /<([^<>\s]+@[^<>\s]+)>/.exec(item)?.[1] ?? /[^\s<>()[\]"',;:]+@[^\s<>()[\]"',;:]+/.exec(item)?.[0] ?? "";
        let nome = espacos(item.replace(/<[^<>]*>/g, " ").replace(/\[[^\]]*\]|\([^)]*@[^)]*\)/g, " ").replace(/["']/g, " "));
        if (nome.includes("@")) nome = "";
        const partes = nome.split(",").map(espacos).filter(Boolean);
        nome = partes.length === 2 ? `${partes[1]} ${partes[0]}` : partes.join(" ");
        if (!nome && email) nome = nomeDoEmail(email);
        return nome ? [{ nome, email: email.toLowerCase() }] : [];
      })
    : interpretarColagem(texto).map((p) => ({ nome: p.nome, email: p.email }));
  const out: PessoaDoEmail[] = [];
  for (const p of lidas) {
    const nome = espacos(p.nome).slice(0, 120);
    if (!nome || out.some((x) => chaveNome(x.nome) === chaveNome(nome) || (!!p.email && x.email === p.email))) continue;
    out.push({ nome, email: p.email });
    if (out.length >= MAX_PESSOAS) break;
  }
  return out;
}

/** Lê o texto de um e-mail colado. Sem cabeçalho reconhecido, devolve tudo em `corpo`. */
export function lerEmail(bruto: unknown): EmailLido {
  const inteiro = (typeof bruto === "string" ? bruto : "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cortado = inteiro.length > MAX_EMAIL;
  const texto = inteiro.slice(0, MAX_EMAIL);
  const linhas = texto.split("\n");

  // pula linhas em branco e separadores no começo ("-----Mensagem original-----")
  let i = 0;
  while (i < linhas.length && SEPARADOR.test(linhas[i])) i++;

  const campos: Partial<Record<Campo, string>> = {};
  let atual: Campo | null = null;
  let achados = 0;
  for (; i < linhas.length && i < 200; i++) {
    const linha = linhas[i];
    const m = LINHA_DE_CAMPO.exec(linha);
    const campo = m ? ROTULOS[semAcento(espacos(m[1]))] : undefined;
    if (campo) {
      atual = campo;
      if (campo !== "outro" && campos[campo] === undefined) {
        campos[campo] = m![2];
        achados++;
      } else if (campo !== "outro") atual = "outro"; // repetido: o primeiro vale
      continue;
    }
    // continuação de um campo que quebrou a linha (lista longa de destinatários): começa com espaço
    if (atual && /^[ \t]+\S/.test(linha)) {
      if (atual !== "outro") campos[atual] = `${campos[atual] ?? ""} ${linha.trim()}`;
      continue;
    }
    break;
  }

  const reconheceu = achados >= 2 && (campos.de !== undefined || campos.assunto !== undefined);
  if (!reconheceu) return { reconheceu: false, assunto: "", de: null, para: [], cc: [], data: "", hora: "", corpo: texto.trim(), cortado };

  const { data, hora } = dataDoEmail(campos.data ?? "");
  return {
    reconheceu: true,
    assunto: assuntoLimpo(campos.assunto ?? ""),
    de: pessoasDoCampo(campos.de ?? "")[0] ?? null,
    para: pessoasDoCampo(campos.para ?? ""),
    cc: pessoasDoCampo(campos.cc ?? ""),
    data,
    hora,
    corpo: linhas.slice(i).join("\n").trim(),
    cortado,
  };
}

// ---------- do e-mail para o registro ----------

/**
 * Texto puro escrito como Markdown sem virar formatação: cada linha vira uma linha (a quebra simples já conta
 * como quebra no leitor do app), e o que o Markdown leria como marcação é escapado.
 */
export function textoComoMarkdown(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .split("\n")
    .map((linha) => {
      // recuo no começo viraria bloco de código; tab no meio vira espaço
      let l = linha.replace(/\t/g, " ").replace(/^ +/, "").replace(/ +$/, "");
      l = l.replace(/\\/g, "\\\\").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/([*_[\]~`|])/g, "\\$1");
      // começo de linha que abriria título, citação, lista, linha divisória ou lista numerada
      l = l.replace(/^([#>+\-=])/, "\\$1").replace(/^(\d{1,9})([.)])(\s|$)/, "$1\\$2$3");
      return l;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Quem estava no e-mail (De, Para e Cc), sem repetir. */
export function pessoasDoEmail(email: EmailLido): PessoaDoEmail[] {
  const out: PessoaDoEmail[] = [];
  for (const p of [...(email.de ? [email.de] : []), ...email.para, ...email.cc]) {
    if (out.some((x) => chaveNome(x.nome) === chaveNome(p.nome) || (!!p.email && x.email === p.email))) continue;
    out.push(p);
  }
  return out.slice(0, MAX_PESSOAS);
}

/**
 * Os nomes que entram como participantes: quem já está no cadastro (achado pelo e-mail ou pelo nome) entra com
 * o nome do cadastro; o próprio usuário fica de fora.
 */
export function participantesDoEmail(email: EmailLido, cadastro: Pessoa[] = []): string[] {
  const out: string[] = [];
  for (const p of pessoasDoEmail(email)) {
    const conhecida = (p.email && acharPessoa(cadastro, p.email)) || acharPessoa(cadastro, p.nome);
    const nome = nomeParaCadastro(conhecida ? conhecida.nome : p.nome);
    if (nome && !out.some((x) => chaveNome(x) === chaveNome(nome))) out.push(nome);
  }
  return out;
}

/** O bloco que vai para as anotações: de quem, quando, para quem, e o texto do e-mail. */
export function anotacoesDoEmail(email: EmailLido): string {
  const L: string[] = [];
  if (email.reconheceu) {
    L.push(`**E-mail${email.assunto ? `: ${textoComoMarkdown(email.assunto)}` : ""}**`);
    const quando = email.data ? `${formatarData(email.data)}${email.hora ? ` ${email.hora}` : ""}` : "";
    const de = email.de ? `De: ${textoComoMarkdown(email.de.nome)}` : "";
    if (de || quando) L.push([de, quando].filter(Boolean).join(" · "));
    const nomes = (ps: PessoaDoEmail[]) => textoComoMarkdown(ps.map((p) => p.nome).join(", "));
    const destino = [email.para.length ? `Para: ${nomes(email.para)}` : "", email.cc.length ? `Cc: ${nomes(email.cc)}` : ""].filter(Boolean).join(" · ");
    if (destino) L.push(destino);
    L.push("");
  }
  L.push(textoComoMarkdown(email.corpo));
  if (email.cortado) L.push("", "(O texto colado era maior do que o Nexo lê de uma vez e foi cortado aqui.)");
  return L.join("\n").trim();
}

/**
 * O registro com o e-mail dentro. Nada do que o usuário já escreveu é trocado: o título só é preenchido se
 * estava vazio, as anotações são acrescentadas no fim e os participantes se somam. Num registro novo e ainda
 * em branco, a data e a hora passam a ser as do e-mail e o tipo vira "nota" (um e-mail não é uma reunião).
 */
export function comEmailNoRegistro(r: Registro, email: EmailLido, opcoes: { novo?: boolean; cadastro?: Pessoa[] } = {}): Registro {
  const emBranco = !r.titulo.trim() && !r.anotacoes.trim() && !r.participantes.length;
  const bloco = anotacoesDoEmail(email);
  const participantes = [...r.participantes];
  for (const nome of participantesDoEmail(email, opcoes.cadastro)) {
    if (!participantes.some((x) => chaveNome(x) === chaveNome(nome))) participantes.push(nome);
  }
  const usarData = !!opcoes.novo && emBranco && !!email.data;
  return {
    ...r,
    tipo: opcoes.novo && emBranco && r.tipo === "reuniao" ? "nota" : r.tipo,
    titulo: r.titulo.trim() ? r.titulo : email.assunto,
    data: usarData ? email.data : r.data,
    hora: usarData ? email.hora : r.hora,
    participantes,
    anotacoes: r.anotacoes.trim() ? `${r.anotacoes.replace(/\s+$/, "")}\n\n${bloco}` : bloco,
  };
}
