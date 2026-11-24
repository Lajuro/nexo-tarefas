#!/usr/bin/env bash
# =============================================================================
#  gerar-scripts-de-copia.sh
#
#  Monta os dois scripts que copiam o projeto sem "git clone", sempre a partir
#  do que está no commit (HEAD), nunca da pasta de trabalho:
#    • scripts/baixar-nexo.sh  → cola a parte comum (scripts/copia/comum.sh) e
#                                reescreve a lista de arquivos embutida
#    • scripts/nexo-offline.sh → recria o instalador com o projeto embutido
#                                (modelo em scripts/copia/offline.modelo.sh)
#
#  Os dois levam o "carimbo do conteúdo": um hash de tudo o que está no commit,
#  fora as partes geradas. Com --check, o gerador só compara esse carimbo com o
#  commit e diz se os scripts estão em dia. O gancho .githooks/pre-push usa
#  isso para barrar um push para a main com os scripts velhos.
#
#  Uso:
#    bash scripts/gerar-scripts-de-copia.sh             # gera a partir do HEAD
#    bash scripts/gerar-scripts-de-copia.sh --commit    # gera e já faz o commit dos dois
#    bash scripts/gerar-scripts-de-copia.sh --check     # só confere o HEAD (sai com 1 se estiverem velhos)
#    bash scripts/gerar-scripts-de-copia.sh --check <commit>
#
#  Roda também no GitHub Actions (.github/workflows/scripts-de-copia.yml).
# =============================================================================
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BAIXAR="scripts/baixar-nexo.sh"
OFFLINE="scripts/nexo-offline.sh"
COMUM="scripts/copia/comum.sh"
MODELO="scripts/copia/offline.modelo.sh"
REPO="${NEXO_REPO:-Lajuro/nexo-tarefas}"
MENSAGEM_DO_COMMIT="chore: atualiza scripts de cópia sem git"

# ----------------------------------------------------------------- saída ----
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_0=$'\033[0m' C_B=$'\033[1m' C_D=$'\033[2m' C_OK=$'\033[32m' C_ER=$'\033[31m' C_AC=$'\033[35m' C_AV=$'\033[33m'
else
  C_0="" C_B="" C_D="" C_OK="" C_ER="" C_AC="" C_AV=""
fi
QUIET=0
ok() { [ "$QUIET" = 1 ] || printf '  %s %s\n' "${C_OK}✓${C_0}" "$*"; }
diga() { [ "$QUIET" = 1 ] || printf '  %s\n' "$*"; }
aviso() { printf '  %s %s\n' "${C_AV}!${C_0}" "$*" >&2; }
falha() {
  local m="$1" d
  shift
  printf '\n  %s %s\n' "${C_ER}✗${C_0}" "${C_B}$m${C_0}" >&2
  for d in "$@"; do printf '    %s\n' "$d" >&2; done
  printf '\n' >&2
  exit 1
}

ajuda() {
  sed -n '3,/^# =====/p' "$0" | sed 's/^# \{0,1\}//' | grep -v '^=====' || true
}

# ------------------------------------------------------------- argumentos ----
ACAO=gerar
ALVO=HEAD
FAZER_COMMIT=0
while [ $# -gt 0 ]; do
  case "$1" in
    -c | --check)
      ACAO=conferir
      if [ $# -gt 1 ] && [ "${2#-}" = "$2" ]; then
        ALVO="$2"
        shift
      fi
      ;;
    --commit) FAZER_COMMIT=1 ;;
    -q | --quiet) QUIET=1 ;;
    -h | --help)
      ajuda
      exit 0
      ;;
    *) falha "Opção desconhecida: $1" "Veja as opções com: bash $0 -h" ;;
  esac
  shift
done

SRC="$(git rev-parse --verify --quiet "$ALVO^{commit}")" || falha "Não achei o commit \"$ALVO\"."
CURTO="$(git rev-parse --short "$SRC")"

# --------------------------------------------------- carimbo do conteúdo ----
# O baixar-nexo.sh sem o miolo dos blocos que o gerador escreve.
sem_partes_geradas() {
  awk '/^# >>> (COMUM|MANIFESTO)/ { print; pula = 1; next }
       /^# <<< (COMUM|MANIFESTO)/ { pula = 0 }
       !pula { print }'
}

# Hash de tudo o que está no commit, sem o nexo-offline.sh e sem as partes
# geradas do baixar-nexo.sh. É o mesmo antes e depois do commit dos scripts.
carimbo_de() {
  local c="$1" bx e meta caminho
  bx="$(git show "$c:$BAIXAR" | sem_partes_geradas | git hash-object --stdin)"
  git ls-tree -r -z --full-tree "$c" | while IFS= read -r -d '' e; do
    meta="${e%%$'\t'*}"
    caminho="${e#*$'\t'}"
    case "$caminho" in
      "$OFFLINE") continue ;;
      "$BAIXAR") meta="${meta% *} $bx" ;;
    esac
    printf '%s\t%s\0' "$meta" "$caminho"
  done | git hash-object --stdin
}

carimbo_gravado() { # commit arquivo variável
  { git show "$1:$2" 2>/dev/null || true; } | sed -n "s/^$3=\"\\([0-9a-f]*\\)\"\$/\\1/p" | sed -n 1p
}

conferir() {
  local esperado off bx
  esperado="$(carimbo_de "$SRC")"
  off="$(carimbo_gravado "$SRC" "$OFFLINE" CONTEUDO)"
  bx="$(carimbo_gravado "$SRC" "$BAIXAR" MANIFEST_CONTEUDO)"
  if [ "$off" = "$esperado" ] && [ "$bx" = "$esperado" ]; then
    ok "Scripts de cópia em dia com o commit $CURTO."
    return 0
  fi
  local velhos=()
  [ "$off" = "$esperado" ] || velhos+=("$OFFLINE")
  [ "$bx" = "$esperado" ] || velhos+=("$BAIXAR")
  falha "Os scripts de cópia não estão em dia com o commit $CURTO." \
    "Desatualizado: ${velhos[*]}" \
    "" \
    "Para resolver (gera a partir do commit e faz o commit dos dois scripts):" \
    "  bash scripts/gerar-scripts-de-copia.sh --commit" \
    "Depois é só fazer o push de novo."
}

if [ "$ACAO" = conferir ]; then
  conferir
  exit 0
fi

# ------------------------------------------------------------------ gerar ----
[ "$(git rev-parse HEAD)" = "$SRC" ] || falha "O gerador só monta a partir do HEAD."

# Os scripts saem do commit. Mudança fora dele ficaria de fora sem ninguém ver.
sujos="$(git status --porcelain=v1 --untracked-files=no -- . ":(exclude)$BAIXAR" ":(exclude)$OFFLINE")"
if [ -n "$sujos" ]; then
  falha "Há mudanças que ainda não estão no commit:" "$sujos" "" \
    "Os scripts são montados a partir do commit, não da pasta. Faça o commit e rode de novo."
fi
if [ -f "$BAIXAR" ] && [ "$(sem_partes_geradas <"$BAIXAR" | git hash-object --stdin)" != "$(git show "HEAD:$BAIXAR" | sem_partes_geradas | git hash-object --stdin)" ]; then
  falha "O $BAIXAR tem mudanças fora das partes geradas que ainda não estão no commit." \
    "O gerador reescreve o arquivo: faça o commit dele antes e rode de novo."
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "$BAIXAR" "$COMUM" "$MODELO"; do
  git cat-file -e "$SRC:$f" 2>/dev/null || falha "Falta $f no commit $CURTO."
done
git show "$SRC:$BAIXAR" >"$TMP/baixar.origem"
for m in "# >>> COMUM" "# <<< COMUM" "# >>> MANIFESTO" "# <<< MANIFESTO"; do
  grep -q "^$m" "$TMP/baixar.origem" || falha "O $BAIXAR perdeu a linha \"$m\": o gerador não sabe onde escrever."
done
novos="$(git ls-files --others --exclude-standard | grep -c . || true)"
[ "$novos" = 0 ] || aviso "$novos arquivo(s) novos ainda fora do git ficam de fora dos scripts (git status mostra quais)."

# commit e data do conteúdo (o último commit que não foi só dos scripts gerados)
ORIGEM="$(git log -1 --format=%h "$SRC" -- . ":(exclude)$BAIXAR" ":(exclude)$OFFLINE")"
[ -n "$ORIGEM" ] || ORIGEM="$CURTO"
DATA="$(git log -1 --format=%cs "$ORIGEM")"
VERSAO="$(git show "$SRC:package.json" | sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' | sed -n 1p)"
CARIMBO="$(carimbo_de "$SRC")"

corpo_de() { git show "$SRC:$1" | awk 'achou { print } /^# >>> corpo$/ { achou = 1 }'; }

tamanho_legivel() {
  awk -v b="$1" 'BEGIN {
    if (b >= 1048576) s = sprintf("%.1f MB", b / 1048576); else s = sprintf("%d KB", int(b / 1024 + 0.5))
    gsub(/\./, ",", s); print s }'
}

# ------------------------------------------------------- baixar-nexo.sh ----
corpo_de "$COMUM" >"$TMP/comum"
{
  printf 'MANIFEST_COMMIT="%s"\n' "$ORIGEM"
  printf 'MANIFEST_VERSAO="%s"\n' "$VERSAO"
  printf 'MANIFEST_CONTEUDO="%s"\n' "$CARIMBO"
  printf 'manifest() {\n'
  printf "  cat <<'MANIFESTO'\n"
  git ls-tree -r -z --full-tree "$SRC" | while IFS= read -r -d '' e; do
    meta="${e%%$'\t'*}"
    caminho="${e#*$'\t'}"
    read -r modo tipo sha <<<"$meta"
    [ "$tipo" = blob ] || continue
    case "$caminho" in "$BAIXAR" | "$OFFLINE") sha="-" ;; esac
    printf '%s %s %s\n' "$modo" "$sha" "$caminho"
  done
  printf 'MANIFESTO\n}\n'
} >"$TMP/manifesto"
TOTAL_LISTA="$(git ls-tree -r "$SRC" | grep -c . || true)"

awk -v comum="$TMP/comum" -v manifesto="$TMP/manifesto" '
  function despeja(arq,  l) { while ((getline l < arq) > 0) print l; close(arq) }
  /^# >>> COMUM/     { print; print "# (gerado de scripts/copia/comum.sh: não edite aqui, edite lá e gere de novo)"; despeja(comum); pula = 1; next }
  /^# >>> MANIFESTO/ { print; despeja(manifesto); pula = 1; next }
  /^# <<< (COMUM|MANIFESTO)/ { pula = 0 }
  !pula { print }
' "$TMP/baixar.origem" >"$TMP/baixar"
bash -n "$TMP/baixar" || falha "O $BAIXAR gerado tem erro de sintaxe (veja acima)."
cp "$TMP/baixar" "$BAIXAR"
chmod +x "$BAIXAR"
ok "$BAIXAR ${C_D}lista com $TOTAL_LISTA arquivos, commit $ORIGEM${C_0}"

# ------------------------------------------------------ nexo-offline.sh ----
# O pacote sai do git (sem passar pela pasta de trabalho): mesmos bytes, modos e
# fins de linha do repositório em qualquer sistema. É a árvore do commit com o
# baixar-nexo.sh recém-gerado e sem o próprio nexo-offline.sh.
MODO_BX="$(git ls-tree "$SRC" -- "$BAIXAR" | cut -d' ' -f1)"
BLOB_BX="$(git hash-object -w --no-filters "$BAIXAR")"
export GIT_INDEX_FILE="$TMP/index"
git read-tree "$SRC"
git update-index --add --cacheinfo "$MODO_BX,$BLOB_BX,$BAIXAR"
git update-index --force-remove -- "$OFFLINE"
ARVORE="$(git write-tree)"
unset GIT_INDEX_FILE
FIXO="$(GIT_AUTHOR_NAME=Nexo GIT_AUTHOR_EMAIL=nexo@local GIT_AUTHOR_DATE="2000-01-01T00:00:00Z" \
  GIT_COMMITTER_NAME=Nexo GIT_COMMITTER_EMAIL=nexo@local GIT_COMMITTER_DATE="2000-01-01T00:00:00Z" \
  git commit-tree --no-gpg-sign "$ARVORE" -m "nexo-offline")"
git -c tar.umask=022 -c core.autocrlf=false archive --format=tar "$FIXO" | gzip -9n >"$TMP/p.tgz"

if base64 -w 76 </dev/null >/dev/null 2>&1; then
  base64 -w 76 "$TMP/p.tgz" >"$TMP/p.b64"
else
  base64 -b 76 -i "$TMP/p.tgz" >"$TMP/p.b64"
fi
if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$TMP/p.tgz" | cut -d' ' -f1)"
else
  SHA256="$(shasum -a 256 "$TMP/p.tgz" | cut -d' ' -f1)"
fi
TOTAL="$(git ls-tree -r "$ARVORE" | grep -c . || true)"
TAMANHO="$(tamanho_legivel "$(wc -c <"$TMP/p.tgz")")"
TAMANHO_SCRIPT="$(tamanho_legivel "$(($(wc -c <"$TMP/p.b64") + 60000))")"

{
  cat <<'TOPO'
#!/usr/bin/env bash
# shellcheck disable=SC2034
if grep -q $'\r' "$0" 2>/dev/null; then _lf="$(mktemp 2>/dev/null || echo "$0.lf")"; tr -d '\r' <"$0" >"$_lf" && NEXO_LF_COPY="$_lf" exec bash "$_lf" "$@"; fi #
TOPO
  cat <<EOF
# =============================================================================
#  nexo-offline.sh · o Nexo $VERSAO inteiro, para instalar sem internet
#
#  O projeto está aqui dentro (tar.gz em base64, conferido por SHA-256). Use
#  quando nem o baixar-nexo.sh consegue acessar o GitHub: leve este arquivo
#  para o computador e rode no Git Bash.
#
#  Origem: commit $ORIGEM de $DATA · $TOTAL arquivos · $TAMANHO compactado
#
#    bash nexo-offline.sh                # instala em ./nexo-tarefas
#    bash nexo-offline.sh -i nexo-app    # instala em ./nexo-app e já faz o build
#    bash nexo-offline.sh -h             # todas as opções
#
#  Gerado por scripts/gerar-scripts-de-copia.sh (de scripts/copia/), não edite.
# =============================================================================
set -euo pipefail

# Cortado ao copiar? Avisa antes de qualquer coisa.
case "\$(tail -c 40 "\${NEXO_LF_COPY:-\$0}" 2>/dev/null || true)" in
  "" | *"# fim do nexo-offline.sh"*) ;;
  *)
    printf '\n  ✗ Este nexo-offline.sh está incompleto: foi cortado ao ser copiado.\n    Copie de novo o arquivo inteiro (cerca de %s) e rode outra vez.\n\n' "$TAMANHO_SCRIPT" >&2
    exit 1
    ;;
esac

NOME_SCRIPT="nexo-offline.sh"
REPO="$REPO"
NEXO_VERSAO="$VERSAO"
COMMIT="$ORIGEM"
COMMIT_DATA="$DATA"
CONTEUDO="$CARIMBO"
SHA256="$SHA256"
TOTAL_ARQUIVOS=$TOTAL
TAMANHO="$TAMANHO"
TAMANHO_SCRIPT="$TAMANHO_SCRIPT"
SEM_COR=0 QUIET=0

# >>> comum (de scripts/copia/comum.sh)
EOF
  cat "$TMP/comum"
  printf '# <<< comum\n\n'
  corpo_de "$MODELO"
  printf '\npayload() {\n'
  printf "  cat <<'PAYLOAD'\n"
  cat "$TMP/p.b64"
  printf 'PAYLOAD\n}\n\nmain "$@"\n# fim do nexo-offline.sh\n'
} >"$TMP/offline"
bash -n "$TMP/offline" || falha "O $OFFLINE gerado tem erro de sintaxe (veja acima)."
cp "$TMP/offline" "$OFFLINE"
chmod +x "$OFFLINE"
ok "$OFFLINE ${C_D}$TOTAL arquivos, $TAMANHO compactado, Nexo $VERSAO${C_0}"

# ------------------------------------------------------------------ fim ----
if git diff --quiet -- "$BAIXAR" "$OFFLINE"; then
  diga "${C_D}Os dois já estavam em dia: nada mudou.${C_0}"
  exit 0
fi
if [ "$FAZER_COMMIT" = 1 ]; then
  git add -- "$BAIXAR" "$OFFLINE"
  git commit -q -m "$MENSAGEM_DO_COMMIT" -- "$BAIXAR" "$OFFLINE"
  ok "Commit $(git rev-parse --short HEAD): $MENSAGEM_DO_COMMIT"
  diga "${C_D}Agora é só fazer o push.${C_0}"
else
  [ "$QUIET" = 1 ] || printf '\n'
  diga "Agora faça o commit dos dois (ou rode de novo com --commit):"
  diga "  ${C_AC}git commit -m \"$MENSAGEM_DO_COMMIT\" -- $BAIXAR $OFFLINE${C_0}"
fi
