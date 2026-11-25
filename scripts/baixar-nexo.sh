#!/usr/bin/env bash
# shellcheck disable=SC2034
if grep -q $'\r' "$0" 2>/dev/null; then _lf="$(mktemp 2>/dev/null || echo "$0.lf")"; tr -d '\r' <"$0" >"$_lf" && NEXO_LF_COPY="$_lf" exec bash "$_lf" "$@"; fi #
# =============================================================================
#  baixar-nexo.sh · instala ou atualiza o Nexo sem "git clone"
#
#  Para redes corporativas em que o GitHub abre no navegador, mas o git é
#  bloqueado. Tenta, nesta ordem, até um funcionar:
#    1. archive  → o pacote .tar.gz/.zip do repositório (um download só)
#    2. api      → a lista de arquivos pela API do GitHub e um por um
#    3. manifest → a lista embutida neste script e um por um
#  Nos dois últimos, cada arquivo é conferido pelo hash do git.
#
#    bash baixar-nexo.sh -i nexo-app     # instala em ./nexo-app e já faz o build
#    bash baixar-nexo.sh -fi nexo-app    # atualiza sem perguntar e faz o build
#    bash baixar-nexo.sh -h              # todas as opções
#
#  Os blocos ">>> COMUM" e ">>> MANIFESTO" são gerados por
#  scripts/gerar-scripts-de-copia.sh: edite scripts/copia/comum.sh e gere de novo.
# =============================================================================
set -euo pipefail

NOME_SCRIPT="baixar-nexo.sh"
REPO="${NEXO_REPO:-Lajuro/nexo-tarefas}"
ARCHIVE_BASE="${NEXO_ARCHIVE_BASE:-https://codeload.github.com}"
RAW_BASE="${NEXO_RAW_BASE:-https://raw.githubusercontent.com}"
API_BASE="${NEXO_API_BASE:-https://api.github.com}"
WEB_BASE="${NEXO_WEB_BASE:-https://github.com}"
AGENTE="nexo-baixar/2.0"
SEM_COR=0 QUIET=0

# >>> COMUM
# (gerado de scripts/copia/comum.sh: não edite aqui, edite lá e gere de novo)

# ----------------------------------------------------------- saída e cores ----
MARCA=".nexo-instalacao"
NODE_MINIMO="20.9"
PORTA_DO_APP=3210

usar_cores() {
  if [ "${SEM_COR:-0}" = 1 ] || [ -n "${NO_COLOR:-}" ] || [ "${TERM:-}" = dumb ] ||
    { [ ! -t 1 ] && [ ! -t 2 ] && [ -z "${FORCE_COLOR:-}" ]; }; then
    C_0="" C_B="" C_D="" C_OK="" C_AV="" C_ER="" C_AC="" C_IN=""
  else
    C_0=$'\033[0m' C_B=$'\033[1m' C_D=$'\033[2m' C_OK=$'\033[32m'
    C_AV=$'\033[33m' C_ER=$'\033[31m' C_AC=$'\033[35m' C_IN=$'\033[36m'
  fi
}
usar_cores

diga() { [ "$QUIET" = 1 ] || printf '  %s\n' "$*"; }
passo() { [ "$QUIET" = 1 ] || printf '  %s %s\n' "${C_AC}›${C_0}" "$*"; }
ok() { [ "$QUIET" = 1 ] || printf '  %s %s\n' "${C_OK}✓${C_0}" "$*"; }
sutil() { [ "$QUIET" = 1 ] || printf '  %s\n' "${C_D}$*${C_0}"; }
aviso() { printf '  %s %s\n' "${C_AV}!${C_0}" "$*" >&2; }
dica() { printf '    %s\n' "${C_D}$*${C_0}" >&2; }
linha() { [ "$QUIET" = 1 ] || printf '\n'; }
plural() { if [ "$1" = 1 ]; then printf '%s %s' "$1" "$2"; else printf '%s %s' "$1" "$3"; fi; }

# falha "o que aconteceu" ["o que fazer" ...]: mostra e sai com código 1
falha() {
  local m="$1" d
  shift
  printf '\n  %s %s\n' "${C_ER}✗${C_0}" "${C_B}$m${C_0}" >&2
  for d in "$@"; do printf '    %s\n' "$d" >&2; done
  printf '\n' >&2
  exit 1
}

cabecalho() { # título [detalhe]
  [ "$QUIET" = 1 ] && return 0
  printf '\n  %s %s\n' "${C_AC}${C_B}◆${C_0}" "${C_B}$1${C_0}"
  [ -n "${2:-}" ] && printf '    %s\n' "${C_D}$2${C_0}"
  printf '\n'
}

# ------------------------------------------------------------------ flags ----
# Deixa as flags no jeito de sempre antes de ler: "-fi" vira "-f -i" e
# "-rmain" vira "-r main" (as letras em $1 levam valor). O resultado fica em ARGS.
normalizar_args() {
  local com_valor="$1" a i c
  shift
  ARGS=()
  while [ $# -gt 0 ]; do
    a="$1"
    shift
    case "$a" in
      --)
        ARGS+=("--" "$@")
        return 0
        ;;
      --* | - | -? | [!-]*) ARGS+=("$a") ;;
      -*)
        for ((i = 1; i < ${#a}; i++)); do
          c="${a:i:1}"
          ARGS+=("-$c")
          if [ -n "$com_valor" ] && [[ "$com_valor" == *"$c"* ]]; then
            [ $((i + 1)) -lt ${#a} ] && ARGS+=("${a:i+1}")
            break
          fi
        done
        ;;
    esac
  done
}

definir_destino() {
  [ -z "${DEST:-}" ] || falha "Informe uma pasta só (recebi \"$DEST\" e \"$1\")." \
    "Pasta com espaço no nome vai entre aspas: bash $NOME_SCRIPT \"minha pasta\""
  DEST="$1"
}

opcao_desconhecida() {
  falha "Opção desconhecida: $1" "Veja as opções com: bash $NOME_SCRIPT -h"
}

# --------------------------------------------------------------- perguntas ----
# perguntar "pergunta" s|n  →  0 = sim, 1 = não, 2 = não dá para perguntar.
# Lê do /dev/tty, então também funciona com "curl ... | bash". Em automação
# (variável CI, como no GitHub Actions) nunca pergunta.
perguntar() {
  local q="$1" padrao="$2" op resp
  [ "$ASSUME_YES" = 1 ] && return 0
  case "${CI:-}" in "" | 0 | false) ;; *) return 2 ;; esac
  { : </dev/tty; } 2>/dev/null || return 2
  if [ "$padrao" = s ]; then op="[S/n]"; else op="[s/N]"; fi
  while :; do
    printf '  %s %s %s ' "${C_IN}?${C_0}" "${C_B}$q${C_0}" "${C_D}$op${C_0}" >/dev/tty
    if ! IFS= read -r resp </dev/tty; then
      resp=""
      printf '\n' >/dev/tty
    fi
    case "$resp" in
      "") [ "$padrao" = s ] && return 0 || return 1 ;;
      [sSyY] | [sS][iI][mM] | [yY][eE][sS]) return 0 ;;
      n | N | nao | Nao | NAO | não | Não | NÃO | no | No | NO) return 1 ;;
      *) printf '    %s\n' "${C_D}Responda s (sim) ou n (não).${C_0}" >/dev/tty ;;
    esac
  done
}

# ----------------------------------------------------------------- pastas ----
caminho_absoluto() { # pasta (existente ou não) → caminho absoluto
  local p="$1" pai base
  if [ -d "$p" ]; then
    (cd "$p" && pwd -P)
    return 0
  fi
  pai="$(dirname "$p")"
  base="$(basename "$p")"
  if [ -d "$pai" ]; then
    pai="$(cd "$pai" && pwd -P)"
    printf '%s/%s\n' "${pai%/}" "$base"
  else
    printf '%s\n' "$p"
  fi
}

# Caminho do jeito que a pessoa reconhece: no Git Bash, C:\Users\... em vez de /c/Users/...
para_mostrar() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1" 2>/dev/null || printf '%s\n' "$1"
  else
    printf '%s\n' "$1"
  fi
}

avisar_se_wsl() {
  if [ -r /proc/version ] && grep -qi microsoft /proc/version 2>/dev/null; then
    aviso "Este terminal é do WSL (o Linux dentro do Windows): o Nexo vai ficar dentro do WSL."
    dica "Para usar o Nexo no Windows, rode no Git Bash."
  fi
}

preparar_trabalho() {
  TRABALHO="$(mktemp -d 2>/dev/null || mktemp -d -t nexo)"
  trap limpar EXIT
  trap interrompido INT TERM
}

limpar() {
  [ -n "${TRABALHO:-}" ] && rm -rf "$TRABALHO"
  [ -n "${NEXO_LF_COPY:-}" ] && rm -f "$NEXO_LF_COPY"
  return 0
}

interrompido() {
  printf '\n' >&2
  if [ "${ETAPA:-}" = copiando ]; then
    falha "Interrompido no meio da cópia: a pasta $(para_mostrar "$DEST") pode ter ficado pela metade." \
      "A versão anterior está em $(para_mostrar "$ANTERIOR"). Rode de novo para terminar."
  fi
  aviso "Cancelado. Nada foi mudado."
  exit 130
}

versao_em() { # pasta → versão do Nexo que está nela (vazio se não for o Nexo)
  local pj="$1/package.json"
  [ -f "$pj" ] || return 0
  grep -q '"name": *"nexo-tarefas"' "$pj" 2>/dev/null || return 0
  sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p;/"version"/q' "$pj"
}

ler_marca() { # pasta campo → valor gravado no arquivo de instalação
  [ -f "$1/$MARCA" ] || return 0
  sed -n "/^--- arquivos\$/q;s/^$2=//p" "$1/$MARCA"
}

arquivos_da_marca() { # pasta → arquivos que a instalação anterior pôs lá
  [ -f "$1/$MARCA" ] || return 0
  sed -n '/^--- arquivos$/,$p' "$1/$MARCA" | sed '1d'
}

# Olha a pasta de destino. DEST_ESTADO: nova (não existe ou vazia), nexo ou outra.
analisar_destino() {
  DEST_ESTADO=nova DEST_VERSAO="" DEST_CONTEUDO="" DEST_QTD=0
  DEST_ABS="$(caminho_absoluto "$DEST")"
  ANTERIOR="${DEST_ABS%/}-anterior"
  if [ -e "$DEST" ] && [ ! -d "$DEST" ]; then
    falha "\"$DEST\" já existe e não é uma pasta." "Escolha outro nome para a pasta."
  fi
  [ -d "$DEST" ] || return 0
  [ -n "$(ls -A "$DEST" 2>/dev/null)" ] || return 0
  DEST_VERSAO="$(versao_em "$DEST")"
  if [ -n "$DEST_VERSAO" ] || [ -f "$DEST/$MARCA" ]; then
    DEST_ESTADO=nexo
    DEST_CONTEUDO="$(ler_marca "$DEST" conteudo)"
  else
    DEST_ESTADO=outra
    DEST_QTD="$(find "$DEST" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')"
  fi
}

# Pasta com arquivos: pergunta se pode usar (ou segue com -f / -y).
# $1 = o que vai entrar ("o Nexo 3.24.0"), $2 = conteúdo novo (vazio se não se sabe).
# Deixa SO_NPM=1 quando a pasta já está em dia e não há o que copiar.
confirmar_destino() {
  local novo="$1" conteudo="${2:-}" mostrar r q
  case "$DEST" in . | ./) mostrar="$(para_mostrar "$DEST_ABS")" ;; *) mostrar="$DEST" ;; esac
  SO_NPM=0
  case "$DEST_ESTADO" in
    nova) return 0 ;;
    nexo)
      if [ -n "$conteudo" ] && [ "$DEST_CONTEUDO" = "$conteudo" ] && [ "$FORCE" = 0 ]; then
        ok "A pasta $mostrar já tem ${novo}, com este mesmo conteúdo."
        perguntar "Instalar de novo mesmo assim?" n && return 0 || r=$?
        [ "$r" = 2 ] && sutil "  Para instalar de novo, use -f."
        SO_NPM=1
        return 0
      fi
      diga "A pasta ${C_B}$mostrar${C_0} já tem o Nexo ${DEST_VERSAO:-de uma versão antiga}."
      [ "$FORCE" = 1 ] && return 0
      if [ "$NO_BACKUP" = 0 ]; then q="Atualizar para ${novo}? (a versão atual fica guardada)"; else q="Atualizar para ${novo}?"; fi
      perguntar "$q" s && return 0 || r=$?
      [ "$r" = 1 ] && {
        aviso "Cancelado. Nada foi mudado."
        exit 1
      }
      falha "A pasta $mostrar já tem o Nexo ${DEST_VERSAO:-de uma versão antiga}." \
        "Para atualizar, rode de novo com -f (ex.: bash $NOME_SCRIPT -f \"$DEST\")." \
        "A versão atual fica guardada em $(para_mostrar "$ANTERIOR") antes de qualquer mudança."
      ;;
    outra)
      diga "A pasta ${C_B}$mostrar${C_0} já tem $DEST_QTD itens e não parece ser do Nexo."
      if [ "$FORCE" = 1 ]; then
        aviso "Usando mesmo assim (-f): arquivos com o mesmo nome serão substituídos."
        return 0
      fi
      perguntar "Pôr o Nexo nela mesmo assim? Arquivos com o mesmo nome serão substituídos." n && return 0 || r=$?
      [ "$r" = 1 ] && {
        aviso "Cancelado. Nada foi mudado."
        exit 1
      }
      falha "A pasta $mostrar já tem arquivos e não parece ser do Nexo." \
        "Escolha uma pasta vazia (ex.: bash $NOME_SCRIPT nexo-app)" \
        "ou use -f para usar esta mesmo assim."
      ;;
  esac
}

# ------------------------------------------------- a pasta de dados é sagrada ----
pasta_de_dados() { # imprime a pasta de dados configurada no app, se houver
  local cfg dd
  if [ -n "${NEXO_DATA_DIR:-}" ]; then
    printf '%s\n' "$NEXO_DATA_DIR"
    return 0
  fi
  for cfg in "${HOME:-}/.nexo/config.json" "${USERPROFILE:-}/.nexo/config.json"; do
    [ -n "${cfg%/.nexo/config.json}" ] || continue
    if [ ! -f "$cfg" ] && command -v cygpath >/dev/null 2>&1; then
      cfg="$(cygpath -u "$cfg" 2>/dev/null || true)"
    fi
    [ -f "$cfg" ] || continue
    dd="$(sed -n 's/.*"dataDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$cfg" | sed -n '1{s/\\\\/\\/g;p;}')"
    if [ -n "$dd" ]; then
      printf '%s\n' "$dd"
      return 0
    fi
  done
}

# Recusa instalar numa pasta que contém a pasta de dados (mesma regra do app e
# do instalar-nexo.ps1): atualizar o app nunca pode chegar perto dos dados.
conferir_pasta_de_dados() {
  local dd a b
  dd="$(pasta_de_dados)"
  [ -n "$dd" ] || return 0
  if command -v cygpath >/dev/null 2>&1; then dd="$(cygpath -u "$dd" 2>/dev/null || printf '%s' "$dd")"; fi
  a="$(caminho_absoluto "$dd")"
  b="$DEST_ABS"
  if command -v cygpath >/dev/null 2>&1; then # Windows: maiúsculas não contam
    a="$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')"
    b="$(printf '%s' "$b" | tr '[:upper:]' '[:lower:]')"
  fi
  case "${a%/}/" in
    "${b%/}"/*)
      falha "Sua pasta de dados ($(para_mostrar "$dd")) fica dentro de $(para_mostrar "$DEST_ABS")." \
        "Instalar aqui poderia mexer nos seus dados, então parei antes de tocar em qualquer coisa." \
        "Mude a pasta de dados para fora da pasta do app (no Nexo: Configurações > Pasta de dados)" \
        "ou escolha outra pasta para o app."
      ;;
  esac
}

# ------------------------------------------------------------- instalação ----
lista_de_arquivos() { # pasta → arquivos (caminho relativo), ordenados
  (cd "$1" && find . -type f ! -name "$MARCA" -print) | sed 's|^\./||' | LC_ALL=C sort
}

# Arquivos que a versão anterior pôs na pasta e que não existem na nova.
# Com o arquivo de instalação, a lista é exata. Sem ele (instalação feita por um
# script antigo), vale o que está nas pastas de código, e só com a cópia em
# <pasta>-anterior garantida.
arquivos_que_sairam() { # lista nova
  local antigos="$TRABALHO/antigos.txt" d
  if [ -f "$DEST/$MARCA" ]; then
    arquivos_da_marca "$DEST" >"$antigos"
  elif [ "$DEST_ESTADO" = nexo ] && [ "$NO_BACKUP" = 0 ]; then
    : >"$antigos"
    for d in app components lib scripts testes .github; do
      [ -d "$DEST/$d" ] && (cd "$DEST" && find "$d" -type f -print) >>"$antigos"
    done
  else
    return 0
  fi
  LC_ALL=C sort -u "$antigos" -o "$antigos"
  LC_ALL=C comm -23 "$antigos" "$1" | grep -v -x -e 'scripts/nexo-offline.sh' -e '' || true
}

# Só apaga o que fica de verdade dentro da pasta (o arquivo de instalação é
# texto: um caminho com ".." ou que passa por um atalho para fora é ignorado).
dentro_do_destino() {
  local f="$1" pai
  case "/$f/" in */../* | */./* | *//*) return 1 ;; esac
  case "$f" in /*) return 1 ;; esac
  pai="$(cd "$DEST/$(dirname "$f")" 2>/dev/null && pwd -P)" || return 1
  case "${pai%/}/" in "${DEST_ABS%/}"/*) return 0 ;; esac
  return 1
}

guardar_anterior() {
  passo "Guardando a versão atual em ${DEST%/}-anterior"
  rm -rf "$ANTERIOR"
  mkdir -p "$ANTERIOR"
  if ! (cd "$DEST" && tar --exclude=node_modules --exclude=.next --exclude=.git -cf - .) | (cd "$ANTERIOR" && tar -xf -); then
    falha "Não consegui guardar a versão atual em $(para_mostrar "$ANTERIOR")." \
      "Nada foi mudado em $(para_mostrar "$DEST_ABS"). Confira o espaço em disco e as permissões."
  fi
  ok "Versão atual guardada"
}

# Põe na pasta o que está em $1 (já conferido). Também usada no -n: aí só conta.
# $2 versão, $3 commit, $4 conteúdo, $5 de onde veio.
instalar_na_pasta() {
  local stage="$1" versao="$2" commit="$3" conteudo="$4" metodo="$5"
  local novos="$TRABALHO/novos.txt" saem="$TRABALHO/saem.txt"
  local total n_novos=0 n_mudam=0 n_saem iguais f d partes=() juntas
  lista_de_arquivos "$stage" >"$novos"
  arquivos_que_sairam "$novos" >"$saem"
  total="$(grep -c . "$novos" || true)"
  n_saem="$(grep -c . "$saem" || true)"
  if [ "$DEST_ESTADO" != nova ]; then
    while IFS= read -r f; do [ -e "$DEST/$f" ] || n_novos=$((n_novos + 1)); done <"$novos"
    if command -v diff >/dev/null 2>&1; then
      n_mudam="$({ diff -rq -x node_modules -x .next -x .git -x "$MARCA" "$stage" "$DEST" 2>/dev/null || true; } | grep -c '^Files ' || true)"
    fi
  else
    n_novos="$total"
  fi
  iguais=$((total - n_novos - n_mudam))
  if [ "$DEST_ESTADO" = nova ]; then
    RESUMO="$(plural "$total" "arquivo copiado" "arquivos copiados")"
  else
    [ "$n_novos" -gt 0 ] && partes+=("$(plural "$n_novos" novo novos)")
    [ "$n_mudam" -gt 0 ] && partes+=("$(plural "$n_mudam" atualizado atualizados)")
    [ "$n_saem" -gt 0 ] && partes+=("$(plural "$n_saem" retirado retirados)")
    if [ "${#partes[@]}" -eq 0 ]; then
      RESUMO="Nenhum arquivo mudou ($total iguais)"
    else
      printf -v juntas '%s, ' "${partes[@]}"
      RESUMO="${juntas%, }"
      [ "$iguais" = 0 ] || RESUMO="$RESUMO ${C_D}($iguais iguais)${C_0}"
    fi
  fi

  if [ "$DRY_RUN" = 1 ]; then
    linha
    diga "${C_B}O que mudaria em $(para_mostrar "$DEST_ABS")${C_0}"
    diga "  • $RESUMO"
    [ "$DEST_ESTADO" = outra ] && diga "  • a pasta não parece ser do Nexo: para usar mesmo assim, -f"
    if [ "$n_saem" -gt 0 ]; then
      diga "  • sairiam (não existem mais no Nexo):"
      head -n 10 "$saem" | while IFS= read -r f; do sutil "      $f"; done
      [ "$n_saem" -gt 10 ] && sutil "        e mais $((n_saem - 10))"
    fi
    if [ "$DEST_ESTADO" = nexo ] && [ "$NO_BACKUP" = 0 ]; then
      diga "  • a versão atual iria para ${DEST%/}-anterior"
    fi
    linha
    ok "Nada foi gravado (-n, --dry-run)."
    return 0
  fi

  BACKUP_FEITO=0
  if [ "$DEST_ESTADO" = nexo ] && [ "$NO_BACKUP" = 0 ]; then
    guardar_anterior
    BACKUP_FEITO=1
  fi

  if [ "$DEST_ESTADO" = nexo ]; then passo "Atualizando $DEST"; else passo "Copiando para $DEST"; fi
  ETAPA=copiando
  mkdir -p "$DEST"
  if ! cp -R "$stage"/. "$DEST"/; then
    if [ "$BACKUP_FEITO" = 1 ]; then
      falha "A cópia para $(para_mostrar "$DEST_ABS") falhou no meio." \
        "A versão anterior está inteira em $(para_mostrar "$ANTERIOR"). Rode de novo para terminar."
    fi
    falha "A cópia para $(para_mostrar "$DEST_ABS") falhou." "Confira o espaço em disco e as permissões e rode de novo."
  fi
  if [ "$n_saem" -gt 0 ]; then
    while IFS= read -r f; do
      if [ -z "$f" ] || ! dentro_do_destino "$f"; then continue; fi
      if [ -f "$DEST/$f" ] && [ ! -L "$DEST/$f" ]; then rm -f -- "$DEST/$f"; fi
      d="$(dirname "$f")"
      while [ "$d" != . ] && rmdir -- "$DEST/$d" 2>/dev/null; do d="$(dirname "$d")"; done
    done <"$saem"
  fi
  {
    echo "# Gravado pelo instalador do Nexo. Não apague: é por ele que a próxima"
    echo "# atualização sabe quais arquivos são do Nexo e tira os que saíram."
    echo "versao=$versao"
    echo "commit=$commit"
    echo "conteudo=$conteudo"
    echo "metodo=$metodo"
    echo "instalado=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "--- arquivos"
    cat "$novos"
  } >"$DEST/$MARCA"
  ETAPA=""
  ok "$RESUMO"
}

# ---------------------------------------------------------------- npm ----
nexo_aberto() { # o servidor do Nexo está respondendo nesta máquina?
  local limite=()
  command -v timeout >/dev/null 2>&1 && limite=(timeout 2)
  "${limite[@]+"${limite[@]}"}" bash -c "exec 3<>/dev/tcp/127.0.0.1/$PORTA_DO_APP" 2>/dev/null
}

node_atende() { # versão do Node instalada é a que o Next pede?
  local v maj min
  v="$(node -v 2>/dev/null || true)"
  v="${v#v}"
  maj="${v%%.*}"
  min="${v#*.}"
  min="${min%%.*}"
  case "$maj$min" in '' | *[!0-9]*) return 0 ;; esac
  [ "$maj" -gt 20 ] || { [ "$maj" -eq 20 ] && [ "$min" -ge 9 ]; }
}

rodar_npm_passo() { # rótulo comando...
  local rotulo="$1" log="$TRABALHO/npm.log"
  shift
  passo "$rotulo"
  if [ "$QUIET" = 1 ]; then
    if (cd "$DEST" && "$@") >"$log" 2>&1; then return 0; fi
    tail -n 30 "$log" >&2
    return 1
  fi
  (cd "$DEST" && "$@")
}

rodar_npm() {
  NPM_RODOU=0
  if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    aviso "Não achei o Node.js (node e npm): pulei o npm install e o build."
    dica "Instale o Node.js $NODE_MINIMO ou mais novo e rode npm install e npm run build na pasta."
    return 0
  fi
  if ! node_atende; then
    falha "O Nexo precisa do Node.js $NODE_MINIMO ou mais novo, e este computador tem o $(node -v)." \
      "Os arquivos já estão na pasta. Atualize o Node.js e rode npm install e npm run build nela."
  fi
  if nexo_aberto; then
    aviso "O Nexo está aberto (http://127.0.0.1:$PORTA_DO_APP)."
    dica "Feche a janela do Nexo antes do build: com ele aberto, o Windows trava arquivos e o build pode falhar."
    local r=0
    perguntar "Já fechei. Continuar?" s || r=$?
    if [ "$r" = 1 ]; then
      falha "Parei antes do npm install." "Os arquivos já estão na pasta. Feche o Nexo e rode npm install e npm run build nela."
    fi
  fi
  linha
  rodar_npm_passo "npm install ${C_D}(na primeira vez demora alguns minutos)${C_0}" npm install --no-audit --no-fund ||
    falha "O npm install falhou." "Confira a mensagem acima (proxy, rede ou versão do Node)" \
      "e rode de novo dentro da pasta: npm install && npm run build"
  if ! rodar_npm_passo "npm run build" npm run build; then
    if [ "${BACKUP_FEITO:-0}" = 1 ]; then
      falha "O build falhou." "Confira a mensagem acima e rode de novo dentro da pasta: npm run build" \
        "A versão anterior está inteira em $(para_mostrar "$ANTERIOR")."
    fi
    falha "O build falhou." "Confira a mensagem acima e rode de novo dentro da pasta: npm run build"
  fi
  ok "Dependências instaladas e build feito"
  NPM_RODOU=1
}

proximos_passos() { # versão
  local versao="$1" mostrar
  mostrar="$(para_mostrar "$DEST_ABS")"
  if [ "$QUIET" = 1 ]; then
    printf 'Nexo %s em %s\n' "$versao" "$mostrar"
    return 0
  fi
  printf '\n  %s %s %s\n' "${C_OK}${C_B}✓${C_0}" "${C_B}Nexo $versao pronto em $mostrar${C_0}" "${C_D}(${SECONDS}s)${C_0}"
  [ "${BACKUP_FEITO:-0}" = 1 ] && sutil "  A versão anterior ficou em $(para_mostrar "$ANTERIOR")"
  printf '\n  %s\n' "${C_B}Próximos passos${C_0}"
  printf '    cd "%s"\n' "$DEST"
  if [ "${NPM_RODOU:-0}" != 1 ]; then
    printf '    npm install\n'
    printf '    npm run build\n'
  fi
  printf '    npm start      %s\n' "${C_D}# abre em http://127.0.0.1:$PORTA_DO_APP (no Windows: \"Iniciar Nexo.cmd\")${C_0}"
  if [ "${NPM_RODOU:-0}" = 1 ] && nexo_aberto; then
    printf '\n'
    aviso "O Nexo está aberto: feche e abra de novo para usar a versão nova."
  fi
  printf '\n'
  sutil "Seus dados ficam na pasta escolhida no app (ex.: OneDrive\\Nexo), fora desta pasta."
  sutil "Para atualizar depois, rode o mesmo comando de novo."
  printf '\n'
}
# <<< COMUM

ajuda() {
  cat <<EOF

  ${C_B}baixar-nexo.sh${C_0} ${C_D}· instala ou atualiza o Nexo sem git clone${C_0}

  ${C_B}Uso${C_0}
    bash baixar-nexo.sh [opções] [pasta]

  Sem pasta, instala em ./${REPO##*/}. Se a pasta já tem o Nexo, atualiza:
  a versão atual fica guardada em <pasta>-anterior e os arquivos que saíram
  do Nexo são retirados. node_modules e o build ficam onde estão.

  ${C_B}Opções${C_0}
    -r, --ref <ref>       branch, tag ou commit a baixar (padrão: main)
    -m, --method <modo>   auto, archive, api ou manifest (padrão: auto)
    -i, --install         roda npm install e npm run build no fim
    -f, --force           usa a pasta mesmo que já tenha arquivos, sem perguntar
    -y, --yes             responde "sim" a todas as perguntas
    -n, --dry-run         baixa, confere e mostra o que mudaria, sem gravar nada
    -g, --git             cria (ou atualiza) um repositório git local com a cópia
    -k, --insecure        não confere o certificado HTTPS (proxy que intercepta)
    -q, --quiet           mostra só avisos, erros e o resultado
        --no-backup       não guarda a versão atual em <pasta>-anterior
        --no-color        sem cores (também vale NO_COLOR=1)
    -v, --version         mostra de qual versão é a lista embutida e sai
    -h, --help            mostra esta ajuda

  As letras podem ir juntas: -fi é o mesmo que -f -i.

  ${C_B}Exemplos${C_0}
    bash baixar-nexo.sh -i nexo-app      ${C_D}# primeira vez: baixa, instala e faz o build${C_0}
    bash baixar-nexo.sh -fi nexo-app     ${C_D}# atualiza sem perguntar e faz o build${C_0}
    bash baixar-nexo.sh -n nexo-app      ${C_D}# só mostra o que mudaria${C_0}
    bash baixar-nexo.sh -k -m api app    ${C_D}# proxy que intercepta HTTPS, arquivo por arquivo${C_0}

  ${C_B}Variáveis${C_0} ${C_D}(opcionais)${C_0}
    HTTPS_PROXY      proxy da empresa (ex.: http://proxy:8080)
    GITHUB_TOKEN     token para a API do GitHub, se o limite de pedidos acabar
    NEXO_REPO, NEXO_REF, NEXO_ARCHIVE_BASE, NEXO_RAW_BASE, NEXO_API_BASE,
    NEXO_WEB_BASE    outro repositório, versão ou espelho interno do GitHub

  No Windows, rode no Git Bash. Sem rede nenhuma, use o nexo-offline.sh.

EOF
}

ler_opcoes() {
  normalizar_args "rm" "$@"
  set -- "${ARGS[@]+"${ARGS[@]}"}"
  while [ $# -gt 0 ]; do
    case "$1" in
      -r | --ref)
        [ $# -gt 1 ] || falha "Falta dizer a versão depois de $1 (ex.: $1 main)."
        REF="$2"
        shift
        ;;
      --ref=*) REF="${1#*=}" ;;
      -m | --method | --metodo)
        [ $# -gt 1 ] || falha "Falta dizer o modo depois de $1 (auto, archive, api ou manifest)."
        METHOD="$2"
        shift
        ;;
      --method=* | --metodo=*) METHOD="${1#*=}" ;;
      -i | --install | --instalar) DO_INSTALL=1 ;;
      -f | --force | --forcar) FORCE=1 ;;
      -y | --yes) ASSUME_YES=1 ;;
      -n | --dry-run) DRY_RUN=1 ;;
      -g | --git) DO_GIT=1 ;;
      -k | --insecure | --inseguro) INSECURE=1 ;;
      -q | --quiet) QUIET=1 ;;
      --no-backup) NO_BACKUP=1 ;;
      --no-color) SEM_COR=1 ;;
      -v | --version) ACAO=versao ;;
      -h | --help | --ajuda) ACAO=ajuda ;;
      --)
        shift
        while [ $# -gt 0 ]; do
          definir_destino "$1"
          shift
        done
        break
        ;;
      -*) opcao_desconhecida "$1" ;;
      *) definir_destino "$1" ;;
    esac
    shift
  done
  case "$METHOD" in
    auto | archive | api | manifest) ;;
    zip | pacote) METHOD=archive ;;
    lista) METHOD=manifest ;;
    *) falha "Modo inválido: $METHOD" "Use auto, archive, api ou manifest." ;;
  esac
}

# ------------------------------------------------------------- download ----
preparar_download() {
  if command -v curl >/dev/null 2>&1; then
    DL=curl
    DL_OPTS=(-fsSL --retry 2 --connect-timeout 20 --max-time 600 -A "$AGENTE")
    [ "$INSECURE" = 1 ] && DL_OPTS+=(-k)
  elif command -v wget >/dev/null 2>&1; then
    DL=wget
    DL_OPTS=(-q --tries=2 --timeout=60 -U "$AGENTE")
    [ "$INSECURE" = 1 ] && DL_OPTS+=(--no-check-certificate)
  else
    falha "Preciso do curl ou do wget." "No Windows, rode no Git Bash: ele já traz o curl."
  fi
  TEM_GIT=0
  command -v git >/dev/null 2>&1 && TEM_GIT=1
  return 0
}

baixar() { # url destino [api]
  local extra=()
  if [ "${3:-}" = api ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    if [ "$DL" = curl ]; then extra=(-H "Authorization: Bearer $GITHUB_TOKEN"); else extra=(--header="Authorization: Bearer $GITHUB_TOKEN"); fi
  fi
  mkdir -p "$(dirname "$2")"
  if [ "$DL" = curl ]; then
    curl "${DL_OPTS[@]}" "${extra[@]+"${extra[@]}"}" -o "$2" "$1" 2>"$TRABALHO/ultimo-erro.txt"
  else
    wget "${DL_OPTS[@]}" "${extra[@]+"${extra[@]}"}" -O "$2" "$1" 2>"$TRABALHO/ultimo-erro.txt"
  fi
}

ultimo_erro() {
  [ -s "$TRABALHO/ultimo-erro.txt" ] && head -c 300 "$TRABALHO/ultimo-erro.txt" | tr '\n' ' '
  return 0
}

codificar_url() {
  local LC_ALL=C s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [A-Za-z0-9._~/-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

# Barra de progresso numa linha só (só em terminal e fora do -q).
barra() { # feitos total texto
  if [ "$QUIET" = 1 ] || [ ! -t 1 ]; then return 0; fi
  local n="$1" t="$2" txt="$3" larg=24 cheio pct cols max b v
  cheio=$((n * larg / t))
  pct=$((n * 100 / t))
  printf -v b '%*s' "$cheio" ''
  printf -v v '%*s' $((larg - cheio)) ''
  cols="${COLUNAS:-80}"
  max=$((cols - larg - 22))
  [ "$max" -lt 10 ] && max=10
  [ "${#txt}" -gt "$max" ] && txt="…${txt: -$((max - 1))}"
  printf '\r\033[K  %s%s%s%s%s %3d%% %s%d/%d%s %s' "$C_AC" "${b// /█}" "$C_D" "${v// /░}" "$C_0" \
    "$pct" "$C_D" "$n" "$t" "$C_0" "$txt"
}
fim_da_barra() { [ "$QUIET" = 1 ] || [ ! -t 1 ] || printf '\r\033[K'; }

# Hash do git (SHA-1 de "blob <tamanho>\0<conteúdo>") de cada arquivo da lista.
# Com git, uma chamada só para todos; sem ele, sha1sum arquivo por arquivo.
hashes_do_git() { # pasta lista-de-caminhos
  if [ "$TEM_GIT" = 1 ]; then
    (cd "$1" && git hash-object --no-filters --stdin-paths <"$2")
    return
  fi
  local p tam
  while IFS= read -r p; do
    tam="$(wc -c <"$1/$p" | tr -d '[:space:]')"
    if command -v sha1sum >/dev/null 2>&1; then
      { printf 'blob %s\0' "$tam"; cat -- "$1/$p"; } | sha1sum | cut -d' ' -f1
    elif command -v shasum >/dev/null 2>&1; then
      { printf 'blob %s\0' "$tam"; cat -- "$1/$p"; } | shasum -a 1 | cut -d' ' -f1
    else
      echo "?"
    fi
  done <"$2"
}

# ------------------------------------------------ modo 1: o pacote inteiro ----
tentar_archive() {
  local url
  passo "Baixando o pacote do repositório"
  for url in "$ARCHIVE_BASE/$REPO/tar.gz/$REF" "$WEB_BASE/$REPO/archive/$REF.tar.gz"; do
    sutil "  $url"
    if baixar "$url" "$TRABALHO/repo.tar.gz" && tar -tzf "$TRABALHO/repo.tar.gz" >/dev/null 2>&1; then
      rm -rf "$STAGE" && mkdir -p "$STAGE"
      if tar -xzf "$TRABALHO/repo.tar.gz" -C "$STAGE" --strip-components=1 2>/dev/null && [ -f "$STAGE/package.json" ]; then
        ORIGEM="$({ gzip -dc "$TRABALHO/repo.tar.gz" 2>/dev/null | head -c 4096 | LC_ALL=C grep -aoE 'comment=[0-9a-f]{40}' || true; } | sed -n '1s/comment=\(.......\).*/\1/p')"
        ok "Pacote .tar.gz baixado"
        return 0
      fi
    else
      sutil "  não deu: $(ultimo_erro)"
    fi
  done
  if command -v unzip >/dev/null 2>&1; then
    for url in "$ARCHIVE_BASE/$REPO/zip/$REF" "$WEB_BASE/$REPO/archive/$REF.zip"; do
      sutil "  $url"
      if baixar "$url" "$TRABALHO/repo.zip"; then
        rm -rf "$TRABALHO/unzip" && mkdir -p "$TRABALHO/unzip"
        if unzip -q -o "$TRABALHO/repo.zip" -d "$TRABALHO/unzip" 2>/dev/null; then
          local dentro
          dentro="$(find "$TRABALHO/unzip" -mindepth 1 -maxdepth 1 -type d | sed -n 1p)"
          if [ -n "$dentro" ] && [ -f "$dentro/package.json" ]; then
            rm -rf "$STAGE" && mv "$dentro" "$STAGE"
            ok "Pacote .zip baixado"
            return 0
          fi
        fi
      else
        sutil "  não deu: $(ultimo_erro)"
      fi
    done
  fi
  return 1
}

# ----------------------------------------- modos 2 e 3: arquivo por arquivo ----
FALHARAM=()
DIFERENTES=()

baixar_lista() { # arquivo com linhas "modo sha caminho"
  local lista="$1" total n=0 modo sha caminho enc base veio esperado
  total="$(grep -c . "$lista" || true)"
  [ "$total" -gt 0 ] || return 1
  rm -rf "$STAGE" && mkdir -p "$STAGE"
  FALHARAM=()
  DIFERENTES=()
  : >"$TRABALHO/conferir-caminhos.txt"
  : >"$TRABALHO/conferir-hashes.txt"
  while read -r modo sha caminho <&3; do
    [ -n "${caminho:-}" ] || continue
    n=$((n + 1))
    barra "$n" "$total" "$caminho"
    enc="$(codificar_url "$caminho")"
    veio=0
    for base in "$RAW_BASE/$REPO/$REF" "$WEB_BASE/$REPO/raw/$REF"; do
      if baixar "$base/$enc" "$STAGE/$caminho"; then
        veio=1
        break
      fi
    done
    if [ "$veio" = 0 ]; then
      FALHARAM+=("$caminho")
      # se os primeiros já falham, não adianta insistir
      if [ "$n" -ge 3 ] && [ "${#FALHARAM[@]}" -eq "$n" ]; then
        fim_da_barra
        sutil "  não deu: $(ultimo_erro)"
        return 1
      fi
      continue
    fi
    [ "$modo" = "100755" ] && chmod +x "$STAGE/$caminho"
    if [ "$sha" != "-" ]; then
      printf '%s\n' "$caminho" >>"$TRABALHO/conferir-caminhos.txt"
      printf '%s\n' "$sha" >>"$TRABALHO/conferir-hashes.txt"
    fi
  done 3<"$lista"
  fim_da_barra
  if [ -s "$TRABALHO/conferir-caminhos.txt" ]; then
    hashes_do_git "$STAGE" "$TRABALHO/conferir-caminhos.txt" >"$TRABALHO/hashes-reais.txt"
    while IFS=$'\t' read -r caminho esperado sha; do
      [ "$sha" = "?" ] || [ "$sha" = "$esperado" ] || DIFERENTES+=("$caminho")
    done < <(paste "$TRABALHO/conferir-caminhos.txt" "$TRABALHO/conferir-hashes.txt" "$TRABALHO/hashes-reais.txt")
  fi
  if [ "${#FALHARAM[@]}" -gt 0 ]; then
    aviso "$((n - ${#FALHARAM[@]})) de $n arquivos baixados. Faltaram: ${FALHARAM[*]:0:5}"
    return 1
  fi
  ok "$n arquivos baixados"
}

lista_pela_api() {
  passo "Pedindo a lista de arquivos à API do GitHub"
  local url
  url="$API_BASE/repos/$REPO/git/trees/$(codificar_url "$REF")?recursive=1"
  sutil "  $url"
  if ! baixar "$url" "$TRABALHO/arvore.json" api; then
    sutil "  não deu: $(ultimo_erro)"
    return 1
  fi
  if command -v node >/dev/null 2>&1; then
    # shellcheck disable=SC2016
    node -e '
      const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      if (t.truncated) process.exit(3)
      for (const e of t.tree || []) if (e.type === "blob") console.log(`${e.mode} ${e.sha} ${e.path}`)
    ' "$TRABALHO/arvore.json" >"$TRABALHO/lista-api.txt" 2>/dev/null || return 1
  else
    local py=""
    command -v python3 >/dev/null 2>&1 && py=python3
    [ -z "$py" ] && command -v python >/dev/null 2>&1 && py=python
    if [ -z "$py" ]; then
      sutil "  sem node nem python para ler a resposta"
      return 1
    fi
    "$py" -c '
import json, sys
t = json.load(open(sys.argv[1], encoding="utf-8"))
if t.get("truncated"): sys.exit(3)
for e in t.get("tree", []):
    if e.get("type") == "blob": print(e["mode"], e["sha"], e["path"])
' "$TRABALHO/arvore.json" >"$TRABALHO/lista-api.txt" 2>/dev/null || return 1
  fi
  [ -s "$TRABALHO/lista-api.txt" ]
}

tentar_api() {
  lista_pela_api || return 1
  ok "$(grep -c . "$TRABALHO/lista-api.txt") arquivos na lista"
  passo "Baixando arquivo por arquivo"
  baixar_lista "$TRABALHO/lista-api.txt" || return 1
  if [ "${#DIFERENTES[@]}" -gt 0 ]; then
    aviso "Chegou diferente do esperado: ${DIFERENTES[*]:0:5}"
    return 1
  fi
  ok "Todos conferidos pelo hash do git"
}

tentar_manifest() {
  passo "Usando a lista embutida neste script ${C_D}(Nexo $MANIFEST_VERSAO, commit $MANIFEST_COMMIT)${C_0}"
  manifest >"$TRABALHO/lista-embutida.txt"
  baixar_lista "$TRABALHO/lista-embutida.txt" || return 1
  if [ "${#DIFERENTES[@]}" -gt 0 ]; then
    aviso "${#DIFERENTES[@]} arquivo(s) mudaram depois que esta lista foi gerada e vieram na versão de agora:"
    printf '      %s\n' "${DIFERENTES[@]:0:10}" >&2
    dica "Arquivos novos podem ter ficado de fora. Para a cópia exata, use o nexo-offline.sh."
  else
    ok "Todos conferidos pelo hash do git"
  fi
}

nada_funcionou() {
  falha "Não consegui baixar o Nexo por nenhum caminho." \
    "O que tentar:" \
    "  • Erro de certificado ou SSL: rode de novo com -k (o proxy da empresa intercepta o HTTPS)." \
    "  • Proxy da empresa: export HTTPS_PROXY=http://proxy:porta e rode de novo." \
    "  • Confira se o repositório abre no navegador: $WEB_BASE/$REPO" \
    "  • Sem rede: baixe o scripts/nexo-offline.sh pelo navegador e rode com bash."
}

criar_git() {
  if [ "$TEM_GIT" = 0 ]; then
    aviso "git não encontrado: pulei o -g (--git)."
    return 0
  fi
  (
    cd "$DEST"
    if [ ! -d .git ]; then
      git init -q
      git checkout -q -b main 2>/dev/null || true
    fi
    git add -A
    if [ -z "$(git config user.name || true)" ]; then export GIT_AUTHOR_NAME="Nexo" GIT_COMMITTER_NAME="Nexo"; fi
    if [ -z "$(git config user.email || true)" ]; then export GIT_AUTHOR_EMAIL="nexo@local" GIT_COMMITTER_EMAIL="nexo@local"; fi
    git diff --cached --quiet || git commit -q -m "Nexo $VERSAO ($REF), copiado sem git clone"
    git remote get-url origin >/dev/null 2>&1 || git remote add origin "$WEB_BASE/$REPO.git"
  )
  ok "Repositório git local em dia (branch main, remote origin)"
}

# --------------------------------------------------------------- execução ----
main() {
  ACAO=baixar DEST="" REF="${NEXO_REF:-main}" METHOD=auto
  FORCE=0 ASSUME_YES=0 DRY_RUN=0 QUIET=0 DO_INSTALL=0 NO_BACKUP=0 DO_GIT=0 INSECURE=0
  ORIGEM=""
  ler_opcoes "$@"
  usar_cores
  case "$ACAO" in
    ajuda)
      ajuda
      exit 0
      ;;
    versao)
      printf 'baixar-nexo.sh 2 · lista embutida do Nexo %s (commit %s)\n' "$MANIFEST_VERSAO" "$MANIFEST_COMMIT"
      exit 0
      ;;
  esac
  [ -n "$DEST" ] || DEST="${REPO##*/}"
  COLUNAS="$(tput cols 2>/dev/null || echo 80)"
  case "$COLUNAS" in '' | *[!0-9]*) COLUNAS=80 ;; esac
  preparar_download
  preparar_trabalho
  STAGE="$TRABALHO/repo"
  mkdir -p "$STAGE"

  cabecalho "Nexo · instalar sem git clone" "repositório $REPO · versão $REF · pasta $DEST"
  avisar_se_wsl
  [ "$INSECURE" = 1 ] && aviso "Sem conferir o certificado HTTPS (-k, --insecure)."
  analisar_destino
  conferir_pasta_de_dados
  if [ "$DRY_RUN" = 0 ]; then
    if [ "$REF" = main ]; then
      confirmar_destino "a versão mais nova do Nexo" ""
    else
      confirmar_destino "a versão $REF do Nexo" ""
    fi
  fi

  local usado=""
  case "$METHOD" in
    archive) tentar_archive && usado=archive ;;
    api) tentar_api && usado=api ;;
    manifest) tentar_manifest && usado=manifest ;;
    auto)
      if tentar_archive; then
        usado=archive
      elif tentar_api; then
        usado=api
      elif tentar_manifest; then
        usado=manifest
      fi
      ;;
  esac
  [ -n "$usado" ] || nada_funcionou
  local essencial
  for essencial in package.json app/page.tsx; do
    [ -f "$STAGE/$essencial" ] || falha "A cópia ficou incompleta (faltou $essencial)." "Rode de novo; se repetir, use o nexo-offline.sh."
  done

  VERSAO="$(versao_em "$STAGE")"
  [ -n "$VERSAO" ] || VERSAO="?"
  [ -n "$ORIGEM" ] || [ "$usado" != manifest ] || ORIGEM="$MANIFEST_COMMIT"
  instalar_na_pasta "$STAGE" "$VERSAO" "$ORIGEM" "" "$usado"
  [ "$DRY_RUN" = 1 ] && exit 0
  [ "$DO_GIT" = 1 ] && criar_git
  [ "$DO_INSTALL" = 1 ] && rodar_npm
  proximos_passos "$VERSAO"
}

# >>> MANIFESTO
MANIFEST_COMMIT="09c1bd6"
MANIFEST_VERSAO="3.24.2"
MANIFEST_CONTEUDO="9e5752b4e97a037fcef68e80ed1bcf4eaa949012"
manifest() {
  cat <<'MANIFESTO'
100755 ec44197cc92dfb24c38d88f7a17e02e26d461cf9 .githooks/pre-push
100644 0ba0211040a56a69364d257781eeef239b46d91a .github/workflows/scripts-de-copia.yml
100644 767a6f46e98ed37466cb0dad15f79dd98cfac96f .gitignore
100644 e953faba2a2ce40d9db40db3d6744ca99443c4cd AGENTS.md
100644 a3956e75a7eb876f829596f3471f06fd76fc6111 CLAUDE.md
100644 c8e208f1f27f1045381a6cb7ee047bea044c7bf7 Iniciar Nexo.cmd
100644 ebd6ded96252a65c679cf70d565bfce41ae754cd README.md
100644 5446ae1d0ee2079741683ea7f7f3c60bcc10a510 app/api/arquivos/route.ts
100644 4ff6063b6877106221de3fccfdf6bbf0b8c86e17 app/api/assuntos/route.ts
100644 83dd22f13bd37936d542901525e190cd4bec8323 app/api/backup/restaurar/route.ts
100644 7072e6be9423a1196f20e069dd1c98814d981ce3 app/api/backup/route.ts
100644 c28578efe9be7694957478263f3c8a387e3a3bbb app/api/categorias/route.ts
100644 dc390bd3abe6e2d536f0b519dad280099d9fc9ac app/api/config/route.ts
100644 3ae2cf010e2f4fc81dc8ab47d43d85d44a81ca46 app/api/dados/route.ts
100644 b46621e477758df584374185b49985124466a3f6 app/api/estado/route.ts
100644 dcbf425e66e43e77003ad712ef8feee145e11c04 app/api/exemplo/route.ts
100644 a107bb9bedd857f1f989405d51392ee9396dc2a7 app/api/exportar/route.ts
100644 46a206a4a4d820308756d87ed3ada6337f1c5699 app/api/importar/route.ts
100644 2073d6857a82e8f3c1a54bbcc8e2867411e6e205 app/api/jornada/route.ts
100644 0aa3a525b99939e81777ab96654037e3c1f04841 app/api/links/route.ts
100644 9516a379fb5f1a299e1648d21db38c352688f709 app/api/lixeira/route.ts
100644 79b01aa019ba1e3a27e73d892a28766f2934a3fa app/api/midia/route.ts
100644 34766422d7652d6f3d1a09a4440e581982743ef6 app/api/modelos/route.ts
100644 3cf931a5679ceeea68cda8cb444f022fcb99714b app/api/notas/route.ts
100644 cece95c1906b1c0f386e3399f4ea29ce2eadd84c app/api/paginas/historico/route.ts
100644 9faff9d0ee86dd21bc3dab5235247a13f3541dd8 app/api/paginas/route.ts
100644 e17331e21f1b39f6e9e7cd35711eddc5fa87d036 app/api/pessoas/route.ts
100644 a8b84873f269149c8d9b3e64427f093cf2f472b2 app/api/tarefas/[id]/route.ts
100644 598b5c2091632d1bd12a4be1e754a3679a247c67 app/api/times/route.ts
100644 941f483574db493e236276c8643bfba6ed48dd81 app/api/transcricoes/route.ts
100644 442c39f1efe7b775ef67ecf703154f6d07091cbb app/api/verificar/route.ts
100644 bde720f7be86b4952e4e0fa1d7a1731bc30c3c4d app/busca/page.tsx
100644 aa84e3a694b281ba121fbd039113c4dab4167dd9 app/categorias/[id]/page.tsx
100644 76827045f35bfc3205a2975c1e06f67d90108534 app/categorias/page.tsx
100644 0be5c2433d1aacccee092db7852ad66e4809fb5c app/configuracoes/page.tsx
100644 3296de2089fb3f7952f6d4ce8180c2c1c35c52a0 app/conquistas/page.tsx
100644 f299710b902d2f835cc3959d1e9d634d7e9eb6eb app/decisoes/page.tsx
100644 882f991953d6a13c6d28952cd8c5929316718f0f app/diario/page.tsx
100644 894949ac25a3b2af10f05b7d1f7e0f058d8cde79 app/globals.css
100644 314684907ed8f33fd74039c3a2d62805b56ad974 app/icon.svg
100644 8432111675d171a9084049a3d2aeb8cbf8ef4cb2 app/layout.tsx
100644 95c9926c71ea18a4c1292510f1be8dd84967a74c app/links/page.tsx
100644 0d402fdde973d79361413b1b7e7ac454b0f305d1 app/manifest.ts
100644 e0a779f73fd60339081d21c038278086bad727b3 app/notas/page.tsx
100644 d81146bc1cc942c64dfd23903e77e3465f38b732 app/page.tsx
100644 7c80e973a325604d43e54a115c095d8b561c33c9 app/paginas/page.tsx
100644 bbd8dba46a558c8943b4ed43e190443742ad48d2 app/pendencias/page.tsx
100644 481eaac66e5ec7ed26c2acbcf370534372ce6cdd app/perguntar/page.tsx
100644 0a6f76ffa109f0bf97eeda85e55aba30f0a63d1e app/pessoas/page.tsx
100644 d5e5c6e1da9e3f87d7358003af1cac811cd8f79a app/radar/page.tsx
100644 d3d8945c425dadb8329121f566cc32ba87135cf0 app/relatorios/page.tsx
100644 8f2dddef9bd826a95c5dd02a5b7f68f0624f8253 app/revisao/page.tsx
100644 80861d021ef33cfb3452f16d5badc730641a07b2 app/rotina/page.tsx
100644 97bf2a04a58361f5b69d3fb9ddb4a7690f31ad4a app/tarefas/[id]/page.tsx
100644 fc7e34c37a58e70a5dab0aee0cf119f930e26c37 app/tarefas/[id]/reuniao/page.tsx
100644 0232fd6db8f9c2425e06bd83a0d6fbe649db7d54 app/tarefas/page.tsx
100644 f580316fc46d384d0219ffa08ad4e6773e251b64 app/template.tsx
100644 de75a0b4bb49f3e74eceaeb4db039a6fcb1aef67 components.json
100644 963fb9c7194d2bf2aa4f73a36a7e8dd10011c898 components/Assuntos.tsx
100644 1eef4d8a5b3e9b04c5938d8d03375c168e45a55b components/AvisosDoSistema.tsx
100644 52bb30f85bf58724c8b8a3259d9d265b8b29b1a3 components/CardTarefa.tsx
100644 b914e55c7164e9eb02d97e92c11215f630f4f2a8 components/CategoriaForm.tsx
100644 c16c63f5dc6b58707e456b3ba7e3a0342bc9879a components/Citacoes.tsx
100644 bc48a4eee09f2c80960dd310dddd931dd32f75c4 components/Criar.tsx
100644 8d1998e2d9853346bc5ecddfde317fc0de732f52 components/Esperando.tsx
100644 950a620e75e34c250d1ce07a5cf3ec5d7e0c488e components/Impressao.tsx
100644 42b36e5c80e1aadbfa9f2dbc820782a1a9c4afd3 components/LinkForm.tsx
100644 bad007c06b3de4a6db134c32b6db2f8c989e5172 components/MenuTarefa.tsx
100644 4c046df39053dfff2909205ea2dcef238fa60785 components/Modelos.tsx
100644 6b6e03b759b2d6e4dadad8d5916489444361a11f components/MoverEJuntar.tsx
100644 491a00b86fd4b40d588c1f8aec15917ff85960f3 components/PromptModal.tsx
100644 e760aeeea278a096e64496d5361f56a66e1a9e61 components/Provider.tsx
100644 0787a476e3beaa1cdf5bc2868ea0248119f8de26 components/Raiz.tsx
100644 7912a655055c6699c82392b4a07ea1e87319d0ea components/RegistroEditor.tsx
100644 573f1e4e20f3b6dff26d5fdd111c6201d77b97fd components/Shell.tsx
100644 7ea128bb0a0332f499593c9191fd85894f1e0d5d components/TarefaForm.tsx
100644 e6044d9baf7976d2094a43dc0fabb9882e0b91ac components/VisorDeArquivo.tsx
100644 8856b60234ee8cda275a624f7423fcfd565584b9 components/VisorDeImagem.tsx
100644 853b57ea933d3108e61b2f0a42b3d35c2dd88083 components/busca/CampoBusca.tsx
100644 ddd3ef9a5dc5401b34cec6a110f7c3ba097b7789 components/categorias/CartaoCategoria.tsx
100644 95fee2178db26f2e1a016e464ddfa37108e7e430 components/categorias/EmblemaCategoria.tsx
100644 a8f6c2e9eddb78d45c4cd648c610d594a11cb0cd components/categorias/Escolher.tsx
100644 a72a024898c1af98cfa1cd57bac3148cc8e39e4c components/categorias/acoes.ts
100644 bc064cdcd11530f0c0132d70c0b8f126127c9e4b components/comum.tsx
100644 375f0cf6a83a2aec4c0adeb0439e03111eae7c37 components/configuracoes/Notificacoes.tsx
100644 b67d2c3cd0312d99f728a324435f7bd6b3d6bf34 components/configuracoes/dados.tsx
100644 77cc4bae8d082f210303c42c6577da35b96ce763 components/configuracoes/preferencias.tsx
100644 4f7a460eb50743a82b0313694c90d2df77733786 components/criar-evento.ts
100644 f7d775d65797e314776f61009bee4ae46013dcf9 components/desfazer.ts
100644 79eec613dc9523a7d51a1adb52d67848f4db684c components/editor/EditorRico.tsx
100644 83cfbaf05d283caffd3479888d2564ffd4c611ac components/editor/extensoes.ts
100644 473dfaa730d055a4567c36842cd3b213db1ec712 components/hoje/CapturaRapida.tsx
100644 3b15eac36822a81710945fa3c79e5eef77b0a981 components/hoje/FocoHoje.tsx
100644 476ac387f9b12b0a68613a84f64445ffe04756cd components/hoje/Laterais.tsx
100644 ba2816773c9667dd073424fa043d402b1c52db76 components/hoje/PrecisaDeVoce.tsx
100644 62e6b8c62108f3f910bbcc61ecfc6fb769111de3 components/hoje/PrimeirosPassos.tsx
100644 2c1acc1cd31464d195890668dc2a144710d99dce components/hoje/ProximaAcao.tsx
100644 c1f0824afaea881d0b21c7b95c7aad632c079770 components/hoje/ReunioesDeHoje.tsx
100644 5417d6a507129f0e74fcae0dcbaaaea05f43e56e components/hoje/Semana.tsx
100644 254cb1e7f06e65290350be9cce7dbd5cb4d33282 components/hoje/apoio.tsx
100644 14e456f7ac068a31e50caeeede52efc04806d9fe components/jogo/Celebracao.tsx
100644 5263100f087d6887cc688e1f00f379f895a04ce6 components/jogo/NivelLateral.tsx
100644 879f3671b63b60934fb7ac301415418462a6b00c components/jogo/pecas.tsx
100644 4d000eec3c5c4a608ea45bc5ce92bc640c63e525 components/jogo/useJogo.ts
100644 471e024a5d9482b29769d6d09182463117ff4c40 components/jornada/Ferramenta.tsx
100644 0339b36f197aae2f407b879b174b96ad144c80a1 components/jornada/Formularios.tsx
100644 300231d7b0d31b7b339f15529ce83c68bd36759b components/jornada/LinhaDoDia.tsx
100644 4c42d4e02dc60b7004efd049f90f84af6127fbc7 components/jornada/Paineis.tsx
100644 aa327e2d87c5103cad81eca182349084c630001f components/jornada/pecas.tsx
100644 160c61acd3c91e146c1aea21c8eeb440af81feb5 components/links/EstadoLink.tsx
100644 a9219bb38a12a80d304c651252e431b0c3a8355d components/links/IconeLink.tsx
100644 2c9fc2f155dcecbb89840e9383edb398c08e566a components/links/SeletorDeTarefas.tsx
100644 0d5bc20c4f3e65c7ea826c507b0d90682b634338 components/notas/EditorNota.tsx
100644 b2537204171e74ba97856a23dbc3ea8ff547263a components/notas/OrganizarNota.tsx
100644 d780958fb2c55d3a0cbe9fb77a41babd2f900450 components/paginas/Abas.tsx
100644 f88a5db09bf185679652f7f4799310bcf874724f components/paginas/EditorPagina.tsx
100644 b4e16cc283642f0046e2e50070e454e47e9cf2a4 components/paginas/Explorador.tsx
100644 f6f19a93814576da1a8041c771be5cedf4443ebe components/paginas/Historico.tsx
100644 137f09b5c49128de31405c202601fcd68be92b8e components/paginas/ListaPaginas.tsx
100644 08610395ce3f1089c903ddc5ea5e7986582dd3e0 components/paginas/MapaDePaginas.tsx
100644 f33a66715d1035bc5964ff9f7c776c0fa6ee551f components/paginas/MoverPagina.tsx
100644 01932358226b5d2f8ca93b295f1db3bc43c4232e components/paginas/QuadroPaginas.tsx
100644 239bf6bd5f1bc9069ba739f1e196ce5c4fd4eb07 components/paginas/pecas.tsx
100644 ba3cf2810ae0b69a22a0269f425ccc06880d8e5a components/paginas/video/GaleriaDeVideos.tsx
100644 f9d647deb801c4a349e6f78078f5c475a5bc727e components/paginas/video/Player.tsx
100644 bf26a619a56fe8e3c91281a3347bffe1c078a907 components/paginas/video/Transcricao.tsx
100644 7d3af3c50f7433b783f7b13d194df8593de1ab53 components/paginas/video/VisaoDeVideo.tsx
100644 4844139730ae056520bd7680514d97a40d67a70a components/pendencias/GrupoPendencias.tsx
100644 67e3c92b0e0856e86b72168e3f2cc5b78d39ad3a components/pendencias/Lateral.tsx
100644 c49aa5e549e2ead5485a345c97660c68c49bff66 components/pendencias/LinhaPendencia.tsx
100644 328074ff6f14a371bc84a730867e74e26b248898 components/pendencias/agrupar.ts
100644 f912a52089455563b1b6ecf1ce182a9758aa4b8e components/pessoas/AbasPessoas.tsx
100644 c743da4d2a62d44365153e4c60e4b4aec5b9f6c9 components/pessoas/DetalhePessoa.tsx
100644 f40218529536b9ae057d977dc4f3251046f946b4 components/pessoas/DetalheTime.tsx
100644 2dd86fa1716d7cab1df7e58343db81170eb4f9c9 components/pessoas/ImportarPessoas.tsx
100644 b7ce60251758db31459f2df68fb14a1de8736bbd components/pessoas/ListaPassos.tsx
100644 a69afc810dcae304f04a30a67e6775616a14601f components/pessoas/ListaPessoas.tsx
100644 7c76b8459d850fcb556809481c3b9cf8d83a3535 components/pessoas/ListaTimes.tsx
100644 5e5a3ab3077d8164f492be3d7718015192f6004a components/pessoas/PessoaForm.tsx
100644 222f026fea659322823fd3f3e5591ffd5c85eb6f components/pessoas/SeletorCor.tsx
100644 1c0b4c82c39cac334c85d64485e2fd9600745aa6 components/pessoas/SeletorMultiplo.tsx
100644 8c2dcddfb36593a44761ea405f1552cf41a50652 components/pessoas/SemCadastro.tsx
100644 08bfd0c47b61671b9292499d05ff7fa8aab4a650 components/pessoas/TimeForm.tsx
100644 7eb0da2345d3d96abbe274f5a4d83ae8915a3692 components/pessoas/dados.ts
100644 7fae400e25cf2f2071d2bf95c5b1dfcf5c4d8532 components/pessoas/pecas.tsx
100644 fbe5c16bbefd5a5cc26c006e8cd47bba41761f9f components/reuniao/TranscricaoDaReuniao.tsx
100644 44e3a626cd7ae12950533fcce29508b803f8f707 components/revisao/CartaoRevisao.tsx
100644 0b842e9391bd0d39095a5042ba818101477b302d components/revisao/retrato.ts
100644 3eb320e4b3d49f0cab369112a6900660a5c613c2 components/rotina/EtapaAtras.tsx
100644 bc1b611b73a5b64f7b78f77605429645a9919e4d components/rotina/EtapaFocos.tsx
100644 296856a037a0f3661fea7f47581abacaba829e4a components/rotina/EtapaPronto.tsx
100644 2f90b15fdd04723296a7a29512aced0e7a39e38d components/rotina/FecharDia.tsx
100644 91031b7d689132cc994fa0acc5e679bd465ec405 components/rotina/PlanejarDia.tsx
100644 d1da5a15fd085f70f353ac77869053e3cb62a83e components/rotina/pecas.tsx
100644 e82bb5598b2a5914550908a986eee00ddaeec992 components/shell/Acompanhar.tsx
100644 eca7e25ff40b99a15390f0af933b8757225bc90f components/shell/Ajuda.tsx
100644 c45ba1c07cb7c1d693b1618b5fdd8cf5c3b0ce60 components/shell/Aparencia.tsx
100644 ec33c2a0679e3366b9a2ae515617d0ba82c3e64b components/shell/BarraSuperior.tsx
100644 df69bd329d22c9d1843b20730d46d00fe9d08d87 components/shell/BoasVindas.tsx
100644 0bf309bfe7f0ead06306c182ff4deaeed5220724 components/shell/Ferramentas.tsx
100644 b7d312f0f9f0d614068c2e9649a91cfeb1fb8b2f components/shell/Holofote.tsx
100644 dbb767903b5c9120a958fde670a9a45f9c7541d2 components/shell/Lateral.tsx
100644 7326a3992d41da49bb4cc174b173eed1c876307f components/shell/Logo.tsx
100644 0fd1a2f47de5f80923dc3d64ec962b8cba8eb22b components/shell/Novidades.tsx
100644 b0a6f3353ae13a9b59752eb486896fa6ec3d0705 components/shell/Paleta.tsx
100644 f55a794f6c9e17b330e44a4fd583604d62a8e2a7 components/shell/Perfis.tsx
100644 5b767729ccedd2adcfaa34d7eb38ac66d105a9d1 components/shell/Personalizar.tsx
100644 657f39d2cb1182f5253aff7f55874d0400d047db components/shell/SessaoFoco.tsx
100644 98ec7df435b801ec4bd2608d46babc5d09feabbf components/shell/Sino.tsx
100644 d672e56b98df88bbc4ba19aa8b02b1c45fdbc081 components/shell/Telas.tsx
100644 047a12ab2b00fdacba404cd58e5981881674e9c0 components/shell/navegacao.ts
100644 ef82c53884453c0a48d07c61b7b92bde09cac876 components/shell/paleta/navegacao.ts
100644 f3a0e7d53d9dde960025644d375a864b238461f5 components/shell/paleta/pecas.tsx
100644 06f7196d2a251c2ef9193429bdd1f3de228979bd components/tags/FiltroDeTags.tsx
100644 947e1111bed9ba6ec1932e0b8b47d489c1063d43 components/tags/GerenciarTags.tsx
100644 e88827a0c6a423951b80c18e829ab2de3ae651ea components/tags/useTags.ts
100644 0da340a19a9c3e61a53abb4950ad3fd5859435f3 components/tarefa/Checklist.tsx
100644 32b0c3dcb921b5db0cf1d7431b5e3400c6f20734 components/tarefa/ColarEmail.tsx
100644 9ccae0a99b72c75af2c23df60b30c207e9c94239 components/tarefa/Copilot.tsx
100644 6a7b1284c52b1b4dad41b00e08520970d17fb52d components/tarefa/Dependencias.tsx
100644 5fd7c79afa4723e1d50652275e0ae259cd65a133 components/tarefa/Lateral.tsx
100644 4b797f16d87f49eab365280f730d5ae3a689301a components/tarefa/Passos.tsx
100644 e42e321945ed11f13b5710da440598bc0ef81b3e components/tarefa/PassosRepetidos.tsx
100644 eb108dfb99199d8c463dff172f2723bc9bd2f5b6 components/tarefa/Propriedades.tsx
100644 522a750d562589503249b9367ea08f5c1fffdd58 components/tarefa/Referencias.tsx
100644 7b912df8ae443aa3b1d339e5ca945f9dff1ef550 components/tarefa/Texto.tsx
100644 82369f4479d43eeab890b858c37639985556752b components/tarefa/Timeline.tsx
100644 af28d7f6fdc7710fd04c4f1b06fdb3d99881ca84 components/tarefas/ComboCategoria.tsx
100644 240115fb75360fb54805b60e0fa46811d27962a4 components/tarefas/ListaTarefas.tsx
100644 eb544e21bd33ff6b26d203bd80daa0fa8761e56f components/tarefas/Lote.tsx
100644 cba8b3f57745c5864aed7b6dc4c4165f0adf6ddd components/tarefas/QuadroTarefas.tsx
100644 edbc53849762e8a3843692398689129724c6392d components/tarefas/Visoes.tsx
100644 79cad0e8d14d1bc64d3f27ce4cb6955aa954fe56 components/tarefas/criar.ts
100644 495872d1528ec6b6638490566c6e2ae77bfadc48 components/tarefas/filtros.ts
100644 a48fff751d70a98fa6049df96a220323144d3554 components/ui/button.tsx
100644 2ee3a7d956b35834303e2f1f41152159b50bc441 components/ui/chips.tsx
100644 d4e76b16d0359f7451ccb11928678aeb5855a60a components/ui/command.tsx
100644 69c72a3a649b26e5ecd6063eeda12cde8108e1b6 components/ui/controles.tsx
100644 b9c8e4a1db59c74130260cf080076565e28cd2ca components/ui/data.tsx
100644 bebf61c9dd97e0547bc23dbfc638fb4470120dfe components/ui/dialog.tsx
100644 2e12d7e40f354893e7ec874316d6b114e8c78b30 components/ui/diversos.tsx
100644 b40fa54bb2469fdebad32ee43c1c5cec62565c9e components/ui/input.tsx
100644 3b202332ee0490656cf5704cb13fcb041cfb3c65 components/ui/menu.tsx
100644 04372cf588d686fa393488ae8fb44b316e5f8b7b components/ui/popover.tsx
100644 b18b1be9ebeccb5be3a7b4b25ee9c82d6186357e components/ui/select.tsx
100644 183d40d56eeb58bf806c6ece1559c7ebb769f893 components/useGravacao.ts
100644 7c74bc378088e2976702b69195074adcd069d8d3 components/useHoje.ts
100644 8dd33995e806683372e304a0ae3eddd37d2c7dc9 components/useLembretes.ts
100644 fdb00b5b919dc2417cd19dff563c7e4374bc10e1 components/useTranscricoes.ts
100644 96dd4e63cf4fd9ae887e7753eca8811d0d4670c2 components/visor/TabelaDeDados.tsx
100644 9f335adb8ee784704146c6b72ee408ed71b12e76 lib/acoes.ts
100644 506964157ecf1f6452238774260d9c94f1ce9a6f lib/ajuda.ts
100644 3198e421c5ca7157371f58d197959a2d2849ce76 lib/animacoes.ts
100644 8a3a2a65ea7dc933fee203d3bef57efcd2dab5a6 lib/aparencia.ts
100644 e095428c6ad12751626bd8cdd2d01233a55249b4 lib/armazenamento.ts
100644 0aa2952e96230763319c683f4cdc4b9a196db99f lib/assuntos.ts
100644 d34d8b0b95c458eed071fc611c637b332fa1f4f7 lib/checklist.ts
100644 1fc85ab4f420985b8e03555e22d7f18e5872b113 lib/decisoes.ts
100644 3ee97700fa0b0589b4d2e85046baaa00134944ee lib/dependencias.ts
100644 1db3dbeed0f90f7275a6b4fa037e8ecf72b16431 lib/diario.ts
100644 52244315c7db5a1c31efd47159140270b882ebca lib/diff.ts
100644 7912868a09599124e220d1a5b731036a286a811f lib/documento.ts
100644 4391d21880ddce8344c960ac5156213ce41ada79 lib/email.ts
100644 6b412141314e6c1223cc37b74d5561ec3c39c111 lib/espera.ts
100644 e30e71c3799e707357810796a4227e1f55ef4d4f lib/exemplo.ts
100644 e26cc9d5d67c34fd79eb2965337b73da307bd8ca lib/fechamento.ts
100644 98b502a721913fd5ea15bbff440303b46ffd147d lib/grafo.ts
100644 5976adeac82a2ce0c47c20f76a5d43a5add020d9 lib/importar-dados.ts
100644 55a06342e9e7d3114c28c6d867021ce961b243ba lib/importar-pessoas.ts
100644 28c74c8ec0fea550bdd9a3e3f519b7ede42b8392 lib/integridade.ts
100644 4d39f1780cd62e38fbdbf4bc6748666d656ab1d8 lib/jogo.ts
100644 f6bcee237851c2d8b7f7b0de567d8266b74dbc5e lib/jornada.ts
100644 adafb80f3ffc8611153f712bf1df1b91943745f9 lib/lembretes.ts
100644 bf133d34c183ff24622468029d91aad76b93107d lib/ligacoes.ts
100644 7abba0cff2f695f3b7a45d61bc8627d2a896b1a0 lib/links.ts
100644 9f827565eca1cc7d1200a047f28e4e50945a48cd lib/markdown.ts
100644 306cd900e20302ac2c5761ec3b0b65ebdd9a59bb lib/migracoes.ts
100644 c9ba09f5658b1bd66c62243a58b7aebcbc075b5b lib/modelos.ts
100644 c2b962e0359651441cc405903f62bfdd7cdb8330 lib/moldura.ts
100644 ade21db897cfe8259691eb13342a4ca9332e1b16 lib/notas.ts
100644 b04799c9eb521cf49046a726a3bdde948fe63ae4 lib/notificar.ts
100644 d32e3d2f97da0b6312b7467d9578aea1d8d73a79 lib/origem.ts
100644 c15f374644a9f0f8f3a31bef31524d8d0e3d6774 lib/paginas.ts
100644 f6ebbc758f6710b98637e692a924accbb5a20c5e lib/passos.ts
100644 eadc99433a5515c61f37cf9fc3ff9879c9061f3e lib/perfis.ts
100644 b2160a32cb9a4705ec820af02d7bfd1f41322ba9 lib/perguntar.ts
100644 8609332337cc1ef04af16a3eea6a7210f124dbcf lib/personalizacao.ts
100644 1980bcdb076d3f5f77a0830cf27d8fdc6fc12d9c lib/pessoas.ts
100644 71313f24d8e2fa2dcd1fd2572b10917f8fab6a82 lib/planilha.ts
100644 54bdf28403924014f0799fc1df69ade6403f80a1 lib/preferencias.ts
100644 87c0dc900964935f12dfbe476e5f1c8f48745e0a lib/primeiros-passos.ts
100644 b24c6ece128164019320158f1711d29a696289ac lib/prompts.ts
100644 2318c0ca3a9cf48750fadbb6ddc71ad05135bffb lib/proxima-acao.ts
100644 e7698cfc714864376e015cdabfbdde0b3b85d9b8 lib/radar.ts
100644 5516cd6fef89993e5d7fdec53a05d928c9a92a0f lib/rascunhos.ts
100644 f01c60f9ea66b8e67cdf51e7d7ad2dc1b5d9a094 lib/realce.ts
100644 010d60ac5e89115fdd7420a5eeb02f69287020eb lib/recorrencia.ts
100644 1e547873db8208dc03cb56acf363e9941c5c35fd lib/resposta.ts
100644 eb537d823d69c0e5d6ff6bdd16d979f0e375d0f5 lib/resumo-periodo.ts
100644 ce56327991c6b09cd3a1fb6df2203aeeae269d43 lib/reuniao.ts
100644 007971a32f4bb4ac498dfea825ac93647919f394 lib/tags.ts
100644 600876f603f65e078c319ad6fd83b3107dcc398a lib/tela-hoje.ts
100644 16e4cce4c12f7879eb0e43a0ba484d8c071a9a21 lib/tema.ts
100644 cc1fc8c5b629ea4e153312d30081d1d78a8d6c16 lib/tempo-status.ts
100644 7c5f00bbe9ff590baeba811147012962b182b37e lib/texto-rico.ts
100644 098e734b2dee6fda398be8de999e4a9f4010285f lib/tipos.ts
100644 a47702cb16f36e82bf8189e0f03a1f8e4f9480e4 lib/transcricao.ts
100644 3aa5c8f254234a99b83208ea53bcae526954d3e5 lib/utils.ts
100644 16d4b9ff08e2dd3aa45da29fabd98779be1553f3 lib/visor.ts
100644 729e39a1c0e3f50bc6ce07466acf875461b9a3c5 lib/zip.ts
100644 80e5a6e65db8f3b060bfe8cb3160ada357dee7ae next.config.ts
100644 278b38f8f2bd893991834aa387e395a3e2be58ae package-lock.json
100644 abe18b088ba96da4f00e154744bad4966dda88f8 package.json
100644 61e36849cf7cfa9f1f71b4a3964a4953e3e243d3 postcss.config.mjs
100644 d83b31bd38f3519c63b1ae93e4d413b7fdcf8954 proxy.ts
100755 - scripts/baixar-nexo.sh
100644 4b73d11bff3368eb56760acfc7f4b6f77e2776c6 scripts/copia/comum.sh
100644 b934586ede7c81281c29eeca1fe376029c81639d scripts/copia/offline.modelo.sh
100755 5a120003cd94a88ee9e274d7068bd4b0dd165cbd scripts/gerar-scripts-de-copia.sh
100644 68a98f7f69c9e9628299ea390a20f053130edc45 scripts/instalar-nexo.ps1
100755 - scripts/nexo-offline.sh
100644 833fb5bbc7a0583c6948b1c54a69cdddd19d5485 testes/ajuda.test.mjs
100644 fe46541dab32fc42d7b8374d778d097922c5f99d testes/aparencia.test.mjs
100644 e99ac488452ae2989e69854569ec116e81b09ed2 testes/api.sh
100644 61d579e9fdbf562084f57ab9ccfae03e028285c3 testes/arquivos.test.mjs
100644 6bebc8c334353f4723b74885969cff5292978e73 testes/auditoria.cjs
100644 b2a78363ee253bfeb06ccdcb2344248e1aa69563 testes/carga.mjs
100644 d58480f07a0db2b74b3a3c9d37134ef8ec757efa testes/checklist.test.mjs
100644 44c6b50981885f0795f9036a11cf67abf957da91 testes/copia.test.sh
100644 1f8bd4db1f1f83ef73754de8cd3b5768e2b95cfe testes/decisoes.test.mjs
100644 a855dfcec14616ad1656d69562094dc969d34b2f testes/dependencias.test.mjs
100644 05bf34712725bf7eba2b3b3fefeecb81e0425721 testes/diario.test.mjs
100644 28f1feb0106b89b82378c274ed38db8cf11e82dc testes/e2e.cjs
100644 219e377c120090cec006827af1cbdf3e6f88f0bd testes/email.test.mjs
100644 2ea4582196066202d5ec8dbf66feab818adcbf55 testes/exemplo.test.mjs
100644 80d928e62b422418bff733c21375b601758631e2 testes/fechamento.test.mjs
100644 6f70d7bf03caec88f4f6dda9e2d9dcfa76da08bf testes/grafo.test.mjs
100644 33992bee09fcb22bed8477d5c6303e374b14b243 testes/importar.test.mjs
100644 70b2fbfa8e3239ded8cc7f9891202b12c6ca0ba1 testes/integridade.test.mjs
100644 bc54217f5fab262dd39e402574484ffc4dd27b78 testes/jogo.test.mjs
100644 dc410253e5417445b0a7b22f5cec5509ddadc088 testes/jornada.test.mjs
100644 26def841d4168e58692d9b68435a8ea0b4febd89 testes/lembretes.test.mjs
100644 30dfa52ce4aef7fe06ff2e505fb0ebee51c39940 testes/ligacoes.test.mjs
100644 556da8fac0ae36f4656b9576f8115d7fa25bee79 testes/links.test.mjs
100644 def817245d35dc6684a637fd2476b7d5fae1f7f0 testes/notas.test.mjs
100644 6544c72d8e73a2c0b86a0b8074bd4030d8fce7bb testes/paginas.test.mjs
100644 171fbb8fbc5bf4601a6d17264506e572e7e35225 testes/passos.test.mjs
100644 f6e55ff7e4ceb0cbc5431d2c7eb3536b3d559085 testes/perfis.test.mjs
100644 3b63db8ea29aa787bf687c4eb6ecb32f277a3591 testes/perguntar.test.mjs
100644 0718754851c5c794f79d63cec67e175e9dfaf23b testes/pessoas.test.mjs
100644 350810ca12be10115e2eff317e0b97f1e8867d0f testes/proxima-acao.test.mjs
100644 ac8c857c070d41697de9b5203a8cdcbbe2ca4630 testes/radar.test.mjs
100644 d7271f1838ce57c58c428f9e5daf192a726ae247 testes/resumo-periodo.test.mjs
100644 44e9a38dc1ddb2b50b07a5f7135ebdc51858c5c6 testes/reuniao.test.mjs
100644 95406917c23578309b9f3a9362c93aa60cc4104b testes/semear.mjs
100644 aaca604246285b2c27c2c2e26ee99ceecee9bfab testes/tags.test.mjs
100644 bb1da9e08c6eda37d93d54f75aa182fa1bf1e938 testes/tempo-status.test.mjs
100644 1472801f1c2a693f64ba1f4b13c1c2d8ee5aa305 testes/texto-rico.test.mjs
100644 0eda418f309fd02636845b5140f2116daf623d86 testes/transcricao.test.mjs
100644 3541a0b21191d4932f2920dd0332c12ca60e93bd testes/versoes.test.mjs
100644 4d908bb7590f735f6888872a14e8ce49f633a353 testes/visor.test.mjs
100644 d2ebf835e7a963463c7dea56af500e2666713900 testes/zip-de-teste.mjs
100644 1a0ca4a34fe96c15554af6446dbe6aca722fa8c7 tsconfig.json
MANIFESTO
}
# <<< MANIFESTO

main "$@"
