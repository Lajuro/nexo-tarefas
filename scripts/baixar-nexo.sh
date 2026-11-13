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
MANIFEST_COMMIT="2173a37"
manifest() {
  cat <<'MANIFESTO'
100644 93e976eb627abb713950f1412bb566bf1302ce52 .github/workflows/scripts-de-copia.yml
100644 c3138d29f7fbb27099a70e1d0b08dbacf5a3ea25 .gitignore
100644 cf5343bc72d992d83098f8deabf8f3a005b85019 AGENTS.md
100644 a3956e75a7eb876f829596f3471f06fd76fc6111 CLAUDE.md
100644 c8e208f1f27f1045381a6cb7ee047bea044c7bf7 Iniciar Nexo.cmd
100644 8d01aa33852947b9f0f40944453441569031ce93 README.md
100644 8e355462a183535d349b80f580493cfcb187032b app/api/arquivos/route.ts
100644 b19a971d9b52424cb50c5eccb24d40eac71d0051 app/api/backup/route.ts
100644 c28578efe9be7694957478263f3c8a387e3a3bbb app/api/categorias/route.ts
100644 dc390bd3abe6e2d536f0b519dad280099d9fc9ac app/api/config/route.ts
100644 3ae2cf010e2f4fc81dc8ab47d43d85d44a81ca46 app/api/dados/route.ts
100644 b46621e477758df584374185b49985124466a3f6 app/api/estado/route.ts
100644 a107bb9bedd857f1f989405d51392ee9396dc2a7 app/api/exportar/route.ts
100644 0aa3a525b99939e81777ab96654037e3c1f04841 app/api/links/route.ts
100644 9516a379fb5f1a299e1648d21db38c352688f709 app/api/lixeira/route.ts
100644 e17331e21f1b39f6e9e7cd35711eddc5fa87d036 app/api/pessoas/route.ts
100644 636c77351b2310321b6a1158098fd204686d933a app/api/tarefas/[id]/route.ts
100644 598b5c2091632d1bd12a4be1e754a3679a247c67 app/api/times/route.ts
100644 77436b98da0cd174313abe3a34b4014defe49216 app/busca/page.tsx
100644 aa75b7a7b4000af968e0dac0f06872bea9a81870 app/categorias/[id]/page.tsx
100644 7b8f5569a82946d87d6a48ae9dacc63e503fc9d7 app/categorias/page.tsx
100644 287dfb560eed7c24bfa22fc11d7ea5be879c00ba app/configuracoes/page.tsx
100644 186e1f6db47a3f02e7782eba1902c84b5871ded1 app/globals.css
100644 314684907ed8f33fd74039c3a2d62805b56ad974 app/icon.svg
100644 4b233817e1c9061f1c34b452d257172397e3d052 app/layout.tsx
100644 c078db56fb9807b61a5bfa05e41d3b4673313d15 app/links/page.tsx
100644 0d402fdde973d79361413b1b7e7ac454b0f305d1 app/manifest.ts
100644 fa54adc1b49e8f9e99701bd9891d7f991c177b97 app/page.tsx
100644 5978a2c002d6a37d9987b96b201eea8dda728cad app/pendencias/page.tsx
100644 0a6f76ffa109f0bf97eeda85e55aba30f0a63d1e app/pessoas/page.tsx
100644 64119c209adfa1cf14576df9bae5c6d834dd0689 app/relatorios/page.tsx
100644 ca5daa3a78f3349c37e13f18c88fb8c6dd79a715 app/revisao/page.tsx
100644 6a584b2258548380ffd8762c807370ccca478ea7 app/tarefas/[id]/page.tsx
100644 ddc3325edbbe3e2c024fd7ddbda048a91048af85 app/tarefas/page.tsx
100644 de75a0b4bb49f3e74eceaeb4db039a6fcb1aef67 components.json
100644 f785e9017c940c3135204a43cb8596f5fcb08d4b components/CardTarefa.tsx
100644 c8345f8321be3bd5036840aa64e489960d7a9129 components/CategoriaForm.tsx
100644 93a0b6f3fbf90d955dbf754c70406d5ffb33d7f1 components/LinkForm.tsx
100644 14a00edc715f600ab1c8f772351f9b8b7c6142f9 components/MenuTarefa.tsx
100644 45cc0682abc77b0c3c8ed8fe1fed7ad9d7b46e20 components/PromptModal.tsx
100644 7492fa34ef3ddd9b686f9d568056531744a916f0 components/Provider.tsx
100644 55ab790a3587bfcda534123dc4e5c34f31a34bea components/Raiz.tsx
100644 5007343501fcb51c0fd6f872114149341f53e9d4 components/RegistroEditor.tsx
100644 32bda50eac729dd84ab669615503a196f8c2af59 components/Shell.tsx
100644 50a53c0af3e3d0734245214b9c2aa55f960d3730 components/TarefaForm.tsx
100644 853b57ea933d3108e61b2f0a42b3d35c2dd88083 components/busca/CampoBusca.tsx
100644 057d16d862d907a36f53fc2ad3b9844d01024f41 components/categorias/CartaoCategoria.tsx
100644 b90efb4a33ad6983da8fb39689e56d942006ee4e components/categorias/EmblemaCategoria.tsx
100644 a72a024898c1af98cfa1cd57bac3148cc8e39e4c components/categorias/acoes.ts
100644 01617ff0498359b9928b464e206a653b79b09656 components/comum.tsx
100644 5e3a4dec67469a25adfc2e5a5e76fd83a921a932 components/configuracoes/dados.tsx
100644 8c5aca79ace65346f1801a6578625158199004f5 components/configuracoes/preferencias.tsx
100644 cbbcb1c71e98a9f8feb086d850cac5ae839fe606 components/hoje/CapturaRapida.tsx
100644 464e69db407309fb2105f5c3743b735cf115bde2 components/hoje/FocoHoje.tsx
100644 cc1c1a01f0875dd8062c6a62e13f64421bbc7224 components/hoje/Laterais.tsx
100644 e4999bef3484da8ce206e344fd550553ec446b15 components/hoje/PrecisaDeVoce.tsx
100644 4b18f410fdc31b0f0f2928f4144d6c0e3b8f917b components/hoje/Semana.tsx
100644 d57d2d224f43608de1b587fb6e929b21ccaa5f88 components/hoje/apoio.tsx
100644 a9219bb38a12a80d304c651252e431b0c3a8355d components/links/IconeLink.tsx
100644 d261a3a3a1a014205a9e847fb9abf36c726b9cad components/pendencias/GrupoPendencias.tsx
100644 798c83b1a52d209d314cd7d05eeea75b57359871 components/pendencias/Lateral.tsx
100644 3d0f299cf274296e2e708d5e16c0bdbb546382d2 components/pendencias/LinhaPendencia.tsx
100644 8b023388312205ea1f290c078363b215942eab9c components/pendencias/agrupar.ts
100644 f912a52089455563b1b6ecf1ce182a9758aa4b8e components/pessoas/AbasPessoas.tsx
100644 3a0ebf5525ba046adca4ad47bbcb91a276323b6d components/pessoas/DetalhePessoa.tsx
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
100644 d51a89f22ce932f4002b3c54c4f331e535f8c750 components/revisao/CartaoRevisao.tsx
100644 a29b3df7cbb5ee1c55f9812c566ee397b91d52d4 components/revisao/retrato.ts
100644 1addde19c305d86f4acfdeffe2f239376c955c87 components/rotina/EtapaAtras.tsx
100644 76c572d515da9726b3205b30f8a6be5e32b76738 components/rotina/EtapaFocos.tsx
100644 a3f19a064f0056632069b3b6a35949da9ff2a370 components/rotina/EtapaPronto.tsx
100644 9d31d582d6273f999010d82d9eacd89533bc531c components/rotina/PlanejarDia.tsx
100644 d1da5a15fd085f70f353ac77869053e3cb62a83e components/rotina/pecas.tsx
100644 d6e4db24b70ba425079049c40f2c1e26d6d76ed1 components/shell/Lateral.tsx
100644 ad1cbceb29c2c2217736fcad8c10c01ac4fd2228 components/shell/Logo.tsx
100644 e55f466a377a38e5ffd42e5f3a0b70c4da81ae55 components/shell/Paleta.tsx
100644 7b38e452da7b8e8fc3028fd71be8647be33e20a1 components/shell/Sino.tsx
100644 26e91d62ec8976b7f09c4a69af50c71b6b6cc5ea components/shell/Telas.tsx
100644 d2015c5ab7f96f73034c9f902ca1ee462a7873d1 components/shell/navegacao.ts
100644 ef82c53884453c0a48d07c61b7b92bde09cac876 components/shell/paleta/navegacao.ts
100644 7cfa09aaec734e68f2c40341f9b7fead357c191b components/shell/paleta/pecas.tsx
100644 35ae516a607c56448e2c22ef76bf84e4ab41f2fd components/tarefa/Copilot.tsx
100644 f55d8e9988d90001bc14529099d2f97a663b3390 components/tarefa/Lateral.tsx
100644 3b24ed2ecf5cc3cd0ac3fbbb33bbd8f573a99f50 components/tarefa/Passos.tsx
100644 14edc8cfce4184300ff01c60ac23b2a5efbada02 components/tarefa/Propriedades.tsx
100644 4956e982b70153962aec7bd1e484cbcb884171d6 components/tarefa/Texto.tsx
100644 679e2bcc1967b0ca26f6282c17832638802b12bb components/tarefa/Timeline.tsx
100644 a2736feee9dce3e7ff528b2bcd3b874c94eeea2c components/tarefas/ComboCategoria.tsx
100644 4c8693d152af772357b14e9b2ceff447be8c7985 components/tarefas/ListaTarefas.tsx
100644 50b3b0fa587f44ac9a71ec464ff94323c0307c37 components/tarefas/QuadroTarefas.tsx
100644 56bdfeaa5f6c8a2fbbfef3d404e7590c23bce280 components/tarefas/filtros.ts
100644 f0de1471553d015ef78f5ed8ab6e64a4f2a129fb components/ui/button.tsx
100644 973c46e9ab8f9e9cd5a2a8b9749ec186b65447fb components/ui/chips.tsx
100644 6fb2f2baa557830ede102a03dc466b00ab5db5a4 components/ui/command.tsx
100644 5636283a288d4814a4c8a86761adbefbeb35b36a components/ui/controles.tsx
100644 704cc6687574986704fb8f668158b68fc02db256 components/ui/data.tsx
100644 7e5be2587fa149d56eb17b01030cc14c3ea55766 components/ui/dialog.tsx
100644 c3206ca6a9c30c6ee616ac5d2fb242f932e45bad components/ui/diversos.tsx
100644 f64c41ae7aea917f2ed251ea026bdbdb194448f8 components/ui/input.tsx
100644 6d90a099ff8e9f00d6884c17f663444022900ba1 components/ui/menu.tsx
100644 9eb2e21ee8fd73cca539db959dee0e35a336ba38 components/ui/popover.tsx
100644 51214c2655f5397adeffa78f66daaea73438b08e components/ui/select.tsx
100644 7c74bc378088e2976702b69195074adcd069d8d3 components/useHoje.ts
100644 4394aaa6e3f005eee4789f769d5f150de89424a3 components/useLembretes.ts
100644 d1b1dc05aee43290461a30e33e8f91762a9e616a lib/acoes.ts
100644 3198e421c5ca7157371f58d197959a2d2849ce76 lib/animacoes.ts
100644 1813aac061be8da8e20209ed23e8df1aefdc57bf lib/armazenamento.ts
100644 55a06342e9e7d3114c28c6d867021ce961b243ba lib/importar-pessoas.ts
100644 8df00e7c7a9d478b808618305057f014f43cefd4 lib/lembretes.ts
100644 f04ec7f2c66b4be82cc1bd1dfcda19beeb4bfbba lib/markdown.ts
100644 306cd900e20302ac2c5761ec3b0b65ebdd9a59bb lib/migracoes.ts
100644 dcd751bb9a402f99fd908b362912017426ff0b1e lib/pessoas.ts
100644 246009cfbac2816f3b967d13bde470a46dd18ffa lib/preferencias.ts
100644 82abb58521d35b7d8eb3284ba1f4256846d4b11c lib/prompts.ts
100644 d5de2f346661d8c4ceb7ec704c9db14a1809b97c lib/rascunhos.ts
100644 1e547873db8208dc03cb56acf363e9941c5c35fd lib/resposta.ts
100644 16e4cce4c12f7879eb0e43a0ba484d8c071a9a21 lib/tema.ts
100644 f2246db4cd974921435129d7ea79dd0fa8a0f3db lib/tipos.ts
100644 3aa5c8f254234a99b83208ea53bcae526954d3e5 lib/utils.ts
100644 47b9f102f4b8b34b862fa295f5108806e1198d79 next.config.ts
100644 9597f2c5e5b4e1dc113759db33b19bc9d23daa34 package-lock.json
100644 8b2757d894ee27554247a852a5e23a72f35d6966 package.json
100644 61e36849cf7cfa9f1f71b4a3964a4953e3e243d3 postcss.config.mjs
100644 ff217c0e0a103de9951a58cdc113c13f3dd18df8 proxy.ts
100755 - scripts/baixar-nexo.sh
100755 b248bddf0ce318579f048d93b148d56418632320 scripts/gerar-scripts-de-copia.sh
100644 68a98f7f69c9e9628299ea390a20f053130edc45 scripts/instalar-nexo.ps1
100755 - scripts/nexo-offline.sh
100644 d6d4f1ef1e5ff3afe7e776f4372458c52b4b45db testes/api.sh
100644 6a19b81baa02e365ed7fd2166329850493c8447f testes/e2e.cjs
100644 01ad3d1d401e114e651ce756995c206a6d42233b testes/pessoas.test.mjs
100644 6f822ba77ec626f837f431a0b7a18f82272ae0d7 testes/semear.mjs
100644 1a0ca4a34fe96c15554af6446dbe6aca722fa8c7 tsconfig.json
MANIFESTO
}
# <<< MANIFESTO

main
