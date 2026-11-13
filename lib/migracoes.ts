// Versão do FORMATO dos dados. Só muda quando a estrutura dos JSON mudar de um
// jeito que exija conversão. Adicionar campo opcional NÃO precisa migração:
// basta dar um valor padrão em lib/tipos.ts (normalizar*).
//
// Para criar uma migração:
//   1. suba SCHEMA_APP (ex.: 1 -> 2)
//   2. adicione { de: 1, executar: async (dir, ferramentas) => {...} }
// Antes de rodar, o app tira uma cópia completa em _backups/pre-migracao-*.

export const SCHEMA_APP = 1;

export interface FerramentasMigracao {
  lerJson: <T>(arquivo: string, padrao: T) => Promise<T>;
  escreverAtomico: (arquivo: string, conteudo: string) => Promise<void>;
}

export interface Migracao {
  de: number;
  executar: (dir: string, f: FerramentasMigracao) => Promise<void>;
}

export const MIGRACOES: Migracao[] = [];
