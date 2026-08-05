$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$DocsRoot = Join-Path $ProjectRoot "docs"
$OutputPath = Join-Path $DocsRoot "AUTO_PROJECT_INDEX.md"
$Utf8 = [System.Text.UTF8Encoding]::new($false)

New-Item -ItemType Directory -Path $DocsRoot -Force | Out-Null

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

function Test-IsExcluded {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $Relative = $Path.Substring($ProjectRoot.Length).TrimStart([char[]]@("\", "/"))
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

  return $false
}

$AllFiles = @(
  Get-ChildItem -Path $ProjectRoot -Recurse -File -Force |
    Where-Object {
      -not (Test-IsExcluded -Path $_.FullName)
    }
)

$ApiRoot = Join-Path $ProjectRoot "api"
$PagesRoot = Join-Path $ProjectRoot "src\pages"
$BuildPath = Join-Path $ProjectRoot "scripts\build.mjs"
$PackagePath = Join-Path $ProjectRoot "package.json"

$ApiFiles = @()
$PageFiles = @()
$Routes = New-Object "System.Collections.Generic.HashSet[string]"
$EnvironmentNames = New-Object "System.Collections.Generic.HashSet[string]"
$TableNames = New-Object "System.Collections.Generic.HashSet[string]"

if (Test-Path $ApiRoot) {
  $ApiFiles = @(
    Get-ChildItem -Path $ApiRoot -Recurse -File |
      Where-Object {
        $_.Extension.ToLowerInvariant() -in @(".js", ".mjs")
      }
  )
}

if (Test-Path $PagesRoot) {
  $PageFiles = @(
    Get-ChildItem -Path $PagesRoot -Recurse -File
  )
}

if (Test-Path $BuildPath) {
  $BuildText = Get-Content $BuildPath -Raw
  $RouteMatches = [regex]::Matches($BuildText, 'writePage\(\s*["'']([^"'']+)["'']')

  foreach ($Match in $RouteMatches) {
    [void]$Routes.Add($Match.Groups[1].Value)
  }
}

$TextExtensions = @(
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".sql",
  ".txt",
  ".csv"
)

foreach ($File in $AllFiles) {
  if ($TextExtensions -notcontains $File.Extension.ToLowerInvariant()) {
    continue
  }

  try {
    $Text = Get-Content $File.FullName -Raw -ErrorAction Stop
  }
  catch {
    continue
  }

  foreach ($Match in [regex]::Matches($Text, 'process\.env\.([A-Z][A-Z0-9_]*)')) {
    [void]$EnvironmentNames.Add($Match.Groups[1].Value)
  }

  foreach ($Match in [regex]::Matches($Text, '\.from\(\s*["'']([^"'']+)["'']\s*\)')) {
    [void]$TableNames.Add($Match.Groups[1].Value)
  }
}

$PackageScripts = @()

if (Test-Path $PackagePath) {
  try {
    $Package = Get-Content $PackagePath -Raw | ConvertFrom-Json

    if ($Package.scripts) {
      foreach ($Property in $Package.scripts.PSObject.Properties) {
        $PackageScripts += [pscustomobject]@{
          Name = $Property.Name
          Command = [string]$Property.Value
        }
      }
    }
  }
  catch {
    $PackageScripts = @()
  }
}

$GitStatus = @()
$GitCommit = @()

try {
  $GitStatus = @(& git -C $ProjectRoot status --short 2>&1)
  $GitCommit = @(& git -C $ProjectRoot log -1 --pretty=format:"%H | %ad | %s" --date=iso 2>&1)
}
catch {
  $GitStatus = @("Git status unavailable")
  $GitCommit = @("Git history unavailable")
}

$Builder = New-Object System.Text.StringBuilder

function Add-Line {
  param(
    [AllowEmptyString()]
    [string]$Text = ""
  )

  [void]$Builder.AppendLine($Text)
}

Add-Line "# Podium Watch automatic project index"
Add-Line ""
Add-Line ("Generated: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Add-Line ("Project: " + $ProjectRoot)
Add-Line ""
Add-Line "This file is generated from the current project."
Add-Line ""
Add-Line "## Project summary"
Add-Line ""
Add-Line "| Item | Count |"
Add-Line "|---|---:|"
Add-Line ("| Included source files | " + $AllFiles.Count + " |")
Add-Line ("| Page source files | " + $PageFiles.Count + " |")
Add-Line ("| API files | " + $ApiFiles.Count + " |")
Add-Line ("| Route references | " + $Routes.Count + " |")
Add-Line ("| Environment variable names | " + $EnvironmentNames.Count + " |")
Add-Line ("| Supabase table references | " + $TableNames.Count + " |")
Add-Line ""
Add-Line "## Git state"
Add-Line ""
Add-Line "Latest commit:"
Add-Line ""

foreach ($Line in $GitCommit) {
  Add-Line ([string]$Line)
}

Add-Line ""
Add-Line "Working tree:"
Add-Line ""

if ($GitStatus.Count -gt 0) {
  foreach ($Line in $GitStatus) {
    Add-Line ([string]$Line)
  }
}
else {
  Add-Line "Working tree clean"
}

Add-Line ""
Add-Line "## Package commands"
Add-Line ""

if ($PackageScripts.Count -gt 0) {
  Add-Line "| Name | Command |"
  Add-Line "|---|---|"

  foreach ($Script in ($PackageScripts | Sort-Object Name)) {
    $SafeCommand = $Script.Command.Replace("|", "\|")
    Add-Line ("| " + $Script.Name + " | " + $SafeCommand + " |")
  }
}
else {
  Add-Line "No package commands were read."
}

Add-Line ""
Add-Line "## Public routes"
Add-Line ""

if ($Routes.Count -gt 0) {
  foreach ($Route in ($Routes | Sort-Object)) {
    Add-Line ("1. " + $Route)
  }
}
else {
  Add-Line "No static route references were detected."
}

Add-Line ""
Add-Line "## API endpoints"
Add-Line ""

if ($ApiFiles.Count -gt 0) {
  foreach ($File in ($ApiFiles | Sort-Object FullName)) {
    $Relative = $File.FullName.Substring($ApiRoot.Length).TrimStart([char[]]@("\", "/"))
    $Route = "/api/" + (($Relative -replace "\\", "/") -replace "\.(js|mjs)$", "")
    Add-Line ("1. " + $Route)
  }
}
else {
  Add-Line "No API endpoints were found."
}

Add-Line ""
Add-Line "## Environment variable names"
Add-Line ""
Add-Line "Values are intentionally excluded."
Add-Line ""

if ($EnvironmentNames.Count -gt 0) {
  foreach ($Name in ($EnvironmentNames | Sort-Object)) {
    Add-Line ("1. " + $Name)
  }
}
else {
  Add-Line "No environment variable references were detected."
}

Add-Line ""
Add-Line "## Supabase table references"
Add-Line ""

if ($TableNames.Count -gt 0) {
  foreach ($Name in ($TableNames | Sort-Object)) {
    Add-Line ("1. " + $Name)
  }
}
else {
  Add-Line "No Supabase table references were detected."
}

Add-Line ""
Add-Line "## Page source files"
Add-Line ""

if ($PageFiles.Count -gt 0) {
  foreach ($File in ($PageFiles | Sort-Object FullName)) {
    $Relative = $File.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@("\", "/"))
    Add-Line ("1. " + $Relative)
  }
}
else {
  Add-Line "No page source files were found."
}

Add-Line ""
Add-Line "## Main project folders"
Add-Line ""

$TopFolders = @(
  Get-ChildItem -Path $ProjectRoot -Directory -Force |
    Where-Object {
      -not (Test-IsExcluded -Path $_.FullName)
    } |
    Sort-Object Name
)

foreach ($Folder in $TopFolders) {
  Add-Line ("1. " + $Folder.Name)
}

[System.IO.File]::WriteAllText($OutputPath, $Builder.ToString(), $Utf8)

Write-Host ""
Write-Host "Project context index updated." -ForegroundColor Green
Write-Host $OutputPath -ForegroundColor Cyan
Write-Host ""