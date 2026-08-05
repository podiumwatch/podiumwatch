$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$UpdateScript = Join-Path $PSScriptRoot "update-project-context.ps1"

Set-Location $ProjectRoot

Write-Host ""
Write-Host "Podium Watch project health review" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

Write-Host "Git status" -ForegroundColor Yellow
& git status --short

Write-Host ""
Write-Host "Building website" -ForegroundColor Yellow
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
  throw "The website build failed."
}

Write-Host ""
Write-Host "Running quality checker" -ForegroundColor Yellow
npm.cmd run check

if ($LASTEXITCODE -ne 0) {
  throw "The quality checker failed."
}

if (Test-Path $UpdateScript) {
  Write-Host ""
  Write-Host "Refreshing project context" -ForegroundColor Yellow

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UpdateScript

  if ($LASTEXITCODE -ne 0) {
    throw "The project context refresh failed."
  }
}

Write-Host ""
Write-Host "Podium Watch project health review passed." -ForegroundColor Green
Write-Host ""