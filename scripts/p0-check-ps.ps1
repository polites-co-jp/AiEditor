# RETIRED (2026-11-15): Phase 0 is closed. Do not run this script. If it has to run again, first change it
# to use buildRoot (scripts\lib\local-config.ps1) instead of C:\b. Decision: docs/user-decisions.md,
# 2026-11-15 "build location and the rest of Phase 0". (This script itself does not use C:\b.)
<#
.SYNOPSIS
  Syntax check of PowerShell scripts with the PowerShell parser (no execution), plus an
  ASCII-only check (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-check-ps.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/p0-check-ps.ps1 -Path scripts\p0-env.ps1
#>
[CmdletBinding()]
param([string[]]$Path)

$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Path) {
    $Path = @(Get-ChildItem -LiteralPath (Join-Path $repo 'scripts') -Recurse -File -Filter '*.ps1' | ForEach-Object { $_.FullName })
}
$bad = 0
foreach ($p in $Path) {
    $full = $p
    if (-not [IO.Path]::IsPathRooted($full)) { $full = Join-Path $repo $p }
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($full, [ref]$tokens, [ref]$errors)
    $bytes = [IO.File]::ReadAllBytes($full)
    $nonAscii = 0
    foreach ($b in $bytes) { if ($b -gt 127) { $nonAscii++ } }
    $rel = $full.Substring($repo.Length + 1)
    if ($errors.Count -gt 0) {
        $bad++
        foreach ($e in $errors) { Write-Host ("ERR  {0}:{1}:{2} {3}" -f $rel, $e.Extent.StartLineNumber, $e.Extent.StartColumnNumber, $e.Message) }
    } else {
        Write-Host ("OK   {0} (non-ASCII bytes: {1})" -f $rel, $nonAscii)
    }
}
Write-Host "PowerShell $($PSVersionTable.PSVersion); files: $($Path.Count); with errors: $bad"
if ($bad -gt 0) { exit 1 }
