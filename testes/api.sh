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


# ---------- pessoas e times ----------
checa "dados trazem pessoas e times vazios" '"pessoas":{"rev":0,"items":[]},"times":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[{"id":"pe1","nome":"Ana Teste","email":"ana@exemplo.local","campoFuturo":"x"},{"id":"pe2","nome":"Beto Teste"}],"revEsperada":0}')
checa "cria pessoas" '"rev":1' "$R"
checa "pessoa ganha padrões" '"apelidos":[]' "$R"
checa "pessoa preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "pessoas: recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/pessoas -H "$J" -d '{"items":[],"revEsperada":0}')"
checa "pessoas: recusa id inválido" 'inválid' "$(curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[{"id":"../x","nome":"X"}],"revEsperada":1}')"
checa "pessoas: recusa id repetido" 'repetido' "$(curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[{"id":"pe1"},{"id":"pe1"}],"revEsperada":1}')"
checa "pessoas: id inválido não grava nada" '"rev": 1' "$(cat "$TMP/dados/pessoas.json")"
R=$(curl -s -X PUT $B/api/times -H "$J" -d '{"items":[{"id":"ti1","nome":"Time A","responsavelIds":["pe1"],"membroIds":["pe2"]}],"revEsperada":0}')
checa "cria time" '"rev":1' "$R"
checa "responsável vira membro" '"membroIds":["pe2","pe1"]' "$R"
checa "times: recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/times -H "$J" -d '{"items":[],"revEsperada":5}')"
checa "times: recusa id inválido" 'inválid' "$(curl -s -X PUT $B/api/times -H "$J" -d '{"items":[{"id":"a/b"}],"revEsperada":1}')"
R=$(curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[{"id":"pe1","nome":"Ana Teste 2"}],"revEsperada":1}')
checa "mescla com o disco ao gravar" '"email":"ana@exemplo.local"' "$R"
checa "pessoa removida vai para a lixeira" 'pessoas-removidos-' "$(ls "$TMP/dados/_lixeira")"
checa "lixeira guarda a pessoa removida" 'Beto Teste' "$(cat "$TMP/dados/_lixeira/"pessoas-removidos-*.json)"
curl -s -X PUT $B/api/times -H "$J" -d '{"items":[],"revEsperada":1}' >/dev/null
checa "time removido vai para a lixeira" 'times-removidos-' "$(ls "$TMP/dados/_lixeira")"
curl -s -X POST $B/api/backup >/dev/null
checa "backup manual inclui pessoas.json" 'pessoas.json' "$(ls "$TMP/dados/_backups/"manual-*/)"
checa "backup manual inclui times.json" 'times.json' "$(ls "$TMP/dados/_backups/"manual-*/)"
E=$(curl -s $B/api/exportar)
checa "exportar inclui pessoas" '"pessoas": {' "$E"
checa "exportar inclui times" '"times": {' "$E"
echo '{ quebrado' >"$TMP/dados/pessoas.json"
checa "pessoas corrompido gera aviso" 'pessoas.json não é um JSON válido' "$(curl -s $B/api/dados)"
checa "pessoas corrompido volta com rev -1" '"pessoas":{"rev":-1' "$(curl -s $B/api/dados)"
curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[],"revEsperada":2}' >/dev/null
curl -s -X PUT $B/api/pessoas -H "$J" -d '{"items":[],"revEsperada":-1}' >/dev/null
checa "pessoas corrompido não é sobrescrito" '{ quebrado' "$(cat "$TMP/dados/pessoas.json")"

echo; [ $FALHAS -eq 0 ] && echo "Tudo certo." || { echo "$FALHAS falha(s)."; exit 1; }
