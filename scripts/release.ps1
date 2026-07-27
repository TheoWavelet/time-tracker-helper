$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
$extensionManifest = Get-Content -Raw (Join-Path $projectRoot 'browser-extension/manifest.json') | ConvertFrom-Json
$releaseDirectory = Join-Path $projectRoot 'release'

Push-Location $projectRoot
try {
  npm run dist
  if ($LASTEXITCODE -ne 0) { throw 'Windows installer build failed.' }

  npm run package:extension
  if ($LASTEXITCODE -ne 0) { throw 'Browser extension package build failed.' }
} finally {
  Pop-Location
}

$installerName = "Time-Tracker-$($package.version)-Setup.exe"
$extensionName = "time-tracker-bridge-$($extensionManifest.version).zip"
$installerPath = Join-Path $releaseDirectory $installerName
$extensionPath = Join-Path $releaseDirectory $extensionName

foreach ($artifactPath in @($installerPath, $extensionPath)) {
  if (-not (Test-Path $artifactPath)) {
    throw "Expected release artifact was not created: $artifactPath"
  }
}

Write-Host "Release complete (in $releaseDirectory):"
Write-Host "  $installerName"
Write-Host "  $extensionName"