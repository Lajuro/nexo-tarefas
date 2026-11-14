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

# ---------- esperando quem, sessão de foco e modelos de tarefa ----------
R=$(curl -s -X PUT $B/api/tarefas/t9 -H "$J" -d '{"tarefa":{"id":"t9","titulo":"Espera","status":"aguardando","esperando":{"quem":"  Ana Teste ","oQue":"o acesso","desde":"ontem","campoFuturo":"x"},"registros":[{"id":"r9","tipo":"atividade","titulo":"Sessão","duracaoMin":"25.4"},{"id":"r10","tipo":"nota","duracaoMin":-3}]},"revEsperada":null}')
checa "esperando: nome aparado e campo desconhecido preservado" '"quem":"Ana Teste","oQue":"o acesso"' "$R"
checa "esperando: preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "esperando: data inválida não passa" '"cobradoEm":null' "$R"
checa "sessão de foco: duração vira número inteiro" '"duracaoMin":25' "$R"
checa "sessão de foco: duração negativa vira 0" '"duracaoMin":0' "$R"
checa "espelho markdown mostra de quem se espera" 'Esperando:** Ana Teste: o acesso' "$(cat "$TMP/dados/markdown/"*--t9.md)"
R=$(curl -s -X PUT $B/api/tarefas/t9 -H "$J" -d '{"tarefa":{"id":"t9","titulo":"Espera","esperando":{"quem":"","oQue":""}},"revEsperada":1}')
checa "esperando vazio vira null" '"esperando":null' "$R"
checa "dados trazem modelos vazios" '"modelos":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/modelos -H "$J" -d '{"items":[{"id":"mo1","nome":"Levar a ferramenta a um squad","passos":["Agendar a abertura","  ",7,"Pedir os acessos"],"prioridade":99,"prazoEmDias":"30","campoFuturo":"x"},{"id":"mo2","nome":"Outro"}],"revEsperada":0}')
checa "cria modelos" '"rev":1' "$R"
checa "modelo: passos só de texto, sem vazios" '"passos":["Agendar a abertura","Pedir os acessos"]' "$R"
checa "modelo: prioridade dentro de 1 a 10" '"prioridade":10' "$R"
checa "modelo: prazo em dias vira número" '"prazoEmDias":30' "$R"
checa "modelo preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "modelos: recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/modelos -H "$J" -d '{"items":[],"revEsperada":0}')"
checa "modelos: recusa id inválido" 'inválid' "$(curl -s -X PUT $B/api/modelos -H "$J" -d '{"items":[{"id":"../x"}],"revEsperada":1}')"
curl -s -X PUT $B/api/modelos -H "$J" -d '{"items":[{"id":"mo1","nome":"Levar a ferramenta a um squad"}],"revEsperada":1}' >/dev/null
checa "modelo removido vai para a lixeira" 'Outro' "$(cat "$TMP/dados/_lixeira/"modelos-removidos-*.json 2>/dev/null)"
checa "exportar inclui modelos" '"modelos": {' "$(curl -s $B/api/exportar)"
# ---------- páginas de conhecimento ----------
checa "dados trazem páginas vazias" '"paginas":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/paginas -H "$J" -d '{"items":[{"id":"pg1","titulo":"Processo de exceção","texto":"# Passo a passo\n\nver ![print](arquivos/2026/a-print.png) e [Tarefa](nexo:tarefa/t9)","campoFuturo":"x"},{"id":"pg2","titulo":"Outra","texto":"apagar"}],"revEsperada":0}')
checa "cria páginas" '"rev":1' "$R"
checa "página preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "página: espelho em markdown" '# Processo de exceção' "$(cat "$TMP/dados/markdown/paginas/"*--pg1.md 2>/dev/null)"
checa "página: imagem do espelho aponta para a pasta de anexos" '](../../arquivos/2026/a-print.png)' "$(cat "$TMP/dados/markdown/paginas/"*--pg1.md 2>/dev/null)"
checa "páginas: recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/paginas -H "$J" -d '{"items":[],"revEsperada":0}')"
checa "páginas: recusa id inválido" 'inválid' "$(curl -s -X PUT $B/api/paginas -H "$J" -d '{"items":[{"id":"../x"}],"revEsperada":1}')"
curl -s -X PUT $B/api/paginas -H "$J" -d '{"items":[{"id":"pg1","titulo":"Processo de exceção"}],"revEsperada":1}' >/dev/null
checa "página removida vai para a lixeira" 'apagar' "$(cat "$TMP/dados/_lixeira/"paginas-removidos-*.json 2>/dev/null)"
checa "página removida perde o espelho" '1' "$(ls "$TMP/dados/markdown/paginas/" | wc -l | tr -d ' ')"
checa "página: gravar só o título não apaga o texto (mescla com o disco)" 'Passo a passo' "$(cat "$TMP/dados/paginas.json")"
checa "exportar inclui páginas" '"paginas": {' "$(curl -s $B/api/exportar)"

# ---------- pessoas e times ----------
checa "dados trazem pessoas e times vazios" '"pessoas":{"rev":0,"items":[]},"times":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
# ---------- bloco de notas ----------
checa "dados trazem notas vazias" '"notas":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/notas -H "$J" -d '{"items":[{"id":"n1","titulo":"Reunião das 10h","texto":"squad topou o piloto","campoFuturo":"x"},{"id":"n2","texto":"ideia solta"}],"revEsperada":0}')
checa "cria notas" '"rev":1' "$R"
checa "nota preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "nota ganha padrões" '"arquivadaEm":null,"gerou":[]' "$R"
checa "notas: recusa rev velha (409)" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/notas -H "$J" -d '{"items":[],"revEsperada":0}')"
checa "notas: recusa id inválido" 'inválid' "$(curl -s -X PUT $B/api/notas -H "$J" -d '{"items":[{"id":"../x"}],"revEsperada":1}')"
curl -s -X PUT $B/api/notas -H "$J" -d '{"items":[{"id":"n1","titulo":"Reunião das 10h","texto":"squad topou o piloto"}],"revEsperada":1}' >/dev/null
checa "nota removida vai para a lixeira" 'ideia solta' "$(cat "$TMP/dados/_lixeira/"notas-removidos-*.json 2>/dev/null)"
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
