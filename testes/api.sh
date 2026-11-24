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
# No Git Bash (Windows) o curl e o servidor são programas do Windows: um caminho que vai DENTRO de um argumento
# (-F "arquivo=@...") ou de um JSON precisa estar no formato deles (C:/...), senão o arquivo não é achado.
# Fora do Windows fica como está. (Argumento que é só o caminho, como --data-binary @arquivo, o Git Bash converte sozinho.)
nativo() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
TMPN="$(nativo "$TMP")"

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
# o corpo vai pela entrada padrão: como argumento, o curl do Windows trocaria os acentos pela página de código da máquina
R=$(printf '%s' '{"items":[{"id":"pg1","titulo":"Processo de exceção","texto":"# Passo a passo\n\nver ![print](arquivos/2026/a-print.png) e [Tarefa](nexo:tarefa/t9)","campoFuturo":"x"},{"id":"pg2","titulo":"Outra","texto":"apagar"}],"revEsperada":0}' | curl -s -X PUT $B/api/paginas -H "$J" --data-binary @-)
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
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgvid1\",\"titulo\":\"Video local\",\"tipo\":\"video\",\"video\":{\"caminho\":\"$TMPN/local.webm\",\"capitulos\":[{\"t\":30,\"titulo\":\"Meio\"}]}},{\"id\":\"pgvid2\",\"titulo\":\"Aponta para segredo\",\"tipo\":\"video\",\"video\":{\"caminho\":\"$TMPN/dados/nexo.json\"}},{\"id\":\"pgvid3\",\"titulo\":\"Sem video\"}],\"revEsperada\":$RP}" >/dev/null
checa "vídeo local: toca pelo id da página" 'video/webm' "$(curl -s -D - -o /dev/null "$B/api/midia?pagina=pgvid1")"
checa "vídeo local: recusa arquivo que não é vídeo, mesmo gravado na página" 'não é um vídeo' "$(curl -s "$B/api/midia?pagina=pgvid2")"
checa "vídeo local: página sem vídeo" 'não aponta' "$(curl -s "$B/api/midia?pagina=pgvid3")"
checa "vídeo local: id inválido" 'não informado' "$(curl -s "$B/api/midia?pagina=..%2Fx")"
checa "vídeo local: o caminho do pedido é ignorado" 'não informado' "$(curl -s "$B/api/midia?caminho=$TMP/local.webm")"
checa "página de vídeo: guarda tipo e capítulos" '"capitulos":[{"t":30,"titulo":"Meio"}]' "$(curl -s $B/api/dados)"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[],\"revEsperada\":$((RP+1))}" >/dev/null

# ---------- histórico de versões das páginas ----------
RP=$(curl -s $B/api/dados | sed 's/.*"paginas":{"rev":\([0-9-]*\).*/\1/')
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo\",\"texto\":\"primeira versao\"}],\"revEsperada\":$RP}" >/dev/null
checa "histórico: página nova ainda não tem versão" '"versoes":[]' "$(curl -s "$B/api/paginas/historico?id=pgh1")"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo\",\"texto\":\"segunda versao do texto\"}],\"revEsperada\":$((RP+1))}" >/dev/null
H=$(curl -s "$B/api/paginas/historico?id=pgh1")
checa "histórico: mudar o texto guarda como ele estava" '"palavras":2' "$H"
VERSAO=$(echo "$H" | sed 's/.*"versao":"\([^"]*\)".*/\1/')
checa "histórico: a versão guardada é a de antes da mudança" '"texto":"primeira versao"' "$(curl -s "$B/api/paginas/historico?id=pgh1&v=$VERSAO")"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo\",\"texto\":\"terceira\"}],\"revEsperada\":$((RP+2))}" >/dev/null
checa "histórico: gravações seguidas não criam uma versão cada" '1' "$(ls "$TMP/dados/_historico/paginas/pgh1" | wc -l | tr -d ' ')"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo\",\"texto\":\"terceira\",\"estado\":\"publicada\"}],\"revEsperada\":$((RP+3))}" >/dev/null
checa "histórico: mudar só o estado não guarda versão" '1' "$(ls "$TMP/dados/_historico/paginas/pgh1" | wc -l | tr -d ' ')"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo renomeado\",\"texto\":\"terceira\",\"estado\":\"publicada\"}],\"revEsperada\":$((RP+4))}" >/dev/null
checa "histórico: renomear não guarda versão" '1' "$(ls "$TMP/dados/_historico/paginas/pgh1" | wc -l | tr -d ' ')"
LONGO="Passo um: abrir a ferramenta. Passo dois: conferir o resultado. Passo tres: registrar o que foi visto na tarefa."
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo renomeado\",\"texto\":\"$LONGO\"}],\"revEsperada\":$((RP+5))}" >/dev/null
sleep 1
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[{\"id\":\"pgh1\",\"titulo\":\"Processo renomeado\",\"texto\":\"\"}],\"revEsperada\":$((RP+6))}" >/dev/null
checa "histórico: apagar boa parte do texto guarda a versão na hora, sem esperar os 10 minutos" '2' "$(ls "$TMP/dados/_historico/paginas/pgh1" | wc -l | tr -d ' ')"
checa "histórico: a versão do corte tem o texto que foi apagado" 'Passo dois: conferir' "$(curl -s "$B/api/paginas/historico?id=pgh1&v=$(ls "$TMP/dados/_historico/paginas/pgh1" | sort | tail -1 | sed 's/\.json$//')")"
checa "histórico: recusa id com path traversal" 'inválida' "$(curl -s "$B/api/paginas/historico?id=..%2F..%2Fx")"
checa "histórico: recusa versão com path traversal" 'inválida' "$(curl -s "$B/api/paginas/historico?id=pgh1&v=..%2F..%2Fnexo")"
checa "histórico: versão que não existe" 'não existe' "$(curl -s "$B/api/paginas/historico?id=pgh1&v=2020-01-01T00-00-00")"
curl -s -X PUT $B/api/paginas -H "$J" -d "{\"items\":[],\"revEsperada\":$((RP+7))}" >/dev/null
checa "histórico: excluir a página não apaga as versões" '2' "$(ls "$TMP/dados/_historico/paginas/pgh1" | wc -l | tr -d ' ')"

# ---------- jornada: rotina do dia, ponto e configuração ----------
checa "jornada: começa vazia" '"jornada":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"config","jornadaMin":480,"pausaMin":60,"padrao":{"1":[{"inicio":"08:00","fim":"10:00","titulo":"Chamados","tipo":"atividade"}]},"campoFuturo":"x"},{"id":"2026-11-16","ponto":{"entrada":"08:12","saida":"17:30","pausas":[{"inicio":"12:00","fim":"13:00"}]},"blocos":[{"id":"bl1","inicio":"14:00","fim":"15:00","titulo":"Revisar","tipo":"tarefa","tarefaId":"t1"}],"planejado":true}],"revEsperada":0}')
checa "jornada: grava a configuração e um dia" '"rev":1' "$R"
checa "jornada: a configuração é reconhecida pelo id" '"tipo":"config","diasDeTrabalho":[1,2,3,4,5]' "$R"
checa "jornada: o dia é reconhecido pela data" '"tipo":"dia","data":"2026-11-16"' "$R"
checa "jornada: preserva campo desconhecido" '"campoFuturo":"x"' "$R"
checa "jornada: o dia padrão fica nos sete dias da semana" '"0":[]' "$R"
checa "jornada: vem em /api/dados" '"entrada":"08:12"' "$(curl -s $B/api/dados)"
checa "jornada: rev errada dá conflito" 'mudou em outro lugar' "$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[],"revEsperada":0}')"
checa "jornada: recusa id que não é data" 'Dia inválido' "$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"../x"}],"revEsperada":1}')"
checa "jornada: recusa data que não existe" 'Dia inválido' "$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"2026-02-30"}],"revEsperada":1}')"
checa "jornada: recusa item sem id" 'Dia inválido' "$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"data":"2026-11-16"}],"revEsperada":1}')"
checa "jornada: recusa dia repetido" 'ID repetido' "$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"2026-11-16"},{"id":"2026-11-16"}],"revEsperada":1}')"
R=$(curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"config"},{"id":"2026-11-16"},{"id":"2026-11-17","ponto":{"entrada":"09:00","saida":"08:00","pausas":[{"inicio":"25:00"},{"inicio":"12:00","fim":"11:00"}]},"blocos":[{"id":"../../x","inicio":"30:00","fim":"07:00","titulo":"<img src=x onerror=alert(1)>","tipo":"qualquer","tarefaId":"../../etc/passwd"}],"jornadaMin":99999}],"revEsperada":1}')
checa "jornada: saída antes da entrada não vale" '"entrada":"09:00","saida":null' "$R"
checa "jornada: pausa torta é descartada ou fica sem fim" '"pausas":[{"inicio":"12:00","fim":null}]' "$R"
checa "jornada: horário torto do bloco vira um horário válido" '"inicio":"08:00","fim":"09:00"' "$R"
checa "jornada: tipo desconhecido vira atividade, sem tarefa" '"tipo":"atividade","tarefaId":null' "$R"
checa "jornada: id de bloco que não serve é trocado" '"id":"bl' "$R"
checa "jornada: jornada absurda é limitada" '"jornadaMin":960' "$R"
checa "jornada: mescla com o disco (o ponto do dia 16 continua)" '"entrada":"08:12","saida":"17:30"' "$R"
checa "jornada: mescla com o disco (a configuração continua)" '"campoFuturo":"x"' "$R"
curl -s -X PUT $B/api/jornada -H "$J" -d '{"items":[{"id":"config"}],"revEsperada":2}' >/dev/null
checa "jornada: dia removido vai para a lixeira" '1' "$(ls "$TMP/dados/_lixeira" | grep -c '^jornada-removidos-')"
checa "jornada: a lixeira guarda o ponto do dia removido" '"entrada":"08:12"' "$(tr -d ' \n' < "$(ls "$TMP"/dados/_lixeira/jornada-removidos-*.json | head -1)")"

# ---------- 3.8: falar com (assuntos), dependências e repetição de modelo ----------
checa "assuntos: começa vazio" '"assuntos":{"rev":0,"items":[]}' "$(curl -s $B/api/dados)"
R=$(curl -s -X PUT $B/api/assuntos -H "$J" -d '{"items":[{"id":"as1","pessoa":"Fulano","texto":"Pedir a lista","tarefaId":"../../x","campoFuturo":1}],"revEsperada":0}')
checa "assuntos: grava" '"rev":1' "$R"
checa "assuntos: tarefaId inválido vira null" '"tarefaId":null' "$R"
checa "assuntos: preserva campo desconhecido" '"campoFuturo":1' "$R"
checa "assuntos: recusa id inválido" 'ID inválido' "$(curl -s -X PUT $B/api/assuntos -H "$J" -d '{"items":[{"id":"../x","pessoa":"a","texto":"b"}],"revEsperada":1}')"
checa "assuntos: rev errada dá conflito" 'mudou em outro lugar' "$(curl -s -X PUT $B/api/assuntos -H "$J" -d '{"items":[],"revEsperada":0}')"
R=$(curl -s -X PUT $B/api/tarefas/dep1 -H "$J" -d '{"tarefa":{"id":"dep1","titulo":"Depende","dependeDe":["t1","t1","dep1","../x"]},"revEsperada":null}')
checa "dependeDe: só ids válidos, sem repetir e sem ela mesma" '"dependeDe":["t1"]' "$R"
R=$(curl -s -X PUT $B/api/modelos -H "$J" -d "{\"items\":[{\"id\":\"mo1\",\"nome\":\"Mensal\",\"repetir\":{\"tipo\":\"mes\",\"diaDoMes\":5,\"desde\":\"2026-01-01\"}},{\"id\":\"mo2\",\"nome\":\"Torto\",\"repetir\":{\"tipo\":\"mes\",\"diaDoMes\":40,\"desde\":\"2026-01-01\"}}],\"revEsperada\":$(curl -s $B/api/dados | grep -o '"modelos":{"rev":[0-9]*' | grep -o '[0-9]*$')}")
checa "modelo: repetição válida é gravada" '"repetir":{"tipo":"mes","diaDoMes":5,"desde":"2026-01-01","ultima":null}' "$R"
checa "modelo: repetição torta vira null" '"nome":"Torto"' "$R"
checa "modelo: repetição torta vira null (sem repetir)" '"repetir":null' "$R"

checa "transcrições: só lê e responde a lista" '"transcricoes":[' "$(curl -s $B/api/transcricoes)"

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

# 3.14: um link em várias tarefas, sem perder o que uma versão antiga gravou ou mexeu
revLinks() { curl -s $B/api/dados | sed 's/.*"links":{"rev":\([0-9-]*\).*/\1/'; }
R=$(curl -s -X PUT $B/api/links -H "$J" -d "{\"items\":[{\"id\":\"lv\",\"titulo\":\"Runbook\",\"url\":\"https://exemplo.local\",\"tarefaId\":\"t1\"}],\"revEsperada\":$(revLinks)}")
checa "link antigo (só tarefaId) ganha a lista de tarefas" '"tarefaIds":["t1"]' "$R"
R=$(curl -s -X PUT $B/api/links -H "$J" -d "{\"items\":[{\"id\":\"lv\",\"titulo\":\"Runbook\",\"tarefaId\":\"t1\",\"tarefaIds\":[\"t1\",\"t2\",\"../x\"],\"estado\":\"aberto\",\"estadoEm\":\"2026-11-10T12:00:00.000Z\",\"trava\":[\"t2\",\"t9\"]}],\"revEsperada\":$(revLinks)}")
checa "link em duas tarefas: id inválido fica de fora" '"tarefaIds":["t1","t2"]' "$R"
checa "link: o campo antigo continua sendo a primeira tarefa" '"tarefaId":"t1"' "$R"
checa "link: status gravado" '"estado":"aberto"' "$R"
checa "link: trava só de tarefa em que o link é usado" '"trava":["t2"]' "$R"
R=$(curl -s -X PUT $B/api/links -H "$J" -d "{\"items\":[{\"id\":\"lv\",\"titulo\":\"Runbook\",\"tarefaId\":null}],\"revEsperada\":$(revLinks)}")
checa "versão antiga desvinculou (tarefaId nulo): sai só a primeira tarefa" '"tarefaIds":["t2"]' "$R"
checa "versão antiga desvinculou: status preservado" '"estado":"aberto"' "$R"
R=$(curl -s -X PUT $B/api/links -H "$J" -d "{\"items\":[{\"id\":\"lv\",\"titulo\":\"Runbook\",\"estado\":\"explodiu\"}],\"revEsperada\":$(revLinks)}")
checa "link: status desconhecido vira sem status" '"estado":null' "$R"

# 3.15: política dos anexos. São arquivos de terceiros: por padrão vão em "sandbox" e não podem ser embutidos;
# só o PDF pedido pelo visor do app (?ver=1) vai sem sandbox, e só o próprio app pode embuti-lo.
# (Até a 3.14 os cabeçalhos das telas passavam por cima dos da rota e o sandbox se perdia em produção.)
sobe() { # nome conteudo -> caminho codificado do anexo
  printf '%s' "$2" > "$TMP/$1"
  curl -s -X POST $B/api/arquivos -F "arquivo=@$TMPN/$1;filename=$1" | sed 's/.*"arquivo":"\([^"]*\)".*/\1/' | sed 's|/|%2F|g'
}
cab() { curl -s -D - -o /dev/null "$B/api/arquivos?p=$1" | tr -d '\r' | tr 'A-Z' 'a-z'; }
SVG=$(sobe desenho.svg '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
CAB=$(cab "$SVG")
checa "anexo: SVG vai em sandbox (script dele não roda na origem do app)" 'content-security-policy: sandbox' "$CAB"
checa "anexo: não pode ser embutido" 'x-frame-options: deny' "$CAB"
checa "anexo: nosniff" 'x-content-type-options: nosniff' "$CAB"
checa "anexo: a política das telas não passa por cima da do anexo" 'ok' "$(echo "$CAB" | grep -q "script-src" && echo vazou || echo ok)"
checa "anexo: informa o tamanho para o visor" "x-nexo-tamanho: $(wc -c < "$TMP/desenho.svg" | tr -d ' ')" "$CAB"
HTML=$(sobe pagina.html '<script>alert(1)</script>')
CAB=$(cab "$HTML")
checa "anexo: HTML é servido como texto" 'content-type: text/plain' "$CAB"
checa "anexo: HTML também em sandbox" 'content-security-policy: sandbox' "$CAB"
PDF=$(sobe laudo.pdf '%PDF-1.4 teste')
checa "anexo: PDF aberto direto continua em sandbox" 'content-security-policy: sandbox' "$(cab "$PDF")"
CAB=$(cab "$PDF&ver=1")
checa "anexo: PDF pedido pelo visor pode ser embutido só pelo app" "content-security-policy: frame-ancestors 'self'" "$CAB"
checa "anexo: PDF no visor: mesma origem" 'x-frame-options: sameorigin' "$CAB"
checa "anexo: PDF no visor é sempre application/pdf" 'content-type: application/pdf' "$CAB"
checa "anexo: ver=1 só vale para PDF (HTML continua em sandbox)" 'content-security-policy: sandbox' "$(cab "$HTML&ver=1")"
checa "anexo: ver=1 só vale para PDF (SVG continua em sandbox)" 'content-security-policy: sandbox' "$(cab "$SVG&ver=1")"
checa "anexo: baixar o PDF continua em sandbox" 'content-security-policy: sandbox' "$(cab "$PDF&baixar=1&ver=1")"
checa "telas: continuam com a política completa" "script-src 'self'" "$(curl -s -D - -o /dev/null $B/links | tr -d '\r')"
checa "telas: continuam sem poder ser embutidas" "frame-ancestors 'none'" "$(curl -s -D - -o /dev/null $B/links | tr -d '\r')"
checa "resto da API: continua com a política das telas" "frame-ancestors 'none'" "$(curl -s -D - -o /dev/null $B/api/dados | tr -d '\r')"

# ---------- 3.17: checklist próprio da tarefa ----------
R=$(curl -s -X PUT $B/api/tarefas/ck1 -H "$J" -d '{"tarefa":{"id":"ck1","titulo":"Com checklist","checklist":[{"id":"a","texto":"  Pedir   acesso ","feito":true,"feitoEm":"2026-11-20T10:00:00.000Z","campoFuturo":"x"},{"id":"a","texto":"Repetido"},{"id":"../x","texto":"Id ruim"},{"texto":"   "},"solto"]},"revEsperada":null}')
checa "checklist: texto aparado, feito e campo desconhecido preservados" '"id":"a","texto":"Pedir acesso","feito":true,"feitoEm":"2026-11-20T10:00:00.000Z","campoFuturo":"x"' "$R"
checa "checklist: id repetido ganha outro e o item continua" '"texto":"Repetido","feito":false' "$R"
checa "checklist: id inválido não é gravado" 'ok' "$(echo "$R" | grep -q '\.\./x' && echo vazou || echo ok)"
checa "checklist: item sem texto fica de fora" '3' "$(echo "$R" | grep -o '"texto":"' | wc -l | tr -d ' ')"
checa "checklist: aparece no espelho em Markdown" '- [x] Pedir acesso' "$(cat "$TMP/dados/markdown/"*--ck1.md)"
R=$(curl -s -X PUT $B/api/tarefas/ck1 -H "$J" -d '{"tarefa":{"id":"ck1","titulo":"Renomeada"},"revEsperada":1}')
checa "checklist: gravar a tarefa sem o campo não apaga o checklist (mescla com o disco)" '"texto":"Pedir acesso"' "$R"
checa "tarefa sem checklist abre com a lista vazia" '"checklist":[]' "$(curl -s -X PUT $B/api/tarefas/ck2 -H "$J" -d '{"tarefa":{"id":"ck2","titulo":"Sem checklist"},"revEsperada":null}')"

# ---------- 3.18: checklist nos modelos de tarefa ----------
revModelos() { curl -s $B/api/dados | sed 's/.*"modelos":{"rev":\([0-9-]*\).*/\1/'; }
R=$(curl -s -X PUT $B/api/modelos -H "$J" -d "{\"items\":[{\"id\":\"mo1\",\"nome\":\"Levar a ferramenta a um squad\"},{\"id\":\"mock\",\"nome\":\"Com checklist\",\"checklist\":[\"  Scan   rodando \",\"\",7,\"Squad treinado\"],\"campoFuturo\":\"x\"}],\"revEsperada\":$(revModelos)}")
checa "modelo: checklist só de texto, aparado e sem vazios" '"checklist":["Scan rodando","Squad treinado"]' "$R"
checa "modelo antigo, sem checklist, ganha a lista vazia" '"checklist":[]' "$R"
checa "modelo com checklist preserva campo desconhecido" '"campoFuturo":"x"' "$R"

# ---------- 3.19: passos juntados (campo opcional do registro) ----------
R=$(curl -s -X PUT $B/api/tarefas/pj1 -H "$J" -d '{"tarefa":{"id":"pj1","titulo":"Com passos juntados","registros":[{"id":"rj1","tipo":"nota","data":"2026-11-20","titulo":"Origem","proximosPassos":[{"id":"pa","texto":"Fica"}],"passosJuntados":[{"id":"pb","texto":"Fica","feito":true,"juntadoEm":"2026-11-21T10:00:00.000Z","juntadoCom":{"registroId":"rj1","passoId":"pa"},"campoFuturo":"x"},"solto",{"id":"pc","texto":"Sem destino","juntadoCom":{"registroId":7}}]},{"id":"rj2","tipo":"nota","data":"2026-11-21","titulo":"Sem juncao","passosJuntados":[]}]},"revEsperada":null}')
checa "passos juntados: vão e voltam com a data, o destino e o campo desconhecido" '"id":"pb","texto":"Fica","feito":false,"juntadoEm":"2026-11-21T10:00:00.000Z","juntadoCom":{"registroId":"rj1","passoId":"pa"},"campoFuturo":"x"' "$R"
checa "passos juntados: destino malformado vira nulo, sem derrubar o passo" '"id":"pc","texto":"Sem destino","juntadoCom":null' "$R"
checa "passos juntados: o que não é passo fica de fora" '2' "$(echo "$R" | grep -o '"juntadoEm":' | wc -l | tr -d ' ')"
checa "passos juntados: registro sem junção não ganha o campo" '1' "$(echo "$R" | grep -o '"passosJuntados":' | wc -l | tr -d ' ')"
checa "passos juntados: ficam no arquivo da tarefa" '"juntadoEm": "2026-11-21T10:00:00.000Z"' "$(cat "$TMP/dados/tarefas/pj1.json")"
checa "passos juntados: não contam como pendência no espelho em Markdown" '1' "$(grep -c -- '- \[ \] Fica' "$TMP/dados/markdown/"*--pj1.md)"

# ---------- 3.21: reunião como campo opcional do bloco da rotina ----------
RJ=$(curl -s $B/api/dados | sed 's/.*"jornada":{"rev":\([0-9]*\).*/\1/')
R=$(curl -s -X PUT $B/api/jornada -H "$J" -d "{\"items\":[{\"id\":\"config\"},{\"id\":\"2026-11-18\",\"planejado\":true,\"blocos\":[{\"id\":\"blr1\",\"inicio\":\"09:00\",\"fim\":\"10:00\",\"titulo\":\"Semanal\",\"tipo\":\"atividade\",\"reuniao\":{\"participantes\":[\"  Otto   Teste \",\"otto teste\",7,\"Zuleica Prado\"],\"tarefaId\":\"../x\",\"campoFuturo\":\"y\"}},{\"id\":\"blr2\",\"inicio\":\"12:00\",\"fim\":\"13:00\",\"titulo\":\"Almoco\",\"tipo\":\"pausa\",\"reuniao\":{\"participantes\":[\"Otto\"]}},{\"id\":\"blr3\",\"inicio\":\"14:00\",\"fim\":\"15:00\",\"titulo\":\"Chamados\",\"tipo\":\"atividade\"},{\"id\":\"blr4\",\"inicio\":\"15:00\",\"fim\":\"16:00\",\"titulo\":\"Com tarefa\",\"tipo\":\"atividade\",\"reuniao\":{\"participantes\":[],\"tarefaId\":\"pj1\"}}]}],\"revEsperada\":$RJ}")
checa "reunião do bloco: participantes limpos e sem repetir, id torto de tarefa não entra, campo desconhecido fica" '"reuniao":{"participantes":["Otto Teste","Zuleica Prado"],"tarefaId":null,"campoFuturo":"y"}' "$R"
checa "reunião do bloco: guarda a tarefa quando o id tem forma de id" '"reuniao":{"participantes":[],"tarefaId":"pj1"}' "$R"
checa "reunião do bloco: pausa não é reunião, e bloco comum não ganha o campo" '2' "$(echo "$R" | grep -o '"reuniao":' | wc -l | tr -d ' ')"
checa "reunião do bloco: fica no arquivo da rotina" '"tarefaId": "pj1"' "$(cat "$TMP/dados/jornada.json")"

# ---------- 3.17: importar um arquivo exportado ----------
imp() { curl -s -X POST "$B/api/importar$1" -H 'Content-Type: text/plain; charset=utf-8' --data-binary "@$2"; }
curl -s $B/api/exportar >"$TMP/export.json"
R=$(imp "" "$TMP/export.json")
checa "importar: o próprio export pode ser importado" '"importavel":true' "$R"
checa "importar: o próprio export não tem nada de novo nem de diferente" 'ok' "$(echo "$R" | grep -Eq '"entram":[1-9]|"conflitos":[1-9]' && echo diferente || echo ok)"
checa "importar: sem nada a trazer, não grava nem tira foto" '"foto":null,"entraram":0,"trocados":0' "$(imp "?aplicar=1&modo=arquivo" "$TMP/export.json")"
cat >"$TMP/novo.json" <<'EOF'
{"exportadoEm":"2026-11-23T12:00:00.000Z","schema":1,
 "tarefas":[
  {"id":"imp1","titulo":"Veio do arquivo","campoFuturo":"fica","criadaEm":"2026-11-01T10:00:00.000Z","atualizadaEm":"2026-11-01T10:00:00.000Z"},
  {"id":"ck1","titulo":"Checklist no arquivo","criadaEm":"2020-01-01T10:00:00.000Z","atualizadaEm":"2020-01-01T10:00:00.000Z"},
  {"id":"../fora","titulo":"Sai da pasta"}],
 "categorias":{"rev":1,"items":[{"id":"cimp","nome":"Categoria importada"}]}}
EOF
LIXO_ANTES=$(ls "$TMP/dados/_lixeira" | wc -l | tr -d ' ')
R=$(imp "" "$TMP/novo.json")
checa "importar: prévia conta o que entra e o que está diferente" '"grupo":"tarefas","noArquivo":2,"entram":1,"exemplosDeEntrada":["Veio do arquivo"],"conflitos":1,"maisNovosNoArquivo":0' "$R"
checa "importar: item com id que sairia da pasta fica de fora" '"ignorados":1' "$R"
checa "importar: a prévia não grava nada" 'ok' "$([ -e "$TMP/dados/tarefas/imp1.json" ] && echo gravou || echo ok)"
R=$(imp "?aplicar=1&modo=manter" "$TMP/novo.json")
checa "importar (manter): entra o que faltava e o diferente fica como está aqui" '"entraram":2,"trocados":0,"mantidos":1' "$R"
FOTO=$(echo "$R" | sed 's/.*"foto":"\([^"]*\)".*/\1/')
checa "importar: tira uma foto do estado de antes" 'pre-importacao-' "$FOTO"
checa "importar: a foto está na pasta de backups" 'tarefas' "$(ls "$TMP/dados/_backups/$FOTO" 2>/dev/null)"
checa "importar: a tarefa nova foi gravada com o campo desconhecido" '"campoFuturo": "fica"' "$(cat "$TMP/dados/tarefas/imp1.json")"
checa "importar: a tarefa nova ganhou o espelho em Markdown" 'Veio do arquivo' "$(cat "$TMP/dados/markdown/"*--imp1.md 2>/dev/null)"
checa "importar (manter): a tarefa que já existia não mudou" 'Renomeada' "$(cat "$TMP/dados/tarefas/ck1.json")"
checa "importar: nada foi escrito fora da pasta de tarefas" 'ok' "$({ [ -e "$TMP/dados/fora.json" ] || [ -e "$TMP/fora.json" ]; } && echo vazou || echo ok)"
C=$(cat "$TMP/dados/categorias.json")
checa "importar: a categoria nova entrou" 'Categoria importada' "$C"
checa "importar: as categorias que já existiam continuam" 'Categoria renomeada depois' "$C"
checa "importar: nada vai para a lixeira" "$LIXO_ANTES" "$(ls "$TMP/dados/_lixeira" | wc -l | tr -d ' ')"
checa "importar: modo desconhecido vale manter" '"trocados":0' "$(imp "?aplicar=1&modo=apagar-tudo" "$TMP/novo.json")"
checa "importar (recente): o lado mexido por último fica, e aqui é mais novo" '"trocados":0' "$(imp "?aplicar=1&modo=recente" "$TMP/novo.json")"
R=$(imp "?aplicar=1&modo=arquivo" "$TMP/novo.json")
checa "importar (arquivo): troca o que estava diferente" '"entraram":0,"trocados":1,"mantidos":0' "$R"
FOTO2=$(echo "$R" | sed 's/.*"foto":"\([^"]*\)".*/\1/')
T=$(cat "$TMP/dados/tarefas/ck1.json")
checa "importar (arquivo): a tarefa passou a ser a do arquivo" 'Checklist no arquivo' "$T"
checa "importar (arquivo): a revisão sobe além da que estava aqui" '"rev": 3' "$T"
checa "importar: aba com dado velho recebe 409" '409' "$(curl -s -o /dev/null -w '%{http_code}' -X PUT $B/api/tarefas/ck1 -H "$J" -d '{"tarefa":{"id":"ck1","titulo":"aba velha"},"revEsperada":2}')"
checa "importar: cada importação que grava tem a sua foto" 'ok' "$([ "$FOTO" != "$FOTO2" ] && [ -d "$TMP/dados/_backups/$FOTO2" ] && echo ok || echo mesma)"
checa "importar tem volta: a foto aparece na lista de backups" "$FOTO2" "$(curl -s $B/api/backup)"
curl -s -X POST $B/api/backup/restaurar -H "$J" -d "{\"nome\":\"$FOTO2\"}" >/dev/null
checa "importar tem volta: restaurar a foto devolve a tarefa de antes" 'Renomeada' "$(cat "$TMP/dados/tarefas/ck1.json")"
printf '{ quebrado' >"$TMP/ruim.json"
checa "importar: arquivo que não é JSON é recusado" 'JSON válido' "$(imp "" "$TMP/ruim.json")"
printf '[1,2,3]' >"$TMP/ruim.json"
checa "importar: JSON que não é um export é recusado" 'não parece um export' "$(imp "?aplicar=1&modo=arquivo" "$TMP/ruim.json")"
printf '{"schema":99,"tarefas":[{"id":"futuro1","titulo":"De uma versão mais nova"}]}' >"$TMP/futuro.json"
checa "importar: export de versão mais nova aparece como não importável" '"importavel":false' "$(imp "" "$TMP/futuro.json")"
checa "importar: export de versão mais nova é recusado" 'versão mais nova' "$(imp "?aplicar=1&modo=arquivo" "$TMP/futuro.json")"
checa "importar: export recusado não grava nada" 'ok' "$([ -e "$TMP/dados/tarefas/futuro1.json" ] && echo gravou || echo ok)"
checa "importar: CSRF, recusa pedido vindo de outro site" '403' "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/api/importar?aplicar=1&modo=arquivo" -H 'Origin: https://evil.example' --data-binary "@$TMP/novo.json")"

echo; [ $FALHAS -eq 0 ] && echo "Tudo certo." || { echo "$FALHAS falha(s)."; exit 1; }
