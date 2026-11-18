#!/usr/bin/env bash
if grep -q $'\r' "$0" 2>/dev/null; then tr -d '\r' <"$0" >"$0.lf" && NEXO_LF_COPY="$0.lf" exec bash "$0.lf" "$@"; fi #
# =============================================================================
#  baixar-nexo.sh
#
#  Copia o repositório Lajuro/nexo-tarefas para a sua máquina SEM usar
#  "git clone". Útil em redes corporativas onde o GitHub abre no navegador,
#  mas o protocolo do git é bloqueado.
#
#  Ele tenta, nesta ordem, até um funcionar:
#    1. zip   → baixa o pacote .tar.gz/.zip do repositório (um download só)
#    2. api   → lista os arquivos pela API do GitHub e baixa um por um
#    3. lista → usa a lista de arquivos embutida neste script e baixa um por um
#  Nos modos 2 e 3 cada arquivo é conferido pelo hash do git (SHA-1), então a
#  cópia fica idêntica ao repositório.
#
#  Uso (no Windows, rode no Git Bash):
#    bash baixar-nexo.sh                  # cria a pasta ./nexo-tarefas
#    bash baixar-nexo.sh minha-pasta      # escolhe a pasta de destino
#    bash baixar-nexo.sh --git --instalar # já cria um repositório git local e roda npm install
#
#  Opções:
#    --ref <branch|tag|commit>  versão a baixar (padrão: main)
#    --metodo auto|zip|api|lista
#    --git          inicia um repositório git local com um commit da cópia
#    --instalar     roda "npm install" no final
#    --inseguro     ignora erros de certificado (proxy corporativo que intercepta HTTPS)
#    --forcar       aceita pasta de destino que já tem arquivos (sobrescreve)
#    -h, --ajuda    mostra esta ajuda
#
#  Variáveis opcionais (para proxy ou espelho interno do GitHub):
#    HTTPS_PROXY, NEXO_REPO, NEXO_ARCHIVE_BASE, NEXO_RAW_BASE,
#    NEXO_API_BASE, NEXO_WEB_BASE
# =============================================================================

set -euo pipefail

REPO="${NEXO_REPO:-Lajuro/nexo-tarefas}"
REF="${NEXO_REF:-main}"
ARCHIVE_BASE="${NEXO_ARCHIVE_BASE:-https://codeload.github.com}"
RAW_BASE="${NEXO_RAW_BASE:-https://raw.githubusercontent.com}"
API_BASE="${NEXO_API_BASE:-https://api.github.com}"
WEB_BASE="${NEXO_WEB_BASE:-https://github.com}"

DEST=""
METHOD="auto"
DO_GIT=0
DO_INSTALL=0
INSECURE=0
FORCE=0

# ----------------------------------------------------------------- saída ----
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m' C_DIM=$'\033[2m' C_BOLD=$'\033[1m'
  C_OK=$'\033[32m' C_WARN=$'\033[33m' C_ERR=$'\033[31m' C_ACC=$'\033[35m'
else
  C_RESET="" C_DIM="" C_BOLD="" C_OK="" C_WARN="" C_ERR="" C_ACC=""
fi
info() { printf '%s\n' "${C_ACC}›${C_RESET} $*"; }
ok() { printf '%s\n' "${C_OK}✓${C_RESET} $*"; }
warn() { printf '%s\n' "${C_WARN}!${C_RESET} $*" >&2; }
die() {
  printf '%s\n' "${C_ERR}✗ $*${C_RESET}" >&2
  exit 1
}
dim() { printf '%s\n' "${C_DIM}$*${C_RESET}"; }

ajuda() {
  sed -n '3,/^# =====/p' "${NEXO_LF_COPY:-$0}" 2>/dev/null | sed 's/^# \{0,1\}//' | grep -v '^=====' || true
  exit 0
}

# ------------------------------------------------------------ argumentos ----
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="${2:?informe a ref}"; shift 2 ;;
    --ref=*) REF="${1#*=}"; shift ;;
    --metodo | --method) METHOD="${2:?informe o método}"; shift 2 ;;
    --metodo=* | --method=*) METHOD="${1#*=}"; shift ;;
    --git) DO_GIT=1; shift ;;
    --instalar | --install) DO_INSTALL=1; shift ;;
    --inseguro | --insecure | -k) INSECURE=1; shift ;;
    --forcar | --force | -f) FORCE=1; shift ;;
    -h | --ajuda | --help) ajuda ;;
    -*) die "Opção desconhecida: $1 (use --ajuda)" ;;
    *) DEST="$1"; shift ;;
  esac
done

case "$METHOD" in auto | zip | api | lista) ;; *) die "Método inválido: $METHOD (use auto, zip, api ou lista)" ;; esac
[ -n "$DEST" ] || DEST="${REPO##*/}"

# ---------------------------------------------------------- ferramentas ----
if command -v curl >/dev/null 2>&1; then
  DL=curl
  DL_OPTS=(-fsSL --retry 2 --connect-timeout 20 --max-time 600 -A "nexo-baixar/1.0")
  [ "$INSECURE" = 1 ] && DL_OPTS+=(-k)
elif command -v wget >/dev/null 2>&1; then
  DL=wget
  DL_OPTS=(-q --tries=2 --timeout=60 -U "nexo-baixar/1.0")
  [ "$INSECURE" = 1 ] && DL_OPTS+=(--no-check-certificate)
else
  die "Preciso do curl ou do wget instalado."
fi

HAS_GIT=0
command -v git >/dev/null 2>&1 && HAS_GIT=1

download() { # url destino
  mkdir -p "$(dirname "$2")"
  if [ "$DL" = curl ]; then
    curl "${DL_OPTS[@]}" -o "$2" "$1" 2>"$WORK/ultimo-erro.txt"
  else
    wget "${DL_OPTS[@]}" -O "$2" "$1" 2>"$WORK/ultimo-erro.txt"
  fi
}

last_error() {
  [ -s "$WORK/ultimo-erro.txt" ] && head -c 300 "$WORK/ultimo-erro.txt" | tr '\n' ' '
  return 0
}

urlencode() {
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

# Hash do git (SHA-1 de "blob <tamanho>\0<conteúdo>") sem precisar de repositório.
blob_sha() {
  if [ "$HAS_GIT" = 1 ]; then
    git hash-object --no-filters -- "$1"
    return
  fi
  local size
  size=$(wc -c <"$1")
  size="${size//[[:space:]]/}"
  if command -v sha1sum >/dev/null 2>&1; then
    { printf 'blob %s\0' "$size"; cat -- "$1"; } | sha1sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    { printf 'blob %s\0' "$size"; cat -- "$1"; } | shasum -a 1 | cut -d' ' -f1
  else
    echo "?"
  fi
}

# ------------------------------------------------------------ preparação ----
if [ -e "$DEST" ] && [ ! -d "$DEST" ]; then die "\"$DEST\" já existe e não é uma pasta."; fi
if [ -d "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ] && [ "$FORCE" = 0 ]; then
  die "A pasta \"$DEST\" já tem arquivos. Escolha outra pasta ou use --forcar."
fi

WORK="$(mktemp -d 2>/dev/null || mktemp -d -t nexo)"
STAGE="$WORK/repo"
cleanup() {
  rm -rf "$WORK"
  [ -n "${NEXO_LF_COPY:-}" ] && rm -f "$NEXO_LF_COPY"
  return 0
}
trap cleanup EXIT
mkdir -p "$STAGE"

printf '\n%s\n' "${C_BOLD}Nexo · cópia sem git clone${C_RESET}"
dim "  repositório: $REPO   versão: $REF   destino: $DEST"
[ "$INSECURE" = 1 ] && warn "Verificação de certificado desligada (--inseguro)."
echo

# ------------------------------------------------------ método 1: pacote ----
try_archive() {
  local url
  info "Tentando baixar o pacote do repositório…"
  for url in "$ARCHIVE_BASE/$REPO/tar.gz/$REF" "$WEB_BASE/$REPO/archive/$REF.tar.gz"; do
    dim "  $url"
    if download "$url" "$WORK/repo.tar.gz" && tar -tzf "$WORK/repo.tar.gz" >/dev/null 2>&1; then
      rm -rf "$STAGE" && mkdir -p "$STAGE"
      if tar -xzf "$WORK/repo.tar.gz" -C "$STAGE" --strip-components=1 && [ -f "$STAGE/package.json" ]; then
        ok "Pacote .tar.gz baixado"
        return 0
      fi
    else
      dim "  falhou: $(last_error)"
    fi
  done
  if command -v unzip >/dev/null 2>&1; then
    for url in "$ARCHIVE_BASE/$REPO/zip/$REF" "$WEB_BASE/$REPO/archive/$REF.zip"; do
      dim "  $url"
      if download "$url" "$WORK/repo.zip"; then
        rm -rf "$WORK/unzip" && mkdir -p "$WORK/unzip"
        if unzip -q -o "$WORK/repo.zip" -d "$WORK/unzip" 2>/dev/null; then
          local inner
          inner="$(find "$WORK/unzip" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
          if [ -n "$inner" ] && [ -f "$inner/package.json" ]; then
            rm -rf "$STAGE" && mv "$inner" "$STAGE"
            ok "Pacote .zip baixado"
            return 0
          fi
        fi
      else
        dim "  falhou: $(last_error)"
      fi
    done
  fi
  return 1
}

# ------------------------------------------ métodos 2 e 3: arquivo a arquivo --
FAILED=()
MISMATCH=()

fetch_list() { # arquivo com linhas "modo sha caminho"
  local list="$1" total n=0 mode sha path enc base got actual
  total=$(grep -c . "$list" || true)
  [ "$total" -gt 0 ] || return 1
  rm -rf "$STAGE" && mkdir -p "$STAGE"
  FAILED=()
  MISMATCH=()
  while read -r mode sha path <&3; do
    [ -n "${path:-}" ] || continue
    n=$((n + 1))
    if [ -t 1 ]; then printf '\r\033[K  %s[%3d/%d]%s %s' "$C_DIM" "$n" "$total" "$C_RESET" "$path"; fi
    enc="$(urlencode "$path")"
    got=0
    for base in "$RAW_BASE/$REPO/$REF" "$WEB_BASE/$REPO/raw/$REF"; do
      if download "$base/$enc" "$STAGE/$path"; then
        got=1
        break
      fi
    done
    if [ "$got" = 0 ]; then
      FAILED+=("$path")
      # se os primeiros arquivos já falham, não adianta insistir
      if [ "$n" -ge 3 ] && [ "${#FAILED[@]}" -eq "$n" ]; then
        [ -t 1 ] && printf '\n'
        dim "  falhou: $(last_error)"
        return 1
      fi
      continue
    fi
    [ "$mode" = "100755" ] && chmod +x "$STAGE/$path"
    if [ "$sha" != "-" ]; then
      actual="$(blob_sha "$STAGE/$path")"
      if [ "$actual" != "?" ] && [ "$actual" != "$sha" ]; then MISMATCH+=("$path"); fi
    fi
  done 3<"$list"
  [ -t 1 ] && printf '\r\033[K'
  ok "$((n - ${#FAILED[@]})) de $n arquivos baixados"
  [ "${#FAILED[@]}" -eq 0 ]
}

list_from_api() {
  info "Tentando listar os arquivos pela API do GitHub…"
  local url="$API_BASE/repos/$REPO/git/trees/$(urlencode "$REF")?recursive=1"
  dim "  $url"
  if ! download "$url" "$WORK/tree.json"; then
    dim "  falhou: $(last_error)"
    return 1
  fi
  if command -v node >/dev/null 2>&1; then
    node -e '
      const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      if (t.truncated) process.exit(3)
      for (const e of t.tree || []) if (e.type === "blob") console.log(`${e.mode} ${e.sha} ${e.path}`)
    ' "$WORK/tree.json" >"$WORK/lista-api.txt" || return 1
  else
    local py=""
    command -v python3 >/dev/null 2>&1 && py=python3
    [ -z "$py" ] && command -v python >/dev/null 2>&1 && py=python
    [ -n "$py" ] || { dim "  sem node/python para ler a resposta"; return 1; }
    "$py" -c '
import json, sys
t = json.load(open(sys.argv[1], encoding="utf-8"))
if t.get("truncated"): sys.exit(3)
for e in t.get("tree", []):
    if e.get("type") == "blob": print(e["mode"], e["sha"], e["path"])
' "$WORK/tree.json" >"$WORK/lista-api.txt" || return 1
  fi
  [ -s "$WORK/lista-api.txt" ]
}

try_api() {
  list_from_api || return 1
  ok "$(grep -c . "$WORK/lista-api.txt") arquivos na lista"
  info "Baixando arquivo por arquivo…"
  fetch_list "$WORK/lista-api.txt" || return 1
  if [ "${#MISMATCH[@]}" -gt 0 ]; then
    warn "Conteúdo diferente do esperado em: ${MISMATCH[*]}"
    return 1
  fi
  return 0
}

try_manifest() {
  info "Usando a lista de arquivos embutida no script (gerada do commit $MANIFEST_COMMIT)…"
  manifest >"$WORK/lista-embutida.txt"
  fetch_list "$WORK/lista-embutida.txt" || return 1
  if [ "${#MISMATCH[@]}" -gt 0 ]; then
    warn "${#MISMATCH[@]} arquivo(s) mudaram depois que esta lista foi gerada."
    warn "Eles foram baixados na versão atual, mas arquivos novos podem ter ficado de fora:"
    printf '    %s\n' "${MISMATCH[@]}" >&2
    warn "Se precisar da cópia exata, use scripts/nexo-offline.sh."
  fi
  return 0
}

# -------------------------------------------------------------- execução ----
main() {
  USED=""
  case "$METHOD" in
    zip) try_archive && USED="pacote" ;;
    api) try_api && USED="API + arquivos" ;;
    lista) try_manifest && USED="lista embutida" ;;
    auto)
      if try_archive; then
        USED="pacote"
      elif try_api; then
        USED="API + arquivos"
      elif try_manifest; then
        USED="lista embutida"
      fi
      ;;
  esac

  if [ -z "$USED" ]; then
    echo
    printf '%s\n' "${C_ERR}✗ Não consegui baixar o repositório por nenhum caminho.${C_RESET}" >&2
    [ "${#FAILED[@]}" -gt 0 ] && warn "Arquivos que falharam: ${FAILED[*]:0:10}"
    cat >&2 <<EOF

  O que tentar:
   • Se o erro fala de certificado/SSL, rode de novo com --inseguro
     (o proxy da empresa provavelmente intercepta o HTTPS).
   • Se a empresa usa proxy, defina antes: export HTTPS_PROXY=http://proxy:porta
   • Confirme que o repositório está público: $WEB_BASE/$REPO
   • Plano B sem rede: abra scripts/nexo-offline.sh no GitHub, copie o
     conteúdo para um arquivo e rode com "bash". Ele já traz o projeto inteiro.
EOF
    exit 1
  fi

  for essential in package.json app/page.tsx; do
    [ -f "$STAGE/$essential" ] || die "A cópia ficou incompleta (faltou $essential)."
  done

  mkdir -p "$DEST"
  (
    shopt -s dotglob nullglob
    cp -R "$STAGE"/* "$DEST"/
  )
  FILES=$(find "$DEST" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l | tr -d ' ')
  echo
  ok "Repositório copiado para ${C_BOLD}$DEST${C_RESET} ($FILES arquivos, via $USED)"

  if [ "$DO_GIT" = 1 ]; then
    if [ "$HAS_GIT" = 1 ]; then
      (
        cd "$DEST"
        git init -q
        git checkout -q -b main 2>/dev/null || true
        git add -A
        if [ -z "$(git config user.name || true)" ]; then export GIT_AUTHOR_NAME="Nexo" GIT_COMMITTER_NAME="Nexo"; fi
        if [ -z "$(git config user.email || true)" ]; then export GIT_AUTHOR_EMAIL="nexo@local" GIT_COMMITTER_EMAIL="nexo@local"; fi
        git commit -q -m "Cópia de $REPO ($REF) baixada sem git clone"
        git remote add origin "$WEB_BASE/$REPO.git" 2>/dev/null || true
      )
      ok "Repositório git local criado (branch main, remote origin)"
    else
      warn "git não encontrado: pulei o --git"
    fi
  fi

  if [ "$DO_INSTALL" = 1 ]; then
    if command -v npm >/dev/null 2>&1; then
      info "Rodando npm install…"
      (cd "$DEST" && npm install)
      ok "Dependências instaladas"
    else
      warn "npm não encontrado: instale o Node.js 20+ e rode npm install na pasta."
    fi
  fi

  cat <<EOF

${C_BOLD}Próximos passos${C_RESET}
  cd "$DEST"
$([ "$DO_INSTALL" = 1 ] || echo "  npm install")
  npm run build
  npm start          ${C_DIM}# abre em http://127.0.0.1:3210 (ou use "Iniciar Nexo.cmd")${C_RESET}

${C_DIM}Seus dados ficam na pasta escolhida no app (ex.: OneDrive\\Nexo), fora desta pasta.
Para atualizar: rode de novo com --forcar apontando para a mesma pasta.${C_RESET}

EOF
}

# >>> MANIFESTO
MANIFEST_COMMIT="82237e7"
manifest() {
  cat <<'MANIFESTO'
100644 93e976eb627abb713950f1412bb566bf1302ce52 .github/workflows/scripts-de-copia.yml
100644 c3138d29f7fbb27099a70e1d0b08dbacf5a3ea25 .gitignore
100644 604dfe2449c92760ab525ec0fd10ddeede95880c AGENTS.md
100644 a3956e75a7eb876f829596f3471f06fd76fc6111 CLAUDE.md
100644 c8e208f1f27f1045381a6cb7ee047bea044c7bf7 Iniciar Nexo.cmd
100644 294e016ab2569af114ec5cecd624674b385d5a78 README.md
100644 d0be4fccca3425f6416821aaf169f200cb20a6b4 app/api/arquivos/route.ts
100644 83dd22f13bd37936d542901525e190cd4bec8323 app/api/backup/restaurar/route.ts
100644 7072e6be9423a1196f20e069dd1c98814d981ce3 app/api/backup/route.ts
100644 c28578efe9be7694957478263f3c8a387e3a3bbb app/api/categorias/route.ts
100644 dc390bd3abe6e2d536f0b519dad280099d9fc9ac app/api/config/route.ts
100644 3ae2cf010e2f4fc81dc8ab47d43d85d44a81ca46 app/api/dados/route.ts
100644 b46621e477758df584374185b49985124466a3f6 app/api/estado/route.ts
100644 a107bb9bedd857f1f989405d51392ee9396dc2a7 app/api/exportar/route.ts
100644 2073d6857a82e8f3c1a54bbcc8e2867411e6e205 app/api/jornada/route.ts
100644 0aa3a525b99939e81777ab96654037e3c1f04841 app/api/links/route.ts
100644 9516a379fb5f1a299e1648d21db38c352688f709 app/api/lixeira/route.ts
100644 6e2c54a943ebceacdde3eecb6a88a11ebbc50fc5 app/api/midia/route.ts
100644 34766422d7652d6f3d1a09a4440e581982743ef6 app/api/modelos/route.ts
100644 3cf931a5679ceeea68cda8cb444f022fcb99714b app/api/notas/route.ts
100644 cece95c1906b1c0f386e3399f4ea29ce2eadd84c app/api/paginas/historico/route.ts
100644 9faff9d0ee86dd21bc3dab5235247a13f3541dd8 app/api/paginas/route.ts
100644 e17331e21f1b39f6e9e7cd35711eddc5fa87d036 app/api/pessoas/route.ts
100644 636c77351b2310321b6a1158098fd204686d933a app/api/tarefas/[id]/route.ts
100644 598b5c2091632d1bd12a4be1e754a3679a247c67 app/api/times/route.ts
100644 442c39f1efe7b775ef67ecf703154f6d07091cbb app/api/verificar/route.ts
100644 988ddda7d843d7931fed9bf9c3ea0e3df0e60621 app/busca/page.tsx
100644 1e07f389fe1b9eaae0465d64d88638d814d03f9f app/categorias/[id]/page.tsx
100644 4649c1cc859b94ceade84984d56befd9e06e122e app/categorias/page.tsx
100644 f049d82c0bc1a77501245b0c4ad57c9d96cea0b5 app/configuracoes/page.tsx
100644 901c3af3c8225297d2e6a2d87b28bb1a0b38aa2a app/conquistas/page.tsx
100644 ac4be3e935c4ac91433519bb9a30603bb91ae4d3 app/diario/page.tsx
100644 ea3cd3d6b44e736888c4cd1d26ccaa8e730c629d app/globals.css
100644 314684907ed8f33fd74039c3a2d62805b56ad974 app/icon.svg
100644 8432111675d171a9084049a3d2aeb8cbf8ef4cb2 app/layout.tsx
100644 afcb6a6ef3ca948caa1dbedd55e1265bd15b9f87 app/links/page.tsx
100644 0d402fdde973d79361413b1b7e7ac454b0f305d1 app/manifest.ts
100644 cbd1f15ecbc0d5b981a1a2df5da7c10ab76ddef6 app/notas/page.tsx
100644 c0b7c6a89e6c7f6a754185fcc31d1b4457f6b053 app/page.tsx
100644 fa1faa2e193236bf4bc66d699356959850af50b1 app/paginas/page.tsx
100644 e467626eadf25e15385a7a6455b0fc01b31e4cbe app/pendencias/page.tsx
100644 01a0d423670fa234815544f7b6aa547374f0bf6f app/perguntar/page.tsx
100644 0a6f76ffa109f0bf97eeda85e55aba30f0a63d1e app/pessoas/page.tsx
100644 6b6138802636806feeb825e45bb691ad9f1cb072 app/radar/page.tsx
100644 0835d7b78aac299e15fa46aec72234c160318e3c app/relatorios/page.tsx
100644 ca5daa3a78f3349c37e13f18c88fb8c6dd79a715 app/revisao/page.tsx
100644 80861d021ef33cfb3452f16d5badc730641a07b2 app/rotina/page.tsx
100644 bc64b65db10644ab9423e7cf26167a9c6dafcdb0 app/tarefas/[id]/page.tsx
100644 e791e7a7c31e2d973bd68104c758d05ed4f06ce6 app/tarefas/[id]/reuniao/page.tsx
100644 56ac7345e6f4c00d49574950f2465e4128a2a4b9 app/tarefas/page.tsx
100644 f580316fc46d384d0219ffa08ad4e6773e251b64 app/template.tsx
100644 de75a0b4bb49f3e74eceaeb4db039a6fcb1aef67 components.json
100644 d6ba5b87b5ff19ff891ed3c630d5475abc7acb6f components/CardTarefa.tsx
100644 b914e55c7164e9eb02d97e92c11215f630f4f2a8 components/CategoriaForm.tsx
100644 c16c63f5dc6b58707e456b3ba7e3a0342bc9879a components/Citacoes.tsx
100644 8d1998e2d9853346bc5ecddfde317fc0de732f52 components/Esperando.tsx
100644 d307ae68cc86c2517d2b813a3fc269c04e1497a1 components/LinkForm.tsx
100644 44ea30c1adce663f9d3e25d3233b98846165504c components/MenuTarefa.tsx
100644 d9b3da6c17a4794221c27685124ea130a63e3610 components/Modelos.tsx
100644 a4b1fe376b0a80ef4fa010a25900b0b73849556b components/MoverEJuntar.tsx
100644 491a00b86fd4b40d588c1f8aec15917ff85960f3 components/PromptModal.tsx
100644 71b14d7c8a851c482cfad2b092e8ef984022b40f components/Provider.tsx
100644 0787a476e3beaa1cdf5bc2868ea0248119f8de26 components/Raiz.tsx
100644 92873e8ec25d37fe34371a17ce04f0ca339ced60 components/RegistroEditor.tsx
100644 5a12a58e80a55c006bcdedd198013535f6c66251 components/Shell.tsx
100644 763077291b65fa13737a2185a415bdd3e345b49b components/TarefaForm.tsx
100644 853b57ea933d3108e61b2f0a42b3d35c2dd88083 components/busca/CampoBusca.tsx
100644 5e049371177732ec8c52e4fc2ec10e5ce489ae86 components/categorias/CartaoCategoria.tsx
100644 95fee2178db26f2e1a016e464ddfa37108e7e430 components/categorias/EmblemaCategoria.tsx
100644 a72a024898c1af98cfa1cd57bac3148cc8e39e4c components/categorias/acoes.ts
100644 72c1e7fb513494124ceab4e3cdb9a2babfa51b92 components/comum.tsx
100644 2e8f55aa7ec43e13e0f6d2d36f73c2d2165b196b components/configuracoes/dados.tsx
100644 09373298821bb00c14e985bfc3d4eab705f31458 components/configuracoes/preferencias.tsx
100644 4d484a9efe3c1128feac903ff3da73dc9b59d401 components/editor/EditorRico.tsx
100644 abdc26cb55f3396e1c858eb0f95659441ab1b78b components/editor/extensoes.ts
100644 c3f84c5968aaa0c86734b24ca51d020431b50541 components/hoje/CapturaRapida.tsx
100644 cb6e2e490cb8ca39c6d24c2487816903822c4004 components/hoje/FocoHoje.tsx
100644 3d5ccc777f842ef6b57917733aeb4549a95b79da components/hoje/Laterais.tsx
100644 347b25a9d590f587d5af4eeec6b3776c8a0ecd98 components/hoje/PrecisaDeVoce.tsx
100644 7be4ed672388a3538f54c643c9c34fff648ef6b2 components/hoje/Semana.tsx
100644 478617f83d7b1c6339d9679624ef6aa1741b9734 components/hoje/apoio.tsx
100644 14e456f7ac068a31e50caeeede52efc04806d9fe components/jogo/Celebracao.tsx
100644 a561b32212b47eea32213b9bc52a83662e0764b8 components/jogo/NivelLateral.tsx
100644 a635de871089ca2b4266288b022c76e70fb3f5dc components/jogo/pecas.tsx
100644 4d000eec3c5c4a608ea45bc5ce92bc640c63e525 components/jogo/useJogo.ts
100644 340636d248b556def3486cc9c728f088313a508a components/jornada/Ferramenta.tsx
100644 69796bfff51b7e80bc11fc38af755f2b443ee54c components/jornada/Formularios.tsx
100644 f3d6e39f7a32c94053746e152374b0d8f7e015da components/jornada/LinhaDoDia.tsx
100644 c3e2879283fba9ea3f4e9e6f5c3d534a69ad3dc3 components/jornada/Paineis.tsx
100644 e3b7a02bf3767133d3d84cebfb0bea66bfb4038a components/jornada/pecas.tsx
100644 a9219bb38a12a80d304c651252e431b0c3a8355d components/links/IconeLink.tsx
100644 e56ede64fd5a55ccd9bba7f010a522dc8ed9997a components/notas/EditorNota.tsx
100644 07efb8fe4f1f423b65ec636199c754ad985ccf0e components/notas/OrganizarNota.tsx
100644 a31296d67eb5ab1eba69860749c8dbb3261cbc87 components/paginas/Abas.tsx
100644 a5e9d8cfbca06786afe98814fa6271c22b8d0f6d components/paginas/EditorPagina.tsx
100644 36c49c402e65337e0133b2610fe354b96f550c41 components/paginas/Explorador.tsx
100644 0878254d985bcf977c4d9ca76f3e34f321f13f3d components/paginas/Historico.tsx
100644 3c4c1c902c2937d3b2801ca99c6a4c0ecd9cbb59 components/paginas/ListaPaginas.tsx
100644 08610395ce3f1089c903ddc5ea5e7986582dd3e0 components/paginas/MapaDePaginas.tsx
100644 01932358226b5d2f8ca93b295f1db3bc43c4232e components/paginas/QuadroPaginas.tsx
100644 e8ed32facbfc6f5b34206d52309459b9c1953c40 components/paginas/pecas.tsx
100644 ba3cf2810ae0b69a22a0269f425ccc06880d8e5a components/paginas/video/GaleriaDeVideos.tsx
100644 3dd690dd2da8ff912173c4325d84c0dfddbdd282 components/paginas/video/Player.tsx
100644 bf26a619a56fe8e3c91281a3347bffe1c078a907 components/paginas/video/Transcricao.tsx
100644 05951b901cffb9969889b965d1c6adbf8644f59d components/paginas/video/VisaoDeVideo.tsx
100644 246a6dd12e58b8da3fd8e351625cf5c825c3a75f components/pendencias/GrupoPendencias.tsx
100644 11b049f0399486c25138d67d616a1c2a218a4fdb components/pendencias/Lateral.tsx
100644 8c4725ed1c82d8438b94d7485b080ae5047cb909 components/pendencias/LinhaPendencia.tsx
100644 8b023388312205ea1f290c078363b215942eab9c components/pendencias/agrupar.ts
100644 f912a52089455563b1b6ecf1ce182a9758aa4b8e components/pessoas/AbasPessoas.tsx
100644 c6fa4baf00c44b501c4233b243d6104a24b4d31e components/pessoas/DetalhePessoa.tsx
100644 18ed8efbbbffc0451863f07269bb2074ea8738da components/pessoas/DetalheTime.tsx
100644 adfb8589e7cbd2920c22ba27742051fd7447b85d components/pessoas/ImportarPessoas.tsx
100644 ecdf61900dec9181008dcd72be0ab51c90299781 components/pessoas/ListaPassos.tsx
100644 5333a4bc88faacf90039397ed1d3d3014f96fb2b components/pessoas/ListaPessoas.tsx
100644 ab5595fa5c3bd71cedcf7c8c925f0ef18a9136a7 components/pessoas/ListaTimes.tsx
100644 4e71af5cb75e253456b67bae6f7e6e6e07e76f26 components/pessoas/PessoaForm.tsx
100644 222f026fea659322823fd3f3e5591ffd5c85eb6f components/pessoas/SeletorCor.tsx
100644 6ddd49f1deb8ebabd30a87e6ad434361b62649a3 components/pessoas/SeletorMultiplo.tsx
100644 d4eba18486c70f3709eed1b56d46b9ede9c4b571 components/pessoas/TimeForm.tsx
100644 7eb0da2345d3d96abbe274f5a4d83ae8915a3692 components/pessoas/dados.ts
100644 7fae400e25cf2f2071d2bf95c5b1dfcf5c4d8532 components/pessoas/pecas.tsx
100644 ce5ca407b72bd909ccd2bb3ee1896dbdade3ec94 components/revisao/CartaoRevisao.tsx
100644 317bfdc15f73cd7f1272e17aa5aad78bf52eec6a components/revisao/retrato.ts
100644 e8630f4a97b2f8d36130f8c8980cbbe464834ee4 components/rotina/EtapaAtras.tsx
100644 539ae0070dc81945c8d236d9cacf11d2d9c5e53a components/rotina/EtapaFocos.tsx
100644 c50524f0bfba4983cdfea968188c32b7f5ae08f4 components/rotina/EtapaPronto.tsx
100644 9d31d582d6273f999010d82d9eacd89533bc531c components/rotina/PlanejarDia.tsx
100644 d1da5a15fd085f70f353ac77869053e3cb62a83e components/rotina/pecas.tsx
100644 af321fff84736ae76800810adef0eced84ca8b5a components/shell/Aparencia.tsx
100644 991f39200d7a5e3a7b83d4f1e9c37efd718cdc3a components/shell/BarraSuperior.tsx
100644 8d6dcf3e195267c87bdeca2f33d1b8bc73480d45 components/shell/Ferramentas.tsx
100644 8be4f4b7b1bf8d262efb19f2b5f73b84e0460826 components/shell/Lateral.tsx
100644 7326a3992d41da49bb4cc174b173eed1c876307f components/shell/Logo.tsx
100644 ce820a1a024bea3ba004f2105f7ec4618ef97052 components/shell/Novidades.tsx
100644 0f70754c1c6aacf230e37596c05b54c8b4eb07f3 components/shell/Paleta.tsx
100644 7cefb43acb404f2bbb9a8157989a3a48a6e902a9 components/shell/Personalizar.tsx
100644 1a4ba106e98bdb7c4e9c4ee586bc8ddb38f6cc25 components/shell/SessaoFoco.tsx
100644 2b0ea422cdedcfdac54582fb3b59ae2e3569f8af components/shell/Sino.tsx
100644 07861798e3fdb7e667535c640df1858fe8205aec components/shell/Telas.tsx
100644 1d66b49e1edc24ea06f2942298c2daa8f744678a components/shell/navegacao.ts
100644 ef82c53884453c0a48d07c61b7b92bde09cac876 components/shell/paleta/navegacao.ts
100644 47d1a1a357bf7081314aed4c5feb740a200387a5 components/shell/paleta/pecas.tsx
100644 9ccae0a99b72c75af2c23df60b30c207e9c94239 components/tarefa/Copilot.tsx
100644 400f1586f551f44b3ca732fa26500e5583f69599 components/tarefa/Lateral.tsx
100644 43cb694f5d4cc6f3303184f9eef242856346404d components/tarefa/Passos.tsx
100644 8f3ba8047b0f632ee2e0ed85cc22d9e250a373c6 components/tarefa/Propriedades.tsx
100644 30e488bd6f67d49620fc3ed04977f00bc16eee5f components/tarefa/Texto.tsx
100644 d77cc4172d3da8e02cc32ce2383b98264189fce6 components/tarefa/Timeline.tsx
100644 2f280ceab6867c468b2071024b010cf01fa3b859 components/tarefas/ComboCategoria.tsx
100644 ac84ff7152bfccc58e362522db168501b72c18ff components/tarefas/ListaTarefas.tsx
100644 15edc15a2fb144ba1ed3108a3650a7dbefe801ad components/tarefas/QuadroTarefas.tsx
100644 56bdfeaa5f6c8a2fbbfef3d404e7590c23bce280 components/tarefas/filtros.ts
100644 f0de1471553d015ef78f5ed8ab6e64a4f2a129fb components/ui/button.tsx
100644 4b1b3a411979e68ebe33e0badaaf5bc207617e89 components/ui/chips.tsx
100644 d4e76b16d0359f7451ccb11928678aeb5855a60a components/ui/command.tsx
100644 7345913e23de6a036c07b2567807784a0642ceec components/ui/controles.tsx
100644 e8b60df73fb3e07d8d4ca077b9b8715157360bcd components/ui/data.tsx
100644 bebf61c9dd97e0547bc23dbfc638fb4470120dfe components/ui/dialog.tsx
100644 dbe22caa9bed1e218c7178e7df7cbabd56345c0d components/ui/diversos.tsx
100644 f30cc2e0d61b0f88c1b9f06a3905c7bd6a386294 components/ui/input.tsx
100644 3b202332ee0490656cf5704cb13fcb041cfb3c65 components/ui/menu.tsx
100644 04372cf588d686fa393488ae8fb44b316e5f8b7b components/ui/popover.tsx
100644 b18b1be9ebeccb5be3a7b4b25ee9c82d6186357e components/ui/select.tsx
100644 183d40d56eeb58bf806c6ece1559c7ebb769f893 components/useGravacao.ts
100644 7c74bc378088e2976702b69195074adcd069d8d3 components/useHoje.ts
100644 bf50a3b8b759f49e67608dc8b05fd7b121327c74 components/useLembretes.ts
100644 f81ee09708c3ed0240b10ab2879315ea6cdafdee lib/acoes.ts
100644 3198e421c5ca7157371f58d197959a2d2849ce76 lib/animacoes.ts
100644 354f6f3a5bb45d10cd9b0d01b349831eef7e0ab8 lib/aparencia.ts
100644 aeb571aa1391e2193ed689a8d3582990ee6e7363 lib/armazenamento.ts
100644 1db3dbeed0f90f7275a6b4fa037e8ecf72b16431 lib/diario.ts
100644 6b412141314e6c1223cc37b74d5561ec3c39c111 lib/espera.ts
100644 98b502a721913fd5ea15bbff440303b46ffd147d lib/grafo.ts
100644 55a06342e9e7d3114c28c6d867021ce961b243ba lib/importar-pessoas.ts
100644 7a571f1b7ae7129eda682b19d82dade907380709 lib/integridade.ts
100644 4d39f1780cd62e38fbdbf4bc6748666d656ab1d8 lib/jogo.ts
100644 21433bd1d73319262eea8775acf477bfb6a97b59 lib/jornada.ts
100644 5f9f9bf4b9823004d824d56e14a8f3e483afd95a lib/lembretes.ts
100644 e80693e89d9ae3dc6124149aab7ef550301b2320 lib/ligacoes.ts
100644 728bd823dd87f96d630ea5519f0294a54e3ccc5a lib/markdown.ts
100644 306cd900e20302ac2c5761ec3b0b65ebdd9a59bb lib/migracoes.ts
100644 ca8388332320142b1d58c3c73111eac9ec73893d lib/modelos.ts
100644 6258294ad9844183df9cec3da6835ea67d894566 lib/moldura.ts
100644 711395759ece28813433ac8001617d751b6a7bb0 lib/notas.ts
100644 725b378d4f0694609af18569b22a4f12ac409dee lib/paginas.ts
100644 15878ae40d6c736a13329b90f58968f753b51533 lib/perguntar.ts
100644 dcd751bb9a402f99fd908b362912017426ff0b1e lib/pessoas.ts
100644 9dfb2919c6cb1c57c97be4938cd4b4bf23064949 lib/preferencias.ts
100644 db485223210bfa66aa2f5c7af32ac1df24f232f3 lib/prompts.ts
100644 bac7100aae7a8a79693ca47ddbe4ca5f9758f50d lib/radar.ts
100644 5516cd6fef89993e5d7fdec53a05d928c9a92a0f lib/rascunhos.ts
100644 f01c60f9ea66b8e67cdf51e7d7ad2dc1b5d9a094 lib/realce.ts
100644 1e547873db8208dc03cb56acf363e9941c5c35fd lib/resposta.ts
100644 12a33656d7720404ea43d3a490b8ac1077fc7293 lib/reuniao.ts
100644 16e4cce4c12f7879eb0e43a0ba484d8c071a9a21 lib/tema.ts
100644 51669589425dac2d9667255a0ff84eb9ab0c2af8 lib/texto-rico.ts
100644 198213d92b01bcec9aa853f043825123a2374f99 lib/tipos.ts
100644 a47702cb16f36e82bf8189e0f03a1f8e4f9480e4 lib/transcricao.ts
100644 3aa5c8f254234a99b83208ea53bcae526954d3e5 lib/utils.ts
100644 feef254d16d9b68ee24ec1424a95db12f840e5f4 next.config.ts
100644 9d89af5509bcd5a840ec6f51519d4e5fb323e1f0 package-lock.json
100644 fc2451d1654d0722dd601f62e2c0be059e9e6413 package.json
100644 61e36849cf7cfa9f1f71b4a3964a4953e3e243d3 postcss.config.mjs
100644 9f1d221053f6ddb6f82346cf95faf1701cf787c0 proxy.ts
100755 - scripts/baixar-nexo.sh
100755 b248bddf0ce318579f048d93b148d56418632320 scripts/gerar-scripts-de-copia.sh
100644 68a98f7f69c9e9628299ea390a20f053130edc45 scripts/instalar-nexo.ps1
100755 - scripts/nexo-offline.sh
100644 d0d6dc7c92904fc8aec47e39a9738ddb32d1085e testes/aparencia.test.mjs
100644 940f05a628cc02aff6775e5ca7cc7317b4fa6e86 testes/api.sh
100644 b2a78363ee253bfeb06ccdcb2344248e1aa69563 testes/carga.mjs
100644 05bf34712725bf7eba2b3b3fefeecb81e0425721 testes/diario.test.mjs
100644 85c9bd23fc8fbbf9dd41fa501648ce6aede60bab testes/e2e.cjs
100644 6f70d7bf03caec88f4f6dda9e2d9dcfa76da08bf testes/grafo.test.mjs
100644 70b2fbfa8e3239ded8cc7f9891202b12c6ca0ba1 testes/integridade.test.mjs
100644 bc54217f5fab262dd39e402574484ffc4dd27b78 testes/jogo.test.mjs
100644 512f61a26b53a847d164b807fc37ebf5c3f89fb8 testes/jornada.test.mjs
100644 e724cf3d50dcbd902236ee88cd6f52008bec6609 testes/lembretes.test.mjs
100644 30dfa52ce4aef7fe06ff2e505fb0ebee51c39940 testes/ligacoes.test.mjs
100644 a079f6e3c2e9210f815adc6405621809265f1f91 testes/notas.test.mjs
100644 419c41fa8bc7505714f4bd1029e75b5f50ee0310 testes/paginas.test.mjs
100644 3b63db8ea29aa787bf687c4eb6ecb32f277a3591 testes/perguntar.test.mjs
100644 01ad3d1d401e114e651ce756995c206a6d42233b testes/pessoas.test.mjs
100644 1aa07fa7fb3b614cfaffed84333dd597b7cca85f testes/radar.test.mjs
100644 6ad501b7f9ce531f3f0a0da8e711b264716b5dae testes/reuniao.test.mjs
100644 d115473f88542e67cd415f7225fb167f8a6af0b1 testes/semear.mjs
100644 1472801f1c2a693f64ba1f4b13c1c2d8ee5aa305 testes/texto-rico.test.mjs
100644 0eda418f309fd02636845b5140f2116daf623d86 testes/transcricao.test.mjs
100644 1a0ca4a34fe96c15554af6446dbe6aca722fa8c7 tsconfig.json
MANIFESTO
}
# <<< MANIFESTO

main
