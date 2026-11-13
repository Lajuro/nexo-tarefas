# Nexo · instruções para quem for evoluir o código

App pessoal do Roh para organizar tarefas do trabalho. Next.js (App Router) + TypeScript, sem banco de dados: tudo em JSON numa pasta local (normalmente no OneDrive). Roda em máquina corporativa sem `git clone`: o código chega pelo script `scripts/instalar-nexo.ps1`, que baixa o repositório público do GitHub.

## Regra número 1: nunca perder dados

O usuário vai pedir melhorias com frequência. Toda mudança tem que abrir os dados antigos sem perder nada.

- **Campo novo**: sempre opcional nos tipos (`lib/tipos.ts`) e com valor padrão em `normalizar*()`. Não precisa migração.
- **Nunca renomear nem remover campo** direto. Se precisar mudar estrutura: suba `SCHEMA_APP` em `lib/migracoes.ts` e escreva uma migração (`{ de: N, executar }`). O app faz backup completo antes de migrar.
- **Mudar o significado de um valor** (ex.: escala de prioridade) também é migração.
- Os `normalizar*()` usam `...spread` para preservar campos desconhecidos. Não remova isso.
- `lerJson` nunca trata arquivo corrompido como vazio. Não troque por `catch { return padrao }`.
- Exclusão sempre vai para `_lixeira` (tarefas, itens de coleção) ou `registrosRemovidos` (registros dentro da tarefa).
- Escrita sempre por `escreverAtomico`. Gravações de tarefa sempre com `revEsperada` (controle de conflito).
- A pasta de dados nunca fica dentro da pasta do app.

## Estrutura

- `lib/tipos.ts`: tipos, normalização, helpers de data/texto (usado no servidor e na interface)
- `lib/armazenamento.ts`: tudo que lê/grava disco (config, backups, lixeira, migrações)
- `lib/migracoes.ts`: versão do formato e migrações
- `lib/prompts.ts`: prompts para o Copilot e o parser da resposta (`interpretarResposta`)
- `lib/markdown.ts`: espelho legível das tarefas
- `app/api/*`: rotas locais. `proxy.ts` bloqueia Host diferente de localhost e requisições de outra origem
- `components/Provider.tsx`: estado global, fila de gravação por recurso, toasts
- `app/*/page.tsx`: telas (painel, tarefa, pendências, categorias, pessoas, links, relatórios, busca, configurações)

## Restrições do ambiente

- Sem API de IA: a IA é sempre "copiar prompt → Copilot do navegador → colar resposta". Se mudar o formato pedido no prompt, atualize `interpretarResposta` junto.
- Servidor só em `127.0.0.1:3210`.
- Evitar dependências novas: cada pacote precisa passar pelo npm do proxy corporativo.
- Nada sensível no repositório (ele é público). Dados só na pasta do usuário.
