// A lógica de pessoas mora em lib/pessoas.ts (funções puras, testadas em testes/pessoas.test.mjs).
// Este arquivo só reexporta com os nomes antigos, para as telas que já usam continuarem iguais.

export {
  chavePessoa, montarPessoas, ordenarPessoas, plural,
} from "@/lib/pessoas";
export type {
  OrdemPessoas, PassoDaPessoa, RegistroDaPessoa, PessoaDosRegistros as Pessoa,
} from "@/lib/pessoas";
