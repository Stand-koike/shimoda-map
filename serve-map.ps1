# web/index.html をローカルで開くための簡易 HTTP サーバー（WebGL で file:// が失敗することがあるため）
$ErrorActionPreference = 'Stop'
$webDir = Join-Path $PSScriptRoot 'web'
if (-not (Test-Path $webDir)) {
    Write-Error "web folder not found: $webDir"
}
Set-Location -LiteralPath $webDir
$port = if ($env:MAP_PORT) { [int]$env:MAP_PORT } else { 8080 }
Write-Host "Serving http://localhost:$port/  (cwd: $webDir)"
Write-Host "Press Ctrl+C to stop."

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    python -m http.server $port
    exit $LASTEXITCODE
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($npx) {
    npx --yes serve -l $port .
    exit $LASTEXITCODE
}

Write-Error 'python または npx が見つかりません。Python を入れるか Node.js をインストールしてください。'
