# Nexo · cérebro de tarefas

Organizador pessoal de tarefas, 100% local (offline-first), com cara de aplicativo de desktop: tema claro e escuro, tudo pelo teclado, e uma tela Hoje que lembra você do que fazer. Cada tarefa tem uma linha do tempo com reuniões, atividades, impedimentos e decisões, e o app monta prompts prontos para colar no Copilot e lê a resposta de volta.

## Instalar ou atualizar (sem git clone)

No PowerShell:

```powershell
irm https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/instalar-nexo.ps1 | iex
```

Se o `irm | iex` for bloqueado, abra o link do script no navegador, salve como `instalar-nexo.ps1` e rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar-nexo.ps1
```

No Git Bash (mesmo kit do Sonora, com 3 caminhos de download e conferência por hash):

```bash
curl -fsSLO https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/baixar-nexo.sh
bash baixar-nexo.sh nexo-app --instalar           # primeira vez
bash baixar-nexo.sh nexo-app --forcar --instalar  # atualizar
```

Sem rede nenhuma: abra `scripts/nexo-offline.sh` no GitHub, copie o conteúdo para um arquivo e rode com `bash` (o projeto inteiro vem embutido).

O script do PowerShell baixa o código (zip ou arquivo por arquivo), guarda a versão anterior em `nexo-app-anterior`, roda `npm install` e `npm run build` e cria o atalho **Nexo** na área de trabalho. Para atualizar, é só rodar o mesmo comando de novo.

Variáveis opcionais: `NEXO_DESTINO` (pasta do app, padrão `%USERPROFILE%\nexo-app`), `NEXO_REPO`, `NEXO_BRANCH`, `NEXO_DATA_DIR` (fixa a pasta de dados).

## Usar

Abra pelo atalho (ou `Iniciar Nexo.cmd`). O Nexo abre em janela própria, como um aplicativo (modo aplicativo do Edge). Para tela cheia, use F11 ou o botão na barra superior. O servidor roda em `http://127.0.0.1:3210` e só aceita conexões da própria máquina. Na primeira vez ele pede a pasta de dados: use uma pasta dentro do OneDrive para ter backup.

A página inicial é a tela **Hoje**: o que pede atenção agora, o foco do dia e uma captura rápida de tarefa.

Atalhos: `N` nova tarefa · `Ctrl K` ou `/` paleta de comandos · `D` planejar o dia · `G` depois `H`, `T` ou `P` (Hoje, Tarefas, Pendências) · `Ctrl B` barra lateral · `Ctrl Enter` salvar · `?` todos os atalhos.

### Fluxo com o Copilot

1. Na página da tarefa, clique em **Reunião** (ou **Atividade**) e escreva suas anotações brutas.
2. **Copiar prompt**: o app junta o contexto da tarefa (histórico, pendências) com suas anotações.
3. Cole no Copilot, copie a resposta e cole de volta no app.
4. **Preencher campos**: resumo, decisões, próximos passos (com responsável), impedimentos e participantes são separados sozinhos. Passos antigos que a resposta disser que foram resolvidos já vêm marcados para concluir.

Também tem prompts de **panorama da tarefa**, **preparar próxima reunião**, **panorama da categoria** e **relatório do período**.

## Rotina

O Nexo lembra você do que fazer:

- **Tela Hoje**: saudação, foco do dia, o que precisa de você, a semana e as tarefas paradas.
- **Planejar o dia**: abre sozinho na primeira visita do dia (dá para desligar) e pela tecla `D`. Mostra o que ficou para trás e você escolhe os focos.
- **Foco de hoje**: marca as tarefas em que você vai trabalhar no dia. No dia seguinte, elas deixam de ser foco sozinhas.
- **Lembrar de voltar em**: uma data para a tarefa voltar a aparecer. Dá para definir no formulário, na página da tarefa ou no menu da tarefa.
- **Sino de lembretes**: tudo o que merece atenção, com a opção de adiar qualquer item até uma data.
- **Revisão semanal**: a barra lateral avisa quando faz 7 dias da última. A tela Revisão passa por todas as tarefas abertas, das mais esquecidas para as mais recentes.
- Os lembretes são calculados dos próprios dados: prazo vencido ou chegando, passo com prazo vencido, aguardando retorno há 5 dias, parada há 7 dias e outros.

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
node testes/semear.mjs   # cenário de demonstração numa pasta de dados vazia e descartável
```

A interface usa Tailwind CSS v4, componentes no padrão Shadcn sobre Radix, motion para as animações e lucide para os ícones.

Contexto completo para agentes e regras para evoluir o app sem perder dados: `AGENTS.md`.
