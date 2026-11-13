// Importador de contatos do Outlook, sem API: o usuário cola o texto do campo Para/Participantes
// ou abre um arquivo exportado (CSV do Outlook desktop/web ou vCard). Funções puras: nada sai
// da máquina, nada é gravado aqui. A tela mostra o resultado e o usuário escolhe o que entra.

import type { Pessoa } from "./tipos";
import { acharPessoa, chaveNome } from "./pessoas";

export type PessoaImportada = { nome: string; email: string; cargo: string; area: string };
export type FormatoImportacao = "csv" | "vcf" | "colagem";

// ---------- utilidades ----------

const EMAIL = /[^\s<>()[\]"',;:]+@[^\s<>()[\]"',;:]+/;
const EMAIL_G = new RegExp(EMAIL.source, "g");
const ehEmail = (s: string) => new RegExp(`^${EMAIL.source}$`).test(s.trim());
const espacos = (s: string) => s.replace(/\s+/g, " ").trim();
const tirarBom = (s: string) => s.replace(/^﻿/, "");
const limparEmail = (s: string) => s.trim().replace(/^mailto:/i, "").replace(/[.]+$/, "").toLowerCase();

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "van", "von", "del", "la"]);

/** "maria.silva@x" vira "Maria Silva"; "joao_da-costa2@x" vira "Joao da Costa". */
export function nomeDoEmail(email: string): string {
  const local = email.split("@")[0].replace(/\+.*$/, "");
  const partes = local.split(/[._\-\s]+/).map((p) => p.replace(/\d+/g, "")).filter(Boolean);
  if (!partes.length) return local;
  return partes
    .map((p, i) => (i > 0 && PARTICULAS.has(p.toLowerCase()) ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

/** "Silva, Maria" vira "Maria Silva" (formato do catálogo do Outlook). Mais de uma vírgula: só tira as vírgulas. */
function desinverterNome(nome: string): string {
  const partes = nome.split(",").map(espacos).filter(Boolean);
  if (partes.length === 2) return `${partes[1]} ${partes[0]}`;
  return espacos(partes.join(" "));
}

function vazia(): PessoaImportada {
  return { nome: "", email: "", cargo: "", area: "" };
}

function juntarArea(...xs: string[]) {
  return [...new Set(xs.map(espacos).filter(Boolean))].join(" · ");
}

/** Completa nome a partir do e-mail e limpa espaços. Devolve null se não sobrou nada. */
function finalizar(p: PessoaImportada): PessoaImportada | null {
  const email = p.email && ehEmail(p.email) ? limparEmail(p.email) : "";
  let nome = espacos(p.nome.replace(/^["'\s]+|["'\s]+$/g, ""));
  if (nome && ehEmail(nome)) nome = "";
  if (!nome && email) nome = nomeDoEmail(email);
  if (!nome && !email) return null;
  return { nome, email, cargo: espacos(p.cargo), area: espacos(p.area) };
}

/**
 * Remove repetidos: mesmo e-mail (sem maiúsculas) ou, para quem não tem e-mail, mesmo nome
 * normalizado (também contra quem tem e-mail). Os campos vazios são completados pelo repetido.
 */
export function removerDuplicados(lista: PessoaImportada[]): PessoaImportada[] {
  const out: { p: PessoaImportada; pos: number }[] = [];
  const porEmail = new Map<string, PessoaImportada>();
  const porNome = new Map<string, PessoaImportada>();
  const completar = (alvo: PessoaImportada, de: PessoaImportada) => {
    for (const c of ["nome", "email", "cargo", "area"] as const) if (!alvo[c] && de[c]) alvo[c] = de[c];
  };
  // primeiro quem tem e-mail, para que os sem e-mail se juntem a eles
  const comPos = lista.map((p, pos) => ({ p, pos }));
  const ordenada = [...comPos.filter((x) => x.p.email), ...comPos.filter((x) => !x.p.email)];
  for (const { p, pos } of ordenada) {
    const e = p.email.toLowerCase();
    const k = chaveNome(p.nome);
    const existente = e ? porEmail.get(e) : porNome.get(k);
    if (existente) {
      completar(existente, p);
      continue;
    }
    const nova = { ...p };
    out.push({ p: nova, pos });
    if (e) porEmail.set(e, nova);
    if (k && !porNome.has(k)) porNome.set(k, nova);
  }
  // devolve na ordem em que apareceram
  return out.sort((a, b) => a.pos - b.pos).map((x) => x.p);
}

// ---------- colagem (campo Para/Participantes do Outlook, listas) ----------

/**
 * Quebra o texto em itens respeitando aspas, <...>, (...) e [...]. `;` e quebra de linha sempre
 * separam. A vírgula separa, exceto no formato "Sobrenome, Nome <email>": quando o item atual
 * ainda não tem e-mail e o trecho seguinte tem um <email>, a vírgula faz parte do nome.
 */
function quebrarItens(texto: string): string[] {
  const itens: string[] = [];
  let atual = "";
  let fecha = ""; // caractere que fecha o grupo aberto ("", '"', '>', ')', ']')
  const abre: Record<string, string> = { '"': '"', "<": ">", "(": ")", "[": "]" };
  const proximoTrecho = (i: number) => {
    let j = i + 1;
    let f = "";
    let s = "";
    for (; j < texto.length; j++) {
      const c = texto[j];
      if (f) {
        if (c === f) f = "";
      } else if (abre[c]) f = abre[c];
      else if (c === "," || c === ";" || c === "\n" || c === "\r") break;
      s += c;
    }
    return s;
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (fecha) {
      atual += c;
      if (c === fecha) fecha = "";
      continue;
    }
    if (abre[c]) {
      fecha = abre[c];
      atual += c;
      continue;
    }
    if (c === ";" || c === "\n" || c === "\r") {
      itens.push(atual);
      atual = "";
      continue;
    }
    if (c === ",") {
      const temEmail = EMAIL.test(atual);
      if (!temEmail && atual.trim() && /<[^<>]*@[^<>]*>/.test(proximoTrecho(i))) {
        atual += c; // "Sobrenome, Nome <email>"
        continue;
      }
      itens.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  itens.push(atual);
  return itens.map((s) => s.trim()).filter(Boolean);
}

function interpretarItem(item: string): PessoaImportada | null {
  const p = vazia();
  let resto = item.replace(/mailto:/gi, "");
  // e-mail entre <>
  const ang = resto.match(/<([^<>]*)>/);
  if (ang && EMAIL.test(ang[1])) {
    p.email = ang[1].match(EMAIL)![0];
    resto = resto.replace(ang[0], " ");
  }
  // sufixos (Empresa) e [Área]; se tiverem e-mail dentro, é o e-mail
  const areas: string[] = [];
  resto = resto.replace(/\(([^()]*)\)|\[([^[\]]*)\]/g, (_, a?: string, b?: string) => {
    const dentro = (a ?? b ?? "").trim();
    if (EMAIL.test(dentro)) {
      if (!p.email) p.email = dentro.match(EMAIL)![0];
    } else if (dentro) areas.push(dentro);
    return " ";
  });
  // e-mail solto no meio do texto
  if (!p.email) {
    const solto = resto.match(EMAIL);
    if (solto) p.email = solto[0];
  }
  resto = resto.replace(EMAIL_G, " ");
  const semAspas = espacos(resto.replace(/"/g, " ").replace(/(^|\s)'|'(\s|$)/g, " "));
  p.nome = semAspas.includes(",") ? desinverterNome(semAspas) : semAspas;
  p.area = juntarArea(...areas);
  return finalizar(p);
}

/**
 * Texto copiado do campo Para/Participantes do Outlook ou uma lista qualquer:
 * `Nome <email>; Outro <email>`, um por linha, separados por `;`, `,` ou quebra de linha,
 * e-mails soltos, `Sobrenome, Nome <email>`, nome entre aspas, sufixos `(Empresa)` e `[Área]`.
 */
export function interpretarColagem(texto: string): PessoaImportada[] {
  const out: PessoaImportada[] = [];
  for (const item of quebrarItens(tirarBom(texto || ""))) {
    // vários e-mails soltos no mesmo item ("a@x b@x"): um contato por e-mail
    const semGrupos = item.replace(/<[^<>]*>|\([^()]*\)|\[[^[\]]*\]|"[^"]*"/g, " ");
    const soltos = semGrupos.match(EMAIL_G) ?? [];
    if (soltos.length > 1 && !/<[^<>]*@/.test(item) && !espacos(semGrupos.replace(EMAIL_G, " "))) {
      for (const e of soltos) {
        const p = finalizar({ ...vazia(), email: e });
        if (p) out.push(p);
      }
      continue;
    }
    const p = interpretarItem(item);
    if (p) out.push(p);
  }
  return removerDuplicados(out);
}

// ---------- CSV (Outlook desktop e web) ----------

/** Lê CSV com aspas, "" escapado e quebras de linha dentro de aspas. */
export function lerCsv(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  const t = tirarBom(texto);
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"' && campo.trim() === "") {
      aspas = true;
      campo = "";
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

/** Separador mais frequente fora de aspas na primeira linha: `,`, `;` ou tab. */
function detectarSeparador(texto: string): string {
  const t = tirarBom(texto);
  const conta: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let aspas = false;
  for (const c of t) {
    if (c === '"') aspas = !aspas;
    else if (!aspas && (c === "\n" || c === "\r")) break;
    else if (!aspas && c in conta) conta[c]++;
  }
  const [sep, n] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? sep : ",";
}

const cab = (s: string) => chaveNome(s.replace(/["']/g, "")).replace(/\s+-\s+/g, " - ");

const CABECALHOS = {
  primeiro: ["first name", "given name", "nome", "primeiro nome"],
  meio: ["middle name", "nome do meio", "segundo nome"],
  ultimo: ["last name", "surname", "family name", "sobrenome"],
  exibicao: ["display name", "name", "full name", "nome para exibicao", "nome de exibicao", "nome completo"],
  email: [
    "e-mail address", "e-mail 1 - value", "email", "e-mail", "email address", "e-mail 1 - valor",
    "endereco de email", "endereco de e-mail", "endereco de email 1", "endereco de e-mail 1", "primary email",
  ],
  cargo: ["job title", "cargo", "titulo", "titulo do cargo"],
  departamento: ["department", "departamento"],
  empresa: ["company", "empresa", "organization", "organizacao"],
} as const;
type Coluna = keyof typeof CABECALHOS;

/** Índices das colunas reconhecidas. E-mail aceita outras variações ("E-mail 2 Address"...) como reserva. */
function mapearCabecalho(cabecalho: string[]) {
  const norm = cabecalho.map(cab);
  const idx = {} as Record<Coluna, number>;
  for (const k of Object.keys(CABECALHOS) as Coluna[]) {
    idx[k] = norm.findIndex((h) => (CABECALHOS[k] as readonly string[]).includes(h));
  }
  const emailsReserva = norm
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i !== idx.email && /e-?mail/.test(h) && !/(display|exibicao|type|tipo|nome)/.test(h))
    .map(({ i }) => i);
  return { idx, emailsReserva, reconhecidas: Object.values(idx).filter((i) => i >= 0).length };
}

/** CSV exportado do Outlook (desktop e web), cabeçalhos em inglês ou português. */
export function interpretarCsv(texto: string): PessoaImportada[] {
  const sep = detectarSeparador(texto);
  const linhas = lerCsv(texto, sep);
  if (linhas.length < 2) return [];
  const { idx, emailsReserva } = mapearCabecalho(linhas[0]);
  const out: PessoaImportada[] = [];
  for (const l of linhas.slice(1)) {
    const v = (k: Coluna) => (idx[k] >= 0 ? espacos(l[idx[k]] ?? "") : "");
    let email = v("email");
    if (!ehEmail(email)) {
      email = "";
      for (const i of emailsReserva) {
        const e = espacos(l[i] ?? "");
        if (ehEmail(e)) {
          email = e;
          break;
        }
      }
    }
    const nome = v("exibicao") || [v("primeiro"), v("meio"), v("ultimo")].filter(Boolean).join(" ");
    const p = finalizar({
      nome: nome.includes(",") ? desinverterNome(nome) : nome,
      email,
      cargo: v("cargo"),
      area: juntarArea(v("departamento"), v("empresa")),
    });
    if (p) out.push(p);
  }
  return removerDuplicados(out);
}

// ---------- vCard 2.1 / 3.0 / 4.0 ----------

function decodificarQP(valor: string, charset: string): string {
  const bytes: number[] = [];
  const v = valor.replace(/=\r?\n/g, "");
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(v.slice(i + 1, i + 3))) {
      bytes.push(parseInt(v.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      // caractere comum: grava como UTF-8
      for (const b of new TextEncoder().encode(v[i])) bytes.push(b);
    }
  }
  const u8 = new Uint8Array(bytes);
  try {
    return new TextDecoder(charset || "utf-8", { fatal: true }).decode(u8);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(u8);
    } catch {
      return new TextDecoder("utf-8").decode(u8);
    }
  }
}

/** Separa por `;` não escapado e desfaz os escapes do vCard. */
function partesVcf(valor: string, sep = ";"): string[] {
  const out: string[] = [];
  let atual = "";
  for (let i = 0; i < valor.length; i++) {
    const c = valor[i];
    if (c === "\\" && i + 1 < valor.length) {
      const n = valor[++i];
      atual += n === "n" || n === "N" ? "\n" : n;
    } else if (c === sep) {
      out.push(atual);
      atual = "";
    } else atual += c;
  }
  out.push(atual);
  return out;
}

/** vCard 2.1/3.0/4.0, com um ou vários contatos. Lê FN, N, EMAIL, TITLE, ORG. */
export function interpretarVcf(texto: string): PessoaImportada[] {
  // desdobra linhas: continuação começa com espaço/tab; no 2.1, QUOTED-PRINTABLE termina com "="
  const brutas = tirarBom(texto || "").split(/\r\n|\r|\n/);
  const linhas: string[] = [];
  for (const l of brutas) {
    const anterior = linhas[linhas.length - 1];
    if ((l.startsWith(" ") || l.startsWith("\t")) && linhas.length) linhas[linhas.length - 1] += l.slice(1);
    else if (anterior !== undefined && /QUOTED-PRINTABLE/i.test(anterior.split(":")[0]) && anterior.endsWith("=")) {
      linhas[linhas.length - 1] = anterior.slice(0, -1) + l;
    } else linhas.push(l);
  }

  const out: PessoaImportada[] = [];
  let atual: { fn: string; n: string; emails: { v: string; pref: boolean }[]; cargo: string; papel: string; org: string[] } | null = null;
  for (const linha of linhas) {
    const doisPontos = linha.indexOf(":");
    if (doisPontos < 0) continue;
    const cabeca = linha.slice(0, doisPontos);
    let valor = linha.slice(doisPontos + 1);
    const [nomeProp, ...params] = cabeca.split(";");
    const prop = nomeProp.replace(/^.*\./, "").toUpperCase(); // tira "item1."
    const paramsUp = params.map((p) => p.toUpperCase());
    if (prop === "BEGIN" && /VCARD/i.test(valor)) {
      atual = { fn: "", n: "", emails: [], cargo: "", papel: "", org: [] };
      continue;
    }
    if (prop === "END" && /VCARD/i.test(valor)) {
      if (atual) {
        const n = partesVcf(atual.n);
        // N = Sobrenome;Nome;Nomes do meio;Prefixo;Sufixo
        const nomeN = espacos([n[1], n[2], n[0]].filter(Boolean).join(" "));
        const email = (atual.emails.find((e) => e.pref) ?? atual.emails[0])?.v ?? "";
        const [empresa = "", ...deptos] = atual.org;
        const p = finalizar({
          nome: espacos(atual.fn) || nomeN,
          email,
          cargo: atual.cargo || atual.papel,
          area: juntarArea(deptos.join(" · "), empresa),
        });
        if (p) out.push(p);
      }
      atual = null;
      continue;
    }
    if (!atual) continue;
    const qp = paramsUp.some((p) => p === "QUOTED-PRINTABLE" || p === "ENCODING=QUOTED-PRINTABLE");
    if (qp) {
      const cs = params.find((p) => /^CHARSET=/i.test(p))?.split("=")[1] ?? "utf-8";
      valor = decodificarQP(valor, cs.replace(/"/g, ""));
    }
    if (prop === "FN") atual.fn = partesVcf(valor).join(";");
    else if (prop === "N") atual.n = valor;
    else if (prop === "EMAIL") {
      const v = valor.replace(/^mailto:/i, "").trim();
      const pref = paramsUp.some((p) => p === "PREF" || /^PREF=/.test(p) || /^TYPE=.*PREF/.test(p));
      if (v) atual.emails.push({ v, pref });
    } else if (prop === "TITLE") atual.cargo = partesVcf(valor).join(";");
    else if (prop === "ROLE") atual.papel = partesVcf(valor).join(";");
    else if (prop === "ORG") atual.org = partesVcf(valor).map(espacos).filter(Boolean);
  }
  return removerDuplicados(out);
}

// ---------- arquivo ----------

/**
 * Bytes do arquivo para texto. UTF-16 (com BOM) e UTF-8 estrito; se não for UTF-8 válido,
 * Windows-1252 (o Outlook de desktop exporta CSV em ANSI).
 */
export function decodificarArquivo(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8);
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(u8);
  try {
    return tirarBom(new TextDecoder("utf-8", { fatal: true }).decode(u8));
  } catch {
    return new TextDecoder("windows-1252").decode(u8);
  }
}

export function detectarFormato(nomeArquivo: string, texto: string): FormatoImportacao {
  const ext = (nomeArquivo || "").toLowerCase().split(".").pop() ?? "";
  if (ext === "vcf" || ext === "vcard") return "vcf";
  if (ext === "csv") return "csv";
  const t = tirarBom(texto || "").trimStart();
  if (/^BEGIN:VCARD/im.test(t)) return "vcf";
  const primeira = t.split(/\r?\n/)[0] ?? "";
  if (!EMAIL.test(primeira)) {
    const sep = detectarSeparador(primeira);
    const { reconhecidas } = mapearCabecalho(lerCsv(primeira, sep)[0] ?? []);
    if (reconhecidas >= 2 || (reconhecidas >= 1 && t.includes("\n") && primeira.includes(sep))) return "csv";
  }
  return "colagem";
}

/** Escolhe o formato (pela extensão ou pelo conteúdo) e interpreta. */
export function interpretarImportacao(
  nomeArquivo: string,
  texto: string,
): { formato: FormatoImportacao; pessoas: PessoaImportada[] } {
  const formato = detectarFormato(nomeArquivo, texto);
  const pessoas =
    formato === "vcf" ? interpretarVcf(texto) : formato === "csv" ? interpretarCsv(texto) : interpretarColagem(texto);
  return { formato, pessoas };
}

// ---------- comparação com o cadastro ----------

export type SituacaoImportada = "nova" | "jaExiste" | "completa";

export interface ComparacaoImportada {
  importada: PessoaImportada;
  situacao: SituacaoImportada;
  /** Pessoa cadastrada que bateu (mesmo e-mail ou mesmo nome/apelido). */
  pessoa?: Pessoa;
  /** Campos que a importação traz e estão vazios no cadastro (só em "completa"). */
  camposNovos: ("email" | "cargo" | "area")[];
}

/**
 * nova: ninguém no cadastro com o mesmo e-mail ou nome. jaExiste: já cadastrada e a importação
 * não traz nada novo. completa: já cadastrada e a importação preenche campo vazio do cadastro.
 */
export function compararComCadastro(importadas: PessoaImportada[], pessoas: Pessoa[]): ComparacaoImportada[] {
  return importadas.map((importada) => {
    const e = importada.email.toLowerCase();
    const pessoa =
      (e ? pessoas.find((p) => p.email.trim().toLowerCase() === e) : undefined) ?? acharPessoa(pessoas, importada.nome);
    if (!pessoa) return { importada, situacao: "nova", camposNovos: [] };
    const camposNovos = (["email", "cargo", "area"] as const).filter((c) => importada[c] && !String(pessoa[c] ?? "").trim());
    return { importada, situacao: camposNovos.length ? "completa" : "jaExiste", pessoa, camposNovos };
  });
}
