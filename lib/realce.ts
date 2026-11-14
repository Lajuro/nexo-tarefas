// Cores no código (leitura): um realce simples, feito aqui mesmo, sem biblioteca. Não é um interpretador da
// linguagem: reconhece comentário, texto entre aspas, número e palavra reservada, o bastante para um comando
// ou um trecho de configuração ficarem fáceis de ler. Devolve pedaços de texto com um tipo; a tela só pinta.
// O código nunca é executado nem vira HTML.

export type TipoDePedaco = "" | "comentario" | "texto" | "numero" | "palavra" | "chave" | "sinal";
export interface Pedaco { t: TipoDePedaco; v: string }

interface Regras {
  /** Começos de comentário de linha. */
  linha: string[];
  /** Comentário de bloco: [abre, fecha]. */
  bloco?: [string, string];
  aspas: string[];
  palavras: Set<string>;
  /** Maiúsculas e minúsculas não importam (SQL, PowerShell). */
  semCaixa?: boolean;
  /** "nome:" ou "nome=" no começo da linha é chave (YAML, INI, .env). */
  chaves?: RegExp;
}

const conjunto = (s: string) => new Set(s.split(" "));
const JS = conjunto("const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of null undefined true false this super yield interface type enum implements public private protected readonly static void");
const SHELL = conjunto("if then else elif fi for in do done while until case esac function return exit export local readonly set unset echo cd sudo source alias");
const REGRAS: Record<string, Regras> = {
  js: { linha: ["//"], bloco: ["/*", "*/"], aspas: ['"', "'", "`"], palavras: JS },
  json: { linha: [], aspas: ['"'], palavras: conjunto("true false null"), chaves: /^(\s*)("[^"\n]*")(\s*:)/ },
  shell: { linha: ["#"], aspas: ['"', "'"], palavras: SHELL },
  powershell: { linha: ["#"], bloco: ["<#", "#>"], aspas: ['"', "'"], palavras: conjunto("if else elseif foreach for while do switch function return param begin process end try catch finally throw in break continue exit $true $false $null"), semCaixa: true },
  python: { linha: ["#"], aspas: ['"""', "'''", '"', "'"], palavras: conjunto("def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda pass break continue yield async await global nonlocal assert del") },
  sql: { linha: ["--"], bloco: ["/*", "*/"], aspas: ["'", '"'], semCaixa: true, palavras: conjunto("select from where and or not in is null as join left right inner outer full on group by order having limit offset insert into values update set delete create alter drop table index view distinct union all case when then else end like between exists asc desc count sum avg min max with") },
  yaml: { linha: ["#"], aspas: ['"', "'"], palavras: conjunto("true false null yes no on off"), chaves: /^(\s*-?\s*)([A-Za-z0-9_."'/-]+)(\s*:)(?=\s|$)/ },
  ini: { linha: ["#", ";"], aspas: ['"', "'"], palavras: conjunto("true false"), chaves: /^(\s*)([A-Za-z0-9_.-]+)(\s*=)/ },
  xml: { linha: [], bloco: ["<!--", "-->"], aspas: ['"', "'"], palavras: new Set() },
  generico: { linha: ["#", "//"], aspas: ['"', "'"], palavras: new Set() },
};
const APELIDOS: Record<string, string> = {
  javascript: "js", jsx: "js", ts: "js", tsx: "js", typescript: "js", java: "js", c: "js", cpp: "js", csharp: "js", cs: "js", go: "js", rust: "js", kotlin: "js", php: "js",
  sh: "shell", bash: "shell", zsh: "shell", console: "shell", dockerfile: "shell", makefile: "shell",
  ps1: "powershell", ps: "powershell", pwsh: "powershell", py: "python", yml: "yaml", toml: "ini", env: "ini", conf: "ini", properties: "ini",
  html: "xml", svg: "xml", tsql: "sql", plsql: "sql", mysql: "sql", psql: "sql",
};

/** Nome a mostrar no canto do bloco. */
export const NOMES_DE_LINGUAGEM: Record<string, string> = {
  bash: "Bash", sh: "Shell", shell: "Shell", powershell: "PowerShell", ps1: "PowerShell", json: "JSON", yaml: "YAML", yml: "YAML", js: "JavaScript", javascript: "JavaScript",
  ts: "TypeScript", typescript: "TypeScript", python: "Python", py: "Python", sql: "SQL", xml: "XML", html: "HTML", ini: "INI", toml: "TOML", env: ".env", java: "Java",
  go: "Go", csharp: "C#", cs: "C#", dockerfile: "Dockerfile", diff: "Diff", http: "HTTP", text: "Texto", txt: "Texto",
};
/** As linguagens oferecidas no editor. Qualquer outra escrita à mão no Markdown continua valendo. */
export const LINGUAGENS = ["bash", "powershell", "json", "yaml", "python", "javascript", "typescript", "sql", "xml", "ini", "diff", "http"] as const;

const MAX = 40_000;
const NUMERO = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/;
const PALAVRA = /^[A-Za-z_$][A-Za-z0-9_$]*/;

function realcarLinha(linha: string, r: Regras, estado: { emBloco: boolean; emTexto: string }): Pedaco[] {
  const out: Pedaco[] = [];
  const por = (t: TipoDePedaco, v: string) => {
    if (!v) return;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.t === t) ultimo.v += v;
    else out.push({ t, v });
  };
  let i = 0;
  // "chave:" no começo da linha (YAML, INI, JSON)
  if (r.chaves && !estado.emBloco && !estado.emTexto) {
    const m = r.chaves.exec(linha);
    if (m) {
      por("", m[1]);
      por("chave", m[2]);
      por("sinal", m[3]);
      i = m[0].length;
    }
  }
  while (i < linha.length) {
    const resto = linha.slice(i);
    if (estado.emBloco) {
      const fim = resto.indexOf(r.bloco![1]);
      if (fim < 0) { por("comentario", resto); return out; }
      por("comentario", resto.slice(0, fim + r.bloco![1].length));
      i += fim + r.bloco![1].length;
      estado.emBloco = false;
      continue;
    }
    if (estado.emTexto) {
      // texto de várias linhas (aspas triplas, crase)
      const fim = resto.indexOf(estado.emTexto);
      if (fim < 0) { por("texto", resto); return out; }
      por("texto", resto.slice(0, fim + estado.emTexto.length));
      i += fim + estado.emTexto.length;
      estado.emTexto = "";
      continue;
    }
    if (r.bloco && resto.startsWith(r.bloco[0])) { estado.emBloco = true; por("comentario", r.bloco[0]); i += r.bloco[0].length; continue; }
    if (r.linha.some((c) => resto.startsWith(c) && (c !== "#" || i === 0 || /\s/.test(linha[i - 1])))) { por("comentario", resto); return out; }
    const aspa = r.aspas.find((a) => resto.startsWith(a));
    if (aspa) {
      let j = aspa.length;
      let fechou = false;
      while (j < resto.length) {
        if (resto[j] === "\\" && aspa.length === 1) { j += 2; continue; }
        if (resto.startsWith(aspa, j)) { j += aspa.length; fechou = true; break; }
        j++;
      }
      por("texto", resto.slice(0, j));
      i += j;
      // só aspas triplas e crase atravessam a linha
      if (!fechou && (aspa.length > 1 || aspa === "`")) estado.emTexto = aspa;
      continue;
    }
    const antes = i > 0 ? linha[i - 1] : " ";
    const num = /[A-Za-z0-9_$.]/.test(antes) ? null : NUMERO.exec(resto);
    if (num) { por("numero", num[0]); i += num[0].length; continue; }
    const pal = PALAVRA.exec(resto);
    if (pal) {
      const w = r.semCaixa ? pal[0].toLowerCase() : pal[0];
      por(r.palavras.has(w) && antes !== "-" ? "palavra" : "", pal[0]);
      i += pal[0].length;
      continue;
    }
    por("", linha[i]);
    i++;
  }
  return out;
}

/** O código em linhas de pedaços coloridos. Linguagem desconhecida: comentário, texto e número, sem palavras. */
export function realcar(codigo: string, linguagem: string): Pedaco[][] {
  const linhas = (codigo || "").split("\n");
  const lang = (linguagem || "").toLowerCase();
  if ((codigo || "").length > MAX || lang === "text" || lang === "txt") return linhas.map((v) => [{ t: "", v }]);
  if (lang === "diff") return linhas.map((v) => [{ t: v.startsWith("+") ? "texto" : v.startsWith("-") ? "sinal" : v.startsWith("@@") ? "palavra" : "", v } as Pedaco]);
  const r = REGRAS[APELIDOS[lang] ?? lang] ?? REGRAS.generico;
  const estado = { emBloco: false, emTexto: "" };
  return linhas.map((l) => realcarLinha(l, r, estado));
}
