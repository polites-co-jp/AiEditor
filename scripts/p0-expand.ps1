# Expand a zip (Phase 0 materials; called from scripts/p0-fetch.mjs). Runs on Windows PowerShell 5.1.
# This file is ASCII only: Windows PowerShell 5.1 reads BOM-less files in the ANSI code page.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-expand.ps1 -Zip <zip> -Dest <dir> [-Force]
#   If <dir> is not empty, it is removed and re-expanded only with -Force (otherwise skipped with exit 0).
#   <dir> must be under C:\b\ (never delete outside the build work area).
param(
  [Parameter(Mandatory = $true)][string]$Zip,
  [Parameter(Mandatory = $true)][string]$Dest,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$destFull = [System.IO.Path]::GetFullPath($Dest)
if (-not $destFull.StartsWith('C:\b\', [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination must be under C:\b\ : $destFull"
}
if (-not (Test-Path -LiteralPath $Zip -PathType Leaf)) { throw "zip not found: $Zip" }

if (Test-Path -LiteralPath $destFull) {
  $items = @(Get-ChildItem -LiteralPath $destFull -Force)
  if ($items.Count -gt 0) {
    if (-not $Force) {
      Write-Output "[expand] destination is not empty; skipped (use -Force to recreate): $destFull"
      exit 0
    }
    Write-Output "[expand] removing destination: $destFull"
    Remove-Item -LiteralPath $destFull -Recurse -Force
  }
}
New-Item -ItemType Directory -Path $destFull -Force | Out-Null

Write-Output "[expand] $Zip -> $destFull"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
[System.IO.Compression.ZipFile]::ExtractToDirectory($Zip, $destFull)
$sw.Stop()
$count = @(Get-ChildItem -LiteralPath $destFull -Recurse -File -Force).Count
Write-Output ("[expand] done: {0} files, {1:N1} s" -f $count, $sw.Elapsed.TotalSeconds)
