#!/usr/bin/env bash
# =============================================================================
#  testes/copia.test.sh · testes dos scripts de cópia sem git
#
#  Monta um repositório temporário com o estado atual da pasta (o que está no
#  git e os arquivos novos ainda não adicionados), gera os scripts nele e testa:
#    • o gerador: recusa mudança fora do commit, --check, --commit, o mesmo
#      resultado ao gerar duas vezes e o gancho .githooks/pre-push num push real;
#    • o nexo-offline.sh: instalar, pasta com arquivos (com e sem -f, e
#      respondendo à pergunta), atualizar guardando a versão anterior e tirando
#      o que saiu, -n, -l, -v, flags juntas, arquivo alterado, cortado, com CRLF,
#      rodado por pipe, pasta de dados dentro da pasta do app e o npm;
#    • o baixar-nexo.sh: os três modos (pacote, API, lista embutida) contra um
#      GitHub de mentira em file://, a queda de um modo para o outro e tudo
#      falhando.
#  Não usa a rede, não roda o npm de verdade e não toca na sua pasta de dados
#  (HOME vai para uma pasta temporária).
#
#  Uso: bash testes/copia.test.sh
# =============================================================================
set -uo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'cd /; rm -rf "$T"' EXIT
export NO_COLOR=1 CI=1 HOME="$T/casa"
export GIT_AUTHOR_NAME=Teste GIT_AUTHOR_EMAIL=teste@exemplo.local GIT_COMMITTER_NAME=Teste GIT_COMMITTER_EMAIL=teste@exemplo.local
unset USERPROFILE NEXO_DATA_DIR GITHUB_TOKEN HTTPS_PROXY https_proxy 2>/dev/null || true
mkdir -p "$HOME"

OK=0 FALHAS=0 SAIDA="" CODIGO=0
certo() {
  OK=$((OK + 1))
  printf '  ✓ %s\n' "$1"
}
errado() {
  FALHAS=$((FALHAS + 1))
  printf '  ✗ %s\n' "$1"
  [ -z "${2:-}" ] || printf '%s\n' "$2" | head -n 30 | sed 's/^/      │ /'
}
secao() { printf '\n%s\n' "$1"; }
rodar() {
  SAIDA="$("$@" 2>&1)"
  CODIGO=$?
}
codigo() { # descrição código-esperado
  if [ "$CODIGO" = "$2" ]; then certo "$1"; else errado "$1 (saiu com $CODIGO, esperava $2)" "$SAIDA"; fi
}
tem() { # descrição texto
  case "$SAIDA" in *"$2"*) certo "$1" ;; *) errado "$1 (faltou \"$2\")" "$SAIDA" ;; esac
}
nao_tem() { # descrição texto
  case "$SAIDA" in *"$2"*) errado "$1 (não devia ter \"$2\")" "$SAIDA" ;; *) certo "$1" ;; esac
}
vale() { # descrição comando... (condição)
  if "${@:2}"; then certo "$1"; else errado "$1" "$SAIDA"; fi
}
gitc() { git -c user.name=Teste -c user.email=teste@exemplo.local -c commit.gpgsign=false "$@"; }
igual_ao_repo() { diff -r -x .nexo-instalacao -x node_modules "$T/ref" "$1" >/dev/null 2>&1; }
igual_sem_offline() { diff -r -x .nexo-instalacao -x node_modules -x nexo-offline.sh "$T/ref" "$1" >/dev/null 2>&1; }
nao_existe() { [ ! -e "$1" ]; }
arquivo_tem() { grep -q -- "$2" "$1" 2>/dev/null; }
# finge uma instalação antiga: outra versão, outro conteúdo e arquivos que saíram do Nexo
envelhecer() {
  local d="$1"
  sed -i.bak 's/^\(  "version": \)"[^"]*"/\1"3.0.0"/' "$d/package.json" && rm -f "$d/package.json.bak"
  printf 'mexido\n' >>"$d/README.md"
  mkdir -p "$d/node_modules/pacote"
  printf 'x\n' >"$d/node_modules/pacote/index.js"
  printf 'velho\n' >"$d/lib/arquivo-que-saiu.ts"
  if [ -f "$d/$MARCA" ]; then
    sed -i.bak 's/^conteudo=.*/conteudo=antigo/' "$d/$MARCA" && rm -f "$d/$MARCA.bak"
    printf 'lib/arquivo-que-saiu.ts\n' >>"$d/$MARCA"
  fi
}
MARCA=".nexo-instalacao"

# ------------------------------------------------------------------ gerador ----
secao "Gerador"
mkdir -p "$T/repo"
(cd "$RAIZ" && git ls-files -z --cached --others --exclude-standard) |
  while IFS= read -r -d '' f; do [ -f "$RAIZ/$f" ] && printf '%s\0' "$f"; done |
  (cd "$RAIZ" && tar --null -T - -cf -) | tar -x -C "$T/repo"
cd "$T/repo" || exit 1
git init -q -b main
gitc add -A
gitc commit -q -m "estado atual"

rodar bash scripts/gerar-scripts-de-copia.sh
codigo "gera os dois scripts a partir do commit" 0
tem "diz o que fazer em seguida" "git commit"
rodar bash scripts/gerar-scripts-de-copia.sh --check
codigo "--check acusa antes do commit dos scripts" 1
tem "--check ensina a resolver" "--commit"
gitc commit -q -m "chore: scripts" -- scripts/baixar-nexo.sh scripts/nexo-offline.sh
rodar bash scripts/gerar-scripts-de-copia.sh --check
codigo "--check passa depois do commit dos scripts" 0
rodar bash scripts/gerar-scripts-de-copia.sh -q
vale "gerar de novo dá exatamente os mesmos bytes" test -z "$(git status --porcelain)"

printf 'mudança\n' >>README.md
rodar bash scripts/gerar-scripts-de-copia.sh
codigo "recusa gerar com mudança fora do commit" 1
tem "e diz qual arquivo" "README.md"
vale "e não mexe nos scripts" git diff --quiet -- scripts
git checkout -q README.md
printf '# comentário\n' >>scripts/baixar-nexo.sh
rodar bash scripts/gerar-scripts-de-copia.sh
codigo "recusa gerar com o baixar-nexo.sh mudado fora das partes geradas" 1
git checkout -q scripts/baixar-nexo.sh
printf 'novo\n' >arquivo-fora-do-git.txt
rodar bash scripts/gerar-scripts-de-copia.sh -q
codigo "arquivo novo fora do git não impede" 0
tem "mas avisa que fica de fora" "fora do git"
rm -f arquivo-fora-do-git.txt

printf 'mais uma linha\n' >>README.md
gitc commit -q -am "muda o README"
rodar bash scripts/gerar-scripts-de-copia.sh --check
codigo "um commit novo deixa os scripts velhos" 1
SHA="$(git rev-parse HEAD)"
rodar bash -c "printf 'refs/heads/main %s refs/heads/main %s\n' $SHA 0000000000000000000000000000000000000000 | bash .githooks/pre-push"
codigo "o gancho barra push para a main com scripts velhos" 1
rodar bash -c "printf 'refs/heads/x %s refs/heads/outra %s\n' $SHA 0000000000000000000000000000000000000000 | bash .githooks/pre-push"
codigo "o gancho não se mete em outras branches" 0

git init -q --bare "$T/remoto.git"
git remote add origin "$T/remoto.git"
git config core.hooksPath .githooks
rodar git push -q origin main
codigo "push de verdade para a main é barrado" 1
vale "e nada chegou ao remoto" nao_existe "$T/remoto.git/refs/heads/main"
rodar bash scripts/gerar-scripts-de-copia.sh --commit
codigo "--commit gera e faz o commit" 0
vale "o commit é só dos dois scripts" test "$(git show --name-only --format= HEAD | sort | tr '\n' ' ')" = "scripts/baixar-nexo.sh scripts/nexo-offline.sh "
rodar git push -q origin main
codigo "depois disso o push passa" 0
rodar bash scripts/gerar-scripts-de-copia.sh --check
codigo "--check em dia no commit dos scripts" 0

mkdir -p "$T/ref"
git archive HEAD | tar -x -C "$T/ref"
OFF="$T/repo/scripts/nexo-offline.sh"
BX="$T/repo/scripts/baixar-nexo.sh"
VERSAO="$(sed -n 's/^NEXO_VERSAO="\(.*\)"$/\1/p' "$OFF")"
CONTEUDO="$(sed -n 's/^CONTEUDO="\(.*\)"$/\1/p' "$OFF")"
vale "o instalador sabe a versão" test -n "$VERSAO"
rodar bash -n "$OFF"
codigo "nexo-offline.sh sem erro de sintaxe" 0
rodar bash -n "$BX"
codigo "baixar-nexo.sh sem erro de sintaxe" 0

# ------------------------------------------------------------ nexo-offline ----
secao "nexo-offline.sh: opções"
W="$T/w"
mkdir -p "$W"
cd "$W" || exit 1
rodar bash "$OFF" -v
codigo "-v sai sem erro" 0
tem "-v mostra a versão" "Nexo $VERSAO"
rodar bash "$OFF" --help
codigo "--help sai sem erro" 0
tem "a ajuda mostra a flag curta e a longa" "-f, --force"
tem "a ajuda mostra o -n" "-n, --dry-run"
rodar bash "$OFF" -l
codigo "-l lista os arquivos" 0
vale "-l lista todos os arquivos do pacote" test "$(printf '%s\n' "$SAIDA" | grep -c .)" = "$(git -C "$T/repo" ls-tree -r HEAD | grep -vc 'scripts/nexo-offline.sh$')"
tem "-l inclui o package.json" "package.json"
rodar bash "$OFF" -z
codigo "flag desconhecida dá erro" 1
tem "e diz qual é" "Opção desconhecida: -z"
rodar bash "$OFF" uma outra
codigo "duas pastas dão erro" 1
touch "$W/um-arquivo"
rodar bash "$OFF" um-arquivo
codigo "destino que é arquivo dá erro" 1
tem "e explica" "não é uma pasta"

secao "nexo-offline.sh: instalar"
rodar bash "$OFF" app1
codigo "instala numa pasta nova" 0
vale "a pasta fica igual ao repositório" igual_ao_repo app1
vale "grava o arquivo de instalação com o carimbo" arquivo_tem "app1/$MARCA" "conteudo=$CONTEUDO"
vale "o instalador vai junto para scripts/" cmp -s "$OFF" app1/scripts/nexo-offline.sh
tem "mostra os próximos passos" "Próximos passos"
tem "com o npm install, que não rodou" "npm install"
mkdir -p "$W/sub"
rodar bash -c "cd '$W/sub' && bash '$OFF' -q"
codigo "sem pasta, instala em ./nexo-tarefas" 0
vale "e a pasta existe" test -f "$W/sub/nexo-tarefas/package.json"
vale "-q mostra só uma linha" test "$(printf '%s\n' "$SAIDA" | grep -c .)" = 1
rodar bash "$OFF" app1
codigo "rodar de novo na mesma pasta não dá erro" 0
tem "e diz que já está em dia" "mesmo conteúdo"
tem "e como instalar de novo" "use -f"

secao "nexo-offline.sh: atualizar"
envelhecer app1
rodar bash "$OFF" app1
codigo "pasta com outra versão, sem -f e sem terminal: para" 1
tem "e diz que versão está lá" "Nexo 3.0.0"
tem "e ensina o -f" "-f"
vale "e não mexeu em nada" arquivo_tem app1/README.md mexido
rodar bash "$OFF" -n app1
codigo "-n mostra o que mudaria" 0
tem "-n conta os arquivos" "O que mudaria"
tem "-n mostra o que sairia" "lib/arquivo-que-saiu.ts"
tem "-n avisa que não gravou" "Nada foi gravado"
vale "-n não mexeu em nada" arquivo_tem app1/README.md mexido
vale "-n não criou a cópia anterior" nao_existe app1-anterior
rodar bash "$OFF" -f app1
codigo "-f atualiza" 0
vale "a pasta fica igual ao repositório" igual_ao_repo app1
vale "o arquivo que saiu do Nexo foi retirado" nao_existe app1/lib/arquivo-que-saiu.ts
vale "node_modules ficou onde estava" test -f app1/node_modules/pacote/index.js
vale "a versão anterior foi guardada" arquivo_tem app1-anterior/README.md mexido
vale "com o arquivo que saiu" test -f app1-anterior/lib/arquivo-que-saiu.ts
vale "e sem node_modules" nao_existe app1-anterior/node_modules
tem "conta o que mudou" "1 retirado"

rm -f "app1/$MARCA"
mkdir -p app1/app/rota-velha
printf 'velha\n' >app1/app/rota-velha/page.tsx
printf 'minhas notas\n' >app1/minhas-notas.txt
rodar bash "$OFF" -f app1
codigo "atualiza instalação feita por um script antigo (sem o arquivo de instalação)" 0
vale "tira o que saiu das pastas de código" nao_existe app1/app/rota-velha
vale "e não toca no resto" test -f app1/minhas-notas.txt
rm -f app1/minhas-notas.txt

rodar bash "$OFF" -q app2
envelhecer app2
rodar bash "$OFF" -f --no-backup app2
codigo "--no-backup atualiza" 0
vale "--no-backup não guarda a anterior" nao_existe app2-anterior
rodar bash "$OFF" -fq --forcar app2
codigo "flags juntas (-fq) e o nome antigo (--forcar) valem" 0

mkdir -p outra
printf 'meu\n' >outra/meu.txt
rodar bash "$OFF" outra
codigo "pasta que não é do Nexo, sem -f: para" 1
tem "e explica" "não parece ser do Nexo"
rodar bash "$OFF" -f outra
codigo "com -f, usa mesmo assim" 0
vale "sem apagar o que já estava" test -f outra/meu.txt
vale "e sem guardar anterior (não era o Nexo)" nao_existe outra-anterior

secao "nexo-offline.sh: perguntas no terminal"
if command -v script >/dev/null 2>&1 && script -qec true /dev/null >/dev/null 2>&1; then
  rodar bash "$OFF" -q app3
  envelhecer app3
  rodar bash -c "printf 'n\n' | CI= script -qec \"bash '$OFF' app3\" /dev/null"
  codigo "respondendo não: cancela" 1
  tem "pergunta se quer atualizar" "Atualizar para o Nexo $VERSAO?"
  vale "e não mexe em nada" arquivo_tem app3/README.md mexido
  rodar bash -c "printf 's\n' | CI= script -qec \"bash '$OFF' app3\" /dev/null"
  codigo "respondendo sim: atualiza" 0
  vale "e a pasta fica igual ao repositório" igual_ao_repo app3
  mkdir -p outra2
  printf 'meu\n' >outra2/meu.txt
  rodar bash -c "printf '\n' | CI= script -qec \"bash '$OFF' outra2\" /dev/null"
  codigo "pasta que não é do Nexo: Enter é não" 1
  vale "e nada foi copiado" nao_existe outra2/package.json
else
  printf '  - pulado: sem o comando script para simular um terminal\n'
fi

secao "nexo-offline.sh: arquivo estragado"
python3 - "$OFF" "$W/estragado.sh" <<'PY'
import sys
linhas = open(sys.argv[1], encoding="utf-8").read().split("\n")
i = next(n for n, l in enumerate(linhas) if l == "  cat <<'PAYLOAD'") + 3000
l = linhas[i]
linhas[i] = l[:10] + ("B" if l[10] != "B" else "C") + l[11:]
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(linhas))
PY
rodar bash "$W/estragado.sh" app-estragado
codigo "pacote alterado: para" 1
tem "e explica" "não confere"
vale "sem criar a pasta" nao_existe app-estragado
head -c 900000 "$OFF" >"$W/cortado.sh"
rodar bash "$W/cortado.sh" app-cortado
codigo "arquivo cortado: para" 1
tem "e explica" "incompleto"
vale "sem criar a pasta" nao_existe app-cortado
sed 's/$/\r/' "$OFF" >"$W/crlf.sh"
rodar bash "$W/crlf.sh" -q app-crlf
codigo "com fim de linha do Windows (CRLF) funciona" 0
vale "e instala igual" igual_ao_repo app-crlf
vale "e não deixa sobra ao lado" nao_existe "$W/crlf.sh.lf"
rodar bash -c "bash -s -- -q app-pipe <'$OFF'"
codigo "rodado por pipe (bash -s) funciona" 0
vale "e instala igual (sem a cópia de si mesmo)" igual_sem_offline app-pipe

secao "nexo-offline.sh: a pasta de dados"
mkdir -p "$HOME/.nexo"
printf '{\n  "dataDir": "%s/app1/dados"\n}\n' "$W" >"$HOME/.nexo/config.json"
rodar bash "$OFF" -f app1
codigo "pasta de dados dentro da pasta do app: recusa" 1
tem "e explica" "pasta de dados"
printf '{\n  "dataDir": "%s/dados-fora"\n}\n' "$W" >"$HOME/.nexo/config.json"
rodar bash "$OFF" -fq app1
codigo "pasta de dados fora: segue" 0
rm -f "$HOME/.nexo/config.json"
rodar env NEXO_DATA_DIR="$W/app1" bash "$OFF" -f app1
codigo "NEXO_DATA_DIR apontando para a pasta do app: recusa" 1

secao "nexo-offline.sh: npm (de mentira)"
mkdir -p "$T/bin" "$T/bin-velho" "$T/bin-falha"
printf '#!/usr/bin/env bash\necho "npm $*" >>"%s/npm.log"\n' "$T" >"$T/bin/npm"
printf '#!/usr/bin/env bash\necho v18.19.0\n' >"$T/bin-velho/node"
printf '#!/usr/bin/env bash\necho "ERRO DE REDE DE MENTIRA"\nexit 1\n' >"$T/bin-falha/npm"
chmod +x "$T/bin/npm" "$T/bin-velho/node" "$T/bin-falha/npm"
rodar env PATH="$T/bin:$PATH" bash "$OFF" -fi app1
codigo "-i roda o npm" 0
vale "npm install e npm run build, nessa ordem" test "$(cat "$T/npm.log")" = "$(printf 'npm install --no-audit --no-fund\nnpm run build')"
SAIDA="${SAIDA#*Próximos passos}"
nao_tem "e os próximos passos não mandam rodar o npm de novo" "npm run build"
rodar env PATH="$T/bin-velho:$T/bin:$PATH" bash "$OFF" -fi app1
codigo "Node antigo: para antes do npm" 1
tem "e diz a versão que precisa" "Node.js 20.9"
rodar env PATH="$T/bin-falha:$PATH" bash "$OFF" -fiq app1
codigo "npm que falha: para" 1
tem "e diz o que falhou" "npm install falhou"
tem "com -q, mostra o fim do log" "ERRO DE REDE DE MENTIRA"

# ------------------------------------------------------------ baixar-nexo ----
secao "baixar-nexo.sh"
SRV="$T/srv"
mkdir -p "$SRV/codeload/Lajuro/nexo-tarefas/tar.gz" "$SRV/raw/Lajuro/nexo-tarefas/main" "$SRV/api/repos/Lajuro/nexo-tarefas/git/trees"
git -C "$T/repo" archive --prefix=nexo-tarefas-main/ HEAD | gzip >"$SRV/codeload/Lajuro/nexo-tarefas/tar.gz/main"
cp -R "$T/ref/." "$SRV/raw/Lajuro/nexo-tarefas/main/"
git -C "$T/repo" ls-tree -r HEAD | node -e '
  const linhas = require("fs").readFileSync(0, "utf8").trim().split("\n")
  const tree = linhas.map((l) => { const [m, p] = l.split("\t"); const [mode, type, sha] = m.split(" "); return { path: p, mode, type, sha } })
  process.stdout.write(JSON.stringify({ sha: "x", tree, truncated: false }))
' >"$SRV/api/repos/Lajuro/nexo-tarefas/git/trees/main"
export NEXO_ARCHIVE_BASE="file://$SRV/codeload" NEXO_RAW_BASE="file://$SRV/raw" NEXO_API_BASE="file://$SRV/api" NEXO_WEB_BASE="file://$SRV/nada"
HEAD_CURTO="$(git -C "$T/repo" rev-parse --short HEAD)"

rodar bash "$BX" -v
codigo "-v sai sem erro" 0
tem "-v mostra a versão da lista" "Nexo $VERSAO"
rodar bash "$BX" -h
tem "a ajuda mostra -m, --method" "-m, --method"
rodar bash "$BX" -m outro x
codigo "modo inválido dá erro" 1
rodar bash "$BX" -m archive bx-a
codigo "modo archive instala" 0
vale "igual ao repositório" igual_ao_repo bx-a
vale "grava de onde veio" arquivo_tem "bx-a/$MARCA" "metodo=archive"
vale "e o commit do pacote" arquivo_tem "bx-a/$MARCA" "commit=$HEAD_CURTO"
rodar bash "$BX" -m api bx-b
codigo "modo api instala" 0
vale "igual ao repositório" igual_ao_repo bx-b
tem "e confere cada arquivo" "conferidos pelo hash do git"
rodar bash "$BX" --method=manifest bx-c
codigo "modo manifest instala" 0
vale "igual ao repositório" igual_ao_repo bx-c
rodar env NEXO_ARCHIVE_BASE="file://$SRV/nada" bash "$BX" bx-d
codigo "sem o pacote, cai para a API sozinho" 0
tem "e diz isso" "API do GitHub"
vale "igual ao repositório" igual_ao_repo bx-d
rodar env NEXO_ARCHIVE_BASE="file://$SRV/nada" NEXO_API_BASE="file://$SRV/nada" NEXO_RAW_BASE="file://$SRV/nada" bash "$BX" bx-e
codigo "sem nenhum caminho: para" 1
tem "e diz o que tentar" "Não consegui baixar"
vale "sem criar a pasta" nao_existe bx-e
envelhecer bx-a
rodar bash "$BX" -m archive bx-a
codigo "pasta com outra versão, sem -f: para" 1
rodar bash "$BX" -fm archive bx-a
codigo "-f (junto com -m) atualiza" 0
vale "igual ao repositório" igual_ao_repo bx-a
vale "o arquivo que saiu foi retirado" nao_existe bx-a/lib/arquivo-que-saiu.ts
vale "a versão anterior foi guardada" arquivo_tem bx-a-anterior/README.md mexido
rodar bash "$BX" -g -r main -m archive bx-g
codigo "-g e -r main" 0
vale "cria o repositório git local" test "$(git -C bx-g rev-list --count HEAD 2>/dev/null)" = 1
vale "sem levar o arquivo de instalação para o git" test -z "$(git -C bx-g ls-files "$MARCA")"
printf 'diferente\n' >>"$SRV/raw/Lajuro/nexo-tarefas/main/README.md"
rodar bash "$BX" -m api bx-h
codigo "API com arquivo diferente do hash: para" 1
tem "e diz qual" "README.md"
rodar bash "$BX" -m manifest bx-i
codigo "lista embutida com arquivo que mudou: segue" 0
tem "mas avisa" "mudaram depois"

# -------------------------------------------------------------------- fim ----
printf '\n%s certos, %s com problema\n' "$OK" "$FALHAS"
[ "$FALHAS" = 0 ]
