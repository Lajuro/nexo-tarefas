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
- A **pasta de dados nunca fica dentro da pasta do app**. A configuração fica em `~/.nexo/config.json` (ou na variável `NEXO_DATA_DIR`). Atualizar o app não toca nos dados.

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
  markdown/paginas/<slug>--<id>.md  espelho legível de cada página, gerado (pode apagar)
  tarefas/<id>.json              uma Tarefa por arquivo, com a timeline inteira dentro
  arquivos/AAAA/<base36>-<nome>  documentos anexados (gravação com flag "wx": nunca sobrescreve)
  markdown/<slug>--<id>.md       espelho legível, gerado (pode apagar)
  _backups/AAAA-MM-DD/           backups diários
  _backups/manual-*/             backups manuais (botão em Configurações)
  _backups/pre-migracao-*/       antes de migração de formato
  _lixeira/                      tudo que foi "excluído"
```

### Modelo (fonte da verdade: `lib/tipos.ts`)
- **Tarefa**: `id, rev, titulo, descricao, categoriaId|null, status, prioridade (1..10, maior = mais urgente), prazo (AAAA-MM-DD|null), tags[], registros[], panoramaIA?{texto, geradoEm}, criadaEm, atualizadaEm, concluidaEm?`, e opcionalmente `registrosRemovidos[]`. Desde a v2 (campos opcionais, sem migração): `lembrarEm?` (AAAA-MM-DD|null: follow-up, "me lembre de voltar nisso") e `focoEm?` (AAAA-MM-DD|null: dia em que foi escolhida como foco; só vale como foco se for hoje). Desde a 2.7: `fixada?` (boolean: presa na barra lateral; é dado, para valer em qualquer PC). Desde a 2.8: `esperando?` (`{ quem, oQue, desde (AAAA-MM-DD), cobradoEm? } | null`: de quem a tarefa espera retorno; só faz sentido em `aguardando` e é limpo por `aplicarStatus()` quando a tarefa sai desse status, virando observação do marco).
- **Status**: `a_fazer | em_andamento | aguardando | bloqueada | concluida | cancelada`. "Abertos" = os quatro primeiros (`STATUS_ABERTOS`).
- **Registro** (cada card da timeline): `id, tipo, data, hora?, titulo, participantes[], anotacoes (brutas), resumoIA, decisoes, proximosPassos: Passo[], impedimentos, respostaIABruta?, notaId? (folha do bloco de notas de onde nasceu), referencia? (conhecimento que vale para o assunto todo), duracaoMin? (minutos de uma sessão de foco; 0 = não veio de uma sessão), alteracoes?{status?, prioridade?, prazo?: {de, para}}, criadoEm, atualizadoEm`.
- **TipoRegistro**: `reuniao | atividade | impedimento | decisao | nota | marco`. `marco` é gerado pelo sistema (tarefa criada, mudança de status; o marco de status `concluida` é o card verde "Concluída" do esboço).
- **Passo**: `id, texto, feito, feitoEm?, responsavel?, prazo?`. As "pendências" do app são todos os passos com `feito=false` de tarefas abertas.
- **Categoria**: `id, nome, descricao, cor, arquivada?, criadaEm, atualizadaEm`.
- **LinkDoc**: `id, tipo ("link"|"arquivo"), titulo, url?, arquivo? (caminho relativo em arquivos/), nomeArquivo?, tamanho?, descricao, tags[], tarefaId?, categoriaId?, criadoEm`.
- **Pessoa**: `id ("pe..."), nome, apelidos[], email, cargo, area, ajudaCom, anotacoes, categoriaIds[], tags[], arquivada?, origem? ("manual"|"registros"|"outlook"), criadaEm, atualizadaEm`. Registros e passos continuam guardando nomes como texto; a ligação com o cadastro é feita na leitura (`lib/pessoas.ts`, `chaveNome` contra `nome` e `apelidos`). Nada é reescrito nas tarefas.
- **Time**: `id ("ti..."), nome, descricao, cor, responsavelIds[], membroIds[] (inclui os responsáveis), categoriaIds[], arquivado?, criadoEm, atualizadoEm`. Os vínculos com pessoas ficam no Time.
- **Nota** (folha do bloco de notas): `id ("n..."), titulo, texto, arquivadaEm? (carimbo|null), gerou?: FrutoDaNota[], sobras? (o que a IA não encaixou e o usuário não guardou), criadaEm, atualizadaEm`. `FrutoDaNota` = `{ tipo ("registro"|"tarefa"|"passo"), tarefaId, registroId?, rotulo }`: o que nasceu da folha quando ela foi organizada. Coleção nova e opcional, sem migração.
- **Modelo** (modelo de tarefa): `id ("mo..."), nome, quando (quando usar), titulo (sugerido), descricao, categoriaId|null, prioridade, tags[], passos[] (textos), prazoEmDias? (a partir da criação), usos?, criadoEm, atualizadoEm`. Coleção nova e opcional, sem migração.
- **Pagina** (página de conhecimento, 2.11): `id ("pg..."), titulo, texto (Markdown), categoriaId|null, tags[], arquivadaEm?, criadaEm, atualizadaEm`. Coleção nova e opcional, sem migração.
- **Link interno** (2.11): dentro de qualquer texto em Markdown, `[rótulo](nexo:tarefa/<id>)`, `nexo:pagina/<id>`, `nexo:categoria/<id>` ou `nexo:pessoa/<nome codificado>`. É só texto no campo: versão antiga do app mostra o link cru. A rota de destino é calculada por `linkInterno()` (`lib/texto-rico.ts`), nunca lida do texto.
- **Texto rico = Markdown no mesmo campo de texto** (2.9, sem migração): `nota.texto` e `registro.anotacoes` são editados no editor rico e guardam **Markdown**. Continua sendo uma string no JSON: versões antigas do app abrem e mostram o texto com a marcação à vista, sem perder nada. O texto antigo (puro) é Markdown válido; uma quebra de linha simples conta como quebra (`breaks: true`). O editor escreve `<` como `&lt;` e põe `\` antes de `* _ [ ] ~` soltos: por isso, **para mostrar um trecho como texto use `paraTextoPlano()`** (`lib/texto-rico.ts`), nunca o campo cru. Imagem colada vira arquivo em `arquivos/AAAA/` e no texto fica `![nome](arquivos/AAAA/arquivo.png)` (caminho relativo à pasta de dados; no espelho `.md` vira `../arquivos/...`). Os demais campos (`resumoIA`, `decisoes`, `impedimentos`, `descricao`) continuam sendo digitados como texto puro, mas são mostrados pelo mesmo leitor de Markdown.
- IDs: `novoId(prefixo)` = prefixo + base36(timestamp) + aleatório. Validados no servidor por `ID_VALIDO` (`/^[a-zA-Z0-9_-]{1,80}$/`).
- Datas de calendário são strings `AAAA-MM-DD` no fuso local (`hojeISO()`); carimbos são ISO UTC (`agoraISO()`).

### Preferências de interface (localStorage, não são dados)
Ficam no navegador com o prefixo `nexo:` (via `usePref` de `lib/preferencias.ts`) e podem ser perdidas sem prejuízo: `tema`, `lateralRecolhida`, `ordem`, `filtroStatus`, `visaoTarefas`, `recentesPrimeiro`, `agrupamentoPendencias`, `soMeus`, `rotina` (`{ ultimoPlanejamento, ultimaRevisao, abrirSozinho }`) e `lembretesAdiados` (`{ idDoLembrete: dataAtéQuando }`) e `meusNomes` (lista de nomes pelos quais o usuário aparece como responsável de um passo), `aparencia` (`{ acento, cantos, fonte, movimento, lateral, fundo }`, ver `lib/aparencia.ts`), `moldura` (largura da barra lateral, ordem e itens escondidos, seções, ferramentas da barra superior, barra de status, ver `lib/moldura.ts`) e `recentes` (ids das últimas tarefas abertas) e `sessao` (a sessão de foco em andamento: `{ tarefaId, inicio, alvoMin, fim?, nota? }`), `jogo` (`{ ligado, meta, celebrar }`) e `jogoVisto` (o que já foi comemorado: `{ conquistas[], nivel, meta, concluidas }`). Tudo o que é lido do localStorage passa por uma função `normalizar*()` com listas fechadas: valor desconhecido vira o padrão. O `usePref` já nasce com o valor lido (não monta no padrão para depois "pular"), o que é seguro porque nada que depende de preferência é desenhado no servidor. Nada que o usuário não possa perder vai para o localStorage. As únicas coisas além de preferência que moram lá são os **rascunhos do editor de registro** (`nexo:rascunho:...`), o **texto pendente de uma folha do bloco de notas** (`nexo:nota-pendente:...`), o **texto ainda não guardado do "Anotar rápido"** (`nexo:anotarPendente`) **o que foi escrito sobre uma sessão de foco ainda não registrada** (dentro de `nexo:sessao`) , **a reunião em andamento no modo reunião** (`nexo:reuniao:<tarefaId>`) e **a pergunta com a resposta colada na tela Perguntar** (`nexo:pergunta`), ver seção 4: são cópia de segurança do que ainda não foi salvo, não dado. O registro só existe de verdade quando é gravado na pasta de dados.

---

## 6. Funcionalidades (telas)

| Rota | O que faz |
|---|---|
| `/` Hoje | Página inicial. Saudação, captura rápida de tarefa, **foco de hoje** (tarefas escolhidas, com os passos marcáveis ali), **precisa de você** (lembretes ativos, com adiar), faixa da semana (prazos dos próximos 7 dias), aguardando retorno, bloqueadas e paradas, progresso do dia. |
| `/tarefas` | Lista de tarefas com números, filtros (texto, categoria, status), ordenação e três visões: **grade**, **lista** e **quadro** (Kanban por status, arrastar muda o status). Aceita `?status=`, `?cat=`, `?f=atrasadas` e `?f=foco`. |
| `/tarefas/[id]` | Propriedades editáveis no lugar (categoria, status, prioridade, prazo, follow-up, tags), botões de prompt (Panorama, Preparar reunião), **timeline** (ordem crescente ou decrescente, lembrada), **faixa "Esperando"** no cabeçalho quando a tarefa aguarda terceiros (de quem, o quê, há quantos dias, copiar cobrança, cobrei hoje), lateral com Pendências, tempo em sessões de foco, Links e docs, Pessoas envolvidas e último Panorama IA. |
| `/tarefas/[id]/reuniao` | **Modo reunião**: pauta à esquerda (pendências da tarefa para marcar como resolvidas, aguardando retorno, o que está com cada participante em outras frentes, últimas decisões, onde a conversa parou), anotações no editor rico ao centro e captura à direita (decisões, próximos passos com responsável e prazo, impedimentos). Relógio, "Copiar pauta", "Encerrar e salvar" e a **ata** em texto para copiar. |
| `/pendencias` | Todos os próximos passos em aberto, agrupados por tarefa, por prazo ou por pessoa, com "só os meus", prazo próprio de cada passo e desfazer ao concluir. |
| `/notas` | **Bloco de notas**: folhas de texto livre, escritas sem escolher tarefa nem campo (abas Abertas e Arquivadas), no **editor de texto rico** (blocos pelo menu `/`, listas de tarefas, tabelas, imagens coladas). "Organizar com o Copilot" copia um prompt com a folha e as tarefas abertas, recebe um **JSON** de volta e mostra uma **prévia** (registro em tarefa existente ou numa tarefa nova da própria folha, tarefa nova, passo antigo concluído, e as sobras como nota para guardar onde o usuário quiser). Na prévia dá para trocar a tarefa de destino, criar uma tarefa nova digitando o nome e ajustar a data do que aconteceu. Só grava o que o usuário confirmar, e a folha é arquivada com a lista do que criou. `/notas?n=<id>` abre uma folha específica. |
| `/paginas` | **Páginas de conhecimento**: documentos em Markdown no editor rico (processos, passo a passo, quem procurar), com categoria, busca, arquivar e gravação automática. Dentro do texto, `@` cita uma tarefa, pessoa ou outra página (link interno). Cada página mostra "quem aponta para cá". `/paginas?p=<id>` abre uma página; `?cat=<id>` começa uma página nova naquele assunto. |
| `/perguntar` | **Perguntar ao Nexo**: o usuário escreve uma pergunta, o app acha os trechos do histórico que têm a ver (registros, tarefas, páginas, folhas, links, pessoas), numera como F1, F2... e monta o prompt para o Copilot responder só com eles. A resposta colada volta com as citações clicáveis e pode virar página de conhecimento. `?q=` começa com a pergunta escrita. |
| `/categorias` e `/categorias/[id]` | Cards de categoria com contagens e progresso; a página da categoria mostra a **referência do assunto** (registros marcados como referência em qualquer tarefa dela), tarefas abertas, histórico (concluídas/canceladas), links, pessoas do assunto e o prompt de panorama. Arquivar/desarquivar. |
| `/pessoas` | Abas **Pessoas** (cadastradas e nomes sem cadastro, com cargo, times e "pode ajudar com") e **Times** (`?aba=times`, cartões com cor e membros). `?p=Nome` é o detalhe da pessoa (o que pode ajudar, times, passos com ela, tarefas em comum, histórico); `?time=<id>` é o detalhe do time (responsáveis, membros, passos, categorias, tarefas). Botão **Importar do Outlook** (colar, CSV ou vCard, sem API). |
| `/links` | Banco de links e arquivos com busca, filtro por tipo e tag, vínculo a tarefa/categoria. Upload salva cópia em `arquivos/`. |
| `/revisao` | **Revisão semanal** guiada: passa por todas as tarefas abertas, das mais esquecidas para as mais recentes, com decisões rápidas (status, prioridade, prazo, follow-up, foco). |
| `/radar` | **Radar das frentes**: uma frente por categoria (mais "Sem categoria"), com a saúde (em risco, parada, pede atenção, em dia), os motivos, números, movimento das últimas 8 semanas e próximo prazo. Os contadores do topo filtram. Linha de prazos das próximas 6 semanas por frente (tarefas, passos e follow-ups; vencidos à parte). "Copiar status" gera o texto para o gestor, sem IA. É só leitura (`lib/radar.ts`). |
| `/diario` | **Diário**: tudo o que aconteceu em todas as tarefas, dia a dia (registros, marcos e passos concluídos no dia em que foram feitos), com um **mapa de atividade** das últimas 36 semanas (clicar num dia mostra só ele), números dos últimos 30 dias, sequência de dias úteis e filtros por tipo, categoria e pessoa. "Copiar" gera texto simples do dia ou do que está na tela, sem IA. É só leitura (`lib/diario.ts`). |
| `/relatorios` | Escolhe período (7/15/30 dias, mês, datas livres) e categoria, mostra o que entra e copia o prompt de relatório. |
| `/conquistas` | **Conquistas** (gamificação): nível e XP, gráfico de XP dos últimos 14 dias, meta do dia, sequência de dias úteis, recorde, e as conquistas por grupo com o progresso de cada uma. Tudo calculado dos dados (`lib/jogo.ts`), nada gravado. Pode ser desligada. |
| `/busca?q=` | Busca sem acento/maiúscula em tarefas, registros (todos os campos), links, pessoas e times. Com várias palavras, o resultado precisa ter **todas**, em qualquer ordem e em qualquer campo do mesmo item; o trecho mostra e destaca cada uma. O resultado de um registro abre a tarefa já rolada até ele (`/tarefas/<id>?r=<registroId>`). |
| `/configuracoes` | Pasta de dados (trocar/copiar caminho), estatísticas, versão do formato, backup manual, exportar tudo em JSON, **modelos de tarefa** (usar, editar, excluir), lixeira com restaurar, aparência (tema), rotina e lembretes, conquistas e meta do dia (ligar/desligar, meta, comemorar), "como você aparece nos passos" (seus nomes), atalhos. |

### Moldura (components/Shell.tsx)
- **Barra lateral** (`components/shell/Lateral.tsx`), recolhível (`Ctrl B`): navegação com contadores, e as seções **Foco de hoje** (tarefas em foco com o próximo passo e um anel de progresso), **Fixadas** (`tarefa.fixada`, pelo menu da tarefa), **Recentes** (últimas tarefas abertas, no localStorage) e **Assuntos**. Cada seção recolhe com um clique no título. A largura se ajusta arrastando a borda direita (setas com a borda em foco, dois cliques voltam ao padrão, arrastar bem para dentro recolhe).
- **Barra superior** (`components/shell/BarraSuperior.tsx`): voltar/avançar, migalhas e as **ferramentas** de `components/shell/Ferramentas.tsx`: **Agenda** (dia e hora; ao abrir, prazos, passos com data e follow-ups das próximas duas semanas), **Foco** (passos do foco marcáveis sem trocar de tela), **Anotar rápido** (tarefa ou folha do bloco de notas de qualquer tela, atalho `A`; o texto digitado fica guardado no navegador até virar tarefa ou folha), busca, sino, **aparência** (tema, cor de destaque, cantos), tela cheia e atalhos. Botão direito na barra abre "escolher o que aparece".
- **Barra de status**: pasta de dados, "Salvando..."/"Salvo às HH:MM", contagens, versão. Pode ser escondida; sem ela, o "Salvando..." aparece na barra superior só enquanto grava.
- **Personalizar** (`components/shell/Personalizar.tsx`, aberto pelo botão do rodapé da barra lateral, pela barra superior, pela paleta e por Configurações): painel que desliza pela direita **sem escurecer o app** (em tela larga o app encolhe para ele caber ao lado), para ver cada mudança na hora. Abas: **Aparência** (tema, cor de destaque, cantos, letra, estilo da barra lateral, fundo das telas, movimento), **Lateral** (ordem e visibilidade dos itens de navegação e das seções, títulos de grupo, contadores, largura) e **Superior** (quais ferramentas aparecem, barra de status). Tudo é preferência do navegador (`lib/aparencia.ts` e `lib/moldura.ts`), nada toca os dados. Item de navegação escondido continua na paleta e nos atalhos `G`.
- **Paleta de comandos** (`Ctrl K` ou `/`): vai para qualquer tela, tarefa, categoria ou pessoa e dispara ações.
- **Sino**: lembretes ativos a um clique, com adiar.
- **Onboarding**: na primeira vez pede o caminho da pasta de dados (sugere `%OneDriveCommercial%\Nexo` ou `%OneDrive%\Nexo`).
- **Atalhos** (lista oficial em `components/shell/navegacao.ts`, mostrada com `?`): `N` nova tarefa, `D` planejar o dia, `A` anotar rápido, `G` depois `H/T/P/N/C/E/L/D/S/R/Q` para navegar (`G N` = Notas, `G D` = Diário, `G Q` = Conquistas, `G A` = Páginas, `G U` = Perguntar, `G F` = Radar das frentes), `Ctrl Enter` salva formulários, `Esc` fecha.
- Abre como aplicativo: `Iniciar Nexo.cmd` usa o modo `--app` do Edge (janela própria) e há `app/manifest.ts` para instalar pelo navegador.

### Rotina e lembretes (o app lembra o usuário do que fazer)
- **Motor de lembretes** (`lib/lembretes.ts`, função pura sobre os dados): prazo vencido, prazo hoje, prazo chegando (3 dias), passo com prazo vencido ou para hoje, follow-up (`lembrarEm`) chegou, bloqueada sem novidade (3 dias), aguardando retorno (5 dias), parada (7 dias), passos antigos (14 dias) e em andamento sem próximo passo. Os limites estão em `LIMITES`.
- Lembretes aparecem no sino, na tela Hoje e nos contadores da barra lateral. **Adiar** esconde um lembrete até uma data e fica só no localStorage.
- **Planejar o dia** (`components/rotina/PlanejarDia.tsx`): ritual em 3 passos (o que ficou para trás, escolher os focos, pronto). Abre sozinho na primeira visita do dia (desligável) e pelo atalho `D`.
- **Foco de hoje**: `tarefa.focoEm = hoje`. Vale só no dia; no dia seguinte a tarefa deixa de ser foco sem precisar limpar nada.
- **Follow-up**: `tarefa.lembrarEm`. Definido no formulário, na página da tarefa ou pelo menu da tarefa ("Lembrar de voltar").
- **Revisão semanal**: a barra lateral sinaliza quando faz 7 dias ou mais desde a última.
- **"Meu" passo** (`passoEhMeu()` em `lib/lembretes.ts`): sem responsável, "Eu" ou um dos nomes da preferência `meusNomes` (Configurações). O Provider chama `definirMeusNomes()` durante o render e relê os dados quando a lista muda, para tudo se recalcular. Com o nome informado, `quemSouEu()` (em `lib/prompts.ts`) acrescenta aos prompts de registro e do bloco de notas a frase que diz ao Copilot quem é "eu".
- **Virada do dia com o app aberto** (`components/useHoje.ts`): o Nexo fica aberto como janela por dias. `useHoje()` devolve o dia atual e muda sozinho quando o dia vira (confere a cada 30 s e quando a janela volta a ter foco). Na virada, o Provider relê os dados do disco, os lembretes são recalculados e o ritual do dia é oferecido de novo. Conta que depende da data deve usar `useHoje()` nas dependências, não `hojeISO()` solto dentro de um `useMemo`.

### Radar das frentes (2.14)
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
- **Editor de registro** (`components/RegistroEditor.tsx`): tipo, data/hora, título, participantes (com sugestão de nomes já usados), anotações brutas, bloco Copilot em 3 passos, campos estruturados, prazo por passo, "passos anteriores resolvidos aqui?" e "atualizar a tarefa junto" (status/prioridade/prazo; mudança de status gera um marco). Tem **rascunho automático** (seção 4): fechar com algo digitado (Esc, clique fora, X) guarda o rascunho e avisa, sem perguntar; o rodapé ganha "Descartar" (com confirmação) e "Fechar e continuar depois". Ao abrir, o estado vem do rascunho, se houver, e um aviso no topo permite descartá-lo e voltar ao que estava salvo.
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
  diario/page.tsx         diário: o que aconteceu dia a dia, com mapa de atividade
  conquistas/page.tsx     conquistas: nível, XP, meta do dia e conquistas (gamificação)
  paginas/page.tsx        páginas de conhecimento (lista, busca e editor)
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
    arquivos/    POST  multipart "arquivo" → { arquivo, nomeArquivo, tamanho }
                 GET   ?p=<caminho relativo>[&baixar=1]  (inline com CSP sandbox)
    backup/      GET lista, POST backup manual
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
  useGravacao.ts          gravação automática de título + texto (usada pelas páginas)
  paginas/                EditorPagina: uma página de conhecimento aberta
  jogo/                   gamificação: useJogo (placar e preferências), Celebracao, NivelLateral e pecas (Anel, CartaoConquista, Confete)
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
  shell/                  moldura: Lateral (navegação e seções), BarraSuperior, Ferramentas (agenda, foco, anotar rápido, aparência),
                          SessaoFoco (cronômetro e registro), Personalizar (painel), Aparencia (controles de tema, cor, cantos...),
                          Paleta, Sino, Logo, Telas, navegacao
  hoje/                   tela Hoje: captura rápida, foco de hoje, precisa de você, semana
  rotina/                 ritual "Planejar o dia" em 3 etapas
  tarefas/                lista de tarefas: filtros, grade, lista, quadro (Kanban), seletor de categoria
  tarefa/                 página da tarefa: propriedades, timeline, passos, Copilot, lateral; Texto.tsx (TextoRico) desenha Markdown
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
  configuracoes/          painéis de dados (pasta, backups, lixeira) e de preferências
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
  perguntar.ts            perguntar ao Nexo: buscarFontes, promptPergunta, ligarFontes, paginaDaResposta, normalizarConsulta (funções puras)
  radar.ts                radar das frentes: montarRadar (saúde, números, movimento, prazos) e textoDoRadar (função pura)
  reuniao.ts              modo reunião: montarPauta, normalizarReuniao, registroDaReuniao, comReuniao, textoDaPauta, textoDaAta (funções puras)
  notas.ts                bloco de notas: promptNotas, interpretarNotas (leitor do JSON da IA) e aplicação das propostas
  texto-rico.ts           Markdown → árvore saneada (analisarMarkdown), paraTextoPlano, regras de imagem e de link
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
- `proxy.ts` em `/api/*`: recusa `Host` que não seja `localhost`/`127.0.0.1`/`[::1]` (DNS rebinding) e, em métodos de escrita, recusa `Origin` de outro host ou `Sec-Fetch-Site` diferente de `same-origin`/`none` (CSRF).
- IDs validados por regex antes de virar caminho; leitura de anexos confere se o caminho resolvido está dentro de `arquivos/` (path traversal).
- Anexos são servidos com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: sandbox`; HTML e SVG de terceiros não executam no origin do app (HTML é servido como texto).
- Upload grava com flag `wx` (nunca sobrescreve) e nome saneado.
- **A resposta da IA é entrada não confiável.** O JSON colado no bloco de notas (`lib/notas.ts`) é validado campo a campo: tipos em lista fechada, datas reais no formato `AAAA-MM-DD`, tamanhos limitados (texto, itens, passos, pessoas), tarefa precisa existir e estar aberta. Ids são sempre gerados pelo app, nunca aceitos da resposta. Nada do que vem dela vira caminho, id ou código, e nada é gravado sem a prévia e a confirmação do usuário.
- **Texto colado é entrada não confiável** (2.9). O editor rico e o leitor de Markdown seguem as mesmas três regras, cobertas por `testes/texto-rico.test.mjs` e pelo e2e: (1) **HTML nunca é interpretado** na leitura (`lib/texto-rico.ts` devolve uma árvore própria e a tela desenha com React, sem `innerHTML`); no editor, HTML colado passa pelo esquema do ProseMirror, que só conhece os blocos do app; (2) **imagem só carrega se for anexo da pasta de dados** (`arquivos/AAAA/nome`, validado por `anexoDoSrc()`): `<img>` de página colada e `![](http...)` não viram imagem, então colar conteúdo de fora não dispara chamada externa nem pixel de rastreio; (3) **link só com `http`, `https` ou `mailto`** (`linkPermitido()`), aberto em nova aba com `rel="noopener noreferrer nofollow"`. Upload de imagem pelo editor aceita só PNG, JPG, GIF e WebP até 15 MB (SVG não).
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
- **2.14: a saúde de uma frente é conta, não campo.** O radar usa as mesmas réguas dos lembretes (`LIMITES`) para as duas visões não se contradizerem, e uma só própria (`RADAR.parada`). Não há "status da categoria" para o usuário manter na mão: seria mais um dado para ficar desatualizado. O status para o gestor é texto fixo de propósito (previsível, sem depender do Copilot); quem quiser um texto redigido usa Relatórios.
- **2.13: perguntar sem API é busca + prompt.** Não há como "conversar com os dados" sem um modelo, então o app faz a parte que dá para fazer localmente (achar e recortar os trechos certos, numerar as fontes) e deixa para o Copilot só a redação. A busca é por palavras, não por significado: não há embeddings nem índice, de propósito (seria mais uma coisa gravada para proteger, e dependência nova). Limite conhecido: sinônimos não casam ("bloqueio" não acha "gate"), então a tela diz quais palavras procurou. O número de fontes e o tamanho do prompt são limitados porque o Copilot do navegador corta entrada longa.
- **2.12: modo reunião.** Primeira das frentes rumo à 3.0 (as outras: perguntar ao Nexo, radar das frentes, confiança e acabamento). A reunião em andamento fica no navegador pelo mesmo motivo do rascunho de registro (gravar em disco a cada tecla faria o OneDrive sincronizar sem parar) e só vira dado quando é encerrada. A ata é texto fixo, sem IA. Nenhum campo novo nos dados: a reunião vira um registro `reuniao` comum, que qualquer versão anterior abre.
- **2.10: gamificação calculada, não gravada.** O dono pediu para gamificar o uso. A decisão foi derivar tudo dos dados que já existem, em vez de guardar pontos: assim a regra de nunca perder dados não ganha mais um arquivo para proteger, e o placar não mente (não dá para ganhar XP sem ter feito a coisa). A pontuação favorece registrar o que aconteceu, que é o hábito que o app mais precisa. Só o que é gosto (ligar, meta do dia, comemorar) e o que já foi comemorado ficam no navegador.
- **2.9: texto rico é Markdown, não um formato próprio.** O editor (Tiptap) poderia gravar JSON de blocos, mas isso prenderia os dados ao editor e quebraria a regra de abrir em qualquer versão. Markdown mantém o campo como texto: o espelho `.md` fica nativo, o Copilot recebe o texto como ele é e uma versão antiga do app continua lendo. Custo aceito: o editor escapa alguns caracteres (`&lt;`, `\*`), e quem mostra um trecho precisa passar por `paraTextoPlano()`. Sublinhado ficou de fora porque não existe em Markdown. A descrição da tarefa e os campos preenchidos pela IA continuam em texto puro.
- **2.8: quatro novidades escolhidas pelo agente a pedido do dono ("me surpreenda")**: Diário, esperando quem, modelos de tarefa e sessão de foco. Todas com campo opcional ou coleção nova, sem migração. "De quem se espera" é dado da tarefa (não preferência) porque é informação de trabalho. A sessão em andamento fica no navegador; só o resultado (a atividade com a duração) vai para a pasta de dados. A mensagem de cobrança é um texto fixo montado com o que o usuário escreveu: sem IA e sem inventar nada.
- **O espelho em Markdown é gravado mesmo com `categorias.json` ilegível** (sem o nome da categoria). Antes, uma coleção corrompida impedia o espelho de se atualizar.
- **Pessoas e times são coleções novas e opcionais** (`pessoas.json`, `times.json`). Uma versão antiga do app ignora os arquivos sem perder nada. A importação do Outlook é só por colagem ou arquivo, sem API.

### Ideias para as próximas versões (backlog, confirme com o usuário antes)
- Importar/colar a ata de reunião do Teams ou o texto de e-mail direto num registro.
- Notificação do sistema (Windows) para lembretes críticos, se o dono quiser ser avisado com o app fechado.
- Subtarefas/checklist próprio da tarefa (além dos passos dos registros).
- Vincular tarefas entre si (dependências) e "tarefas relacionadas" na mesma categoria.
- Exportar uma tarefa ou categoria como relatório em Markdown/HTML para mandar ao gestor.
- Importar de volta um `nexo-export-*.json` (restauração completa).
- Histórico de prompts gerados e respostas coladas por tarefa.

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
| `components/tarefa/Texto.tsx` | `TextoRico`: mostra Markdown (títulos, listas, tarefas, tabela, código, imagens anexadas) com a classe `prosa`. |
| `components/ui/*` | Kit genérico (padrão Shadcn, sem regra de negócio). `button`, `input` (Input, Textarea), `dialog` (Dialog e AlertDialog), `select` (Select e o atalho `Seletor`), `popover` (Popover, `Dica`), `menu` (DropdownMenu e ContextMenu), `controles` (Label, Checkbox, Switch, `CampoSwitch`, Slider, `Segmentado`), `data` (`Calendario`, `SeletorData`, `SeletorHora`, `somarDias`, `dataPorExtenso`), `command` (Command e `Combobox`), `chips` (`CampoChips`, `CampoSugestoes`, `AreaArquivo`), `diversos` (Badge, Card, Separator, Skeleton, Kbd, Collapsible, ScrollArea, Tabs, Progress, Table/THead/TBody/Tr/Th/Td, Toaster). |
| `components/comum.tsx` | Peças de domínio: `Pagina`, `Secao`, `Painel`, `Estatistica`, `Vazio`, `Contador`, `StatusBadge`, `SeletorStatus`, `IconeStatus`, `opcoesStatus`, `PrioBadge`, `SeletorPrioridade`, `CatTag`, `PontoCor`, `PrazoTag`, `IconeTipo`, `TipoBadge`, `AvatarPessoa`, `ChipPessoa`, `Etiqueta`, `ItemPasso`, `Campo`, `LinhaCampos`, `ChipsInput`, `Modal`, `Destaque`, `copiarTexto`, `formatarTamanho`. |
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
| `<input type="range">` | `SeletorPrioridade` (1 a 10) ou `Slider` |
| `<input type="checkbox">` | `Checkbox`, `CampoSwitch` ou `ItemPasso` |
| `<input type="file">` | `AreaArquivo` |
| `<datalist>` | `CampoSugestoes` ou `CampoChips` |
| `confirm()` / `alert()` | `useConfirmar()` e `toast()` do Provider |
| atributo `title` | `<Dica texto="...">` |
| `<details>` | `Collapsible` |
| `<table>` crua | `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td` |
| `<textarea>` para texto longo com formatação | `EditorRico` (texto curto e simples continua em `Textarea`) |
| mostrar texto do usuário com `innerHTML` | `TextoRico` (nunca `dangerouslySetInnerHTML`) |
| emoji como ícone | ícone do `lucide-react` (tipos de registro: `IconeTipo`; status: `IconeStatus`) |
| menu de contexto do navegador em itens | `ContextMenu` (`MenuContextoTarefa` para tarefas) |

### Layout e densidade (cara de app de desktop)
- A janela não rola. O Shell ocupa `100vh` (barra lateral, barra superior, barra de status) e cada tela usa `<Pagina>`: cabeçalho fixo e corpo com rolagem própria. Para telas com colunas que rolam separadas (quadro, página da tarefa) use `<Pagina semRolagem>` e cuide da rolagem dentro.
- Densidade compacta: controles com 32px de altura (`h-8`), texto de interface `text-[13px]`, texto de leitura `text-sm`, rótulos `text-xs`, metadados `text-[11px]`. Título de página `text-lg`, de seção `text-[13px] font-semibold`.
- Espaços: 12 a 16px entre blocos irmãos (`gap-3`/`gap-4`), 32px entre seções (`Secao` já dá). Cartões com `rounded-xl border bg-card shadow-xs`.
- Cores só por token (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`, `text-destructive`, `text-sucesso`, `text-alerta`, `text-info`, `bg-st-andamento/12`...). Nunca hexadecimal em componente. A única cor livre é `categoria.cor`, que é dado do usuário e entra por `style`.
- Tema claro e escuro por classe `.dark` no `<html>` (`useTema()`), com opção "sistema". Toda tela tem que ficar boa nos dois.
- **A cor de destaque é do usuário.** `--primary`, `--ring`, `--accent` e `--sidebar-accent` derivam de `--matiz` e `--croma`. Em componente, use sempre os tokens (`bg-primary`, `text-primary`, `ring-ring`); nunca escreva um matiz fixo (275, "indigo"), senão a peça não acompanha a escolha. O mesmo para os cantos: use `rounded-md/lg/xl`, que derivam de `--radius`.
- Números em `tabular-nums`. Textos longos do usuário em `texto-pre` (preserva quebras). Rótulos e botões em `sem-selecao`.

### Animação
- `motion` (`import { motion, AnimatePresence } from "motion/react"`) com os presets de `lib/animacoes.ts`. Listas entram em cascata (`lista` + `itemLista`), itens que somem usam `AnimatePresence` + `layout`, pílulas e seleções deslizam com `layoutId`.
- Rápido e discreto: 150 a 250ms, nada que atrase o uso.
- **O usuário escolhe quanto a interface se mexe** (`aparencia.movimento`): "completo" (respeita o "reduzir movimento" do Windows), "sutil" (só esmaecer: o motion roda com `reducedMotion="always"` e o CSS zera deslocamentos e escalas do tw-animate) e "nenhum" (`MotionGlobalConfig.skipAnimations` e transições de CSS zeradas). Por isso, anime com `motion` ou com as classes do tw-animate (`animate-in`, `fade-in-0`...), que obedecem a essa escolha; não crie `@keyframes` soltos sem olhar `html[data-movimento]`.
- Cada tela entra com `app/template.tsx`; `Secao` e `Painel` dentro de `Pagina` entram em cascata por CSS; o cabeçalho da `Pagina` ganha sombra quando o conteúdo rola por baixo; a troca de tema abre em círculo a partir do clique (View Transitions, só no movimento completo).
- Hover e foco sempre visíveis (anel `ring-ring`). Todo botão só de ícone tem `aria-label` e `Dica`.

### Texto e testes
- Português do Brasil, tom direto, sem travessão. Erros dizem o que aconteceu e o que fazer.
- Os componentes do kit têm `data-slot` (ex.: `data-slot="seletor-data"`, `"seletor-status"`, `"passo"`, `"estatistica"`). O `testes/e2e.cjs` usa esses atributos e textos visíveis; ao criar componente novo que o teste precise achar, ponha um `data-slot`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
