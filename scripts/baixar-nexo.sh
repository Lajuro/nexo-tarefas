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
MANIFEST_COMMIT="2bcbe29"
manifest() {
  cat <<'MANIFESTO'
100644 93e976eb627abb713950f1412bb566bf1302ce52 .github/workflows/scripts-de-copia.yml
100644 c3138d29f7fbb27099a70e1d0b08dbacf5a3ea25 .gitignore
100644 58dd6cb7c4b6e912caea0cf5130b3a1b19728afb AGENTS.md
100644 a3956e75a7eb876f829596f3471f06fd76fc6111 CLAUDE.md
100644 c8e208f1f27f1045381a6cb7ee047bea044c7bf7 Iniciar Nexo.cmd
100644 73299324983a43baf00e787ea5de02150986b09d README.md
100644 fc821067e49f9f1917f59d7d5e1d68acb14a9308 app/api/arquivos/route.ts
100644 4ff6063b6877106221de3fccfdf6bbf0b8c86e17 app/api/assuntos/route.ts
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
100644 a8b84873f269149c8d9b3e64427f093cf2f472b2 app/api/tarefas/[id]/route.ts
100644 598b5c2091632d1bd12a4be1e754a3679a247c67 app/api/times/route.ts
100644 941f483574db493e236276c8643bfba6ed48dd81 app/api/transcricoes/route.ts
100644 442c39f1efe7b775ef67ecf703154f6d07091cbb app/api/verificar/route.ts
100644 f7ddd45767e3969b29c67b90125eb0d79d24ca9d app/busca/page.tsx
100644 b7e40d307e33dca8fb755b2b6c4c238f74eea829 app/categorias/[id]/page.tsx
100644 4649c1cc859b94ceade84984d56befd9e06e122e app/categorias/page.tsx
100644 0be5c2433d1aacccee092db7852ad66e4809fb5c app/configuracoes/page.tsx
100644 3296de2089fb3f7952f6d4ce8180c2c1c35c52a0 app/conquistas/page.tsx
100644 882f991953d6a13c6d28952cd8c5929316718f0f app/diario/page.tsx
100644 9179c1f73af203fe08ed32758df6c36009116259 app/globals.css
100644 314684907ed8f33fd74039c3a2d62805b56ad974 app/icon.svg
100644 8432111675d171a9084049a3d2aeb8cbf8ef4cb2 app/layout.tsx
100644 ea0ed98bc71474bf3f9af0526c656472e9bd3838 app/links/page.tsx
100644 0d402fdde973d79361413b1b7e7ac454b0f305d1 app/manifest.ts
100644 aae490d97895bd4dd9f6eb56b1d33a409992dd8f app/notas/page.tsx
100644 c72b5dc2c341bca5b9feb56ec13d79733a052909 app/page.tsx
100644 fa1faa2e193236bf4bc66d699356959850af50b1 app/paginas/page.tsx
100644 e467626eadf25e15385a7a6455b0fc01b31e4cbe app/pendencias/page.tsx
100644 481eaac66e5ec7ed26c2acbcf370534372ce6cdd app/perguntar/page.tsx
100644 0a6f76ffa109f0bf97eeda85e55aba30f0a63d1e app/pessoas/page.tsx
100644 fa452df5e71fb46d0d4b5660e024af0266730ae7 app/radar/page.tsx
100644 f0032e43d30e5be4bb0e5aed9e35772b9ba8e99f app/relatorios/page.tsx
100644 8f2dddef9bd826a95c5dd02a5b7f68f0624f8253 app/revisao/page.tsx
100644 80861d021ef33cfb3452f16d5badc730641a07b2 app/rotina/page.tsx
100644 49a9275772f8b4d9b52a628433de71d4112dc7c7 app/tarefas/[id]/page.tsx
100644 3b08199c51f22df1c2ecdce3469b3f55b74165a4 app/tarefas/[id]/reuniao/page.tsx
100644 492ad131935de58c05b9478c1f3519318ee94b24 app/tarefas/page.tsx
100644 f580316fc46d384d0219ffa08ad4e6773e251b64 app/template.tsx
100644 de75a0b4bb49f3e74eceaeb4db039a6fcb1aef67 components.json
100644 69133b1a2e75ff56e85dc46fef5417ad9d438b91 components/Assuntos.tsx
100644 1eef4d8a5b3e9b04c5938d8d03375c168e45a55b components/AvisosDoSistema.tsx
100644 c4ea4dbbc9d377e10f7a9814012e4dc2e70bfd88 components/CardTarefa.tsx
100644 b914e55c7164e9eb02d97e92c11215f630f4f2a8 components/CategoriaForm.tsx
100644 c16c63f5dc6b58707e456b3ba7e3a0342bc9879a components/Citacoes.tsx
100644 8d1998e2d9853346bc5ecddfde317fc0de732f52 components/Esperando.tsx
100644 494d80ed7dce5cd827d2fd775e9b0d230bdd5631 components/Impressao.tsx
100644 146db159f63cf73861f5385e2854f5ba87946b9d components/LinkForm.tsx
100644 21d112e8cdb8bf99f2caae786434a9ceb23545bb components/MenuTarefa.tsx
100644 b886225ad9a9c7fe7184584216ec7dc742f8bbb5 components/Modelos.tsx
100644 092cae0aca9972d1f09358553934aff1219f1371 components/MoverEJuntar.tsx
100644 491a00b86fd4b40d588c1f8aec15917ff85960f3 components/PromptModal.tsx
100644 8928b2b2c5034eea15733647fba6fc7f61d02941 components/Provider.tsx
100644 0787a476e3beaa1cdf5bc2868ea0248119f8de26 components/Raiz.tsx
100644 705f8e28b4200ebda687736be1b0c92db93164ff components/RegistroEditor.tsx
100644 3bc579f3ae61768d3092f89a8b10f1290fb9ba05 components/Shell.tsx
100644 6193d3b42a0bd8b18717be93733be5391ec34ad2 components/TarefaForm.tsx
100644 e6044d9baf7976d2094a43dc0fabb9882e0b91ac components/VisorDeArquivo.tsx
100644 8856b60234ee8cda275a624f7423fcfd565584b9 components/VisorDeImagem.tsx
100644 853b57ea933d3108e61b2f0a42b3d35c2dd88083 components/busca/CampoBusca.tsx
100644 8f8ed53b8168a7d70df4c1f01611b7496a5b081a components/categorias/CartaoCategoria.tsx
100644 95fee2178db26f2e1a016e464ddfa37108e7e430 components/categorias/EmblemaCategoria.tsx
100644 a72a024898c1af98cfa1cd57bac3148cc8e39e4c components/categorias/acoes.ts
100644 95f63d09a485d5902ab9848ab76bb03d396de986 components/comum.tsx
100644 375f0cf6a83a2aec4c0adeb0439e03111eae7c37 components/configuracoes/Notificacoes.tsx
100644 48184171b2e9788a586e4c1d8001a5f25b6018c6 components/configuracoes/dados.tsx
100644 77cc4bae8d082f210303c42c6577da35b96ce763 components/configuracoes/preferencias.tsx
100644 a62dbb63c88a488bf3ff68e44f4bb134762c40cc components/desfazer.ts
100644 79eec613dc9523a7d51a1adb52d67848f4db684c components/editor/EditorRico.tsx
100644 83cfbaf05d283caffd3479888d2564ffd4c611ac components/editor/extensoes.ts
100644 473dfaa730d055a4567c36842cd3b213db1ec712 components/hoje/CapturaRapida.tsx
100644 3b15eac36822a81710945fa3c79e5eef77b0a981 components/hoje/FocoHoje.tsx
100644 476ac387f9b12b0a68613a84f64445ffe04756cd components/hoje/Laterais.tsx
100644 ba2816773c9667dd073424fa043d402b1c52db76 components/hoje/PrecisaDeVoce.tsx
100644 5417d6a507129f0e74fcae0dcbaaaea05f43e56e components/hoje/Semana.tsx
100644 254cb1e7f06e65290350be9cce7dbd5cb4d33282 components/hoje/apoio.tsx
100644 14e456f7ac068a31e50caeeede52efc04806d9fe components/jogo/Celebracao.tsx
100644 5263100f087d6887cc688e1f00f379f895a04ce6 components/jogo/NivelLateral.tsx
100644 879f3671b63b60934fb7ac301415418462a6b00c components/jogo/pecas.tsx
100644 4d000eec3c5c4a608ea45bc5ce92bc640c63e525 components/jogo/useJogo.ts
100644 05fe3f4825a3864f2f91e478a9e0dd872bc328c1 components/jornada/Ferramenta.tsx
100644 69796bfff51b7e80bc11fc38af755f2b443ee54c components/jornada/Formularios.tsx
100644 32969f8d7b20d0566d049ee4f0025ae958f22fb4 components/jornada/LinhaDoDia.tsx
100644 f69afedcafd65b3c6e7747b144e60e833963f05c components/jornada/Paineis.tsx
100644 aa327e2d87c5103cad81eca182349084c630001f components/jornada/pecas.tsx
100644 160c61acd3c91e146c1aea21c8eeb440af81feb5 components/links/EstadoLink.tsx
100644 a9219bb38a12a80d304c651252e431b0c3a8355d components/links/IconeLink.tsx
100644 fb96a514ece9bb56bff669b9ee61aa0a76831e07 components/links/SeletorDeTarefas.tsx
100644 0d5bc20c4f3e65c7ea826c507b0d90682b634338 components/notas/EditorNota.tsx
100644 91f4681dbfa83ffafec1afd9d3443e5d8c081158 components/notas/OrganizarNota.tsx
100644 d780958fb2c55d3a0cbe9fb77a41babd2f900450 components/paginas/Abas.tsx
100644 111839d538ef070ed2ba5ebce708aa6a53970d4a components/paginas/EditorPagina.tsx
100644 36c49c402e65337e0133b2610fe354b96f550c41 components/paginas/Explorador.tsx
100644 f6f19a93814576da1a8041c771be5cedf4443ebe components/paginas/Historico.tsx
100644 3c4c1c902c2937d3b2801ca99c6a4c0ecd9cbb59 components/paginas/ListaPaginas.tsx
100644 08610395ce3f1089c903ddc5ea5e7986582dd3e0 components/paginas/MapaDePaginas.tsx
100644 01932358226b5d2f8ca93b295f1db3bc43c4232e components/paginas/QuadroPaginas.tsx
100644 609a7a597ec9949314fee3db3e0fee5b5711db0b components/paginas/pecas.tsx
100644 ba3cf2810ae0b69a22a0269f425ccc06880d8e5a components/paginas/video/GaleriaDeVideos.tsx
100644 3dd690dd2da8ff912173c4325d84c0dfddbdd282 components/paginas/video/Player.tsx
100644 bf26a619a56fe8e3c91281a3347bffe1c078a907 components/paginas/video/Transcricao.tsx
100644 05951b901cffb9969889b965d1c6adbf8644f59d components/paginas/video/VisaoDeVideo.tsx
100644 246a6dd12e58b8da3fd8e351625cf5c825c3a75f components/pendencias/GrupoPendencias.tsx
100644 67e3c92b0e0856e86b72168e3f2cc5b78d39ad3a components/pendencias/Lateral.tsx
100644 c49aa5e549e2ead5485a345c97660c68c49bff66 components/pendencias/LinhaPendencia.tsx
100644 8b023388312205ea1f290c078363b215942eab9c components/pendencias/agrupar.ts
100644 f912a52089455563b1b6ecf1ce182a9758aa4b8e components/pessoas/AbasPessoas.tsx
100644 8d2f522b873b69c367ca0e21e233f53affc48b07 components/pessoas/DetalhePessoa.tsx
100644 f40218529536b9ae057d977dc4f3251046f946b4 components/pessoas/DetalheTime.tsx
100644 5c76d03e481ac1985dc5840ce0b2451428ed834a components/pessoas/ImportarPessoas.tsx
100644 b7ce60251758db31459f2df68fb14a1de8736bbd components/pessoas/ListaPassos.tsx
100644 498e04bc1758e884c1dc583ead959bcaced7bf9e components/pessoas/ListaPessoas.tsx
100644 ab5595fa5c3bd71cedcf7c8c925f0ef18a9136a7 components/pessoas/ListaTimes.tsx
100644 4e71af5cb75e253456b67bae6f7e6e6e07e76f26 components/pessoas/PessoaForm.tsx
100644 222f026fea659322823fd3f3e5591ffd5c85eb6f components/pessoas/SeletorCor.tsx
100644 2526a8971728f4494913d394ec2766f27f15b5f7 components/pessoas/SeletorMultiplo.tsx
100644 d4eba18486c70f3709eed1b56d46b9ede9c4b571 components/pessoas/TimeForm.tsx
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
100644 89f3686b435be581012dbd401375c5de9e252890 components/shell/Acompanhar.tsx
100644 c45ba1c07cb7c1d693b1618b5fdd8cf5c3b0ce60 components/shell/Aparencia.tsx
100644 d621beda6b8042df49c858633caa61cfc0bcee7f components/shell/BarraSuperior.tsx
100644 5e1f8cc0bd06d81b0793d37b028bb7bdd96360ff components/shell/Ferramentas.tsx
100644 09cdbdb16bde39b3e1149209de9e1a32efea2bde components/shell/Lateral.tsx
100644 7326a3992d41da49bb4cc174b173eed1c876307f components/shell/Logo.tsx
100644 5f37cd4516f18362b4674d88315c4dea30920ad9 components/shell/Novidades.tsx
100644 0c76532f0aa84316e115b366b3b6aa72d5e098c4 components/shell/Paleta.tsx
100644 29209e9de55028ca4cf5de83ccf10fd4b6ea50a2 components/shell/Personalizar.tsx
100644 1a4ba106e98bdb7c4e9c4ee586bc8ddb38f6cc25 components/shell/SessaoFoco.tsx
100644 98ec7df435b801ec4bd2608d46babc5d09feabbf components/shell/Sino.tsx
100644 07861798e3fdb7e667535c640df1858fe8205aec components/shell/Telas.tsx
100644 5446309d929ae734fb53e85d8b4153ebe145d801 components/shell/navegacao.ts
100644 ef82c53884453c0a48d07c61b7b92bde09cac876 components/shell/paleta/navegacao.ts
100644 f3a0e7d53d9dde960025644d375a864b238461f5 components/shell/paleta/pecas.tsx
100644 9ccae0a99b72c75af2c23df60b30c207e9c94239 components/tarefa/Copilot.tsx
100644 d22c4ec40eb45a1f61761a60b0cf1bc821a5f5a2 components/tarefa/Dependencias.tsx
100644 ee6cead6cce7c3c423e7429567461a60cdc5824f components/tarefa/Lateral.tsx
100644 4b797f16d87f49eab365280f730d5ae3a689301a components/tarefa/Passos.tsx
100644 400627058997887992302bda064cf5cd6711e251 components/tarefa/Propriedades.tsx
100644 522a750d562589503249b9367ea08f5c1fffdd58 components/tarefa/Referencias.tsx
100644 7b912df8ae443aa3b1d339e5ca945f9dff1ef550 components/tarefa/Texto.tsx
100644 701d0b6b7a3a520cb947064da467945040236c5e components/tarefa/Timeline.tsx
100644 2f280ceab6867c468b2071024b010cf01fa3b859 components/tarefas/ComboCategoria.tsx
100644 240115fb75360fb54805b60e0fa46811d27962a4 components/tarefas/ListaTarefas.tsx
100644 49abe4a553c8b659ff5227414475a1bd43019ad4 components/tarefas/Lote.tsx
100644 cba8b3f57745c5864aed7b6dc4c4165f0adf6ddd components/tarefas/QuadroTarefas.tsx
100644 96e6dd24a5580655b3b8f1c02754d8554ee2a6ab components/tarefas/Visoes.tsx
100644 059efd13f30c0717f8e906931dad3dec86ee49a0 components/tarefas/filtros.ts
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
100644 3ae6167df33ca968308632f07befbdde200924d1 components/useLembretes.ts
100644 fdb00b5b919dc2417cd19dff563c7e4374bc10e1 components/useTranscricoes.ts
100644 96dd4e63cf4fd9ae887e7753eca8811d0d4670c2 components/visor/TabelaDeDados.tsx
100644 a1e00c3e92229579f8baeef7b7b1239571728175 lib/acoes.ts
100644 3198e421c5ca7157371f58d197959a2d2849ce76 lib/animacoes.ts
100644 8a3a2a65ea7dc933fee203d3bef57efcd2dab5a6 lib/aparencia.ts
100644 020b9295c9744297e1b017fcabde4b29cbdab127 lib/armazenamento.ts
100644 0aa2952e96230763319c683f4cdc4b9a196db99f lib/assuntos.ts
100644 3ee97700fa0b0589b4d2e85046baaa00134944ee lib/dependencias.ts
100644 1db3dbeed0f90f7275a6b4fa037e8ecf72b16431 lib/diario.ts
100644 52244315c7db5a1c31efd47159140270b882ebca lib/diff.ts
100644 7912868a09599124e220d1a5b731036a286a811f lib/documento.ts
100644 6b412141314e6c1223cc37b74d5561ec3c39c111 lib/espera.ts
100644 e26cc9d5d67c34fd79eb2965337b73da307bd8ca lib/fechamento.ts
100644 98b502a721913fd5ea15bbff440303b46ffd147d lib/grafo.ts
100644 55a06342e9e7d3114c28c6d867021ce961b243ba lib/importar-pessoas.ts
100644 28c74c8ec0fea550bdd9a3e3f519b7ede42b8392 lib/integridade.ts
100644 4d39f1780cd62e38fbdbf4bc6748666d656ab1d8 lib/jogo.ts
100644 21433bd1d73319262eea8775acf477bfb6a97b59 lib/jornada.ts
100644 378d22d3276143db4fd780a0a988033f68ba52c8 lib/lembretes.ts
100644 bf133d34c183ff24622468029d91aad76b93107d lib/ligacoes.ts
100644 7abba0cff2f695f3b7a45d61bc8627d2a896b1a0 lib/links.ts
100644 728bd823dd87f96d630ea5519f0294a54e3ccc5a lib/markdown.ts
100644 306cd900e20302ac2c5761ec3b0b65ebdd9a59bb lib/migracoes.ts
100644 ca8388332320142b1d58c3c73111eac9ec73893d lib/modelos.ts
100644 6049cb7e431a1d270309227fc7238b94269c6539 lib/moldura.ts
100644 711395759ece28813433ac8001617d751b6a7bb0 lib/notas.ts
100644 9f8815bb16b1243b960add84b90cdd20e782c33f lib/notificar.ts
100644 725b378d4f0694609af18569b22a4f12ac409dee lib/paginas.ts
100644 7368e4c527620ca653b19052c8b40c5fcb35f0c0 lib/perguntar.ts
100644 77b48a280bf5ffdba414a6ae393b70b54540f0bb lib/personalizacao.ts
100644 dcd751bb9a402f99fd908b362912017426ff0b1e lib/pessoas.ts
100644 71313f24d8e2fa2dcd1fd2572b10917f8fab6a82 lib/planilha.ts
100644 9dfb2919c6cb1c57c97be4938cd4b4bf23064949 lib/preferencias.ts
100644 42500b2460e8e0ec9889bb6364b64c2cf9fc778b lib/prompts.ts
100644 c8b3e28355e434927e5ddb25d8b5df21c55bc047 lib/radar.ts
100644 5516cd6fef89993e5d7fdec53a05d928c9a92a0f lib/rascunhos.ts
100644 f01c60f9ea66b8e67cdf51e7d7ad2dc1b5d9a094 lib/realce.ts
100644 010d60ac5e89115fdd7420a5eeb02f69287020eb lib/recorrencia.ts
100644 1e547873db8208dc03cb56acf363e9941c5c35fd lib/resposta.ts
100644 78692bdd4c6673dac457c92d985168f2ca971f1a lib/reuniao.ts
100644 9a5405f9b240a17e9c12168c5e5c7a0c3a71f4a1 lib/tela-hoje.ts
100644 16e4cce4c12f7879eb0e43a0ba484d8c071a9a21 lib/tema.ts
100644 7c5f00bbe9ff590baeba811147012962b182b37e lib/texto-rico.ts
100644 3b599426a7bc8f5fe7bf5c51affe1ec422df517d lib/tipos.ts
100644 a47702cb16f36e82bf8189e0f03a1f8e4f9480e4 lib/transcricao.ts
100644 3aa5c8f254234a99b83208ea53bcae526954d3e5 lib/utils.ts
100644 16d4b9ff08e2dd3aa45da29fabd98779be1553f3 lib/visor.ts
100644 729e39a1c0e3f50bc6ce07466acf875461b9a3c5 lib/zip.ts
100644 80e5a6e65db8f3b060bfe8cb3160ada357dee7ae next.config.ts
100644 f1ec1f347b38700ef020a4c0498f6cb9d23e0444 package-lock.json
100644 c1066360fccf7a750672b86df682f36c6b01e3fe package.json
100644 61e36849cf7cfa9f1f71b4a3964a4953e3e243d3 postcss.config.mjs
100644 9f1d221053f6ddb6f82346cf95faf1701cf787c0 proxy.ts
100755 - scripts/baixar-nexo.sh
100755 b248bddf0ce318579f048d93b148d56418632320 scripts/gerar-scripts-de-copia.sh
100644 68a98f7f69c9e9628299ea390a20f053130edc45 scripts/instalar-nexo.ps1
100755 - scripts/nexo-offline.sh
100644 77db78868daf724b14313636ddf1d7b1d34c9a16 testes/aparencia.test.mjs
100644 4065289e3fa1990cdd55c5c5f541ad094e4848c2 testes/api.sh
100644 61d579e9fdbf562084f57ab9ccfae03e028285c3 testes/arquivos.test.mjs
100644 b2a78363ee253bfeb06ccdcb2344248e1aa69563 testes/carga.mjs
100644 a855dfcec14616ad1656d69562094dc969d34b2f testes/dependencias.test.mjs
100644 05bf34712725bf7eba2b3b3fefeecb81e0425721 testes/diario.test.mjs
100644 f0ee6b73607ede7b5ee22cac779c1045afd0c994 testes/e2e.cjs
100644 80d928e62b422418bff733c21375b601758631e2 testes/fechamento.test.mjs
100644 6f70d7bf03caec88f4f6dda9e2d9dcfa76da08bf testes/grafo.test.mjs
100644 70b2fbfa8e3239ded8cc7f9891202b12c6ca0ba1 testes/integridade.test.mjs
100644 bc54217f5fab262dd39e402574484ffc4dd27b78 testes/jogo.test.mjs
100644 512f61a26b53a847d164b807fc37ebf5c3f89fb8 testes/jornada.test.mjs
100644 4140928f58185242566dcf95b9909bbb4e90a1ca testes/lembretes.test.mjs
100644 30dfa52ce4aef7fe06ff2e505fb0ebee51c39940 testes/ligacoes.test.mjs
100644 556da8fac0ae36f4656b9576f8115d7fa25bee79 testes/links.test.mjs
100644 a079f6e3c2e9210f815adc6405621809265f1f91 testes/notas.test.mjs
100644 419c41fa8bc7505714f4bd1029e75b5f50ee0310 testes/paginas.test.mjs
100644 3b63db8ea29aa787bf687c4eb6ecb32f277a3591 testes/perguntar.test.mjs
100644 01ad3d1d401e114e651ce756995c206a6d42233b testes/pessoas.test.mjs
100644 1aa07fa7fb3b614cfaffed84333dd597b7cca85f testes/radar.test.mjs
100644 6ad501b7f9ce531f3f0a0da8e711b264716b5dae testes/reuniao.test.mjs
100644 95406917c23578309b9f3a9362c93aa60cc4104b testes/semear.mjs
100644 1472801f1c2a693f64ba1f4b13c1c2d8ee5aa305 testes/texto-rico.test.mjs
100644 0eda418f309fd02636845b5140f2116daf623d86 testes/transcricao.test.mjs
100644 c57d6d4be14f3a81315899909c4ac1979d09a2e5 testes/versoes.test.mjs
100644 4d908bb7590f735f6888872a14e8ce49f633a353 testes/visor.test.mjs
100644 d2ebf835e7a963463c7dea56af500e2666713900 testes/zip-de-teste.mjs
100644 1a0ca4a34fe96c15554af6446dbe6aca722fa8c7 tsconfig.json
MANIFESTO
}
# <<< MANIFESTO

main
