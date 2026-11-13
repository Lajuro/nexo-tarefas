# Nexo · cérebro de tarefas

Organizador pessoal de tarefas, 100% local (offline-first). Cada tarefa tem uma linha do tempo com reuniões, atividades, impedimentos e decisões, e o app monta prompts prontos para colar no Copilot e lê a resposta de volta.

## Instalar ou atualizar (sem git clone)

No PowerShell:

```powershell
irm https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/instalar-nexo.ps1 | iex
```

Se o `irm | iex` for bloqueado, abra o link do script no navegador, salve como `instalar-nexo.ps1` e rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar-nexo.ps1
```

O script baixa o código (zip ou arquivo por arquivo), guarda a versão anterior em `nexo-app-anterior`, roda `npm install` e `npm run build` e cria o atalho **Nexo** na área de trabalho. Para atualizar, é só rodar o mesmo comando de novo.

Variáveis opcionais: `NEXO_DESTINO` (pasta do app, padrão `%USERPROFILE%\nexo-app`), `NEXO_REPO`, `NEXO_BRANCH`, `NEXO_DATA_DIR` (fixa a pasta de dados).

## Usar

Abra pelo atalho (ou `Iniciar Nexo.cmd`). O app roda em `http://127.0.0.1:3210` e só aceita conexões da própria máquina. Na primeira vez ele pede a pasta de dados: use uma pasta dentro do OneDrive para ter backup.

Atalhos: `N` nova tarefa · `/` buscar · `Esc` fechar janela.

### Fluxo com o Copilot

1. Em uma tarefa, clique em **+ Reunião** (ou Atividade) e escreva suas anotações brutas.
2. **Copiar prompt**: o app junta o contexto da tarefa (histórico, pendências) com suas anotações.
3. Cole no Copilot, copie a resposta e cole de volta no app.
4. **Preencher campos**: resumo, decisões, próximos passos (com responsável), impedimentos e participantes são separados sozinhos. Passos antigos que a resposta disser que foram resolvidos já vêm marcados para concluir.

Também tem prompts de **panorama da tarefa**, **preparar próxima reunião**, **panorama da categoria** e **relatório do período**.

## Onde ficam os dados

```
<pasta escolhida>/
  nexo.json               versão do formato dos dados
  categorias.json
  links.json
  tarefas/<id>.json       uma tarefa por arquivo, com a timeline inteira
  arquivos/AAAA/...       documentos anexados
  markdown/*.md           versão legível de cada tarefa (gerada automaticamente)
  _backups/AAAA-MM-DD/    foto diária (últimas 45) + manuais + pré-migração
  _lixeira/               nada é apagado de verdade
```

A configuração (qual pasta usar) fica em `%USERPROFILE%\.nexo\config.json`. O código do app fica em outra pasta. Atualizar o app nunca encosta nos dados.

## Proteções contra perda de dados

- Escrita atômica (arquivo temporário + troca), com nova tentativa se o OneDrive estiver segurando o arquivo.
- Arquivo corrompido nunca é tratado como vazio: o app avisa e não grava por cima.
- Controle de revisão: se a mesma tarefa for alterada em duas abas ou dois PCs, a segunda gravação é recusada em vez de sobrescrever.
- Campos que a versão atual não conhece são preservados ao salvar.
- Dados gravados por uma versão mais nova abrem em modo somente leitura numa versão antiga.
- Migrações de formato versionadas, sempre com backup completo antes.

## Desenvolvimento

```bash
npm install
npm run dev        # http://127.0.0.1:3210
npm run typecheck
```

Regras para evoluir o app sem perder dados estão em `CLAUDE.md`.
