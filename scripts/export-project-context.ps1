$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$UpdatePath = Join-Path $PSScriptRoot "update-project-context.ps1"
$Downloads = Join-Path $env:USERPROFILE "Downloads"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$StagingRoot = Join-Path $env:TEMP ("PodiumWatch_Project_Context_" + $Timestamp)
$ZipPath = Join-Path $Downloads ("PodiumWatch_Project_Context_" + $Timestamp + ".zip")
$LatestPath = Join-Path $Downloads "PodiumWatch_Project_Context_Latest.zip"
$Utf8 = [System.Text.UTF8Encoding]::new($false)

if (Test-Path $UpdatePath) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UpdatePath

  if ($LASTEXITCODE -ne 0) {
    throw "The project index refresh failed."
  }
}

$ExcludedNames = @(
  ".git",
  ".vercel",
  ".cache",
  ".backups",
  "backups",
  "backup",
  "node_modules",
  "dist",
  "coverage",
  "project_exports"
)

$ExcludedFiles = @(
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.preview"
)

$ExcludedExtensions = @(
  ".pem",
  ".key",
  ".pfx",
  ".p12"
)

function Test-IsExcluded {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.FileInfo]$File
  )

  $Relative = $File.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@("\", "/"))
  $Parts = $Relative -split "[\\/]"

  foreach ($Part in $Parts) {
    $Lower = $Part.ToLowerInvariant()

    if ($ExcludedNames -contains $Lower) {
      return $true
    }

    if ($Lower -like "*backup*") {
      return $true
    }
  }

  $LowerName = $File.Name.ToLowerInvariant()

  if ($ExcludedFiles -contains $LowerName) {
    return $true
  }

  if ($LowerName.StartsWith(".env") -and $LowerName -ne ".env.example") {
    return $true
  }

  if ($ExcludedExtensions -contains $File.Extension.ToLowerInvariant()) {
    return $true
  }

  if ($File.Length -gt 50MB) {
    return $true
  }

  return $false
}

if (Test-Path $StagingRoot) {
  Remove-Item $StagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $StagingRoot -Force | Out-Null

$Files = @(
  Get-ChildItem -Path $ProjectRoot -Recurse -File -Force
)

$Included = New-Object "System.Collections.Generic.List[string]"
$Skipped = New-Object "System.Collections.Generic.List[string]"

foreach ($File in $Files) {
  $Relative = $File.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@("\", "/"))

  if (Test-IsExcluded -File $File) {
    [void]$Skipped.Add($Relative)
    continue
  }

  $Destination = Join-Path $StagingRoot $Relative
  $DestinationFolder = Split-Path $Destination -Parent

  New-Item -ItemType Directory -Path $DestinationFolder -Force | Out-Null
  Copy-Item -Path $File.FullName -Destination $Destination -Force
  [void]$Included.Add($Relative)
}

$Manifest = New-Object System.Text.StringBuilder
[void]$Manifest.AppendLine("Podium Watch project context export")
[void]$Manifest.AppendLine("Created: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
[void]$Manifest.AppendLine("Project: " + $ProjectRoot)
[void]$Manifest.AppendLine("Files included: " + $Included.Count)
[void]$Manifest.AppendLine("Files skipped: " + $Skipped.Count)
[void]$Manifest.AppendLine("")
[void]$Manifest.AppendLine("Included files")
[void]$Manifest.AppendLine("")

foreach ($Item in ($Included | Sort-Object)) {
  [void]$Manifest.AppendLine($Item)
}

$ManifestPath = Join-Path $StagingRoot "PROJECT_EXPORT_MANIFEST.txt"
[System.IO.File]::WriteAllText($ManifestPath, $Manifest.ToString(), $Utf8)

if (Test-Path $ZipPath) {
  Remove-Item $ZipPath -Force
}

Compress-Archive -Path (Join-Path $StagingRoot "*") -DestinationPath $ZipPath -CompressionLevel Optimal -Force

if (-not (Test-Path $ZipPath)) {
  throw "The project context ZIP was not created."
}

Copy-Item -Path $ZipPath -Destination $LatestPath -Force
Remove-Item $StagingRoot -Recurse -Force

$ZipFile = Get-Item $LatestPath

Write-Host ""
Write-Host "Podium Watch context export created." -ForegroundColor Green
Write-Host "Files included: $($Included.Count)"
Write-Host "File size: $([math]::Round($ZipFile.Length / 1MB, 2)) MB"
Write-Host ""
Write-Host "Upload this file to a new chat:" -ForegroundColor Cyan
Write-Host $LatestPath -ForegroundColor Cyan
Write-Host ""