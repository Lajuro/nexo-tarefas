#!/usr/bin/env bash
# Testes de fumaça da camada de dados e da segurança da API.
# Pré-requisito: npm run build.   Uso: bash testes/api.sh
# Sobe o servidor com HOME e pasta de dados temporários, roda as checagens e derruba.
set -uo pipefail
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"; PORTA=3299; B="http://127.0.0.1:$PORTA"; FALHAS=0
set -m
HOME="$TMP/home" NEXO_DATA_DIR="$TMP/dados" node_modules/.bin/next start -p $PORTA -H 127.0.0.1 >"$TMP/server.log" 2>&1 &
PID=$!
trap 'kill -- -$PID 2>/dev/null; rm -rf "$TMP"' EXIT
for _ in $(seq 1 40); do curl -s "$B/api/estado" >/dev/null && break; sleep 0.5; done

checa() { # nome esperado obtido
  if [[ "$3" == *"$2"* ]]; then echo "ok   $1"; else echo "FALHA $1 -> esperado '$2', veio '$3'"; FALHAS=$((FALHAS+1)); fi
}
J='Content-Type: application/json'

checa "estado configurado via env" '"origem":"env"' "$(curl -s $B/api/estado)"
checa "cria tarefa" '"rev":1' "$(curl -s -X PUT $B/api/tarefas/t1 -H "$J" -d '{"tarefa":{"id":"t1","titulo":"A","campoFuturo":"x"},"revEsperada":null}')"
R=$(curl -s -X PUT $B/api/tarefas/t1 -H "$J" -d '{"tarefa":{"id":"t1","titulo":"B"},"revEsperada":1}')
checa "atualiza com rev certa" '"rev":2' "$R"
checa "preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/tarefas/t1 -H "$J" -d '{"tarefa":{"id":"t1"},"revEsperada":1}')"
checa "recusa id com path traversal" 'inválid' "$(curl -s -X PUT $B/api/tarefas/x -H "$J" -d '{"tarefa":{"id":"../x"},"revEsperada":null}')"
checa "recusa leitura fora de arquivos/" 'inválid' "$(curl -s "$B/api/arquivos?p=../nexo.json")"
checa "CSRF: recusa Origin de outro site" '403' "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/backup -H 'Origin: https://evil.example')"
checa "DNS rebinding: recusa Host estranho" '403' "$(curl -s -o /dev/null -w '%{http_code}' $B/api/estado -H 'Host: evil.example')"
checa "backup diário criado" 'tarefas' "$(ls "$TMP/dados/_backups/"*/ 2>/dev/null)"
checa "espelho markdown" '.md' "$(ls "$TMP/dados/markdown" 2>/dev/null)"
curl -s -X DELETE $B/api/tarefas/t1 >/dev/null
checa "excluir vai para a lixeira" 'tarefa-t1-' "$(ls "$TMP/dados/_lixeira")"
echo '{ quebrado' >"$TMP/dados/categorias.json"
checa "JSON corrompido gera aviso" 'não é um JSON válido' "$(curl -s $B/api/dados)"
curl -s -X PUT $B/api/categorias -H "$J" -d '{"items":[],"revEsperada":0}' >/dev/null
checa "JSON corrompido não é sobrescrito" '{ quebrado' "$(cat "$TMP/dados/categorias.json")"

echo; [ $FALHAS -eq 0 ] && echo "Tudo certo." || { echo "$FALHAS falha(s)."; exit 1; }
