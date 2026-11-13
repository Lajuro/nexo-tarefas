// Preferências que ficam só no navegador (localStorage). Nada aqui é dado de trabalho:
// se sumir, o app volta ao padrão.

export function lerPref<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(`nexo:${chave}`);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function gravarPref(chave: string, valor: unknown) {
  try {
    localStorage.setItem(`nexo:${chave}`, JSON.stringify(valor));
  } catch {}
}

// Nomes pelos quais o usuário aparece como responsável de um passo (além de "Eu").
export function lerMeusNomes(): string[] {
  const v = lerPref<unknown>("meusNomes", []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
}
