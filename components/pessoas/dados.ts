// Monta a lista de pessoas a partir das tarefas: quem participou de registros e quem ficou
// responsável por algum próximo passo. Função pura (sem React), usada pela lista e pelo detalhe.

import { aberta, passoEhMeu } from "@/lib/lembretes";
import { Passo, Registro, Tarefa, semAcento } from "@/lib/tipos";

export interface RegistroDaPessoa { t: Tarefa; r: Registro }
export interface PassoDaPessoa { t: Tarefa; r: Registro; p: Passo }

export interface Pessoa {
  /** Nome sem acento e em minúsculas: é o que identifica a pessoa. */
  chave: string;
  nome: string;
  /** Registros em que participou. */
  regs: RegistroDaPessoa[];
  /** Tarefas em que aparece, da conversa mais recente para a mais antiga. */
  tarefas: Tarefa[];
  /** Data (AAAA-MM-DD) do registro mais recente com ela. null = só aparece como responsável por um passo. */
  ultima: string | null;
  /** Passos de tarefas abertas atribuídos a ela (feitos ou não). */
  passos: PassoDaPessoa[];
  /** Quantos desses passos ainda estão em aberto. */
  abertos: number;
}

export type OrdemPessoas = "contato" | "nome" | "pendencias";

export const chavePessoa = (nome: string) => semAcento(nome.trim());

const momento = (r: Registro) => `${r.data} ${r.hora || "99:99"} ${r.criadoEm}`;

export function montarPessoas(tarefas: Tarefa[]): Pessoa[] {
  const m = new Map<string, { nome: string; regs: RegistroDaPessoa[]; passos: PassoDaPessoa[] }>();
  const entrada = (nome: string) => {
    const k = chavePessoa(nome);
    if (!m.has(k)) m.set(k, { nome: nome.trim(), regs: [], passos: [] });
    return m.get(k)!;
  };

  for (const t of tarefas)
    for (const r of t.registros)
      for (const nome of r.participantes) if (nome.trim()) entrada(nome).regs.push({ t, r });

  // Passos com responsável: quem já é conhecido recebe todos; quem só aparece como responsável
  // entra na lista apenas se ainda estiver devendo alguma coisa.
  for (const t of tarefas) {
    if (!aberta(t)) continue;
    for (const r of t.registros)
      for (const p of r.proximosPassos) {
        if (passoEhMeu(p)) continue;
        const k = chavePessoa(p.responsavel || "");
        if (m.has(k) || !p.feito) entrada(p.responsavel || "").passos.push({ t, r, p });
      }
  }

  return [...m.entries()].map(([chave, e]) => {
    const regs = [...e.regs].sort((a, b) => (momento(a.r) < momento(b.r) ? 1 : momento(a.r) > momento(b.r) ? -1 : 0));
    const vistas = new Map<string, Tarefa>();
    for (const { t } of regs) if (!vistas.has(t.id)) vistas.set(t.id, t);
    for (const { t, p } of e.passos) if (!p.feito && !vistas.has(t.id)) vistas.set(t.id, t);
    return {
      chave,
      nome: e.nome,
      regs,
      tarefas: [...vistas.values()],
      ultima: regs[0]?.r.data ?? null,
      passos: [...e.passos].sort((a, b) => (momento(a.r) < momento(b.r) ? -1 : 1)),
      abertos: e.passos.filter((x) => !x.p.feito).length,
    };
  });
}

export function ordenarPessoas(pessoas: Pessoa[], ordem: OrdemPessoas): Pessoa[] {
  const porNome = (a: Pessoa, b: Pessoa) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  const porContato = (a: Pessoa, b: Pessoa) => (b.ultima ?? "").localeCompare(a.ultima ?? "") || porNome(a, b);
  const comparar =
    ordem === "nome" ? porNome : ordem === "pendencias" ? (a: Pessoa, b: Pessoa) => b.abertos - a.abertos || porContato(a, b) : porContato;
  return [...pessoas].sort(comparar);
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
