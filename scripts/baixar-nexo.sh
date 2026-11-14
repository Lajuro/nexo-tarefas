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
MANIFEST_COMMIT="20c9c8f"
manifest() {
  cat <<'MANIFESTO'
100644 93e976eb627abb713950f1412bb566bf1302ce52 .github/workflows/scripts-de-copia.yml
100644 c3138d29f7fbb27099a70e1d0b08dbacf5a3ea25 .gitignore
100644 87363bf2859b9f2dacc08b14b56a0c5dbb9d0b64 AGENTS.md
100644 a3956e75a7eb876f829596f3471f06fd76fc6111 CLAUDE.md
100644 c8e208f1f27f1045381a6cb7ee047bea044c7bf7 Iniciar Nexo.cmd
100644 91251b448f730e73c23c9fdb583b3ff45db00d11 README.md
100644 d8cf556828652cc2667180d0364a9deb574aef6c app/api/arquivos/route.ts
100644 b19a971d9b52424cb50c5eccb24d40eac71d0051 app/api/backup/route.ts
100644 c28578efe9be7694957478263f3c8a387e3a3bbb app/api/categorias/route.ts
100644 dc390bd3abe6e2d536f0b519dad280099d9fc9ac app/api/config/route.ts
100644 3ae2cf010e2f4fc81dc8ab47d43d85d44a81ca46 app/api/dados/route.ts
100644 b46621e477758df584374185b49985124466a3f6 app/api/estado/route.ts
100644 a107bb9bedd857f1f989405d51392ee9396dc2a7 app/api/exportar/route.ts
100644 0aa3a525b99939e81777ab96654037e3c1f04841 app/api/links/route.ts
100644 9516a379fb5f1a299e1648d21db38c352688f709 app/api/lixeira/route.ts
100644 34766422d7652d6f3d1a09a4440e581982743ef6 app/api/modelos/route.ts
100644 3cf931a5679ceeea68cda8cb444f022fcb99714b app/api/notas/route.ts
100644 e17331e21f1b39f6e9e7cd35711eddc5fa87d036 app/api/pessoas/route.ts
100644 636c77351b2310321b6a1158098fd204686d933a app/api/tarefas/[id]/route.ts
100644 598b5c2091632d1bd12a4be1e754a3679a247c67 app/api/times/route.ts
100644 a233b18d50d27781032f454a6626c1fd1fa38903 app/busca/page.tsx
100644 b0ca933caaf46cdaa0ab8582a21849418fe4385d app/categorias/[id]/page.tsx
100644 7b8f5569a82946d87d6a48ae9dacc63e503fc9d7 app/categorias/page.tsx
100644 ae14b4b3c5b2215a75149d42ce17dff2bde82cb4 app/configuracoes/page.tsx
100644 766f6336b377866db5117a0d8a4cf1d750e0bdec app/diario/page.tsx
100644 24045c4575a357625226d20f5f0ca3e34eb5085b app/globals.css
100644 314684907ed8f33fd74039c3a2d62805b56ad974 app/icon.svg
100644 8432111675d171a9084049a3d2aeb8cbf8ef4cb2 app/layout.tsx
100644 c078db56fb9807b61a5bfa05e41d3b4673313d15 app/links/page.tsx
100644 0d402fdde973d79361413b1b7e7ac454b0f305d1 app/manifest.ts
100644 c36d78c99cc5fba2dcdaef0fc9f4d4bef91040c0 app/notas/page.tsx
100644 fa54adc1b49e8f9e99701bd9891d7f991c177b97 app/page.tsx
100644 5978a2c002d6a37d9987b96b201eea8dda728cad app/pendencias/page.tsx
100644 0a6f76ffa109f0bf97eeda85e55aba30f0a63d1e app/pessoas/page.tsx
100644 33ad978221a95d76367fe1862ded93c8ef8514ac app/relatorios/page.tsx
100644 ca5daa3a78f3349c37e13f18c88fb8c6dd79a715 app/revisao/page.tsx
100644 3496ed0b0b94bdb7ed10670f1f559b73de4a0e97 app/tarefas/[id]/page.tsx
100644 ddc3325edbbe3e2c024fd7ddbda048a91048af85 app/tarefas/page.tsx
100644 f580316fc46d384d0219ffa08ad4e6773e251b64 app/template.tsx
100644 de75a0b4bb49f3e74eceaeb4db039a6fcb1aef67 components.json
100644 f785e9017c940c3135204a43cb8596f5fcb08d4b components/CardTarefa.tsx
100644 c8345f8321be3bd5036840aa64e489960d7a9129 components/CategoriaForm.tsx
100644 9feacd31601ce2997f141cf19973725288cc672e components/Esperando.tsx
100644 93a0b6f3fbf90d955dbf754c70406d5ffb33d7f1 components/LinkForm.tsx
100644 844ee1e59c19be9c269a7fe87b232082e17f5b13 components/MenuTarefa.tsx
100644 58f243e14967a93d60d48214696e830b0b5aef4a components/Modelos.tsx
100644 a4b1fe376b0a80ef4fa010a25900b0b73849556b components/MoverEJuntar.tsx
100644 45cc0682abc77b0c3c8ed8fe1fed7ad9d7b46e20 components/PromptModal.tsx
100644 e1666c8ac78029d935a47957f86cc6e74539004a components/Provider.tsx
100644 0787a476e3beaa1cdf5bc2868ea0248119f8de26 components/Raiz.tsx
100644 0372a441f28c9b1ee2e4685c4f5bc28b093a27e1 components/RegistroEditor.tsx
100644 cdd016c86e1ba1c3ff11634278d02dfeeeb63bc4 components/Shell.tsx
100644 6954358f1c431cd15c370d660728e9903ec12937 components/TarefaForm.tsx
100644 853b57ea933d3108e61b2f0a42b3d35c2dd88083 components/busca/CampoBusca.tsx
100644 057d16d862d907a36f53fc2ad3b9844d01024f41 components/categorias/CartaoCategoria.tsx
100644 b90efb4a33ad6983da8fb39689e56d942006ee4e components/categorias/EmblemaCategoria.tsx
100644 a72a024898c1af98cfa1cd57bac3148cc8e39e4c components/categorias/acoes.ts
100644 bab85dc6d22acf0ed2e19d1de0071593f9f794f9 components/comum.tsx
100644 5e3a4dec67469a25adfc2e5a5e76fd83a921a932 components/configuracoes/dados.tsx
100644 df552432a06821b18b7d3e1c9666602e6a055bb2 components/configuracoes/preferencias.tsx
100644 69db6a5fc60b21a995ba635124563240de2758c2 components/editor/EditorRico.tsx
100644 34e7d0d23458e99d4f1d50c473f9a344508f595f components/editor/extensoes.ts
100644 dc018253621ff69b6f743c5e0f08db620cb18c0c components/hoje/CapturaRapida.tsx
100644 464e69db407309fb2105f5c3743b735cf115bde2 components/hoje/FocoHoje.tsx
100644 25af189a7fa0cfe6d1613797ff56bed0a3350ff6 components/hoje/Laterais.tsx
100644 e4999bef3484da8ce206e344fd550553ec446b15 components/hoje/PrecisaDeVoce.tsx
100644 4b18f410fdc31b0f0f2928f4144d6c0e3b8f917b components/hoje/Semana.tsx
100644 d57d2d224f43608de1b587fb6e929b21ccaa5f88 components/hoje/apoio.tsx
100644 a9219bb38a12a80d304c651252e431b0c3a8355d components/links/IconeLink.tsx
100644 feadbe5869e6af57f08e055f78f829ca0fbc4dbf components/notas/EditorNota.tsx
100644 9a5b3f47d4b2b34fdaf381f488bb5c8a918f2c36 components/notas/OrganizarNota.tsx
100644 d261a3a3a1a014205a9e847fb9abf36c726b9cad components/pendencias/GrupoPendencias.tsx
100644 798c83b1a52d209d314cd7d05eeea75b57359871 components/pendencias/Lateral.tsx
100644 3d0f299cf274296e2e708d5e16c0bdbb546382d2 components/pendencias/LinhaPendencia.tsx
100644 8b023388312205ea1f290c078363b215942eab9c components/pendencias/agrupar.ts
100644 f912a52089455563b1b6ecf1ce182a9758aa4b8e components/pessoas/AbasPessoas.tsx
100644 fe0d5cd354f0764a8296c5af93efbace16ab69b0 components/pessoas/DetalhePessoa.tsx
100644 61ec36b8cdd6a64469ee080b29524dee88069acb components/pessoas/DetalheTime.tsx
100644 b6cf49d2128049b536d96b55a3c27b73382af0a9 components/pessoas/ImportarPessoas.tsx
100644 ef5305285d6ae661b6d2731c9b80b1c1f9dd249c components/pessoas/ListaPassos.tsx
100644 ba3de9ef3f3b2409ffe26d03e6e3309600c7254f components/pessoas/ListaPessoas.tsx
100644 d235269f4403a3527fcb1070d546bbd76fb40be4 components/pessoas/ListaTimes.tsx
100644 ab7f541f31a7149aa9aaf4d875e8ae7dbf37813c components/pessoas/PessoaForm.tsx
100644 222f026fea659322823fd3f3e5591ffd5c85eb6f components/pessoas/SeletorCor.tsx
100644 d2920752586b91aafb5c814d59191fe4c71be8d7 components/pessoas/SeletorMultiplo.tsx
100644 6d7bba034ce0c2aaeee26e8681a0665204680a9a components/pessoas/TimeForm.tsx
100644 7eb0da2345d3d96abbe274f5a4d83ae8915a3692 components/pessoas/dados.ts
100644 c8017bd782f5fcc2512877edb9c1b4a64597e92e components/pessoas/pecas.tsx
100644 67549f7e03f8722388a5f52623bab9de213bbf5d components/revisao/CartaoRevisao.tsx
100644 a29b3df7cbb5ee1c55f9812c566ee397b91d52d4 components/revisao/retrato.ts
100644 1addde19c305d86f4acfdeffe2f239376c955c87 components/rotina/EtapaAtras.tsx
100644 76c572d515da9726b3205b30f8a6be5e32b76738 components/rotina/EtapaFocos.tsx
100644 a3f19a064f0056632069b3b6a35949da9ff2a370 components/rotina/EtapaPronto.tsx
100644 9d31d582d6273f999010d82d9eacd89533bc531c components/rotina/PlanejarDia.tsx
100644 d1da5a15fd085f70f353ac77869053e3cb62a83e components/rotina/pecas.tsx
100644 5a7c2d3298bea40c252f37252107cd7553943e5c components/shell/Aparencia.tsx
100644 8042fc6bc6dfc2ff5cf032b491c4527b82ad26f4 components/shell/BarraSuperior.tsx
100644 03be4f620af429ca28a6d846f726f852fc0d5c11 components/shell/Ferramentas.tsx
100644 cbcc71ece2ffa2ef41882381f5b861ae1669ca18 components/shell/Lateral.tsx
100644 7326a3992d41da49bb4cc174b173eed1c876307f components/shell/Logo.tsx
100644 911a610846e7542e977b4d8cfbd1117d379ff7c5 components/shell/Paleta.tsx
100644 a84821730d6ecabab4855bf7ea44ffc2ea119235 components/shell/Personalizar.tsx
100644 dd6e798924c93efcdbb25d955745040f10643752 components/shell/SessaoFoco.tsx
100644 7b38e452da7b8e8fc3028fd71be8647be33e20a1 components/shell/Sino.tsx
100644 26e91d62ec8976b7f09c4a69af50c71b6b6cc5ea components/shell/Telas.tsx
100644 1d679b1ee6487b262c78f52d6afa0b76b839a8a1 components/shell/navegacao.ts
100644 ef82c53884453c0a48d07c61b7b92bde09cac876 components/shell/paleta/navegacao.ts
100644 7cfa09aaec734e68f2c40341f9b7fead357c191b components/shell/paleta/pecas.tsx
100644 35ae516a607c56448e2c22ef76bf84e4ab41f2fd components/tarefa/Copilot.tsx
100644 0ea1894466a67707471b687263ca797ab117021c components/tarefa/Lateral.tsx
100644 3b24ed2ecf5cc3cd0ac3fbbb33bbd8f573a99f50 components/tarefa/Passos.tsx
100644 14edc8cfce4184300ff01c60ac23b2a5efbada02 components/tarefa/Propriedades.tsx
100644 6886108f94a6b473c56a4d2d33a85ea7796736c9 components/tarefa/Texto.tsx
100644 215ffffc561a0c888368fb1aff4f965ae448a81b components/tarefa/Timeline.tsx
100644 a2736feee9dce3e7ff528b2bcd3b874c94eeea2c components/tarefas/ComboCategoria.tsx
100644 4c8693d152af772357b14e9b2ceff447be8c7985 components/tarefas/ListaTarefas.tsx
100644 50b3b0fa587f44ac9a71ec464ff94323c0307c37 components/tarefas/QuadroTarefas.tsx
100644 56bdfeaa5f6c8a2fbbfef3d404e7590c23bce280 components/tarefas/filtros.ts
100644 f0de1471553d015ef78f5ed8ab6e64a4f2a129fb components/ui/button.tsx
100644 973c46e9ab8f9e9cd5a2a8b9749ec186b65447fb components/ui/chips.tsx
100644 6fb2f2baa557830ede102a03dc466b00ab5db5a4 components/ui/command.tsx
100644 5636283a288d4814a4c8a86761adbefbeb35b36a components/ui/controles.tsx
100644 704cc6687574986704fb8f668158b68fc02db256 components/ui/data.tsx
100644 bebf61c9dd97e0547bc23dbfc638fb4470120dfe components/ui/dialog.tsx
100644 c3206ca6a9c30c6ee616ac5d2fb242f932e45bad components/ui/diversos.tsx
100644 f64c41ae7aea917f2ed251ea026bdbdb194448f8 components/ui/input.tsx
100644 6d90a099ff8e9f00d6884c17f663444022900ba1 components/ui/menu.tsx
100644 9eb2e21ee8fd73cca539db959dee0e35a336ba38 components/ui/popover.tsx
100644 51214c2655f5397adeffa78f66daaea73438b08e components/ui/select.tsx
100644 7c74bc378088e2976702b69195074adcd069d8d3 components/useHoje.ts
100644 4394aaa6e3f005eee4789f769d5f150de89424a3 components/useLembretes.ts
100644 f81ee09708c3ed0240b10ab2879315ea6cdafdee lib/acoes.ts
100644 3198e421c5ca7157371f58d197959a2d2849ce76 lib/animacoes.ts
100644 354f6f3a5bb45d10cd9b0d01b349831eef7e0ab8 lib/aparencia.ts
100644 9199179c788376bd41d4cc1a731dff078a5e2a94 lib/armazenamento.ts
100644 1db3dbeed0f90f7275a6b4fa037e8ecf72b16431 lib/diario.ts
100644 6b412141314e6c1223cc37b74d5561ec3c39c111 lib/espera.ts
100644 55a06342e9e7d3114c28c6d867021ce961b243ba lib/importar-pessoas.ts
100644 564f313d0241eb13e5ac6155ff6fe3cef6b499c7 lib/lembretes.ts
100644 682c03255c7b67e1de8f258534562b409ba1fc94 lib/markdown.ts
100644 306cd900e20302ac2c5761ec3b0b65ebdd9a59bb lib/migracoes.ts
100644 ca8388332320142b1d58c3c73111eac9ec73893d lib/modelos.ts
100644 18106386afe95a2231740867955fb2810fd9e784 lib/moldura.ts
100644 711395759ece28813433ac8001617d751b6a7bb0 lib/notas.ts
100644 dcd751bb9a402f99fd908b362912017426ff0b1e lib/pessoas.ts
100644 9dfb2919c6cb1c57c97be4938cd4b4bf23064949 lib/preferencias.ts
100644 db485223210bfa66aa2f5c7af32ac1df24f232f3 lib/prompts.ts
100644 0f221358f01a62d201e110ce5aca68acf7c155e9 lib/rascunhos.ts
100644 1e547873db8208dc03cb56acf363e9941c5c35fd lib/resposta.ts
100644 16e4cce4c12f7879eb0e43a0ba484d8c071a9a21 lib/tema.ts
100644 be8535a41e40b6b6941d99ca7651df13b9257110 lib/texto-rico.ts
100644 68bcbf33ba16688e48217b2a9f55f8f69909259f lib/tipos.ts
100644 3aa5c8f254234a99b83208ea53bcae526954d3e5 lib/utils.ts
100644 47b9f102f4b8b34b862fa295f5108806e1198d79 next.config.ts
100644 2c9c109d7de5e149c41b5aa9c50debf07815ab44 package-lock.json
100644 59fdab65010a452c4b09e3e9785b94a08d4402d9 package.json
100644 61e36849cf7cfa9f1f71b4a3964a4953e3e243d3 postcss.config.mjs
100644 ff217c0e0a103de9951a58cdc113c13f3dd18df8 proxy.ts
100755 - scripts/baixar-nexo.sh
100755 b248bddf0ce318579f048d93b148d56418632320 scripts/gerar-scripts-de-copia.sh
100644 68a98f7f69c9e9628299ea390a20f053130edc45 scripts/instalar-nexo.ps1
100755 - scripts/nexo-offline.sh
100644 d0d6dc7c92904fc8aec47e39a9738ddb32d1085e testes/aparencia.test.mjs
100644 f0b437e9da7762b35e9ce076e6977a8f2e792094 testes/api.sh
100644 05bf34712725bf7eba2b3b3fefeecb81e0425721 testes/diario.test.mjs
100644 0f5970b4d95bfd857243da90f5e1d875b63b6be0 testes/e2e.cjs
100644 a079f6e3c2e9210f815adc6405621809265f1f91 testes/notas.test.mjs
100644 01ad3d1d401e114e651ce756995c206a6d42233b testes/pessoas.test.mjs
100644 e8229c99683381a865c81bc426f119f327ae42c3 testes/semear.mjs
100644 1ea4978ec712d4790faadc20fde1ecd0e2c0e2a1 testes/texto-rico.test.mjs
100644 1a0ca4a34fe96c15554af6446dbe6aca722fa8c7 tsconfig.json
MANIFESTO
}
# <<< MANIFESTO

main
