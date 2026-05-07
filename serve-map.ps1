# map/index.html をローカルで開くための簡易 HTTP サーバー（WebGL で file:// が失敗することがあるため）
$ErrorActionPreference = 'Stop'
$mapDir = Join-Path $PSScriptRoot 'map'
if (-not (Test-Path $mapDir)) {
    Write-Error "map folder not found: $mapDir"
}
Set-Location -LiteralPath $mapDir
$port = if ($env:MAP_PORT) { [int]$env:MAP_PORT } else { 8080 }
Write-Host "Serving http://localhost:$port/  (cwd: $mapDir)"
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
