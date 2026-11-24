#!/usr/bin/env bash
# shellcheck shell=bash disable=SC2034
# =============================================================================
#  scripts/copia/comum.sh
#
#  Parte comum dos scripts de cópia sem git (scripts/baixar-nexo.sh e
#  scripts/nexo-offline.sh): cores e mensagens, perguntas no terminal, leitura
#  de flags, a conferência da pasta de destino, a instalação nela (com a versão
#  atual guardada em <pasta>-anterior e os arquivos que saíram do Nexo
#  retirados), npm install + build e os próximos passos.
#
#  Não roda sozinho. O gerador (scripts/gerar-scripts-de-copia.sh) copia tudo o
#  que vem depois da linha ">>> corpo" para dentro dos dois scripts, porque
#  quem baixa leva um arquivo só. Mudou aqui? Gere os scripts de novo.
#
#  Quem inclui define antes: NOME_SCRIPT e as opções FORCE, ASSUME_YES,
#  DRY_RUN, QUIET, DO_INSTALL, NO_BACKUP e SEM_COR (0 ou 1).
# =============================================================================
# >>> corpo

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
