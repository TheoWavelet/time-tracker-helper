$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionDirectory = Join-Path $projectRoot 'browser-extension'
$manifestPath = Join-Path $extensionDirectory 'manifest.json'
$releaseDirectory = Join-Path $projectRoot 'release'

if (-not (Test-Path $manifestPath)) {
  throw "Extension manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if (-not $manifest.version) {
  throw 'browser-extension/manifest.json must declare a version.'
}

New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
$archivePath = Join-Path $releaseDirectory "time-tracker-bridge-$($manifest.version).zip"
Remove-Item -Force -ErrorAction SilentlyContinue $archivePath

Compress-Archive -Path (Join-Path $extensionDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal
Write-Host "Created extension package: $archivePath"