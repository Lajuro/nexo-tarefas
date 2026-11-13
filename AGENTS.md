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
- **Dependências com parcimônia.** Cada pacote precisa passar pelo npm do proxy (funciona, mas é mais um ponto de falha). A v2 adotou, a pedido do dono, a pilha de interface que ele usa nos outros projetos: `tailwindcss` + `@tailwindcss/postcss`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `motion`, `lucide-react`, `cmdk`, `sonner`, `@dnd-kit/core` e `geist` (fonte empacotada, sem buscar nada na internet). Versões **fixadas** no `package.json`. Antes de somar outra, veja se o kit em `components/ui` já resolve. Continua sem banco e sem API de IA.
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
- **Fila de gravação por recurso** no cliente (`components/Provider.tsx`, `enfileirar`): cliques rápidos não disputam a mesma revisão. Sempre altere tarefa via `atualizarTarefa(id, fn)`, que aplica `fn` sobre a **versão mais recente** do estado.
- **Backup diário automático**: antes da primeira escrita de cada dia, cópia dos JSON em `_backups/AAAA-MM-DD/` (mantém as 45 mais recentes; `manual-*` e `pre-migracao-*` nunca são podados).
- **Nada é apagado de verdade**:
  - tarefa excluída → `_lixeira/tarefa-<id>-<carimbo>.json` (restaurável em Configurações);
  - item removido de categorias/links → `_lixeira/<colecao>-removidos-<carimbo>.json`;
  - registro removido da timeline → fica dentro da própria tarefa em `registrosRemovidos[]`.
- **Espelho em Markdown** (`markdown/<slug>--<id>.md`) regenerado a cada gravação: se o app morrer, os dados continuam legíveis e pesquisáveis no Windows.
- **Nada digitado se perde antes de salvar**:
  - o editor de registro guarda um **rascunho automático** a cada mudança (`lib/rascunhos.ts`, no `localStorage`, chave `nexo:rascunho:<tarefaId>:<registroId|novo>`). Esc, clique fora, F5, janela fechada ou navegador travado não perdem as anotações: o rascunho volta ao reabrir o editor e a página da tarefa mostra um aviso com Continuar/Descartar. Só some ao salvar ou ao descartar com confirmação;
  - se o navegador não deixar gravar o rascunho, o editor avisa no rodapé e pergunta antes de fechar;
  - os formulários de tarefa, link e resposta colada do Copilot não têm rascunho, mas perguntam antes de fechar se algo foi digitado (`useFecharComCuidado()` em `components/Raiz.tsx`). **Formulário novo com texto longo tem que usar um dos dois mecanismos.**
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
  tarefas/<id>.json              uma Tarefa por arquivo, com a timeline inteira dentro
  arquivos/AAAA/<base36>-<nome>  documentos anexados (gravação com flag "wx": nunca sobrescreve)
  markdown/<slug>--<id>.md       espelho legível, gerado (pode apagar)
  _backups/AAAA-MM-DD/           backups diários
  _backups/manual-*/             backups manuais (botão em Configurações)
  _backups/pre-migracao-*/       antes de migração de formato
  _lixeira/                      tudo que foi "excluído"
```

### Modelo (fonte da verdade: `lib/tipos.ts`)
- **Tarefa**: `id, rev, titulo, descricao, categoriaId|null, status, prioridade (1..10, maior = mais urgente), prazo (AAAA-MM-DD|null), tags[], registros[], panoramaIA?{texto, geradoEm}, criadaEm, atualizadaEm, concluidaEm?`, e opcionalmente `registrosRemovidos[]`. Desde a v2 (campos opcionais, sem migração): `lembrarEm?` (AAAA-MM-DD|null: follow-up, "me lembre de voltar nisso") e `focoEm?` (AAAA-MM-DD|null: dia em que foi escolhida como foco; só vale como foco se for hoje).
- **Status**: `a_fazer | em_andamento | aguardando | bloqueada | concluida | cancelada`. "Abertos" = os quatro primeiros (`STATUS_ABERTOS`).
- **Registro** (cada card da timeline): `id, tipo, data, hora?, titulo, participantes[], anotacoes (brutas), resumoIA, decisoes, proximosPassos: Passo[], impedimentos, respostaIABruta?, alteracoes?{status?, prioridade?, prazo?: {de, para}}, criadoEm, atualizadoEm`.
- **TipoRegistro**: `reuniao | atividade | impedimento | decisao | nota | marco`. `marco` é gerado pelo sistema (tarefa criada, mudança de status; o marco de status `concluida` é o card verde "Concluída" do esboço).
- **Passo**: `id, texto, feito, feitoEm?, responsavel?, prazo?`. As "pendências" do app são todos os passos com `feito=false` de tarefas abertas.
- **Categoria**: `id, nome, descricao, cor, arquivada?, criadaEm, atualizadaEm`.
- **LinkDoc**: `id, tipo ("link"|"arquivo"), titulo, url?, arquivo? (caminho relativo em arquivos/), nomeArquivo?, tamanho?, descricao, tags[], tarefaId?, categoriaId?, criadoEm`.
- **Pessoa**: `id ("pe..."), nome, apelidos[], email, cargo, area, ajudaCom, anotacoes, categoriaIds[], tags[], arquivada?, origem? ("manual"|"registros"|"outlook"), criadaEm, atualizadaEm`. Registros e passos continuam guardando nomes como texto; a ligação com o cadastro é feita na leitura (`lib/pessoas.ts`, `chaveNome` contra `nome` e `apelidos`). Nada é reescrito nas tarefas.
- **Time**: `id ("ti..."), nome, descricao, cor, responsavelIds[], membroIds[] (inclui os responsáveis), categoriaIds[], arquivado?, criadoEm, atualizadoEm`. Os vínculos com pessoas ficam no Time.
- IDs: `novoId(prefixo)` = prefixo + base36(timestamp) + aleatório. Validados no servidor por `ID_VALIDO` (`/^[a-zA-Z0-9_-]{1,80}$/`).
- Datas de calendário são strings `AAAA-MM-DD` no fuso local (`hojeISO()`); carimbos são ISO UTC (`agoraISO()`).

### Preferências de interface (localStorage, não são dados)
Ficam no navegador com o prefixo `nexo:` (via `usePref` de `lib/preferencias.ts`) e podem ser perdidas sem prejuízo: `tema`, `lateralRecolhida`, `ordem`, `filtroStatus`, `visaoTarefas`, `recentesPrimeiro`, `agrupamentoPendencias`, `soMeus`, `rotina` (`{ ultimoPlanejamento, ultimaRevisao, abrirSozinho }`) e `lembretesAdiados` (`{ idDoLembrete: dataAtéQuando }`). Nada que o usuário não possa perder vai para o localStorage. A única coisa além de preferência que mora lá são os **rascunhos do editor de registro** (`nexo:rascunho:...`, seção 4): são cópia de segurança do que ainda não foi salvo, não dado. O registro só existe de verdade quando é gravado na pasta de dados.

---

## 6. Funcionalidades (telas)

| Rota | O que faz |
|---|---|
| `/` Hoje | Página inicial. Saudação, captura rápida de tarefa, **foco de hoje** (tarefas escolhidas, com os passos marcáveis ali), **precisa de você** (lembretes ativos, com adiar), faixa da semana (prazos dos próximos 7 dias), aguardando retorno, bloqueadas e paradas, progresso do dia. |
| `/tarefas` | Lista de tarefas com números, filtros (texto, categoria, status), ordenação e três visões: **grade**, **lista** e **quadro** (Kanban por status, arrastar muda o status). Aceita `?status=`, `?cat=`, `?f=atrasadas` e `?f=foco`. |
| `/tarefas/[id]` | Propriedades editáveis no lugar (categoria, status, prioridade, prazo, follow-up, tags), botões de prompt (Panorama, Preparar reunião), **timeline** (ordem crescente ou decrescente, lembrada), lateral com Pendências, Links e docs, Pessoas envolvidas e último Panorama IA. |
| `/pendencias` | Todos os próximos passos em aberto, agrupados por tarefa, por prazo ou por pessoa, com "só os meus", prazo próprio de cada passo e desfazer ao concluir. |
| `/categorias` e `/categorias/[id]` | Cards de categoria com contagens e progresso; a página da categoria mostra tarefas abertas, histórico (concluídas/canceladas), links, pessoas do assunto e o prompt de panorama. Arquivar/desarquivar. |
| `/pessoas` | Abas **Pessoas** (cadastradas e nomes sem cadastro, com cargo, times e "pode ajudar com") e **Times** (`?aba=times`, cartões com cor e membros). `?p=Nome` é o detalhe da pessoa (o que pode ajudar, times, passos com ela, tarefas em comum, histórico); `?time=<id>` é o detalhe do time (responsáveis, membros, passos, categorias, tarefas). Botão **Importar do Outlook** (colar, CSV ou vCard, sem API). |
| `/links` | Banco de links e arquivos com busca, filtro por tipo e tag, vínculo a tarefa/categoria. Upload salva cópia em `arquivos/`. |
| `/revisao` | **Revisão semanal** guiada: passa por todas as tarefas abertas, das mais esquecidas para as mais recentes, com decisões rápidas (status, prioridade, prazo, follow-up, foco). |
| `/relatorios` | Escolhe período (7/15/30 dias, mês, datas livres) e categoria, mostra o que entra e copia o prompt de relatório. |
| `/busca?q=` | Busca sem acento/maiúscula em tarefas, registros (todos os campos) e links, com trecho destacado. |
| `/configuracoes` | Pasta de dados (trocar/copiar caminho), estatísticas, versão do formato, backup manual, exportar tudo em JSON, lixeira com restaurar, aparência (tema), rotina e lembretes, atalhos. |

### Moldura (components/Shell.tsx)
- Barra lateral recolhível (`Ctrl B`) com contadores, barra superior (voltar/avançar, migalhas, busca, sino, tema, tela cheia, atalhos) e barra de status (pasta de dados, "Salvando..."/"Salvo às HH:MM", contagens, versão).
- **Paleta de comandos** (`Ctrl K` ou `/`): vai para qualquer tela, tarefa, categoria ou pessoa e dispara ações.
- **Sino**: lembretes ativos a um clique, com adiar.
- **Onboarding**: na primeira vez pede o caminho da pasta de dados (sugere `%OneDriveCommercial%\Nexo` ou `%OneDrive%\Nexo`).
- **Atalhos** (lista oficial em `components/shell/navegacao.ts`, mostrada com `?`): `N` nova tarefa, `D` planejar o dia, `G` depois `H/T/P/C/E/L/S/R` para navegar, `Ctrl Enter` salva formulários, `Esc` fecha.
- Abre como aplicativo: `Iniciar Nexo.cmd` usa o modo `--app` do Edge (janela própria) e há `app/manifest.ts` para instalar pelo navegador.

### Rotina e lembretes (o app lembra o usuário do que fazer)
- **Motor de lembretes** (`lib/lembretes.ts`, função pura sobre os dados): prazo vencido, prazo hoje, prazo chegando (3 dias), passo com prazo vencido ou para hoje, follow-up (`lembrarEm`) chegou, bloqueada sem novidade (3 dias), aguardando retorno (5 dias), parada (7 dias), passos antigos (14 dias) e em andamento sem próximo passo. Os limites estão em `LIMITES`.
- Lembretes aparecem no sino, na tela Hoje e nos contadores da barra lateral. **Adiar** esconde um lembrete até uma data e fica só no localStorage.
- **Planejar o dia** (`components/rotina/PlanejarDia.tsx`): ritual em 3 passos (o que ficou para trás, escolher os focos, pronto). Abre sozinho na primeira visita do dia (desligável) e pelo atalho `D`.
- **Foco de hoje**: `tarefa.focoEm = hoje`. Vale só no dia; no dia seguinte a tarefa deixa de ser foco sem precisar limpar nada.
- **Follow-up**: `tarefa.lembrarEm`. Definido no formulário, na página da tarefa ou pelo menu da tarefa ("Lembrar de voltar").
- **Revisão semanal**: a barra lateral sinaliza quando faz 7 dias ou mais desde a última.

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

---

## 8. Estrutura do código

```
app/
  layout.tsx              Provider, Raiz e Shell em todas as páginas
  globals.css             Tailwind, tokens de cor (claro e escuro), utilitários
  icon.svg                ícone do app (aba e instalação)
  manifest.ts             manifesto para instalar o Nexo pelo navegador
  page.tsx                Hoje (página inicial)
  tarefas/page.tsx        lista de tarefas (grade, lista e quadro)
  tarefas/[id]/page.tsx   página da tarefa + timeline (CardRegistro)
  categorias/             lista e página de cada categoria ([id])
  pendencias/page.tsx     passos em aberto
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
  comum.tsx               peças de domínio: Pagina, Secao, StatusBadge, PrioBadge, Modal etc.
  useLembretes.ts         lembretes ativos e adiar()
  TarefaForm.tsx          criar e editar tarefa, aplicarStatus() na tela
  RegistroEditor.tsx      editor de registro com fluxo Copilot
  PromptModal.tsx         copiar prompt / colar resposta genérico
  LinkForm.tsx            link ou arquivo, hrefLink()
  CategoriaForm.tsx       criar e editar categoria
  CardTarefa.tsx          cartão de tarefa (grade, quadro e categorias)
  ui/                     kit genérico no padrão Shadcn sobre Radix (seção 13)
  shell/                  barra lateral, paleta de comandos, sino, logo, telas de primeira vez, erro e atalhos
  hoje/                   tela Hoje: captura rápida, foco de hoje, precisa de você, semana
  rotina/                 ritual "Planejar o dia" em 3 etapas
  tarefas/                lista de tarefas: filtros, grade, lista, quadro (Kanban), seletor de categoria
  tarefa/                 página da tarefa: propriedades, timeline, passos, Copilot, lateral
  pendencias/             tela de pendências: agrupamento e linhas
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
  prompts.ts              prompts do Copilot e parser da resposta
  rascunhos.ts            rascunho automático do editor de registro (localStorage, só cliente)
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
- **Pessoas e times são coleções novas e opcionais** (`pessoas.json`, `times.json`). Uma versão antiga do app ignora os arquivos sem perder nada. A importação do Outlook é só por colagem ou arquivo, sem API.

### Ideias para as próximas versões (backlog, confirme com o usuário antes)
- Importar/colar a ata de reunião do Teams ou o texto de e-mail direto num registro.
- Notificação do sistema (Windows) para lembretes críticos, se o dono quiser ser avisado com o app fechado.
- Subtarefas/checklist próprio da tarefa (além dos passos dos registros).
- Vincular tarefas entre si (dependências) e "tarefas relacionadas" na mesma categoria.
- Templates por tipo de demanda (ex.: onboarding Security Champion) com passos padrão.
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
| `app/globals.css` | Tailwind, tokens de cor (claro em `:root`, escuro em `.dark`), sombras, barras de rolagem, utilitários `texto-pre` e `sem-selecao`. |
| `components/ui/*` | Kit genérico (padrão Shadcn, sem regra de negócio). `button`, `input` (Input, Textarea), `dialog` (Dialog e AlertDialog), `select` (Select e o atalho `Seletor`), `popover` (Popover, `Dica`), `menu` (DropdownMenu e ContextMenu), `controles` (Label, Checkbox, Switch, `CampoSwitch`, Slider, `Segmentado`), `data` (`Calendario`, `SeletorData`, `SeletorHora`, `somarDias`, `dataPorExtenso`), `command` (Command e `Combobox`), `chips` (`CampoChips`, `CampoSugestoes`, `AreaArquivo`), `diversos` (Badge, Card, Separator, Skeleton, Kbd, Collapsible, ScrollArea, Tabs, Progress, Table/THead/TBody/Tr/Th/Td, Toaster). |
| `components/comum.tsx` | Peças de domínio: `Pagina`, `Secao`, `Painel`, `Estatistica`, `Vazio`, `Contador`, `StatusBadge`, `SeletorStatus`, `IconeStatus`, `opcoesStatus`, `PrioBadge`, `SeletorPrioridade`, `CatTag`, `PontoCor`, `PrazoTag`, `IconeTipo`, `TipoBadge`, `AvatarPessoa`, `ChipPessoa`, `Etiqueta`, `ItemPasso`, `Campo`, `LinhaCampos`, `ChipsInput`, `Modal`, `Destaque`, `copiarTexto`, `formatarTamanho`. |
| `components/Raiz.tsx` | Provedores de interface: tema (`useTema`), confirmação (`useConfirmar`), dicas, toasts, `MotionConfig`. |
| `components/MenuTarefa.tsx` | `MenuContextoTarefa` (botão direito), `BotaoMenuTarefa` ("...") e `useAcoesTarefa()`. Toda tarefa que aparece na tela deve ter esse menu. |
| `components/useLembretes.ts` | Lembretes ativos e `adiar()`. |
| `lib/acoes.ts` | Transformações puras de tarefa: `aplicarStatus`, `comFoco`, `comLembrete`, `comPassoAlternado`, `comPrazoDoPasso`, `semRegistro`. Use sempre dentro de `atualizarTarefa(id, fn)`. |
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
| emoji como ícone | ícone do `lucide-react` (tipos de registro: `IconeTipo`; status: `IconeStatus`) |
| menu de contexto do navegador em itens | `ContextMenu` (`MenuContextoTarefa` para tarefas) |

### Layout e densidade (cara de app de desktop)
- A janela não rola. O Shell ocupa `100vh` (barra lateral, barra superior, barra de status) e cada tela usa `<Pagina>`: cabeçalho fixo e corpo com rolagem própria. Para telas com colunas que rolam separadas (quadro, página da tarefa) use `<Pagina semRolagem>` e cuide da rolagem dentro.
- Densidade compacta: controles com 32px de altura (`h-8`), texto de interface `text-[13px]`, texto de leitura `text-sm`, rótulos `text-xs`, metadados `text-[11px]`. Título de página `text-lg`, de seção `text-[13px] font-semibold`.
- Espaços: 12 a 16px entre blocos irmãos (`gap-3`/`gap-4`), 32px entre seções (`Secao` já dá). Cartões com `rounded-xl border bg-card shadow-xs`.
- Cores só por token (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`, `text-destructive`, `text-sucesso`, `text-alerta`, `text-info`, `bg-st-andamento/12`...). Nunca hexadecimal em componente. A única cor livre é `categoria.cor`, que é dado do usuário e entra por `style`.
- Tema claro e escuro por classe `.dark` no `<html>` (`useTema()`), com opção "sistema". Toda tela tem que ficar boa nos dois.
- Números em `tabular-nums`. Textos longos do usuário em `texto-pre` (preserva quebras). Rótulos e botões em `sem-selecao`.

### Animação
- `motion` (`import { motion, AnimatePresence } from "motion/react"`) com os presets de `lib/animacoes.ts`. Listas entram em cascata (`lista` + `itemLista`), itens que somem usam `AnimatePresence` + `layout`, pílulas e seleções deslizam com `layoutId`.
- Rápido e discreto: 150 a 250ms, nada que atrase o uso. O `MotionConfig reducedMotion="user"` já respeita quem pede menos movimento.
- Hover e foco sempre visíveis (anel `ring-ring`). Todo botão só de ícone tem `aria-label` e `Dica`.

### Texto e testes
- Português do Brasil, tom direto, sem travessão. Erros dizem o que aconteceu e o que fazer.
- Os componentes do kit têm `data-slot` (ex.: `data-slot="seletor-data"`, `"seletor-status"`, `"passo"`, `"estatistica"`). O `testes/e2e.cjs` usa esses atributos e textos visíveis; ao criar componente novo que o teste precise achar, ponha um `data-slot`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
