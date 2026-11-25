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

No Git Bash (três caminhos de download, com conferência por hash):

```bash
curl -fsSLO https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/baixar-nexo.sh
bash baixar-nexo.sh -i nexo-app     # primeira vez: baixa, instala e faz o build
bash baixar-nexo.sh -fi nexo-app    # atualizar sem perguntar
bash baixar-nexo.sh -h              # todas as opções
```

Sem rede nenhuma: baixe `scripts/nexo-offline.sh` pelo navegador (o projeto inteiro vem dentro dele) e rode `bash nexo-offline.sh -i nexo-app`.

Os dois scripts do Git Bash perguntam antes de usar uma pasta que já tem arquivos (`-f` pula a pergunta), guardam a versão atual em `<pasta>-anterior` ao atualizar, mantêm o `node_modules` e nunca tocam na pasta de dados. `-n` mostra o que mudaria sem gravar nada. As letras podem ir juntas (`-fi` é `-f -i`).

O script do PowerShell baixa o código (zip ou arquivo por arquivo), guarda a versão anterior em `nexo-app-anterior`, roda `npm install` e `npm run build` e cria o atalho **Nexo** na área de trabalho. Para atualizar, é só rodar o mesmo comando de novo.

Variáveis opcionais: `NEXO_DESTINO` (pasta do app, padrão `%USERPROFILE%\nexo-app`), `NEXO_REPO`, `NEXO_BRANCH`, `NEXO_DATA_DIR` (fixa a pasta de dados).

## Usar

Abra pelo atalho (ou `Iniciar Nexo.cmd`). O Nexo abre em janela própria, como um aplicativo (modo aplicativo do Edge). Para tela cheia, use F11 ou o botão "..." da barra superior. O servidor roda em `http://127.0.0.1:3210` e só aceita conexões da própria máquina. Na primeira vez ele pede a pasta de dados: use uma pasta dentro do OneDrive para ter backup.

A página inicial é a tela **Hoje**: o que pede atenção agora, o foco do dia e uma captura rápida de tarefa.

### Referência do assunto

Quando um registro explica como algo funciona (um processo, quem cuida do quê), marque-o como **referência** no menu "..." do próprio card. Ele passa a aparecer no topo da página da categoria, para consultar em qualquer tarefa daquele assunto. No bloco de notas, o Copilot já sugere isso sozinho quando a folha é uma explicação.

### Busca e "só os meus"

A busca aceita várias palavras em qualquer ordem e abre a tarefa já no registro encontrado. Em **Configurações**, "Como você aparece nos passos" guarda o seu nome e apelidos: com isso, passos em que o Copilot escreveu o seu nome contam como seus, e os prompts passam a dizer ao Copilot quem é você.

### Registrou no lugar errado?

Cada registro da linha do tempo tem um botão **Mover para outra tarefa**. E no menu "..." da tarefa existe **Juntar em outra tarefa**, para quando uma tarefa na verdade faz parte de outra: os registros, tags e links vão para a tarefa escolhida e a antiga vai para a lixeira, de onde dá para restaurar.

### Bloco de notas

Em **Notas** você escreve solto, sem escolher tarefa nem campo, e pode misturar assuntos na mesma folha. A folha grava sozinha. Depois, **Organizar com o Copilot** copia um prompt com a folha e as suas tarefas abertas; você cola no Copilot, traz o JSON de volta e o Nexo mostra uma prévia do que vai criar: registro numa tarefa existente, tarefa nova ou passo antigo concluído. Nada é gravado antes de você conferir e aplicar, e a folha fica arquivada com o texto original e a lista do que criou.

Se a folha é sobre uma demanda que ainda não está no app, o Copilot propõe a tarefa nova e já coloca a reunião dentro dela. Na prévia você pode trocar a tarefa de destino, criar uma tarefa digitando o nome e acertar a data em que a coisa aconteceu. O que a IA não conseguir encaixar aparece como "não coube em nenhum item": dá para guardar como nota numa tarefa ou deixar anotado na folha. Cada registro criado tem um link para a folha original, e o seu texto inteiro fica guardado junto.

Atalhos: `N` nova tarefa · `Ctrl K` ou `/` paleta de comandos · `D` planejar o dia · `Shift D` fechar o dia · `Ctrl Z` desfazer · `G` depois `H`, `T` ou `P` (Hoje, Tarefas, Pendências) · `Ctrl B` barra lateral · `Ctrl Enter` salvar · `?` todos os atalhos.

### Fluxo com o Copilot

1. Na página da tarefa, clique em **Reunião** (ou **Atividade**) e escreva suas anotações brutas.
2. **Copiar prompt**: o app junta o contexto da tarefa (histórico, pendências) com suas anotações.
3. Cole no Copilot, copie a resposta e cole de volta no app.
4. **Preencher campos**: resumo, decisões, próximos passos (com responsável), impedimentos e participantes são separados sozinhos. Passos antigos que a resposta disser que foram resolvidos já vêm marcados para concluir.

Também tem prompts de **panorama da tarefa** e **preparar próxima reunião** (no botão **Copilot** do cabeçalho da tarefa), **panorama da categoria** e **relatório do período**.

Na página da tarefa, categoria, status, prioridade, prazo, lembrete de voltar e tags mudam ali mesmo: tudo que tem a setinha ao lado abre um seletor. Cada registro da linha do tempo tem o botão "..." com editar, guardar como referência, mover e remover, e ele também é alcançado pelo Tab.

## Rotina

O Nexo lembra você do que fazer:

- **Tela Hoje**: abre com o que precisa de você (uma linha por tarefa, com os motivos dentro), depois o foco do dia, a semana e as tarefas paradas.
- **Planejar o dia**: abre sozinho na primeira visita do dia (dá para desligar) e pela tecla `D`. Mostra o que ficou para trás e você escolhe os focos.
- **Foco de hoje**: marca as tarefas em que você vai trabalhar no dia. No dia seguinte, elas deixam de ser foco sozinhas.
- **Lembrar de voltar em**: uma data para a tarefa voltar a aparecer. Dá para definir no formulário, na página da tarefa ou no menu da tarefa.
- **Sino de lembretes**: as tarefas que merecem atenção, com a opção de adiar até uma data. O número do sino é o mesmo da tela Hoje e do menu: conta tarefas, não avisos (uma tarefa atrasada, com passo vencido e sem retorno é uma coisa só).
- **Revisão semanal**: a barra lateral avisa quando faz 7 dias da última. A tela Revisão passa por todas as tarefas abertas, das mais esquecidas para as mais recentes.
- Os lembretes são calculados dos próprios dados: prazo vencido ou chegando, passo com prazo vencido, aguardando retorno há 5 dias, parada há 7 dias e outros.

## 3.24.2: páginas na ordem que você quer, e vídeo grande enviado inteiro

- **Arrastar na árvore de páginas**: no terço de cima de uma página, a que você arrasta vai antes dela; no meio, para dentro; no terço de baixo, depois. Uma linha azul e um texto embaixo do item mostram onde ela vai cair. Parar em cima de uma página fechada a abre.
- **Mover, no menu da página** (botão direito ou **...**): para cima, para baixo, para dentro da de cima, para fora da mãe, **para dentro de outra página...** (uma lista com busca, para levar longe sem arrastar) e levar para a raiz.
- **Ordem alfabética de uma vez**: "Ordenar as de dentro de A a Z" e "Ordenar as irmãs de A a Z". Números contam como números: "2. Instalar" vem antes de "10. Testar".
- **Pelo teclado**, com o foco numa página da árvore: `Alt ↑` e `Alt ↓` sobem e descem, `Alt Shift →` põe para dentro da de cima e `Alt Shift ←` tira de dentro. `Ctrl Z` desfaz qualquer movimento.
- **Vídeo enviado acima de 10 MB** ("Enviar o arquivo") era gravado só com o começo e não tocava. Agora chega inteiro. Se um vídeo que você enviou antes não toca, use **Escolher o arquivo de novo**, na própria mensagem do player: a transcrição, os capítulos e as anotações ficam. Anexar arquivo e importar um export acima de 10 MB também voltaram a funcionar.

## 3.24: acabamento

Uma passada por todas as telas, nos dois temas, medindo o que dá para medir. Nada muda nos dados nem no jeito de usar.

- **Barra superior inteira com um painel ao lado.** Com a Ajuda (`?`) ou o Personalizar aberto, o sino e o menu **...** ficavam cortados. Agora a barra se ajusta ao espaço que sobra: os rótulos viram ícones e nada sai da tela.
- **Leitura melhor no tema escuro**: o selo "Atividade", o dia de hoje na semana da Rotina, o selo "Foco" da paleta e o destaque do termo na Busca ganharam contraste.
- **Leitura melhor no tema claro**: o endereço de cada link e os textos "Sem descrição" e "Sem cargo nem área" estavam apagados demais.

## 3.23: decisões num lugar só, tempo em cada status e o resumo pronto

Três respostas que antes pediam abrir tarefa por tarefa. Nada muda no formato dos dados: tudo é calculado do que você já registrou.

- **Decisões.** Uma tela nova em **Acompanhar** (`G` depois `I`): o que foi decidido em todas as tarefas, por mês, com quando e com quem.
  - Aparecem sozinhas: vêm do campo **Decisões** de cada registro (uma por linha) e dos registros do tipo Decisão.
  - Busque por texto, filtre por categoria, por quem estava e por período.
  - O nome da tarefa leva ao registro em que a decisão foi tomada. **Copiar** gera um texto simples, bom para uma ata.
  - Na tarefa, o botão do martelo na linha do tempo mostra só os registros com decisão. Na categoria, o painel **Decisões da categoria**.
- **Tempo em cada status.** No resumo da tarefa (à direita, embaixo): "Em andamento há 8 dias" e uma barra com quanto ela ficou a fazer, em andamento, aguardando terceiros e bloqueada.
  - A conta sai das mudanças de status que o Nexo já registra na linha do tempo. Quando falta parte desse histórico, o app avisa que é uma estimativa.
  - No **Radar**, cada categoria mostra a espera média por tarefa (aguardando e bloqueada). Só aparece com três tarefas de histórico completo.
- **Copiar resumo**, em **Relatórios**: o período em texto simples, sem passar pelo Copilot. Concluído, o que andou, o que está travado, decisões e os seus próximos passos. Pronto para um e-mail de status.
- **Preparar o 1:1**, em **Relatórios**: o mesmo material arrumado para a conversa com o gestor (o que andou, o que travou, o que precisa de decisão ou de ajuda, o que vem agora). Abre uma prévia antes de copiar.
- Os dois textos só repetem o que está nos seus registros: nada é inventado nem resumido por conta própria. Para um relatório redigido, o prompt do Copilot continua lá.

## 3.22: o Nexo se ensina

Para quem está chegando e para quem esqueceu onde fica alguma coisa. Nada muda no formato dos dados.

- **Ajuda desta tela.** Aperte **?** em qualquer tela (ou use o menu Mais). Um painel ao lado explica para que a tela serve, como usar em poucos passos e quais são os atalhos. Ele não trava o app: você lê e usa ao mesmo tempo, e a mesma tecla fecha.
- **Mostrar na tela.** Os botões da ajuda acendem o lugar de cada coisa, com uma explicação curta. Se o lugar não aparece (o perfil em uso pode ter escondido), o Nexo diz isso em vez de apontar para o nada.
- **Boas-vindas.** Depois de escolher a pasta de dados, o Nexo faz três perguntas: como você trabalha (o perfil de uso), como você aparece (o nome da saudação e os nomes pelos quais é citado nos passos) e por onde quer começar.
- **Primeiros passos.** Seis coisas na tela Hoje, cada uma com **Mostrar onde**: criar uma tarefa, registrar uma conversa, concluir um passo, escolher o foco, planejar o dia e criar uma categoria. A lista é calculada dos seus dados: ninguém precisa marcar nada. Some quando tudo foi feito, e dá para esconder.
- **Conhecer com um exemplo.** Em **Configurações > Pasta de dados** (e nas boas-vindas), abre oito tarefas de mentira, com reuniões, prazos e rotina, para ver o app cheio.
  - O exemplo fica numa **pasta separada**. Seus dados não são lidos, escritos nem movidos.
  - Uma faixa no topo avisa que é o exemplo. **Usar meus dados** volta com um clique.
  - O que você criar dentro do exemplo fica só no exemplo.
  - Se a pasta de dados está fixada pela variável `NEXO_DATA_DIR`, o exemplo não fica disponível.

## 3.21: próxima ação e reuniões do dia

A tela Hoje passou a responder, logo no topo, à pergunta "o que eu faço agora?". Nada muda no formato dos dados.

- **Próxima ação.** Um bloco no topo da tela Hoje com **uma** coisa a fazer, o motivo em uma linha e um botão: abrir a tarefa, concluir o passo, entrar no modo reunião, planejar o dia ou fechar o dia. Logo abaixo, as três seguintes.
- **A ordem é sempre a mesma**, a primeira que valer: a reunião que está acontecendo; a reunião que começa em até 15 minutos; o bloco de agora na sua rotina; o que está com prazo estourado (as tarefas em foco primeiro); o próximo passo seu no foco de hoje; sem foco, planejar o dia ou a melhor sugestão; o que pede atenção, com cobrar retorno primeiro; e, com as horas cumpridas, fechar o dia.
- **Agora não** dispensa aquela sugestão por hoje, sem mexer em nada. O Nexo **nunca age sozinho**: toda mudança é um clique seu e tem Desfazer.
- **Reunião na rotina.** Ao criar ou editar um bloco da rotina, ligue **É uma reunião** e informe os participantes e a tarefa a que ela serve. No **dia padrão**, é a reunião que se repete toda semana.
- **Reuniões de hoje.** Em dia que tem reunião, a coluna da direita da tela Hoje mostra cada uma com o horário, quem participa, a **Pauta** (as pendências da tarefa, as últimas decisões e o que está com cada participante, com Copiar) e **Começar**, que abre o modo reunião já com o título e os participantes.
- **Aviso 15 minutos antes** de cada reunião, junto com os outros avisos da rotina.
- A tarefa que tem reunião marcada nos próximos sete dias deixa de aparecer como "parada" ou "sem próximo passo". Prazo vencido e retorno pendente continuam avisando.
- O balão do **Foco**, na barra superior, mostra a mesma próxima ação.

## 3.20: perfis de uso

O mesmo app, arrumado para o dia que você tem. Um **perfil** guarda o que aparece no menu, nas barras e na tela Hoje, e em que tela o app abre. Suas tarefas são as mesmas em todos, e nada muda no formato dos dados.

- **Cinco perfis prontos.** **Completo** (tudo à vista), **Foco** (dia de execução: o foco na frente, a barra lateral recolhida e o resto fora do caminho), **Reuniões** (rotina, pendências por pessoa e bloco de notas à mão), **Gestão** (abre no Radar, com Relatórios e o quadro de tarefas) e **Estudo** (abre em Páginas, com Perguntar, Links e Categorias na frente).
- **Trocar.** O botão com o nome do perfil na barra superior, a tecla **P** (no menu, **1 a 9** escolhe) ou a paleta (Ctrl K e "perfil foco").
- **Cada perfil lembra como você o deixou.** Mexeu no Foco, trocou para Reuniões e voltou: o Foco está como ficou. **Redefinir este perfil** volta ao original, com Desfazer.
- **Seus perfis.** Arrume o app do seu jeito e use **Salvar o arranjo de agora como perfil**. Dá para renomear, duplicar e excluir. Se você já tinha personalizado as barras ou a tela Hoje, nada mudou: o seu arranjo virou o perfil **Meu arranjo**, já em uso.
- **Personalizar > Perfis.** Uma miniatura de cada perfil, a tela em que ele abre e **Copiar código deste perfil**, para mandar a um colega. Quem recebe usa **Colar código de perfil**: o perfil entra na lista, sem trocar nada do que está em uso.
- **Duas voltas separadas.** No painel Personalizar, **Redefinir este perfil** mexe no menu, nas barras e na tela Hoje; **Voltar a aparência ao padrão** mexe nas cores, nos cantos e na letra. O seu nome na saudação não é apagado por nenhuma das duas.
- O perfil não muda o tema nem as cores (isso continua nos temas prontos), e a tela inicial do perfil só vale ao abrir o app: clicar em Hoje continua levando para Hoje.

## 3.19: passos sem repetição e cobrança por pessoa

O mesmo passo não aparece mais duas vezes na mesma tarefa. Nada muda no formato dos dados.

- **Aviso de passos repetidos.** Quando a mesma tarefa tem o mesmo passo anotado mais de uma vez (por exemplo, vindo de uma folha organizada pelo Copilot e da reunião do mesmo dia), aparece "N passos repetidos" no painel **Pendências** da tarefa e na tela de **Pendências**. **Ver e juntar** mostra os pares antes de mexer em qualquer coisa.
- **Juntar não apaga nada.** Fica o passo do registro mais antigo, com o responsável e o prazo mais cedo dos dois. A cópia fica guardada no registro de onde veio: na linha do tempo, "passos juntados com outros iguais" mostra cada uma, com o botão **Separar**. Juntar e separar têm **Desfazer**.
- **Parecem o mesmo passo.** Quando um texto está contido em outro ("Enviar o relatório" e "Enviar o relatório ao Bruno"), o app pergunta em vez de juntar: **Juntar** ou **São diferentes**. A resposta fica lembrada.
- **Daqui para a frente o repetido nem nasce.** Ao preencher um registro com a resposta do Copilot, ao organizar uma folha do bloco de notas e ao encerrar o modo reunião, o passo que já está em aberto na tarefa não é criado de novo. A tela diz quantos ficaram de fora e deixa **criar mesmo assim**.
- **Cobrança por pessoa.** Em **Pendências**, agrupado **por pessoa**, cada grupo tem **Copiar mensagem**: a lista do que está com aquela pessoa, em todas as tarefas, pronta para colar na conversa. **Copiar todas** junta uma mensagem por pessoa. Quem está no cadastro de pessoas é reconhecido também pelos apelidos, então "Marina" e "Marina Souza" viram um grupo só.

## 3.18: a tarefa nasce pronta

Duas melhorias para o começo de uma tarefa, sem mudar o formato dos dados.

- **Modelo com checklist.** O modelo de tarefa agora guarda também um checklist. Em **Configurações > Modelos de tarefa**, ao criar ou editar um modelo, o campo **Checklist de sempre** recebe um item por linha. "Salvar como modelo", no menu de uma tarefa, já leva o checklist dela. Em **Nova tarefa**, ao escolher o modelo, o checklist aparece para você desmarcar o que não vale desta vez, como já era com os passos; a tarefa nasce com os itens marcados, todos em aberto.
- **Tarefa a partir de um e-mail.** Em **Nova tarefa**, ao lado do título, **A partir de um e-mail** abre a janela de colar o e-mail (com o cabeçalho do Outlook: De, Enviada em, Para, Assunto). O assunto vira o título, se ele estiver vazio. Ao salvar, o e-mail vira o primeiro registro da tarefa: uma nota com a data e a hora em que foi enviado, as pessoas como participantes e o texto nas anotações. A linha do tempo passa a começar por onde a demanda chegou. Antes de salvar, o "x" ao lado do e-mail desiste dele.

## 3.17: checklist na tarefa, e-mail colado, filtro por tag e importação

Cinco coisas que estavam na lista de pedidos, todas sem mudar o formato dos dados (nenhuma migração).

- **Checklist da tarefa.** Na página da tarefa, abaixo de Pendências, o painel **Checklist** é a lista do que a tarefa precisa para ficar pronta. Digite e aperte Enter. Colar uma lista de várias linhas cria um item por linha (a marca de lista, como `- ` ou `1.`, sai sozinha, e `[x]` entra como feito). Clique no texto para editar; o "..." de cada item move para cima, para baixo ou tira (com Desfazer). O cartão da tarefa mostra o progresso (`1/3`).
  - O checklist não é a mesma coisa que os **passos**. O passo nasce de um registro (o que ficou combinado numa conversa), tem responsável e prazo e aparece em Pendências. O item do checklist é da tarefa em si e só diz feito ou não: ele não gera lembrete nem entra em Pendências.
  - Ele aparece no espelho em Markdown, na impressão, na busca e nos prompts do Copilot. Ao juntar duas tarefas, o checklist da antiga vai junto.
- **Colar e-mail num registro.** No editor de registro, ao lado de "Anotações brutas", o botão **Colar e-mail** abre uma janela para colar o texto do e-mail. Copie no Outlook com o cabeçalho (De, Enviada em, Para, Cc, Assunto), como aparece ao responder ou encaminhar. A janela mostra o que reconheceu antes de trazer:
  - o **assunto** vira o título (sem "RES:" e "ENC:"), se o título estava vazio;
  - a **data e a hora** viram as do registro, num registro novo e em branco;
  - quem está em **De, Para e Cc** vira participante. Quem já está no cadastro entra com o nome do cadastro, e você fica de fora (pelos nomes informados em Configurações);
  - o **texto** vai para o fim das anotações, sem trocar o que você já escreveu. Ele entra como texto puro: um `#` ou um `<script>` do e-mail aparece como está escrito, não vira formatação.
  - Sem o cabeçalho, o texto entra inteiro nas anotações e você preenche o resto.
- **Cadastrar a pessoa direto do campo de participantes.** Embaixo do campo, a linha **Sem cadastro** mostra os nomes que ainda não estão no cadastro de pessoas. Um clique cadastra só com o nome, sem sair do registro, e o aviso tem "Completar cadastro" para pôr cargo, e-mail e times. Vale no editor de registro e no modo reunião. O participante continua sendo um nome escrito: nada muda nos registros antigos.
- **Filtro por tag.** O botão **Tags** nas listas de **Tarefas** e de **Páginas** (visão Lista) abre as tags que existem ali, com a contagem. Marque uma ou mais: a lista mostra só o que tem todas. Em Tarefas o filtro fica no endereço (`/tarefas?tag=pipeline`), aparece como etiqueta removível e entra nas **visões salvas**. Na aba **Tags** de Categorias, **Ver na lista** abre a lista de tarefas ou de páginas já filtrada, e as tags da página e da pessoa viraram links para essa aba.
- **Importar um arquivo exportado.** Em **Configurações > Proteção dos dados**, **Importar um export...** recebe um `nexo-export-*.json` (o arquivo de "Exportar tudo") e mostra, antes de gravar, o que entra e o que está diferente.
  - **Importar soma.** O que está no arquivo e não está aqui, entra. Nada do que está aqui é apagado e nada vai para a lixeira.
  - Quando o mesmo item está nos dois lados com conteúdo diferente, você escolhe uma vez para a importação inteira: **Manter o daqui** (o padrão), **O mais recente** (fica o lado mexido por último) ou **O do arquivo**.
  - **Tem volta.** Antes de gravar, o app guarda uma foto do estado de agora em `_backups/pre-importacao-*`, que aparece na lista de backups e pode ser restaurada.
  - Os **anexos** (pasta `arquivos`) não fazem parte do arquivo exportado. Se o export veio de outro computador, copie também a pasta `arquivos`; a janela avisa quantos anexos estão faltando.
  - Isso é diferente de **Restaurar** um backup: restaurar faz os dados voltarem a ser o que eram, e o que foi criado depois vai para a lixeira.

## 3.16: criar sem sair de onde está, e um lugar para as tags

Antes, para usar uma categoria que ainda não existia você tinha que largar o que estava fazendo, ir à tela de Categorias, criar e voltar. E as tags não tinham tela nenhuma: se a mesma ideia fosse escrita de dois jeitos, o jeito era abrir item por item.

- **Categoria criada na hora.** Em qualquer lugar onde se escolhe uma categoria, digite o nome da que falta e clique em **Criar**: na tarefa (a categoria ao lado do status), no formulário de link, na página, no modelo de tarefa, no cadastro de pessoa e de time, no importador do Outlook e nas ações em lote. Ela nasce com a próxima cor da paleta; o aviso tem "Cor e descrição" para ajustar depois, sem sair da tela.
- **Tarefa criada na hora.** O mesmo nos seletores de tarefa: mover um registro para uma tarefa que ainda não existe, "Depende de", as tarefas a que um link, uma página ou uma folha serve, "falar com alguém" e o bloco da rotina. A tarefa nasce só com o título (e a categoria de onde você está, quando faz sentido); o resto você preenche depois.
- **Criar qualquer coisa de qualquer tela.** A setinha ao lado de **Nova tarefa**, na barra lateral, abre o menu **Criar**: categoria, página, folha no bloco de notas, link ou arquivo, pessoa, time e modelo de tarefa. O formulário abre por cima da tela em que você está e, ao salvar, você continua nela. Na paleta (`Ctrl K`) é só digitar "nova categoria", "novo link", "nova pessoa".
- **Tags têm lugar.** Em **Categorias**, a aba **Tags** mostra todas as tags do app, da mais usada para a menos, com o que usa cada uma (tarefas, links, páginas, pessoas e modelos). Abra uma para ver os itens e:
  - **Renomear**: muda em todos os itens de uma vez;
  - **Juntar em outra tag**: tudo o que usa uma passa a usar a outra;
  - **Tirar de tudo**: os itens ficam, só perdem a tag.
  Toda troca tem **Desfazer** (no aviso ou com `Ctrl Z`).
- **Tags parecidas.** Quando duas tags parecem a mesma (acento, plural ou hífen diferentes, como "pipeline" e "pipelines"), elas aparecem no topo da aba com **Juntar** a um clique, ou "São diferentes" para o app não perguntar de novo.
- **Um vocabulário só.** Todo campo de tag sugere as tags do app inteiro. Antes a página só sugeria tags de páginas, o link só as de links, e por isso a mesma tag acabava escrita de dois jeitos.
- **Na lista de tarefas**: a barra de seleção ganhou **Tags** (põe ou tira uma tag de várias tarefas de uma vez) e a **Categoria** dela também cria a que falta. O botão direito de uma tarefa ganhou **Categoria**.

Nada mudou no formato dos dados: tag continua sendo um texto dentro de cada item, e renomear é regravar os itens que a usam.

## 3.15: ver os arquivos por dentro do app

Clicar num arquivo anexado (no texto de um registro ou de uma página, em "Links e documentos" da tarefa, na tela de Links, na busca) abre o conteúdo **por cima da tela**, sem baixar e sem sair de onde você está. `Esc`, o X ou um clique fora fecham, e você volta para o mesmo lugar.

| Arquivo | O que você vê |
|---|---|
| **PDF** | O leitor do próprio navegador, embutido: zoom, busca e impressão são os dele. |
| **Planilha do Excel** (`.xlsx`, `.xlsm`) | A grade com as abas embaixo, como no Excel. Filtre as linhas, clique numa célula para ver o conteúdo inteiro e use **Copiar** para colar no Excel ou num e-mail. Datas, percentuais e números saem como se lê em português (18/11/2026, 12,5%, 1,5). |
| **CSV e TSV** | A mesma grade. O separador (ponto e vírgula, vírgula ou tabulação) e os acentos são reconhecidos sozinhos, inclusive nos arquivos que o Excel em português grava. |
| **Word** (`.docx`) | O texto: títulos, parágrafos, listas e tabelas. |
| **PowerPoint** (`.pptx`) | O título e o texto de cada slide, na ordem da apresentação. |
| **Markdown** | Formatado, ou o texto cru. |
| **Texto, log e código** (`.txt`, `.log`, `.json`, `.yaml`, `.xml`, `.sql`, `.ps1`, `.sh`, `.py` e outros) | Com número de linha e cores. |
| **ZIP** | A lista do que tem dentro. |
| **Áudio e vídeo** | O player do app. |
| **Imagem** | O visor de imagem, como já era. |

O que vale saber:

- **Word e PowerPoint mostram só o texto.** A formatação, as imagens e os comentários ficam para quando você baixar e abrir no Office. Serve para ler e copiar rápido, não para ver o documento como ele é.
- **Planilha mostra os valores**, não as fórmulas, as cores nem os gráficos. De uma fórmula aparece o resultado.
- **Formatos antigos** (`.xls`, `.doc`, `.ppt`) não abrem por dentro: continuam baixando, e um aviso lembra de salvar como `.xlsx`, `.docx` ou `.pptx`.
- **HTML e SVG anexados aparecem como código-fonte**, nunca como página: nada de um arquivo anexado roda dentro do Nexo.
- Arquivo com mais de 40 MB não é aberto por dentro (PDF, áudio e vídeo não têm esse limite). Com `Ctrl` + clique, o arquivo abre do jeito antigo.
- Nenhum programa novo foi instalado para isso: a leitura é feita pelo próprio Nexo.

## 3.14: links que servem a várias tarefas, com status, e editor mais completo

**Links e documentos** deixaram de ser só uma lista de endereços e viraram material de trabalho:

- **Um link, várias tarefas.** O mesmo link, arquivo ou chamado pode servir a quantas tarefas precisar. Na tarefa, **Adicionar** (em "Links e documentos") agora busca no que já existe: escolha um item do banco e ele passa a aparecer ali também. Ao editar um link, o campo **Usar nas tarefas** aceita várias. Desvincular tira o link só daquela tarefa.
- **Status em cada link.** Para leitura: *Para ler* e *Lido*. Para chamado: *Aberto*, *Em andamento*, *Aguardando retorno*, *Concluído* e *Cancelado*. Cada um tem um ícone próprio. Clique no ícone (na tarefa ou na tela de Links) para mudar; o app guarda desde quando está naquele status ("Aberto há 3 dias"). A tela **Links e docs** ganhou a coluna e o filtro de status.
- **Chamado que trava a tarefa.** No menu "..." do link, dentro da tarefa, marque **Está travando esta tarefa**. O chamado aparece numa faixa no cabeçalho da tarefa, um impedimento é anotado na linha do tempo e o app oferece marcar a tarefa como bloqueada. Quando você muda o chamado para *Concluído*, a faixa some e aparece o lembrete de que a tarefa **destravou**. É por tarefa: o mesmo chamado pode travar uma e ser só referência em outra.
- **Chamado esquecido vira lembrete.** Chamado em aberto há 5 dias sem mudar de status entra em "Precisa de você" (com mais peso se estiver travando a tarefa).
- **Páginas e folhas ligadas a tarefas.** No mesmo **Adicionar**, escolha uma página ou uma folha do bloco de notas, ou crie uma já ligada à tarefa. Na página, o botão de tarefas (ao lado da categoria) escolhe a quais ela serve; na folha, ele fica no rodapé. Uma página pode servir a várias tarefas.

O **editor** (páginas, folhas e anotações do registro) também cresceu:

- `@` agora cita também **links e documentos do banco** (entra o endereço de verdade, ou o arquivo guardado), **folhas do bloco de notas** e **categorias**, além de páginas, tarefas e pessoas.
- **Ctrl + clique** num link do texto abre o destino (o clique simples continua pondo o cursor, para editar). O balão do link ganhou o botão **Abrir**.
- **Arraste ou cole um arquivo** (PDF, planilha...) no texto: ele é guardado na pasta de dados e entra como link.
- Na barra: **desfazer**, **refazer** e **anexar arquivo** (aparecem quando há largura; `Ctrl Z` e `Ctrl Y` funcionam sempre). No menu `/`: **Data de hoje**, **Hora de agora** e **Citar ou ligar**.
- A folha do bloco de notas mostra **quantas palavras** tem e ganhou **Virar página**: o texto vira página de conhecimento (com as tarefas ligadas) e a folha fica arquivada.

Nada muda nos dados que você já tem: os links antigos continuam ligados à mesma tarefa.

**Imagem que abre sem tirar você do lugar (3.14.1).** Clicar numa imagem do texto (na linha do tempo, numa página, numa folha) amplia a imagem por cima do app, em vez de trocar a tela inteira por ela. `Esc`, o X ou um clique fora fecham e você volta exatamente para onde estava. Lá dentro: as setas passam para as outras imagens do mesmo texto, `+` e `-` aproximam e afastam, `0` volta a ajustar à janela, e um clique na imagem alterna entre ajustada e tamanho real. Dá para baixar ou abrir em outra aba. No editor, um clique seleciona a imagem e dois cliques ampliam. Arquivos de imagem do banco de links abrem do mesmo jeito.

## 3.13: o Nexo com a sua cara

Abra **Personalizar** (o botão ao lado de Configurações, no pé do menu, ou o "..." da barra superior). Tudo muda na hora e fica só no seu navegador; suas tarefas não mudam.

- **Temas prontos**: Nexo, Grafite, Oceano, Floresta, Pôr do sol, Papel, Ameixa, Meia-noite e Terminal. Um clique troca cor, tons, cantos, letra, barra lateral e fundo. Os que têm um sol ou uma lua também mudam para claro ou escuro. Depois é só ajustar o que quiser.
- **Sua cor**: a última bolinha da cor de destaque abre dois controles, matiz e intensidade. Qualquer cor serve: o Nexo mantém a luminosidade, então o texto continua legível.
- **Tons neutros**: os fundos, as bordas e o texto podem ser frios (como sempre foram), cinza, quentes ou puxados de leve para a sua cor.
- **Escuro profundo**: fundos quase pretos, com mais contraste, para ambiente escuro.
- **Fundo em grade**, além de liso, aurora e pontilhado.
- **Tela Hoje sob medida**: o botão ao lado de "Planejar o dia" abre as opções. Ponha seu nome na saudação, esconda os blocos que você não usa, mude a ordem dos painéis da direita e escolha se o foco ou "Precisa de você" vem primeiro.
- **Levar para outro computador**: no fim da aba Aparência, "Copiar código" guarda a personalização inteira num texto. No outro computador (ou em outro navegador), "Colar código..." aplica tudo.

## 3.12: mais fácil de bater o olho

- **Tela Hoje**: em "Precisa de você", os motivos de cada tarefa viraram selos numa linha (vermelho para o que está errado, âmbar para o que pede atenção, cinza para o resto). Passe o mouse num selo para ver a explicação. Embaixo fica só o que dá para resolver ali mesmo: o passo, com o botão **Concluir**. A saudação ficou maior e a lista ocupa menos espaço, então o foco de hoje aparece sem rolar.
- **Nome da tela maior** em todas as telas, para o olho achar onde está.
- **Barra superior mais leve**: as ferramentas (rotina, agenda, foco, anotar) perderam a moldura; o fundo aparece quando você passa o mouse. A **busca** fica num lugar só: na barra lateral ou, com ela recolhida, na barra superior. `Ctrl K` e `/` continuam abrindo de qualquer lugar.
- **Tela Tarefas**: Grade, Lista e Quadro subiram para o cabeçalho e os cartões começam mais cedo. O botão "Nova tarefa" de lá saiu, porque já está na barra lateral (e no atalho `N`).
- **Página da tarefa**: "Depende de" vazio virou uma linha só, com o seletor ao lado.
- **Radar**: o gráfico de movimento de cada categoria ganhou linha de base.
- **Lista de tarefas**: o título aparece inteiro. Num notebook, as outras colunas ficam mais justas para dar lugar a ele.
- **Quadro**: as cinco colunas cabem na tela de um notebook, sem a última ficar cortada.
- **Barra lateral**: o que não cabe esmaece no fim, em vez de um item aparecer pela metade, e o nome do seu nível aparece inteiro.
- **O que há de novo** (em Configurações): o que é da versão atual aparece primeiro, em frases curtas. As versões anteriores viraram um histórico enxuto, uma linha por novidade, que abre ao clicar.
- Acertos pequenos: o cabeçalho "Último contato" da tela Pessoas não quebra mais em duas linhas, e os ícones das ações da paleta (`Ctrl K`) ficaram neutros.

## 3.11: formulários com o essencial primeiro

- **Novo registro**: à esquerda tipo, título, data e hora, participantes e as anotações, com mais espaço. À direita o **Copilot** vem no topo, inteiro na tela mesmo num notebook de 1366x768: copiar o prompt, colar a resposta e preencher os campos sem rolar.
- **Resumo, decisões, próximos passos e impedimentos** só aparecem quando têm conteúdo: abrem sozinhos quando você aplica a resposta do Copilot, ao editar um registro que já tem esses campos e ao voltar de um rascunho. Para escrever à mão, clique em **Preencher à mão**. "Passos anteriores resolvidos aqui?" e "Atualizar a tarefa junto" ficam logo abaixo, recolhidos, e abrem sozinhos quando há algo marcado ou mudado.
- **Nova tarefa**: à vista só título, categoria, prazo e prioridade. Status, lembrete de voltar, tags e descrição ficam em **Mais opções**, que mostra um resumo do que tem dentro. Se você prefere ver tudo, deixe aberto: o Nexo lembra. Ao editar uma tarefa que já tem esses campos, ele abre sozinho.
- **Prioridade**: continua de 1 a 10, mas os números aparecem agrupados em baixa (1 a 4), média (5 a 7) e alta (8 a 10), com a faixa escolhida escrita embaixo.
- **Campos de texto crescem com o que você escreve**, sem a alça de arrastar do navegador, até um limite a partir do qual rolam por dentro.

## 3.10: cores com significado e datas de um jeito só

- **Vermelho é só o que está errado**: prazo vencido, erro, excluir e o aviso de algo crítico. A prioridade deixou de ser vermelha e âmbar: agora é um quadradinho neutro, com contorno (1 a 4), preenchido claro (5 a 7) ou escuro (8 a 10), e o número continua lá. Impedimento e tarefa parada há muito tempo ficam em âmbar, que quer dizer "pede atenção".
- **Números só com cor quando ela diz algo**: atrasadas e em risco em vermelho, bloqueadas e "pede atenção" em âmbar, concluídas e "em dia" em verde. O resto (abertas, passos em aberto, registros) fica na cor do texto.
- **Datas sempre iguais**: `20/11` (com o ano só se não for este ano) e, quando ajuda, `em 2 dias`, `há 4 dias` ou `3 dias de atraso`, sempre por extenso. Os textos que você copia (status, ata, daily, cobrança) e o espelho em Markdown continuam com a data completa.
- **Mais fácil de ler**: selos e contadores passaram de 4,5:1 de contraste nos dois temas, com qualquer cor de destaque, e o botão principal no tema escuro também.

## Novidades da 3.9: menu mais curto

- **Acompanhar**: Radar, Diário, Revisão semanal, Relatórios e Conquistas (e, desde a 3.23, Decisões) viraram um item só no menu lateral, **Acompanhar**. Ele abre a última dessas telas que você usou (na primeira vez, o Radar), e no topo de cada uma há abas para trocar entre elas. Os atalhos continuam: `G F` Radar, `G D` Diário, `G S` Revisão, `G R` Relatórios, `G Q` Conquistas. O ponto de "revisão atrasada" aparece no item Acompanhar e na aba Revisão.
- **Quer as telas separadas, como antes?** Abra Personalizar (o botão ao lado de Configurações, no pé do menu) > Lateral e ligue "Mostrar as telas de acompanhar separadas no menu". A ordem e os itens que você tinha escondido continuam como estavam.
- **Barra superior com menos botões**: tema, tela cheia e atalhos de teclado agora ficam no botão **...** do canto direito, junto com "Personalizar as barras". F11 e a tecla `?` continuam valendo.
- **Agenda mostra só o dia**: a hora aparece quando você abre o balão. O ponto vermelho de atraso continua.
- **Ícones diferentes entre si**: com o menu recolhido (`Ctrl B`), cada tela tem um desenho próprio, e passar o mouse mostra o nome.

## Novidades da 3.8

- **Fechar o dia**: ao clicar em **Encerrar o dia** na Rotina (ou `Shift D`), o Nexo mostra o que saiu hoje, os focos que ficaram (leve para o próximo dia de trabalho com um clique), seus passos vencidos, os impedimentos e a **daily** pronta para copiar. De manhã, o botão de copiar daily fica na tela Hoje. É texto montado só com o que você registrou, sem IA.
- **Desfazer**: mudou o status, a prioridade ou o prazo, moveu um registro, mandou algo para a lixeira? O aviso traz **Desfazer**, e `Ctrl Z` (fora de campos de texto) faz o mesmo.
- **Várias tarefas de uma vez**: em Tarefas, marque a caixinha (ou `Ctrl` + clique, ou `X`) e use a barra de baixo para mudar status, prioridade, categoria, prazo, lembrete ou foco de todas juntas. `J` e `K` andam pela lista, `Enter` abre, `F` põe no foco de hoje e `M` abre o menu.
- **Visões salvas**: monte os filtros e guarde com um nome no botão **Visões**. Elas também aparecem na paleta (`Ctrl K`).
- **Transcrição do Teams na reunião**: no modo reunião, botão **Transcrição**. Cole o texto (ou escolha o .vtt), copie o prompt, cole a resposta do Copilot e as decisões, passos e impedimentos entram na captura. O texto original fica anexado.
- **Depende de**: na lateral da tarefa, ligue as tarefas que precisam terminar antes. Quando todas terminam, aparece o lembrete "Destravou". O Radar mostra o que está segurando cada categoria.
- **Tarefas que se repetem**: no modelo de tarefa, escolha **Repetir** (toda semana, todo mês ou a cada N dias). No dia, o Nexo lembra com **Criar agora** ou **Pular esta vez**. Ele nunca cria sozinho.
- **Falar com alguém**: anote o que levar para a próxima conversa com uma pessoa (na página dela, no menu da tarefa ou na paleta). Na reunião com ela, os assuntos aparecem na pauta.
- **Imprimir ou salvar em PDF** a tarefa ou a categoria inteira (menu "..."), e **Copiar em Markdown**.
- **Comparar versões** de uma página: no histórico, "Comparar com agora" mostra o que entrou e o que saiu.
- **Busca dentro dos vídeos**: a busca e o Perguntar agora acham o que foi dito nas transcrições, e o resultado leva ao instante da fala.
- **Avisos do Windows** (opcional, em Configurações): com o Nexo em segundo plano, os avisos da rotina e os lembretes críticos chegam como notificação do sistema.

## Cada coisa com um nome só (3.6)

A 3.6 foi uma passada de acabamento na interface, sem mexer nos dados:

- **Um nome por conceito**: **categoria** (antes também "assunto" e "frente"), **passo** e **passos em aberto** (a tela que junta todos é **Pendências**), **lembrete de voltar** (antes também "follow-up") e **linha do tempo**.
- **Lembretes por tarefa**: no sino e em "Precisa de você", cada tarefa aparece uma vez, com todos os motivos embaixo. Adiar adia os motivos daquela tarefa.
- **Tela Hoje sem números repetidos**: saíram os quatro cartões de contagem (já estão no menu e na barra de status) e o segundo botão de "Nova tarefa".
- **Letras e contraste**: o texto miúdo subiu de 11 para 12 px, os prazos em âmbar ficaram mais escuros e o círculo de concluir passo ganhou uma área de clique maior.

## Rotina: o dia em blocos, a hora de sair e o banco de horas (3.5)

Além das tarefas, o dia tem uma rotina. Na tela **Rotina** (`G` depois `O`):

- **Planeje o dia em blocos**: clique num horário da linha do tempo e reserve aquele tempo para uma tarefa do app, para uma atividade que não é tarefa (como "Chamados") ou para uma pausa (almoço, jantar). Arraste um bloco para mudar o horário e puxe a borda de baixo para mudar a duração.
- **Dia padrão**: monte uma vez os blocos que se repetem em cada dia da semana (os chamados da manhã, o almoço). Todo dia já nasce com eles, e o que você mudar num dia vale só para aquele dia.
- **O app acompanha**: a barra superior mostra o bloco de agora e quanto falta, e um aviso aparece quando um bloco começa e 5 minutos antes de ele acabar.
- **Ponto**: clique em **Entrei agora** (ou digite a hora) e o Nexo diz a que horas você sai. O padrão é 8h de trabalho + 1h de almoço, 9h no total: entrou 08:12, sai 17:12. Registre a saída e a volta da pausa e a hora de sair se ajusta. Se esquecer de registrar a pausa, ele desconta 1h nos dias de mais de 6 horas.
- **Hora extra**: dá para planejar além do expediente. A linha "Fim do expediente", a faixa hachurada e o selo "extra" nos blocos deixam claro o que passou da jornada.
- **Banco de horas**: saldo da semana, do mês e acumulado, com o mês dia a dia e um botão para copiar em texto. Só entra no saldo o dia com entrada e saída; dia sem registro não conta contra você.
- **Jornada** (botão no topo): horas por dia, tamanho da pausa, dias de trabalho, saldo que você já tinha e os avisos.

Esqueceu de bater o ponto? Abra o dia, clique em **Ajustar** e informe os horários. Lá também se marca folga ou feriado.

## Documentação (3.1)

As **Páginas** viraram um lugar para documentar de verdade:

- **Páginas dentro de páginas**: a árvore à esquerda mostra tudo. Arraste para mudar a ordem ou pôr uma página dentro de outra. Botão direito (ou "...") cria subpágina, duplica, favorita, arquiva.
- **Abas**: cada página aberta fica numa aba, como num editor de código. `Alt ←` e `Alt →` trocam de aba.
- **Ler ou editar**: no modo leitura a página aparece limpa, com o **sumário** ao lado acompanhando a rolagem, as páginas de dentro e "anterior / próxima".
- **Modelos**: processo, guia passo a passo, runbook, registro de decisão, perguntas frequentes e glossário.
- **Ligar páginas**: digite `[[` e o nome. Se a página não existe, o Nexo cria e liga. `@` continua citando tarefas e pessoas.
- **Busca na documentação** (`Ctrl P`): mostra em que seção de cada página o trecho está e abre direto nela.
- **Quadro e Lista**: veja as páginas por estado (rascunho, em revisão, pronta), arrastando entre as colunas, ou numa tabela com filtro.

## Páginas de vídeo (3.3)

Em Páginas, no botão ao lado de "Nova página", escolha **Página de vídeo**. Serve para a gravação de uma reunião ou de um treinamento:

- **O vídeo**: envie o arquivo (fica na pasta de dados), aponte para um arquivo do computador (não copia, bom para gravação grande) ou só guarde o link.
- **Player próprio**: `Espaço` toca e pausa, as setas pulam 5 segundos; com um clique no vídeo, `J` e `L` pulam 10 s, `<` e `>` mudam a velocidade, `C` liga a legenda, `F` a tela cheia. Ele lembra onde você parou.
- **Transcrição que acompanha**: envie o VTT ou SRT (o Teams exporta VTT) ou cole o texto. A fala de agora fica destacada, clicar numa fala leva o vídeo até ela, e a busca acha qualquer palavra.
- **Anotar neste instante**: põe o tempo nas suas anotações; depois é só clicar nele para voltar àquele ponto. Um `[12:34]` escrito à mão também vira botão.
- **Capítulos**: marque onde o assunto muda; eles aparecem na barra do vídeo.
- **Resumir**: copia um prompt com a transcrição para o Copilot devolver resumo, decisões e próximos passos com os tempos.

A visão **Vídeos** mostra todas as páginas de vídeo como uma galeria.

## Componentes nas páginas (3.2)

No editor, digite `/` e escolha:

- **Destaque** (nota, dica, importante, atenção, perigo, deu certo): uma caixa colorida para o que não pode passar batido.
- **Bloco que abre e fecha** e **Pergunta e resposta**: o título aparece, o resto abre ao clicar.
- **Bloco de código**: escolha a linguagem na barra; na leitura ele ganha cores e o botão de copiar.
- **Índice**: a lista dos títulos da página, montada sozinha.
- **Arquivo**: anexa um PDF, planilha ou outro arquivo, que fica na pasta de dados.
- **Subpágina**: cria uma página dentro da atual e já deixa o link.

Um link para uma tarefa, página ou pessoa **sozinho numa linha** vira um cartão que mostra o estado de agora (status, prazo, passos em aberto). Tudo isso continua sendo Markdown simples por baixo: um destaque é `> [!NOTA] Título`.

## Mapa e histórico das páginas (3.4)

- **Mapa**: em Páginas, escolha a visão **Mapa**. Cada página é um ponto e cada linha é uma citação (ou uma página dentro da outra). Dá para ver de relance o que está bem ligado e o que ficou **solto**, sem ninguém apontando. Arraste o fundo para mover, use a roda do mouse para aproximar, passe o ponteiro num ponto para destacar os vizinhos e clique para abrir. As chaves no topo incluem as tarefas e as pessoas citadas.
- **Histórico de versões**: o botão do relógio no topo de cada página mostra como ela estava antes das últimas edições. Escolha uma versão para ler e, se quiser, **restaure**. Restaurar também guarda o texto que estava, então tem volta. O Nexo guarda até 40 versões por página, no máximo uma a cada 10 minutos, na pasta `_historico` dentro da sua pasta de dados. Se você apagar um pedaço grande do texto de uma vez, a versão é guardada na hora, sem esperar os 10 minutos.

## Nexo 3.0

A 3.0 junta cinco frentes: **modo reunião**, **páginas de conhecimento com @**, **perguntar ao Nexo**, **radar das frentes** e **confiança**. As quatro primeiras estão descritas abaixo. Da última:

- **Restaurar um backup pelo app**: em Configurações, abra a lista de backups e clique em "Restaurar...". Uma prévia mostra o que muda (tarefas que voltam ao que eram, tarefas criadas depois que vão para a lixeira). Antes de mexer em qualquer coisa, o estado de agora é guardado em `_backups/pre-restauracao-*`: se não era isso que você queria, restaure essa foto.
- **Saúde dos dados**: "Verificar agora" confere se todos os arquivos estão legíveis, se há cópia de conflito do OneDrive, anexo faltando ou vínculo que aponta para algo que não existe mais. Só lê e explica o que fazer.
- **Mais fechado**: o app recusa qualquer pedido de dados vindo de outra página aberta no navegador e manda uma política de conteúdo que só o deixa falar com a própria máquina.
- **Rápido com muito dado**: medido com um ano de uso simulado (300 tarefas, mais de 6 mil registros). A busca agora mostra os resultados em lotes.
- **O que há de novo**: um aviso discreto na primeira abertura; a lista fica em Configurações.

O menu lateral foi reagrupado em **Dia a dia**, **Conhecimento** e **Acompanhar**. A ordem e os itens que você escondeu continuam como estavam.

## Radar (2.14)

Em **Radar** (`G F`) cada categoria aparece com a saúde calculada na hora:

- **Em risco**: tem tarefa com prazo vencido ou bloqueada.
- **Parada**: tem tarefa aberta e nenhum movimento há 14 dias ou mais.
- **Pede atenção**: prazo chegando, passo vencido, retorno demorando ou tarefa em andamento sem próximo passo.
- **Em dia**: nada disso.

Cada cartão diz o porquê, mostra o movimento das últimas 8 semanas e o próximo prazo. Embaixo, a linha de **prazos das próximas semanas** (tarefas, passos e lembretes de voltar, por categoria). **Copiar status** gera um texto simples para mandar ao gestor, só com o que está registrado, sem IA.

## Perguntar ao Nexo (2.13)

Tem uma dúvida cuja resposta está em algum lugar do seu histórico? Em **Perguntar** (`G U`):

1. Escreva a pergunta, do jeito que falaria ("O que ficou decidido sobre o gate de bloqueio?").
2. O Nexo procura em tudo (registros, tarefas, páginas, folhas, links e pessoas) e mostra os trechos que têm a ver, numerados como F1, F2... Dá para tirar algum e para limitar a uma categoria.
3. **Copiar prompt**, colar no Copilot e trazer a resposta de volta. As citações `[F1]` viram links para as fontes, e a resposta pode ser guardada como página de conhecimento.

O prompt manda o Copilot responder só com esses trechos e dizer quando eles não bastam. Nada sai do seu computador a não ser o que você mesmo colar no Copilot. Na tela de busca, "Perguntar ao Copilot" leva o termo pesquisado para lá.

## Modo reunião (2.12)

Na página da tarefa, **Modo reunião** abre uma tela só para a conversa:

- **Antes**: a pauta se monta sozinha com as pendências da tarefa, as últimas decisões, onde a conversa parou e, ao informar os participantes, o que está com cada um em outras tarefas. "Copiar" gera a pauta em texto para mandar antes.
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
- **Barra lateral**: arraste os itens para mudar a ordem, desligue o que não usa, escolha quais seções aparecem (Foco de hoje, Fixadas, Recentes, Assuntos). A largura se ajusta arrastando a borda direita da barra. Clique no título de uma seção para recolher. "Mostrar as telas de acompanhar separadas no menu" troca o item Acompanhar por Radar, Diário, Decisões, Revisão semanal, Relatórios e Conquistas soltos.
- **Barra superior**: escolha as ferramentas que ficam à mão.
  - **Agenda**: o dia. Ao clicar, a hora e os prazos, passos com data e lembretes das próximas duas semanas.
  - **Foco**: quantos passos do foco de hoje já saíram. Ao clicar, você marca passos sem sair da tela em que está.
  - **Anotar** (tecla `A`): cria uma tarefa ou uma folha do bloco de notas de qualquer tela. O que você digitar fica guardado ali até virar tarefa ou folha, mesmo se fechar o balão.
  - **...** (sempre à vista): tema, tela cheia, atalhos de teclado e Personalizar. Tela cheia e atalhos escondidos aqui somem também desse menu.
- **Fixar uma tarefa**: no menu da tarefa (botão direito ou "..."), "Fixar na barra lateral". Ela fica a um clique, em qualquer tela.

Essas escolhas ficam no navegador daquele computador. "Redefinir este perfil" desfaz o que você mexeu no menu, nas barras e na tela Hoje, e "Voltar a aparência ao padrão" desfaz cores, cantos e letra, sem tocar nas suas tarefas. Para aumentar ou diminuir tudo, use `Ctrl +` e `Ctrl -`.

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
  notas.json              folhas do bloco de notas
  modelos.json            modelos de tarefa
  paginas.json            páginas da documentação
  jornada.json            rotina (blocos de cada dia), ponto e a configuração da jornada
  tarefas/<id>.json       uma tarefa por arquivo, com a timeline inteira
  arquivos/AAAA/...       documentos anexados, imagens coladas, vídeos e transcrições
  markdown/*.md           versão legível de cada tarefa (gerada automaticamente)
  _backups/AAAA-MM-DD/    foto diária (últimas 45) + manuais + pré-migração
  _historico/paginas/     como cada página estava antes de ser editada
  _lixeira/               nada é apagado de verdade
```

A configuração (qual pasta usar) fica em `%USERPROFILE%\.nexo\config.json`. O código do app fica em outra pasta. Atualizar o app nunca encosta nos dados.

## Proteções contra perda de dados

- Rascunho automático no editor de registro: pode fechar no meio da digitação (Esc, clique fora, F5, janela fechada, navegador travado) que o texto volta quando abrir de novo, e a página da tarefa avisa com **Continuar** e **Descartar**. O rascunho fica no navegador, então vale para aquele navegador e some se você limpar os dados do site.
- Os formulários de tarefa, link e resposta colada do Copilot perguntam antes de fechar se houver texto digitado.
- Cada página da documentação guarda as versões anteriores do texto, e dá para voltar a qualquer uma.
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
