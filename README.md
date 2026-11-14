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

### Referência do assunto

Quando um registro explica como algo funciona (um processo, quem cuida do quê), marque-o como **referência** no botão do próprio card. Ele passa a aparecer no topo da página da categoria, para consultar em qualquer tarefa daquele assunto. No bloco de notas, o Copilot já sugere isso sozinho quando a folha é uma explicação.

### Busca e "só os meus"

A busca aceita várias palavras em qualquer ordem e abre a tarefa já no registro encontrado. Em **Configurações**, "Como você aparece nos passos" guarda o seu nome e apelidos: com isso, passos em que o Copilot escreveu o seu nome contam como seus, e os prompts passam a dizer ao Copilot quem é você.

### Registrou no lugar errado?

Cada registro da linha do tempo tem um botão **Mover para outra tarefa**. E no menu "..." da tarefa existe **Juntar em outra tarefa**, para quando uma tarefa na verdade faz parte de outra: os registros, tags e links vão para a tarefa escolhida e a antiga vai para a lixeira, de onde dá para restaurar.

### Bloco de notas

Em **Notas** você escreve solto, sem escolher tarefa nem campo, e pode misturar assuntos na mesma folha. A folha grava sozinha. Depois, **Organizar com o Copilot** copia um prompt com a folha e as suas tarefas abertas; você cola no Copilot, traz o JSON de volta e o Nexo mostra uma prévia do que vai criar: registro numa tarefa existente, tarefa nova ou passo antigo concluído. Nada é gravado antes de você conferir e aplicar, e a folha fica arquivada com o texto original e a lista do que criou.

Se a folha é sobre uma demanda que ainda não está no app, o Copilot propõe a tarefa nova e já coloca a reunião dentro dela. Na prévia você pode trocar a tarefa de destino, criar uma tarefa digitando o nome e acertar a data em que a coisa aconteceu. O que a IA não conseguir encaixar aparece como "não coube em nenhum item": dá para guardar como nota numa tarefa ou deixar anotado na folha. Cada registro criado tem um link para a folha original, e o seu texto inteiro fica guardado junto.

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

## Modo reunião (2.12)

Na página da tarefa, **Modo reunião** abre uma tela só para a conversa:

- **Antes**: a pauta se monta sozinha com as pendências da tarefa, as últimas decisões, onde a conversa parou e, ao informar os participantes, o que está com cada um em outras frentes. "Copiar" gera a pauta em texto para mandar antes.
- **Durante**: anote solto no editor e capture decisões (`Alt 1`) e próximos passos (`Alt 2`, com responsável e prazo) sem tirar a mão do teclado. Marque na pauta as pendências que forem resolvidas. "Começar" liga o relógio.
- **Depois**: "Encerrar e salvar" (`Ctrl Enter`) grava a reunião na linha do tempo e mostra a **ata** pronta para copiar, montada só com o que você escreveu.

Tudo o que é digitado fica guardado no navegador a cada mudança: F5, fechar a janela ou sair da tela não perdem nada, e a tarefa avisa que há uma reunião esperando para ser salva.

## Páginas de conhecimento (2.11)

- **Páginas** (`G` depois `A`): para o que não é tarefa nem reunião, mas vale guardar. Um processo, um passo a passo, quem resolve o quê. Usam o mesmo editor das notas e gravam sozinhas.
- **Citar com `@`**: em qualquer texto do editor, digite `@` e escolha uma tarefa, uma pessoa ou outra página. Vira um link que leva direto para lá.
- **Quem aponta para cá**: a tarefa, a página e a pessoa mostram onde foram citadas. É assim que as coisas se conectam sem você precisar organizar.
- A tela de cada categoria lista as páginas daquele assunto, e a busca também procura nelas.

## Conquistas (2.10)

O Nexo agora reconhece o que você faz nele:

- **Nível e XP**: concluir um passo, registrar o que aconteceu, fechar uma tarefa e fazer uma sessão de foco rendem XP. Registrar vale mais que marcar um passo, porque é o hábito mais difícil de manter.
- **Meta do dia**: um número de avanços por dia (3, para começar). O anel no pé da barra lateral e na tela Hoje mostra quanto falta.
- **Conquistas**: 25 marcos, do primeiro passo concluído a um mês de dias úteis seguidos. Em `G` depois `Q`, ou clicando no placar da barra lateral.
- **Comemoração**: ao bater a meta, subir de nível ou ganhar uma conquista, aparece um aviso e cai confete.

Nada disso é guardado à parte: o placar é calculado dos seus registros, então já começa contando tudo o que você fez antes. Em Configurações dá para mudar a meta, desligar o confete ou desligar tudo.

## Editor de texto (2.9)

As folhas do bloco de notas e as anotações de cada registro agora têm um editor completo, no estilo de blocos:

- **Digite `/`** para escolher o bloco: título, lista, lista numerada, lista de tarefas, citação, bloco de código, tabela, imagem ou divisor.
- **Atalhos de quem já usa Markdown**: `# ` vira título, `- ` vira lista, `[] ` vira tarefa, `> ` vira citação, três crases abrem um bloco de código. `Ctrl B` e `Ctrl I` para negrito e itálico.
- **Imagens**: cole um print com `Ctrl V`, arraste um arquivo ou use o botão da barra. A imagem é copiada para a pasta de dados (em `arquivos/`), junto com o resto.
- **Colar do Copilot**: a resposta colada entra já formatada (títulos, listas, negrito).
- O que você escreve é guardado como **Markdown**, que é texto simples: continua legível em qualquer lugar, inclusive no espelho da pasta `markdown/`.

Por segurança, o editor nunca carrega imagem de fora nem executa nada do que foi colado: imagem de página da internet e links estranhos viram só texto.

## Novidades da 2.8

- **Diário** (`G` depois `D`): tudo o que aconteceu em todas as tarefas, dia a dia, com um mapa de atividade. Clique num dia do mapa para ver só ele. "Copiar o que está na tela" gera um texto simples, bom para colar num e-mail de acompanhamento.
- **Esperando quem?**: quando uma tarefa vai para "Aguardando terceiros", o Nexo pergunta de quem você espera retorno e o quê. A partir daí ele conta os dias, mostra isso na tela Hoje e na página da pessoa, e ajuda a cobrar: **Copiar cobrança** deixa uma mensagem pronta para colar e **Cobrei hoje** anota a cobrança na linha do tempo.
- **Modelos de tarefa**: para demandas que se repetem. No menu de uma tarefa, "Salvar como modelo...". Em "Nova tarefa", escolha o modelo e ela já nasce com título, categoria, prazo e os passos de sempre (dá para desmarcar os que não valem). Os modelos ficam em Configurações.
- **Sessão de foco**: no menu da tarefa ou no balão "Foco" da barra superior, comece um cronômetro de 15, 25 ou 50 minutos. Quando terminar, escreva uma frase sobre o que saiu e ela vira uma atividade na linha do tempo, com a duração.

## Deixe do seu jeito

O botão de ajustes no rodapé da barra lateral (ou "Personalizar" na paleta, `Ctrl K`) abre um painel ao lado do app. Tudo muda na hora, enquanto você olha.

- **Aparência**: tema claro, escuro ou do sistema, **cor de destaque** (dez opções), cantos retos, suaves ou redondos, letra (Geist, a do Windows ou serifada), estilo da barra lateral (sólida, vidro ou colorida), fundo das telas (liso, aurora ou pontilhado) e quanto a interface se mexe (completo, sutil ou nenhum).
- **Barra lateral**: arraste os itens para mudar a ordem, desligue o que não usa, escolha quais seções aparecem (Foco de hoje, Fixadas, Recentes, Assuntos). A largura se ajusta arrastando a borda direita da barra. Clique no título de uma seção para recolher.
- **Barra superior**: escolha as ferramentas que ficam à mão.
  - **Agenda**: o dia e a hora. Ao clicar, os prazos, passos com data e lembretes das próximas duas semanas.
  - **Foco**: quantos passos do foco de hoje já saíram. Ao clicar, você marca passos sem sair da tela em que está.
  - **Anotar** (tecla `A`): cria uma tarefa ou uma folha do bloco de notas de qualquer tela. O que você digitar fica guardado ali até virar tarefa ou folha, mesmo se fechar o balão.
- **Fixar uma tarefa**: no menu da tarefa (botão direito ou "..."), "Fixar na barra lateral". Ela fica a um clique, em qualquer tela.

Essas escolhas ficam no navegador daquele computador. "Voltar tudo ao padrão" desfaz tudo de uma vez, sem tocar nas suas tarefas. Para aumentar ou diminuir tudo, use `Ctrl +` e `Ctrl -`.

## Pessoas e times

Cadastre as pessoas com quem você trabalha e os times de cada assunto. Assim o Nexo sabe quem pode ajudar com o quê, e cada nome que aparece nos registros fica ligado à pessoa certa.

- **Pessoas**: nome, apelidos (outros jeitos de escrever o nome que aparecem nos registros), e-mail, cargo, área e "pode ajudar com".
- **Times**: nome, cor, responsáveis e membros. Um time pode ser ligado a uma ou mais categorias.
- **Categorias**: a página de cada categoria mostra quem pode ajudar naquele assunto e os times ligados a ele.
- **Nomes sem cadastro**: quem aparece nos registros mas ainda não foi cadastrado fica numa lista própria. Dali você cadastra a pessoa ou junta o nome como apelido de alguém que já existe.
- **Importar do Outlook**: três jeitos, e nada sai do seu computador.
  - **Colar**: copie o campo Para ou Participantes de um e-mail ou de uma reunião e cole no app.
  - **CSV**: exporte os contatos em arquivo CSV. No Outlook clássico: Arquivo > Abrir e Exportar > Importar/Exportar > Exportar para um arquivo. No Outlook novo ou na web: Pessoas > Gerenciar contatos > Exportar contatos.
  - **vCard (.vcf)**: um arquivo com um ou mais contatos. No Outlook clássico, abra o contato e vá em Arquivo > Salvar como, escolhendo o formato vCard.

O app mostra uma prévia antes de gravar. Quem já existe no cadastro não é duplicado: só entram os campos que estavam vazios.

## Onde ficam os dados

```
<pasta escolhida>/
  nexo.json               versão do formato dos dados
  categorias.json
  links.json
  pessoas.json            pessoas cadastradas (opcional: sem o arquivo, a lista começa vazia)
  times.json              times (opcional, como as pessoas)
  tarefas/<id>.json       uma tarefa por arquivo, com a timeline inteira
  arquivos/AAAA/...       documentos anexados
  markdown/*.md           versão legível de cada tarefa (gerada automaticamente)
  _backups/AAAA-MM-DD/    foto diária (últimas 45) + manuais + pré-migração
  _lixeira/               nada é apagado de verdade
```

A configuração (qual pasta usar) fica em `%USERPROFILE%\.nexo\config.json`. O código do app fica em outra pasta. Atualizar o app nunca encosta nos dados.

## Proteções contra perda de dados

- Rascunho automático no editor de registro: pode fechar no meio da digitação (Esc, clique fora, F5, janela fechada, navegador travado) que o texto volta quando abrir de novo, e a página da tarefa avisa com **Continuar** e **Descartar**. O rascunho fica no navegador, então vale para aquele navegador e some se você limpar os dados do site.
- Os formulários de tarefa, link e resposta colada do Copilot perguntam antes de fechar se houver texto digitado.
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
