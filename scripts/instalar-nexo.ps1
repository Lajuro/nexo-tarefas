# ============================================================================
#  Nexo - instalar / atualizar sem git clone
#
#  Uso (PowerShell):
#    irm https://raw.githubusercontent.com/Lajuro/nexo-tarefas/main/scripts/instalar-nexo.ps1 | iex
#  ou, com o arquivo salvo:
#    powershell -ExecutionPolicy Bypass -File .\instalar-nexo.ps1
#
#  O que ele faz:
#    1. baixa o codigo do GitHub (zip; se falhar, arquivo por arquivo)
#    2. guarda a versao atual em <pasta>-anterior (para voltar se der problema)
#    3. espelha o codigo novo na pasta do app (sem tocar em node_modules)
#    4. npm install + npm run build
#
#  Ele NUNCA mexe nos seus dados: eles ficam na pasta escolhida no app
#  (ex.: OneDrive\Nexo) e a configuracao fica em %USERPROFILE%\.nexo
# ============================================================================

$ErrorActionPreference = "Stop"
$Repo    = if ($env:NEXO_REPO)    { $env:NEXO_REPO }    else { "Lajuro/nexo-tarefas" }
$Branch  = if ($env:NEXO_BRANCH)  { $env:NEXO_BRANCH }  else { "main" }
$Destino = if ($env:NEXO_DESTINO) { $env:NEXO_DESTINO } else { Join-Path $env:USERPROFILE "nexo-app" }

function Info($m) { Write-Host "  > $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK $m" -ForegroundColor Green }
function Falha($m){ Write-Host "  ERRO $m" -ForegroundColor Red; throw "Instalacao do Nexo interrompida." }

Write-Host ""
Write-Host "  NEXO - instalar/atualizar" -ForegroundColor White
Write-Host "  repo: $Repo ($Branch)   pasta do app: $Destino"
Write-Host ""

# proxy corporativo: usa as credenciais do Windows
try {
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
  [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials
} catch {}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Falha "Node.js nao encontrado no PATH." }
if (-not (Get-Command npm  -ErrorAction SilentlyContinue)) { Falha "npm nao encontrado no PATH." }

# seguranca: a pasta de dados nao pode estar dentro da pasta do app
$cfgPath = Join-Path $env:USERPROFILE ".nexo\config.json"
if (Test-Path $cfgPath) {
  try {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if ($cfg.dataDir) {
      $dd = [System.IO.Path]::GetFullPath($cfg.dataDir).TrimEnd('\') + '\'
      $ap = [System.IO.Path]::GetFullPath($Destino).TrimEnd('\') + '\'
      if ($dd.StartsWith($ap, [System.StringComparison]::OrdinalIgnoreCase)) {
        Falha "Sua pasta de dados ($($cfg.dataDir)) esta DENTRO da pasta do app. Mova os dados para outro lugar antes de atualizar."
      }
      Info "Seus dados ficam em $($cfg.dataDir) (nao serao tocados)."
    }
  } catch {}
}

$tmp = Join-Path $env:TEMP ("nexo-" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Path $tmp | Out-Null
$codigo = Join-Path $tmp "codigo"

# 1) download
$baixou = $false
try {
  Info "Baixando zip do GitHub..."
  $zip = Join-Path $tmp "repo.zip"
  Invoke-WebRequest -UseBasicParsing -Uri "https://codeload.github.com/$Repo/zip/refs/heads/$Branch" -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath (Join-Path $tmp "zip") -Force
  $raiz = Get-ChildItem (Join-Path $tmp "zip") -Directory | Select-Object -First 1
  Move-Item $raiz.FullName $codigo
  $baixou = $true
  Ok "Zip baixado."
} catch {
  Info "Zip bloqueado ($($_.Exception.Message)). Tentando arquivo por arquivo..."
}

if (-not $baixou) {
  try {
    $arvore = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/git/trees/$Branch`?recursive=1" -Headers @{ "User-Agent" = "nexo-instalador" }
    $arquivos = $arvore.tree | Where-Object { $_.type -eq "blob" }
    $i = 0
    foreach ($a in $arquivos) {
      $i++
      $alvo = Join-Path $codigo ($a.path -replace "/", "\")
      New-Item -ItemType Directory -Force -Path (Split-Path $alvo) | Out-Null
      $url = "https://raw.githubusercontent.com/$Repo/$Branch/$($a.path)"
      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $alvo
      Write-Progress -Activity "Baixando arquivos" -Status $a.path -PercentComplete (100 * $i / $arquivos.Count)
    }
    Write-Progress -Activity "Baixando arquivos" -Completed
    Ok "$($arquivos.Count) arquivos baixados."
  } catch {
    Falha "Nao consegui baixar o codigo: $($_.Exception.Message)"
  }
}

if (-not (Test-Path (Join-Path $codigo "package.json"))) { Falha "Download incompleto (package.json nao veio)." }

# 2) guarda a versao atual
if (Test-Path (Join-Path $Destino "package.json")) {
  $anterior = "$Destino-anterior"
  Info "Guardando a versao atual em $anterior ..."
  robocopy $Destino $anterior /MIR /XD node_modules .next /NFL /NDL /NJH /NJS /NP | Out-Null
}

# 3) espelha o codigo novo (node_modules e .next ficam onde estao)
Info "Copiando codigo para $Destino ..."
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
robocopy $codigo $Destino /MIR /XD node_modules .next /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Falha "robocopy falhou (codigo $LASTEXITCODE)." }
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

# 4) dependencias e build
Push-Location $Destino
try {
  Info "npm install (pode demorar na primeira vez)..."
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou" }
  Info "npm run build..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build falhou" }
} catch {
  Pop-Location
  Falha "$($_.Exception.Message). A versao anterior continua em $Destino-anterior."
}
Pop-Location

# atalho na area de trabalho
try {
  $desk = [Environment]::GetFolderPath("Desktop")
  $ws = New-Object -ComObject WScript.Shell
  $lnk = $ws.CreateShortcut((Join-Path $desk "Nexo.lnk"))
  $lnk.TargetPath = Join-Path $Destino "Iniciar Nexo.cmd"
  $lnk.WorkingDirectory = $Destino
  $lnk.Save()
  Ok "Atalho 'Nexo' criado na area de trabalho."
} catch {}

$versao = (Get-Content (Join-Path $Destino "package.json") -Raw | ConvertFrom-Json).version
Write-Host ""
Ok "Nexo $versao pronto. Abra pelo atalho 'Nexo' ou rode 'Iniciar Nexo.cmd' em $Destino"
Write-Host ""
