#!/usr/bin/env bash
# shellcheck shell=bash disable=SC2154,SC2034
# =============================================================================
#  scripts/copia/offline.modelo.sh
#
#  Modelo do scripts/nexo-offline.sh. O gerador (scripts/gerar-scripts-de-copia.sh)
#  monta o instalador assim: cabeçalho e variáveis (NEXO_VERSAO, COMMIT,
#  COMMIT_DATA, CONTEUDO, SHA256, TOTAL_ARQUIVOS, TAMANHO), a parte comum
#  (scripts/copia/comum.sh), o que vem depois da linha ">>> corpo" deste
#  arquivo e, no fim, o projeto embutido em payload().
# =============================================================================
# >>> corpo

ajuda() {
  cat <<EOF

  ${C_B}nexo-offline.sh${C_0} ${C_D}· instala o Nexo $NEXO_VERSAO sem internet${C_0}

  ${C_B}Uso${C_0}
    bash nexo-offline.sh [opções] [pasta]

  O projeto inteiro vem dentro deste arquivo (commit $COMMIT de $COMMIT_DATA).
  Sem pasta, instala em ./nexo-tarefas. Se a pasta já tem o Nexo, atualiza:
  a versão atual fica guardada em <pasta>-anterior e os arquivos que saíram
  do Nexo são retirados. node_modules e o build ficam onde estão.

  ${C_B}Opções${C_0}
    -f, --force       usa a pasta mesmo que já tenha arquivos, sem perguntar
    -i, --install     roda npm install e npm run build no fim
    -y, --yes         responde "sim" a todas as perguntas
    -n, --dry-run     confere o pacote e mostra o que mudaria, sem gravar nada
    -l, --list        lista os arquivos que vêm dentro e sai
    -q, --quiet       mostra só avisos, erros e o resultado
        --no-backup   não guarda a versão atual em <pasta>-anterior
        --no-color    sem cores (também vale NO_COLOR=1)
    -v, --version     mostra a versão que vem dentro e sai
    -h, --help        mostra esta ajuda

  As letras podem ir juntas: -fi é o mesmo que -f -i.

  ${C_B}Exemplos${C_0}
    bash nexo-offline.sh                 ${C_D}# instala em ./nexo-tarefas${C_0}
    bash nexo-offline.sh -i nexo-app     ${C_D}# instala em ./nexo-app e já faz o build${C_0}
    bash nexo-offline.sh -fi nexo-app    ${C_D}# atualiza sem perguntar e faz o build${C_0}
    bash nexo-offline.sh -n nexo-app     ${C_D}# só mostra o que mudaria${C_0}

  No Windows, rode no Git Bash. Seus dados nunca ficam na pasta do app.

EOF
}

ler_opcoes() {
  normalizar_args "" "$@"
  set -- "${ARGS[@]+"${ARGS[@]}"}"
  while [ $# -gt 0 ]; do
    case "$1" in
      -f | --force | --forcar) FORCE=1 ;;
      -i | --install | --instalar) DO_INSTALL=1 ;;
      -y | --yes) ASSUME_YES=1 ;;
      -n | --dry-run) DRY_RUN=1 ;;
      -l | --list) ACAO=lista ;;
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
}

sha256_de() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$1" | sed 's/.*= *//'
  fi
}

# Tira o projeto de dentro deste arquivo para $TRABALHO/p.tgz e confere o SHA-256.
abrir_pacote() {
  local dec=() real
  if printf 'TmV4bw==' | base64 -d >/dev/null 2>&1; then
    dec=(base64 -d)
  elif printf 'TmV4bw==' | base64 -D >/dev/null 2>&1; then
    dec=(base64 -D)
  elif command -v openssl >/dev/null 2>&1; then
    dec=(openssl base64 -d -A)
  else
    falha "Preciso do base64 ou do openssl para abrir o pacote." "No Windows, rode no Git Bash: ele já traz os dois."
  fi
  payload | tr -d '\r\n ' >"$TRABALHO/p.b64"
  "${dec[@]}" <"$TRABALHO/p.b64" >"$TRABALHO/p.tgz" 2>/dev/null || pacote_estragado
  real="$(sha256_de "$TRABALHO/p.tgz")"
  if [ -z "$real" ]; then
    aviso "Sem sha256sum, shasum ou openssl: não deu para conferir a integridade."
  elif [ "$real" != "$SHA256" ]; then
    pacote_estragado
  fi
  tar -tzf "$TRABALHO/p.tgz" >/dev/null 2>&1 || pacote_estragado
}

pacote_estragado() {
  falha "O conteúdo não confere: este arquivo foi alterado ou cortado ao ser copiado." \
    "Copie de novo o nexo-offline.sh inteiro (são cerca de $TAMANHO_SCRIPT) e rode outra vez."
}

arquivos_do_pacote() { tar -tzf "$TRABALHO/p.tgz" | grep -v '/$' || true; }

main() {
  ACAO=instalar DEST="" FORCE=0 ASSUME_YES=0 DRY_RUN=0 QUIET=0 DO_INSTALL=0 NO_BACKUP=0
  ler_opcoes "$@"
  usar_cores
  case "$ACAO" in
    ajuda)
      ajuda
      exit 0
      ;;
    versao)
      printf 'Nexo %s (commit %s de %s, %s arquivos)\n' "$NEXO_VERSAO" "$COMMIT" "$COMMIT_DATA" "$TOTAL_ARQUIVOS"
      exit 0
      ;;
  esac
  command -v tar >/dev/null 2>&1 || falha "Preciso do tar instalado." "No Windows, rode no Git Bash: ele já traz o tar."
  preparar_trabalho
  if [ "$ACAO" = lista ]; then
    abrir_pacote
    arquivos_do_pacote
    exit 0
  fi
  [ -n "$DEST" ] || DEST="nexo-tarefas"

  cabecalho "Nexo $NEXO_VERSAO · instalador offline" "commit $COMMIT de $COMMIT_DATA · $TOTAL_ARQUIVOS arquivos · $TAMANHO"
  avisar_se_wsl
  analisar_destino
  conferir_pasta_de_dados
  [ "$DRY_RUN" = 1 ] || confirmar_destino "o Nexo $NEXO_VERSAO" "$CONTEUDO"

  if [ "${SO_NPM:-0}" = 1 ] && [ "$DO_INSTALL" = 0 ]; then
    diga "${C_D}Nada a fazer.${C_0}"
    exit 0
  fi

  if [ "${SO_NPM:-0}" = 0 ]; then
    passo "Conferindo o pacote"
    abrir_pacote
    ok "Pacote íntegro (SHA-256 confere)"
    mkdir -p "$TRABALHO/nexo"
    tar -xzf "$TRABALHO/p.tgz" -C "$TRABALHO/nexo" || pacote_estragado
    # o próprio instalador também faz parte do repositório
    local eu="${NEXO_LF_COPY:-$0}"
    if [ -f "$eu" ] && [ -d "$TRABALHO/nexo/scripts" ]; then
      case "$(tail -n 1 "$eu")" in
        "# fim do nexo-offline.sh"*) cp "$eu" "$TRABALHO/nexo/scripts/nexo-offline.sh" ;;
      esac
    fi
    instalar_na_pasta "$TRABALHO/nexo" "$NEXO_VERSAO" "$COMMIT" "$CONTEUDO" offline
    [ "$DRY_RUN" = 1 ] && exit 0
  fi

  [ "$DO_INSTALL" = 1 ] && rodar_npm
  proximos_passos "$NEXO_VERSAO"
}
