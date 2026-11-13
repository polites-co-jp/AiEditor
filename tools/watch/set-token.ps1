<#
.SYNOPSIS
  Saves the Notion token of the update watcher, protected with DPAPI (docs/06 section 2.4).

.DESCRIPTION
  The user runs this once (and again when the token is renewed). The token is typed at a hidden prompt
  (Read-Host -AsSecureString); it is never taken from an argument, never printed and never logged.
  ConvertFrom-SecureString without a key uses DPAPI of the current user, so only this user on this PC
  can read the file back (scripts/lib/read-secret.ps1).

  Default file: %LOCALAPPDATA%\Shuko\watch\notion-token.dpapi (fixed place, docs/06 section 2.1).
  The file is written to "<file>.tmp" first and then moved into place. After saving, the script reads
  the file back with scripts/lib/read-secret.ps1 and reports only the length.

.PARAMETER Path
  Another file to write (trials). Default: %LOCALAPPDATA%\Shuko\watch\notion-token.dpapi
.PARAMETER Force
  Overwrite an existing file (renewing the token).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\set-token.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools\watch\set-token.ps1 -Force

  NOTE: this file is ASCII only on purpose (Windows PowerShell 5.1 reads BOM-less scripts as ANSI).
#>
[CmdletBinding()]
param(
    [string]$Path,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not $Path) {
    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set' }
    $Path = Join-Path $env:LOCALAPPDATA 'Shuko\watch\notion-token.dpapi'
}
$Path = [IO.Path]::GetFullPath($Path)

if ((Test-Path -LiteralPath $Path) -and -not $Force) {
    Write-Host "set-token: $Path already exists. Run again with -Force to replace it."
    exit 1
}

$dir = Split-Path -Parent $Path
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$secure = Read-Host -Prompt 'Notion token of the update watcher (input is hidden)' -AsSecureString
if ($null -eq $secure -or $secure.Length -eq 0) {
    Write-Host 'set-token: empty input; nothing was saved.'
    exit 1
}

$tmp = $Path + '.tmp'
try {
    $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $tmp -Encoding Ascii
    Move-Item -LiteralPath $tmp -Destination $Path -Force
} finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    $secure.Dispose()
}

# Read it back the same way the watcher does (separate process), and report only the length.
$reader = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\scripts\lib\read-secret.ps1'))
$value = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $reader -Path $Path
if ($LASTEXITCODE -ne 0 -or -not $value) {
    Write-Host "set-token: saved to $Path, but reading it back failed (exit $LASTEXITCODE)."
    exit 1
}
$len = ([string]$value).Length
$value = $null
Write-Host "set-token: saved to $Path (DPAPI, current user). Read back OK; length $len."
exit 0
