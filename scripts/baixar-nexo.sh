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
# <<< MANIFESTO

main "$@"
