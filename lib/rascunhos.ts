import { Registro, STATUS, Status, agoraISO, normalizarRegistro } from "./tipos";

// Rascunhos do editor de registro (só no cliente).
// Tudo o que é digitado no editor e ainda não foi salvo fica guardado aqui a cada mudança,
// para sobreviver a F5, janela fechada, navegador travado ou PC reiniciado.
// É uma cópia de segurança, não o dado: o registro só passa a existir quando é salvo na
// pasta de dados. Mora no localStorage de propósito, porque gravar em disco a cada tecla
// faria o OneDrive sincronizar sem parar. Some quando o registro é salvo ou descartado.
// Uma chave por tarefa + registro ("novo" para registro ainda não criado).

export interface Rascunho {
  tarefaId: string;
  registroId: string | null; // null = registro novo
  r: Registro;
  colado: string;
  // Só entram se o usuário mexeu em "atualizar a tarefa junto". Assim um rascunho antigo
  // não desfaz uma mudança de status feita depois dele.
  status?: Status;
  prioridade?: number;
  prazo?: string;
  concluir: string[];
  baseAtualizadoEm: string | null; // atualizadoEm do registro quando o rascunho começou
  salvoEm: string;
}

const PREFIXO = "nexo:rascunho:";

const chave = (tarefaId: string, registroId: string | null) => `${PREFIXO}${tarefaId}:${registroId ?? "novo"}`;

function interpretar(bruto: string | null): Rascunho | null {
  if (!bruto) return null;
  try {
    const x = JSON.parse(bruto) as Partial<Rascunho>;
    if (!x || typeof x !== "object" || typeof x.tarefaId !== "string" || !x.r || typeof x.r !== "object") return null;
    return {
      tarefaId: x.tarefaId,
      registroId: typeof x.registroId === "string" ? x.registroId : null,
      r: normalizarRegistro(x.r),
      colado: typeof x.colado === "string" ? x.colado : "",
      status: STATUS.some((s) => s.id === x.status) ? x.status : undefined,
      prioridade: typeof x.prioridade === "number" ? x.prioridade : undefined,
      prazo: typeof x.prazo === "string" ? x.prazo : undefined,
      concluir: Array.isArray(x.concluir) ? x.concluir.filter((c) => typeof c === "string") : [],
      baseAtualizadoEm: typeof x.baseAtualizadoEm === "string" ? x.baseAtualizadoEm : null,
      salvoEm: typeof x.salvoEm === "string" ? x.salvoEm : agoraISO(),
    };
  } catch {
    return null;
  }
}

export function lerRascunho(tarefaId: string, registroId: string | null): Rascunho | null {
  try {
    return interpretar(localStorage.getItem(chave(tarefaId, registroId)));
  } catch {
    return null;
  }
}

// Devolve false se o navegador não deixou gravar (armazenamento cheio ou bloqueado).
// Quem chama precisa saber, para não prometer um rascunho que não existe.
export function gravarRascunho(x: Omit<Rascunho, "salvoEm">): boolean {
  try {
    localStorage.setItem(chave(x.tarefaId, x.registroId), JSON.stringify({ ...x, salvoEm: agoraISO() }));
    return true;
  } catch {
    return false;
  }
}

export function apagarRascunho(tarefaId: string, registroId: string | null) {
  try {
    localStorage.removeItem(chave(tarefaId, registroId));
  } catch {}
}

export function listarRascunhos(tarefaId: string): Rascunho[] {
  const out: Rascunho[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${PREFIXO}${tarefaId}:`)) continue;
      const x = interpretar(localStorage.getItem(k));
      if (x) out.push(x);
    }
  } catch {}
  return out.sort((a, b) => b.salvoEm.localeCompare(a.salvoEm));
}
