// "Falar com Fulano": assuntos para levar a uma pessoa na próxima conversa (assuntos.json).
// O nome fica como texto; quem é quem é decidido na leitura, pelo cadastro e pelos apelidos (lib/pessoas.ts),
// do mesmo jeito que os registros e os passos. Funções puras.

import { acharPessoa, chaveNome, chavesDaPessoa } from "./pessoas";
import { type AssuntoParaFalar, type Dados, type Pessoa, agoraISO, normalizarAssunto, novoId } from "./tipos";

/** As chaves de nome que valem para uma pessoa: o nome digitado e, se ela é cadastrada, o nome e os apelidos dela. */
function chavesDe(nome: string, pessoas: Pessoa[]): string[] {
  const p = acharPessoa(pessoas, nome);
  return [chaveNome(nome), ...(p ? chavesDaPessoa(p) : [])];
}

/** Os assuntos em aberto com uma pessoa (reconhece apelidos: "Marina" e "Marina Souza" são a mesma). */
export function assuntosCom(dados: Pick<Dados, "assuntos" | "pessoas">, nome: string, incluirResolvidos = false): AssuntoParaFalar[] {
  const pessoas = dados.pessoas?.items ?? [];
  const chaves = chavesDe(nome, pessoas);
  return (dados.assuntos?.items ?? [])
    .filter((a) => (incluirResolvidos || !a.resolvidoEm) && chavesDe(a.pessoa, pessoas).some((k) => chaves.includes(k)))
    .sort((a, b) => Number(!!a.resolvidoEm) - Number(!!b.resolvidoEm) || a.criadoEm.localeCompare(b.criadoEm));
}

/** Quantos assuntos em aberto há com cada pessoa (chave = nome normalizado). */
export function contagemPorPessoa(dados: Pick<Dados, "assuntos" | "pessoas">): Map<string, number> {
  const pessoas = dados.pessoas?.items ?? [];
  const m = new Map<string, number>();
  for (const a of dados.assuntos?.items ?? []) {
    if (a.resolvidoEm) continue;
    const p = acharPessoa(pessoas, a.pessoa);
    const k = chaveNome(p?.nome ?? a.pessoa);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function assuntoNovo(pessoa: string, texto: string, tarefaId?: string | null): AssuntoParaFalar {
  const agora = agoraISO();
  return normalizarAssunto({ id: novoId("as"), pessoa, texto, tarefaId: tarefaId ?? null, criadoEm: agora, atualizadoEm: agora });
}

/** Marca (ou reabre) um assunto. `registroId` diz em que reunião ele foi tratado. */
export function comAssuntoResolvido(items: AssuntoParaFalar[], ids: string[], resolvido: boolean, registroId?: string | null): AssuntoParaFalar[] {
  const alvo = new Set(ids);
  const agora = agoraISO();
  return items.map((a) =>
    alvo.has(a.id)
      ? { ...a, resolvidoEm: resolvido ? a.resolvidoEm ?? agora : null, registroId: resolvido ? registroId ?? a.registroId ?? null : null, atualizadoEm: agora }
      : a,
  );
}

/** Na pauta do modo reunião, um assunto marcado como tratado é guardado em `resolvidos` com este prefixo. */
export const CHAVE_ASSUNTO = "as:";
export const chaveDoAssunto = (id: string) => `${CHAVE_ASSUNTO}${id}`;
export const idsDeAssuntos = (resolvidos: string[]) => resolvidos.filter((k) => k.startsWith(CHAVE_ASSUNTO)).map((k) => k.slice(CHAVE_ASSUNTO.length));
