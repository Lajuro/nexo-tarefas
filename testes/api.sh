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
checa "DNS rebinding: recusa Host estranho também nas telas" '403' "$(curl -s -o /dev/null -w '%{http_code}' $B/ -H 'Host: evil.example')"
checa "leitura: recusa pedido vindo de outro site" '403' "$(curl -s -o /dev/null -w '%{http_code}' $B/api/dados -H 'Sec-Fetch-Site: cross-site')"
checa "leitura: recusa pedido vindo de outra porta da máquina" '403' "$(curl -s -o /dev/null -w '%{http_code}' $B/api/exportar -H 'Sec-Fetch-Site: same-site')"
checa "leitura: o próprio app continua lendo" '200' "$(curl -s -o /dev/null -w '%{http_code}' $B/api/dados -H 'Sec-Fetch-Site: same-origin')"
checa "CSRF: recusa escrita vinda de outra porta da máquina" '403' "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/backup -H 'Sec-Fetch-Site: same-site')"
CAB=$(curl -s -D - -o /dev/null $B/)
checa "telas: política de conteúdo só deixa falar com a própria máquina" "connect-src 'self'" "$CAB"
checa "telas: não podem ser embutidas em outra página" "frame-ancestors 'none'" "$CAB"
checa "telas: sem referrer" 'no-referrer' "$CAB"
checa "telas: nosniff" 'nosniff' "$CAB"
checa "telas: não anuncia o servidor" '' "$(echo "$CAB" | grep -i 'x-powered-by' || true)"
checa "pasta de dados fixada por variável não é trocada pela API" 'NEXO_DATA_DIR' "$(curl -s -X POST $B/api/config -H "$J" -d '{"dataDir":"/tmp/x"}')"
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

# ---------- documentação: árvore, ícone, estado e favorita das páginas ----------
RP=$(curl -s $B/api/dados | sed 's/.*"paginas":{"rev":\([0-9-]*\).*/\1/')
R=$(curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgarv1\",\"titulo\":\"Mae\",\"icone\":\"livro\",\"estado\":\"publicada\",\"fixada\":true,\"ordem\":2},{\"id\":\"pgarv2\",\"titulo\":\"Filha\",\"paiId\":\"pgarv1\",\"campoFuturo\":\"fica\"},{\"id\":\"pgarv3\",\"titulo\":\"Torta\",\"paiId\":\"../../x\",\"icone\":\"<b>\",\"estado\":\"qualquer\",\"fixada\":\"sim\",\"ordem\":\"abc\"}],\"revEsperada\":$RP}")
checa "página: guarda ícone, estado, favorita e ordem" '"id":"pgarv1","titulo":"Mae","icone":"livro","estado":"publicada","fixada":true,"ordem":2' "$R"
checa "página: filha aponta para a mãe e preserva campo desconhecido" '"campoFuturo":"fica"' "$R"
checa "página: filha com a mãe gravada" '"paiId":"pgarv1"' "$R"
checa "página: mãe inválida, ícone, estado e favorita estranhos viram padrão" '"id":"pgarv3","titulo":"Torta","paiId":null,"icone":"","estado":"rascunho","fixada":false,"ordem":0' "$R"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[],\"revEsperada\":$((RP+1))}" >/dev/null

# ---------- vídeo: enviar em pedaços e tocar com Range ----------
head -c 2000 /dev/urandom >"$TMP/video.bin"
R=$(curl -s -X POST "$B/api/midia?nome=Reuni%C3%A3o%20de%20teste.mp4" --data-binary @"$TMP/video.bin" -H 'Content-Type: application/octet-stream')
checa "vídeo: envio grava na pasta de dados" '"tamanho":2000' "$R"
MIDIA=$(echo "$R" | sed 's/.*"arquivo":"\([^"]*\)".*/\1/')
MIDIA_URL=${MIDIA// /%20}
checa "vídeo: o arquivo gravado é igual ao enviado" "$(sha256sum <"$TMP/video.bin")" "$(sha256sum <"$TMP/dados/arquivos/$MIDIA")"
CAB=$(curl -s -D - -o "$TMP/pedaco.bin" "$B/api/midia?p=$MIDIA_URL" -H 'Range: bytes=100-199')
checa "vídeo: Range devolve 206" 'HTTP/1.1 206' "$CAB"
checa "vídeo: Range diz qual pedaço mandou" 'bytes 100-199/2000' "$CAB"
checa "vídeo: tipo certo e sem adivinhação" 'video/mp4' "$CAB"
checa "vídeo: o pedaço é o pedido" "$(tail -c +101 "$TMP/video.bin" | head -c 100 | sha256sum)" "$(sha256sum <"$TMP/pedaco.bin")"
checa "vídeo: Range aberto vai até o fim" 'bytes 1990-1999/2000' "$(curl -s -D - -o /dev/null "$B/api/midia?p=$MIDIA_URL" -H 'Range: bytes=1990-')"
checa "vídeo: Range do fim" 'bytes 1995-1999/2000' "$(curl -s -D - -o /dev/null "$B/api/midia?p=$MIDIA_URL" -H 'Range: bytes=-5')"
checa "vídeo: Range fora do arquivo devolve 416" '416' "$(curl -s -o /dev/null -w '%{http_code}' "$B/api/midia?p=$MIDIA_URL" -H 'Range: bytes=5000-')"
checa "vídeo: sem Range devolve tudo e avisa que aceita Range" 'accept-ranges: bytes' "$(curl -s -D - -o /dev/null "$B/api/midia?p=$MIDIA_URL" | tr 'A-Z' 'a-z')"
checa "vídeo: recusa tipo que não é vídeo nem áudio" 'não é aceito' "$(curl -s -X POST "$B/api/midia?nome=virus.exe" --data-binary @"$TMP/video.bin")"
checa "vídeo: recusa envio vazio" 'vazio' "$(curl -s -X POST "$B/api/midia?nome=vazio.mp4" --data-binary '')"
curl -s -X POST "$B/api/midia?nome=..%2F..%2Ffora.mp4" --data-binary @"$TMP/video.bin" >/dev/null
checa "vídeo: nome com ../ não sai da pasta de anexos" '' "$(ls "$TMP/dados" "$TMP" | grep -x 'fora.mp4' || true)"
checa "vídeo: CSRF recusa Origin de outro site" '403' "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/midia?nome=x.mp4" -H 'Origin: https://evil.example' --data-binary @"$TMP/video.bin")"
checa "vídeo: recusa caminho fora de arquivos/" 'inválid' "$(curl -s "$B/api/midia?p=../nexo.json")"
echo "nao e video" >"$TMP/dados/arquivos/$(date +%Y)/nota.txt"
checa "vídeo: não toca arquivo que não é vídeo" 'não é um vídeo' "$(curl -s "$B/api/midia?p=$(date +%Y)/nota.txt")"
# vídeo num caminho do computador: o caminho vem da página gravada, nunca do pedido
cp "$TMP/video.bin" "$TMP/local.webm"
RP=$(curl -s $B/api/dados | sed 's/.*"paginas":{"rev":\([0-9-]*\).*/\1/')
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgvid1\",\"titulo\":\"Video local\",\"tipo\":\"video\",\"video\":{\"caminho\":\"$TMP/local.webm\",\"capitulos\":[{\"t\":30,\"titulo\":\"Meio\"}]}},{\"id\":\"pgvid2\",\"titulo\":\"Aponta para segredo\",\"tipo\":\"video\",\"video\":{\"caminho\":\"$TMP/dados/nexo.json\"}},{\"id\":\"pgvid3\",\"titulo\":\"Sem video\"}],\"revEsperada\":$RP}" >/dev/null
checa "vídeo local: toca pelo id da página" 'video/webm' "$(curl -s -D - -o /dev/null "$B/api/midia?pagina=pgvid1")"
checa "vídeo local: recusa arquivo que não é vídeo, mesmo gravado na página" 'não é um vídeo' "$(curl -s "$B/api/midia?pagina=pgvid2")"
checa "vídeo local: página sem vídeo" 'não aponta' "$(curl -s "$B/api/midia?pagina=pgvid3")"
checa "vídeo local: id inválido" 'não informado' "$(curl -s "$B/api/midia?pagina=..%2Fx")"
checa "vídeo local: o caminho do pedido é ignorado" 'não informado' "$(curl -s "$B/api/midia?caminho=$TMP/local.webm")"
checa "página de vídeo: guarda tipo e capítulos" '"capitulos":[{"t":30,"titulo":"Meio"}]' "$(curl -s $B/api/dados)"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[],\"revEsperada\":$((RP+1))}" >/dev/null

# ---------- verificação de integridade e restauração de backup ----------
V=$(curl -s $B/api/verificar)
checa "verificar: acusa arquivo ilegível como erro" '"id":"ilegivel","gravidade":"erro"' "$V"
checa "verificar: conta as tarefas" '"tarefas":' "$V"
MANUAL=$(basename "$(ls -d "$TMP/dados/_backups/"manual-* | head -1)")
checa "restaurar: recusa backup com arquivo ilegível dentro" 'não é um JSON válido' "$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d "{\"nome\":\"$MANUAL\"}")"
checa "restaurar recusado não cria foto do estado" '' "$(ls "$TMP/dados/_backups" | grep pre-restauracao || true)"
checa "restaurar: recusa nome com path traversal" 'inválido' "$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d '{"nome":"../../x"}')"
checa "restaurar: recusa nome fora do padrão" 'inválido' "$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d '{"nome":"tarefas"}')"
checa "restaurar: backup que não existe" 'não existe' "$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d '{"nome":"manual-2020-01-01T00-00-00"}')"
checa "prévia: recusa nome com path traversal" 'inválido' "$(curl -s "$B/api/backup?nome=..%2F..%2Fx")"
checa "restaurar: CSRF recusa Origin de outro site" '403' "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/backup/restaurar -H "$J" -H 'Origin: https://evil.example' -d "{\"nome\":\"$MANUAL\"}")"
# conserta os dois arquivos quebrados de propósito acima, para ter um backup inteiro
echo '{"rev":7,"items":[{"id":"c1","nome":"Categoria do backup"}]}' >"$TMP/dados/categorias.json"
echo '{"rev":7,"items":[{"id":"pe1","nome":"Ana Teste"}]}' >"$TMP/dados/pessoas.json"
checa "verificar: sem arquivo ilegível depois do conserto" '' "$(curl -s $B/api/verificar | grep -o '"id":"ilegivel"' || true)"
curl -s -X PUT $B/api/tarefas/tr1 -H "$J" -d '{"tarefa":{"id":"tr1","titulo":"Como era no backup","campoFuturo":"fica"},"revEsperada":null}' >/dev/null
sleep 1.1
BK=$(basename "$(curl -s -X POST $B/api/backup | sed 's/.*"pasta":"\([^"]*\)".*/\1/')")
checa "backup manual para restaurar" 'manual-' "$BK"
curl -s -X PUT $B/api/tarefas/tr1 -H "$J" -d '{"tarefa":{"id":"tr1","titulo":"Mudou depois"},"revEsperada":1}' >/dev/null
curl -s -X PUT $B/api/tarefas/tr2 -H "$J" -d '{"tarefa":{"id":"tr2","titulo":"Criada depois do backup"},"revEsperada":null}' >/dev/null
curl -s -X PUT $B/api/categorias -H "$J" -d '{"items":[{"id":"c1","nome":"Categoria renomeada depois"},{"id":"c2","nome":"Categoria nova"}],"revEsperada":7}' >/dev/null
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[],\"revEsperada\":$(curl -s $B/api/dados | sed 's/.*"paginas":{"rev":\([0-9-]*\).*/\1/')}" >/dev/null
PV=$(curl -s "$B/api/backup?nome=$BK")
checa "prévia: tarefa que volta ao que era" '"mudam":[{"id":"tr1","titulo":"Como era no backup"}]' "$PV"
checa "prévia: tarefa criada depois sai" '"saem":[{"id":"tr2","titulo":"Criada depois do backup"}]' "$PV"
checa "prévia: restaurável" '"restauravel":true' "$PV"
checa "prévia não altera nada" 'Mudou depois' "$(cat "$TMP/dados/tarefas/tr1.json")"
R=$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d "{\"nome\":\"$BK\"}")
checa "restaurar: responde com a foto do estado anterior" '"foto":"pre-restauracao-' "$R"
checa "restaurar: uma tarefa foi para a lixeira" '"paraLixeira":1' "$R"
T1=$(cat "$TMP/dados/tarefas/tr1.json")
checa "restaurar: a tarefa voltou ao que era" '"titulo": "Como era no backup"' "$T1"
checa "restaurar: preserva campo desconhecido" '"campoFuturo": "fica"' "$T1"
checa "restaurar: a revisão sobe além da atual" '"rev": 3' "$T1"
checa "restaurar: aba com dado velho recebe 409" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/tarefas/tr1 -H "$J" -d '{"tarefa":{"id":"tr1","titulo":"aba velha"},"revEsperada":2}')"
checa "restaurar: tarefa criada depois saiu da pasta" '' "$(ls "$TMP/dados/tarefas" | grep '^tr2' || true)"
checa "restaurar: e foi para a lixeira" 'tarefa-tr2-' "$(ls "$TMP/dados/_lixeira")"
checa "restaurar: a foto do estado anterior tem a tarefa nova" 'tr2.json' "$(ls "$TMP/dados/_backups/"pre-restauracao-*/tarefas)"
checa "restaurar: a foto guarda a versão que foi substituída" 'Mudou depois' "$(cat "$TMP/dados/_backups/"pre-restauracao-*/tarefas/tr1.json)"
C=$(cat "$TMP/dados/categorias.json")
checa "restaurar: coleção volta ao que era" 'Categoria do backup' "$C"
checa "restaurar: revisão da coleção sobe além da atual" '"rev": 9' "$C"
checa "restaurar: espelho em Markdown acompanha" 'Como era no backup' "$(cat "$TMP/dados/markdown/"*--tr1.md)"
checa "restaurar: tarefa da lixeira pode voltar" 'Criada depois do backup' "$(curl -s -X POST $B/api/lixeira -H "$J" -d "{\"arquivo\":\"$(ls "$TMP/dados/_lixeira" | grep '^tarefa-tr2-')\"}")"
checa "restaurar a foto desfaz a restauração" '"tarefas":' "$(curl -s -X POST $B/api/backup/restaurar -H "$J" -d "{\"nome\":\"$(basename "$(ls -d "$TMP/dados/_backups/"pre-restauracao-* | head -1)")\"}")"
checa "desfazer: a tarefa volta ao estado de antes da restauração" '"titulo": "Mudou depois"' "$(cat "$TMP/dados/tarefas/tr1.json")"
checa "desfazer: a categoria volta ao estado de antes da restauração" 'Categoria renomeada depois' "$(cat "$TMP/dados/categorias.json")"
# anexo citado que não está na pasta
curl -s -X PUT $B/api/links -H "$J" -d "{\"items\":[{\"id\":\"lx\",\"tipo\":\"arquivo\",\"titulo\":\"Laudo\",\"arquivo\":\"2026/nao-existe.pdf\"}],\"revEsperada\":$(curl -s $B/api/dados | sed 's/.*"links":{"rev":\([0-9-]*\).*/\1/')}" >/dev/null
V=$(curl -s $B/api/verificar)
checa "verificar: anexo citado que não está na pasta" '"id":"anexo-faltando","gravidade":"erro"' "$V"
checa "verificar: diz qual anexo" '2026/nao-existe.pdf' "$V"
checa "verificar: só lê (não cria nem apaga arquivo)" 'nao-existe' "$(cat "$TMP/dados/links.json")"

echo; [ $FALHAS -eq 0 ] && echo "Tudo certo." || { echo "$FALHAS falha(s)."; exit 1; }
