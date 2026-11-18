# AGENTS.md · Nexo (cérebro de tarefas)

Este arquivo é o contexto completo do projeto para qualquer agente (Claude Code, Codex, Devin, Copilot). Leia inteiro antes de mexer no código. O README é para o usuário final; este arquivo é para quem desenvolve.

---

## 1. O que é e para quem

**Nexo** é um organizador pessoal de tarefas de trabalho, 100% local (offline-first), criado para o **Roh** (dono do repositório), especialista de Cyber numa instituição financeira (AppSec, DevSecOps, gestão de vulnerabilidades).

> Este repositório é público. Não escreva aqui (nem em código, testes ou exemplos) nome da empresa, nomes internos de sistemas/programas, pessoas reais ou qualquer dado de trabalho. Exemplos usam nomes genéricos ("Ferramenta X", "squad de Pagamentos").

### O problema
Ele recebe várias tarefas ao mesmo tempo (ex.: frentes como **Security Champion**, gestão de vulnerabilidades, adoção de ferramentas pelos squads). Cada tarefa avança por **reuniões** (com pessoas diferentes) e por **atividades** que ele mesmo faz. Antes, as informações ficavam espalhadas em anotações, arquivos e conversas soltas, e ele se perdia. A ideia é ter um "cérebro das tarefas": um lugar único com a **linha do tempo** de cada tarefa (o que aconteceu em cada data, com quem, o que foi decidido, o que ficou pendente, quais os impedimentos), busca em tudo e um banco de links e documentos.

### O esboço original (feito à mão pelo usuário)
- Tela "Tarefas" com cards **T1, T2, T3, T4**, cada um com a **prioridade** embaixo (5, 2, 3, 8).
- Ao abrir T1: uma **timeline vertical** de cards de "Atualizações" datados (10/05/26 → 15/06/26 → ...) que termina num card **"Concluída"** (30/09/26).
- Cada atualização tem: **Informações da reunião, Participantes, Data, Resumo IA, Status, Prazo, Prioridade**.

Tudo isso foi implementado. Ver seção 6.

### Pedidos explícitos do usuário (requisitos)
1. Centralizar todas as informações de cada tarefa, com visão de timeline.
2. **Categorias**: de um mesmo assunto/aplicação nascem várias tarefas; abrir a categoria tem que mostrar todas as tarefas que já saíram dela.
3. Integração com IA **sem API**: copiar um prompt pronto → colar no **Microsoft Copilot do navegador** (o único disponível no trabalho) → colar a resposta de volta no app.
4. Busca: achar quais tarefas tinham a informação pesquisada.
5. Banco de **links e documentos** importantes.
6. **Offline-first**, rodando na máquina dele, com os dados numa pasta escolhida (normalmente dentro do **OneDrive**, que faz backup).
7. **"Não perder os dados anteriores conforme a ferramenta evolui. Isso é o mais crucial de tudo."** (palavras dele). Ver seção 4.
8. Ele vai pedir melhorias continuamente conforme usa. O app tem que ficar cada vez melhor sem quebrar o que já existe.

---

## 2. Restrições do ambiente (máquina corporativa)

Estas restrições definem várias decisões de arquitetura. Não as viole.

- **Node.js está instalado** e `npm install` funciona pelo proxy corporativo. Ele já rodou outros projetos Next.js lá (ex.: Sonora).
- **`git clone` é bloqueado**, mas o GitHub abre e repositórios **públicos** podem ser baixados por HTTP. Por isso este repositório é **público** e existe o kit de cópia sem git (seção 9).
- **Não existe API de IA** liberada. Só o **Copilot no navegador**. Toda IA do app é "copiar prompt / colar resposta". Nunca adicione dependência de API de LLM.
- **Nada sensível vai para o repositório.** Dados do trabalho ficam só na pasta local do usuário. O repo é público.
- Ele usa **Windows**, Edge/Chrome, PowerShell e Git Bash.
- **Dependências com parcimônia.** Cada pacote precisa passar pelo npm do proxy (funciona, mas é mais um ponto de falha). A v2 adotou, a pedido do dono, a pilha de interface que ele usa nos outros projetos: `tailwindcss` + `@tailwindcss/postcss`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `motion`, `lucide-react`, `cmdk`, `sonner`, `@dnd-kit/core` e `geist` (fonte empacotada, sem buscar nada na internet). A 2.9 somou o editor de texto rico, também a pedido do dono: **Tiptap** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/markdown`, `@tiptap/suggestion`, `@tiptap/extensions`, `@tiptap/extension-image`, `-link`, `-list`, `-paragraph`, `-table`, todos na mesma versão) e `marked` (o leitor de Markdown que o Tiptap já usa). Versões **fixadas** no `package.json`; ao atualizar o Tiptap, suba todos os pacotes juntos e prefira uma versão com pelo menos duas semanas de publicada. Antes de somar outra, veja se o kit em `components/ui` já resolve. Continua sem banco e sem API de IA.
- **Fontes e ícones são locais.** Nunca use `next/font/google` nem CDN: o build roda na máquina corporativa e o app não faz chamadas externas.
- O servidor sobe **só em `127.0.0.1:3210`** (nunca `0.0.0.0`), porque está numa rede corporativa.

---

## 3. Stack e comandos

- **Next.js 16.4.6** (App Router, Turbopack), **React 19.3.1**, **TypeScript** estrito. Versões fixadas no `package.json`.
- **Tailwind CSS v4** (configurado só por CSS em `app/globals.css`, sem `tailwind.config`), componentes no padrão **Shadcn** sobre **Radix** em `components/ui`, animações com **motion**, ícones **lucide-react**. Tema claro, escuro ou do sistema. Detalhes e regras na seção 13.
- Atenção às mudanças do Next 16: o antigo `middleware.ts` agora é **`proxy.ts`** (exporta `function proxy`); `params` de rotas dinâmicas é uma **Promise** (`await ctx.params` nos route handlers, `useParams()` nos client components); `useSearchParams()` exige `<Suspense>`. Na dúvida, leia `node_modules/next/dist/docs/`.

```bash
npm install
npm run dev         # http://127.0.0.1:3210 (Turbopack)
npm run build       # build de produção
npm start           # produção em 127.0.0.1:3210
npm run typecheck   # tsc --noEmit
bash testes/api.sh  # testes de fumaça da camada de dados e segurança (precisa de build)
NEXO_URL=http://127.0.0.1:3311 node testes/e2e.cjs  # ponta a ponta da interface (Playwright para Node), pasta de dados VAZIA, ver cabeçalho
node testes/semear.mjs # cenário de demonstração numa pasta de dados VAZIA e descartável
node testes/pessoas.test.mjs  # testes do cadastro de pessoas e do importador do Outlook
node testes/notas.test.mjs    # testes do bloco de notas: prompt e leitor do JSON que a IA devolve
node testes/aparencia.test.mjs # testes da personalização: aparência, moldura e o script que roda antes da primeira pintura
node testes/diario.test.mjs   # testes do Diário, de "esperando quem", dos modelos de tarefa e da sessão de foco
node testes/texto-rico.test.mjs # testes do texto rico: leitor de Markdown saneado (HTML, imagens de fora, links)
node testes/jogo.test.mjs     # testes da gamificação: XP, níveis, meta do dia e conquistas
node testes/ligacoes.test.mjs # testes das páginas de conhecimento, dos links internos e de "quem cita quem"
node testes/reuniao.test.mjs  # testes do modo reunião: pauta, rascunho vindo do navegador, registro e ata
node testes/perguntar.test.mjs # testes de "Perguntar ao Nexo": achar trechos, prompt e citações da resposta
node testes/radar.test.mjs    # testes do Radar das frentes: saúde, linha de prazos e status em texto
node testes/integridade.test.mjs # testes da verificação de integridade (o que está estranho nos dados e na pasta)
node testes/paginas.test.mjs  # testes da documentação: árvore de páginas, ordem de leitura, sumário, busca e modelos
node testes/transcricao.test.mjs # testes da transcrição de vídeo: VTT, SRT, texto com tempos, sincronia e prompt
node testes/grafo.test.mjs    # testes do mapa das páginas: nós, ligações e disposição determinística
node testes/jornada.test.mjs  # testes da rotina: plano do dia, ponto, hora de sair, hora extra, avisos e banco de horas
node testes/lembretes.test.mjs # testes do motor de lembretes e do agrupamento por tarefa
node testes/fechamento.test.mjs # testes do fechamento do dia, da daily e da transcrição trazida para o modo reunião
node testes/dependencias.test.mjs # testes de dependências entre tarefas, tarefas que se repetem e "falar com" (assuntos)
node testes/versoes.test.mjs  # testes da comparação de versões, do vídeo como fonte do Perguntar e das preferências novas
NEXO_URL=http://127.0.0.1:3311 node testes/carga.mjs --telas # desempenho com um ano de dados simulados, pasta de dados VAZIA, ver cabeçalho
```

Para desenvolver sem sujar dados reais, use pasta descartável:
```bash
HOME=/tmp/nexo-home NEXO_DATA_DIR=/tmp/nexo-dados npm run dev
```

**Antes de entregar qualquer mudança:** `npm run typecheck`, `npm run build` e `bash testes/api.sh` precisam passar. Se mexeu em tela, rode o `testes/e2e.cjs` ou ao menos abra no navegador e confira.

---

## 4. Regra número 1: nunca perder dados

O usuário vai usar o app todo dia e pedir mudanças. **Qualquer versão nova tem que abrir os dados de qualquer versão anterior sem perder nada.**

### Regras de evolução do modelo de dados
- **Campo novo**: sempre **opcional** no tipo (`lib/tipos.ts`) e com **valor padrão** na função `normalizar*()` correspondente. Isso não precisa de migração.
- **Nunca renomeie nem remova um campo diretamente.** Se a estrutura precisar mudar (renomear, mover, mudar tipo, mudar significado de um valor como a escala de prioridade), faça uma **migração**:
  1. suba `SCHEMA_APP` em `lib/migracoes.ts` (ex.: 1 → 2);
  2. adicione `{ de: 1, executar: async (dir, { lerJson, escreverAtomico }) => { ... } }` em `MIGRACOES`;
  3. a migração deve ser idempotente e conservadora (na dúvida, mantenha o campo antigo também);
  4. o app tira um **backup completo** em `_backups/pre-migracao-v1-para-v2-<data>` antes de rodar.
- As funções `normalizar*()` fazem `...spread` do objeto original para **preservar campos desconhecidos** (gravados por versões mais novas). Não remova esse spread.
- O servidor **mescla** o que recebe com o que está no disco (`{...existente, ...recebido}`), também para não perder campos.
- Se os dados tiverem `schemaVersion` **maior** que o do app (app velho abrindo dado novo), o app entra em **somente leitura** (HTTP 423 nas escritas).

### Garantias implementadas em `lib/armazenamento.ts` (não enfraqueça)
- **Escrita atômica** (`escreverAtomico`): grava em `arquivo.tmp` e faz `rename`. Tenta de novo até 8 vezes se o OneDrive/antivírus segurar o arquivo; fallback com `copyFile`.
- **Arquivo corrompido nunca vira vazio** (`lerJson`): se o JSON não parsear, lança erro com mensagem clara. Uma coleção ilegível volta com `rev: -1` e a interface bloqueia gravações nela. **Nunca troque por `catch { return padrao }`.**
- **Controle de concorrência otimista**: toda tarefa e coleção tem `rev`. A gravação manda `revEsperada`; se não bater, o servidor responde **409** e a interface recarrega. Isso protege contra duas abas ou dois PCs (OneDrive) gravando por cima.
- **Fila de gravação por recurso** no cliente (`components/Provider.tsx`, `enfileirar`): cliques rápidos não disputam a mesma revisão. Sempre altere tarefa via `atualizarTarefa(id, fn)`, que aplica `fn` sobre a **versão mais recente** do estado. Depois de cada gravação, a referência usada pela fila (`ref.current`) é atualizada na hora, sem esperar o próximo render: assim duas gravações seguidas com `await` na mesma tarefa ou coleção (como aplicar várias propostas do bloco de notas) usam a rev certa.
- **Backup diário automático**: antes da primeira escrita de cada dia, cópia dos JSON em `_backups/AAAA-MM-DD/` (mantém as 45 mais recentes; `manual-*` e `pre-migracao-*` nunca são podados).
- **Restaurar um backup pelo app** (`restaurarBackup()` em `lib/armazenamento.ts`, tela em Configurações): mostra uma prévia do que muda (`previaDoBackup()`, só leitura) e, ao confirmar: (1) lê e confere o backup inteiro antes da primeira escrita (backup com arquivo ilegível é recusado e nada muda); (2) tira uma foto do estado de agora em `_backups/pre-restauracao-<carimbo>` (nunca é podada), então **restaurar tem volta**; (3) regrava tarefas e coleções do backup com a revisão acima da atual, para uma aba aberta com dados velhos receber 409 em vez de gravar por cima; (4) só depois manda para a `_lixeira` as tarefas que não existiam no backup. Coleção que não existe no backup (backup de versão antiga) fica como está. Anexos (`arquivos/`) nunca entram em backup nem são apagados. Backup de formato mais novo que o app é recusado; de formato mais antigo, a versão volta junto e a migração roda na leitura seguinte.
- **Histórico de versões das páginas** (3.4, `guardarVersoesDasPaginas()` em `lib/armazenamento.ts`): antes de uma página ter o texto ou o título mudado, o que ela tinha é guardado em `_historico/paginas/<id>/<carimbo>.json`. No máximo uma versão a cada 10 minutos por página (a gravação automática acontece a cada pausa na digitação) e as 40 mais recentes ficam. **Exceção: corte grande** (o texto perde de uma vez 30% ou mais, e pelo menos 40 caracteres) guarda a versão na hora, mesmo dentro dos 10 minutos, porque apagar sem querer é o acidente que o histórico existe para desfazer. Só mudança de texto conta: página em branco não gera versão, e mudar só título, estado, ícone ou mãe também não (senão renomear uma página recém-criada gastaria a versão da sessão). Consequência aceita: fora o corte grande, dá para perder até 10 minutos de mudanças pequenas entre duas versões. **Restaurar uma versão é uma edição comum** (passa pelo Provider, com rev), então o texto que estava antes de restaurar também vai para o histórico: restaurar tem volta. Excluir a página não apaga as versões dela. Falha ao guardar a versão nunca impede a gravação da página. O histórico **não entra nos backups** (como os anexos): é uma rede a mais, não a principal.
- **Desfazer** (3.8, `components/desfazer.ts`): ações rápidas mostram um aviso com "Desfazer" e entram numa pilha que o `Ctrl Z` (fora de campos de texto) percorre. Quem desfaz é sempre uma gravação comum pelo Provider, com rev: `atualizarComVolta(id, fn, texto)` guarda a tarefa como estava e, ao desfazer, só volta se a rev de agora for a que a ação gravou (se alguém mexeu depois, recusa e avisa em vez de passar por cima). Excluir uma tarefa devolve o nome do arquivo na `_lixeira` (`DELETE /api/tarefas/<id>` responde `{ arquivo }`) e o desfazer usa a restauração normal da lixeira (`restaurarTarefa`). A pilha vive só na aba: é atalho, não proteção; a proteção continua sendo lixeira, `registrosRemovidos` e backups.
- **Verificação de integridade** (`GET /api/verificar`, `lib/integridade.ts`): só lê. Acusa arquivo ilegível e anexo citado que falta (erro), cópia de conflito do OneDrive, id repetido, categoria que sumiu e falta de backup (aviso) e vínculos órfãos, citações quebradas, anexos sem uso, sobras `.tmp` e tarefa muito grande (informação). **Não conserta nada sozinha**: cada achado diz o que fazer.
- **Nada é apagado de verdade**:
  - tarefa excluída → `_lixeira/tarefa-<id>-<carimbo>.json` (restaurável em Configurações);
  - item removido de categorias/links → `_lixeira/<colecao>-removidos-<carimbo>.json`;
  - registro removido da timeline → fica dentro da própria tarefa em `registrosRemovidos[]`;
  - folha do bloco de notas organizada → é **arquivada** (`arquivadaEm`), com o texto original, a lista do que criou e as sobras que não foram guardadas (`sobras`); folha excluída → `_lixeira/notas-removidos-<carimbo>.json`;
  - o que foi escrito numa folha nunca depende da IA para sobreviver: cada registro criado guarda `notaId` (link "abrir a folha original" na timeline) e, quando a folha rende um único conteúdo, o registro leva o **texto inteiro** da folha em `anotacoes`, não o trecho que a IA copiou.
- **Espelho em Markdown** (`markdown/<slug>--<id>.md`) regenerado a cada gravação: se o app morrer, os dados continuam legíveis e pesquisáveis no Windows.
- **Nada digitado se perde antes de salvar**:
  - o editor de registro guarda um **rascunho automático** a cada mudança (`lib/rascunhos.ts`, no `localStorage`, chave `nexo:rascunho:<tarefaId>:<registroId|novo>`). Esc, clique fora, F5, janela fechada ou navegador travado não perdem as anotações: o rascunho volta ao reabrir o editor e a página da tarefa mostra um aviso com Continuar/Descartar. Só some ao salvar ou ao descartar com confirmação;
  - se o navegador não deixar gravar o rascunho, o editor avisa no rodapé e pergunta antes de fechar;
  - a folha do bloco de notas grava sozinha na pasta de dados 1,5 s depois de o usuário parar de digitar (e ao trocar de folha ou a janela ir para o fundo). Nesse intervalo, ou se a gravação falhar, o texto fica em `nexo:nota-pendente:<id>` no `localStorage` e é regravado na próxima abertura;
  - o "Anotar rápido" da barra superior guarda o que foi digitado em `nexo:anotarPendente` a cada tecla: fechar o balão, apertar F5 ou trocar de tela não perde o texto, e um ponto no botão avisa que há texto esperando;
  - o **modo reunião** guarda tudo o que está sendo capturado (título, participantes, anotações, decisões, passos, impedimentos, pendências marcadas) em `nexo:reuniao:<tarefaId>` a cada mudança. Nada vai para a tarefa antes de "Encerrar e salvar"; até lá, F5 ou sair da tela não perdem nada e a página da tarefa mostra o aviso "Reunião ainda não salva" com Continuar/Descartar;
  - a tela **Perguntar** guarda a pergunta, a resposta colada e as fontes do último prompt copiado em `nexo:pergunta`, até a resposta virar página ou ser limpa;
  - a sessão de foco guarda o cronômetro e o texto de "o que saiu?" em `nexo:sessao`: F5, fechar a janela do registro ou o app não perdem nem o tempo nem o que foi escrito;
  - os formulários de tarefa, link, modelo e resposta colada do Copilot não têm rascunho, mas perguntam antes de fechar se algo foi digitado (`useFecharComCuidado()` em `components/Raiz.tsx`). **Formulário novo com texto longo tem que usar um dos dois mecanismos.**
- **Conflitos do OneDrive** (dois arquivos com a mesma tarefa, ex.: `t1-NOMEDOPC.json`) são detectados e viram **avisos** na interface; nada é descartado em silêncio.
- A **pasta de dados nunca fica dentro da pasta do app**. A configuração fica em `~/.nexo/config.json` (ou na variável `NEXO_DATA_DIR`). Atualizar o app não toca nos dados. Desde a 3.0 o servidor também recusa (`definirDataDir`): o atualizador espelha a pasta do app e apagaria os dados.

---

## 5. Onde e como os dados são gravados

```
<pasta de dados>/                ex.: C:\Users\<user>\OneDrive - <empresa>\Nexo
  nexo.json                      { app: "nexo", schemaVersion, criadoEm, migradoEm? }
  categorias.json                { rev, items: Categoria[] }
  links.json                     { rev, items: LinkDoc[] }
  pessoas.json                   { rev, items: Pessoa[] }   (ausente = vazio, rev 0)
  times.json                     { rev, items: Time[] }     (ausente = vazio, rev 0)
  notas.json                     { rev, items: Nota[] }     (ausente = vazio, rev 0) folhas do bloco de notas
  modelos.json                   { rev, items: Modelo[] }   (ausente = vazio, rev 0) modelos de tarefa
  paginas.json                   { rev, items: Pagina[] }   (ausente = vazio, rev 0) páginas de conhecimento
  jornada.json                   { rev, items: ItemDaJornada[] } (ausente = vazio, rev 0) rotina e ponto: um item por dia (id = data) e o item "config"
  assuntos.json                  { rev, items: AssuntoParaFalar[] } (ausente = vazio, rev 0) o que levar para a próxima conversa com cada pessoa
  markdown/paginas/<slug>--<id>.md  espelho legível de cada página, gerado (pode apagar)
  tarefas/<id>.json              uma Tarefa por arquivo, com a timeline inteira dentro
  arquivos/AAAA/<base36>-<nome>  documentos anexados (gravação com flag "wx": nunca sobrescreve). Também os vídeos, as transcrições e as capas das páginas de vídeo
  markdown/<slug>--<id>.md       espelho legível, gerado (pode apagar)
  _backups/AAAA-MM-DD/           backups diários
  _backups/manual-*/             backups manuais (botão em Configurações)
  _backups/pre-migracao-*/       antes de migração de formato
  _backups/pre-restauracao-*/    estado de antes de restaurar um backup pelo app (nunca é podado)
  _historico/paginas/<id>/       como cada página estava antes de ser editada (até 40 versões por página; não entra em backup)
  _lixeira/                      tudo que foi "excluído"
```

### Modelo (fonte da verdade: `lib/tipos.ts`)
- **Tarefa**: `id, rev, titulo, descricao, categoriaId|null, status, prioridade (1..10, maior = mais urgente), prazo (AAAA-MM-DD|null), tags[], registros[], panoramaIA?{texto, geradoEm}, criadaEm, atualizadaEm, concluidaEm?`, e opcionalmente `registrosRemovidos[]`. Desde a v2 (campos opcionais, sem migração): `lembrarEm?` (AAAA-MM-DD|null: follow-up, "me lembre de voltar nisso") e `focoEm?` (AAAA-MM-DD|null: dia em que foi escolhida como foco; só vale como foco se for hoje). Desde a 2.7: `fixada?` (boolean: presa na barra lateral; é dado, para valer em qualquer PC). Desde a 2.8: `esperando?` (`{ quem, oQue, desde (AAAA-MM-DD), cobradoEm? } | null`: de quem a tarefa espera retorno; só faz sentido em `aguardando` e é limpo por `aplicarStatus()` quando a tarefa sai desse status, virando observação do marco). Desde a 3.8: `dependeDe?` (ids das tarefas que precisam terminar antes desta; `normalizarDependencias()` aceita só ids válidos, sem repetir, sem a própria tarefa, até 50).
- **Status**: `a_fazer | em_andamento | aguardando | bloqueada | concluida | cancelada`. "Abertos" = os quatro primeiros (`STATUS_ABERTOS`).
- **Registro** (cada card da timeline): `id, tipo, data, hora?, titulo, participantes[], anotacoes (brutas), resumoIA, decisoes, proximosPassos: Passo[], impedimentos, respostaIABruta?, notaId? (folha do bloco de notas de onde nasceu), referencia? (conhecimento que vale para o assunto todo), duracaoMin? (minutos de uma sessão de foco; 0 = não veio de uma sessão), alteracoes?{status?, prioridade?, prazo?: {de, para}}, criadoEm, atualizadoEm`.
- **TipoRegistro**: `reuniao | atividade | impedimento | decisao | nota | marco`. `marco` é gerado pelo sistema (tarefa criada, mudança de status; o marco de status `concluida` é o card verde "Concluída" do esboço).
- **Passo**: `id, texto, feito, feitoEm?, responsavel?, prazo?`. As "pendências" do app são todos os passos com `feito=false` de tarefas abertas.
- **Categoria**: `id, nome, descricao, cor, arquivada?, criadaEm, atualizadaEm`.
- **LinkDoc**: `id, tipo ("link"|"arquivo"), titulo, url?, arquivo? (caminho relativo em arquivos/), nomeArquivo?, tamanho?, descricao, tags[], tarefaId?, categoriaId?, criadoEm`.
- **Pessoa**: `id ("pe..."), nome, apelidos[], email, cargo, area, ajudaCom, anotacoes, categoriaIds[], tags[], arquivada?, origem? ("manual"|"registros"|"outlook"), criadaEm, atualizadaEm`. Registros e passos continuam guardando nomes como texto; a ligação com o cadastro é feita na leitura (`lib/pessoas.ts`, `chaveNome` contra `nome` e `apelidos`). Nada é reescrito nas tarefas.
- **Time**: `id ("ti..."), nome, descricao, cor, responsavelIds[], membroIds[] (inclui os responsáveis), categoriaIds[], arquivado?, criadoEm, atualizadoEm`. Os vínculos com pessoas ficam no Time.
- **Nota** (folha do bloco de notas): `id ("n..."), titulo, texto, arquivadaEm? (carimbo|null), gerou?: FrutoDaNota[], sobras? (o que a IA não encaixou e o usuário não guardou), criadaEm, atualizadaEm`. `FrutoDaNota` = `{ tipo ("registro"|"tarefa"|"passo"), tarefaId, registroId?, rotulo }`: o que nasceu da folha quando ela foi organizada. Coleção nova e opcional, sem migração.
- **Modelo** (modelo de tarefa): `id ("mo..."), nome, quando (quando usar), titulo (sugerido), descricao, categoriaId|null, prioridade, tags[], passos[] (textos), prazoEmDias? (a partir da criação), usos?, criadoEm, atualizadoEm`. Coleção nova e opcional, sem migração. Desde a 3.8: `repetir?` (`RepeticaoDoModelo | null`: `{ tipo: "semana" | "mes" | "dias", diaDaSemana? (0-6), diaDoMes? (1-31), cadaDias? (1-365), desde, ultima? }`; `normalizarRepeticao()` devolve null para qualquer forma torta).
- **AssuntoParaFalar** (3.8, `assuntos.json`): `id ("as..."), pessoa (nome como texto), texto, tarefaId?, resolvidoEm? (carimbo|null), registroId? (a reunião em que foi tratado), criadoEm, atualizadoEm`. Como nos registros, o nome é texto e a ligação com o cadastro é feita na leitura (`lib/assuntos.ts`, por nome e apelidos). Coleção nova e opcional, sem migração.
- **Pagina** (página de conhecimento, 2.11): `id ("pg..."), titulo, texto (Markdown), categoriaId|null, tags[], arquivadaEm?, criadaEm, atualizadaEm`. Coleção nova e opcional, sem migração. Desde a 3.1 (campos opcionais, sem migração): `paiId?` (página mãe: as páginas formam uma árvore; mãe que não existe ou ciclo = raiz), `ordem?` (posição entre as irmãs), `icone?` (chave de `ICONES_DE_PAGINA`, lista fechada), `estado?` (`rascunho | revisao | publicada`, as colunas do quadro) e `fixada?` (favorita). Desde a 3.3: `tipo?` (`"doc"` ou `"video"`) e `video?` (`VideoDaPagina`: `arquivo?` em `arquivos/`, ou `caminho?` de um arquivo deste computador que não é copiado, ou `url?` de fora; `duracao?`, `transcricao?` e `capa?` em `arquivos/`, `capitulos?: { t, titulo }[]`). `normalizarVideo()` confere tudo: caminho de anexo no formato `AAAA/nome` sem `..`, link só `http(s)`, capítulos com tempo válido.
- **Jornada** (rotina do dia e ponto, 3.5; coleção nova e opcional `jornada.json`, sem migração). Os itens são de dois tipos, separados pelo id:
  - **DiaDaJornada** (`id` = a data `AAAA-MM-DD`, `tipo: "dia"`): `data, planejado (false = o plano ainda é o dia padrão daquele dia da semana), blocos: BlocoDaJornada[], ponto: { entrada, saida, pausas: { inicio, fim|null }[] } (horas "HH:MM"), folga, jornadaMin|null e pausaMin|null (o esperado no dia, fixado quando a entrada é registrada), obs, criadoEm, atualizadoEm`.
  - **ConfigDaJornada** (`id: "config"`, `tipo: "config"`): `jornadaMin (480), pausaMin (60), diasDeTrabalho (0 = domingo ... 6 = sábado; padrão 1 a 5), descontarPausa (true), saldoInicialMin, padrao: { "0".."6": BlocoDaJornada[] } (o dia padrão de cada dia da semana), atualizadoEm`.
  - **BlocoDaJornada**: `id ("bl..."), inicio, fim ("HH:MM", fim depois do início, no mesmo dia), titulo, tipo ("tarefa" | "atividade" | "pausa"), tarefaId? (só em bloco de tarefa), nota?, feito?`.
  - `lerJornada(dados.jornada)` (`lib/jornada.ts`) separa a configuração dos dias. **A hora de saída, a hora extra e os saldos não são gravados**: são conta (ver seção 6).
- **Link interno** (2.11): dentro de qualquer texto em Markdown, `[rótulo](nexo:tarefa/<id>)`, `nexo:pagina/<id>`, `nexo:categoria/<id>` ou `nexo:pessoa/<nome codificado>`. É só texto no campo: versão antiga do app mostra o link cru. A rota de destino é calculada por `linkInterno()` (`lib/texto-rico.ts`), nunca lida do texto.
- **Texto rico = Markdown no mesmo campo de texto** (2.9, sem migração): `nota.texto` e `registro.anotacoes` são editados no editor rico e guardam **Markdown**. Continua sendo uma string no JSON: versões antigas do app abrem e mostram o texto com a marcação à vista, sem perder nada. O texto antigo (puro) é Markdown válido; uma quebra de linha simples conta como quebra (`breaks: true`). O editor escreve `<` como `&lt;` e põe `\` antes de `* _ [ ] ~` soltos: por isso, **para mostrar um trecho como texto use `paraTextoPlano()`** (`lib/texto-rico.ts`), nunca o campo cru. Imagem colada vira arquivo em `arquivos/AAAA/` e no texto fica `![nome](arquivos/AAAA/arquivo.png)` (caminho relativo à pasta de dados; no espelho `.md` vira `../arquivos/...`). Os demais campos (`resumoIA`, `decisoes`, `impedimentos`, `descricao`) continuam sendo digitados como texto puro, mas são mostrados pelo mesmo leitor de Markdown.
- IDs: `novoId(prefixo)` = prefixo + base36(timestamp) + aleatório. Validados no servidor por `ID_VALIDO` (`/^[a-zA-Z0-9_-]{1,80}$/`).
- Datas de calendário são strings `AAAA-MM-DD` no fuso local (`hojeISO()`); carimbos são ISO UTC (`agoraISO()`).

### Preferências de interface (localStorage, não são dados)
Ficam no navegador com o prefixo `nexo:` (via `usePref` de `lib/preferencias.ts`) e podem ser perdidas sem prejuízo: `tema`, `lateralRecolhida`, `ordem`, `filtroStatus`, `visaoTarefas`, `recentesPrimeiro`, `agrupamentoPendencias`, `soMeus`, `rotina` (`{ ultimoPlanejamento, ultimaRevisao, abrirSozinho }`) e `lembretesAdiados` (`{ idDoLembrete: dataAtéQuando }`) e `meusNomes` (lista de nomes pelos quais o usuário aparece como responsável de um passo), `aparencia` (`{ acento, cantos, fonte, movimento, lateral, fundo }`, ver `lib/aparencia.ts`), `moldura` (largura da barra lateral, ordem e itens escondidos, seções, ferramentas da barra superior, barra de status e, desde a 3.9, `acompanharSeparado`: as cinco telas de acompanhar como itens soltos no menu, padrão `false`; ver `lib/moldura.ts`) e `recentes` (ids das últimas tarefas abertas), `novidadesVistas` (para qual versão o aviso "o que há de novo" já apareceu), `paginasArea` (jeito de trabalhar na tela de Páginas: visão (documentos, quadro, lista, vídeos ou mapa), abas abertas, o que está recolhido na árvore, painel, modo ler/editar), `player` (velocidade, volume, mudo e legenda do player) e `videoPosicoes` (onde cada vídeo parou, para retomar) e `sessao` (a sessão de foco em andamento: `{ tarefaId, inicio, alvoMin, fim?, nota? }`), `jogo` (`{ ligado, meta, celebrar }`) e `jogoVisto` (o que já foi comemorado: `{ conquistas[], nivel, meta, concluidas }`), `jornadaAvisos` (avisar quando um bloco da rotina começa ou está acabando) e `jornadaAvisados` (`{ data, chaves[] }`: os avisos da rotina que já apareceram hoje, para não repetir). Desde a 3.8: `visoesTarefas` (visões salvas da lista de tarefas, `normalizarVisoes()` em `components/tarefas/filtros.ts`), `fechamento` (`{ abrirAoSair }`), `notificacoes` (`{ ligado, rotina, lembretes }`, desligado por padrão, `lib/notificar.ts`) e `notificados` (`{ data, ids[] }`: lembretes críticos que já viraram aviso do Windows ou já foram vistos hoje). Desde a 3.9: `acompanharAba` (a última das cinco telas de acompanhar aberta, para o item "Acompanhar" do menu abrir nela; só vale um dos cinco endereços, senão Radar). Desde a 3.11: `tarefaMaisOpcoes` (se "Mais opções" do formulário de nova tarefa abre aberto; só o booleano `true` liga, qualquer outra coisa vale fechado; muda só quando o usuário abre ou fecha ao criar). Tudo o que é lido do localStorage passa por uma função `normalizar*()` com listas fechadas: valor desconhecido vira o padrão. O `usePref` já nasce com o valor lido (não monta no padrão para depois "pular"), o que é seguro porque nada que depende de preferência é desenhado no servidor. Nada que o usuário não possa perder vai para o localStorage. As únicas coisas além de preferência que moram lá são os **rascunhos do editor de registro** (`nexo:rascunho:...`), o **texto pendente de uma folha do bloco de notas** (`nexo:nota-pendente:...`), o **texto ainda não guardado do "Anotar rápido"** (`nexo:anotarPendente`) **o que foi escrito sobre uma sessão de foco ainda não registrada** (dentro de `nexo:sessao`) , **a reunião em andamento no modo reunião** (`nexo:reuniao:<tarefaId>`) e **a pergunta com a resposta colada na tela Perguntar** (`nexo:pergunta`), ver seção 4: são cópia de segurança do que ainda não foi salvo, não dado. O registro só existe de verdade quando é gravado na pasta de dados.

---

## 6. Funcionalidades (telas)

| Rota | O que faz |
|---|---|
| `/` Hoje | Página inicial. Saudação, captura rápida de tarefa, **precisa de você** (uma linha por tarefa, com os motivos dentro e adiar; vem primeiro quando há algo pedindo atenção), **foco de hoje** (tarefas escolhidas, com os passos marcáveis ali), faixa da semana (prazos dos próximos 7 dias), aguardando retorno, bloqueadas e paradas, progresso do dia. Desde a 3.6 não tem a fileira de cartões de contagem nem um segundo botão de "Nova tarefa": os números já estão no menu e na barra de status. Desde a 3.12 a saudação é o título em destaque (22px) e, em "Precisa de você", os motivos de cada tarefa são selos numa linha, com o passo que dá para concluir logo abaixo (ver "Piloto visual da tela Hoje"). |
| `/tarefas` | Lista de tarefas com números, filtros (texto, categoria, status), ordenação e três visões: **grade**, **lista** e **quadro** (Kanban por status, arrastar muda o status). Na grade e na lista: **seleção** (caixa de marcar, Ctrl/Shift + clique, `X`, `Ctrl A`) com a **barra de ações em lote** (status, prioridade, categoria, prazo, lembrete, foco, lixeira, um só desfazer), **visões salvas** (botão "Visões" e paleta) e teclado (`J`/`K` ou setas andam, `Enter` abre, `F` foco de hoje, `M`/`S` abre o menu). Aceita `?status=`, `?cat=`, `?f=atrasadas`, `?f=foco` e `?v=<visão salva>`. |
| `/tarefas/[id]` | Cabeçalho com o título (quebra em até duas linhas), Focar hoje, Modo reunião, **Copilot** (menu com Panorama da tarefa e Preparar próxima reunião), Editar e o menu da tarefa. Embaixo, numa linha só, as propriedades editáveis no lugar (categoria, status, prioridade, prazo, lembrete de voltar, tags). **Linha do tempo** com uma barra presa no topo (título, filtros, ordem crescente ou decrescente lembrada, botões de registrar), **faixa "Esperando"** no cabeçalho quando a tarefa aguarda terceiros (de quem, o quê, há quantos dias, copiar cobrança, cobrei hoje), lateral com Pendências, Links e docs, Pessoas envolvidas, último Panorama IA e o resumo (dias, reuniões, última atividade, tempo em sessões de foco, data de criação). Detalhes na seção "Página da tarefa (3.7)". |
| `/tarefas/[id]/reuniao` | **Modo reunião** (3.8: botão **Transcrição** para colar a do Teams e trazer o que o Copilot organizou; pauta com **"Para falar com"** de cada participante): pauta à esquerda (pendências da tarefa para marcar como resolvidas, aguardando retorno, o que está com cada participante em outras frentes, últimas decisões, onde a conversa parou), anotações no editor rico ao centro e captura à direita (decisões, próximos passos com responsável e prazo, impedimentos). Relógio, "Copiar pauta", "Encerrar e salvar" e a **ata** em texto para copiar. |
| `/rotina` | **Rotina** (3.5): o dia em **blocos de horário** numa linha do tempo (tarefa, atividade como "Chamados", pausa como almoço e jantar), com a linha de agora, o fim do expediente e a faixa de **hora extra**. À direita: a **jornada do dia** (entrada, pausas, saída, "você sai às"), o resumo do plano e a semana com os saldos. Visão **Banco de horas**: o mês dia a dia, saldo da semana, do mês e acumulado, e "Copiar o mês". Botões **Dia padrão** (blocos que se repetem em cada dia da semana) e **Jornada** (horas por dia, pausa, dias de trabalho, avisos). `?d=<data>` abre um dia; `?v=banco` abre no banco de horas. |
| `/pendencias` | Todos os próximos passos em aberto, agrupados por tarefa, por prazo ou por pessoa, com "só os meus", prazo próprio de cada passo e desfazer ao concluir. |
| `/notas` | **Bloco de notas**: folhas de texto livre, escritas sem escolher tarefa nem campo (abas Abertas e Arquivadas), no **editor de texto rico** (blocos pelo menu `/`, listas de tarefas, tabelas, imagens coladas). "Organizar com o Copilot" copia um prompt com a folha e as tarefas abertas, recebe um **JSON** de volta e mostra uma **prévia** (registro em tarefa existente ou numa tarefa nova da própria folha, tarefa nova, passo antigo concluído, e as sobras como nota para guardar onde o usuário quiser). Na prévia dá para trocar a tarefa de destino, criar uma tarefa nova digitando o nome e ajustar a data do que aconteceu. Só grava o que o usuário confirmar, e a folha é arquivada com a lista do que criou. `/notas?n=<id>` abre uma folha específica. |
| `/paginas` | **Documentação** (3.1): páginas dentro de páginas. À esquerda o **explorador** (árvore com arrastar para reordenar e mudar a página mãe, favoritas, arquivadas, busca que mostra a seção de cada trecho); no centro as páginas abertas em **abas**, com caminho, ícone, título, estado, categoria e tags, o texto no editor rico ou em **modo leitura**, as páginas de dentro e anterior/próxima; à direita o **sumário** (acompanha a rolagem) e quem aponta para cá. Visões **Quadro** (colunas por estado, arrastar muda), **Lista** (tabela com filtro e ordenação), **Vídeos** (galeria das páginas de vídeo) e **Mapa** (quem cita quem, 3.4). Cada página tem o **histórico de versões** (botão do relógio no topo). Página nova em branco ou de um **modelo**. No texto, `@` cita tarefa, pessoa ou página e `[[` liga a uma página (e cria, se não existe). `/paginas?p=<id>` abre uma página; `?cat=<id>` começa uma página nova naquele assunto. |
| `/perguntar` | **Perguntar ao Nexo**: o usuário escreve uma pergunta, o app acha os trechos do histórico que têm a ver (registros, tarefas, páginas, folhas, links, pessoas), numera como F1, F2... e monta o prompt para o Copilot responder só com eles. A resposta colada volta com as citações clicáveis e pode virar página de conhecimento. `?q=` começa com a pergunta escrita. |
| `/categorias` e `/categorias/[id]` | Cards de categoria com contagens e progresso; a página da categoria mostra a **referência do assunto** (registros marcados como referência em qualquer tarefa dela), tarefas abertas, histórico (concluídas/canceladas), links, pessoas do assunto e o prompt de panorama. Arquivar/desarquivar. |
| `/pessoas` | (3.8: o detalhe da pessoa tem **"Para falar com"**, os assuntos a levar na próxima conversa.) Abas **Pessoas** (cadastradas e nomes sem cadastro, com cargo, times e "pode ajudar com") e **Times** (`?aba=times`, cartões com cor e membros). `?p=Nome` é o detalhe da pessoa (o que pode ajudar, times, passos com ela, tarefas em comum, histórico); `?time=<id>` é o detalhe do time (responsáveis, membros, passos, categorias, tarefas). Botão **Importar do Outlook** (colar, CSV ou vCard, sem API). |
| `/links` | Banco de links e arquivos com busca, filtro por tipo e tag, vínculo a tarefa/categoria. Upload salva cópia em `arquivos/`. |
| Acompanhar (3.9) | Não é rota: é o item do menu que junta `/radar`, `/diario`, `/revisao`, `/relatorios` e `/conquistas`. As cinco continuam com o mesmo endereço e atalho; no topo de cada uma aparece a faixa de abas em comum (`AbasAcompanhar`, `components/shell/Acompanhar.tsx`, montada pelo Shell). Ver "Moldura". |
| `/revisao` | **Revisão semanal** guiada: passa por todas as tarefas abertas, das mais esquecidas para as mais recentes, com decisões rápidas (status, prioridade, prazo, follow-up, foco). |
| `/radar` | **Radar** (na tela, desde a 3.6, fala "categoria"; no código continua "frente"): uma frente por categoria (mais "Sem categoria"), com a saúde (em risco, parada, pede atenção, em dia), os motivos, números, movimento das últimas 8 semanas e próximo prazo. Os contadores do topo filtram. Linha de prazos das próximas 6 semanas por frente (tarefas, passos e follow-ups; vencidos à parte). "Copiar status" gera o texto para o gestor, sem IA. É só leitura (`lib/radar.ts`). |
| `/diario` | **Diário**: tudo o que aconteceu em todas as tarefas, dia a dia (registros, marcos e passos concluídos no dia em que foram feitos), com um **mapa de atividade** das últimas 36 semanas (clicar num dia mostra só ele), números dos últimos 30 dias, sequência de dias úteis e filtros por tipo, categoria e pessoa. "Copiar" gera texto simples do dia ou do que está na tela, sem IA. É só leitura (`lib/diario.ts`). |
| `/relatorios` | Escolhe período (7/15/30 dias, mês, datas livres) e categoria, mostra o que entra e copia o prompt de relatório. |
| `/conquistas` | **Conquistas** (gamificação): nível e XP, gráfico de XP dos últimos 14 dias, meta do dia, sequência de dias úteis, recorde, e as conquistas por grupo com o progresso de cada uma. Tudo calculado dos dados (`lib/jogo.ts`), nada gravado. Pode ser desligada. |
| `/busca?q=` | Busca sem acento/maiúscula em tarefas, registros (todos os campos), links, pessoas e times. Com várias palavras, o resultado precisa ter **todas**, em qualquer ordem e em qualquer campo do mesmo item; o trecho mostra e destaca cada uma. O resultado de um registro abre a tarefa já rolada até ele (`/tarefas/<id>?r=<registroId>`). Cada seção desenha 40 resultados e "Mostrar mais" traz o resto (um termo comum casa com milhares de registros); "Perguntar ao Copilot" leva o termo para `/perguntar`. |
| `/configuracoes` | Pasta de dados (trocar/copiar caminho), estatísticas, versão do formato, backup manual, exportar tudo em JSON, **modelos de tarefa** (usar, editar, excluir), lixeira com restaurar, aparência (tema), rotina e lembretes, conquistas e meta do dia (ligar/desligar, meta, comemorar), "como você aparece nos passos" (seus nomes), atalhos. Desde a 3.0: **restaurar um backup** (cada backup da lista tem "Restaurar...", com prévia), **saúde dos dados** ("Verificar agora") e **o que há de novo**. |

### Moldura (components/Shell.tsx)
- **Barra lateral** (`components/shell/Lateral.tsx`), recolhível (`Ctrl B`): navegação com contadores, e as seções **Foco de hoje** (tarefas em foco com o próximo passo e um anel de progresso), **Fixadas** (`tarefa.fixada`, pelo menu da tarefa), **Recentes** (últimas tarefas abertas, no localStorage) e **Assuntos**. Cada seção recolhe com um clique no título. A largura se ajusta arrastando a borda direita (setas com a borda em foco, dois cliques voltam ao padrão, arrastar bem para dentro recolhe). Desde a 3.12 a navegação esmaece no fim enquanto há mais para rolar (`esmaece-fim-y`), em vez de um item aparecer cortado pela ficha de nível, e a ficha mostra o nome do nível inteiro (o total de XP aparece quando a barra é alargada e está sempre na dica). Os grupos da navegação são **Dia a dia** (Hoje, Tarefas, Rotina, Pendências, Notas), **Conhecimento** (Páginas, Perguntar, Categorias, Pessoas, Links e docs) e **Acompanhar**. O nome do grupo não é guardado em preferência, só a ordem dos itens, então reagrupar não mexe no que o usuário personalizou.
- **Acompanhar** (3.9, `components/shell/Acompanhar.tsx`, `gruposDoMenu()` em `components/shell/navegacao.ts`): por padrão, Radar, Diário, Revisão semanal, Relatórios e Conquistas viram **um item só** no menu ("Acompanhar", chave `/acompanhar` em `ordem`/`ocultos`; não existe rota com esse nome). O item leva à última aba usada (`nexo:acompanharAba`, padrão Radar), fica marcado em qualquer uma das cinco (`ehAcompanhar()`) e mostra o ponto de "revisão semanal atrasada" (`useRevisaoAtrasada()`). As cinco telas ganham no topo a faixa **AbasAcompanhar** (Radar, Diário, Revisão, Relatórios, Conquistas; com o ponto de atraso na Revisão; Conquistas some com a gamificação desligada, a não ser que seja a tela aberta), montada pelo Shell acima de `<main>`, e por isso nenhuma das cinco páginas mudou. Rotas, atalhos `G F/D/S/R/Q`, paleta e `nomeDaRota()` continuam usando `NAV`, que segue com os cinco itens. Em Personalizar > Lateral, "Mostrar as cinco telas separadas no menu" (`moldura.acompanharSeparado`) volta ao menu da 3.8; a ordem e os itens escondidos de antes continuam valendo, porque as chaves são as mesmas. Grupo com um item só e o mesmo nome dele ("Acompanhar") aparece sem título, só com o traço.
- **Ícones do menu** (3.9): cada item tem silhueta própria (Tarefas `SquareKanban`, Pendências `Footprints`, Notas `StickyNote`, Páginas `Library`, Diário `History`, Revisão `ClipboardCheck`, Relatórios `ChartColumn`, Acompanhar `Telescope`), porque com a barra recolhida só o ícone diz qual tela é. Ao acrescentar item, não repita a "folha com linhas". Recolhida, todo item tem `Dica` com o nome (e o motivo do ponto, se houver).
- **Barra superior** (`components/shell/BarraSuperior.tsx`): voltar/avançar, migalhas e as **ferramentas**: **Rotina** (`components/jornada/Ferramenta.tsx`: o bloco de agora e quanto falta, ou a hora de sair; ao abrir, o próximo bloco e os botões do ponto) e as de `components/shell/Ferramentas.tsx`: **Agenda** (só o dia, com o ponto vermelho quando há algo em atraso; ao abrir, a hora e os prazos, passos com data e lembretes de voltar das próximas duas semanas), **Foco** (passos do foco marcáveis sem trocar de tela), **Anotar rápido** (tarefa ou folha do bloco de notas de qualquer tela, atalho `A`; o texto digitado fica guardado no navegador até virar tarefa ou folha), busca, sino e o menu **Mais** (`MenuMais`, botão "...", `data-slot="menu-mais"`: tema claro/escuro/sistema, cor de destaque e cantos pelo Personalizar, tela cheia, atalhos de teclado e "Personalizar as barras..."). Desde a 3.9 aparência, tela cheia e atalhos não são mais botões soltos: são de uso raro e cada um tem outro caminho (Personalizar, `F11`, `?`, paleta). Tela cheia e atalhos escondidos em Personalizar > Superior somem também de dentro do menu; o sino e o "Mais" ficam sempre. Botão direito na barra abre "escolher o que aparece". Desde a 3.12 as ferramentas não têm moldura nem fundo em repouso (a borda é transparente, para nada mudar de tamanho): o fundo aparece no hover, no foco e com o balão aberto. A ficha da sessão de foco em andamento continua com cor, porque é estado.
- **Barra de status**: pasta de dados, "Salvando..."/"Salvo às HH:MM", contagens, versão. Pode ser escondida; sem ela, o "Salvando..." aparece na barra superior só enquanto grava.
- **Personalizar** (`components/shell/Personalizar.tsx`, aberto pelo botão do rodapé da barra lateral, pela barra superior, pela paleta e por Configurações): painel que desliza pela direita **sem escurecer o app** (em tela larga o app encolhe para ele caber ao lado), para ver cada mudança na hora. Abas: **Aparência** (tema, cor de destaque, cantos, letra, estilo da barra lateral, fundo das telas, movimento), **Lateral** (ordem e visibilidade dos itens de navegação e das seções, títulos de grupo, contadores, largura) e **Superior** (quais ferramentas aparecem, barra de status). Tudo é preferência do navegador (`lib/aparencia.ts` e `lib/moldura.ts`), nada toca os dados. Item de navegação escondido continua na paleta e nos atalhos `G`.
- **Paleta de comandos** (`Ctrl K` ou `/`): vai para qualquer tela, tarefa, categoria ou pessoa e dispara ações.
- **Sino**: lembretes ativos a um clique, com adiar.
- **Onboarding**: na primeira vez pede o caminho da pasta de dados (sugere `%OneDriveCommercial%\Nexo` ou `%OneDrive%\Nexo`).
- **Atalhos** (lista oficial em `components/shell/navegacao.ts`, mostrada com `?`): `N` nova tarefa, `D` planejar o dia, `Shift D` fechar o dia, `Ctrl Z` desfazer (fora de campos de texto), `A` anotar rápido, `G` depois `H/T/P/N/C/E/L/D/S/R/Q` para navegar (`G O` = Rotina, `G N` = Notas, `G D` = Diário, `G Q` = Conquistas, `G A` = Páginas, `G U` = Perguntar, `G F` = Radar; os cinco de acompanhar valem com o menu juntando ou não), `Ctrl Enter` salva formulários, `Esc` fecha.
- Abre como aplicativo: `Iniciar Nexo.cmd` usa o modo `--app` do Edge (janela própria) e há `app/manifest.ts` para instalar pelo navegador.

### Rotina e lembretes (o app lembra o usuário do que fazer)
- **Motor de lembretes** (`lib/lembretes.ts`, função pura sobre os dados): prazo vencido, prazo hoje, prazo chegando (3 dias), passo com prazo vencido ou para hoje, follow-up (`lembrarEm`) chegou, bloqueada sem novidade (3 dias), aguardando retorno (5 dias), parada (7 dias), passos antigos (14 dias) e em andamento sem próximo passo. Os limites estão em `LIMITES`.
- Lembretes aparecem no sino, na tela Hoje e nos contadores da barra lateral. **Adiar** esconde um lembrete até uma data e fica só no localStorage.
- **A interface mostra e conta por tarefa** (3.6, `agruparLembretes()` em `lib/lembretes.ts`): o motor continua gerando um lembrete por motivo, mas o sino e "Precisa de você" mostram cada tarefa uma vez, com os motivos dentro, e o número do sino, da frase do dia e do contador do menu é o de **tarefas que pedem atenção** (`useLembretes().pedemAtencao`), sempre o mesmo nos três lugares. A gravidade do grupo é a do motivo mais grave; motivo "info" de uma tarefa que também tem algo grave aparece junto, não em "Para ficar de olho". Adiar um grupo adia todos os lembretes dele (os ids continuam sendo os de cada lembrete, então o que já estava adiado continua adiado). O ritual "Planejar o dia" já agrupava por tarefa por conta própria (`components/rotina/EtapaAtras.tsx`).
- **Motivos em selos (3.12, `components/hoje/PrecisaDeVoce.tsx`)**: cada lembrete do grupo é um `Badge` (`data-slot="motivo"`, com `data-tipo` e `data-gravidade`): crítico em `perigo`, atenção em `alerta`, informação em `secondary`. O `detalhe` do lembrete vai para a `Dica` do selo e para um texto só de leitor de tela; não é mais uma linha. A exceção é o lembrete de passo (`passoId`): o texto do passo aparece embaixo (`data-slot="passo-do-motivo"`) com o botão Concluir, porque é a única coisa que se resolve ali. O sino continua com a lista dele.
- **Planejar o dia** (`components/rotina/PlanejarDia.tsx`): ritual em 3 passos (o que ficou para trás, escolher os focos, pronto). Abre sozinho na primeira visita do dia (desligável) e pelo atalho `D`.
- **Foco de hoje**: `tarefa.focoEm = hoje`. Vale só no dia; no dia seguinte a tarefa deixa de ser foco sem precisar limpar nada.
- **Follow-up**: `tarefa.lembrarEm`. Definido no formulário, na página da tarefa ou pelo menu da tarefa ("Lembrar de voltar").
- **Revisão semanal**: a barra lateral sinaliza quando faz 7 dias ou mais desde a última.
- **"Meu" passo** (`passoEhMeu()` em `lib/lembretes.ts`): sem responsável, "Eu" ou um dos nomes da preferência `meusNomes` (Configurações). O Provider chama `definirMeusNomes()` durante o render e relê os dados quando a lista muda, para tudo se recalcular. Com o nome informado, `quemSouEu()` (em `lib/prompts.ts`) acrescenta aos prompts de registro e do bloco de notas a frase que diz ao Copilot quem é "eu".
- **Virada do dia com o app aberto** (`components/useHoje.ts`): o Nexo fica aberto como janela por dias. `useHoje()` devolve o dia atual e muda sozinho quando o dia vira (confere a cada 30 s e quando a janela volta a ter foco). Na virada, o Provider relê os dados do disco, os lembretes são recalculados e o ritual do dia é oferecido de novo. Conta que depende da data deve usar `useHoje()` nas dependências, não `hojeISO()` solto dentro de um `useMemo`.

### Novidades da 3.8 (dia a dia, UX e pontas do backlog)
- **Fechar o dia** (`components/rotina/FecharDia.tsx`, `lib/fechamento.ts`): o par do "Planejar o dia". Abre pelo "Encerrar o dia" da rotina (`useEncerrarDia()`, bate a saída e abre se a preferência `fechamento.abrirAoSair` deixar), por `Shift D`, pela paleta e pela tela Hoje. Mostra o que saiu no dia (mesmos eventos do Diário), os focos que ficaram (levar para o **próximo dia de trabalho**, que vem de `config.diasDeTrabalho` da jornada, ou soltar: `comFocoEm()` grava `focoEm` com a data futura, que só passa a valer como foco naquele dia), meus passos vencidos, impedimentos (bloqueadas e quem se espera) e a **daily** em texto fixo (`dailyDoFechamento()`). De manhã, "Copiar daily" na tela Hoje (`dailyDaManha()`: o último dia com atividade, até 14 dias para trás, e os focos e prazos de hoje). Sem IA, nada inventado.
- **Transcrição no modo reunião** (`components/reuniao/TranscricaoDaReuniao.tsx`): cola ou escolhe o arquivo (VTT, SRT, texto do Teams), lê com `lerTranscricao()` e parte em pedaços que cabem no Copilot (`partesDaTranscricao`). O prompt (`promptTranscricao()` em `lib/prompts.ts`) pede o **mesmo formato do registro**, então a resposta passa pelo `interpretarResposta()` de sempre; `comRespostaDaTranscricao()` (`lib/reuniao.ts`) soma decisões, passos, participantes e impedimentos sem apagar nada e marca na pauta os passos antigos resolvidos. O texto original vira anexo (`arquivos/`, como `.txt`) com o link nas anotações. Nada vai para a tarefa antes de "Encerrar e salvar".
- **Desfazer** (ver seção 4): status, prioridade, prazo, foco, fixar, lembrete, remover registro, mover registro, juntar tarefas, excluir tarefa, arquivar e excluir página, ações em lote e tratar assunto.
- **Seleção em lote e visões salvas** (`components/tarefas/Lote.tsx`, `Visoes.tsx`): ver a tabela de telas. Seleção não é guardada; o que um filtro esconde sai da seleção. A barra de lote grava tarefa por tarefa e oferece um desfazer que volta só as que ninguém mexeu depois.
- **Dependências** (`lib/dependencias.ts`, `components/tarefa/Dependencias.tsx`): painel "Depende de" na lateral da tarefa (com "Esta tarefa segura"), contador no cartão, lembrete **"destravou"** (todas as dependências fecharam: aparece por 7 dias, ou enquanto a tarefa segue bloqueada ou aguardando), motivo no Radar e vínculo órfão na verificação. `criaCiclo()` recusa ligar o que fecharia um ciclo.
- **Tarefas que se repetem** (`lib/recorrencia.ts`, campo "Repetir" do modelo): o app **só lembra** (lembrete tipo `recorrencia`, sem tarefa, com "Criar agora" e "Pular esta vez"), nunca cria sozinho. Várias ocorrências perdidas viram um lembrete só, da mais recente. Criar pelo modelo ou pular grava `repetir.ultima`. Dia 31 em mês curto vale o último dia.
- **Falar com alguém** (`lib/assuntos.ts`, `components/Assuntos.tsx`): `pedirAssunto()` abre a janela de qualquer lugar (menu da tarefa, paleta); o detalhe da pessoa tem o painel com marcar como tratado e anotar mais; o modo reunião mostra os assuntos de cada participante na pauta (`resolvidos` com o prefixo `as:`) e, ao encerrar, marca os tratados com o id do registro; a ata lista "Assuntos tratados".
- **Avisos do Windows** (`lib/notificar.ts`, `components/AvisosDoSistema.tsx`, painel em Configurações): API `Notification` do navegador, desligada por padrão e pedida só no clique. Só avisa com o Nexo em segundo plano. Rotina: os mesmos avisos de `AvisosDaJornada`. Lembretes: os críticos que surgem com a janela em segundo plano (os que estavam à vista contam como vistos), uma vez por dia. Clicar traz o app e abre uma rota interna (`nexo:ir`, só caminho que começa com uma barra).
- **Comparar versões** (`lib/diff.ts`, histórico da página): "Comparar com agora" mostra linhas que saíram e entraram e, nas linhas alteradas, as palavras que mudaram. Maior subsequência comum feita em casa, com começo e fim iguais aparados e um teto de tamanho (acima dele, o miolo aparece como "saiu tudo, entrou tudo").
- **Imprimir ou salvar em PDF** (`components/Impressao.tsx`): menu da tarefa e da categoria. A folha é desenhada direto no `<body>` só durante a impressão e o CSS `@media print` de `app/globals.css` esconde o resto. No tema escuro, a folha sai clara e o tema volta depois. "Copiar em Markdown" usa o mesmo texto do espelho `.md`.
- **Transcrição na busca e em Perguntar** (`GET /api/transcricoes`, `components/useTranscricoes.ts`): as transcrições continuam fora de `/api/dados`; a busca e o Perguntar pedem esta rota quando abrem. Na busca, cada trecho de fala com todas as palavras é um resultado "Nos vídeos", que leva ao instante (`/paginas?p=<id>&t=<s>`). No Perguntar, a transcrição entra em trechos como fonte `video` (`video:<paginaId>:<segundos>`), citável como as outras.

### Rotina: blocos do dia, ponto e banco de horas (3.5)
- **Nomes**: na tela é **Rotina** (`/rotina`); no código é **jornada** (`lib/jornada.ts`, `components/jornada/`, `jornada.json`, `/api/jornada`), porque `rotina` já era o ritual "Planejar o dia" (`components/rotina/`, preferência `nexo:rotina`, `useRotina()`). Não misture os dois.
- **Tudo é conta** (`lib/jornada.ts`, funções puras): gravado é só o que o usuário informou (o plano e o ponto). As regras, que valem para a tela, a barra superior, os avisos e o banco de horas:
  - **saída prevista** = entrada + jornada do dia + pausa. A pausa é a planejada (config) enquanto nenhuma foi registrada; depois, as pausas de verdade (pausa em andamento conta pelo que falta da planejada, ou pelo que já durou). Padrão: 8h + 1h = 9h da entrada à saída;
  - **trabalhado** = (saída ou agora) − entrada − pausas. Sem pausa registrada num dia de mais de 6h, a pausa planejada é descontada (`config.descontarPausa`, dá para desligar);
  - **saldo do dia** = trabalhado − jornada do dia. **Só entra no banco de horas o dia com entrada e saída.** Dia sem registro não conta (quem não usou o app num dia não fica devendo 8h); dia com entrada e sem saída fica como "sem saída", fora do saldo, com aviso para corrigir;
  - **folga, feriado e dia fora dos dias de trabalho**: nada é esperado, tudo o que for trabalhado é extra;
  - a **jornada do dia é fixada na entrada** (`dia.jornadaMin`, `dia.pausaMin`, em `comEntrada()`): mudar a configuração depois não mexe no saldo dos dias antigos.
- **Plano do dia**: `blocosDoDia()` devolve o plano do próprio dia (`planejado: true`) ou o **dia padrão** daquele dia da semana (`config.padrao`). Ver um dia que segue o padrão não grava nada; a primeira mudança copia o padrão para o dia (`comPlanoProprio()`), e daí em diante mexer no padrão não muda aquele dia. Plano vazio de propósito continua vazio (o padrão não volta sozinho); "Voltar ao dia padrão" está no menu do dia.
- **Hora extra planejada** (`resumoDoPlano()`): o usuário pode planejar além do expediente e a tela deixa isso claro de três jeitos: o número "Hora extra" (trabalho planejado além da jornada do dia), a linha **Fim do expediente** com a faixa hachurada depois dela, e o selo "extra" nos blocos que passam dessa linha. Com entrada registrada, o fim do expediente é a saída prevista do ponto; sem ela, é o começo do plano + jornada + pausa. Em dia sem expediente, tudo é extra.
- **Linha do tempo** (`components/jornada/LinhaDoDia.tsx`): clicar num horário vazio abre o formulário já com aquela hora; clicar num bloco edita; arrastar muda o horário e a alça de baixo muda a duração (de 5 em 5 minutos, grava só ao soltar); blocos sobrepostos ficam lado a lado (`emColunas()`). O trilho verde à esquerda é o ponto de verdade, com as pausas vazadas. Bloco de tarefa abre a tarefa e começa uma sessão de foco.
- **Ponto** (`usePonto(data)` em `components/jornada/pecas.tsx`): "Entrei agora" (ou digitar a hora), "Sair para a pausa"/"Voltei", "Encerrar o dia", "Reabrir". "Ajustar" (`AjustarPonto`) corrige horários, registra um dia que passou, marca folga e muda a jornada só daquele dia. As ações recusam o que não faz sentido (saída antes da entrada, duas pausas abertas) devolvendo o dia como estava.
- **O app acompanha o dia**: a ficha da barra superior e o cartão da tela Hoje mostram o bloco de agora, quanto falta e o próximo (`blocoNoInstante()`), e `AvisosDaJornada` (montado no Shell) solta um aviso quando um bloco começa, 5 minutos antes de acabar, quando a jornada do dia se completa e quando a pausa planejada termina (`avisosDoMinuto()`). Cada aviso aparece uma vez por dia e só vale por 3 minutos depois do instante dele (abrir o app ao meio-dia não despeja os avisos da manhã). É aviso dentro do app, não notificação do Windows. `useMinuto()` dá o minuto do dia e anda sozinho.
- **Banco de horas** (`bancoDeHoras()`, `linhaDoDia()`, `textoDoBanco()`): semana de segunda a domingo, mês de calendário e acumulado (tudo o que foi registrado mais `config.saldoInicialMin`). "Copiar o mês" é texto fixo, sem IA.
- **`CampoHora`** (`components/jornada/pecas.tsx`): campo de hora digitável ("8", "815", "8:15", "08h15"). Use quando o minuto exato importa (o `SeletorHora` anda de 5 em 5). Ele avisa a mudança ao sair do campo; formulário com `Ctrl Enter` tem que tirar o foco antes de salvar (ver `BlocoForm`).
- **Limites conhecidos**: o expediente cabe num dia de calendário (turno que atravessa a meia-noite não é atendido); não há feriados automáticos (marque folga no dia); um bloco cumprido não vira registro na tarefa sozinho (a sessão de foco faz isso).
- **Se mudar uma regra da conta, mude `lib/jornada.ts` e `testes/jornada.test.mjs` juntos**, e confira a etapa da rotina no e2e, que anda com o relógio do navegador na mão (`clock.setFixedTime`).

### Mapa das páginas e histórico de versões (3.4)
- **Mapa** (`lib/grafo.ts`, `components/paginas/MapaDePaginas.tsx`, visão "Mapa" de `/paginas`): cada página ativa é um ponto; as ligações vêm dos links internos do texto (`alvosDoTexto()` de `lib/ligacoes.ts`) e, se ligado, da árvore (página dentro de página). Tarefas e pessoas citadas entram só quando pedidas. `montarGrafo(dados, { tarefas, pessoas, arvore })` é função pura; **nada é gravado**, nem as posições.
- **Disposição determinística** (`disporGrafo()`): os pontos partem de uma espiral na ordem dos ids e passam por um número fixo de passos em que os ligados se aproximam e todos se afastam (método de Fruchterman e Reingold); no fim o desenho é encaixado na área com margem. Os mesmos dados dão sempre o mesmo desenho, sem `Math.random`. O custo é quadrático no número de pontos: serve bem para centenas de páginas; se a documentação passar muito disso, o caminho é limitar os passos ou desenhar por grupos.
- **Na tela**: arrastar o fundo move, a roda do mouse aproxima, passar o ponteiro num ponto destaca os vizinhos, clicar abre a página (ou a tarefa, ou a pessoa). A busca do mapa acende os pontos cujo nome casa. O resumo mostra quantos pontos, ligações e **páginas soltas** (que não citam, não são citadas e não estão em nenhuma árvore). A rota de cada ponto é calculada pelo app (`no.rota`), nunca lida do texto. Cada ponto tem um círculo transparente maior por cima, que é o alvo do clique.
- **Histórico** (`components/paginas/Historico.tsx`, `GET /api/paginas/historico?id=<id>[&v=<versão>]`): a janela lista as versões guardadas (quando, título, quantas palavras), mostra a escolhida pelo `TextoRico` e "Restaurar esta versão" devolve título e texto pelo mesmo `mudar()` da página, ou seja, pela gravação normal. As regras do que é guardado estão na seção 4.
- **Se mudar o que conta como ligação, mude `lib/ligacoes.ts`, `lib/grafo.ts` e `testes/grafo.test.mjs` juntos**: o painel "quem aponta para cá" e o mapa têm que concordar.

### Página de vídeo (3.3)
- **O que é**: uma página com `tipo: "video"`. O texto da página são as **anotações** sobre o vídeo; em volta delas ficam o player, a transcrição sincronizada e os capítulos. Nasce pelo modelo "Página de vídeo" e aparece na árvore como qualquer página (pode ter mãe e filhas) e na visão **Vídeos** (galeria com capa e duração).
- **De onde vem o vídeo** (`FonteDoVideo`): (1) **enviar o arquivo**, que é copiado para `arquivos/` em pedaços, com barra de progresso (`enviarMidia` do Provider, por `XMLHttpRequest`), até 4 GB; (2) **apontar para um arquivo deste computador** (`video.caminho`), que não é copiado e só toca neste computador; (3) **só guardar o link** de fora, que o app não toca (não há chamada externa), só abre em outra aba. Aceita MP4, WebM, MOV, MKV, MP3, M4A, WAV, OGG; o que o navegador toca de verdade é MP4 (H.264) e WebM.
- **Servidor** (`app/api/midia/route.ts`, `salvarMidia` e `abrirMidia` em `lib/armazenamento.ts`): o envio grava com `wx` lendo o corpo aos poucos (envio interrompido ou grande demais não deixa arquivo pela metade); a reprodução responde a `Range` (206, `Content-Range`), que é o que deixa pular para qualquer ponto. **O vídeo local toca pelo id da página** (`?pagina=<id>`): o caminho vem do que está gravado na página, nunca do pedido, e só arquivo com extensão de vídeo ou áudio é servido.
- **Player** (`components/paginas/video/Player.tsx`): controles próprios (tocar, ±10 s, barra com o que já carregou, marcas de capítulo e dica com o tempo e a fala daquele ponto, velocidade de 0,5x a 2x, volume, legenda vinda da transcrição, janela flutuante, tela cheia), retoma de onde parou e tira um quadro para a capa. Atalhos: em qualquer lugar da página, `Espaço`/`K` e as setas; com o player em foco, `J L M C F < >` e `0-9` (as letras são atalhos do resto do app fora dele). Dentro da tela cheia não há menus do Radix (eles são desenhados fora do elemento em tela cheia): por isso a velocidade é um botão que avança a cada clique.
- **Transcrição** (`lib/transcricao.ts`, `Transcricao.tsx`): arquivo em `arquivos/` (enviado ou colado), lido no navegador por `lerTranscricao()`: WebVTT (com `<v Nome>`), SRT e texto com o tempo no começo de cada fala (inclusive o jeito do Teams: nome, tempo, texto embaixo). Sem tempo nenhum, vira parágrafos para ler e buscar. O painel acompanha o vídeo (`falaNoInstante`, busca binária), junta falas da mesma pessoa em trechos (`emTrechos`), busca com "1 de N", copia ou cita um trecho nas anotações. A marcação dentro da legenda é lida ou descartada, **nunca interpretada**.
- **Instantes nas anotações**: "Anotar neste instante" põe `[12:34](nexo:tempo/754)`; na página de vídeo, tanto esse link quanto um `[12:34]` escrito à mão (ou vindo do resumo do Copilot) viram botões que levam o player até lá (`TextoRico` com `aoIrParaTempo`).
- **Capítulos** (`video.capitulos`): "Capítulo aqui" marca no instante atual; aparecem na barra do player e na aba Capítulos.
- **Resumir com o Copilot** (`promptDoVideo`, `partesDaTranscricao`): copia um prompt com a transcrição, pedindo os tempos entre colchetes. Transcrição longa sai em partes que cabem no Copilot do navegador, sem cortar uma fala no meio. A resposta é colada nas anotações pelo usuário.
- **Limites conhecidos**: a transcrição não vem em `/api/dados` (de propósito, para não pesar a leitura); desde a 3.8 a busca global e o Perguntar a pedem à parte (`/api/transcricoes`). Vídeo apontado por caminho não vai para o backup nem para outro computador.
- **Se mudar o formato de tempo ou o prompt, mude `lib/transcricao.ts`, `comTempos()` em `components/tarefa/Texto.tsx` e `testes/transcricao.test.mjs` juntos.**

### Componentes do documento (3.2)
Todo componente é **Markdown comum com uma marca**: o campo continua sendo texto, uma versão antiga do app mostra a citação ou o link cru, e o Copilot recebe algo que entende. Não há formato próprio nem nó novo no editor.
- **Destaque** (callout): citação que começa com `[!TIPO]`, no estilo do GitHub e do Obsidian. `> [!NOTA] Título` e o corpo embaixo. Tipos em `TIPOS_DE_DESTAQUE` (nota, dica, importante, atencao, perigo, sucesso, pergunta, exemplo, detalhes), com apelidos em inglês (`APELIDOS` em `lib/texto-rico.ts`). `-` ou `+` depois do colchete faz **abrir e fechar** (`[!PERGUNTA]- Dúvida?` começa fechado). Tipo desconhecido continua citação comum.
- **Índice**: parágrafo que é só `[TOC]` (ou `[ÍNDICE]`, `[SUMÁRIO]`), no primeiro nível do documento.
- **Código**: o bloco mostra a linguagem, o botão de copiar e cores. O realce é próprio (`lib/realce.ts`, sem biblioteca): comentário, texto, número, palavra reservada e chave, por regras simples por linguagem. O que entra é o que sai (testado), e código grande demais fica sem cor. No editor, com o cursor num bloco de código, a barra mostra a linguagem.
- **Anexo**: link `[nome](arquivos/AAAA/arquivo.pdf)` para um arquivo da pasta de dados (bloco "Arquivo" do menu `/`). Só vale se `anexoDoSrc()` aceitar o caminho.
- **Cartão vivo**: num documento (`TextoRico` com `cartoes`), um link interno sozinho numa linha vira um cartão com o estado de agora da tarefa, página, pessoa ou categoria.
- **Instante de vídeo**: `[12:34](nexo:tempo/754)`; onde há player por perto (`aoIrParaTempo`), leva até lá.
- **No leitor** (`lib/texto-rico.ts`, `components/tarefa/Texto.tsx`): blocos `destaque` e `indice`, inlines `anexo` e `tempo`. **No editor** (`components/editor/extensoes.ts`): a extensão `MarcasDeComponente` só põe decorações (a citação com `data-destaque`, a marca como etiqueta, o parágrafo `[TOC]`); o documento não muda. `linkDoEditor()` é a regra única de quais endereços um link pode ter.
- O menu `/` filtra por uma palavra só (espaço fecha o menu).

### Documentação: páginas em árvore, abas, leitura e quadro (3.1)
- **Lógica pura em `lib/paginas.ts`**: `montarArvore`, `emOrdemDeLeitura`, `caminhoDaPagina`, `descendentes`, `vizinhas`, `moverPagina`, `semPagina`, `sumarioDoMarkdown`/`sumarioDosBlocos`, `buscarNasPaginas`, `MODELOS_DE_PAGINA`, `paginaDoModelo`, `duplicarPagina`. **Árvore torta nunca some com página**: mãe que não existe, mãe arquivada, ciclo e "mãe de si mesma" viram raiz (`maes()`), e toda página aparece exatamente uma vez.
- **Excluir uma página sobe as filhas** para a avó (`semPagina`); **arquivar leva junto** o que está dentro; desarquivar traz só a página. Mover para dentro de si mesma ou de uma descendente devolve a lista intacta.
- **A página nasce na hora** (`useAcoesDePagina().criar`), em branco ou de um modelo, e abre numa aba. Antes ela só passava a existir ao ganhar texto; com árvore e subpáginas isso deixou de valer.
- **Área de trabalho** (`app/paginas/page.tsx`): `Explorador`, `Abas`, `EditorPagina` (a página aberta, com o sumário ao lado), `QuadroPaginas`, `ListaPaginas`, peças e ações em `components/paginas/pecas.tsx` (`useAcoesDePagina`, `MenuContextoPagina`, `BotaoMenuPagina`, `IconePagina`, `SeletorDeIcone`, `SeloEstado`). Toda página mostrada na tela tem o menu de ações (botão direito ou "...").
- **Sumário**: sai da mesma árvore que o leitor desenha (`sumarioDosBlocos`), só com os títulos de primeiro nível do documento. A tela acha cada título pela posição: `[data-titulo]` no leitor e `.ProseMirror > h1,h2,h3` no editor. `TextoRico` ganhou a prop `ancoras` (põe `id` e `data-titulo` nos títulos).
- **Editor**: variante `"documento"` (sem rolagem própria, a barra gruda no topo de quem rola), prop `paginaAtualId`, `[[` (extensão `menuLigar`, com o item "Criar página") e o bloco "Subpágina". **Só abrir um texto não conta como mudança**: o editor reescreve o Markdown do jeito dele (escapa `[`, alinha tabela), então `EditorRico` guarda o texto original e o que o editor escreveria (`base`), e enquanto o conteúdo for esse nada é avisado para fora. Antes, abrir uma página já a regravava.
- **Atalhos na tela de Páginas**: `Ctrl P` ou `Ctrl Shift F` leva à busca do explorador; `Alt ←`/`Alt →` troca de aba; duplo clique numa aba fecha as outras; botão do meio fecha a aba.
- Arrastar usa `@dnd-kit/core`. O clique que nasce de soltar um item é cancelado só por um instante **e só dentro do próprio explorador ou quadro** (`closest("[data-slot=...]")`): cancelar na janela inteira engolia o clique seguinte em outro lugar da tela (apareceu como falha intermitente no e2e).

### Página da tarefa (3.7)
- **A linha do tempo começa cedo.** Em 1366x768, com o cenário de `testes/semear.mjs` (tarefa `tdemo1`), o primeiro registro começa em y=286 (era 445). Para isso: a faixa fixa do Copilot saiu do corpo e virou o botão **Copilot** do cabeçalho (`data-slot="copilot-tarefa"`, menu com os dois prompts); título "Linha do tempo", contador, filtros, ordem (só ícone, com dica e `aria-label`) e os botões de registrar ficam numa linha só, a barra presa (`data-slot="timeline-barra"`); "Criada em" saiu da faixa de propriedades e foi para o resumo da lateral (`data-slot="prop-criada"`), para a faixa caber numa linha em 1366px.
- **A barra da linha do tempo se ajusta à coluna, não à janela** (`@container/linha` em `tarefa-principal`): abaixo de 47rem o Impedimento fica só com o ícone, abaixo de 44rem a Atividade também (os dois com `aria-label` e `Dica`). Reunião sempre tem o rótulo.
- **Cabeçalho**: `Pagina` ganhou `quebrarTitulo` (título em até duas linhas, `line-clamp-2`, em vez de reticências numa) e o cabeçalho de toda `Pagina` é um contêiner (`@container/cabecalho`). Na tarefa, abaixo de `@5xl/cabecalho` (1024px) os botões viram só ícone (quadrados, com `aria-label` e `Dica`); o título nunca é cortado antes deles. A dica com o título inteiro aparece só quando ele não coube nas duas linhas.
- **Propriedades com cara de editável** (`components/tarefa/Propriedades.tsx`): todo valor editável usa a mesma classe (`EDITAVEL`) e a mesma pista estável, uma setinha discreta no fim (`data-slot="seta-editavel"`); fundo no hover, no foco por teclado e enquanto o seletor está aberto. `SeletorStatus` e `SeletorData` ganharam a prop `seta`. **Categoria e tags passaram a mudar no lugar**: a categoria abre uma lista com busca (sem criar categoria nova; isso continua no formulário) e o link "Abrir a página da categoria"; as tags abrem o `CampoChips` num balão, e cada mudança grava na hora. Mudar a categoria é uma gravação comum de tarefa (`atualizarTarefa`), sem campo novo.
- **Ações do registro sem mouse** (`AcoesRegistro` em `components/tarefa/Timeline.tsx`): o botão "..." (`data-slot="registro-menu"`) fica sempre à vista nos cards e leva a todas as ações (editar, referência, mover, remover). O lápis de editar aparece no hover e também quando o foco do teclado entra no card. Nos marcos de uma linha o "..." também só aparece no hover ou no foco, para a linha do tempo não encher de botões. Mover, referência e remover deixaram de ser ícones soltos no hover: estão no menu.
- **Migalhas** (`components/shell/BarraSuperior.tsx`): a navegação é um contêiner (`@container/migalhas`, ocupa o espaço que sobra até as ferramentas). Na tarefa, a migalha da própria tarefa é a primeira a sumir (abaixo de 20rem; o título já está no cabeçalho) e a da categoria some por inteiro abaixo de 11rem, com no mínimo 4,5rem quando aparece: nunca vira uma letra só.

### Piloto visual da tela Hoje (3.12)
- **Três níveis de leitura em vez de dois.** Medido em 1366x768 com o cenário de `testes/semear.mjs`: dos cerca de 1.970 caracteres visíveis na tela Hoje, só os 12 da saudação passavam de 14px. Agora: saudação em 22px (`Pagina` com a prop `destaque`, `h1[data-destaque]`), título de cada tarefa de "Precisa de você" em 14px semibold, e o resto como estava. **`destaque` só é usado na tela Hoje**: é piloto, para o dono aprovar antes de valer para todas as telas (a seção 13 continua dizendo `text-lg` para título de página).
- **"Precisa de você" deixou de ser parede de texto.** Eram 4 tarefas e 10 linhas de motivo, cada uma com frase colorida e explicação cinza do mesmo tamanho; a lista tinha 467px de altura. Com os motivos em selos tem 391px, e o título "Foco de hoje" passou a aparecer na primeira tela (y=707, numa área que vai até 744).
- **Caixa dentro de caixa virou preenchimento.** No cartão "Rotina de hoje", "Agora" e "Depois" têm fundo suave (`bg-muted/60`), sem borda, como os marcadores de "Progresso de hoje".
- Ficou de fora do piloto, para decidir depois de ver: título maior nas outras telas, as repetições (busca na lateral e na barra superior, "Nova tarefa" duas vezes em Tarefas, rotina e foco em mais de um lugar), painéis vazios que ocupam espaço (como "Depende de" na tarefa) e os gráficos pequenos do Radar.

### O que há de novo (3.0, atualizado na 3.12)
- `components/shell/Novidades.tsx`, montado no Shell. Na primeira abertura depois de atualizar aparece só um aviso discreto (toast com "Ver novidades"), que não cobre o trabalho nem disputa com o ritual do dia; a janela abre por ele ou por Configurações (`abrirNovidades()`). Quem começa com a pasta vazia não vê aviso.
- `VERSAO_NOVIDADES` sobe só quando há novidade que vale avisar (não a cada correção). O que já foi visto é a preferência `novidadesVistas`.
- **A janela separa o novo do histórico (3.12).** Eram 20 cartões do mesmo peso, acumulados desde a 3.0, em duas colunas e com 1.609px de rolagem numa área de 587: nada dizia o que era desta versão. Agora cada item de `NOVIDADES` tem `versao` e a lista fica da mais nova para a mais antiga. O que é da versão atual (`versao === VERSAO_NOVIDADES`) aparece em destaque (`data-slot="novidade-atual"`), com `pontos` (frases curtas) no lugar do parágrafo. O resto é o histórico por versão (`data-slot="versao-anterior"`): uma linha por novidade (`data-slot="novidade-anterior"`), que abre ao clicar, uma por vez; só as `RECENTES` (5) versões aparecem de cara e "Mostrar as versões mais antigas" traz as outras. A rolagem inicial caiu para 874px.
- **Ao subir `VERSAO_NOVIDADES`**: acrescente o item no topo com a `versao` nova e os `pontos`, e troque o texto do aviso (`description` do toast). O item da versão anterior vira histórico sozinho; se ele tinha `pontos`, confira se o `texto` dele continua dizendo tudo, porque no histórico é o `texto` que aparece.

### Radar (2.14; "Radar das frentes" até a 3.5)
- **O que é** (`app/radar/page.tsx`, `lib/radar.ts`): visão por assunto, para responder "como estão as minhas frentes?" sem abrir tarefa por tarefa. `montarRadar(dados, hoje)` é função pura; **a saúde não é gravada**, é conta feita na hora (mesma decisão dos lembretes e da gamificação).
- **Saúde**, nesta ordem de precedência: `risco` (tarefa aberta com prazo vencido ou bloqueada), `parada` (tem tarefa aberta e nenhum movimento há `RADAR.parada` = 14 dias), `atencao` (prazo em até `LIMITES.prazoProximo` dias, passo com prazo vencido, aguardando há `LIMITES.aguardando` dias ou mais contando da última cobrança, tarefa em andamento sem próximo passo), `em_dia`, `sem_abertas`. Os motivos vão em `frente.motivos`, do mais grave para o menos.
- **Movimento** = registro (menos marco) ou passo concluído, até hoje. Data no futuro não conta. Sem nenhum movimento, vale a data de criação da tarefa.
- **Frentes**: uma por categoria; categoria arquivada só aparece se ainda tiver tarefa aberta; tarefas sem categoria (ou com categoria que não existe mais) entram em "Sem categoria".
- **Linha de prazos** (`radar.prazos`, `colunaDoPrazo()`): prazos de tarefa aberta, de passo em aberto e follow-ups das próximas `RADAR.semanasDePrazo` semanas (segunda a domingo). Vencidos vão para a coluna "Atrasado"; follow-up vencido não entra (não é atraso de entrega).
- **Status em texto** (`textoDoRadar(radar, ids)`): texto fixo montado só com os dados, sem IA. Para o relatório redigido pelo Copilot continua existindo `/relatorios`.
- Conta que depende do dia usa `useHoje()`; os testes passam o dia como parâmetro e montam carimbos no fuso local, para valer em qualquer fuso.

### Perguntar ao Nexo (2.13)
- **O que é** (`app/perguntar/page.tsx`, `lib/perguntar.ts`): busca de trechos + prompt com fontes citadas, sem API e sem índice gravado. Tudo é calculado na hora, em funções puras.
- **Achar os trechos** (`buscarFontes(pergunta, dados, { categoriaId, limite, maxFontes, hoje })`): `termosDaPergunta()` tira acentos e palavras vazias e reduz ao radical (plural acha singular). Cada candidata (registro, tarefa, página, folha, link, pessoa) pontua por palavra achada, com peso maior para palavra rara, título e contexto, e bônus para quem tem mais palavras da pergunta, para o mais recente, para registro marcado como referência e para o que casa com a intenção ("decidido" favorece registro com decisões; "pendente", com passos em aberto; "travando", com impedimentos). A pontuação olha só o conteúdo do usuário (`busca`), não os rótulos que o app acrescenta ao trecho ("Decisões:", "Pode ajudar com:"). O resultado é determinístico: a mesma pergunta sobre os mesmos dados dá a mesma lista.
- **Tamanho** (`TAMANHOS`: curto 6 mil, médio 12 mil, longo 24 mil caracteres): texto longo é recortado nas linhas que têm as palavras (`recortar`), e o que não cabe é contado em `deFora`, para a tela avisar.
- **Prompt** (`promptPergunta`): manda responder SOMENTE com as fontes, citar `[F2]` depois de cada afirmação, dizer quando as fontes não bastam e mostrar as duas versões quando elas se contradizem. Imagem anexada não vai (o trecho passa por `paraTextoPlano`).
- **Resposta colada é entrada não confiável.** Só é mostrada pelo `TextoRico`. `ligarFontes()` troca `[F1]` por um link interno cujo destino vem da lista de fontes do app, nunca do texto; citação desconhecida fica como texto. `paginaDaResposta()` monta a página (pergunta no título, resposta com as citações ligadas, lista de fontes) e passa a resposta por `semHtml()`, que escreve `<` como `&lt;` fora de bloco de código, igual ao editor.
- **O que fica no navegador** (`nexo:pergunta`, lido por `normalizarConsulta()`): pergunta, categoria, tamanho, fontes tiradas, resposta e as fontes do último prompt copiado (só rótulo, chave, título, contexto e data). **Rota e link nunca são guardados**: `destinoDaChave()` recalcula dos dados de agora, e fonte que sumiu fica sem link.
- **Se mudar o formato da citação ou as regras do prompt, mude `CITACAO`, `promptPergunta` e `testes/perguntar.test.mjs` juntos.**

### Modo reunião (2.12)
- **O que é** (`app/tarefas/[id]/reuniao/page.tsx`, `lib/reuniao.ts`): uma tela para o antes, o durante e o depois de uma reunião da tarefa. Aberta pelo botão "Modo reunião" do cabeçalho da tarefa e pelo menu da tarefa (só em tarefa aberta).
- **Pauta** (`montarPauta(dados, tarefa, participantes)`, função pura): passos em aberto da tarefa, de quem ela espera retorno, as três últimas decisões, o último registro e, para cada participante, os passos dele em **outras** tarefas abertas e as tarefas que esperam retorno dele. Participante cadastrado é reconhecido pelos apelidos (`acharPessoa`). `textoDaPauta()` gera o texto para copiar.
- **Captura**: o estado é um `Reuniao` (`inicio` em ms, 0 = relógio ainda não ligado). Fica só no navegador (`lerReuniao`/`gravarReuniao`/`apagarReuniao` em `lib/rascunhos.ts`) e é lido de volta por `normalizarReuniao()`, com tipos, tamanhos e ids conferidos. `Alt 1` e `Alt 2` levam o cursor para "nova decisão" e "novo passo"; `Ctrl Enter` encerra.
- **Gravar** (`comReuniao(t, r, registro)` dentro de `atualizarTarefa`): acrescenta um registro `reuniao` (anotações em Markdown, decisões em lista, próximos passos, impedimentos, participantes, hora de início) e conclui os passos antigos marcados na pauta, numa gravação só. A reunião **não** grava `duracaoMin` (esse campo é das sessões de foco e conta XP por minuto).
- **Ata** (`textoDaAta()`): texto simples montado só com o que o usuário escreveu, sem IA. Para resumo do Copilot, o caminho continua sendo abrir o registro no editor.
- A primeira versão não muda status, prazo nem prioridade da tarefa a partir da reunião: isso continua na página da tarefa.

### Páginas de conhecimento e links internos (2.11)
- **Páginas** (`app/paginas/page.tsx`, `components/paginas/EditorPagina.tsx`, `paginas.json`): gravam sozinhas pelo hook `useGravacao` (`components/useGravacao.ts`, mesma lógica do bloco de notas: 1,5 s depois de parar de digitar, texto pendente no navegador até chegar ao disco). Excluir manda para a lixeira; arquivar mantém os links funcionando. O servidor espelha cada página em `markdown/paginas/`.
- **Citar com `@`** (no editor rico, em qualquer lugar em que ele aparece): abre a lista de páginas, tarefas e pessoas e insere um link interno. O botão `@` da barra faz o mesmo. Na leitura, o link interno vira navegação dentro do app (`data-slot="link-interno"`).
- **Quem aponta para cá** (`lib/ligacoes.ts`, `components/Citacoes.tsx`): `indiceDeCitacoes(dados)` lê os links internos de registros, descrições, páginas e folhas e monta o índice na hora (nada é gravado). `PainelCitacoes` aparece na lateral da tarefa, na página e no detalhe da pessoa, só quando há citação.
- A página da categoria lista as "Páginas do assunto"; a busca e a paleta acham páginas.

### Conquistas: nível, meta do dia e comemorações (2.10)
- **O placar não é dado, é conta.** `calcularJogo(dados, hoje, meta)` em `lib/jogo.ts` percorre registros, passos concluídos e marcos de conclusão e devolve XP, nível, meta do dia, sequência, recorde e as conquistas. Nada é gravado: vale retroativamente, é igual em qualquer PC e não tem como dessincronizar. **Não crie campo de "pontos" nos dados.**
- **XP** (constante `XP`): 10 por passo concluído, 15 por registro (20 se for reunião), 50 por tarefa concluída, 1 por minuto de sessão de foco (até 60 por sessão). O que tem data no futuro não conta. Nível n exige `60·n·(n−1)` XP.
- **Meta do dia**: N "avanços" (passo concluído, registro ou tarefa concluída) no dia; N é preferência (padrão 3, até 12).
- **Conquistas** (lista `MOLDES`): por contador acumulado (guardam o dia em que foram alcançadas) ou por valor atual (melhor sequência, recorde do dia, modelos, pessoas, folhas organizadas). Para criar uma, acrescente um molde e um ícone em `ICONE_CONQUISTA` (`components/jogo/pecas.tsx`).
- **Onde aparece**: pé da barra lateral (`NivelLateral`: anel da meta, nível, barra de XP), painel "Progresso de hoje" da tela Hoje, tela `/conquistas` e painel em Configurações.
- **Comemoração** (`components/jogo/Celebracao.tsx`, montada no Shell): compara o placar com `nexo:jogoVisto` e, se há conquista nova, nível novo, meta batida ou tarefa concluída, avisa e solta confete (`Confete`, só com movimento "completo"). Na primeira vez registra o estado atual em silêncio, para não comemorar de uma vez tudo o que já tinha sido feito. O que já foi comemorado não é comemorado de novo.
- **Desligável** (`jogo.ligado`): esconde tudo. Como nada é gravado, ligar de novo traz o mesmo placar.

### Editor de texto rico (2.9)
- **Onde**: folha do bloco de notas (`components/notas/EditorNota.tsx`) e "Anotações brutas" do registro (`components/RegistroEditor.tsx`). Componente `EditorRico` (`components/editor/EditorRico.tsx`, extensões em `components/editor/extensoes.ts`), sobre o Tiptap. O valor é sempre uma string em Markdown: os mecanismos de rascunho e de gravação automática não mudaram.
- **O que faz**: barra de formatação, menu de blocos ao digitar `/` (texto, títulos, lista, numerada, tarefas, citação, código, tabela, imagem, divisor), atalhos de Markdown (`# `, `- `, `[] `, `> `, três crases), link, tabela com linhas e colunas, e **imagens**: colar (`Ctrl V`), arrastar ou escolher. Texto puro colado com cara de Markdown (resposta do Copilot) entra formatado.
- **Ler**: `TextoRico` (`components/tarefa/Texto.tsx`) desenha a árvore que `analisarMarkdown()` devolve (`lib/texto-rico.ts`). A classe CSS `prosa` (`app/globals.css`) dá a mesma cara para ler e editar.
- **Atalhos que mudam dentro do editor**: `Ctrl B` é negrito (fora dele, recolhe a barra lateral); `Ctrl Enter` continua salvando o formulário em volta (o editor não insere quebra); `Esc` com o menu de blocos aberto fecha só o menu, não a janela.
- **Prompts**: imagem anexada vai para o Copilot como `[imagem anexada: nome]` (`semImagens()` em `lib/prompts.ts`), porque ele não vê o arquivo.
- **Limite conhecido**: quando o bloco de notas organiza uma folha em vários registros, cada registro leva o trecho que a IA copiou, então as imagens ficam só na folha arquivada (o link "abrir a folha original" leva até elas). Quando a folha rende um registro só, ele leva o texto inteiro, com as imagens.

### Esperando quem, modelos de tarefa e sessão de foco (2.8)
- **Esperando quem** (`components/Esperando.tsx`, `lib/espera.ts`): quando a tarefa vai para "Aguardando terceiros" por `useAcoesTarefa().mudarStatus` (ou pela revisão) e ainda não diz de quem, abre a janela "Esperando quem?" (quem, o quê, lembrar de cobrar em). É opcional ("Agora não"). Com isso preenchido: a faixa `FaixaEspera` aparece no cabeçalho da tarefa e no detalhe da pessoa; "Aguardando retorno" em Hoje mostra de quem e conta os dias **desde a última cobrança**; o lembrete vira "Sem retorno de Fulano há N dias"; **Copiar cobrança** gera uma mensagem pronta (`mensagemCobranca()`, que só usa o que o usuário escreveu) e **Cobrei hoje** (`comCobranca()`) grava uma atividade "Cobrei Fulano" e recomeça a contagem. Também no menu da tarefa.
- **Modelos de tarefa** (`components/Modelos.tsx`, `lib/modelos.ts`, `modelos.json`): para demandas que se repetem. "Salvar como modelo..." no menu da tarefa já traz campos e passos dela (`modeloDaTarefa()`); em "Nova tarefa" aparece "Começar de um modelo", que preenche o formulário (o `...` do título sugerido fica selecionado para digitar por cima) e lista os passos, que dá para desmarcar. Os passos marcados entram num registro `nota` "Passos do modelo «nome»" (`registroDosPassos()`), é isso que os leva para Pendências. Gerenciar em Configurações. `abrirNovaTarefa(categoriaId, modeloId)` abre o formulário já com o modelo.
- **Sessão de foco** (`components/shell/SessaoFoco.tsx`): cronômetro de 15, 25 ou 50 minutos numa tarefa, começado pelo menu da tarefa ou pelo balão "Foco" da barra superior. Uma de cada vez. A ficha com o tempo fica na barra superior e no título da janela. Ao encerrar (ou quando o tempo acaba), pergunta "o que saiu?" e `comSessaoDeFoco()` grava uma atividade com `duracaoMin`. A tarefa mostra o total em "sessões de foco" (`minutosEmFoco()`). O tempo é sempre calculado da hora de início, então aba em segundo plano não atrasa.

### Pessoas e times
- **Dois arquivos novos** na pasta de dados: `pessoas.json` (`{ rev, items: Pessoa[] }`) e `times.json` (`{ rev, items: Time[] }`). Se faltarem, valem como vazios (rev 0). Não houve migração: `SCHEMA_APP` continua 1, e uma versão antiga do app simplesmente ignora os dois arquivos.
- **Nomes continuam como texto** nos registros e passos. A ligação com o cadastro é feita na leitura, por `nome` ou `apelidos` (`lib/pessoas.ts`: `montarDiretorio`, `acharPessoa`, `pessoasDaCategoria`, `nomesConhecidos`). Nada é reescrito nas tarefas.
- **O vínculo com time mora no Time**: `membroIds` (que inclui os responsáveis) e `responsavelIds`. A Pessoa não guarda time.
- **Ids** de pessoa e time são gerados no cliente com `novoId("pe")` e `novoId("ti")`, e validados no servidor por `ID_VALIDO`.
- **Importação do Outlook** (`components/pessoas/ImportarPessoas.tsx` + `lib/importar-pessoas.ts`): tudo no navegador, sem API. Mostra prévia, avisa quem já existe e nunca duplica. Para quem já existe, só preenche campo vazio. Pode pôr os importados num time e ligá-los a uma categoria.
- **Privacidade**: nomes e e-mails reais nunca vão para o repositório. Testes e exemplos usam nomes fictícios e o domínio `exemplo.local`.

### Regras que continuam valendo
- **Editor de registro** (`components/RegistroEditor.tsx`): tipo, data/hora, título, participantes (com sugestão de nomes já usados), anotações brutas, bloco Copilot em 3 passos, campos estruturados, prazo por passo, "passos anteriores resolvidos aqui?" e "atualizar a tarefa junto" (status/prioridade/prazo; mudança de status gera um marco). **Desde a 3.11, o essencial primeiro**: à esquerda tipo, título com data e hora numa linha só, participantes e as anotações (que ocupam a altura que sobra); à direita o **bloco do Copilot no topo**, inteiro na primeira tela em 1366x768 (copiar em y=230, preencher em y=444; antes o copiar ficava em y=776, abaixo da dobra de 686). Embaixo dele, três seções que recolhem (`Recolhivel`): **"Como vai para a linha do tempo"** (`data-slot="editor-campos"`: resumo, decisões, próximos passos, impedimentos; fechada com "Preencher à mão" enquanto vazia), **"Passos anteriores resolvidos aqui?"** (`passos-anteriores`) e **"Atualizar a tarefa junto"** (`atualizar-tarefa`). **O que tem conteúdo nunca fica escondido**: a seção abre sozinha e perde a setinha (não dá para recolher) enquanto tiver campo preenchido, passo, passo antigo marcado ou status/prioridade/prazo diferente do da tarefa. Isso é conta sobre o estado (`temCampos`, `mexeuNaTarefa`), não é gravado: por isso editar um registro cheio ou voltar de um rascunho abre tudo o que tem valor, e o formato do rascunho não mudou. "Preencher campos com a resposta" abre os campos e rola a coluna até eles. O foco inicial vai para o título (`data-foco-inicial`, que o `Modal` agora respeita). Tem **rascunho automático** (seção 4): fechar com algo digitado (Esc, clique fora, X) guarda o rascunho e avisa, sem perguntar; o rodapé ganha "Descartar" (com confirmação) e "Fechar e continuar depois". Ao abrir, o estado vem do rascunho, se houver, e um aviso no topo permite descartá-lo e voltar ao que estava salvo.
- **Formulário de tarefa** (`components/TarefaForm.tsx`, 3.11): à vista ficam "Começar de um modelo", título, categoria, prazo e prioridade. Status, lembrete de voltar, tags e descrição ficam em **"Mais opções"** (`data-slot="mais-opcoes"`, `Collapsible`), que recolhido mostra um resumo do que tem dentro ("Em andamento · 2 tags · descrição"). Ao criar, abre como o usuário deixou da última vez (preferência `tarefaMaisOpcoes`); ao editar, abre se status não for "A fazer" ou houver lembrete, tag ou descrição; um modelo com tags ou descrição também abre. Fechar continua perguntando antes se algo foi digitado, inclusive nos campos recolhidos (o estado é do formulário, não do `Collapsible`).
- Nova tarefa cria automaticamente um marco "Tarefa criada"; mudar status em qualquer lugar passa por `aplicarStatus()` (em `lib/acoes.ts`), que gera o marco.
- Toda tarefa mostrada na tela tem o menu de ações (`components/MenuTarefa.tsx`): botão direito ou "...".
- **Referência do assunto**: qualquer registro (menos marcos) pode ser marcado como referência (`registro.referencia`, botão no card, `comReferencia()` em `lib/acoes.ts`). É para conhecimento que serve além daquela tarefa, como a explicação de um processo. Aparece com um selo na timeline e na página da categoria, com link de volta para o registro. No bloco de notas, a IA pode sugerir com `"referencia": true`; só vale o booleano `true`.
- **Tarefa e registro**: a tarefa é a demanda inteira; reunião, atividade, decisão e nota são registros dentro dela. O formulário de nova tarefa e o prompt do bloco de notas dizem isso, porque registrar uma reunião como tarefa é o erro mais comum.
- **Consertar o que foi registrado no lugar errado** (`components/MoverEJuntar.tsx`, montado uma vez no Shell e aberto por evento): cada registro da timeline (menos os marcos) tem "Mover para outra tarefa", e o menu da tarefa tem "Juntar em outra tarefa...". Juntar leva registros, tags e links para o destino, grava um marco "Juntou a tarefa X" com a descrição que ela tinha e manda a origem para a lixeira (restaurável). A ordem das gravações é sempre **destino recebe, depois origem perde**: se falhar no meio, sobra uma cópia repetida, nunca um buraco. As folhas do bloco de notas que apontavam para a origem passam a apontar para o destino.

---

## 7. Integração com o Copilot (sem API)

Tudo em `lib/prompts.ts`.

### Prompts disponíveis
| Função | Onde aparece | Retorno colado volta para |
|---|---|---|
| `promptRegistro(t, cat, r)` | Editor de registro | campos do registro (via `interpretarResposta`) |
| `promptPanorama(t, cat)` | Página da tarefa | `tarefa.panoramaIA` |
| `promptPrepararReuniao(t, cat)` | Página da tarefa | não é salvo (uso livre) |
| `promptTranscricao(t, cat, parte, opcoes)` | Modo reunião (Transcrição) | campos da reunião em andamento (via `interpretarResposta` e `comRespostaDaTranscricao`) |
| `promptCategoria(cat, tarefas)` | Página da categoria | não é salvo |
| `promptRelatorio(tarefas, cats, ini, fim, foco)` | Relatórios | não é salvo |
| `promptNotas(nota, tarefas, cats)` (em `lib/notas.ts`) | Bloco de notas | propostas (via `interpretarNotas`), aplicadas só depois da prévia |
| `promptPergunta(pergunta, fontes)` (em `lib/perguntar.ts`) | Perguntar | mostrada com as citações ligadas; vira página se o usuário guardar |

Todos incluem o contexto (cabeçalho da tarefa, histórico resumido, passos em aberto) e regras: português do Brasil, **não inventar** nada fora do que foi dado, seção vazia = "Nenhum", títulos de seção sozinhos na linha com `## `.

### Contrato do formato de resposta (registro)
```
## RESUMO
## DECISÕES
## PRÓXIMOS PASSOS        - ação (responsável: Nome)
## IMPEDIMENTOS
## PARTICIPANTES
## PASSOS CONCLUÍDOS      texto exato de passos antigos que foram resolvidos
```
`interpretarResposta()` é tolerante porque o texto copiado do Copilot perde formatação: aceita título com ou sem `##`, `**negrito**`, `:` no final, número na frente, acentos ou não, maiúsculas ou não. Itens de lista aceitam `-`, `*`, `•`, `1.`, `[ ]`. Se nenhuma seção for reconhecida, tudo vai para o resumo e a interface avisa. `PASSOS CONCLUÍDOS` é casado com os passos abertos por `mesmoTexto()` (normalizado, por inclusão) e o usuário confirma na tela antes de salvar.

**Se mudar o formato pedido em qualquer prompt, atualize `interpretarResposta` e o `MAPA` de títulos junto, e teste com uma resposta colada de verdade.**

### Bloco de notas: resposta em JSON (`lib/notas.ts`)
É o único prompt que pede **JSON**, porque uma folha pode render vários itens em várias tarefas. O contrato está no cabeçalho de `lib/notas.ts`: `{ "nexo": 1, "itens": [...], "sobras": "..." }`, com itens de tipo `registro`, `tarefa` e `passo_concluido`.
- As tarefas abertas vão no prompt com um **apelido** (`[T1]`, `[T2]`...), que a IA copia com mais segurança do que o id. `apelidosDasTarefas()` dá sempre a mesma ordem (criação, depois id). O leitor confere o apelido contra o título que a IA devolve e, se não baterem, deixa o item em dúvida para o usuário escolher a tarefa.
- `interpretarNotas()` só devolve **propostas**: não grava nada. Acha o JSON puro, dentro de cercas de código ou com conversa em volta; se vier cortado, devolve erro claro.
- A primeira versão não deixa a IA mudar status, prazo ou prioridade de tarefa existente, de propósito: é arriscado aplicar em lote.
- **Tarefa nova com o que aconteceu dentro dela**: o item `tarefa` pode trazer um `ref` (`N1`, `N2`...) e os itens `registro` apontam para ele no campo `tarefa`. É o caso comum de "anotei uma reunião de uma demanda que ainda não está no app": a demanda vira tarefa e a reunião vira um registro dentro dela. O prompt diz com todas as letras que reunião nunca vira tarefa.
- **Não perder informação é regra do prompt e do app.** O prompt pede um resumo completo e organizado (sem limite de linhas), em tópicos quando as notas explicam um processo, e que dúvidas viram passos. Como a IA encurta mesmo assim, o app não depende dela: guarda o texto original (ver seção 4), avisa quando os trechos copiados somam menos de 60% da folha e transforma as `sobras` numa proposta de nota, desmarcada, que o usuário pode guardar numa tarefa. Sobras não guardadas ficam em `nota.sobras`, em destaque na folha arquivada.
- A data de um registro sem data nas notas vem como hoje, marcada para conferir, e é editável na prévia. O marco "Tarefa criada" de uma tarefa nova leva a data do registro mais antigo que entra nela.
- **Se mudar o contrato, mude o prompt, o leitor e `testes/notas.test.mjs` juntos.**

---

## 8. Estrutura do código

```
app/
  layout.tsx              Provider, Raiz e Shell em todas as páginas; injeta os scripts de tema e aparência no <head>
  template.tsx            entrada animada de cada tela (o Next remonta o template a cada troca de rota)
  globals.css             Tailwind, tokens de cor (claro e escuro), utilitários
  icon.svg                ícone do app (aba e instalação)
  manifest.ts             manifesto para instalar o Nexo pelo navegador
  page.tsx                Hoje (página inicial)
  tarefas/page.tsx        lista de tarefas (grade, lista e quadro)
  tarefas/[id]/page.tsx   página da tarefa + timeline (CardRegistro)
  tarefas/[id]/reuniao/page.tsx  modo reunião: pauta, captura e ata
  categorias/             lista e página de cada categoria ([id])
  pendencias/page.tsx     passos em aberto
  notas/page.tsx          bloco de notas (folhas abertas e arquivadas)
  rotina/page.tsx         rotina: o dia em blocos, o ponto com a hora de sair e o banco de horas
  diario/page.tsx         diário: o que aconteceu dia a dia, com mapa de atividade
  conquistas/page.tsx     conquistas: nível, XP, meta do dia e conquistas (gamificação)
  paginas/page.tsx        documentação: explorador em árvore, abas, página aberta e as visões Quadro e Lista
  radar/page.tsx          radar das frentes: saúde de cada assunto, linha de prazos e status em texto
  perguntar/page.tsx      perguntar ao Nexo: trechos do histórico, prompt com fontes e resposta com citações
  pessoas/page.tsx        pessoas envolvidas e detalhe (?p=Nome)
  links/page.tsx          banco de links e arquivos
  revisao/page.tsx        revisão semanal guiada
  relatorios/page.tsx     relatório do período
  busca/page.tsx          busca global (?q=)
  configuracoes/page.tsx  dados, aparência, rotina, atalhos
  api/
    estado/      GET   estado do app (configurado? pasta, schema, somente leitura, erro)
    config/      POST  { dataDir }  define a pasta de dados
    dados/       GET   tudo: { tarefas, categorias, links, avisos }
    tarefas/[id] PUT   { tarefa, revEsperada|null }   DELETE → lixeira
    categorias/  PUT   { items, revEsperada }   (lista inteira; removidos vão pra lixeira)
    links/       PUT   { items, revEsperada }
    pessoas/     PUT   { items, revEsperada }   (ids validados por ID_VALIDO, sem repetição)
    times/       PUT   { items, revEsperada }
    notas/       PUT   { items, revEsperada }   (folhas do bloco de notas)
    modelos/     PUT   { items, revEsperada }   (modelos de tarefa)
    paginas/     PUT   { items, revEsperada }   (páginas de conhecimento; atualiza o espelho em markdown/paginas/)
    paginas/historico/ GET ?id=<página> lista as versões guardadas; &v=<versão> devolve uma (só leitura)
    jornada/     PUT   { items, revEsperada }   (rotina e ponto: cada id tem que ser uma data de verdade ou "config")
    assuntos/    PUT   { items, revEsperada }   (falar com: assuntos para a próxima conversa com cada pessoa)
    transcricoes/ GET  as transcrições das páginas de vídeo, para a busca e o Perguntar (só leitura)
    midia/       POST  ?nome=<arquivo>, corpo cru → grava o vídeo em pedaços   GET ?p=<arquivo> ou ?pagina=<id> → toca, com Range
    arquivos/    POST  multipart "arquivo" → { arquivo, nomeArquivo, tamanho }
                 GET   ?p=<caminho relativo>[&baixar=1]  (inline com CSP sandbox)
    backup/      GET lista (ou ?nome=<backup>: prévia do que mudaria ao restaurar), POST backup manual
    backup/restaurar/ POST { nome }  volta os dados àquele backup (foto do estado atual antes; o que não existia vai para a lixeira)
    verificar/   GET   verificação de integridade dos dados e da pasta (só leitura)
    exportar/    GET   JSON completo para download
    lixeira/     GET lista, POST { arquivo } restaura tarefa
components/
  Provider.tsx            estado global, fetch, fila de gravação, atualizarTarefa(id, fn), toasts
  Raiz.tsx                provedores de interface: tema, confirmação, dicas, toasts, MotionConfig
  Shell.tsx               moldura: barra lateral, barra superior, barra de status, atalhos
  MenuTarefa.tsx          menu de ações da tarefa (botão direito e "...") e useAcoesTarefa()
  MoverEJuntar.tsx        janelas de mover registro para outra tarefa e de juntar duas tarefas
  Esperando.tsx           "Esperando quem?": janela, faixa de cobrança (FaixaEspera) e useCobranca()
  Modelos.tsx             modelos de tarefa: janela (ModeloForm), painel de Configurações e pedirModelo()
  Citacoes.tsx            "quem aponta para cá": useCitacoes() e PainelCitacoes
  desfazer.ts             pilha do desfazer (aviso com "Desfazer" e Ctrl Z): oferecerDesfazer(), desfazerUltimo()
  Assuntos.tsx            "falar com": pedirAssunto(), JanelaAssunto (montada no Shell) e PainelFalarCom (detalhe da pessoa)
  AvisosDoSistema.tsx     lembretes críticos como aviso do Windows e o clique na notificação ("nexo:ir")
  Impressao.tsx           folha de impressão da tarefa e da categoria (pedirImpressao) e copiarTarefaEmMarkdown
  useTranscricoes.ts      transcrições dos vídeos pedidas a /api/transcricoes (busca e Perguntar)
  reuniao/                TranscricaoDaReuniao (colar a transcrição, prompt por partes, trazer para a captura)
  useGravacao.ts          gravação automática de título + texto (usada pelas páginas)
  paginas/                documentação: Explorador (árvore, favoritas, busca), Abas, EditorPagina (a página aberta e o sumário), QuadroPaginas, ListaPaginas, MapaDePaginas (quem cita quem), Historico (versões guardadas) e pecas (ações, menu, ícone, estado)
  paginas/video/          página de vídeo: Player (controles próprios), Transcricao (painel sincronizado), VisaoDeVideo (player, anotações, capítulos) e GaleriaDeVideos
  jogo/                   gamificação: useJogo (placar e preferências), Celebracao, NivelLateral e pecas (Anel, CartaoConquista, Confete)
  jornada/                rotina e ponto: LinhaDoDia (linha do tempo com arrastar), Paineis (ponto, plano, semana, banco de horas), Formularios (bloco, ajustar o ponto, dia padrão, configuração),
                          Ferramenta (ficha da barra superior, avisos, cartão da tela Hoje) e pecas (useJornada, usePonto, useMinuto, CampoHora)
  editor/                 editor de texto rico: EditorRico (barra, menu "/", imagens) e extensoes (Tiptap, regras de segurança)
  comum.tsx               peças de domínio: Pagina, Secao, StatusBadge, PrioBadge, Modal etc.
  useLembretes.ts         lembretes ativos e adiar()
  useHoje.ts              dia de hoje que se atualiza sozinho na virada do dia
  TarefaForm.tsx          criar e editar tarefa, aplicarStatus() na tela
  RegistroEditor.tsx      editor de registro com fluxo Copilot
  PromptModal.tsx         copiar prompt / colar resposta genérico
  LinkForm.tsx            link ou arquivo, hrefLink()
  CategoriaForm.tsx       criar e editar categoria
  CardTarefa.tsx          cartão de tarefa (grade, quadro e categorias)
  ui/                     kit genérico no padrão Shadcn sobre Radix (seção 13)
  shell/                  moldura: Novidades (o que há de novo), Lateral (navegação e seções), BarraSuperior, Ferramentas (agenda, foco, anotar rápido, menu Mais),
                          Acompanhar (abas das cinco telas de acompanhar, última aba, revisão atrasada),
                          SessaoFoco (cronômetro e registro), Personalizar (painel), Aparencia (controles de tema, cor, cantos...),
                          Paleta, Sino, Logo, Telas, navegacao
  hoje/                   tela Hoje: captura rápida, foco de hoje, precisa de você, semana
  rotina/                 ritual "Planejar o dia" em 3 etapas e FecharDia (o que saiu, o que fica, daily; useEncerrarDia)
  tarefas/                lista de tarefas: filtros (e visões salvas), grade, lista, quadro (Kanban), seletor de categoria, Lote (seleção e ações em lote), Visoes
  tarefa/                 página da tarefa: propriedades, timeline, passos, Copilot, lateral, Dependencias; Texto.tsx (TextoRico) desenha Markdown
  pendencias/             tela de pendências: agrupamento e linhas
  notas/                  bloco de notas: EditorNota (grava sozinho) e OrganizarNota (prompt, JSON, prévia, aplicar)
  categorias/             cartões de categoria, emblema e ações
  pessoas/                lista e detalhe de pessoas e times
    AbasPessoas.tsx       alternância Pessoas | Times
    ListaPessoas.tsx      aba Pessoas: cadastradas e nomes sem cadastro
    ListaTimes.tsx        aba Times: cartões com cor, responsáveis e membros
    DetalhePessoa.tsx     página da pessoa (?p=Nome): ajuda, times, passos, histórico
    DetalheTime.tsx       página do time (?time=id): responsáveis, membros, tarefas
    PessoaForm.tsx        cadastrar/editar pessoa
    TimeForm.tsx          cadastrar/editar time
    ImportarPessoas.tsx   assistente do Outlook (colar, CSV, vCard)
    ListaPassos.tsx       passos em aberto com a pessoa ou o time, marcáveis
    SeletorMultiplo.tsx   seleção múltipla com busca (chips + popover)
    SeletorCor.tsx        bolinhas de cor do time
    pecas.tsx             links, etiquetas, avatares, ações e menus
    dados.ts              reexporta lib/pessoas.ts com os nomes antigos
  links/                  ícones e formato curto dos links
  busca/                  campo de busca e filtro
  revisao/                cartão da revisão semanal e contas do retrato
  configuracoes/          painéis de dados (pasta, backups com restauração, saúde dos dados, lixeira), de preferências e Notificacoes (avisos do Windows)
lib/
  tipos.ts                tipos, normalização e helpers (servidor e cliente)
  armazenamento.ts        TODO acesso a disco (só servidor)
  migracoes.ts            SCHEMA_APP e MIGRACOES
  acoes.ts                transformações puras da tarefa (aplicarStatus, comFoco, comLembrete...)
  lembretes.ts            motor de lembretes (função pura sobre os dados)
  preferencias.ts         usePref() e useRotina() (localStorage com prefixo nexo:)
  aparencia.ts            aparência escolhida (cor de destaque, cantos, letra, movimento, lateral, fundo) e o script do <head>
  moldura.ts              barra lateral e barra superior do jeito do usuário: useMoldura(), useRecentes(), abrirPersonalizar()
  prompts.ts              prompts do Copilot e parser da resposta
  rascunhos.ts            rascunho automático do editor de registro, texto pendente das folhas e reunião em andamento (localStorage, só cliente)
  paginas.ts              documentação: árvore de páginas, ordem de leitura, sumário, busca por seção, modelos de página (funções puras)
  grafo.ts                mapa das páginas: montarGrafo (nós e ligações), disporGrafo (posições, determinístico) e vizinhosDe (funções puras)
  fechamento.ts           fechamento do dia e daily: montarFechamento, dailyDoFechamento, dailyDaManha, proximoDiaDeTrabalho (funções puras)
  dependencias.ts         dependências entre tarefas: dependenciasDe, quemDependeDe, criaCiclo, comDependencia, destravouEm (funções puras)
  recorrencia.ts          tarefas que se repetem: ocorrenciaDevida, proximaOcorrencia, comOcorrenciaAtendida, textoDaRepeticao (funções puras)
  assuntos.ts             falar com: assuntosCom, contagemPorPessoa, assuntoNovo, comAssuntoResolvido (funções puras)
  diff.ts                 comparação de versões: diffDeTexto (linhas e palavras), comTrechosRecolhidos (função pura)
  notificar.ts            avisos do Windows pelo navegador: preferência, permissão e notificar() (só cliente)
  jornada.ts              rotina e ponto: contarPonto (hora de sair, trabalhado, saldo), resumoDoPlano (hora extra), blocoNoInstante, avisosDoMinuto, bancoDeHoras e as mudanças no dia (funções puras)
  transcricao.ts          transcrição de vídeo: lerTranscricao (VTT, SRT, texto com tempos), falaNoInstante, emTrechos, busca e promptDoVideo (funções puras)
  perguntar.ts            perguntar ao Nexo: buscarFontes, promptPergunta, ligarFontes, paginaDaResposta, normalizarConsulta (funções puras)
  integridade.ts          verificação de integridade: verificarIntegridade(dados, inventário da pasta) (função pura)
  radar.ts                radar das frentes: montarRadar (saúde, números, movimento, prazos) e textoDoRadar (função pura)
  reuniao.ts              modo reunião: montarPauta, normalizarReuniao, registroDaReuniao, comReuniao, textoDaPauta, textoDaAta (funções puras)
  notas.ts                bloco de notas: promptNotas, interpretarNotas (leitor do JSON da IA) e aplicação das propostas
  texto-rico.ts           Markdown → árvore saneada (analisarMarkdown), paraTextoPlano, regras de imagem, de link, de destaque e de anexo
  realce.ts               cores do bloco de código na leitura (realce próprio, sem biblioteca)
  ligacoes.ts             quem cita quem: índice de citações a partir dos links internos (função pura)
  jogo.ts                 gamificação: calcularJogo (XP, nível, meta do dia, conquistas), função pura sobre os dados
  diario.ts               diário: eventos por dia, mapa de atividade, sequência e texto para copiar (função pura)
  espera.ts               esperando quem: dias esperando, resumo e mensagem de cobrança
  modelos.ts              modelos de tarefa: passosDoTexto, modeloDaTarefa, registroDosPassos
  pessoas.ts              diretório unificado (cadastradas + nomes soltos), pessoasDaCategoria, nomesConhecidos
  importar-pessoas.ts     importador do Outlook sem API (colagem, CSV, vCard, ANSI) e compararComCadastro
  markdown.ts             espelho .md de cada tarefa
  resposta.ts             tratar(): erro → 409 (conflito), 423 (somente leitura), 500
  animacoes.ts            presets do motion (suave, mola, lista, subir...)
  tema.ts                 script que aplica o tema antes da primeira pintura
  utils.ts                cn() (junta classes do Tailwind)
proxy.ts                  segurança das rotas /api (ver seção 10)
postcss.config.mjs        Tailwind CSS v4 via @tailwindcss/postcss
components.json           configuração do kit Shadcn (estilo, aliases)
next.config.ts            configuração do Next.js
scripts/                  instalação/atualização sem git (seção 9)
testes/api.sh             testes de fumaça da API e da segurança
testes/e2e.cjs            teste ponta a ponta da interface (Playwright para Node)
testes/semear.mjs         cenário de demonstração numa pasta de dados vazia e descartável (--so-pessoas: só pessoas e times)
testes/pessoas.test.mjs   testes das funções puras de pessoas e do importador (node testes/pessoas.test.mjs)
testes/notas.test.mjs     testes do prompt e do leitor de JSON do bloco de notas (node testes/notas.test.mjs)
testes/aparencia.test.mjs testes da personalização e do script do <head> com valores hostis (node testes/aparencia.test.mjs)
testes/diario.test.mjs    testes do Diário, de "esperando quem", dos modelos e da sessão de foco (node testes/diario.test.mjs)
testes/texto-rico.test.mjs testes do leitor de Markdown: formatação, HTML, imagens de fora, links (node testes/texto-rico.test.mjs)
testes/jogo.test.mjs      testes da gamificação: XP, níveis, meta do dia, conquistas (node testes/jogo.test.mjs)
testes/ligacoes.test.mjs  testes dos links internos e das citações (node testes/ligacoes.test.mjs)
testes/reuniao.test.mjs   testes do modo reunião (node testes/reuniao.test.mjs)
testes/perguntar.test.mjs testes de "Perguntar ao Nexo" (node testes/perguntar.test.mjs)
testes/radar.test.mjs     testes do Radar das frentes (node testes/radar.test.mjs)
testes/integridade.test.mjs testes da verificação de integridade (node testes/integridade.test.mjs)
testes/paginas.test.mjs   testes da árvore de páginas, do sumário, da busca e dos modelos (node testes/paginas.test.mjs)
testes/grafo.test.mjs     testes do mapa das páginas (node testes/grafo.test.mjs)
testes/jornada.test.mjs   testes da rotina, do ponto e do banco de horas (node testes/jornada.test.mjs)
testes/lembretes.test.mjs testes do motor de lembretes e do agrupamento por tarefa (node testes/lembretes.test.mjs)
testes/fechamento.test.mjs testes do fechamento do dia, da daily e da transcrição no modo reunião
testes/dependencias.test.mjs testes de dependências, repetição de modelos e "falar com"
testes/versoes.test.mjs   testes da comparação de versões, do vídeo no Perguntar e das preferências novas
testes/transcricao.test.mjs testes da leitura de transcrições e do vídeo da página (node testes/transcricao.test.mjs)
testes/carga.mjs          desempenho com um ano de dados simulados numa pasta vazia; sai com erro se algo passar do teto (--telas mede as telas com Playwright)
Iniciar Nexo.cmd          abre o Nexo em janela própria (modo aplicativo do Edge) e roda npm start
```

Convenções:
- **Código, nomes e textos em português** (variáveis, funções, rotas, mensagens). Mantenha.
- Componentes de tela são client components (`"use client"`); acesso a disco só em `lib/armazenamento.ts`, chamado pelos route handlers.
- Toda escrita de dados passa pelo Provider (nunca `fetch` direto para gravar, exceto backup/lixeira em Configurações).
- Textos da interface: tom natural, direto, sem "cara de IA". **Não use travessão (—)** em textos visíveis nem em documentos (preferência do usuário).
- Interface sempre com o kit de `components/ui` e `components/comum.tsx` (seção 13). Nada de elemento nativo do navegador onde o kit tem substituto.

---

## 9. Distribuição para a máquina corporativa (sem git clone)

O repositório é **público** de propósito. Três caminhos, do mais simples ao mais resistente:

1. **PowerShell** (`scripts/instalar-nexo.ps1`): baixa o zip do codeload (ou arquivo por arquivo via API + raw), guarda a versão atual em `<pasta>-anterior`, espelha com `robocopy /MIR /XD node_modules .next`, roda `npm install` + `npm run build` e cria atalho "Nexo" na área de trabalho. Recusa rodar se a pasta de dados estiver dentro da pasta do app. Texto só ASCII (PowerShell 5.1 lê .ps1 sem BOM como ANSI). Usa `throw` (não `exit`) para não fechar a janela quando rodado via `irm | iex`.
   ```powershell
   irm https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/instalar-nexo.ps1 | iex
   ```
2. **Git Bash** (`scripts/baixar-nexo.sh`): mesmo kit já usado com sucesso no projeto Sonora. Tenta pacote tar.gz/zip, depois API + arquivo por arquivo, depois uma **lista de arquivos embutida** no próprio script; confere cada arquivo pelo hash do git.
   ```bash
   bash baixar-nexo.sh nexo-app --instalar          # primeira vez
   bash baixar-nexo.sh nexo-app --forcar --instalar # atualizar
   ```
3. **Offline** (`scripts/nexo-offline.sh`): o projeto inteiro embutido em base64 (tar.gz + SHA-256). Para quando nada de rede funciona: copiar o conteúdo do arquivo e rodar com `bash`.

`scripts/gerar-scripts-de-copia.sh` regenera a lista embutida do `baixar-nexo.sh` e o `nexo-offline.sh`. O workflow `.github/workflows/scripts-de-copia.yml` roda isso a cada push na `main` e commita se mudou. Se rodar à mão, faça antes o commit das suas mudanças.

---

## 10. Segurança (o usuário é de AppSec, capriche)

- Servidor só em `127.0.0.1` (flag `-H` nos scripts do `package.json`).
- `proxy.ts` vale para as telas e para a API (menos os estáticos do build): recusa `Host` que não seja `localhost`/`127.0.0.1`/`[::1]` (DNS rebinding). Na API, recusa também qualquer pedido que o navegador marque como vindo de outro site ou de outra porta (`Sec-Fetch-Site` diferente de `same-origin`/`none`): em escrita barra CSRF, em leitura impede outra página aberta no navegador de pedir os dados. Em escrita confere ainda o `Origin`.
- **Cabeçalhos das telas** (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` (câmera, microfone, localização, pagamento, USB e serial desligados) e, no build de produção, uma **CSP** que só deixa o app falar com a própria máquina (`connect-src`, `img-src`, `font-src`, `form-action 'self'`), proíbe ser embutido (`frame-ancestors 'none'`) e plugin (`object-src 'none'`). `script-src` mantém `'unsafe-inline'` porque o Next inicia cada tela com scripts em linha (e o app injeta o do tema): a defesa contra script injetado continua sendo não interpretar HTML de usuário. Em desenvolvimento a CSP não é enviada (o Next usa eval e WebSocket). **Ao acrescentar recurso novo, não afrouxe a CSP para buscar algo de fora: o app não faz chamada externa.**
- IDs validados por regex antes de virar caminho; leitura de anexos confere se o caminho resolvido está dentro de `arquivos/` (path traversal).
- Anexos são servidos com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox`; HTML e SVG de terceiros não executam no origin do app (HTML é servido como texto).
- Upload grava com flag `wx` (nunca sobrescreve) e nome saneado, com teto de 200 MB (o arquivo passa pela memória do servidor).
- Restaurar backup só aceita nomes no padrão que o app cria (`NOME_DE_BACKUP`) e confere que o caminho resolvido está dentro de `_backups/`.
- **3.8**: `/api/assuntos` exige ids válidos e únicos (coleção de id estrito) e `normalizarAssunto()` limita tamanhos e confere `tarefaId`/`registroId` por `ID_VALIDO`. `/api/transcricoes` só lê: o caminho vem da página gravada (já conferido por `normalizarVideo`) e passa por `caminhoArquivo()`, que recusa sair de `arquivos/`; há teto por arquivo e no total. A resposta colada da transcrição passa pelo mesmo `interpretarResposta()` do registro, com tamanhos e quantidades limitados ao entrar na reunião. O clique numa notificação só abre rota interna (começa com uma barra e não com duas). A folha de impressão é desenhada pelo React com o leitor de Markdown de sempre. Visões salvas, avisos e "notificados" vêm do localStorage e passam por normalizadores com listas fechadas (`testes/versoes.test.mjs`). Nenhuma chamada externa nova: a notificação é do próprio navegador.
- **Rotina e ponto** (3.5): `/api/jornada` só aceita item cujo id é uma data de calendário de verdade ou `config` (nada de id que vire outra coisa), e os normalizadores conferem tudo o que chega: horas no formato `HH:MM`, tipo de bloco em lista fechada, `tarefaId` por `ID_VALIDO`, tamanhos e quantidades limitados. Nome e observação de bloco são desenhados como texto pelo React. O que já foi avisado (`nexo:jornadaAvisados`) é lido como lista de textos e só serve para não repetir um aviso; a rota de "Ver a rotina" é fixa.
- **Histórico de versões** (3.4): `/api/paginas/historico` só lê. O id da página passa por `ID_VALIDO` e a versão por um formato fechado de carimbo (`VERSAO_VALIDA`) antes de virarem caminho, então nenhum dos dois sai de `_historico/paginas/`. A versão é mostrada pelo leitor de Markdown, com as mesmas regras de qualquer texto (sem HTML, imagem só de `arquivos/`). O mapa é SVG desenhado pelo React com rótulos como texto; nome de página nunca vira marcação.
- **Vídeo** (3.3): `/api/midia` só grava e só serve arquivo com extensão de vídeo ou áudio (`TIPOS_DE_MIDIA`), com `nosniff`. O caminho de um vídeo local é lido da página gravada, nunca do pedido (um `?caminho=` é ignorado), então a rota não vira leitor de arquivo qualquer; mesmo um caminho malicioso gravado na página só é servido se tiver extensão de mídia. O nome enviado é saneado e o arquivo cai sempre em `arquivos/AAAA/`. A transcrição é texto: o leitor tira a marcação e a tela desenha com React. Não há player de fora, embed nem miniatura buscada na internet.
- **A resposta da IA é entrada não confiável.** O JSON colado no bloco de notas (`lib/notas.ts`) é validado campo a campo: tipos em lista fechada, datas reais no formato `AAAA-MM-DD`, tamanhos limitados (texto, itens, passos, pessoas), tarefa precisa existir e estar aberta. Ids são sempre gerados pelo app, nunca aceitos da resposta. Nada do que vem dela vira caminho, id ou código, e nada é gravado sem a prévia e a confirmação do usuário.
- **Texto colado é entrada não confiável** (2.9). O editor rico e o leitor de Markdown seguem as mesmas três regras, cobertas por `testes/texto-rico.test.mjs` e pelo e2e: (1) **HTML nunca é interpretado** na leitura (`lib/texto-rico.ts` devolve uma árvore própria e a tela desenha com React, sem `innerHTML`); no editor, HTML colado passa pelo esquema do ProseMirror, que só conhece os blocos do app; (2) **imagem só carrega se for anexo da pasta de dados** (`arquivos/AAAA/nome`, validado por `anexoDoSrc()`): `<img>` de página colada e `![](http...)` não viram imagem, então colar conteúdo de fora não dispara chamada externa nem pixel de rastreio; (3) **link só com `http`, `https` ou `mailto`** (`linkPermitido()`), aberto em nova aba com `rel="noopener noreferrer nofollow"`. Upload de imagem pelo editor aceita só PNG, JPG, GIF e WebP até 15 MB (SVG não).
- **Componentes do documento** (3.2) não abrem nenhuma porta nova: destaque e índice são texto reconhecido pelo leitor; o link de anexo só vira link se o caminho passar por `anexoDoSrc()` (dentro de `arquivos/`, sem `..`) e abre pela rota de anexos, que já serve com `nosniff` e `sandbox`; o código é só pintado (`lib/realce.ts` devolve pedaços de texto, nada é executado nem vira HTML); o cartão vivo calcula a rota pelo `linkInterno()`. HTML dentro de um destaque continua sendo texto (coberto pelo e2e).
- **A resposta colada em Perguntar segue as mesmas regras** (2.13): é desenhada pelo leitor de Markdown, as citações viram links só para destinos calculados pelo app (`destinoDaChave`), e o que fica no `localStorage` é validado por `normalizarConsulta()` (chaves de fonte em formato fechado, sem rota nem link guardados).
- **O localStorage também é entrada não confiável.** O script que aplica a aparência antes da primeira pintura (`SCRIPT_APARENCIA` em `lib/aparencia.ts`) é texto fixo, gerado só de constantes, e aplica apenas valores das listas fechadas do app (consulta com `hasOwnProperty`, para `constructor` e afins não escaparem pela cadeia de protótipos). Nada lido do localStorage vira CSS, HTML ou código. `testes/aparencia.test.mjs` cobre isso.
- Nada de telemetria, analytics ou chamadas externas em tempo de execução.

---

## 11. Decisões tomadas e pontos em aberto

- **Prioridade 1 a 10, quanto maior mais urgente.** Confirmado pelo usuário. Mudar o sentido no futuro altera o significado de um valor gravado, então **é migração** (seção 4).
- Pasta de dados é um caminho digitado (o servidor é local, então pode ler qualquer pasta do usuário). Não há seletor de pasta nativo.
- Timeline em ordem crescente por padrão (como no esboço), com alternância.
- **v2: a página inicial é a tela Hoje** e a lista de tarefas foi para `/tarefas`. A ideia é abrir o app de manhã e já saber o que fazer.
- **v2: interface com Tailwind + Shadcn/Radix + motion**, a pedido do dono (seção 13). A regra antiga de "sem Tailwind, sem libs de UI" deixou de valer.
- Lembretes são calculados na hora a partir dos dados (não há tabela de lembretes para manter). O que é preferência (adiar, tema, rotina) fica no localStorage; o que é dado (`lembrarEm`, `focoEm`, prazo do passo) fica na tarefa.
- Não usamos notificações do sistema operacional: os lembretes vivem dentro do app (sino, Hoje, ritual do dia).
- Categorias e links são salvos como lista inteira (arquivo único), tarefas são um arquivo cada, para reduzir conflito no OneDrive.
- **Rascunho do editor de registro fica no `localStorage`**, não na pasta de dados: gravar em disco a cada tecla faria o OneDrive sincronizar sem parar. Consequência aceita: vale só naquele navegador e naquele endereço (`127.0.0.1:3210` e `localhost:3210` são origens diferentes) e some se o navegador limpar os dados do site. "Atualizar a tarefa junto" só entra no rascunho se foi mexido, para um rascunho antigo não desfazer uma mudança de status feita depois. Fechar o editor guarda o rascunho em vez de perguntar "descartar?", porque assim dá para fechar no meio de uma reunião, olhar a timeline e voltar.
- **Bloco de notas** (`/notas`): existe para tirar o atrito de registrar. O usuário escreve solto e a organização fica para depois, com o Copilot. As folhas são dado (ficam em `notas.json`), a resposta vem em JSON e sempre passa por uma prévia. A folha organizada é arquivada, nunca apagada, para dar para voltar ao texto original.
- **2.7: moldura e aparência personalizáveis.** O que é gosto (cor de destaque, cantos, letra, movimento, estilo da barra lateral, fundo, ordem e visibilidade dos itens, ferramentas da barra superior, largura) é preferência do navegador. O que é organização (`tarefa.fixada`) é dado. A cor de destaque é só matiz e croma (`--matiz`, `--croma`): a luminosidade de cada token continua fixa, para o contraste do texto não depender da cor escolhida.
- **Não há "escala da interface" própria.** O `zoom` do CSS no `<html>` desalinha os menus e balões do Radix (testado na 2.7), e escalar pela fonte raiz não pega os tamanhos em px. Para aumentar tudo, vale o zoom do navegador (`Ctrl +`/`Ctrl -`), que o Edge lembra.
- **3.12: revisão visual, defeitos primeiro e piloto na tela Hoje.** O dono perguntou como melhorar mais o visual; a resposta saiu de 19 telas fotografadas em 1366x768 nos dois temas e ele pediu para seguir. Corrigido sem discussão de gosto: (1) item do "Foco de hoje" cortado pela ficha de nível na barra lateral (agora esmaece) e nome do nível truncado; (2) **lista de tarefas com os 7 títulos cortados** enquanto as outras colunas sobravam: entre 64rem e 80rem de largura as colunas ficam justas e a contagem de reuniões some (`SO_FOLGADA`), então 6 dos 7 títulos do cenário cabem inteiros; acima de 80rem volta a grade folgada; (3) **quadro** com a quinta coluna cortada: a coluna mínima foi de 220 para 200px e as cinco cabem em 1366 com a barra lateral aberta; se houver mais, a borda direita esmaece (`esmaece-fim-x`); (4) cabeçalho "Último contato" em duas linhas na tela Pessoas; (5) ícones das ações da paleta com cores decorativas, contra a regra da 3.10: ficaram neutros. Piloto, só na tela Hoje: título em destaque, motivos em selos, ferramentas da barra superior sem moldura e preenchimento no lugar de cartão dentro de cartão (ver "Piloto visual da tela Hoje"). Decisões: (a) **o piloto fica numa tela só** porque tamanho de título é regra do design system e muda todas as telas de uma vez; (b) **a explicação do motivo foi para a dica** porque era texto fixo de conselho ("Renegocie o prazo ou conclua") que se repetia todo dia; o que é do usuário (o texto do passo) continua à vista; (c) **o esmaecimento é só CSS** (animação por rolagem, sem JavaScript): onde o navegador não tem, só não esmaece.
- **3.11: formulários com o essencial primeiro (item 9, o último, da revisão de UX da 3.6).** Medido em 1366x768 com o cenário de `testes/semear.mjs`: o editor de registro abria com 9 campos inteiros na primeira tela (seis deles de saída: resumo, decisões e impedimentos vazios competindo com as anotações) e o botão de copiar o prompt em y=776, abaixo da dobra (a área visível ia até 686); a nova tarefa mostrava 7 campos. Decisões: (1) **Copilot no topo da coluna da direita**, porque é o fluxo principal e a direita é "o que vai para a linha do tempo"; título, data e hora numa linha para a esquerda caber; (2) **campos organizados recolhidos atrás de "Preencher à mão"**, e não uma coluna mais leve, porque vazios eles não dizem nada e a resposta do Copilot os abre; (3) **abrir por conteúdo é conta, não estado guardado**, então nada muda no rascunho (um rascunho da 3.10 abre igual) e não existe o caso de algo preenchido ficar escondido; (4) **"Mais opções" lembra a última escolha ao criar** (preferência), mas ao editar quem decide é o que a tarefa tem; (5) **prioridade continua de 1 a 10** (decisão do dono), só o seletor passou a agrupar os números nas três faixas que o resto da interface mostra; (6) **`Textarea` sem alça nativa, crescendo com o texto** por `field-sizing: content` (Edge e Chrome), com uma conta de altura para navegador que não tem, e teto a partir do qual rola. Primeira tela depois: registro novo 7 campos (tipo, título, data, hora, participantes, anotações, resposta do Copilot), nova tarefa 4 (título, categoria, prazo, prioridade).
- **3.10: disciplina de cor e uma regra de data (item 8 da revisão de UX da 3.6, mais as datas).** Medido com o cenário de `testes/semear.mjs`: um cartão de tarefa tinha até seis elementos coloridos, o vermelho queria dizer cinco coisas (prioridade alta, prazo vencido, bloqueada, uma categoria e o selo do menu), números de contagem ganhavam cor sem significado e selos tingidos ficavam entre 3,0 e 4,4:1. A data aparecia em sete jeitos ("20/11/26 · em 2d", "sex, 20 nov", "em 2 dias", "28/10/26"...). Decisões: (1) **cada cor tem um significado** (tabela na seção 13) e vermelho é só o que está errado ou é perigoso; (2) **prioridade virou escala neutra por peso**, sem mudar a escala nem o dado; (3) **impedimento e tarefa parada há muito tempo passaram a âmbar**, marco ficou neutro e a linha de "agora" da rotina passou ao `primary`; (4) **contraste resolvido nos tokens**, não tela por tela: cores de estado e de status mais escuras no claro e `--primary` 0,48 no claro, para o texto passar sobre o próprio tingido com qualquer cor de destaque; (5) **o branco sobre o botão primário no escuro** (era 4,1:1) passou de 4,5:1 com um token de fundo à parte (`--primary-solido`, 0,52 no escuro), e `--primary` subiu para 0,63 para `text-primary` continuar legível no escuro com qualquer cor (antes, vermelho, rosa e roxo ficavam em 4,45:1); (6) **uma regra de data** em `lib/tipos.ts`, só na tela: o que sai do app continua com a data completa, para nenhum texto copiado, prompt ou espelho mudar. Ficaram como estavam, de propósito: saldo negativo do banco de horas em vermelho (é falta, como atraso), e as linhas removidas do histórico de versões em vermelho (convenção de comparação).
- **3.9: menu e barra superior mais curtos (itens 1 e 7 da revisão de UX da 3.6).** Medido em 1366x768 com o cenário de `testes/semear.mjs`: o menu tinha 15 destinos e ia até y=731 numa área que acaba em 657 (Revisão semanal, Relatórios e Conquistas ficavam fora, e a seção Foco de hoje começava em 747, abaixo da dobra); a barra superior tinha 9 controles depois das migalhas e a migalha da tarefa não cabia. Decisões: (1) **as cinco telas de acompanhar viram um item com abas**, não uma tela nova: as rotas, os atalhos e as páginas ficaram iguais, a faixa de abas é montada pelo Shell, e assim nada que já linkava para `/radar` ou `/diario` quebrou; (2) **dá para voltar ao menu antigo** (`moldura.acompanharSeparado`), porque é mudança de lugar de coisa que o dono usa; (3) **a última aba usada é lembrada** (preferência), para o item não obrigar dois cliques a quem vive no Diário; (4) **aparência, tela cheia e atalhos num menu "Mais"**, mantendo o tema a dois cliques; (5) **a hora saiu da ficha da Agenda** (o relógio do Windows já mostra) e foi para dentro do balão; (6) **ícones com silhueta própria**. Resultado: menu até y=582, Foco de hoje em y=598 (visível), 7 controles na barra (Rotina, Agenda, Foco, Anotar, busca, sino, Mais) e as migalhas da tarefa mostrando categoria e título em 1366 e 1440.
- **3.8: dia a dia, UX e pontas do backlog, a pedido do dono ("bora fazer tudo isso").** Decisões: (1) **a daily é texto fixo**, montado do que está registrado, como a ata e o status do radar; (2) **o desfazer é atalho, não proteção**: vive na aba e sempre passa pelo Provider com rev, recusando quando a coisa mudou depois; (3) **repetição só lembra**, nunca cria tarefa sozinha (sem tarefa fantasma nas férias) e várias perdidas viram um lembrete só; (4) **"falar com" é coleção própria** (`assuntos.json`) e não campo da Pessoa, porque a maioria dos nomes não tem cadastro, e o nome fica como texto como em todo o resto; (5) **dependência mora na tarefa que espera** (`dependeDe`), o resto é conta; (6) **avisos do Windows são opcionais e só em segundo plano**, para não duplicar o aviso de dentro do app, e com o app fechado não há aviso (nada roda fora dele); (7) **visões salvas são preferência** (gosto, como os filtros), não dado; (8) **imprimir usa o PDF do próprio navegador**, sem biblioteca; (9) **a transcrição continua fora de `/api/dados`**: busca e Perguntar pedem a rota própria quando abrem.
- **3.7: página da tarefa (item 6 da revisão de UX da 3.6).** Pedido do dono: a linha do tempo começava na metade da tela em 1366x768, as propriedades editáveis pareciam texto parado, as ações do registro só apareciam com o mouse, o título era cortado antes dos botões em janela estreita e a migalha da categoria virava uma letra. Decisões: (1) a integração com o Copilot continua a um clique, mas num botão de menu no cabeçalho em vez de uma faixa fixa de 70px; (2) "..." sempre visível nos cards em vez de só `group-focus-within`, porque quem navega por Tab precisa ver que há ações antes de chegar nelas; (3) a pista de "editável" é uma setinha, não sublinhado, porque o status é um selo e o sublinhado ficaria estranho nele; (4) categoria e tags viraram editáveis no lugar, porque a seção 6 já dizia que eram e a pista visual passaria a mentir para elas; (5) larguras por container query (cabeçalho, coluna da linha do tempo, migalhas), não pela janela, porque a barra lateral recolhida muda o espaço de verdade. Passada geral: todo `group-hover...:opacity-100` em `components/` e `app/` ganhou o equivalente de foco (`group-focus-within`, `group-focus-visible` ou `focus-visible`) onde faltava.
- **3.6: acabamento de UX sem tocar em dados.** Saiu de uma revisão crítica da interface feita a pedido do dono, que achou nove problemas; esta versão atacou os quatro que não mexem em dados gravados: (1) um nome por conceito (glossário na seção 13); (2) lembretes mostrados e contados por tarefa, porque uma tarefa com quatro motivos inflava o selo vermelho e os três contadores não batiam (8 no sino, 13 dentro dele); (3) tela Hoje sem a fileira de números, que repetia o menu e a barra de status e empurrava o que é acionável para fora da tela em 1366x768; (4) piso de legibilidade (12px, contraste, alvo de clique). O que ficou para depois, por ser mudança maior e de gosto: enxugar o menu (15 destinos, que não cabem em 768px de altura) fundindo telas de "acompanhar"; a página da tarefa (linha do tempo começa na metade da tela, ações do registro só aparecem com o mouse em cima); a barra superior (migalhas esmagadas); disciplina de cor (vermelho com cinco significados); formulários que mostram tudo de uma vez. No tema escuro, o texto branco sobre `--primary` ficou em 4,1:1: escurecer o token derrubaria o contraste de `text-primary` sobre o fundo escuro, então ficou como está (resolvido na 3.10 com `--primary-solido`).
- **3.5: a rotina grava o que o usuário informou e calcula o resto.** Pedido do dono: planejar o dia em blocos (chamados, tarefas, almoço), ser lembrado do que é para fazer agora e saber a que horas sair. Decisões: (1) **padrão Brasil**, confirmado por ele: 8h de trabalho + 1h de almoço = 9h da entrada à saída, com a pausa de verdade ajustando a conta; (2) **só o expediente**, mas dá para planejar além dele e a tela marca como hora extra, em vez de impedir; (3) **banco de horas** com semana, mês e acumulado; (4) dia sem registro não entra no saldo, para o app não acusar dívida de horas em férias ou em dia em que ele não foi usado; (5) a configuração mora na mesma coleção dos dias, como o item `config`, para o plano, o ponto e a jornada serem gravados juntos, com uma revisão só; (6) todos os dias ficam em `jornada.json` (um ano de uso dá uns 250 itens pequenos); se pesar, o caminho é um arquivo por mês, **com migração**; (7) avisos dentro do app, não do Windows, como os lembretes. Ficou de fora: turno que atravessa a meia-noite, feriados automáticos e arrastar bloco de um dia para outro.
- **3.4: o mapa é conta, o histórico é arquivo à parte.** O mapa segue a regra do radar e dos lembretes: calculado dos dados, sem posições gravadas (posição arrastada à mão seria mais um dado para proteger e para dessincronizar entre PCs). O histórico fica fora de `paginas.json` porque guardar versões dentro da coleção faria ela crescer a cada edição e pesar na gravação automática; fora dela, uma versão antiga do app nem enxerga a pasta. Fica fora do backup de propósito (o backup diário já é, ele mesmo, um histórico por dia). Não há comparação lado a lado (diff) entre versões: a janela mostra a versão inteira; fica no backlog. O histórico vale só para páginas; tarefas têm `registrosRemovidos` e a lixeira.
- **3.3: o vídeo é da página, a transcrição é um arquivo.** O vídeo e a transcrição ficam em `arquivos/` (ou num caminho do computador), não dentro de `paginas.json`: uma transcrição de uma hora tem dezenas de KB e a coleção de páginas é regravada a cada pausa na digitação. (Na 3.3 isso deixava a transcrição fora da busca; desde a 3.8 ela é pedida à parte.) Vídeo de fora (link) não toca no app porque a regra de não fazer chamada externa vale mais do que a comodidade; a saída para gravação grande é apontar para o arquivo no computador, sem copiar.
- **3.2: componente é Markdown com marca, não bloco próprio.** O Tiptap permitiria nós novos (callout, abas, colunas), mas cada nó novo é um formato a mais para ler em qualquer versão e para o Copilot entender. Por isso ficaram só os componentes que têm uma escrita em Markdown que já existe por aí (destaque do GitHub/Obsidian, `[TOC]` do MkDocs) e que degradam bem. Abas e colunas dentro do texto ficaram de fora por não terem essa escrita. O realce de código é feito em casa para não somar uma biblioteca de realce ao que passa pelo proxy.
- **3.1: a árvore de páginas é um campo (`paiId`), não uma pasta.** Não há "pasta" como tipo separado: toda página pode ter páginas dentro, como numa wiki. Assim uma versão antiga do app continua vendo todas as páginas (numa lista plana) e nada some. As páginas continuam todas em `paginas.json`; se a documentação crescer a ponto de pesar na gravação automática, o caminho é um arquivo por página, **com migração**. O estado da página (rascunho, em revisão, pronta) é dado; abas abertas e o que está recolhido são preferência.
- **3.0: confiança e acabamento.** A versão fecha o plano de cinco frentes (modo reunião, páginas e citações, perguntar, radar, confiança). O que entrou nesta última: restaurar backup com volta, verificação de integridade, cabeçalhos de segurança e CSP, proxy também em leitura, menu reagrupado, "o que há de novo" e a medição de carga.
- **3.0: desempenho medido, não suposto** (`testes/carga.mjs`). Com um ano simulado (300 tarefas, 6.673 registros, 8,4 MB de JSON) nesta máquina de desenvolvimento: ler tudo 0,4 s, gravar uma tarefa 10 ms, as contas das telas entre 1 e 60 ms, abrir qualquer tela entre 0,9 e 2 s. A medição achou dois problemas, corrigidos: a busca desenhava todos os resultados de uma vez (travava mais de 60 s com um termo comum; agora desenha em lotes de 40) e tirava a marcação do Markdown de cada registro a cada tecla (agora o texto fica guardado por registro, em `WeakMap`, e `paraTextoPlano()` tem um atalho para texto sem marcação, testado contra o leitor completo). O mesmo cache vale para Perguntar. **Lista que pode crescer com os dados tem que ter lote ou "mostrar mais", e conta cara sobre todos os registros tem que guardar o resultado por objeto.**
- **3.0: sem importar `nexo-export-*.json` ainda.** Restaurar pelo app cobre o caso real (voltar a um backup da própria pasta). Importar um arquivo de fora continua no backlog, porque exige decidir o que fazer com ids que colidem.
- **2.14: a saúde de uma frente é conta, não campo.** O radar usa as mesmas réguas dos lembretes (`LIMITES`) para as duas visões não se contradizerem, e uma só própria (`RADAR.parada`). Não há "status da categoria" para o usuário manter na mão: seria mais um dado para ficar desatualizado. O status para o gestor é texto fixo de propósito (previsível, sem depender do Copilot); quem quiser um texto redigido usa Relatórios.
- **2.13: perguntar sem API é busca + prompt.** Não há como "conversar com os dados" sem um modelo, então o app faz a parte que dá para fazer localmente (achar e recortar os trechos certos, numerar as fontes) e deixa para o Copilot só a redação. A busca é por palavras, não por significado: não há embeddings nem índice, de propósito (seria mais uma coisa gravada para proteger, e dependência nova). Limite conhecido: sinônimos não casam ("bloqueio" não acha "gate"), então a tela diz quais palavras procurou. O número de fontes e o tamanho do prompt são limitados porque o Copilot do navegador corta entrada longa.
- **2.12: modo reunião.** Primeira das frentes rumo à 3.0 (as outras: perguntar ao Nexo, radar das frentes, confiança e acabamento). A reunião em andamento fica no navegador pelo mesmo motivo do rascunho de registro (gravar em disco a cada tecla faria o OneDrive sincronizar sem parar) e só vira dado quando é encerrada. A ata é texto fixo, sem IA. Nenhum campo novo nos dados: a reunião vira um registro `reuniao` comum, que qualquer versão anterior abre.
- **2.10: gamificação calculada, não gravada.** O dono pediu para gamificar o uso. A decisão foi derivar tudo dos dados que já existem, em vez de guardar pontos: assim a regra de nunca perder dados não ganha mais um arquivo para proteger, e o placar não mente (não dá para ganhar XP sem ter feito a coisa). A pontuação favorece registrar o que aconteceu, que é o hábito que o app mais precisa. Só o que é gosto (ligar, meta do dia, comemorar) e o que já foi comemorado ficam no navegador.
- **2.9: texto rico é Markdown, não um formato próprio.** O editor (Tiptap) poderia gravar JSON de blocos, mas isso prenderia os dados ao editor e quebraria a regra de abrir em qualquer versão. Markdown mantém o campo como texto: o espelho `.md` fica nativo, o Copilot recebe o texto como ele é e uma versão antiga do app continua lendo. Custo aceito: o editor escapa alguns caracteres (`&lt;`, `\*`), e quem mostra um trecho precisa passar por `paraTextoPlano()`. Sublinhado ficou de fora porque não existe em Markdown. A descrição da tarefa e os campos preenchidos pela IA continuam em texto puro.
- **2.8: quatro novidades escolhidas pelo agente a pedido do dono ("me surpreenda")**: Diário, esperando quem, modelos de tarefa e sessão de foco. Todas com campo opcional ou coleção nova, sem migração. "De quem se espera" é dado da tarefa (não preferência) porque é informação de trabalho. A sessão em andamento fica no navegador; só o resultado (a atividade com a duração) vai para a pasta de dados. A mensagem de cobrança é um texto fixo montado com o que o usuário escreveu: sem IA e sem inventar nada.
- **O espelho em Markdown é gravado mesmo com `categorias.json` ilegível** (sem o nome da categoria). Antes, uma coleção corrompida impedia o espelho de se atualizar.
- **Pessoas e times são coleções novas e opcionais** (`pessoas.json`, `times.json`). Uma versão antiga do app ignora os arquivos sem perder nada. A importação do Outlook é só por colagem ou arquivo, sem API.

### Ideias para as próximas versões (backlog, confirme com o usuário antes)
- Colar o texto de um e-mail direto num registro (a transcrição do Teams já entra pelo modo reunião desde a 3.8).
- Avisos com o app fechado (hoje os avisos do Windows só funcionam com o Nexo aberto, mesmo minimizado).
- Subtarefas/checklist próprio da tarefa (além dos passos dos registros).
- "Tarefas relacionadas" na mesma categoria (dependências já existem desde a 3.8).
- Importar de volta um `nexo-export-*.json` (restauração completa).
- Histórico de prompts gerados e respostas coladas por tarefa.
- Comparar duas versões antigas entre si (hoje a comparação é de uma versão com o texto de agora).
- Rotina: turno que atravessa a meia-noite; feriados automáticos; transformar um bloco cumprido em registro da tarefa; exportar o banco de horas em CSV.

---

## 12. Como pedir/entregar mudanças neste projeto

1. Leia este arquivo e o trecho de código envolvido.
2. Se a mudança toca dados gravados: siga a seção 4 (campo opcional + padrão, ou migração).
3. Implemente em português, no estilo existente, com o kit de `components/ui` e `components/comum.tsx` (seção 13). Dependência nova só com motivo forte.
4. `npm run typecheck && npm run build && bash testes/api.sh` (e e2e se mexeu em tela).
5. Atualize este AGENTS.md (seções 5 a 8 e 11) e o README se o comportamento para o usuário mudou. Suba a `version` no `package.json` em mudanças relevantes.
6. Commits em português, descritivos.
7. **Toda entrega vai para a `main`**, depois de os testes passarem (pedido do dono). É o que garante que uma sessão nova comece do estado mais recente: sessões diferentes não lembram umas das outras, só enxergam o repositório. Se o workflow dos scripts de cópia não rodar, gere-os à mão (seção 9) e suba junto.
8. **Antes de começar qualquer trabalho, liste as branches remotas** (`git branch -r` depois de `git fetch`) e veja se alguma tem commits que a `main` não tem. Se tiver, pare e pergunte ao dono antes de trabalhar em cima da `main`: já aconteceu de uma sessão refazer, sobre uma versão antiga, coisas que estavam prontas numa branch ainda não unida.

## 13. Interface (design system)

A interface foi refeita na v2 com **Tailwind CSS v4 + componentes no padrão Shadcn (Radix) + motion + lucide**. Pedido do dono: cara de app de desktop profissional, **nada nativo do navegador** e tudo com componente próprio e animação discreta. Siga estas regras em qualquer tela nova.

### Onde fica cada coisa
| Arquivo | O que tem |
|---|---|
| `app/globals.css` | Tailwind, tokens de cor (claro em `:root`, escuro em `.dark`), sombras, barras de rolagem, utilitários `texto-pre` e `sem-selecao`. Também as regras da aparência escolhida (`html[data-fonte]`, `[data-movimento]`, `[data-lateral]`, `[data-fundo]`), a troca de tema em círculo e a entrada em cascata dos blocos. |
| `lib/aparencia.ts` | Aparência do usuário: `ACENTOS`, `CANTOS`, `normalizarAparencia`, `aplicarAparencia`, `SCRIPT_APARENCIA`. Use `useAparencia()` (de `components/Raiz.tsx`) para ler ou mudar. |
| `lib/moldura.ts` | Moldura do usuário: `useMoldura()`, `useRecentes()`, `registrarRecente()`, `abrirPersonalizar(aba)`, `naOrdem`, `alternarNa`. |
| `components/shell/Aparencia.tsx` | Controles prontos: `SeletorTema`, `SeletorAcento`, `SeletorCantos`, `OpcoesAparencia`. |
| `components/editor/EditorRico.tsx` | Editor de texto rico. Use para campo de texto longo em que formatação ajuda: `<EditorRico valor={md} aoMudar={setMd} />` (`variante="pagina"` ocupa a altura disponível). O valor é Markdown. |
| `components/tarefa/Texto.tsx` | `TextoRico`: mostra Markdown (títulos, listas, tarefas, tabela, código com cores e copiar, destaques, imagens e arquivos anexados) com a classe `prosa`. Props: `ancoras` (títulos com âncora e `[TOC]` vira índice), `cartoes` (link interno sozinho vira cartão) e `aoIrParaTempo` (instantes de vídeo clicáveis). |
| `components/ui/*` | Kit genérico (padrão Shadcn, sem regra de negócio). `button`, `input` (Input, Textarea), `dialog` (Dialog e AlertDialog), `select` (Select e o atalho `Seletor`), `popover` (Popover, `Dica`), `menu` (DropdownMenu e ContextMenu), `controles` (Label, Checkbox, Switch, `CampoSwitch`, Slider, `Segmentado`), `data` (`Calendario`, `SeletorData`, `SeletorHora`, `somarDias`, `dataPorExtenso`), `command` (Command e `Combobox`), `chips` (`CampoChips`, `CampoSugestoes`, `AreaArquivo`), `diversos` (Badge, Card, Separator, Skeleton, Kbd, Collapsible, ScrollArea, Tabs, Progress, Table/THead/TBody/Tr/Th/Td, Toaster). |
| `components/comum.tsx` | Peças de domínio: `Pagina` (prop `destaque`: título em 22px, por enquanto só na tela Hoje), `Secao`, `Painel`, `Estatistica`, `Vazio`, `Contador`, `StatusBadge`, `SeletorStatus`, `IconeStatus`, `opcoesStatus`, `PrioBadge`, `SeletorPrioridade`, `CatTag`, `PontoCor`, `PrazoTag`, `IconeTipo`, `TipoBadge`, `AvatarPessoa`, `ChipPessoa`, `Etiqueta`, `ItemPasso`, `Campo`, `LinhaCampos`, `ChipsInput`, `Modal`, `Destaque`, `copiarTexto`, `formatarTamanho`. |
| `components/Raiz.tsx` | Provedores de interface: tema (`useTema`), confirmação (`useConfirmar`), dicas, toasts, `MotionConfig`. |
| `components/MenuTarefa.tsx` | `MenuContextoTarefa` (botão direito), `BotaoMenuTarefa` ("...") e `useAcoesTarefa()`. Toda tarefa que aparece na tela deve ter esse menu. |
| `components/useLembretes.ts` | Lembretes ativos e `adiar()`. |
| `lib/acoes.ts` | Transformações puras de tarefa: `aplicarStatus`, `comFoco`, `comLembrete`, `comPassoAlternado`, `comPrazoDoPasso`, `semRegistro`, `comRegistroRecebido`, `semRegistroMovido`, `comTarefaJuntada`, `comReferencia`, `comFixada`, `comEspera`, `comCobranca`, `comSessaoDeFoco`, `tarefaRapida`. Use sempre dentro de `atualizarTarefa(id, fn)`. |
| `lib/lembretes.ts` | Motor de lembretes (`gerarLembretes`, `resumoDoDia`, `sugestoesDeFoco`, `dataRelativa`, `saudacao`, `LIMITES`). Função pura. |
| `lib/preferencias.ts` | `usePref(chave, padrao)` (localStorage com prefixo `nexo:`) e `useRotina()`. |
| `lib/animacoes.ts` | Presets do motion: `suave`, `mola`, `lista`/`itemLista`, `subir`, `brotar`, `itemRemovivel`. |

### Nada nativo do navegador
| Em vez de | Use |
|---|---|
| `<select>` | `Seletor` (lista curta) ou `Combobox` (lista longa, com busca) |
| `<input type="date">` / `type="time"` | `SeletorData` / `SeletorHora` (valor continua string `AAAA-MM-DD` / `HH:MM`, `""` = vazio) |
| hora em que o minuto exato importa (ponto, bloco) | `CampoHora` (`components/jornada/pecas.tsx`): digitável, aceita "815" e "8:15" |
| `<input type="range">` | `SeletorPrioridade` (1 a 10) ou `Slider` |
| `<input type="checkbox">` | `Checkbox`, `CampoSwitch` ou `ItemPasso` |
| `<input type="file">` | `AreaArquivo` |
| `<datalist>` | `CampoSugestoes` ou `CampoChips` |
| `confirm()` / `alert()` | `useConfirmar()` e `toast()` do Provider |
| atributo `title` | `<Dica texto="...">` |
| `<details>` | `Collapsible` |
| `<table>` crua | `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` |
| `<textarea>` para texto longo com formatação | `EditorRico` (texto curto e simples continua em `Textarea`) |
| alça de redimensionar do `<textarea>` | nada: o `Textarea` do kit cresce sozinho até um teto (3.11) |
| mostrar texto do usuário com `innerHTML` | `TextoRico` (nunca `dangerouslySetInnerHTML`) |
| emoji como ícone | ícone do `lucide-react` (tipos de registro: `IconeTipo`; status: `IconeStatus`) |
| menu de contexto do navegador em itens | `ContextMenu` (`MenuContextoTarefa` para tarefas) |

### Layout e densidade (cara de app de desktop)
- A janela não rola. O Shell ocupa `100vh` (barra lateral, barra superior, barra de status) e cada tela usa `<Pagina>`: cabeçalho fixo e corpo com rolagem própria. Para telas com colunas que rolam separadas (quadro, página da tarefa) use `<Pagina semRolagem>` e cuide da rolagem dentro.
- Densidade compacta: controles com 32px de altura (`h-8`), texto de interface `text-[13px]`, texto de leitura `text-sm`, rótulos e metadados `text-xs` (12px). Título de página `text-lg`, de seção `text-[13px] font-semibold`.
- **Piso de legibilidade (3.6).** Nenhum texto que se lê tem menos de 12px (`text-xs`). `text-[11px]` só vale para o que não é frase: rótulo em maiúsculas, tecla (`Kbd`), contador dentro de selo, inicial de avatar e eixo de gráfico. Não use 9 nem 10px. Texto informativo não leva opacidade no `text-muted-foreground` (ele já está no limite de 4,5:1 sobre o fundo): `text-muted-foreground/80` fica para o que é decoração (separador "·", ícone); número zero e "vazio" (Sem prazo, Ninguém ainda) usam `text-muted-foreground` cheio desde a 3.10. As cores de estado e de status têm que dar 4,5:1 como texto pequeno nos dois temas, **também sobre o fundo tingido da mesma cor** (ver "Contraste dos selos" abaixo); ao mexer nelas, meça. Alvo de clique com menos de 24px ganha área invisível em volta (o `Checkbox` do kit faz isso com `after:-inset-1`).
- Espaços: 12 a 16px entre blocos irmãos (`gap-3`/`gap-4`), 32px entre seções (`Secao` já dá). Cartões com `rounded-xl border bg-card shadow-xs`.
- **Dois níveis de caixa, não três (3.12).** Borda serve para separar; quando tudo tem borda, ela deixa de separar. Dentro de um `Painel` ou cartão, um item que precisa de destaque usa preenchimento (`rounded-lg bg-muted/60`) ou uma divisória, não outra caixa com `border bg-card`. O mesmo na barra superior: controle em repouso sem moldura.
- **O que rola e é cortado por outra coisa esmaece (3.12).** `esmaece-fim-y` e `esmaece-fim-x` (`app/globals.css`) apagam os últimos 2rem de quem rola enquanto ainda há conteúdo para lá, e somem ao chegar no fim. Vão no próprio elemento que tem `overflow-*-auto`. É animação por rolagem (`animation-timeline: scroll()`), sem JavaScript; sem rolagem ou sem suporte, nada muda. Use quando a lista encosta em algo fixo (a navegação da barra lateral, o quadro).
- **Numa tabela, a coluna principal é a última a ser cortada (3.12).** Antes de deixar o título virar reticências, aperte ou esconda as colunas de apoio na largura intermediária (ver `GRADE` e `SO_FOLGADA` em `components/tarefas/ListaTarefas.tsx`). Cabeçalho de coluna não quebra linha (`whitespace-nowrap`).
- **Cuidado com a ordem das classes no `cn()`**: o `tailwind-merge` descarta um `leading-*` que venha antes de um `text-*` (tamanho de letra traz altura de linha junto). Escreva o tamanho primeiro e o `leading-*` depois.
- Cores só por token (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`, `text-destructive`, `text-sucesso`, `text-alerta`, `text-info`, `bg-st-andamento/12`...). Nunca hexadecimal em componente. A única cor livre é `categoria.cor`, que é dado do usuário e entra por `style`.
- Tema claro e escuro por classe `.dark` no `<html>` (`useTema()`), com opção "sistema". Toda tela tem que ficar boa nos dois.
- **A cor de destaque é do usuário.** `--primary`, `--primary-solido`, `--ring`, `--accent` e `--sidebar-accent` derivam de `--matiz` e `--croma`. Em componente, use sempre os tokens (`bg-primary`, `text-primary`, `ring-ring`); nunca escreva um matiz fixo (275, "indigo"), senão a peça não acompanha a escolha. O mesmo para os cantos: use `rounded-md/lg/xl`, que derivam de `--radius`.
- **Fundo cheio com texto por cima (3.10).** Fundo de destaque com texto claro (botão primário, selo de foco, dia escolhido, caixa marcada) usa `bg-primary-solido` com `text-primary-foreground`, nunca `bg-primary`: no escuro `--primary` é claro o bastante para `text-primary` ler sobre o fundo escuro, e por isso não serve de fundo para texto branco; `--primary-solido` é mais fundo (no claro os dois são iguais). Fundo cheio de cor de estado (`bg-sucesso`, `bg-destructive`, `bg-alerta`: o número do sino, o selo de feito) leva `text-background`, que é claro no tema claro e escuro no escuro; botão `destructive` já faz isso no escuro. Tecla (`Kbd`) dentro de botão cheio: `border-white/25 bg-black/12 text-white`.

### Formulários (3.11)
- **O essencial primeiro.** Formulário que o usuário abre muitas vezes mostra à vista só o que quase sempre se preenche; o resto fica num `Collapsible` ("Mais opções") ou numa seção que recolhe. O botão recolhido diz o que há dentro (lista dos campos, ou um resumo dos valores quando há algum).
- **O que tem valor nunca fica escondido.** Seção com campo preenchido abre sozinha ao editar, ao voltar de um rascunho ou quando o Copilot preenche. Calcule isso do estado do formulário; não guarde "aberto" no rascunho.
- Campo escondido continua contando para `useFecharComCuidado` e para o rascunho: o estado mora no formulário, não dentro do `CollapsibleContent` (que desmonta o conteúdo fechado).
- `Ctrl Enter` salva de qualquer campo (o `onKeyDown` fica no contêiner do formulário). O foco inicial vai para o campo marcado com `data-foco-inicial` (o `Modal` respeita a marca mesmo que não seja o primeiro campo).
- **`Textarea`** (`components/ui/input.tsx`): sem alça nativa. `rows` vira a altura mínima (`--linhas`), o campo cresce com o texto (`field-sizing: content`; sem suporte, mede pelo `scrollHeight`) e para no teto, que por padrão é o menor entre 20rem e 45% da janela, rolando por dentro. `min-h-*` e `max-h-*` na classe trocam o piso e o teto. Comece com poucas linhas (2 ou 3): ele cresce.
- **Prioridade**: `SeletorPrioridade` agrupa 1 a 4, 5 a 7 e 8 a 10 com o nome da faixa embaixo (a do valor atual em negrito, `data-atual`) e expõe `data-nivel` no grupo. O dado continua de 1 a 10.

### O que cada cor quer dizer (3.10)
Cor é sinal, não enfeite. Antes de pintar algo, ache o significado nesta lista; se não estiver nela, fica neutro (`text-foreground`, `text-muted-foreground`).

| Token | Quer dizer | Exemplos | Não use para |
|---|---|---|---|
| `destructive` (vermelho) | **está errado ou é perigoso** | prazo vencido (`PrazoTag` com `CalendarX`), erro, arquivo ilegível, ação de excluir, selo de "tem coisa crítica" (sino, contador do menu), categoria "em risco" no radar | prioridade, tarefa parada há muito tempo, impedimento, linha de "agora" |
| `alerta` (âmbar) | **pede atenção** | prazo em até 3 dias, bloqueadas (número), pede atenção, aguardando há muito, parada, impedimento, lembrete de voltar que chegou, hora extra | contagem neutra, sequência de dias, "em aberto com" |
| `sucesso` (verde) | **deu certo** | concluída(s), em dia, meta batida, saldo positivo de horas | contagem de registros, avanços ou passos que não é "concluído" |
| `primary` (destaque do usuário) | **é seu / está escolhido / é ação** | botão principal, item ativo, foco de hoje, seleção, link, linha de agora na rotina | estado bom ou ruim |
| `info` (azul) | tipo "reunião" e destaque do tipo "nota" | `TipoBadge` | estado |
| `st-*` (status) | **paleta fechada do status da tarefa** | `StatusBadge`, `IconeStatus`, colunas do quadro | outra coisa que não seja status |
| `categoria.cor` | dado do usuário | ponto da categoria (`PontoCor`/`CatTag`) | |

- **Prioridade não tem cor de alarme.** `PrioBadge` e `SeletorPrioridade` são uma escala neutra por peso, legível sem enxergar cor: contorno (1 a 4), preenchido suave (5 a 7), preenchido forte (8 a 10, `bg-foreground/85 text-background`). O número continua escrito. Uma prioridade 10 em dia não pode gritar como um atraso.
- **Bloqueada e atraso não se confundem pela cor.** O status "Bloqueada" é um selo tingido com o ícone `Ban`; o atraso é texto com o ícone `CalendarX` e "N dias de atraso". O número de bloqueadas (`Estatistica`) é âmbar.
- **Categoria aparece uma vez por cartão**: o ponto com o nome. Nada de borda colorida repetindo a mesma informação (`CardTarefa`, cartão do foco de hoje).
- **Número só tem cor quando a cor diz algo** (`Estatistica`, tipo `TomNumero`): `perigo` para prazo vencido e em risco, `alerta` para pede atenção e bloqueadas, `sucesso` para concluídas e em dia. Contagem neutra (abertas, passos em aberto, registros, avanços, dias ativos, sequência) fica em `text-foreground`; zero fica em `text-muted-foreground`, sem cor. Vale também para números grandes fora da `Estatistica` (marcadores de "Progresso de hoje", painel de Pendências).
- **Contraste dos selos.** Selo e contador tingido (`Badge`, `StatusBadge`, `PrioBadge`, `TipoBadge`, `Etiqueta`, `Contador`, contagem do menu) é texto da cor X sobre `bg-X/10` a `bg-X/18`. Por isso as cores de estado e de status são escuras no claro (L entre 0,47 e 0,5 em OKLCH) e claras no escuro: o texto passa de 4,5:1 sobre o tingido sem precisar de token de texto à parte. `--primary` é 0,48 no claro (passa sobre `bg-primary/15` com qualquer cor de `ACENTOS`) e 0,63 no escuro. Medido com o cenário de demonstração nas telas Hoje, Tarefas (grade, lista e quadro), tarefa, Pendências, Radar e Diário, nos dois temas, com as cores índigo, laranja, vermelho, âmbar, verde, ciano e grafite: nenhum texto abaixo de 4,5:1. Ao criar um selo, use as mesmas proporções (`/10` a `/18`) e meça.
- Números em `tabular-nums`. Textos longos do usuário em `texto-pre` (preserva quebras). Rótulos e botões em `sem-selecao`.

### Animação
- `motion` (`import { motion, AnimatePresence } from "motion/react"`) com os presets de `lib/animacoes.ts`. Listas entram em cascata (`lista` + `itemLista`), itens que somem usam `AnimatePresence` + `layout`, pílulas e seleções deslizam com `layoutId`.
- Rápido e discreto: 150 a 250ms, nada que atrase o uso.
- **O usuário escolhe quanto a interface se mexe** (`aparencia.movimento`): "completo" (respeita o "reduzir movimento" do Windows), "sutil" (só esmaecer: o motion roda com `reducedMotion="always"` e o CSS zera deslocamentos e escalas do tw-animate) e "nenhum" (`MotionGlobalConfig.skipAnimations` e transições de CSS zeradas). Por isso, anime com `motion` ou com as classes do tw-animate (`animate-in`, `fade-in-0`...), que obedecem a essa escolha; não crie `@keyframes` soltos sem olhar `html[data-movimento]`.
- Cada tela entra com `app/template.tsx`; `Secao` e `Painel` dentro de `Pagina` entram em cascata por CSS; o cabeçalho da `Pagina` ganha sombra quando o conteúdo rola por baixo; a troca de tema abre em círculo a partir do clique (View Transitions, só no movimento completo).
- Hover e foco sempre visíveis (anel `ring-ring`). Todo botão só de ícone tem `aria-label` e `Dica`.
- **Nada só no hover (3.7).** Botão que aparece ao passar o mouse (`opacity-0 group-hover/x:opacity-100`) tem que aparecer também pelo teclado: `group-focus-within/x:opacity-100` no grupo ou `focus-visible:opacity-100` no próprio botão. Quando a ação importa (editar, excluir, mover), prefira um "..." sempre visível com o menu, como nos registros da linha do tempo.
- **Valor editável no lugar (3.7)**: uma setinha discreta no fim do valor (`ChevronDown`, `size-3`, `opacity-50`) é a pista estável de que ele abre um seletor, mais fundo no hover, no foco e com o seletor aberto (`data-[state=open]:bg-accent`). Use a mesma cara em qualquer faixa de propriedades (ver `EDITAVEL` em `components/tarefa/Propriedades.tsx`).
- **Uso raro vai para o menu "Mais" (3.9)**: a barra superior guarda só o que se usa todo dia. Controle novo de uso raro entra como item do `MenuMais` (`components/shell/Ferramentas.tsx`), não como botão solto, e respeita `moldura.ferramentasOcultas` se for escondível.
- **Botões que encolhem**: em cabeçalho ou barra que pode ficar estreita, o rótulo some por container query (`hidden @5xl/cabecalho:inline`) e o botão fica quadrado com `aria-label` e `Dica`. Nunca deixe o título da tela ser cortado antes dos botões.

### Datas na tela: uma regra só (3.10)
As funções moram em `lib/tipos.ts` (e `dataRelativa`/`dataLocal` continuam exportadas também por `lib/lembretes.ts`):

| O que | Função | Como sai |
|---|---|---|
| data absoluta | `dataCurta(iso)` | `20/11`; de outro ano, `20/11/25` |
| data relativa | `dataRelativa(iso)` | `hoje`, `amanhã`, `ontem`, `em 2 dias`, `há 4 dias` (sempre por extenso) |
| prazo relativo | `prazoRelativo(iso)` | igual, mas o que passou é `1 dia de atraso`, `3 dias de atraso` |
| as duas juntas | `dataComRelativo(iso, { prazo, ate })` | `20/11 · em 2 dias`; o relativo só entra até `ate` dias (padrão 7) ou quando é atraso |
| data e hora | `formatarDataHora(carimbo)` | `13/11 14:32` |

- `PrazoTag` (cartões, listas, pendências, quadro) usa `dataComRelativo` com `prazo`; o `SeletorData` mostra `dataComRelativo` sempre com o relativo (`ate: Infinity`) e ganhou a prop `prazo` (passe quando o campo é prazo e a coisa está aberta). Não ponha um segundo aviso de "em N dias" ao lado de um `SeletorData`: ele já diz.
- **Nada de abreviação** (`2d`, `em 3d`): nem no quadro, onde o texto inteiro coube. Duração em chip também vai por extenso (`8 dias`).
- **Título de um dia** pode ser por extenso (`quarta-feira, 18 de novembro` na saudação, nos cabeçalhos do Diário, da Rotina e dos Relatórios por dia, e a ficha da Agenda): é título, não data solta. `dataPorExtenso()` (`components/ui/data.tsx`) fica para isso e para `aria-label`.
- **O que sai do app não muda**: espelho em Markdown, prompts do Copilot, textos de "Copiar" (status do radar, ata, pauta, daily, banco de horas, cobrança, lista de pendências da pessoa), folha de impressão e o texto gravado nos marcos continuam com `formatarData()` (data completa, `20/11/26`).

### Texto e testes
- Português do Brasil, tom direto, sem travessão. Erros dizem o que aconteceu e o que fazer.
- **Um nome por conceito (glossário, 3.6).** Em rótulo, título, botão e aviso, use sempre o mesmo nome:

  | Conceito | Nome na interface | Não use |
  |---|---|---|
  | `Categoria` | **categoria** | "assunto" e "frente" como nome (em frase explicativa, "assunto" pode aparecer para dizer o que é uma categoria) |
  | `Passo` | **passo**; os não feitos são **passos em aberto** | "pendente(s)" como substantivo, "próximos passos em aberto" |
  | lista dos passos em aberto | **Pendências** (a tela e o painel da tarefa) | |
  | campo do registro | **Próximos passos** (é o nome do campo e da seção do contrato do Copilot) | |
  | `tarefa.lembrarEm` | **lembrete de voltar** / "Lembrar de voltar em" | "follow-up" |
  | alertas do motor | **lembretes**; a lista na tela Hoje é **Precisa de você** | |
  | timeline | **linha do tempo** | "timeline" |
  | `tarefa.focoEm` | **foco de hoje**; o cronômetro é a **sessão de foco** | |

  No código os nomes antigos continuam (`frente` no radar, `followup` no tipo do lembrete, `secao "assuntos"` na moldura, `data-slot="timeline"`): renomear ali não muda nada para o usuário e mexeria em preferência gravada e em testes. O texto de "Copiar status" do Radar continua dizendo "frentes", porque é prosa para o gestor, não rótulo da interface.
- Os componentes do kit têm `data-slot` (ex.: `data-slot="seletor-data"`, `"seletor-status"`, `"passo"`, `"estatistica"`). O `testes/e2e.cjs` usa esses atributos e textos visíveis; ao criar componente novo que o teste precise achar, ponha um `data-slot`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
